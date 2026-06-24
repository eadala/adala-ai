/**
 * bankruptcyIntegrations.ts
 * Phase 1 cross-module wiring for the Bankruptcy module:
 *   ① Telegram notifications  (5 events)
 *   ② Storage file registration (reports + court packages)
 *   ③ callAI wrapper with correct officeId (credits deducted automatically)
 *
 * All functions are fire-and-forget (void) to never block the HTTP response.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI as _callAI } from "../ai/aiChat";
import { eventBus } from "../../core/eventBus";
import type { EventType } from "../../core/eventBus";
import { auditLog } from "../../lib/auditLogger";

/* ── db helpers ── */
function sqlOne(r: any): any { const rows = Array.isArray(r) ? r : (r?.rows ?? []); return rows[0] ?? null; }

/* ══════════════════════════════════════════════════════════
   ① callAI WRAPPER — correct parameter order + credits
══════════════════════════════════════════════════════════ */
export type BkAnalysisType =
  | "bankruptcy_analysis"
  | "bankruptcy_eligibility"
  | "bankruptcy_court_package"
  | "bankruptcy_qa";

export async function callBkAI(
  systemPrompt: string,
  userMessage: string,
  officeId: string,
  queryType: BkAnalysisType = "bankruptcy_analysis",
  userId = "system",
): Promise<string> {
  try {
    const { reply } = await _callAI(
      systemPrompt,
      userMessage,
      [],          // no history
      "auto",      // model
      officeId,    // ← credits deducted here
      queryType,
      userId,
    );
    return reply;
  } catch {
    return "";
  }
}

/* ══════════════════════════════════════════════════════════
   ② STORAGE — register bankruptcy documents in storage_files
══════════════════════════════════════════════════════════ */
export async function saveReportToStorage(opts: {
  officeId: string;
  caseId:   string;
  title:    string;
  content:  string | null;
  reportId: string;
  reportType: string;
}): Promise<void> {
  try {
    const { officeId, caseId, title, content, reportId, reportType } = opts;
    const fileSize = content ? Buffer.byteLength(content, "utf8") : 0;
    const fileName = `bk_report_${reportId}.txt`;
    const category = "bankruptcy";

    // Check for duplicate (idempotent)
    const exists = sqlOne(await db.execute(sql`
      SELECT id FROM storage_files WHERE file_name = ${fileName} AND office_id = ${officeId} LIMIT 1
    `).catch(() => null));
    if (exists) return;

    await db.execute(sql`
      INSERT INTO storage_files
        (office_id, case_id, original_name, file_name, mime_type, file_size,
         file_url, storage_key, category)
      VALUES
        (${officeId}, ${caseId}::uuid,
         ${title + (reportType ? " [" + reportType + "]" : "")},
         ${fileName}, 'text/plain', ${fileSize},
         ${"/api/bankruptcy/cases/" + caseId + "/reports"},
         ${"bk/" + officeId + "/" + fileName},
         ${category})
    `).catch(() => {});
  } catch { /* non-fatal */ }
}

/* ══════════════════════════════════════════════════════════
   ③ TELEGRAM — per-office notifications for 5 BK events
══════════════════════════════════════════════════════════ */

/** Lookup telegram settings for a specific office, fall back to 'default' */
async function getTelegramSettings(officeId: string): Promise<any | null> {
  try {
    const specific = sqlOne(await db.execute(sql`
      SELECT * FROM telegram_settings
      WHERE office_id = ${officeId} AND enabled = TRUE AND bot_token IS NOT NULL AND chat_id IS NOT NULL
      LIMIT 1
    `).catch(() => null));
    if (specific) return specific;

    // fall back to platform default
    const def = sqlOne(await db.execute(sql`
      SELECT * FROM telegram_settings
      WHERE office_id = 'default' AND enabled = TRUE AND bot_token IS NOT NULL AND chat_id IS NOT NULL
      LIMIT 1
    `).catch(() => null));
    return def ?? null;
  } catch { return null; }
}

async function sendTg(officeId: string, text: string, eventType: string): Promise<void> {
  try {
    const s = await getTelegramSettings(officeId);
    if (!s) return;

    const url = `https://api.telegram.org/bot${s.bot_token}/sendMessage`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: s.chat_id, text, parse_mode: "HTML" }),
    }).catch(() => null);
    const ok = (resp as any)?.ok ?? false;

    await db.execute(sql`
      INSERT INTO telegram_logs (office_id, chat_id, message, type, status, error)
      VALUES (${officeId}, ${s.chat_id}, ${text}, ${eventType},
              ${ok ? "sent" : "failed"}, ${ok ? null : "send failed"})
    `).catch(() => {});
  } catch { /* non-fatal */ }
}

