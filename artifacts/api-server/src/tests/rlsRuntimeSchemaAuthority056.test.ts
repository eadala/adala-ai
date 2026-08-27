/**
 * Stage 9 — Migration 056 RLS Runtime schema authority.
 * Run: pnpm --filter @workspace/api-server run test:rls-runtime-056
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

console.log("\n═══ Migration 056 presence + RLS Runtime contract ═══");
const migPath = "artifacts/api-server/migrations/056_rls_runtime_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-056.sql";
assert.ok(existsSync(join(ROOT, migPath)), "056 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "056 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS security_events/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS rls_enablement_log/);
assert.match(mig, /ENABLE ROW LEVEL SECURITY/);
assert.match(mig, /FORCE ROW LEVEL SECURITY/);
assert.match(mig, /zta_tenant_isolation_/);
assert.match(mig, /vault_tenant_isolation/);
assert.match(mig, /NULLIF\(current_setting\('app\.current_tenant'/);
assert.match(mig, /app\.bypass_rls/);
assert.match(mig, /INCOMPATIBLE_POLICY/);
assert.match(mig, /RLS_RUNTIME_SCHEMA_READY/);
assert.match(mig, /idx_security_events_created/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+POLICY\b/im);
}
console.log("  ✅ 056 owns RLS ENABLE/FORCE + ZTA/vault policies + supporting tables");

console.log("\n═══ Preflight 056 SELECT-only ═══");
assert.match(pre, /Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /RLS_RUNTIME_SCHEMA_READY/);
assert.match(pre, /zta_tenant_isolation_cases/);
assert.match(pre, /vault_tenant_isolation/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+POLICY\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY");

console.log("\n═══ Runtime RLS DDL removed; routes / DML / SA preserved ═══");
const rls = readSrc("security/rls-migration.ts");
const vault = readSrc("modules/platform/dataVault.ts");
const zt = readSrc("security/zero-trust-router.ts");

assert.doesNotMatch(rls, /ALTER TABLE .* ENABLE ROW LEVEL SECURITY/);
assert.doesNotMatch(rls, /FORCE ROW LEVEL SECURITY/);
assert.doesNotMatch(rls, /(?:^|[`'"])\s*CREATE POLICY\b/m);
assert.doesNotMatch(rls, /(?:^|[`'"])\s*DROP POLICY\b/m);
assert.doesNotMatch(rls, /DISABLE ROW LEVEL SECURITY/);
assert.match(rls, /Migration 056/);
assert.match(rls, /relrowsecurity|rls_enabled/);

assert.doesNotMatch(vault, /ALTER TABLE .* ENABLE ROW LEVEL SECURITY/);
assert.doesNotMatch(vault, /(?:^|[`'"])\s*CREATE POLICY\b/m);
assert.doesNotMatch(vault, /(?:^|[`'"])\s*DROP POLICY\b/m);
assert.doesNotMatch(vault, /CREATE TABLE IF NOT EXISTS security_events/);
assert.doesNotMatch(vault, /CREATE TABLE IF NOT EXISTS rls_enablement_log/);
assert.match(vault, /to_regclass\('public\.security_events'\)/);
assert.match(vault, /INSERT INTO rls_enablement_log/);
assert.match(vault, /INSERT INTO security_events/);
assert.match(vault, /requireSuperAdmin/);

assert.match(zt, /requireAuthWithTenant/);
assert.match(zt, /applyRLS|getRLSStatus/);
assert.match(zt, /superAdminOnly|super_admin/);
assert.doesNotMatch(zt, /ENABLE ROW LEVEL SECURITY|CREATE POLICY/);
console.log("  ✅ Runtime RLS DDL gone; readiness + DML + SA kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:rls-runtime-056/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:rls-runtime-056/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_056|scenario_migration_056/);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^security_events$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^rls_enablement_log$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^security_events\.event_type$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^security_events$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^rls_enablement_log$/m);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /056_rls_runtime_schema_authority/);
console.log("  ✅ wiring complete");

console.log("\n✅ rlsRuntimeSchemaAuthority056: all checks passed\n");
