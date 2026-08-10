/**
 * Stage 21 — Remaining internal-messages routes tenant isolation.
 * Run: pnpm --filter @workspace/api-server run test:internal-messages-remaining-tenant
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCanonicalBusinessOfficeId,
  TenantResolutionError,
} from "../lib/tenantResolution";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..");
const ROOT = join(HERE, "..", "..", "..", "..");
const routeTs = readFileSync(join(SRC, "modules/operations/internal-messages.ts"), "utf8");
const mig016 = readFileSync(
  join(ROOT, "artifacts/api-server/migrations/016_office_messages_fts.sql"),
  "utf8",
);
const casesSchema = readFileSync(join(ROOT, "lib/db/src/schema/cases.ts"), "utf8");
const ciYml = readFileSync(join(ROOT, ".github/workflows/ci.yml"), "utf8");

const OFFICE_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const OFFICE_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const USER_A = "user_shared";
const USER_OTHER = "user_other_same_office";
const MSG_A = "11111111-1111-4111-8111-111111111111";
const MSG_B = "22222222-2222-4222-8222-222222222222";
const CASE_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CASE_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CONV_B = "33333333-3333-4333-8333-333333333333";

function sliceRoute(startMarker: string, endMarker: string): string {
  const start = routeTs.indexOf(startMarker);
  const end = routeTs.indexOf(endMarker);
  assert.ok(start >= 0 && end > start, `route slice ${startMarker} → ${endMarker}`);
  return routeTs.slice(start, end);
}

function routeOrderIndex(marker: string): number {
  const i = routeTs.indexOf(marker);
  assert.ok(i >= 0, `missing marker ${marker}`);
  return i;
}

type Msg = {
  id: string;
  office_id: string;
  sender_id: string;
  recipient_ids: string[];
  case_id: string | null;
  conversation_id: string | null;
  folder: string;
  body: string;
  is_read?: boolean;
};

type CaseRow = { id: string; office_id: string };

/** Mirror Stage 21 GET /:id authorization. */
function canReadMessage(
  rows: Msg[],
  opts: { tenantId: string; userId: string; id: string },
): Msg | null {
  const m = rows.find((r) => r.id === opts.id);
  if (!m) return null;
  if (m.office_id !== opts.tenantId) return null;
  if (m.sender_id !== opts.userId && !m.recipient_ids.includes(opts.userId)) return null;
  return m;
}

/** Mirror Stage 21 mark-read: only current office + user recipient rows. */
function markRead(
  rows: Msg[],
  opts: { tenantId: string; userId: string; id: string },
): boolean {
  const m = rows.find((r) => r.id === opts.id && r.office_id === opts.tenantId);
  if (!m) return false;
  if (!m.recipient_ids.includes(opts.userId)) return false;
  m.is_read = true;
  return true;
}

/** Mirror Stage 21 GET /case/:caseId. */
function listCaseMessages(
  rows: Msg[],
  cases: CaseRow[],
  opts: { tenantId: string; caseId: string },
): Msg[] {
  const owned = cases.find((c) => c.id === opts.caseId && c.office_id === opts.tenantId);
  if (!owned) return [];
  return rows.filter(
    (m) => m.office_id === opts.tenantId && m.case_id === opts.caseId,
  );
}

/** Mirror Stage 21 stats/counts (sent total for user in office). */
function countSent(rows: Msg[], tenantId: string, userId: string): number {
  return rows.filter(
    (m) => m.office_id === tenantId && m.sender_id === userId && m.folder !== "draft",
  ).length;
}

/** Mirror Stage 21 ai-tools conversation load. */
function loadConversation(
  rows: Msg[],
  opts: { tenantId: string; conversationId: string },
): Msg[] {
  return rows.filter(
    (m) =>
      m.office_id === opts.tenantId && m.conversation_id === opts.conversationId,
  );
}

const statsBlock = sliceRoute(
  "// GET /api/internal-messages/stats/counts",
  "/* ══════════════════════════════════════════════════════\n   ANALYTICS",
);
const analyticsBlock = sliceRoute(
  "/* ══════════════════════════════════════════════════════\n   ANALYTICS",
  "// GET /api/internal-messages/case/:caseId",
);
const caseBlock = sliceRoute(
  "// GET /api/internal-messages/case/:caseId",
  "// GET /api/internal-messages/:id",
);
const getByIdBlock = sliceRoute(
  "// GET /api/internal-messages/:id",
  "// POST /api/internal-messages",
);
const aiToolsBlock = sliceRoute(
  "/* ══════════════════════════════════════════════════════\n   AI TOOLS",
  "/* ── Additional indexes",
);

