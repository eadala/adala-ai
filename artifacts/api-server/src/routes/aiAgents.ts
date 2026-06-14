import { requireAuth } from "../middlewares/requireAuth";
import { Router } from "express";

const router = Router();

const AGENTS: Record<string, { name: string; systemPrompt: string; fallback: (input: string) => string }> = {
  contracts: {
    name: "وكيل العقود",
    systemPrompt: "أنت وكيل ذكاء اصطناعي متخصص في العقود القانونية السعودية. تُصيغ العقود وتراجعها وتقارن نسخها. أجب بالعربية الفصحى.",
    fallback: (input) => `**تحليل العقد:**\n\n${input.length > 50 ? "بناءً على ما قدمته" : "بناءً على طلبك"}:\n\n**1. النقاط الجوهرية:**\n- تحديد الأطراف والصفات القانونية\n- الالتزامات التبادلية\n- شروط الإنهاء والتعويض\n\n**2. ما يحتاج مراجعة:**\n- شرط التحكيم (يُنصح بإضافته)\n- الغرامات التأخيرية\n- حالات القوة القاهرة\n\n**3. التوصية:** يُنصح بمراجعة العقد مع محامٍ متخصص قبل التوقيع.`,
  },
  litigation: {
    name: "وكيل التقاضي",
    systemPrompt: "أنت وكيل ذكاء اصطناعي متخصص في التقاضي أمام المحاكم السعودية. تحلل القضايا وتُعِد المذكرات وتقترح الدفوع. أجب بالعربية القانونية.",
    fallback: (input) => `**تحليل القضية:**\n\n**نقاط القوة:**\n- وضوح الوقائع والمستندات\n- إمكانية الإثبات بالقرائن\n\n**الدفوع المقترحة:**\n1. الدفع الشكلي: التحقق من الاختصاص واستيفاء الشروط الإجرائية\n2. الدفع الموضوعي: نفي أركان المسؤولية\n3. الدفع بالتقادم إن كان منطبقاً\n\n**الاستراتيجية:**\nيُنصح بالسعي للتسوية الودية أولاً، وإن تعذر فالمضي في الدعوى مع التركيز على الإثبات الوثائقي.`,
  },
  corporate: {
    name: "وكيل الشركات",
    systemPrompt: "أنت وكيل ذكاء اصطناعي متخصص في قانون الشركات السعودي (نظام الشركات 1443هـ). تساعد في تأسيس الشركات وإدارة قراراتها. أجب بالعربية.",
    fallback: (input) => `**الاستشارة الشركاتية:**\n\n**بخصوص طلبك:**\nوفق نظام الشركات السعودي 1443هـ:\n\n**الخطوات الأساسية:**\n1. تحديد نوع الشركة المناسب (محدودة المسؤولية / مساهمة)\n2. إعداد عقد التأسيس والنظام الأساسي\n3. التسجيل في وزارة التجارة\n4. استيفاء متطلبات رأس المال\n5. الحصول على السجل التجاري\n\n**الوثائق المطلوبة:**\n- هويات المؤسسين\n- عقد التأسيس الموثق\n- إثبات رأس المال`,
  },
  compliance: {
    name: "وكيل الامتثال",
    systemPrompt: "أنت وكيل ذكاء اصطناعي متخصص في الامتثال والحوكمة وفق الأنظمة السعودية (PDPL، مكافحة غسل الأموال، حماية البيانات). أجب بالعربية.",
    fallback: (input) => `**تقرير الامتثال:**\n\n**المجالات التي تحتاج مراجعة:**\n\n1. **حماية البيانات (PDPL):**\n- التحقق من سياسة الخصوصية\n- إجراءات جمع ومعالجة البيانات\n- آليات الحذف والتصحيح\n\n2. **مكافحة غسل الأموال:**\n- برنامج اعرف عميلك (KYC)\n- الإبلاغ عن المعاملات المشبوهة\n\n3. **الحوكمة:**\n- السياسات الداخلية\n- إجراءات تضارب المصالح\n\n**التوصية:** إعداد مصفوفة امتثال شاملة وتحديثها ربع سنوياً.`,
  },
  ip: {
    name: "وكيل الملكية الفكرية",
    systemPrompt: "أنت وكيل ذكاء اصطناعي متخصص في حقوق الملكية الفكرية في المملكة العربية السعودية (العلامات التجارية، براءات الاختراع، حقوق المؤلف). أجب بالعربية.",
    fallback: (input) => `**استشارة الملكية الفكرية:**\n\n**خيارات الحماية المتاحة:**\n\n1. **العلامة التجارية:**\n- التسجيل في هيئة الملكية الفكرية\n- الفترة: 10 سنوات قابلة للتجديد\n- التكلفة: 1,000 - 3,000 ريال\n\n2. **براءة الاختراع:**\n- شرط الجِدة والابتكار\n- مدة الحماية: 20 سنة\n- التقديم عبر هيئة الملكية الفكرية\n\n3. **حقوق المؤلف:**\n- حماية تلقائية عند الإنشاء\n- يُنصح بالتوثيق الرسمي\n\n**الخطوة التالية:** إجراء بحث عن المخالفات الحالية.`,
  },
  collections: {
    name: "وكيل التحصيل",
    systemPrompt: "أنت وكيل ذكاء اصطناعي متخصص في تحصيل الديون والمطالبات القانونية وفق الأنظمة السعودية. تُعِد الإنذارات وتقترح التسويات. أجب بالعربية.",
    fallback: (input) => `**خطة التحصيل:**\n\n**المرحلة 1 - الإنذار الودي:**\nإرسال إشعار رسمي بالبريد المسجل مع منح مهلة 15 يوماً.\n\n**المرحلة 2 - الإنذار القانوني:**\nإنذار رسمي موثق يتضمن إجمالي الدين + الفوائد القانونية + التكاليف.\n\n**المرحلة 3 - اللجوء القضائي:**\n- رفع دعوى أمام المحكمة التجارية\n- طلب الحجز التحفظي على أصول المدين\n- الحصول على أمر الأداء\n\n**التسوية المقترحة:**\nقبول 80% من المبلغ نقداً فورياً أفضل من انتظار الحكم.`,
  },
};

