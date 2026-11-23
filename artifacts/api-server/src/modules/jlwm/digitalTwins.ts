/**
 * JLWM — Digital Twins Engine
 * Builds and maintains Case, Client, and Firm digital twins.
 * Scoring is deterministic (no AI dependency) for reliability.
 */

import { Router }                from "express";
import { db }                    from "@workspace/db";
import { sql }                   from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";

const router = Router();

/* ── Case Twin Score ─────────────────────────────────────────── */
async function syncCaseTwin(officeId: string, caseId: string) {
  const { rows: caseRows } = await db.execute(sql`
    SELECT id, title, status, case_type, court_name, created_at, updated_at
    FROM   cases WHERE id = ${caseId} AND office_id = ${officeId} LIMIT 1
  `).catch(() => ({ rows: [] as any[] }));
  if (!caseRows.length) return null;
  const c = caseRows[0] as any;

  const { rows: tasks } = await db.execute(sql`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status IN ('done','completed','مكتملة'))         AS done,
           COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('done','مكتملة')) AS overdue
    FROM   tasks WHERE case_id = ${caseId} AND office_id = ${officeId}
  `).catch(() => ({ rows: [{}] as any[] }));
  const { rows: docs } = await db.execute(sql`
    SELECT COUNT(*) AS count FROM documents WHERE case_id = ${caseId} AND office_id = ${officeId}
  `).catch(() => ({ rows: [{}] as any[] }));
  const { rows: timelines } = await db.execute(sql`
    SELECT COUNT(*) AS count FROM case_timeline WHERE case_id = ${caseId}
  `).catch(() => ({ rows: [{}] as any[] }));

  const tm = (tasks[0] ?? {}) as any;
  const totalTasks  = Number(tm.total ?? 0);
  const doneTasks   = Number(tm.done  ?? 0);
  const overdueTasks= Number(tm.overdue ?? 0);
  const docCount    = Number((docs[0] as any)?.count ?? 0);
  const timelineEvt = Number((timelines[0] as any)?.count ?? 0);

  /* Health score (0-100) */
  let health = 50;
  if (totalTasks > 0) health += (doneTasks / totalTasks) * 20;
  health -= overdueTasks * 10;
  if (docCount >= 3) health += 10;
  if (timelineEvt >= 2) health += 10;
  health = Math.max(0, Math.min(100, health));

  /* Risk level */
  const riskLevel = health >= 70 ? "low" : health >= 40 ? "medium" : "high";

  /* Financial exposure from invoices linked to case */
  const { rows: invRows } = await db.execute(sql`
    SELECT COALESCE(SUM(total_amount),0) AS total
    FROM   client_invoices WHERE case_id = ${caseId} AND status IN ('pending','overdue')
  `).catch(() => ({ rows: [{}] as any[] }));
  const financialExposure = Number((invRows[0] as any)?.total ?? 0);

  const stateData = {
    status: c.status, case_type: c.case_type, court: c.court_name,
    total_tasks: totalTasks, done_tasks: doneTasks, overdue_tasks: overdueTasks,
    doc_count: docCount, timeline_events: timelineEvt,
  };

  /* Upsert */
  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_case_twins
      (office_id, case_id, health_score, complexity_score, risk_level,
       financial_exposure, state_data, last_synced_at, updated_at)
    VALUES
      (${officeId}, ${caseId}, ${health}, ${Math.min(totalTasks * 10, 100)},
       ${riskLevel}, ${financialExposure}, ${JSON.stringify(stateData)}::jsonb, NOW(), NOW())
    ON CONFLICT (office_id, case_id)
    DO UPDATE SET
      health_score      = EXCLUDED.health_score,
      complexity_score  = EXCLUDED.complexity_score,
      risk_level        = EXCLUDED.risk_level,
      financial_exposure= EXCLUDED.financial_exposure,
      state_data        = EXCLUDED.state_data,
      last_synced_at    = NOW(),
      updated_at        = NOW()
    RETURNING *
  `);
  return rows[0];
}

/* ── Client Twin Score ───────────────────────────────────────── */
async function syncClientTwin(officeId: string, clientId: string) {
  const { rows: clientRows } = await db.execute(sql`
    SELECT id, name, created_at FROM clients WHERE id = ${clientId} AND office_id = ${officeId} LIMIT 1
  `).catch(() => ({ rows: [] as any[] }));
  if (!clientRows.length) return null;

  const { rows: caseStats } = await db.execute(sql`
    SELECT
      COUNT(*)                                                    AS total,
      COUNT(*) FILTER (WHERE status IN ('active','جارية'))        AS active,
      COUNT(*) FILTER (WHERE status IN ('won','ربحنا','كسبنا'))   AS won,
      COUNT(*) FILTER (WHERE status IN ('lost','خسرنا'))          AS lost
    FROM cases WHERE client_id = ${clientId} AND office_id = ${officeId}
  `).catch(() => ({ rows: [{}] as any[] }));

  const { rows: invStats } = await db.execute(sql`
    SELECT
      COALESCE(SUM(total_amount),0)                       AS total_invoiced,
      COALESCE(SUM(total_amount) FILTER (WHERE status='paid'),0) AS total_paid
    FROM client_invoices WHERE client_id = ${clientId} AND office_id = ${officeId}
  `).catch(() => ({ rows: [{}] as any[] }));

  const cs = (caseStats[0] ?? {}) as any;
  const is_ = (invStats[0] ?? {}) as any;

  const totalCases  = Number(cs.total  ?? 0);
  const activeCases = Number(cs.active ?? 0);
  const wonCases    = Number(cs.won    ?? 0);
  const lostCases   = Number(cs.lost   ?? 0);
  const totalInvoiced = Number(is_.total_invoiced ?? 0);
  const totalPaid     = Number(is_.total_paid     ?? 0);

  const paymentReliability = totalInvoiced > 0
    ? Math.min(totalPaid / totalInvoiced, 1) : 1;

  /* Loyalty score */
  let loyalty = 50;
  if (totalCases >= 3) loyalty += 20;
  if (paymentReliability >= 0.9) loyalty += 20;
  loyalty = Math.min(100, loyalty);

  /* Risk score */
  let risk = 20;
  if (paymentReliability < 0.7) risk += 30;
  if (activeCases > 2) risk += 10;
  risk = Math.min(100, risk);

  /* Churn risk */
  const churnRisk = loyalty >= 70 ? "low" : loyalty >= 50 ? "medium"
    : loyalty >= 30 ? "high" : "critical";

  /* LTV estimate */
  const ltv = totalCases > 0 ? totalInvoiced / totalCases * 10 : 0;

  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_client_twins
      (office_id, client_id, loyalty_score, risk_score, ltv_score,
       total_cases, won_cases, lost_cases, active_cases,
       total_invoiced, total_paid, payment_reliability, churn_risk, updated_at)
    VALUES
      (${officeId}, ${clientId}, ${loyalty}, ${risk}, ${ltv},
       ${totalCases}, ${wonCases}, ${lostCases}, ${activeCases},
       ${totalInvoiced}, ${totalPaid}, ${paymentReliability}, ${churnRisk}, NOW())
    ON CONFLICT (office_id, client_id)
    DO UPDATE SET
      loyalty_score      = EXCLUDED.loyalty_score,
      risk_score         = EXCLUDED.risk_score,
      ltv_score          = EXCLUDED.ltv_score,
      total_cases        = EXCLUDED.total_cases,
      won_cases          = EXCLUDED.won_cases,
      lost_cases         = EXCLUDED.lost_cases,
      active_cases       = EXCLUDED.active_cases,
      total_invoiced     = EXCLUDED.total_invoiced,
      total_paid         = EXCLUDED.total_paid,
      payment_reliability= EXCLUDED.payment_reliability,
      churn_risk         = EXCLUDED.churn_risk,
      last_synced_at     = NOW(),
      updated_at         = NOW()
    RETURNING *
  `);
  return rows[0];
}

