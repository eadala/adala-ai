/**
 * Batch12 cohesion — subscription / push / promo tenant gates
 * Run: node src/tests/tenantCohesionBatch12.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

const sub = readFileSync(join(SRC, "modules/financial/subscription.ts"), "utf8");
assert.match(sub, /router\.get\("\/office\/subscription", requireAuthWithTenant/);
assert.match(sub, /router\.get\("\/office\/plan-notifications", requireAuthWithTenant/);
assert.match(sub, /WHERE office_id = \$\{tid\}/);
assert.match(sub, /eq\(officePageTable\.id/);
assert.doesNotMatch(sub, /from\(officePageTable\)\.limit\(1\)/);
assert.doesNotMatch(sub, /resolveTenantId/);

const push = readFileSync(join(SRC, "modules/integrations/push.ts"), "utf8");
assert.match(push, /router\.post\("\/push\/subscribe", requireAuthWithTenant/);
assert.match(push, /router\.post\("\/push\/test", requireAuthWithTenant/);
assert.doesNotMatch(push, /OR office_id = \$\{officeId\}/);

const promo = readFileSync(join(SRC, "modules/financial/promo.ts"), "utf8");
assert.match(promo, /router\.post\("\/promo\/redeem", requireAuthWithTenant/);
assert.match(promo, /router\.get\("\/promo\/my-gift", requireAuthWithTenant/);
assert.match(promo, /INSERT INTO gift_subscriptions \(office_id/);
assert.match(promo, /WHERE gs\.office_id = \$\{tid\}/);

console.log("✅ tenantCohesionBatch12: subscription/push/promo scoped");
