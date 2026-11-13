/**
 * Batch19 — stamp office_id on finance collection revenues + autopilot tasks; scope AI case-brief contracts
 * Run: node src/tests/tenantCohesionBatch19.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const finance = readFileSync(join(SRC, "modules/financial/finance-center.ts"), "utf8");
assert.match(finance, /INSERT INTO revenues \(office_id/);
assert.match(finance, /collections\/:id\/payment[\s\S]*if \(!tenantId\)/);

const autopilot = readFileSync(join(SRC, "agents/caseAutopilot.ts"), "utf8");
assert.match(autopilot, /INSERT INTO tasks \(office_id, case_id/);
assert.match(autopilot, /FROM events WHERE case_id = \$\{caseId\} AND office_id = \$\{tenantId\}/);

const ai = readFileSync(join(SRC, "modules/ai/ai-engine.ts"), "utf8");
assert.match(ai, /FROM contracts WHERE case_id = \$\{id\}::uuid AND office_id = \$\{tenantId\}/);
assert.match(ai, /if \(!tenantId\) return res\.status\(403\)/);

console.log("✅ tenantCohesionBatch19: finance revenues / autopilot tasks / AI contracts scoped");
