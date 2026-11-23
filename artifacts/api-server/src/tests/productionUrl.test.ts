/**
 * Production URL helper tests
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/productionUrl.test.ts
 */
import assert from "node:assert/strict";
import {
  getProductionBaseUrl,
  requireProductionBaseUrl,
} from "../lib/productionUrl";

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

console.log("\n═══ productionUrl ═══");

withEnv({ PRODUCTION_URL: undefined, APP_URL: undefined }, () => {
  assert.equal(getProductionBaseUrl(), null);
  assert.throws(() => requireProductionBaseUrl(), /PRODUCTION_URL/);
  console.log("  ✅ fails closed when unset");
});

withEnv({ PRODUCTION_URL: "https://adalahai.com/", APP_URL: undefined }, () => {
  assert.equal(getProductionBaseUrl(), "https://adalahai.com");
  console.log("  ✅ normalizes trailing slash");
});

withEnv({ PRODUCTION_URL: undefined, APP_URL: "adalahai.com" }, () => {
  assert.equal(requireProductionBaseUrl(), "https://adalahai.com");
  console.log("  ✅ APP_URL fallback with https prefix");
});

withEnv({ PRODUCTION_URL: "https://primary.example", APP_URL: "https://fallback.example" }, () => {
  assert.equal(getProductionBaseUrl(), "https://primary.example");
  console.log("  ✅ PRODUCTION_URL takes precedence over APP_URL");
});

console.log("\n✅ All productionUrl tests passed\n");
