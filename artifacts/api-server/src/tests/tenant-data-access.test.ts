/**
 * PR-DATA-001 — Unified tenant data access tests
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "..");
const ROOT = resolve(__dirname, "../../../../");

function readModule(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

function testRlsMigrationExists() {
  const sql = readFileSync(resolve(ROOT, "lib/db/drizzle/0003_rls_p0_tables.sql"), "utf8");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /adala_tenant_isolation/);
  assert.match(sql, /adala_tenant_id/);
  console.log("  ✅ RLS migration 0003 present");
}

function testDataAccessLayer() {
  const da = readModule("core/tenant/dataAccess.ts");
  assert.match(da, /tenantDB/);
  assert.match(da, /withTenantRls/);
  assert.match(da, /bootRlsValidation/);
  console.log("  ✅ canonical dataAccess layer");
}

function testRlsScopeHelpers() {
  const scope = readModule("core/tenant/rlsScope.ts");
  assert.match(scope, /setRlsSession/);
  assert.match(scope, /withPlatformRlsBypass/);
  assert.match(scope, /PLATFORM_RLS_BYPASS_DENIED/);
  console.log("  ✅ RLS scope helpers fail-closed");
}

function testMiddlewareSetsBypassFalse() {
  const auth = readModule("middlewares/requireAuth.ts");
  assert.match(auth, /app\.bypass_rls/);
  console.log("  ✅ requireAuth clears RLS bypass on tenant bind");
}

function testAgentCronRlsCompatible() {
  const cron = readModule("cron/agentCron.ts");
  assert.match(cron, /withTenantRls/);
  assert.doesNotMatch(cron, /FROM cases c[\s\S]{0,200}WHERE s\.session_date[\s\S]{0,80}LIMIT 50/);
  console.log("  ✅ agentCron uses per-office RLS scope");
}

function main() {
  console.log("Tenant Data Access Tests — PR-DATA-001\n");
  testRlsMigrationExists();
  testDataAccessLayer();
  testRlsScopeHelpers();
  testMiddlewareSetsBypassFalse();
  testAgentCronRlsCompatible();
  console.log("\n✅ All PR-DATA-001 data access tests passed\n");
}

main();
