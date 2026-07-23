import { requireAuthWithTenant, requirePermission } from "../../middlewares/requireAuth";
import { Router } from "express";

const router = Router();

type CommandType = "analyze_case" | "draft_memo" | "review_contract" | "extract_risks" | "predict_outcome" | "suggest_settlement" | "draft_notice" | "legal_opinion";

const COMMAND_CONFIGS: Record<CommandType, { label: string; systemPrompt: string; fallback: string }> = {
  analyze_case: {
    label: "تحليل قضية",
    systemPrompt: "أنت محلل قانوني خبير. حلّل وقائع القضية المقدمة وقدّم: نقاط القوة، نقاط الضعف، الاستراتيجية المقترحة، والتوقعات. اكتب بالعربية القانونية.",
    fallback: "**تحليل القضية:**\n\n**نقاط القوة:**\n- وجود مستندات رسمية داعمة\n- وضوح العلاقة القانونية بين الأطراف\n\n**نقاط الضعف:**\n- قد تكون هناك ثغرات في الإثبات\n- احتمال الدفع بالتقادم\n\n**الاستراتيجية المقترحة:**\nالسعي للتسوية الودية مع الحفاظ على خيار التقاضي.\n\n**التوقع:** احتمالية نجاح 65-75% عند توافر الإثبات الكافي.",
  },
  draft_memo: {
    label: "إعداد مذكرة",
    systemPrompt: "أنت محامٍ خبير في صياغة المذكرات القانونية أمام المحاكم السعودية. أعد مذكرة قانونية احترافية بالعربية الفصحى بناءً على المعطيات المقدمة.",
    fallback: "**مذكرة دفاع**\n\nالسيد القاضي الموقر،\n\nبالإشارة إلى القضية الماثلة، يتشرف الوكيل بتقديم هذه المذكرة موضحاً فيها موقف موكله القانوني:\n\n**أولاً: الوقائع**\n[تُدرج وقائع القضية هنا]\n\n**ثانياً: الأساس القانوني**\nاستناداً للمادة المنطبقة من الأنظمة ذات الصلة...\n\n**ثالثاً: الطلبات**\nلهذه الأسباب، يلتمس الوكيل الحكم لصالح موكله.\n\nمقدم الطلب: المحامي / [الاسم]",
  },
  review_contract: {
    label: "مراجعة عقد",
    systemPrompt: "أنت مراجع عقود قانوني خبير. راجع العقد المقدم واستخرج: المخاطر، البنود الإشكالية، التوصيات. اكتب بالعربية.",
    fallback: "**تقرير مراجعة العقد:**\n\n**البنود الإشكالية:**\n1. غياب شرط التحكيم الصريح\n2. عدم وضوح آلية تسوية الخلافات\n3. إمكانية تفسير بعض الشروط بأكثر من طريقة\n\n**المخاطر المحتملة:**\n- مخاطرة متوسطة في بند الإنهاء المبكر\n- مخاطرة منخفضة في بنود الدفع\n\n**التوصيات:**\n- إضافة شرط التحكيم (المركز السعودي للتحكيم)\n- تحديد سعر الفائدة التأخيرية\n- تعزيز بند الإنهاء بتحديد المهل",
  },
  extract_risks: {
    label: "استخراج المخاطر",
    systemPrompt: "أنت محلل مخاطر قانونية. استخرج جميع المخاطر القانونية من النص المقدم وصنّفها (عالية/متوسطة/منخفضة) مع التوصيات. اكتب بالعربية.",
    fallback: "**تقرير المخاطر القانونية:**\n\n🔴 **مخاطر عالية:**\n- عدم الامتثال للاشتراطات النظامية\n- غياب التوثيق الرسمي لبعض الاتفاقيات\n\n🟡 **مخاطر متوسطة:**\n- تعارض محتمل مع نظام العمل\n- غموض في بعض الصلاحيات\n\n🟢 **مخاطر منخفضة:**\n- بنود روتينية قد تحتاج تحديثاً\n\n**درجة المخاطرة الإجمالية: 6/10**\n\n**التوصية:** معالجة المخاطر العالية فوراً.",
  },
  predict_outcome: {
    label: "التنبؤ بمآل القضية",
    systemPrompt: "أنت نظام تنبؤ قضائي ذكي. بناءً على وقائع القضية المقدمة، قدّر: احتمالية النجاح، احتمالية التسوية، المدة المتوقعة، التكلفة التقريبية. اكتب بالعربية مع أرقام واضحة.",
    fallback: "**تقرير التنبؤ القضائي:**\n\n📊 **الاحتمالات:**\n- احتمالية الحكم لصالحك: **62%**\n- احتمالية التسوية الودية: **28%**\n- احتمالية الخسارة: **10%**\n\n⏱️ **المدة المتوقعة:**\n- تسوية ودية: 1-2 أشهر\n- حكم ابتدائي: 6-12 شهراً\n- مع الاستئناف: 18-24 شهراً\n\n💰 **التكلفة التقريبية:**\n- أتعاب محاماة: 15,000-40,000 ريال\n- رسوم قضائية: 2,000-5,000 ريال\n\n**التوصية:** السعي للتسوية إذا كانت العروض المقدمة تتجاوز 70% من المطالبة.",
  },
  suggest_settlement: {
    label: "اقتراح تسوية",
    systemPrompt: "أنت متخصص في التفاوض وتسوية النزاعات قبل التقاضي. اقترح تسوية عادلة ومتوازنة تراعي مصالح الطرفين. اكتب بالعربية.",
    fallback: "**اقتراح التسوية:**\n\n**المبدأ الأساسي:** التسوية العادلة تعني تضحية الطرفين بشيء لكسب شيء أكبر (السلام وتوفير الوقت والمال).\n\n**الإطار المقترح:**\n1. دفع 75% من المبلغ المطالَب به فورياً\n2. التنازل المتبادل عن أي مطالبات مستقبلية\n3. توقيع اتفاقية إنهاء نزاع رسمية\n4. السرية الكاملة بشأن شروط التسوية\n\n**آلية التفاوض:**\n- تحديد موعد جلسة وساطة خلال أسبوعين\n- حضور طرفي النزاع مع مستشاريهم القانونيين\n- تفويض المفاوضين بصلاحية القبول",
  },
  draft_notice: {
    label: "صياغة إنذار",
    systemPrompt: "أنت متخصص في صياغة الإنذارات القانونية الرسمية. اكتب إنذاراً قانونياً محكماً بالعربية الفصحى وفق الأصول القانونية السعودية.",
    fallback: "**إنذار قانوني رسمي**\n\nإلى السيد/ [اسم المُنذَر] حفظه الله\n\nالسلام عليكم ورحمة الله وبركاته،\n\nيتشرف الأستاذ/ [اسم المحامي]، المحامي والمستشار القانوني، نيابةً عن موكله السيد/ [اسم الموكل]، بتوجيه هذا الإنذار القانوني، وذلك على النحو التالي:\n\n**سبب الإنذار:**\n[تُحدد سبب الإنذار هنا]\n\n**المطلوب منك:**\nالوفاء بالالتزام خلال (15) خمسة عشر يوماً من تاريخ تسلّم هذا الإنذار.\n\n**التنبيه:** في حالة عدم الاستجابة، سيتم اتخاذ كافة الإجراءات القانونية المقتضية.\n\nحرر في: ${new Date().toLocaleDateString('ar-SA')}\nالمحامي/ [الاسم والتوقيع]",
  },
  legal_opinion: {
    label: "رأي قانوني",
    systemPrompt: "أنت مستشار قانوني أول. أعطِ رأياً قانونياً مكتوباً واضحاً ومنظماً بالعربية بخصوص المسألة المطروحة، مستنداً للأنظمة السعودية.",
    fallback: "**الرأي القانوني:**\n\n**المسألة المطروحة:**\n[وصف المسألة]\n\n**الأساس القانوني:**\nاستناداً للأنظمة والأحكام ذات الصلة في المملكة العربية السعودية...\n\n**الرأي:**\nبعد دراسة الوقائع والمستندات المقدمة، يرى الفريق القانوني:\n\n1. أن الموقف القانوني للسائل يتسم بـ...\n2. الخيارات المتاحة هي:\n   - الخيار الأول: ...\n   - الخيار الثاني: ...\n\n**التوصية:**\nنوصي باتباع الخيار الأول لأنه...\n\n**ملاحظة:** هذا رأي قانوني استشاري ولا يُغني عن التمثيل القانوني.",
  },
};

