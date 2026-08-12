/**
 * Stage 4C — Migration 035 JLWM Satellites schema authority (fail-closed).
 * Run: pnpm --filter @workspace/api-server run test:jlwm-035
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

const SATELLITE_TABLES = [
  "jlwm_future_paths",
  "jlwm_simulations",
  "jlwm_litigation_intel",
  "jlwm_accuracy_records",
  "jlwm_executive_reports",
  "jlwm_coo_actions",
];

const INDEXES = [
  "idx_jfp_office",
  "idx_jfp_subject",
  "idx_jsim_office",
  "idx_jsim_case",
  "idx_jli_office",
  "idx_jli_case",
  "idx_jac_office",
  "idx_jac_type",
  "idx_jac_case",
  "idx_jer_office",
  "idx_jer_type",
  "idx_jca_office",
  "idx_jca_status",
  "idx_jca_type",
  "idx_jca_priority",
];

console.log("\n═══ Migration 035 presence + satellite contract ═══");
const migPath = "artifacts/api-server/migrations/035_jlwm_satellites_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-035.sql";
assert.ok(existsSync(join(ROOT, migPath)), "035 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "035 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const t of SATELLITE_TABLES) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`));
}
for (const idx of INDEXES) {
  assert.match(mig, new RegExp(idx));
  assert.match(pre, new RegExp(idx));
}
assert.match(mig, /generated_at DESC/);
assert.match(mig, /priority, created_at DESC/);
assert.match(mig, /NON_UUID_OFFICE_ID/);
assert.match(mig, /NULL_OFFICE_ID/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /NULL_CASE_ID/);
assert.match(mig, /NULL_PERIOD/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /POST_APPLY_READINESS_FAILED/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /jlwm_ai_audit|jlwm_trust_scores|jlwm_config\b/);
  /* Do not invent UNIQUE constraints for targetless ON CONFLICT; PRIMARY KEY is expected */
  assert.doesNotMatch(sqlOnly, /ADD CONSTRAINT\s+\S+\s+UNIQUE\b/i);
  assert.doesNotMatch(sqlOnly, /CREATE\s+UNIQUE\s+INDEX\b/i);
}
console.log("  ✅ 035 owns 6 satellites + exact indexes; no DROP; no Reliability/core; no invented UNIQUE");

