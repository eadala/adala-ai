import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { eventBus } from "../../core/eventBus";

const router = Router();

// Ensure case_id column exists on office_messages
async function ensureCaseIdColumn() {
  try {
    await db.execute(sql`
      ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL
    `);
  } catch (_) {}
}
ensureCaseIdColumn();

/* ── Full-Text Search Migration ─────────────────────────────────────────────
   Adds a GENERATED ALWAYS AS STORED tsvector column that PostgreSQL keeps
   in sync automatically — existing rows are backfilled instantly on ALTER,
   new rows are indexed on INSERT.
   Uses 'arabic' FTS config (confirmed available on this PG 16 instance).
   Falls back silently if the column already exists.
──────────────────────────────────────────────────────────────────────────── */
async function ensureFullTextSearch() {
  try {
    /* 1. Add generated tsvector column (backfills all existing rows automatically) */
    await db.execute(sql`
      ALTER TABLE office_messages
        ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
          to_tsvector('arabic', coalesce(subject, '') || ' ' || coalesce(body, ''))
        ) STORED
    `);
  } catch (e: any) {
    /* Column already exists or other transient error — not fatal */
    if (!e.message?.includes("already exists")) {
      console.warn("[FTS] search_vector column skipped:", e.message);
    }
  }
  try {
    /* 2. GIN index for fast @@ queries */
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_messages_search
        ON office_messages USING gin(search_vector)
    `);
  } catch (e: any) {
    console.warn("[FTS] GIN index skipped:", e.message);
  }
}
ensureFullTextSearch();

/* ── Group Conversations Schema ────────────────────────────────────────────
   Adds the foundation for group/thread-based messaging:
     message_conversations — the "room" (direct or group)
     conversation_members  — who is in the room + their role
     office_messages.conversation_id — links a message to a conversation

   Rules:
   • conversation_id is NULLABLE — existing messages are unaffected
   • type = 'direct' for 1-to-1, 'group' for multi-member rooms
   • office_id on both tables ensures full multi-tenant isolation
   • No routes or UI built in this step — schema only
──────────────────────────────────────────────────────────────────────────── */
async function ensureConversationTables() {
  /* 1. Conversations table */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS message_conversations (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id   TEXT NOT NULL,
      title       TEXT,
      type        TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_conv_office
      ON message_conversations(office_id)
  `).catch(() => {});

  /* 2. Conversation members table */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS conversation_members (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id   UUID NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
      office_id         TEXT NOT NULL,
      user_id           TEXT NOT NULL,
      user_name         TEXT,
      role              TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
      joined_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (conversation_id, user_id)
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_conv_members_conv
      ON conversation_members(conversation_id)
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_conv_members_user
      ON conversation_members(user_id, office_id)
  `).catch(() => {});

  /* 3. Add conversation_id FK to office_messages (nullable — no breaking change) */
  await db.execute(sql`
    ALTER TABLE office_messages
      ADD COLUMN IF NOT EXISTS conversation_id UUID
      REFERENCES message_conversations(id) ON DELETE SET NULL
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_messages_conv
      ON office_messages(conversation_id)
      WHERE conversation_id IS NOT NULL
  `).catch(() => {});
}
ensureConversationTables();

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
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { folder = "inbox", search = "" } = req.query as any;
    const userId = (req as any).auth?.userId ?? "anonymous";
    const searchTerm: string | null = search ? String(search).trim() : null;

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
          ${searchTerm ? sql`AND m.search_vector @@ plainto_tsquery('arabic', ${searchTerm})` : sql``}
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
          ${searchTerm ? sql`AND m.search_vector @@ plainto_tsquery('arabic', ${searchTerm})` : sql``}
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
          ${searchTerm ? sql`AND m.search_vector @@ plainto_tsquery('arabic', ${searchTerm})` : sql``}
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
          ${searchTerm ? sql`AND m.search_vector @@ plainto_tsquery('arabic', ${searchTerm})` : sql``}
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
router.get("/stats/counts", requireAuth, async (req: Request, res: Response) => {
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
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params as Record<string, string>;
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

// GET /api/internal-messages/case/:caseId — messages for a specific case
router.get("/case/:caseId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params as Record<string, string>;
    const numericId = parseInt(caseId, 10);

    /* Guard: caseId must be a valid integer (INTEGER FK to cases) */
    if (!caseId || isNaN(numericId)) {
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
      WHERE m.case_id = ${numericId}
      GROUP BY m.id
      ORDER BY m.created_at DESC
      LIMIT 100
    `);

    res.json(q.rows ?? []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/internal-messages
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { subject, body, recipients = [], attachments = [], folder = "sent", tags = [], caseId } = req.body;
    const userId = (req as any).auth?.userId ?? "anonymous";
    const senderName = (req as any).auth?.sessionClaims?.fullName ?? "المرسِل";
    const ip = getClientIp(req);
    const device = getDeviceInfo(req);
    const tagsArr = `{${(tags as string[]).join(",")}}`;

    const ins = await db.execute(sql`
      INSERT INTO office_messages (subject, body, sender_id, sender_name, sender_ip, device_info, folder, tags, case_id)
      VALUES (${subject}, ${body}, ${userId}, ${senderName}, ${ip}, ${device}, ${folder}, ${tagsArr},
              ${caseId ? Number(caseId) : null})
      RETURNING id, subject, body, sender_id, sender_name, folder, created_at, case_id
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

    /* ── Targeted SSE notification — only to the intended recipients ──
       sendToUsers() does NOT broadcast to the whole office, only to the
       specific users whose SSE connections are registered with their userId. */
    const recipientIds = (recipients as any[])
      .map((r: any) => r.userId)
      .filter((id: any) => typeof id === "string" && id.length > 0);

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
    const tenantId = (req as any).tenantId as string;
    await db.execute(sql`UPDATE office_messages SET folder = 'archive' WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/internal-messages/:id  (soft delete)
router.delete("/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string;
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
   ANALYTICS — GET /api/internal-messages/analytics
   لوحة تحكم شاملة لنظام المراسلات
══════════════════════════════════════════════════════ */
router.get("/analytics", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string;
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
        WHERE r.user_id = ${userId} AND r.is_read = FALSE
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
        JOIN cases c ON c.id::text = m.case_id::text AND c.office_id = ${tenantId}
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
          AND body ILIKE '%AI%' OR body ILIKE '%ذكاء%' OR body ILIKE '%تلقائي%'
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

/* ══════════════════════════════════════════════════════
   AI TOOLS — POST /api/internal-messages/ai-tools
   أدوات ذكاء اصطناعي مدمجة في المراسلات
══════════════════════════════════════════════════════ */
router.post("/ai-tools", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string;
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

/* ── Additional indexes (non-blocking startup) ─────────────────────────── */
(async () => {
  const extras = [
    sql`ALTER TABLE office_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL`,
    sql`CREATE INDEX IF NOT EXISTS idx_msgs_sender_date ON office_messages (sender_id, created_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_msgs_office_date ON office_messages (office_id, created_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS idx_msgs_office_folder ON office_messages (office_id, folder)`,
    sql`CREATE INDEX IF NOT EXISTS idx_rcpt_user_unread  ON office_message_recipients (user_id, is_read) WHERE is_read = FALSE`,
    sql`CREATE INDEX IF NOT EXISTS idx_rcpt_msg         ON office_message_recipients (message_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_attach_msg       ON office_message_attachments (message_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_conv_updated      ON message_conversations (office_id, updated_at DESC)`,
  ];
  for (const m of extras) await db.execute(m).catch(() => {});
})();

export default router;
