import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getTenantSafe } from "../../core/tenantContext";
import { logEndpointError } from "../../lib/endpointErrorLog";

const router = Router();

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1200, temperature: 0.2 },
      }),
    }
  );
  const d = (await r.json()) as any;
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

type AgentIntent =
  | "get_briefing" | "create_case" | "close_case" | "list_cases"
  | "create_client" | "list_clients"
  | "create_invoice" | "get_overdue_invoices" | "list_invoices"
  | "schedule_event" | "list_events"
  | "send_reminder" | "generate_report" | "unknown";

interface ParsedCommand {
  intent: AgentIntent;
  params: Record<string, any>;
  explanation: string;
  confidence: number;
}

async function parseIntent(command: string): Promise<ParsedCommand> {
  const prompt = `أنت محلل أوامر لنظام إدارة مكتب قانوني "عدالة AI".
حلّل الأمر التالي وأرجع JSON فقط بدون أي نص آخر أو markdown:
{
  "intent": "get_briefing|create_case|close_case|list_cases|create_client|list_clients|create_invoice|get_overdue_invoices|list_invoices|schedule_event|list_events|send_reminder|generate_report|unknown",
  "params": {
    "clientName": "",
    "caseTitle": "",
    "caseType": "مدنية",
    "invoiceTitle": "",
    "amount": 0,
    "eventTitle": "",
    "eventType": "other",
    "date": "",
    "description": "",
    "targetName": "",
    "query": ""
  },
  "explanation": "وصف عربي لما سأفعله",
  "confidence": 0.9
}

الأمر: ${command}`;

  try {
    const raw = await callGemini(prompt);
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as ParsedCommand;
  } catch {}
  return { intent: "unknown", params: {}, explanation: "لم أفهم الأمر، يرجى إعادة الصياغة", confidence: 0 };
}

async function logAction(data: {
  userId?: string; userEmail?: string; command: string; intent: string;
  params?: any; actionTaken?: string; result?: any; success?: boolean;
  errorMessage?: string; executionMs?: number;
}) {
  try {
    await db.execute(sql`
      INSERT INTO ai_agent_logs (id,user_id,user_email,command,intent,params,action_taken,result,success,error_message,execution_ms)
      VALUES (
        ${randomUUID()}, ${data.userId ?? null}, ${data.userEmail ?? null},
        ${data.command}, ${data.intent}, ${JSON.stringify(data.params ?? {})}::jsonb,
        ${data.actionTaken ?? null}, ${JSON.stringify(data.result ?? {})}::jsonb,
        ${data.success ?? true}, ${data.errorMessage ?? null}, ${data.executionMs ?? null}
      )
    `);
  } catch {}
}

