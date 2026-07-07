import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getRequiredOfficeId } from "../core/tenantContext";
import { callAI } from "../modules/ai/aiChat";

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  action?: { type: string; url?: string; [k: string]: any };
}

async function getOfficeId(): Promise<string> {
  return getRequiredOfficeId();
}

/* ─── Tool: CREATE_CASE ─── */
export async function toolCreateCase(entities: any): Promise<ToolResult> {
  const officeId = await getOfficeId();
  const title = entities.title ?? entities.caseTitle ?? `قضية ${new Date().toLocaleDateString("ar-SA")}`;
  const clientName = entities.clientName ?? entities.defendant ?? null;
  const caseType = entities.caseType ?? "other";
  const description = entities.description ?? null;

  await db.execute(sql`
    INSERT INTO cases (title, case_type, status, client_name, description, office_id, created_by)
    VALUES (${title}, ${caseType}, 'open', ${clientName}, ${description}, ${officeId}, 'copilot')
  `);
  return {
    success: true,
    message: `✅ تم فتح القضية بنجاح`,
    data: { title, clientName, caseType },
    action: { type: "navigate", url: "/cases" },
  };
}

/* ─── Tool: CREATE_CLIENT ─── */
export async function toolCreateClient(entities: any): Promise<ToolResult> {
  const officeId = await getOfficeId();
  const name = entities.clientName ?? entities.name ?? "عميل جديد";
  const phone = entities.phone ?? null;
  const email = entities.email ?? null;

  await db.execute(sql`
    INSERT INTO clients (full_name, phone, email, office_id)
    VALUES (${name}, ${phone}, ${email}, ${officeId})
  `);
  return {
    success: true,
    message: `✅ تم إضافة العميل "${name}" بنجاح`,
    data: { name, phone, email },
    action: { type: "navigate", url: "/clients" },
  };
}

/* ─── Tool: CREATE_REMINDER ─── */
export async function toolCreateReminder(entities: any): Promise<ToolResult> {
  const officeId = await getOfficeId();
  const title = entities.title ?? entities.reminderTitle ?? "تذكير جديد";
  const body  = entities.body ?? null;
  const due   = entities.dateStr ?? entities.dueDate ?? new Date().toISOString().split("T")[0];
  const prio  = entities.priority ?? "medium";

  await db.execute(sql`
    INSERT INTO reminders (title, body, due_date, priority, category, office_id, created_by)
    VALUES (${title}, ${body}, ${due}, ${prio}, 'general', ${officeId}, 'copilot')
  `);
  return {
    success: true,
    message: `✅ تم إضافة التذكير "${title}" بتاريخ ${due}`,
    data: { title, due, priority: prio },
    action: { type: "navigate", url: "/reminders" },
  };
}

/* ─── Tool: SCHEDULE_EVENT ─── */
export async function toolScheduleEvent(entities: any, userId: string): Promise<ToolResult> {
  const officeId = await getOfficeId();
  const title  = entities.title ?? "موعد جديد";
  const date   = entities.dateStr ?? new Date(Date.now() + 86400000).toISOString();
  const loc    = entities.location ?? null;
  const caseId = entities.caseId ?? null;

  await db.execute(sql`
    INSERT INTO events (id, user_id, title, event_type, start_at, location, case_id, office_id)
    VALUES (gen_random_uuid()::text, ${userId}, ${title}, 'court_session',
            ${date}::timestamptz, ${loc}, ${caseId}, ${officeId})
  `);
  return {
    success: true,
    message: `✅ تم جدولة "${title}"`,
    data: { title, date, location: loc },
    action: { type: "navigate", url: "/calendar" },
  };
}

