import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function getDeviceInfo(req: Request): string {
  const ua = req.headers["user-agent"] ?? "";
  if (/Mobile|Android|iPhone/i.test(ua)) return "جهاز جوال";
  if (/iPad|Tablet/i.test(ua)) return "جهاز لوحي";
  return "حاسوب";
}

// GET /api/internal-messages?folder=inbox|sent|drafts|archive
router.get("/", async (req: Request, res: Response) => {
  try {
    const { folder = "inbox", search = "" } = req.query as any;
    const userId = (req as any).auth?.userId ?? "anonymous";
    const searchParam = search ? `%${search}%` : null;

    let rows: any[] = [];

    if (folder === "sent") {
      const q = await db.execute(sql`
        SELECT m.id, m.subject, m.body, m.sender_id, m.sender_name, m.sender_ip, m.device_info,
               m.folder, m.tags, m.created_at,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('userId', r.user_id, 'userName', r.user_name, 'isRead', r.is_read, 'readAt', r.read_at, 'readerIp', r.reader_ip))
            FILTER (WHERE r.id IS NOT NULL), '[]'
          ) AS recipients,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('id', a.id::text, 'fileName', a.file_name, 'fileUrl', a.file_url, 'fileSize', a.file_size))
            FILTER (WHERE a.id IS NOT NULL), '[]'
          ) AS attachments
        FROM office_messages m
        LEFT JOIN office_message_recipients r ON r.message_id = m.id
        LEFT JOIN office_message_attachments a ON a.message_id = m.id
        WHERE m.sender_id = ${userId} AND m.folder != 'draft'
          ${searchParam ? sql`AND (m.subject ILIKE ${searchParam} OR m.body ILIKE ${searchParam})` : sql``}
        GROUP BY m.id
        ORDER BY m.created_at DESC
        LIMIT 100
      `);
      rows = q.rows as any[];
    } else if (folder === "drafts") {
      const q = await db.execute(sql`
        SELECT m.id, m.subject, m.body, m.sender_id, m.sender_name, m.folder, m.tags, m.created_at,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('userId', r.user_id, 'userName', r.user_name))
            FILTER (WHERE r.id IS NOT NULL), '[]'
          ) AS recipients,
          '[]'::json AS attachments
        FROM office_messages m
        LEFT JOIN office_message_recipients r ON r.message_id = m.id
        WHERE m.sender_id = ${userId} AND m.folder = 'draft'
          ${searchParam ? sql`AND (m.subject ILIKE ${searchParam} OR m.body ILIKE ${searchParam})` : sql``}
        GROUP BY m.id
        ORDER BY m.created_at DESC
        LIMIT 100
      `);
      rows = q.rows as any[];
    } else if (folder === "archive") {
      const q = await db.execute(sql`
        SELECT m.id, m.subject, m.body, m.sender_id, m.sender_name, m.folder, m.tags, m.created_at,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('userId', r.user_id, 'userName', r.user_name, 'isRead', r.is_read))
            FILTER (WHERE r.id IS NOT NULL), '[]'
          ) AS recipients,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('id', a.id::text, 'fileName', a.file_name, 'fileUrl', a.file_url))
            FILTER (WHERE a.id IS NOT NULL), '[]'
          ) AS attachments
        FROM office_messages m
        LEFT JOIN office_message_recipients r ON r.message_id = m.id
        LEFT JOIN office_message_attachments a ON a.message_id = m.id
        WHERE m.folder = 'archive'
          ${searchParam ? sql`AND (m.subject ILIKE ${searchParam} OR m.body ILIKE ${searchParam})` : sql``}
        GROUP BY m.id
        ORDER BY m.created_at DESC
        LIMIT 100
      `);
      rows = q.rows as any[];
    } else {
      // inbox
      const q = await db.execute(sql`
        SELECT m.id, m.subject, m.body, m.sender_id, m.sender_name, m.folder, m.tags, m.created_at,
               r_me.is_read, r_me.read_at, r_me.reader_ip,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('userId', r2.user_id, 'userName', r2.user_name, 'isRead', r2.is_read))
            FILTER (WHERE r2.id IS NOT NULL), '[]'
          ) AS recipients,
          COALESCE(
            json_agg(DISTINCT jsonb_build_object('id', a.id::text, 'fileName', a.file_name, 'fileUrl', a.file_url))
            FILTER (WHERE a.id IS NOT NULL), '[]'
          ) AS attachments
        FROM office_messages m
        JOIN office_message_recipients r_me ON r_me.message_id = m.id AND r_me.user_id = ${userId}
        LEFT JOIN office_message_recipients r2 ON r2.message_id = m.id
        LEFT JOIN office_message_attachments a ON a.message_id = m.id
        WHERE m.folder = 'sent'
          ${searchParam ? sql`AND (m.subject ILIKE ${searchParam} OR m.body ILIKE ${searchParam})` : sql``}
        GROUP BY m.id, r_me.is_read, r_me.read_at, r_me.reader_ip
        ORDER BY m.created_at DESC
        LIMIT 100
      `);
      rows = q.rows as any[];
    }

    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/internal-messages/stats/counts
router.get("/stats/counts", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId ?? "anonymous";

    const inboxQ = await db.execute(sql`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN r.is_read = FALSE THEN 1 ELSE 0 END) AS unread
      FROM office_messages m
      JOIN office_message_recipients r ON r.message_id = m.id AND r.user_id = ${userId}
      WHERE m.folder = 'sent'
    `);

    const sentQ = await db.execute(sql`
      SELECT COUNT(*) AS total FROM office_messages WHERE sender_id = ${userId} AND folder != 'draft'
    `);

    const draftQ = await db.execute(sql`
      SELECT COUNT(*) AS total FROM office_messages WHERE sender_id = ${userId} AND folder = 'draft'
    `);

    res.json({
      inbox:  { total: Number((inboxQ.rows[0] as any)?.total ?? 0), unread: Number((inboxQ.rows[0] as any)?.unread ?? 0) },
      sent:   { total: Number((sentQ.rows[0] as any)?.total ?? 0) },
      drafts: { total: Number((draftQ.rows[0] as any)?.total ?? 0) },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/internal-messages/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).auth?.userId ?? "anonymous";
    const ip = getClientIp(req);

    const q = await db.execute(sql`
      SELECT m.id, m.subject, m.body, m.sender_id, m.sender_name, m.sender_ip, m.device_info,
             m.folder, m.tags, m.created_at,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', r.id::text, 'userId', r.user_id, 'userName', r.user_name,
            'isRead', r.is_read, 'readAt', r.read_at, 'readerIp', r.reader_ip
          )) FILTER (WHERE r.id IS NOT NULL), '[]'
        ) AS recipients,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', a.id::text, 'fileName', a.file_name, 'fileUrl', a.file_url, 'fileSize', a.file_size
          )) FILTER (WHERE a.id IS NOT NULL), '[]'
        ) AS attachments
      FROM office_messages m
      LEFT JOIN office_message_recipients r ON r.message_id = m.id
      LEFT JOIN office_message_attachments a ON a.message_id = m.id
      WHERE m.id = ${id}::uuid
      GROUP BY m.id
    `);

    if (!q.rows[0]) return res.status(404).json({ error: "not found" });

    await db.execute(sql`
      UPDATE office_message_recipients
      SET is_read = TRUE, read_at = NOW(), reader_ip = ${ip}
      WHERE message_id = ${id}::uuid AND user_id = ${userId} AND is_read = FALSE
    `);

    res.json(q.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/internal-messages
router.post("/", async (req: Request, res: Response) => {
  try {
    const { subject, body, recipients = [], attachments = [], folder = "sent", tags = [] } = req.body;
    const userId = (req as any).auth?.userId ?? "anonymous";
    const senderName = (req as any).auth?.sessionClaims?.fullName ?? "المرسِل";
    const ip = getClientIp(req);
    const device = getDeviceInfo(req);
    const tagsArr = `{${(tags as string[]).join(",")}}`;

    const ins = await db.execute(sql`
      INSERT INTO office_messages (subject, body, sender_id, sender_name, sender_ip, device_info, folder, tags)
      VALUES (${subject}, ${body}, ${userId}, ${senderName}, ${ip}, ${device}, ${folder}, ${tagsArr})
      RETURNING id, subject, body, sender_id, sender_name, folder, created_at
    `);

    const msg = ins.rows[0] as any;

    for (const r of recipients as any[]) {
      await db.execute(sql`
        INSERT INTO office_message_recipients (message_id, user_id, user_name)
        VALUES (${msg.id}::uuid, ${r.userId}, ${r.userName ?? r.userId})
      `);
    }

    for (const a of attachments as any[]) {
      await db.execute(sql`
        INSERT INTO office_message_attachments (message_id, file_name, file_url, file_size)
        VALUES (${msg.id}::uuid, ${a.fileName}, ${a.fileUrl}, ${a.fileSize ?? 0})
      `);
    }

    res.json(msg);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/internal-messages/:id/archive
router.put("/:id/archive", async (req: Request, res: Response) => {
  try {
    await db.execute(sql`UPDATE office_messages SET folder = 'archive' WHERE id = ${req.params.id}::uuid`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/internal-messages/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await db.execute(sql`DELETE FROM office_messages WHERE id = ${req.params.id}::uuid`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
