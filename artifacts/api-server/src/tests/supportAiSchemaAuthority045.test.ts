/**
 * Stage 7 — Migration 045 Support AI schema authority.
 * Run: pnpm --filter @workspace/api-server run test:support-ai-045
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

console.log("\n═══ Migration 045 presence + Support AI contract ═══");
const migPath = "artifacts/api-server/migrations/045_support_ai_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-045.sql";
assert.ok(existsSync(join(ROOT, migPath)), "045 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "045 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS support_ai_analysis/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS support_knowledge_base/);
assert.match(mig, /ticket_id\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
assert.match(mig, /support_ai_analysis_ticket_id_key/);
assert.match(mig, /POST_APPLY_READINESS_FAILED|SUPPORT_AI_SCHEMA_READY/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /gen_random_uuid/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DELETE\s+FROM\b/im);
  assert.doesNotMatch(sqlOnly, /ai_score/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS support_ticket_attachments\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS ai_coo_notif_settings\b/);
  assert.doesNotMatch(sqlOnly, /FOREIGN\s+KEY/i);
  assert.doesNotMatch(sqlOnly, /UNIQUE\s*\(\s*category/i);
  assert.doesNotMatch(sqlOnly, /UNIQUE\s*\(\s*issue/i);
}
console.log("  ✅ 045 owns analysis+KB; UNIQUE(ticket_id); no invented KB UNIQUE/FK; no ai_score");

console.log("\n═══ Preflight 045 SELECT-only + blockers-first + UNIQUE readiness ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only|does not\s+CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /SUPPORT_AI_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
assert.match(pre, /DUPLICATE_UNIQUE_KEY/);
assert.match(pre, /no invented business UNIQUE|KB note/i);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+INDEX\b/im);
}
console.log("  ✅ preflight SELECT-only; blockers-first; UNIQUE ticket_id; KB duplicates noticed only");

console.log("\n═══ P0 / boot gates ═══");
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^support_ai_analysis$/m);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^support_knowledge_base$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^support_ai_analysis\.ticket_id$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^support_knowledge_base\.category$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^support_ai_analysis$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^support_knowledge_base$/m);
assert.match(readRepo("scripts/db/boot-created-tables.md"), /045/);
console.log("  ✅ P0 gates Support AI tables; boot inventory cleared");

console.log("\n═══ Runtime DDL removed; readiness + DML preserved ═══");
const supportAi = readSrc("modules/platform/support-ai.ts");
assert.doesNotMatch(supportAi, /CREATE TABLE IF NOT EXISTS support_ai_analysis/);
assert.doesNotMatch(supportAi, /CREATE TABLE IF NOT EXISTS support_knowledge_base/);
assert.match(supportAi, /to_regclass\('public\.support_ai_analysis'\)/);
assert.match(supportAi, /to_regclass\('public\.support_knowledge_base'\)/);
assert.match(supportAi, /ensureSupportAITables/);
assert.match(supportAi, /ON CONFLICT \(ticket_id\) DO UPDATE/);
assert.match(supportAi, /INSERT INTO support_knowledge_base/);
assert.match(supportAi, /WHERE NOT EXISTS/);
assert.doesNotMatch(supportAi, /ON CONFLICT DO NOTHING/);
assert.match(supportAi, /Migration 045/);
console.log("  ✅ Runtime CREATE gone; readiness + analysis/KB DML kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:support-ai-045/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:support-ai-045/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_045|scenario_migration_045/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /mig045_partial_uq|mig045_expr_uq|mig045_kb_dups/);
assert.match(readRepo("artifacts/api-server/migrations/README.md"), /045_support_ai_schema_authority/);
console.log("  ✅ package/CI/integration/README wired");

console.log("\n✅ supportAiSchemaAuthority045 tests passed\n");
