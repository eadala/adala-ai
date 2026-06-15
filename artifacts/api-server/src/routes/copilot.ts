import { requireAuth, requireAuthWithTenant } from "../middlewares/requireAuth";
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI } from "./aiChat";
import { getTenantSafe } from "../core/tenantContext";

const router = Router();

/* ── Snapshot of office data for context ── */
async function getOfficeSnapshot() {
  try {
    const [cases, clients, invoices, events, reminders] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status='open') as open,
          COUNT(*) FILTER (WHERE status='in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status='closed') as closed
        FROM cases
      `),
      db.execute(sql`SELECT COUNT(*) as total FROM clients`),
      db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status='overdue') as overdue,
          COUNT(*) FILTER (WHERE status='sent') as sent,
          COALESCE(SUM(total) FILTER (WHERE status='overdue'),0) as overdue_amount,
          COALESCE(SUM(total) FILTER (WHERE status IN ('sent','overdue')),0) as outstanding
        FROM client_invoices
      `),
      db.execute(sql`
        SELECT title, event_type, start_at, location
        FROM events
        WHERE start_at >= NOW() AND start_at <= NOW() + INTERVAL '7 days'
        ORDER BY start_at ASC LIMIT 5
      `),
      db.execute(sql`
        SELECT COUNT(*) as pending FROM reminders
        WHERE done = FALSE AND due_date <= CURRENT_DATE + 1
      `),
    ]);

    const c  = (cases.rows[0]   as any) ?? {};
    const cl = (clients.rows[0] as any) ?? {};
    const inv = (invoices.rows[0] as any) ?? {};
    const rem = (reminders.rows[0] as any) ?? {};

    const upcomingEvents = (events.rows as any[]).map(e =>
      `• ${e.title} — ${new Date(e.start_at).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" })}${e.location ? ` (${e.location})` : ""}`
    ).join("\n");

    return `
📊 بيانات المكتب الآن:
• القضايا: ${c.total ?? 0} إجمالي (${c.open ?? 0} مفتوحة، ${c.in_progress ?? 0} قيد التنفيذ، ${c.closed ?? 0} مغلقة)
• العملاء: ${cl.total ?? 0} عميل
• الفواتير المتأخرة: ${inv.overdue ?? 0} فاتورة (${Number(inv.overdue_amount ?? 0).toLocaleString("ar-SA")} ر.س)
• المبالغ المستحقة: ${Number(inv.outstanding ?? 0).toLocaleString("ar-SA")} ر.س
• التذكيرات المعلقة اليوم: ${rem.pending ?? 0}
${upcomingEvents ? `\n📅 المواعيد القادمة هذا الأسبوع:\n${upcomingEvents}` : "• لا مواعيد قادمة هذا الأسبوع"}
`.trim();
  } catch {
    return "بيانات المكتب غير متاحة حالياً.";
  }
}

/* ── Execute action requested by AI ── */
async function executeAction(action: any): Promise<string> {
  try {
    if (action.type === "create_reminder") {
      await db.execute(sql`
        INSERT INTO reminders (title, body, due_date, priority, category, office_id, created_by)
        VALUES (
          ${action.title ?? "تذكير جديد"},
          ${action.body ?? null},
          ${action.dueDate ?? new Date().toISOString().split("T")[0]},
          ${action.priority ?? "medium"},
          ${action.category ?? "general"},
          'default',
          'copilot'
        )
      `);
      return `✅ تم إنشاء التذكير: **${action.title}**`;
    }
    if (action.type === "create_case") {
      await db.execute(sql`
        INSERT INTO cases (title, case_type, status, client_name, description, office_id)
        VALUES (
          ${action.title ?? "قضية جديدة"},
          ${action.caseType ?? "other"},
          'open',
          ${action.clientName ?? null},
          ${action.description ?? null},
          ${getTenantSafe()?.officeId ?? "default"}
        )
      `);
      return `✅ تم إنشاء القضية: **${action.title}**`;
    }
    return "";
  } catch (e: any) {
    return `⚠️ لم يتمكن من تنفيذ الإجراء: ${e.message}`;
  }
}

