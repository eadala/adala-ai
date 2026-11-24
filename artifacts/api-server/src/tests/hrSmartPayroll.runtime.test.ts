/**
 * Runtime tests for set-based GET /hr-perf/smart-payroll/preview (Task 10.5.2).
 * Run: pnpm --filter @workspace/api-server run test:hr-smart-payroll
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSmartPayrollPreview,
  calcSalary,
  incentiveAggToMap,
  legacySmartPayrollQueryCount,
  selectLatestEvaluationsByEmployee,
  setBasedSmartPayrollQueryCount,
  syncSmartPayrollPreviewInMemory,
  type SmartPayrollEmployee,
  type SmartPayrollEvaluation,
  type SmartPayrollIncentiveAgg,
  type SmartPayrollSettings,
} from "../lib/hrSmartPayroll";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const tenantA = "office-a";
const tenantB = "office-b";

const cfg: SmartPayrollSettings = {
  bonus_rate_excellent: 0.3,
  bonus_rate_good: 0.2,
  bonus_rate_above_avg: 0.1,
  threshold_excellent: 90,
  threshold_good: 80,
  threshold_above_avg: 70,
  deduct_late_threshold: 5,
  deduct_late_rate: 0.05,
  deduct_absent_threshold: 2,
  deduct_absent_rate: 0.1,
  deduct_poor_threshold: 60,
  deduct_poor_rate: 0.15,
  gosi_rate: 0.1,
  allowance_rate: 0.15,
};

const employees: SmartPayrollEmployee[] = [
  {
    id: "emp-1",
    full_name: "أحمد",
    job_title: "محامي",
    department: "litigation",
    salary: "10000",
    office_id: tenantA,
    status: "active",
  },
  {
    id: "emp-2",
    full_name: "سارة",
    job_title: "سكرتير",
    department: "admin",
    salary: "5000",
    office_id: tenantA,
    status: "active",
  },
  {
    id: "emp-3",
    full_name: "خالد",
    job_title: "محامي",
    department: "litigation",
    salary: "8000",
    office_id: tenantB,
    status: "active",
  },
];

const evaluations: SmartPayrollEvaluation[] = [
  {
    id: 1,
    employee_id: "emp-1",
    performance_score: 70,
    late_days: 0,
    absent_days: 0,
    period: "مايو 2026",
    created_at: "2026-05-01T10:00:00Z",
  },
  {
    id: 2,
    employee_id: "emp-1",
    performance_score: 92,
    late_days: 1,
    absent_days: 0,
    period: "مايو 2026",
    created_at: "2026-05-10T10:00:00Z",
  },
  {
    id: 3,
    employee_id: "emp-1",
    performance_score: 50,
    late_days: 0,
    absent_days: 0,
    period: "أبريل 2026",
    created_at: "2026-04-20T10:00:00Z",
  },
  {
    id: 4,
    employee_id: "emp-2",
    performance_score: 75,
    late_days: 6,
    absent_days: 0,
    period: "مايو 2026",
    created_at: "2026-05-05T10:00:00Z",
  },
  {
    id: 5,
    employee_id: "emp-3",
    performance_score: 95,
    late_days: 0,
    absent_days: 0,
    period: "مايو 2026",
    created_at: "2026-05-08T10:00:00Z",
  },
];

const bonuses: SmartPayrollIncentiveAgg[] = [
  { employee_id: "emp-1", total: 500 },
  { employee_id: "emp-3", total: 999 },
];

const deductions: SmartPayrollIncentiveAgg[] = [
  { employee_id: "emp-2", total: 100 },
];

console.log("\n═══ source: set-based smart-payroll preview route ═══");
{
  const src = read("modules/operations/hrPerformance.ts");
  const start = src.indexOf('router.get("/hr-perf/smart-payroll/preview"');
  const end = src.indexOf('router.get("/hr-perf/dashboard"');
  assert.ok(start >= 0 && end > start, "preview route present");
  const block = src.slice(start, end);

  assert.match(block, /DISTINCT ON \(pe\.employee_id\)/);
  assert.match(block, /ORDER BY pe\.employee_id, pe\.created_at DESC, pe\.id DESC/);
  assert.match(block, /GROUP BY ei\.employee_id/);
  assert.match(block, /buildSmartPayrollPreview/);
  assert.match(block, /e\.office_id = \$\{tenantId\}/);
  assert.doesNotMatch(block, /for\s*\(\s*const\s+emp\s+of/);
  assert.doesNotMatch(block, /await sqlOne\(sql`SELECT \* FROM performance_evaluations/);
  console.log("  ✅ route is set-based; no per-employee DB loop");
}

console.log("\n═══ runtime: latest evaluation is deterministic ═══");
{
  const latest = selectLatestEvaluationsByEmployee(evaluations, "مايو 2026");
  assert.equal(latest.get("emp-1")?.performance_score, 92);
  assert.equal(latest.get("emp-1")?.id, 2);

  /* Equal timestamps → higher id wins */
  const tied: SmartPayrollEvaluation[] = [
    {
      id: 10,
      employee_id: "emp-x",
      performance_score: 80,
      created_at: "2026-05-01T12:00:00.000Z",
      period: "p",
    },
    {
      id: 11,
      employee_id: "emp-x",
      performance_score: 81,
      created_at: "2026-05-01T12:00:00.000Z",
      period: "p",
    },
  ];
  assert.equal(selectLatestEvaluationsByEmployee(tied, "p").get("emp-x")?.id, 11);
  console.log("  ✅ created_at DESC, id DESC tie-break");
}

