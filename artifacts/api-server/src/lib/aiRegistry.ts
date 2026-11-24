/**
 * AI Registry — عدالة AI Platform
 * السجل المركزي لجميع وكلاء الذكاء الاصطناعي والنماذج والأدوات
 *
 * كل وكيل أو نموذج موثَّق بالتكلفة والحدود والأهداف
 * المرجع الوحيد — callAI() و aiGateway.ts يعتمدان عليه
 */

export type AIProvider = "gemini" | "anthropic" | "openai" | "fallback";
export type AIUseCase =
  | "legal-drafting"
  | "case-analysis"
  | "prediction"
  | "translation"
  | "research"
  | "financial"
  | "general-chat"
  | "code"
  | "document-review"
  | "risk-assessment";

export interface AIModelDefinition {
  id: string;                         // معرّف النموذج
  provider: AIProvider;
  nameAr: string;
  maxTokens: number;
  creditCostPerCall: number;          // 1 = gemini, 3 = claude/openai
  useCases: AIUseCase[];
  isDefault?: boolean;
  envKey?: string;                    // متغير البيئة المطلوب
  fallbackTo?: string;                // النموذج البديل
}

export interface AIAgentDefinition {
  id: string;
  nameAr: string;
  route?: string;                     // API route المرتبط
  model: string;                      // model.id
  systemPromptKey?: string;           // مفتاح البرومبت في aiTemplates
  useCase: AIUseCase;
  rateLimitPerHour?: number;
  requiresPermission?: string;
  plans: string[];                    // الباقات التي تدعمه
  description?: string;
  usesRAG?: boolean;                  // يستخدم Retrieval Augmented Generation؟
  savesToDB?: boolean;                // يحفظ النتائج؟
}

export interface AIToolDefinition {
  name: string;
  nameAr: string;
  agentId?: string;
  description: string;
  inputSchema: string;               // وصف مختصر للمدخلات
  outputSchema: string;              // وصف مختصر للمخرجات
}

/* ── النماذج المتاحة ──────────────────────────────────────── */
export const AI_MODELS: AIModelDefinition[] = [
  {
    id: "gemini-2.0-flash",
    provider: "gemini",
    nameAr: "Gemini 2.0 Flash",
    maxTokens: 8192,
    creditCostPerCall: 1,
    useCases: ["legal-drafting", "case-analysis", "general-chat", "translation", "research"],
    isDefault: true,
    envKey: "GEMINI_API_KEY",
    fallbackTo: "arabic-template",
  },
  {
    id: "gemini-1.5-pro",
    provider: "gemini",
    nameAr: "Gemini 1.5 Pro",
    maxTokens: 32768,
    creditCostPerCall: 2,
    useCases: ["document-review", "research", "prediction", "financial"],
    envKey: "GEMINI_API_KEY",
    fallbackTo: "gemini-2.0-flash",
  },
  {
    id: "claude-3-5-sonnet",
    provider: "anthropic",
    nameAr: "Claude 3.5 Sonnet",
    maxTokens: 8192,
    creditCostPerCall: 3,
    useCases: ["legal-drafting", "document-review", "code", "risk-assessment"],
    envKey: "ANTHROPIC_API_KEY",
    fallbackTo: "gemini-2.0-flash",
  },
  {
    id: "gpt-4o",
    provider: "openai",
    nameAr: "GPT-4o",
    maxTokens: 8192,
    creditCostPerCall: 3,
    useCases: ["general-chat", "research", "code"],
    envKey: "OPENAI_API_KEY",
    fallbackTo: "gemini-2.0-flash",
  },
  {
    id: "arabic-template",
    provider: "fallback",
    nameAr: "القوالب العربية (لا اتصال)",
    maxTokens: 0,
    creditCostPerCall: 0,
    useCases: ["legal-drafting"],
    isDefault: false,
  },
];

