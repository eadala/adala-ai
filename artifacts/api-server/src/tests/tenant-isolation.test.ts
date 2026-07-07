/**
 * Tenant Isolation Security Tests — Phase 1 (T-ISO-01 … T-ISO-07)
 * Run: DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/tests/tenant-isolation.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FORBIDDEN_TENANT_IDS,
  TENANT_REQUIRED_CODE,
  TenantRequiredError,
  allowLegacyDefaultTenant,
  getRequiredOfficeId,
  getRequiredTenantId,
  isRealOfficeTenantId,
  runWithTenant,
  tenantRequiredResponse,
} from "../core/tenantContext";
import { buildCacheKey } from "../modules/ai/aiGateway";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..");

function readModule(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

/* ── T-ISO-03: tenant-required endpoint returns TNT_403 semantics ── */
function testT_ISO_03() {
  assert.throws(() => getRequiredTenantId({}), TenantRequiredError);
  const body = tenantRequiredResponse();
  assert.equal(body.code, TENANT_REQUIRED_CODE);
  console.log("  ✅ T-ISO-03: missing tenant → TenantRequiredError / TNT_403");
}

/* ── T-ISO-04: copilot tools cannot mutate without validated tenant ── */
function testT_ISO_04() {
  const toolRegistry = readModule("copilot/tool.registry.ts");
  assert.doesNotMatch(toolRegistry, /getTenantSafe\(\)\?\.officeId\s*\?\?\s*["']default["']/);
  assert.match(toolRegistry, /getRequiredOfficeId/);
  for (const banned of FORBIDDEN_TENANT_IDS) {
    assert.throws(
      () => runWithTenant({ userId: "u1", officeId: banned }, () => getRequiredOfficeId()),
      TenantRequiredError,
    );
  }
  console.log("  ✅ T-ISO-04: copilot tools use getRequiredOfficeId — no default fallback");
}

/* ── T-ISO-05: entitlements isolated per validated tenant ── */
function testT_ISO_05() {
  const entitlements = readModule("modules/platform/entitlements.ts");
  assert.match(entitlements, /requireAuthWithTenant/);
  assert.match(entitlements, /getRequiredTenantId/);
  assert.doesNotMatch(entitlements, /return\s*["']default["']\s*;/);
  assert.doesNotMatch(entitlements, /officeId\s*=\s*["']default["']/);
  console.log("  ✅ T-ISO-05: entitlements bound to getRequiredTenantId");
}

/* ── T-ISO-06: internal messages scoped by office_id on all folders ── */
function testT_ISO_06() {
  const messages = readModule("modules/operations/internal-messages.ts");
  assert.match(messages, /requireAuthWithTenant/);
  const officeFilters = (messages.match(/m\.office_id\s*=\s*\$\{tenantId\}/g) ?? []).length;
  assert.ok(officeFilters >= 4, `expected office_id filters in all folders, got ${officeFilters}`);
  assert.match(messages, /folder === ['"]archive['"]/);
  assert.match(messages, /sender_id = \$\{userId\}/);
  console.log("  ✅ T-ISO-06: internal messages tenant + authorization on all folders");
}

/* ── T-ISO-07: AI cache keys tenant-isolated (office + user + type + model) ── */
function testT_ISO_07() {
  const input = "ما هي مدة التقادم؟";
  const base = { type: "legal_assistant", model: "auto", input };
  const keyA = buildCacheKey({ ...base, officeId: "office_a", userId: "user_1" });
  const keyB = buildCacheKey({ ...base, officeId: "office_b", userId: "user_1" });
  const keyOtherUser = buildCacheKey({ ...base, officeId: "office_a", userId: "user_2" });
  const keyOtherModel = buildCacheKey({ ...base, officeId: "office_a", userId: "user_1", model: "gemini" });

  assert.notEqual(keyA, keyB);
  assert.notEqual(keyA, keyOtherUser);
  assert.notEqual(keyA, keyOtherModel);

  const gateway = readModule("modules/ai/aiGateway.ts");
  assert.match(gateway, /requireAuthWithTenant/);
  assert.match(gateway, /getRequiredTenantId/);
  assert.doesNotMatch(gateway, /tenantId\s*\?\?\s*\(req as any\)\.userId/);

  const providerEngine = readModule("modules/ai/aiProviderEngine.ts");
  assert.match(providerEngine, /requireAuthWithTenant/);
  assert.doesNotMatch(providerEngine, /tenantId\s*\?\?\s*\(req as any\)\.userId/);

  const integrations = readModule("modules/platform/managedIntegrations.ts");
  assert.match(integrations, /requireAuthWithTenant/);
  assert.doesNotMatch(integrations, /tenantId\s*\?\?\s*\(req as any\)\.userId/);
  console.log("  ✅ T-ISO-07: AI cache keys isolated by officeId, userId, type, model");
}

/* ── T-ISO-01 / T-ISO-02: canonical middleware + no duplicate implementation ── */
function testT_ISO_01_02() {
  const requireAuth = readModule("middlewares/requireAuth.ts");
  const tenantMw = readModule("middlewares/tenantMiddleware.ts");
  const tenantResolution = readModule("middlewares/tenantResolution.ts");

  assert.match(requireAuth, /export async function requireAuthWithTenant/);
  assert.doesNotMatch(tenantMw, /export async function requireAuthWithTenant\s*\(/);
  assert.match(tenantMw, /export \{ requireAuthWithTenant \} from "\.\/requireAuth"/);
  assert.match(tenantResolution, /tenantKernel/);
  assert.match(requireAuth, /assertTenantActive/);
  assert.match(requireAuth, /set_config\('app\.current_tenant'/);
  console.log("  ✅ T-ISO-01/02: single canonical middleware; kernel resolution");
}

function testLegacyDevFlag() {
  const prevNode = process.env.NODE_ENV;
  const prevFlag = process.env.ALLOW_LEGACY_DEFAULT_TENANT;

  process.env.NODE_ENV = "development";
  process.env.ALLOW_LEGACY_DEFAULT_TENANT = "true";
  assert.equal(allowLegacyDefaultTenant(), true);

  for (const env of ["production", "staging", "test"]) {
    process.env.NODE_ENV = env;
    assert.equal(allowLegacyDefaultTenant(), false, `${env} must not allow legacy default`);
  }
  console.log("  ✅ legacy default allowed only in NODE_ENV=development");

  process.env.NODE_ENV = prevNode;
  process.env.ALLOW_LEGACY_DEFAULT_TENANT = prevFlag;
}

function testTenantContextPrimitives() {
  assert.equal(isRealOfficeTenantId("office_abc"), true);
  assert.equal(isRealOfficeTenantId("default"), false);
  assert.equal(getRequiredTenantId({ tenantId: "office_xyz" }), "office_xyz");

  runWithTenant({ userId: "u1", officeId: "office_a" }, () => {
    assert.equal(getRequiredOfficeId(), "office_a");
  });
  console.log("  ✅ tenant context primitives (getTenant path via ALS)");
}

function main() {
  console.log("Tenant Isolation Security Tests — Phase 1");
  console.log("\n═══ T-ISO acceptance tests ═══");
  testT_ISO_01_02();
  testT_ISO_03();
  testT_ISO_04();
  testT_ISO_05();
  testT_ISO_06();
  testT_ISO_07();
  testLegacyDevFlag();
  testTenantContextPrimitives();
  console.log("\n✅ All tenant isolation tests passed (T-ISO-01 … T-ISO-07)\n");
}

main();
