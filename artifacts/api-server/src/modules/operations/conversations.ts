/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; pagination + schema authority */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { eventBus } from "../../core/eventBus";
import {
  MAX_PAGE_LIMIT,
  parsePageLimit,
  queryHasPageAndLimit,
} from "../../lib/paginationSafety";
import {
  buildConversationMemberRows,
  resolveUniqueMemberIds,
} from "../../lib/conversationMemberCreate";
import {
  assertCanonicalBusinessOfficeId,
  TenantResolutionError,
} from "../../lib/tenantResolution";

const router = Router();

function sqlRows(res: unknown): any[] {
  return (res as any).rows ?? (res as any) ?? [];
}

/**
 * Stage 23.3B — conversation paths require a canonical Office UUID.
 * Same resolver contract as Stage 20.1 internal-messages (no second tenant system).
 */
function resolveCanonicalConversationOfficeId(
  req: Request,
  res: Response,
): string | null {
  const userId = String((req as any).auth?.userId ?? (req as any).userId ?? "");
  try {
    return assertCanonicalBusinessOfficeId((req as any).tenantId, {
      userId,
      source: "conversations",
    });
  } catch (err: unknown) {
    if (err instanceof TenantResolutionError) {
      res.status(403).json({
        error: err.message,
        code: err.code,
        ...err.details,
      });
      return null;
    }
    res.status(403).json({
      error: "لا يمكن تحديد المكتب. تأكد من اكتمال إعداد الحساب.",
      code: "MISSING_CANONICAL_OFFICE_UUID",
    });
    return null;
  }
}

/** Membership only counts when conversation + member rows belong to officeId. */
async function isMember(convId: string, userId: string, officeId: string): Promise<boolean> {
  const rows = sqlRows(await db.execute(sql`
    SELECT 1
    FROM conversation_members cm
    JOIN message_conversations c ON c.id = cm.conversation_id
    WHERE cm.conversation_id = ${convId}::uuid
      AND cm.user_id = ${userId}
      AND c.office_id = ${officeId}
      AND cm.office_id = ${officeId}
    LIMIT 1
  `));
  return rows.length > 0;
}

async function isAdmin(convId: string, userId: string, officeId: string): Promise<boolean> {
  const rows = sqlRows(await db.execute(sql`
    SELECT 1
    FROM conversation_members cm
    JOIN message_conversations c ON c.id = cm.conversation_id
    WHERE cm.conversation_id = ${convId}::uuid
      AND cm.user_id = ${userId}
      AND cm.role = 'admin'
      AND c.office_id = ${officeId}
      AND cm.office_id = ${officeId}
    LIMIT 1
  `));
  return rows.length > 0;
}

async function getMemberIds(convId: string, officeId: string): Promise<string[]> {
  const rows = sqlRows(await db.execute(sql`
    SELECT cm.user_id
    FROM conversation_members cm
    JOIN message_conversations c ON c.id = cm.conversation_id
    WHERE cm.conversation_id = ${convId}::uuid
      AND c.office_id = ${officeId}
  `));
  return rows.map((r: any) => r.user_id);
}

async function conversationOwnedByOffice(convId: string, officeId: string): Promise<boolean> {
  const rows = sqlRows(await db.execute(sql`
    SELECT 1 FROM message_conversations
    WHERE id = ${convId}::uuid AND office_id = ${officeId}
    LIMIT 1
  `));
  return rows.length > 0;
}

/* ── 1. POST /conversations ────────────────────────────────────────────── */
router.post("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  const userId   = (req as any).auth?.userId;
  const tenantId = resolveCanonicalConversationOfficeId(req, res);
  if (!tenantId) return;
  const { title, type = "direct", memberIds = [], caseId = null } = req.body;

  if (!Array.isArray(memberIds)) {
    return res.status(400).json({ error: "memberIds must be an array" });
  }
  if (type === "group" && !title?.trim()) {
    return res.status(400).json({ error: "title مطلوب للمجموعات" });
  }

  const otherMembers: string[] = memberIds.filter((id: string) => id !== userId);

  if (otherMembers.length > 0) {
    const checked = sqlRows(await db.execute(sql`
      SELECT user_id FROM office_members
      WHERE office_id = ${tenantId} AND user_id = ANY(${otherMembers}::text[])
    `));
    if (checked.length < otherMembers.length) {
      return res.status(403).json({ error: "بعض الأعضاء لا ينتمون لنفس المكتب" });
    }
  }

  const convRow = sqlRows(await db.execute(sql`
    INSERT INTO message_conversations (office_id, title, type, created_by, case_id)
    VALUES (${tenantId}, ${title ?? null}, ${type}, ${userId}, ${caseId ?? null})
    RETURNING *
  `))[0];

  /* Set-based members: one name lookup + one bulk INSERT (no per-member loop). */
  const allIds = resolveUniqueMemberIds(userId, otherMembers);
  const nameRows = sqlRows(await db.execute(sql`
    SELECT id, COALESCE(full_name, first_name, email) AS name
    FROM users
    WHERE id = ANY(${allIds}::text[])
  `)).map((r: any) => ({ id: String(r.id), name: r.name == null ? null : String(r.name) }));

  const memberRows = buildConversationMemberRows({
    conversationId: String(convRow.id),
    officeId: String(tenantId),
    creatorId: userId,
    memberIds: otherMembers,
    nameRows,
  });

  if (memberRows.length > 0) {
    const userIds = memberRows.map((r) => r.user_id);
    const userNames = memberRows.map((r) => r.user_name);
    const roles = memberRows.map((r) => r.role);
    await db.execute(sql`
      INSERT INTO conversation_members (conversation_id, office_id, user_id, user_name, role)
      SELECT ${String(convRow.id)}::uuid, ${tenantId}, t.user_id, t.user_name, t.role
      FROM unnest(
        ${userIds}::text[],
        ${userNames}::text[],
        ${roles}::text[]
      ) AS t(user_id, user_name, role)
      ON CONFLICT (conversation_id, user_id) DO NOTHING
    `);
  }

  return res.json({ conversation: convRow });
});

