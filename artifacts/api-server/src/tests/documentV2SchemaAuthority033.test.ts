/**
 * Stage 23.5B — Migration 033 Document V2 schema authority.
 * Run: pnpm --filter @workspace/api-server run test:document-033
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

console.log("\n═══ Migration 033 presence + contract ═══");
const migPath = "artifacts/api-server/migrations/033_document_v2_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-033.sql";
assert.ok(existsSync(join(ROOT, migPath)), "033 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "033 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS document_versions/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS document_permissions/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS storage_migration_log/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS document_retention_policies/);
assert.match(mig, /ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key TEXT/);
assert.match(mig, /ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_size BIGINT/);
assert.match(mig, /storage_provider TEXT DEFAULT 'db_base64'|SET DEFAULT 'db_base64'/);
assert.match(mig, /gen_random_uuid\(\)::text/);
assert.match(mig, /idx_dv_doc_id/);
assert.match(mig, /idx_dv_doc_ver/);
assert.match(mig, /idx_dv_office/);
assert.match(mig, /idx_dp_doc_id/);
assert.match(mig, /idx_dp_office/);
assert.match(mig, /idx_sml_office_status/);
assert.match(mig, /UNIQUE\s*\(\s*office_id,\s*category\s*\)/);
assert.match(mig, /ON CONFLICT \(office_id, category\) DO NOTHING/);
assert.match(mig, /'__default__'/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /DUPLICATE_RETENTION_KEY/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /POST_APPLY_READINESS_FAILED/);
assert.match(mig, /SERIAL PRIMARY KEY/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  /* Must not invent UNIQUE on storage_migration_log merely for ON CONFLICT */
  assert.doesNotMatch(sqlOnly, /storage_migration_log[\s\S]{0,800}UNIQUE\s*\(/i);
}
console.log("  ✅ 033 owns V2 tables + documents extensions; no DROP; no invented sml UNIQUE");

console.log("\n═══ Preflight 033 SELECT-only + ladder ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /chosen_action/);
assert.match(pre, /reason_code/);
assert.match(pre, /ALREADY_CORRECT/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /BASELINE_MISSING/);
assert.match(pre, /INCOMPATIBLE_TYPE/);
assert.match(pre, /NULL_REQUIRED/);
assert.match(pre, /DUPLICATE_RETENTION_KEY/);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /default_seed_rows/);
assert.match(pre, /lock_risk/);
assert.match(pre, /compliance_retention_note/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*DROP\s+TABLE\b/im);
}
console.log("  ✅ preflight SELECT-only ladder with blockers first");

console.log("\n═══ P0 verify-schema gate includes Document V2 ═══");
const p0Tables = readRepo("scripts/db/expected-tables-p0.txt");
assert.match(p0Tables, /^document_versions$/m);
assert.match(p0Tables, /^document_permissions$/m);
assert.match(p0Tables, /^storage_migration_log$/m);
assert.match(p0Tables, /^document_retention_policies$/m);
const p0Cols = readRepo("scripts/db/expected-columns-p0.txt");
assert.match(p0Cols, /^documents\.storage_key$/m);
assert.match(p0Cols, /^documents\.file_size$/m);
assert.match(p0Cols, /^documents\.storage_provider$/m);
assert.match(p0Cols, /^document_retention_policies\.office_id$/m);
assert.match(p0Cols, /^document_retention_policies\.category$/m);
const verify = readRepo("scripts/db/verify-schema.sh");
assert.match(verify, /expected-tables-p0\.txt/);
console.log("  ✅ P0 tables + critical documents/retention columns gated");

console.log("\n═══ Runtime V2 DDL removed; Document Center DML retargeted ═══");
const dc = readSrc("modules/documents/documentCenter.ts");
assert.match(dc, /033_document_v2_schema_authority/);
assert.match(dc, /021_rag_schema_foundation/);
assert.doesNotMatch(dc, /ALTER TABLE documents ADD COLUMN/);
assert.doesNotMatch(dc, /CREATE TABLE IF NOT EXISTS storage_migration_log/);
assert.doesNotMatch(dc, /CREATE TABLE IF NOT EXISTS document_versions/);
assert.doesNotMatch(dc, /CREATE TABLE IF NOT EXISTS document_permissions/);
assert.doesNotMatch(dc, /CREATE TABLE IF NOT EXISTS retention_policies/);
assert.doesNotMatch(dc, /CREATE INDEX IF NOT EXISTS idx_dv_/);
assert.doesNotMatch(dc, /CREATE INDEX IF NOT EXISTS idx_dp_/);
assert.doesNotMatch(dc, /CREATE INDEX IF NOT EXISTS idx_sml_/);
assert.doesNotMatch(dc, /CREATE INDEX IF NOT EXISTS idx_rp_/);
assert.match(dc, /INSERT INTO document_retention_policies/);
assert.match(dc, /FROM\s+document_retention_policies/);
assert.match(dc, /JOIN\s+document_retention_policies/);
assert.doesNotMatch(dc, /INSERT INTO retention_policies/);
assert.doesNotMatch(dc, /FROM\s+retention_policies/);
assert.doesNotMatch(dc, /JOIN\s+retention_policies/);
assert.match(dc, /to_regclass\('public\.document_center_files'\)/);
console.log("  ✅ Runtime V2 DDL gone; DC DML uses document_retention_policies");

console.log("\n═══ Compliance retention_policies untouched ═══");
const compliance = readSrc("modules/security/complianceCenter.ts");
assert.match(compliance, /CREATE TABLE IF NOT EXISTS retention_policies/);
assert.match(compliance, /resource_type/);
assert.match(compliance, /retention_days/);
assert.doesNotMatch(compliance, /document_retention_policies/);
const bootTxt = readRepo("scripts/db/boot-created-tables.txt");
assert.doesNotMatch(bootTxt, /^document_versions$/m);
assert.doesNotMatch(bootTxt, /^document_permissions$/m);
assert.doesNotMatch(bootTxt, /^storage_migration_log$/m);
assert.doesNotMatch(bootTxt, /^document_retention_policies$/m);
assert.match(bootTxt, /^retention_policies$/m);
console.log("  ✅ compliance Runtime retention_policies preserved; V2 boot list cleaned");

console.log("\n═══ Migration 021 core authority unchanged ═══");
const mig021 = readRepo("artifacts/api-server/migrations/021_rag_schema_foundation.sql");
assert.match(mig021, /CREATE TABLE IF NOT EXISTS document_center_files/);
assert.match(mig021, /CREATE TABLE IF NOT EXISTS document_ai_metadata/);
assert.match(mig021, /CREATE TABLE IF NOT EXISTS rag_chunks/);
assert.doesNotMatch(mig021, /document_retention_policies/);
assert.doesNotMatch(mig021, /CREATE TABLE IF NOT EXISTS document_versions/);
console.log("  ✅ 021 core tables still owned by 021; V2 not re-homed there");

console.log("\n═══ CI / integration wiring ═══");
const pkg = readRepo("artifacts/api-server/package.json");
assert.match(pkg, /test:document-033/);
const ci = readRepo(".github/workflows/ci.yml");
assert.match(ci, /test:document-033/);
const integ = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ, /MIGRATION_033|scenario_migration_033/);
assert.match(integ, /apply_migration_033/);
const readme = readRepo("artifacts/api-server/migrations/README.md");
assert.match(readme, /033_document_v2_schema_authority/);
assert.match(readme, /preflight-migration-033/);
assert.match(readme, /document_retention_policies/);
console.log("  ✅ package.json + CI + integration + README wired");

console.log("\n✅ documentV2SchemaAuthority033 tests passed\n");
