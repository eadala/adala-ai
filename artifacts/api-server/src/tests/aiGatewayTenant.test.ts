/**
 * Fail-closed AI gateway tenant resolution.
 * Run: pnpm --filter @workspace/api-server run test:ai-gateway-tenant
 */
import assert from "node:assert/strict";
import {
  isAiGatewayAdmin,
  requireAiGatewayOfficeId,
  resolveAiGatewayOfficeId,
} from "../lib/aiGatewayTenant";

console.log("\n═══ resolveAiGatewayOfficeId ═══");
{
  assert.equal(resolveAiGatewayOfficeId({ tenantId: "  office-uuid  " }), "office-uuid");
  assert.equal(resolveAiGatewayOfficeId({ tenantId: "unknown" }), null);
  assert.equal(resolveAiGatewayOfficeId({ tenantId: "platform" }), null);
  assert.equal(resolveAiGatewayOfficeId({ tenantId: "" }), null);
  assert.equal(resolveAiGatewayOfficeId({ tenantId: 123 as any }), null);
  assert.equal(resolveAiGatewayOfficeId({}), null);
  assert.equal(resolveAiGatewayOfficeId({ tenantId: undefined }), null);
  console.log("  ✅ rejects unknown/platform/empty; accepts trimmed tenantId");
}

console.log("\n═══ requireAiGatewayOfficeId ═══");
{
  const ok = requireAiGatewayOfficeId({ tenantId: "t1" });
  assert.equal(ok.reject, false);
  assert.equal(ok.officeId, "t1");

  const noTenant = requireAiGatewayOfficeId({});
  assert.equal(noTenant.reject, true);
  assert.equal(noTenant.officeId, null);

  const adminOk = requireAiGatewayOfficeId(
    { isSuperAdmin: true },
    { allowAdminWithoutTenant: true },
  );
  assert.equal(adminOk.reject, false);
  assert.equal(adminOk.officeId, null);

  const platformSa = requireAiGatewayOfficeId(
    { tenantId: "platform", isSuperAdmin: true },
    { allowAdminWithoutTenant: true },
  );
  assert.equal(platformSa.reject, false);
  assert.equal(platformSa.officeId, null);

  const adminStillNeedsForQuery = requireAiGatewayOfficeId({ isSuperAdmin: true });
  assert.equal(adminStillNeedsForQuery.reject, true);
  console.log("  ✅ fail-closed for non-admin; optional SA aggregate bypass");
}

console.log("\n═══ isAiGatewayAdmin ═══");
{
  assert.equal(isAiGatewayAdmin({}), false);
  assert.equal(isAiGatewayAdmin({ isSuperAdmin: true }), true);
  assert.equal(isAiGatewayAdmin({ isAdmin: true }), true);
  console.log("  ✅ admin flags recognized");
}

console.log("\n✅ aiGatewayTenant tests passed\n");
