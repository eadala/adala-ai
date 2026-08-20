/**
 * Stage 8 — Migration 049 HR Performance schema authority.
 * Run: pnpm --filter @workspace/api-server run test:hr-performance-049
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

console.log("\n═══ Migration 049 presence + HR Performance contract ═══");
const migPath = "artifacts/api-server/migrations/049_hr_performance_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-049.sql";
assert.ok(existsSync(join(ROOT, migPath)), "049 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "049 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS performance_evaluations/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS employee_incentives/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS hr_settings/);
assert.match(mig, /office_id\s+TEXT\s+NOT\s+NULL/);
assert.match(mig, /UNIQUE\s*\(\s*key\s*\)/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /HR_PERFORMANCE_SCHEMA_READY/);
assert.match(mig, /UPDATE performance_evaluations pe[\s\S]*SET office_id = e\.office_id/);
assert.match(mig, /UPDATE employee_incentives ei[\s\S]*SET office_id = e\.office_id/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /FOREIGN\s+KEY/i);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS hr_announcements\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS events\b/);
}
console.log("  ✅ 049 owns performance_evaluations + employee_incentives office_id + hr_settings UNIQUE(key)");

console.log("\n═══ Preflight 049 SELECT-only + exact UNIQUE(key) arbiter ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /HR_PERFORMANCE_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /duplicate_unique_keys|DUPLICATE_UNIQUE_KEY/);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
assert.match(pre, /GROUP BY x\.indexrelid/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY; exact hr_settings UNIQUE(key)");

console.log("\n═══ Runtime DDL removed; DML + seed preserved ═══");
const hrPerf = readSrc("modules/operations/hrPerformance.ts");
assert.doesNotMatch(hrPerf, /CREATE TABLE IF NOT EXISTS performance_evaluations/);
assert.doesNotMatch(hrPerf, /CREATE TABLE IF NOT EXISTS employee_incentives/);
assert.doesNotMatch(hrPerf, /CREATE TABLE IF NOT EXISTS hr_settings/);
assert.match(hrPerf, /to_regclass\('public\.performance_evaluations'\)/);
assert.match(hrPerf, /to_regclass\('public\.employee_incentives'\)/);
assert.match(hrPerf, /to_regclass\('public\.hr_settings'\)/);
assert.match(hrPerf, /ON CONFLICT \(key\) DO NOTHING/);
assert.match(hrPerf, /ON CONFLICT \(key\) DO UPDATE SET val/);
assert.match(hrPerf, /INSERT INTO performance_evaluations[\s\S]*office_id/);
assert.match(hrPerf, /INSERT INTO employee_incentives \(office_id, employee_id/);
assert.match(hrPerf, /INNER JOIN employees e ON pe\.employee_id = e\.id::text AND e\.office_id = \$\{tid\}/);
console.log("  ✅ Runtime CREATE gone; readiness + seed; office_id INSERT and tenant joins kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:hr-performance-049/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:hr-performance-049/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_049|scenario_migration_049/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig049_legacy_no_office|mig049_wrong_unique|mig049_dup_key/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /049_hr_performance_schema_authority/);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^performance_evaluations$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^employee_incentives$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^hr_settings$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^performance_evaluations$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^employee_incentives$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^hr_settings$/m);
console.log("  ✅ package/CI/integration/README/P0 wired");

console.log("\n✅ hrPerformanceSchemaAuthority049 tests passed\n");
