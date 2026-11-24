/**
 * Behavioral tests for the tenant-resolution write gates extracted for the
 * auth.userId-as-tenant-fallback fix: writeClientCommSettings, linkClientCase,
 * and insertForResolvedOffice. Each proves, with injected mocks (no real DB
 * or Clerk needed — same mocking convention as storageFileRegister.test.ts /
 * storageFolderCreate.test.ts), that:
 *   - a null resolveTenantId result performs NO write/insert and denies, and
 *   - a resolved office id is the EXACT id used for the write/insert.
 * Run: pnpm --filter @workspace/api-server run test:tenant-gated-writes
 */
import assert from "node:assert/strict";
import { writeClientCommSettings } from "../lib/clientCommSettingsWrite";
import { linkClientCase } from "../lib/clientCaseLinkWrite";
import { insertForResolvedOffice } from "../lib/messagesTenantGate";

const USER_ID = "user_3GAZkvsPRRIyUOY77l9gJ1TIcai";
const OFFICE_ID = "trial_gJ1TIcai";

type Call = { text: string };

function createMockDb(opts: { existingRows?: Record<string, unknown>[] } = {}) {
  const captured: Call[] = [];
  return {
    captured,
    execute: async (q: unknown) => {
      const text = (() => {
        try { return JSON.stringify(q); } catch { return String(q); }
      })();
      captured.push({ text });
      if (text.includes("SELECT id FROM client_comm_settings") || text.includes("SELECT id FROM client_portal_tokens")) {
        return opts.existingRows ?? [];
      }
      return [];
    },
  };
}

console.log("\n═══ writeClientCommSettings: null resolution → no write, request denied ═══");

{
  const mock = createMockDb();
  const resolveTenantId = async () => null;
  const outcome = await writeClientCommSettings(
    {
      userId: USER_ID,
      roles: { replyRoles: "{lawyer}", portalRoles: "{lawyer}", timelineRoles: "{lawyer}", intakeRoles: "{lawyer}", requireReplyApproval: false },
    },
    { resolveTenantId, db: mock },
  );
  assert.equal(outcome, null, "unresolved tenant must deny (return null)");
  assert.equal(mock.captured.length, 0, "no client_comm_settings query may run when the tenant cannot be resolved");
  console.log("  ✅ resolveTenantId → null: zero client_comm_settings queries executed; write denied");
}

console.log("\n═══ writeClientCommSettings: resolved office → write uses that exact office id ═══");

{
  const mock = createMockDb({ existingRows: [] });
  const resolveTenantId = async (userId: string) => { assert.equal(userId, USER_ID); return OFFICE_ID; };
  const outcome = await writeClientCommSettings(
    {
      userId: USER_ID,
      roles: { replyRoles: "{lawyer}", portalRoles: "{lawyer}", timelineRoles: "{lawyer}", intakeRoles: "{lawyer}", requireReplyApproval: true },
    },
    { resolveTenantId, db: mock },
  );
  assert.deepEqual(outcome, { officeId: OFFICE_ID });
  assert.ok(mock.captured.some((c) => c.text.includes("SELECT id FROM client_comm_settings")), "must check for an existing row");
  const insertCall = mock.captured.find((c) => c.text.includes("INSERT INTO client_comm_settings"));
  assert.ok(insertCall, "must insert client_comm_settings when no existing row");
  assert.ok(insertCall.text.includes(OFFICE_ID), "insert must use the exact resolved office id");
  assert.doesNotMatch(insertCall.text, new RegExp(USER_ID), "insert must never embed the Clerk user id");
  console.log("  ✅ resolveTenantId → office id: client_comm_settings insert uses that exact office id");
}

console.log("\n═══ writeClientCommSettings: existing row → UPDATE (not INSERT) for the resolved office ═══");

{
  const mock = createMockDb({ existingRows: [{ id: "row-1" }] });
  const resolveTenantId = async () => OFFICE_ID;
  await writeClientCommSettings(
    { userId: USER_ID, roles: { replyRoles: "{lawyer}", portalRoles: "{lawyer}", timelineRoles: "{lawyer}", intakeRoles: "{lawyer}", requireReplyApproval: false } },
    { resolveTenantId, db: mock },
  );
  const updateCall = mock.captured.find((c) => c.text.includes("UPDATE client_comm_settings"));
  assert.ok(updateCall, "must update when a client_comm_settings row already exists");
  assert.ok(updateCall.text.includes(OFFICE_ID), "update must target the exact resolved office id");
  console.log("  ✅ existing row: UPDATE targets the exact resolved office id");
}

