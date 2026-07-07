/**
 * PR-TNT-002 — Tenant Kernel Hardening tests
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

function testCanonicalKernelExists() {
  const kernel = readModule("core/tenant/tenantKernel.ts");
  assert.match(kernel, /export async function resolveTenantContext/);
  assert.match(kernel, /verifyMembership/);
  assert.doesNotMatch(kernel, /SELECT office_id FROM users/);
  assert.doesNotMatch(kernel, /TENANT-HEAL-7/);
  console.log("  ✅ canonical tenant kernel — no heal-7 / users.office_id fallback");
}

function testResolutionShimDelegates() {
  const shim = readModule("middlewares/tenantResolution.ts");
  assert.match(shim, /core\/tenant\/tenantKernel/);
  assert.doesNotMatch(shim, /SELECT office_id FROM users/);
  console.log("  ✅ tenantResolution.ts delegates to kernel");
}

function testLifecycleInMiddleware() {
  const auth = readModule("middlewares/requireAuth.ts");
  assert.match(auth, /assertTenantActive/);
  assert.match(auth, /TenantLifecycleError/);
  console.log("  ✅ requireAuthWithTenant checks tenant lifecycle");
}

function testEventBusNoDefaultTenant() {
  const bus = readModule("core/eventBus.ts");
  assert.doesNotMatch(bus, /officeId \?\? "default"/);
  assert.match(bus, /missing officeId/);
  console.log("  ✅ eventBus fail-closed — no default office_id");
}

function testLifecycleMigration() {
  const migration = readFileSync(resolve(__dirname, "../../../../lib/db/drizzle/0002_tenant_lifecycle.sql"), "utf8");
  assert.match(migration, /lifecycle_status/);
  assert.match(migration, /is_primary/);
  console.log("  ✅ migration 0002_tenant_lifecycle present");
}

function testControlTowerUsesPersistentFreeze() {
  const ct = readModule("modules/platform/control-tower.ts");
  assert.match(ct, /setTenantLifecycle/);
  assert.doesNotMatch(ct, /frozenTenants\.add/);
  assert.match(ct, /isOfficeLifecycleBlocked/);
  console.log("  ✅ control-tower uses persistent tenant lifecycle");
}

function testEventListenersFailClosed() {
  for (const rel of [
    "core/listeners/notificationListener.ts",
    "core/listeners/analyticsListener.ts",
    "core/listeners/autopilotListener.ts",
  ]) {
    const src = readModule(rel);
    assert.doesNotMatch(src, /officeId \?\? "default"/);
    assert.match(src, /requireEventOfficeId/);
  }
  const finance = readModule("core/listeners/financeListener.ts");
  assert.doesNotMatch(finance, /officeId \?\? "default"/);
  assert.match(finance, /isRealOfficeTenantId/);
  console.log("  ✅ event listeners fail-closed — no default tenant");
}

function testCanonicalSuperAdmin() {
  const sa = readFileSync(resolve(SRC, "core/platform/superAdmin.ts"), "utf8");
  const kernel = readModule("core/tenant/tenantKernel.ts");
  assert.match(sa, /export async function checkIsSuperAdmin/);
  assert.match(kernel, /checkIsSuperAdmin/);
  assert.doesNotMatch(kernel, /isSuperAdminUser/);
  console.log("  ✅ super-admin check deduplicated");
}

function testLifecycleBootSync() {
  const lc = readModule("core/tenant/tenantLifecycle.ts");
  assert.match(lc, /bootLifecycleCache/);
  assert.match(lc, /lifecycleBlockedCache/);
  console.log("  ✅ lifecycle boot cache sync present");
}

function testEmailCronPerOffice() {
  const cron = readModule("cron/emailCron.ts");
  assert.doesNotMatch(cron, /office_id = 'default'/);
  assert.match(cron, /runAsSystemTenant/);
  assert.match(cron, /listEmailEnabledOffices/);
  console.log("  ✅ emailCron — per-office tenant scope");
}

function testBillingUsesTenantMiddleware() {
  const billing = readModule("modules/financial/billing.ts");
  assert.match(billing, /requireAuthWithTenant/);
  assert.match(billing, /getRequiredTenantId/);
  assert.doesNotMatch(billing, /resolveTenantId/);
  console.log("  ✅ billing.ts — canonical tenant middleware");
}

function main() {
  console.log("Tenant Kernel Hardening Tests — PR-TNT-002\n");
  testCanonicalKernelExists();
  testResolutionShimDelegates();
  testLifecycleInMiddleware();
  testEventBusNoDefaultTenant();
  testLifecycleMigration();
  testControlTowerUsesPersistentFreeze();
  testEventListenersFailClosed();
  testCanonicalSuperAdmin();
  testLifecycleBootSync();
  testEmailCronPerOffice();
  testBillingUsesTenantMiddleware();
  console.log("\n✅ All PR-TNT-002 tenant kernel tests passed\n");
}

main();
