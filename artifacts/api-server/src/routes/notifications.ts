import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/* ── GET /notifications ───────────────────────────────────────────────────── */
router.get("/notifications", async (_req, res) => {
  const now = new Date();
  const in7Days  = new Date(now); in7Days.setDate(now.getDate() + 7);
  const in30Days = new Date(now); in30Days.setDate(now.getDate() + 30);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);

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

  /* 1. Overdue invoices */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, total, due_date
      FROM client_invoices
      WHERE status = 'overdue'
         OR (status NOT IN ('paid','cancelled') AND due_date < NOW()::text)
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
  } catch {}

  /* 2. Invoices due in 7 days (not yet overdue) */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, total, due_date
      FROM client_invoices
      WHERE status NOT IN ('paid','cancelled','overdue')
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
  } catch {}

  /* 3. Contracts expiring in 30 days */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, expires_at
      FROM contracts
      WHERE expires_at IS NOT NULL
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
  } catch {}

  /* 4. Upcoming events today/tomorrow */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, start_at, event_type, location
      FROM events
      WHERE start_at IS NOT NULL
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
  } catch {}

  /* 5. Events in next 7 days (beyond tomorrow) */
  try {
    const rows = await db.execute(sql`
      SELECT id, title, start_at, event_type
      FROM events
      WHERE start_at IS NOT NULL
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
  } catch {}

  /* 6. Pending invitations */
  try {
    const rows = await db.execute(sql`
      SELECT id, email, role, created_at
      FROM invitations
      WHERE status = 'pending'
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 5
    `);
    const count = (rows.rows ?? []).length;
    if (count > 0) {
      const emails = (rows.rows as any[]).map(r => r.email);
      notifications.push({
        id: "invitations-pending",
        type: "warning",
        category: "فريق العمل",
        title: `${count} دعوة معلقة`,
        body: count === 1 ? `${emails[0]} لم يقبل الدعوة بعد` : `${emails.slice(0, 2).join("، ")}${count > 2 ? ` و${count - 2} آخرون` : ""}`,
        href: "/users",
        createdAt: now.toISOString(),
        read: false,
      });
    }
  } catch {}

  /* 7. Pending leave requests */
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM leaves WHERE status = 'pending'
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
  } catch {}

  /* 8. Recent inbound messages (last 24h) */
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) as cnt
      FROM messages
      WHERE direction = 'inbound'
        AND created_at >= NOW() - INTERVAL '24 hours'
    `);
    const cnt = parseInt((rows.rows?.[0] as any)?.cnt ?? "0");
    if (cnt > 0) {
      notifications.push({
        id: "messages-new",
        type: "info",
        category: "الرسائل",
        title: `${cnt} رسالة واردة جديدة`,
        body: "خلال الـ 24 ساعة الماضية",
        href: "/messages",
        createdAt: now.toISOString(),
        read: false,
      });
    }
  } catch {}

  /* 9. Open cases (awareness) */
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM cases WHERE status = 'open'
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
  } catch {}

  /* Sort: errors first, then warnings, then info — then by date */
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

export default router;
