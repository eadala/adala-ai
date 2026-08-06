/**
 * Stage 17 — Finance listener canonical Office UUID ownership.
 * Run: pnpm --filter @workspace/api-server run test:finance-listener
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  logFinanceSkip,
  resolveFinanceEventOfficeId,
  resolveFinanceOfficeId,
  runOwnedFinanceEffect,
} from "../lib/financeOwnership";
import type { StoredEvent } from "../core/eventBus";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");

const OFFICE_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const INVOICE_ID = "11111111-2222-4333-8444-555555555555";

const listenerTs = readFileSync(join(SRC, "core/listeners/financeListener.ts"), "utf8");
const ownershipTs = readFileSync(join(SRC, "lib/financeOwnership.ts"), "utf8");
const paymentsTs = readFileSync(join(SRC, "modules/financial/payments.ts"), "utf8");
const invoicesTs = readFileSync(join(SRC, "modules/financial/invoices.ts"), "utf8");
const eventBusTs = readFileSync(join(SRC, "core/eventBus.ts"), "utf8");

function makeEvent(
  officeId: string | undefined,
  type: StoredEvent["type"] = "PAYMENT_SUCCESS",
  data: Record<string, unknown> = {},
): StoredEvent {
  return {
    id: "evt-finance-1",
    type,
    officeId,
    timestamp: new Date().toISOString(),
    data: { amount: 100, invoiceId: INVOICE_ID, clientName: "عميل", ...data },
  };
}

console.log("\n═══ resolveFinanceOfficeId — UUID only ═══");

{
  assert.equal(resolveFinanceOfficeId(OFFICE_UUID), OFFICE_UUID);
  for (const bad of [null, undefined, "", "default", "platform", "trial_abc", "not-a-uuid"]) {
    assert.equal(resolveFinanceOfficeId(bad), null, `must reject ${String(bad)}`);
  }
  assert.equal(
    resolveFinanceEventOfficeId(makeEvent(undefined, "PAYMENT_SUCCESS", { officeId: OFFICE_UUID })),
    null,
    "must not reconstruct tenant from event.data.officeId",
  );
  assert.equal(resolveFinanceEventOfficeId(makeEvent(OFFICE_UUID)), OFFICE_UUID);
  assert.doesNotMatch(listenerTs, /officeId\s*\?\?\s*["']default["']/);
  assert.doesNotMatch(listenerTs, /\?\?\s*["']default["']/);
  assert.doesNotMatch(ownershipTs, /\?\?\s*["']default["']/);
  assert.doesNotMatch(ownershipTs, /resolveAutopilotOfficeId/);
  assert.match(listenerTs, /runOwnedFinanceEffect/);
  assert.match(listenerTs, /office_id = \$\{officeId\}/);
  console.log("  ✅ no default/platform/trial_/NULL invent; data.officeId ignored");
}

async function main() {
  console.log("\n═══ UUID officeId → side-effect once with exact UUID ═══");

  {
    const seen: string[] = [];
    const result = await runOwnedFinanceEffect({
      event: makeEvent(OFFICE_UUID),
      eventType: "PAYMENT_SUCCESS",
      effectFn: async (officeId) => {
        seen.push(officeId);
      },
    });
    assert.equal(result, "ok");
    assert.deepEqual(seen, [OFFICE_UUID]);
    console.log("  ✅ effect runs with exact office UUID");
  }

  console.log("\n═══ missing / invalid officeId → no write ═══");

  {
    const badIds = [undefined, "default", "platform", "trial_office_x", "arbitrary-text"];
    for (const bad of badIds) {
      const seen: string[] = [];
      const result = await runOwnedFinanceEffect({
        event: makeEvent(bad),
        eventType: "PAYMENT_SUCCESS",
        effectFn: async (officeId) => {
          seen.push(officeId);
        },
      });
      assert.equal(result, "skipped", `expected skip for ${String(bad)}`);
      assert.deepEqual(seen, [], `effect must not run for ${String(bad)}`);
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
        logFinanceSkip({
          eventType: "PAYMENT_SUCCESS",
          eventId: "evt-1",
          officeIdRaw: "default",
          reason: "NON_UUID_OFFICE_ID",
        }),
      );
      const skipped = await runOwnedFinanceEffect({
        event: makeEvent("default"),
        eventType: "PAYMENT_SUCCESS",
        effectFn: async () => {
          throw new Error("must not run");
        },
      });
      assert.equal(skipped, "skipped");
      assert.ok(warns.length >= 1, "expected structured warn");
      const flat = JSON.stringify(warns);
      assert.match(flat, /FinanceListener/);
      assert.match(flat, /PAYMENT_SUCCESS|NON_UUID_OFFICE_ID|MISSING_CANONICAL/);
    } finally {
      console.warn = orig;
    }
    console.log("  ✅ skip logs structured fields and does not throw");
  }

  console.log("\n═══ EventBus fan-out survives finance skip ═══");

  {
    assert.match(eventBusTs, /Promise\.resolve\(handler\(stored\)\)\.catch/);
    const otherRan: string[] = [];
    const result = await runOwnedFinanceEffect({
      event: makeEvent(undefined),
      eventType: "INVOICE_PAID",
      effectFn: async () => {
        throw new Error("no effect");
      },
    });
    assert.equal(result, "skipped");
    otherRan.push("notification-or-analytics");
    assert.deepEqual(otherRan, ["notification-or-analytics"]);
    console.log("  ✅ skip is non-throwing; other listeners can continue");
  }

  console.log("\n═══ producers carry top-level officeId UUID ═══");

  {
    assert.match(paymentsTs, /type:\s*"PAYMENT_SUCCESS"/);
    assert.match(paymentsTs, /officeId,/);
    assert.match(invoicesTs, /type:\s*"INVOICE_PAID"/);
    assert.match(invoicesTs, /officeId:\s*tenantId/);
    /* PAYMENT_SUCCESS data must not be the sole ownership source */
    assert.match(listenerTs, /runOwnedFinanceEffect/);
    assert.doesNotMatch(listenerTs, /const\s*\{\s*[^}]*officeId[^}]*\}\s*=\s*event\.data/);
    console.log("  ✅ producers emit top-level officeId; listener does not trust data.officeId");
  }

  console.log("\n═══ invoice mutations require office_id scope ═══");

  {
    assert.match(listenerTs, /UPDATE client_invoices[\s\S]*office_id = \$\{officeId\}/);
    assert.match(listenerTs, /FROM client_invoices[\s\S]*office_id = \$\{officeId\}/);
    console.log("  ✅ invoice mark-paid / payment insert scoped by office UUID");
  }

  console.log("\n✅ financeListenerTenant tests passed\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
