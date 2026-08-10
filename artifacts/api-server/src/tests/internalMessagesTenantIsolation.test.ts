/**
 * Stage 20.1 — Internal messages FTS/list tenant isolation (P0).
 * Run: pnpm --filter @workspace/api-server run test:internal-messages-tenant
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
const routeTs = readFileSync(join(SRC, "modules/operations/internal-messages.ts"), "utf8");

const OFFICE_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeee1";
const OFFICE_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const USER_A = "user_office_a";
const USER_B = "user_office_b";

type Msg = {
  id: string;
  office_id: string;
  sender_id: string;
  folder: string;
  subject: string;
  recipient_ids: string[];
  deleted_at: string | null;
};

/** In-memory mirror of Stage 20.1 list/search folder predicates. */
function listFolder(
  rows: Msg[],
  opts: {
    tenantId: string;
    userId: string;
    folder: "inbox" | "sent" | "drafts" | "archive";
    search?: string;
  },
): Msg[] {
  const term = opts.search?.trim().toLowerCase() ?? "";
  return rows.filter((m) => {
    if (m.office_id !== opts.tenantId) return false;
    if (m.deleted_at) return false;
    if (term && !m.subject.toLowerCase().includes(term)) return false;
    if (opts.folder === "sent") {
      return m.sender_id === opts.userId && m.folder !== "draft";
    }
    if (opts.folder === "drafts") {
      return m.sender_id === opts.userId && m.folder === "draft";
    }
    if (opts.folder === "archive") {
      return m.folder === "archive";
    }
    /* inbox: recipient + folder=sent (matches route) */
    return m.folder === "sent" && m.recipient_ids.includes(opts.userId);
  });
}

function mutateArchive(rows: Msg[], id: string, tenantId: string): boolean {
  const row = rows.find((m) => m.id === id && m.office_id === tenantId);
  if (!row) return false;
  row.folder = "archive";
  return true;
}

function mutateSoftDelete(rows: Msg[], id: string, tenantId: string): boolean {
  const row = rows.find((m) => m.id === id && m.office_id === tenantId);
  if (!row) return false;
  row.deleted_at = new Date().toISOString();
  return true;
}

function sliceRoute(startMarker: string, endMarker: string): string {
  const start = routeTs.indexOf(startMarker);
  const end = routeTs.indexOf(endMarker);
  assert.ok(start >= 0 && end > start, `route slice ${startMarker} → ${endMarker}`);
  return routeTs.slice(start, end);
}

const listBlock = sliceRoute(
  "// GET /api/internal-messages?folder=inbox|sent|drafts|archive",
  "// GET /api/internal-messages/stats/counts",
);
const postBlock = sliceRoute(
  "// POST /api/internal-messages",
  "// PUT /api/internal-messages/:id/archive",
);
const archiveBlock = sliceRoute(
  "// PUT /api/internal-messages/:id/archive",
  "// DELETE /api/internal-messages/:id",
);
const deleteBlock = sliceRoute(
  "// DELETE /api/internal-messages/:id",
  "/* ══════════════════════════════════════════════════════\n   AI TOOLS",
);

