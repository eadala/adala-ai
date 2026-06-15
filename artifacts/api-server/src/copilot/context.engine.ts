import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface RichContext {
  officeSnapshot: string;
  recentCases: string;
  activeClients: string;
  financials: string;
  upcomingEvents: string;
  pendingTasks: string;
}

export async function buildRichContext(officeId: string): Promise<RichContext> {
  try {
    const [snap, cases, clients, fin, events, tasks] = await Promise.all([
      /* Office Snapshot */
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status='open') as open_cases,
          COUNT(*) FILTER (WHERE status='in_progress') as active_cases,
          COUNT(*) FILTER (WHERE status='closed') as closed_cases
        FROM cases WHERE office_id = ${officeId}
      `),
      /* Recent Cases */
      db.execute(sql`
        SELECT id, title, case_type, status, client_name, created_at
        FROM cases WHERE office_id = ${officeId}
        ORDER BY created_at DESC LIMIT 8
      `),
      /* Active Clients */
      db.execute(sql`
        SELECT name, phone, email FROM clients
        WHERE office_id = ${officeId}
        ORDER BY created_at DESC LIMIT 5
      `),
      /* Financials */
      db.execute(sql`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE type IN ('أتعاب محاماة','استشارات قانونية','خدمات قانونية متنوعة','عقود وتوثيق')), 0) as revenue,
          COALESCE((SELECT SUM(amount) FROM expenses WHERE office_id = ${officeId}), 0) as expenses,
          COALESCE((SELECT SUM(total) FROM client_invoices WHERE office_id = ${officeId} AND status='overdue'), 0) as overdue
        FROM revenues WHERE office_id = ${officeId}
      `),
      /* Upcoming Events */
      db.execute(sql`
        SELECT title, event_type, start_at, location, case_id
        FROM events
        WHERE office_id = ${officeId} AND start_at >= NOW() AND start_at <= NOW() + INTERVAL '14 days'
        ORDER BY start_at ASC LIMIT 6
      `),
      /* Pending Tasks */
      db.execute(sql`
        SELECT title, priority, status, due_date FROM tasks
        WHERE office_id = ${officeId} AND status != 'done'
        ORDER BY
          CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
          due_date ASC NULLS LAST
        LIMIT 5
      `),
    ]);

    const s = (snap.rows[0] as any) ?? {};
    const f = (fin.rows[0] as any) ?? {};

    const caseList = (cases.rows as any[]).map(c =>
      `• [${c.id}] ${c.title} (${c.case_type}) — ${c.status}${c.client_name ? ` | ${c.client_name}` : ""}`
    ).join("\n") || "لا توجد قضايا";

    const clientList = (clients.rows as any[]).map(c =>
      `• ${c.name}${c.phone ? ` | ${c.phone}` : ""}`
    ).join("\n") || "لا يوجد عملاء";

    const eventList = (events.rows as any[]).map(e =>
      `• ${e.title} — ${new Date(e.start_at).toLocaleDateString("ar-SA", { weekday: "short", day: "numeric", month: "short" })}${e.location ? ` @ ${e.location}` : ""}`
    ).join("\n") || "لا مواعيد قادمة";

    const taskList = (tasks.rows as any[]).map(t =>
      `• [${t.priority}] ${t.title}${t.due_date ? ` — ${t.due_date}` : ""}`
    ).join("\n") || "لا مهام معلقة";

    return {
      officeSnapshot: `📊 القضايا: ${s.open_cases ?? 0} مفتوحة | ${s.active_cases ?? 0} قيد التنفيذ | ${s.closed_cases ?? 0} مغلقة`,
      recentCases: caseList,
      activeClients: clientList,
      financials: `💰 الإيرادات: ${Number(f.revenue ?? 0).toLocaleString("ar-SA")} ر.س | المصاريف: ${Number(f.expenses ?? 0).toLocaleString("ar-SA")} ر.س | المتأخرات: ${Number(f.overdue ?? 0).toLocaleString("ar-SA")} ر.س`,
      upcomingEvents: eventList,
      pendingTasks: taskList,
    };
  } catch {
    return {
      officeSnapshot: "بيانات غير متاحة",
      recentCases: "",
      activeClients: "",
      financials: "",
      upcomingEvents: "",
      pendingTasks: "",
    };
  }
}

export function formatContextForPrompt(ctx: RichContext, memory: string): string {
  return `
${ctx.officeSnapshot}
${ctx.financials}

📋 القضايا الأخيرة:
${ctx.recentCases}

👤 العملاء النشطون:
${ctx.activeClients}

📅 المواعيد القادمة (14 يوم):
${ctx.upcomingEvents}

✅ المهام المعلقة:
${ctx.pendingTasks}
${memory}`.trim();
}
