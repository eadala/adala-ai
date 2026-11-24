/**
 * Payment error-swallowing Batch 1 — payments.ts must fail closed.
 * Run: pnpm --filter @workspace/api-server run test:payments-error-swallowing
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { paymentDbRows, logPaymentSideEffectFailure } from "../lib/paymentDb";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const paymentsTs = readFileSync(join(SRC, "modules/financial/payments.ts"), "utf8");
const paymentDbTs = readFileSync(join(SRC, "lib/paymentDb.ts"), "utf8");

console.log("\n═══ paymentDbRows: DB failure is logged and rethrown (not []) ═══");

{
  const calls: unknown[] = [];
  const fail = Object.assign(new Error("relation payment_transactions does not exist"), { code: "42P01" });
  await assert.rejects(
    () =>
      paymentDbRows(async () => {
        throw fail;
      }, { text: "SELECT 1" }),
    (err: unknown) => {
      calls.push(err);
      assert.equal(err, fail);
      return true;
    },
  );
  assert.equal(calls.length, 1, "must rethrow the original DB error");
  console.log("  ✅ paymentDbRows rethrows DB errors (no empty-array false success)");
}

console.log("\n═══ paymentDbRows: successful rows pass through ═══");

{
  const rows = await paymentDbRows(async () => [{ id: "tx-1", status: "completed" }], {});
  assert.deepEqual(rows, [{ id: "tx-1", status: "completed" }]);
  const nested = await paymentDbRows(async () => ({ rows: [{ id: "tx-2" }] }), {});
  assert.deepEqual(nested, [{ id: "tx-2" }]);
  console.log("  ✅ paymentDbRows returns array / .rows payloads");
}

console.log("\n═══ logPaymentSideEffectFailure is callable (does not throw) ═══");

{
  assert.equal(typeof logPaymentSideEffectFailure, "function");
  logPaymentSideEffectFailure("test side-effect", new Error("bus down"), { officeId: "off-1" });
  console.log("  ✅ side-effect failures are logged without inventing success");
}

console.log("\n═══ payments.ts wiring: no silent swallow patterns on payment writes ═══");

assert.match(
  paymentsTs,
  /paymentDbRows/,
  "payments.ts must use paymentDbRows for DB reads/writes via rows()",
);
assert.doesNotMatch(
  paymentsTs,
  /catch\s*\{\s*return\s*\[\];\s*\}/,
  "payments.ts must not catch-and-return [] (false success)",
);
assert.doesNotMatch(
  paymentsTs,
  /\.catch\(\(\)\s*=>\s*\{\s*\}\)/,
  "payments.ts must not use empty .catch(() => {}) on payment paths",
);
assert.doesNotMatch(
  paymentsTs,
  /\.catch\(\(\)\s*=>\s*\(\{\}\)\)/,
  "payments.ts must not swallow Checkout.com fetch failures into {}",
);
assert.match(
  paymentsTs,
  /logPaymentSideEffectFailure\(\s*"PAYMENT_SUCCESS event emit failed"/,
  "PAYMENT_SUCCESS emit failures must be logged",
);
assert.match(
  paymentsTs,
  /Checkout\.com payment-links failed/,
  "Checkout.com API failures must throw an explicit error",
);
assert.match(
  paymentsTs,
  /logEndpointError\(\s*"POST \/api\/webhook\/checkout"/,
  "checkout webhook DB failures must be logged via logEndpointError",
);
assert.match(
  paymentsTs,
  /logEndpointError\(\s*"GET \/api\/payments\/moyasar\/success"/,
  "moyasar success redirect DB failures must be logged (not swallowed)",
);
assert.match(
  paymentDbTs,
  /logger\.error/,
  "paymentDbRows must log before rethrowing",
);

console.log("  ✅ payments.ts no longer silently swallows payment DB / gateway failures");

console.log("\n✅ paymentsErrorSwallowing: all checks passed\n");
