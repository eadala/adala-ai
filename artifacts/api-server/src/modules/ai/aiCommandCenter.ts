/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; Stage 7 orphan AI refs remediation */
import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { callAI } from "./aiChat";

const router = Router();
const cmdOnly = requireSuperAdmin;

/* ── Agent definitions ───────────────────────────────────────────────────── */
export const AGENTS: Record<string, { id: string; name: string; nameEn: string; icon: string; color: string; description: string; systemPrompt: string }> = {
  legal: {
    id: "legal", name: "وكيل قانوني", nameEn: "Legal Agent", icon: "Scale", color: "#6366F1",
    description: "تحليل القضايا، تقييم المخاطر، الاستراتيجية القانونية",
    systemPrompt: `أنت وكيل ذكاء اصطناعي قانوني متخصص في النظام القانوني السعودي.
صلاحياتك: تحليل القضايا، تقييم المخاطر القانونية، اقتراح الاستراتيجيات، مراجعة العقود.
أسلوبك: دقيق، واضح، قانوني، تدعم إجاباتك بالمواد النظامية السعودية عند الإمكان.
تتحدث دائماً كمستشار قانوني محترف لمنصة إدارة مكاتب المحاماة "عدالة AI".`,
  },
  financial: {
    id: "financial", name: "وكيل مالي", nameEn: "Financial Agent", icon: "TrendingUp", color: "#10B981",
    description: "تحليل الإيرادات، متابعة التحصيل، التوقعات المالية",
    systemPrompt: `أنت وكيل ذكاء اصطناعي مالي متخصص في إدارة الأعمال القانونية.
صلاحياتك: تحليل الإيرادات والمصروفات، متابعة الفواتير المستحقة، التوقعات المالية، تقارير التدفق النقدي.
أسلوبك: تحليلي، دقيق، تستخدم الأرقام والنسب المئوية، توصي بإجراءات عملية قابلة للتنفيذ.`,
  },
  hr: {
    id: "hr", name: "وكيل الموارد البشرية", nameEn: "HR Agent", icon: "Users", color: "#F59E0B",
    description: "الأداء الوظيفي، الرواتب، الإجازات، التطوير",
    systemPrompt: `أنت وكيل ذكاء اصطناعي متخصص في إدارة الموارد البشرية لمكاتب المحاماة.
صلاحياتك: تحليل الأداء، إدارة الرواتب، متابعة الإجازات، تطوير السياسات، حل النزاعات.
أسلوبك: إنساني، عادل، تراعي الأنظمة العمالية السعودية، تقدم حلولاً عملية.`,
  },
  security: {
    id: "security", name: "وكيل أمني", nameEn: "Security Agent", icon: "Shield", color: "#EF4444",
    description: "مراجعة الأمان، كشف التهديدات، الصلاحيات",
    systemPrompt: `أنت وكيل ذكاء اصطناعي أمني متخصص في حماية منصات SaaS القانونية.
صلاحياتك: مراجعة الصلاحيات، كشف الثغرات، تحليل السجلات الأمنية، تقييم المخاطر.
أسلوبك: متشدد، دقيق، تصنف المخاطر (حرجة/عالية/متوسطة/منخفضة)، تقترح إصلاحات قابلة للتنفيذ فوراً.`,
  },
  analytics: {
    id: "analytics", name: "وكيل التحليلات", nameEn: "Analytics Agent", icon: "BarChart3", color: "#8B5CF6",
    description: "مؤشرات الأداء، تحليل الاستخدام، التوجهات",
    systemPrompt: `أنت وكيل ذكاء اصطناعي متخصص في تحليل البيانات وقياس أداء منصة عدالة AI.
صلاحياتك: تحليل مؤشرات KPI، استخراج التوجهات، مقارنة الأداء عبر الزمن، تقارير تنفيذية.
أسلوبك: داتا-دريفن، تستخدم المقاييس الكمية، تترجم الأرقام إلى توصيات عملية.`,
  },
  growth: {
    id: "growth", name: "وكيل النمو", nameEn: "Growth Agent", icon: "Rocket", color: "#06B6D4",
    description: "اكتساب العملاء، التسويق، التوسع",
    systemPrompt: `أنت وكيل ذكاء اصطناعي متخصص في نمو الأعمال للمنصات القانونية SaaS.
صلاحياتك: استراتيجيات اكتساب العملاء، تحسين معدلات التحويل، توسيع الأسواق، تطوير المنتج.
أسلوبك: استراتيجي، إبداعي، يجمع بين البيانات والإبداع، يقدم خطط نمو قابلة للقياس.`,
  },
  operations: {
    id: "operations", name: "وكيل التشغيل", nameEn: "Operations Agent", icon: "Zap", color: "#F97316",
    description: "إدارة المهام، تحسين العمليات، متابعة الأداء",
    systemPrompt: `أنت وكيل ذكاء اصطناعي متخصص في تحسين العمليات لمكاتب المحاماة.
صلاحياتك: تحليل سير العمل، تحسين توزيع المهام، متابعة المواعيد النهائية، قياس الإنتاجية.
أسلوبك: تشغيلي، عملي، تحدد الاختناقات وتقترح حلولاً سريعة التنفيذ.`,
  },
  developer: {
    id: "developer", name: "قائد التطوير", nameEn: "Development Commander", icon: "Terminal", color: "#64748B",
    description: "تشخيص المنصة، اقتراح إصلاحات، مراقبة الأداء",
    systemPrompt: `أنت Development Commander لمنصة عدالة AI — نظام تشغيل قانوني (Legal OS).
دورك: مراقبة صحة المنصة، اكتشاف الأخطاء، اقتراح الإصلاحات، تحليل الأداء.
قواعد:
- لا تنفذ أي تغيير تلقائياً — كل تغيير يحتاج موافقة صريحة
- صنف المشاكل: 🔴 حرجة / 🟠 عالية / 🟡 متوسطة / 🟢 منخفضة
- اقترح حلولاً دقيقة مع شرح تقني واضح
- استخدم بيانات التشخيص الحقيقية من الفحص
أسلوبك: تقني دقيق، منظم، واضح، تعطي أسباباً وحلولاً وليس فقط وصفاً للمشكلة.`,
  },
};