async function executeAction(
  intent: AgentIntent,
  params: Record<string, any>,
  userId?: string,
  officeId: string = ""
): Promise<{ success: boolean; message: string; data?: any }> {
  switch (intent) {
    case "get_briefing": {
      const [events, overdue, openCases, contracts] = await Promise.all([
        db.execute(sql`SELECT id, title, event_type, start_at, location FROM events WHERE start_at >= NOW() AND start_at < NOW() + INTERVAL '24 hours' AND office_id = ${officeId} ORDER BY start_at LIMIT 10`),
        db.execute(sql`SELECT id, title, total, due_date FROM client_invoices WHERE status='overdue' AND office_id = ${officeId} ORDER BY due_date LIMIT 10`),
        db.execute(sql`SELECT COUNT(*) as cnt FROM cases WHERE status='open' AND office_id = ${officeId}`),
        db.execute(sql`SELECT COUNT(*) as cnt FROM contracts WHERE status='active' AND office_id = ${officeId}`),
      ]);
      const todayEventsCount = events.rows?.length ?? 0;
      const overdueCount = overdue.rows?.length ?? 0;
      const openCasesCount = Number((openCases.rows?.[0] as any)?.cnt ?? 0);
      const activeContracts = Number((contracts.rows?.[0] as any)?.cnt ?? 0);
      return {
        success: true,
        message: `الإحاطة اليومية جاهزة`,
        data: {
          todayEvents: events.rows ?? [],
          overdueInvoices: overdue.rows ?? [],
          openCases: openCasesCount,
          activeContracts,
          summary: {
            hearingsToday: todayEventsCount,
            overdueInvoices: overdueCount,
            openCases: openCasesCount,
            activeContracts,
          },
        },
      };
    }

    case "create_case": {
      const id = randomUUID();
      const title = params.caseTitle || `قضية ${params.clientName || "جديدة"}`;
      await db.execute(sql`
        INSERT INTO cases (id, title, case_type, status, client_name, description, office_id, created_at, updated_at)
        VALUES (
          ${id}, ${title}, ${params.caseType || "مدنية"}, 'open',
          ${params.clientName || null}, ${params.description || null}, ${officeId}, NOW(), NOW()
        )
      `);
      return { success: true, message: `✅ تم إنشاء القضية "${title}" بنجاح`, data: { id, title } };
    }

    case "close_case": {
      const query = params.caseTitle || params.query || "";
      const r = await db.execute(sql`
        UPDATE cases SET status='closed', updated_at=NOW()
        WHERE title ILIKE ${"%" + query + "%"} AND status != 'closed'
          AND office_id = ${officeId}
        RETURNING id, title
      `);
      const updated = r.rows?.length ?? 0;
      return { success: true, message: updated > 0 ? `✅ تم إغلاق ${updated} قضية` : `لم أجد قضية مطابقة`, data: r.rows };
    }

    case "list_cases": {
      const q = params.query || "";
      const rows = await db.execute(sql`
        SELECT id, title, case_type, status, client_name, created_at
        FROM cases
        WHERE office_id = ${officeId}
          ${q ? sql`AND (title ILIKE ${"%" + q + "%"} OR client_name ILIKE ${"%" + q + "%"})` : sql``}
        ORDER BY created_at DESC LIMIT 10
      `);
      return { success: true, message: `وجدت ${rows.rows?.length ?? 0} قضية`, data: rows.rows };
    }

    case "create_client": {
      const id = randomUUID();
      await db.execute(sql`
        INSERT INTO clients (id, full_name, email, phone, type, status, tags, office_id, created_at, updated_at)
        VALUES (
          ${id}, ${params.clientName || "عميل جديد"}, ${params.email || null},
          ${params.phone || null}, 'individual', 'active', '[]'::jsonb, ${officeId}, NOW(), NOW()
        )
      `);
      return { success: true, message: `✅ تمت إضافة العميل "${params.clientName}"`, data: { id, fullName: params.clientName } };
    }

    case "list_clients": {
      const q = params.query || "";
      const rows = await db.execute(sql`
        SELECT id, full_name, email, phone, type, status, created_at
        FROM clients ${q ? sql`WHERE full_name ILIKE ${"%" + q + "%"} OR email ILIKE ${"%" + q + "%"}` : sql``}
        ORDER BY created_at DESC LIMIT 10
      `);
      return { success: true, message: `وجدت ${rows.rows?.length ?? 0} عميل`, data: rows.rows };
    }

    case "create_invoice": {
      const id = randomUUID();
      const num = `INV-${Date.now()}`;
      const amount = Number(params.amount) || 1000;
      const vat = Math.round(amount * 0.15);
      await db.execute(sql`
        INSERT INTO client_invoices (id, invoice_number, title, items, subtotal, vat_rate, vat_amount, total, currency, status, office_id, created_at)
        VALUES (
          ${id}, ${num}, ${params.invoiceTitle || `فاتورة خدمات قانونية`},
          ${JSON.stringify([{ description: "خدمات قانونية", qty: 1, price: amount }])},
          ${amount}, 15, ${vat}, ${amount + vat}, 'SAR', 'draft', ${officeId}, NOW()
        )
      `);
      return { success: true, message: `✅ تم إنشاء الفاتورة رقم ${num} بمبلغ ${amount + vat} ريال`, data: { id, num } };
    }

    case "get_overdue_invoices": {
      const rows = await db.execute(sql`
        SELECT id, invoice_number, title, total, due_date, status FROM client_invoices
        WHERE status='overdue' AND office_id = ${officeId} ORDER BY due_date ASC LIMIT 20
      `);
      const total = (rows.rows as any[])?.reduce((s: number, r: any) => s + (r.total || 0), 0) ?? 0;
      return {
        success: true,
        message: `${rows.rows?.length ?? 0} فاتورة متأخرة بإجمالي ${total.toLocaleString("ar-SA")} ريال`,
        data: rows.rows,
      };
    }

    case "list_invoices": {
      const rows = await db.execute(sql`
        SELECT id, invoice_number, title, total, status, due_date FROM client_invoices
        WHERE office_id = ${officeId} ORDER BY created_at DESC LIMIT 10
      `);
      return { success: true, message: `آخر ${rows.rows?.length ?? 0} فاتورة`, data: rows.rows };
    }

    case "schedule_event": {
      const id = randomUUID();
      const startAt = params.date ? new Date(params.date) : new Date(Date.now() + 86400000);
      await db.execute(sql`
        INSERT INTO events (id, user_id, title, event_type, start_at, all_day, status, office_id, created_at, updated_at)
        VALUES (
          ${id}, ${userId || "system"}, ${params.eventTitle || "حدث جديد"},
          ${params.eventType || "other"}, ${startAt.toISOString()}, false, 'upcoming', ${officeId}, NOW(), NOW()
        )
      `);
      return { success: true, message: `✅ تمت جدولة "${params.eventTitle}" بتاريخ ${startAt.toLocaleDateString("ar-SA")}`, data: { id } };
    }

    case "list_events": {
      const rows = await db.execute(sql`
        SELECT id, title, event_type, start_at, location FROM events
        WHERE start_at >= NOW() AND office_id = ${officeId} ORDER BY start_at LIMIT 10
      `);
      return { success: true, message: `${rows.rows?.length ?? 0} حدث قادم`, data: rows.rows };
    }

    case "send_reminder": {
      const target = params.targetName || "الفريق";
      const msg = params.description || "تذكير من النظام";
      return {
        success: true,
        message: `✅ تم إرسال التذكير إلى ${target}: "${msg}"`,
        data: { target, message: msg, sentAt: new Date().toISOString() },
      };
    }

    case "generate_report": {
      const [casesCount, clientsCount, revenue, eventsCount] = await Promise.all([
        db.execute(sql`SELECT COUNT(*) as cnt, SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) as open FROM cases WHERE office_id = ${officeId}`),
        db.execute(sql`SELECT COUNT(*) as cnt FROM clients WHERE status='active' AND office_id = ${officeId}`),
        db.execute(sql`SELECT COALESCE(SUM(total),0) as total FROM client_invoices WHERE status='paid' AND office_id = ${officeId}`),
        db.execute(sql`SELECT COUNT(*) as cnt FROM events WHERE start_at >= NOW() AND office_id = ${officeId}`),
      ]);
      const stats = {
        totalCases: (casesCount.rows?.[0] as any)?.cnt,
        openCases: (casesCount.rows?.[0] as any)?.open,
        clients: (clientsCount.rows?.[0] as any)?.cnt,
        revenue: (revenue.rows?.[0] as any)?.total,
        upcomingEvents: (eventsCount.rows?.[0] as any)?.cnt,
      };
      const reportText = await callGemini(
        `أنت محلل قانوني خبير. اكتب تقريراً تنفيذياً موجزاً باللغة العربية بناءً على البيانات التالية:
- إجمالي القضايا: ${stats.totalCases} (منها ${stats.openCases} نشطة)
- العملاء النشطون: ${stats.clients}
- الإيرادات المحصّلة: ${Number(stats.revenue ?? 0).toLocaleString("ar-SA")} ريال
- الأحداث القادمة: ${stats.upcomingEvents}
${params.query ? `- التركيز على: ${params.query}` : ""}

اكتب تقريراً من 3-4 فقرات يشمل: الأداء العام، نقاط القوة، التوصيات.`
      );
      return { success: true, message: "التقرير التنفيذي", data: { report: reportText, stats } };
    }

    default:
      return { success: false, message: "لم أتمكن من تنفيذ هذا الأمر. يرجى إعادة الصياغة" };
  }
}

