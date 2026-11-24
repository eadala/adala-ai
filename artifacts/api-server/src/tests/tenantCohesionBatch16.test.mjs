/**
 * Batch16 — drop inventing DEFAULT 'default' on whatsapp/reminders/hrInternal/webPush
 * Run: node src/tests/tenantCohesionBatch16.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const wa = readFileSync(join(SRC, "modules/integrations/whatsapp.ts"), "utf8");
assert.doesNotMatch(wa, /DEFAULT 'default'/);
assert.match(wa, /tidOf\(req\)/);
assert.match(wa, /لا يمكن تحديد المكتب/);
assert.match(wa, /ALTER COLUMN office_id DROP DEFAULT/);

const rem = readFileSync(join(SRC, "modules/legal-core/reminders.ts"), "utf8");
assert.doesNotMatch(rem, /DEFAULT 'default'/);
assert.match(rem, /tidOf\(req\)/);
assert.match(rem, /c\.office_id = \$\{tenantId\}/);

const hr = readFileSync(join(SRC, "modules/operations/hrInternal.ts"), "utf8");
assert.doesNotMatch(hr, /DEFAULT 'default'/);
assert.match(hr, /tidOf\(req\)/);
assert.match(hr, /ALTER TABLE hr_announcements ALTER COLUMN office_id DROP DEFAULT/);

const push = readFileSync(join(SRC, "lib/webPush.ts"), "utf8");
assert.doesNotMatch(push, /DEFAULT 'default'/);
assert.match(push, /ALTER TABLE push_subscriptions ALTER COLUMN office_id DROP DEFAULT/);

console.log("✅ tenantCohesionBatch16: whatsapp/reminders/hrInternal/webPush no inventing default");
