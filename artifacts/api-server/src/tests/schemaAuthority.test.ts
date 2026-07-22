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
assert.ok(migrationFiles.includes("012_payment_transactions.sql"));
assert.ok(migrationFiles.includes("013_erp_schema.sql"));
assert.ok(migrationFiles.includes("014_bankruptcy_schema.sql"));
assert.ok(migrationFiles.includes("015_tasks_branches_schema.sql"));
assert.ok(migrationFiles.includes("016_office_messages_fts.sql"));
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

console.log("\n═══ schemaAuthority: Batch 4 payment_transactions ═══");

assert.ok(migrationFiles.includes("012_payment_transactions.sql"));
const mig012 = readRepo("artifacts/api-server/migrations/012_payment_transactions.sql");
assert.match(mig012, /CREATE TABLE IF NOT EXISTS payment_transactions/);
assert.match(mig012, /settlement_status/);
assert.match(mig012, /settled_at/);
assert.match(mig012, /settlement_ref/);
assert.match(mig012, /gateway_payment_id/);
assert.match(mig012, /payment_link/);
assert.match(mig012, /idx_payment_transactions_office_id/);
assert.match(mig012, /skipping settlement_status CHECK/);
assert.match(mig012, /skipping unique stripe_event_id/);

const paymentsSrc = readSrc("modules/financial/payments.ts");
assert.doesNotMatch(paymentsSrc, /ensurePaymentCols/);
assert.doesNotMatch(paymentsSrc, /ALTER TABLE payment_transactions/);
assert.doesNotMatch(paymentsSrc, /ADD COLUMN IF NOT EXISTS settlement_status/);
assert.match(paymentsSrc, /012_payment_transactions/);
assert.match(paymentsSrc, /ensureGatewaySettingsTables/);
assert.match(paymentsSrc, /CREATE TABLE IF NOT EXISTS moyasar_settings/);
assert.match(paymentsSrc, /CREATE TABLE IF NOT EXISTS checkout_settings/);
console.log("  ✅ migration 012 owns payment_transactions; ensurePaymentCols removed");

console.log("\n═══ schemaAuthority: Batch ERP (013) ═══");

assert.ok(migrationFiles.includes("013_erp_schema.sql"));
const mig013 = readRepo("artifacts/api-server/migrations/013_erp_schema.sql");
assert.match(mig013, /CREATE TABLE IF NOT EXISTS office_erp_ledger/);
assert.match(mig013, /CREATE TABLE IF NOT EXISTS financial_anomalies/);
assert.match(mig013, /CREATE TABLE IF NOT EXISTS chart_of_accounts/);
assert.match(mig013, /CREATE TABLE IF NOT EXISTS journal_entries/);
assert.match(mig013, /CREATE TABLE IF NOT EXISTS journal_items/);
assert.match(mig013, /idx_erp_office/);
assert.match(mig013, /idx_je_office/);
assert.match(mig013, /idx_ji_entry/);
assert.match(mig013, /skipping office_erp_ledger entry_type CHECK/);
assert.match(mig013, /skipping chart_of_accounts UNIQUE/);
assert.match(mig013, /skipping journal_items FK/);
assert.match(mig013, /incompatible types journal_items\.entry_id/);
assert.match(mig013, /datatype_mismatch/);
assert.match(mig013, /foreign_key_violation/);
assert.match(mig013, /zta_erp_ledger/);

const erpSrc = readSrc("modules/financial/erp-ledger.ts");
assert.doesNotMatch(erpSrc, /ensureERPTables/);
assert.doesNotMatch(erpSrc, /CREATE TABLE/);
assert.doesNotMatch(erpSrc, /CREATE INDEX/);
assert.doesNotMatch(erpSrc, /ENABLE ROW LEVEL SECURITY/);
assert.match(erpSrc, /013_erp_schema/);

