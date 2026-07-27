/**
 * Runtime tests for set-based GET /hr-internal/leave-balances (Task 10.5.1).
 * Run: pnpm --filter @workspace/api-server run test:hr-leave-balances
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  aggregateApprovedLeaveUsage,
  applyUsedToBalances,
  ensureMissingBalanceRows,
  formatLeaveBalancesResponse,
  legacyLeaveBalancesQueryCount,
  setBasedLeaveBalancesQueryCount,
  syncLeaveBalancesInMemory,
  type LeaveBalanceEmployeeRow,
  type LeaveBalanceLedgerRow,
} from "../lib/hrLeaveBalances";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const year = 2026;
const tenantA = "office-a";
const tenantB = "office-b";

const employees: LeaveBalanceEmployeeRow[] = [
  {
    id: "emp-1",
    full_name: "أحمد",
    job_title: "محامي",
    department: "litigation",
    office_id: tenantA,
    status: "active",
  },
  {
    id: "emp-2",
    full_name: "سارة",
    job_title: "سكرتير",
    department: "admin",
    office_id: tenantA,
    status: "active",
  },
  {
    id: "emp-3",
    full_name: "خالد",
    job_title: "محامي",
    department: "litigation",
    office_id: tenantB,
    status: "active",
  },
  {
    id: "emp-inactive",
    full_name: "قديم",
    job_title: "محامي",
    department: "litigation",
    office_id: tenantA,
    status: "inactive",
  },
];

const leaves = [
  {
    employee_id: "emp-1",
    type: "annual",
    status: "approved",
    days: 5,
    start_date: "2026-03-01",
    office_id: tenantA,
  },
  {
    employee_id: "emp-1",
    type: "annual",
    status: "approved",
    days: 2,
    start_date: "2026-06-01",
    office_id: tenantA,
  },
  {
    employee_id: "emp-1",
    type: "sick",
    status: "pending",
    days: 3,
    start_date: "2026-04-01",
    office_id: tenantA,
  },
  {
    employee_id: "emp-2",
    type: "emergency",
    status: "approved",
    days: 1,
    start_date: "2026-02-10",
    office_id: tenantA,
  },
  {
    employee_id: "emp-3",
    type: "annual",
    status: "approved",
    days: 10,
    start_date: "2026-01-15",
    office_id: tenantB,
  },
  {
    employee_id: "emp-1",
    type: "annual",
    status: "approved",
    days: 4,
    start_date: "2025-12-01",
    office_id: tenantA,
  },
];

console.log("\n═══ source: set-based leave-balances route ═══");
{
  const src = read("modules/operations/hrInternal.ts");
  const start = src.indexOf('router.get("/hr-internal/leave-balances"');
  const end = src.indexOf('router.patch("/hr-internal/leave-balances/:employeeId"');
  assert.ok(start >= 0 && end > start, "leave-balances GET route present");
  const block = src.slice(start, end);

  assert.match(block, /INSERT INTO leave_balances[\s\S]*CROSS JOIN/);
  assert.match(block, /ON CONFLICT \(employee_id, leave_type, year\) DO NOTHING/);
  assert.match(block, /UPDATE leave_balances AS lb/);
  assert.match(block, /GROUP BY l\.employee_id, l\.type/);
  assert.match(block, /formatLeaveBalancesResponse/);
  assert.match(block, /e\.office_id = \$\{tid\}/);

  assert.doesNotMatch(block, /for\s*\(\s*const\s+emp\s+of/);
  assert.doesNotMatch(block, /for\s*\(\s*const\s+type\s+of/);
  assert.doesNotMatch(block, /for\s*\(const type of \['annual'/);
  console.log("  ✅ route uses set-based SQL; no per-employee loops");
}

console.log("\n═══ runtime: identical results (legacy algorithm ≡ set-based) ═══");
{
  const existing: LeaveBalanceLedgerRow[] = [
    /* stale used that must be overwritten for emp-2 annual */
    { employee_id: "emp-2", leave_type: "annual", year, quota: 21, used: 99 },
  ];

  const setBased = syncLeaveBalancesInMemory({
    tenantId: tenantA,
    year,
    employees,
    existingBalances: existing,
    leaves,
  });

  /* Explicit legacy-style steps (same pure helpers, same math) */
  const tenantEmployees = employees.filter((e) => e.office_id === tenantA);
  const ensured = ensureMissingBalanceRows(tenantEmployees, existing, year);
  const usage = aggregateApprovedLeaveUsage(leaves, year, tenantA);
  const updated = applyUsedToBalances(tenantEmployees, ensured, usage, year);
  const legacyResponse = formatLeaveBalancesResponse(tenantEmployees, updated, year, tenantA);

  assert.deepEqual(setBased.response, legacyResponse);

  const ahmed = setBased.response.find((r) => r.employeeId === "emp-1");
  const sara = setBased.response.find((r) => r.employeeId === "emp-2");
  assert.ok(ahmed && sara);
  assert.equal(ahmed.balances.find((b) => b.type === "annual")?.used, 7);
  assert.equal(ahmed.balances.find((b) => b.type === "annual")?.remaining, 14);
  assert.equal(ahmed.balances.find((b) => b.type === "sick")?.used, 0);
  assert.equal(sara.balances.find((b) => b.type === "emergency")?.used, 1);
  assert.equal(sara.balances.find((b) => b.type === "annual")?.used, 0);
  assert.equal(ahmed.balances.length, 3);
  assert.equal(sara.balances.length, 3);
  assert.equal(setBased.response.length, 2);
  assert.equal(
    setBased.response.some((r) => r.employeeId === "emp-inactive"),
    false,
  );
  console.log("  ✅ identical response shape and used/remaining math");
}

