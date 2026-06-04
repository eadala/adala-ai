import { Router } from "express";

const router = Router();

const CASE_TYPE_CONTEXTS: Record<string, string> = {
  civil: "القضية مدنية — عقود ومسؤولية تقصيرية. المرجع: نظام المعاملات المدنية السعودي 1444هـ.",
  commercial: "القضية تجارية — شركات وعقود تجارية. المرجع: نظام الشركات 1443هـ ونظام الإفلاس.",
  labor: "القضية عمالية — نزاعات العمل. المرجع: نظام العمل السعودي ولوائح وزارة الموارد البشرية.",
  family: "القضية أسرية — طلاق ونفقة وحضانة. المرجع: نظام الأحوال الشخصية 1443هـ.",
  real_estate: "القضية عقارية — ملكية وإيجار وحدود. المرجع: نظام الأراضي ونظام الإيجار.",
  criminal: "القضية جنائية — دفاع وادعاء. المرجع: نظام الإجراءات الجزائية ونظام العقوبات التعزيرية.",
};

const JUDGE_STYLE_DESC: Record<string, string> = {
  strict: "القاضي صارم جداً، دقيق في الشكليات، يقاطع عند الانحراف عن المسار، يطلب الدليل على كل تفصيل.",
  balanced: "القاضي متوازن، يستمع بإنصاف لكلا الطرفين، يطرح أسئلة لتوضيح الغموض، منفتح على الحجج.",
  fast: "القاضي يريد السرعة والإيجاز، لا يتحمل التكرار والاسترسال، يقاطع ويطلب الاختصار.",
  technical: "القاضي متخصص تقني، يتعمق في النصوص النظامية واللوائح، يطلب المراجع الدقيقة والمواد القانونية.",
};

