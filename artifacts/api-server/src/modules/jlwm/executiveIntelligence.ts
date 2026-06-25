/**
 * JLWM Phase 3 — Executive Intelligence Engine
 * Generates Office Intelligence Reports: weekly/monthly summaries,
 * revenue forecasts, risk concentration, lawyer performance, client risk.
 * All data is tenant-isolated via office_id.
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI }                from "../ai/aiChat";
import { extractJSON }           from "./jlwmAI";

const router = Router();

const EI_SYSTEM = `أنت نظام الذكاء التنفيذي JLWM — مستشار استراتيجي لمدير المكتب القانوني.
مهمتك تحليل أداء المكتب وإنتاج تقارير تنفيذية عالية الجودة بالعربية.
كن دقيقاً وعملياً. استند للأرقام الفعلية. لا تختلق بيانات. أعد JSON فقط بدون أي نص إضافي.`;

/* ── DB Bootstrap ────────────────────────────────────────────── */
export async function ensureExecutiveTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS jlwm_executive_reports (
      id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id           TEXT NOT NULL,
      report_type         TEXT NOT NULL DEFAULT 'weekly',
      period_start        TIMESTAMPTZ NOT NULL,
      period_end          TIMESTAMPTZ NOT NULL,
      executive_summary   TEXT,
      kpis                JSONB NOT NULL DEFAULT '{}',
      revenue_forecast    JSONB NOT NULL DEFAULT '{}',
      risk_concentration  JSONB NOT NULL DEFAULT '{}',
      lawyer_performance  JSONB NOT NULL DEFAULT '[]',
      client_risk         JSONB NOT NULL DEFAULT '[]',
      opportunities       JSONB NOT NULL DEFAULT '[]',
      alerts              JSONB NOT NULL DEFAULT '[]',
      generated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      model_used          TEXT,
      generation_ms       INT
    )
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_jer_office ON jlwm_executive_reports(office_id)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_jer_type ON jlwm_executive_reports(office_id, report_type, generated_at DESC)
  `).catch(() => {});
}

/* ── Data Collectors ─────────────────────────────────────────── */
async function collectOfficeData(officeId: string, since: Date) {
  const sinceISO = since.toISOString();

  const [cases, revenue, lawyers, clients, tasks, invoices] = await Promise.all([
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('open','جديدة','قيد النظر','active'))::int AS active,
        COUNT(*) FILTER (WHERE status IN ('closed','منتهية'))::int AS closed,
        COUNT(*) FILTER (WHERE status IN ('won','فاز'))::int AS won,
        COUNT(*) FILTER (WHERE created_at >= ${sinceISO}::timestamptz)::int AS new_period,
        COUNT(*) FILTER (WHERE hearing_date BETWEEN NOW() AND NOW()+INTERVAL '30 days')::int AS upcoming_hearings
      FROM cases WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),

    db.execute(sql`
      SELECT
        COALESCE(SUM(amount),0)::float AS total_revenue,
        COUNT(*)::int AS revenue_count,
        COALESCE(AVG(amount),0)::float AS avg_revenue,
        COALESCE(SUM(amount) FILTER (WHERE date >= ${sinceISO}::timestamptz),0)::float AS period_revenue
      FROM revenues WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),

    db.execute(sql`
      SELECT
        em.id, em.name, em.email,
        COUNT(DISTINCT c.id)::int AS case_count,
        COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('done','completed','مكتملة'))::int AS completed_tasks,
        COUNT(DISTINCT t.id)::int AS total_tasks
      FROM employees em
      LEFT JOIN cases c ON c.responsible_id::text = em.id::text AND c.office_id = ${officeId}
      LEFT JOIN tasks t ON t.assigned_to::text = em.id::text AND t.office_id = ${officeId}
      WHERE em.office_id = ${officeId}
      GROUP BY em.id, em.name, em.email
      ORDER BY case_count DESC
      LIMIT 10
    `).catch(() => ({ rows: [] })),

    db.execute(sql`
      SELECT
        cl.id, cl.name,
        COUNT(DISTINCT c.id)::int AS case_count,
        COALESCE(SUM(ci.total_amount),0)::float AS invoiced_total,
        COALESCE(SUM(ci.total_amount) FILTER (WHERE ci.status='pending'),0)::float AS unpaid_total,
        MAX(c.updated_at) AS last_activity
      FROM clients cl
      LEFT JOIN cases c ON c.client_id::text = cl.id::text AND c.office_id = ${officeId}
      LEFT JOIN client_invoices ci ON ci.client_id::text = cl.id::text AND ci.office_id = ${officeId}
      WHERE cl.office_id = ${officeId}
      GROUP BY cl.id, cl.name
      ORDER BY unpaid_total DESC
      LIMIT 10
    `).catch(() => ({ rows: [] })),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status NOT IN ('done','completed','مكتملة') AND due_date < NOW())::int AS overdue,
        COUNT(*) FILTER (WHERE status NOT IN ('done','completed','مكتملة') AND due_date BETWEEN NOW() AND NOW()+INTERVAL '7 days')::int AS due_soon
      FROM tasks WHERE office_id = ${officeId}
    `).catch(() => ({ rows: [{}] })),

    db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='pending')::int AS pending,
        COALESCE(SUM(total_amount) FILTER (WHERE status='pending'),0)::float AS pending_amount,
        COALESCE(SUM(total_amount) FILTER (WHERE status='paid'),0)::float AS collected_period
      FROM client_invoices
      WHERE office_id = ${officeId}
        AND created_at >= ${sinceISO}::timestamptz
    `).catch(() => ({ rows: [{}] })),
  ]);

  return {
    cases:   cases.rows[0] as any ?? {},
    revenue: revenue.rows[0] as any ?? {},
    lawyers: lawyers.rows as any[],
    clients: clients.rows as any[],
    tasks:   tasks.rows[0] as any ?? {},
    invoices: invoices.rows[0] as any ?? {},
  };
}

