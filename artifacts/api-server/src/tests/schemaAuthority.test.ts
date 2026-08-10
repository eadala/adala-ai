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
assert.ok(migrationFiles.includes("017_cases_schema.sql"));
assert.ok(migrationFiles.includes("018_money_numeric_batch1.sql"));
assert.ok(migrationFiles.includes("019_money_numeric_batch2.sql"));
assert.ok(migrationFiles.includes("020_performance_hotpath_indexes.sql"));
assert.ok(migrationFiles.includes("021_rag_schema_foundation.sql"));
assert.ok(migrationFiles.includes("023_trial_uuid_offices.sql"));
assert.ok(migrationFiles.includes("024_tasks_tenant_ownership.sql"));
assert.ok(migrationFiles.includes("025_billing_schema_authority.sql"));
assert.ok(migrationFiles.includes("026_promo_schema_authority.sql"));
assert.ok(migrationFiles.includes("027_event_daily_counts_schema_authority.sql"));
assert.ok(migrationFiles.includes("028_case_autopilot_reports_schema_authority.sql"));
assert.ok(migrationFiles.includes("029_office_messages_fts_readiness.sql"));
/* Ordering: 024 must sort after 023 (023 remaps trial_* before NULL-task backfill). */
assert.ok(
  "023_trial_uuid_offices.sql" < "024_tasks_tenant_ownership.sql",
  "024 must lexicographically follow 023",
);
assert.ok(
  "024_tasks_tenant_ownership.sql" < "025_billing_schema_authority.sql",
  "025 must lexicographically follow 024",
);
assert.ok(
  "025_billing_schema_authority.sql" < "026_promo_schema_authority.sql",
  "026 must lexicographically follow 025",
);
assert.ok(
  "026_promo_schema_authority.sql" < "027_event_daily_counts_schema_authority.sql",
  "027 must lexicographically follow 026",
);
assert.ok(
  "028_case_autopilot_reports_schema_authority.sql" <
    "029_office_messages_fts_readiness.sql",
  "029 must lexicographically follow 028",
);
assert.ok(
  !migrationFiles.includes("022_tasks_tenant_ownership.sql"),
  "legacy 022_tasks_tenant_ownership.sql must be renamed to 024",
);
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
assert.match(messageFtsLogicSrc, /MESSAGE_FTS_ALLOWED_CONFIGS/);
assert.match(messageFtsLogicSrc, /isAllowedMessageFtsConfig/);
assert.match(messageFtsLogicSrc, /unsupported_config/);
assert.doesNotMatch(messageFtsConfigSrc, /FROM pg_ts_config/);
assert.doesNotMatch(messageFtsConfigSrc, /WHEN EXISTS \(SELECT 1 FROM pg_ts_config/);
assert.doesNotMatch(messageFtsConfigSrc, /cfgname = 'arabic'/);
assert.doesNotMatch(messageFtsLogicSrc, /FROM pg_ts_config/);
assert.doesNotMatch(messageFtsLogicSrc, /cfgname = 'arabic'/);
console.log("  ✅ migration 016 owns office_messages FTS; runtime reads generated expression config");

console.log("\n═══ schemaAuthority: Batch Cases (017) + Demo seed ═══");

const mig017 = readRepo("artifacts/api-server/migrations/017_cases_schema.sql");
assert.match(mig017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_number TEXT/);
assert.match(mig017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_name TEXT/);
assert.match(mig017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_code TEXT/);
assert.match(mig017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_city TEXT/);
assert.match(mig017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_district_number INTEGER/);
assert.match(mig017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS court_district_type TEXT/);
assert.match(mig017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS next_hearing_date TIMESTAMPTZ/);
assert.match(mig017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ/);
assert.match(mig017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS version INTEGER/);
assert.match(mig017, /ALTER TABLE cases ALTER COLUMN version SET DEFAULT 1/);
assert.match(mig017, /CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_cases_office_case_number/);
assert.match(mig017, /017_cases: skipping column repair — cases table missing/);
assert.match(mig017, /duplicate \(office_id, case_number\) rows/);
assert.match(mig017, /WHERE office_id IS NOT NULL\s*\n\s*AND case_number IS NOT NULL/);
assert.doesNotMatch(mig017, /^\s*WHEN others\b/im);
assert.doesNotMatch(mig017, /DROP COLUMN/);
assert.doesNotMatch(mig017, /RENAME COLUMN/);

const drizzleCases = readRepo("lib/db/src/schema/cases.ts");
assert.match(drizzleCases, /case_number/);
assert.match(drizzleCases, /court_name/);
assert.match(drizzleCases, /court_code/);
assert.match(drizzleCases, /court_city/);
assert.match(drizzleCases, /court_district_number/);
assert.match(drizzleCases, /court_district_type/);
assert.match(drizzleCases, /next_hearing_date/);
assert.match(drizzleCases, /deleted_at/);
assert.match(drizzleCases, /version/);
assert.match(drizzleCases, /withTimezone:\s*true/);
assert.match(drizzleCases, /\.default\(1\)/);
console.log("  ✅ Drizzle cases schema matches Migration 017 columns");

const casesSrc017 = readSrc("modules/legal-core/cases.ts");
assert.match(casesSrc017, /017_cases_schema/);
assert.doesNotMatch(casesSrc017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at/);
assert.doesNotMatch(casesSrc017, /ALTER TABLE cases ADD COLUMN IF NOT EXISTS version/);
assert.doesNotMatch(casesSrc017, /CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_cases_office_case_number/);

const demoModeSrc = readSrc("modules/platform/demoMode.ts");
const demoPolicySrc = readSrc("modules/platform/demoSeedPolicy.ts");
assert.match(demoModeSrc, /isDemoSeedEnabled/);
assert.match(demoModeSrc, /classifyDemoSeedError/);
assert.match(demoModeSrc, /017_cases_schema/);
assert.doesNotMatch(demoModeSrc, /table may not exist yet/);
assert.match(demoModeSrc, /ON CONFLICT \(id\) DO NOTHING/);
assert.match(demoModeSrc, /INSERT INTO cases \(id, title, case_number, case_type, status, client_name, office_id, created_at, updated_at\)/);
assert.match(demoPolicySrc, /DEMO_SEED_ENABLED === "true"/);
assert.doesNotMatch(demoPolicySrc, /NODE_ENV\s*!==\s*["']production["']/);
assert.doesNotMatch(demoPolicySrc, /NODE_ENV\s*===\s*["']production["']/);
console.log("  ✅ migration 017 owns cases court/soft-delete columns; Demo seed opt-in only");

console.log("\n═══ schemaAuthority: Money Numeric Batch 1 (018) ═══");

const mig018 = readRepo("artifacts/api-server/migrations/018_money_numeric_batch1.sql");
assert.match(mig018, /Migration 018: Money Numeric Batch 1/);
assert.match(mig018, /NUMERIC\(18,2\)/);
assert.match(mig018, /::numeric\(18,2\)/);
assert.match(mig018, /round-half-away-from-zero/);
assert.match(mig018, /ARRAY\['invoices',\s*'amount'/);
assert.match(mig018, /ARRAY\['subscriptions',\s*'plan_price'/);
assert.match(mig018, /ARRAY\['usage_logs',\s*'cost'/);
assert.match(mig018, /ARRAY\['plans',\s*'price'/);
assert.match(mig018, /ARRAY\['plans',\s*'monthly_price'/);
assert.match(mig018, /ARRAY\['plans',\s*'yearly_price'/);
assert.match(mig018, /ARRAY\['discount_codes',\s*'value'/);
assert.match(mig018, /ARRAY\['ai_api_keys',\s*'total_cost'/);
assert.doesNotMatch(mig018, /WHEN others/i);
assert.doesNotMatch(mig018, /ARRAY\['client_invoices'/);
assert.doesNotMatch(mig018, /ARRAY\['payment_transactions'/);
assert.doesNotMatch(mig018, /ARRAY\['office_ledger'/);
assert.doesNotMatch(mig018, /ARRAY\['contracts'/);
assert.doesNotMatch(mig018, /ARRAY\['arbitration/);
assert.doesNotMatch(mig018, /cost_points/);
assert.match(mig018, /RAISE NOTICE '018_money: skipping/);
assert.match(mig018, /refusing to convert/);

const billingSchema = readRepo("lib/db/src/schema/billing.ts");
assert.match(billingSchema, /numeric\("amount",\s*\{\s*precision:\s*18,\s*scale:\s*2\s*\}\)/);
assert.match(billingSchema, /numeric\("plan_price",\s*\{\s*precision:\s*18,\s*scale:\s*2\s*\}\)/);
assert.match(billingSchema, /numeric\("cost",\s*\{\s*precision:\s*18,\s*scale:\s*2\s*\}\)/);
assert.doesNotMatch(billingSchema, /\breal\s*\(/);

const adminSchema = readRepo("lib/db/src/schema/admin.ts");
assert.match(adminSchema, /numeric\("price",\s*\{\s*precision:\s*18,\s*scale:\s*2\s*\}\)/);
assert.match(adminSchema, /numeric\("monthly_price",\s*\{\s*precision:\s*18,\s*scale:\s*2\s*\}\)/);
assert.match(adminSchema, /numeric\("yearly_price",\s*\{\s*precision:\s*18,\s*scale:\s*2\s*\}\)/);
assert.match(adminSchema, /numeric\("value",\s*\{\s*precision:\s*18,\s*scale:\s*2\s*\}\)/);
assert.match(adminSchema, /numeric\("total_cost",\s*\{\s*precision:\s*18,\s*scale:\s*2\s*\}\)/);
assert.doesNotMatch(adminSchema, /\breal\s*\(/);

assert.match(adminSrc, /function moneyNum/);
assert.match(adminSrc, /serializeDiscount/);
console.log("  ✅ migration 018 converts Batch-1 REAL money → NUMERIC(18,2); Drizzle aligned; no REAL in billing/admin schemas");

console.log("\n═══ schemaAuthority: Money Numeric Batch 2 (019) ═══");

const mig019 = readRepo("artifacts/api-server/migrations/019_money_numeric_batch2.sql");
assert.match(mig019, /Migration 019: Money Numeric Batch 2/);
assert.match(mig019, /NUMERIC\(18,2\)/);
assert.match(mig019, /::numeric\(18,2\)/);
assert.match(mig019, /more than 2 meaningful decimal places/);
assert.match(mig019, /exceeding NUMERIC\(18,2\) range/);
assert.match(mig019, /ARRAY\['payment_transactions',\s*'amount'/);
assert.match(mig019, /ARRAY\['payment_transactions',\s*'platform_fee'/);
assert.match(mig019, /ARRAY\['payment_transactions',\s*'net_amount'/);
assert.match(mig019, /ARRAY\['payment_transactions',\s*'stripe_fee'/);
assert.match(mig019, /ARRAY\['office_ledger',\s*'amount'/);
assert.match(mig019, /ARRAY\['office_ledger',\s*'platform_fee'/);
assert.match(mig019, /ARRAY\['office_ledger',\s*'stripe_fee'/);
assert.match(mig019, /ARRAY\['office_ledger',\s*'net_amount'/);
assert.doesNotMatch(mig019, /EXCEPTION\s+WHEN\s+others/i);
assert.doesNotMatch(mig019, /^\s*WHEN others/im);
assert.doesNotMatch(mig019, /ARRAY\['client_invoices'/);
assert.doesNotMatch(mig019, /ARRAY\['invoices'/);
assert.doesNotMatch(mig019, /ARRAY\['plans'/);
assert.match(mig019, /RAISE NOTICE '019_money: skipping/);
assert.match(mig019, /expected numeric/);
assert.match(mig019, /No ×100 \/ ÷100/);

const dbRegistry = readRepo("artifacts/api-server/src/lib/dbRegistry.ts");
assert.match(dbRegistry, /tableName: "payment_transactions"/);
assert.match(dbRegistry, /name: "amount", type: "NUMERIC\(18,2\)"/);
assert.match(dbRegistry, /name: "stripe_fee", type: "NUMERIC\(18,2\)"/);
assert.match(dbRegistry, /name: "net_amount", type: "NUMERIC\(18,2\)"/);
assert.match(dbRegistry, /name: "platform_fee", type: "NUMERIC\(18,2\)"/);
console.log("  ✅ migration 019 tightens payment/ledger bare NUMERIC → NUMERIC(18,2); preflight aborts unsafe data; dbRegistry aligned");

console.log("\n═══ schemaAuthority: migration 020 hot-path indexes (Stage 10.7) ═══");
const mig020 = readRepo("artifacts/api-server/migrations/020_performance_hotpath_indexes.sql");
assert.match(mig020, /CREATE INDEX IF NOT EXISTS idx_office_messages_conversation_created/);
assert.match(mig020, /CREATE INDEX IF NOT EXISTS idx_folder_permissions_user_id/);
assert.match(mig020, /CREATE INDEX IF NOT EXISTS idx_employees_office_status/);
assert.match(mig020, /CREATE INDEX IF NOT EXISTS idx_payroll_employee_period/);
assert.match(mig020, /CREATE INDEX IF NOT EXISTS idx_events_case_id/);
assert.match(mig020, /CREATE INDEX IF NOT EXISTS idx_conv_members_user/);
assert.doesNotMatch(mig020, /CREATE TABLE|ALTER TABLE|DROP INDEX/i);
assert.match(mig020, /020_indexes: skipping/);
console.log("  ✅ migration 020 is CREATE INDEX IF NOT EXISTS only; guarded for missing tables/columns");

console.log("\n═══ schemaAuthority: migration 021 RAG schema foundation (Stage 11.2) ═══");
const mig021 = readRepo("artifacts/api-server/migrations/021_rag_schema_foundation.sql");
assert.match(mig021, /CREATE EXTENSION IF NOT EXISTS vector/);
assert.match(mig021, /CREATE TABLE IF NOT EXISTS rag_chunks/);
assert.match(mig021, /vector\(1536\)/);
assert.match(mig021, /Decision A/);
assert.match(mig021, /text-embedding-3-small/);
assert.match(mig021, /document_center_files_office_id_id_key/);
assert.match(mig021, /UNIQUE \(office_id, id\)/);
assert.match(
  mig021,
  /FOREIGN KEY \(office_id, document_id\)\s+REFERENCES document_center_files \(office_id, id\)\s+ON DELETE CASCADE/s,
);
assert.doesNotMatch(
  mig021,
  /REFERENCES document_center_files \(id\) ON DELETE CASCADE/,
);
assert.match(mig021, /UNIQUE \(office_id, document_id, chunk_index\)/);
assert.match(mig021, /USING hnsw \(embedding vector_cosine_ops\)/);
assert.doesNotMatch(mig021, /USING ivfflat/i);
assert.match(mig021, /extracted_text/);
assert.match(mig021, /CREATE TABLE IF NOT EXISTS document_center_files/);
assert.match(mig021, /CREATE TABLE IF NOT EXISTS document_ai_metadata/);
assert.doesNotMatch(mig021, /float8\[\]|REAL\[\]/);
assert.match(mig021, /No float\[] \/ JSON embedding fallback is permitted/);

const docCenterSrc = readSrc("modules/documents/documentCenter.ts");
assert.match(docCenterSrc, /021_rag_schema_foundation/);
assert.doesNotMatch(docCenterSrc, /CREATE TABLE IF NOT EXISTS document_center_files/);
assert.doesNotMatch(docCenterSrc, /CREATE TABLE IF NOT EXISTS document_ai_metadata/);
assert.doesNotMatch(docCenterSrc, /CREATE INDEX IF NOT EXISTS idx_dcf_/);
assert.doesNotMatch(docCenterSrc, /CREATE INDEX IF NOT EXISTS idx_dam_/);
assert.doesNotMatch(docCenterSrc, /ALTER TABLE document_center_files/);
assert.doesNotMatch(docCenterSrc, /ALTER TABLE document_ai_metadata/);
assert.match(docCenterSrc, /to_regclass\('public\.document_center_files'\)/);
console.log("  ✅ migration 021 owns pgvector + composite tenant FK + document_center; Runtime DDL removed");



console.log("\n═══ schemaAuthority: migration 024 tasks tenant ownership (Stage 15) ═══");
const mig024 = readRepo("artifacts/api-server/migrations/024_tasks_tenant_ownership.sql");
assert.match(mig024, /CREATE TABLE IF NOT EXISTS tasks_orphan_quarantine/);
assert.match(mig024, /FROM cases c/);
assert.match(mig024, /office_branches/);
assert.match(mig024, /ALTER TABLE tasks ALTER COLUMN office_id SET NOT NULL/);
assert.match(mig024, /RAISE EXCEPTION/);
assert.match(mig024, /idx_tasks_office_id/);
assert.match(mig024, /FK to office_page intentionally omitted/);
assert.doesNotMatch(mig024, /ORDER BY created_at LIMIT 1/);
assert.match(mig024, /Migration 023[\s\S]*MUST be applied first/i);
assert.match(mig024, /must not run while legacy trial_\* cases remain|Do NOT apply this file while legacy trial_\* cases remain/i);
assert.match(mig024, /Autopilot UUID office writes must be deployed/i);
const tasksOpsSrc = readSrc("modules/operations/tasks.ts");
assert.doesNotMatch(tasksOpsSrc, /office_id IS NULL/);
assert.match(tasksOpsSrc, /resolveTaskOfficeId/);
const preflight024 = readRepo("scripts/db/preflight-migration-024.sql");
assert.match(preflight024, /READ-ONLY|SELECT only/i);
assert.match(preflight024, /Migration 023 FIRST, then Migration 024/i);
console.log("  ✅ migration 024 backfills trusted owners, quarantines orphans, NOT NULL; apply after 023; app has no NULL visibility");

console.log("\n═══ schemaAuthority: migration 023 trial → UUID offices (Stage 15.2c) ═══");
const mig023 = readRepo("artifacts/api-server/migrations/023_trial_uuid_offices.sql");
assert.match(mig023, /CREATE TABLE IF NOT EXISTS legacy_trial_office_map/);
assert.match(mig023, /legacy_trial_office_conflicts/);
assert.match(mig023, /legacy_default_office_unresolved/);
assert.match(mig023, /INSERT INTO office_page/);
assert.match(mig023, /RAISE EXCEPTION/);
assert.match(mig023, /trial_offices/);
assert.match(mig023, /role = 'owner'/);
assert.match(mig023, /abort BEFORE office_page creation/i);
assert.doesNotMatch(mig023, /FROM office_page ORDER BY created_at LIMIT 1/);
assert.doesNotMatch(mig023, /role IN \('owner',\s*'admin'\)/);
const preflight023 = readRepo("scripts/db/preflight-migration-023.sql");
assert.match(preflight023, /READ-ONLY|SELECT only/i);
assert.match(preflight023, /chosen_action/);
assert.match(preflight023, /map_to_new_or_existing/);
console.log("  ✅ migration 023 trusted-only ownership + read-only preflight; no first-office guess");

console.log("\n═══ schemaAuthority: onboarding UUID provisioning fail-closed (PR-1) ═══");
const onboardingPr1 = readRepo("artifacts/api-server/src/modules/platform/onboarding.ts");
const trialPr1 = readRepo("artifacts/api-server/src/modules/platform/trialOnboarding.ts");
assert.doesNotMatch(onboardingPr1, /\?\?\s*["']default["']/);
assert.match(onboardingPr1, /LEGACY_NON_UUID/);
assert.match(onboardingPr1, /provisionOfficeForUser/);
assert.match(trialPr1, /needsMigration/);
assert.match(trialPr1, /provisionOfficeForUser/);
console.log("  ✅ onboarding/trial use UUID provision helper and do not invent default tenant ids");


console.log("\n═══ schemaAuthority: Stage 15.2e EventBus / CASE_CREATED officeId (PR-3) ═══");
const caseEvents152e = readRepo("artifacts/api-server/src/case/case.events.ts");
const eventBus152e = readRepo("artifacts/api-server/src/core/eventBus.ts");
assert.match(caseEvents152e, /officeId/);
assert.doesNotMatch(eventBus152e, /officeId\s*\?\?\s*["']default["']/);
assert.doesNotMatch(eventBus152e, /\?\?\s*["']default["']/);
console.log("  ✅ CASE_CREATED carries officeId; EventBus does not invent default tenant ids");

console.log("\n═══ schemaAuthority: migration 025 billing tables (Stage 16.1) ═══");
const mig025 = readRepo("artifacts/api-server/migrations/025_billing_schema_authority.sql");
assert.match(mig025, /CREATE TABLE IF NOT EXISTS office_entitlements/);
assert.match(mig025, /CREATE TABLE IF NOT EXISTS platform_billing_invoices/);
assert.match(mig025, /ADD COLUMN IF NOT EXISTS/);
assert.match(mig025, /idx_platform_billing_invoices_office_id/);
assert.match(mig025, /idx_platform_billing_invoices_status/);
assert.match(mig025, /idx_platform_billing_invoices_due_date/);
assert.doesNotMatch(mig025, /DROP TABLE/i);
const billingSrc025 = readSrc("modules/financial/billing.ts");
assert.match(billingSrc025, /requireAuthWithTenant/);
assert.match(billingSrc025, /fetchBillingOverview|listTenantPlatformInvoices|tenantPlatformInvoiceStats/);
assert.doesNotMatch(
  billingSrc025,
  /FROM platform_billing_invoices ORDER BY created_at DESC LIMIT 50/,
);
const preflight025 = readRepo("scripts/db/preflight-migration-025.sql");
assert.match(preflight025, /READ-ONLY|SELECT only/i);
console.log("  ✅ migration 025 owns entitlements + platform invoices; tenant GETs no longer list all invoices");

console.log("\n═══ schemaAuthority: migration 026 promo tables (Stage 16.3) ═══");
const mig026 = readRepo("artifacts/api-server/migrations/026_promo_schema_authority.sql");
assert.match(mig026, /CREATE TABLE IF NOT EXISTS promo_codes/);
assert.match(mig026, /CREATE TABLE IF NOT EXISTS gift_subscriptions/);
assert.match(mig026, /office_id\s+UUID NOT NULL/);
assert.match(mig026, /user_id\s+TEXT NOT NULL/);
assert.match(mig026, /ADD COLUMN IF NOT EXISTS office_id/);
assert.match(mig026, /ADD COLUMN IF NOT EXISTS user_id/);
assert.match(mig026, /ADD COLUMN IF NOT EXISTS/);
assert.match(mig026, /uq_promo_codes_code|UNIQUE \(code\)/);
assert.match(mig026, /idx_gift_subscriptions_status_end_date/);
assert.match(mig026, /idx_gift_subscriptions_office_id/);
assert.match(mig026, /idx_gift_subscriptions_user_id/);
assert.match(mig026, /idx_gift_subscriptions_office_user_status/);
assert.doesNotMatch(mig026, /DROP TABLE/i);
assert.doesNotMatch(mig026, /USING\s+\w+::/i);
assert.doesNotMatch(mig026, /ALTER COLUMN office_id SET NOT NULL/i);
assert.doesNotMatch(mig026, /ALTER COLUMN user_id SET NOT NULL/i);
const promoSrc026 = readSrc("modules/financial/promo.ts");
assert.match(promoSrc026, /\/promo\/my-gift/);
assert.match(promoSrc026, /requireAuthWithTenant/);
assert.match(promoSrc026, /resolveGiftOwner/);
assert.match(promoSrc026, /office_id = \$\{officeId\}::uuid/);
assert.match(promoSrc026, /user_id = \$\{userId\}/);
assert.match(promoSrc026, /FROM gift_subscriptions/);
assert.match(promoSrc026, /FROM promo_codes|JOIN promo_codes/);
assert.doesNotMatch(promoSrc026, /CREATE TABLE IF NOT EXISTS (promo_codes|gift_subscriptions)/);
const subSrc026 = readSrc("modules/financial/subscription.ts");
assert.match(subSrc026, /requireAuthWithTenant/);
assert.match(subSrc026, /gs\.office_id = \$\{officeId\}::uuid/);
assert.match(subSrc026, /gs\.user_id = \$\{userId\}/);
const preflight026 = readRepo("scripts/db/preflight-migration-026.sql");
assert.match(preflight026, /READ-ONLY|SELECT only/i);
assert.match(preflight026, /missing_office_id|missing_user_id/);
const integ026 = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ026, /scenario_migration_026_promo|MIGRATION_026/);
console.log("  ✅ migration 026 owns promo tables with office_id+user_id; tenant paths scoped");

console.log("\n═══ schemaAuthority: migration 027 event_daily_counts (Stage 16.5) ═══");
const mig027 = readRepo("artifacts/api-server/migrations/027_event_daily_counts_schema_authority.sql");
assert.match(mig027, /CREATE TABLE IF NOT EXISTS event_daily_counts/);
assert.match(mig027, /office_id\s+TEXT NOT NULL\s*,/);
assert.doesNotMatch(mig027, /office_id\s+TEXT NOT NULL DEFAULT\s*'default'/i);
assert.match(mig027, /ADD COLUMN IF NOT EXISTS/);
assert.match(mig027, /DROP DEFAULT/);
assert.match(mig027, /uq_event_daily_counts_type_office_date|UNIQUE \(event_type, office_id, event_date\)/);
assert.match(mig027, /RAISE EXCEPTION/);
assert.doesNotMatch(mig027.replace(/--.*$/gm, ""), /RAISE WARNING/i);
assert.match(mig027, /idx_event_daily_counts_office_id/);
{
  const sqlOnly027 = mig027.replace(/--.*$/gm, "");
  assert.doesNotMatch(sqlOnly027, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sqlOnly027, /\bDROP\s+COLUMN\b/i);
}
const analyticsListener027 = readSrc("core/listeners/analyticsListener.ts");
assert.doesNotMatch(analyticsListener027, /CREATE TABLE IF NOT EXISTS event_daily_counts/);
assert.doesNotMatch(analyticsListener027, /ensureEventCountsTable/);
assert.doesNotMatch(analyticsListener027, /officeId\s*\?\?\s*["']default["']/);
assert.doesNotMatch(analyticsListener027, /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/);
assert.match(analyticsListener027, /trackOwnedAnalyticsEvent/);
const analyticsOwn027 = readSrc("lib/analyticsOwnership.ts");
assert.match(analyticsOwn027, /classifyTenantId/);
assert.match(analyticsOwn027, /toUuid/);
assert.match(analyticsOwn027, /logAnalyticsUpsertFailure|upsert_failed/);
assert.doesNotMatch(analyticsOwn027, /resolveAutopilotOfficeId/);
const preflight027 = readRepo("scripts/db/preflight-migration-027.sql");
assert.match(preflight027, /READ-ONLY|SELECT only/i);
assert.match(preflight027, /BLOCKED_CLEAN_DUPLICATES/);
assert.match(preflight027, /chosen_action/);
const integ027 = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ027, /scenario_migration_027_event_daily_counts|MIGRATION_027/);
console.log("  ✅ migration 027 owns event_daily_counts; analytics UUID-only; Runtime DDL removed");

console.log("\n═══ schemaAuthority: migration 028 case_autopilot_reports (Stage 19) ═══");
const mig028 = readRepo("artifacts/api-server/migrations/028_case_autopilot_reports_schema_authority.sql");
assert.match(mig028, /CREATE TABLE IF NOT EXISTS case_autopilot_reports/);
assert.match(mig028, /case_id\s+TEXT PRIMARY KEY/);
assert.match(mig028, /office_id\s+TEXT NOT NULL/);
assert.match(mig028, /ADD COLUMN IF NOT EXISTS/);
assert.match(mig028, /PRIMARY KEY \(case_id\)|case_autopilot_reports_pkey/);
assert.match(mig028, /idx_autopilot_office/);
assert.match(mig028, /RAISE EXCEPTION/);
assert.match(mig028, /BLOCKED_CLEAN_DUPLICATES|duplicate case_id/i);
assert.match(mig028, /indpred IS NULL/);
assert.match(mig028, /indexprs IS NULL/);
assert.match(mig028, /indnkeyatts = 1/);
assert.match(mig028, /__mig028_on_conflict_probe__/);
assert.doesNotMatch(mig028.replace(/--.*$/gm, ""), /RAISE WARNING/i);
{
  const sqlOnly028 = mig028.replace(/--.*$/gm, "");
  assert.doesNotMatch(sqlOnly028, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sqlOnly028, /\bDROP\s+COLUMN\b/i);
}
const stripComments028 = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const caseAutopilot028 = readSrc("agents/caseAutopilot.ts");
assert.doesNotMatch(stripComments028(caseAutopilot028), /ensureAutopilotTable/);
assert.doesNotMatch(stripComments028(caseAutopilot028), /CREATE TABLE IF NOT EXISTS case_autopilot_reports/);
assert.doesNotMatch(stripComments028(caseAutopilot028), /ALTER TABLE case_autopilot_reports/);
assert.match(caseAutopilot028, /ON CONFLICT \(case_id\) DO UPDATE/);
const autopilotListener028 = readSrc("core/listeners/autopilotListener.ts");
assert.doesNotMatch(stripComments028(autopilotListener028), /ensureAutopilotTable/);
assert.doesNotMatch(stripComments028(autopilotListener028), /CREATE TABLE IF NOT EXISTS case_autopilot_reports/);
assert.match(autopilotListener028, /resolveAutopilotOfficeId/);
const cases028 = readSrc("modules/legal-core/cases.ts");
assert.doesNotMatch(stripComments028(cases028), /ensureAutopilotTable/);
const preflight028 = readRepo("scripts/db/preflight-migration-028.sql");
assert.match(preflight028, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable/i);
assert.match(preflight028, /BLOCKED_CLEAN_DUPLICATES/);
assert.match(preflight028, /apply_028_create_missing_table/);
assert.match(preflight028, /indpred IS NULL/);
assert.match(preflight028, /on_conflict_case_id_supported/);
assert.match(preflight028, /chosen_action/);
const integ028 = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ028, /scenario_migration_028_case_autopilot_reports|MIGRATION_028/);
assert.match(integ028, /partial UNIQUE rejected|UNIQUE\(lower\(case_id\)\) rejected/);
const expectedTables028 = readRepo("scripts/db/expected-tables-p0.txt");
assert.match(expectedTables028, /^case_autopilot_reports$/m);
const bootTxt028 = readRepo("scripts/db/boot-created-tables.txt");
assert.doesNotMatch(bootTxt028, /^case_autopilot_reports$/m);
console.log("  ✅ migration 028 owns case_autopilot_reports; tight ON CONFLICT arbiter; Runtime DDL removed");

console.log("\n═══ schemaAuthority: Batch FTS readiness (029) ═══");

const mig029 = readRepo("artifacts/api-server/migrations/029_office_messages_fts_readiness.sql");
assert.match(mig029, /SAFE_AUTO_REPAIR_ADD_COLUMN/);
assert.match(mig029, /SAFE_AUTO_REPAIR_ADD_GIN/);
assert.match(mig029, /ALREADY_CORRECT/);
assert.match(mig029, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(mig029, /RAISE EXCEPTION/);
assert.match(mig029, /GENERATED ALWAYS AS/);
assert.match(mig029, /CREATE INDEX IF NOT EXISTS idx_messages_search/);
assert.match(mig029, /POST_APPLY_READINESS_FAILED/);
assert.match(mig029, /WRONG_GENERATED_EXPRESSION|PARTIAL_INDEX/);
assert.match(mig029, /idx_present AND NOT idx_ready_gin/);
{
  const sqlOnly029 = mig029.replace(/--.*$/gm, "");
  assert.doesNotMatch(sqlOnly029, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(sqlOnly029, /\bDROP\s+INDEX\b/i);
  assert.doesNotMatch(sqlOnly029, /^\s*CREATE\s+INDEX\s+CONCURRENTLY\b/im);
}
const preflight029 = readRepo("scripts/db/preflight-migration-029.sql");
assert.match(preflight029, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable/i);
assert.match(preflight029, /chosen_action/);
assert.match(preflight029, /reason_code/);
assert.match(preflight029, /estimated_rows/);
assert.match(preflight029, /lock_risk/);
assert.match(preflight029, /SAFE_AUTO_REPAIR_ADD_COLUMN/);
assert.match(preflight029, /BLOCK_AND_MANUAL_REVIEW/);
const integ029 = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ029, /scenario_migration_029_office_messages_fts_readiness|MIGRATION_029/);
assert.match(integ029, /apply_migration_029/);
console.log("  ✅ migration 029 FTS readiness: safe add column/GIN only; BLOCK refuses destructive repair");

console.log("\n═══ schemaAuthority: Drizzle is ORM types, not production DDL ═══");

const drizzleCfg = readRepo("lib/db/drizzle.config.ts");
assert.match(drizzleCfg, /schema authority|DDL authority|migrations/i);
assert.match(drizzleCfg, /artifacts\/api-server\/migrations/);
console.log("  ✅ drizzle.config.ts documents migrations as DDL authority");

const libDbPkg = readRepo("lib/db/package.json");
assert.match(libDbPkg, /"push"/);
console.log("  ✅ @workspace/db push remains available for local/dev only");

console.log("\n✅ schemaAuthority: all checks passed\n");
