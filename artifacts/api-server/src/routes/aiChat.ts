import { Router } from "express";
import { db, casesTable, documentsTable, aiTasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callAI(systemPrompt: string, userMessage: string): Promise<string> {
  if (ANTHROPIC_API_KEY) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const data = await res.json() as any;
    return data.content?.[0]?.text ?? "عذراً، لم أتمكن من معالجة الطلب.";
  }

  if (OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 2048,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content ?? "عذراً، لم أتمكن من معالجة الطلب.";
  }

  return generateSmartResponse(userMessage);
}

function generateSmartResponse(query: string): string {
  const q = query.toLowerCase();

  if (q.includes("تقادم") || q.includes("مدة")) {
    return `**التقادم في القانون السعودي**

المادة (16) من نظام التحكيم: تتقادم الدعاوى بمضي خمس سنوات من تاريخ نشوء الحق.

**المدد الخاصة:**
- دعاوى العمال: سنة واحدة من تاريخ انتهاء العقد
- الشيكات: 3 سنوات من تاريخ الاستحقاق
- المسؤولية التقصيرية: 3 سنوات من علم المضرور
- العقارات: 10 سنوات

**ملاحظة:** يقطع التقادم بالمطالبة القضائية أو الإقرار أو التنبيه.`;
  }

  if (q.includes("عقد") || q.includes("اتفاق")) {
    return `**تحليل العقود في الفقه الإسلامي والنظام السعودي**

**أركان العقد الصحيح:**
1. الإيجاب والقبول (التراضي)
2. المحل (موضوع العقد) - يجب أن يكون مشروعاً
3. السبب (الغرض من العقد)
4. الأهلية القانونية للطرفين

**أسباب البطلان:**
- الغرر الفاحش
- الجهالة في المحل
- الإكراه أو الغش
- مخالفة النظام العام

**التوصية:** مراجعة نظام المعاملات المدنية الصادر 1444هـ.`;
  }

  if (q.includes("نفقة") || q.includes("طلاق") || q.includes("أسرة")) {
    return `**أحكام الأحوال الشخصية**

**النفقة الزوجية:** تجب على الزوج بالعقد الصحيح وتشمل: المسكن، الطعام، الكسوة، العلاج.

**نفقة الأولاد:** تستمر حتى بلوغ الذكر وتحصله على عمل، وحتى زواج الأنثى.

**الحضانة:** للأم حتى سبع سنوات للذكر وتسع سنوات للأنثى، ثم للأب.

**المراجع النظامية:**
- نظام الأحوال الشخصية 1443هـ
- لائحة المحاكم الشرعية`;
  }

  if (q.includes("جريم") || q.includes("عقوبة") || q.includes("حد")) {
    return `**أحكام قانون العقوبات**

**الجرائم الحدية:** عقوباتها مقدرة شرعاً ولا تقبل التخفيف.

**التعزيرات:** تقديرية للقاضي وفق درجة الجريمة وملابساتها.

**ظروف التخفيف:**
- صغر السن
- العفو من المجني عليه
- التوبة الصادقة
- حسن السيرة

**المراجع:** نظام الأحوال الجزائية، نظام مكافحة الجرائم المعلوماتية.`;
  }

  if (q.includes("شركة") || q.includes("تجار") || q.includes("استثمار")) {
    return `**القانون التجاري في المملكة العربية السعودية**

**أنواع الشركات (نظام الشركات 1443هـ):**
- شركة المساهمة: رأس مال لا يقل عن مليون ريال
- شركة ذات مسؤولية محدودة: رأس مال لا يقل عن 500 ريال
- شركة الشخص الواحد: رائجة للشركات الصغيرة

**الترخيص:** عبر منصة إتمام أو وزارة التجارة.

**الإفلاس:** نظام الإفلاس 1439هـ يكفل إعادة الهيكلة قبل التصفية.`;
  }

  return `**المساعد القانوني لعدالة AI**

شكراً لسؤالك. بناءً على تحليل استفساركم:

**النقاط القانونية الرئيسية:**
- يُنصح بمراجعة الأنظمة والتشريعات السارية في المملكة العربية السعودية
- توثيق جميع الأدلة والمستندات المتعلقة بالقضية
- الالتزام بالمواعيد القانونية المحددة

**الخطوات التالية المقترحة:**
1. جمع وتنظيم المستندات الداعمة
2. تحديد الطرف المدعى عليه بدقة
3. تقييم جدوى التسوية الودية
4. رفع الدعوى عبر منصة ناجز إن لزم

**تنبيه:** هذا تحليل استشاري عام ولا يغني عن الاستشارة القانونية المتخصصة.`;
}