console.log("\n═══ runtime: identical preview output (legacy math ≡ merge) ═══");
{
  const period = "مايو 2026";
  const setBased = syncSmartPayrollPreviewInMemory({
    tenantId: tenantA,
    period,
    cfg,
    employees,
    evaluations,
    bonuses,
    deductions,
  });

  /* Explicit legacy-style per-employee math using the same helpers */
  const legacyRows = employees
    .filter((e) => e.office_id === tenantA && e.status === "active")
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"))
    .map((emp) => {
      const evMap = selectLatestEvaluationsByEmployee(evaluations, period);
      const ev = evMap.get(String(emp.id)) ?? null;
      const score = ev ? parseFloat(String(ev.performance_score)) : 75;
      const calc = calcSalary(
        parseFloat(String(emp.salary || "0")),
        score,
        ev ?? { late_days: 0, absent_days: 0 },
        cfg,
      );
      const extraBonus = incentiveAggToMap(bonuses).get(String(emp.id)) ?? 0;
      const extraDeduction = incentiveAggToMap(deductions).get(String(emp.id)) ?? 0;
      return {
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
        netSalary: Math.max(0, calc.net + extraBonus - extraDeduction),
        performanceScore: score,
        hasEvaluation: !!ev,
      };
    });

  const legacyPreview = {
    employees: legacyRows,
    totalNet: legacyRows.reduce((s, r) => s + r.netSalary, 0),
    avgScore: Math.round(
      legacyRows.reduce((s, r) => s + r.performanceScore, 0) / legacyRows.length,
    ),
    period,
  };

  assert.deepEqual(setBased.preview, legacyPreview);

  const ahmed = setBased.preview.employees.find((r) => r.employeeId === "emp-1");
  const sara = setBased.preview.employees.find((r) => r.employeeId === "emp-2");
  assert.ok(ahmed && sara);
  assert.equal(ahmed.performanceScore, 92);
  assert.equal(ahmed.hasEvaluation, true);
  assert.equal(ahmed.manualBonus, 500);
  assert.equal(sara.manualBonus, 0);
  /* late_days=6 > threshold → late deduction applied on top of manual */
  const saraCalc = calcSalary(5000, 75, { late_days: 6, absent_days: 0 }, cfg);
  assert.equal(sara.deduction, saraCalc.deduction + 100);
  assert.equal(setBased.preview.employees.length, 2);
  console.log("  ✅ identical employee rows, totals, and period");
}

console.log("\n═══ runtime: tenant isolation ═══");
{
  const forA = syncSmartPayrollPreviewInMemory({
    tenantId: tenantA,
    period: "مايو 2026",
    cfg,
    employees,
    evaluations,
    bonuses,
    deductions,
  });
  const forB = syncSmartPayrollPreviewInMemory({
    tenantId: tenantB,
    period: "مايو 2026",
    cfg,
    employees,
    evaluations,
    bonuses,
    deductions,
  });

  assert.deepEqual(
    forA.preview.employees.map((e) => e.employeeId).sort(),
    ["emp-1", "emp-2"],
  );
  assert.deepEqual(
    forB.preview.employees.map((e) => e.employeeId),
    ["emp-3"],
  );
  assert.equal(forA.preview.employees.some((e) => e.employeeId === "emp-3"), false);
  assert.equal(forB.preview.employees[0]?.manualBonus, 999);
  assert.equal(forB.preview.employees[0]?.performanceScore, 95);
  console.log("  ✅ tenant A/B previews isolated");
}

console.log("\n═══ runtime: no JOIN row multiplication in merge ═══");
{
  const evMap = selectLatestEvaluationsByEmployee(evaluations, "مايو 2026");
  const preview = buildSmartPayrollPreview({
    employees: employees.filter((e) => e.office_id === tenantA),
    evaluationsByEmployee: evMap,
    bonusByEmployee: incentiveAggToMap(bonuses),
    deductionByEmployee: incentiveAggToMap(deductions),
    cfg,
    period: "مايو 2026",
    tenantId: tenantA,
  });
  assert.equal(preview.employees.length, 2);
  assert.equal(new Set(preview.employees.map((e) => e.employeeId)).size, 2);
  console.log("  ✅ one output row per employee");
}

console.log("\n═══ runtime: query count reduction ═══");
{
  const n = 50;
  const legacy = legacySmartPayrollQueryCount(n);
  const setBased = setBasedSmartPayrollQueryCount();
  assert.equal(legacy, 2 + n * 3);
  assert.equal(setBased, 5);
  assert.ok(setBased < legacy);
  assert.ok(legacy / setBased > 20);

  const sim = syncSmartPayrollPreviewInMemory({
    tenantId: tenantA,
    period: "مايو 2026",
    cfg,
    employees,
    evaluations,
    bonuses,
    deductions,
  });
  assert.equal(sim.setBasedQueries, 5);
  assert.equal(sim.legacyQueries, 2 + 2 * 3);
  console.log(`  ✅ N=50: legacy ${legacy} → set-based ${setBased}`);
}

console.log("\n═══ runtime: default score when no evaluation ═══");
{
  const preview = buildSmartPayrollPreview({
    employees: [
      {
        id: "emp-new",
        full_name: "جديد",
        job_title: "متدرب",
        department: null,
        salary: "3000",
        office_id: tenantA,
        status: "active",
      },
    ],
    evaluationsByEmployee: new Map(),
    bonusByEmployee: new Map(),
    deductionByEmployee: new Map(),
    cfg,
    period: null,
    tenantId: tenantA,
  });
  assert.equal(preview.employees[0]?.performanceScore, 75);
  assert.equal(preview.employees[0]?.hasEvaluation, false);
  assert.equal(preview.period, "latest");
  console.log("  ✅ default score 75 + period latest");
}

console.log("\n✅ hrSmartPayroll runtime tests passed\n");
