/**
 * Negative security tests for AI gateway tenant helper.
 * Run: pnpm --filter @workspace/api-server run test:ai-gateway-tenant-negative
 */
import assert from "node:assert/strict";
import {
  isAiGatewayAdmin,
  requireAiGatewayOfficeId,
  resolveAiGatewayOfficeId,
} from "../lib/aiGatewayTenant";

console.log("\n═══ body/userId must never become officeId ═══");
{
  const attacker = {
    tenantId: undefined as string | undefined,
    userId: "user_attacker",
    body: { officeId: "other-office", tenantId: "other-office" },
  };
  assert.equal(resolveAiGatewayOfficeId(attacker), null);
  assert.equal(requireAiGatewayOfficeId(attacker).reject, true);
  console.log("  ✅ userId/body officeId ignored");
}

console.log("\n═══ client cannot spoof admin without isSuperAdmin ═══");
{
  assert.equal(isAiGatewayAdmin({ isAdmin: false }), false);
  assert.equal(
    requireAiGatewayOfficeId(
      { isAdmin: "true" },
      { allowAdminWithoutTenant: true },
    ).reject,
    true,
  );
  assert.equal(
    requireAiGatewayOfficeId(
      { isSuperAdmin: true },
      { allowAdminWithoutTenant: true },
    ).reject,
    false,
  );
  console.log("  ✅ only boolean isSuperAdmin/isAdmin grant aggregate bypass");
}

console.log("\n═══ platform synthetic tenant never scopes AI office cache ═══");
{
  assert.equal(resolveAiGatewayOfficeId({ tenantId: "platform", isSuperAdmin: true }), null);
  console.log("  ✅ platform rejected as office id");
}

console.log("\n✅ aiGatewayTenant negative tests passed\n");
