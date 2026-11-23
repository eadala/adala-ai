/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; schema-authority touch-up only */
/**
 * Notifications — tenant-scoped aggregation.
 * Recovery P0: every office-owned query MUST filter by authenticated tenantId.
 * Tables without office_id (invitations, messages) are omitted (fail-closed).
 */
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

type TenantRequest = Request & { tenantId?: string };

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/* ── GET /notifications ───────────────────────────────────────────────────── */
router.get("/notifications", requireAuthWithTenant, async (req, res) => {
  const tenantId = (req as TenantRequest).tenantId;
  if (!tenantId || tenantId === "platform") {
    /* Super Admin / missing office: never aggregate all tenants */
    return res.json({ notifications: [], unreadCount: 0 });
  }

  const now = new Date();

  const notifications: {
    id: string;
    type: "error" | "warning" | "info" | "success";
    category: string;
    title: string;
    body: string;
    href: string;
    createdAt: string;
    read: boolean;
  }[] = [];

  /* 1. Overdue invoices — office scoped */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, total, due_date
      FROM client_invoices
      WHERE office_id = ${tenantId}
        AND (
          status = 'overdue'
          OR (status NOT IN ('paid','cancelled') AND due_date < NOW()::text)
        )
      ORDER BY created_at DESC
      LIMIT 10
    `);
    for (const inv of (rows.rows ?? []) as any[]) {
      notifications.push({
        id: `inv-overdue-${inv.id}`,
        type: "error",
        category: "الفواتير",
        title: `فاتورة متأخرة: ${inv.title ?? "بدون عنوان"}`,
        body: inv.total ? `المبلغ: ${(inv.total / 100).toLocaleString("ar-SA")} ر.س` : "تحتاج إلى متابعة",
        href: "/invoices",
        createdAt: now.toISOString(),
        read: false,
      });
    }
  } catch { /* table may be absent */ }

  /* 2. Invoices due in 7 days */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, total, due_date
      FROM client_invoices
      WHERE office_id = ${tenantId}
        AND status NOT IN ('paid','cancelled','overdue')
        AND due_date IS NOT NULL
        AND due_date::timestamp >= NOW()
        AND due_date::timestamp <= NOW() + INTERVAL '7 days'
      ORDER BY due_date ASC
      LIMIT 5
    `);
    for (const inv of (rows.rows ?? []) as any[]) {
      notifications.push({
        id: `inv-due-${inv.id}`,
        type: "warning",
        category: "الفواتير",
        title: `فاتورة تستحق قريباً: ${inv.title ?? ""}`,
        body: `تاريخ الاستحقاق: ${new Date(inv.due_date).toLocaleDateString("ar-SA")}`,
        href: "/invoices",
        createdAt: now.toISOString(),
        read: false,
      });
    }
  } catch { /* ignore */ }

  /* 3. Contracts expiring in 30 days */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, expires_at
      FROM contracts
      WHERE office_id = ${tenantId}
        AND expires_at IS NOT NULL
        AND expires_at > NOW()
        AND expires_at <= NOW() + INTERVAL '30 days'
      ORDER BY expires_at ASC
      LIMIT 5
    `);
    for (const c of (rows.rows ?? []) as any[]) {
      const daysLeft = Math.ceil((new Date(c.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      notifications.push({
        id: `contract-exp-${c.id}`,
        type: daysLeft <= 7 ? "warning" : "info",
        category: "العقود",
        title: `عقد ينتهي خلال ${daysLeft} يوم`,
        body: c.title ?? "عقد بدون عنوان",
        href: "/contracts",
        createdAt: now.toISOString(),
        read: false,
      });
    }
  } catch { /* ignore */ }

  /* 4. Upcoming events today/tomorrow */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, start_at, event_type, location
      FROM events
      WHERE office_id = ${tenantId}
        AND start_at IS NOT NULL
        AND start_at >= NOW()
        AND start_at <= NOW() + INTERVAL '24 hours'
      ORDER BY start_at ASC
      LIMIT 5
    `);
    for (const ev of (rows.rows ?? []) as any[]) {
      const startDate = new Date(ev.start_at);
      const isToday = startDate.toDateString() === now.toDateString();
      notifications.push({
        id: `event-${ev.id}`,
        type: "info",
        category: "المواعيد",
        title: `${isToday ? "اليوم" : "غداً"}: ${ev.title ?? "موعد"}`,
        body: `${startDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}${ev.location ? ` — ${ev.location}` : ""}`,
        href: "/calendar",
        createdAt: ev.start_at,
        read: false,
      });
    }
  } catch { /* ignore */ }

  /* 5. Events in next 7 days (beyond tomorrow) */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, start_at, event_type
      FROM events
      WHERE office_id = ${tenantId}
        AND start_at IS NOT NULL
        AND start_at > NOW() + INTERVAL '24 hours'
        AND start_at <= NOW() + INTERVAL '7 days'
      ORDER BY start_at ASC
      LIMIT 3
    `);
    for (const ev of (rows.rows ?? []) as any[]) {
      const startDate = new Date(ev.start_at);
      notifications.push({
        id: `event-week-${ev.id}`,
        type: "info",
        category: "المواعيد",
        title: `موعد قادم: ${ev.title ?? ""}`,
        body: startDate.toLocaleDateString("ar-SA", { weekday: "long", month: "short", day: "numeric" }),
        href: "/calendar",
        createdAt: ev.start_at,
        read: false,
      });
    }
  } catch { /* ignore */ }

  /* 6. Pending invitations — OMITTED: invitations table has no office_id (fail-closed) */

  /* 7. Pending leave requests — scope via employees.office_id */
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) as cnt
      FROM leaves l
      INNER JOIN employees e ON e.id = l.employee_id AND e.office_id = ${tenantId}
      WHERE l.status = 'pending'
    `);
    const cnt = parseInt((rows.rows?.[0] as any)?.cnt ?? "0");
    if (cnt > 0) {
      notifications.push({
        id: "leaves-pending",
        type: "warning",
        category: "الموارد البشرية",
        title: `${cnt} طلب إجازة ينتظر الموافقة`,
        body: "راجع طلبات الإجازة المعلقة وأصدر قرارك",
        href: "/leaves",
        createdAt: now.toISOString(),
        read: false,
      });
    }
  } catch { /* ignore */ }

  /* 8. Recent inbound messages — OMITTED: messages table has no office_id (fail-closed).
     Internal inbox uses office_messages (separate surface). */

  /* 9. Open cases */
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM cases WHERE status = 'open' AND office_id = ${tenantId}
    `);
    const cnt = parseInt((rows.rows?.[0] as any)?.cnt ?? "0");
    if (cnt > 5) {
      notifications.push({
        id: "cases-open",
        type: "info",
        category: "القضايا",
        title: `${cnt} قضية مفتوحة تحتاج متابعة`,
        body: "راجع القضايا المفتوحة وحدّث حالاتها",
        href: "/cases",
        createdAt: now.toISOString(),
        read: false,
      });
    }
  } catch { /* ignore */ }

  /* 10. Plan change notifications */
  try {
    const rows = await db.execute(sql`
      SELECT id, type, old_plan, new_plan, title, message, is_read, created_at
      FROM plan_notifications
      WHERE office_id = ${tenantId}
        AND is_read = FALSE
      ORDER BY created_at DESC
      LIMIT 5
    `);
    for (const n of (rows.rows ?? []) as any[]) {
      notifications.push({
        id: `plan-notif-${n.id}`,
        type: n.type === "upgrade" ? "success" : "warning",
        category: "الاشتراك",
        title: n.title,
        body: n.message,
        href: "/billing",
        createdAt: n.created_at instanceof Date ? n.created_at.toISOString() : String(n.created_at),
        read: false,
      });
    }
  } catch { /* ignore */ }

  /* 11. Low AI credits — this office only */
  try {
    const aiCrRows = await db.execute(sql`
      SELECT office_id, office_name, balance, monthly_allowance
      FROM office_ai_credits
      WHERE office_id = ${tenantId}
        AND monthly_allowance > 0
        AND balance::numeric / NULLIF(monthly_allowance,0) < 0.20
      ORDER BY balance ASC
      LIMIT 1
    `);
    for (const cr of (aiCrRows.rows ?? []) as any[]) {
      const pct = Math.round((Number(cr.balance) / Number(cr.monthly_allowance)) * 100);
      notifications.push({
        id: `ai-credits-low-${cr.office_id}`,
        type: pct <= 5 ? "error" : "warning",
        category: "رصيد AI",
        title: `رصيد AI منخفض — ${pct}% متبقٍ`,
        body: `رصيد ${cr.office_name ?? cr.office_id}: ${cr.balance} من ${cr.monthly_allowance} وحدة`,
        href: "/ai-credits",
        createdAt: now.toISOString(),
        read: false,
      });
    }
  } catch { /* ignore */ }

  /* 12. Payment failure / forced downgrade alerts */
  try {
    const failRows = await db.execute(sql`
      SELECT id, type, old_plan, new_plan, title, message, created_at
      FROM plan_notifications
      WHERE office_id = ${tenantId}
        AND is_read = FALSE
        AND type IN ('downgrade','failed_payment')
        AND created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 3
    `);
    for (const n of (failRows.rows ?? []) as any[]) {
      notifications.push({
        id: `plan-fail-${n.id}`,
        type: "error",
        category: "الاشتراك",
        title: n.title ?? "فشل في الدفع",
        body: n.message ?? `تم تخفيض الباقة من ${n.old_plan} إلى ${n.new_plan}`,
        href: "/billing",
        createdAt: n.created_at instanceof Date ? n.created_at.toISOString() : String(n.created_at),
        read: false,
      });
    }
  } catch { /* ignore */ }

  const ORDER = { error: 0, warning: 1, info: 2, success: 3 };
  notifications.sort((a, b) => {
    const typeDiff = (ORDER[a.type] ?? 3) - (ORDER[b.type] ?? 3);
    if (typeDiff !== 0) return typeDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  res.json({
    notifications,
    unreadCount: notifications.length,
  });
});

/* POST /api/notifications/mark-read — mark plan notification as read */
router.post("/notifications/mark-read/:planId", requireAuthWithTenant, async (req, res) => {
  try {
    const { planId } = req.params as Record<string, string>;
    const tenantId = (req as TenantRequest).tenantId;
    if (!tenantId || tenantId === "platform") {
      return res.status(403).json({ ok: false, error: "لا يمكن تحديد المكتب" });
    }
    if (planId.startsWith("plan-notif-")) {
      const realId = planId.replace("plan-notif-", "");
      await db.execute(sql`UPDATE plan_notifications SET is_read = TRUE WHERE id = ${realId} AND office_id = ${tenantId}`);
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

/* ══════════════════════════════════════════════════════════
   PER-OFFICE NOTIFICATION SETTINGS — Migration 051 owns DDL; readiness only
══════════════════════════════════════════════════════════ */

let officeNotificationSettingsReady = false;
export async function ensureOfficeNotificationSettingsTable(): Promise<void> {
  if (officeNotificationSettingsReady) return;
  try {
    const r = await db.execute(sql`
      SELECT to_regclass('public.office_notification_settings') IS NOT NULL AS present
    `).catch(() => ({ rows: [{}] }));
    const row = ((r as { rows?: Record<string, unknown>[] }).rows ?? [])[0] ?? {};
    if (!row.present) {
      console.error("[notifications] Migration 051 schema not ready — office_notification_settings missing");
      return;
    }
    officeNotificationSettingsReady = true;
  } catch { /* non-blocking */ }
}

/* GET /api/notifications/settings */
router.get("/notifications/settings", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as TenantRequest).tenantId;
    if (!officeId || officeId === "platform") {
      return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    }
    await ensureOfficeNotificationSettingsTable();
    const rows = await db.execute(sql`
      SELECT event_type, push_enabled, in_app_enabled, email_enabled
      FROM office_notification_settings
      WHERE office_id = ${officeId}
    `);
    res.json({ settings: rows.rows ?? [] });
  } catch (e: unknown) {
    res.status(500).json({ error: errMsg(e) });
  }
});

/* PATCH /api/notifications/settings */
router.patch("/notifications/settings", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as TenantRequest).tenantId;
    if (!officeId || officeId === "platform") {
      return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    }
    const updates = req.body.settings as Array<{
      event_type: string;
      push_enabled: boolean;
      in_app_enabled: boolean;
      email_enabled: boolean;
    }>;
    if (!Array.isArray(updates)) return res.status(400).json({ error: "settings must be array" });

    await ensureOfficeNotificationSettingsTable();
    for (const s of updates) {
      await db.execute(sql`
        INSERT INTO office_notification_settings
          (office_id, event_type, push_enabled, in_app_enabled, email_enabled, updated_at)
        VALUES
          (${officeId}, ${s.event_type},
           ${s.push_enabled ?? true}, ${s.in_app_enabled ?? true}, ${s.email_enabled ?? false},
           NOW())
        ON CONFLICT (office_id, event_type) DO UPDATE
          SET push_enabled   = EXCLUDED.push_enabled,
              in_app_enabled = EXCLUDED.in_app_enabled,
              email_enabled  = EXCLUDED.email_enabled,
              updated_at     = NOW()
      `);
    }
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: errMsg(e) });
  }
});

export default router;