/* ── Firm Twin ───────────────────────────────────────────────── */
async function syncFirmTwin(officeId: string) {
  const { rows: caseM } = await db.execute(sql`
    SELECT
      COUNT(*)                                            AS total,
      COUNT(*) FILTER (WHERE status IN ('active','جارية')) AS active,
      COUNT(*) FILTER (WHERE status IN ('won','ربحنا','كسبنا')) AS won,
      COUNT(*) FILTER (WHERE status IN ('lost','خسرنا'))       AS lost,
      AVG(EXTRACT(EPOCH FROM (COALESCE(updated_at,NOW()) - created_at))/86400)::float AS avg_days
    FROM cases WHERE office_id = ${officeId}
  `).catch(() => ({ rows: [{}] }));

  const { rows: revM } = await db.execute(sql`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE date >= DATE_TRUNC('month', NOW())),0) AS this_month,
      COALESCE(SUM(amount) FILTER (WHERE date >= DATE_TRUNC('month', NOW()-INTERVAL '1 month')
                                     AND date < DATE_TRUNC('month', NOW())),0)  AS last_month
    FROM revenues WHERE office_id = ${officeId}
  `).catch(() => ({ rows: [{}] }));

  const { rows: topTypes } = await db.execute(sql`
    SELECT case_type, COUNT(*) AS count FROM cases WHERE office_id = ${officeId}
    GROUP BY case_type ORDER BY count DESC LIMIT 5
  `).catch(() => ({ rows: [] }));

  const cm = (caseM[0] ?? {}) as any;
  const rm = (revM[0] ?? {}) as any;

  const active = Number(cm.active ?? 0);
  const won    = Number(cm.won    ?? 0);
  const lost   = Number(cm.lost   ?? 0);
  const total  = Number(cm.total  ?? 1);
  const winRate= (won + lost) > 0 ? (won / (won + lost)) * 100 : 0;

  const thisMonth = Number(rm.this_month ?? 0);
  const lastMonth = Number(rm.last_month ?? 1);
  const revTrend  = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

  /* Scores */
  const perfScore   = Math.min(winRate * 0.6 + Math.min(active * 2, 40), 100);
  const healthScore = Math.min(60 + revTrend * 0.5 + winRate * 0.4, 100);
  const effScore    = Math.min(50 + (total > 0 ? (won / total) * 50 : 0), 100);

  const { rows } = await db.execute(sql`
    INSERT INTO jlwm_firm_twin
      (office_id, performance_score, efficiency_score, health_score,
       monthly_revenue, revenue_trend, active_cases_count, avg_case_duration_days,
       win_rate_pct, top_case_types, snapshot_date, updated_at)
    VALUES
      (${officeId}, ${perfScore}, ${effScore}, ${healthScore},
       ${thisMonth}, ${revTrend}, ${active}, ${Number(cm.avg_days ?? 0)},
       ${winRate}, ${JSON.stringify(topTypes)}::jsonb, CURRENT_DATE, NOW())
    ON CONFLICT (office_id, snapshot_date)
    DO UPDATE SET
      performance_score    = EXCLUDED.performance_score,
      efficiency_score     = EXCLUDED.efficiency_score,
      health_score         = EXCLUDED.health_score,
      monthly_revenue      = EXCLUDED.monthly_revenue,
      revenue_trend        = EXCLUDED.revenue_trend,
      active_cases_count   = EXCLUDED.active_cases_count,
      avg_case_duration_days= EXCLUDED.avg_case_duration_days,
      win_rate_pct         = EXCLUDED.win_rate_pct,
      top_case_types       = EXCLUDED.top_case_types,
      updated_at           = NOW()
    RETURNING *
  `);
  return rows[0];
}

