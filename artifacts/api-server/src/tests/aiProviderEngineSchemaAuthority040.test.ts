/**
 * Stage 7E — Migration 040 AI Provider Engine schema authority.
 * Run: pnpm --filter @workspace/api-server run test:ai-provider-040
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

const OWNED = ["ai_provider_config", "office_ai_settings"];

console.log("\n═══ Migration 040 presence + AI provider engine contract ═══");
const migPath = "artifacts/api-server/migrations/040_ai_provider_engine_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-040.sql";
assert.ok(existsSync(join(ROOT, migPath)), "040 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "040 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const t of OWNED) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`));
}
assert.match(mig, /provider\s+TEXT\s+NOT NULL\s+UNIQUE|UNIQUE\s*\(\s*provider\s*\)/);
assert.match(mig, /office_id\s+TEXT\s+NOT NULL\s+UNIQUE|UNIQUE\s*\(\s*office_id\s*\)/);
assert.match(mig, /ai_provider_config_provider_key|UNIQUE\s*\(\s*provider\s*\)/);
assert.match(mig, /office_ai_settings_office_id_key|UNIQUE\s*\(\s*office_id\s*\)/);
assert.match(mig, /enabled/);
assert.match(mig, /priority/);
assert.match(mig, /preferred_provider/);
assert.match(mig, /POST_APPLY_READINESS_FAILED|AI_PROVIDER_ENGINE_SCHEMA_READY/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_ai_credits\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_credit_transactions\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_usage_logs\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_events\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_agents\b/);
}
console.log("  ✅ 040 owns 2 tables; UNIQUE(provider)/UNIQUE(office_id); no out-of-scope CREATEs");

console.log("\n═══ Preflight 040 SELECT-only + blockers-first ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only|does not\s+CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /AI_PROVIDER_ENGINE_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
assert.match(pre, /DUPLICATE_UNIQUE_KEY/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
}
console.log("  ✅ preflight SELECT-only; blockers-first; READY reason present");

console.log("\n═══ P0 / boot gates ═══");
const p0Tables = readRepo("scripts/db/expected-tables-p0.txt");
for (const t of OWNED) {
  assert.match(p0Tables, new RegExp(`^${t}$`, "m"));
}
const p0Cols = readRepo("scripts/db/expected-columns-p0.txt");
assert.match(p0Cols, /^ai_provider_config\.provider$/m);
assert.match(p0Cols, /^ai_provider_config\.enabled$/m);
assert.match(p0Cols, /^ai_provider_config\.priority$/m);
assert.match(p0Cols, /^office_ai_settings\.office_id$/m);
assert.match(p0Cols, /^office_ai_settings\.preferred_provider$/m);
assert.match(p0Cols, /^office_ai_settings\.mode$/m);
const bootTxt = readRepo("scripts/db/boot-created-tables.txt");
for (const t of OWNED) {
  assert.doesNotMatch(bootTxt, new RegExp(`^${t}$`, "m"));
}
assert.match(readRepo("scripts/db/boot-created-tables.md"), /040/);
console.log("  ✅ P0 gates provider/settings; boot inventory cleared");

console.log("\n═══ Runtime DDL removed; readiness + seed DML preserved ═══");
const provider = readSrc("modules/ai/aiProviderEngine.ts");
assert.doesNotMatch(provider, /CREATE TABLE IF NOT EXISTS ai_provider_config/);
assert.doesNotMatch(provider, /CREATE TABLE IF NOT EXISTS office_ai_settings/);
assert.match(provider, /to_regclass\('public\.ai_provider_config'\)/);
assert.match(provider, /to_regclass\('public\.office_ai_settings'\)/);
assert.match(provider, /ensureProviderTablesReady/);
assert.match(provider, /ON CONFLICT \(provider\)/);
assert.match(provider, /ON CONFLICT \(office_id\)/);
assert.match(provider, /Migration 040/);
console.log("  ✅ Runtime CREATE gone; to_regclass readiness + ON CONFLICT seed/upsert kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:ai-provider-040/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:ai-provider-040/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_040|scenario_migration_040/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig040_dup_provider|duplicate provider/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig040_wrong_uq|wrong UNIQUE shape/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig040_on_conflict_prov|ON CONFLICT \(provider\)/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /040_ai_provider_engine_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ aiProviderEngineSchemaAuthority040 tests passed\n");