const journalSrc = readSrc("modules/financial/journalAccounting.ts");
assert.doesNotMatch(journalSrc, /CREATE TABLE/);
assert.doesNotMatch(journalSrc, /CREATE INDEX/);
assert.doesNotMatch(journalSrc, /ON CONFLICT\s*\(\s*office_id\s*,\s*account_code\s*\)/);
assert.match(journalSrc, /WHERE NOT EXISTS/);
assert.match(journalSrc, /upsertChartAccount/);
assert.match(journalSrc, /ensureJournalTables/);
assert.match(journalSrc, /013_erp_schema/);
assert.match(journalSrc, /Seed Chart of Accounts/);
assert.match(journalSrc, /\[ERP\] CoA seed/);
assert.doesNotMatch(journalSrc, /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/);

assert.doesNotMatch(indexSrc, /ensureERPTables/);
console.log("  ✅ migration 013 owns ERP tables; Runtime DDL removed; CoA seed/upsert conflict-free");

console.log("\n═══ schemaAuthority: Batch Bankruptcy (014) ═══");

assert.ok(migrationFiles.includes("014_bankruptcy_schema.sql"));
const mig014 = readRepo("artifacts/api-server/migrations/014_bankruptcy_schema.sql");
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bankruptcy_cases/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_creditors/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_claims/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_claim_documents/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_assets/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_asset_valuations/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_meetings/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_distributions/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_distribution_items/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_reports/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_ai_analysis/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_timeline/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_audit_logs/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_notifications/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_workflows/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_workflow_steps/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_workflow_events/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_tasks/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_task_comments/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_task_assignments/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_templates/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_alerts/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_opening_requests/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_opening_request_documents/);
assert.match(mig014, /CREATE TABLE IF NOT EXISTS bk_emergency_locks/);
assert.match(mig014, /bankruptcy_cases_office_id_case_number_key/);
assert.match(mig014, /idx_bk_cases_office_status/);
assert.match(mig014, /idx_bk_tasks_due/);
assert.match(mig014, /idx_bk_alerts_active/);
assert.match(mig014, /idx_bk_or_office/);
assert.match(mig014, /idx_bk_emg_office/);
assert.match(mig014, /is_demo/);
assert.match(mig014, /deleted_at/);
assert.match(mig014, /category/);
assert.match(mig014, /metadata/);
assert.match(mig014, /token_count/);
assert.match(mig014, /014_bk: skipping % CHECK/);
assert.match(mig014, /014_bk: skipping % UNIQUE/);
assert.match(mig014, /014_bk: skipping % FK to %/);
assert.match(mig014, /bankruptcy_cases status/);
assert.match(mig014, /foreign_key_violation/);
assert.match(mig014, /datatype_mismatch/);

const bankruptcySrc = readSrc("modules/bankruptcy/bankruptcy.ts");
const bankruptcyV2Src = readSrc("modules/bankruptcy/bankruptcyV2.ts");
const bankruptcyV3Src = readSrc("modules/bankruptcy/bankruptcyV3.ts");
const bankruptcyDemoSrc = readSrc("modules/bankruptcy/bankruptcyDemo.ts");
const adminSrc = readSrc("modules/platform/admin.ts");

for (const src of [bankruptcySrc, bankruptcyV2Src, bankruptcyV3Src]) {
  assert.doesNotMatch(src, /CREATE TABLE/);
  assert.doesNotMatch(src, /CREATE INDEX/);
  assert.match(src, /014_bankruptcy_schema/);
}
assert.match(bankruptcySrc, /ensureBankruptcyTables/);
assert.doesNotMatch(bankruptcySrc, /CREATE TABLE IF NOT EXISTS bankruptcy_cases/);
assert.doesNotMatch(bankruptcyV2Src, /ALTER TABLE bk_reports ADD COLUMN/);
assert.doesNotMatch(bankruptcyV3Src, /CREATE TABLE IF NOT EXISTS bk_opening_requests/);

