/**
 * Stage 4B — Migration 034 JLWM Core schema authority (fail-closed).
 * Run: pnpm --filter @workspace/api-server run test:jlwm-034
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

const CORE_TABLES = [
  "jlwm_config",
  "jlwm_memory_nodes",
  "jlwm_memory_edges",
  "jlwm_world_states",
  "jlwm_legal_patterns",
  "jlwm_command_sessions",
  "jlwm_command_actions",
  "jlwm_case_twins",
  "jlwm_client_twins",
  "jlwm_firm_twin",
  "jlwm_predictions",
  "jlwm_recommendations",
  "jlwm_radar_alerts",
  "jlwm_feedback",
];

console.log("\n═══ Migration 034 presence + core contract ═══");
const migPath = "artifacts/api-server/migrations/034_jlwm_core_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-034.sql";
assert.ok(existsSync(join(ROOT, migPath)), "034 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "034 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const t of CORE_TABLES) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${t}`));
}
assert.match(mig, /UNIQUE\s*\(\s*office_id\s*\)/);
assert.match(mig, /UNIQUE\s*\(\s*office_id,\s*case_id\s*\)/);
assert.match(mig, /UNIQUE\s*\(\s*office_id,\s*client_id\s*\)/);
assert.match(mig, /UNIQUE\s*\(\s*office_id,\s*snapshot_date\s*\)/);
assert.match(mig, /idx_jmn_uniq/);
assert.match(mig, /WHERE\s+node_ref\s+IS\s+NOT\s+NULL/i);
assert.match(mig, /jlwm_memory_edges_from_node_id_fkey/);
assert.match(mig, /jlwm_memory_edges_to_node_id_fkey/);
assert.match(mig, /ON DELETE CASCADE/);
assert.match(mig, /FK_DEFERRED_ORPHANS/);
assert.match(mig, /fk_status/);
assert.match(mig, /NON_UUID_OFFICE_ID/);
assert.match(mig, /DUPLICATE_CONFIG_OFFICE_ID/);
assert.match(mig, /DUPLICATE_CASE_TWIN/);
assert.match(mig, /DUPLICATE_CLIENT_TWIN/);
assert.match(mig, /DUPLICATE_FIRM_TWIN/);
assert.match(mig, /DUPLICATE_MEMORY_NODE/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /INCOMPATIBLE_PK/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /NULL_OFFICE_ID/);
assert.match(mig, /POST_APPLY_READINESS_FAILED/);
assert.match(mig, /Post-apply readiness/);
assert.match(mig, /gen_random_uuid\(\)::text/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /jlwm_future_paths|jlwm_simulations|jlwm_ai_audit|jlwm_trust_scores/);
}
console.log("  ✅ 034 owns 14 core tables; partial unique + FK defer; no DROP; no satellites/reliability");

console.log("\n═══ Preflight 034 SELECT-only + blockers-first ladder ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|only reads catalogs/i);
assert.match(pre, /chosen_action/);
assert.match(pre, /reason_code/);
assert.match(pre, /ALREADY_CORRECT/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /JLWM_CORE_SCHEMA_READY/);
assert.match(pre, /NON_UUID_OFFICE_ID/);
assert.match(pre, /DUPLICATE_CONFIG_OFFICE_ID/);
assert.match(pre, /DUPLICATE_CASE_TWIN/);
assert.match(pre, /DUPLICATE_MEMORY_NODE/);
assert.match(pre, /INCOMPATIBLE_UNIQUE/);
assert.match(pre, /idx_jmn_uniq/);
assert.match(pre, /fk_status/);
assert.match(pre, /lock_risk/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*DROP\s+TABLE\b/im);
}
console.log("  ✅ preflight fail-closed; blockers before SAFE");

console.log("\n═══ P0 verify-schema gate includes JLWM Core critical tables ═══");
const p0Tables = readRepo("scripts/db/expected-tables-p0.txt");
assert.match(p0Tables, /^jlwm_config$/m);
assert.match(p0Tables, /^jlwm_memory_nodes$/m);
assert.match(p0Tables, /^jlwm_memory_edges$/m);
assert.match(p0Tables, /^jlwm_case_twins$/m);
assert.match(p0Tables, /^jlwm_client_twins$/m);
assert.match(p0Tables, /^jlwm_firm_twin$/m);
/* Additional core tables owned by 034 but not all P0-gated (documented choice) */
assert.doesNotMatch(p0Tables, /^jlwm_predictions$/m);
assert.doesNotMatch(p0Tables, /^jlwm_future_paths$/m);
assert.doesNotMatch(p0Tables, /^jlwm_ai_audit$/m);
const p0Cols = readRepo("scripts/db/expected-columns-p0.txt");
assert.match(p0Cols, /^jlwm_config\.office_id$/m);
assert.match(p0Cols, /^jlwm_memory_nodes\.office_id$/m);
assert.match(p0Cols, /^jlwm_memory_edges\.from_node_id$/m);
assert.match(p0Cols, /^jlwm_case_twins\.case_id$/m);
assert.match(p0Cols, /^jlwm_client_twins\.client_id$/m);
assert.match(p0Cols, /^jlwm_firm_twin\.snapshot_date$/m);
console.log("  ✅ P0 gates critical rebuild/twin tables; satellites/reliability excluded");

