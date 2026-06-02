import { Router } from "express";

const router = Router();

const LEGAL_LIBRARY: Record<string, { title: string; category: string; summary: string; content: string; ref: string }[]> = {
  civil: [
    { title: "نظام المعاملات المدنية", category: "أنظمة", ref: "مرسوم ملكي م/191 لعام 1444هـ", summary: "ينظم العقود المدنية والمسؤولية التقصيرية والالتزامات في المملكة العربية السعودية", content: "يُعدّ نظام المعاملات المدنية الركيزة الأساسية لتنظيم العلاقات المدنية. يتضمن أحكام العقود، المسؤولية التقصيرية، الحقوق العينية، والإثبات." },
    { title: "نظام الإجراءات المدنية", category: "أنظمة", ref: "مرسوم ملكي م/1 لعام 1435هـ", summary: "يُنظّم إجراءات التقاضي أمام المحاكم المدنية", content: "يحدد النظام قواعد رفع الدعاوى، الاختصاص القضائي، مراحل التقاضي، وتنفيذ الأحكام." },
  ],
  commercial: [
    { title: "نظام الشركات", category: "أنظمة", ref: "مرسوم ملكي م/132 لعام 1443هـ", summary: "ينظم تأسيس الشركات وإدارتها والتزاماتها في المملكة", content: "يشمل أحكام شركات المساهمة، المسؤولية المحدودة، التوصية، والشركات متعددة الأشكال." },
    { title: "نظام التجارة الإلكترونية", category: "لوائح", ref: "مرسوم ملكي م/126 لعام 1442هـ", summary: "ينظم المعاملات التجارية الإلكترونية وحماية المستهلك الرقمي", content: "يُلزم مزودي الخدمات الإلكترونية بالشفافية والإفصاح ويحمي حقوق المستهلك." },
  ],
  labor: [
    { title: "نظام العمل السعودي", category: "أنظمة", ref: "مرسوم ملكي م/51 لعام 1426هـ وتعديلاته", summary: "يُنظّم علاقة العمل بين أصحاب العمل والعمال في القطاع الخاص", content: "يشمل عقود العمل، الأجور، ساعات العمل، الإجازات، التأديب، وإنهاء الخدمة ومكافأتها." },
    { title: "لائحة حماية الأجور", category: "لوائح", ref: "وزارة الموارد البشرية 1430هـ", summary: "تُلزم أصحاب العمل بصرف الأجور إلكترونياً في مواعيدها", content: "يُعد مخالفة اللائحة سبباً لتعليق الخدمات الحكومية وفرض غرامات." },
  ],
  family: [
    { title: "نظام الأحوال الشخصية", category: "أنظمة", ref: "مرسوم ملكي م/73 لعام 1443هـ", summary: "ينظم أحكام الزواج والطلاق والنفقة والحضانة والميراث", content: "يُقنّن أحكام الفقه الإسلامي في شؤون الأسرة ويوحّد الإجراءات القضائية." },
    { title: "نظام الولاية على النفس", category: "أنظمة", ref: "مرسوم ملكي م/38 لعام 1443هـ", summary: "يُنظّم أحكام الولاية وتمكين المرأة", content: "يُحدد شروط الولاية وحالاتها ويُعزز استقلالية المرأة في القرارات الشخصية." },
  ],
  real_estate: [
    { title: "نظام الملكية العقارية", category: "أنظمة", ref: "مرسوم ملكي م/6 لعام 1423هـ", summary: "يُنظّم تسجيل الأراضي ونقل الملكية وحل النزاعات العقارية", content: "يُلزم بتسجيل الصكوك رسمياً ويحدد إجراءات نقل الملكية ورسومها." },
    { title: "نظام الإيجار التمويلي", category: "أنظمة", ref: "مرسوم ملكي م/48 لعام 1433هـ", summary: "يُنظّم عقود الإيجار التمويلي بين الممولين والمستفيدين", content: "يُحدد شروط الإيجار التمويلي وضمانات حقوق الطرفين." },
  ],
  criminal: [
    { title: "نظام الإجراءات الجزائية", category: "أنظمة", ref: "مرسوم ملكي م/39 لعام 1422هـ", summary: "يُنظّم إجراءات التحقيق والمحاكمة الجزائية", content: "يشمل حقوق المتهم، إجراءات القبض، التحقيق، المحاكمة، والطعن في الأحكام." },
    { title: "نظام مكافحة الجرائم المعلوماتية", category: "أنظمة", ref: "مرسوم ملكي م/17 لعام 1428هـ", summary: "يُجرّم الجرائم المرتكبة عبر الأنظمة المعلوماتية", content: "يشمل جرائم القرصنة والتشهير والتزوير الإلكتروني وعقوباتها." },
  ],
  compliance: [
    { title: "نظام حماية البيانات الشخصية (PDPL)", category: "أنظمة", ref: "مرسوم ملكي م/19 لعام 1443هـ", summary: "يُنظّم جمع البيانات الشخصية ومعالجتها وحفظها", content: "يُلزم الجهات بالحصول على موافقة صريحة لجمع البيانات ويُعاقب على المخالفات." },
    { title: "نظام مكافحة غسل الأموال", category: "أنظمة", ref: "مرسوم ملكي م/20 لعام 1439هـ", summary: "يُجرّم غسل الأموال ويلزم الجهات ببرامج AML/KYC", content: "يُلزم المؤسسات المالية بالإبلاغ عن المعاملات المشبوهة والتحقق من هوية العملاء." },
  ],
};

