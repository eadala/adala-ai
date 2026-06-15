import { requireAuth } from "../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export type ModelKey = "auto" | "gemini" | "claude" | "openai";

export function getAvailableModels() {
  return {
    gemini: !!GEMINI_API_KEY,
    claude: !!ANTHROPIC_API_KEY,
    openai: !!OPENAI_API_KEY,
  };
}

async function callGeminiAI(systemPrompt: string, userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY غير متوفر");
  const contents = [
    ...history.map(h => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
      }),
    }
  );
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message ?? "خطأ Gemini");
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "عذراً، لم أتمكن من معالجة الطلب.";
}

async function callClaudeAI(systemPrompt: string, userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY غير متوفر");
  const messages = [
    ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: userMessage },
  ];
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
      messages,
    }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message ?? "خطأ Claude");
  return data.content?.[0]?.text ?? "عذراً، لم أتمكن من معالجة الطلب.";
}

async function callOpenAI(systemPrompt: string, userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY غير متوفر");
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: userMessage },
  ];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini", max_tokens: 2048, messages }),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message ?? "خطأ OpenAI");
  return data.choices?.[0]?.message?.content ?? "عذراً، لم أتمكن من معالجة الطلب.";
}

const MODEL_CREDIT_COST: Record<string, number> = { gemini: 1, claude: 3, openai: 3, fallback: 0 };

async function deductCredits(officeId: string, model: string): Promise<void> {
  try {
    const cost = MODEL_CREDIT_COST[model] ?? 1;
    if (cost === 0) return;
    const r = await db.execute(sql`SELECT balance FROM office_ai_credits WHERE office_id = ${officeId}`) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    const balance = rows[0]?.balance ?? 0;
    if (balance < cost) return; /* allow call but don't go negative */
    await db.execute(sql`
      UPDATE office_ai_credits SET balance = balance - ${cost}, updated_at = NOW()
      WHERE office_id = ${officeId}
    `);
    await db.execute(sql`
      INSERT INTO ai_credit_transactions (office_id, amount, type, description, model)
      VALUES (${officeId}, ${-cost}, 'usage', ${'استخدام AI - ' + model}, ${model})
    `);
  } catch { /* non-blocking — don't fail the AI call */ }
}

