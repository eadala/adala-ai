/**
 * Migration 060 — vault fail-closed (closes 056 empty-OR undercutting zta).
 * Run: pnpm --filter @workspace/api-server run test:vault-rls-060
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const readRepo = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/^[ \t]*--.*$/gm, "");

console.log("\n═══ Migration 060 vault fail-closed ═══");
{
  const mig = readRepo("artifacts/api-server/migrations/060_vault_rls_fail_closed.sql");
  assert.match(mig, /vault_tenant_isolation/);
  assert.match(mig, /nullif\(current_setting\('app\.current_tenant'/);
  assert.match(mig, /DROP POLICY vault_tenant_isolation/);
  assert.match(mig, /VAULT_RLS_FAIL_CLOSED_READY/);
  assert.doesNotMatch(strip(mig), /zta_tenant_isolation_/);
  assert.doesNotMatch(mig, /FORCE ROW LEVEL SECURITY/);
  console.log("  ✅ 060 replaces fail-open vault only; zta untouched");
}

console.log("\n═══ Stripe bypass AFTER signature verify ═══");
{
  const app = strip(readRepo("artifacts/api-server/src/app.ts"));
  assert.doesNotMatch(
    app,
    /setBypassRlsSession[\s\S]{0,200}processWebhook/,
    "app route must not set bypass before processWebhook",
  );
  const buf = readRepo("artifacts/api-server/src/services/stripeEventBuffer.ts");
  const constructIdx = buf.indexOf("constructEvent");
  const bypassIdx = buf.indexOf("setBypassRlsSession");
  assert.ok(constructIdx >= 0 && bypassIdx > constructIdx, "bypass must follow constructEvent");
  console.log("  ✅ Stripe bypass only after constructEvent");
}

console.log("\n═══ Wiring ═══");
{
  assert.ok(existsSync(join(ROOT, "scripts/db/preflight-migration-060.sql")));
  assert.match(readRepo("artifacts/api-server/package.json"), /test:vault-rls-060/);
  assert.match(readRepo(".github/workflows/ci.yml"), /test:vault-rls-060/);
  assert.match(readRepo("artifacts/api-server/migrations/README.md"), /060_vault_rls_fail_closed/);
  console.log("  ✅ package/CI/README/preflight");
}

console.log("\n✅ vaultRlsFailClosed060: all checks passed\n");