/* ── AI Report Generator ─────────────────────────────────────── */
async function generateReport(officeId: string, reportType: "weekly" | "monthly" | "quarterly", data: any) {
  const intervalDays = reportType === "weekly" ? 7 : reportType === "monthly" ? 30 : 90;
  const label = reportType === "weekly" ? "أسبوعي" : reportType === "monthly" ? "شهري" : "ربع سنوي";

  const prompt = `أنت تقوم بإنشاء تقرير تنفيذي ${label} لمكتب محاماة. البيانات:

${JSON.stringify(data, null, 2)}

أنتج JSON بالهيكل التالي بدقة (بدون أي نص خارج JSON):
{
  "executive_summary": "ملخص تنفيذي شامل (3-4 جمل بالعربية)",
  "kpis": {
    "win_rate": <رقم 0-100>,
    "case_velocity": <معدل إغلاق القضايا>,
    "revenue_growth": <نسبة نمو الإيرادات>,
    "team_efficiency": <كفاءة الفريق 0-100>,
    "client_satisfaction_index": <مؤشر رضا العملاء 0-100>
  },
  "revenue_forecast": {
    "next_period_estimate": <تقدير إيرادات الفترة القادمة>,
    "confidence": <0-100>,
    "growth_drivers": ["عامل1","عامل2"],
    "risks": ["خطر1","خطر2"],
    "monthly_breakdown": [{"month":"شهر","amount":0}]
  },
  "risk_concentration": {
    "high_risk_clients": [{"name":"اسم","risk":"وصف المخاطر","unpaid_amount":0}],
    "case_type_concentration": [{"type":"نوع","count":0,"revenue_share":0}],
    "geographic_concentration": [],
    "overall_risk_score": <0-100>
  },
  "lawyer_performance": [
    {"name":"اسم","cases":0,"efficiency":0,"score":0,"trend":"up|down|stable","insights":"ملاحظة"}
  ],
  "client_risk": [
    {"name":"اسم","risk_level":"high|medium|low","unpaid":0,"last_activity":"تاريخ","recommendation":"توصية"}
  ],
  "opportunities": ["فرصة1","فرصة2","فرصة3"],
  "alerts": [
    {"severity":"high|medium|low","message":"تنبيه","action":"إجراء مقترح"}
  ]
}`;

  const startMs = Date.now();
  const result  = await callAI(EI_SYSTEM, prompt, [], "auto", officeId, "executive_report").catch(() => null);
  const durationMs = Date.now() - startMs;

  if (!result?.reply) return { report: buildFallbackReport(data, label), modelUsed: "fallback", durationMs };

  const parsed = extractJSON(result.reply);
  if (!parsed) return { report: buildFallbackReport(data, label), modelUsed: "fallback", durationMs };

  return { report: parsed, modelUsed: result.modelUsed ?? "auto", durationMs };
}