assert.doesNotMatch(indexSrc, /ensureBankruptcyTables\(\)/);
assert.doesNotMatch(indexSrc, /ensureBankruptcyV2Tables\(\)/);
assert.doesNotMatch(indexSrc, /ensureBankruptcyV3Tables\(\)/);
assert.match(indexSrc, /bankruptcy_\* → migration 014/);

assert.doesNotMatch(bankruptcyDemoSrc, /ALTER TABLE .*is_demo/);
assert.match(bankruptcyDemoSrc, /014_bankruptcy_schema/);
assert.doesNotMatch(adminSrc, /CREATE TABLE IF NOT EXISTS bk_emergency_locks/);
assert.doesNotMatch(adminSrc, /ensureEocTables/);
assert.match(adminSrc, /014_bankruptcy_schema/);
console.log("  ✅ migration 014 owns Bankruptcy tables; Runtime DDL removed from boot/demo/EOC");

console.log("\n═══ schemaAuthority: Batch Tasks/Branches (015) ═══");

const mig015 = readRepo("artifacts/api-server/migrations/015_tasks_branches_schema.sql");
assert.match(mig015, /CREATE TABLE IF NOT EXISTS office_branches/);
assert.match(mig015, /CREATE TABLE IF NOT EXISTS tasks/);
assert.match(mig015, /office_id\s+TEXT/);
assert.match(mig015, /case_id\s+TEXT/);
assert.match(mig015, /branch_id\s+UUID/);
assert.match(mig015, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS branch_id UUID/);
assert.match(mig015, /ALTER TABLE clients ADD COLUMN IF NOT EXISTS branch_id UUID/);
assert.match(mig015, /ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS branch_id UUID/);
assert.match(mig015, /ALTER TABLE tasks ADD COLUMN IF NOT EXISTS branch_id UUID/);
assert.doesNotMatch(mig015, /ALTER TABLE tasks ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES/);
assert.match(mig015, /idx_office_branches_office/);
assert.match(mig015, /idx_office_branches_status/);
assert.match(mig015, /idx_tasks_office_due/);
assert.match(mig015, /idx_tasks_status/);
assert.match(mig015, /idx_tasks_case_id/);
assert.match(mig015, /idx_tasks_office_case/);
assert.match(mig015, /idx_cases_branch/);
assert.match(mig015, /idx_clients_branch/);
assert.match(mig015, /pg_temp\.add_015_tb_fk/);
assert.match(mig015, /015_tb: skipping % FK to %/);
assert.match(mig015, /orphan row\(s\)/);
assert.match(mig015, /incompatible types/);
assert.match(mig015, /foreign_key_violation/);
assert.match(mig015, /datatype_mismatch/);

const branchesSrc = readSrc("modules/platform/branches.ts");
assert.doesNotMatch(branchesSrc, /ALTER TABLE tasks/);
assert.doesNotMatch(branchesSrc, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS branch_id/);
assert.doesNotMatch(branchesSrc, /CREATE TABLE IF NOT EXISTS office_branches/);
assert.doesNotMatch(branchesSrc, /ensureTables\(\)\.catch/);
assert.match(branchesSrc, /015_tasks_branches_schema/);

const casesSrc = readSrc("modules/legal-core/cases.ts");
assert.doesNotMatch(casesSrc, /CREATE INDEX IF NOT EXISTS idx_tasks_case_id/);
assert.doesNotMatch(casesSrc, /CREATE INDEX IF NOT EXISTS idx_tasks_office_case/);
assert.match(casesSrc, /task indexes live in migration 015/);
console.log("  ✅ migration 015 owns tasks/branches; Runtime DDL/indexes removed");

console.log("\n═══ schemaAuthority: Batch FTS (016) ═══");

