/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; schema authority */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { eventBus } from "../../core/eventBus";
import {
  buildMessageAttachmentRows,
  buildMessageRecipientRows,
} from "../../lib/internalMessageCreate";
import {
  assertCanonicalBusinessOfficeId,
  TenantResolutionError,
} from "../../lib/tenantResolution";
import { getMessageFtsConfig } from "./messageFtsConfig";

const router = Router();

/**
 * Stage 20.1 — business message paths require a canonical Office UUID.
 * requireAuthWithTenant may inject synthetic "platform" for SA; that must
 * never own or read office_messages rows.
 */
function resolveCanonicalMessageOfficeId(
  req: Request,
  res: Response,
): string | null {
  const userId = String((req as any).auth?.userId ?? (req as any).userId ?? "");
  try {
    return assertCanonicalBusinessOfficeId((req as any).tenantId, {
      userId,
      source: "internal-messages",
    });
  } catch (err: unknown) {
    if (err instanceof TenantResolutionError) {
      const status = err.code === "PLATFORM_FORBIDDEN_FOR_USER" ? 403 : 403;
      res.status(status).json({
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

/* office_messages.case_id TEXT alignment is owned by migration 030 (Stage 22).
   No Runtime INTEGER ADD COLUMN for case_id at boot. */

/* Full-text search schema is owned by migration 016_office_messages_fts.sql.
   Query config is read from the live search_vector generated expression. */

function messageSearchPredicate(searchTerm: string | null, ftsConfig: string | null) {
  return searchTerm && ftsConfig
    ? sql`AND m.search_vector @@ plainto_tsquery(${ftsConfig}::regconfig, ${searchTerm})`
    : sql``;
}

/* message_conversations + conversation_members schema authority:
   artifacts/api-server/migrations/031_message_conversations_schema_authority.sql
   (Stage 23.3B). No Runtime CREATE TABLE / CREATE INDEX for these tables.
   office_messages.conversation_id / deleted_at remain owned by migration 016. */

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
// Stage 20.1 — every folder/FTS path is scoped by canonical office_id.
router.get("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveCanonicalMessageOfficeId(req, res);
    if (!tenantId) return;

    const { folder = "inbox", search = "" } = req.query as any;
    const userId = (req as any).auth?.userId ?? (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    }
    const searchTerm: string | null = search ? String(search).trim() : null;
    const ftsConfig = searchTerm ? await getMessageFtsConfig() : null;

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
        WHERE m.office_id = ${tenantId}
          AND m.sender_id = ${userId} AND m.folder != 'draft'
          ${messageSearchPredicate(searchTerm, ftsConfig)}
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
        WHERE m.office_id = ${tenantId}
          AND m.sender_id = ${userId} AND m.folder = 'draft'
          ${messageSearchPredicate(searchTerm, ftsConfig)}
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
        WHERE m.office_id = ${tenantId}
          AND m.folder = 'archive'
          ${messageSearchPredicate(searchTerm, ftsConfig)}
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
        WHERE m.office_id = ${tenantId}
          AND m.folder = 'sent'
          ${messageSearchPredicate(searchTerm, ftsConfig)}
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
// Stage 21 — counts scoped to canonical office (same userId across offices ≠ merge).
router.get("/stats/counts", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveCanonicalMessageOfficeId(req, res);
    if (!tenantId) return;
    const userId = (req as any).auth?.userId ?? (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    }

    const inboxQ = await db.execute(sql`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN r.is_read = FALSE THEN 1 ELSE 0 END) AS unread
      FROM office_messages m
      JOIN office_message_recipients r ON r.message_id = m.id AND r.user_id = ${userId}
      WHERE m.office_id = ${tenantId}
        AND m.folder = 'sent'
    `);

    const sentQ = await db.execute(sql`
      SELECT COUNT(*) AS total FROM office_messages
      WHERE office_id = ${tenantId}
        AND sender_id = ${userId}
        AND folder != 'draft'
    `);

    const draftQ = await db.execute(sql`
      SELECT COUNT(*) AS total FROM office_messages
      WHERE office_id = ${tenantId}
        AND sender_id = ${userId}
        AND folder = 'draft'
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

/* ══════════════════════════════════════════════════════
   ANALYTICS — GET /api/internal-messages/analytics
   لوحة تحكم شاملة لنظام المراسلات
   Stage 21 — registered BEFORE /:id so Express cannot shadow it.
══════════════════════════════════════════════════════ */
router.get("/analytics", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveCanonicalMessageOfficeId(req, res);
    if (!tenantId) return;
    const userId   = (req as any).auth?.userId ?? "";
    const days     = Math.min(90, Math.max(1, Number(req.query.days ?? 30)));

    const [dailyCounts, topSenders, unreadCount, convStats, topCases, avgResponse, aiUsage] = await Promise.all([
      db.execute(sql`
        SELECT DATE(created_at) AS day, COUNT(*)::int AS count
        FROM office_messages
        WHERE office_id = ${tenantId}
          AND created_at >= NOW() - (${days} || ' days')::interval
          AND (deleted_at IS NULL OR deleted_at > NOW())
          AND folder != 'draft'
        GROUP BY day ORDER BY day DESC LIMIT ${days}
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT sender_name, COUNT(*)::int AS count
        FROM office_messages
        WHERE office_id = ${tenantId}
          AND created_at >= NOW() - (${days} || ' days')::interval
          AND folder != 'draft'
          AND (deleted_at IS NULL OR deleted_at > NOW())
        GROUP BY sender_name ORDER BY count DESC LIMIT 5
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT COUNT(*)::int AS n
        FROM office_message_recipients r
        JOIN office_messages m ON m.id = r.message_id
        WHERE r.user_id = ${userId}
          AND r.is_read = FALSE
          AND m.office_id = ${tenantId}
          AND (m.deleted_at IS NULL OR m.deleted_at > NOW())
      `).catch(() => ({ rows: [{ n: 0 }] })),

      db.execute(sql`
        SELECT
          COUNT(DISTINCT mc.id)::int AS total_conversations,
          (SELECT COUNT(*)::int FROM office_messages WHERE conversation_id IS NOT NULL
            AND office_id = ${tenantId}
            AND (deleted_at IS NULL OR deleted_at > NOW())) AS total_conv_messages
        FROM message_conversations mc
        WHERE mc.office_id = ${tenantId}
      `).catch(() => ({ rows: [{ total_conversations: 0, total_conv_messages: 0 }] })),

      db.execute(sql`
        SELECT c.id, c.title, COUNT(m.id)::int AS msg_count
        FROM office_messages m
        JOIN cases c ON c.id = m.case_id AND c.office_id = ${tenantId}
        WHERE m.office_id = ${tenantId}
          AND (m.deleted_at IS NULL OR m.deleted_at > NOW())
          AND m.created_at >= NOW() - (${days} || ' days')::interval
        GROUP BY c.id, c.title ORDER BY msg_count DESC LIMIT 5
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (r.read_at - m.created_at)) / 3600)::numeric, 1) AS avg_hours
        FROM office_messages m
        JOIN office_message_recipients r ON r.message_id = m.id
        WHERE m.office_id = ${tenantId} AND r.is_read = TRUE AND r.read_at IS NOT NULL
          AND m.created_at >= NOW() - (${days} || ' days')::interval
      `).catch(() => ({ rows: [{ avg_hours: null }] })),

      db.execute(sql`
        SELECT COUNT(*)::int AS n
        FROM office_messages
        WHERE office_id = ${tenantId}
          AND (
            body ILIKE '%AI%'
            OR body ILIKE '%ذكاء%'
            OR body ILIKE '%تلقائي%'
          )
          AND created_at >= NOW() - (${days} || ' days')::interval
      `).catch(() => ({ rows: [{ n: 0 }] })),
    ]);

    const daily = (dailyCounts as any).rows ?? [];
    const totalMessages = daily.reduce((s: number, r: any) => s + Number(r.count), 0);
    const conv = ((convStats as any).rows ?? [])[0] ?? {};

    res.json({
      period:           `${days} يوم`,
      totalMessages,
      unreadCount:      Number(((unreadCount as any).rows ?? [])[0]?.n ?? 0),
      avgResponseHours: Number(((avgResponse as any).rows ?? [])[0]?.avg_hours ?? 0) || null,
      aiMessages:       Number(((aiUsage as any).rows ?? [])[0]?.n ?? 0),
      dailyCounts:      daily,
      topSenders:       (topSenders as any).rows ?? [],
      topCases:         (topCases as any).rows ?? [],
      conversations: {
        total:    Number(conv.total_conversations ?? 0),
        messages: Number(conv.total_conv_messages ?? 0),
      },
      kpis: {
        messagesPerDay:      totalMessages / Math.max(days, 1),
        responseTimeRating:  (() => {
          const h = Number(((avgResponse as any).rows ?? [])[0]?.avg_hours ?? 99);
          if (h <= 1)  return "ممتاز";
          if (h <= 4)  return "جيد";
          if (h <= 24) return "متوسط";
          return "بطيء";
        })(),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/internal-messages/case/:caseId — messages for a specific case
// Stage 21 — canonical office + case ownership; no parseInt on cases.id (TEXT UUID).
router.get("/case/:caseId", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveCanonicalMessageOfficeId(req, res);
    if (!tenantId) return;

    const { caseId } = req.params as Record<string, string>;
    /* cases.id is TEXT (UUID). Reject empty; do not parseInt / invent identifiers. */
    if (!caseId || !String(caseId).trim()) {
      return res.json([]);
    }
    const caseKey = String(caseId).trim();

    const owned = await db.execute(sql`
      SELECT c.id
      FROM cases c
      WHERE c.id = ${caseKey}
        AND c.office_id = ${tenantId}
      LIMIT 1
    `);
    if (!owned.rows[0]) {
      /* Foreign / missing case — empty list (no existence leak via error codes). */
      return res.json([]);
    }

    const q = await db.execute(sql`
      SELECT m.id, m.subject, m.body, m.sender_id, m.sender_name,
             m.sender_ip, m.device_info, m.folder, m.tags, m.created_at, m.case_id,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'userId', r.user_id, 'userName', r.user_name,
            'isRead', r.is_read, 'readAt', r.read_at
          )) FILTER (WHERE r.id IS NOT NULL), '[]'
        ) AS recipients
      FROM office_messages m
      LEFT JOIN office_message_recipients r ON r.message_id = m.id
      WHERE m.office_id = ${tenantId}
        AND m.case_id = ${caseKey}
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT 100
    `);

    res.json(q.rows ?? []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/internal-messages/:id
// Stage 21 — office-scoped + sender/recipient participant gate; uniform 404.
router.get("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveCanonicalMessageOfficeId(req, res);
    if (!tenantId) return;

    const { id } = req.params as Record<string, string>;
    const userId = (req as any).auth?.userId ?? (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    }
    const ip = getClientIp(req);

    /* Uniform not-found for malformed / foreign / non-participant ids. */
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(404).json({ error: "not found" });
    }

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
        AND m.office_id = ${tenantId}
        AND (
          m.sender_id = ${userId}
          OR EXISTS (
            SELECT 1 FROM office_message_recipients rx
            WHERE rx.message_id = m.id AND rx.user_id = ${userId}
          )
        )
      GROUP BY m.id
    `);

    if (!q.rows[0]) return res.status(404).json({ error: "not found" });

    await db.execute(sql`
      UPDATE office_message_recipients r
      SET is_read = TRUE, read_at = NOW(), reader_ip = ${ip}
      FROM office_messages m
      WHERE r.message_id = m.id
        AND m.id = ${id}::uuid
        AND m.office_id = ${tenantId}
        AND r.user_id = ${userId}
        AND r.is_read = FALSE
    `);

    res.json(q.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/internal-messages
// Stage 20.1 — create requires canonical Office UUID and persists office_id.
router.post("/", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveCanonicalMessageOfficeId(req, res);
    if (!tenantId) return;

    const { subject, body, recipients = [], attachments = [], folder = "sent", tags = [], caseId } = req.body;
    const userId = (req as any).auth?.userId ?? (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "غير مصرح. يرجى تسجيل الدخول." });
    }
    const senderName = (req as any).auth?.sessionClaims?.fullName ?? "المرسِل";
    const ip = getClientIp(req);
    const device = getDeviceInfo(req);
    const tagsArr = `{${(tags as string[]).join(",")}}`;

    /* Stage 22 — caseId is TEXT (cases.id). Prove same-office ownership before link.
       Never Number()/parseInt; never invent UUID mappings; never infer tenant from caseId. */
    let provenCaseId: string | null = null;
    if (caseId != null && String(caseId).trim() !== "") {
      const caseKey = String(caseId).trim();
      const caseCheck = await db.execute(sql`
        SELECT id FROM cases
        WHERE id = ${caseKey}
          AND office_id = ${tenantId}
        LIMIT 1
      `);
      if ((caseCheck.rows || []).length === 0) {
        return res.status(403).json({ error: "القضية غير تابعة لمكتبك" });
      }
      provenCaseId = caseKey;
    }

    const ins = await db.execute(sql`
      INSERT INTO office_messages (office_id, subject, body, sender_id, sender_name, sender_ip, device_info, folder, tags, case_id)
      VALUES (${tenantId}, ${subject}, ${body}, ${userId}, ${senderName}, ${ip}, ${device}, ${folder}, ${tagsArr},
              ${provenCaseId})
      RETURNING id, office_id, subject, body, sender_id, sender_name, folder, created_at, case_id
    `);

    const msg = ins.rows[0] as any;

    /* Set-based side-effects: fixed ≤2 write statements (no per-row loops). */
    const recipientRows = buildMessageRecipientRows(String(msg.id), recipients as any[]);
    const attachmentRows = buildMessageAttachmentRows(String(msg.id), attachments as any[]);

    if (recipientRows.length > 0) {
      const userIds = recipientRows.map((r) => r.user_id);
      const userNames = recipientRows.map((r) => r.user_name);
      await db.execute(sql`
        INSERT INTO office_message_recipients (message_id, user_id, user_name)
        SELECT ${String(msg.id)}::uuid, t.user_id, t.user_name
        FROM unnest(
          ${userIds}::text[],
          ${userNames}::text[]
        ) AS t(user_id, user_name)
      `);
    }

    if (attachmentRows.length > 0) {
      const fileNames = attachmentRows.map((a) => a.file_name);
      const fileUrls = attachmentRows.map((a) => a.file_url);
      const fileSizes = attachmentRows.map((a) => a.file_size);
      await db.execute(sql`
        INSERT INTO office_message_attachments (message_id, file_name, file_url, file_size)
        SELECT ${String(msg.id)}::uuid, t.file_name, t.file_url, t.file_size
        FROM unnest(
          ${fileNames}::text[],
          ${fileUrls}::text[],
          ${fileSizes}::int[]
        ) AS t(file_name, file_url, file_size)
      `);
    }

    /* ── Targeted SSE notification — only to the intended recipients ──
       sendToUsers() does NOT broadcast to the whole office, only to the
       specific users whose SSE connections are registered with their userId. */
    const recipientIds = recipientRows.map((r) => r.user_id);

    if (recipientIds.length > 0) {
      eventBus.sendToUsers(recipientIds, {
        id:        crypto.randomUUID(),
        type:      "NEW_MESSAGE",
        label:     "رسالة جديدة",
        data: {
          messageId:  msg.id,
          subject:    subject,
          senderName: senderName,
          preview:    String(body ?? "").slice(0, 100),
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.json(msg);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/internal-messages/:id/archive
router.put("/:id/archive", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveCanonicalMessageOfficeId(req, res);
    if (!tenantId) return;
    await db.execute(sql`
      UPDATE office_messages SET folder = 'archive'
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/internal-messages/:id  (soft delete)
router.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveCanonicalMessageOfficeId(req, res);
    if (!tenantId) return;
    await db.execute(sql`
      UPDATE office_messages SET deleted_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════
   AI TOOLS — POST /api/internal-messages/ai-tools
   أدوات ذكاء اصطناعي مدمجة في المراسلات
   Stage 21 — conversationId DB load is office-scoped.
══════════════════════════════════════════════════════ */
router.post("/ai-tools", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = resolveCanonicalMessageOfficeId(req, res);
    if (!tenantId) return;
    const { tool, conversationId, messages: inputMessages, targetLanguage } = req.body as {
      tool: "summarize" | "extract_tasks" | "extract_decisions" | "extract_appointments" | "suggest_reply" | "translate" | "meeting_minutes";
      conversationId?: string;
      messages?: Array<{ sender_name: string; body: string; created_at: string }>;
      targetLanguage?: string;
    };

    let msgs: any[] = inputMessages ?? [];
    if (!msgs.length && conversationId) {
      const r = await db.execute(sql`
        SELECT m.sender_name, m.body, m.created_at
        FROM office_messages m
        WHERE m.conversation_id = ${conversationId}::uuid
          AND m.office_id = ${tenantId}
          AND (m.deleted_at IS NULL OR m.deleted_at > NOW())
        ORDER BY m.created_at ASC LIMIT 60
      `).catch(() => ({ rows: [] }));
      msgs = (r as any).rows ?? [];
    }

    if (!msgs.length) return res.json({ result: "لا توجد رسائل للمعالجة." });

    const convText = msgs.map((m: any) =>
      `[${new Date(m.created_at).toLocaleTimeString("ar-SA")}] ${m.sender_name ?? "مجهول"}: ${m.body}`
    ).join("\n");

    const PROMPTS: Record<string, string> = {
      summarize:            `قدّم ملخصاً موجزاً للمحادثة التالية (3-5 أسطر):\n\n${convText}`,
      extract_tasks:        `استخرج جميع المهام والواجبات المذكورة وقدّمها كقائمة مرقّمة:\n\n${convText}`,
      extract_decisions:    `استخرج جميع القرارات والاتفاقيات وقدّمها كقائمة:\n\n${convText}`,
      extract_appointments: `استخرج جميع المواعيد والتواريخ والجلسات وقدّمها كقائمة:\n\n${convText}`,
      suggest_reply:        `اقترح ردًّا مهنياً مناسباً على آخر رسالة في المحادثة:\n\n${convText}`,
      translate:            `ترجم الرسائل التالية إلى ${targetLanguage ?? "الإنجليزية"}:\n\n${convText}`,
      meeting_minutes:      `أنشئ محضر اجتماع رسمياً يشمل: الحضور، النقاط الرئيسية، القرارات، المهام:\n\n${convText}`,
    };

    const prompt = PROMPTS[tool];
    if (!prompt) return res.status(400).json({ error: "أداة غير معروفة" });

    const { callAI } = await import("../ai/aiChat");
    const { reply } = await callAI(
      "أنت مساعد قانوني متخصص في تحليل المراسلات المهنية. أجب باللغة العربية.",
      prompt, [], "gemini", tenantId,
    );

    res.json({ result: reply, tool, messageCount: msgs.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── Messaging Runtime indexes — Migration 052 owns DDL; readiness only ──
   office_messages.deleted_at / conversation_id owned by migration 016 — no ALTER.
   idx_conv_updated / conversation table indexes owned by migration 031 — no Runtime CREATE.
   idx_msgs_* / idx_rcpt_* / idx_attach_msg owned by migration 052 (re-asserts 020 shapes
   + idx_msgs_office_folder). */
let messagingRuntimeIndexesReady = false;
export async function ensureMessagingRuntimeIndexes(): Promise<void> {
  if (messagingRuntimeIndexesReady) return;
  try {
    const r = await db.execute(sql`
      SELECT
        to_regclass('public.idx_msgs_sender_date') IS NOT NULL AS idx_msgs_sender_date,
        to_regclass('public.idx_msgs_office_date') IS NOT NULL AS idx_msgs_office_date,
        to_regclass('public.idx_msgs_office_folder') IS NOT NULL AS idx_msgs_office_folder,
        to_regclass('public.office_message_recipients') IS NOT NULL AS recipients_present,
        to_regclass('public.idx_rcpt_user_unread') IS NOT NULL AS idx_rcpt_user_unread,
        to_regclass('public.idx_rcpt_msg') IS NOT NULL AS idx_rcpt_msg,
        to_regclass('public.office_message_attachments') IS NOT NULL AS attachments_present,
        to_regclass('public.idx_attach_msg') IS NOT NULL AS idx_attach_msg
    `).catch(() => ({ rows: [{}] }));
    const row = ((r as { rows?: Record<string, unknown>[] }).rows ?? [])[0] ?? {};
    if (!row.idx_msgs_sender_date || !row.idx_msgs_office_date || !row.idx_msgs_office_folder) {
      console.error("[internal-messages] Migration 052 schema not ready — office_messages Runtime indexes missing");
      return;
    }
    if (row.recipients_present && (!row.idx_rcpt_user_unread || !row.idx_rcpt_msg)) {
      console.error("[internal-messages] Migration 052 schema not ready — recipient indexes missing");
      return;
    }
    if (row.attachments_present && !row.idx_attach_msg) {
      console.error("[internal-messages] Migration 052 schema not ready — attachment index missing");
      return;
    }
    messagingRuntimeIndexesReady = true;
  } catch { /* non-blocking */ }
}

/* Boot readiness probe (no CREATE INDEX) — Migration 052 owns DDL. */
void ensureMessagingRuntimeIndexes();

export default router;