async function semanticSearch(query: string, category: string): Promise<{ results: any[]; summary: string }> {
  const all = Object.values(LEGAL_LIBRARY).flat();
  const filtered = category !== "all"
    ? Object.entries(LEGAL_LIBRARY).filter(([k]) => k === category).flatMap(([, v]) => v)
    : all;

  const queryLower = query.toLowerCase();
  const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);

  const scored = filtered.map(item => {
    let score = 0;
    const text = `${item.title} ${item.summary} ${item.content}`.toLowerCase();
    keywords.forEach(kw => { if (text.includes(kw)) score += 3; });
    if (item.title.toLowerCase().includes(queryLower)) score += 10;
    if (item.summary.toLowerCase().includes(queryLower)) score += 5;
    return { ...item, score };
  }).filter(i => i.score > 0).sort((a, b) => b.score - a.score);

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const OPENAI_KEY = process.env.OPENAI_API_KEY;

  let summary = "";
  if ((ANTHROPIC_KEY || OPENAI_KEY) && scored.length > 0) {
    const context = scored.slice(0, 3).map(r => `${r.title}: ${r.summary}`).join("\n");
    const prompt = `بناءً على هذه الأنظمة القانونية:\n${context}\n\nأجب على السؤال التالي بإيجاز (3-4 جمل بالعربية): ${query}`;
    try {
      if (ANTHROPIC_KEY) {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 512, messages: [{ role: "user", content: prompt }] }),
        });
        const d = await r.json() as any;
        summary = d.content?.[0]?.text ?? "";
      } else if (OPENAI_KEY) {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 512, messages: [{ role: "user", content: prompt }] }),
        });
        const d = await r.json() as any;
        summary = d.choices?.[0]?.message?.content ?? "";
      }
    } catch {}
  }

  if (!summary && scored.length > 0) {
    summary = `بخصوص "${query}": ${scored[0].summary}. وفق ${scored[0].ref}.`;
  }

  return { results: scored.slice(0, 6), summary };
}

router.post("/legal-research/search", async (req, res) => {
  const { query, category = "all" } = req.body;
  if (!query) return res.status(400).json({ error: "استعلام البحث مطلوب" });
  const data = await semanticSearch(query, category);
  res.json(data);
});

router.get("/legal-research/categories", (_req, res) => {
  res.json([
    { key: "all", label: "الكل" },
    { key: "civil", label: "المدني" },
    { key: "commercial", label: "التجاري" },
    { key: "labor", label: "العمالي" },
    { key: "family", label: "الأسري" },
    { key: "real_estate", label: "العقاري" },
    { key: "criminal", label: "الجنائي" },
    { key: "compliance", label: "الامتثال" },
  ]);
});

router.get("/legal-research/featured", (_req, res) => {
  const featured = [
    { ...LEGAL_LIBRARY.civil[0], category_key: "civil" },
    { ...LEGAL_LIBRARY.labor[0], category_key: "labor" },
    { ...LEGAL_LIBRARY.commercial[0], category_key: "commercial" },
    { ...LEGAL_LIBRARY.family[0], category_key: "family" },
    { ...LEGAL_LIBRARY.compliance[0], category_key: "compliance" },
    { ...LEGAL_LIBRARY.criminal[0], category_key: "criminal" },
  ];
  res.json(featured);
});

export default router;
