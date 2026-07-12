/**
 * HR Extended RBAC — static enforcement contract
 * Covers hr-enterprise, hrInternal, hrPerformance modules.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoutePolicy } from "../core/authorization/routePolicyRegistry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..");

const HR_EXTENDED_MODULES = [
  "modules/operations/hr-enterprise.ts",
  "modules/operations/hrInternal.ts",
  "modules/operations/hrPerformance.ts",
] as const;

function readModule(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

function assertAllRoutesGuarded(rel: string) {
  const src = readModule(rel);
  const lines = src.split("\n").filter((l) => /router\.(get|post|put|patch|delete)\(/.test(l));
  const unguarded = lines.filter((l) => !l.includes("requirePermission("));
  assert.equal(
    unguarded.length,
    0,
    `${rel} has unguarded routes:\n${unguarded.join("\n")}`,
  );
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

function testModulesGuarded() {
  for (const m of HR_EXTENDED_MODULES) {
    assertAllRoutesGuarded(m);
    assertMutationsGuarded(m);
  }
  console.log("  ✅ HR extended modules — all routes require requirePermission");
}

function testRouteRegistryCoverage() {
  const required = [
    ["POST", "/api/hr-enterprise/workflows", "hr:manage"],
    ["GET", "/api/hr-internal/announcements", "dashboard:view"],
    ["POST", "/api/hr-internal/requests", "dashboard:view"],
    ["GET", "/api/hr-internal/payslip/:payrollId", "payroll:view"],
    ["GET", "/api/hr-perf/evaluations", "hr:manage"],
    ["GET", "/api/hr-perf/smart-payroll/preview", "payroll:view"],
  ] as const;

  for (const [method, path, perm] of required) {
    const policy = findRoutePolicy(method, path);
    assert.ok(policy, `missing policy ${method} ${path}`);
    assert.equal(policy?.permission, perm);
  }
  console.log("  ✅ route policy registry covers HR extended P0");
}

function testEmployeeSelfService() {
  const internal = readModule("modules/operations/hrInternal.ts");
  assert.match(
    internal,
    /router\.post\("\/hr-internal\/requests", requireAuthWithTenant, requirePermission\("dashboard:view"\)/,
  );
  assert.match(
    internal,
    /router\.get\("\/hr-internal\/announcements", requireAuthWithTenant, requirePermission\("dashboard:view"\)/,
  );
  console.log("  ✅ employee self-service routes use dashboard:view");
}

function main() {
  console.log("HR Extended RBAC Tests\n");
  testModulesGuarded();
  testRouteRegistryCoverage();
  testEmployeeSelfService();
  console.log("\n✅ All HR extended RBAC tests passed\n");
}

main();