async function ensureCreditTables(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS office_ai_credits (
        id SERIAL PRIMARY KEY, office_id TEXT NOT NULL UNIQUE DEFAULT 'default',
        office_name TEXT NOT NULL DEFAULT 'المكتب الافتراضي',
        balance INTEGER NOT NULL DEFAULT 100, monthly_allowance INTEGER NOT NULL DEFAULT 100,
        auto_renew BOOLEAN NOT NULL DEFAULT TRUE, renew_day INTEGER NOT NULL DEFAULT 1,
        last_renewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_credit_transactions (
        id SERIAL PRIMARY KEY, office_id TEXT NOT NULL DEFAULT 'default',
        amount INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'usage',
        description TEXT, model TEXT, created_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      INSERT INTO office_ai_credits (office_id, office_name, balance, monthly_allowance)
      VALUES ('default','المكتب الافتراضي',100,100) ON CONFLICT (office_id) DO NOTHING
    `);
  } catch { /* tables may already exist */ }
}

/* run once on load */
ensureCreditTables();

export async function callAI(
  systemPrompt: string,
  userMessage: string,
  history: { role: string; content: string }[] = [],
  preferredModel: ModelKey = "auto",
  officeId: string = "default"
): Promise<{ reply: string; modelUsed: string }> {

  /* forced model */
  if (preferredModel === "gemini" && GEMINI_API_KEY) {
    const reply = await callGeminiAI(systemPrompt, userMessage, history);
    deductCredits(officeId, "gemini");
    return { reply, modelUsed: "gemini" };
  }
  if (preferredModel === "claude" && ANTHROPIC_API_KEY) {
    const reply = await callClaudeAI(systemPrompt, userMessage, history);
    deductCredits(officeId, "claude");
    return { reply, modelUsed: "claude" };
  }
  if (preferredModel === "openai" && OPENAI_API_KEY) {
    const reply = await callOpenAI(systemPrompt, userMessage, history);
    deductCredits(officeId, "openai");
    return { reply, modelUsed: "openai" };
  }
  /* requested model not available → fall through to auto */

  /* auto: priority Gemini → Claude → OpenAI → fallback */
  if (GEMINI_API_KEY) {
    const reply = await callGeminiAI(systemPrompt, userMessage, history);
    deductCredits(officeId, "gemini");
    return { reply, modelUsed: "gemini" };
  }
  if (ANTHROPIC_API_KEY) {
    const reply = await callClaudeAI(systemPrompt, userMessage, history);
    deductCredits(officeId, "claude");
    return { reply, modelUsed: "claude" };
  }
  if (OPENAI_API_KEY) {
    const reply = await callOpenAI(systemPrompt, userMessage, history);
    deductCredits(officeId, "openai");
    return { reply, modelUsed: "openai" };
  }
  return { reply: generateSmartResponse(userMessage), modelUsed: "fallback" };
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
  const { reply } = await callAI(systemPrompt, prompt);
  return reply;
}

/* ── Available models endpoint ── */
router.get("/ai-models/available", (_req, res) => {
  res.json(getAvailableModels());
});

router.post("/ai-chat/message", requireAuth, async (req, res) => {
  const { message, caseId, history = [], model = "auto" } = req.body as {
    message: string;
    caseId?: number;
    history?: { role: string; content: string }[];
    model?: ModelKey;
  };

  if (!message) {
    return res.status(400).json({ error: "الرسالة مطلوبة" });
  }

  let context = "";
  if (caseId) {
    try {
      const userId = (req as any).userId;
      const caseRows = await db.execute(sql`SELECT * FROM cases WHERE id = ${caseId} AND (created_by = ${userId} OR office_id IS NOT NULL) LIMIT 1`) as any;
      const caseArr = Array.isArray(caseRows) ? caseRows : (caseRows?.rows ?? []);
      if (caseArr.length > 0) {
        const c = caseArr[0];
        context = `\n\n[سياق القضية: ${c.title} - ${c.case_type ?? c.caseType ?? ""} - الحالة: ${c.status}]`;
      }
    } catch { /* ignore */ }
  }

  const systemPrompt = `أنت مساعد قانوني ذكي لمنصة عدالة AI. متخصص في القانون السعودي والفقه الإسلامي. تجيب بالعربية الفصحى بأسلوب مهني ودقيق. تقدم تحليلات قانونية، ترشيح مراجع نظامية، وخطوات عملية للمحامين.${context}`;

  const { reply, modelUsed } = await callAI(systemPrompt, message, history as { role: string; content: string }[], model);
  return res.json({ reply, modelUsed });
});

router.post("/ai-tasks/:id/process", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "معرف غير صالح" });

  try {
    const taskRows = await db.execute(sql`SELECT * FROM ai_tasks WHERE id = ${id} LIMIT 1`) as any;
    const taskArr = Array.isArray(taskRows) ? taskRows : (taskRows?.rows ?? []);
    if (!taskArr.length) return res.status(404).json({ error: "المهمة غير موجودة" });
    const t = taskArr[0];

    await db.execute(sql`UPDATE ai_tasks SET status = 'running' WHERE id = ${id}`);

    let docContent = "";
    if (t.document_id) {
      const docRows = await db.execute(sql`SELECT * FROM documents WHERE id = ${t.document_id} LIMIT 1`) as any;
      const docArr = Array.isArray(docRows) ? docRows : (docRows?.rows ?? []);
      if (docArr.length) docContent = docArr[0].ocr_text ?? docArr[0].file_name ?? "";
    }
    if (!docContent) docContent = "مستند قانوني للتحليل";

    const result = await processAiTask(t.type ?? t.task_type ?? "summarize", docContent);

    await db.execute(sql`
      UPDATE ai_tasks SET status = 'done', output_text = ${result}, updated_at = NOW()
      WHERE id = ${id}
    `);

    return res.json({ success: true, result });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/ai-search", requireAuth, async (req, res) => {
  const { query } = req.body as { query: string };
  if (!query) return res.status(400).json({ error: "استعلام البحث مطلوب" });

  const systemPrompt = `أنت محرك بحث قانوني ذكي. عند تلقي استفسار، حدد المفاهيم القانونية المرتبطة به في القانون السعودي وقدم نتائج بحث منظمة.`;
  const { reply: analysis } = await callAI(systemPrompt, `ابحث عن: ${query}`);

  const like = `%${query}%`;
  const docsRaw = await db.execute(sql`
    SELECT id, file_name as title, file_type FROM documents WHERE file_name ILIKE ${like} LIMIT 10
  `) as any;
  const casesRaw = await db.execute(sql`
    SELECT id, title, status FROM cases WHERE title ILIKE ${like} OR description ILIKE ${like} LIMIT 10
  `) as any;
  const matchedDocs = Array.isArray(docsRaw) ? docsRaw : (docsRaw?.rows ?? []);
  const matchedCases = Array.isArray(casesRaw) ? casesRaw : (casesRaw?.rows ?? []);

  return res.json({
    analysis,
    documents: matchedDocs,
    cases: matchedCases,
    total: matchedDocs.length + matchedCases.length,
  });
});

export default router;