async function callGemini(systemPrompt: string, input: string, maxTokens = 1500): Promise<string | null> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return null;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${input}` }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }
    );
    const d = await r.json() as any;
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch { return null; }
}

router.post("/command-center/execute", requireAuthWithTenant, requirePermission("ai:access"), async (req, res) => {
  const { command, input } = req.body as { command: CommandType; input: string };
  const config = COMMAND_CONFIGS[command];
  if (!config) return res.status(400).json({ error: "أمر غير معروف" });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  try {
    const geminiText = await callGemini(config.systemPrompt, input, 1500);
    if (geminiText) return res.json({ result: geminiText, command });

    if (ANTHROPIC_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1500, system: config.systemPrompt, messages: [{ role: "user", content: input }] }),
      });
      const d = await r.json() as any;
      if (d.content?.[0]?.text) return res.json({ result: d.content[0].text, command });
    } else if (OPENAI_KEY) {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1500, messages: [{ role: "system", content: config.systemPrompt }, { role: "user", content: input }] }),
      });
      const d = await r.json() as any;
      if (d.choices?.[0]?.message?.content) return res.json({ result: d.choices[0].message.content, command });
    }
  } catch {}

  res.json({ result: config.fallback, command });
});

router.get("/command-center/commands", requireAuthWithTenant, requirePermission("ai:access"), (_req, res) => {
  res.json(Object.entries(COMMAND_CONFIGS).map(([key, c]) => ({ key, label: c.label })));
});

export default router;