console.log("\n═══ linkClientCase: null resolution → no insert executed ═══");

{
  const mock = createMockDb();
  const resolveTenantId = async () => null;
  const outcome = await linkClientCase(
    { userId: USER_ID, clientId: "client-1", caseId: "case-1", portalTokenId: null, portalToken: null },
    { resolveTenantId, db: mock },
  );
  assert.equal(outcome, null, "unresolved tenant must deny (return null)");
  assert.equal(mock.captured.length, 0, "no client_case_links insert may run when the tenant cannot be resolved");
  console.log("  ✅ resolveTenantId → null: zero client_case_links inserts executed; linking denied");
}

console.log("\n═══ linkClientCase: resolved office → client_case_links.office_id is that exact office id ═══");

{
  const mock = createMockDb();
  const resolveTenantId = async (userId: string) => { assert.equal(userId, USER_ID); return OFFICE_ID; };
  const outcome = await linkClientCase(
    { userId: USER_ID, clientId: "client-1", caseId: "case-1", portalTokenId: "pt-1", portalToken: "tok-1" },
    { resolveTenantId, db: mock },
  );
  assert.deepEqual(outcome, { officeId: OFFICE_ID });
  assert.equal(mock.captured.length, 1);
  assert.ok(mock.captured[0].text.includes("INSERT INTO client_case_links"));
  assert.ok(mock.captured[0].text.includes(OFFICE_ID), "insert must use the exact resolved office id");
  assert.doesNotMatch(mock.captured[0].text, new RegExp(USER_ID), "insert must never embed the Clerk user id as office_id");
  console.log("  ✅ resolveTenantId → office id: client_case_links.office_id is that exact office id");
}

console.log("\n═══ insertForResolvedOffice (messages POST gate): null resolution → insert never invoked ═══");

{
  let insertCalled = false;
  const resolveTenantId = async () => null;
  const result = await insertForResolvedOffice(
    { userId: USER_ID },
    async () => { insertCalled = true; return { id: "msg-1" }; },
    { resolveTenantId },
  );
  assert.equal(result, null, "unresolved tenant must deny (return null)");
  assert.equal(insertCalled, false, "the message insert callback must NEVER run when the tenant cannot be resolved");
  console.log("  ✅ resolveTenantId → null: message insert callback never invoked; POST /messages would reject (403)");
}

console.log("\n═══ insertForResolvedOffice (messages POST gate): resolved office → insert runs exactly once ═══");

{
  let insertCallCount = 0;
  let receivedOfficeId: string | null = null;
  const resolveTenantId = async () => OFFICE_ID;
  const result = await insertForResolvedOffice(
    { userId: USER_ID },
    async (officeId) => { insertCallCount += 1; receivedOfficeId = officeId; return { id: "msg-1" }; },
    { resolveTenantId },
  );
  assert.deepEqual(result, { id: "msg-1" });
  assert.equal(insertCallCount, 1, "the message insert callback must run exactly once when the tenant resolves");
  assert.equal(receivedOfficeId, OFFICE_ID, "the callback must receive the exact resolved office id");
  console.log("  ✅ resolveTenantId → office id: message insert callback runs exactly once with that office id");
}

console.log(
  "\nNOTE: this proves the shared resolve-then-write contract used by messages.ts's POST /messages\n" +
  "(same insertForResolvedOffice import, same fail-closed semantics). A true end-to-end Express\n" +
  "route test is impractical here without a live Postgres + Clerk (messages.ts/client-portal.ts/\n" +
  "client-auth.ts import @workspace/db, which throws at import time without DATABASE_URL, and\n" +
  "several routes run side-effecting ensureTables() at module load) — and this repo has no test\n" +
  "framework capable of mocking static ESM imports (jest/vitest are not used). Extracting the\n" +
  "gate itself (the smallest testable unit, per review guidance) is the practical alternative.",
);

console.log("\n✅ tenantGatedWrites: all checks passed\n");
