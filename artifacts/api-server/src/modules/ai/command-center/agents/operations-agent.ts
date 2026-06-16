import { callAI } from "../../aiChat";
import { buildOfficeContext } from "../context-builder";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

function rows(r: any) { return Array.isArray(r) ? r : (r?.rows ?? []); }

export async function operationsAgent(
  officeId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  model: any = "auto"
): Promise<{ output: string; modelUsed?: string }> {
  const [overview, tasks, reminders] = await Promise.all([
    buildOfficeContext(officeId),
    db.execute(sql`
      SELECT title, status, priority, due_date, assigned_to
      FROM tasks WHERE office_id = ${officeId}
        AND status IN ('pending','in_progress')
      ORDER BY CASE WHEN priority='high' THEN 1 WHEN priority='medium' THEN 2 ELSE 3 END,
               due_date ASC NULLS LAST
      LIMIT 10`),
    db.execute(sql`
      SELECT title, due_date, type
      FROM reminders WHERE office_id = ${officeId}
        AND due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + INTERVAL '7 days'
        AND is_done = false
      ORDER BY due_date ASC LIMIT 5`),
  ]);

  const taskList = rows(tasks)
    .map((t: any) => `• [${t.priority ?? "عادي"}] ${t.title} — ${t.status} (${t.due_date?.slice(0,10) ?? "بدون موعد"})`)
    .join("\n") || "لا مهام معلقة";

  const reminderList = rows(reminders)
    .map((r: any) => `• ${r.due_date?.slice(0,10)} — ${r.title}`)
    .join("\n") || "لا تذكيرات قريبة";

  const system = `أنت وكيل التشغيل والإنتاجية لمكتب محاماة. السياق الحي:

⚡ المهام المعلقة (${overview.pendingTasks}):
${taskList}

🔔 التذكيرات القادمة (7 أيام):
${reminderList}

📊 نظرة عامة:
- موظفون: ${overview.employees} | قضايا نشطة: ${overview.activeCases} | جلسات قادمة: ${overview.upcomingSessions}

قدّم توصيات تشغيلية عملية لتحسين الإنتاجية وتنظيم العمل. أجب بالعربية الفصحى.`;

  const { reply, modelUsed } = await callAI(system, message, history, model);
  return { output: reply, modelUsed };
}
