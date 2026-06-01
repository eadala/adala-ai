import { Router } from "express";

const router = Router();

const DIFFICULTY_PROMPTS: Record<string, string> = {
  beginner: "أنت محامٍ خصم مبتدئ. حججك بسيطة ومباشرة. أسلوبك هادئ ومتعاون نسبياً.",
  intermediate: "أنت محامٍ خصم ذو خبرة متوسطة. حججك منطقية ومدعومة بمراجع نظامية. أسلوبك مهني وصارم.",
  expert: "أنت محامٍ خصم خبير محترف. حججك متقدمة ومحكمة. تستشهد بنصوص نظامية دقيقة وسوابق قضائية. أسلوبك ضاغط ولا تترك ثغرة دون استغلال.",
};

const CASE_TYPE_CONTEXTS: Record<string, string> = {
  civil: "القضية مدنية (عقود، مسؤولية تقصيرية، أضرار). المرجع: نظام المعاملات المدنية السعودي 1444هـ.",
  criminal: "القضية جنائية. المرجع: نظام الإجراءات الجزائية ونظام العقوبات التعزيرية.",
  commercial: "القضية تجارية (شركات، عقود تجارية، إفلاس). المرجع: نظام الشركات 1443هـ ونظام الإفلاس.",
  family: "القضية أسرية (طلاق، نفقة، حضانة، ميراث). المرجع: نظام الأحوال الشخصية 1443هـ.",
  labor: "القضية عمالية. المرجع: نظام العمل السعودي ولوائح وزارة الموارد البشرية.",
  real_estate: "القضية عقارية (ملكية، إيجار، حدود). المرجع: نظام الأراضي ونظام الإيجار.",
};

async function callAI(systemPrompt: string, messages: { role: string; content: string }[]): Promise<string> {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  if (ANTHROPIC_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role === "opponent" ? "assistant" : "user", content: m.content })),
      }),
    });
    const data = await res.json() as any;
    return data.content?.[0]?.text ?? generateOpponentResponse(messages);
  }

  if (OPENAI_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map(m => ({ role: m.role === "opponent" ? "assistant" : "user", content: m.content })),
        ],
      }),
    });
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content ?? generateOpponentResponse(messages);
  }

  return generateOpponentResponse(messages);
}

function generateOpponentResponse(messages: { role: string; content: string }[]): string {
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
  const round = messages.filter(m => m.role === "opponent").length + 1;

  const openings = [
    "**اعتراض!** ما ذكرته يفتقر إلى الأساس القانوني السليم.",
    "**مع احترامي للزميل**، هذه الحجة لا تصمد أمام النصوص النظامية.",
    "**أتحدى هذا الطرح** — دعنا نتأمل ما تقوله من الجانب القانوني الصحيح.",
  ];

  const counters = [
    `\n\n**الرد القانوني:**\nأولاً: ما استند إليه الزميل مجرد تفسير فضفاض لا يستند إلى نص صريح. المادة ذات الصلة واضحة في أن الإثبات يقع على عاتق المدعي وفق مبدأ "البينة على من ادعى".\n\nثانياً: لم يُقدَّم أي دليل مادي يدعم هذا الادعاء. الوقائع وحدها لا تكفي — المحكمة تحتاج إلى مستندات رسمية موثقة.\n\nثالثاً: التوقيت يُثير الشك — هذه الادعاءات جاءت متأخرة ومتعارضة مع ما وُثِّق سابقاً.`,
    `\n\n**الحجة المضادة:**\nالزميل يتجاهل مبدأً جوهرياً — عبء الإثبات. لا يكفي مجرد الادعاء، بل يجب أن يُثبت كل ركن من أركان الدعوى بشكل مستقل.\n\nعلاوة على ذلك، ما أُشير إليه من وقائع يمكن تفسيره بأكثر من طريقة، والتفسير الأوفق بالمنطق القانوني يصبّ في مصلحة موكلي.\n\nكما أن الضرر المزعوم — إن وُجد أصلاً — ليس من الجسامة التي تستوجب ما يُطالب به.`,
    `\n\n**الموقف القانوني:**\nنعود إلى الأساس: العقد/الواقعة موضع النزاع يجب أن يُنظر إليه في ضوء النية والملابسات كاملة، لا انتزاع جزء منه.\n\nأما الحجج المُقدَّمة فتقوم على فرضيات لم تُثبَت. الحكمة تقتضي أن تُؤسَّس الدعاوى على حقائق راسخة لا تخمينات.\n\nختاماً، الوقت لصالحنا — كل يوم تمتد فيه هذه المرافعة يُضعف الموقف المقابل.`,
  ];

  const opening = openings[round % openings.length];
  const counter = counters[round % counters.length];

  return `${opening}${counter}`;
}

