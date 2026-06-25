/**
 * JLWM — Legal World State Engine
 * Computes the current legal world state from live office data.
 * No AI required for basic computation — AI is optional for narrative.
 */

import { Router }                  from "express";
import { db }                      from "@workspace/db";
import { sql }                     from "drizzle-orm";
import { requireAuthWithTenant }   from "../../middlewares/requireAuth";
import { callJLWMAI, extractJSON } from "./jlwmAI";

const router = Router();

/* ── Core computation (no AI) ────────────────────────────────── */
async function computeStateVector(officeId: string) {
  /* Cases metrics */
  const { rows: caseMetrics } = await db.execute(sql`
    SELECT
      COUNT(*)                                              AS total_cases,
      COUNT(*) FILTER (WHERE status IN ('active','جارية','قيد_النظر')) AS active_cases,
      COUNT(*) FILTER (WHERE status IN ('critical','عاجلة'))           AS critical_cases,
      COUNT(*) FILTER (WHERE status IN ('won','كسبنا','ربحنا'))        AS won_cases,
      COUNT(*) FILTER (WHERE status IN ('lost','خسرنا'))               AS lost_cases
    FROM cases WHERE office_id = ${officeId}
  `).catch(() => ({ rows: [{}] }));

  /* Tasks overdue */
  const { rows: taskMetrics } = await db.execute(sql`
    SELECT
      COUNT(*) AS total_tasks,
      COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('done','completed','مكتملة')) AS overdue_tasks
    FROM tasks WHERE office_id = ${officeId}
  `).catch(() => ({ rows: [{}] }));

  /* Hearings in next 7 days */
  const { rows: hearingMetrics } = await db.execute(sql`
    SELECT COUNT(*) AS upcoming_hearings
    FROM   events
    WHERE  office_id = ${officeId}
      AND  type IN ('hearing','جلسة')
      AND  date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
  `).catch(() => ({ rows: [{}] }));

  /* Revenue — current month vs last month */
  const { rows: revenueMetrics } = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE date >= DATE_TRUNC('month', NOW())), 0)              AS revenue_this_month,
      COALESCE(SUM(amount) FILTER (WHERE date >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
                                     AND date <  DATE_TRUNC('month', NOW())), 0)              AS revenue_last_month
    FROM revenues WHERE office_id = ${officeId}
  `).catch(() => ({ rows: [{}] }));

  /* Unpaid invoices */
  const { rows: invoiceMetrics } = await db.execute(sql`
    SELECT
      COUNT(*)          AS pending_invoices,
      COALESCE(SUM(total_amount),0) AS pending_amount
    FROM client_invoices
    WHERE office_id = ${officeId} AND status IN ('pending','overdue','متأخرة')
  `).catch(() => ({ rows: [{}] }));

  /* Clients */
  const { rows: clientMetrics } = await db.execute(sql`
    SELECT COUNT(*) AS total_clients FROM clients WHERE office_id = ${officeId}
  `).catch(() => ({ rows: [{}] }));

  const cm = (caseMetrics[0] ?? {}) as any;
  const tm = (taskMetrics[0] ?? {}) as any;
  const hm = (hearingMetrics[0] ?? {}) as any;
  const rm = (revenueMetrics[0] ?? {}) as any;
  const im = (invoiceMetrics[0] ?? {}) as any;
  const clm = (clientMetrics[0] ?? {}) as any;

  const activeC    = Number(cm.active_cases   ?? 0);
  const criticalC  = Number(cm.critical_cases ?? 0);
  const overdueTasks= Number(tm.overdue_tasks ?? 0);
  const revenueThis = Number(rm.revenue_this_month ?? 0);
  const revenueLast = Number(rm.revenue_last_month ?? 1);
  const revenueMomentum = revenueLast > 0
    ? Math.round(((revenueThis - revenueLast) / revenueLast) * 100) / 100
    : 0;

  const totalWon  = Number(cm.won_cases  ?? 0);
  const totalLost = Number(cm.lost_cases ?? 0);
  const winRate   = (totalWon + totalLost) > 0
    ? Math.round((totalWon / (totalWon + totalLost)) * 100) / 100
    : 0;

  const stateVector = {
    active_cases:       activeC,
    critical_cases:     criticalC,
    overdue_tasks:      overdueTasks,
    upcoming_hearings:  Number(hm.upcoming_hearings ?? 0),
    pending_invoices:   Number(im.pending_invoices  ?? 0),
    pending_amount:     Number(im.pending_amount    ?? 0),
    revenue_momentum:   revenueMomentum,
    win_rate:           winRate,
    total_clients:      Number(clm.total_clients    ?? 0),
    total_cases:        Number(cm.total_cases       ?? 0),
  };

  /* Risk level calculation */
  let riskScore = 0;
  if (criticalC > 0)     riskScore += Math.min(criticalC * 15, 40);
  if (overdueTasks > 3)  riskScore += Math.min(overdueTasks * 5, 30);
  if (Number(im.pending_invoices ?? 0) > 5) riskScore += 10;
  if (revenueMomentum < -0.1) riskScore += 20;

  let riskLevel = "green";
  if (riskScore >= 60) riskLevel = "red";
  else if (riskScore >= 35) riskLevel = "orange";
  else if (riskScore >= 15) riskLevel = "yellow";

  /* Active threats */
  const threats: any[] = [];
  if (criticalC > 0)
    threats.push({ type: "critical_cases", detail: `${criticalC} قضية حرجة تحتاج تدخلاً فورياً` });
  if (overdueTasks > 2)
    threats.push({ type: "overdue_tasks",  detail: `${overdueTasks} مهمة متأخرة عن موعدها` });
  if (Number(hm.upcoming_hearings ?? 0) > 0)
    threats.push({ type: "upcoming_hearings", detail: `${hm.upcoming_hearings} جلسة في الأسبوع القادم` });
  if (revenueMomentum < -0.1)
    threats.push({ type: "revenue_decline", detail: `الإيرادات انخفضت ${Math.abs(revenueMomentum * 100).toFixed(0)}%` });

  /* Opportunities */
  const opportunities: any[] = [];
  if (revenueMomentum > 0.1)
    opportunities.push({ type: "revenue_growth", detail: `نمو إيرادات ${(revenueMomentum * 100).toFixed(0)}%` });
  if (winRate > 0.7)
    opportunities.push({ type: "high_win_rate", detail: `معدل فوز ممتاز ${(winRate * 100).toFixed(0)}%` });

  return { stateVector, riskLevel, threats, opportunities, riskScore };
}

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/world-state — current state (last computed)
───────────────────────────────────────────────────────────── */
router.get("/jlwm/world-state", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;

    /* Get latest valid state */
    const { rows } = await db.execute(sql`
      SELECT * FROM jlwm_world_states
      WHERE  office_id = ${officeId}
      ORDER  BY computed_at DESC LIMIT 1
    `);

    if (!rows.length || new Date((rows[0] as any).valid_until) < new Date()) {
      /* Compute fresh */
      const { stateVector, riskLevel, threats, opportunities } = await computeStateVector(officeId);
      const { rows: inserted } = await db.execute(sql`
        INSERT INTO jlwm_world_states
          (office_id, risk_level, state_vector, active_threats, opportunities, state_summary, triggered_by)
        VALUES
          (${officeId}, ${riskLevel},
           ${JSON.stringify(stateVector)}::jsonb,
           ${JSON.stringify({ items: threats })}::jsonb,
           ${JSON.stringify({ items: opportunities })}::jsonb,
           ${"حالة المكتب محدّثة تلقائياً"}, 'auto')
        RETURNING *
      `);
      return res.json(inserted[0]);
    }

    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/world-state/history
───────────────────────────────────────────────────────────── */
router.get("/jlwm/world-state/history", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { limit = "30" } = req.query as { limit?: string };
    const { rows } = await db.execute(sql`
      SELECT id, risk_level, state_vector, computed_at, triggered_by
      FROM   jlwm_world_states
      WHERE  office_id = ${officeId}
      ORDER  BY computed_at DESC
      LIMIT  ${Math.min(parseInt(limit, 10), 90)}
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   POST /jlwm/world-state/compute — force recompute
───────────────────────────────────────────────────────────── */
router.post("/jlwm/world-state/compute", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "system";
    const { withNarrative = false } = req.body ?? {};

    const { stateVector, riskLevel, threats, opportunities, riskScore } =
      await computeStateVector(officeId);

    let summary = `المكتب في حالة ${riskLevel === "green" ? "ممتازة" : riskLevel === "yellow" ? "مستقرة مع تنبيهات" : riskLevel === "orange" ? "تحتاج انتباهاً" : "حرجة"}. القضايا النشطة: ${stateVector.active_cases}.`;

    if (withNarrative) {
      try {
        const { reply } = await callJLWMAI({
          task: "worldState",
          message: "اكتب ملخصاً تنفيذياً لحالة المكتب القانوني",
          officeId, userId,
          context: { stateVector, riskLevel, threats, opportunities, riskScore },
        });
        const parsed = extractJSON<{ summary?: string }>(reply);
        if (parsed?.summary) summary = parsed.summary;
        else if (reply.length < 500) summary = reply;
      } catch { /* keep fallback summary */ }
    }

    const { rows } = await db.execute(sql`
      INSERT INTO jlwm_world_states
        (office_id, risk_level, state_vector, active_threats, opportunities, state_summary, triggered_by)
      VALUES
        (${officeId}, ${riskLevel},
         ${JSON.stringify(stateVector)}::jsonb,
         ${JSON.stringify({ items: threats })}::jsonb,
         ${JSON.stringify({ items: opportunities })}::jsonb,
         ${summary}, ${"manual"})
      RETURNING *
    `);
    res.status(201).json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   GET /jlwm/world-state/patterns
───────────────────────────────────────────────────────────── */
router.get("/jlwm/world-state/patterns", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { rows } = await db.execute(sql`
      SELECT * FROM jlwm_legal_patterns
      WHERE  office_id = ${officeId} AND is_active = TRUE
      ORDER  BY confidence_score DESC, last_seen_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ─────────────────────────────────────────────────────────────
   POST /jlwm/world-state/discover-patterns — AI discovery
───────────────────────────────────────────────────────────── */
router.post("/jlwm/world-state/discover-patterns", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "system";

    /* Gather data for pattern analysis */
    const { rows: caseSummary } = await db.execute(sql`
      SELECT case_type, status, COUNT(*) AS cnt,
             AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400)::int AS avg_days
      FROM   cases WHERE office_id = ${officeId}
      GROUP  BY case_type, status LIMIT 30
    `).catch(() => ({ rows: [] }));

    const { rows: revSummary } = await db.execute(sql`
      SELECT EXTRACT(QUARTER FROM date) AS quarter, ROUND(SUM(amount)) AS total
      FROM   revenues WHERE office_id = ${officeId}
      GROUP  BY quarter ORDER BY quarter
    `).catch(() => ({ rows: [] }));

    const { reply } = await callJLWMAI({
      task: "patternDiscovery",
      message: "اكتشف الأنماط في بيانات المكتب القانوني",
      officeId, userId,
      context: { caseSummary, revSummary },
    });

    const parsed = extractJSON<{ patterns?: any[] }>(reply);
    const patterns = parsed?.patterns ?? [];
    let inserted = 0;

    for (const p of patterns) {
      await db.execute(sql`
        INSERT INTO jlwm_legal_patterns
          (office_id, pattern_type, pattern_name, description, confidence_score, applies_to)
        VALUES
          (${officeId}, ${p.type ?? "outcome"}, ${p.name ?? "نمط"}, ${p.description ?? ""},
           ${p.confidence ?? 0.5}, ${JSON.stringify(p.applies_to ?? {})}::jsonb)
        ON CONFLICT DO NOTHING
      `).then(() => inserted++).catch(() => {});
    }

    res.json({ discovered: patterns.length, inserted, patterns });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
