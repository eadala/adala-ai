/**
 * Runtime tests for set-based POST /conversations member create (Stage 10.6.2).
 * Run: pnpm --filter @workspace/api-server run test:conversation-member-create
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildConversationMemberRows,
  createConversationMembersInMemory,
  dedupeConversationMemberRows,
  legacyConversationCreateQueryCount,
  legacyConversationMemberQueryCount,
  resolveUniqueMemberIds,
  setBasedConversationCreateQueryCount,
  setBasedConversationMemberQueryCount,
  type UserNameRow,
} from "../lib/conversationMemberCreate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const officeA = "office-a";
const officeB = "office-b";
const creator = "user-creator";
const member1 = "user-m1";
const member2 = "user-m2";
const stranger = "user-stranger";

const nameRows: UserNameRow[] = [
  { id: creator, name: "منشئ" },
  { id: member1, name: "عضو ١" },
  { id: member2, name: null }, // fallback to user id
];

console.log("\n═══ source: set-based POST /conversations ═══");
{
  const src = read("modules/operations/conversations.ts");
  const start = src.indexOf('router.post("/", requireAuthWithTenant');
  const end = src.indexOf('router.get("/", requireAuthWithTenant');
  assert.ok(start >= 0 && end > start, "POST /conversations route present");
  const block = src.slice(start, end);

  assert.match(block, /buildConversationMemberRows/);
  assert.match(block, /resolveUniqueMemberIds/);
  assert.match(block, /WHERE id = ANY\(\$\{allIds\}::text\[\]\)/);
  assert.match(block, /INSERT INTO conversation_members/);
  assert.match(block, /FROM unnest\(/);
  assert.match(block, /ON CONFLICT \(conversation_id, user_id\) DO NOTHING/);
  assert.match(block, /office_id = \$\{tenantId\}/);

  assert.doesNotMatch(block, /for\s*\(\s*const\s+uid\s+of\s+allIds\s*\)/);
  assert.doesNotMatch(
    block,
    /SELECT COALESCE\(full_name, first_name, email\) AS name FROM users WHERE id = \$\{uid\}/,
  );
  console.log("  ✅ route uses batched name lookup + bulk INSERT; no per-member loop");
}

console.log("\n═══ runtime: identical members created ═══");
{
  const memberIds = [member1, member2, creator]; // creator also in list
  const unique = resolveUniqueMemberIds(creator, memberIds);
  assert.deepEqual(unique, [creator, member1, member2]);

  const rows = buildConversationMemberRows({
    conversationId: "conv-1",
    officeId: officeA,
    creatorId: creator,
    memberIds,
    nameRows,
  });

  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => ({ user_id: r.user_id, role: r.role, user_name: r.user_name, office_id: r.office_id })),
    [
      { user_id: creator, role: "admin", user_name: "منشئ", office_id: officeA },
      { user_id: member1, role: "member", user_name: "عضو ١", office_id: officeA },
      { user_id: member2, role: "member", user_name: member2, office_id: officeA },
    ],
  );

  /* Legacy loop parity: same Set order + same name fallback */
  const legacyIds = [...new Set<string>([creator, ...memberIds.filter((id) => id !== creator)])];
  const legacy = legacyIds.map((uid) => {
    const name = nameRows.find((n) => n.id === uid)?.name ?? uid;
    return {
      user_id: uid,
      role: uid === creator ? "admin" : "member",
      user_name: name,
      office_id: officeA,
      conversation_id: "conv-1",
    };
  });
  assert.deepEqual(rows, legacy);
  console.log("  ✅ creator=admin, others=member; names match legacy");
}

console.log("\n═══ runtime: duplicate prevention ═══");
{
  const memberIds = [member1, member1, member2, member1];
  const rows = buildConversationMemberRows({
    conversationId: "conv-2",
    officeId: officeA,
    creatorId: creator,
    memberIds,
    nameRows,
  });
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map((r) => r.user_id)).size, 3);

  const withDupPlan = dedupeConversationMemberRows([
    ...rows,
    { ...rows[0], user_name: "should-skip" },
  ]);
  assert.equal(withDupPlan.length, 3);
  assert.equal(withDupPlan[0].user_name, "منشئ");

  const sim = createConversationMembersInMemory({
    conversationId: "conv-2",
    officeId: officeA,
    creatorId: creator,
    memberIds,
    nameRows,
    existingKeys: [{ conversation_id: "conv-2", user_id: member1 }],
  });
  assert.equal(sim.skippedDuplicates, 1);
  assert.equal(sim.inserted.some((r) => r.user_id === member1), false);
  assert.equal(sim.inserted.length, 2); // creator + member2
  console.log("  ✅ unique members only; ON CONFLICT skips existing");
}

