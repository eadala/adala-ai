/**
 * Launch readiness validators — unit tests
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/launchReadiness.test.ts
 */

import assert from "node:assert/strict";
import {
  clerkProductionReadiness,
  moyasarProductionReadiness,
  paymentProductionReadiness,
  stripeProductionReadiness,
  stripeSystemStatus,
} from "../lib/launchReadiness";

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

console.log("\n═══ launchReadiness: stripeProductionReadiness ═══");

withEnv({
  STRIPE_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: undefined,
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
}, () => {
  const r = stripeProductionReadiness();
  assert.equal(r.ok, false);
  assert.match(r.detail, /TEST/);
  console.log("  ✅ rejects test keys when Stripe enabled");
});

withEnv({
  STRIPE_ENABLED: undefined,
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: undefined,
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
}, () => {
  const r = stripeProductionReadiness();
  assert.equal(r.ok, true);
  assert.match(r.detail, /معطّل/);
  console.log("  ✅ Stripe disabled returns ok without keys");
});

withEnv({
  STRIPE_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_live_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_live_abc",
}, () => {
  const r = stripeProductionReadiness();
  assert.equal(r.ok, true);
  console.log("  ✅ accepts live keys + webhook secret");
});

console.log("\n═══ launchReadiness: clerkProductionReadiness ═══");

withEnv({
  CLERK_SECRET_KEY: "sk_test_abc",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_test_abc",
}, () => {
  const r = clerkProductionReadiness();
  assert.equal(r.ok, false);
  console.log("  ✅ rejects Clerk test keys");
});

withEnv({
  CLERK_SECRET_KEY: "sk_live_abc",
  VITE_CLERK_PUBLISHABLE_KEY: "pk_live_abc",
}, () => {
  const r = clerkProductionReadiness();
  assert.equal(r.ok, true);
  console.log("  ✅ accepts Clerk live keys");
});

console.log("\n═══ launchReadiness: stripeSystemStatus ═══");

withEnv({
  STRIPE_SECRET_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  STRIPE_ENABLED: undefined,
}, () => {
  const r = stripeSystemStatus();
  assert.equal(r.status, "operational");
  assert.match(r.detail, /معطّل/);
  console.log("  ✅ operational when Stripe explicitly disabled");
});

withEnv({
  STRIPE_SECRET_KEY: undefined,
  STRIPE_WEBHOOK_SECRET: undefined,
  STRIPE_ENABLED: "true",
}, () => {
  const r = stripeSystemStatus();
  assert.equal(r.status, "outage");
  console.log("  ✅ outage when Stripe enabled but not configured");
});

console.log("\n═══ launchReadiness: moyasarProductionReadiness ═══");

withEnv({
  MOYASAR_SECRET_KEY: "sk_test",
  MOYASAR_PUBLISHABLE_KEY: "pk_test",
  PRODUCTION_URL: "https://adalahai.com",
}, () => {
  const r = moyasarProductionReadiness();
  assert.equal(r.ok, true);
  console.log("  ✅ accepts Moyasar keys + PRODUCTION_URL");
});

withEnv({
  MOYASAR_SECRET_KEY: undefined,
  MOYASAR_PUBLISHABLE_KEY: undefined,
  PRODUCTION_URL: undefined,
  APP_URL: undefined,
}, () => {
  const r = paymentProductionReadiness();
  assert.equal(r.ok, false);
  assert.match(r.detail, /MOYASAR_SECRET_KEY/);
  console.log("  ✅ paymentProductionReadiness checks Moyasar by default");
});

withEnv({
  STRIPE_ENABLED: "true",
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
}, () => {
  const r = stripeSystemStatus();
  assert.equal(r.status, "degraded");
  console.log("  ✅ degraded for test-mode Stripe");
});

console.log("\n✅ All launchReadiness tests passed\n");