/* Event 1 — Case status changed */
export async function tgBkCaseStatus(officeId: string, caseName: string, oldStatus: string, newStatus: string): Promise<void> {
  const STATUS_AR: Record<string, string> = {
    active: "نشط 🟢", suspended: "موقوف ⏸️", claims_review: "مراجعة مطالبات 🔍",
    asset_management: "إدارة أصول 📦", distribution: "توزيع 💰",
    closed: "مغلق ✅", archived: "مؤرشف 🗄️",
  };
  const text = [
    `⚖️ <b>تحديث حالة ملف إفلاس</b>`,
    ``,
    `📂 <b>المدين:</b> ${caseName}`,
    `📌 <b>الحالة السابقة:</b> ${STATUS_AR[oldStatus] ?? oldStatus}`,
    `✅ <b>الحالة الجديدة:</b> ${STATUS_AR[newStatus] ?? newStatus}`,
    ``,
    `<i>عدالة AI — نظام الإفلاس</i>`,
  ].join("\n");
  void sendTg(officeId, text, "bk_case_status");
}

/* Event 2 — Meeting scheduled */
export async function tgBkMeeting(officeId: string, caseName: string, meetingTitle: string, meetingDate: string | null, meetingType: string): Promise<void> {
  const TYPE_AR: Record<string, string> = {
    creditors: "اجتماع الدائنين 🤝", trustee: "اجتماع أمين الإفلاس 👔",
    court: "جلسة المحكمة ⚖️", committee: "اجتماع اللجنة 📋",
    valuation: "اجتماع التقييم 📊", other: "اجتماع آخر 📅",
  };
  const text = [
    `📅 <b>اجتماع إفلاس جديد</b>`,
    ``,
    `📂 <b>الملف:</b> ${caseName}`,
    `🎯 <b>النوع:</b> ${TYPE_AR[meetingType] ?? meetingType}`,
    `📌 <b>العنوان:</b> ${meetingTitle}`,
    meetingDate ? `🗓️ <b>الموعد:</b> ${new Date(meetingDate).toLocaleDateString("ar-SA", { dateStyle: "full" })}` : null,
    ``,
    `<i>عدالة AI — نظام الإفلاس</i>`,
  ].filter(Boolean).join("\n");
  void sendTg(officeId, text, "bk_meeting");
}

/* Event 3 — Distribution executed */
export async function tgBkDistribution(officeId: string, caseName: string, round: number, totalAmount: number, status: string): Promise<void> {
  if (status !== "executed" && status !== "approved") return;
  const text = [
    `💰 <b>${status === "executed" ? "تم تنفيذ توزيع" : "اعتماد توزيع"}</b>`,
    ``,
    `📂 <b>الملف:</b> ${caseName}`,
    `🔢 <b>الجولة:</b> ${round}`,
    `💵 <b>المبلغ:</b> ${Number(totalAmount).toLocaleString("ar-SA")} ريال`,
    `📌 <b>الحالة:</b> ${status === "executed" ? "منفَّذ ✅" : "معتمد 🟡"}`,
    ``,
    `<i>عدالة AI — نظام الإفلاس</i>`,
  ].join("\n");
  void sendTg(officeId, text, "bk_distribution");
}

/* Event 4 — Critical alert triggered */
export async function tgBkAlert(officeId: string, caseName: string, alertTitle: string, severity: string): Promise<void> {
  if (severity !== "critical" && severity !== "high") return;
  const SEV: Record<string, string> = { critical: "🚨 حرج", high: "🔴 مرتفع" };
  const text = [
    `${severity === "critical" ? "🚨" : "🔴"} <b>تنبيه إفلاس — ${SEV[severity] ?? severity}</b>`,
    ``,
    `📂 <b>الملف:</b> ${caseName}`,
    `⚠️ <b>التنبيه:</b> ${alertTitle}`,
    ``,
    `<i>يرجى المراجعة الفورية — عدالة AI</i>`,
  ].join("\n");
  void sendTg(officeId, text, "bk_alert");
}

/* Event 5 — AI analysis completed */
export async function tgBkAiAnalysis(officeId: string, caseName: string, analysisType: string): Promise<void> {
  const TYPE_AR: Record<string, string> = {
    general: "عام", claims: "المطالبات", assets: "الأصول",
    risk: "المخاطر", financial: "مالي", summary: "ملخص تنفيذي", trustee_report: "تقرير الأمين",
  };
  const text = [
    `🤖 <b>تحليل ذكاء اصطناعي — اكتمل</b>`,
    ``,
    `📂 <b>الملف:</b> ${caseName}`,
    `🔍 <b>نوع التحليل:</b> ${TYPE_AR[analysisType] ?? analysisType}`,
    `✅ <b>التقرير:</b> جاهز للمراجعة في المنصة`,
    ``,
    `<i>عدالة AI — نظام الإفلاس</i>`,
  ].join("\n");
  void sendTg(officeId, text, "bk_ai_analysis");
}

