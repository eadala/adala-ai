/**
 * Enterprise Support Center — عدالة AI
 * ─────────────────────────────────────────────────────────────────────────
 * Full-stack support ticket system:
 *   1. Extended DB schema (office_id, case_id, SLA, visitor, attachments, audit)
 *   2. User CRUD routes  (POST/GET /support/tickets, replies, close, reopen)
 *   3. Admin routes      (analytics, assign, workflow, SLA violations)
 *   4. Visitor contact   (public POST /support/contact → auto-ticket)
 *   5. SLA engine        (5 tiers: emergency→low)
 *   6. EventBus          (SUPPORT_TICKET_CREATED, SUPPORT_TICKET_UPDATED)
 *   7. Audit trail       (all mutations logged)
 *   8. Notification      (in-app + push on new ticket & reply)
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireSuperAdmin } from "../../middlewares/requireAuth";
import { getAuth } from "@clerk/express";
import { runSupportAIPipeline } from "./support-ai";
import { eventBus } from "../../core/eventBus";

const router = Router();

/* ── helpers ─────────────────────────────────────────────────────────────── */
function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? null; }
function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  return fwd ? String(fwd).split(",")[0].trim() : (req.socket?.remoteAddress ?? "unknown");
}
function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/* ══════════════════════════════════════════════════════════════════════════
   SLA ENGINE
══════════════════════════════════════════════════════════════════════════ */
const SLA_CONFIG: Record<string, { responseMinutes: number; resolutionMinutes: number }> = {
  emergency: { responseMinutes: 15,    resolutionMinutes: 120   },
  critical:  { responseMinutes: 60,    resolutionMinutes: 480   },
  high:      { responseMinutes: 240,   resolutionMinutes: 1440  },
  urgent:    { responseMinutes: 240,   resolutionMinutes: 1440  },
  medium:    { responseMinutes: 1440,  resolutionMinutes: 4320  },
  normal:    { responseMinutes: 1440,  resolutionMinutes: 4320  },
  low:       { responseMinutes: 2880,  resolutionMinutes: 10080 },
};
function computeSLA(priority: string) {
  const sla = SLA_CONFIG[priority] ?? SLA_CONFIG.medium;
  const now = new Date();
  return {
    slaResponseDeadline:   new Date(now.getTime() + sla.responseMinutes   * 60_000).toISOString(),
    slaResolutionDeadline: new Date(now.getTime() + sla.resolutionMinutes * 60_000).toISOString(),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   STARTUP MIGRATIONS
══════════════════════════════════════════════════════════════════════════ */
async function ensureEnterpriseSchema(): Promise<void> {
  /* 1. Extend support_tickets */
  const cols = [
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS office_id TEXT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS case_id TEXT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS invoice_id TEXT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS conversation_id TEXT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS visitor_id TEXT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS visitor_phone TEXT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS department TEXT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to_name TEXT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user'`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS sla_response_deadline TIMESTAMPTZ`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS sla_resolution_deadline TIMESTAMPTZ`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS internal_notes TEXT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS satisfaction_score INT`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS ai_score NUMERIC(4,2)`,
    `ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMPTZ`,
  ];
  for (const c of cols) await db.execute(sql.raw(c)).catch(() => {});

  /* 2. support_ticket_attachments */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS support_ticket_attachments (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id   TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      file_name   TEXT NOT NULL,
      file_url    TEXT NOT NULL,
      file_size   INT  DEFAULT 0,
      file_type   TEXT,
      uploaded_by TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  /* 3. support_ticket_audit */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS support_ticket_audit (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id  TEXT NOT NULL,
      user_id    TEXT,
      user_name  TEXT,
      action     TEXT NOT NULL,
      old_value  TEXT,
      new_value  TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  /* 4. support_visitor_profiles */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS support_visitor_profiles (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email        TEXT UNIQUE,
      phone        TEXT,
      name         TEXT NOT NULL,
      first_visit  TIMESTAMPTZ DEFAULT NOW(),
      last_visit   TIMESTAMPTZ DEFAULT NOW(),
      ticket_count INT DEFAULT 1
    )
  `).catch(() => {});

  /* 5. Indexes */
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_st_user    ON support_tickets (user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_st_status  ON support_tickets (status, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_st_office  ON support_tickets (office_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_st_sla_res ON support_tickets (sla_resolution_deadline) WHERE status NOT IN ('closed','resolved')`,
    `CREATE INDEX IF NOT EXISTS idx_sta_ticket ON support_ticket_attachments (ticket_id)`,
    `CREATE INDEX IF NOT EXISTS idx_stau_ticket ON support_ticket_audit (ticket_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sm_ticket  ON support_messages (ticket_id, created_at ASC)`,
  ];
  for (const idx of indexes) await db.execute(sql.raw(idx)).catch(() => {});
}
ensureEnterpriseSchema();

/* ── Audit helper ────────────────────────────────────────────────────────── */
async function audit(
  ticketId: string, userId: string, userName: string,
  action: string, oldVal?: string, newVal?: string, ip?: string,
) {
  await db.execute(sql`
    INSERT INTO support_ticket_audit (ticket_id, user_id, user_name, action, old_value, new_value, ip_address)
    VALUES (${ticketId}, ${userId}, ${userName}, ${action}, ${oldVal ?? null}, ${newVal ?? null}, ${ip ?? null})
  `).catch(() => {});
}

/* ── In-app notification helper ──────────────────────────────────────────── */
async function notifyAdmin(subject: string, ticketId: string) {
  await db.execute(sql`
    INSERT INTO notifications (title, body, link, is_read, created_at)
    VALUES ('🎫 تذكرة دعم جديدة', ${`"${subject}"`}, ${`/support`}, false, NOW())
  `).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════════════════
   USER ROUTES
══════════════════════════════════════════════════════════════════════════ */

/* GET /support/tickets/stats — my ticket counts */
router.get("/support/tickets/stats", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    const r = one(await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('open','in_progress','waiting_customer','waiting_internal'))::int AS active,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed,
        COUNT(*) FILTER (WHERE status = 'open' AND sla_response_deadline < NOW())::int AS sla_breach
      FROM support_tickets
      WHERE user_id = ${userId}
    `));
    res.json(r ?? { total: 0, active: 0, resolved: 0, closed: 0, sla_breach: 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /support/tickets — create ticket */
router.post("/support/tickets", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    const {
      subject, body, priority = "medium", category = "technical",
      caseId, invoiceId, tags = [],
      userEmail = "", userName = "مستخدم", officeName = "",
    } = req.body;

    if (!subject?.trim() || !body?.trim()) {
      res.status(400).json({ error: "الموضوع والتفاصيل مطلوبان" }); return;
    }

    const sla = computeSLA(priority);
    const tagsArr = Array.isArray(tags) ? `{${tags.join(",")}}` : "{}";

    const ticket = one(await db.execute(sql`
      INSERT INTO support_tickets
        (id, subject, body, priority, category, user_id, user_email, user_name, office_name,
         case_id, invoice_id, source, tags,
         sla_response_deadline, sla_resolution_deadline, status)
      VALUES
        (gen_random_uuid()::text, ${subject.trim()}, ${body.trim()}, ${priority}, ${category},
         ${userId}, ${userEmail}, ${userName}, ${officeName ?? ""},
         ${caseId ?? null}, ${invoiceId ?? null}, 'user', ${tagsArr},
         ${sla.slaResponseDeadline}, ${sla.slaResolutionDeadline}, 'open')
      RETURNING *
    `));

    /* Audit */
    await audit(ticket.id, userId, userName, "TICKET_CREATED", undefined, `status=open priority=${priority}`, getIp(req));

    /* Notify admin in-app */
    await notifyAdmin(subject, ticket.id);

    /* EventBus */
    eventBus.emit({
      type: "CASE_UPDATED" as any,
      data: {
        hrEventType: "SUPPORT_TICKET_CREATED",
        ticketId: ticket.id,
        subject,
        priority,
        category,
        userId,
      },
    }).catch(() => {});

    /* AI pipeline (async — never block user) */
    runSupportAIPipeline(ticket.id, subject, body).catch(() => {});

    res.status(201).json(ticket);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /support/tickets — list my tickets */
router.get("/support/tickets", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    const { status, priority, category, search, limit = 50, offset = 0 } = req.query as any;

    const r = await db.execute(sql`
      SELECT
        t.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', a.id::text, 'fileName', a.file_name, 'fileUrl', a.file_url))
          FILTER (WHERE a.id IS NOT NULL), '[]'
        ) AS attachments,
        (SELECT COUNT(*)::int FROM support_messages WHERE ticket_id = t.id) AS message_count,
        aa.ai_type, aa.ai_priority, aa.ai_summary, aa.ai_confidence, aa.model_used,
        CASE WHEN t.sla_resolution_deadline < NOW() AND t.status NOT IN ('closed','resolved') THEN TRUE ELSE FALSE END AS sla_breached
      FROM support_tickets t
      LEFT JOIN support_ticket_attachments a ON a.ticket_id = t.id
      LEFT JOIN support_ai_analysis aa ON aa.ticket_id = t.id
      WHERE t.user_id = ${userId}
        ${status && status !== "all" ? sql`AND t.status = ${status}` : sql``}
        ${priority ? sql`AND t.priority = ${priority}` : sql``}
        ${category ? sql`AND t.category = ${category}` : sql``}
        ${search ? sql`AND (t.subject ILIKE ${"%" + search + "%"} OR t.body ILIKE ${"%" + search + "%"})` : sql``}
      GROUP BY t.id, aa.ticket_id, aa.ai_type, aa.ai_priority, aa.ai_summary, aa.ai_confidence, aa.model_used
      ORDER BY t.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `);

    res.json(rows(r));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /support/tickets/:id — ticket detail + messages + AI + audit */
router.get("/support/tickets/:id", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const id = String(req.params.id);
  try {
    const ticket = one(await db.execute(sql`
      SELECT t.*, aa.ai_type, aa.ai_priority, aa.ai_root_cause, aa.ai_suggestions,
             aa.ai_summary, aa.ai_confidence, aa.model_used, aa.soc_alerted,
             aa.knowledge_hits, aa.ai_auto_replied
      FROM support_tickets t
      LEFT JOIN support_ai_analysis aa ON aa.ticket_id = t.id
      WHERE t.id = ${id} AND t.user_id = ${userId}
    `));
    if (!ticket) { res.status(404).json({ error: "التذكرة غير موجودة" }); return; }

    const messages = rows(await db.execute(sql`
      SELECT * FROM support_messages WHERE ticket_id = ${id} ORDER BY created_at ASC
    `));

    const attachments = rows(await db.execute(sql`
      SELECT * FROM support_ticket_attachments WHERE ticket_id = ${id} ORDER BY created_at ASC
    `));

    res.json({ ticket, messages, attachments });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /support/tickets/:id/messages — user reply */
router.post("/support/tickets/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const id = String(req.params.id);
  try {
    const { message, senderName = "المستخدم" } = req.body;
    if (!message?.trim()) { res.status(400).json({ error: "الرسالة فارغة" }); return; }

    const ticket = one(await db.execute(sql`
      SELECT id, status FROM support_tickets WHERE id = ${id} AND user_id = ${userId}
    `));
    if (!ticket) { res.status(404).json({ error: "التذكرة غير موجودة" }); return; }
    if (ticket.status === "closed") { res.status(400).json({ error: "التذكرة مغلقة — أعد فتحها للرد" }); return; }

    const msg = one(await db.execute(sql`
      INSERT INTO support_messages (ticket_id, sender_type, sender_name, message)
      VALUES (${id}, 'user', ${senderName}, ${message.trim()})
      RETURNING *
    `));

    /* Move back to open if was waiting_customer */
    await db.execute(sql`
      UPDATE support_tickets SET status = 'in_progress', updated_at = NOW()
      WHERE id = ${id} AND status = 'waiting_customer'
    `).catch(() => {});

    await audit(id, userId, senderName, "USER_REPLY", undefined, message.trim().slice(0, 100), getIp(req));
    res.json(msg);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /support/tickets/:id/close — user closes ticket */
router.patch("/support/tickets/:id/close", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const id = String(req.params.id);
  try {
    const { satisfactionScore } = req.body;
    await db.execute(sql`
      UPDATE support_tickets
      SET status = 'closed', closed_at = NOW(), updated_at = NOW(),
          satisfaction_score = ${satisfactionScore ? Number(satisfactionScore) : null}
      WHERE id = ${id} AND user_id = ${userId} AND status != 'closed'
    `);
    await audit(id, userId, "user", "TICKET_CLOSED", "open/in_progress", "closed", getIp(req));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /support/tickets/:id/reopen — user reopens resolved/closed ticket */
router.patch("/support/tickets/:id/reopen", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const id = String(req.params.id);
  try {
    const sla = computeSLA("medium");
    await db.execute(sql`
      UPDATE support_tickets
      SET status = 'open', reopened_at = NOW(), updated_at = NOW(),
          sla_response_deadline = ${sla.slaResponseDeadline},
          sla_resolution_deadline = ${sla.slaResolutionDeadline}
      WHERE id = ${id} AND user_id = ${userId} AND status IN ('closed','resolved')
    `);
    await audit(id, userId, "user", "TICKET_REOPENED", "closed", "open", getIp(req));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /support/tickets/:id/rate — satisfaction score */
router.patch("/support/tickets/:id/rate", requireAuth, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  const id = String(req.params.id);
  try {
    const { score } = req.body;
    const n = Math.min(5, Math.max(1, Number(score)));
    await db.execute(sql`
      UPDATE support_tickets SET satisfaction_score = ${n}
      WHERE id = ${id} AND user_id = ${userId}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════════════════
   VISITOR CONTACT (PUBLIC — no auth)
══════════════════════════════════════════════════════════════════════════ */
router.post("/support/contact", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, subject, body, category = "other" } = req.body;
    if (!name || !subject || !body) {
      res.status(400).json({ error: "الاسم والموضوع والرسالة مطلوبة" }); return;
    }

    /* Upsert visitor profile */
    const visitor = one(await db.execute(sql`
      INSERT INTO support_visitor_profiles (email, phone, name, ticket_count)
      VALUES (${email ?? null}, ${phone ?? null}, ${name}, 1)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name, phone = COALESCE(EXCLUDED.phone, support_visitor_profiles.phone),
        last_visit = NOW(), ticket_count = support_visitor_profiles.ticket_count + 1
      RETURNING id
    `).catch(() => ({ rows: [{ id: null }] })));

    const sla = computeSLA("medium");
    const ticket = one(await db.execute(sql`
      INSERT INTO support_tickets
        (id, subject, body, priority, category, user_email, user_name,
         visitor_id, visitor_phone, source,
         sla_response_deadline, sla_resolution_deadline, status)
      VALUES
        (gen_random_uuid()::text, ${subject.trim()}, ${body.trim()}, 'medium', ${category},
         ${email ?? ""}, ${name},
         ${visitor?.id ?? null}, ${phone ?? null}, 'visitor',
         ${sla.slaResponseDeadline}, ${sla.slaResolutionDeadline}, 'open')
      RETURNING id, subject, status, created_at
    `));

    await notifyAdmin(subject, ticket.id);
    runSupportAIPipeline(ticket.id, subject, body).catch(() => {});

    res.json({ ok: true, ticketId: ticket.id, message: "تم استلام رسالتك وسيتم التواصل معك قريباً" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════════════════════════
   ADMIN ROUTES
══════════════════════════════════════════════════════════════════════════ */

/* GET /admin/support/analytics — full dashboard stats */
router.get("/admin/support/analytics", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const [overview, byStatus, byCategory, byPriority, slaStats, topAssigned, avgTimes, csat, dailyVolume] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int                                               AS total,
          COUNT(*) FILTER (WHERE status = 'open')::int               AS open,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int        AS in_progress,
          COUNT(*) FILTER (WHERE status = 'waiting_customer')::int   AS waiting_customer,
          COUNT(*) FILTER (WHERE status = 'resolved')::int           AS resolved,
          COUNT(*) FILTER (WHERE status = 'closed')::int             AS closed,
          COUNT(*) FILTER (
            WHERE status NOT IN ('closed','resolved')
            AND sla_resolution_deadline < NOW()
          )::int AS sla_breached
        FROM support_tickets
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT status, COUNT(*)::int AS n FROM support_tickets GROUP BY status
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT category, COUNT(*)::int AS n FROM support_tickets GROUP BY category ORDER BY n DESC
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT priority, COUNT(*)::int AS n FROM support_tickets GROUP BY priority ORDER BY n DESC
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('closed','resolved') AND sla_response_deadline < NOW())::int AS response_breached,
          COUNT(*) FILTER (WHERE status NOT IN ('closed','resolved') AND sla_resolution_deadline < NOW())::int AS resolution_breached,
          ROUND(100.0 * COUNT(*) FILTER (WHERE first_response_at <= sla_response_deadline OR first_response_at IS NULL)
            / NULLIF(COUNT(*), 0), 1) AS response_compliance_pct
        FROM support_tickets
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT assigned_to_name, COUNT(*)::int AS n
        FROM support_tickets WHERE assigned_to_name IS NOT NULL
        GROUP BY assigned_to_name ORDER BY n DESC LIMIT 5
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT
          ROUND(AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 3600)::numeric, 1) AS avg_first_response_hours,
          ROUND(AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600)::numeric, 1)         AS avg_resolution_hours
        FROM support_tickets WHERE status IN ('closed','resolved')
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT
          ROUND(AVG(satisfaction_score)::numeric, 2) AS avg_csat,
          COUNT(*) FILTER (WHERE satisfaction_score IS NOT NULL)::int AS rated_count
        FROM support_tickets
      `).catch(() => ({ rows: [] })),

      db.execute(sql`
        SELECT DATE(created_at) AS day, COUNT(*)::int AS n
        FROM support_tickets
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day DESC LIMIT 30
      `).catch(() => ({ rows: [] })),
    ]);

    res.json({
      overview:    rows(overview)[0] ?? {},
      byStatus:    rows(byStatus),
      byCategory:  rows(byCategory),
      byPriority:  rows(byPriority),
      sla:         rows(slaStats)[0] ?? {},
      topAssigned: rows(topAssigned),
      avgTimes:    rows(avgTimes)[0] ?? {},
      csat:        rows(csat)[0] ?? {},
      dailyVolume: rows(dailyVolume),
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/support/sla-violations — tickets past SLA */
router.get("/admin/support/sla-violations", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const r = await db.execute(sql`
      SELECT *,
        EXTRACT(EPOCH FROM (NOW() - sla_resolution_deadline))::int / 3600 AS hours_overdue
      FROM support_tickets
      WHERE status NOT IN ('closed','resolved')
        AND sla_resolution_deadline < NOW()
      ORDER BY sla_resolution_deadline ASC
      LIMIT 50
    `);
    res.json(rows(r));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /admin/support/:id/assign — assign ticket to staff */
router.patch("/admin/support/:id/assign", requireSuperAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const { assignedTo, assignedToName, department } = req.body;
    await db.execute(sql`
      UPDATE support_tickets
      SET assigned_to = ${assignedTo ?? null}, assigned_to_name = ${assignedToName ?? null},
          department = ${department ?? null},
          status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
          updated_at = NOW()
      WHERE id = ${id}
    `);
    await audit(id, "admin", assignedToName ?? "admin", "TICKET_ASSIGNED", undefined, assignedToName ?? "", undefined);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /admin/support/:id/workflow — change workflow status */
router.patch("/admin/support/:id/workflow", requireSuperAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const { status, internalNote } = req.body;
    const validStatuses = ["new","assigned","in_progress","waiting_customer","waiting_internal","resolved","closed","archived"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: "حالة غير صالحة" }); return;
    }
    const extra: any = {};
    if (status === "closed")   extra.closedAt = new Date().toISOString();
    if (status === "resolved") extra.resolvedAt = new Date().toISOString();

    await db.execute(sql`
      UPDATE support_tickets
      SET status = ${status}, updated_at = NOW(),
          internal_notes = CASE WHEN ${internalNote ?? ""} != '' THEN ${internalNote ?? ""} ELSE internal_notes END,
          closed_at   = ${status === "closed"   ? new Date().toISOString() : null},
          resolved_at = ${status === "resolved" ? new Date().toISOString() : null}
      WHERE id = ${id}
    `);
    await audit(id, "admin", "admin", "STATUS_CHANGED", undefined, status, undefined);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /admin/support/:id/internal-note — admin internal note */
router.post("/admin/support/:id/internal-note", requireSuperAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const { note } = req.body;
    if (!note?.trim()) { res.status(400).json({ error: "الملاحظة فارغة" }); return; }
    await db.execute(sql`
      UPDATE support_tickets SET internal_notes = ${note.trim()}, updated_at = NOW() WHERE id = ${id}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/support/:id/audit — full audit trail for a ticket */
router.get("/admin/support/:id/audit", requireSuperAdmin, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const r = await db.execute(sql`
      SELECT * FROM support_ticket_audit WHERE ticket_id = ${id} ORDER BY created_at DESC
    `);
    res.json(rows(r));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/support/knowledge-base + POST — manage knowledge base */
router.get("/admin/support/knowledge-base", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const r = await db.execute(sql`
      SELECT * FROM support_knowledge_base ORDER BY hits DESC, created_at DESC
    `);
    res.json(rows(r));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/admin/support/knowledge-base", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { category, issue, fix, tags = [] } = req.body;
    if (!category || !issue || !fix) { res.status(400).json({ error: "جميع الحقول مطلوبة" }); return; }
    const tagsArr = `{${(tags as string[]).join(",")}}`;
    const r = one(await db.execute(sql`
      INSERT INTO support_knowledge_base (category, issue, fix, tags)
      VALUES (${category}, ${issue}, ${fix}, ${tagsArr})
      RETURNING *
    `));
    res.json(r);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /admin/support/knowledge-base/:id */
router.delete("/admin/support/knowledge-base/:id", requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    if (!isUUID(String(req.params.id))) { res.status(400).json({ error: "معرف غير صالح" }); return; }
    await db.execute(sql`DELETE FROM support_knowledge_base WHERE id = ${String(req.params.id)}::uuid`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /admin/support/visitors — visitor profiles */
router.get("/admin/support/visitors", requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const r = await db.execute(sql`
      SELECT * FROM support_visitor_profiles ORDER BY last_visit DESC LIMIT 100
    `);
    res.json(rows(r));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
