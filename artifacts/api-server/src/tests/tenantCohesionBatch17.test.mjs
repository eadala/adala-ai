/**
 * Batch17 — eventBus/analytics defaults; compliance/branches/hrPerformance fail-closed
 * Run: node src/tests/tenantCohesionBatch17.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const bus = readFileSync(join(SRC, "core/eventBus.ts"), "utf8");
assert.doesNotMatch(bus, /DEFAULT 'default'/);
assert.match(bus, /ALTER TABLE system_events ALTER COLUMN office_id DROP DEFAULT/);

const analytics = readFileSync(join(SRC, "core/listeners/analyticsListener.ts"), "utf8");
assert.doesNotMatch(analytics, /DEFAULT 'default'/);
assert.match(analytics, /ALTER TABLE event_daily_counts ALTER COLUMN office_id DROP DEFAULT/);

const compliance = readFileSync(join(SRC, "modules/legal-core/compliance.ts"), "utf8");
assert.match(compliance, /tidOf\(req\)/);
assert.doesNotMatch(compliance, /requireAuth,/);

const branches = readFileSync(join(SRC, "modules/platform/branches.ts"), "utf8");
assert.match(branches, /tidOf\(req\)/);
assert.doesNotMatch(branches, /tenantId as string/);
assert.match(branches, /لا يمكن تحديد المكتب/);

const hr = readFileSync(join(SRC, "modules/operations/hrPerformance.ts"), "utf8");
assert.match(hr, /tidOf\(req\)/);
assert.match(hr, /ADD COLUMN IF NOT EXISTS office_id/);
assert.match(hr, /DELETE FROM performance_evaluations[\s\S]*office_id = \$\{tid\}/);
assert.match(hr, /DELETE FROM employee_incentives[\s\S]*office_id = \$\{tid\}/);
assert.doesNotMatch(hr, /tenantId as string/);

console.log("✅ tenantCohesionBatch17: eventBus/analytics/compliance/branches/hrPerformance scoped");
