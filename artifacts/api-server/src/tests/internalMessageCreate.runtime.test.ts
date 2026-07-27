/**
 * Runtime tests for set-based POST /internal-messages writes (Stage 10.6.3).
 * Run: pnpm --filter @workspace/api-server run test:internal-message-create
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildMessageAttachmentRows,
  buildMessageRecipientRows,
  createInternalMessageSideEffectsInMemory,
  legacyInternalMessageCreateQueryCount,
  setBasedInternalMessageCreateQueryCount,
} from "../lib/internalMessageCreate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const messageId = "11111111-1111-1111-1111-111111111111";
const officeA = "office-a";
const officeB = "office-b";

console.log("\n═══ source: set-based POST /internal-messages ═══");
{
  const src = read("modules/operations/internal-messages.ts");
  const start = src.indexOf("// POST /api/internal-messages");
  const end = src.indexOf("// PUT /api/internal-messages/:id/archive");
  assert.ok(start >= 0 && end > start, "POST /internal-messages route present");
  const block = src.slice(start, end);

  assert.match(block, /buildMessageRecipientRows/);
  assert.match(block, /buildMessageAttachmentRows/);
  assert.match(block, /INSERT INTO office_message_recipients/);
  assert.match(block, /INSERT INTO office_message_attachments/);
  assert.match(block, /FROM unnest\(/);
  assert.match(block, /res\.json\(msg\)/);

  assert.doesNotMatch(block, /for\s*\(\s*const\s+r\s+of\s+recipients/);
  assert.doesNotMatch(block, /for\s*\(\s*const\s+a\s+of\s+attachments/);
  /* Must not silently wrap the whole create in a new transaction */
  assert.doesNotMatch(block, /BEGIN\b|db\.transaction\b|\.transaction\(/);
  console.log("  ✅ bulk unnest inserts; no per-row loops; no new transaction");
}

console.log("\n═══ runtime: identical recipients and attachments ═══");
{
  const recipients = [
    { userId: "u1", userName: "أحمد" },
    { userId: "u2", userName: "سارة" },
  ];
  const attachments = [
    { fileName: "a.pdf", fileUrl: "/files/a.pdf", fileSize: 10 },
    { fileName: "b.docx", fileUrl: "/files/b.docx", fileSize: 20 },
  ];

  const rcpt = buildMessageRecipientRows(messageId, recipients);
  const att = buildMessageAttachmentRows(messageId, attachments);

  assert.deepEqual(rcpt, [
    { message_id: messageId, user_id: "u1", user_name: "أحمد" },
    { message_id: messageId, user_id: "u2", user_name: "سارة" },
  ]);
  assert.deepEqual(att, [
    { message_id: messageId, file_name: "a.pdf", file_url: "/files/a.pdf", file_size: 10 },
    { message_id: messageId, file_name: "b.docx", file_url: "/files/b.docx", file_size: 20 },
  ]);

  /* Legacy userName fallback */
  assert.deepEqual(
    buildMessageRecipientRows(messageId, [{ userId: "u9" }]),
    [{ message_id: messageId, user_id: "u9", user_name: "u9" }],
  );
  /* Legacy fileSize default */
  assert.equal(
    buildMessageAttachmentRows(messageId, [{ fileName: "x", fileUrl: "/x" }])[0]?.file_size,
    0,
  );
  console.log("  ✅ recipient/attachment rows match legacy field mapping");
}

console.log("\n═══ runtime: duplicate prevention ═══");
{
  const rcpt = buildMessageRecipientRows(messageId, [
    { userId: "u1", userName: "First" },
    { userId: "u1", userName: "Second" },
    { userId: "u2", userName: "Other" },
    { userId: "", userName: "skip" },
    { userId: 123 as unknown as string, userName: "skip-type" },
  ]);
  assert.deepEqual(
    rcpt.map((r) => r.user_id),
    ["u1", "u2"],
  );
  assert.equal(rcpt[0]?.user_name, "First");

  const att = buildMessageAttachmentRows(messageId, [
    { fileName: "a.pdf", fileUrl: "/a", fileSize: 1 },
    { fileName: "a.pdf", fileUrl: "/a", fileSize: 99 },
    { fileName: "a.pdf", fileUrl: "/a-other", fileSize: 2 },
  ]);
  assert.equal(att.length, 2);
  assert.equal(att[0]?.file_size, 1);
  assert.equal(att[1]?.file_url, "/a-other");
  console.log("  ✅ duplicate recipients/attachments collapsed (first wins)");
}

