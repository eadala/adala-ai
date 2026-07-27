/**
 * Set-based Smart Payroll Preview helpers (GET /hr-perf/smart-payroll/preview).
 * Keeps payroll math and response shape stable while eliminating per-employee DB loops.
 */

export type SmartPayrollSettings = Record<string, number>;

export type SmartPayrollEmployee = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  salary: string | number | null;
  office_id: string;
  status: string;
};

export type SmartPayrollEvaluation = {
  employee_id: string;
  performance_score: string | number | null;
  late_days?: number | null;
  absent_days?: number | null;
  period?: string | null;
  created_at?: string | Date | null;
  id?: string | number | null;
};

export type SmartPayrollIncentiveAgg = {
  employee_id: string;
  total: number;
};

export type SmartPayrollRow = {
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  department: string | null;
  baseSalary: number;
  allowance: number;
  performanceBonus: number;
  manualBonus: number;
  deduction: number;
  gosi: number;
  netSalary: number;
  performanceScore: number;
  hasEvaluation: boolean;
};

export type SmartPayrollPreview = {
  employees: SmartPayrollRow[];
  totalNet: number;
  avgScore: number;
  period: string;
};

/** Legacy: settings + employees + (eval + bonus SUM + deduction SUM) per employee. */
export function legacySmartPayrollQueryCount(employeeCount: number): number {
  return 2 + employeeCount * 3;
}

/**
 * Set-based: settings + employees + latest evals + bonus agg + deduction agg.
 * Independent of roster size.
 */
export function setBasedSmartPayrollQueryCount(): number {
  return 5;
}

export function calcSalary(
  baseSalary: number,
  score: number,
  ev: { late_days?: number | null; absent_days?: number | null },
  cfg: SmartPayrollSettings,
) {
  let bonus = 0;
  let deduction = 0;

  if (score >= cfg.threshold_excellent) bonus = baseSalary * cfg.bonus_rate_excellent;
  else if (score >= cfg.threshold_good) bonus = baseSalary * cfg.bonus_rate_good;
  else if (score >= cfg.threshold_above_avg) bonus = baseSalary * cfg.bonus_rate_above_avg;

  if ((ev.late_days ?? 0) > cfg.deduct_late_threshold) {
    deduction += baseSalary * cfg.deduct_late_rate;
  }
  if ((ev.absent_days ?? 0) > cfg.deduct_absent_threshold) {
    deduction += baseSalary * cfg.deduct_absent_rate;
  }
  if (score < cfg.deduct_poor_threshold) {
    deduction += baseSalary * cfg.deduct_poor_rate;
  }

  const gosi = baseSalary * cfg.gosi_rate;
  const allowance = baseSalary * cfg.allowance_rate;
  const net = Math.max(0, baseSalary + allowance + bonus - deduction - gosi);

  return { baseSalary, allowance, bonus, deduction, gosi, net, score };
}

function evalRecencyKey(ev: SmartPayrollEvaluation): number {
  const t = ev.created_at ? new Date(ev.created_at).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function evalIdKey(ev: SmartPayrollEvaluation): number {
  const n = Number(ev.id ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Deterministic latest evaluation per employee:
 * highest created_at, then highest id (stable tie-break).
 * Optional period filter matches legacy `AND period = $period`.
 */
export function selectLatestEvaluationsByEmployee(
  evaluations: SmartPayrollEvaluation[],
  period?: string | null,
): Map<string, SmartPayrollEvaluation> {
  const filtered =
    period && period.trim()
      ? evaluations.filter((e) => String(e.period ?? "") === period)
      : evaluations;

  const best = new Map<string, SmartPayrollEvaluation>();
  for (const ev of filtered) {
    const key = String(ev.employee_id);
    const prev = best.get(key);
    if (!prev) {
      best.set(key, ev);
      continue;
    }
    const newer =
      evalRecencyKey(ev) > evalRecencyKey(prev) ||
      (evalRecencyKey(ev) === evalRecencyKey(prev) && evalIdKey(ev) > evalIdKey(prev));
    if (newer) best.set(key, ev);
  }
  return best;
}

export function incentiveAggToMap(rows: SmartPayrollIncentiveAgg[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(String(r.employee_id), Number(r.total ?? 0) || 0);
  }
  return m;
}

/**
 * In-memory merge keyed by employee_id — no JOIN multiplication.
 * Preserves legacy defaults: score 75 when no evaluation; late/absent 0.
 */
export function buildSmartPayrollPreview(args: {
  employees: SmartPayrollEmployee[];
  evaluationsByEmployee: Map<string, SmartPayrollEvaluation>;
  bonusByEmployee: Map<string, number>;
  deductionByEmployee: Map<string, number>;
  cfg: SmartPayrollSettings;
  period?: string | null;
  tenantId: string;
}): SmartPayrollPreview {
  const active = args.employees
    .filter((e) => e.status === "active" && e.office_id === args.tenantId)
    .slice()
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), "ar"));

  const results: SmartPayrollRow[] = active.map((emp) => {
    const id = String(emp.id);
    const baseSalary = parseFloat(String(emp.salary || "0")) || 0;
    const ev = args.evaluationsByEmployee.get(id) ?? null;
    const score = ev ? parseFloat(String(ev.performance_score)) : 75;
    const evData = ev ?? { late_days: 0, absent_days: 0 };
    const calc = calcSalary(baseSalary, score, evData, args.cfg);
    const extraBonus = args.bonusByEmployee.get(id) ?? 0;
    const extraDeduction = args.deductionByEmployee.get(id) ?? 0;
    const finalNet = Math.max(0, calc.net + extraBonus - extraDeduction);

    return {
      employeeId: id,
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
    };
  });

  const totalNet = results.reduce((s, r) => s + r.netSalary, 0);
  const avgScore =
    results.length > 0
      ? results.reduce((s, r) => s + r.performanceScore, 0) / results.length
      : 0;

  return {
    employees: results,
    totalNet,
    avgScore: Math.round(avgScore),
    period: args.period && String(args.period).trim() ? String(args.period) : "latest",
  };
}

/** Pure end-to-end for runtime tests (legacy math ≡ set-based merge). */
export function syncSmartPayrollPreviewInMemory(args: {
  tenantId: string;
  period?: string | null;
  cfg: SmartPayrollSettings;
  employees: SmartPayrollEmployee[];
  evaluations: SmartPayrollEvaluation[];
  bonuses: SmartPayrollIncentiveAgg[];
  deductions: SmartPayrollIncentiveAgg[];
}): {
  preview: SmartPayrollPreview;
  setBasedQueries: number;
  legacyQueries: number;
} {
  const tenantEmployees = args.employees.filter((e) => e.office_id === args.tenantId);
  const evaluationsByEmployee = selectLatestEvaluationsByEmployee(
    args.evaluations.filter((ev) =>
      tenantEmployees.some((e) => String(e.id) === String(ev.employee_id)),
    ),
    args.period,
  );
  const preview = buildSmartPayrollPreview({
    employees: tenantEmployees,
    evaluationsByEmployee,
    bonusByEmployee: incentiveAggToMap(args.bonuses),
    deductionByEmployee: incentiveAggToMap(args.deductions),
    cfg: args.cfg,
    period: args.period,
    tenantId: args.tenantId,
  });
  const n = tenantEmployees.filter((e) => e.status === "active").length;
  return {
    preview,
    setBasedQueries: setBasedSmartPayrollQueryCount(),
    legacyQueries: legacySmartPayrollQueryCount(n),
  };
}
