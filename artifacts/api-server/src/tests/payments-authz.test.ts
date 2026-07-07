/**
 * Payments RBAC + tenant isolation — static enforcement contract
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoutePolicy } from "../core/authorization/routePolicyRegistry";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..");

function readModule(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

function assertTenantRoutesGuarded() {
  const src = readModule("modules/financial/payments.ts");
  const lines = src.split("\n").filter((l) => /router\.(get|post|put|patch|delete)\(/.test(l));
  const tenantRoutes = lines.filter((l) => !l.includes('"/webhook/'));
  const unguarded = tenantRoutes.filter((l) => !l.includes("requirePermission("));
  assert.equal(
    unguarded.length,
    0,
    `payments.ts has unguarded tenant routes:\n${unguarded.join("\n")}`,
  );
  console.log("  ✅ payments — all tenant routes require requirePermission");
}

function assertWebhookPublic() {
  const src = readModule("modules/financial/payments.ts");
  assert.match(src, /router\.post\("\/webhook\/checkout", async/);
  assert.doesNotMatch(src, /router\.post\("\/webhook\/checkout", requireAuthWithTenant/);
  assert.match(src, /office_id = \$\{officeId\}/);
  console.log("  ✅ checkout webhook — no session auth; tenant-scoped updates");
}

function assertTenantScopedReads() {
  const src = readModule("modules/financial/payments.ts");
  assert.match(src, /getRequiredTenantId/);
  assert.match(src, /WHERE office_id = \$\{officeId\}/);
  assert.doesNotMatch(src, /office_id\s+TEXT NOT NULL DEFAULT 'default'/);
  console.log("  ✅ payments reads scoped by office_id");
}

function testRouteRegistryCoverage() {
  const required = [
    ["GET", "/api/payments/transactions", "payments:view"],
    ["POST", "/api/payments/transactions", "payments:create"],
    ["POST", "/api/payments/batch-settle", "payments:create"],
    ["GET", "/api/payments/wallet", "payments:view"],
    ["PUT", "/api/payments/moyasar/settings", "payments:create"],
  ] as const;

  for (const [method, path, perm] of required) {
    const policy = findRoutePolicy(method, path);
    assert.ok(policy, `missing policy ${method} ${path}`);
    assert.equal(policy?.permission, perm);
  }
  console.log("  ✅ route policy registry covers payments P0");
}

function main() {
  console.log("Payments Authorization Tests\n");
  assertTenantRoutesGuarded();
  assertWebhookPublic();
  assertTenantScopedReads();
  testRouteRegistryCoverage();
  console.log("\n✅ All payments authz tests passed\n");
}

main();
