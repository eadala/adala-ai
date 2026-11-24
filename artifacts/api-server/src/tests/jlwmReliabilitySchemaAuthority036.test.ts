/**
 * Stage 4D — Migration 036 JLWM Reliability schema authority (fail-closed).
 * Run: pnpm --filter @workspace/api-server run test:reliability-036
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

const RELIABILITY_TABLES = [
  "jlwm_ai_audit",
  "jlwm_trust_scores",
  "jlwm_recommendation_tracking",
  "jlwm_data_quality",
  "jlwm_learning_events",
];

const INDEXES = [
  "idx_jaa_office",
  "idx_jaa_type",
  "idx_jts_office",
  "idx_jrt_office",
  "idx_jdq_office",
  "idx_jle_office",
];

console.log("\n═══ Migration 036 presence + reliability contract ═══");
const migPath = "artifacts/api-server/migrations/036_jlwm_reliability_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-036.sql";
assert.ok(existsSync(join(ROOT, migPath)), "036 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "036 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const table of RELIABILITY_TABLES) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
for (const index of INDEXES) {
  assert.match(mig, new RegExp(index));
  assert.match(pre, new RegExp(index));
}
assert.match(mig, /idx_jaa_type[\s\S]{0,180}created_at DESC/);
assert.match(mig, /idx_jts_office[\s\S]{0,180}computed_at DESC/);
assert.match(mig, /idx_jdq_office[\s\S]{0,180}computed_at DESC/);
assert.match(mig, /idx_jle_office[\s\S]{0,180}created_at DESC/);
assert.match(mig, /NON_UUID_OFFICE_ID/);
assert.match(mig, /NULL_OFFICE_ID/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /INCOMPATIBLE_(?:TYPE|PK|INDEX)/);
assert.match(mig, /POST_APPLY_READINESS_FAILED/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /ADD CONSTRAINT\s+\S+\s+UNIQUE\b/i);
  assert.doesNotMatch(sqlOnly, /CREATE\s+UNIQUE\s+INDEX\b/i);
  assert.doesNotMatch(
    sqlOnly,
    /jlwm_(?:config|memory_nodes|memory_edges|world_states|legal_patterns|command_sessions|command_actions|case_twins|client_twins|firm_twin|predictions|recommendations|radar_alerts|feedback|future_paths|simulations|litigation_intel|accuracy_records|executive_reports|coo_actions)\b/,
  );
}
console.log("  ✅ 036 owns 5 reliability tables + exact 6 indexes; no DROP/UNIQUE/core/satellite SQL");

console.log("\n═══ Preflight 036 SELECT-only + blockers-first ladder ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|only reads catalogs/i);
assert.match(pre, /chosen_action/);
assert.match(pre, /reason_code/);
assert.match(pre, /ALREADY_CORRECT/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /JLWM_RELIABILITY_SCHEMA_READY/);
assert.match(pre, /NON_UUID_OFFICE_ID/);
assert.match(pre, /NULL_OFFICE_ID/);
assert.match(pre, /NULL_REQUIRED/);
assert.match(pre, /INCOMPATIBLE_(?:TYPE|PK|INDEX)/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /WHERE n\.nspname='public' AND i\.relname=index_spec\.index_name/);
assert.match(pre, /last key DESC, all prefix keys ASC|prefix keys ASC/i);
assert.match(pre, /incompatible_objects[\s\S]*missing_tables/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*DROP\s+(?:TABLE|INDEX)\b/im);
}
console.log("  ✅ preflight is SELECT-only; named index probes and blockers precede SAFE");

console.log("\n═══ P0 verify-schema gate includes JLWM Reliability ═══");
const p0Tables = readRepo("scripts/db/expected-tables-p0.txt");
for (const table of RELIABILITY_TABLES) {
  assert.match(p0Tables, new RegExp(`^${table}$`, "m"));
}
const p0Cols = readRepo("scripts/db/expected-columns-p0.txt");
for (const table of RELIABILITY_TABLES) {
  assert.match(p0Cols, new RegExp(`^${table}\\.office_id$`, "m"));
}
assert.match(p0Cols, /^jlwm_ai_audit\.created_at$/m);
assert.match(p0Cols, /^jlwm_trust_scores\.computed_at$/m);
assert.match(p0Cols, /^jlwm_data_quality\.computed_at$/m);
assert.match(p0Cols, /^jlwm_learning_events\.created_at$/m);
console.log("  ✅ P0 gates all 5 reliability tables and office/computed/created columns");

console.log("\n═══ Reliability Runtime DDL removed; readiness uses to_regclass ═══");
const rel = readSrc("modules/jlwm/reliabilityEngine.ts");
assert.doesNotMatch(rel, /CREATE TABLE IF NOT EXISTS jlwm_/);
assert.doesNotMatch(rel, /CREATE INDEX IF NOT EXISTS idx_ja[atrd]_?/);
for (const table of RELIABILITY_TABLES) {
  assert.match(rel, new RegExp(`to_regclass\\('public\\.${table}'\\)`));
}
console.log("  ✅ Runtime CREATE TABLE/INDEX removed; SELECT-only to_regclass probes remain");

console.log("\n═══ Reliability DML follows 034/035 column contracts ═══");
assert.match(rel, /subject_type\s*=\s*'case'/);
assert.match(rel, /supporting_data/);
assert.match(rel, /recorded_at/);
assert.doesNotMatch(rel, /SELECT\s+predictions\b/i);
assert.doesNotMatch(rel, /FROM\s+jlwm_predictions[\s\S]{0,300}\bcase_id\s*=/i);
assert.doesNotMatch(rel, /FROM\s+jlwm_predictions[\s\S]{0,300}\bcomputed_at\b/i);
assert.doesNotMatch(rel, /toISOString\(\)\s*\+\s*["']::timestamptz["']/);
assert.match(rel, /export async function selectCaseBundlePrediction/);
const predictionQueries = [...rel.matchAll(/FROM\s+jlwm_predictions[\s\S]*?LIMIT 1/gi)].map(
  ([query]) => query,
);
assert.equal(predictionQueries.length, 1, "single shared case_bundle prediction read");
assert.match(predictionQueries[0], /WHERE office_id\s*=\s*\$\{officeId\}/);
assert.match(predictionQueries[0], /subject_type\s*=\s*'case'/);
assert.match(predictionQueries[0], /prediction_type\s*=\s*'case_bundle'/);
assert.match(predictionQueries[0], /ORDER BY created_at DESC/);
assert.match(rel, /await selectCaseBundlePrediction\(\s*officeId,\s*entityId\s*\)/, "explain path");
assert.match(rel, /selectCaseBundlePrediction\(\s*officeId,\s*caseId\s*\)/, "confidence path");
console.log("  ✅ prediction DML uses case_bundle + supporting_data/created_at; tenant filters retained");

console.log("\n═══ Behavioral: case_bundle wins over newer slice rows ═══");
/* In-memory mirror of the formal-034 SELECT used by selectCaseBundlePrediction.
 * Integration Scenario 036 N executes the same predicate against live Postgres. */