console.log("\n═══ schema: cases.id TEXT vs office_messages.case_id ═══");
{
  assert.match(casesSchema, /id:\s*text\("id"\)\.primaryKey/);
  assert.match(mig016, /case_id\s+INTEGER/);
  assert.doesNotMatch(caseBlock, /parseInt\s*\(/);
  assert.match(caseBlock, /c\.id\s*=\s*\$\{caseKey\}/);
  assert.match(caseBlock, /c\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(caseBlock, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(caseBlock, /m\.case_id\s*=\s*\$\{caseKey\}/);
  assert.doesNotMatch(caseBlock, /m\.case_id::text/);
  console.log("  ✅ caseId TEXT↔TEXT with cases.id; no parseInt; office-scoped");
}

console.log("\n═══ route order: /analytics and /case before /:id ═══");
{
  const iStats = routeOrderIndex('router.get("/stats/counts"');
  const iAnalytics = routeOrderIndex('router.get("/analytics"');
  const iCase = routeOrderIndex('router.get("/case/:caseId"');
  const iId = routeOrderIndex('router.get("/:id"');
  assert.ok(iStats < iAnalytics, "stats before analytics");
  assert.ok(iAnalytics < iId, "/analytics registered before /:id (no shadow)");
  assert.ok(iCase < iId, "/case/:caseId before /:id");
  assert.equal(
    (routeTs.match(/router\.get\(\s*"\/analytics"/g) ?? []).length,
    1,
    "exactly one /analytics registration",
  );
  console.log("  ✅ /analytics reaches analytics handler rather than /:id");
}

console.log("\n═══ auth: remaining routes use requireAuthWithTenant + canonical ═══");
{
  for (const [, block] of [
    ["stats", statsBlock],
    ["analytics", analyticsBlock],
    ["case", caseBlock],
    ["getById", getByIdBlock],
    ["ai-tools", aiToolsBlock],
  ] as const) {
    assert.match(block, /requireAuthWithTenant/);
    assert.match(block, /resolveCanonicalMessageOfficeId/);
    assert.doesNotMatch(block, /router\.(get|post)\([^)]*requireAuth\s*,/);
  }
  assert.match(
    routeTs,
    /import\s*\{\s*requireAuthWithTenant\s*\}\s*from\s*"\.\.\/\.\.\/middlewares\/requireAuth"/,
  );
  assert.doesNotMatch(getByIdBlock, /router\.get\(\s*"\/:id"\s*,\s*requireAuth\s*,/);
  console.log("  ✅ no requireAuth-only on remaining message data routes");
}

console.log("\n═══ SQL: office_id + participant / case ownership ═══");
{
  assert.match(getByIdBlock, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(getByIdBlock, /m\.sender_id\s*=\s*\$\{userId\}/);
  assert.match(getByIdBlock, /office_message_recipients rx/);
  assert.match(getByIdBlock, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(getByIdBlock, /UPDATE office_message_recipients r[\s\S]*FROM office_messages m/);
  assert.match(getByIdBlock, /m\.office_id\s*=\s*\$\{tenantId\}/);

  assert.match(statsBlock, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(statsBlock, /WHERE office_id = \$\{tenantId\}[\s\S]*sender_id = \$\{userId\}[\s\S]*folder != 'draft'/);
  assert.match(statsBlock, /WHERE office_id = \$\{tenantId\}[\s\S]*folder = 'draft'/);

  assert.match(analyticsBlock, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(
    analyticsBlock,
    /JOIN cases c ON c\.id = m\.case_id AND c\.office_id = \$\{tenantId\}/,
  );
  assert.doesNotMatch(analyticsBlock, /m\.case_id::text|c\.id::text\s*=\s*m\.case_id/);
  assert.match(
    analyticsBlock,
    /AND \(\s*body ILIKE '%AI%'[\s\S]*OR body ILIKE '%ذكاء%'[\s\S]*OR body ILIKE '%تلقائي%'[\s\S]*\)/,
  );
  assert.doesNotMatch(
    analyticsBlock,
    /WHERE office_id = \$\{tenantId\}\s*\n\s*AND body ILIKE '%AI%' OR body ILIKE/,
  );

  assert.match(aiToolsBlock, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(aiToolsBlock, /conversation_id = \$\{conversationId\}::uuid/);
  console.log("  ✅ office scoping + aiUsage OR grouping + mark-read join");
}

console.log("\n═══ behavioral: GET /:id isolation + participant ═══");
{
  const rows: Msg[] = [
    {
      id: MSG_A,
      office_id: OFFICE_A,
      sender_id: USER_A,
      recipient_ids: [USER_A],
      case_id: CASE_A,
      conversation_id: null,
      folder: "sent",
      body: "office A secret",
      is_read: false,
    },
    {
      id: MSG_B,
      office_id: OFFICE_B,
      sender_id: USER_A,
      recipient_ids: [USER_A],
      case_id: CASE_B,
      conversation_id: CONV_B,
      folder: "sent",
      body: "office B secret",
      is_read: false,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      office_id: OFFICE_A,
      sender_id: USER_OTHER,
      recipient_ids: [USER_OTHER],
      case_id: CASE_A,
      conversation_id: null,
      folder: "sent",
      body: "peer private",
      is_read: false,
    },
  ];

  assert.equal(
    canReadMessage(rows, { tenantId: OFFICE_A, userId: USER_A, id: MSG_B }),
    null,
    "Office A cannot GET office B message UUID",
  );
  assert.equal(
    canReadMessage(rows, {
      tenantId: OFFICE_A,
      userId: USER_A,
      id: "44444444-4444-4444-8444-444444444444",
    }),
    null,
    "same-office non-participant cannot read",
  );
  assert.ok(
    canReadMessage(rows, { tenantId: OFFICE_A, userId: USER_A, id: MSG_A }),
    "authorized same-office participant can read",
  );

  assert.equal(
    markRead(rows, { tenantId: OFFICE_A, userId: USER_A, id: MSG_B }),
    false,
    "mark-read cannot affect foreign-office message",
  );
  assert.equal(rows.find((m) => m.id === MSG_B)?.is_read, false);
  assert.equal(
    markRead(rows, { tenantId: OFFICE_A, userId: USER_A, id: MSG_A }),
    true,
  );
  assert.equal(rows.find((m) => m.id === MSG_A)?.is_read, true);
  console.log("  ✅ GET /:id + mark-read office/participant gates");
}

console.log("\n═══ behavioral: case / stats / ai-tools ═══");
{
  const cases: CaseRow[] = [
    { id: CASE_A, office_id: OFFICE_A },
    { id: CASE_B, office_id: OFFICE_B },
  ];
  const rows: Msg[] = [
    {
      id: MSG_A,
      office_id: OFFICE_A,
      sender_id: USER_A,
      recipient_ids: [],
      case_id: CASE_A,
      conversation_id: null,
      folder: "sent",
      body: "a",
    },
    {
      id: MSG_B,
      office_id: OFFICE_B,
      sender_id: USER_A,
      recipient_ids: [],
      case_id: CASE_B,
      conversation_id: CONV_B,
      folder: "sent",
      body: "b-body-secret",
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      office_id: OFFICE_B,
      sender_id: USER_A,
      recipient_ids: [],
      case_id: CASE_B,
      conversation_id: CONV_B,
      folder: "sent",
      body: "b2",
    },
  ];

  assert.deepEqual(
    listCaseMessages(rows, cases, { tenantId: OFFICE_A, caseId: CASE_B }),
    [],
    "Office A cannot retrieve office B case messages",
  );
  assert.equal(
    listCaseMessages(rows, cases, { tenantId: OFFICE_A, caseId: CASE_A }).length,
    1,
  );

  assert.equal(countSent(rows, OFFICE_A, USER_A), 1);
  assert.equal(countSent(rows, OFFICE_B, USER_A), 2);
  assert.notEqual(
    countSent(rows, OFFICE_A, USER_A),
    countSent(rows, OFFICE_B, USER_A),
    "same userId across A/B only counts active office",
  );

  assert.deepEqual(
    loadConversation(rows, { tenantId: OFFICE_A, conversationId: CONV_B }),
    [],
    "ai-tools cannot load foreign-office conversation bodies",
  );
  assert.equal(
    loadConversation(rows, { tenantId: OFFICE_B, conversationId: CONV_B }).length,
    2,
  );
  console.log("  ✅ case / stats / ai-tools office isolation");
}

console.log("\n═══ fail-closed ownership helpers ═══");
{
  for (const bad of [null, undefined, "", "platform", "default", "trial_abc", "not-a-uuid"]) {
    assert.throws(
      () =>
        assertCanonicalBusinessOfficeId(bad as string | null | undefined, {
          userId: USER_A,
          source: "stage21",
        }),
      (err: unknown) => err instanceof TenantResolutionError,
      `must reject ${String(bad)}`,
    );
  }
  assert.equal(
    assertCanonicalBusinessOfficeId(OFFICE_A, { userId: USER_A, source: "stage21" }),
    OFFICE_A,
  );
  console.log("  ✅ missing/default/platform/trial_*/non-UUID fail closed");
}

console.log("\n═══ Stage 20.1 / 20.2 surfaces preserved ═══");
{
  assert.match(routeTs, /Stage 20\.1/);
  assert.match(routeTs, /m\.office_id\s*=\s*\$\{tenantId\}/);
  assert.match(routeTs, /getMessageFtsConfig/);
  const ftsLogic = readFileSync(join(SRC, "modules/operations/messageFtsConfigLogic.ts"), "utf8");
  assert.match(ftsLogic, /MESSAGE_FTS_ALLOWED_CONFIGS/);
  assert.match(ftsLogic, /cache: false/);
  assert.doesNotMatch(routeTs, /ADD COLUMN IF NOT EXISTS search_vector/);
  assert.doesNotMatch(routeTs, /CREATE INDEX IF NOT EXISTS idx_messages_search/);
  console.log("  ✅ Stage 20.1/20.2 + no Runtime FTS DDL reintroduced");
}

console.log("\n═══ CI wiring ═══");
{
  assert.match(ciYml, /test:internal-messages-remaining-tenant/);
  console.log("  ✅ CI includes Stage 21 remaining-tenant test");
}

console.log("\n✅ internalMessagesRemainingTenantIsolation tests passed\n");
