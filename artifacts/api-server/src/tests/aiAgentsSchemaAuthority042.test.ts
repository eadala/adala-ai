/**
 * Stage 7 — Migration 042 AI Agents schema authority.
 * Run: pnpm --filter @workspace/api-server run test:ai-agents-042
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

console.log("\n═══ Migration 042 presence + AI Agents contract ═══");
const migPath = "artifacts/api-server/migrations/042_ai_agents_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-042.sql";
assert.ok(existsSync(join(ROOT, migPath)), "042 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "042 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS ai_agents/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS agent_actions/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS agent_job_logs/);
assert.match(mig, /idx_agent_job_logs_created/);
assert.match(mig, /created_at\s+DESC/i);
assert.match(mig, /idx_agent_job_logs_type/);
assert.match(mig, /ON CONFLICT \(id\) DO NOTHING/);
assert.match(mig, /'legal'|legal/);
assert.match(mig, /'finance'|finance/);
assert.match(mig, /'risk'|risk/);
assert.match(mig, /'system'|system/);
assert.match(mig, /'hr'|hr/);
assert.match(mig, /POST_APPLY_READINESS_FAILED|AI_AGENTS_SCHEMA_READY/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /i\.relname\s*=\s*'idx_agent_job_logs_created'/);
assert.match(mig, /i\.relname\s*=\s*'idx_agent_job_logs_type'/);
assert.match(mig, /office_id must remain nullable|is_nullable='YES'/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_events\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS case_ai_insights\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_coo_notif_settings\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS support_ai_analysis\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_ai_credits\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_provider_config\b/);
  assert.doesNotMatch(sqlOnly, /FOREIGN\s+KEY/i);
  assert.doesNotMatch(sqlOnly, /UNIQUE\s*\(/);
}
console.log("  ✅ 042 owns agents trio + DESC index + seed; no out-of-scope CREATEs; no invented UNIQUE/FK");

console.log("\n═══ Preflight 042 SELECT-only + blockers-first + global index name ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only|does not\s+CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /AI_AGENTS_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /i\.relname\s*=\s*'idx_agent_job_logs_created'/);
assert.match(pre, /i\.relname\s*=\s*'idx_agent_job_logs_type'/);
assert.match(pre, /desc_ok/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; blockers-first; global index names + DESC");

console.log("\n═══ P0 / boot gates ═══");
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^ai_agents$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^agent_actions$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^agent_job_logs$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^ai_agents\.id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^agent_actions\.agent_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^agent_job_logs\.agent_type$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^agent_job_logs\.status$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^agent_job_logs\.created_at$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^ai_agents$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^agent_actions$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^agent_job_logs$/m);
assert.match(readRepo("scripts/db/boot-created-tables.md"), /042/);
console.log("  ✅ P0 gates agents trio; boot inventory cleared");

console.log("\n═══ Runtime DDL removed; readiness + DML preserved ═══");
const runtime = readSrc("modules/platform/agentRuntime.ts");
assert.doesNotMatch(runtime, /CREATE TABLE IF NOT EXISTS ai_agents/);
assert.doesNotMatch(runtime, /CREATE TABLE IF NOT EXISTS agent_actions/);
assert.match(runtime, /to_regclass\('public\.ai_agents'\)/);
assert.match(runtime, /to_regclass\('public\.agent_actions'\)/);
assert.match(runtime, /ensureAgentsSchemaReady/);
assert.match(runtime, /ON CONFLICT \(id\) DO NOTHING/);
assert.match(runtime, /INSERT INTO agent_actions/);
assert.match(runtime, /UPDATE ai_agents SET last_run/);
assert.match(runtime, /Migration 042/);

const cron = readSrc("cron/agentCron.ts");
assert.doesNotMatch(cron, /CREATE TABLE IF NOT EXISTS agent_job_logs/);
assert.doesNotMatch(cron, /CREATE INDEX IF NOT EXISTS idx_agent_job_logs_created/);
assert.doesNotMatch(cron, /CREATE INDEX IF NOT EXISTS idx_agent_job_logs_type/);
assert.match(cron, /to_regclass\('public\.agent_job_logs'\)/);
assert.match(cron, /ensureAgentJobLogsReady/);
assert.match(cron, /INSERT INTO agent_job_logs/);
assert.match(cron, /UPDATE agent_job_logs/);
assert.match(cron, /Migration 042/);
console.log("  ✅ Runtime CREATE/INDEX gone; to_regclass readiness + DML kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:ai-agents-042/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:ai-agents-042/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_042|scenario_migration_042/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig042_stolen_idx|stolen index/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig042_wrong_desc|wrong DESC/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /042_ai_agents_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ aiAgentsSchemaAuthority042 tests passed\n");