console.log("\n═══ runtime: tenant isolation ═══");
{
  const simA = createInternalMessageSideEffectsInMemory({
    messageId: "msg-a",
    officeId: officeA,
    recipients: [{ userId: "u1", userName: "A" }],
    attachments: [{ fileName: "a.pdf", fileUrl: "/a", fileSize: 1 }],
  });
  const simB = createInternalMessageSideEffectsInMemory({
    messageId: "msg-b",
    officeId: officeB,
    recipients: [{ userId: "u1", userName: "A" }],
    attachments: [{ fileName: "a.pdf", fileUrl: "/a", fileSize: 1 }],
  });

  assert.ok(simA.recipients.every((r) => r.message_id === "msg-a"));
  assert.ok(simA.attachments.every((a) => a.message_id === "msg-a"));
  assert.ok(simB.recipients.every((r) => r.message_id === "msg-b"));
  assert.equal(simA.messageScope, "msg-a");
  assert.equal(simB.messageScope, "msg-b");
  assert.equal(simA.officeId, officeA);
  assert.equal(simB.officeId, officeB);
  assert.notEqual(simA.messageScope, simB.messageScope);

  /* POST create path still does not cross-write another message's children */
  const src = read("modules/operations/internal-messages.ts");
  const start = src.indexOf("// POST /api/internal-messages");
  const end = src.indexOf("// PUT /api/internal-messages/:id/archive");
  const block = src.slice(start, end);
  assert.match(block, /SELECT \$\{String\(msg\.id\)\}::uuid/);
  console.log("  ✅ child rows scoped to created message id only");
}

console.log("\n═══ runtime: response parity ═══");
{
  const src = read("modules/operations/internal-messages.ts");
  const start = src.indexOf("// POST /api/internal-messages");
  const end = src.indexOf("// PUT /api/internal-messages/:id/archive");
  const block = src.slice(start, end);

  assert.match(
    block,
    /RETURNING id, subject, body, sender_id, sender_name, folder, created_at, case_id/,
  );
  assert.match(block, /res\.json\(msg\)/);
  assert.match(block, /eventBus\.sendToUsers\(recipientIds/);

  const sim = createInternalMessageSideEffectsInMemory({
    messageId,
    recipients: [
      { userId: "u1", userName: "أحمد" },
      { userId: "u1", userName: "dup" },
      { userId: "u2", userName: "سارة" },
    ],
    attachments: [{ fileName: "a.pdf", fileUrl: "/a", fileSize: 3 }],
  });
  assert.deepEqual(sim.recipientIdsForNotify, ["u1", "u2"]);
  assert.equal(sim.attachments[0]?.file_size, 3);
  console.log("  ✅ response still message RETURNING row; SSE uses unique recipients");
}

console.log("\n═══ runtime: fixed query count as counts grow ═══");
{
  const R = 40;
  const A = 25;
  const legacy = legacyInternalMessageCreateQueryCount(R, A);
  const setBased = setBasedInternalMessageCreateQueryCount(R, A);
  assert.equal(legacy, 1 + R + A);
  assert.equal(setBased, 3);
  assert.ok(setBased < legacy);
  assert.ok(legacy / setBased > 20);

  const manyRecipients = Array.from({ length: R }, (_, i) => ({
    userId: `user-${i}`,
    userName: `Name ${i}`,
  }));
  const manyAttachments = Array.from({ length: A }, (_, i) => ({
    fileName: `f-${i}.pdf`,
    fileUrl: `/files/${i}`,
    fileSize: i,
  }));
  const sim = createInternalMessageSideEffectsInMemory({
    messageId,
    recipients: manyRecipients,
    attachments: manyAttachments,
  });
  assert.equal(sim.recipients.length, R);
  assert.equal(sim.attachments.length, A);
  assert.equal(sim.setBasedQueries, 3);
  assert.equal(sim.legacyQueries, 1 + R + A);

  /* Empty side collections skip their statements */
  assert.equal(setBasedInternalMessageCreateQueryCount(0, 0), 1);
  assert.equal(setBasedInternalMessageCreateQueryCount(5, 0), 2);
  console.log(`  ✅ R=${R} A=${A}: legacy ${legacy} → set-based ${setBased}`);
}

console.log("\n✅ internalMessageCreate runtime tests passed\n");
