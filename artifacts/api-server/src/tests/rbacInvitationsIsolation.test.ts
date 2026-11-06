/**
 * Recovery P0/P1 — invitations must not dump all rows to any office user.
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
    /invitedBy,\s*userId|eq\(\s*invitationsTable\.invitedBy\s*,\s*userId\s*\)/,
    "office users must filter invitations by invitedBy = userId",
  );
  assert.match(code, /tenantId === ["']platform["']/);
  /* Office branch must use invitedBy filter (platform branch may list all) */
  assert.match(
    code,
    /tenantId === ["']platform["'][\s\S]{0,250}eq\(\s*invitationsTable\.invitedBy\s*,\s*userId\s*\)/,
    "non-platform path must filter by invitedBy",
  );
  console.log("  ✅ invitations list scoped by invitedBy (platform may see all)");
}

console.log("\n═══ POST binds invitedBy to auth user ═══");
{
  assert.match(
    code,
    /invitedBy:\s*userId/,
    "POST must set invitedBy from authenticated userId",
  );
  console.log("  ✅ invitedBy bound server-side");
}

console.log("\n═══ mutate ownership check ═══");
{
  assert.match(code, /existing\.invitedBy !== userId/);
  console.log("  ✅ resend/delete check invitedBy ownership");
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

console.log("\n✅ rbacInvitationsIsolation: all checks passed\n");
