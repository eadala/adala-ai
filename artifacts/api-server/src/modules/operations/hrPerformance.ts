import { requireAuthWithTenant, requirePermission } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/* ══════════════════════════════════════════════
   ENSURE TABLES
══════════════════════════════════════════════ */
async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS performance_evaluations (
      id              SERIAL PRIMARY KEY,
      employee_id     TEXT NOT NULL,
      period          TEXT NOT NULL,
      cases_closed    INTEGER NOT NULL DEFAULT 0,
      cases_delayed   INTEGER NOT NULL DEFAULT 0,
      tasks_completed INTEGER NOT NULL DEFAULT 0,
      errors          INTEGER NOT NULL DEFAULT 0,
      on_time_days    INTEGER NOT NULL DEFAULT 0,
      late_days       INTEGER NOT NULL DEFAULT 0,
      absent_days     INTEGER NOT NULL DEFAULT 0,
      clients_handled INTEGER NOT NULL DEFAULT 0,
      data_errors     INTEGER NOT NULL DEFAULT 0,
      ops_handled     INTEGER NOT NULL DEFAULT 0,
      incidents_resolved INTEGER NOT NULL DEFAULT 0,
      system_errors   INTEGER NOT NULL DEFAULT 0,
      role            TEXT NOT NULL DEFAULT 'lawyer',
      performance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
      notes           TEXT,
      evaluator_id    TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS employee_incentives (
      id          SERIAL PRIMARY KEY,
      employee_id TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'bonus',
      amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
      reason      TEXT NOT NULL DEFAULT '',
      period      TEXT,
      is_applied  BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hr_settings (
      id   SERIAL PRIMARY KEY,
      key  TEXT UNIQUE NOT NULL,
      val  TEXT NOT NULL
    )
  `);
  /* seed defaults */
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
  `);
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

function calcSalary(baseSalary: number, score: number, ev: any, cfg: Record<string, number>) {
  let bonus = 0;
  let deduction = 0;

  if (score >= cfg.threshold_excellent)  bonus = baseSalary * cfg.bonus_rate_excellent;
  else if (score >= cfg.threshold_good)  bonus = baseSalary * cfg.bonus_rate_good;
  else if (score >= cfg.threshold_above_avg) bonus = baseSalary * cfg.bonus_rate_above_avg;

  if ((ev.late_days ?? 0) > cfg.deduct_late_threshold)
    deduction += baseSalary * cfg.deduct_late_rate;
  if ((ev.absent_days ?? 0) > cfg.deduct_absent_threshold)
    deduction += baseSalary * cfg.deduct_absent_rate;
  if (score < cfg.deduct_poor_threshold)
    deduction += baseSalary * cfg.deduct_poor_rate;

  const gosi = baseSalary * cfg.gosi_rate;
  const allowance = baseSalary * cfg.allowance_rate;
  const net = Math.max(0, baseSalary + allowance + bonus - deduction - gosi);

  return { baseSalary, allowance, bonus, deduction, gosi, net, score };
}

/* ══════════════════════════════════════════════
   ROUTES — SETTINGS
══════════════════════════════════════════════ */
router.get("/hr-perf/settings", requireAuthWithTenant, requirePermission("hr:manage"), async (_req, res) => {
  await ensureTables();
  const rows = await sqlAll(sql`SELECT key, val FROM hr_settings`);
  const obj: Record<string, string> = {};
  rows.forEach(r => (obj[r.key] = r.val));
  res.json(obj);
});

router.patch("/hr-perf/settings", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
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
router.get("/hr-perf/evaluations", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
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

router.get("/hr-perf/evaluations/:employeeId", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
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

router.post("/hr-perf/evaluate", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
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

router.delete("/hr-perf/evaluations/:id", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  /* performance_evaluations has no office_id — verify ownership via employee join */
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
router.get("/hr-perf/incentives", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
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

router.post("/hr-perf/incentives", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
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

router.delete("/hr-perf/incentives/:id", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
  await ensureTables();
  const tid = (req as any).tenantId as string;
  /* employee_incentives has no office_id — verify via employee join */
  await db.execute(sql`
    DELETE FROM employee_incentives
    WHERE id = ${parseInt(String(req.params.id))}
      AND employee_id IN (SELECT id::text FROM employees WHERE office_id = ${tid})
  `);
  res.status(204).end();
});

/* ══════════════════════════════════════════════
   ROUTES — SMART PAYROLL SIMULATION
══════════════════════════════════════════════ */
router.get("/hr-perf/smart-payroll/preview", requireAuthWithTenant, requirePermission("payroll:view"), async (req, res) => {
  await ensureTables();
  const tenantId = (req as any).tenantId as string;
  try {
    const { period } = req.query as { period?: string };
    const cfg = await getSettings();
    const employees = await sqlAll(sql`SELECT * FROM employees WHERE status = 'active' AND office_id = ${tenantId} ORDER BY full_name`);

    const results = [];
    for (const emp of employees) {
      const baseSalary = parseFloat(String(emp.salary || "0"));

      /* get latest evaluation for this period or latest */
      const ev = period
        ? await sqlOne(sql`SELECT * FROM performance_evaluations WHERE employee_id = ${emp.id}::text AND period = ${period} ORDER BY created_at DESC LIMIT 1`)
        : await sqlOne(sql`SELECT * FROM performance_evaluations WHERE employee_id = ${emp.id}::text ORDER BY created_at DESC LIMIT 1`);

      const score = ev ? parseFloat(String(ev.performance_score)) : 75; /* default 75 */
      const evData = ev ?? { late_days: 0, absent_days: 0 };
      const calc = calcSalary(baseSalary, score, evData, cfg);

      /* get manual incentives */
      const manualBonuses = await sqlAll(sql`
        SELECT SUM(amount)::numeric as total FROM employee_incentives
        WHERE employee_id = ${emp.id}::text AND type = 'bonus'
        ${period ? sql`AND period = ${period}` : sql``}
      `);
      const manualDeductions = await sqlAll(sql`
        SELECT SUM(amount)::numeric as total FROM employee_incentives
        WHERE employee_id = ${emp.id}::text AND type = 'deduction'
        ${period ? sql`AND period = ${period}` : sql``}
      `);

      const extraBonus = parseFloat(String((manualBonuses[0]?.total) ?? 0));
      const extraDeduction = parseFloat(String((manualDeductions[0]?.total) ?? 0));
      const finalNet = Math.max(0, calc.net + extraBonus - extraDeduction);

      results.push({
        employeeId: String(emp.id),
        employeeName: emp.full_name,
        jobTitle: emp.job_title,
        department: emp.department,
        baseSalary: calc.baseSalary,
        allowance: calc.allowance,
        performanceBonus: calc.bonus,
        manualBonus: extraBonus,
        deduction: calc.deduction + extraDeduction,
        gosi: calc.gosi,
        netSalary: finalNet,
        performanceScore: score,
        hasEvaluation: !!ev,
      });
    }

    const totalNet = results.reduce((s, r) => s + r.netSalary, 0);
    const avgScore = results.length > 0 ? results.reduce((s, r) => s + r.performanceScore, 0) / results.length : 0;
    res.json({ employees: results, totalNet, avgScore: Math.round(avgScore), period: period ?? "latest" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════
   ROUTES — DASHBOARD
══════════════════════════════════════════════ */
router.get("/hr-perf/dashboard", requireAuthWithTenant, requirePermission("hr:manage"), async (req, res) => {
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