/* ── Routes ──────────────────────────────────────────────────── */

/* GET /jlwm/twins/firm */
router.get("/jlwm/twins/firm", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { rows } = await db.execute(sql`
      SELECT * FROM jlwm_firm_twin WHERE office_id = ${officeId}
      ORDER BY snapshot_date DESC LIMIT 1
    `);
    if (!rows.length) {
      const twin = await syncFirmTwin(officeId);
      return res.json(twin);
    }
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/twins/cases */
router.get("/jlwm/twins/cases", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { risk, limit = "50" } = req.query as { risk?: string; limit?: string };
    let q = sql`
      SELECT ct.*, c.title AS case_title, c.status AS case_status
      FROM   jlwm_case_twins ct
      JOIN   cases c ON c.id = ct.case_id
      WHERE  ct.office_id = ${officeId}
    `;
    if (risk) {
      q = sql`
        SELECT ct.*, c.title AS case_title, c.status AS case_status
        FROM   jlwm_case_twins ct
        JOIN   cases c ON c.id = ct.case_id
        WHERE  ct.office_id = ${officeId} AND ct.risk_level = ${risk}
        ORDER  BY ct.health_score ASC LIMIT ${parseInt(limit, 10)}
      `;
    } else {
      q = sql`
        SELECT ct.*, c.title AS case_title, c.status AS case_status
        FROM   jlwm_case_twins ct
        JOIN   cases c ON c.id = ct.case_id
        WHERE  ct.office_id = ${officeId}
        ORDER  BY ct.health_score ASC LIMIT ${parseInt(limit, 10)}
      `;
    }
    const { rows } = await db.execute(q);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/twins/cases/:caseId */
router.get("/jlwm/twins/cases/:caseId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { caseId } = req.params as { caseId: string };
    const { rows } = await db.execute(sql`
      SELECT * FROM jlwm_case_twins WHERE case_id=${caseId} AND office_id=${officeId} LIMIT 1
    `);
    const twin = rows.length ? rows[0] : await syncCaseTwin(officeId, caseId);
    if (!twin) return res.status(404).json({ error: "القضية غير موجودة" });
    res.json(twin);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/twins/clients */
router.get("/jlwm/twins/clients", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { churn, limit = "50" } = req.query as { churn?: string; limit?: string };
    const { rows } = churn
      ? await db.execute(sql`
          SELECT ct.*, c.name AS client_name
          FROM   jlwm_client_twins ct JOIN clients c ON c.id = ct.client_id
          WHERE  ct.office_id=${officeId} AND ct.churn_risk=${churn}
          ORDER  BY ct.loyalty_score ASC LIMIT ${parseInt(limit, 10)}
        `)
      : await db.execute(sql`
          SELECT ct.*, c.name AS client_name
          FROM   jlwm_client_twins ct JOIN clients c ON c.id = ct.client_id
          WHERE  ct.office_id=${officeId}
          ORDER  BY ct.loyalty_score DESC LIMIT ${parseInt(limit, 10)}
        `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /jlwm/twins/clients/:clientId */
router.get("/jlwm/twins/clients/:clientId", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { clientId } = req.params as { clientId: string };
    const { rows } = await db.execute(sql`
      SELECT * FROM jlwm_client_twins WHERE client_id=${clientId} AND office_id=${officeId} LIMIT 1
    `);
    const twin = rows.length ? rows[0] : await syncClientTwin(officeId, clientId);
    if (!twin) return res.status(404).json({ error: "العميل غير موجود" });
    res.json(twin);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /jlwm/twins/sync — full sync for all entities */
router.post("/jlwm/twins/sync", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { target = "all" } = req.body ?? {};

    let casesDone = 0, clientsDone = 0;

    if (target === "all" || target === "firm") {
      await syncFirmTwin(officeId);
    }

    if (target === "all" || target === "cases") {
      const { rows: cases } = await db.execute(sql`
        SELECT id FROM cases WHERE office_id=${officeId} LIMIT 200
      `).catch(() => ({ rows: [] as any[] }));
      for (const c of cases as any[]) {
        await syncCaseTwin(officeId, String(c.id)).catch(() => null);
        casesDone++;
      }
    }

    if (target === "all" || target === "clients") {
      const { rows: clients } = await db.execute(sql`
        SELECT id FROM clients WHERE office_id=${officeId} LIMIT 200
      `).catch(() => ({ rows: [] as any[] }));
      for (const c of clients as any[]) {
        await syncClientTwin(officeId, String(c.id)).catch(() => null);
        clientsDone++;
      }
    }

    res.json({ ok: true, casesDone, clientsDone });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export { syncCaseTwin, syncClientTwin, syncFirmTwin };
export default router;