/* ── 2. GET /conversations ─────────────────────────────────────────────── */
router.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  const userId   = (req as any).auth?.userId;
  const tenantId = resolveCanonicalConversationOfficeId(req, res);
  if (!tenantId) return;

  if (!userId) return res.status(401).json({ error: "غير مصرح" });

  const paginated = queryHasPageAndLimit(req.query);
  const { page, limit, offset } = paginated
    ? parsePageLimit(req.query, 50)
    : { page: 1, limit: MAX_PAGE_LIMIT, offset: 0 };

  /* Set-based list: CTEs + DISTINCT ON / GROUP BY — no per-row correlated scalars. */
  const rows = sqlRows(await db.execute(sql`
    WITH my_convs AS (
      SELECT
        c.id, c.title, c.type, c.created_by, c.created_at, c.updated_at,
        my.role AS my_role
      FROM message_conversations c
      JOIN conversation_members my
        ON my.conversation_id = c.id AND my.user_id = ${userId}
       AND my.office_id = ${tenantId}
      WHERE c.office_id = ${tenantId}
    ),
    last_msgs AS (
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id,
        m.body,
        m.created_at
      FROM office_messages m
      INNER JOIN my_convs mc ON mc.id = m.conversation_id
      WHERE m.office_id = ${tenantId}
      ORDER BY m.conversation_id, m.created_at DESC
    ),
    member_counts AS (
      SELECT cm.conversation_id, COUNT(*)::int AS member_count
      FROM conversation_members cm
      INNER JOIN my_convs mc ON mc.id = cm.conversation_id
      WHERE cm.office_id = ${tenantId}
      GROUP BY cm.conversation_id
    )
    SELECT
      c.id, c.title, c.type, c.created_by, c.created_at, c.updated_at,
      lm.body AS last_message,
      lm.created_at AS last_message_at,
      COALESCE(cnt.member_count, 0) AS member_count,
      c.my_role
    FROM my_convs c
    LEFT JOIN last_msgs lm ON lm.conversation_id = c.id
    LEFT JOIN member_counts cnt ON cnt.conversation_id = c.id
    ORDER BY COALESCE(lm.created_at, c.created_at) DESC
    LIMIT ${limit} OFFSET ${offset}
  `));

  if (!paginated) {
    return res.json(rows);
  }

  const total = Number(sqlRows(await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM message_conversations c
    JOIN conversation_members my
      ON my.conversation_id = c.id AND my.user_id = ${userId}
     AND my.office_id = ${tenantId}
    WHERE c.office_id = ${tenantId}
  `))[0]?.total ?? 0);

  return res.json({
    data: rows,
    total,
    page,
    limit,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
});

/* ── 3. GET /conversations/:id/messages ────────────────────────────────── */
router.get("/:id/messages", requireAuthWithTenant, async (req: Request, res: Response) => {
  const userId   = (req as any).auth?.userId;
  const tenantId = resolveCanonicalConversationOfficeId(req, res);
  if (!tenantId) return;
  const convId   = String(req.params.id);
  /* Preserve pageSize query alias; default 30 matches prior endpoint default. */
  const { page, limit: pageSize, offset } = parsePageLimit(
    { page: req.query.page, limit: req.query.pageSize ?? req.query.limit },
    30,
  );

  if (!/^[0-9a-f-]{36}$/.test(convId)) {
    return res.status(400).json({ error: "معرّف المحادثة غير صحيح" });
  }
  if (!(await isMember(convId, userId, tenantId))) {
    return res.status(403).json({ error: "لا تملك صلاحية عرض هذه المحادثة" });
  }

  const msgs = sqlRows(await db.execute(sql`
    SELECT id, subject, body, sender_id, sender_name, created_at, conversation_id
    FROM office_messages
    WHERE conversation_id = ${convId}::uuid
      AND office_id = ${tenantId}
    ORDER BY created_at ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `));

  const total = sqlRows(await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM office_messages
    WHERE conversation_id = ${convId}::uuid
      AND office_id = ${tenantId}
  `))[0]?.total ?? 0;

  const conv = sqlRows(await db.execute(sql`
    SELECT c.*,
      (SELECT json_agg(json_build_object(
        'userId', cm.user_id, 'userName', cm.user_name, 'role', cm.role
      )) FROM conversation_members cm
       WHERE cm.conversation_id = c.id AND cm.office_id = ${tenantId}) AS members
    FROM message_conversations c
    WHERE c.id = ${convId}::uuid AND c.office_id = ${tenantId}
    LIMIT 1
  `))[0];

  return res.json({ conversation: conv, messages: msgs, page, pageSize, total });
});

