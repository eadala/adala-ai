/**
 * Batch11 cohesion — notifications feed + legal tools + email tenant gates
 * Run: node src/tests/tenantCohesionBatch11.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const notif = readFileSync(join(SRC, "modules/operations/notifications.ts"), "utf8");
assert.match(notif, /router\.get\("\/notifications", requireAuthWithTenant/);
assert.match(notif, /WHERE office_id = \$\{tid\}/);
assert.match(notif, /FROM office_ai_credits[\s\S]*office_id = \$\{tid\}/);
assert.match(notif, /router\.get\("\/notifications\/settings", requireAuthWithTenant/);
assert.doesNotMatch(notif, /resolveTenantId/);

const judge = readFileSync(join(SRC, "modules/legal-core/judgePrep.ts"), "utf8");
assert.match(judge, /requireAuthWithTenant/);

const opp = readFileSync(join(SRC, "modules/legal-core/opponentSimulator.ts"), "utf8");
assert.match(opp, /router\.post\("\/opponent-simulator\/respond", requireAuthWithTenant/);
assert.match(opp, /router\.post\("\/opponent-simulator\/evaluate", requireAuthWithTenant/);

const research = readFileSync(join(SRC, "modules/legal-core/legalResearch.ts"), "utf8");
assert.match(research, /router\.post\("\/legal-research\/search", requireAuthWithTenant/);

const email = readFileSync(join(SRC, "modules/integrations/email.ts"), "utf8");
assert.match(email, /router\.post\("\/email\/send-letter", requireAuthWithTenant/);
assert.match(email, /router\.post\("\/email\/send-reminder", requireAuthWithTenant/);

console.log("✅ tenantCohesionBatch11: notifications/legal-tools/email scoped");
