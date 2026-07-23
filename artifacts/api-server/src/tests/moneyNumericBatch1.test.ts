/**
 * Money Numeric Batch 1 — static guards for Migration 018 + Drizzle alignment.
 * Ensures in-scope monetary columns cannot silently return to REAL.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const mig018 = read("artifacts/api-server/migrations/018_money_numeric_batch1.sql");
const billing = read("lib/db/src/schema/billing.ts");
const admin = read("lib/db/src/schema/admin.ts");

console.log("\n═══ moneyNumericBatch1 ═══");

assert.match(mig018, /018_money_numeric_batch1|Money Numeric Batch 1/);
assert.match(mig018, /NUMERIC\(18,2\)/);
assert.match(mig018, /::numeric\(18,2\)/);
assert.doesNotMatch(mig018, /WHEN others/i);
assert.doesNotMatch(mig018, /\* 100|\/ 100/);

for (const needle of [
  "invoices",
  "subscriptions",
  "usage_logs",
  "plans",
  "discount_codes",
  "ai_api_keys",
  "amount",
  "plan_price",
  "cost",
  "monthly_price",
  "yearly_price",
  "value",
  "total_cost",
]) {
  assert.match(mig018, new RegExp(needle));
}

assert.doesNotMatch(billing, /\breal\s*\(/);
assert.doesNotMatch(admin, /\breal\s*\(/);
assert.match(billing, /precision:\s*18,\s*scale:\s*2/);
assert.match(admin, /precision:\s*18,\s*scale:\s*2/);

assert.doesNotMatch(mig018, /ARRAY\['client_invoices'/);
assert.doesNotMatch(mig018, /ARRAY\['payment_transactions'/);
assert.doesNotMatch(mig018, /ARRAY\['office_ledger'/);
assert.doesNotMatch(mig018, /cost_points/);

const adminRuntime = read("artifacts/api-server/src/modules/platform/admin.ts");
assert.match(adminRuntime, /function moneyNum/);
/* PATCH /admin/ai-keys/:id must coerce totalCost to a JSON number (same as GET/POST). */
assert.match(
  adminRuntime,
  /router\.patch\("\/admin\/ai-keys\/:id"[\s\S]*?totalCost:\s*moneyNum\(updated\[0\]\.totalCost\)/,
);
assert.doesNotMatch(
  adminRuntime,
  /router\.patch\("\/admin\/ai-keys\/:id"[\s\S]*?res\.json\(updated\[0\]\);/,
);

console.log("  ✅ Migration 018 + Drizzle Batch-1 money guards passed");
console.log("  ✅ PATCH /admin/ai-keys/:id serializes totalCost via moneyNum\n");
