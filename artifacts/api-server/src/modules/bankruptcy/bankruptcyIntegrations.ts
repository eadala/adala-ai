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
