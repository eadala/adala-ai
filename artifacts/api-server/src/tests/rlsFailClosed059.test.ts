/**
 * ADR-001 / Migration 059 — fail-closed empty-tenant contract.
 * Run: pnpm --filter @workspace/api-server run test:rls-fail-closed-059
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const API = join(HERE, "..");
const readRepo = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const readSrc = (rel: string) => readFileSync(join(API, rel), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

console.log("\n═══ Migration 059 fail-closed ═══");
{
  const migPath = "artifacts/api-server/migrations/059_rls_fail_closed_empty_tenant.sql";
  assert.ok(existsSync(join(ROOT, migPath)));
  const mig = readRepo(migPath);
  assert.match(mig, /nullif\(current_setting\('app\.current_tenant'/);
  assert.match(mig, /app\.bypass_rls/);
  assert.match(mig, /DROP POLICY/);
  assert.match(mig, /RLS_FAIL_CLOSED_EMPTY_TENANT_READY/);
  assert.match(mig, /vault_tenant_isolation/);
  assert.doesNotMatch(strip(mig), /FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
  console.log("  ✅ 059 replaces fail-open rls_*; skips vault/zta; no FORCE");
}

console.log("\n═══ App fail-closed session helpers ═══");
{
  const sess = readSrc("lib/tenantSession.ts");
  assert.match(sess, /TENANT_DENY_SENTINEL\s*=\s*["']__unscoped__["']/);
  assert.match(sess, /setFailClosedTenantSession/);
  assert.match(sess, /setBypassRlsSession/);
  assert.match(sess, /setOfficeTenantSession/);

  const app = strip(readSrc("app.ts"));
  assert.match(app, /setFailClosedTenantSession/);
  assert.match(app, /clearTenantSessionFailClosed/);
  assert.doesNotMatch(app, /set_config\('app\.current_tenant',\s*''/);
  assert.match(app, /setBypassRlsSession/);

  const auth = strip(readSrc("middlewares/requireAuth.ts"));
  assert.match(auth, /setOfficeTenantSession/);
  assert.match(auth, /setBypassRlsSession/);
  console.log("  ✅ app + SA + office session never clear to empty privilege");
}

console.log("\n═══ Readiness accepts 057 or 059 quals ═══");
{
  const iso = readSrc("modules/monitoring/isolation.ts");
  assert.match(iso, /legacyFailOpen|failClosed|nullif/);
  assert.match(iso, /coalesce/);
  console.log("  ✅ isolation readiness dual-compatible");
}

console.log("\n═══ Wiring ═══");
{
  assert.match(readRepo("artifacts/api-server/package.json"), /test:rls-fail-closed-059/);
  assert.match(readRepo(".github/workflows/ci.yml"), /test:rls-fail-closed-059/);
  assert.match(readRepo("artifacts/api-server/migrations/README.md"), /059_rls_fail_closed/);
  assert.ok(existsSync(join(ROOT, "scripts/db/preflight-migration-059.sql")));
  console.log("  ✅ package/CI/README/preflight");
}

console.log("\n✅ rlsFailClosed059: all checks passed\n");
