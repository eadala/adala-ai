/**
 * Stage 8 — Migration 047 Calendar schema authority.
 * Run: pnpm --filter @workspace/api-server run test:calendar-047
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const API = join(HERE, "..");

function readRepo(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}
function readSrc(rel: string) {
  return readFileSync(join(API, rel), "utf8");
}
function stripComments(sql: string) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

console.log("\n═══ Migration 047 presence + Calendar contract ═══");
const migPath = "artifacts/api-server/migrations/047_calendar_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-047.sql";
assert.ok(existsSync(join(ROOT, migPath)), "047 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "047 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS events/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS event_reminders/);
assert.match(mig, /REFERENCES events\(id\) ON DELETE CASCADE/);
assert.match(mig, /event_reminders_event_id_fkey/);
assert.match(mig, /idx_events_case_id/);
assert.match(mig, /idx_events_office_start/);
assert.match(mig, /ON events \(case_id\)/);
assert.match(mig, /ON events \(office_id, start_at\)/);
assert.match(mig, /office_id\s+TEXT NOT NULL DEFAULT 'default'/);
assert.match(mig, /start_at\s+TIMESTAMPTZ NOT NULL/);
assert.match(mig, /udt_name.*timestamptz|'timestamptz'/);
assert.match(mig, /POST_APPLY_READINESS_FAILED|CALENDAR_SCHEMA_READY/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_FK/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /ORPHAN_FK/);
assert.match(mig, /i\.relname=spec\.index_name|i\.relname = spec\.index_name|i\.relname=spec\.index_name/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS hr_announcements\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS hr_roles\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS performance_evaluations\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_notification_settings\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_events\b/);
  assert.doesNotMatch(sqlOnly, /UNIQUE\s*\(\s*office_id\s*\)/);
  assert.doesNotMatch(sqlOnly, /REFERENCES cases\b/i);
}
console.log("  ✅ 047 owns events + event_reminders + CASCADE FK + 020-shaped ASC indexes; no invented UNIQUE/FK");

console.log("\n═══ Preflight 047 SELECT-only + blockers-first + global index name ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only|does not\s+CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /CALENDAR_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /INCOMPATIBLE_FK/);
assert.match(pre, /ORPHAN_FK/);
assert.match(pre, /duplicate_id_groups/);
assert.match(pre, /WHERE id IS NOT NULL GROUP BY id HAVING COUNT\(\*\) > 1/);
assert.match(pre, /event_reminders\.rows=%s events=missing|events=missing/);
assert.match(pre, /idx_events_case_id/);
assert.match(pre, /idx_events_office_start/);
assert.match(pre, /asc_ok/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; blockers-first; global index names + ASC");

console.log("\n═══ P0 / boot gates ═══");
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^events$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^event_reminders$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^events\.office_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^events\.start_at$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^events\.event_type$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^event_reminders\.event_id$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^events$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^event_reminders$/m);
assert.match(readRepo("scripts/db/boot-created-tables.md"), /047/);
console.log("  ✅ P0 gates events / event_reminders; boot inventory cleared");

console.log("\n═══ Runtime DDL removed; readiness + DML preserved ═══");
const calendar = readSrc("modules/operations/calendar.ts");
assert.doesNotMatch(calendar, /CREATE TABLE IF NOT EXISTS events/);
assert.doesNotMatch(calendar, /CREATE TABLE IF NOT EXISTS event_reminders/);
assert.doesNotMatch(calendar, /CREATE INDEX IF NOT EXISTS idx_events_/);
assert.match(calendar, /to_regclass\('public\.events'\)/);
assert.match(calendar, /to_regclass\('public\.event_reminders'\)/);
assert.match(calendar, /ensureTables/);
assert.match(calendar, /INSERT INTO events/);
assert.match(calendar, /INSERT INTO event_reminders/);
assert.match(calendar, /UPDATE events SET/);
assert.match(calendar, /Migration 047/);
assert.match(readSrc("modules/legal-core/cases.ts"), /INSERT INTO events/);
assert.match(readSrc("modules/legal-core/cases.ts"), /ON CONFLICT \(id\) DO UPDATE/);
console.log("  ✅ Runtime CREATE gone; to_regclass readiness + calendar/cases DML kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:calendar-047/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:calendar-047/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_047|scenario_migration_047/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig047_stolen|stolen index/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig047_orphan|ORPHAN_FK/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig047_dup_pk/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig047_orphan_parent_missing/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /047_calendar_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ calendarSchemaAuthority047 tests passed\n");
