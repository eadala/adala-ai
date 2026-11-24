/**
 * Stage 8 — Migration 050 HR Enterprise schema authority.
 * Run: pnpm --filter @workspace/api-server run test:hr-enterprise-050
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

console.log("\n═══ Migration 050 presence + HR Enterprise contract ═══");
const migPath = "artifacts/api-server/migrations/050_hr_enterprise_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-050.sql";
assert.ok(existsSync(join(ROOT, migPath)), "050 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "050 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS hr_roles/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS hr_memberships/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS hr_workflows/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS hr_audit_logs/);
assert.match(mig, /UNIQUE\s*\(\s*office_id\s*,\s*name\s*\)/);
assert.match(mig, /UNIQUE\s*\(\s*office_id\s*,\s*user_id\s*\)/);
assert.match(mig, /idx_hrwf_office/);
assert.match(mig, /idx_hral_office/);
assert.match(mig, /created_at DESC/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /HR_ENTERPRISE_SCHEMA_READY/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /FOREIGN\s+KEY/i);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS hr_announcements\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS performance_evaluations\b/);
}
console.log("  ✅ 050 owns hr_roles/memberships/workflows/audit_logs + UNIQUEs + indexes");

console.log("\n═══ Preflight 050 SELECT-only + UNIQUE/index arbiters ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /HR_ENTERPRISE_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /GROUP BY x\.indexrelid/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY");

console.log("\n═══ Runtime DDL removed; DML preserved ═══");
const src = readSrc("modules/operations/hr-enterprise.ts");
assert.doesNotMatch(src, /CREATE TABLE IF NOT EXISTS hr_roles/);
assert.doesNotMatch(src, /CREATE TABLE IF NOT EXISTS hr_memberships/);
assert.doesNotMatch(src, /CREATE TABLE IF NOT EXISTS hr_workflows/);
assert.doesNotMatch(src, /CREATE TABLE IF NOT EXISTS hr_audit_logs/);
assert.doesNotMatch(src, /CREATE INDEX IF NOT EXISTS idx_hrwf_office/);
assert.doesNotMatch(src, /CREATE INDEX IF NOT EXISTS idx_hral_office/);
assert.match(src, /to_regclass\('public\.hr_roles'\)/);
assert.match(src, /ON CONFLICT \(office_id, name\) DO NOTHING/);
assert.match(src, /ON CONFLICT \(office_id, name\) DO UPDATE/);
assert.match(src, /ON CONFLICT \(office_id, user_id\) DO UPDATE/);
assert.match(src, /WHERE r\.office_id = \$\{tid\}/);
assert.match(src, /m\.office_id = \$\{officeId\}/);
console.log("  ✅ Runtime CREATE/INDEX gone; readiness + ON CONFLICT + tenant predicates kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:hr-enterprise-050/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:hr-enterprise-050/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_050|scenario_migration_050/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig050_wrong_unique|mig050_dup_key|mig050_wrong_idx|mig050_extra_unique/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /050_hr_enterprise_schema_authority/);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^hr_roles$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^hr_memberships$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^hr_workflows$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^hr_audit_logs$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^hr_roles$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^hr_memberships$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^hr_workflows$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^hr_audit_logs$/m);
console.log("  ✅ package/CI/integration/README/P0 wired");

console.log("\n✅ hrEnterpriseSchemaAuthority050 tests passed\n");
