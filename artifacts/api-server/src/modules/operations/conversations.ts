import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { eventBus } from "../../core/eventBus";

const router = Router();

function sqlRows(res: unknown): any[] {
  return (res as any).rows ?? (res as any) ?? [];
}

async function isMember(convId: string, userId: string): Promise<boolean> {
  const rows = sqlRows(await db.execute(sql`
    SELECT 1 FROM conversation_members
    WHERE conversation_id = ${convId}::uuid AND user_id = ${userId}
    LIMIT 1
  `));
  return rows.length > 0;
}

async function isAdmin(convId: string, userId: string): Promise<boolean> {
  const rows = sqlRows(await db.execute(sql`
    SELECT 1 FROM conversation_members
    WHERE conversation_id = ${convId}::uuid AND user_id = ${userId} AND role = 'admin'
    LIMIT 1
  `));
  return rows.length > 0;
}

async function getMemberIds(convId: string): Promise<string[]> {
  const rows = sqlRows(await db.execute(sql`
    SELECT user_id FROM conversation_members WHERE conversation_id = ${convId}::uuid
  `));
  return rows.map((r: any) => r.user_id);
}

/* ── 1. POST /conversations ────────────────────────────────────────────── */
router.post("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  const userId   = (req as any).auth?.userId;
  const userName = (req as any).auth?.fullName ?? (req as any).auth?.firstName ?? "مستخدم";
  const tenantId = (req as any).tenantId;
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

  const allIds: string[] = [...new Set<string>([userId, ...otherMembers])];
  for (const uid of allIds) {
    const role = uid === userId ? "admin" : "member";
    const nameRow = sqlRows(await db.execute(sql`
      SELECT COALESCE(full_name, first_name, email) AS name FROM users WHERE id = ${uid} LIMIT 1
    `))[0];
    const uname = nameRow?.name ?? uid;
    await db.execute(sql`
      INSERT INTO conversation_members (conversation_id, office_id, user_id, user_name, role)
      VALUES (${convRow.id}::uuid, ${tenantId}, ${uid}, ${uname}, ${role})
      ON CONFLICT (conversation_id, user_id) DO NOTHING
    `).catch(() => {});
  }

  return res.json({ conversation: convRow });
});

/* ── 2. GET /conversations ─────────────────────────────────────────────── */
router.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  const userId   = (req as any).auth?.userId;
  const tenantId = (req as any).tenantId;

  if (!userId) return res.status(401).json({ error: "غير مصرح" });

  const rows = sqlRows(await db.execute(sql`
    SELECT
      c.id, c.title, c.type, c.created_by, c.created_at, c.updated_at,
      (
        SELECT m.body FROM office_messages m
        WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
      ) AS last_message,
      (
        SELECT m.created_at FROM office_messages m
        WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
      ) AS last_message_at,
      (
        SELECT COUNT(*)::int FROM conversation_members cm2 WHERE cm2.conversation_id = c.id
      ) AS member_count,
      my.role AS my_role
    FROM message_conversations c
    JOIN conversation_members my
      ON my.conversation_id = c.id AND my.user_id = ${userId}
    WHERE c.office_id = ${tenantId}
    ORDER BY COALESCE(
      (SELECT m.created_at FROM office_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
      c.created_at
    ) DESC
  `));
  return res.json(rows);
});

/* ── 3. GET /conversations/:id/messages ────────────────────────────────── */
router.get("/:id/messages", requireAuthWithTenant, async (req: Request, res: Response) => {
  const userId   = (req as any).auth?.userId;
  const convId   = String(req.params.id);
  const page     = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const pageSize = Math.min(50, Math.max(10, parseInt(String(req.query.pageSize ?? "30"))));
  const offset   = (page - 1) * pageSize;

  if (!/^[0-9a-f-]{36}$/.test(convId)) {
    return res.status(400).json({ error: "معرّف المحادثة غير صحيح" });
  }
  if (!(await isMember(convId, userId))) {
    return res.status(403).json({ error: "لا تملك صلاحية عرض هذه المحادثة" });
  }

  const msgs = sqlRows(await db.execute(sql`
    SELECT id, subject, body, sender_id, sender_name, created_at, conversation_id
    FROM office_messages
    WHERE conversation_id = ${convId}::uuid
    ORDER BY created_at ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `));

  const total = sqlRows(await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM office_messages WHERE conversation_id = ${convId}::uuid
  `))[0]?.total ?? 0;

  const conv = sqlRows(await db.execute(sql`
    SELECT c.*,
      (SELECT json_agg(json_build_object(
        'userId', cm.user_id, 'userName', cm.user_name, 'role', cm.role
      )) FROM conversation_members cm WHERE cm.conversation_id = c.id) AS members
    FROM message_conversations c WHERE c.id = ${convId}::uuid LIMIT 1
  `))[0];

  return res.json({ conversation: conv, messages: msgs, page, pageSize, total });
});

/* ── 4. POST /conversations/:id/messages ───────────────────────────────── */
router.post("/:id/messages", requireAuthWithTenant, async (req: Request, res: Response) => {
  const userId   = (req as any).auth?.userId;
  const userName = (req as any).auth?.fullName ?? (req as any).auth?.firstName ?? "مستخدم";
  const tenantId = (req as any).tenantId;
  const convId   = String(req.params.id);
  const { body } = req.body;

  if (!body?.trim()) return res.status(400).json({ error: "body مطلوب" });
  if (!/^[0-9a-f-]{36}$/.test(convId)) {
    return res.status(400).json({ error: "معرّف المحادثة غير صحيح" });
  }
  if (!(await isMember(convId, userId))) {
    return res.status(403).json({ error: "لا تملك صلاحية الإرسال في هذه المحادثة" });
  }

  const titleRow = sqlRows(await db.execute(sql`
    SELECT COALESCE(title, 'رسالة') AS title FROM message_conversations WHERE id = ${convId}::uuid
  `))[0];

  const msg = sqlRows(await db.execute(sql`
    INSERT INTO office_messages
      (office_id, subject, body, sender_id, sender_name, folder, conversation_id)
    VALUES
      (${tenantId}, ${titleRow?.title ?? "رسالة"}, ${body.trim()}, ${userId}, ${userName}, 'sent', ${convId}::uuid)
    RETURNING *
  `))[0];

  await db.execute(sql`
    UPDATE message_conversations SET updated_at = NOW() WHERE id = ${convId}::uuid
  `).catch(() => {});

  const memberIds = await getMemberIds(convId);
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
  const tenantId = (req as any).tenantId;
  const convId   = String(req.params.id);
  const { newUserId, newUserName } = req.body;

  if (!newUserId) return res.status(400).json({ error: "newUserId مطلوب" });
  if (!/^[0-9a-f-]{36}$/.test(convId)) {
    return res.status(400).json({ error: "معرّف المحادثة غير صحيح" });
  }
  if (!(await isAdmin(convId, userId))) {
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
  `);

  return res.json({ ok: true, added: newUserId });
});

export default router;