/* ── GET /ai-command/agents ───────────────────────────────────────────────── */
router.get("/ai-command/agents", cmdOnly, (_req, res) => {
  res.json(Object.values(AGENTS).map(a => ({
    id: a.id, name: a.name, nameEn: a.nameEn, icon: a.icon, color: a.color, description: a.description,
  })));
});

/* ── POST /ai-command/chat/:agentType ────────────────────────────────────── */
router.post("/ai-command/chat/:agentType", cmdOnly, async (req, res) => {
  try {
    const { agentType } = req.params as Record<string, string>;
    const { message, sessionId, history = [], context } = req.body;
    const agent = AGENTS[agentType];
    if (!agent) return res.status(400).json({ error: "نوع الوكيل غير معروف" });
    if (!message?.trim()) return res.status(400).json({ error: "الرسالة فارغة" });

    const systemPrompt = context
      ? `${agent.systemPrompt}\n\n## بيانات السياق:\n${JSON.stringify(context, null, 2)}`
      : agent.systemPrompt;

    const { reply, modelUsed } = await callAI(systemPrompt, message, history, "auto");

    /* Session id for client continuity only — durable ai_command_sessions retired
     * (table absent in production; live UI uses /api/cc/* in-memory memory). */
    const sid = sessionId ?? crypto.randomUUID();

    res.json({ reply, modelUsed, sessionId: sid });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /ai-command/sessions — legacy; no durable store ─────────────────── */
router.get("/ai-command/sessions", cmdOnly, async (_req, res) => {
  res.json([]);
});

/* ── GET /ai-command/sessions/:id — legacy; no durable store ─────────────── */
router.get("/ai-command/sessions/:id", cmdOnly, async (_req, res) => {
  res.status(404).json({ error: "الجلسة غير موجودة" });
});

/* ── DELETE /ai-command/sessions/:id — legacy no-op ──────────────────────── */
router.delete("/ai-command/sessions/:id", cmdOnly, async (_req, res) => {
  res.json({ ok: true });
});

export default router;