/* ── 4. POST /conversations/:id/messages ───────────────────────────────── */
router.post("/:id/messages", requireAuthWithTenant, async (req: Request, res: Response) => {
  const userId   = (req as any).auth?.userId;
  const userName = (req as any).auth?.fullName ?? (req as any).auth?.firstName ?? "مستخدم";
  const tenantId = resolveCanonicalConversationOfficeId(req, res);
  if (!tenantId) return;
  const convId   = String(req.params.id);
  const { body } = req.body;

  if (!body?.trim()) return res.status(400).json({ error: "body مطلوب" });
  if (!/^[0-9a-f-]{36}$/.test(convId)) {
    return res.status(400).json({ error: "معرّف المحادثة غير صحيح" });
  }
  if (!(await isMember(convId, userId, tenantId))) {
    return res.status(403).json({ error: "لا تملك صلاحية الإرسال في هذه المحادثة" });
  }
  /* Defense in depth: never stamp office A into an office B conversation. */
  if (!(await conversationOwnedByOffice(convId, tenantId))) {
    return res.status(403).json({ error: "لا تملك صلاحية الإرسال في هذه المحادثة" });
  }

  const titleRow = sqlRows(await db.execute(sql`
    SELECT COALESCE(title, 'رسالة') AS title
    FROM message_conversations
    WHERE id = ${convId}::uuid AND office_id = ${tenantId}
  `))[0];

  const msg = sqlRows(await db.execute(sql`
    INSERT INTO office_messages
      (office_id, subject, body, sender_id, sender_name, folder, conversation_id)
    VALUES
      (${tenantId}, ${titleRow?.title ?? "رسالة"}, ${body.trim()}, ${userId}, ${userName}, 'sent', ${convId}::uuid)
    RETURNING *
  `))[0];

  await db.execute(sql`
    UPDATE message_conversations
    SET updated_at = NOW()
    WHERE id = ${convId}::uuid AND office_id = ${tenantId}
  `).catch(() => {});

  const memberIds = await getMemberIds(convId, tenantId);
  eventBus.sendToUsers(
    memberIds.filter((id: string) => id !== userId),
    {
      type: "NEW_MESSAGE",
      payload: {
        messageId:      msg.id,
        conversationId: convId,
        senderName:     userName,
        preview:        body.trim().slice(0, 80),
      },
    },
  );

  return res.json({ message: msg });
});

/* ── 5. POST /conversations/:id/members ────────────────────────────────── */
router.post("/:id/members", requireAuthWithTenant, async (req: Request, res: Response) => {
  const userId   = (req as any).auth?.userId;
  const tenantId = resolveCanonicalConversationOfficeId(req, res);
  if (!tenantId) return;
  const convId   = String(req.params.id);
  const { newUserId, newUserName } = req.body;

  if (!newUserId) return res.status(400).json({ error: "newUserId مطلوب" });
  if (!/^[0-9a-f-]{36}$/.test(convId)) {
    return res.status(400).json({ error: "معرّف المحادثة غير صحيح" });
  }
  if (!(await isAdmin(convId, userId, tenantId))) {
    return res.status(403).json({ error: "فقط مسؤول المحادثة يمكنه إضافة أعضاء" });
  }
  if (!(await conversationOwnedByOffice(convId, tenantId))) {
    return res.status(403).json({ error: "فقط مسؤول المحادثة يمكنه إضافة أعضاء" });
  }

  const officeCheck = sqlRows(await db.execute(sql`
    SELECT 1 FROM office_members WHERE office_id = ${tenantId} AND user_id = ${newUserId} LIMIT 1
  `));
  if (officeCheck.length === 0) {
    return res.status(403).json({ error: "المستخدم لا ينتمي لهذا المكتب" });
  }

  let uname = newUserName;
  if (!uname) {
    const nameRow = sqlRows(await db.execute(sql`
      SELECT COALESCE(full_name, first_name, email) AS name FROM users WHERE id = ${newUserId} LIMIT 1
    `))[0];
    uname = nameRow?.name ?? newUserId;
  }

  await db.execute(sql`
    INSERT INTO conversation_members (conversation_id, office_id, user_id, user_name, role)
    VALUES (${convId}::uuid, ${tenantId}, ${newUserId}, ${uname}, 'member')
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET user_name = EXCLUDED.user_name
    WHERE conversation_members.office_id = ${tenantId}
  `);

  return res.json({ ok: true, added: newUserId });
});

export default router;
