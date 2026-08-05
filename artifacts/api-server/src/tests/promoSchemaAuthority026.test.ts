/**
 * Stage 16.3 — Promo schema authority (Migration 026).
 * Run: pnpm --filter @workspace/api-server run test:promo-026
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SRC = join(HERE, "..");

const migPath = join(ROOT, "artifacts/api-server/migrations/026_promo_schema_authority.sql");
const preflightPath = join(ROOT, "scripts/db/preflight-migration-026.sql");
const mig = readFileSync(migPath, "utf8");
const preflight = readFileSync(preflightPath, "utf8");
const promoTs = readFileSync(join(SRC, "modules/financial/promo.ts"), "utf8");
const integ = readFileSync(join(ROOT, "scripts/db/test-migrations.integration.sh"), "utf8");
const expectedTables = readFileSync(join(ROOT, "scripts/db/expected-tables-p0.txt"), "utf8");

console.log("\n═══ migration 026 file present + repair patterns ═══");

assert.ok(existsSync(migPath), "026_promo_schema_authority.sql must exist");
assert.ok(existsSync(preflightPath), "preflight-migration-026.sql must exist");
assert.match(mig, /CREATE TABLE IF NOT EXISTS promo_codes/);
assert.match(mig, /CREATE TABLE IF NOT EXISTS gift_subscriptions/);
assert.match(mig, /ADD COLUMN IF NOT EXISTS code/);
assert.match(mig, /ADD COLUMN IF NOT EXISTS promo_code_id/);
assert.match(mig, /ADD COLUMN IF NOT EXISTS renewed_count/);
assert.match(mig, /uq_promo_codes_code/);
assert.match(mig, /idx_gift_subscriptions_status_end_date/);
assert.match(mig, /idx_gift_subscriptions_promo_code_id/);
assert.doesNotMatch(mig, /DROP TABLE/i);
assert.doesNotMatch(mig, /DROP COLUMN/i);
assert.match(preflight, /READ-ONLY|SELECT only/i);
assert.match(integ, /scenario_migration_026_promo/);
assert.match(integ, /MIGRATION_026/);
assert.match(expectedTables, /^promo_codes$/m);
assert.match(expectedTables, /^gift_subscriptions$/m);
console.log("  ✅ migration 026 + preflight + harness + P0 inventory");

console.log("\n═══ endpoint behavior preserved (no handler rewrite) ═══");

{
  const start = promoTs.indexOf('router.get("/promo/my-gift"');
  assert.ok(start >= 0, "GET /promo/my-gift must exist");
  const end = promoTs.indexOf("export default", start);
  const route = promoTs.slice(start, end === -1 ? undefined : end);
  assert.match(route, /requireAuth/);
  assert.match(route, /FROM gift_subscriptions gs/);
  assert.match(route, /LEFT JOIN promo_codes pc ON pc\.id = gs\.promo_code_id/);
  assert.match(route, /gs\.status = 'active' AND gs\.end_date > NOW\(\)/);
  assert.match(route, /res\.json\(row \?\? null\)/);
  assert.doesNotMatch(promoTs, /CREATE TABLE IF NOT EXISTS/);
  console.log("  ✅ my-gift SELECT shape unchanged; no Runtime DDL in promo.ts");
}

console.log("\n═══ ordering after 025 ═══");

assert.ok(
  "025_billing_schema_authority.sql" < "026_promo_schema_authority.sql",
  "026 must lexicographically follow 025",
);
console.log("  ✅ 026 sorts after 025");

console.log("\n✅ promoSchemaAuthority026 tests passed\n");
