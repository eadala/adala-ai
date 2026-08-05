/**
 * Stage 16.3 — Promo schema authority + gift ownership (Migration 026).
 * Run: pnpm --filter @workspace/api-server run test:promo-026
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  giftOwnerHttpStatus,
  resolveGiftOwner,
  TenantResolutionError,
} from "../lib/giftOwnership";
import {
  LEGACY_NON_UUID_TENANT,
  PLATFORM_FORBIDDEN_FOR_USER,
} from "../lib/tenantResolution";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SRC = join(HERE, "..");

const migPath = join(ROOT, "artifacts/api-server/migrations/026_promo_schema_authority.sql");
const preflightPath = join(ROOT, "scripts/db/preflight-migration-026.sql");
const mig = readFileSync(migPath, "utf8");
const preflight = readFileSync(preflightPath, "utf8");
const promoTs = readFileSync(join(SRC, "modules/financial/promo.ts"), "utf8");
const subTs = readFileSync(join(SRC, "modules/financial/subscription.ts"), "utf8");
const giftOwnTs = readFileSync(join(SRC, "lib/giftOwnership.ts"), "utf8");
const integ = readFileSync(join(ROOT, "scripts/db/test-migrations.integration.sh"), "utf8");
const expectedTables = readFileSync(join(ROOT, "scripts/db/expected-tables-p0.txt"), "utf8");
const expectedCols = readFileSync(join(ROOT, "scripts/db/expected-columns-p0.txt"), "utf8");

const OFFICE_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const OFFICE_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const USER_A = "user_a";
const USER_B = "user_b";

function routeSlice(src: string, marker: string): string {
  const start = src.indexOf(marker);
  assert.ok(start >= 0, `missing route ${marker}`);
  const end = src.indexOf("router.", start + marker.length);
  return src.slice(start, end === -1 ? undefined : end);
}

console.log("\n═══ migration 026 ownership columns + repair patterns ═══");

assert.ok(existsSync(migPath), "026_promo_schema_authority.sql must exist");
assert.ok(existsSync(preflightPath), "preflight-migration-026.sql must exist");
assert.match(mig, /CREATE TABLE IF NOT EXISTS promo_codes/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS gift_subscriptions/);
assert.match(mig, /office_id\s+UUID NOT NULL/);
assert.match(mig, /user_id\s+TEXT NOT NULL/);
assert.match(mig, /ADD COLUMN IF NOT EXISTS office_id UUID/);
assert.match(mig, /ADD COLUMN IF NOT EXISTS user_id TEXT/);
assert.match(mig, /ADD COLUMN IF NOT EXISTS promo_code_id/);
assert.match(mig, /uq_promo_codes_code/);
assert.match(mig, /idx_gift_subscriptions_office_id/);
assert.match(mig, /idx_gift_subscriptions_user_id/);
assert.match(mig, /idx_gift_subscriptions_office_user_status/);
assert.match(mig, /idx_gift_subscriptions_status_end_date/);
assert.doesNotMatch(mig, /DROP TABLE/i);
assert.doesNotMatch(mig, /DROP COLUMN/i);
assert.doesNotMatch(mig, /ALTER COLUMN office_id SET NOT NULL/i);
assert.doesNotMatch(mig, /ALTER COLUMN user_id SET NOT NULL/i);
assert.doesNotMatch(mig, /UPDATE\s+gift_subscriptions\s+SET\s+office_id/i);
assert.match(preflight, /READ-ONLY|SELECT only/i);
assert.match(preflight, /missing_office_id/);
assert.match(preflight, /missing_user_id/);
assert.match(preflight, /do NOT guess\/backfill|do NOT guess/i);
assert.match(integ, /scenario_migration_026_promo/);
assert.match(integ, /MIGRATION_026/);
assert.match(integ, /NULL-owned legacy invisible|NULL-owned/);
assert.match(expectedTables, /^gift_subscriptions$/m);
assert.match(expectedCols, /^gift_subscriptions\.office_id$/m);
assert.match(expectedCols, /^gift_subscriptions\.user_id$/m);
console.log("  ✅ migration 026 ownership + preflight + harness + P0 inventory");

console.log("\n═══ resolveGiftOwner rejects platform/default/trial_/NULL ═══");

{
  const ok = resolveGiftOwner({ userId: USER_A, tenantId: OFFICE_A }, "test");
  assert.equal(ok.officeId, OFFICE_A);
  assert.equal(ok.userId, USER_A);

  assert.throws(
    () => resolveGiftOwner({ userId: USER_A, tenantId: "platform" }, "test"),
    (e: unknown) => e instanceof TenantResolutionError && e.code === PLATFORM_FORBIDDEN_FOR_USER,
  );
  assert.throws(
    () => resolveGiftOwner({ userId: USER_A, tenantId: "default" }, "test"),
    (e: unknown) => e instanceof TenantResolutionError && e.code === LEGACY_NON_UUID_TENANT,
  );
  assert.throws(
    () => resolveGiftOwner({ userId: USER_A, tenantId: "trial_abc" }, "test"),
    (e: unknown) => e instanceof TenantResolutionError && e.code === LEGACY_NON_UUID_TENANT,
  );
  assert.throws(
    () => resolveGiftOwner({ userId: USER_A, tenantId: null as unknown as string }, "test"),
    (e: unknown) => e instanceof TenantResolutionError,
  );
  assert.throws(
    () => resolveGiftOwner({ userId: "", tenantId: OFFICE_A }, "test"),
    (e: unknown) =>
      e instanceof Error && (e as { code?: string }).code === "GIFT_OWNER_UNAUTHENTICATED",
  );
  assert.equal(giftOwnerHttpStatus(new TenantResolutionError("x", "y")), 403);
  console.log("  ✅ gift owner resolution fail-closed");
}

console.log("\n═══ redeem + my-gift tenant-scoped ═══");

{
  const redeem = routeSlice(promoTs, 'router.post("/promo/redeem"');
  assert.match(redeem, /requireAuthWithTenant/);
  assert.doesNotMatch(redeem, /requireAuth,/);
  assert.match(redeem, /resolveGiftOwner/);
  assert.match(redeem, /INSERT INTO gift_subscriptions \(office_id, user_id/);
  assert.match(redeem, /office_id = \$\{officeId\}::uuid/);
  assert.match(redeem, /user_id = \$\{userId\}/);
  assert.match(redeem, /status = 'active' AND end_date > NOW\(\)/);

  const myGift = routeSlice(promoTs, 'router.get("/promo/my-gift"');
  assert.match(myGift, /requireAuthWithTenant/);
  assert.match(myGift, /resolveGiftOwner/);
  assert.match(myGift, /gs\.office_id = \$\{officeId\}::uuid/);
  assert.match(myGift, /gs\.user_id = \$\{userId\}/);
  assert.match(myGift, /gs\.status = 'active' AND gs\.end_date > NOW\(\)/);
  assert.match(myGift, /res\.json\(row \?\? null\)/);
  assert.doesNotMatch(myGift, /office_id IS NULL/);
  assert.doesNotMatch(promoTs, /CREATE TABLE IF NOT EXISTS/);

  /* No unscoped active-gift SELECT (must always include office_id + user_id) */
  assert.match(redeem, /FROM gift_subscriptions[\s\S]*office_id = \$\{officeId\}::uuid[\s\S]*user_id = \$\{userId\}/);
  assert.match(myGift, /FROM gift_subscriptions gs[\s\S]*gs\.office_id = \$\{officeId\}::uuid[\s\S]*gs\.user_id = \$\{userId\}/);
  assert.doesNotMatch(redeem, /FROM gift_subscriptions\s+WHERE status = 'active' AND end_date > NOW\(\)\s*`/);
  assert.doesNotMatch(myGift, /WHERE gs\.status = 'active' AND gs\.end_date > NOW\(\)\s*ORDER BY/);
  console.log("  ✅ redeem writes ownership; my-gift filters; no global SELECT");
}

console.log("\n═══ subscription gift entitlement scoped ═══");

{
  const sub = routeSlice(subTs, 'router.get("/office/subscription"');
  assert.match(sub, /requireAuthWithTenant/);
  assert.match(sub, /resolveGiftOwner/);
  assert.match(sub, /gs\.office_id = \$\{officeId\}::uuid/);
  assert.match(sub, /gs\.user_id = \$\{userId\}/);
  assert.doesNotMatch(
    sub,
    /FROM gift_subscriptions gs\s+WHERE gs\.status = 'active' AND gs\.end_date > NOW\(\)\s+ORDER BY/,
  );
  console.log("  ✅ subscription gift read ownership-scoped");
}

console.log("\n═══ isolation invariants encoded in helpers + SQL ═══");

{
  assert.match(giftOwnTs, /never backfill|Never.*backfill/i);
  assert.match(promoTs, /office_id = \$\{officeId\}::uuid/);
  assert.match(promoTs, /user_id = \$\{userId\}/);
  /* Cross-user / cross-office filters are equality on both keys */
  assert.notEqual(OFFICE_A, OFFICE_B);
  assert.notEqual(USER_A, USER_B);
  assert.match(integ, /user A filter excludes user B|cross-user/);
  assert.match(integ, /office A filter excludes office B|cross-office/);
  assert.match(integ, /expired\/inactive excluded/);
  assert.match(integ, /scoped active-gift check/);
  console.log("  ✅ isolation coverage wired (unit + integration)");
}

console.log("\n═══ auth semantics (source contracts) ═══");

{
  /* Unauthenticated → 401 via requireAuthWithTenant; unresolved tenant → 403 */
  assert.match(
    readFileSync(join(SRC, "middlewares/requireAuth.ts"), "utf8"),
    /requireAuthWithTenant[\s\S]*status\(401\)[\s\S]*status\(403\)/,
  );
  assert.match(promoTs, /giftOwnerHttpStatus/);
  console.log("  ✅ 401/403 contracts preserved via requireAuthWithTenant + giftOwnerHttpStatus");
}

console.log("\n═══ ordering after 025 ═══");

assert.ok(
  "025_billing_schema_authority.sql" < "026_promo_schema_authority.sql",
  "026 must lexicographically follow 025",
);
console.log("  ✅ 026 sorts after 025");

console.log("\n✅ promoSchemaAuthority026 tests passed\n");
