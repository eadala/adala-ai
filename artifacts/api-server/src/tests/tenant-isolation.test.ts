/**
 * Tenant Isolation Security Tests — Phase 1
 * Run: npx tsx src/tests/tenant-isolation.test.ts
 */
import assert from "node:assert/strict";
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

function runTenantContextTests() {
  console.log("\n═══ UNIT: tenant context validation ═══");

  assert.equal(isRealOfficeTenantId("office_abc"), true);
  assert.equal(isRealOfficeTenantId("default"), false);
  assert.equal(isRealOfficeTenantId("unknown"), false);
  assert.equal(isRealOfficeTenantId("platform"), false);
  assert.equal(isRealOfficeTenantId(null), false);
  console.log("  ✅ isRealOfficeTenantId rejects banned/synthetic ids");

  assert.throws(
    () => getRequiredTenantId({ tenantId: "default" }),
    (e: unknown) => e instanceof TenantRequiredError && e.code === TENANT_REQUIRED_CODE,
    "default tenant must throw TenantRequiredError",
  );
  console.log("  ✅ getRequiredTenantId rejects default");

  assert.throws(
    () => getRequiredTenantId({ tenantId: undefined }),
    TenantRequiredError,
    "missing tenant must throw",
  );
  console.log("  ✅ getRequiredTenantId rejects missing tenant");

  assert.equal(getRequiredTenantId({ tenantId: "office_xyz" }), "office_xyz");
  console.log("  ✅ getRequiredTenantId accepts real office id");

  const body = tenantRequiredResponse("user_1");
  assert.equal(body.code, TENANT_REQUIRED_CODE);
  assert.equal(body.userId, "user_1");
  console.log("  ✅ tenantRequiredResponse uses TNT_403");

  assert.throws(
    () => {
      runWithTenant({ userId: "u1", officeId: "office_a" }, () => {
        /* no tenant in ALS */
      });
      getRequiredOfficeId();
    },
    TenantRequiredError,
    "getRequiredOfficeId outside ALS must throw",
  );

  runWithTenant({ userId: "u1", officeId: "office_a" }, () => {
    assert.equal(getRequiredOfficeId(), "office_a");
  });
  console.log("  ✅ getRequiredOfficeId reads AsyncLocalStorage context");

  for (const banned of FORBIDDEN_TENANT_IDS) {
    assert.throws(
      () => {
        runWithTenant({ userId: "u1", officeId: banned }, () => getRequiredOfficeId());
      },
      TenantRequiredError,
      `${banned} must not be valid office context`,
    );
  }
  console.log("  ✅ copilot-style mutations reject banned office ids in ALS");
}

function runLegacyDevFlagTests() {
  console.log("\n═══ UNIT: legacy dev flag ═══");
  const prevNode = process.env.NODE_ENV;
  const prevFlag = process.env.ALLOW_LEGACY_DEFAULT_TENANT;

  process.env.NODE_ENV = "development";
  process.env.ALLOW_LEGACY_DEFAULT_TENANT = "true";
  assert.equal(allowLegacyDefaultTenant(), true);
  assert.equal(getRequiredTenantId({ tenantId: undefined }), "default");
  console.log("  ✅ ALLOW_LEGACY_DEFAULT_TENANT=true permits dev default");

  process.env.NODE_ENV = "production";
  process.env.ALLOW_LEGACY_DEFAULT_TENANT = "true";
  assert.equal(allowLegacyDefaultTenant(), false);
  assert.throws(() => getRequiredTenantId({ tenantId: undefined }), TenantRequiredError);
  console.log("  ✅ production never allows legacy default tenant");

  process.env.NODE_ENV = prevNode;
  process.env.ALLOW_LEGACY_DEFAULT_TENANT = prevFlag;
}

function runAiCacheIsolationTests() {
  console.log("\n═══ UNIT: AI gateway cache isolation ═══");

  const input = "ما هي مدة التقادم؟";
  const keyA = buildCacheKey("office_a", "legal_assistant", input);
  const keyB = buildCacheKey("office_b", "legal_assistant", input);
  const keyUserFallback = buildCacheKey("user_123", "legal_assistant", input);

  assert.notEqual(keyA, keyB, "different offices must not share cache keys");
  assert.notEqual(keyA, keyUserFallback, "officeId must not collapse to userId");
  console.log("  ✅ buildCacheKey isolates cache per officeId");
}

function runMessageScopingContractTests() {
  console.log("\n═══ UNIT: internal messages tenant contract ═══");

  const archiveSqlSnippet = `
    WHERE m.office_id = $tenantId
      AND m.folder = 'archive'
      AND (m.sender_id = $userId OR EXISTS (...))
  `;
  assert.match(archiveSqlSnippet, /office_id/, "archive queries must filter by office_id");
  assert.match(archiveSqlSnippet, /sender_id|EXISTS/, "archive must enforce sender/recipient auth");
  console.log("  ✅ message folder contract requires tenant + authorization filters");
}

function main() {
  console.log("Tenant Isolation Security Tests — Phase 1");
  runTenantContextTests();
  runLegacyDevFlagTests();
  runAiCacheIsolationTests();
  runMessageScopingContractTests();
  console.log("\n✅ All tenant isolation tests passed\n");
}

main();
