import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

async function processQuery(question: string): Promise<{ response: string; contextUsed: string }> {
  const q = question.toLowerCase().trim();
  try {
    if (/متأخر|متأخرة|قضايا.*مفتوحة|مفتوحة/.test(q)) {
      const r = await db.execute(sql`
        SELECT title, case_number, case_type, status, created_at FROM cases
        WHERE status IN ('open','in_progress') ORDER BY created_at ASC LIMIT 10
      `);
      if (!r.rows.length) return { response: "لا توجد قضايا مفتوحة حالياً.", contextUsed: "cases" };
      const list = (r.rows as any[]).map((c, i) =>
        `${i + 1}. **${c.title}** (${c.case_number ?? ""}) — ${c.case_type ?? ""} — ${c.status === "open" ? "مفتوحة" : "قيد التنفيذ"}`
      ).join("\n");
      return { response: `القضايا المفتوحة حالياً:\n\n${list}`, contextUsed: "cases" };
    }

    if (/جلسات.*قادمة|مواعيد.*قادمة|قادم|الجلسات/.test(q)) {
      const r = await db.execute(sql`
        SELECT title, event_type, start_at, location FROM events
        WHERE start_at >= NOW() ORDER BY start_at ASC LIMIT 10
      `);
      if (!r.rows.length) return { response: "لا توجد جلسات أو مواعيد قادمة مسجّلة.", contextUsed: "events" };
      const list = (r.rows as any[]).map((e, i) =>
        `${i + 1}. **${e.title}** — ${e.event_type ?? ""} — ${new Date(e.start_at).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" })}${e.location ? ` — ${e.location}` : ""}`
      ).join("\n");
      return { response: `الجلسات والمواعيد القادمة:\n\n${list}`, contextUsed: "events" };
    }

    if (/فواتير/.test(q)) {
      const clientMatch = q.match(/فواتير\s+(.+)/);
      if (clientMatch) {
        const name = `%${clientMatch[1].trim()}%`;
        const r = await db.execute(sql`
          SELECT i.invoice_number, i.title, i.total, i.status, c.full_name
          FROM client_invoices i
          JOIN clients c ON c.id = i.client_id
          WHERE c.full_name ILIKE ${name}
          ORDER BY i.created_at DESC LIMIT 10
        `);
        if (!r.rows.length) return { response: `لم أجد فواتير للعميل المذكور.`, contextUsed: "invoices" };
        const rows = r.rows as any[];
        const total = rows.reduce((s, x) => s + Number(x.total), 0);
        const list = rows.map((inv, i) =>
          `${i + 1}. **${inv.invoice_number}** — ${inv.title} — ${Number(inv.total).toLocaleString("ar-EG")} ر.س — ${inv.status === "paid" ? "✅ مدفوعة" : inv.status === "overdue" ? "⚠️ متأخرة" : "⏳ في الانتظار"}`
        ).join("\n");
        return { response: `فواتير ${rows[0]?.full_name}:\n\n${list}\n\n**الإجمالي:** ${total.toLocaleString("ar-EG")} ر.س`, contextUsed: "invoices,clients" };
      }
      const r = await db.execute(sql`
        SELECT status, COUNT(*) as cnt, SUM(total) as sum FROM client_invoices GROUP BY status
      `);
      const lines = (r.rows as any[]).map(row => {
        const label = row.status === "paid" ? "مدفوعة" : row.status === "overdue" ? "متأخرة" : row.status === "sent" ? "مُرسَلة" : "مسودة";
        return `• ${label}: ${row.cnt} فاتورة — ${Number(row.sum || 0).toLocaleString("ar-EG")} ر.س`;
      }).join("\n");
      return { response: `ملخص الفواتير:\n\n${lines}`, contextUsed: "invoices" };
    }

    if (/عقود.*تنتهي|ستنتهي|انتهاء.*عقود|عقود.*قريب/.test(q)) {
      const r = await db.execute(sql`
        SELECT title, type, expires_at FROM contracts
        WHERE expires_at BETWEEN NOW() AND NOW() + INTERVAL '90 days'
        AND status = 'active'
        ORDER BY expires_at ASC LIMIT 10
      `);
      if (!r.rows.length) return { response: "لا توجد عقود ستنتهي خلال الـ 90 يوماً القادمة.", contextUsed: "contracts" };
      const list = (r.rows as any[]).map((c, i) =>
        `${i + 1}. **${c.title}** — ${c.type ?? ""} — ينتهي: ${new Date(c.expires_at).toLocaleDateString("ar-EG")}`
      ).join("\n");
      return { response: `العقود التي ستنتهي قريباً:\n\n${list}`, contextUsed: "contracts" };
    }

    if (/مراسلات.*غير.*مقروءة|رسائل.*غير.*مقروءة/.test(q)) {
      const r = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM office_message_recipients WHERE is_read = FALSE
      `);
      const cnt = Number((r.rows[0] as any)?.cnt ?? 0);
      if (cnt === 0) return { response: "لا توجد رسائل غير مقروءة في صندوق الوارد.", contextUsed: "messages" };
      return { response: `يوجد **${cnt} رسالة** غير مقروءة في صندوق الوارد.`, contextUsed: "messages" };
    }

    if (/عملاء|عميل/.test(q)) {
      const r = await db.execute(sql`SELECT COUNT(*) as cnt, COUNT(*) FILTER (WHERE status='active') as active FROM clients`);
      const docs = await db.execute(sql`SELECT COUNT(*) as cnt FROM documents`);
      const row = r.rows[0] as any;
      return {
        response: `إجمالي العملاء: **${row.cnt}** عميل، منهم **${row.active}** نشط.\nإجمالي المستندات: **${(docs.rows[0] as any)?.cnt ?? 0}** مستند.`,
        contextUsed: "clients,documents"
      };
    }

    if (/ملخص|تقرير|نظرة عامة|احصاء/.test(q)) {
      const [cases, clients, invoices, events] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='open') as open FROM cases`),
        db.execute(sql`SELECT COUNT(*) as total FROM clients`),
        db.execute(sql`SELECT COUNT(*) FILTER (WHERE status='overdue') as overdue, COALESCE(SUM(total) FILTER (WHERE status IN ('sent','overdue')),0) as outstanding FROM client_invoices`),
        db.execute(sql`SELECT COUNT(*) as upcoming FROM events WHERE start_at >= NOW()`),
      ]);
      const c = cases.rows[0] as any;
      const cl = clients.rows[0] as any;
      const inv = invoices.rows[0] as any;
      const ev = events.rows[0] as any;
      return {
        response: [
          "📊 **ملخص المكتب اليوم:**",
          `• القضايا: ${c.total} إجمالي (${c.open} مفتوحة)`,
          `• العملاء: ${cl.total}`,
          `• الفواتير المتأخرة: ${inv.overdue} — المستحق: ${Number(inv.outstanding).toLocaleString("ar-EG")} ر.س`,
          `• المواعيد القادمة: ${ev.upcoming}`,
        ].join("\n"),
        contextUsed: "cases,clients,invoices,events"
      };
    }

    return {
      response: `يمكنني مساعدتك في:\n\n• **القضايا المفتوحة** — "ما القضايا المفتوحة؟"\n• **الجلسات القادمة** — "ما الجلسات القادمة؟"\n• **فواتير عميل** — "فواتير [اسم العميل]"\n• **العقود المنتهية** — "ما العقود التي ستنتهي قريباً؟"\n• **الرسائل** — "المراسلات غير المقروءة"\n• **ملخص المكتب** — "ملخص المكتب اليوم"\n\nكيف يمكنني مساعدتك؟`,
      contextUsed: "none"
    };
  } catch (e: any) {
    return { response: `حدث خطأ في معالجة الطلب: ${e.message}`, contextUsed: "error" };
  }
}

// POST /api/ai-assistant
router.post("/", async (req: Request, res: Response) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: "السؤال مطلوب" });
    const userId = (req as any).auth?.userId ?? "anonymous";
    const { response, contextUsed } = await processQuery(question);
    await db.execute(sql`
      INSERT INTO ai_assistant_logs (user_id, question, response, context_used)
      VALUES (${userId}, ${question}, ${response}, ${contextUsed})
    `);
    res.json({ question, response, contextUsed });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/ai-assistant/history
router.get("/history", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.userId ?? "anonymous";
    const r = await db.execute(sql`
      SELECT id, question, response, context_used, created_at
      FROM ai_assistant_logs
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `);
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/ai-assistant/suggestions
router.get("/suggestions", async (_req: Request, res: Response) => {
  res.json([
    "ما هي القضايا المفتوحة؟",
    "ما هي الجلسات القادمة؟",
    "ملخص المكتب اليوم",
    "ما العقود التي ستنتهي قريباً؟",
    "المراسلات غير المقروءة",
    "كم عدد العملاء النشطين؟",
  ]);
});

export default router;
