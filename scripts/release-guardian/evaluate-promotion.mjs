#!/usr/bin/env node
/**
 * Fail-closed production promotion evaluator.
 * Reads risk classification JSON + gate results; never deploys.
 *
 * Usage:
 *   node scripts/release-guardian/evaluate-promotion.mjs --risk risk.json --gates gates.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout.trim();
const policy = JSON.parse(
  readFileSync(resolve(root, "release-guardian/policy.json"), "utf8"),
);
const riskPath = arg("--risk");
const gatesPath = arg("--gates");
if (!riskPath || !gatesPath) {
  console.error("FAIL: --risk and --gates required");
  process.exit(2);
}

const risk = JSON.parse(readFileSync(riskPath, "utf8"));
const gates = JSON.parse(readFileSync(gatesPath, "utf8"));

const blockers = [];

if (policy.production_auto_promote !== true) {
  blockers.push("production_auto_promote_disabled");
}
if (policy.owner_activation_required !== false && !gates.owner_activated) {
  blockers.push("owner_activation_required");
}
if (!risk.clean_history) {
  blockers.push("contaminated_or_unclean_history");
}
if ((policy.block_auto_prod_risk || []).includes(risk.risk)) {
  blockers.push(`risk_${risk.risk}_blocked`);
}
if (!(policy.allowed_auto_prod_risk || []).includes(risk.risk)) {
  blockers.push(`risk_${risk.risk}_not_in_allowlist`);
}

const required = policy.required_ci_jobs || [];
for (const job of required) {
  const st = gates.jobs?.[job];
  if (st !== "success" && st !== "PASS" && st !== "VERIFIED_PASS") {
    blockers.push(`ci_job_not_pass:${job}:${st ?? "MISSING"}`);
  }
}

if (gates.staging_deploy !== "success" && gates.staging_deploy !== "PASS") {
  blockers.push(`staging_deploy:${gates.staging_deploy ?? "MISSING"}`);
}
if (gates.staging_smoke !== "success" && gates.staging_smoke !== "PASS") {
  blockers.push(`staging_smoke:${gates.staging_smoke ?? "MISSING"}`);
}
if (!gates.release_artifact_digest) {
  blockers.push("missing_release_artifact_digest");
}
if (!gates.rollback_target) {
  blockers.push("missing_rollback_target");
}
if (!gates.backup_verified) {
  blockers.push("backup_not_verified");
}
if (gates.unresolved_p0 || gates.unresolved_p1_security) {
  blockers.push("unresolved_security_findings");
}
if (gates.production_baseline_healthy !== true) {
  blockers.push("production_baseline_not_healthy");
}

const decision =
  blockers.length === 0 ? "PROMOTE_ALLOWED" : "PROMOTE_BLOCKED";

const out = {
  decision,
  risk: risk.risk,
  blockers,
  production_auto_promote: policy.production_auto_promote,
  note:
    decision === "PROMOTE_BLOCKED"
      ? "Fail-closed: no production deployment performed"
      : "Eligible under policy — still requires activated Coolify promotion credentials",
};
console.log(JSON.stringify(out, null, 2));
process.exit(decision === "PROMOTE_ALLOWED" ? 0 : 1);
