/**
 * Batch8 cohesion guards — orgStructure / telegram / email / aiChat
 * must not invent office_id = 'default' on writes or leave list routes unscoped.
 * Run: node src/tests/tenantCohesionBatch8.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const org = readFileSync(join(SRC, "modules/platform/orgStructure.ts"), "utf8");
assert.match(org, /WHERE office_id = \$\{tid\}/);
assert.match(org, /INSERT INTO organization_units \(firm_id, office_id/);
assert.doesNotMatch(org, /SELECT \* FROM organization_units ORDER BY/);
assert.doesNotMatch(org, /SELECT id, full_name, email, role FROM users ORDER BY/);

const telegram = readFileSync(join(SRC, "modules/integrations/telegram.ts"), "utf8");
assert.doesNotMatch(telegram, /VALUES\s*\(\s*['"]default['"]/);
assert.match(telegram, /VALUES \(\$\{officeId\}/);
assert.match(telegram, /VALUES \(\$\{tid\}/);

const email = readFileSync(join(SRC, "modules/integrations/emailNotifications.ts"), "utf8");
assert.doesNotMatch(email, /VALUES\s*\(\s*['"]default['"]/);
assert.match(email, /VALUES \(\$\{tid\}, 'test'/);

const aiChat = readFileSync(join(SRC, "modules/ai/aiChat.ts"), "utf8");
assert.match(aiChat, /router\.post\("\/ai-chat\/message", requireAuthWithTenant/);
assert.match(aiChat, /router\.post\("\/ai-tasks\/:id\/process", requireAuthWithTenant/);
assert.doesNotMatch(aiChat, /office_id IS NULL OR office_id/);
assert.doesNotMatch(aiChat, /officeId: string = "default"/);
assert.doesNotMatch(aiChat, /VALUES \('default','المكتب الافتراضي'/);

console.log("✅ tenantCohesionBatch8: org/telegram/email/aiChat scoped");
