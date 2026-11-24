/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; pagination touch-up */
import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  buildSmartPayrollPreview,
  incentiveAggToMap,
  selectLatestEvaluationsByEmployee,
  type SmartPayrollEmployee,
  type SmartPayrollEvaluation,
  type SmartPayrollIncentiveAgg,
} from "../../lib/hrSmartPayroll";

const router = Router();

/* ══════════════════════════════════════════════
   ENSURE TABLES — Migration 049 owns DDL; readiness + seed only
══════════════════════════════════════════════ */
let hrPerformanceSchemaReady = false;
async function ensureTables() {
  if (!hrPerformanceSchemaReady) {
    try {
      const r = await db.execute(sql`
        SELECT
          to_regclass('public.performance_evaluations') IS NOT NULL AS performance_evaluations_present,
          to_regclass('public.employee_incentives') IS NOT NULL AS employee_incentives_present,
          to_regclass('public.hr_settings') IS NOT NULL AS hr_settings_present
      `).catch(() => ({ rows: [{}] }));
      const row = ((r as { rows?: Record<string, unknown>[] }).rows ?? [])[0] ?? {};
      if (!row.performance_evaluations_present || !row.employee_incentives_present || !row.hr_settings_present) {
        console.error("[hrPerformance] Migration 049 schema not ready — performance_evaluations / employee_incentives / hr_settings missing");
        return;
      }
      hrPerformanceSchemaReady = true;
    } catch { /* non-blocking */ }
  }
  if (!hrPerformanceSchemaReady) return;
  /* seed defaults — requires hr_settings UNIQUE(key) from Migration 049 */
  await db.execute(sql`
    INSERT INTO hr_settings (key, val) VALUES
      ('bonus_rate_excellent', '0.30'),
      ('bonus_rate_good',      '0.20'),
      ('bonus_rate_above_avg', '0.10'),
      ('threshold_excellent',  '90'),
      ('threshold_good',       '80'),
      ('threshold_above_avg',  '70'),
      ('deduct_late_threshold','5'),
      ('deduct_late_rate',     '0.05'),
      ('deduct_absent_threshold','2'),
      ('deduct_absent_rate',   '0.10'),
      ('deduct_poor_threshold','60'),
      ('deduct_poor_rate',     '0.15'),
      ('gosi_rate',            '0.10'),
      ('allowance_rate',       '0.15')
    ON CONFLICT (key) DO NOTHING
  `).catch(() => undefined);
}