console.log("\n═══ runtime: tenant isolation ═══");
{
  const forA = buildConversationMemberRows({
    conversationId: "conv-a",
    officeId: officeA,
    creatorId: creator,
    memberIds: [member1],
    nameRows,
  });
  const forB = buildConversationMemberRows({
    conversationId: "conv-b",
    officeId: officeB,
    creatorId: creator,
    memberIds: [member1],
    nameRows,
  });

  assert.ok(forA.every((r) => r.office_id === officeA));
  assert.ok(forB.every((r) => r.office_id === officeB));
  assert.equal(forA[0].office_id === forB[0].office_id, false);

  /* Source still validates other members against office_members for tenantId */
  const src = read("modules/operations/conversations.ts");
  const start = src.indexOf('router.post("/", requireAuthWithTenant');
  const end = src.indexOf('router.get("/", requireAuthWithTenant');
  const block = src.slice(start, end);
  assert.match(
    block,
    /SELECT user_id FROM office_members\s+WHERE office_id = \$\{tenantId\} AND user_id = ANY\(\$\{otherMembers\}::text\[\]\)/,
  );
  assert.equal(
    forA.some((r) => r.user_id === stranger),
    false,
  );
  console.log("  ✅ members stamped with tenant office_id; office_members check retained");
}

console.log("\n═══ runtime: response parity ═══");
{
  /* Response remains { conversation: convRow } — members are side-effect only */
  const src = read("modules/operations/conversations.ts");
  const start = src.indexOf('router.post("/", requireAuthWithTenant');
  const end = src.indexOf('router.get("/", requireAuthWithTenant');
  const block = src.slice(start, end);
  assert.match(block, /return res\.json\(\{\s*conversation:\s*convRow\s*\}\)/);

  const sim = createConversationMembersInMemory({
    conversationId: "conv-resp",
    officeId: officeA,
    creatorId: creator,
    memberIds: [member1, member2],
    nameRows,
  });
  assert.deepEqual(
    sim.inserted.map((r) => r.user_id),
    [creator, member1, member2],
  );
  assert.equal(sim.inserted.find((r) => r.user_id === creator)?.role, "admin");
  console.log("  ✅ response shape unchanged; member side-effect identical");
}

console.log("\n═══ runtime: fixed query count as member count grows ═══");
{
  const n = 50;
  const legacyMembers = legacyConversationMemberQueryCount(n);
  const setBasedMembers = setBasedConversationMemberQueryCount();
  assert.equal(legacyMembers, n * 2);
  assert.equal(setBasedMembers, 2);
  assert.ok(setBasedMembers < legacyMembers);

  const legacyFull = legacyConversationCreateQueryCount(n, true);
  const setBasedFull = setBasedConversationCreateQueryCount(true);
  assert.equal(legacyFull, 1 + 1 + n * 2);
  assert.equal(setBasedFull, 1 + 1 + 2);
  assert.ok(legacyFull / setBasedFull > 20);

  const many = Array.from({ length: n }, (_, i) => `user-${i}`);
  const sim = createConversationMembersInMemory({
    conversationId: "conv-n",
    officeId: officeA,
    creatorId: creator,
    memberIds: many,
    nameRows: [
      { id: creator, name: "منشئ" },
      ...many.map((id) => ({ id, name: `Name ${id}` })),
    ],
  });
  assert.equal(sim.inserted.length, n + 1);
  assert.equal(sim.setBasedQueries, 4);
  assert.equal(sim.legacyQueries, 1 + 1 + (n + 1) * 2);
  console.log(`  ✅ N=${n}: legacy ${legacyFull} → set-based ${setBasedFull} (full create w/ validation)`);
}

console.log("\n✅ conversationMemberCreate runtime tests passed\n");
