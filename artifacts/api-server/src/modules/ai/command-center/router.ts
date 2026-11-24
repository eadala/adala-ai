import type { AIAgentType } from "./types";

/* ── Intent keywords → agent mapping ─────────────────────────────────────── */
const INTENT_MAP: { patterns: RegExp[]; agent: AIAgentType }[] = [
  {
    patterns: [/قضي|محاكم|جلس|قانون|عقد|موكل|محام|تقاض|نزاع|دعو|حكم/i],
    agent: "legal",
  },
  {
    patterns: [/مال|إيراد|مصروف|فاتور|راتب|ميزانية|ربح|خسار|تحصيل|دفع|مبلغ|ريال/i],
    agent: "finance",
  },
  {
    patterns: [/موظف|أداء|إجاز|تقييم|تدريب|فريق|توظيف|رواتب|hr|موارد بشرية/i],
    agent: "hr",
  },
  {
    patterns: [/أمن|صلاحي|اختراق|حماية|كلمة مرور|تهديد|هجوم|وصول|سجل دخول/i],
    agent: "security",
  },
  {
    patterns: [/تحليل|إحصاء|نمو|اتجاه|مقارن|مؤشر|kpi|تقرير أداء|بيانات/i],
    agent: "analytics",
  },
  {
    patterns: [/تسويق|اكتساب|عميل جديد|توسع|سوق|منافس|ترويج|إعلان/i],
    agent: "growth",
  },
  {
    patterns: [/مهمة|إنتاجية|تشغيل|عملية|تنظيم|توزيع عمل|تذكير|جدول/i],
    agent: "operations",
  },
  {
    patterns: [/سيرفر|قاعدة بيانات|أداء نظام|بوق|bug|خطأ تقني|api|كود|developer|مطور/i],
    agent: "developer",
  },
];

export function detectAgentIntent(message: string): AIAgentType {
  for (const { patterns, agent } of INTENT_MAP) {
    if (patterns.some(p => p.test(message))) return agent;
  }
  return "legal";
}

export async function aiRouter(
  type: AIAgentType,
  officeId: string,
  message: string,
  history: { role: string; content: string }[] = [],
  model: any = "auto"
): Promise<{ output: string; modelUsed?: string; diagnostics?: any }> {
  switch (type) {
    case "legal":      return (await import("./agents/legal-agent")).legalAgent(officeId, message, history, model);
    case "finance":    return (await import("./agents/finance-agent")).financeAgent(officeId, message, history, model);
    case "hr":         return (await import("./agents/hr-agent")).hrAgent(officeId, message, history, model);
    case "security":   return (await import("./agents/security-agent")).securityAgent(officeId, message, history, model);
    case "analytics":  return (await import("./agents/analytics-agent")).analyticsAgent(officeId, message, history, model);
    case "growth":     return (await import("./agents/growth-agent")).growthAgent(officeId, message, history, model);
    case "operations": return (await import("./agents/operations-agent")).operationsAgent(officeId, message, history, model);
    case "developer":  return (await import("./agents/dev-commander")).devCommanderAgent(message, history, model);
    default:           return (await import("./agents/legal-agent")).legalAgent(officeId, message, history, model);
  }
}
