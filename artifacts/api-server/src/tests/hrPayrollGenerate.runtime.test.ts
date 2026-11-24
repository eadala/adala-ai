/**
 * Runtime tests for set-based POST /hr/payroll/generate (Task 10.5.3).
 * Run: pnpm --filter @workspace/api-server run test:hr-payroll-generate
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPayrollGenerateEntries,
  computePayrollAmounts,
  legacyPayrollGenerateQueryCount,
  selectEmployeesForPayrollGenerate,
  setBasedPayrollGenerateQueryCount,
  syncPayrollGenerateInMemory,
  type ExistingPayrollKey,
  type PayrollGenerateEmployee,
} from "../lib/hrPayrollGenerate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const tenantA = "office-a";
const tenantB = "office-b";
const month = "مايو";
const year = 2026;

const employees: PayrollGenerateEmployee[] = [
  { id: "emp-1", salary: "10000", office_id: tenantA, status: "active" },
  { id: "emp-2", salary: "5000", office_id: tenantA, status: "active" },
  { id: "emp-3", salary: "8000", office_id: tenantB, status: "active" },
  { id: "emp-inactive", salary: "9000", office_id: tenantA, status: "inactive" },
];

console.log("\n═══ source: set-based payroll generate route ═══");
{
  const src = read("modules/operations/hr.ts");
  const start = src.indexOf('router.post("/hr/payroll/generate"');
  const end = src.indexOf('router.patch("/hr/payroll/:id/pay"');
  assert.ok(start >= 0 && end > start, "generate route present");
  const block = src.slice(start, end);

  assert.match(block, /INSERT INTO payroll/);
  assert.match(block, /SELECT[\s\S]*FROM employees e/);
  assert.match(block, /NOT EXISTS/);
  assert.match(block, /e\.office_id = \$\{tid\}/);
  assert.match(block, /RETURNING \*/);
  assert.match(block, /requirePermission\("payroll:manage"\)/);
  assert.doesNotMatch(block, /for\s*\(\s*const\s+emp\s+of/);
  assert.doesNotMatch(block, /for \(const emp of employees\)/);
  console.log("  ✅ set-based INSERT…SELECT; no per-employee loop");
}

console.log("\n═══ runtime: identical generated amounts ═══");
{
  const amounts = computePayrollAmounts(10000);
  assert.equal(amounts.baseSalary, 10000);
  assert.equal(amounts.allowances, 1500);
  assert.equal(amounts.gosi, 1000);
  assert.equal(amounts.deductions, 0);
  assert.equal(amounts.netSalary, 10500);

  const legacyStyle = employees
    .filter((e) => e.office_id === tenantA && e.status === "active")
    .map((e) => ({
      employee_id: e.id,
      status: "draft" as const,
      ...computePayrollAmounts(e.salary),
    }));

  const setBased = buildPayrollGenerateEntries(
    selectEmployeesForPayrollGenerate({
      employees,
      existing: [],
      tenantId: tenantA,
      month,
      year,
    }),
  );

  assert.deepEqual(setBased, legacyStyle);
  console.log("  ✅ allowances 15% / gosi 10% / net parity");
}

console.log("\n═══ runtime: tenant isolation ═══");
{
  const forA = syncPayrollGenerateInMemory({
    tenantId: tenantA,
    month,
    year,
    employees,
    existing: [],
  });
  const forB = syncPayrollGenerateInMemory({
    tenantId: tenantB,
    month,
    year,
    employees,
    existing: [],
  });

  assert.equal(forA.response.generated, 2);
  assert.deepEqual(
    forA.response.entries.map((e) => e.employee_id).sort(),
    ["emp-1", "emp-2"],
  );
  assert.equal(forB.response.generated, 1);
  assert.equal(forB.response.entries[0]?.employee_id, "emp-3");
  assert.equal(
    forA.response.entries.some((e) => e.employee_id === "emp-3"),
    false,
  );
  assert.equal(
    forA.response.entries.some((e) => e.employee_id === "emp-inactive"),
    false,
  );
  console.log("  ✅ only active employees in requesting tenant");
}

console.log("\n═══ runtime: duplicate prevention ═══");
{
  const existing: ExistingPayrollKey[] = [
    { employee_id: "emp-1", month, year },
  ];
  const first = syncPayrollGenerateInMemory({
    tenantId: tenantA,
    month,
    year,
    employees,
    existing: [],
  });
  const second = syncPayrollGenerateInMemory({
    tenantId: tenantA,
    month,
    year,
    employees,
    existing: first.response.entries.map((e) => ({
      employee_id: e.employee_id,
      month,
      year,
    })),
  });
  const partial = syncPayrollGenerateInMemory({
    tenantId: tenantA,
    month,
    year,
    employees,
    existing,
  });

  assert.equal(first.response.generated, 2);
  assert.equal(second.response.generated, 0);
  assert.equal(partial.response.generated, 1);
  assert.equal(partial.response.entries[0]?.employee_id, "emp-2");

  /* Different month still generates */
  const otherMonth = syncPayrollGenerateInMemory({
    tenantId: tenantA,
    month: "يونيو",
    year,
    employees,
    existing,
  });
  assert.equal(otherMonth.response.generated, 2);
  console.log("  ✅ skips existing (employee, month, year); other periods ok");
}

console.log("\n═══ runtime: response format ═══");
{
  const res = syncPayrollGenerateInMemory({
    tenantId: tenantA,
    month,
    year,
    employees,
    existing: [],
  }).response;
  assert.equal(res.generated, res.entries.length);
  assert.ok(res.entries.every((e) => e.status === "draft"));
  assert.ok(res.entries.every((e) => e.month === month && e.year === year));
  console.log("  ✅ { generated, entries } shape preserved");
}

console.log("\n═══ runtime: query count reduction ═══");
{
  const n = 50;
  const legacy = legacyPayrollGenerateQueryCount(n);
  const setBased = setBasedPayrollGenerateQueryCount();
  assert.equal(legacy, 51);
  assert.equal(setBased, 1);
  assert.ok(setBased < legacy);

  const sim = syncPayrollGenerateInMemory({
    tenantId: tenantA,
    month,
    year,
    employees,
    existing: [],
  });
  assert.equal(sim.setBasedQueries, 1);
  assert.equal(sim.legacyQueries, 1 + 2);
  console.log(`  ✅ N=50: legacy ${legacy} → set-based ${setBased}`);
}

console.log("\n✅ hrPayrollGenerate runtime tests passed\n");
