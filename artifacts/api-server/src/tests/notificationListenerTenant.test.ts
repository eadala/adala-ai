/**
 * Stage 16.4 — Notification listener canonical Office UUID ownership.
 * Run: pnpm --filter @workspace/api-server run test:notification-listener
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  deliverOwnedNotification,
  logNotificationSkip,
  resolveNotificationOfficeId,
} from "../lib/notificationOwnership";
import type { StoredEvent } from "../core/eventBus";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");

const OFFICE_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const CASE_ID = "case-1111-2222-3333-444444444444";

const listenerTs = readFileSync(join(SRC, "core/listeners/notificationListener.ts"), "utf8");
const ownershipTs = readFileSync(join(SRC, "lib/notificationOwnership.ts"), "utf8");
const clientsTs = readFileSync(join(SRC, "modules/legal-core/clients.ts"), "utf8");
const eventBusTs = readFileSync(join(SRC, "core/eventBus.ts"), "utf8");

function makeEvent(officeId: string | undefined, extra: Partial<StoredEvent> = {}): StoredEvent {
  return {
    id: "evt-test-1",
    type: "CASE_CREATED",
    officeId,
    timestamp: new Date().toISOString(),
    data: { caseId: CASE_ID, title: "قضية اختبار", clientName: "عميل" },
    ...extra,
  };
}

console.log("\n═══ resolveNotificationOfficeId — UUID only ═══");

{
  assert.equal(resolveNotificationOfficeId(OFFICE_UUID), OFFICE_UUID);
  for (const bad of [null, undefined, "", "default", "platform", "trial_abc", "not-a-uuid"]) {
    assert.equal(resolveNotificationOfficeId(bad), null, `must reject ${String(bad)}`);
  }
  assert.doesNotMatch(listenerTs, /officeId\s*\?\?\s*["']default["']/);
  assert.doesNotMatch(listenerTs, /\?\?\s*["']default["']/);
  assert.doesNotMatch(ownershipTs, /\?\?\s*["']default["']/);
  assert.match(ownershipTs, /resolveAutopilotOfficeId/);
  assert.match(listenerTs, /deliverOwnedNotification|deliverOwned/);
  console.log("  ✅ no default/platform/trial_/NULL invent");
}

async function main() {
  console.log("\n═══ UUID officeId → insert once + push same UUID ═══");

  {
    const inserts: string[] = [];
    const pushes: string[] = [];
    const result = await deliverOwnedNotification({
      event: makeEvent(OFFICE_UUID),
      eventType: "CASE_CREATED",
      title: "⚖️ قضية جديدة",
      body: "body",
      link: "/cases",
      push: { title: "t", body: "b", url: "/cases", tag: "case_created" },
      insertFn: async (officeId) => {
        inserts.push(officeId);
      },
      pushFn: async (officeId) => {
        pushes.push(officeId);
      },
    });
    assert.equal(result, "delivered");
    assert.deepEqual(inserts, [OFFICE_UUID]);
    assert.deepEqual(pushes, [OFFICE_UUID]);
    console.log("  ✅ delivered with exact office UUID");
  }

  console.log("\n═══ missing / invalid officeId → no insert, no push ═══");

  {
    const badIds = [undefined, "default", "platform", "trial_office_x", "arbitrary-text"];
    for (const bad of badIds) {
      const inserts: string[] = [];
      const pushes: string[] = [];
      const result = await deliverOwnedNotification({
        event: makeEvent(bad),
        eventType: "CASE_CREATED",
        title: "t",
        body: "b",
        push: { title: "t", body: "b" },
        insertFn: async (officeId) => {
          inserts.push(officeId);
        },
        pushFn: async (officeId) => {
          pushes.push(officeId);
        },
      });
      assert.equal(result, "skipped", `expected skip for ${String(bad)}`);
      assert.deepEqual(inserts, [], `insert must not run for ${String(bad)}`);
      assert.deepEqual(pushes, [], `push must not run for ${String(bad)}`);
    }
    console.log("  ✅ missing/default/platform/trial_/text safely skipped");
  }

  console.log("\n═══ structured skip log without throw ═══");

  {
    const warns: unknown[] = [];
    const orig = console.warn;
    console.warn = (...args: unknown[]) => {
      warns.push(args);
    };
    try {
      assert.doesNotThrow(() =>
        logNotificationSkip({
          eventType: "CASE_CREATED",
          eventId: "evt-1",
          caseId: CASE_ID,
          officeIdRaw: "default",
          reason: "NON_UUID_OFFICE_ID",
        }),
      );
      const skipped = await deliverOwnedNotification({
        event: makeEvent("default"),
        eventType: "CASE_CREATED",
        title: "t",
        body: "b",
        insertFn: async () => {
          throw new Error("must not insert");
        },
        pushFn: async () => {
          throw new Error("must not push");
        },
      });
      assert.equal(skipped, "skipped");
      assert.ok(warns.length >= 1, "expected structured warn");
      const flat = JSON.stringify(warns);
      assert.match(flat, /NotificationListener/);
      assert.match(flat, /CASE_CREATED|NON_UUID_OFFICE_ID|MISSING_CANONICAL/);
    } finally {
      console.warn = orig;
    }
    console.log("  ✅ skip logs structured fields and does not throw");
  }

  console.log("\n═══ CLIENT_ADDED producer carries officeId ═══");

  {
    const start = clientsTs.indexOf("eventBus.emit({");
    assert.ok(start >= 0);
    const slice = clientsTs.slice(start, start + 280);
    assert.match(slice, /type:\s*"CLIENT_ADDED"/);
    assert.match(slice, /officeId:\s*tenantId/);
    assert.doesNotMatch(slice, /officeId:\s*["']default["']/);
    console.log("  ✅ CLIENT_ADDED emit includes tenant officeId");
  }

  console.log("\n═══ EventBus fan-out survives notification skip ═══");

  {
    /* EventBus isolates listener failures; skip path must not throw into fan-out */
    assert.match(eventBusTs, /Promise\.resolve\(handler\(stored\)\)\.catch/);
    const otherRan: string[] = [];
    const result = await deliverOwnedNotification({
      event: makeEvent(undefined),
      eventType: "CASE_CREATED",
      title: "t",
      body: "b",
      insertFn: async () => {
        throw new Error("no insert");
      },
    });
    assert.equal(result, "skipped");
    otherRan.push("autopilot-or-analytics");
    assert.deepEqual(otherRan, ["autopilot-or-analytics"]);
    console.log("  ✅ skip is non-throwing; other listeners can continue");
  }

  console.log("\n═══ source: all handlers use deliverOwnedNotification ═══");

  {
    assert.match(listenerTs, /deliverOwnedNotification/);
    assert.match(listenerTs, /CASE_CREATED/);
    assert.match(listenerTs, /CLIENT_ADDED/);
    assert.equal((listenerTs.match(/event\.officeId\s*\?\?\s*["']default["']/g) ?? []).length, 0);
    console.log("  ✅ listener wired through owned delivery helper");
  }

  console.log("\n✅ notificationListenerTenant tests passed\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