async function callGemini(systemPrompt: string, messages: { role: string; content: string }[], maxTokens = 1500): Promise<string | null> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return null;
  try {
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastMsg = messages[messages.length - 1];
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [...history, { role: "user", parts: [{ text: lastMsg.content }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }
    );
    const d = await r.json() as any;
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch { return null; }
}

router.post("/ai-agents/run", requireAuth, async (req, res) => {
  const { agentType, input, history = [] } = req.body as { agentType: string; input: string; history: {role:string;content:string}[] };

  const agent = AGENTS[agentType];
  if (!agent) return res.status(400).json({ error: "نوع الوكيل غير معروف" });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  const messages = [...history, { role: "user", content: input }];

  try {
    const geminiText = await callGemini(agent.systemPrompt, messages, 1500);
    if (geminiText) return res.json({ response: geminiText, agent: agentType });

    if (ANTHROPIC_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1500, system: agent.systemPrompt, messages }),
      });
      const d = await r.json() as any;
      if (d.content?.[0]?.text) return res.json({ response: d.content[0].text, agent: agentType });
    } else if (OPENAI_KEY) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1500, messages: [{ role: "system", content: agent.systemPrompt }, ...messages] }),
      });
      const d = await r.json() as any;
      if (d.choices?.[0]?.message?.content) return res.json({ response: d.choices[0].message.content, agent: agentType });
    }
  } catch {}

  res.json({ response: agent.fallback(input), agent: agentType });
});

router.get("/ai-agents/list", (_req, res) => {
  res.json(Object.entries(AGENTS).map(([key, a]) => ({ key, name: a.name })));
});

export default router;
