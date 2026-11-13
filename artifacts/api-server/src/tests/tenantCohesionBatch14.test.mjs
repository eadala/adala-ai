/**
 * Batch14 — RBAC invitations/audit/members tenant scope; tasks/cases NULL-OR closed; AI assistant logs
 * Run: node src/tests/tenantCohesionBatch14.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const rbac = readFileSync(join(SRC, "modules/platform/rbac.ts"), "utf8");
assert.match(rbac, /requireAuthWithTenant/);
assert.doesNotMatch(rbac, /resolveTenantId/);
assert.match(rbac, /WHERE office_id = \$\{officeId\}/);
assert.match(rbac, /INSERT INTO invitations[\s\S]*office_id/);
assert.match(rbac, /INSERT INTO audit_logs[\s\S]*office_id/);
assert.match(rbac, /FROM audit_logs[\s\S]*WHERE office_id = \$\{officeId\}/);
assert.match(rbac, /tenantIdOf\(req\)/);

const opsTasks = readFileSync(join(SRC, "modules/operations/tasks.ts"), "utf8");
assert.match(opsTasks, /requireAuthWithTenant/);
assert.match(opsTasks, /WHERE office_id = \$\{officeId\}::uuid/);
assert.doesNotMatch(opsTasks, /office_id IS NULL/);
assert.doesNotMatch(opsTasks, /OR office_id/);

const caseTasks = readFileSync(join(SRC, "case/modules/tasks.ts"), "utf8");
assert.match(caseTasks, /office_id::text = \$\{this\.tenantId\}/);
assert.doesNotMatch(caseTasks, /office_id IS NULL/);

const cases = readFileSync(join(SRC, "modules/legal-core/cases.ts"), "utf8");
assert.doesNotMatch(cases, /OR office_id IS NULL/);
assert.match(cases, /FROM tasks[\s\S]*office_id::text = \$\{tenantId\}/);

const ai = readFileSync(join(SRC, "modules/ai/ai-assistant.ts"), "utf8");
assert.match(ai, /requireAuthWithTenant/);
assert.doesNotMatch(ai, /resolveTenantId/);
assert.match(ai, /INSERT INTO ai_assistant_logs \(office_id/);
assert.match(ai, /WHERE user_id = \$\{userId\} AND office_id = \$\{tenantId\}/);

console.log("✅ tenantCohesionBatch14: rbac/tasks/cases/ai-assistant scoped");
