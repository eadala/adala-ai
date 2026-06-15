import { detectIntent, IntentType } from "./intent.engine";
import { buildRichContext, formatContextForPrompt } from "./context.engine";
import { buildMemoryContext, rememberFact } from "./memory";
import { analyzeCaseIntelligence } from "./case.intelligence";
import { TOOL_REGISTRY } from "./tool.registry";
import { callAI } from "../modules/ai/aiChat";

export interface OrchestratorResult {
  reply: string;
  intent: IntentType;
  confidence: number;
  action?: { type: string; url?: string; [k: string]: any };
  intelligence?: any;
  toolUsed?: string;
}

const COPILOT_SYSTEM = (context: string) => `أنت "عدل" — المساعد القانوني الذكي لمنصة عدالة AI.
أنت لا تجيب فقط — بل تُنفّذ وتُحلّل وتُساعد على اتخاذ القرار.

${context}

قواعدك:
- أجب باللغة العربية دائماً، بأسلوب احترافي ودود وموجز
- استخدم **نص غامق** للأرقام والنقاط المهمة
- للقوائم: استخدم • أو أرقام مرتبة
- إذا نفّذت إجراء، اذكر ما تم بوضوح
- لا تخترع بيانات ليست في السياق
- الأمان: لا تحذف بيانات، لا تُعدّل بيانات مالية مباشرة`;

export async function orchestrate(
  message: string,
  history: { role: string; content: string }[],
  userId: string,
  officeId: string,
  pageContext = ""
): Promise<OrchestratorResult> {

  /* 1. Detect Intent */
  const intent = await detectIntent(message);

  /* 2. Build Context */
  const [richCtx, memory] = await Promise.all([
    buildRichContext(officeId),
    buildMemoryContext(userId, officeId),
  ]);
  const context = formatContextForPrompt(richCtx, memory)
    + (pageContext ? `\nالصفحة الحالية: ${pageContext}` : "");

  /* 3. Handle Tool Intents directly */
  if (intent.confidence > 0.75) {
    /* ANALYZE_CASE / CALCULATE_PROBABILITY → Case Intelligence */
    if (intent.type === "ANALYZE_CASE" || intent.type === "CALCULATE_PROBABILITY") {
      const caseId = intent.entities.caseId;
      if (caseId) {
        try {
          const intel = await analyzeCaseIntelligence(caseId);
          const pct   = intel.probabilityOfWin;
          const risk  = intel.riskLevel === "low" ? "منخفضة" : intel.riskLevel === "medium" ? "متوسطة" : intent.entities.riskLevel === "critical" ? "حرجة" : "عالية";
          const reply = `
🧠 **تحليل القضية: ${intel.caseTitle}**

📊 **احتمالية الفوز: ${pct}%** ${pct >= 70 ? "✅" : pct >= 50 ? "⚠️" : "❌"}
⚠️ **مستوى المخاطرة:** ${risk}

**نقاط القوة:**
${intel.keyStrengths.map(s => `• ${s}`).join("\n")}

**نقاط الضعف:**
${intel.keyWeakPoints.map(w => `• ${w}`).join("\n")}

**الاستراتيجية المقترحة:**
${intel.recommendedStrategy}

**المدة المتوقعة:** ${intel.estimatedDuration}

${intel.analysisText}
`.trim();
          return { reply, intent: intent.type, confidence: intent.confidence, intelligence: intel };
        } catch (e: any) {
          /* Fall through to AI chat */
        }
      }
    }

    /* Tool Registry Intents */
    const toolIntents: IntentType[] = [
      "CREATE_CASE", "CREATE_CLIENT", "CREATE_REMINDER",
      "SCHEDULE_EVENT", "DRAFT_DOCUMENT", "FINANCIAL_SUMMARY", "SEARCH_DATA"
    ];
    if (toolIntents.includes(intent.type)) {
      const tool = TOOL_REGISTRY[intent.type as keyof typeof TOOL_REGISTRY];
      if (tool) {
        try {
          const result = await (tool as any)(intent.entities, userId);
          if (result.success) {
            /* Save memory: last action */
            await rememberFact(userId, officeId, "history", "last_action", intent.type);
            return {
              reply: result.message + (result.data?.content ? "\n\n" + result.data.content : ""),
              intent: intent.type,
              confidence: intent.confidence,
              action: result.action,
              toolUsed: intent.type,
            };
          }
        } catch {}
      }
    }

    /* NAVIGATE */
    if (intent.type === "NAVIGATE") {
      const urlMap: Record<string, string> = {
        قضايا: "/cases", عملاء: "/clients", فواتير: "/invoices",
        عقود: "/contracts", مستندات: "/documents", تذكيرات: "/reminders",
        تقارير: "/financial-reports", مدفوعات: "/payment-center",
        موظفين: "/hr", مهام: "/tasks", رواتب: "/payroll",
        ذكاء: "/ai-hub", مراقبة: "/monitoring",
      };
      const found = Object.entries(urlMap).find(([k]) => message.includes(k));
      if (found) {
        return {
          reply: `✅ انتقل إلى صفحة ${found[0]}`,
          intent: intent.type,
          confidence: intent.confidence,
          action: { type: "navigate", url: found[1] },
        };
      }
    }
  }

  /* 4. Fallback: AI Chat with full context */
  const systemPrompt = COPILOT_SYSTEM(context);
  const { reply } = await callAI(systemPrompt, message, history, "gemini");

  /* Parse any [ACTION:...] blocks from AI reply */
  const actionMatch = reply.match(/\[ACTION:(\{.+?\})\]/s);
  let action;
  const cleanReply = reply.replace(/\[ACTION:\{.+?\}\]/gs, "").trim();
  if (actionMatch) {
    try { action = JSON.parse(actionMatch[1]); } catch {}
  }

  return {
    reply: cleanReply,
    intent: intent.type,
    confidence: intent.confidence,
    action,
  };
}
