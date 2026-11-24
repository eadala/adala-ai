/**
 * Unit tests for metrics beacon path matching
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/metricsBeaconPath.test.ts
 */
import assert from "node:assert/strict";
import {
  getRequestPathname,
  isMetricsBeaconPath,
  isMetricsBeaconRequest,
  normalizeBeaconPath,
} from "../lib/metricsBeaconPath";

console.log("\n═══ metricsBeaconPath: normalize ═══");
assert.equal(normalizeBeaconPath("/api/metrics/vitals/"), "/api/metrics/vitals");
assert.equal(normalizeBeaconPath("/api/metrics/vitals?x=1"), "/api/metrics/vitals");
assert.equal(normalizeBeaconPath("//api//metrics//vitals"), "/api/metrics/vitals");
console.log("  ✅ normalizeBeaconPath strips slash/query/dupes");

console.log("\n═══ metricsBeaconPath: exact + suffix ═══");
assert.equal(isMetricsBeaconPath("/api/metrics/vitals"), true);
assert.equal(isMetricsBeaconPath("/api/metrics/vitals/"), true);
assert.equal(isMetricsBeaconPath("/metrics/vitals"), true);
assert.equal(isMetricsBeaconPath("/api/api/metrics/vitals"), true);
assert.equal(isMetricsBeaconPath("/prefix/api/metrics/vitals"), true);
assert.equal(isMetricsBeaconPath("/api/metrics/route-analytics"), true);
assert.equal(isMetricsBeaconPath("/api/metrics/vitals/summary"), false);
assert.equal(isMetricsBeaconPath("/api/offices/my"), false);
console.log("  ✅ endsWith matching covers proxy prefixes; excludes summary");

console.log("\n═══ metricsBeaconPath: request fields ═══");
assert.equal(
  isMetricsBeaconRequest({
    path: "/",
    baseUrl: "/api/metrics/vitals",
    url: "/",
    originalUrl: "/api/metrics/vitals",
  }),
  true,
);
assert.equal(
  getRequestPathname({
    path: "/",
    baseUrl: "/api/metrics/vitals",
    url: "/",
    originalUrl: "/api/metrics/vitals/",
  }),
  "/api/metrics/vitals",
);
assert.equal(
  isMetricsBeaconRequest({
    originalUrl: "/api/metrics/vitals?x=1",
    path: "/something-else",
  }),
  true,
  "originalUrl wins over misleading path",
);
console.log("  ✅ originalUrl preferred; mount-stripped path still matches via originalUrl");

console.log("\n✅ metricsBeaconPath: all checks passed\n");
