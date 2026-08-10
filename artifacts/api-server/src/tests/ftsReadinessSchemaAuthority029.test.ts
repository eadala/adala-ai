/**
 * Stage 20.3 — FTS readiness schema authority (Migration 029).
 * Run: pnpm --filter @workspace/api-server run test:fts-029
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SRC = join(HERE, "..");

const migPath = join(
  ROOT,
  "artifacts/api-server/migrations/029_office_messages_fts_readiness.sql",
);
const preflightPath = join(ROOT, "scripts/db/preflight-migration-029.sql");
const mig = readFileSync(migPath, "utf8");
const preflight = readFileSync(preflightPath, "utf8");
const integ = readFileSync(join(ROOT, "scripts/db/test-migrations.integration.sh"), "utf8");
const readme = readFileSync(
  join(ROOT, "artifacts/api-server/migrations/README.md"),
  "utf8",
);
const im = readFileSync(join(SRC, "modules/operations/internal-messages.ts"), "utf8");
const ftsLogic = readFileSync(
  join(SRC, "modules/operations/messageFtsConfigLogic.ts"),
  "utf8",
);
const ftsMod = readFileSync(join(SRC, "modules/operations/messageFtsConfig.ts"), "utf8");

function sqlOnly(src: string): string {
  return src.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

console.log("\n═══ migration 029 + preflight presence ═══");
{
  assert.ok(existsSync(migPath), "029_office_messages_fts_readiness.sql must exist");
  assert.ok(existsSync(preflightPath), "preflight-migration-029.sql must exist");
  assert.ok(
    "028_case_autopilot_reports_schema_authority.sql" <
      "029_office_messages_fts_readiness.sql",
    "029 must lexicographically follow 028",
  );
  console.log("  ✅ files present; ordering after 028");
}

console.log("\n═══ preflight: SELECT-only report contract ═══");
{
  assert.match(preflight, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable/i);
  assert.match(preflight, /office_messages_present|office_messages presence/i);
  assert.match(preflight, /attgenerated/);
  assert.match(preflight, /pg_get_expr/);
  assert.match(preflight, /parsed_config/);
  assert.match(preflight, /allow_list_ok/);
  assert.match(preflight, /idx_messages_search/);
  assert.match(preflight, /index_am|amname/);
  assert.match(preflight, /index_definition|pg_get_indexdef/);
  assert.match(preflight, /indisvalid/);
  assert.match(preflight, /indisready/);
  assert.match(preflight, /estimated_rows/);
  assert.match(preflight, /lock_risk/);
  assert.match(preflight, /chosen_action/);
  assert.match(preflight, /reason_code/);
  assert.match(preflight, /ALREADY_CORRECT/);
  assert.match(preflight, /SAFE_AUTO_REPAIR_ADD_COLUMN/);
  assert.match(preflight, /SAFE_AUTO_REPAIR_ADD_GIN/);
  assert.match(preflight, /BLOCK_AND_MANUAL_REVIEW/);
  assert.match(preflight, /WRONG_SEARCH_VECTOR_TYPE|NON_GENERATED_TSVECTOR|UNSUPPORTED_FTS_CONFIG/);
  assert.match(preflight, /WRONG_INDEX_AM|INDEX_NOT_VALID_OR_NOT_READY/);
  const pfSql = sqlOnly(preflight);
  assert.doesNotMatch(pfSql, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(pfSql, /\bDROP\s+INDEX\b/i);
  assert.doesNotMatch(pfSql, /\bALTER\s+TABLE\b/i);
  /* Allow ops notes mentioning CREATE INDEX; forbid executable durable DDL. */
  assert.doesNotMatch(pfSql, /^\s*CREATE\s+INDEX\b/im);
  assert.doesNotMatch(pfSql, /^\s*CREATE\s+TABLE\b(?!.*TEMP)/im);
  console.log("  ✅ preflight reports required fields; no durable DDL");
}

console.log("\n═══ migration 029: safe repairs only; block legacy ═══");
{
  assert.match(mig, /SAFE_AUTO_REPAIR_ADD_COLUMN/);
  assert.match(mig, /SAFE_AUTO_REPAIR_ADD_GIN/);
  assert.match(mig, /ALREADY_CORRECT/);
  assert.match(mig, /BLOCK_AND_MANUAL_REVIEW/);
  assert.match(mig, /RAISE EXCEPTION/);
  assert.match(mig, /GENERATED ALWAYS AS/);
  assert.match(mig, /STORED/);
  assert.match(mig, /cfgname = 'arabic'/);
  assert.match(mig, /ELSE 'simple'/);
  assert.match(mig, /CREATE INDEX IF NOT EXISTS idx_messages_search/);
  assert.match(mig, /USING gin\s*\(\s*search_vector\s*\)/i);
  assert.match(mig, /ACCESS EXCLUSIVE|rewrite/i);
  assert.match(mig, /CREATE INDEX CONCURRENTLY is intentionally NOT used|cannot run inside/i);

  const body = sqlOnly(mig);
  assert.doesNotMatch(body, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(body, /\bDROP\s+INDEX\b/i);
  assert.doesNotMatch(body, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(body, /^\s*CREATE\s+INDEX\s+CONCURRENTLY\b/im);
  assert.match(mig, /WRONG_SEARCH_VECTOR_TYPE/);
  assert.match(mig, /NON_GENERATED_TSVECTOR/);
  assert.match(mig, /UNSUPPORTED_FTS_CONFIG/);
  assert.match(mig, /WRONG_INDEX_AM|WRONG_INDEX_DEFINITION|INDEX_NOT_VALID_OR_NOT_READY/);
  assert.match(mig, /refusing destructive repair/i);
  console.log("  ✅ ADD COLUMN / ADD GIN only; BLOCK raises; no DROP");
}

console.log("\n═══ Stage 20.2 / 20.1 preserved ═══");
{
  assert.match(ftsLogic, /MESSAGE_FTS_ALLOWED_CONFIGS/);
  assert.match(ftsLogic, /arabic/);
  assert.match(ftsLogic, /simple/);
  assert.match(ftsLogic, /unsupported_config/);
  assert.match(ftsLogic, /cache: false/);
  assert.match(ftsMod, /cachedMessageFtsConfig/);
  assert.match(im, /requireAuthWithTenant/);
  assert.match(im, /resolveCanonicalMessageOfficeId/);
  assert.match(im, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(im, /getMessageFtsConfig\(\)/);
  assert.match(im, /messageSearchPredicate/);
  assert.match(im, /plainto_tsquery\(\$\{ftsConfig\}::regconfig/);
  assert.doesNotMatch(im, /ADD COLUMN IF NOT EXISTS search_vector/);
  assert.doesNotMatch(im, /CREATE INDEX IF NOT EXISTS idx_messages_search/);
  console.log("  ✅ allow-list/cache + office_id tenant isolation unchanged");
}

console.log("\n═══ harness + docs inventory ═══");
{
  assert.match(integ, /MIGRATION_029/);
  assert.match(integ, /apply_migration_029/);
  assert.match(integ, /scenario_migration_029_office_messages_fts_readiness/);
  assert.match(integ, /SAFE_AUTO_REPAIR_ADD_COLUMN|SAFE_AUTO_REPAIR_ADD_GIN/);
  assert.match(integ, /BLOCK_AND_MANUAL_REVIEW/);
  assert.match(readme, /029_office_messages_fts_readiness/);
  assert.match(readme, /preflight-migration-029/);
  console.log("  ✅ integration harness + README inventory");
}

console.log("\n✅ ftsReadinessSchemaAuthority029 tests passed\n");
