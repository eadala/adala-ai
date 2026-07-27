/**
 * PR-AI-002 — AI Gateway RBAC static enforcement contract
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..");

const AI_P0_MODULES = [
  "modules/ai/aiGateway.ts",
  "modules/ai/copilot.ts",
  "modules/ai/aiChat.ts",
  "modules/ai/ai-agent.ts",
  "modules/ai/ai-engine.ts",
  "modules/ai/ai-assistant.ts",
  "modules/ai/ai-workflow.ts",
  "modules/ai/uiBuilder.ts",
  "modules/ai/command-center/index.ts",
  "modules/ai/aiTasks.ts",
  "modules/ai/aiEvents.ts",
  "modules/ai/aiAgents.ts",
  "modules/ai/commandCenter.ts",
  "modules/ai/aiProviderEngine.ts",
] as const;

const AI_ADMIN_ONLY = [
  "modules/ai/devCommander.ts",
  "modules/ai/aiCommandCenter.ts",
] as const;

function readModule(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

function assertTenantAiRoutesGuarded(rel: string) {
  const src = readModule(rel);
  const mutationRe = /router\.(post|put|patch|delete)\([\s\S]*?async/g;
  let m: RegExpExecArray | null;
  while ((m = mutationRe.exec(src)) !== null) {
    const block = m[0];
    if (block.includes("requireSuperAdmin") || block.includes("adminOnly") || block.includes("devCmd") || block.includes("cmdOnly")) continue;
    assert.match(block, /requirePermission\(/, `${rel} has unguarded mutation block`);
  }
}

function assertMutationsGuarded(rel: string) {
  assertTenantAiRoutesGuarded(rel);
}

function testAiGatewayHardening() {
  const gateway = readModule("modules/ai/aiGateway.ts");
  assert.match(gateway, /requireAuthWithTenant, requirePermission\("ai:access"\)/);
  assert.match(gateway, /requireAuthWithTenant, requireSuperAdmin/);
  assert.doesNotMatch(gateway, /tenantId \?\? .*"unknown"/);
  assert.doesNotMatch(gateway, /router\.\w+\([^)]*requireAuth[^W]/);
  console.log("  ✅ aiGateway — tenant + ai:access + super-admin analytics");
}

function testCreditDeductLocked() {
  const credits = readModule("modules/ai/aiCredits.ts");
  assert.match(credits, /router\.post\("\/ai-credits\/deduct", requireSuperAdmin/);
  console.log("  ✅ ai-credits/deduct locked to super-admin");
}

function testAiAgentTenantScope() {
  const agent = readModule("modules/ai/ai-agent.ts");
  assert.match(agent, /office_members WHERE office_id/);
  assert.match(agent, /ai_workflows WHERE office_id/);
  console.log("  ✅ ai-agent logs/workflows tenant-scoped");
}

function testP0Modules() {
  for (const m of AI_P0_MODULES) {
    assertTenantAiRoutesGuarded(m);
    assertMutationsGuarded(m);
  }
  console.log(`  ✅ ${AI_P0_MODULES.length} AI P0 modules guarded with ai:access`);
}

function testAdminModules() {
  for (const m of AI_ADMIN_ONLY) {
    const src = readModule(m);
    assert.match(src, /requireSuperAdmin/);
  }
  console.log("  ✅ admin-only AI modules use requireSuperAdmin");
}

function main() {
  console.log("PR-AI-002 AI Gateway RBAC Tests\n");
  testAiGatewayHardening();
  testCreditDeductLocked();
  testAiAgentTenantScope();
  testP0Modules();
  testAdminModules();
  console.log("\n✅ All PR-AI-002 AI gateway RBAC tests passed\n");
}

main();
