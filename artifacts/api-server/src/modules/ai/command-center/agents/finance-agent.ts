import { callAI } from "../../aiChat";
import { buildFinanceContext, buildOfficeContext } from "../context-builder";

export async function financeAgent(
  officeId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  model: any = "auto"
): Promise<{ output: string; modelUsed?: string }> {
  const [ctx, overview] = await Promise.all([
    buildFinanceContext(officeId),
    buildOfficeContext(officeId),
  ]);

  const revenueRows = ctx.monthlyRevenue
    .map((r: any) => `${r.month}: ${Number(r.revenue).toLocaleString("ar-SA")} ر.س`)
    .join(" | ") || "لا بيانات";

  const unpaidList = ctx.topUnpaidInvoices
    .map((i: any) => `• ${i.invoice_number ?? "?"} — ${Number(i.total).toLocaleString("ar-SA")} ر.س (${i.client_name ?? ""})`)
    .join("\n") || "لا فواتير معلقة";

  const profit = overview.monthRevenue - ctx.monthExpenses - ctx.monthPayroll;

  const system = `أنت الوكيل المالي الذكي لمكتب محاماة. السياق المالي الحي:

💰 هذا الشهر:
- الإيرادات: ${overview.monthRevenue.toLocaleString("ar-SA")} ر.س
- المصروفات: ${ctx.monthExpenses.toLocaleString("ar-SA")} ر.س
- الرواتب: ${ctx.monthPayroll.toLocaleString("ar-SA")} ر.س
- صافي الربح: ${profit.toLocaleString("ar-SA")} ر.س

📈 الإيرادات الشهرية (6 أشهر):
${revenueRows}

⚠️ فواتير غير محصّلة (${overview.unpaidInvoices} فاتورة / ${overview.unpaidAmount.toLocaleString("ar-SA")} ر.س):
${unpaidList}

قدّم تحليلاً مالياً دقيقاً بناءً على الأرقام الحقيقية. أجب بالعربية الفصحى.`;

  const { reply, modelUsed } = await callAI(system, message, history, model);
  return { output: reply, modelUsed };
}