/* ══════════════════════════════════════════════════════════
   PHASE 2-A — EventBus / EDA Integration
   Emits typed BK events into the platform event stream
   (persisted to system_events + SSE broadcast to dashboards)
══════════════════════════════════════════════════════════ */
export async function bkEmit(
  officeId: string,
  type: EventType,
  data: Record<string, any>,
  actorId?: string,
): Promise<void> {
  try {
    await eventBus.emit({ type, officeId, actorId, data });
  } catch { /* non-fatal */ }
}

/* ══════════════════════════════════════════════════════════
   PHASE 2-B — Global Platform Audit Trail
   Writes to audit_logs (the platform-wide table) in addition
   to the module-local bk_audit_logs, giving super-admin
   cross-module visibility and enabling compliance exports.
══════════════════════════════════════════════════════════ */
export async function auditLogBk(opts: {
  officeId:   string;
  userId?:    string;
  action:     string;        // "bk.case.create" | "bk.distribution.execute" | …
  resourceId: string;
  details?:   string;
  oldValue?:  Record<string, unknown> | null;
  newValue?:  Record<string, unknown> | null;
  ip?:        string;
  ua?:        string;
}): Promise<void> {
  void auditLog({
    officeId:     opts.officeId,
    userId:       opts.userId,
    action:       opts.action,
    resource:     "bankruptcy",
    resourceId:   opts.resourceId,
    details:      opts.details,
    oldValue:     opts.oldValue,
    newValue:     opts.newValue,
    ipAddress:    opts.ip,
    userAgent:    opts.ua,
  });
}

/* ══════════════════════════════════════════════════════════
   PHASE 3 — Finance Auto-posting
   When a bankruptcy distribution is executed, the trustee
   (law office) earns a management fee.  We auto-post this
   fee as a revenue entry in the accounting module so it
   appears in P&L, cash-flow, and financial reports without
   manual data entry.

   Default trustee fee = 2 % of total distributed amount
   (per Saudi Bankruptcy Law Article 56 guidelines).
   Stored in revenues with category "أتعاب قضائية" so it
   maps to Chart-of-Accounts code 4100 automatically.
══════════════════════════════════════════════════════════ */
export async function autoPostBkRevenue(opts: {
  officeId:       string;
  caseId:         string;
  caseNumber:     string;
  debtorName:     string;
  distributionId: string;
  round:          number;
  totalAmount:    number;
  /** trustee fee percentage — defaults to 2 % */
  feePct?:        number;
  executedAt?:    string;
}): Promise<void> {
  try {
    const {
      officeId, caseId, caseNumber, debtorName,
      distributionId, round, totalAmount,
      feePct = 2, executedAt,
    } = opts;

    const fee = Math.round(totalAmount * feePct / 100 * 100) / 100;
    if (fee <= 0) return;

    const date = executedAt
      ? new Date(executedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const title = `رسوم أمين الإفلاس — ${debtorName} (${caseNumber}) جولة ${round}`;

    /* Idempotency: skip if already posted for this distribution */
    const dup = sqlOne(await db.execute(sql`
      SELECT id FROM revenues
      WHERE office_id = ${officeId}
        AND notes LIKE ${"%" + distributionId + "%"}
      LIMIT 1
    `).catch(() => null));
    if (dup) return;

    await db.execute(sql`
      INSERT INTO revenues
        (office_id, title, category, amount, payment_method, date, case_id, notes)
      VALUES
        (${officeId},
         ${title},
         ${"أتعاب قضائية"},
         ${fee},
         ${"bank"},
         ${date},
         ${caseId}::uuid,
         ${"auto-posted from bankruptcy distribution " + distributionId + " (" + feePct + "% of " + totalAmount + ")"})
    `).catch(() => {});

    /* Also log this as an audit event */
    void auditLogBk({
      officeId,
      action:     "bk.distribution.revenue_posted",
      resourceId: distributionId,
      details:    `رسوم أمين إفلاس تلقائية: ${fee.toLocaleString("ar-SA")} ر.س (${feePct}% من ${totalAmount.toLocaleString("ar-SA")} ر.س) — ملف ${caseNumber}`,
    });
  } catch { /* non-fatal */ }
}
