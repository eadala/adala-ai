/**
 * Post-migration API fixes — regression tests
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/postMigrationApiFixes.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

console.log("\n═══ postMigrationApiFixes: route registration ═══");

const officeSrc = readSrc("modules/marketplace/office.ts");
assert.match(officeSrc, /router\.get\("\/office\/my"/);
assert.match(officeSrc, /router\.get\("\/offices\/my",\s*requireAuth,\s*handleGetMyOffice/);
assert.match(officeSrc, /handleGetMyOffice[\s\S]*?selectOfficePageSafe/);
console.log("  ✅ office.ts: /offices/my alias + safe select");

const eventsSrc = readSrc("modules/operations/events.ts");
assert.match(eventsSrc, /router\.get\("\/events",\s*requireAuth/);
assert.match(eventsSrc, /resolveReqTenantId/);
console.log("  ✅ events.ts: GET /events + tenant resolution");

const loginSrc = readSrc("modules/platform/loginTracking.ts");
assert.match(loginSrc, /ensureLoginLogsTable/);
assert.match(loginSrc, /CREATE TABLE IF NOT EXISTS login_logs/);
console.log("  ✅ loginTracking.ts: login_logs DDL guard");

const subSrc = readSrc("modules/financial/subscription.ts");
assert.match(subSrc, /getOfficePlanSlug/);
assert.doesNotMatch(subSrc, /officePageTable/);
console.log("  ✅ subscription.ts: plan via SQL (no officePageTable)");

const metricsSrc = readSrc("routes/metrics.ts");
assert.match(metricsSrc, /await ensureTable\(\)/);
console.log("  ✅ metrics.ts: await ensureTable in handlers");

const routesIndex = readSrc("routes/index.ts");
assert.match(routesIndex, /eventsRouter/);
assert.match(routesIndex, /officeRouter/);
assert.match(routesIndex, /subscriptionRouter/);
assert.match(routesIndex, /loginTrackingRouter/);
assert.match(routesIndex, /metricsRouter/);
console.log("  ✅ routes/index.ts: all modules registered");

console.log("\n═══ postMigrationApiFixes: requestGuard beacon paths ═══");

const guardSrc = readSrc("prevention/request.guard.ts");
assert.match(guardSrc, /isMetricsBeaconPath/);
assert.match(guardSrc, /\/metrics\/vitals/);
assert.match(guardSrc, /!isMetricsBeaconPath\(req\.path\)/);
console.log("  ✅ requestGuard exempts metrics beacon paths");

const appSrc = readSrc("app.ts");
assert.match(appSrc, /\/api\/metrics\/vitals.*express\.text/);
console.log("  ✅ app.ts: text parser for sendBeacon vitals");

console.log("\n✅ postMigrationApiFixes: all checks passed\n");
