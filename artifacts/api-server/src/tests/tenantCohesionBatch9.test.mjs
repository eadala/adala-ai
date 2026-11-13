/**
 * Batch9 / AAGG-20 — ai-agent, aiAgents, aiEvents, legalAI tenant cohesion.
 * Run: node src/tests/tenantCohesionBatch9.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const agent = readFileSync(join(SRC, "modules/ai/ai-agent.ts"), "utf8");
assert.match(agent, /router\.get\("\/ai-agent\/logs", requireAuthWithTenant/);
assert.match(agent, /router\.get\("\/ai-agent\/workflows", requireAuthWithTenant/);
assert.match(agent, /router\.post\("\/ai-agent\/workflows", requireAuthWithTenant/);
assert.match(agent, /INSERT INTO ai_workflows \(id, office_id/);
assert.match(agent, /INSERT INTO ai_agent_logs \(id,office_id/);
assert.doesNotMatch(agent, /FROM ai_agent_logs ORDER BY/);
assert.doesNotMatch(agent, /SELECT \* FROM ai_workflows ORDER BY/);

const agents = readFileSync(join(SRC, "modules/ai/aiAgents.ts"), "utf8");
assert.match(agents, /router\.post\("\/ai-agents\/run", requireAuthWithTenant/);

const events = readFileSync(join(SRC, "modules/ai/aiEvents.ts"), "utf8");
assert.match(events, /router\.get\("\/ai-events", requireAuthWithTenant/);
assert.match(events, /router\.post\("\/ai-events\/:id\/dismiss", requireAuthWithTenant/);
assert.match(events, /router\.post\("\/ai-events\/scan", requireAuthWithTenant/);
assert.doesNotMatch(events, /\(req as any\)\.officeId/);

const legal = readFileSync(join(SRC, "modules/legal-core/legalAI.ts"), "utf8");
assert.match(legal, /AND c\.office_id = \$\{tenantId\}/);
assert.match(legal, /callAI\(\s*template\.systemPrompt[\s\S]*tenantId/);
assert.match(legal, /"legal_ai_generate"/);

console.log("✅ tenantCohesionBatch9: ai-agent/aiAgents/aiEvents/legalAI scoped");