async function callAI(prompt: string): Promise<string> {
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
        max_tokens: 4096,
        system: "أنت مساعد قانوني متخصص في القانون السعودي. تجيب دائماً بالعربية الفصحى. أجوبتك دقيقة واحترافية ومفيدة للمحامين.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json() as any;
    if (data.content?.[0]?.text) return data.content[0].text;
  }

  if (OPENAI_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 4096,
        messages: [
          { role: "system", content: "أنت مساعد قانوني متخصص في القانون السعودي. تجيب دائماً بالعربية الفصحى." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await res.json() as any;
    if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  }

  return generateFallback();
}

function generateFallback(): string {
  return JSON.stringify({
    readinessScore: 72,
    openingStatement: "سعادة القاضي، هذه القضية تتعلق بحق موكلي المكفول نظاماً. سنُثبت من خلال الأدلة والحجج القانونية أن موكلي على حق وأن الطرف الآخر قد أخل بالتزاماته.",
    questions: [
      { category: "أدلة", question: "ما الدليل المادي الذي تستند إليه في إثبات وقائع الدعوى؟", suggestedAnswer: "نستند إلى العقد الموقع بتاريخ... والمراسلات الرسمية المرفقة كمستندات الدعوى.", legalRef: "المادة 1 من نظام الإثبات", strategy: "قدّم المستندات مرتبة زمنياً وأشر إلى كل واحدة برقمها في ملف القضية.", difficulty: "high" },
      { category: "أدلة", question: "هل لديك شهود يمكنهم تأكيد روايتك؟", suggestedAnswer: "نعم، لدينا شهود على واقعة... وقد أُدرجت أسماؤهم في قائمة الشهود المرفقة.", legalRef: "نظام الإثبات", strategy: "أكّد جاهزية الشهود وتوافرهم.", difficulty: "medium" },
      { category: "إجراءات", question: "هل اتُّخذت الإجراءات القانونية المطلوبة قبل رفع الدعوى؟", suggestedAnswer: "نعم، أُرسل إنذار رسمي موثق لدى الكاتب العدل بتاريخ... ومضت المدة النظامية دون استجابة.", legalRef: "المادة 70 من نظام المرافعات الشرعية", strategy: "قدّم نسخة الإنذار الرسمي دليلاً على استيفاء الإجراءات.", difficulty: "medium" },
      { category: "إجراءات", question: "لماذا لم يُسوَّ النزاع عبر التسوية الودية قبل اللجوء للقضاء؟", suggestedAnswer: "جرت محاولات مضنية للتسوية تشهد عليها المراسلات، إلا أن الطرف الآخر رفض الحلول المقدمة.", legalRef: "نظام المحكمة التجارية", strategy: "وثّق محاولات التسوية ببريد إلكتروني أو رسائل رسمية.", difficulty: "low" },
      { category: "موضوعية", question: "ما هو الأساس القانوني الصريح لطلبك؟", suggestedAnswer: "يستند طلبنا إلى المادة... التي تنص صراحةً على...", legalRef: "النص النظامي ذو الصلة", strategy: "احفظ المادة عن ظهر قلب واستشهد بها بثقة.", difficulty: "high" },
      { category: "موضوعية", question: "كيف تحدد قيمة الضرر المطالب به؟", suggestedAnswer: "الضرر محسوب وفق التقرير المالي المرفق الصادر من جهة معتمدة بتاريخ...", legalRef: "مبادئ تقدير الضرر في النظام السعودي", strategy: "ارفق تقريراً مالياً معتمداً أو رأي خبير.", difficulty: "high" },
      { category: "شهود", question: "ما علاقة الشاهد بالأطراف وهل يُحتمل تحيزه؟", suggestedAnswer: "الشاهد علاقته بالقضية محايدة تماماً، إذ كان طرفاً ثالثاً في الواقعة دون مصلحة لأيٍّ من الطرفين.", legalRef: "شروط الشهادة في الفقه والنظام", strategy: "أكّد استقلالية الشاهد وأن شهادته وقائعية لا رأيية.", difficulty: "medium" },
      { category: "شهود", question: "لماذا لم يُسمَع هؤلاء الشهود في مرحلة التحقيق؟", suggestedAnswer: "تعذّر الوصول إليهم في مرحلة التحقيق لأسباب خارجة عن إرادتنا، وقد أُبلغت المحكمة بذلك.", legalRef: "إجراءات سماع الشهود", strategy: "وثّق محاولات الحضور وسبب التأخر.", difficulty: "medium" },
      { category: "تعويضات", question: "هل التعويض المطلوب يتناسب مع الضرر الفعلي؟", suggestedAnswer: "التعويض محسوب بدقة ويعادل الضرر المادي والمعنوي الموثق، لا يزيد ولا ينقص عن الحق.", legalRef: "مبدأ التناسب في التعويض", strategy: "قسّم التعويض إلى بنود واضحة: مادي، فرصة ضائعة، معنوي.", difficulty: "high" },
      { category: "تعويضات", question: "هل هناك تعويض بديل تقبله كحل وسط؟", suggestedAnswer: "موكلي يسعى للحصول على حقه كاملاً، غير أنه منفتح على أي مقترح يحقق العدالة الكاملة.", legalRef: "مبدأ التسوية القضائية", strategy: "لا تُبدِ مرونة قبل استشارة موكلك في الجلسة.", difficulty: "low" },
      { category: "أدلة", question: "هل المستندات المقدمة مصادق عليها رسمياً؟", suggestedAnswer: "جميع المستندات موثقة ومصادق عليها وفق الإجراءات النظامية المعتمدة.", legalRef: "اشتراطات توثيق المستندات", strategy: "تحقق من ختم وتاريخ كل مستند قبل الجلسة.", difficulty: "high" },
      { category: "إجراءات", question: "هل انتهت مدة التقادم للمطالبة بهذا الحق؟", suggestedAnswer: "الدعوى مرفوعة ضمن المدد النظامية المحددة، ومدة التقادم لم تنقضِ.", legalRef: "أحكام التقادم في النظام السعودي", strategy: "احسب المدة بدقة ووثّقها في مستندات الدعوى.", difficulty: "high" },
    ],
    criticalTips: [
      "راجع جميع المستندات ليلة الجلسة وتأكد من ترتيبها برقم كل مستند",
      "احفظ أرقام المواد النظامية التي ستستشهد بها",
      "لا تُجادل القاضي إذا قاطعك — استمع، ثم أكمل بهدوء",
      "إذا لم تعرف الجواب قل: سعادة القاضي، سأتحقق وأُجيب المحكمة بعد الجلسة",
      "الحجة القصيرة الواضحة أقوى من الخطاب المطوّل",
    ],
    requiredDocuments: [
      "العقد الأصلي أو الوثيقة موضع النزاع",
      "الإنذار الرسمي وإثبات الإرسال",
      "المراسلات بين الطرفين",
      "التقرير المالي أو تقرير الخبير",
      "سجلات الشهود وبياناتهم",
      "وكالة المحامي النظامية",
    ],
  });
}

router.post("/judge-prep/generate", async (req, res) => {
  const { caseType, factsummary, judgeStyle, strengths, weaknesses, previousNotes } = req.body;

  const caseContext = CASE_TYPE_CONTEXTS[caseType] || CASE_TYPE_CONTEXTS.civil;
  const judgeDesc = JUDGE_STYLE_DESC[judgeStyle] || JUDGE_STYLE_DESC.balanced;

  const prompt = `أنت خبير قانوني متخصص في القانون السعودي ومدرّب على أساليب القضاء.

سياق القضية:
- النوع: ${caseContext}
- ملخص الوقائع: ${factsummary}
- أسلوب القاضي: ${judgeDesc}
- نقاط القوة: ${strengths || "لم تُحدد"}
- نقاط الضعف: ${weaknesses || "لم تُحدد"}
- ملاحظات جلسات سابقة: ${previousNotes || "لا يوجد"}

المطلوب: أنشئ تقرير استعداد شامل للجلسة بصيغة JSON صحيحة بالضبط كما يلي (لا تضف أي نص خارج JSON):

{
  "readinessScore": رقم من 0 إلى 100 يعكس مستوى الاستعداد بناء على المعطيات,
  "openingStatement": "جملة افتتاحية احترافية أمام القاضي (3-4 جمل)",
  "questions": [
    {
      "category": "أدلة" أو "إجراءات" أو "موضوعية" أو "شهود" أو "تعويضات",
      "question": "السؤال المحتمل من القاضي",
      "suggestedAnswer": "الإجابة المقترحة للمحامي",
      "legalRef": "المادة أو النص النظامي المرجعي",
      "strategy": "نصيحة استراتيجية مختصرة",
      "difficulty": "high" أو "medium" أو "low"
    }
  ],
  "criticalTips": ["نصيحة حرجة 1", "نصيحة حرجة 2", ...حتى 6 نصائح],
  "requiredDocuments": ["مستند 1", "مستند 2", ...حتى 8 مستندات]
}

اجعل الأسئلة 12 سؤالاً موزعة: 3 أدلة + 2 إجراءات + 3 موضوعية + 2 شهود + 2 تعويضات.
اجعل الأسئلة متعلقة تحديداً بوقائع القضية المذكورة وأسلوب هذا القاضي.`;

  try {
    const rawText = await callAI(prompt);
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.json(JSON.parse(generateFallback()));
    }
    const result = JSON.parse(jsonMatch[0]);
    res.json(result);
  } catch (err) {
    res.json(JSON.parse(generateFallback()));
  }
});

export default router;