function buildFallbackReport(data: any, label: string): any {
  const wonRate = Number(data.cases.total ?? 0) > 0
    ? Math.round(Number(data.cases.won ?? 0) / Number(data.cases.total ?? 1) * 100)
    : 50;
  return {
    executive_summary: `تقرير ${label} للمكتب القانوني. القضايا النشطة: ${data.cases.active ?? 0}. الإيرادات الإجمالية: ${data.revenue.total_revenue ?? 0} ريال.`,
    kpis: { win_rate: wonRate, case_velocity: Number(data.cases.closed ?? 0), revenue_growth: 0, team_efficiency: 70, client_satisfaction_index: 75 },
    revenue_forecast: { next_period_estimate: Number(data.revenue.period_revenue ?? 0) * 1.1, confidence: 60, growth_drivers: [], risks: [], monthly_breakdown: [] },
    risk_concentration: { high_risk_clients: [], case_type_concentration: [], geographic_concentration: [], overall_risk_score: 30 },
    lawyer_performance: (data.lawyers as any[]).map((l: any) => ({
      name: l.name, cases: l.case_count, efficiency: l.total_tasks > 0 ? Math.round(l.completed_tasks / l.total_tasks * 100) : 50,
      score: 70, trend: "stable", insights: "أداء طبيعي",
    })),
    client_risk: (data.clients as any[]).slice(0, 5).map((c: any) => ({
      name: c.name, risk_level: Number(c.unpaid_total ?? 0) > 5000 ? "high" : "low",
      unpaid: Number(c.unpaid_total ?? 0), last_activity: c.last_activity, recommendation: "متابعة",
    })),
    opportunities: ["زيادة عدد القضايا في المجال التجاري", "تطوير علاقات العملاء الحاليين"],
    alerts: [],
  };
}

/* ── Routes ──────────────────────────────────────────────────── */

