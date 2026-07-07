/**
 * Enterprise Customer Zero — security attack simulation (static contract)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..");

function readModule(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

function assertNoUnguardedMutations(rel: string) {
  const src = readModule(rel);
  const lines = src.split("\n").filter((l) => /router\.(post|put|patch|delete)\(/.test(l));
  const unguarded = lines.filter((l) =>
    !l.includes("requirePermission(") && !l.includes("/webhook/"),
  );
  assert.equal(unguarded.length, 0, `${rel} unguarded mutations:\n${unguarded.join("\n")}`);
}

function testPaymentsModuleGuarded() {
  assertNoUnguardedMutations("modules/financial/payments.ts");
  const src = readModule("modules/financial/payments.ts");
  assert.doesNotMatch(src, /office_id\s+TEXT NOT NULL DEFAULT 'default'/);
  console.log("  ✅ payments.ts — all mutations RBAC-guarded, no default tenant in schema");
}

function testRbacEnumerationBlocked() {
  const rbac = readModule("modules/platform/rbac.ts");
  assert.match(rbac, /router\.get\("\/rbac\/members", requireAuthWithTenant, requirePermission\("users:view"\)/);
  assert.match(rbac, /router\.get\("\/rbac\/invitations", requireAuthWithTenant, requirePermission\("users:view"\)/);
  assert.match(rbac, /router\.get\("\/rbac\/roles", requireAuthWithTenant, requirePermission\("roles:view"\)/);
  console.log("  ✅ RBAC member/invitation enumeration requires users:view / roles:view");
}

function testOfficeManagerHasHrManage() {
  const rbac = readModule("modules/platform/rbac.ts");
  const mgrBlock = rbac.match(/name: "office_manager"[\s\S]*?permissions: JSON\.stringify\(\[([\s\S]*?)\]\)/);
  assert.ok(mgrBlock, "office_manager role block");
  assert.match(mgrBlock![0], /"hr:manage"/);
  assert.match(mgrBlock![0], /"payments:create"/);
  console.log("  ✅ office_manager has hr:manage + payments:create for enterprise ops");
}

function testTraineeCannotAccessPayments() {
  const rbac = readModule("modules/platform/rbac.ts");
  const trainee = rbac.match(/name: "trainee_lawyer"[\s\S]*?permissions: JSON\.stringify\(\[([\s\S]*?)\]\)/);
  assert.ok(trainee);
  assert.doesNotMatch(trainee![0], /payments:create/);
  assert.doesNotMatch(trainee![0], /financial:view/);
  console.log("  ✅ trainee_lawyer denied financial/payment permissions");
}

function testFrontendNavPermissionGates() {
  const layout = readFileSync(resolve(SRC, "../../adala/src/components/layout.tsx"), "utf8");
  assert.match(layout, /href: "\/invoices".*permission: "invoices:view"/);
  assert.match(layout, /href: "\/payment-center".*permission: "payments:view"/);
  assert.match(layout, /href: "\/employees".*permission: "hr:manage"/);
  console.log("  ✅ frontend nav gates finance + HR by permission");
}

function testTenantIsolationInP0Modules() {
  for (const mod of ["modules/financial/invoices.ts", "modules/financial/accounting.ts", "modules/operations/hr.ts"]) {
    const src = readModule(mod);
    assert.match(src, /office_id|tenantId/, `${mod} should scope by tenant`);
  }
  console.log("  ✅ P0 financial/HR modules use tenant scoping");
}

function main() {
  console.log("Enterprise Attack Simulation — Customer Zero\n");
  testPaymentsModuleGuarded();
  testRbacEnumerationBlocked();
  testOfficeManagerHasHrManage();
  testTraineeCannotAccessPayments();
  testFrontendNavPermissionGates();
  testTenantIsolationInP0Modules();
  console.log("\n✅ All enterprise attack simulation checks passed\n");
}

main();
