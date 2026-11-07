/**
 * Recovery — invitations office isolation (SEC-005).
 * Run: pnpm --filter @workspace/api-server run test:rbac-invitations
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, "../modules/platform/rbac.ts"), "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

console.log("\n═══ GET /rbac/invitations isolation ═══");
{
  assert.match(
    code,
    /router\.get\(\s*["']\/rbac\/invitations["']\s*,\s*requireAuthWithTenant/,
  );
  assert.match(
    code,
    /eq\(\s*invitationsTable\.officeId\s*,\s*tenantId\s*\)/,
    "office tenants must filter by officeId",
  );
  assert.match(
    code,
    /isNull\(\s*invitationsTable\.officeId\s*\)/,
    "historical NULL office_id rows remain invitedBy-scoped",
  );
  assert.match(code, /tenantId === ["']platform["']/);
  console.log("  ✅ list scoped by officeId (+ NULL/invitedBy transitional)");
}

console.log("\n═══ POST binds officeId + invitedBy ═══");
{
  assert.match(code, /officeId:\s*tenantId/);
  assert.match(code, /invitedBy:\s*userId/);
  assert.match(
    code,
    /tenantId === ["']platform["'][\s\S]{0,120}403/,
    "platform must not create office invites without office context",
  );
  console.log("  ✅ create binds trusted tenant + user");
}

console.log("\n═══ mutate ownership via canManageInvitation ═══");
{
  assert.match(code, /canManageInvitation/);
  assert.match(code, /inv\.officeId === tenantId|officeId === tenantId/);
  console.log("  ✅ resend/delete office-aware");
}

console.log("\n═══ Stripe webhook registry path ═══");
{
  const reg = readFileSync(join(HERE, "../lib/integrationsRegistry.ts"), "utf8");
  assert.match(reg, /webhookPath:\s*["']\/api\/stripe\/webhook["']/);
  assert.doesNotMatch(reg, /webhookPath:\s*["']\/api\/billing\/stripe-webhook["']/);
  console.log("  ✅ integrationsRegistry points at /api/stripe/webhook");
}

console.log("\n═══ mediators/stats Super Admin ═══");
{
  const med = readFileSync(join(HERE, "../modules/legal-core/mediators.ts"), "utf8");
  const medCode = med.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.match(
    medCode,
    /router\.get\(\s*["']\/mediators\/stats["']\s*,\s*requireSuperAdmin/,
  );
  console.log("  ✅ mediators/stats requires Super Admin");
}

console.log("\n═══ fail-closed pool clear (ADR-001 implemented) ═══");
{
  const app = readFileSync(join(HERE, "../app.ts"), "utf8");
  assert.doesNotMatch(app, /set_config\('app\.current_tenant',\s*''/);
  assert.match(app, /clearTenantSessionFailClosed|setFailClosedTenantSession/);
  assert.match(
    readFileSync(join(HERE, "..", "..", "..", "..", "docs/security/ADR-001-fail-closed-rls.md"), "utf8"),
    /Accepted|Implemented|fail-closed/i,
  );
  console.log("  ✅ pool clear is fail-closed sentinel; ADR updated");
}

console.log("\n✅ rbacInvitationsIsolation: all checks passed\n");