/* Generate a new executive report */
router.post("/jlwm/executive/generate", requireAuthWithTenant, async (req, res) => {
  const officeId   = (req as any).tenantId as string;
  const reportType = (req.body.type ?? "weekly") as "weekly" | "monthly" | "quarterly";
  const intervalDays = reportType === "weekly" ? 7 : reportType === "monthly" ? 30 : 90;

  const since    = new Date(Date.now() - intervalDays * 86400_000);
  const now      = new Date();
  const data     = await collectOfficeData(officeId, since);
  const { report, modelUsed, durationMs } = await generateReport(officeId, reportType, data);

  const kpis   = report.kpis ?? {};
  const rfcast  = report.revenue_forecast ?? {};
  const rconc   = report.risk_concentration ?? {};
  const lperf   = report.lawyer_performance ?? [];
  const crisk   = report.client_risk ?? [];
  const opps    = report.opportunities ?? [];
  const alerts  = report.alerts ?? [];

  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_executive_reports
      (office_id, report_type, period_start, period_end, executive_summary,
       kpis, revenue_forecast, risk_concentration, lawyer_performance,
       client_risk, opportunities, alerts, model_used, generation_ms)
    VALUES
      (${officeId}, ${reportType}, ${since.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz,
       ${report.executive_summary ?? ""}::text,
       ${JSON.stringify(kpis)}::jsonb, ${JSON.stringify(rfcast)}::jsonb,
       ${JSON.stringify(rconc)}::jsonb, ${JSON.stringify(lperf)}::jsonb,
       ${JSON.stringify(crisk)}::jsonb, ${JSON.stringify(opps)}::jsonb,
       ${JSON.stringify(alerts)}::jsonb, ${modelUsed}, ${durationMs})
    RETURNING *
  `).catch((e: any) => { throw e; });

  res.json({ ok: true, report: rows[0] });
});

/* List reports */
router.get("/jlwm/executive/reports", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const limit    = Math.min(Number(req.query.limit ?? 10), 50);
  const type     = req.query.type as string | undefined;

  const { rows } = await db.execute(sql`
    SELECT id, office_id, report_type, period_start, period_end,
           executive_summary, kpis, generated_at, model_used
    FROM jlwm_executive_reports
    WHERE office_id = ${officeId}
      ${type ? sql`AND report_type = ${type}` : sql``}
    ORDER BY generated_at DESC
    LIMIT ${limit}
  `).catch(() => ({ rows: [] }));

  res.json({ reports: rows });
});

/* Get a specific report */
router.get("/jlwm/executive/reports/:id", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const id       = String(req.params.id);

  const { rows } = await db.execute(sql`
    SELECT * FROM jlwm_executive_reports
    WHERE id = ${id} AND office_id = ${officeId}
    LIMIT 1
  `).catch(() => ({ rows: [] }));

  if (!rows.length) return res.status(404).json({ error: "التقرير غير موجود" });
  res.json(rows[0]);
});

/* Latest report (or generate fresh if none in last 24h) */
router.get("/jlwm/executive/latest", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const type     = (req.query.type ?? "weekly") as string;

  const { rows } = await db.execute(sql`
    SELECT * FROM jlwm_executive_reports
    WHERE office_id = ${officeId} AND report_type = ${type}
      AND generated_at >= NOW() - INTERVAL '24 hours'
    ORDER BY generated_at DESC
    LIMIT 1
  `).catch(() => ({ rows: [] }));

  if (rows.length) return res.json(rows[0]);

  const intervalDays = type === "weekly" ? 7 : type === "monthly" ? 30 : 90;
  const since = new Date(Date.now() - intervalDays * 86400_000);
  const now   = new Date();
  const data  = await collectOfficeData(officeId, since);
  const { report, modelUsed, durationMs } = await generateReport(officeId, type as any, data);

  const { rows: inserted } = await db.execute(sql`
    INSERT INTO jlwm_executive_reports
      (office_id, report_type, period_start, period_end, executive_summary,
       kpis, revenue_forecast, risk_concentration, lawyer_performance,
       client_risk, opportunities, alerts, model_used, generation_ms)
    VALUES
      (${officeId}, ${type}, ${since.toISOString()}::timestamptz, ${now.toISOString()}::timestamptz,
       ${report.executive_summary ?? ""}::text,
       ${JSON.stringify(report.kpis ?? {})}::jsonb,
       ${JSON.stringify(report.revenue_forecast ?? {})}::jsonb,
       ${JSON.stringify(report.risk_concentration ?? {})}::jsonb,
       ${JSON.stringify(report.lawyer_performance ?? [])}::jsonb,
       ${JSON.stringify(report.client_risk ?? [])}::jsonb,
       ${JSON.stringify(report.opportunities ?? [])}::jsonb,
       ${JSON.stringify(report.alerts ?? [])}::jsonb,
       ${modelUsed}, ${durationMs})
    RETURNING *
  `).catch((e: any) => { throw e; });

  res.json(inserted[0]);
});

/* Live KPI snapshot (no AI, pure DB) */
router.get("/jlwm/executive/kpis", requireAuthWithTenant, async (req, res) => {
  const officeId = (req as any).tenantId as string;
  const data = await collectOfficeData(officeId, new Date(Date.now() - 30 * 86400_000));
  res.json({ kpis: data });
});

export default router;
