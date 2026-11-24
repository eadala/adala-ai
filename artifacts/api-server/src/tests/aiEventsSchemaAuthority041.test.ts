/**
 * Stage 7E — Migration 041 AI Events schema authority.
 * Run: pnpm --filter @workspace/api-server run test:ai-events-041
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

console.log("\n═══ Migration 041 presence + AI Events contract ═══");
const migPath = "artifacts/api-server/migrations/041_ai_events_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-041.sql";
assert.ok(existsSync(join(ROOT, migPath)), "041 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "041 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS ai_events/);
assert.match(mig, /ai_events_office_status_idx/);
assert.match(mig, /office_id,\s*status,\s*created_at\s+DESC/i);
assert.match(mig, /created_at\s+TIMESTAMP\b/);
assert.match(mig, /udt_name.*timestamp|'timestamp'/);
assert.match(mig, /POST_APPLY_READINESS_FAILED|AI_EVENTS_SCHEMA_READY/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /i\.relname\s*=\s*'ai_events_office_status_idx'/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_agents\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS agent_actions\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS agent_job_logs\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS case_ai_insights\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_coo_notif_settings\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS support_ai_analysis\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_ai_credits\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_provider_config\b/);
  assert.doesNotMatch(sqlOnly, /UNIQUE\s*\(\s*office_id\s*\)/);
}
console.log("  ✅ 041 owns ai_events + DESC index; no out-of-scope CREATEs; no invented UNIQUE");

console.log("\n═══ Preflight 041 SELECT-only + blockers-first + global index name ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only|does not\s+CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /AI_EVENTS_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /i\.relname\s*=\s*'ai_events_office_status_idx'/);
assert.match(pre, /desc_ok/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; blockers-first; global index name + DESC");

console.log("\n═══ P0 / boot gates ═══");
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^ai_events$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^ai_events\.office_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^ai_events\.status$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^ai_events\.created_at$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^ai_events\.type$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^ai_events$/m);
assert.match(readRepo("scripts/db/boot-created-tables.md"), /041/);
console.log("  ✅ P0 gates ai_events; boot inventory cleared");

console.log("\n═══ Runtime DDL removed; readiness + DML preserved ═══");
const events = readSrc("modules/ai/aiEvents.ts");
assert.doesNotMatch(events, /CREATE TABLE IF NOT EXISTS ai_events/);
assert.doesNotMatch(events, /CREATE INDEX IF NOT EXISTS ai_events_office_status_idx/);
assert.match(events, /to_regclass\('public\.ai_events'\)/);
assert.match(events, /ensureAiEventsReady/);
assert.match(events, /WHERE NOT EXISTS/);
assert.match(events, /INSERT INTO ai_events/);
assert.match(events, /UPDATE ai_events SET status = 'dismissed'/);
assert.match(events, /Migration 041/);
console.log("  ✅ Runtime CREATE/INDEX gone; to_regclass readiness + DML kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:ai-events-041/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:ai-events-041/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_041|scenario_migration_041/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig041_stolen_idx|stolen index/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig041_wrong_desc|wrong DESC/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /041_ai_events_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ aiEventsSchemaAuthority041 tests passed\n");
