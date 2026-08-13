/**
 * Stage 5B — Migration 037 Remaining Financial Runtime schema authority (fail-closed).
 * Run: pnpm --filter @workspace/api-server run test:financial-037
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const API = join(HERE, "..");

function readRepo(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}
function readSrc(rel: string) {
  return readFileSync(join(API, rel), "utf8");
}
function stripComments(sql: string) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

const OWNED_TABLES = [
  "financial_accounts",
  "ledger_entries",
  "wallets",
  "lawyer_payouts",
  "invoice_payments",
  "office_tax_settings",
  "invoice_revisions",
  "credit_notes",
];

const INDEXES = [
  "idx_inv_payments_invoice",
  "idx_inv_payments_office",
  "idx_invoice_revisions_invoice",
  "idx_credit_notes_office",
  "idx_invoices_case_office",
  "idx_revenues_case_office",
  "idx_expenses_case_office",
];

const EXT_COLUMNS = [
  "client_name",
  "tax_enabled",
  "amount_paid",
  "view_token",
  "zatca_uuid",
  "qr_code_data",
  "locked_at",
  "linked_credit_note_id",
];

console.log("\n═══ Migration 037 presence + financial remaining contract ═══");
const migPath = "artifacts/api-server/migrations/037_financial_remaining_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-037.sql";
assert.ok(existsSync(join(ROOT, migPath)), "037 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "037 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const table of OWNED_TABLES) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
for (const index of INDEXES) {
  assert.match(mig, new RegExp(index));
  assert.match(pre, new RegExp(index));
}
assert.match(mig, /CREATE SEQUENCE IF NOT EXISTS invoice_seq/);
assert.match(mig, /ledger_entries[\s\S]{0,400}office_id/);
assert.match(mig, /revenues[\s\S]{0,80}deleted_at|ADD COLUMN IF NOT EXISTS deleted_at/);
assert.match(mig, /expenses[\s\S]{0,80}deleted_at|ADD COLUMN IF NOT EXISTS deleted_at/);
for (const col of EXT_COLUMNS) {
  assert.match(mig, new RegExp(`client_invoices[\\s\\S]{0,200}${col}|ADD COLUMN IF NOT EXISTS ${col}`));
}
assert.doesNotMatch(mig, /ADD COLUMN IF NOT EXISTS invoice_number/);
assert.match(mig, /NON_UUID_OFFICE_ID/);
assert.match(mig, /NULL_OFFICE_ID/);
assert.match(mig, /NULL_REQUIRED/);
assert.match(mig, /INCOMPATIBLE_(?:TYPE|PK|INDEX)/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /POST_APPLY_READINESS_FAILED/);
assert.match(mig, /UNIQUE\s*\(\s*owner_id\s*,\s*currency\s*\)/);
assert.match(mig, /UNIQUE\s*\(\s*owner_id\s*\)/);
assert.match(mig, /office_tax_settings[\s\S]{0,200}UNIQUE\s*\(\s*office_id\s*\)|UNIQUE\s*\(\s*office_id\s*\)/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_ledger/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS payment_transactions/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS stripe_events/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS moyasar_settings/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS chart_of_accounts/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS client_invoices/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS revenues\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS expenses\b/);
}
console.log("  ✅ 037 owns 8 tables + extensions + seq + 7 indexes; no DROP/re-own of prior authority");

console.log("\n═══ Preflight 037 SELECT-only + blockers-first ladder ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|only reads catalogs/i);
assert.match(pre, /chosen_action/);
assert.match(pre, /reason_code/);
assert.match(pre, /ALREADY_CORRECT/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /FINANCIAL_REMAINING_SCHEMA_READY/);
assert.match(pre, /NON_UUID_OFFICE_ID/);
assert.match(pre, /NULL_OFFICE_ID/);
assert.match(pre, /NULL_REQUIRED/);
assert.match(pre, /INCOMPATIBLE_(?:TYPE|PK|INDEX|UNIQUE)/);
assert.match(pre, /DUPLICATE_UNIQUE_KEY/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
assert.match(pre, /ALWAYS probed by name|ALWAYS probe by index name|probe by name/i);
assert.match(pre, /WHERE n\.nspname='public' AND i\.relname=index_spec\.index_name/);
assert.match(pre, /incompatible_objects[\s\S]*missing_tables|missing_tables[\s\S]*incompatible/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*DROP\s+(?:TABLE|INDEX)\b/im);
}
console.log("  ✅ preflight is SELECT-only; named index probes and blockers precede SAFE");

console.log("\n═══ P0 verify-schema gate includes Financial 037 ═══");
const p0Tables = readRepo("scripts/db/expected-tables-p0.txt");
for (const table of OWNED_TABLES) {
  assert.match(p0Tables, new RegExp(`^${table}$`, "m"));
}
const p0Cols = readRepo("scripts/db/expected-columns-p0.txt");
assert.match(p0Cols, /^ledger_entries\.office_id$/m);
assert.match(p0Cols, /^client_invoices\.amount_paid$/m);
assert.match(p0Cols, /^revenues\.deleted_at$/m);
assert.match(p0Cols, /^expenses\.deleted_at$/m);
assert.match(p0Cols, /^wallets\.owner_id$/m);
assert.match(p0Cols, /^invoice_payments\.office_id$/m);
console.log("  ✅ P0 gates 037 tables and critical extension columns");

console.log("\n═══ Runtime financial DDL removed; readiness + seeds preserved ═══");
const core = readSrc("modules/financial/financialCore.ts");
const inv = readSrc("modules/financial/invoices.ts");
const comp = readSrc("modules/financial/financial-completions.ts");
const acct = readSrc("modules/financial/accounting.ts");
const cases = readSrc("modules/legal-core/cases.ts");
assert.doesNotMatch(core, /CREATE TABLE IF NOT EXISTS financial_accounts/);
assert.doesNotMatch(core, /CREATE TABLE IF NOT EXISTS ledger_entries/);
assert.doesNotMatch(core, /CREATE TABLE IF NOT EXISTS wallets/);
assert.doesNotMatch(core, /CREATE TABLE IF NOT EXISTS lawyer_payouts/);
assert.match(core, /to_regclass\('public\.financial_accounts'\)/);
assert.match(core, /INSERT INTO wallets[\s\S]*ON CONFLICT \(owner_id\) DO NOTHING/);
assert.doesNotMatch(inv, /CREATE TABLE IF NOT EXISTS invoice_payments/);
assert.doesNotMatch(inv, /CREATE INDEX IF NOT EXISTS idx_inv_payments_/);
assert.doesNotMatch(inv, /ALTER TABLE client_invoices ADD COLUMN IF NOT EXISTS/);
assert.match(inv, /to_regclass\('public\.invoice_payments'\)/);
assert.match(inv, /UPDATE client_invoices SET view_token/);
assert.doesNotMatch(comp, /CREATE TABLE IF NOT EXISTS office_tax_settings/);
assert.doesNotMatch(comp, /CREATE SEQUENCE IF NOT EXISTS invoice_seq/);
assert.doesNotMatch(comp, /ADD COLUMN IF NOT EXISTS invoice_number/);
assert.doesNotMatch(comp, /ADD COLUMN IF NOT EXISTS zatca_uuid/);
assert.match(comp, /to_regclass\('public\.office_tax_settings'\)/);
assert.match(comp, /UPDATE client_invoices[\s\S]*invoice_number/);
assert.doesNotMatch(acct, /ALTER TABLE revenues ADD COLUMN IF NOT EXISTS deleted_at/);
assert.doesNotMatch(acct, /ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deleted_at/);
assert.match(acct, /revenues\.deleted_at|table_name = 'revenues'/);
assert.doesNotMatch(cases, /CREATE INDEX IF NOT EXISTS idx_invoices_case_office/);
assert.doesNotMatch(cases, /CREATE INDEX IF NOT EXISTS idx_revenues_case_office/);
assert.doesNotMatch(cases, /CREATE INDEX IF NOT EXISTS idx_expenses_case_office/);
console.log("  ✅ Runtime CREATE/ALTER/INDEX removed; wallet seed + DML backfills preserved");

console.log("\n═══ Prior formal authority + wiring ═══");
assert.match(readRepo("artifacts/api-server/migrations/003_drizzle_baseline_safe.sql"), /invoice_number/);
assert.match(readRepo("artifacts/api-server/migrations/010_office_ledger_performance_indexes.sql"), /office_ledger/);
assert.match(readRepo("artifacts/api-server/migrations/011_stripe_infrastructure_tables.sql"), /stripe_events/);
assert.match(readRepo("artifacts/api-server/migrations/012_payment_transactions.sql"), /payment_transactions/);
assert.match(readRepo("artifacts/api-server/migrations/013_erp_schema.sql"), /chart_of_accounts/);
assert.match(readRepo("artifacts/api-server/migrations/025_billing_schema_authority.sql"), /platform_billing_invoices|office_entitlements/);
assert.match(readRepo("artifacts/api-server/migrations/032_gateway_settings_schema_authority.sql"), /moyasar_settings/);
const bootTxt = readRepo("scripts/db/boot-created-tables.txt");
for (const table of OWNED_TABLES) {
  assert.doesNotMatch(bootTxt, new RegExp(`^${table}$`, "m"));
}
assert.doesNotMatch(bootTxt, /^expenses$/m);
const pkg = readRepo("artifacts/api-server/package.json");
assert.match(pkg, /test:financial-037/);
const ci = readRepo(".github/workflows/ci.yml");
assert.match(ci, /test:financial-037/);
const integ = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ, /MIGRATION_037/);
assert.match(integ, /apply_migration_037/);
assert.match(integ, /scenario_migration_037_financial_remaining/);
console.log("  ✅ Prior authority preserved; boot/package/CI/integration wiring present");

console.log("\n✅ financialRemainingSchemaAuthority037 tests passed\n");
