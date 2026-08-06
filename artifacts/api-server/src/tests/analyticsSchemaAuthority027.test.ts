/**
 * Stage 16.5 — Analytics listener canonical Office UUID + Migration 027.
 * Run: pnpm --filter @workspace/api-server run test:analytics-027
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  logAnalyticsSkip,
  resolveAnalyticsOfficeId,
  trackOwnedAnalyticsEvent,
} from "../lib/analyticsOwnership";
import type { StoredEvent } from "../core/eventBus";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..", "..");
const SRC = join(HERE, "..");

const OFFICE_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";

const migPath = join(
  ROOT,
  "artifacts/api-server/migrations/027_event_daily_counts_schema_authority.sql",
);
const preflightPath = join(ROOT, "scripts/db/preflight-migration-027.sql");
const mig = readFileSync(migPath, "utf8");
const preflight = readFileSync(preflightPath, "utf8");
const listenerTs = readFileSync(join(SRC, "core/listeners/analyticsListener.ts"), "utf8");
const ownershipTs = readFileSync(join(SRC, "lib/analyticsOwnership.ts"), "utf8");
const eventBusTs = readFileSync(join(SRC, "core/eventBus.ts"), "utf8");
const enterpriseTs = readFileSync(join(SRC, "modules/jlwm/enterpriseReport.ts"), "utf8");
const integ = readFileSync(join(ROOT, "scripts/db/test-migrations.integration.sh"), "utf8");
const expectedTables = readFileSync(join(ROOT, "scripts/db/expected-tables-p0.txt"), "utf8");
const expectedCols = readFileSync(join(ROOT, "scripts/db/expected-columns-p0.txt"), "utf8");

function makeEvent(officeId: string | undefined, extra: Partial<StoredEvent> = {}): StoredEvent {
  return {
    id: "evt-analytics-1",
    type: "CASE_CREATED",
    officeId,
    timestamp: new Date().toISOString(),
    data: {},
    ...extra,
  };
}

console.log("\n═══ migration 027 + preflight + P0 inventory ═══");

assert.ok(existsSync(migPath), "027_event_daily_counts_schema_authority.sql must exist");
assert.ok(existsSync(preflightPath), "preflight-migration-027.sql must exist");
assert.match(mig, /CREATE TABLE IF NOT EXISTS event_daily_counts/);
assert.match(mig, /office_id\s+TEXT NOT NULL\s*,/);
assert.doesNotMatch(mig, /office_id\s+TEXT NOT NULL DEFAULT\s*'default'/i);
assert.match(mig, /ADD COLUMN IF NOT EXISTS/);
assert.match(mig, /DROP DEFAULT/);
assert.match(mig, /uq_event_daily_counts_type_office_date|UNIQUE \(event_type, office_id, event_date\)/);
assert.match(mig, /idx_event_daily_counts_office_id/);
assert.match(mig, /idx_event_daily_counts_office_date/);
assert.match(mig, /idx_event_daily_counts_event_date/);
assert.match(mig, /idx_event_daily_counts_event_type/);
assert.doesNotMatch(mig, /DROP TABLE/i);
assert.doesNotMatch(mig, /DROP COLUMN/i);
assert.match(preflight, /READ-ONLY|SELECT only/i);
assert.match(preflight, /default_office_rows|office_id = 'default'/);
assert.match(preflight, /null_office_id|non_uuid_office_id/);
assert.match(preflight, /duplicate upsert-key|HAVING COUNT/);
assert.match(preflight, /chosen_action/);
assert.doesNotMatch(preflight, /^\s*(CREATE|ALTER|DROP)\b/im);
assert.match(integ, /scenario_migration_027_event_daily_counts/);
assert.match(integ, /MIGRATION_027/);
assert.match(expectedTables, /^event_daily_counts$/m);
assert.match(expectedCols, /^event_daily_counts\.office_id$/m);
assert.match(expectedCols, /^event_daily_counts\.event_type$/m);
console.log("  ✅ migration 027 + preflight + harness + P0 inventory");

console.log("\n═══ Runtime DDL removed from analyticsListener ═══");

assert.doesNotMatch(listenerTs, /CREATE TABLE IF NOT EXISTS event_daily_counts/);
assert.doesNotMatch(listenerTs, /ensureEventCountsTable/);
assert.doesNotMatch(listenerTs, /ALTER TABLE event_daily_counts/);
assert.doesNotMatch(listenerTs, /officeId\s*\?\?\s*["']default["']/);
assert.doesNotMatch(listenerTs, /\?\?\s*["']default["']/);
assert.match(listenerTs, /trackOwnedAnalyticsEvent/);
assert.match(ownershipTs, /classifyTenantId/);
assert.match(ownershipTs, /toUuid/);
assert.doesNotMatch(ownershipTs, /resolveAutopilotOfficeId/);
assert.doesNotMatch(listenerTs, /resolveAutopilotOfficeId/);
console.log("  ✅ no Runtime DDL; no Autopilot-named helper; no ?? default");

console.log("\n═══ resolveAnalyticsOfficeId — UUID only ═══");

{
  assert.equal(resolveAnalyticsOfficeId(OFFICE_UUID), OFFICE_UUID);
  for (const bad of [
    null,
    undefined,
    "",
    "default",
    "platform",
    "trial_abc",
    "trial_office_x",
    "not-a-uuid",
    "arbitrary-text",
  ]) {
    assert.equal(resolveAnalyticsOfficeId(bad), null, `must reject ${String(bad)}`);
  }
  console.log("  ✅ missing/default/platform/trial_/text rejected");
}

async function main() {
  console.log("\n═══ valid UUID upserts exactly once ═══");

  {
    const upserts: Array<{ officeId: string; eventType: string }> = [];
    const result = await trackOwnedAnalyticsEvent({
      event: makeEvent(OFFICE_UUID),
      upsertFn: async (officeId, eventType) => {
        upserts.push({ officeId, eventType });
      },
    });
    assert.equal(result, "tracked");
    assert.deepEqual(upserts, [{ officeId: OFFICE_UUID, eventType: "CASE_CREATED" }]);
    console.log("  ✅ tracked with exact office UUID once");
  }

  console.log("\n═══ invalid owner → no write ═══");

  {
    const badIds = [undefined, "default", "platform", "trial_office_x", "arbitrary-text", null as unknown as undefined];
    for (const bad of badIds) {
      const upserts: string[] = [];
      const result = await trackOwnedAnalyticsEvent({
        event: makeEvent(bad as string | undefined),
        upsertFn: async (officeId) => {
          upserts.push(officeId);
        },
      });
      assert.equal(result, "skipped", `expected skip for ${String(bad)}`);
      assert.deepEqual(upserts, [], `upsert must not run for ${String(bad)}`);
    }
    console.log("  ✅ missing/default/platform/trial_/text skip with no write");
  }

  console.log("\n═══ structured warn; EventBus fan-out continues ═══");

  {
    const warns: unknown[] = [];
    const orig = console.warn;
    console.warn = (...args: unknown[]) => {
      warns.push(args);
    };
    try {
      assert.doesNotThrow(() =>
        logAnalyticsSkip({
          eventType: "CASE_CREATED",
          eventId: "evt-1",
          officeIdRaw: "default",
          reason: "NON_UUID_OFFICE_ID",
        }),
      );
      const skipped = await trackOwnedAnalyticsEvent({
        event: makeEvent("default"),
        upsertFn: async () => {
          throw new Error("must not upsert");
        },
      });
      assert.equal(skipped, "skipped");
      assert.ok(warns.length >= 1, "expected structured warn");
      const flat = JSON.stringify(warns);
      assert.match(flat, /AnalyticsListener/);
      assert.match(flat, /CASE_CREATED|NON_UUID_OFFICE_ID|MISSING_CANONICAL/);
    } finally {
      console.warn = orig;
    }

    assert.match(eventBusTs, /Promise\.resolve\(handler\(stored\)\)\.catch/);
    const otherRan: string[] = [];
    const result = await trackOwnedAnalyticsEvent({
      event: makeEvent(undefined),
      upsertFn: async () => {
        throw new Error("no upsert");
      },
    });
    assert.equal(result, "skipped");
    otherRan.push("notification-or-finance");
    assert.deepEqual(otherRan, ["notification-or-finance"]);
    console.log("  ✅ skip logs structured fields and does not throw into fan-out");
  }

  console.log("\n═══ existing UUID analytics reads still scoped ═══");

  {
    assert.match(enterpriseTs, /FROM event_daily_counts WHERE office_id=\$\{officeId\}/);
    console.log("  ✅ JLWM enterpriseReport still filters by office_id");
  }

  console.log("\n═══ ordering after 026 ═══");

  assert.ok(
    "026_promo_schema_authority.sql" < "027_event_daily_counts_schema_authority.sql",
    "027 must lexicographically follow 026",
  );
  console.log("  ✅ 027 sorts after 026");

  console.log("\n✅ analyticsSchemaAuthority027 tests passed\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
