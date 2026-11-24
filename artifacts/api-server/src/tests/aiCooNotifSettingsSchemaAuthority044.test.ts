/**
 * Stage 7 — Migration 044 AI COO Notif Settings schema authority.
 * Run: pnpm --filter @workspace/api-server run test:ai-coo-notif-044
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

console.log("\n═══ Migration 044 presence + AI COO Notif Settings contract ═══");
const migPath = "artifacts/api-server/migrations/044_ai_coo_notif_settings_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-044.sql";
assert.ok(existsSync(join(ROOT, migPath)), "044 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "044 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS ai_coo_notif_settings/);
assert.match(mig, /office_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
assert.match(mig, /ai_coo_notif_settings_office_id_key/);
assert.match(mig, /POST_APPLY_READINESS_FAILED|AI_COO_NOTIF_SETTINGS_SCHEMA_READY/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DELETE\s+FROM\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS support_ai_analysis\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS case_ai_insights\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_agents\b/);
  assert.doesNotMatch(sqlOnly, /FOREIGN\s+KEY/i);
}
console.log("  ✅ 044 owns ai_coo_notif_settings + UNIQUE(office_id); no out-of-scope CREATEs; no invented FK");

console.log("\n═══ Preflight 044 SELECT-only + blockers-first + UNIQUE readiness ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only|does not\s+CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /AI_COO_NOTIF_SETTINGS_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
assert.match(pre, /DUPLICATE_UNIQUE_KEY/);
assert.match(pre, /expression_uq|expression=/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; blockers-first; UNIQUE wider/partial/expression");

console.log("\n═══ P0 / boot gates ═══");
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^ai_coo_notif_settings$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^ai_coo_notif_settings\.id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^ai_coo_notif_settings\.office_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^ai_coo_notif_settings\.updated_at$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^ai_coo_notif_settings$/m);
assert.match(readRepo("scripts/db/boot-created-tables.md"), /044/);
console.log("  ✅ P0 gates ai_coo_notif_settings; boot inventory cleared");

console.log("\n═══ Runtime DDL removed; readiness + DML preserved ═══");
const aiCoo = readSrc("modules/platform/aiCoo.ts");
assert.doesNotMatch(aiCoo, /CREATE TABLE IF NOT EXISTS ai_coo_notif_settings/);
assert.match(aiCoo, /to_regclass\('public\.ai_coo_notif_settings'\)/);
assert.match(aiCoo, /ensureNotifTable/);
assert.match(aiCoo, /ON CONFLICT DO NOTHING/);
assert.match(aiCoo, /ON CONFLICT \(office_id\) DO UPDATE/);
assert.match(aiCoo, /UPDATE ai_coo_notif_settings SET last_notified_at/);
assert.match(aiCoo, /SELECT \* FROM ai_coo_notif_settings WHERE office_id/);
assert.match(aiCoo, /Migration 044/);
console.log("  ✅ Runtime CREATE gone; to_regclass readiness + GET/PATCH/notify DML kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:ai-coo-notif-044/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:ai-coo-notif-044/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_044|scenario_migration_044/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig044_partial_uq|mig044_expr_uq|mig044_wider_uq/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /044_ai_coo_notif_settings_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ aiCooNotifSettingsSchemaAuthority044 tests passed\n");