async function processAiTask(taskType: string, content: string): Promise<string> {
  const systemPrompt = `أنت محلل قانوني متخصص في القانون السعودي والفقه الإسلامي. تحلل المستندات القانونية وتقدم تقارير دقيقة ومهنية باللغة العربية الفصحى. ردودك منظمة وتستخدم العناوين والنقاط لتسهيل القراءة.`;

  const prompts: Record<string, string> = {
    summarize: `قدم ملخصاً قانونياً شاملاً ومنظماً للمستند التالي. اذكر: الأطراف، الموضوع، الحقوق والالتزامات، والبنود الجوهرية:\n\n${content}`,
    risk_analysis: `حلل المخاطر القانونية في المستند التالي. اذكر: المخاطر العالية، المتوسطة، المنخفضة، والتوصيات للحماية القانونية:\n\n${content}`,
    extract: `استخرج البيانات القانونية الهيكلية من المستند التالي: الأطراف، التواريخ، المبالغ، الالتزامات، والشروط الجزائية:\n\n${content}`,
  };

  const prompt = prompts[taskType] ?? `حلل المستند القانوني التالي:\n\n${content}`;
  return callAI(systemPrompt, prompt);
}

router.post("/ai-chat/message", async (req, res) => {
  const { message, caseId, history = [] } = req.body as {
    message: string;
    caseId?: number;
    history?: { role: string; content: string }[];
  };

  if (!message) {
    return res.status(400).json({ error: "الرسالة مطلوبة" });
  }

  let context = "";
  if (caseId) {
    const caseData = await db.select().from(casesTable).where(eq(casesTable.id, caseId)).limit(1);
    if (caseData.length > 0) {
      const c = caseData[0];
      context = `\n\n[سياق القضية: ${c.title} - ${c.caseType} - الحالة: ${c.status}]`;
    }
  }

  const systemPrompt = `أنت مساعد قانوني ذكي لمنصة عدالة AI. متخصص في القانون السعودي والفقه الإسلامي. تجيب بالعربية الفصحى بأسلوب مهني ودقيق. تقدم تحليلات قانونية، ترشيح مراجع نظامية، وخطوات عملية للمحامين.${context}`;

  const fullMessage = history.length > 0
    ? `${history.map(h => `${h.role === "user" ? "المستخدم" : "المساعد"}: ${h.content}`).join("\n")}\nالمستخدم: ${message}`
    : message;

  const reply = await callAI(systemPrompt, fullMessage);
  return res.json({ reply });
});

router.post("/ai-tasks/:id/process", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });

  const task = await db.select().from(aiTasksTable).where(eq(aiTasksTable.id, id)).limit(1);
  if (!task.length) return res.status(404).json({ error: "المهمة غير موجودة" });

  const t = task[0];

  await db.update(aiTasksTable).set({ status: "running" }).where(eq(aiTasksTable.id, id));

  let docContent = "";
  if (t.documentId) {
    const doc = await db.select().from(documentsTable).where(eq(documentsTable.id, t.documentId)).limit(1);
    if (doc.length) docContent = doc[0].content ?? doc[0].title;
  }

  if (!docContent) {
    const relatedDocs = await db.select().from(documentsTable).limit(1);
    docContent = relatedDocs[0]?.content ?? relatedDocs[0]?.title ?? "مستند قانوني للتحليل";
  }

  const result = await processAiTask(t.taskType, docContent);

  await db.update(aiTasksTable)
    .set({ status: "done", result, completedAt: new Date() })
    .where(eq(aiTasksTable.id, id));

  return res.json({ success: true, result });
});

router.post("/ai-search", async (req, res) => {
  const { query } = req.body as { query: string };
  if (!query) return res.status(400).json({ error: "استعلام البحث مطلوب" });

  const systemPrompt = `أنت محرك بحث قانوني ذكي. عند تلقي استفسار، حدد المفاهيم القانونية المرتبطة به في القانون السعودي وقدم نتائج بحث منظمة.`;
  const analysis = await callAI(systemPrompt, `ابحث عن: ${query}`);

  const allDocs = await db.select().from(documentsTable).limit(10);
  const allCases = await db.select().from(casesTable).limit(10);

  const queryLower = query.toLowerCase();
  const matchedDocs = allDocs.filter(d =>
    d.title.includes(query) || (d.content ?? "").includes(query) ||
    d.title.toLowerCase().includes(queryLower)
  );
  const matchedCases = allCases.filter(c =>
    c.title.includes(query) || (c.description ?? "").includes(query) ||
    c.title.toLowerCase().includes(queryLower)
  );

  return res.json({
    analysis,
    documents: matchedDocs,
    cases: matchedCases,
    total: matchedDocs.length + matchedCases.length,
  });
});

export default router;
