/**
 * Stage 7 — Orphan AI reference remediation (post-045).
 * Run: pnpm --filter @workspace/api-server run test:orphan-ai-refs
 *
 * Proves:
 * 1) no production source references ai_credit_log
 * 2) no production source references obsolete ai_credits (excl. office_ai_credits)
 * 3) production-launch readiness uses office_ai_credits
 * 4) ai_command_sessions durable DML removed; v2 in-memory only
 * 5) no speculative Migration 046
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const API_SRC = join(HERE, "..");

function readRepo(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "tests" || name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkTsFiles(p, out);
    else if (name.endsWith(".ts") || name.endsWith(".js")) out.push(p);
  }
  return out;
}

function stripComments(src: string) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

console.log("\n═══ Orphan AI refs: ai_credit_log absent from production src ═══");
const prodFiles = walkTsFiles(API_SRC);
const creditLogHits: string[] = [];
const obsoleteAiCreditsHits: string[] = [];
const commandSessionsHits: string[] = [];

for (const file of prodFiles) {
  const raw = readFileSync(file, "utf8");
  const code = stripComments(raw);
  const rel = relative(ROOT, file);
  if (/\bai_credit_log\b/.test(code)) creditLogHits.push(rel);
  // SQL table identifier ai_credits only (not metric ids like goLiveMetrics id "ai_credits")
  if (/(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+ai_credits\b/i.test(code)) {
    obsoleteAiCreditsHits.push(rel);
  }
  if (/\bai_command_sessions\b/.test(code)) commandSessionsHits.push(rel);
}

assert.deepEqual(creditLogHits, [], `ai_credit_log still referenced: ${creditLogHits.join(", ")}`);
assert.deepEqual(obsoleteAiCreditsHits, [], `obsolete ai_credits still referenced: ${obsoleteAiCreditsHits.join(", ")}`);
assert.deepEqual(commandSessionsHits, [], `ai_command_sessions still referenced: ${commandSessionsHits.join(", ")}`);
console.log("  ✅ no ai_credit_log / obsolete ai_credits / ai_command_sessions in production src");

console.log("\n═══ production-launch uses office_ai_credits ═══");
const launch = readRepo("artifacts/api-server/src/modules/platform/productionLaunch.ts");
assert.match(launch, /FROM office_ai_credits/);
assert.doesNotMatch(stripComments(launch), /FROM\s+ai_credits\b/);
console.log("  ✅ production-launch readiness queries office_ai_credits");

console.log("\n═══ credit metrics map to Migration 039 ai_credit_transactions ═══");
for (const rel of [
  "artifacts/api-server/src/modules/platform/platformCommand.ts",
  "artifacts/api-server/src/modules/platform/deploymentCenter.ts",
  "artifacts/api-server/src/cron/agentCron.ts",
  "artifacts/api-server/src/modules/jlwm/enterpriseReport.ts",
]) {
  const src = stripComments(readRepo(rel));
  assert.match(src, /ai_credit_transactions/);
  assert.doesNotMatch(src, /\bai_credit_log\b/);
}
console.log("  ✅ PCC / deployment / cron / JLWM use ai_credit_transactions");

console.log("\n═══ Command Center: v2 in-memory; v1 session DML retired ═══");
const isolated = readRepo("artifacts/api-server/src/modules/ai/command-center/memory/isolated-memory.ts");
const ccIndex = readRepo("artifacts/api-server/src/modules/ai/command-center/index.ts");
const v1 = readRepo("artifacts/api-server/src/modules/ai/aiCommandCenter.ts");
assert.doesNotMatch(stripComments(isolated), /INSERT INTO|FROM ai_command_sessions|ON CONFLICT/);
assert.match(isolated, /inMemoryStore|IsolatedMemory/);
assert.doesNotMatch(stripComments(ccIndex), /ai_command_sessions/);
assert.match(ccIndex, /IsolatedMemory\.listSessions|IsolatedMemory\.clear/);
assert.doesNotMatch(stripComments(v1), /ai_command_sessions/);
assert.match(v1, /\/ai-command\/sessions/);
console.log("  ✅ durable session DML removed; v2 memory + legacy session stubs remain");

console.log("\n═══ no speculative Migration 046 ═══");
const migDir = join(ROOT, "artifacts/api-server/migrations");
const mig046 = readdirSync(migDir).filter((f) => /^046_/.test(f));
assert.deepEqual(mig046, [], `unexpected 046 migration(s): ${mig046.join(", ")}`);
assert.ok(!existsSync(join(ROOT, "scripts/db/preflight-migration-046.sql")));
console.log("  ✅ no Migration 046 / preflight-046");

console.log("\n✅ orphanAiRefsRemediation tests passed\n");
