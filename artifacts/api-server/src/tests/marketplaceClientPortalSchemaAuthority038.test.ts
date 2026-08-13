/**
 * Stage 6B — Migration 038 Marketplace + Client Portal schema authority.
 * Run: pnpm --filter @workspace/api-server run test:marketplace-038
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
  "marketplace_services",
  "marketplace_orders",
  "marketplace_deals",
  "marketplace_deal_offers",
  "client_portal_tokens",
  "portal_uploads",
  "case_timeline",
  "client_accounts",
  "client_sessions",
  "client_case_links",
  "home_cms",
];

console.log("\n═══ Migration 038 presence + marketplace/portal contract ═══");
const migPath = "artifacts/api-server/migrations/038_marketplace_client_portal_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-038.sql";
assert.ok(existsSync(join(ROOT, migPath)), "038 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "038 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const table of OWNED_TABLES) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
assert.match(mig, /ADD COLUMN IF NOT EXISTS client_account_id TEXT/);
assert.match(mig, /client_sessions_client_id_fkey/);
assert.match(mig, /client_case_links_client_id_fkey/);
assert.match(mig, /ON DELETE CASCADE/);
assert.match(mig, /ORPHAN_FK/);
assert.match(mig, /DUPLICATE_UNIQUE_KEY/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /POST_APPLY_READINESS_FAILED/);
assert.match(mig, /UNIQUE\s*\(\s*token\s*\)|client_portal_tokens_token_key/);
assert.match(mig, /UNIQUE\s*\(\s*email\s*\)|client_accounts_email_key/);
assert.match(mig, /UNIQUE\s*\(\s*client_id\s*,\s*case_id\s*\)|client_case_links_client_id_case_id_key/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS invitations\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_page\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_services\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_orders\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS office_reviews\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS client_comm_settings\b/);
  assert.doesNotMatch(sqlOnly, /CREATE TABLE IF NOT EXISTS website_builder_pages\b/);
  assert.doesNotMatch(sqlOnly, /ADD COLUMN IF NOT EXISTS deleted_at/);
  assert.doesNotMatch(sqlOnly, /marketplace_services[\s\S]{0,200}office_id TEXT NOT NULL/);
  assert.doesNotMatch(sqlOnly, /client_portal_tokens[\s\S]{0,200}office_id TEXT NOT NULL/);
}
console.log("  ✅ 038 owns 11 tables + clients.client_account_id; auth FKs; no 003/004/006 re-own");

console.log("\n═══ Preflight 038 SELECT-only + blockers-first ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /chosen_action/);
assert.match(pre, /MARKETPLACE_PORTAL_SCHEMA_READY/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /ORPHAN_FK/);
assert.match(pre, /INCOMPATIBLE_(?:TYPE|PK|UNIQUE|FK)/);
assert.match(pre, /DUPLICATE_UNIQUE_KEY/);
assert.match(pre, /incompatible_uniques\s*:=\s*array_append|array_append\(\s*incompatible_uniques/);
assert.match(pre, /Any blocker wins|blocker wins over every safe repair/i);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
}
console.log("  ✅ preflight SELECT-only; FK/UNIQUE blockers before SAFE");

console.log("\n═══ P0 / boot gates ═══");
const p0Tables = readRepo("scripts/db/expected-tables-p0.txt");
for (const t of [
  "client_accounts",
  "client_sessions",
  "client_case_links",
  "client_portal_tokens",
  "case_timeline",
  "portal_uploads",
  "marketplace_services",
  "marketplace_orders",
]) {
  assert.match(p0Tables, new RegExp(`^${t}$`, "m"));
}
assert.doesNotMatch(p0Tables, /^home_cms$/m);
const p0Cols = readRepo("scripts/db/expected-columns-p0.txt");
assert.match(p0Cols, /^clients\.client_account_id$/m);
assert.match(p0Cols, /^client_portal_tokens\.token$/m);
assert.match(p0Cols, /^marketplace_services\.user_id$/m);
const bootTxt = readRepo("scripts/db/boot-created-tables.txt");
for (const t of OWNED_TABLES) {
  assert.doesNotMatch(bootTxt, new RegExp(`^${t}$`, "m"));
}
console.log("  ✅ P0 gates critical portal/marketplace tables; home_cms not P0; boot list cleared");

console.log("\n═══ Runtime DDL removed; DML preserved ═══");
const market = readSrc("modules/marketplace/marketplace.ts");
const portal = readSrc("modules/marketplace/client-portal.ts");
const auth = readSrc("modules/marketplace/client-auth.ts");
const home = readSrc("modules/marketplace/homeCms.ts");
const webhook = readSrc("webhookHandlers.ts");
const clients = readSrc("modules/legal-core/clients.ts");
assert.doesNotMatch(market, /CREATE TABLE IF NOT EXISTS marketplace_services/);
assert.match(market, /to_regclass\('public\.marketplace_services'\)/);
assert.doesNotMatch(portal, /CREATE TABLE IF NOT EXISTS client_portal_tokens/);
assert.match(portal, /to_regclass\('public\.client_portal_tokens'\)/);
assert.doesNotMatch(auth, /CREATE TABLE IF NOT EXISTS client_accounts/);
assert.match(auth, /to_regclass\('public\.client_accounts'\)/);
assert.doesNotMatch(home, /CREATE TABLE IF NOT EXISTS home_cms/);
assert.match(home, /INSERT INTO home_cms \(id\) VALUES \(1\) ON CONFLICT DO NOTHING/);
assert.doesNotMatch(webhook, /CREATE TABLE IF NOT EXISTS client_accounts/);
assert.doesNotMatch(webhook, /CREATE TABLE IF NOT EXISTS client_portal_tokens/);
assert.doesNotMatch(webhook, /CREATE TABLE IF NOT EXISTS client_case_links/);
assert.doesNotMatch(webhook, /CREATE TABLE IF NOT EXISTS case_timeline/);
assert.doesNotMatch(webhook, /ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_account_id/);
assert.doesNotMatch(clients, /ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_account_id/);
assert.match(clients, /ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at/);
assert.match(webhook, /INSERT INTO client_case_links/);
assert.match(webhook, /INSERT INTO client_portal_tokens/);
console.log("  ✅ Runtime CREATE/ALTER removed; seed + webhook DML preserved; deleted_at untouched");

console.log("\n═══ Prior authority + wiring ═══");
assert.match(readRepo("artifacts/api-server/migrations/003_drizzle_baseline_safe.sql"), /invitations/);
assert.match(readRepo("artifacts/api-server/migrations/004_legal_core_extensions.sql"), /portal_token/);
assert.match(readRepo("artifacts/api-server/migrations/006_post_migration_api_support.sql"), /website_config/);
const pkg = readRepo("artifacts/api-server/package.json");
assert.match(pkg, /test:marketplace-038/);
const ci = readRepo(".github/workflows/ci.yml");
assert.match(ci, /test:marketplace-038/);
const integ = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ, /MIGRATION_038/);
assert.match(integ, /apply_migration_038/);
assert.match(integ, /scenario_migration_038_marketplace_client_portal/);
console.log("  ✅ Prior 003/004/006 preserved; package/CI/integration wired");

console.log("\n✅ marketplaceClientPortalSchemaAuthority038 tests passed\n");