async function generateEvaluation(
  caseDesc: string,
  side: string,
  caseType: string,
  messages: { role: string; content: string }[]
): Promise<{
  overallScore: number;
  argumentStrength: number;
  legalAccuracy: number;
  persuasiveness: number;
  weakPoints: string[];
  strongPoints: string[];
  recommendation: string;
  verdict: string;
}> {
  const userMessages = messages.filter(m => m.role === "user").map(m => m.content).join("\n---\n");

  const systemPrompt = `أنت قاضٍ قانوني خبير ومحايد متخصص في القانون السعودي. مهمتك تقييم أداء المحامي في جلسة محاكمة تدريبية.`;

  const prompt = `القضية: ${caseDesc}
الجانب: ${side === "plaintiff" ? "المدعي" : "المدعى عليه"}
النوع: ${caseType}

حجج المحامي المُقيَّم:
${userMessages}

قيّم الأداء وأعط نتيجة JSON بالشكل التالي بالضبط (أرقام من 0-100):
{
  "overallScore": 75,
  "argumentStrength": 70,
  "legalAccuracy": 80,
  "persuasiveness": 75,
  "weakPoints": ["نقطة ضعف 1", "نقطة ضعف 2"],
  "strongPoints": ["نقطة قوة 1", "نقطة قوة 2"],
  "recommendation": "توصية تفصيلية للتحسين",
  "verdict": "تقدير عام للأداء في جملة واحدة"
}
أجب بـ JSON فقط بدون أي نص إضافي.`;

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  try {
    let raw = "";

    if (ANTHROPIC_KEY) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1024, system: systemPrompt, messages: [{ role: "user", content: prompt }] }),
      });
      const d = await res.json() as any;
      raw = d.content?.[0]?.text ?? "";
    } else if (OPENAI_KEY) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 1024, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }] }),
      });
      const d = await res.json() as any;
      raw = d.choices?.[0]?.message?.content ?? "";
    }

    if (raw) {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    }
  } catch {}

  const msgCount = messages.filter(m => m.role === "user").length;
  const base = Math.min(85, 50 + msgCount * 7);
  return {
    overallScore: base,
    argumentStrength: base - 5,
    legalAccuracy: base + 5,
    persuasiveness: base - 10,
    weakPoints: [
      "بعض الحجج افتقرت إلى مراجع نظامية محددة",
      "لم يُعالَج كل اعتراض من الخصم بشكل كافٍ",
    ],
    strongPoints: [
      "تسلسل منطقي واضح في عرض الوقائع",
      "إدراك جيد لجوهر القضية",
    ],
    recommendation: "ركّز على الاستشهاد بنصوص النظام بدقة، وتوقّع اعتراضات الخصم مسبقاً لتجهيز ردود واثقة. تدرّب على الاقتضاب — القاضي يفضّل الحجة الموجزة المحكمة.",
    verdict: `أداء ${base >= 75 ? "جيد" : "متوسط"} يعكس فهماً ${base >= 75 ? "واضحاً" : "أولياً"} للقضية مع مساحة للتطوير.`,
  };
}

router.post("/opponent-simulator/respond", async (req, res) => {
  const { caseDescription, side, caseType, difficulty, history, userMessage } = req.body as {
    caseDescription: string;
    side: "plaintiff" | "defendant";
    caseType: string;
    difficulty: string;
    history: { role: string; content: string }[];
    userMessage: string;
  };

  if (!userMessage) return res.status(400).json({ error: "الحجة مطلوبة" });

  const sideContext = side === "plaintiff"
    ? "أنت تمثّل المدعى عليه وتواجه المدعي."
    : "أنت تمثّل المدعي وتواجه المدعى عليه.";

  const systemPrompt = `${DIFFICULTY_PROMPTS[difficulty] ?? DIFFICULTY_PROMPTS.intermediate}

${CASE_TYPE_CONTEXTS[caseType] ?? ""}

${sideContext}

ملخص القضية: ${caseDescription}

قواعد المحاكاة:
- ردّ دائماً بالعربية الفصحى القانونية
- اعترض على الحجج الضعيفة واستغل الثغرات
- استشهد بمبادئ قانونية ونظامية حين أمكن
- حافظ على دور المحامي الخصم طوال الجلسة
- ردودك مختصرة ومُركَّزة (150-300 كلمة)
- لا تُقدِّم مساعدة للطرف الآخر، بل ناظره وجادله`;

  const messages = [...history, { role: "user", content: userMessage }];

  const response = await callAI(systemPrompt, messages);
  res.json({ response, round: messages.filter(m => m.role === "user").length });
});

router.post("/opponent-simulator/evaluate", async (req, res) => {
  const { caseDescription, side, caseType, history } = req.body as {
    caseDescription: string;
    side: string;
    caseType: string;
    history: { role: string; content: string }[];
  };

  if (!history.length) return res.status(400).json({ error: "لا توجد حجج للتقييم" });

  const evaluation = await generateEvaluation(caseDescription, side, caseType, history);
  res.json(evaluation);
});

export default router;
