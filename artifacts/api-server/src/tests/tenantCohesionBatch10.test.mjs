/**
 * Batch10 cohesion — signatures / adoul / events / copilot / commandCenter
 * Run: node src/tests/tenantCohesionBatch10.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const sig = readFileSync(join(SRC, "modules/legal-core/signatures.ts"), "utf8");
assert.match(sig, /requireAuthWithTenant/);
assert.match(sig, /AND office_id = \$\{tid\}/);
assert.match(sig, /WHERE office_id = \$\{tid\}/);
assert.doesNotMatch(sig, /FROM document_signatures\s+ORDER BY/);

const adoul = readFileSync(join(SRC, "modules/legal-core/adoul.ts"), "utf8");
assert.match(adoul, /router\.post\("\/stream", requireAuthWithTenant/);
assert.match(adoul, /router\.post\("\/chat", requireAuthWithTenant/);
assert.doesNotMatch(adoul, /\|\| ["']adoul["']/);

const events = readFileSync(join(SRC, "modules/operations/events.ts"), "utf8");
assert.match(events, /router\.get\("\/events\/stream", requireAuthWithTenant/);
assert.match(events, /router\.get\("\/events\/recent", requireAuthWithTenant/);
assert.match(events, /router\.get\("\/events\/stats", requireAuthWithTenant/);

const copilot = readFileSync(join(SRC, "modules/ai/copilot.ts"), "utf8");
assert.match(copilot, /router\.post\("\/chat", requireAuthWithTenant/);
assert.match(copilot, /router\.get\("\/memory", requireAuthWithTenant/);
assert.match(copilot, /router\.post\("\/memory", requireAuthWithTenant/);
assert.doesNotMatch(copilot, /officeId !== ["']default["']/);

const cmd = readFileSync(join(SRC, "modules/ai/commandCenter.ts"), "utf8");
assert.match(cmd, /router\.post\("\/command-center\/execute", requireAuthWithTenant/);

console.log("✅ tenantCohesionBatch10: signatures/adoul/events/copilot/commandCenter scoped");