console.log("\n═══ Preflight 035 SELECT-only + blockers-first ladder ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|only reads catalogs/i);
assert.match(pre, /chosen_action/);
assert.match(pre, /reason_code/);
assert.match(pre, /ALREADY_CORRECT/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /JLWM_SATELLITES_SCHEMA_READY/);
assert.match(pre, /NON_UUID_OFFICE_ID/);
assert.match(pre, /NULL_OFFICE_ID/);
assert.match(pre, /NULL_REQUIRED/);
assert.match(pre, /INCOMPATIBLE_INDEX/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
/* DESC: prefix ASC + last DESC (mirror apply); always probe index by name */
assert.match(pre, /ALWAYS probe by index name|probe by index name/i);
assert.match(pre, /last key DESC, all prefix keys ASC|prefix keys ASC/i);
assert.match(pre, /desc_ok/);
assert.doesNotMatch(
  stripComments(pre),
  /Missing target table → index gap; skip catalog probe/,
);
assert.match(mig, /Mirror apply-time DESC: last DESC \+ all prefix keys ASC/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*DROP\s+TABLE\b/im);
}
console.log("  ✅ preflight fail-closed; blockers before SAFE; strict DESC + always index-name probe");

console.log("\n═══ P0 verify-schema gate includes JLWM Satellites ═══");
const p0Tables = readRepo("scripts/db/expected-tables-p0.txt");
for (const t of SATELLITE_TABLES) {
  assert.match(p0Tables, new RegExp(`^${t}$`, "m"));
}
assert.doesNotMatch(p0Tables, /^jlwm_ai_audit$/m);
const p0Cols = readRepo("scripts/db/expected-columns-p0.txt");
assert.match(p0Cols, /^jlwm_future_paths\.office_id$/m);
assert.match(p0Cols, /^jlwm_simulations\.office_id$/m);
assert.match(p0Cols, /^jlwm_litigation_intel\.office_id$/m);
assert.match(p0Cols, /^jlwm_accuracy_records\.office_id$/m);
assert.match(p0Cols, /^jlwm_executive_reports\.office_id$/m);
assert.match(p0Cols, /^jlwm_coo_actions\.office_id$/m);
assert.match(p0Cols, /^jlwm_simulations\.case_id$/m);
assert.match(p0Cols, /^jlwm_litigation_intel\.case_id$/m);
assert.match(p0Cols, /^jlwm_accuracy_records\.case_id$/m);
assert.match(p0Cols, /^jlwm_executive_reports\.period_start$/m);
assert.match(p0Cols, /^jlwm_executive_reports\.period_end$/m);
console.log("  ✅ P0 gates all 6 satellites + critical columns; Reliability excluded");

console.log("\n═══ Runtime satellite DDL removed; Reliability remains ═══");
const future = readSrc("modules/jlwm/futureExplorer.ts");
const sim = readSrc("modules/jlwm/simulationEngine.ts");
const lit = readSrc("modules/jlwm/litigationIntelligence.ts");
const acc = readSrc("modules/jlwm/predictionAccuracy.ts");
const exec = readSrc("modules/jlwm/executiveIntelligence.ts");
const coo = readSrc("modules/jlwm/legalCOO.ts");
assert.doesNotMatch(future, /CREATE TABLE IF NOT EXISTS jlwm_future_paths/);
assert.doesNotMatch(sim, /CREATE TABLE IF NOT EXISTS jlwm_simulations/);
assert.doesNotMatch(lit, /CREATE TABLE IF NOT EXISTS jlwm_litigation_intel/);
assert.doesNotMatch(acc, /CREATE TABLE IF NOT EXISTS jlwm_accuracy_records/);
assert.doesNotMatch(exec, /CREATE TABLE IF NOT EXISTS jlwm_executive_reports/);
assert.doesNotMatch(coo, /CREATE TABLE IF NOT EXISTS jlwm_coo_actions/);
assert.doesNotMatch(future, /CREATE INDEX IF NOT EXISTS idx_jfp_/);
assert.doesNotMatch(sim, /CREATE INDEX IF NOT EXISTS idx_jsim_/);
assert.doesNotMatch(lit, /CREATE INDEX IF NOT EXISTS idx_jli_/);
assert.doesNotMatch(acc, /CREATE INDEX IF NOT EXISTS idx_jac_/);
assert.doesNotMatch(exec, /CREATE INDEX IF NOT EXISTS idx_jer_/);
assert.doesNotMatch(coo, /CREATE INDEX IF NOT EXISTS idx_jca_/);
assert.match(future, /to_regclass\('public\.jlwm_future_paths'\)/);
assert.match(sim, /to_regclass\('public\.jlwm_simulations'\)/);
assert.match(lit, /to_regclass\('public\.jlwm_litigation_intel'\)/);
assert.match(acc, /to_regclass\('public\.jlwm_accuracy_records'\)/);
assert.match(exec, /to_regclass\('public\.jlwm_executive_reports'\)/);
assert.match(coo, /to_regclass\('public\.jlwm_coo_actions'\)/);
const rel = readSrc("modules/jlwm/reliabilityEngine.ts");
assert.match(rel, /CREATE TABLE IF NOT EXISTS jlwm_ai_audit/);
assert.match(rel, /CREATE TABLE IF NOT EXISTS jlwm_trust_scores/);
console.log("  ✅ Satellite Runtime DDL gone; Reliability Runtime DDL intentionally remain");

console.log("\n═══ Boot inventory + CI wiring ═══");
const bootTxt = readRepo("scripts/db/boot-created-tables.txt");
for (const t of SATELLITE_TABLES) {
  assert.doesNotMatch(bootTxt, new RegExp(`^${t}$`, "m"));
}
assert.match(bootTxt, /^jlwm_ai_audit$/m);
const pkg = readRepo("artifacts/api-server/package.json");
assert.match(pkg, /test:jlwm-035/);
const ci = readRepo(".github/workflows/ci.yml");
assert.match(ci, /test:jlwm-035/);
const integ = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ, /MIGRATION_035|scenario_migration_035/);
assert.match(integ, /apply_migration_035/);
assert.match(integ, /mig035_wrong_desc|prefix-DESC idx_jer_type/);
assert.match(integ, /mig035_miss_tbl_bad_idx|missing table \+ wrong same-name/);
const indexTs = readSrc("index.ts");
assert.match(indexTs, /migration 035|Migration 035/i);
assert.match(indexTs, /ensureReliabilitySchema/);
console.log("  ✅ boot list / package / CI / integration / index wiring present");

console.log("\n═══ Follow-up bugs intentionally not fixed in 035 ═══");
const demo = readSrc("modules/jlwm/jlwmDemoSeed.ts");
assert.match(demo, /ON CONFLICT DO NOTHING/);
console.log("  ✅ targetless ON CONFLICT demo paths left for follow-up");

console.log("\n✅ jlwmSatellitesSchemaAuthority035 tests passed\n");
