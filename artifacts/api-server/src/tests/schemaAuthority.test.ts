/**
 * Schema Authority — migrations are the sole DDL source for covered tables.
 * Run: pnpm --filter @workspace/api-server run test:schema-authority
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SRC = join(HERE, "..");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

console.log("\n═══ schemaAuthority: migration files present ═══");

const migrationsDir = join(ROOT, "artifacts/api-server/migrations");
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
assert.ok(migrationFiles.includes("003_drizzle_baseline_safe.sql"));
assert.ok(migrationFiles.includes("004_legal_core_extensions.sql"));
assert.ok(migrationFiles.includes("005_tenant_platform_tables.sql"));
assert.ok(migrationFiles.includes("006_post_migration_api_support.sql"));
assert.ok(migrationFiles.includes("009_storage_folders.sql"));
console.log(`  ✅ ${migrationFiles.length} SQL migrations under artifacts/api-server/migrations/`);

const mig004 = readRepo("artifacts/api-server/migrations/004_legal_core_extensions.sql");
assert.match(mig004, /CREATE TABLE IF NOT EXISTS contract_templates/);
assert.match(mig004, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS source/);
assert.match(mig004, /ALTER TABLE office_orders ADD COLUMN IF NOT EXISTS portal_token/);
console.log("  ✅ migration 004 owns contract_* + cases/office_orders columns");

const mig005 = readRepo("artifacts/api-server/migrations/005_tenant_platform_tables.sql");
assert.match(mig005, /CREATE TABLE IF NOT EXISTS trial_offices/);
assert.match(mig005, /CREATE TABLE IF NOT EXISTS onboarding_state/);
assert.match(mig005, /CREATE TABLE IF NOT EXISTS system_events/);
assert.match(mig005, /CREATE TABLE IF NOT EXISTS plan_cms/);
console.log("  ✅ migration 005 owns trial_offices / onboarding_state / system_events / plan_cms");

console.log("\n═══ schemaAuthority: no Runtime DDL for migration-covered tables ═══");

const indexSrc = readSrc("index.ts");
assert.doesNotMatch(indexSrc, /ALTER TABLE cases ADD COLUMN/);
assert.doesNotMatch(indexSrc, /ALTER TABLE office_orders ADD COLUMN/);
assert.doesNotMatch(indexSrc, /ensureAdHocColumns/);
assert.match(indexSrc, /ensureOfficePageSlugs/);
console.log("  ✅ index.ts: boot ALTER DDL removed; slug backfill retained");

const contractsSrc = readSrc("modules/legal-core/contracts.ts");
assert.doesNotMatch(contractsSrc, /CREATE TABLE/);
assert.doesNotMatch(contractsSrc, /ensureTables\s*\(/);
assert.match(contractsSrc, /004_legal_core_extensions/);
console.log("  ✅ contracts.ts: no Runtime DDL");

const eventBusSrc = readSrc("core/eventBus.ts");
assert.doesNotMatch(eventBusSrc, /CREATE TABLE/);
assert.doesNotMatch(eventBusSrc, /ensureEventsTable/);
assert.match(eventBusSrc, /005_tenant_platform_tables/);
console.log("  ✅ eventBus.ts: no Runtime DDL");

const planCmsSrc = readSrc("modules/platform/planCms.ts");
assert.doesNotMatch(planCmsSrc, /CREATE TABLE/);
assert.doesNotMatch(planCmsSrc, /ALTER TABLE plan_cms/);
assert.match(planCmsSrc, /ensurePlanSeed/);
assert.match(planCmsSrc, /005_tenant_platform_tables/);
console.log("  ✅ planCms.ts: seed only, no Runtime DDL");

const trialSrc = readSrc("modules/platform/trialOnboarding.ts");
assert.doesNotMatch(trialSrc, /CREATE TABLE/);
assert.doesNotMatch(trialSrc, /ensureTables/);
console.log("  ✅ trialOnboarding.ts: no Runtime DDL");

const onboardingSrc = readSrc("modules/platform/onboarding.ts");
assert.doesNotMatch(onboardingSrc, /CREATE TABLE/);
assert.doesNotMatch(onboardingSrc, /ensureTable\s*\(/);
console.log("  ✅ onboarding.ts: no Runtime DDL");

console.log("\n═══ schemaAuthority: Drizzle is ORM types, not production DDL ═══");

const drizzleCfg = readRepo("lib/db/drizzle.config.ts");
assert.match(drizzleCfg, /schema authority|DDL authority|migrations/i);
assert.match(drizzleCfg, /artifacts\/api-server\/migrations/);
console.log("  ✅ drizzle.config.ts documents migrations as DDL authority");

const libDbPkg = readRepo("lib/db/package.json");
assert.match(libDbPkg, /"push"/);
console.log("  ✅ @workspace/db push remains available for local/dev only");

console.log("\n✅ schemaAuthority: all checks passed\n");
