/**
 * Stage 19 — Autopilot schema authority (Migration 028).
 * Run: pnpm --filter @workspace/api-server run test:autopilot-028
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAutopilotOfficeId } from "../agents/autopilotTaskCreation";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SRC = join(HERE, "..");

const OFFICE_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";

const migPath = join(
  ROOT,
  "artifacts/api-server/migrations/028_case_autopilot_reports_schema_authority.sql",
);
const preflightPath = join(ROOT, "scripts/db/preflight-migration-028.sql");
const mig = readFileSync(migPath, "utf8");
const preflight = readFileSync(preflightPath, "utf8");
const caseAutopilotTs = readFileSync(join(SRC, "agents/caseAutopilot.ts"), "utf8");
const listenerTs = readFileSync(join(SRC, "core/listeners/autopilotListener.ts"), "utf8");
const casesTs = readFileSync(join(SRC, "modules/legal-core/cases.ts"), "utf8");
const ownershipTs = readFileSync(join(SRC, "agents/autopilotTaskCreation.ts"), "utf8");
const integ = readFileSync(join(ROOT, "scripts/db/test-migrations.integration.sh"), "utf8");
const expectedTables = readFileSync(join(ROOT, "scripts/db/expected-tables-p0.txt"), "utf8");
const expectedCols = readFileSync(join(ROOT, "scripts/db/expected-columns-p0.txt"), "utf8");
const bootTxt = readFileSync(join(ROOT, "scripts/db/boot-created-tables.txt"), "utf8");
const readme = readFileSync(
  join(ROOT, "artifacts/api-server/migrations/README.md"),
  "utf8",
);

console.log("\n═══ migration 028 + preflight + P0 inventory ═══");

assert.ok(existsSync(migPath), "028_case_autopilot_reports_schema_authority.sql must exist");
assert.ok(existsSync(preflightPath), "preflight-migration-028.sql must exist");
assert.match(mig, /CREATE TABLE IF NOT EXISTS case_autopilot_reports/);
assert.match(mig, /case_id\s+TEXT PRIMARY KEY/);
assert.match(mig, /office_id\s+TEXT NOT NULL/);
assert.match(mig, /health_score\s+INTEGER NOT NULL DEFAULT 0/);
assert.match(mig, /grade\s+TEXT NOT NULL DEFAULT 'F'/);
assert.match(mig, /risks\s+JSONB NOT NULL DEFAULT/);
assert.match(mig, /missing_data\s+JSONB NOT NULL DEFAULT/);
assert.match(mig, /next_steps\s+JSONB NOT NULL DEFAULT/);
assert.match(mig, /tasks_created\s+INTEGER NOT NULL DEFAULT 0/);
assert.match(mig, /outcome_prediction\s+JSONB NOT NULL DEFAULT/);
assert.match(mig, /ai_summary\s+TEXT/);
assert.match(mig, /run_at\s+TIMESTAMPTZ DEFAULT NOW\(\)/);
assert.match(mig, /ADD COLUMN IF NOT EXISTS/);
assert.match(mig, /PRIMARY KEY \(case_id\)|case_autopilot_reports_pkey/);
assert.match(mig, /RAISE EXCEPTION/);
assert.match(mig, /BLOCKED_CLEAN_DUPLICATES|duplicate case_id/i);
assert.match(mig, /idx_autopilot_office/);
assert.doesNotMatch(mig.replace(/--.*$/gm, ""), /RAISE WARNING/i);
{
  const sqlOnly = mig.replace(/--.*$/gm, "");
  assert.doesNotMatch(sqlOnly, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sqlOnly, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(sqlOnly, /created_at/i);
}
assert.match(preflight, /READ-ONLY|SELECT only/i);
assert.match(preflight, /case_autopilot_reports_present|table presence/i);
assert.match(preflight, /default_office_rows|office_id = 'default'/);
assert.match(preflight, /null_office_id|non_uuid_office_id/);
assert.match(preflight, /null_case_id|duplicate case_id/i);
assert.match(preflight, /BLOCKED_CLEAN_DUPLICATES/);
assert.match(preflight, /chosen_action/);
assert.doesNotMatch(preflight, /^\s*(CREATE|ALTER|DROP)\b/im);
assert.match(integ, /scenario_migration_028_case_autopilot_reports/);
assert.match(integ, /MIGRATION_028/);
assert.match(integ, /apply_migration_028/);
assert.match(expectedTables, /^case_autopilot_reports$/m);
assert.match(expectedCols, /^case_autopilot_reports\.case_id$/m);
assert.match(expectedCols, /^case_autopilot_reports\.office_id$/m);
assert.match(expectedCols, /^case_autopilot_reports\.health_score$/m);
assert.match(expectedCols, /^case_autopilot_reports\.run_at$/m);
assert.doesNotMatch(bootTxt, /^case_autopilot_reports$/m);
assert.match(readme, /028_case_autopilot_reports_schema_authority/);
assert.match(readme, /preflight-migration-028/);
console.log("  ✅ migration 028 + preflight + harness + P0 inventory");

console.log("\n═══ Runtime DDL removed from Autopilot paths ═══");

assert.doesNotMatch(caseAutopilotTs, /ensureAutopilotTable/);
assert.doesNotMatch(caseAutopilotTs, /CREATE TABLE IF NOT EXISTS case_autopilot_reports/);
assert.doesNotMatch(caseAutopilotTs, /ALTER TABLE case_autopilot_reports/);
assert.doesNotMatch(caseAutopilotTs, /CREATE INDEX IF NOT EXISTS idx_autopilot_office/);
assert.match(caseAutopilotTs, /028_case_autopilot_reports_schema_authority/);
assert.match(caseAutopilotTs, /ON CONFLICT \(case_id\) DO UPDATE/);
assert.doesNotMatch(listenerTs, /ensureAutopilotTable/);
assert.doesNotMatch(listenerTs, /CREATE TABLE IF NOT EXISTS case_autopilot_reports/);
assert.doesNotMatch(listenerTs, /tableReady/);
assert.match(listenerTs, /resolveAutopilotOfficeId/);
assert.doesNotMatch(casesTs, /ensureAutopilotTable/);
assert.match(casesTs, /FROM case_autopilot_reports WHERE case_id/);
assert.match(casesTs, /office_id = \$\{tenantId\}/);
console.log("  ✅ no Runtime DDL; upsert + tenant-scoped reads preserved");

console.log("\n═══ resolveAutopilotOfficeId — UUID only (unchanged) ═══");

{
  assert.equal(resolveAutopilotOfficeId(OFFICE_UUID), OFFICE_UUID);
  for (const bad of [
    null,
    undefined,
    "",
    "default",
    "platform",
    "trial_abc",
    "trial_office_x",
    "not-a-uuid",
    "arbitrary-text",
  ]) {
    assert.equal(resolveAutopilotOfficeId(bad), null, `must reject ${String(bad)}`);
  }
  assert.match(ownershipTs, /classifyTenantId/);
  assert.match(ownershipTs, /kind !== "uuid"/);
  console.log("  ✅ missing/default/platform/trial_/text rejected");
}

console.log("\n═══ Autopilot SQL compatibility with migration 028 ═══");

{
  assert.match(
    caseAutopilotTs,
    /INSERT INTO case_autopilot_reports[\s\S]*case_id, office_id, health_score, grade, risks, missing_data, next_steps/,
  );
  assert.match(caseAutopilotTs, /tasks_created, outcome_prediction, ai_summary, run_at/);
  assert.match(caseAutopilotTs, /ON CONFLICT \(case_id\) DO UPDATE SET/);
  assert.doesNotMatch(mig.replace(/--.*$/gm, ""), /DEFAULT\s+'default'/i);
  assert.ok(
    "027_event_daily_counts_schema_authority.sql" <
      "028_case_autopilot_reports_schema_authority.sql",
    "028 must lexicographically follow 027",
  );
  console.log("  ✅ INSERT/ON CONFLICT columns match migration; ordering after 027");
}

console.log("\n✅ autopilotSchemaAuthority028 tests passed\n");