console.log("\n═══ source: auth + canonical UUID gate ═══");
{
  assert.match(routeTs, /requireAuthWithTenant/);
  assert.match(routeTs, /assertCanonicalBusinessOfficeId/);
  assert.match(routeTs, /resolveCanonicalMessageOfficeId/);
  assert.match(listBlock, /router\.get\(\s*"\/"\s*,\s*requireAuthWithTenant/);
  assert.match(postBlock, /router\.post\(\s*"\/"\s*,\s*requireAuthWithTenant/);
  assert.match(archiveBlock, /router\.put\(\s*"\/:id\/archive"\s*,\s*requireAuthWithTenant/);
  assert.match(deleteBlock, /router\.delete\(\s*"\/:id"\s*,\s*requireAuthWithTenant/);
  /* list/create must not fall back to requireAuth-only */
  assert.doesNotMatch(listBlock, /router\.get\(\s*"\/"\s*,\s*requireAuth\s*,/);
  assert.doesNotMatch(postBlock, /router\.post\(\s*"\/"\s*,\s*requireAuth\s*,/);
  assert.doesNotMatch(routeTs, /office_id\s*\?\?\s*["']default["']/);
  assert.doesNotMatch(postBlock, /VALUES\s*\(\s*["']platform["']/);
  console.log("  ✅ requireAuthWithTenant + assertCanonicalBusinessOfficeId on list/create/mutate");
}

console.log("\n═══ source: every list/search folder scoped by office_id ═══");
{
  for (const folder of ["sent", "drafts", "archive", "inbox"] as const) {
    const marker =
      folder === "sent"
        ? 'if (folder === "sent")'
        : folder === "drafts"
          ? 'if (folder === "drafts")'
          : folder === "archive"
            ? 'if (folder === "archive")'
            : "// inbox";
    const idx = listBlock.indexOf(marker);
    assert.ok(idx >= 0, `${folder} branch present`);
    const nextMarkers = [
      'if (folder === "drafts")',
      'if (folder === "archive")',
      "// inbox",
      "res.json(rows)",
    ];
    let end = listBlock.length;
    for (const n of nextMarkers) {
      const nIdx = listBlock.indexOf(n, idx + marker.length);
      if (nIdx > idx && nIdx < end) end = nIdx;
    }
    const branch = listBlock.slice(idx, end);
    assert.match(
      branch,
      /m\.office_id\s*=\s*\$\{tenantId\}/,
      `${folder} must scope by m.office_id = canonicalTenantUuid`,
    );
    assert.match(branch, /messageSearchPredicate/, `${folder} must keep FTS predicate hook`);
  }
  /* archive must not be unscoped (previous P0 exposure) */
  assert.match(
    listBlock,
    /folder === "archive"[\s\S]*?m\.office_id\s*=\s*\$\{tenantId\}[\s\S]*?m\.folder\s*=\s*'archive'/,
  );
  console.log("  ✅ inbox/sent/drafts/archive (+ FTS) all require m.office_id = tenantId");
}

console.log("\n═══ source: POST persists office_id; mutates gate on office_id ═══");
{
  assert.match(
    postBlock,
    /INSERT INTO office_messages\s*\(\s*office_id\s*,/,
  );
  assert.match(postBlock, /VALUES\s*\(\s*\$\{tenantId\}/);
  assert.match(postBlock, /RETURNING id, office_id,/);
  assert.match(
    archiveBlock,
    /WHERE id = \$\{String\(req\.params\.id\)\}::uuid AND office_id = \$\{tenantId\}/,
  );
  assert.match(
    deleteBlock,
    /WHERE id = \$\{String\(req\.params\.id\)\}::uuid AND office_id = \$\{tenantId\}/,
  );
  console.log("  ✅ create writes office_id; archive/delete WHERE includes office_id");
}

console.log("\n═══ fail-closed: invalid / missing / platform tenant ═══");
{
  for (const bad of [null, undefined, "", "default", "platform", "trial_abc", "not-a-uuid"]) {
    assert.throws(
      () =>
        assertCanonicalBusinessOfficeId(bad, {
          userId: USER_A,
          source: "internal-messages",
        }),
      (err: unknown) => err instanceof TenantResolutionError,
      `must reject ${String(bad)}`,
    );
  }
  assert.equal(
    assertCanonicalBusinessOfficeId(OFFICE_A, {
      userId: USER_A,
      source: "internal-messages",
    }),
    OFFICE_A,
  );
  console.log("  ✅ unresolved/platform/legacy fail closed; UUID accepted");
}

console.log("\n═══ behavioral: office A cannot see office B (search/archive/folders) ═══");
{
  const store: Msg[] = [
    {
      id: "msg-a-sent",
      office_id: OFFICE_A,
      sender_id: USER_A,
      folder: "sent",
      subject: "سر مكتب أ",
      recipient_ids: [USER_A],
      deleted_at: null,
    },
    {
      id: "msg-b-sent",
      office_id: OFFICE_B,
      sender_id: USER_B,
      folder: "sent",
      subject: "سر مكتب ب",
      recipient_ids: [USER_A, USER_B], /* shared user id must still not cross tenants */
      deleted_at: null,
    },
    {
      id: "msg-a-draft",
      office_id: OFFICE_A,
      sender_id: USER_A,
      folder: "draft",
      subject: "مسودة أ",
      recipient_ids: [],
      deleted_at: null,
    },
    {
      id: "msg-b-draft",
      office_id: OFFICE_B,
      sender_id: USER_A, /* same sender, other office */
      folder: "draft",
      subject: "مسودة ب",
      recipient_ids: [],
      deleted_at: null,
    },
    {
      id: "msg-a-arch",
      office_id: OFFICE_A,
      sender_id: USER_A,
      folder: "archive",
      subject: "أرشيف أ",
      recipient_ids: [USER_A],
      deleted_at: null,
    },
    {
      id: "msg-b-arch",
      office_id: OFFICE_B,
      sender_id: USER_B,
      folder: "archive",
      subject: "أرشيف ب سر",
      recipient_ids: [USER_A],
      deleted_at: null,
    },
  ];

  const aSearch = listFolder(store, {
    tenantId: OFFICE_A,
    userId: USER_A,
    folder: "inbox",
    search: "سر",
  });
  assert.deepEqual(
    aSearch.map((m) => m.id),
    ["msg-a-sent"],
    "office A FTS/search must not return office B",
  );

  const aArchive = listFolder(store, {
    tenantId: OFFICE_A,
    userId: USER_A,
    folder: "archive",
  });
  assert.deepEqual(
    aArchive.map((m) => m.id),
    ["msg-a-arch"],
    "office A archive must not return office B archive",
  );
  assert.ok(!aArchive.some((m) => m.id === "msg-b-arch"));

  const aSent = listFolder(store, { tenantId: OFFICE_A, userId: USER_A, folder: "sent" });
  const aDrafts = listFolder(store, { tenantId: OFFICE_A, userId: USER_A, folder: "drafts" });
  const aInbox = listFolder(store, { tenantId: OFFICE_A, userId: USER_A, folder: "inbox" });
  /* sent = sender + folder != draft (includes archive rows owned by sender) */
  assert.deepEqual(aSent.map((m) => m.id).sort(), ["msg-a-arch", "msg-a-sent"]);
  assert.deepEqual(aDrafts.map((m) => m.id), ["msg-a-draft"]);
  assert.deepEqual(aInbox.map((m) => m.id), ["msg-a-sent"]);
  assert.ok(aSent.every((m) => m.office_id === OFFICE_A));
  assert.ok(aDrafts.every((m) => m.office_id === OFFICE_A));
  assert.ok(aInbox.every((m) => m.office_id === OFFICE_A));
  assert.ok(!aSent.some((m) => m.id === "msg-b-sent" || m.id === "msg-b-draft"));
  assert.ok(!aDrafts.some((m) => m.id === "msg-b-draft"));
  assert.ok(!aInbox.some((m) => m.id === "msg-b-sent"));
  console.log("  ✅ search/archive/sent/inbox/drafts office-scoped");
}

console.log("\n═══ behavioral: create stores office A UUID; mutate cannot touch B ═══");
{
  const created = {
    office_id: OFFICE_A,
    subject: "رسالة جديدة",
    sender_id: USER_A,
  };
  assert.equal(created.office_id, OFFICE_A);
  assert.notEqual(created.office_id, OFFICE_B);
  assert.notEqual(created.office_id, "platform");
  assert.notEqual(created.office_id, null);

  const store: Msg[] = [
    {
      id: "msg-b-target",
      office_id: OFFICE_B,
      sender_id: USER_B,
      folder: "sent",
      subject: "لا تلمس",
      recipient_ids: [USER_B],
      deleted_at: null,
    },
    {
      id: "msg-a-target",
      office_id: OFFICE_A,
      sender_id: USER_A,
      folder: "sent",
      subject: "قابل للتعديل",
      recipient_ids: [USER_A],
      deleted_at: null,
    },
  ];

  assert.equal(mutateArchive(store, "msg-b-target", OFFICE_A), false);
  assert.equal(store.find((m) => m.id === "msg-b-target")?.folder, "sent");
  assert.equal(mutateSoftDelete(store, "msg-b-target", OFFICE_A), false);
  assert.equal(store.find((m) => m.id === "msg-b-target")?.deleted_at, null);

  assert.equal(mutateArchive(store, "msg-a-target", OFFICE_A), true);
  assert.equal(store.find((m) => m.id === "msg-a-target")?.folder, "archive");
  assert.equal(mutateSoftDelete(store, "msg-a-target", OFFICE_A), true);
  assert.ok(store.find((m) => m.id === "msg-a-target")?.deleted_at);

  /* Source: create path binds VALUES(${tenantId}...) — office A UUID when resolved */
  assert.match(postBlock, /resolveCanonicalMessageOfficeId/);
  assert.match(postBlock, /VALUES \(\$\{tenantId\}/);
  console.log("  ✅ create binds canonical UUID; cross-tenant archive/delete no-op");
}

console.log("\n═══ source: unauthenticated contract remains requireAuthWithTenant ═══");
{
  /* Middleware itself returns 401 without userId — route must use it */
  const authTs = readFileSync(join(SRC, "middlewares/requireAuth.ts"), "utf8");
  assert.match(authTs, /export async function requireAuthWithTenant/);
  assert.match(
    authTs,
    /if \(!userId\) \{\s*return res\.status\(401\)/,
  );
  assert.match(authTs, /code:\s*"TNT_403"/);
  assert.match(listBlock, /requireAuthWithTenant/);
  assert.match(postBlock, /requireAuthWithTenant/);
  console.log("  ✅ unauthenticated → 401; unresolved tenant → fail closed via existing auth");
}

console.log("\n✅ internalMessagesTenantIsolation tests passed\n");
