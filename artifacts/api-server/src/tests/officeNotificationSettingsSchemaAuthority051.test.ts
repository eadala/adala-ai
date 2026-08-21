/**
 * Stage 8 — Migration 051 office_notification_settings schema authority.
 * Run: pnpm --filter @workspace/api-server run test:office-notif-051
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

console.log("\n═══ Migration 051 presence + office_notification_settings contract ═══");
const migPath = "artifacts/api-server/migrations/051_office_notification_settings_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-051.sql";
assert.ok(existsSync(join(ROOT, migPath)), "051 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "051 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS office_notification_settings/);
assert.match(mig, /UNIQUE\s*\(\s*office_id\s*,\s*event_type\s*\)/);
assert.match(mig, /updated_at\s+TIMESTAMP\b/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /OFFICE_NOTIFICATION_SETTINGS_SCHEMA_READY/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /FOREIGN\s+KEY/i);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS hr_roles\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS events\b/);
}
console.log("  ✅ 051 owns office_notification_settings + UNIQUE(office_id, event_type)");

console.log("\n═══ Preflight 051 SELECT-only + UNIQUE arbiter ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /OFFICE_NOTIFICATION_SETTINGS_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
assert.match(pre, /GROUP BY x\.indexrelid/);
assert.match(pre, /udt_name.*timestamp|expected_udt.*timestamp|'timestamp'/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY");

console.log("\n═══ Runtime DDL removed; DML preserved ═══");
const src = readSrc("modules/operations/notifications.ts");
assert.doesNotMatch(src, /CREATE TABLE IF NOT EXISTS office_notification_settings/);
assert.match(src, /to_regclass\('public\.office_notification_settings'\)/);
assert.match(src, /ON CONFLICT \(office_id, event_type\) DO UPDATE/);
assert.match(src, /WHERE office_id = \$\{officeId\}/);
assert.match(src, /ensureOfficeNotificationSettingsTable/);
const listener = readSrc("core/listeners/notificationListener.ts");
assert.match(listener, /FROM office_notification_settings/);
assert.match(listener, /WHERE office_id = \$\{officeId\}/);
console.log("  ✅ Runtime CREATE gone; readiness + ON CONFLICT + office predicates kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:office-notif-051/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:office-notif-051/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_051|scenario_migration_051/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig051_wrong_unique|mig051_dup_key|mig051_extra_unique/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /051_office_notification_settings_schema_authority/);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^office_notification_settings$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^office_notification_settings$/m);
console.log("  ✅ package/CI/integration/README/P0 wired");

console.log("\n✅ officeNotificationSettingsSchemaAuthority051 tests passed\n");
