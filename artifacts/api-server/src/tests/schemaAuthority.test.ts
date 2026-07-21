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
assert.ok(migrationFiles.includes("010_office_ledger_performance_indexes.sql"));
assert.ok(migrationFiles.includes("011_stripe_infrastructure_tables.sql"));
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
assert.doesNotMatch(indexSrc, /ensurePerformanceIndexes/);
assert.doesNotMatch(indexSrc, /ensureStripeBufferTables/);
assert.doesNotMatch(indexSrc, /ensureReconciliationTable/);
assert.doesNotMatch(indexSrc, /CREATE INDEX IF NOT EXISTS idx_cases_office_id/);
assert.doesNotMatch(indexSrc, /idx_office_ledger_stripe_event_id/);
assert.match(indexSrc, /ensureOfficePageSlugs/);
console.log("  ✅ index.ts: boot ALTER/INDEX DDL removed; slug backfill retained");

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

console.log("\n═══ schemaAuthority: Batch 2 office_ledger + performance indexes ═══");

const mig010 = readRepo("artifacts/api-server/migrations/010_office_ledger_performance_indexes.sql");
assert.match(mig010, /CREATE TABLE IF NOT EXISTS office_ledger/);
assert.match(mig010, /stripe_event_id/);
assert.match(mig010, /platform_fee/);
assert.match(mig010, /stripe_fee/);
assert.match(mig010, /net_amount/);
assert.match(mig010, /idx_office_ledger_stripe_event_id/);
assert.match(mig010, /WHERE stripe_event_id IS NOT NULL/);
assert.match(mig010, /idx_cases_office_id/);
assert.match(mig010, /idx_cases_status/);
assert.match(mig010, /idx_cases_office_status/);
assert.match(mig010, /idx_clients_office_id/);
assert.match(mig010, /idx_documents_office_id/);
assert.doesNotMatch(mig010, /CREATE INDEX IF NOT EXISTS idx_tasks_office_due/);
assert.doesNotMatch(mig010, /CREATE INDEX IF NOT EXISTS idx_tasks_status/);
assert.doesNotMatch(mig010, /CREATE INDEX IF NOT EXISTS idx_reminders_office_due/);
assert.match(mig010, /idx_tasks_office_due.*idx_tasks_status.*idx_reminders_office_due/s); // deferred mention only
assert.match(mig010, /idx_audit_logs_office_ts/);
assert.match(mig010, /idx_revenues_office_date/);
assert.match(mig010, /idx_expenses_office_date/);
assert.match(mig010, /idx_invoices_office_id/);
assert.match(mig010, /idx_invoices_status/);
assert.match(mig010, /idx_contracts_office_id/);
assert.match(mig010, /skipping type CHECK/);
assert.match(mig010, /skipping idx_office_ledger_stripe_event_id/);
assert.match(mig010, /duplicate cleanup required/);
console.log("  ✅ migration 010 owns office_ledger + safe indexes; tasks/reminders deferred");

console.log("\n═══ schemaAuthority: Batch 3 Stripe infrastructure ═══");

const mig011 = readRepo("artifacts/api-server/migrations/011_stripe_infrastructure_tables.sql");
assert.match(mig011, /CREATE TABLE IF NOT EXISTS stripe_events/);
assert.match(mig011, /CREATE TABLE IF NOT EXISTS stripe_dead_letters/);
assert.match(mig011, /CREATE TABLE IF NOT EXISTS stripe_reconciliation_log/);
assert.match(mig011, /idx_stripe_events_status/);
assert.match(mig011, /idx_stripe_events_created/);
assert.match(mig011, /idx_stripe_dlq_created/);
assert.match(mig011, /idx_reconciliation_run_at/);
assert.match(mig011, /skipping stripe_events status CHECK/);
assert.match(mig011, /skipping unique stripe_events\.stripe_event_id/);
assert.match(mig011, /skipping stripe_reconciliation_log status CHECK/);

const bufferSrc = readSrc("services/stripeEventBuffer.ts");
assert.doesNotMatch(bufferSrc, /CREATE TABLE/);
assert.doesNotMatch(bufferSrc, /CREATE INDEX/);
assert.doesNotMatch(bufferSrc, /ensureStripeBufferTables/);
assert.match(bufferSrc, /011_stripe_infrastructure_tables/);

const reconcileSrc = readSrc("jobs/stripeReconcile.ts");
assert.doesNotMatch(reconcileSrc, /CREATE TABLE/);
assert.doesNotMatch(reconcileSrc, /CREATE INDEX/);
assert.doesNotMatch(reconcileSrc, /ensureReconciliationTable/);
assert.match(reconcileSrc, /011_stripe_infrastructure_tables/);
console.log("  ✅ migration 011 owns stripe_events / dead_letters / reconciliation_log; Runtime DDL removed");

console.log("\n═══ schemaAuthority: Drizzle is ORM types, not production DDL ═══");

const drizzleCfg = readRepo("lib/db/drizzle.config.ts");
assert.match(drizzleCfg, /schema authority|DDL authority|migrations/i);
assert.match(drizzleCfg, /artifacts\/api-server\/migrations/);
console.log("  ✅ drizzle.config.ts documents migrations as DDL authority");

const libDbPkg = readRepo("lib/db/package.json");
assert.match(libDbPkg, /"push"/);
console.log("  ✅ @workspace/db push remains available for local/dev only");

console.log("\n✅ schemaAuthority: all checks passed\n");
