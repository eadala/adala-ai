/**
 * Post-migration API fixes — regression tests
 * Run: pnpm --filter @workspace/api-server exec tsx src/tests/postMigrationApiFixes.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

function readSrc(rel: string): string {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

console.log("\n═══ postMigrationApiFixes: route registration ═══");

const officeSrc = readSrc("modules/marketplace/office.ts");
assert.match(officeSrc, /router\.get\("\/office\/my"/);
assert.match(officeSrc, /router\.get\("\/offices\/my",\s*requireAuth,\s*handleGetMyOffice/);
assert.match(officeSrc, /No fallback to "first office"/);
assert.match(officeSrc, /code: "TNT_403"/);
assert.doesNotMatch(officeSrc, /select\(\)\.from\(officePageTable\)\.limit\(1\);\s*\n\s*res\.json/);
console.log("  ✅ office.ts: /offices/my alias + no first-office fallback");

const eventsSrc = readSrc("modules/operations/events.ts");
assert.match(eventsSrc, /router\.get\("\/events",\s*requireAuth/);
assert.match(eventsSrc, /resolveReqTenantId/);
assert.match(eventsSrc, /MAX_EVENTS_LIMIT = 100/);
assert.match(eventsSrc, /intentionally ignored/);
console.log("  ✅ events.ts: GET /events + tenant + max limit 100");

const loginSrc = readSrc("modules/platform/loginTracking.ts");
assert.doesNotMatch(loginSrc, /ensureLoginLogsTable/);
assert.doesNotMatch(loginSrc, /CREATE TABLE/);
assert.match(loginSrc, /SCHEMA_MISSING/);
assert.match(loginSrc, /006_post_migration_api_support/);
console.log("  ✅ loginTracking.ts: no Runtime DDL + clear SCHEMA_MISSING");

const mig006 = readRepo("artifacts/api-server/migrations/006_post_migration_api_support.sql");
assert.match(mig006, /CREATE TABLE IF NOT EXISTS login_logs/);
assert.match(mig006, /website_config JSONB DEFAULT '\{\}'::jsonb/);
assert.match(mig006, /CREATE TABLE IF NOT EXISTS web_vitals/);
assert.match(mig006, /CREATE TABLE IF NOT EXISTS route_analytics/);
assert.match(mig006, /idx_login_logs_office_id/);
console.log("  ✅ migration 006: login_logs + website_config + web_vitals + route_analytics");

const subSrc = readSrc("modules/financial/subscription.ts");
assert.match(subSrc, /db\.select\(\)\.from\(officePageTable\)/);
assert.doesNotMatch(subSrc, /getOfficePlanSlug|selectOfficePageSafe/);
console.log("  ✅ subscription.ts: full Drizzle select (schema fixed by 006)");

const metricsSrc = readSrc("routes/metrics.ts");
assert.doesNotMatch(metricsSrc, /ensureTable|CREATE TABLE/);
assert.match(metricsSrc, /SCHEMA_MISSING/);
assert.match(metricsSrc, /typeof req\.body === "string"/);
console.log("  ✅ metrics.ts: no Runtime DDL + sendBeacon parse + SCHEMA_MISSING");

const routesIndex = readSrc("routes/index.ts");
assert.match(routesIndex, /eventsRouter/);
assert.match(routesIndex, /officeRouter/);
assert.match(routesIndex, /subscriptionRouter/);
assert.match(routesIndex, /loginTrackingRouter/);
assert.match(routesIndex, /metricsRouter/);
console.log("  ✅ routes/index.ts: all modules registered");

console.log("\n═══ postMigrationApiFixes: requestGuard beacon paths ═══");

const guardSrc = readSrc("prevention/request.guard.ts");
assert.match(guardSrc, /isMetricsBeaconPath|isMetricsBeaconRequest/);
assert.match(guardSrc, /metricsBeaconPath/);
assert.match(guardSrc, /!isMetricsBeaconRequest\(req\)/);
console.log("  ✅ requestGuard exempts metrics beacon paths");

const appSrc = readSrc("app.ts");
assert.match(appSrc, /sendBeacon posts JSON without application\/json/);
assert.match(appSrc, /express\.text\(\{ type: "\*\/\*", limit: "8kb" \}/);
assert.match(appSrc, /isMetricsBeaconRequest\(req\)/);
assert.match(appSrc, /clerkBeaconGate/);
console.log("  ✅ app.ts: text parser + Clerk skip + diagnostic gate for sendBeacon vitals");

const beaconLib = readSrc("lib/metricsBeaconPath.ts");
assert.match(beaconLib, /getRequestPathname/);
assert.match(beaconLib, /endsWith/);
console.log("  ✅ metricsBeaconPath: originalUrl-aware suffix matching");

const integSrc = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integSrc, /006_post_migration_api_support\.sql/);
assert.match(integSrc, /scenario_incomplete_schema_no_runtime_ddl/);
console.log("  ✅ integration test includes 006 + incomplete-schema scenario");

const expectedTables = readRepo("scripts/db/expected-tables-p0.txt");
assert.match(expectedTables, /login_logs/);
assert.match(expectedTables, /web_vitals/);
assert.match(expectedTables, /route_analytics/);
const expectedCols = readRepo("scripts/db/expected-columns-p0.txt");
assert.match(expectedCols, /office_page\.website_config/);
assert.match(expectedCols, /web_vitals\.name/);
console.log("  ✅ verify-schema P0 expectations include 006 objects");

console.log("\n✅ postMigrationApiFixes: all checks passed\n");
