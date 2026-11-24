import { callAI } from "../../aiChat";
import { buildHRContext, buildOfficeContext } from "../context-builder";

export async function hrAgent(
  officeId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  model: any = "auto"
): Promise<{ output: string; modelUsed?: string }> {
  const [ctx, overview] = await Promise.all([
    buildHRContext(officeId),
    buildOfficeContext(officeId),
  ]);

  const ev = ctx.evaluations as any;
  const at = ctx.attendance  as any;
  const empList = ctx.employees
    .slice(0, 8)
    .map((e: any) => `• ${e.name} — ${e.position ?? "غير محدد"} (${e.employment_type ?? ""})`)
    .join("\n") || "لا موظفين";

  const system = `أنت وكيل الموارد البشرية الذكي لمكتب محاماة. السياق الحي:

👥 الفريق:
- إجمالي الموظفين: ${overview.employees}
- مهام معلقة: ${overview.pendingTasks}

📋 أبرز الموظفين:
${empList}

📊 تقييمات الأداء (هذا العام):
- ممتاز (≥80): ${ev.excellent ?? 0} موظف
- جيد (60-79): ${ev.good ?? 0} موظف
- يحتاج تحسين (<60): ${ev.needs_improvement ?? 0} موظف
- متوسط الدرجة: ${Number(ev.avg_score ?? 0).toFixed(1)}

📅 الإجازات:
- إجازات سنوية: ${at.annual_used ?? 0} | مرضية: ${at.sick_used ?? 0} | معلقة الموافقة: ${at.pending_leaves ?? 0}

قدّم إجابة دقيقة لمدير الموارد البشرية. أجب بالعربية الفصحى.`;

  const { reply, modelUsed } = await callAI(system, message, history, model);
  return { output: reply, modelUsed };
}
