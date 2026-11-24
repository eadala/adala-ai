/**
 * Stage 9 — Migration 053 Security Centers schema authority.
 * Run: pnpm --filter @workspace/api-server run test:security-centers-053
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

console.log("\n═══ Migration 053 presence + Security Centers contract ═══");
const migPath = "artifacts/api-server/migrations/053_security_centers_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-053.sql";
assert.ok(existsSync(join(ROOT, migPath)), "053 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "053 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const table of [
  "security_sessions",
  "security_alerts",
  "blocked_ips",
  "mfa_status_cache",
  "audit_coverage_rules",
  "audit_risk_scores",
  "compliance_controls",
  "data_requests",
  "retention_policies",
  "legal_holds",
  "dr_restore_points",
  "dr_test_runs",
  "dr_health_checks",
  "high_risk_op_log",
  "recovery_codes",
]) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
assert.match(mig, /UNIQUE\s*\(\s*framework\s*,\s*control_id\s*\)/);
assert.match(mig, /UNIQUE\s*\(\s*resource_type\s*\)/);
assert.match(mig, /ip_address\s+TEXT UNIQUE NOT NULL/);
assert.match(mig, /user_id\s+TEXT PRIMARY KEY/);
assert.match(mig, /REFERENCES dr_restore_points\(id\) ON DELETE CASCADE/);
assert.match(mig, /dr_test_runs_restore_point_id_fkey/);
assert.match(mig, /idx_security_sessions_user/);
assert.match(mig, /idx_audit_logs_created_at/);
assert.match(mig, /created_at DESC/);
assert.match(mig, /idx_blocked_ips_ip/);
assert.match(mig, /idx_high_risk_op_user/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /INCOMPATIBLE_FK/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /ORPHAN_FK/);
assert.match(mig, /SECURITY_CENTERS_SCHEMA_READY/);
assert.match(mig, /skipping % — table % missing/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS audit_logs\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS document_retention_policies\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS hr_roles\b/);
}
console.log("  ✅ 053 owns Security Center tables + UNIQUEs + FK CASCADE + indexes");

console.log("\n═══ Preflight 053 SELECT-only + UNIQUE/index/FK arbiters ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /SECURITY_CENTERS_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /INCOMPATIBLE_FK/);
assert.match(pre, /ORPHAN_FK/);
assert.match(pre, /GROUP BY x\.indexrelid/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /ALWAYS probed by global name|probed by global name/i);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY");

console.log("\n═══ Runtime DDL removed; DML / seeds / SA / tenant preserved ═══");
const soc = readSrc("modules/security/soc.ts");
const audit = readSrc("modules/security/auditCenter.ts");
const compliance = readSrc("modules/security/complianceCenter.ts");
const dr = readSrc("modules/security/drCenter.ts");
const mfa = readSrc("modules/security/mfaCenter.ts");

assert.doesNotMatch(soc, /CREATE TABLE IF NOT EXISTS security_sessions/);
assert.doesNotMatch(soc, /CREATE TABLE IF NOT EXISTS blocked_ips/);
assert.doesNotMatch(soc, /CREATE INDEX IF NOT EXISTS idx_security_sessions_user/);
assert.match(soc, /to_regclass\('public\.security_sessions'\)/);
assert.match(soc, /to_regclass\('public\.mfa_status_cache'\)/);
assert.match(soc, /ON CONFLICT \(ip_address\)/);
assert.match(soc, /requireSuperAdmin/);
assert.match(soc, /office_id/);

assert.doesNotMatch(audit, /CREATE TABLE IF NOT EXISTS audit_coverage_rules/);
assert.doesNotMatch(audit, /CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at/);
assert.match(audit, /to_regclass\('public\.audit_coverage_rules'\)/);
assert.match(audit, /requireSuperAdmin/);

assert.doesNotMatch(compliance, /CREATE TABLE IF NOT EXISTS retention_policies/);
assert.doesNotMatch(compliance, /CREATE TABLE IF NOT EXISTS compliance_controls/);
assert.doesNotMatch(compliance, /CREATE INDEX IF NOT EXISTS idx_data_requests_status/);
assert.match(compliance, /to_regclass\('public\.retention_policies'\)/);
assert.match(compliance, /INSERT INTO compliance_controls/);
assert.match(compliance, /ON CONFLICT \(framework, control_id\) DO NOTHING/);
assert.match(compliance, /INSERT INTO retention_policies/);
assert.match(compliance, /ON CONFLICT \(resource_type\) DO NOTHING/);
assert.doesNotMatch(compliance, /document_retention_policies/);
assert.match(compliance, /requireSuperAdmin/);
assert.match(compliance, /office_id/);

assert.doesNotMatch(dr, /CREATE TABLE IF NOT EXISTS dr_restore_points/);
assert.doesNotMatch(dr, /CREATE TABLE IF NOT EXISTS dr_test_runs/);
assert.match(dr, /to_regclass\('public\.dr_restore_points'\)/);
assert.match(dr, /INSERT INTO dr_restore_points/);
assert.match(dr, /requireSuperAdmin/);

assert.doesNotMatch(mfa, /CREATE TABLE IF NOT EXISTS high_risk_op_log/);
assert.doesNotMatch(mfa, /CREATE INDEX IF NOT EXISTS idx_high_risk_op_user/);
assert.match(mfa, /to_regclass\('public\.high_risk_op_log'\)/);
assert.match(mfa, /ON CONFLICT \(user_id\)/);
assert.match(mfa, /requireSuperAdmin/);
console.log("  ✅ Runtime CREATE/INDEX gone; readiness + seeds + ON CONFLICT + SA kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:security-centers-053/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:security-centers-053/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_053|scenario_migration_053/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig053_wrong_unique|mig053_dup_key|mig053_wrong_idx|mig053_stolen|mig053_orphan/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /053_security_centers_schema_authority/);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^security_sessions$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^retention_policies$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^dr_test_runs$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^blocked_ips\.ip_address$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^compliance_controls\.framework$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^mfa_status_cache\.user_id$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^security_sessions$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^retention_policies$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^high_risk_op_log$/m);
console.log("  ✅ package/CI/integration/README/P0 wired");

console.log("\n✅ securityCentersSchemaAuthority053 tests passed\n");
