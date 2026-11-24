/**
 * Stage 7 — Migration 043 Case AI Insights schema authority.
 * Run: pnpm --filter @workspace/api-server run test:case-ai-insights-043
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

console.log("\n═══ Migration 043 presence + Case AI Insights contract ═══");
const migPath = "artifacts/api-server/migrations/043_case_ai_insights_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-043.sql";
assert.ok(existsSync(join(ROOT, migPath)), "043 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "043 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS case_ai_insights/);
assert.match(mig, /idx_case_ai_insights_case/);
assert.match(mig, /case_id,\s*office_id,\s*created_at\s+DESC/i);
assert.match(mig, /gen_random_uuid/);
assert.match(mig, /POST_APPLY_READINESS_FAILED|CASE_AI_INSIGHTS_SCHEMA_READY/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /i\.relname\s*=\s*'idx_case_ai_insights_case'/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_coo_notif_settings\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS support_ai_analysis\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_agents\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_events\b/);
  assert.doesNotMatch(sqlOnly, /FOREIGN\s+KEY/i);
  assert.doesNotMatch(sqlOnly, /UNIQUE\s*\(/);
}
console.log("  ✅ 043 owns case_ai_insights + DESC index; no out-of-scope CREATEs; no invented UNIQUE/FK");

console.log("\n═══ Preflight 043 SELECT-only + blockers-first + global index name ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only|does not\s+CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /CASE_AI_INSIGHTS_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /i\.relname\s*=\s*'idx_case_ai_insights_case'/);
assert.match(pre, /desc_ok/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; blockers-first; global index name + DESC");

console.log("\n═══ P0 / boot gates ═══");
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^case_ai_insights$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^case_ai_insights\.case_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^case_ai_insights\.office_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^case_ai_insights\.created_at$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^case_ai_insights\.id$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^case_ai_insights$/m);
assert.match(readRepo("scripts/db/boot-created-tables.md"), /043/);
console.log("  ✅ P0 gates case_ai_insights; boot inventory cleared");

console.log("\n═══ Runtime DDL removed; readiness + DML preserved ═══");
const caseAi = readSrc("case/case.ai.ts");
assert.doesNotMatch(caseAi, /CREATE TABLE IF NOT EXISTS case_ai_insights/);
assert.doesNotMatch(caseAi, /CREATE INDEX IF NOT EXISTS idx_case_ai_insights_case/);
assert.match(caseAi, /to_regclass\('public\.case_ai_insights'\)/);
assert.match(caseAi, /ensureAIInsightsTable/);
assert.match(caseAi, /INSERT INTO case_ai_insights/);
assert.match(caseAi, /SELECT \* FROM case_ai_insights/);
assert.match(caseAi, /UPDATE case_ai_insights SET auto_tasks/);
assert.match(caseAi, /Migration 043/);
console.log("  ✅ Runtime CREATE/INDEX gone; to_regclass readiness + DML kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:case-ai-insights-043/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:case-ai-insights-043/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_043|scenario_migration_043/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig043_stolen_idx|stolen index/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig043_wrong_desc|wrong DESC/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /043_case_ai_insights_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ caseAiInsightsSchemaAuthority043 tests passed\n");