console.log("\n═══ Runtime JLWM Core DDL removed; satellites/reliability remain ═══");
const schema = readSrc("modules/jlwm/jlwm.schema.ts");
assert.match(schema, /034_jlwm_core_schema_authority|Migration 034/);
assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS jlwm_config/);
assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS jlwm_memory_nodes/);
assert.doesNotMatch(schema, /CREATE INDEX IF NOT EXISTS idx_jmn_/);
assert.match(schema, /to_regclass\('public\.jlwm_config'\)/);
assert.match(schema, /seedJLWMDemoData/);

const future = readSrc("modules/jlwm/futureExplorer.ts");
assert.match(future, /CREATE TABLE IF NOT EXISTS jlwm_future_paths/);
const sim = readSrc("modules/jlwm/simulationEngine.ts");
assert.match(sim, /CREATE TABLE IF NOT EXISTS jlwm_simulations/);
const lit = readSrc("modules/jlwm/litigationIntelligence.ts");
assert.match(lit, /CREATE TABLE IF NOT EXISTS jlwm_litigation_intel/);
const acc = readSrc("modules/jlwm/predictionAccuracy.ts");
assert.match(acc, /CREATE TABLE IF NOT EXISTS jlwm_accuracy_records/);
const exec = readSrc("modules/jlwm/executiveIntelligence.ts");
assert.match(exec, /CREATE TABLE IF NOT EXISTS jlwm_executive_reports/);
const coo = readSrc("modules/jlwm/legalCOO.ts");
assert.match(coo, /CREATE TABLE IF NOT EXISTS jlwm_coo_actions/);
const rel = readSrc("modules/jlwm/reliabilityEngine.ts");
assert.match(rel, /CREATE TABLE IF NOT EXISTS jlwm_ai_audit/);
assert.match(rel, /CREATE TABLE IF NOT EXISTS jlwm_trust_scores/);
console.log("  ✅ Core Runtime DDL gone; 035/036 Runtime DDL intentionally remain");

console.log("\n═══ Boot inventory + CI wiring ═══");
const bootTxt = readRepo("scripts/db/boot-created-tables.txt");
assert.doesNotMatch(bootTxt, /^jlwm_config$/m);
assert.doesNotMatch(bootTxt, /^jlwm_memory_nodes$/m);
assert.doesNotMatch(bootTxt, /^jlwm_case_twins$/m);
assert.match(bootTxt, /^jlwm_future_paths$/m);
assert.match(bootTxt, /^jlwm_ai_audit$/m);
const pkg = readRepo("artifacts/api-server/package.json");
assert.match(pkg, /test:jlwm-034/);
const ci = readRepo(".github/workflows/ci.yml");
assert.match(ci, /test:jlwm-034/);
const integ = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ, /MIGRATION_034|scenario_migration_034/);
const indexTs = readSrc("index.ts");
assert.match(indexTs, /migration 034|Migration 034/i);
assert.match(indexTs, /ensureFuturePathsTable/);
assert.match(indexTs, /ensureReliabilitySchema/);
console.log("  ✅ boot list / package / CI / integration / index wiring present");

console.log("\n═══ Follow-up bugs intentionally not fixed in 034 ═══");
const enterprise = readSrc("modules/jlwm/enterpriseReport.ts");
assert.match(enterprise, /ON CONFLICT \(office_id, node_ref\)/);
assert.match(schema, /ON CONFLICT \(office_id, node_type, node_ref\) DO UPDATE/);
console.log("  ✅ documented app ON CONFLICT mismatches left for follow-up");

console.log("\n✅ jlwmCoreSchemaAuthority034 tests passed\n");