async function sqlAll(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function sqlOne(q: any): Promise<any> {
  const rows = await sqlAll(q);
  return rows[0] ?? null;
}

/* ── PERFORMANCE ENGINE ──────────────────────── */
function calcScore(ev: any): number {
  let score = 100;
  const role = ev.role ?? "lawyer";

  if (role === "secretary") {
    score += (ev.tasks_completed ?? 0) * 3;
    score += (ev.clients_handled ?? 0) * 2;
    score -= (ev.data_errors ?? 0) * 8;
    score -= (ev.errors ?? 0) * 5;
  } else if (role === "admin") {
    score += (ev.ops_handled ?? 0) * 4;
    score += (ev.incidents_resolved ?? 0) * 5;
    score -= (ev.system_errors ?? 0) * 6;
    score -= (ev.errors ?? 0) * 4;
  } else {
    score += (ev.cases_closed ?? 0) * 5;
    score -= (ev.cases_delayed ?? 0) * 8;
    score += (ev.tasks_completed ?? 0) * 2;
    score -= (ev.errors ?? 0) * 7;
  }

  /* attendance always applies */
  score += (ev.on_time_days ?? 0) * 3;
  score -= (ev.late_days ?? 0) * 5;
  score -= (ev.absent_days ?? 0) * 10;

  return Math.max(0, Math.min(100, score));
}

async function getSettings(): Promise<Record<string, number>> {
  const rows = await sqlAll(sql`SELECT key, val FROM hr_settings`);
  const m: Record<string, number> = {};
  for (const r of rows) m[r.key] = parseFloat(r.val);
  return m;
}

/* ══════════════════════════════════════════════
   ROUTES — SETTINGS
══════════════════════════════════════════════ */
router.get("/hr-perf/settings", requireAuthWithTenant, async (_req, res) => {
  await ensureTables();
  const rows = await sqlAll(sql`SELECT key, val FROM hr_settings`);
  const obj: Record<string, string> = {};
  rows.forEach(r => (obj[r.key] = r.val));
  res.json(obj);
});

router.patch("/hr-perf/settings", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const updates = req.body as Record<string, string>;
  for (const [key, val] of Object.entries(updates)) {
    await db.execute(sql`
      INSERT INTO hr_settings (key, val) VALUES (${key}, ${String(val)})
      ON CONFLICT (key) DO UPDATE SET val = ${String(val)}
    `);
  }
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════
   ROUTES — PERFORMANCE EVALUATIONS
══════════════════════════════════════════════ */
router.get("/hr-perf/evaluations", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const rows = await sqlAll(sql`
      SELECT pe.*, e.full_name as employee_name, e.job_title, e.department, e.salary
      FROM performance_evaluations pe
      INNER JOIN employees e ON pe.employee_id = e.id::text AND e.office_id = ${tid}
      ORDER BY pe.created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/hr-perf/evaluations/:employeeId", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    /* verify employee belongs to office before returning evaluations */
    const emp = await sqlOne(sql`SELECT id FROM employees WHERE id::text = ${String(req.params.employeeId)} AND office_id = ${tid} LIMIT 1`);
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
    const rows = await sqlAll(sql`
      SELECT pe.*, e.full_name as employee_name, e.salary
      FROM performance_evaluations pe
      INNER JOIN employees e ON pe.employee_id = e.id::text AND e.office_id = ${tid}
      WHERE pe.employee_id = ${String(req.params.employeeId)}
      ORDER BY pe.created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr-perf/evaluate", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  try {
    const tid = (req as any).tenantId as string;
    const ev = req.body as any;
    /* verify employee belongs to office */
    const emp = await sqlOne(sql`SELECT id FROM employees WHERE id::text = ${String(ev.employeeId)} AND office_id = ${tid} LIMIT 1`);
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
    const score = calcScore(ev);
    const row = await sqlOne(sql`
      INSERT INTO performance_evaluations
        (office_id, employee_id, period, cases_closed, cases_delayed, tasks_completed, errors,
         on_time_days, late_days, absent_days, clients_handled, data_errors,
         ops_handled, incidents_resolved, system_errors, role, performance_score, notes, evaluator_id)
      VALUES
        (${tid}, ${ev.employeeId}, ${ev.period ?? ""},
         ${ev.casesClosed ?? 0}, ${ev.casesDelayed ?? 0}, ${ev.tasksCompleted ?? 0}, ${ev.errors ?? 0},
         ${ev.onTimeDays ?? 0}, ${ev.lateDays ?? 0}, ${ev.absentDays ?? 0},
         ${ev.clientsHandled ?? 0}, ${ev.dataErrors ?? 0},
         ${ev.opsHandled ?? 0}, ${ev.incidentsResolved ?? 0}, ${ev.systemErrors ?? 0},
         ${ev.role ?? "lawyer"}, ${score}, ${ev.notes ?? null}, ${ev.evaluatorId ?? null})
      RETURNING *
    `);
    res.status(201).json({ ...row, performance_score: score });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/hr-perf/evaluations/:id", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  /* tenant ownership via office_id + employee join */
  await db.execute(sql`
    DELETE FROM performance_evaluations
    WHERE id = ${parseInt(String(req.params.id))}
      AND employee_id IN (SELECT id::text FROM employees WHERE office_id = ${tid})
  `);
  res.status(204).end();
});

/* ══════════════════════════════════════════════
   ROUTES — INCENTIVES
══════════════════════════════════════════════ */
router.get("/hr-perf/incentives", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const rows = await sqlAll(sql`
      SELECT ei.*, e.full_name as employee_name, e.job_title
      FROM employee_incentives ei
      INNER JOIN employees e ON ei.employee_id = e.id::text AND e.office_id = ${tid}
      ORDER BY ei.created_at DESC
    `);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/hr-perf/incentives", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  try {
    const { employeeId, type, amount, reason, period } = req.body as any;
    if (!employeeId || !amount) return res.status(400).json({ error: "معرف الموظف والمبلغ مطلوبان" });
    /* verify employee belongs to office */
    const emp = await sqlOne(sql`SELECT id FROM employees WHERE id::text = ${String(employeeId)} AND office_id = ${tid} LIMIT 1`);
    if (!emp) return res.status(404).json({ error: "الموظف غير موجود" });
    const row = await sqlOne(sql`
      INSERT INTO employee_incentives (office_id, employee_id, type, amount, reason, period)
      VALUES (${tid}, ${employeeId}, ${type ?? 'bonus'}, ${parseFloat(amount)}, ${reason ?? ''}, ${period ?? null})
      RETURNING *
    `);
    res.status(201).json(row);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete("/hr-perf/incentives/:id", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  /* tenant ownership via office_id + employee join */
  await db.execute(sql`
    DELETE FROM employee_incentives
    WHERE id = ${parseInt(String(req.params.id))}
      AND employee_id IN (SELECT id::text FROM employees WHERE office_id = ${tid})
  `);
  res.status(204).end();
});

/* ══════════════════════════════════════════════
   ROUTES — SMART PAYROLL SIMULATION (set-based)
══════════════════════════════════════════════ */
router.get("/hr-perf/smart-payroll/preview", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tenantId = (req as any).tenantId as string;
  try {
    const { period } = req.query as { period?: string };
    const periodFilter =
      typeof period === "string" && period.trim() ? period.trim() : null;

    const cfg = await getSettings();

    /* 1) Active tenant employees */
    const employees = (await sqlAll(sql`
      SELECT id, full_name, job_title, department, salary, office_id, status
      FROM employees
      WHERE status = 'active' AND office_id = ${tenantId}
      ORDER BY full_name
    `)) as SmartPayrollEmployee[];

    /* 2) Latest evaluation per employee (deterministic: created_at DESC, id DESC) */
    const evaluations = (await sqlAll(sql`
      SELECT DISTINCT ON (pe.employee_id)
        pe.id,
        pe.employee_id,
        pe.performance_score,
        pe.late_days,
        pe.absent_days,
        pe.period,
        pe.created_at
      FROM performance_evaluations pe
      INNER JOIN employees e
        ON pe.employee_id = e.id::text
       AND e.office_id = ${tenantId}
       AND e.status = 'active'
      WHERE 1=1
        ${periodFilter ? sql`AND pe.period = ${periodFilter}` : sql``}
      ORDER BY pe.employee_id, pe.created_at DESC, pe.id DESC
    `)) as SmartPayrollEvaluation[];

    /* 3–4) Grouped incentive aggregates — no per-row joins into employees list */
    const bonusRows = (await sqlAll(sql`
      SELECT ei.employee_id, COALESCE(SUM(ei.amount), 0)::numeric AS total
      FROM employee_incentives ei
      INNER JOIN employees e
        ON ei.employee_id = e.id::text
       AND e.office_id = ${tenantId}
       AND e.status = 'active'
      WHERE ei.type = 'bonus'
        ${periodFilter ? sql`AND ei.period = ${periodFilter}` : sql``}
      GROUP BY ei.employee_id
    `)) as SmartPayrollIncentiveAgg[];

    const deductionRows = (await sqlAll(sql`
      SELECT ei.employee_id, COALESCE(SUM(ei.amount), 0)::numeric AS total
      FROM employee_incentives ei
      INNER JOIN employees e
        ON ei.employee_id = e.id::text
       AND e.office_id = ${tenantId}
       AND e.status = 'active'
      WHERE ei.type = 'deduction'
        ${periodFilter ? sql`AND ei.period = ${periodFilter}` : sql``}
      GROUP BY ei.employee_id
    `)) as SmartPayrollIncentiveAgg[];

    const preview = buildSmartPayrollPreview({
      employees,
      evaluationsByEmployee: selectLatestEvaluationsByEmployee(evaluations, periodFilter),
      bonusByEmployee: incentiveAggToMap(
        bonusRows.map((r) => ({
          employee_id: String(r.employee_id),
          total: parseFloat(String(r.total ?? 0)) || 0,
        })),
      ),
      deductionByEmployee: incentiveAggToMap(
        deductionRows.map((r) => ({
          employee_id: String(r.employee_id),
          total: parseFloat(String(r.total ?? 0)) || 0,
        })),
      ),
      cfg,
      period: periodFilter,
      tenantId,
    });

    res.json(preview);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════
   ROUTES — DASHBOARD
══════════════════════════════════════════════ */
router.get("/hr-perf/dashboard", requireAuthWithTenant, async (req, res) => {
  await ensureTables();
  const tenantId = (req as any).tenantId as string;
  try {
    const [
      empCount, evalCount, avgScore, topPerformers, needAttention,
      bonusTotal, deductTotal, recentEvals,
    ] = await Promise.all([
      sqlOne(sql`SELECT COUNT(*)::int as count FROM employees WHERE status = 'active' AND office_id = ${tenantId}`),
      sqlOne(sql`
        SELECT COUNT(*)::int as count FROM performance_evaluations pe
        INNER JOIN employees e ON pe.employee_id = e.id::text AND e.office_id = ${tenantId}
      `),
      sqlOne(sql`
        SELECT AVG(pe.performance_score)::numeric(5,2) as avg FROM performance_evaluations pe
        INNER JOIN employees e ON pe.employee_id = e.id::text AND e.office_id = ${tenantId}
      `),
      sqlAll(sql`
        SELECT DISTINCT ON (pe.employee_id)
          pe.employee_id, pe.performance_score, pe.period,
          e.full_name, e.job_title, e.department
        FROM performance_evaluations pe
        INNER JOIN employees e ON pe.employee_id = e.id::text AND e.office_id = ${tenantId}
        ORDER BY pe.employee_id, pe.created_at DESC
        LIMIT 20
      `).then(r => r.sort((a: any, b: any) => b.performance_score - a.performance_score).slice(0, 5)),
      sqlAll(sql`
        SELECT DISTINCT ON (pe.employee_id)
          pe.employee_id, pe.performance_score, pe.period,
          e.full_name, e.job_title
        FROM performance_evaluations pe
        INNER JOIN employees e ON pe.employee_id = e.id::text AND e.office_id = ${tenantId}
        ORDER BY pe.employee_id, pe.created_at DESC
      `).then(r => r.filter((x: any) => x.performance_score < 70).slice(0, 5)),
      sqlOne(sql`
        SELECT COALESCE(SUM(ei.amount),0)::numeric as total FROM employee_incentives ei
        INNER JOIN employees e ON ei.employee_id = e.id::text AND e.office_id = ${tenantId}
        WHERE ei.type = 'bonus'
      `),
      sqlOne(sql`
        SELECT COALESCE(SUM(ei.amount),0)::numeric as total FROM employee_incentives ei
        INNER JOIN employees e ON ei.employee_id = e.id::text AND e.office_id = ${tenantId}
        WHERE ei.type = 'deduction'
      `),
      sqlAll(sql`
        SELECT pe.*, e.full_name as employee_name
        FROM performance_evaluations pe
        INNER JOIN employees e ON pe.employee_id = e.id::text AND e.office_id = ${tenantId}
        ORDER BY pe.created_at DESC LIMIT 5
      `),
    ]);

    /* AI insights */
    const insights: string[] = [];
    const scoreAvg = parseFloat(String(avgScore?.avg ?? 0));
    if (scoreAvg >= 85) insights.push("متوسط الأداء ممتاز — ننصح بصرف مكافأة جماعية هذا الشهر");
    else if (scoreAvg < 65) insights.push("تراجع في الأداء العام — يُستحسن عقد اجتماع تقييمي عاجل");
    if (topPerformers.length > 0)
      insights.push(`المتميز: ${topPerformers[0]?.full_name} بنسبة ${topPerformers[0]?.performance_score}% — يستحق ترقية أو مكافأة استثنائية`);
    if (needAttention.length > 0)
      insights.push(`${needAttention.length} موظف تحت 70% — يحتاجون خطة تطوير فردية`);
    insights.push("ربط الرواتب بالأداء يرفع الإنتاجية — ننصح بتفعيل الرواتب الذكية");

    res.json({
      empCount: empCount?.count ?? 0,
      evalCount: evalCount?.count ?? 0,
      avgScore: scoreAvg,
      bonusTotal: parseFloat(String(bonusTotal?.total ?? 0)),
      deductTotal: parseFloat(String(deductTotal?.total ?? 0)),
      topPerformers,
      needAttention,
      recentEvals,
      insights,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
