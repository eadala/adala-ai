/**
 * Batch13 — marketplace office_id, billing tenant middleware, feature-gate per office
 * Run: node src/tests/tenantCohesionBatch13.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(SRC, "..", "..", "..");

const market = readFileSync(join(SRC, "modules/marketplace/marketplace.ts"), "utf8");
assert.match(market, /requireAuthWithTenant/);
assert.match(market, /INSERT INTO marketplace_services[\s\S]*office_id/);
assert.match(market, /WHERE office_id = \$\{tid\} AND user_id/);
assert.doesNotMatch(market, /resolveTenantId/);

const billing = readFileSync(join(SRC, "modules/financial/billing.ts"), "utf8");
assert.match(billing, /requireAuthWithTenant/);
assert.doesNotMatch(billing, /resolveTenantId/);
assert.match(billing, /billing\/mark-overdue", requireAuthWithTenant, requireSuperAdmin/);

const gate = readFileSync(join(SRC, "middleware/feature-gate.ts"), "utf8");
assert.match(gate, /getOfficeFeatureFlags\(officeId: string\)/);
assert.match(gate, /eq\(officePageTable\.id/);
assert.doesNotMatch(gate, /from\(officePageTable\)\.limit\(1\)/);

const contracts = readFileSync(join(SRC, "modules/legal-core/contracts.ts"), "utf8");
assert.match(contracts, /contract-templates", requireAuthWithTenant/);
assert.match(contracts, /contract-categories", requireAuthWithTenant/);

console.log("✅ tenantCohesionBatch13: marketplace/billing/feature-gate/contracts scoped");