console.log("\n═══ runtime: tenant isolation ═══");
{
  const forA = syncLeaveBalancesInMemory({
    tenantId: tenantA,
    year,
    employees,
    existingBalances: [],
    leaves,
  });
  const forB = syncLeaveBalancesInMemory({
    tenantId: tenantB,
    year,
    employees,
    existingBalances: [],
    leaves,
  });

  assert.deepEqual(
    forA.response.map((r) => r.employeeId).sort(),
    ["emp-1", "emp-2"],
  );
  assert.deepEqual(
    forB.response.map((r) => r.employeeId),
    ["emp-3"],
  );
  assert.equal(forA.response.some((r) => r.employeeId === "emp-3"), false);
  assert.equal(forB.response[0]?.balances.find((b) => b.type === "annual")?.used, 10);

  /* Cross-tenant leave rows must not inflate tenant A usage */
  const usageA = aggregateApprovedLeaveUsage(leaves, year, tenantA);
  assert.equal(
    usageA.find((u) => u.employee_id === "emp-3"),
    undefined,
  );
  console.log("  ✅ tenant A/B employees and leave usage isolated");
}

console.log("\n═══ runtime: query count reduction ═══");
{
  const n = 50;
  const legacy = legacyLeaveBalancesQueryCount(n);
  const setBased = setBasedLeaveBalancesQueryCount();
  assert.equal(legacy, 1 + n * 10);
  assert.equal(setBased, 3);
  assert.ok(setBased < legacy);
  assert.ok(legacy / setBased > 100, "50 employees: >100× fewer DB round-trips");

  const sim = syncLeaveBalancesInMemory({
    tenantId: tenantA,
    year,
    employees,
    existingBalances: [],
    leaves,
  });
  assert.equal(sim.setBasedQueries, 3);
  assert.equal(sim.legacyQueries, 1 + 2 * 10);
  console.log(`  ✅ N=50: legacy ${legacy} → set-based ${setBased}`);
}

console.log("\n✅ hrLeaveBalances runtime tests passed\n");
