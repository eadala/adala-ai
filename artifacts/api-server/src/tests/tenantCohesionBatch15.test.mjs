/**
 * Batch15 — messages/storage/calendar/financial-engine tenant cohesion
 * Run: node src/tests/tenantCohesionBatch15.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const messages = readFileSync(join(SRC, "modules/operations/messages.ts"), "utf8");
assert.match(messages, /requireAuthWithTenant/);
assert.doesNotMatch(messages, /resolveTenantId/);
assert.match(messages, /INSERT INTO messages \(office_id/);
assert.match(messages, /WHERE office_id=\$\{tenantId\}/);
assert.match(messages, /eq\(casesTable\.officeId, tenantId\)/);

const storage = readFileSync(join(SRC, "modules/operations/storage.ts"), "utf8");
assert.match(storage, /requireAuthWithTenant/);
assert.doesNotMatch(storage, /resolveTenantId/);
assert.match(storage, /typeof req\.tenantId === "string" && req\.tenantId/);

const calendar = readFileSync(join(SRC, "modules/operations/calendar.ts"), "utf8");
assert.match(calendar, /requireAuthWithTenant/);
assert.doesNotMatch(calendar, /DEFAULT 'default'/);
assert.match(calendar, /INSERT INTO events[\s\S]*office_id/);
assert.match(calendar, /WHERE office_id = \$\{officeId\}/);
assert.match(calendar, /tenantIdOf\(req\)/);

const engine = readFileSync(join(SRC, "modules/financial/financial-engine.ts"), "utf8");
assert.match(engine, /financial-engine\/test", requireAuthWithTenant/);
assert.doesNotMatch(engine, /test-office/);
assert.match(engine, /\(req as any\)\.tenantId/);

console.log("✅ tenantCohesionBatch15: messages/storage/calendar/financial-engine scoped");
