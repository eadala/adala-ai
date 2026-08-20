/**
 * Stage 8 — Migration 048 HR Internal schema authority.
 * Run: pnpm --filter @workspace/api-server run test:hr-internal-048
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

console.log("\n═══ Migration 048 presence + HR Internal contract ═══");
const migPath = "artifacts/api-server/migrations/048_hr_internal_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-048.sql";
assert.ok(existsSync(join(ROOT, migPath)), "048 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "048 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS hr_announcements/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS employee_requests/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS leave_balances/);
assert.match(mig, /UNIQUE\s*\(\s*employee_id\s*,\s*leave_type\s*,\s*year\s*\)/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /HR_INTERNAL_SCHEMA_READY/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /FOREIGN\s+KEY/i);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS hr_roles\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_notification_settings\b/);
}
console.log("  ✅ 048 owns hr_announcements + employee_requests + leave_balances UNIQUE(employee_id, leave_type, year)");

console.log("\n═══ Preflight 048 SELECT-only + exact UNIQUE arbiter ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /HR_INTERNAL_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /duplicate_unique_keys|DUPLICATE_UNIQUE_KEY/);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY; exact leave_balances unique arbiter");

console.log("\n═══ Runtime DDL removed; DML preserved ═══");
const hrInternal = readSrc("modules/operations/hrInternal.ts");
assert.doesNotMatch(hrInternal, /CREATE TABLE IF NOT EXISTS hr_announcements/);
assert.doesNotMatch(hrInternal, /CREATE TABLE IF NOT EXISTS employee_requests/);
assert.doesNotMatch(hrInternal, /CREATE TABLE IF NOT EXISTS leave_balances/);
assert.match(hrInternal, /to_regclass\('public\.hr_announcements'\)/);
assert.match(hrInternal, /to_regclass\('public\.employee_requests'\)/);
assert.match(hrInternal, /to_regclass\('public\.leave_balances'\)/);
assert.match(hrInternal, /INSERT INTO employee_requests/);
assert.match(hrInternal, /INSERT INTO leave_balances[\s\S]*ON CONFLICT \(employee_id, leave_type, year\) DO NOTHING/);
assert.match(hrInternal, /UPDATE leave_balances SET quota/);
console.log("  ✅ Runtime CREATE gone; readiness only; ON CONFLICT and tenant-scoped DML kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:hr-internal-048/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:hr-internal-048/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_048|scenario_migration_048/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig048_dup_unique|mig048_wrong_unique|mig048_extra_unique/);
assert.match(mig, /has incompatible UNIQUE index\(es\)/);
assert.match(pre, /GROUP BY x\.indexrelid/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /048_hr_internal_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ hrInternalSchemaAuthority048 tests passed\n");
