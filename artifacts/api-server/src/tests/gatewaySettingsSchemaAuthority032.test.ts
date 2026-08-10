/**
 * Stage 23.4 — Migration 032 gateway settings schema authority.
 * Run: pnpm --filter @workspace/api-server run test:gateway-032
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

console.log("\n═══ Migration 032 presence + contract ═══");
const migPath = "artifacts/api-server/migrations/032_gateway_settings_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-032.sql";
assert.ok(existsSync(join(ROOT, migPath)), "032 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "032 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

assert.match(mig, /CREATE TABLE IF NOT EXISTS moyasar_settings/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS checkout_settings/);
assert.match(mig, /office_id\s+TEXT\s+NOT\s+NULL/);
assert.match(mig, /UNIQUE\s*\(\s*office_id\s*\)/);
assert.match(mig, /publishable_key/);
assert.match(mig, /callback_url/);
assert.match(mig, /public_key/);
assert.match(mig, /DROP DEFAULT/);
assert.match(mig, /DUPLICATE_OFFICE_ID/);
assert.match(mig, /NULL_OFFICE_ID/);
assert.match(mig, /INCOMPATIBLE_TYPE/);
assert.match(mig, /INCOMPATIBLE_UNIQUE/);
assert.match(mig, /POST_APPLY_READINESS_FAILED/);
assert.match(mig, /legacy.*office_id.*default|office_id=''default''/i);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /DEFAULT\s+'default'/i);
  assert.doesNotMatch(sqlOnly, /\bREFERENCES\b/i);
}
console.log("  ✅ 032 owns both tables; no office_id DEFAULT 'default'; no FK/DROP TABLE");

console.log("\n═══ Preflight 032 SELECT-only + ladder ═══");
assert.match(pre, /READ-ONLY|Does not CREATE \/ ALTER \/ DROP durable/i);
assert.match(pre, /chosen_action/);
assert.match(pre, /reason_code/);
assert.match(pre, /ALREADY_CORRECT/);
assert.match(pre, /SAFE_AUTO_REPAIR/);
assert.match(pre, /BLOCK_AND_MANUAL_REVIEW/);
assert.match(pre, /DUPLICATE_OFFICE_ID/);
assert.match(pre, /NULL_OFFICE_ID/);
assert.match(pre, /DROP_OFFICE_ID_DEFAULT/);
assert.match(pre, /legacy_office_id_default_rows|legacy_default/);
assert.match(pre, /lock_risk/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*DROP\s+TABLE\b/im);
}
console.log("  ✅ preflight false-safe ladder; legacy default rows reported non-blocking");

console.log("\n═══ Runtime DDL removed; payment business paths preserved ═══");
const payments = readSrc("modules/financial/payments.ts");
assert.doesNotMatch(payments, /function ensureGatewaySettingsTables|ensureGatewaySettingsTables\s*\(/);
assert.doesNotMatch(payments, /CREATE TABLE IF NOT EXISTS moyasar_settings/);
assert.doesNotMatch(payments, /CREATE TABLE IF NOT EXISTS checkout_settings/);
assert.doesNotMatch(payments, /logEnsureFailure/);
assert.match(payments, /032_gateway_settings_schema_authority/);
assert.match(payments, /012_payment_transactions/);
assert.match(payments, /INSERT INTO moyasar_settings \(office_id/);
assert.match(payments, /INSERT INTO checkout_settings \(office_id/);
assert.match(payments, /\/payments\/moyasar\/settings/);
assert.match(payments, /\/payments\/checkout\/settings/);
assert.match(payments, /\/payments\/payment-link/);
assert.match(payments, /\/payments\/checkout\/create-payment/);
console.log("  ✅ Runtime CREATE gone; INSERT office_id explicit; payment routes intact");

console.log("\n═══ Follow-up note: Moyasar webhook office_id fallback ═══");
const webhook = readSrc("modules/integrations/webhook.ts");
assert.match(
  webhook,
  /metadata\?\.office_id\s*\?\?\s*["']default["']/,
  "document remaining webhook fallback for future cleanup",
);
console.log("  ✅ webhook still uses metadata.office_id ?? 'default' (follow-up, out of scope)");

console.log("\n═══ CI / integration wiring ═══");
const pkg = readRepo("artifacts/api-server/package.json");
assert.match(pkg, /test:gateway-032/);
const ci = readRepo(".github/workflows/ci.yml");
assert.match(ci, /test:gateway-032/);
const integ = readRepo("scripts/db/test-migrations.integration.sh");
assert.match(integ, /MIGRATION_032|scenario_migration_032/);
assert.match(integ, /apply_migration_032/);
console.log("  ✅ package.json + CI + integration harness wired");

console.log("\n✅ gatewaySettingsSchemaAuthority032 tests passed\n");
