#!/usr/bin/env node
/**
 * Deterministic release risk classifier.
 * Inspects changed paths + content patterns. AI may assist elsewhere but cannot override HIGH rules.
 *
 * Usage:
 *   node scripts/release-guardian/classify-risk.mjs [base-ref] [head-ref]
 * Env:
 *   RELEASE_GUARDIAN_POLICY=release-guardian/policy.json
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout.trim();
const policyPath = resolve(
  root,
  process.env.RELEASE_GUARDIAN_POLICY || "release-guardian/policy.json",
);
const policy = JSON.parse(readFileSync(policyPath, "utf8"));
const base = process.argv[2] || "origin/main";
const head = process.argv[3] || "HEAD";

function git(args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (r.status !== 0) {
    return { ok: false, out: (r.stdout || "") + (r.stderr || "") };
  }
  return { ok: true, out: r.stdout };
}

function matchGlob(path, glob) {
  // Minimal glob: ** and * only
  const esc = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${esc}$`).test(path);
}

function classifyPath(path) {
  for (const g of policy.high_path_globs || []) {
    if (matchGlob(path, g)) return "HIGH";
  }
  for (const g of policy.medium_path_globs || []) {
    if (matchGlob(path, g)) return "MEDIUM";
  }
  for (const g of policy.low_path_globs || []) {
    if (matchGlob(path, g)) return "LOW";
  }
  return "UNKNOWN";
}

const rank = { LOW: 1, MEDIUM: 2, HIGH: 3, UNKNOWN: 4 };

// Contaminated history check — fail closed if we cannot prove cleanliness
const contam = policy.contaminated_blob_oid;
let cleanHistory = false;
if (contam) {
  const objs = git(["rev-list", "--objects", head]);
  if (objs.ok) {
    cleanHistory = !objs.out.includes(contam);
  } else {
    cleanHistory = false; // cannot verify → unclean
  }
} else {
  cleanHistory = false; // policy must name the contaminated OID
}

const diffNames = git(["diff", "--name-only", `${base}...${head}`]);
if (!diffNames.ok) {
  // Fallback: uncommitted + recent tip files when base missing
  const fallback = git(["diff", "--name-only", "HEAD"]);
  const staged = git(["diff", "--cached", "--name-only"]);
  const names = new Set(
    `${fallback.out}\n${staged.out}`
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (names.size === 0) {
    // Compare against parent
    const parent = git(["rev-parse", `${head}^`]);
    if (parent.ok) {
      const d = git(["diff", "--name-only", `${parent.out.trim()}...${head}`]);
      d.out.split("\n").map((s) => s.trim()).filter(Boolean).forEach((n) => names.add(n));
    }
  }
  var files = [...names];
} else {
  var files = diffNames.out.split("\n").map((s) => s.trim()).filter(Boolean);
}

if (files.length === 0) {
  // No diff vs base — classify as UNKNOWN for safety if we cannot see changes
  const result = {
    risk: "UNKNOWN",
    reason: "no_diff_against_base",
    base,
    head,
    files: [],
    clean_history: cleanHistory,
    production_auto_promote_eligible: false,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

let worst = "LOW";
const fileRisks = [];
const highHits = [];

for (const file of files) {
  let r = classifyPath(file);
  // Content inspection for tracked files at head
  const show = git(["show", `${head}:${file}`]);
  let content = show.ok ? show.out : "";
  if (!content && existsSync(resolve(root, file))) {
    try {
      content = readFileSync(resolve(root, file), "utf8");
    } catch {
      content = "";
    }
  }
  for (const pat of policy.high_content_patterns || []) {
    if (content && new RegExp(pat, "i").test(content)) {
      r = "HIGH";
      highHits.push({ file, pattern: pat });
      break;
    }
  }
  // Dependency / lockfile alone => at least MEDIUM
  if (file.endsWith("pnpm-lock.yaml") || file.endsWith("package.json")) {
    if (rank[r] < rank.MEDIUM) r = "MEDIUM";
  }
  if (rank[r] > rank[worst]) worst = r;
  fileRisks.push({ file, risk: r });
}

if (!cleanHistory && policy.forbid_public_contaminated_promote) {
  // Contaminated ancestry blocks auto-prod regardless of path risk
  worst = rank[worst] < rank.HIGH ? "HIGH" : worst;
}

const eligible =
  policy.production_auto_promote === true &&
  cleanHistory &&
  (policy.allowed_auto_prod_risk || []).includes(worst) &&
  !(policy.block_auto_prod_risk || []).includes(worst);

const result = {
  risk: worst,
  base,
  head,
  file_count: files.length,
  files: fileRisks,
  high_content_hits: highHits,
  clean_history: cleanHistory,
  production_auto_promote_enabled: policy.production_auto_promote === true,
  production_auto_promote_eligible: eligible,
  staging_auto_deploy_enabled: policy.staging_auto_deploy === true,
  owner_activation_required: policy.owner_activation_required !== false,
};
console.log(JSON.stringify(result, null, 2));
process.exit(0);
