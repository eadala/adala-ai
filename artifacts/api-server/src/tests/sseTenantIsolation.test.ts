/**
 * Stage 17 — EventBus SSE tenant isolation (P0).
 * Run: pnpm --filter @workspace/api-server run test:sse-tenant-isolation
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SseTenantHub,
  resolveSseOfficeId,
} from "../lib/sseTenantIsolation";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");

const OFFICE_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const OFFICE_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

const eventBusTs = readFileSync(join(SRC, "core/eventBus.ts"), "utf8");
const sseHubTs = readFileSync(join(SRC, "lib/sseTenantIsolation.ts"), "utf8");
const eventsRouteTs = readFileSync(join(SRC, "modules/operations/events.ts"), "utf8");

type MockRes = {
  writes: string[];
  res: {
    write: (chunk: string) => boolean;
    on: (event: string, fn: () => void) => void;
  };
  close: () => void;
};

function mockResponse(): MockRes {
  const writes: string[] = [];
  const ee = new EventEmitter();
  return {
    writes,
    res: {
      write: (chunk: string) => {
        writes.push(chunk);
        return true;
      },
      on: (event: string, fn: () => void) => {
        ee.on(event, fn);
      },
    },
    close: () => {
      ee.emit("close");
    },
  };
}

function makeEvent(officeId: string | undefined): {
  id: string;
  type: string;
  officeId?: string;
  timestamp: string;
  data: Record<string, unknown>;
} {
  return {
    id: "evt-sse-1",
    type: "CASE_CREATED",
    officeId,
    timestamp: new Date().toISOString(),
    data: { caseId: "case-1", title: "قضية حساسة" },
  };
}

function payloadsFor(mock: MockRes): unknown[] {
  return mock.writes
    .filter((w) => w.startsWith("data: "))
    .map((w) => JSON.parse(w.slice("data: ".length).trim()));
}

console.log("\n═══ resolveSseOfficeId — UUID only ═══");
{
  assert.equal(resolveSseOfficeId(OFFICE_A), OFFICE_A);
  for (const bad of [null, undefined, "", "default", "platform", "trial_abc", "not-a-uuid"]) {
    assert.equal(resolveSseOfficeId(bad), null, `must reject ${String(bad)}`);
  }
  assert.doesNotMatch(sseHubTs, /\?\?\s*["']default["']/);
  assert.doesNotMatch(eventBusTs, /officeId\s*\?\?\s*["']default["']/);
  assert.doesNotMatch(
    sseHubTs,
    /for\s*\(\s*const\s+client\s+of\s+this\.sseClients\s*\)/,
    "must not fan-out over unscoped sseClients",
  );
  assert.match(sseHubTs, /sseClientsByOffice\.get\(officeId\)/);
  assert.match(eventBusTs, /SseTenantHub/);
  assert.match(eventBusTs, /this\.sse\.broadcastSSE/);
  console.log("  ✅ no invent; EventBus delegates to SseTenantHub");
}

console.log("\n═══ /events/stream uses canonical resolveReqTenantId ═══");
{
  assert.match(eventsRouteTs, /resolveReqTenantId/);
  assert.match(eventsRouteTs, /resolveSseOfficeId/);
  assert.match(eventsRouteTs, /addSSEClient\(res,\s*userId,\s*officeId\)/);
  assert.match(eventsRouteTs, /resolveTenantId/);
  assert.doesNotMatch(eventsRouteTs, /officeId\s*\?\?\s*["']default["']/);
  console.log("  ✅ stream reuses resolveReqTenantId; UUID-only registration");
}

console.log("\n═══ office A receives A; B does not ═══");
{
  const hub = new SseTenantHub();
  const a = mockResponse();
  const b = mockResponse();
  hub.addSSEClient(a.res as never, "user-a", OFFICE_A);
  hub.addSSEClient(b.res as never, "user-b", OFFICE_B);

  hub.broadcastSSE(makeEvent(OFFICE_A));

  const aPayloads = payloadsFor(a);
  const bPayloads = payloadsFor(b);
  assert.equal(aPayloads.length, 1);
  assert.equal((aPayloads[0] as { officeId: string }).officeId, OFFICE_A);
  assert.equal(bPayloads.length, 0, "office B must not receive office A event");
  console.log("  ✅ A receives A; B isolated");
}

console.log("\n═══ office A does not receive office B ═══");
{
  const hub = new SseTenantHub();
  const a = mockResponse();
  const b = mockResponse();
  hub.addSSEClient(a.res as never, "user-a", OFFICE_A);
  hub.addSSEClient(b.res as never, "user-b", OFFICE_B);

  hub.broadcastSSE(makeEvent(OFFICE_B));

  assert.equal(payloadsFor(a).length, 0, "office A must not receive office B event");
  assert.equal(payloadsFor(b).length, 1);
  assert.equal((payloadsFor(b)[0] as { officeId: string }).officeId, OFFICE_B);
  console.log("  ✅ A isolated from B");
}

console.log("\n═══ invalid / non-UUID ownership cannot cause tenant delivery ═══");
{
  const hub = new SseTenantHub();
  const a = mockResponse();
  const badClient = mockResponse();
  hub.addSSEClient(a.res as never, "user-a", OFFICE_A);

  for (const bad of ["default", "platform", "trial_xyz", "random-text", "", null]) {
    hub.addSSEClient(badClient.res as never, "user-bad", bad);
  }
  assert.equal(hub.tenantSseOfficeCount, 1, "only OFFICE_A should have a bucket");

  for (const badOffice of [undefined, "default", "platform", "trial_xyz", "not-uuid", ""]) {
    a.writes.length = 0;
    badClient.writes.length = 0;
    hub.broadcastSSE(makeEvent(badOffice as string | undefined));
    assert.equal(payloadsFor(a).length, 0, `A must not get event officeId=${String(badOffice)}`);
    assert.equal(payloadsFor(badClient).length, 0, `bad client must not get event officeId=${String(badOffice)}`);
  }

  a.writes.length = 0;
  hub.broadcastSSE(makeEvent("default"));
  assert.equal(payloadsFor(a).length, 0);
  console.log("  ✅ non-UUID register + emit fail closed; no remap");
}

console.log("\n═══ disconnect cleanup ═══");
{
  const hub = new SseTenantHub();
  const a1 = mockResponse();
  const a2 = mockResponse();
  hub.addSSEClient(a1.res as never, "user-a1", OFFICE_A);
  hub.addSSEClient(a2.res as never, "user-a2", OFFICE_A);
  assert.equal(hub.clientCount, 2);
  assert.equal(hub.tenantSseOfficeCount, 1);

  a1.close();
  assert.equal(hub.clientCount, 1);
  assert.equal(hub.tenantSseOfficeCount, 1);

  hub.broadcastSSE(makeEvent(OFFICE_A));
  assert.equal(payloadsFor(a1).length, 0, "closed client must not receive");
  assert.equal(payloadsFor(a2).length, 1, "remaining client still receives");

  a2.close();
  assert.equal(hub.clientCount, 0);
  assert.equal(hub.tenantSseOfficeCount, 0);

  const after = mockResponse();
  hub.addSSEClient(after.res as never, "user-later", OFFICE_A);
  a1.writes.length = 0;
  a2.writes.length = 0;
  hub.broadcastSSE(makeEvent(OFFICE_A));
  assert.equal(payloadsFor(a1).length, 0);
  assert.equal(payloadsFor(a2).length, 0);
  assert.equal(payloadsFor(after).length, 1);
  after.close();
  console.log("  ✅ close removes from buckets; no zombie delivery");
}

console.log("\n═══ events without officeId — fail closed (no global tenant SSE) ═══");
{
  const hub = new SseTenantHub();
  const a = mockResponse();
  const b = mockResponse();
  hub.addSSEClient(a.res as never, "user-a", OFFICE_A);
  hub.addSSEClient(b.res as never, "user-b", OFFICE_B);

  hub.broadcastSSE(makeEvent(undefined));
  assert.equal(payloadsFor(a).length, 0);
  assert.equal(payloadsFor(b).length, 0);

  /* sendToUsers remains explicit recipient delivery (not global broadcast) */
  hub.sendToUsers(["user-a"], { type: "NEW_MESSAGE", body: "private" });
  assert.equal(payloadsFor(a).length, 1);
  assert.equal(payloadsFor(b).length, 0);
  assert.equal((payloadsFor(a)[0] as { type: string }).type, "NEW_MESSAGE");
  console.log("  ✅ missing officeId → no tenant broadcast; sendToUsers still targeted");
}

console.log("\n═══ no Runtime DDL in SSE isolation surface ═══");
{
  assert.doesNotMatch(sseHubTs, /CREATE TABLE/);
  assert.doesNotMatch(eventBusTs, /CREATE TABLE/);
  assert.doesNotMatch(eventBusTs, /ensureEventsTable/);
  console.log("  ✅ no Runtime DDL");
}

console.log("\n✅ sseTenantIsolation: all assertions passed\n");
