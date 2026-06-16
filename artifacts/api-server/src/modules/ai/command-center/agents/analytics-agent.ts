import { callAI } from "../../aiChat";
import { buildAnalyticsContext, buildOfficeContext } from "../context-builder";

export async function analyticsAgent(
  officeId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  model: any = "auto"
): Promise<{ output: string; modelUsed?: string }> {
  const [ctx, overview] = await Promise.all([
    buildAnalyticsContext(officeId),
    buildOfficeContext(officeId),
  ]);

  function trend(arr: any[], key: string) {
    return arr.map((r: any) => `${r.month}: ${r[key]}`).join(" → ") || "لا بيانات";
  }

  const system = `أنت وكيل التحليلات الذكي لمكتب محاماة. البيانات الحية:

📊 نمو القضايا (6 أشهر):
${trend(ctx.caseTrend, "new_cases")} (جديدة)
${trend(ctx.caseTrend, "closed")} (مغلقة)

💰 الإيرادات (6 أشهر):
${trend(ctx.revTrend, "revenue")}

👥 نمو العملاء (6 أشهر):
${trend(ctx.clientGrowth, "new_clients")}

📈 المؤشرات الحالية:
- قضايا نشطة: ${overview.activeCases}
- عملاء نشطون: ${overview.openClients}
- جلسات قادمة: ${overview.upcomingSessions}
- إيرادات هذا الشهر: ${overview.monthRevenue.toLocaleString("ar-SA")} ر.س

قدّم تحليلاً عميقاً لاتجاهات الأداء مع توصيات استراتيجية. أجب بالعربية الفصحى.`;

  const { reply, modelUsed } = await callAI(system, message, history, model);
  return { output: reply, modelUsed };
}