const mig016 = readRepo("artifacts/api-server/migrations/016_office_messages_fts.sql");
assert.match(mig016, /CREATE TABLE IF NOT EXISTS office_messages/);
assert.match(mig016, /subject\s+TEXT/);
assert.match(mig016, /body\s+TEXT/);
assert.match(mig016, /search_vector tsvector GENERATED ALWAYS AS/);
assert.match(mig016, /to_tsvector\(%L/);
assert.match(mig016, /EXISTS \(SELECT 1 FROM pg_ts_config WHERE cfgname = 'arabic'\)/);
assert.match(mig016, /ELSE 'simple'/);
assert.match(mig016, /CREATE INDEX IF NOT EXISTS idx_messages_search/);
assert.match(mig016, /ON office_messages USING gin\(search_vector\)/);
assert.match(mig016, /016_fts: skipping search_vector — office_messages missing/);
assert.match(mig016, /016_fts: skipping search_vector — subject or body missing/);
assert.match(mig016, /016_fts: skipping search_vector — incompatible existing type/);
assert.match(mig016, /016_fts: skipping search_vector — existing tsvector is not a compatible generated expression/);
assert.match(mig016, /016_fts: skipping idx_messages_search — search_vector missing/);
assert.match(mig016, /016_fts: skipping idx_messages_search — search_vector expression unverifiable/);
assert.match(mig016, /pg_get_expr\(ad\.adbin, ad\.adrelid\)/);
assert.match(mig016, /regexp_match\(gen_expr,/);

const internalMessagesSrc = readSrc("modules/operations/internal-messages.ts");
assert.doesNotMatch(internalMessagesSrc, /ensureFullTextSearch/);
assert.doesNotMatch(internalMessagesSrc, /ADD COLUMN IF NOT EXISTS search_vector/);
assert.doesNotMatch(internalMessagesSrc, /CREATE INDEX IF NOT EXISTS idx_messages_search/);
assert.doesNotMatch(internalMessagesSrc, /plainto_tsquery\('arabic'/);
assert.doesNotMatch(internalMessagesSrc, /pg_ts_config/);
assert.match(internalMessagesSrc, /016_office_messages_fts/);
assert.match(internalMessagesSrc, /getMessageFtsConfig/);
assert.match(internalMessagesSrc, /from "\.\/messageFtsConfig"/);
assert.match(internalMessagesSrc, /plainto_tsquery\(\$\{ftsConfig\}::regconfig/);

const messageFtsConfigSrc = readSrc("modules/operations/messageFtsConfig.ts");
const messageFtsLogicSrc = readSrc("modules/operations/messageFtsConfigLogic.ts");
assert.match(messageFtsConfigSrc, /pg_attribute/);
assert.match(messageFtsConfigSrc, /pg_attrdef/);
assert.match(messageFtsConfigSrc, /pg_get_expr/);
assert.match(messageFtsLogicSrc, /parseFtsConfigFromGeneratedExpr/);
assert.match(messageFtsLogicSrc, /status: "transient_error"/);
assert.match(messageFtsLogicSrc, /cache: false/);
assert.doesNotMatch(messageFtsConfigSrc, /FROM pg_ts_config/);
assert.doesNotMatch(messageFtsConfigSrc, /WHEN EXISTS \(SELECT 1 FROM pg_ts_config/);
assert.doesNotMatch(messageFtsConfigSrc, /cfgname = 'arabic'/);
assert.doesNotMatch(messageFtsLogicSrc, /FROM pg_ts_config/);
assert.doesNotMatch(messageFtsLogicSrc, /cfgname = 'arabic'/);
console.log("  ✅ migration 016 owns office_messages FTS; runtime reads generated expression config");

console.log("\n═══ schemaAuthority: Drizzle is ORM types, not production DDL ═══");

const drizzleCfg = readRepo("lib/db/drizzle.config.ts");
assert.match(drizzleCfg, /schema authority|DDL authority|migrations/i);
assert.match(drizzleCfg, /artifacts\/api-server\/migrations/);
console.log("  ✅ drizzle.config.ts documents migrations as DDL authority");

const libDbPkg = readRepo("lib/db/package.json");
assert.match(libDbPkg, /"push"/);
console.log("  ✅ @workspace/db push remains available for local/dev only");

console.log("\n✅ schemaAuthority: all checks passed\n");
