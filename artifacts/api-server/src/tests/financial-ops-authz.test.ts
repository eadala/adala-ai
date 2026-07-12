/**
 * PR-AUTH-003 — Financial + Operations Authorization Enforcement (static contract)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoutePolicy, ROUTE_POLICIES } from "../core/authorization/routePolicyRegistry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..");

function readModule(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

function assertMutationsGuarded(rel: string) {
  const src = readModule(rel);
  const lines = src.split("\n").filter((l) => /router\.(post|put|patch|delete)\(/.test(l));
  const unguarded = lines.filter((l) => !l.includes("requirePermission("));
  assert.equal(
    unguarded.length,
    0,
    `${rel} has unguarded mutations:\n${unguarded.join("\n")}`,
  );
}

function testFinancialOpsModules() {
  const modules = [
    "modules/financial/invoices.ts",
    "modules/financial/accounting.ts",
    "modules/operations/hr.ts",
  ];
  for (const m of modules) assertMutationsGuarded(m);
  console.log("  ✅ financial + operations mutations all require requirePermission");
}

function testRouteRegistryCoverage() {
  const required = [
    ["POST", "/api/invoices", "invoices:create"],
    ["PUT", "/api/invoices/:id", "invoices:edit"],
    ["POST", "/api/invoices/:id/payments", "payments:create"],
    ["POST", "/api/accounting/revenues", "financial:view"],
    ["DELETE", "/api/accounting/expenses/:id", "accounting:delete"],
    ["POST", "/api/hr/employees", "hr:manage"],
    ["POST", "/api/hr/attendance/check-in", "dashboard:view"],
    ["POST", "/api/hr/leaves", "dashboard:view"],
    ["PATCH", "/api/hr/leaves/:id", "hr:manage"],
  ] as const;

  for (const [method, path, perm] of required) {
    const policy = findRoutePolicy(method, path);
    assert.ok(policy, `missing policy ${method} ${path}`);
    assert.equal(policy?.permission, perm);
  }
  assert.ok(ROUTE_POLICIES.length >= 70, "expected expanded policy registry for PR-AUTH-003");
  console.log("  ✅ route policy registry covers financial + operations P0");
}

function testTraineeCannotCreateInvoice() {
  const invoices = readModule("modules/financial/invoices.ts");
  assert.match(
    invoices,
    /router\.post\("\/invoices", requireAuthWithTenant, requirePermission\("invoices:create"\)/,
  );
  console.log("  ✅ POST /invoices requires invoices:create");
}

function testAccountantCannotDeleteAccountingWithoutPermission() {
  const accounting = readModule("modules/financial/accounting.ts");
  assert.match(
    accounting,
    /router\.delete\("\/accounting\/revenues\/:id", requireAuthWithTenant, requirePermission\("accounting:delete"\)/,
  );
  assert.match(
    accounting,
    /router\.post\("\/accounting\/revenues", requireAuthWithTenant, requirePermission\("financial:view"\)/,
  );
  console.log("  ✅ accounting mutations split financial:view vs accounting:delete");
}

function main() {
  console.log("Financial + Operations Authorization Tests — PR-AUTH-003\n");
  testFinancialOpsModules();
  testRouteRegistryCoverage();
  testTraineeCannotCreateInvoice();
  testAccountantCannotDeleteAccountingWithoutPermission();
  console.log("\n✅ All PR-AUTH-003 financial-ops authz tests passed\n");
}

main();
