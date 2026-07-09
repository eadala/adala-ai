/**
 * Payment gateway abstraction tests
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/payments.test.ts
 */
import assert from "node:assert/strict";
import {
  PaymentService,
  getDefaultPaymentProviderId,
  isStripeProviderEnabled,
} from "../payments/paymentService";
import { MOYASAR_CHECKOUT_METHODS } from "../payments/types";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    prev[key] = process.env[key];
    const val = vars[key];
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(vars)) {
      const val = prev[key];
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  }
}

console.log("\n═══ payments: provider selection ═══");

withEnv({
  PAYMENT_PROVIDER: "moyasar",
  MOYASAR_SECRET_KEY: "sk_test_moyasar",
  MOYASAR_PUBLISHABLE_KEY: "pk_test_moyasar",
  STRIPE_ENABLED: undefined,
  STRIPE_SECRET_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
}, () => {
  assert.equal(getDefaultPaymentProviderId(), "moyasar");
  assert.equal(isStripeProviderEnabled(), false);
  const providers = PaymentService.listProviders();
  const moyasar = providers.find((p) => p.id === "moyasar");
  assert.equal(moyasar?.enabled, true);
  assert.equal(moyasar?.primary, true);
  console.log("  ✅ Moyasar is primary when configured");
});

withEnv({
  PAYMENT_PROVIDER: "moyasar",
  MOYASAR_SECRET_KEY: undefined,
  MOYASAR_PUBLISHABLE_KEY: undefined,
  STRIPE_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
}, () => {
  assert.equal(isStripeProviderEnabled(), true);
  assert.equal(getDefaultPaymentProviderId(), "stripe");
  console.log("  ✅ falls back to Stripe when Moyasar keys missing");
});

withEnv({
  PAYMENT_PROVIDER: "moyasar",
  MOYASAR_SECRET_KEY: undefined,
  MOYASAR_PUBLISHABLE_KEY: undefined,
  STRIPE_ENABLED: undefined,
}, () => {
  assert.equal(isStripeProviderEnabled(), false);
  assert.throws(
    () => PaymentService.resolveProvider("moyasar"),
    /غير مفعّلة/
  );
  console.log("  ✅ disabled providers throw clear errors");
});

console.log("\n═══ payments: Moyasar checkout methods ═══");
assert.deepEqual(MOYASAR_CHECKOUT_METHODS, [
  "creditcard",
  "applepay",
  "stcpay",
  "mada",
]);
console.log("  ✅ supports Mada, Apple Pay, Visa/Mastercard, STC Pay");

console.log("\n✅ All payment gateway tests passed\n");
