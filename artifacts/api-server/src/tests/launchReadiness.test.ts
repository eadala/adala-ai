/**
 * Launch readiness validators — unit tests
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/launchReadiness.test.ts
 */

import assert from "node:assert/strict";
import {
  clerkProductionReadiness,
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
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: undefined,
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
}, () => {
  const r = stripeProductionReadiness();
  assert.equal(r.ok, false);
  assert.match(r.detail, /TEST/);
  console.log("  ✅ rejects test keys");
});

withEnv({
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
  REPLIT_CONNECTORS_HOSTNAME: undefined,
  REPL_IDENTITY: undefined,
  WEB_REPL_RENEWAL: undefined,
}, () => {
  const r = stripeSystemStatus();
  assert.equal(r.status, "outage");
  console.log("  ✅ outage when Stripe not configured");
});

withEnv({
  STRIPE_SECRET_KEY: "sk_test_abc",
  STRIPE_WEBHOOK_SECRET: "whsec_abc",
  VITE_STRIPE_PUBLISHABLE_KEY: "pk_test_abc",
  REPLIT_CONNECTORS_HOSTNAME: undefined,
}, () => {
  const r = stripeSystemStatus();
  assert.equal(r.status, "degraded");
  console.log("  ✅ degraded for test-mode Stripe");
});

console.log("\n✅ All launchReadiness tests passed\n");
