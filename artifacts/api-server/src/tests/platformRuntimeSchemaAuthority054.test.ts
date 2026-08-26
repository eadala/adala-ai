/**
 * Stage 9 — Migration 054 Platform Runtime schema authority.
 * Run: pnpm --filter @workspace/api-server run test:platform-runtime-054
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

console.log("\n═══ Migration 054 presence + Platform Runtime contract ═══");
const migPath = "artifacts/api-server/migrations/054_platform_runtime_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-054.sql";
assert.ok(existsSync(join(ROOT, migPath)), "054 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "054 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const table of [
  "ct_security_events",
  "governance_action_log",
  "go_live_certificates",
  "system_audit_logs",
  "engineering_tasks",
  "engineering_scans",
  "engineering_ip_whitelist",
  "engineering_logs",
  "prod_incidents",
  "prod_heal_log",
  "launch_events",
  "os_events",
  "os_action_queue",
]) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
assert.match(mig, /message\s+TEXT/);
assert.match(mig, /metadata\s+JSONB/);
assert.match(mig, /UNIQUE\s*\(\s*certificate_id\s*\)/);
assert.match(mig, /ip_address\s+TEXT NOT NULL UNIQUE/);
assert.match(mig, /idx_ct_sec_events_severity/);
assert.match(mig, /idx_gov_log_created/);
assert.match(mig, /idx_sys_audit_admin/);
assert.match(mig, /idx_ct_sec_events_office/);
assert.match(mig, /idx_sys_audit_office/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /PLATFORM_RUNTIME_SCHEMA_READY/);
assert.match(mig, /to_regclass\('public\.engineering_scans'\)/);
assert.match(mig, /to_regclass\('public\.prod_heal_log'\)/);
assert.match(mig, /to_regclass\('public\.idx_sys_audit_office'\)/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
}
console.log("  ✅ 054 owns Platform Runtime tables + indexes + UNIQUEs");

console.log("\n═══ Preflight 054 SELECT-only ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /PLATFORM_RUNTIME_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /engineering_ip_whitelist\(ip_address\)/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY");

console.log("\n═══ Runtime DDL removed; DML / SA / tenant preserved ═══");
const controlTower = readSrc("modules/platform/control-tower.ts");
const launchGate = readSrc("modules/platform/launchGate.ts");
const governance = readSrc("core/governance/governanceKernel.ts");
const certification = readSrc("modules/platform/certification.ts");
const admin = readSrc("modules/platform/admin.ts");
const engineering = readSrc("modules/platform/engineering.ts");
const productionOs = readSrc("modules/platform/production-os.ts");
const productionLaunch = readSrc("modules/platform/productionLaunch.ts");
const saasOs = readSrc("modules/platform/saas-os.ts");

assert.doesNotMatch(controlTower, /CREATE TABLE IF NOT EXISTS ct_security_events/);
assert.match(controlTower, /to_regclass\('public\.ct_security_events'\)/);
assert.match(controlTower, /INSERT INTO ct_security_events/);
assert.match(controlTower, /requireSuperAdmin|ctGuard/);

assert.doesNotMatch(launchGate, /CREATE TABLE IF NOT EXISTS ct_security_events/);
assert.doesNotMatch(launchGate, /CREATE INDEX IF NOT EXISTS idx_ct_sec_events/);
assert.match(launchGate, /to_regclass\('public\.ct_security_events'\)/);
assert.match(launchGate, /UPDATE ct_security_events SET resolved=true/);
assert.match(launchGate, /requireSuperAdmin/);

assert.doesNotMatch(governance, /CREATE TABLE IF NOT EXISTS governance_action_log/);
assert.doesNotMatch(governance, /CREATE INDEX IF NOT EXISTS idx_gov_log_created/);
assert.match(governance, /to_regclass\('public\.governance_action_log'\)/);
assert.match(governance, /INSERT INTO governance_action_log/);

assert.doesNotMatch(certification, /CREATE TABLE IF NOT EXISTS go_live_certificates/);
assert.match(certification, /to_regclass\('public\.go_live_certificates'\)/);
assert.match(certification, /INSERT INTO go_live_certificates/);
assert.match(certification, /requireSuperAdmin/);

assert.doesNotMatch(admin, /CREATE TABLE IF NOT EXISTS system_audit_logs/);
assert.doesNotMatch(admin, /CREATE INDEX IF NOT EXISTS idx_sys_audit/);
assert.match(admin, /to_regclass\('public\.system_audit_logs'\)/);
assert.match(admin, /INSERT INTO system_audit_logs/);

assert.doesNotMatch(engineering, /CREATE TABLE IF NOT EXISTS engineering_tasks/);
assert.match(engineering, /to_regclass\('public\.engineering_tasks'\)/);
assert.match(engineering, /INSERT INTO engineering_logs/);
assert.match(engineering, /INSERT INTO engineering_ip_whitelist/);

assert.doesNotMatch(productionOs, /CREATE TABLE IF NOT EXISTS prod_incidents/);
assert.match(productionOs, /to_regclass\('public\.prod_incidents'\)/);

assert.doesNotMatch(productionLaunch, /CREATE TABLE IF NOT EXISTS launch_events/);
assert.match(productionLaunch, /to_regclass\('public\.launch_events'\)/);

assert.doesNotMatch(saasOs, /CREATE TABLE IF NOT EXISTS os_events/);
assert.match(saasOs, /to_regclass\('public\.os_events'\)/);
assert.match(saasOs, /INSERT INTO os_events/);
assert.match(saasOs, /INSERT INTO os_action_queue/);
console.log("  ✅ Runtime CREATE/INDEX gone; readiness + DML + SA kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:platform-runtime-054/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:platform-runtime-054/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_054|scenario_migration_054/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /054_platform_runtime_schema_authority/);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^ct_security_events$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^governance_action_log$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^os_action_queue$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^ct_security_events$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^governance_action_log$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^ct_security_events\.message$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^go_live_certificates\.certificate_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^engineering_ip_whitelist\.ip_address$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^system_audit_logs\.admin_user_id$/m);
console.log("  ✅ wiring complete");

console.log("\n✅ platformRuntimeSchemaAuthority054: all checks passed\n");