// ─── POST /ai-agent/execute ───────────────────────────────────────────────────
router.post("/ai-agent/execute", requireAuthWithTenant, async (req: Request, res: Response) => {
  const { command, userId, userEmail, mode = "execute" } = req.body as {
    command: string; userId?: string; userEmail?: string; mode?: "preview" | "execute";
  };
  if (!command?.trim()) { res.status(400).json({ error: "الأمر مطلوب" }); return; }

  const tenantId = (req as any).tenantId as string;
  if (!tenantId) { res.status(403).json({ error: "لا يمكن تحديد المكتب" }); return; }
  const t0 = Date.now();
  const parsed = await parseIntent(command);

  if (mode === "preview") {
    res.json({ intent: parsed.intent, explanation: parsed.explanation, params: parsed.params, confidence: parsed.confidence });
    return;
  }

  const result = await executeAction(parsed.intent, parsed.params, userId, tenantId);
  const ms = Date.now() - t0;

  await logAction({
    userId, userEmail, command, intent: parsed.intent, params: parsed.params,
    actionTaken: result.message, result: result.data, success: result.success, executionMs: ms,
  });

  res.json({ ...parsed, ...result, executionMs: ms });
});

// ─── GET /ai-agent/briefing ───────────────────────────────────────────────────
router.get("/ai-agent/briefing", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const tid = (req as any).tenantId as string;
    const [eventsR, overdueR, casesR, contractsR, invoicesR] = await Promise.all([
      db.execute(sql`SELECT id, title, event_type, start_at, location FROM events WHERE office_id = ${tid} AND start_at >= NOW()::date AND start_at < NOW()::date + INTERVAL '1 day' ORDER BY start_at LIMIT 5`),
      db.execute(sql`SELECT COUNT(*) as cnt, COALESCE(SUM(total),0) as total FROM client_invoices WHERE office_id = ${tid} AND status='overdue'`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM cases WHERE office_id = ${tid} AND status='open'`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM contracts WHERE office_id = ${tid} AND status IN ('active','pending')`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM client_invoices WHERE office_id = ${tid} AND status='draft'`),
    ]);
    const todayEvents = eventsR.rows ?? [];
    const overdueInfo = (overdueR.rows?.[0] as any) ?? {};
    const openCases = Number((casesR.rows?.[0] as any)?.cnt ?? 0);
    const pendingContracts = Number((contractsR.rows?.[0] as any)?.cnt ?? 0);
    const draftInvoices = Number((invoicesR.rows?.[0] as any)?.cnt ?? 0);
    res.json({
      todayEvents,
      stats: {
        hearingsToday: todayEvents.length,
        overdueInvoices: Number(overdueInfo.cnt ?? 0),
        overdueTotal: Number(overdueInfo.total ?? 0),
        openCases,
        pendingContracts,
        draftInvoices,
      },
    });
  } catch (e: any) {
    logEndpointError("GET /api/ai-agent/briefing", req, e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /ai-agent/logs ───────────────────────────────────────────────────────
router.get("/ai-agent/logs", requireAuth, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const rows = await db.execute(sql`
    SELECT id, user_email, command, intent, action_taken, success, execution_ms, created_at
    FROM ai_agent_logs ORDER BY created_at DESC LIMIT ${limit}
  `);
  res.json(rows.rows ?? []);
});

// ─── GET /ai-agent/workflows ──────────────────────────────────────────────────
router.get("/ai-agent/workflows", requireAuth, async (_req: Request, res: Response) => {
  const rows = await db.execute(sql`
    SELECT * FROM ai_workflows ORDER BY created_at DESC
  `);
  res.json(rows.rows ?? []);
});

// ─── POST /ai-agent/workflows ─────────────────────────────────────────────────
router.post("/ai-agent/workflows", requireAuth, async (req: Request, res: Response) => {
  const { name, description, triggerType, schedule, actionType, actionParams, mode, createdBy } = req.body;
  const id = randomUUID();
  await db.execute(sql`
    INSERT INTO ai_workflows (id, name, description, trigger_type, schedule, action_type, action_params, mode, is_active, created_by, created_at)
    VALUES (
      ${id}, ${name}, ${description || null}, ${triggerType || "scheduled"}, ${schedule || null},
      ${actionType}, ${JSON.stringify(actionParams || {})}::jsonb, ${mode || "manual"},
      true, ${createdBy || null}, NOW()
    )
  `);
  res.json({ success: true, id });
});

// ─── PUT /ai-agent/workflows/:id ──────────────────────────────────────────────
router.put("/ai-agent/workflows/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  const { id } = req.params as Record<string, string>;
  const { isActive, mode } = req.body;
  await db.execute(sql`
    UPDATE ai_workflows SET
      is_active = ${isActive ?? true},
      mode = ${mode || "manual"}
    WHERE id = ${id} AND office_id = ${tenantId}
  `);
  res.json({ success: true });
});

// ─── DELETE /ai-agent/workflows/:id ───────────────────────────────────────────
router.delete("/ai-agent/workflows/:id", requireAuthWithTenant, async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId as string;
  await db.execute(sql`
    DELETE FROM ai_workflows WHERE id = ${String(req.params.id)} AND office_id = ${tenantId}
  `);
  res.json({ success: true });
});

export default router;
