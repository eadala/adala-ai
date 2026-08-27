/**
 * Stage 9 — Migration 057 monitoring isolation rls_* schema authority.
 * Run: pnpm --filter @workspace/api-server run test:monitoring-isolation-057
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const API = join(HERE, "..");

const readRepo = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const readSrc = (rel: string) => readFileSync(join(API, rel), "utf8");
const stripComments = (sql: string) => sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

console.log("\n═══ Migration 057 presence + monitoring isolation rls_* contract ═══");
const migPath = "artifacts/api-server/migrations/057_monitoring_isolation_rls_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-057.sql";
assert.ok(existsSync(join(ROOT, migPath)), "057 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "057 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /'rls_' \|\| rec\.tablename/);
assert.match(mig, /coalesce\(current_setting\('app\.current_tenant'/);
assert.match(mig, /app\.bypass_rls/);
assert.match(mig, /vault_tenant_isolation/);
assert.match(mig, /zta_tenant_isolation_/);
assert.match(mig, /INCOMPATIBLE_POLICY/);
assert.match(mig, /MONITORING_ISOLATION_RLS_SCHEMA_READY/);
assert.doesNotMatch(mig, /FORCE ROW LEVEL SECURITY/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+POLICY\b/im);
}
console.log("  ✅ 057 owns ENABLE + rls_* policies; skips 056 zta/vault");

console.log("\n═══ Preflight 057 SELECT-only ═══");
assert.match(pre, /Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /MONITORING_ISOLATION_RLS_SCHEMA_READY/);
assert.match(pre, /rls_office_branches/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+POLICY\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY");

console.log("\n═══ Runtime RLS DDL removed; routes / SA preserved ═══");
const iso = readSrc("modules/monitoring/isolation.ts");

assert.doesNotMatch(iso, /ALTER TABLE .* ENABLE ROW LEVEL SECURITY/);
assert.doesNotMatch(iso, /(?:^|[`'"])\s*CREATE POLICY\b/m);
assert.doesNotMatch(iso, /(?:^|[`'"])\s*DROP POLICY\b/m);
assert.match(iso, /Migration 057/);
assert.match(iso, /verifyIsolationRlsReadiness/);
assert.match(iso, /requireSuperAdmin/);
assert.match(iso, /ownedBy056/);
assert.match(iso, /GET \/isolation\/rls-status/);
assert.match(iso, /POST \/isolation\/test/);
console.log("  ✅ isolation.ts readiness-only; SA guards + routes kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:monitoring-isolation-057/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:monitoring-isolation-057/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_057|scenario_migration_057/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /057_monitoring_isolation_rls_schema_authority/);
console.log("  ✅ wiring complete");

console.log("\n✅ monitoringIsolationRlsSchemaAuthority057: all checks passed\n");