type PredRow = {
  prediction_type: string;
  subject_type: string;
  subject_id: string;
  office_id: string;
  created_at: string;
  supporting_data: Record<string, unknown>;
};
function selectCaseBundleMirror(
  rows: PredRow[],
  officeId: string,
  subjectId: string,
): PredRow | undefined {
  return rows
    .filter(
      (r) =>
        r.office_id === officeId &&
        r.subject_type === "case" &&
        r.subject_id === subjectId &&
        r.prediction_type === "case_bundle",
    )
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
}
const officeA = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const caseA = "case-1111-2222-3333-444444444444";
const bundleData = { marker: "BUNDLE_SUPPORTING", outcome: { value: "win", confidence: 0.8 } };
const sliceDuration = { marker: "SLICE_DURATION", value: 90 };
const sliceAppeal = { marker: "SLICE_APPEAL", probability: 0.2 };
const fixtureRows: PredRow[] = [
  {
    office_id: officeA,
    subject_type: "case",
    subject_id: caseA,
    prediction_type: "case_bundle",
    created_at: "2026-01-01T10:00:00.000Z",
    supporting_data: bundleData,
  },
  {
    office_id: officeA,
    subject_type: "case",
    subject_id: caseA,
    prediction_type: "duration",
    created_at: "2026-01-01T11:00:00.000Z",
    supporting_data: sliceDuration,
  },
  {
    office_id: officeA,
    subject_type: "case",
    subject_id: caseA,
    prediction_type: "appeal",
    created_at: "2026-01-01T12:00:00.000Z",
    supporting_data: sliceAppeal,
  },
];
const newestAny = [...fixtureRows].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
assert.equal(newestAny.prediction_type, "appeal", "fixture: newest row is a slice");
assert.equal(newestAny.supporting_data.marker, "SLICE_APPEAL");
const selected = selectCaseBundleMirror(fixtureRows, officeA, caseA);
assert.ok(selected, "case_bundle row selected");
assert.equal(selected?.prediction_type, "case_bundle");
assert.equal(selected?.supporting_data.marker, "BUNDLE_SUPPORTING");
assert.notEqual(selected?.supporting_data.marker, newestAny.supporting_data.marker);
/* SQL source must encode the same filters the mirror applies */
assert.match(
  predictionQueries[0],
  /prediction_type\s*=\s*'case_bundle'[\s\S]*ORDER BY created_at DESC/,
);
console.log("  ✅ case_bundle supporting_data selected over newer duration/appeal slices");

console.log("\n═══ 034/035 ownership boundaries + wiring ═══");
for (const path of [
  "artifacts/api-server/migrations/034_jlwm_core_schema_authority.sql",
  "artifacts/api-server/migrations/035_jlwm_satellites_schema_authority.sql",
]) {
  assert.doesNotMatch(readRepo(path), /CREATE TABLE IF NOT EXISTS jlwm_ai_audit/);
}
assert.doesNotMatch(rel, /ALTER\s+TABLE\s+jlwm_predictions/i);
assert.doesNotMatch(rel, /ALTER\s+TABLE\s+jlwm_(?:ai_audit|trust_scores|recommendation_tracking|data_quality|learning_events)/i);
const bootTxt = readRepo("scripts/db/boot-created-tables.txt");
assert.doesNotMatch(bootTxt, /^jlwm_(?:ai_audit|trust_scores|recommendation_tracking|data_quality|learning_events)$/m);
const pkg = readRepo("artifacts/api-server/package.json");
assert.match(pkg, /test:reliability-036/);
const ci = readRepo(".github/workflows/ci.yml");
assert.match(ci, /test:reliability-036/);
const integ = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ, /MIGRATION_036/);
assert.match(integ, /apply_migration_036/);
assert.match(integ, /scenario_migration_036_jlwm_reliability/);
console.log("  ✅ Reliability remains migration 036-owned; boot/package/CI/integration wiring present");

console.log("\n✅ jlwmReliabilitySchemaAuthority036 tests passed\n");
