/**
 * Stage 15.2c — Migration 023 static contract + live integration
 * (scripts/db/test-migration-023.integration.sh) and read-only preflight.
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
const preflightPath = join(REPO_ROOT, "scripts/db/preflight-migration-023.sql");

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
assert.match(mig023, /role = 'owner'/);
assert.match(mig023, /INSERT INTO office_page/);
assert.match(mig023, /office_registry/);
assert.match(mig023, /UPDATE trial_offices/);
assert.match(mig023, /UPDATE onboarding_state/);
assert.match(mig023, /UPDATE users/);
assert.match(
  mig023,
  /Remap ALL users\.office_id rows pointing at this mapped legacy trial id/i,
);
assert.match(mig023, /WHERE office_id = r\.old_office_id/);
assert.match(mig023, /'tasks'/);
assert.match(mig023, /office_id IS NULL|NULL-task|Migration 024/i);
assert.match(mig023, /RAISE EXCEPTION/);
assert.match(mig023, /fail closed/i);
assert.match(mig023, /Rollback/i);
assert.match(mig023, /abort BEFORE office_page creation/i);
assert.match(mig023, /trust preflight script output/);
/* Ownership must not use "first office_page row" guessing (Migration 001 style) */
assert.doesNotMatch(mig023, /FROM office_page ORDER BY created_at LIMIT 1/);
assert.doesNotMatch(mig023, /current_setting\('app\.current_tenant'/);
assert.doesNotMatch(mig023, /DELETE FROM cases/);
assert.doesNotMatch(mig023, /DELETE FROM tasks/);
/* Unsafe owner inference removed */
assert.doesNotMatch(mig023, /role IN \('owner',\s*'admin'\)/);
assert.doesNotMatch(mig023, /office_members\.owner_admin/);
assert.doesNotMatch(mig023, /office_members\.sole_active/);
assert.doesNotMatch(mig023, /resolve_source.*,\s*'users\.office_id'/);
assert.match(mig023, /Ordinary members \/ users\.office_id \/ admin-only are NOT trusted/i);
assert.match(mig023, /role='admin' is NOT used for automatic ownership/i);
console.log("  ✅ mapping table, trusted-only owner rules, remap, fail-closed gates, rollback notes");

assert.match(mig023, /do not create a second office|Existing UUID office proven/i);
assert.match(mig023, /ON CONFLICT \(old_office_id\) DO NOTHING/);
console.log("  ✅ idempotent map + reuse existing UUID office");

assert.match(mig023, /office_id = 'default'|office_id = %L[\s\S]*'default'/);
assert.match(mig023, /left unresolved/);
console.log("  ✅ default rows inventoried, not auto-mapped");

console.log("\n═══ preflight SQL contract (read-only) ═══");
assert.ok(existsSync(preflightPath), "preflight-migration-023.sql must exist");
const preflight = readFileSync(preflightPath, "utf8");
assert.match(preflight, /SELECT only|READ-ONLY/i);
assert.match(preflight, /old_office_id/);
assert.match(preflight, /trial_owner_user_id/);
assert.match(preflight, /owner_member_user_id/);
assert.match(preflight, /admin_member_user_id/);
assert.match(preflight, /existing_uuid_office/);
assert.match(preflight, /chosen_owner/);
assert.match(preflight, /chosen_action/);
assert.match(preflight, /conflict_reason/);
assert.match(preflight, /map_to_new_or_existing/);
assert.match(preflight, /unresolved/);
assert.match(preflight, /conflict/);
assert.match(preflight, /null_tasks_left_for_024|NULL tasks/i);
assert.match(preflight, /default/);
assert.match(preflight, /two legacy ids/i);
const preflightCode = preflight
  .split("\n")
  .filter((line) => !/^\s*--/.test(line))
  .join("\n");
assert.doesNotMatch(
  preflightCode,
  /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE|COPY)\b/im,
);
console.log("  ✅ preflight SELECT-only with required columns/classifications");

console.log("\n═══ integration harness present ═══");
assert.ok(existsSync(integ), "test-migration-023.integration.sh must exist");
const integSrc = readFileSync(integ, "utf8");
assert.match(integSrc, /scenario_one_legacy_user/);
assert.match(integSrc, /scenario_two_ids_one_owner/);
assert.match(integSrc, /scenario_conflict_owners/);
assert.match(integSrc, /scenario_existing_uuid/);
assert.match(integSrc, /scenario_null_task_and_default/);
assert.match(integSrc, /scenario_idempotent_rerun/);
assert.match(integSrc, /scenario_ordinary_member_not_owner/);
assert.match(integSrc, /scenario_users_office_id_alone/);
assert.match(integSrc, /scenario_explicit_trial_owner/);
assert.match(integSrc, /scenario_explicit_owner_membership/);
assert.match(integSrc, /scenario_trial_vs_member_owner_conflict/);
assert.match(integSrc, /scenario_admin_alone_not_owner/);
assert.match(integSrc, /scenario_owner_and_invited_member_users_office_id/);
assert.match(integSrc, /scenario_preflight_readonly/);
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