/* ── POST /api/copilot/chat ── */
router.post("/chat", requireAuth, async (req: Request, res: Response) => {
  try {
    const { message, history = [], pageContext = "" } = req.body as {
      message: string;
      history: { role: string; content: string }[];
      pageContext?: string;
    };

    if (!message?.trim()) {
      res.status(400).json({ error: "الرسالة مطلوبة" });
      return;
    }

    const snapshot = await getOfficeSnapshot();

    const systemPrompt = `أنت مساعد قانوني ذكي اسمه "عدل" داخل منصة عدالة AI. أنت مدمج في واجهة المنصة وتظهر كمساعد عائم في كل صفحة.

${snapshot}

الصفحة الحالية للمستخدم: ${pageContext || "الرئيسية"}

صلاحياتك الكاملة:
1. قراءة وتحليل جميع بيانات المكتب (قضايا، عملاء، فواتير، عقود، مواعيد، تذكيرات)
2. إنشاء تذكيرات جديدة
3. إنشاء قضايا جديدة
4. التوجيه للصفحات المناسبة
5. تلخيص وتحليل الوضع المالي والقانوني
6. الإجابة على الأسئلة القانونية العامة

عندما يطلب المستخدم تنفيذ إجراء، أضف في نهاية ردك سطراً بهذا الشكل بالضبط:
[ACTION:{"type":"navigate","url":"/cases"}]
[ACTION:{"type":"create_reminder","title":"...","body":"...","dueDate":"YYYY-MM-DD","priority":"high|medium|low"}]
[ACTION:{"type":"create_case","title":"...","caseType":"civil|criminal|commercial|family|administrative|labor|other","clientName":"...","description":"..."}]

تعليمات مهمة:
- أجب باللغة العربية دائماً وبأسلوب احترافي ودود
- كن موجزاً ومفيداً — لا تُطوّل إذا كان الجواب قصيراً
- استخدم **نص غامق** للأرقام والعناوين المهمة
- للقوائم استخدم • أو أرقام مرتبة
- إذا لم تكن متأكداً من بيانات معينة، اذكر ذلك بدل الاختراع`;

    const { reply } = await callAI(systemPrompt, message, history, "auto");

    /* Parse action from reply */
    const actionMatch = reply.match(/\[ACTION:(\{.+?\})\]/s);
    let action = null;
    let cleanReply = reply.replace(/\[ACTION:\{.+?\}\]/gs, "").trim();

    if (actionMatch) {
      try {
        action = JSON.parse(actionMatch[1]);
        /* Execute write actions server-side */
        if (action.type === "create_reminder" || action.type === "create_case") {
          const msg = await executeAction(action);
          if (msg) cleanReply = cleanReply + "\n\n" + msg;
        }
      } catch {}
    }

    /* Log */
    try {
      const userId = (req as any).auth?.userId ?? "anonymous";
      await db.execute(sql`
        INSERT INTO ai_assistant_logs (user_id, question, response, context_used)
        VALUES (${userId}, ${message}, ${cleanReply}, 'copilot')
      `);
    } catch {}

    res.json({ reply: cleanReply, action });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /api/copilot/snapshot ── quick office summary ── */
router.get("/snapshot", requireAuth, async (_req: Request, res: Response) => {
  try {
    const [cases, invoices, events] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) FILTER (WHERE status IN ('open','in_progress')) as active FROM cases`),
      db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='overdue') as overdue FROM client_invoices`),
      db.execute(sql`SELECT COUNT(*) as upcoming FROM events WHERE start_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'`),
    ]);
    res.json({
      activeCases: Number((cases.rows[0] as any)?.active ?? 0),
      overdueInvoices: Number((invoices.rows[0] as any)?.overdue ?? 0),
      upcomingEvents: Number((events.rows[0] as any)?.upcoming ?? 0),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
