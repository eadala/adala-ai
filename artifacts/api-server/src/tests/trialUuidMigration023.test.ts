/**
 * Stage 15.2c — Migration 023 static contract (live scenarios in
 * scripts/db/test-migration-023.integration.sh).
 * Run: pnpm --filter @workspace/api-server run test:migration-023
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_ROOT = join(API_ROOT, "../..");
const mig023 = readFileSync(
  join(API_ROOT, "migrations/023_trial_uuid_offices.sql"),
  "utf8",
);
const integ = join(REPO_ROOT, "scripts/db/test-migration-023.integration.sh");

console.log("\n═══ migration 023 SQL contract ═══");

assert.match(mig023, /023_trial_uuid_offices/);
assert.match(mig023, /^BEGIN;/m);
assert.match(mig023, /^COMMIT;/m);
assert.match(mig023, /CREATE TABLE IF NOT EXISTS legacy_trial_office_map/);
assert.match(mig023, /old_office_id\s+TEXT PRIMARY KEY/);
assert.match(mig023, /new_office_uuid\s+UUID NOT NULL/);
assert.match(mig023, /owner_user_id\s+TEXT NOT NULL/);
assert.match(mig023, /legacy_trial_office_conflicts/);
assert.match(mig023, /legacy_default_office_unresolved/);
assert.match(mig023, /trial_offices\.user_id/);
assert.match(mig023, /office_members\.owner_admin|role IN \('owner', 'admin'\)/);
assert.match(mig023, /INSERT INTO office_page/);
assert.match(mig023, /office_registry/);
assert.match(mig023, /UPDATE trial_offices/);
assert.match(mig023, /UPDATE onboarding_state/);
assert.match(mig023, /UPDATE users/);
assert.match(mig023, /'tasks'/);
assert.match(mig023, /office_id IS NULL/);
assert.match(mig023, /RAISE EXCEPTION/);
assert.match(mig023, /fail closed/i);
assert.match(mig023, /Rollback/i);
/* Ownership must not use "first office_page row" guessing (Migration 001 style) */
assert.doesNotMatch(mig023, /FROM office_page ORDER BY created_at LIMIT 1/);
assert.doesNotMatch(mig023, /current_setting\('app\.current_tenant'/);
assert.doesNotMatch(mig023, /DELETE FROM cases/);
assert.doesNotMatch(mig023, /DELETE FROM tasks/);
console.log("  ✅ mapping table, owner rules, remap, fail-closed gates, rollback notes");

assert.match(mig023, /do not create a second office|Existing canonical UUID membership/i);
assert.match(mig023, /ON CONFLICT \(old_office_id\) DO NOTHING/);
console.log("  ✅ idempotent map + reuse existing UUID office");

assert.match(mig023, /office_id = 'default'|office_id = %L[\s\S]*'default'/);
assert.match(mig023, /left unresolved/);
console.log("  ✅ default rows inventoried, not auto-mapped");

console.log("\n═══ integration harness present ═══");
assert.ok(existsSync(integ), "test-migration-023.integration.sh must exist");
const integSrc = readFileSync(integ, "utf8");
assert.match(integSrc, /scenario_one_legacy_user/);
assert.match(integSrc, /scenario_two_ids_one_owner/);
assert.match(integSrc, /scenario_conflict_owners/);
assert.match(integSrc, /scenario_existing_uuid/);
assert.match(integSrc, /scenario_null_task_and_default/);
assert.match(integSrc, /scenario_idempotent_rerun/);
console.log("  ✅ all required live scenarios declared");

console.log("\n═══ live integration (local PostgreSQL) ═══");
const run = spawnSync("bash", [integ], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  env: process.env,
});
if (run.status !== 0) {
  console.error(run.stdout);
  console.error(run.stderr);
  assert.fail(`migration 023 integration failed with status ${run.status}`);
}
assert.match(run.stdout, /RESULTS: \d+ passed, 0 failed/);
console.log("  ✅ live integration: 0 failed");

console.log("\n✅ trialUuidMigration023 tests passed\n");
