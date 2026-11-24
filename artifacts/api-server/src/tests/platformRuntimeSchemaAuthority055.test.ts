/**
 * Stage 9 — Migration 055 Platform Runtime batch 2 schema authority.
 * Run: pnpm --filter @workspace/api-server run test:platform-runtime-055
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const API = join(HERE, "..");

const readRepo = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const readSrc = (rel: string) => readFileSync(join(API, rel), "utf8");
const stripComments = (sql: string) => sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

console.log("\n═══ Migration 055 presence + Platform Runtime B2 contract ═══");
const migPath = "artifacts/api-server/migrations/055_platform_runtime_b2_schema_authority.sql";
const prePath = "scripts/db/preflight-migration-055.sql";
assert.ok(existsSync(join(ROOT, migPath)), "055 migration present");
assert.ok(existsSync(join(ROOT, prePath)), "055 preflight present");
const mig = readRepo(migPath);
const pre = readRepo(prePath);

for (const table of [
  "developer_impersonation",
  "ghost_access_log",
  "developer_accounts",
  "tenant_audit_logs",
  "office_isolation_config",
  "organization_units",
  "platform_integrations",
  "office_integration_status",
  "integration_requests",
  "demo_sync_log",
  "pcc_command_log",
  "office_themes",
  "tenant_bindings",
  "tenant_binding_history",
  "tenant_audit_archive",
]) {
  assert.match(mig, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
}
assert.match(mig, /UNIQUE\s*\(\s*super_admin_user_id\s*\)/);
assert.match(mig, /UNIQUE\s*\(\s*office_id\s*,\s*integration_key\s*\)/);
assert.match(mig, /idx_tenant_audit_time/);
assert.match(mig, /idx_ir_status/);
assert.match(mig, /idx_tbh_version/);
assert.match(mig, /idx_taa_tenant_period/);
assert.match(mig, /organization_units_parent_id_fkey/);
assert.match(mig, /INCOMPATIBLE_INDEX/);
assert.match(mig, /PLATFORM_RUNTIME_B2_SCHEMA_READY/);
assert.match(mig, /to_regclass\('public\.tenant_audit_archive'\)/);
{
  const sqlOnly = stripComments(mig);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnly, /(?:^|;)\s*DROP\s+INDEX\b/im);
}
console.log("  ✅ 055 owns Platform Runtime B2 tables + indexes + UNIQUEs + FK");

console.log("\n═══ Preflight 055 SELECT-only ═══");
assert.match(pre, /Does not CREATE \/ ALTER \/ DROP durable|SELECT-only/i);
assert.match(pre, /PLATFORM_RUNTIME_B2_SCHEMA_READY/);
assert.match(pre, /developer_accounts\(email\)/);
assert.match(pre, /office_integration_status\(office_id, integration_key\)/);
{
  const sqlOnlyPre = stripComments(pre);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*CREATE\s+TABLE\b/im);
  assert.doesNotMatch(sqlOnlyPre, /(?:^|;)\s*ALTER\s+TABLE\b/im);
}
console.log("  ✅ preflight SELECT-only; BLOCK/SAFE/ALREADY");

console.log("\n═══ Runtime DDL removed; DML / SA / tenant preserved ═══");
const developer = readSrc("modules/platform/developer.ts");
const tenantDebug = readSrc("modules/platform/tenantDebug.ts");
const infrastructure = readSrc("modules/platform/infrastructure.ts");
const orgStructure = readSrc("modules/platform/orgStructure.ts");
const managedIntegrations = readSrc("modules/platform/managedIntegrations.ts");
const demoSync = readSrc("modules/platform/demo-sync.ts");
const platformCommand = readSrc("modules/platform/platformCommand.ts");
const themeBuilder = readSrc("modules/platform/themeBuilder.ts");
const tenantVersioning = readSrc("core/tenant/tenantVersioning.ts");

assert.doesNotMatch(developer, /CREATE TABLE IF NOT EXISTS developer_impersonation/);
assert.doesNotMatch(developer, /CREATE TABLE IF NOT EXISTS ghost_access_log/);
assert.match(developer, /to_regclass\('public\.developer_impersonation'\)/);
assert.match(developer, /ON CONFLICT \(super_admin_user_id\) DO UPDATE/);
assert.match(developer, /ON CONFLICT \(email\) DO UPDATE/);

assert.doesNotMatch(tenantDebug, /CREATE TABLE IF NOT EXISTS tenant_audit_logs/);
assert.doesNotMatch(tenantDebug, /CREATE INDEX IF NOT EXISTS idx_tenant_audit/);
assert.match(tenantDebug, /to_regclass\('public\.tenant_audit_logs'\)/);
assert.match(tenantDebug, /requireSuperAdmin|requireSA/);

assert.doesNotMatch(infrastructure, /CREATE TABLE IF NOT EXISTS office_isolation_config/);
assert.match(infrastructure, /to_regclass\('public\.office_isolation_config'\)/);
assert.match(infrastructure, /requireSuperAdmin|adminOnly/);

assert.doesNotMatch(orgStructure, /CREATE TABLE IF NOT EXISTS organization_units/);
assert.match(orgStructure, /to_regclass\('public\.organization_units'\)/);
assert.match(orgStructure, /requireAuthWithTenant/);

assert.doesNotMatch(managedIntegrations, /CREATE TABLE IF NOT EXISTS platform_integrations/);
assert.doesNotMatch(managedIntegrations, /CREATE INDEX IF NOT EXISTS idx_ois_office/);
assert.match(managedIntegrations, /to_regclass\('public\.platform_integrations'\)/);
assert.match(managedIntegrations, /ON CONFLICT \(key\) DO NOTHING/);
assert.match(managedIntegrations, /office_id/);

assert.doesNotMatch(demoSync, /CREATE TABLE IF NOT EXISTS demo_sync_log/);
assert.match(demoSync, /to_regclass\('public\.demo_sync_log'\)/);

assert.doesNotMatch(platformCommand, /CREATE TABLE IF NOT EXISTS pcc_command_log/);
assert.match(platformCommand, /to_regclass\('public\.pcc_command_log'\)/);
assert.match(platformCommand, /requireSuperAdmin|pccOnly/);

assert.doesNotMatch(themeBuilder, /CREATE TABLE IF NOT EXISTS office_themes/);
assert.match(themeBuilder, /to_regclass\('public\.office_themes'\)/);
assert.match(themeBuilder, /INSERT INTO office_themes/);

assert.doesNotMatch(tenantVersioning, /CREATE TABLE IF NOT EXISTS tenant_bindings/);
assert.doesNotMatch(tenantVersioning, /CREATE INDEX IF NOT EXISTS idx_tb_user/);
assert.match(tenantVersioning, /to_regclass\('public\.tenant_bindings'\)/);
assert.match(tenantVersioning, /ON CONFLICT \(user_id\)/);
assert.match(tenantVersioning, /ON CONFLICT \(tenant_id, period\)/);
assert.match(tenantVersioning, /DELETE FROM tenant_audit_logs/);
console.log("  ✅ Runtime CREATE/INDEX gone; readiness + DML + SA kept");

console.log("\n═══ Wiring ═══");
assert.match(readRepo("artifacts/api-server/package.json"), /test:platform-runtime-055/);
assert.match(readRepo(".github/workflows/ci.yml"), /test:platform-runtime-055/);
assert.match(readRepo("scripts/db/test-migrations.integration.sh"), /MIGRATION_055|scenario_migration_055/);
assert.match(readRepo("scripts/db/expected-tables-p0.txt"), /^tenant_bindings$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^developer_accounts\.email$/m);
assert.match(readRepo("scripts/db/expected-columns-p0.txt"), /^tenant_bindings\.user_id$/m);
assert.doesNotMatch(readRepo("scripts/db/boot-created-tables.txt"), /^tenant_bindings$/m);
console.log("  ✅ wiring complete");

console.log("\n✅ platformRuntimeSchemaAuthority055: all checks passed\n");