/* ── الوكلاء الذكيون ──────────────────────────────────────── */
export const AI_AGENTS: AIAgentDefinition[] = [
  {
    id: "legal-ai-writer",
    nameAr: "كاتب المذكرات القانونية",
    route: "/api/legal-ai/generate",
    model: "gemini-2.0-flash",
    useCase: "legal-drafting",
    rateLimitPerHour: 20,
    plans: ["starter", "professional", "enterprise"],
    savesToDB: true,
    description: "يكتب مذكرات، مرافعات، عقود، وإنذارات بالعربية",
  },
  {
    id: "case-health-analyzer",
    nameAr: "محلل صحة القضايا",
    route: "/api/cases/:id/health",
    model: "gemini-2.0-flash",
    useCase: "case-analysis",
    plans: ["professional", "enterprise"],
    savesToDB: true,
    description: "يحسب درجة صحة القضية (0-100) ويُنشئ تقرير",
  },
  {
    id: "case-autopilot",
    nameAr: "الطيار الآلي للقضايا",
    route: "/api/cases/:id/autopilot",
    model: "gemini-2.0-flash",
    useCase: "case-analysis",
    plans: ["professional", "enterprise"],
    savesToDB: true,
    description: "يُنشئ مهام تلقائية بناءً على حالة القضية",
  },
  {
    id: "opponent-simulator",
    nameAr: "محاكي الخصم",
    route: "/api/ai-chat/opponent",
    model: "gemini-1.5-pro",
    useCase: "prediction",
    rateLimitPerHour: 10,
    plans: ["professional", "enterprise"],
    savesToDB: false,
    description: "يحاكي حجج الخصم ويجهّز الردود",
  },
  {
    id: "financial-guard",
    nameAr: "حارس المعاملات المالية",
    route: "/api/fincore/guard",
    model: "gemini-2.0-flash",
    useCase: "financial",
    plans: ["enterprise"],
    savesToDB: true,
    description: "يفحص المعاملات ويرصد الشذوذات المالية",
  },
  {
    id: "legal-copilot",
    nameAr: "المساعد القانوني الذكي",
    route: "/api/copilot/query",
    model: "gemini-2.0-flash",
    useCase: "general-chat",
    plans: ["starter", "professional", "enterprise"],
    savesToDB: false,
    description: "محادثة قانونية مع وعي بسياق المكتب",
  },
  {
    id: "ai-coo",
    nameAr: "المدير التنفيذي الذكي",
    route: "/api/ai-coo/*",
    model: "gemini-1.5-pro",
    useCase: "general-chat",
    plans: ["professional", "enterprise"],
    savesToDB: true,
    description: "تحليل شامل لأداء المكتب وتوصيات استراتيجية",
  },
  {
    id: "jlwm-intelligence",
    nameAr: "ذكاء مركز القيادة القانونية",
    route: "/api/jlwm/*",
    model: "gemini-1.5-pro",
    useCase: "prediction",
    plans: ["professional", "enterprise"],
    savesToDB: true,
    usesRAG: true,
    description: "نظام الذكاء القانوني الشامل — تنبؤ، محاكاة، تحليل",
  },
  {
    id: "dev-commander",
    nameAr: "قائد التطوير الذكي",
    route: "/api/ai-command-center/dev-commander/*",
    model: "gemini-2.0-flash",
    useCase: "code",
    requiresPermission: "super_admin",
    plans: ["enterprise"],
    savesToDB: true,
    description: "يفحص الكود ويقترح تحسينات معمارية",
  },
  {
    id: "ui-builder-ai",
    nameAr: "منشئ الواجهات بالذكاء",
    route: "/api/ui-builder/generate",
    model: "gemini-2.0-flash",
    useCase: "code",
    plans: ["professional", "enterprise"],
    savesToDB: false,
    description: "يحوّل النص إلى مكوّنات React قابلة للتخصيص",
  },
];

/* ── الأدوات ──────────────────────────────────────────────── */
export const AI_TOOLS: AIToolDefinition[] = [
  {
    name: "get_case_summary",
    nameAr: "ملخص القضية",
    agentId: "legal-copilot",
    description: "يجلب ملخص القضية من DB للسياق",
    inputSchema: "{ caseId: string }",
    outputSchema: "{ title, status, nextHearing, clientName }",
  },
  {
    name: "search_legal_precedents",
    nameAr: "البحث في السوابق القضائية",
    agentId: "legal-copilot",
    description: "يبحث في قاعدة السوابق القضائية المحلية",
    inputSchema: "{ query: string, jurisdiction?: string }",
    outputSchema: "{ precedents: Array<{ title, court, year, summary }> }",
  },
  {
    name: "calculate_financial_risk",
    nameAr: "حساب المخاطر المالية",
    agentId: "financial-guard",
    description: "يحسب درجة مخاطر معاملة مالية",
    inputSchema: "{ amount: number, type: string, officeId: string }",
    outputSchema: "{ riskScore: number, flags: string[], recommendation: string }",
  },
];

/* ── Helpers ─────────────────────────────────────────────── */
export function getModel(id: string): AIModelDefinition | undefined {
  return AI_MODELS.find(m => m.id === id);
}

export function getAgent(id: string): AIAgentDefinition | undefined {
  return AI_AGENTS.find(a => a.id === id);
}

export function getDefaultModel(): AIModelDefinition {
  return AI_MODELS.find(m => m.isDefault) ?? AI_MODELS[0];
}

export function getAgentsForPlan(plan: string): AIAgentDefinition[] {
  return AI_AGENTS.filter(a => a.plans.includes(plan));
}

export function getTotalCreditCost(modelId: string, calls: number): number {
  const model = getModel(modelId);
  return (model?.creditCostPerCall ?? 0) * calls;
}
