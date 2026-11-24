import { callAI } from "../../aiChat";
import { buildAnalyticsContext, buildOfficeContext } from "../context-builder";

export async function growthAgent(
  officeId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  model: any = "auto"
): Promise<{ output: string; modelUsed?: string }> {
  const [ctx, overview] = await Promise.all([
    buildAnalyticsContext(officeId),
    buildOfficeContext(officeId),
  ]);

  const lastClients = ctx.clientGrowth.slice(-3).map((r: any) => `${r.month}: +${r.new_clients}`).join(", ");
  const lastRev     = ctx.revTrend.slice(-3).map((r: any) => `${r.month}: ${Number(r.revenue).toLocaleString("ar-SA")}`).join(", ");

  const system = `أنت وكيل النمو والتسويق لمكتب محاماة. البيانات الحية:

🚀 آخر 3 أشهر:
- اكتساب عملاء: ${lastClients || "لا بيانات"}
- الإيرادات: ${lastRev || "لا بيانات"}
- إجمالي العملاء الحاليين: ${overview.openClients}

📌 الفرص:
- قضايا حرجة قد تحتاج دعماً قانونياً إضافياً: ${overview.criticalCases}
- فواتير غير محصّلة (فرصة تحصيل): ${overview.unpaidInvoices} بقيمة ${overview.unpaidAmount.toLocaleString("ar-SA")} ر.س

قدّم استراتيجيات نمو ملموسة مع خطوات تنفيذية واقعية. أجب بالعربية الفصحى.`;

  const { reply, modelUsed } = await callAI(system, message, history, model);
  return { output: reply, modelUsed };
}
