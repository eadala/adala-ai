/**
 * Runtime tests for set-based GET /conversations list SQL (Stage 10.6.4).
 * Run: pnpm --filter @workspace/api-server run test:conversations-list-query
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  legacyConversationsListCorrelatedSubqueryCount,
  listConversationsLegacy,
  listConversationsSetBased,
  setBasedConversationsListCorrelatedSubqueryCount,
  type ConversationListConversation,
  type ConversationListMember,
  type ConversationListMessage,
} from "../lib/conversationsListQuery";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const officeA = "office-a";
const officeB = "office-b";
const userA = "user-a";
const userB = "user-b";

const conversations: ConversationListConversation[] = [
  {
    id: "c-old",
    office_id: officeA,
    title: "قديمة",
    type: "group",
    created_by: userA,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "c-hot",
    office_id: officeA,
    title: "نشطة",
    type: "direct",
    created_by: userA,
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "c-empty",
    office_id: officeA,
    title: "فارغة",
    type: "group",
    created_by: userA,
    created_at: "2026-01-10T00:00:00.000Z",
    updated_at: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "c-other-user",
    office_id: officeA,
    title: "ليست لي",
    type: "direct",
    created_by: userB,
    created_at: "2026-01-11T00:00:00.000Z",
    updated_at: "2026-01-11T00:00:00.000Z",
  },
  {
    id: "c-tenant-b",
    office_id: officeB,
    title: "مكتب ب",
    type: "group",
    created_by: userA,
    created_at: "2026-01-12T00:00:00.000Z",
    updated_at: "2026-01-12T00:00:00.000Z",
  },
];

const members: ConversationListMember[] = [
  { conversation_id: "c-old", user_id: userA, role: "admin" },
  { conversation_id: "c-old", user_id: userB, role: "member" },
  { conversation_id: "c-hot", user_id: userA, role: "member" },
  { conversation_id: "c-hot", user_id: userB, role: "admin" },
  { conversation_id: "c-empty", user_id: userA, role: "admin" },
  { conversation_id: "c-other-user", user_id: userB, role: "admin" },
  { conversation_id: "c-tenant-b", user_id: userA, role: "admin" },
  { conversation_id: "c-tenant-b", user_id: userB, role: "member" },
];

const messages: ConversationListMessage[] = [
  { conversation_id: "c-old", body: "old-1", created_at: "2026-01-03T00:00:00.000Z" },
  { conversation_id: "c-old", body: "old-2", created_at: "2026-01-04T00:00:00.000Z" },
  { conversation_id: "c-hot", body: "hot-1", created_at: "2026-01-05T00:00:00.000Z" },
  { conversation_id: "c-hot", body: "hot-latest", created_at: "2026-01-20T00:00:00.000Z" },
  { conversation_id: "c-tenant-b", body: "b-msg", created_at: "2026-01-21T00:00:00.000Z" },
  { conversation_id: "c-other-user", body: "secret", created_at: "2026-01-22T00:00:00.000Z" },
];

console.log("\n═══ source: set-based GET /conversations ═══");
{
  const src = read("modules/operations/conversations.ts");
  const start = src.indexOf("/* ── 2. GET /conversations");
  const end = src.indexOf("/* ── 3. GET /conversations/:id/messages");
  assert.ok(start >= 0 && end > start, "GET /conversations route present");
  const block = src.slice(start, end);

  assert.match(block, /WITH my_convs AS/);
  assert.match(block, /DISTINCT ON \(m\.conversation_id\)/);
  assert.match(block, /member_counts AS/);
  assert.match(block, /GROUP BY cm\.conversation_id/);
  assert.match(block, /LEFT JOIN last_msgs lm/);
  assert.match(block, /LEFT JOIN member_counts cnt/);
  assert.match(block, /c\.office_id = \$\{tenantId\}/);
  assert.match(block, /my\.user_id = \$\{userId\}/);
  assert.match(block, /ORDER BY COALESCE\(lm\.created_at, c\.created_at\) DESC/);
  assert.match(block, /LIMIT \$\{limit\} OFFSET \$\{offset\}/);

  /* Correlated scalar subqueries removed from SELECT list / ORDER BY */
  assert.doesNotMatch(
    block,
    /SELECT m\.body FROM office_messages m\s+WHERE m\.conversation_id = c\.id/,
  );
  assert.doesNotMatch(
    block,
    /SELECT COUNT\(\*\)::int FROM conversation_members cm2 WHERE cm2\.conversation_id = c\.id/,
  );
  assert.doesNotMatch(
    block,
    /ORDER BY COALESCE\(\s*\(SELECT m\.created_at FROM office_messages/,
  );
  console.log("  ✅ CTE/DISTINCT ON/GROUP BY list; correlated scalars removed");
}

console.log("\n═══ runtime: identical response ═══");
{
  const args = {
    userId: userA,
    officeId: officeA,
    conversations,
    members,
    messages,
    limit: 50,
    offset: 0,
  };
  const legacy = listConversationsLegacy(args);
  const setBased = listConversationsSetBased(args);
  assert.deepEqual(setBased, legacy);

  const hot = setBased.find((r) => r.id === "c-hot");
  assert.equal(hot?.last_message, "hot-latest");
  assert.equal(hot?.last_message_at, "2026-01-20T00:00:00.000Z");
  assert.equal(hot?.member_count, 2);
  assert.equal(hot?.my_role, "member");

  const empty = setBased.find((r) => r.id === "c-empty");
  assert.equal(empty?.last_message, null);
  assert.equal(empty?.last_message_at, null);
  assert.equal(empty?.member_count, 1);

  assert.equal(
    setBased.some((r) => r.id === "c-other-user"),
    false,
  );
  console.log("  ✅ set-based rows ≡ legacy correlated semantics");
}

console.log("\n═══ runtime: ordering parity ═══");
{
  const args = {
    userId: userA,
    officeId: officeA,
    conversations,
    members,
    messages,
    limit: 50,
    offset: 0,
  };
  const legacyIds = listConversationsLegacy(args).map((r) => r.id);
  const setBasedIds = listConversationsSetBased(args).map((r) => r.id);
  assert.deepEqual(setBasedIds, legacyIds);
  /* hot (latest msg) → empty (created_at 01-10, no msg) → old (msg 01-04) */
  assert.deepEqual(setBasedIds, ["c-hot", "c-empty", "c-old"]);

  const page = listConversationsSetBased({ ...args, limit: 1, offset: 1 });
  assert.deepEqual(
    page.map((r) => r.id),
    listConversationsLegacy({ ...args, limit: 1, offset: 1 }).map((r) => r.id),
  );
  assert.deepEqual(page.map((r) => r.id), ["c-empty"]);
  console.log("  ✅ COALESCE(last_message_at, created_at) DESC + pagination parity");
}

console.log("\n═══ runtime: tenant isolation ═══");
{
  const forA = listConversationsSetBased({
    userId: userA,
    officeId: officeA,
    conversations,
    members,
    messages,
    limit: 50,
    offset: 0,
  });
  const forB = listConversationsSetBased({
    userId: userA,
    officeId: officeB,
    conversations,
    members,
    messages,
    limit: 50,
    offset: 0,
  });

  assert.equal(forA.some((r) => r.id === "c-tenant-b"), false);
  assert.deepEqual(
    forB.map((r) => r.id),
    ["c-tenant-b"],
  );
  assert.equal(forB[0]?.last_message, "b-msg");
  assert.equal(forB[0]?.member_count, 2);
  console.log("  ✅ office_id filter isolates tenant A/B lists");
}

console.log("\n═══ runtime: no duplicate conversations ═══");
{
  const dupMembers: ConversationListMember[] = [
    ...members,
    /* Defensive: duplicate membership row must not multiply conversations */
    { conversation_id: "c-hot", user_id: userA, role: "member" },
  ];
  const out = listConversationsSetBased({
    userId: userA,
    officeId: officeA,
    conversations,
    members: dupMembers,
    messages,
    limit: 50,
    offset: 0,
  });
  const ids = out.map((r) => r.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(ids.filter((id) => id === "c-hot").length, 1);

  const src = read("modules/operations/conversations.ts");
  const start = src.indexOf("/* ── 2. GET /conversations");
  const end = src.indexOf("/* ── 3. GET /conversations/:id/messages");
  const block = src.slice(start, end);
  /* Final SELECT joins my_convs 1:1 with aggregates — no fan-out JOIN to messages */
  assert.doesNotMatch(
    block,
    /FROM my_convs c\s+JOIN office_messages/,
  );
  console.log("  ✅ no duplicate conversation ids; no message join fan-out");
}

console.log("\n═══ runtime: query plan improvement (correlated work removed) ═══");
{
  assert.equal(legacyConversationsListCorrelatedSubqueryCount(), 4);
  assert.equal(setBasedConversationsListCorrelatedSubqueryCount(), 0);

  const src = read("modules/operations/conversations.ts");
  const start = src.indexOf("/* ── 2. GET /conversations");
  const end = src.indexOf("/* ── 3. GET /conversations/:id/messages");
  const block = src.slice(start, end);

  const correlatedScalarHits = [
    ...block.matchAll(
      /\(\s*SELECT[\s\S]*?FROM office_messages[\s\S]*?WHERE m\.conversation_id = c\.id/g,
    ),
  ];
  const correlatedCountHits = [
    ...block.matchAll(
      /\(\s*SELECT COUNT\(\*\)::int FROM conversation_members cm2 WHERE cm2\.conversation_id = c\.id/g,
    ),
  ];
  assert.equal(correlatedScalarHits.length, 0);
  assert.equal(correlatedCountHits.length, 0);
  assert.match(block, /DISTINCT ON/);
  assert.match(block, /GROUP BY cm\.conversation_id/);
  console.log("  ✅ 4 correlated scalars → 0; set-based DISTINCT ON + GROUP BY present");
}

console.log("\n✅ conversationsListQuery runtime tests passed\n");
