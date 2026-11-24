/**
 * Money Numeric Batch 2 — static guards for Migration 019.
 * payment_transactions / office_ledger bare NUMERIC → NUMERIC(18,2).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../../..");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const mig019 = read("artifacts/api-server/migrations/019_money_numeric_batch2.sql");
const registry = read("artifacts/api-server/src/lib/dbRegistry.ts");

console.log("\n═══ moneyNumericBatch2 ═══");

assert.match(mig019, /Money Numeric Batch 2/);
assert.match(mig019, /NUMERIC\(18,2\)/);
assert.match(mig019, /::numeric\(18,2\)/);
assert.match(mig019, /more than 2 meaningful decimal places/);
assert.match(mig019, /exceeding NUMERIC\(18,2\) range/);
assert.doesNotMatch(mig019, /EXCEPTION\s+WHEN\s+others/i);
assert.doesNotMatch(mig019, /^\s*WHEN others/im);
assert.doesNotMatch(mig019, /\* 100|\/ 100/);
assert.match(mig019, /expected numeric/);

for (const needle of [
  "payment_transactions",
  "office_ledger",
  "amount",
  "platform_fee",
  "net_amount",
  "stripe_fee",
]) {
  assert.match(mig019, new RegExp(needle));
}

assert.doesNotMatch(mig019, /ARRAY\['client_invoices'/);
assert.doesNotMatch(mig019, /ARRAY\['invoices'/);
assert.doesNotMatch(mig019, /ARRAY\['plans'/);
assert.doesNotMatch(mig019, /cost_points/);

assert.match(registry, /name: "amount", type: "NUMERIC\(18,2\)"/);
assert.match(registry, /name: "platform_fee", type: "NUMERIC\(18,2\)"/);
assert.match(registry, /name: "net_amount", type: "NUMERIC\(18,2\)"/);
assert.match(registry, /name: "stripe_fee", type: "NUMERIC\(18,2\)"/);

/* No Drizzle ORM tables for these — payments use raw SQL */
const billing = read("lib/db/src/schema/billing.ts");
const admin = read("lib/db/src/schema/admin.ts");
assert.doesNotMatch(billing, /payment_transactions|office_ledger/);
assert.doesNotMatch(admin, /payment_transactions|office_ledger/);

console.log("  ✅ Migration 019 + dbRegistry Batch-2 money guards passed\n");
