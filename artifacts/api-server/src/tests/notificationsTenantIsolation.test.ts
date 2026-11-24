/**
 * Recovery P0 — Notification cross-tenant isolation.
 * Run: pnpm --filter @workspace/api-server run test:notifications-tenant
 *
 * Static contract: GET /notifications and plan-notifications MUST use
 * requireAuthWithTenant and office_id (or employee join) scoping.
 * Tables without office_id must not be queried unscoped.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const API = join(HERE, "..");
const readSrc = (rel: string) => readFileSync(join(API, rel), "utf8");

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

console.log("\n═══ GET /notifications tenant contract ═══");
{
  const src = readSrc("modules/operations/notifications.ts");
  const code = stripComments(src);

  assert.match(src, /requireAuthWithTenant/);
  assert.match(
    code,
    /router\.get\(\s*["']\/notifications["']\s*,\s*requireAuthWithTenant/,
    "GET /notifications must use requireAuthWithTenant",
  );

  /* Must not register the list route with bare requireAuth */
  assert.doesNotMatch(
    code,
    /router\.get\(\s*["']\/notifications["']\s*,\s*requireAuth\s*,/,
    "GET /notifications must not use bare requireAuth",
  );

  /* Office-owned tables must appear with office_id = tenantId */
  for (const table of [
    "client_invoices",
    "contracts",
    "events",
    "plan_notifications",
    "office_ai_credits",
    "cases",
  ]) {
    assert.match(
      code,
      new RegExp(`FROM\\s+${table}[\\s\\S]{0,400}office_id\\s*=\\s*\\$\\{tenantId\\}`),
      `${table} query must filter office_id = \${tenantId}`,
    );
  }

  /* Leaves scoped via employees join */
  assert.match(
    code,
    /FROM\s+leaves\s+l[\s\S]{0,200}employees\s+e[\s\S]{0,120}e\.office_id\s*=\s*\$\{tenantId\}/,
    "leaves must join employees with e.office_id = tenantId",
  );

  /* Fail-closed: do not query invitations/messages unscoped */
  assert.doesNotMatch(
    code,
    /FROM\s+invitations\b/,
    "must not query invitations (no office_id) from notifications aggregator",
  );
  assert.doesNotMatch(
    code,
    /FROM\s+messages\b/,
    "must not query messages (no office_id) from notifications aggregator",
  );

  /* Platform / missing tenant returns empty — never global dump */
  assert.match(src, /tenantId === ["']platform["']/);
  assert.match(src, /notifications:\s*\[\s*\]/);

  console.log("  ✅ GET /notifications requireAuthWithTenant + office_id scoping");
}

console.log("\n═══ plan-notifications tenant contract ═══");
{
  const src = readSrc("modules/financial/subscription.ts");
  const code = stripComments(src);

  assert.match(
    code,
    /router\.get\(\s*["']\/office\/plan-notifications["']\s*,\s*requireAuthWithTenant/,
    "GET plan-notifications must use requireAuthWithTenant",
  );
  assert.match(
    code,
    /FROM\s+plan_notifications[\s\S]{0,200}office_id\s*=\s*\$\{officeId\}/,
    "plan-notifications SELECT must filter office_id",
  );
  assert.match(
    code,
    /router\.patch\(\s*["']\/office\/plan-notifications\/read-all["']\s*,\s*requireAuthWithTenant/,
    "PATCH read-all must use requireAuthWithTenant",
  );
  assert.match(
    code,
    /UPDATE\s+plan_notifications\s+SET\s+is_read\s*=\s*TRUE\s+WHERE\s+office_id\s*=\s*\$\{officeId\}/,
    "read-all UPDATE must filter office_id",
  );

  assert.doesNotMatch(
    code,
    /router\.get\(\s*["']\/office\/plan-notifications["']\s*,\s*requireAuth\s*,/,
    "GET plan-notifications must not use bare requireAuth",
  );

  console.log("  ✅ plan-notifications list/update office-scoped");
}

console.log("\n═══ settings use requireAuthWithTenant ═══");
{
  const src = readSrc("modules/operations/notifications.ts");
  const code = stripComments(src);
  assert.match(
    code,
    /router\.get\(\s*["']\/notifications\/settings["']\s*,\s*requireAuthWithTenant/,
  );
  assert.match(
    code,
    /router\.patch\(\s*["']\/notifications\/settings["']\s*,\s*requireAuthWithTenant/,
  );
  console.log("  ✅ settings GET/PATCH requireAuthWithTenant");
}

console.log("\n✅ notificationsTenantIsolation: all checks passed\n");