/* ─── Tool: DRAFT_DOCUMENT ─── */
export async function toolDraftDocument(entities: any): Promise<ToolResult> {
  const docType = entities.documentType ?? entities.type ?? "مذكرة قانونية";
  const about   = entities.about ?? entities.clientName ?? "";

  const systemPrompt = `أنت محامٍ خبير. اكتب ${docType} احترافية باللغة العربية. كن دقيقاً ومنظماً.`;
  const userPrompt   = about ? `اكتب ${docType} بخصوص: ${about}` : `اكتب ${docType} نموذجية`;

  const { reply } = await callAI(systemPrompt, userPrompt, [], "gemini");

  return {
    success: true,
    message: `📄 تم صياغة ${docType}`,
    data: { docType, content: reply },
    action: { type: "navigate", url: "/legal-ai" },
  };
}

/* ─── Tool: FINANCIAL_SUMMARY ─── */
export async function toolFinancialSummary(): Promise<ToolResult> {
  const officeId = await getOfficeId();
  const [rev, exp, inv] = await Promise.all([
    db.execute(sql`SELECT COALESCE(SUM(amount),0) as total FROM revenues WHERE office_id=${officeId}`),
    db.execute(sql`SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE office_id=${officeId}`),
    db.execute(sql`SELECT COALESCE(SUM(total),0) as overdue FROM client_invoices WHERE office_id=${officeId} AND status='overdue'`),
  ]);
  const revenue  = Number((rev.rows?.[0] as any)?.total ?? 0);
  const expenses = Number((exp.rows?.[0] as any)?.total ?? 0);
  const overdue  = Number((inv.rows?.[0] as any)?.overdue ?? 0);
  const net      = revenue - expenses;

  return {
    success: true,
    message: `💰 الملخص المالي:\n• الإيرادات: **${revenue.toLocaleString("ar-SA")} ر.س**\n• المصاريف: **${expenses.toLocaleString("ar-SA")} ر.س**\n• صافي الربح: **${net.toLocaleString("ar-SA")} ر.س**\n• المتأخرات: **${overdue.toLocaleString("ar-SA")} ر.س**`,
    data: { revenue, expenses, net, overdue },
    action: { type: "navigate", url: "/accounting/revenues" },
  };
}

/* ─── Tool: SEARCH_DATA ─── */
export async function toolSearchData(entities: any): Promise<ToolResult> {
  const officeId = await getOfficeId();
  const q = entities.query ?? entities.term ?? "";
  if (!q) return { success: false, message: "لم يتم تحديد نص البحث" };

  const [cases, clients] = await Promise.all([
    db.execute(sql`
      SELECT id, title, status, client_name FROM cases
      WHERE office_id=${officeId} AND (title ILIKE ${"%" + q + "%"} OR client_name ILIKE ${"%" + q + "%"})
      LIMIT 5
    `),
    db.execute(sql`
      SELECT id, full_name AS name, phone FROM clients
      WHERE office_id=${officeId} AND full_name ILIKE ${"%" + q + "%"}
      LIMIT 5
    `),
  ]);

  const caseResults  = (cases.rows ?? cases) as any[];
  const clientResults = (clients.rows ?? clients) as any[];

  let msg = `🔍 نتائج البحث عن "${q}":\n`;
  if (caseResults.length > 0) {
    msg += `\nقضايا (${caseResults.length}):\n` + caseResults.map(c => `• ${c.title} [${c.status}]`).join("\n");
  }
  if (clientResults.length > 0) {
    msg += `\nعملاء (${clientResults.length}):\n` + clientResults.map(c => `• ${c.name}${c.phone ? ` | ${c.phone}` : ""}`).join("\n");
  }
  if (caseResults.length === 0 && clientResults.length === 0) msg += "لا توجد نتائج.";

  return { success: true, message: msg, data: { cases: caseResults, clients: clientResults } };
}

/* ─── Registry Map ─── */
export const TOOL_REGISTRY = {
  CREATE_CASE:          toolCreateCase,
  CREATE_CLIENT:        toolCreateClient,
  CREATE_REMINDER:      toolCreateReminder,
  SCHEDULE_EVENT:       toolScheduleEvent,
  DRAFT_DOCUMENT:       toolDraftDocument,
  FINANCIAL_SUMMARY:    toolFinancialSummary,
  SEARCH_DATA:          toolSearchData,
};
