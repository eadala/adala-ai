import { callAI } from "../../aiChat";
import { buildLegalContext, buildOfficeContext } from "../context-builder";

export async function legalAgent(
  officeId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  model: any = "auto"
): Promise<{ output: string; modelUsed?: string }> {
  const [ctx, overview] = await Promise.all([
    buildLegalContext(officeId),
    buildOfficeContext(officeId),
  ]);

  const upcomingSessions = ctx.sessions
    .map((s: any) => `• ${s.session_date?.slice(0, 10)} — ${s.case_title} (${s.session_location ?? "غير محدد"})`)
    .join("\n") || "لا جلسات قادمة";

  const activeCases = ctx.cases
    .slice(0, 5)
    .map((c: any) => `• [${c.status}] ${c.title} — ${c.case_type ?? ""} (${c.client_name ?? ""})`)
    .join("\n") || "لا توجد قضايا نشطة";

  const system = `أنت الوكيل القانوني الذكي لمكتب محاماة. لديك هذا السياق الحي:

📊 نظرة عامة:
- قضايا نشطة: ${overview.activeCases}
- قضايا حرجة: ${overview.criticalCases}
- عملاء نشطون: ${overview.openClients}
- جلسات قادمة (14 يوم): ${overview.upcomingSessions}

⚖️ أبرز القضايا النشطة:
${activeCases}

📅 الجلسات القادمة:
${upcomingSessions}

📄 العقود: نشطة=${ctx.contracts.active ?? 0} | منتهية=${ctx.contracts.expired ?? 0} | تنتهي قريباً=${ctx.contracts.expiring_soon ?? 0}

قدّم تحليلاً قانونياً دقيقاً بناءً على السياق الحقيقي. ركّز على الأولويات وإجراءات التالية المحددة. أجب بالعربية الفصحى.`;

  const { reply, modelUsed } = await callAI(system, message, history, model);
  return { output: reply, modelUsed };
}
