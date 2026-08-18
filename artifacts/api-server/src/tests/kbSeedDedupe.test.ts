/**
 * Stage 7 — Support KB seed de-dupe (no invented UNIQUE).
 * Run: pnpm --filter @workspace/api-server run test:kb-seed-dedupe
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const CANONICAL_ISSUES = [
  "cross-tenant data leak",
  "auth bypass",
  "unauthorized access",
  "missing data in dashboard",
  "invoice not appearing",
  "ai not responding",
  "payment failed",
  "subscription not active",
  "slow loading",
  "request new feature",
];

console.log("\n═══ KB seed uses NOT EXISTS (category, issue); PK-only ═══");
const supportAi = readSrc("modules/platform/support-ai.ts");
assert.match(supportAi, /INSERT INTO support_knowledge_base/);
assert.match(supportAi, /WHERE NOT EXISTS/);
assert.match(supportAi, /k\.category = v\.category AND k\.issue = v\.issue/);
assert.doesNotMatch(supportAi, /ON CONFLICT DO NOTHING/);
{
  const seedBlock = supportAi.slice(
    supportAi.indexOf("INSERT INTO support_knowledge_base"),
    supportAi.indexOf(").catch", supportAi.indexOf("INSERT INTO support_knowledge_base")),
  );
  assert.doesNotMatch(seedBlock, /ON CONFLICT/i);
  assert.doesNotMatch(seedBlock, /DELETE\s+FROM\s+support_knowledge_base/i);
  assert.doesNotMatch(seedBlock, /UPDATE\s+support_knowledge_base/i);
}
for (const issue of CANONICAL_ISSUES) {
  assert.ok(supportAi.includes(issue), `canonical issue missing: ${issue}`);
}
assert.equal(CANONICAL_ISSUES.length, 10);
console.log("  ✅ seed INSERT … SELECT … WHERE NOT EXISTS (category, issue); 10 canonical issues");

console.log("\n═══ Migration 045 remains PK-only (no invented KB UNIQUE) ═══");
const mig045 = readRepo("artifacts/api-server/migrations/045_support_ai_schema_authority.sql");
{
  const sqlOnly = stripComments(mig045);
  assert.doesNotMatch(sqlOnly, /UNIQUE\s*\(\s*category/i);
  assert.doesNotMatch(sqlOnly, /UNIQUE\s*\(\s*issue/i);
  assert.doesNotMatch(sqlOnly, /UNIQUE\s*\(\s*fix/i);
}
assert.match(mig045, /support_knowledge_base PK-only|PK only/i);
console.log("  ✅ 045 does not invent KB business UNIQUE");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:kb-seed-dedupe/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:kb-seed-dedupe/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /scenario_kb_seed_dedupe/);
console.log("  ✅ package/CI/integration wired");

console.log("\n✅ kbSeedDedupe tests passed\n");
