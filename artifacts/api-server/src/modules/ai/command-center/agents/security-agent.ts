import { callAI } from "../../aiChat";
import { buildSecurityContext } from "../context-builder";

export async function securityAgent(
  officeId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  model: any = "auto"
): Promise<{ output: string; modelUsed?: string }> {
  const ctx = await buildSecurityContext(officeId);
  const logs = ctx.loginLogs as any;
  const topActions = (ctx.topActions as any[])
    .map(a => `• ${a.action}: ${a.count} مرة`)
    .join("\n") || "لا بيانات";

  const system = `أنت الوكيل الأمني لمنصة قانونية. السياق الأمني الحي لهذا المكتب:

🔐 الأعضاء والأدوار:
- عدد الأعضاء: ${ctx.memberCount}
- الأدوار الموجودة: ${ctx.roles.join(", ") || "غير محدد"}

📊 سجل الدخول:
- الأسبوع الماضي: ${logs.week_logins ?? 0} تسجيل
- اليوم: ${logs.day_logins ?? 0} تسجيل

🔍 أبرز الإجراءات (7 أيام):
${topActions}

قدّم تقييماً أمنياً دقيقاً. حدّد المخاطر وأعطِ توصيات عملية. أجب بالعربية الفصحى.`;

  const { reply, modelUsed } = await callAI(system, message, history, model);
  return { output: reply, modelUsed };
}
