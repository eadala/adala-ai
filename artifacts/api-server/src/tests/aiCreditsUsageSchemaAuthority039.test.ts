/**
 * Stage 7B — Migration 039 AI Credits + Usage schema authority.
 * Run: pnpm --filter @workspace/api-server run test:ai-credits-039
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

const OWNED = ["office_ai_credits", "ai_credit_transactions", "ai_usage_logs"];

console.log("\n═══ Migration 039 presence + AI credits/usage contract ═══");
const migPath = "artifacts/api-server/migrations/039_ai_credits_usage_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-039.sql";
assert.ok(existsSync(join(ROOT, migPath)), "039 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "039 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const t of OWNED) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`));
}
assert.match(mig, /balance\s+INTEGER\s+NOT NULL\s+DEFAULT\s+100/);
assert.match(mig, /daily_limit/);
assert.match(mig, /daily_used/);
assert.match(mig, /monthly_limit/);
assert.match(mig, /monthly_used/);
assert.match(mig, /daily_reset_at/);
assert.match(mig, /cost_sar/);
assert.match(mig, /token_count/);
assert.match(mig, /policy_used/);
assert.match(mig, /idx_ai_usage_office/);
assert.match(mig, /idx_ai_usage_created/);
assert.match(mig, /idx_ai_usage_case/);
assert.match(mig, /WHERE\s+case_id\s+IS\s+NOT\s+NULL/i);
assert.match(mig, /office_ai_credits_office_id_key|UNIQUE\s*\(\s*office_id\s*\)/);
assert.match(mig, /POST_APPLY_READINESS_FAILED|AI_CREDITS_USAGE_SCHEMA_READY/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS usage_logs\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_provider_config\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_ai_settings\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_events\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_agents\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS case_ai_insights\b/);
  assert.doesNotMatch(sqlOnly, /balance\s+INTEGER\s+NOT NULL\s+DEFAULT\s+0/);
}
console.log("  ✅ 039 owns 3 tables; balance DEFAULT 100; usage indexes; no out-of-scope CREATEs");

console.log("\n═══ Preflight 039 SELECT-only + blockers-first ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /AI_CREDITS_USAGE_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /legacy_default_office|office_id='default'|default_office/i);
assert.match(pre, /idx_ai_usage_case/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
}
assert.match(pre, /FROM\s+pg_class\s+i[\s\S]*i\.relname\s*=\s*index_spec\.index_name|i\.relname\s*=\s*index_spec\.index_name/);
assert.match(mig, /FROM\s+pg_class\s+i[\s\S]*i\.relname\s*=\s*spec\.index_name/);
console.log("  ✅ preflight SELECT-only; default office reported not blocked; global index-name probes");

console.log("\n═══ P0 / boot gates ═══");
const p0Tables = readRepo("scripts/db/expected-tables-p0.txt");
for (const t of OWNED) {
  assert.match(p0Tables, new RegExp(`^${t}$`, "m"));
}
const p0Cols = readRepo("scripts/db/expected-columns-p0.txt");
assert.match(p0Cols, /^office_ai_credits\.balance$/m);
assert.match(p0Cols, /^office_ai_credits\.daily_limit$/m);
assert.match(p0Cols, /^ai_usage_logs\.cost_sar$/m);
const bootTxt = readRepo("scripts/db/boot-created-tables.txt");
for (const t of OWNED) {
  assert.doesNotMatch(bootTxt, new RegExp(`^${t}$`, "m"));
}
console.log("  ✅ P0 gates credits/usage; boot inventory cleared");

console.log("\n═══ Runtime DDL removed for 039; provider out-of-scope preserved ═══");
const chat = readSrc("modules/ai/aiChat.ts");
const credits = readSrc("modules/ai/aiCredits.ts");
const provider = readSrc("modules/ai/aiProviderEngine.ts");
assert.doesNotMatch(chat, /CREATE TABLE IF NOT EXISTS ai_usage_logs/);
assert.doesNotMatch(chat, /CREATE TABLE IF NOT EXISTS office_ai_credits/);
assert.doesNotMatch(credits, /CREATE TABLE IF NOT EXISTS office_ai_credits/);
assert.doesNotMatch(credits, /CREATE TABLE IF NOT EXISTS ai_credit_transactions/);
assert.doesNotMatch(provider, /ALTER TABLE ai_usage_logs/);
assert.doesNotMatch(provider, /ADD COLUMN IF NOT EXISTS cost_sar/);
assert.match(chat, /to_regclass\('public\.ai_usage_logs'\)/);
assert.match(chat, /INSERT INTO office_ai_credits[\s\S]*ON CONFLICT \(office_id\) DO NOTHING/);
assert.match(credits, /ON CONFLICT \(office_id\)/);
assert.match(credits, /INSERT INTO office_ai_credits[\s\S]*\bbalance\b[\s\S]*ON CONFLICT \(office_id\) DO UPDATE/);
assert.match(provider, /CREATE TABLE IF NOT EXISTS ai_provider_config/);
assert.match(provider, /CREATE TABLE IF NOT EXISTS office_ai_settings/);
console.log("  ✅ 039 Runtime DDL removed; provider/settings Runtime CREATE retained; seed DML kept; settings sets balance");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:ai-credits-039/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:ai-credits-039/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_039|scenario_migration_039/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig039_stolen_idx|stolen same-name index/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig039_wrong_uq|wrong UNIQUE shape/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig039_wrong_pred|wrong partial predicate/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /039_ai_credits_usage_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ aiCreditsUsageSchemaAuthority039 tests passed\n");
