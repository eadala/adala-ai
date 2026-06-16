/**
 * Autonomous Legal OS Layer
 * - Daily automated recommendations per office
 * - Self-monitoring with health scoring
 * - Auto-healing proposals
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI } from "../aiChat";
import { buildOfficeContext } from "./context-builder";

function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function first(r: any): any  { const a = rows(r); return a[0] ?? null; }

/* ── Daily Office Health Score ──────────────────────────────────────────── */
export async function computeOfficeHealth(officeId: string): Promise<{
  score: number;
  issues: string[];
  strengths: string[];
}> {
  const ctx = await buildOfficeContext(officeId);
  const issues: string[]    = [];
  const strengths: string[] = [];
  let score = 100;

  if (ctx.criticalCases > 0) {
    issues.push(`${ctx.criticalCases} قضايا حرجة تحتاج اهتماماً فورياً`);
    score -= Math.min(ctx.criticalCases * 5, 20);
  }
  if (ctx.unpaidAmount > 50000) {
    issues.push(`ديون غير محصّلة: ${ctx.unpaidAmount.toLocaleString("ar-SA")} ر.س`);
    score -= 10;
  }
  if (ctx.unpaidInvoices > 5) {
    issues.push(`${ctx.unpaidInvoices} فاتورة غير محصّلة`);
    score -= 5;
  }
  if (ctx.pendingTasks > 20) {
    issues.push(`${ctx.pendingTasks} مهمة معلقة`);
    score -= 5;
  }
  if (ctx.upcomingSessions === 0 && ctx.activeCases > 0) {
    issues.push("لا جلسات مجدولة رغم وجود قضايا نشطة");
    score -= 5;
  }
  if (ctx.activeCases > 5) {
    strengths.push(`${ctx.activeCases} قضية نشطة تُدار بكفاءة`);
  }
  if (ctx.monthRevenue > 10000) {
    strengths.push(`إيرادات جيدة هذا الشهر: ${ctx.monthRevenue.toLocaleString("ar-SA")} ر.س`);
  }
  if (ctx.openClients > 10) {
    strengths.push(`قاعدة عملاء واسعة: ${ctx.openClients} عميل نشط`);
  }

  return { score: Math.max(score, 0), issues, strengths };
}

/* ── Daily Automated Report ─────────────────────────────────────────────── */
export async function generateDailyReport(officeId: string): Promise<{
  title: string;
  summary: string;
  recommendations: string[];
  score: number;
}> {
  const [health, ctx] = await Promise.all([
    computeOfficeHealth(officeId),
    buildOfficeContext(officeId),
  ]);

  const prompt = `اكتب تقريراً يومياً موجزاً لمكتب محاماة بناءً على هذه البيانات:

درجة الصحة: ${health.score}/100
قضايا نشطة: ${ctx.activeCases} | حرجة: ${ctx.criticalCases}
عملاء: ${ctx.openClients} | موظفون: ${ctx.employees}
فواتير غير محصّلة: ${ctx.unpaidInvoices} (${ctx.unpaidAmount.toLocaleString("ar-SA")} ر.س)
إيرادات اليوم: ${ctx.monthRevenue.toLocaleString("ar-SA")} ر.س
مهام معلقة: ${ctx.pendingTasks} | جلسات قادمة: ${ctx.upcomingSessions}

المشاكل المكتشفة:
${health.issues.map(i => `- ${i}`).join("\n") || "لا مشاكل"}

اكتب:
1. ملخص تنفيذي (3 أسطر)
2. 3-5 توصيات عملية وقابلة للتنفيذ اليوم

الصيغة: JSON بشكل:
{"summary": "...", "recommendations": ["...", "..."]}`;

  try {
    const { reply } = await callAI(
      "أنت مساعد قانوني ذكي يُنشئ تقارير يومية موجزة ودقيقة.",
      prompt
    );
    const cleaned = reply.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: `التقرير اليومي — درجة الصحة ${health.score}/100`,
      summary: parsed.summary ?? reply,
      recommendations: parsed.recommendations ?? health.issues,
      score: health.score,
    };
  } catch {
    return {
      title: `التقرير اليومي — درجة الصحة ${health.score}/100`,
      summary: `المكتب يعمل بدرجة صحة ${health.score}/100. ${health.issues[0] ?? ""}`,
      recommendations: health.issues.length ? health.issues : ["متابعة العمليات اليومية"],
      score: health.score,
    };
  }
}

/* ── Self-Healing Proposals ──────────────────────────────────────────────── */
export async function detectAndProposeHealing(officeId: string): Promise<void> {
  const ctx   = await buildOfficeContext(officeId);
  const proposals: {title: string; description: string; severity: string; category: string; fix_type: string}[] = [];

  if (ctx.unpaidInvoices > 0 && ctx.unpaidAmount > 0) {
    proposals.push({
      title: `تحصيل ${ctx.unpaidInvoices} فاتورة معلقة`,
      description: `توجد ${ctx.unpaidInvoices} فاتورة غير محصّلة بإجمالي ${ctx.unpaidAmount.toLocaleString("ar-SA")} ر.س. يُنصح بإرسال تذكيرات فورية.`,
      severity: ctx.unpaidAmount > 100000 ? "critical" : "high",
      category: "business",
      fix_type: "manual",
    });
  }
  if (ctx.criticalCases > 0) {
    proposals.push({
      title: `مراجعة ${ctx.criticalCases} قضية حرجة`,
      description: `${ctx.criticalCases} قضية مصنفة كحرجة تحتاج مراجعة فورية لتجنب تفويت مواعيد قانونية.`,
      severity: "critical",
      category: "legal",
      fix_type: "manual",
    });
  }
  if (ctx.pendingTasks > 15) {
    proposals.push({
      title: `تراكم المهام: ${ctx.pendingTasks} مهمة معلقة`,
      description: `تراكم كبير في المهام قد يؤثر على جودة الخدمة. يُنصح بإعادة توزيع المهام على الفريق.`,
      severity: "medium",
      category: "operations",
      fix_type: "manual",
    });
  }

  for (const p of proposals) {
    await db.execute(sql`
      INSERT INTO dev_commander_proposals
        (id, title, description, severity, category, fix_type, status,
         affected, created_at)
      VALUES
        (gen_random_uuid()::text, ${p.title}, ${p.description},
         ${p.severity}, ${p.category}, ${p.fix_type}, 'pending',
         ${officeId}, NOW())
      ON CONFLICT DO NOTHING
    `).catch(() => {});
  }
}

/* ── Cron-style runner — call from server startup ────────────────────────── */
export async function runAutonomousForAllOffices(): Promise<void> {
  try {
    const officeRows = await db.execute(sql`
      SELECT id FROM offices WHERE status = 'active' LIMIT 50
    `) as any;
    const officeIds = rows(officeRows).map((r: any) => r.id).filter(Boolean);

    await Promise.allSettled(
      officeIds.map(async (officeId: string) => {
        try {
          await Promise.all([
            generateDailyReport(officeId),
            detectAndProposeHealing(officeId),
          ]);
        } catch { /* per-office errors are non-fatal */ }
      })
    );
  } catch { /* ignore top-level errors */ }
}
