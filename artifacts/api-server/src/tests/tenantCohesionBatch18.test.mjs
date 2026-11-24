/**
 * Batch18 — fail-closed hr-enterprise + JLWM recommendations
 * Run: node src/tests/tenantCohesionBatch18.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const hr = readFileSync(join(SRC, "modules/operations/hr-enterprise.ts"), "utf8");
assert.match(hr, /function tidOf\(req/);
assert.match(hr, /لا يمكن تحديد المكتب/);
assert.doesNotMatch(hr, /tenantId as string/);
assert.match(hr, /requireAuthWithTenant/);

const rec = readFileSync(join(SRC, "modules/jlwm/recommendations.ts"), "utf8");
assert.match(rec, /function tidOf\(req/);
assert.match(rec, /لا يمكن تحديد المكتب/);
assert.doesNotMatch(rec, /tenantId as string/);
assert.match(rec, /office_id=\$\{officeId\}/);

console.log("✅ tenantCohesionBatch18: hr-enterprise/jlwm recommendations fail-closed");
