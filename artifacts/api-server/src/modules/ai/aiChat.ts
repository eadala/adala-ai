import { requireAuth, requireAuthWithTenant, requireSuperAdmin } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { sanitizePrompt, logInjectionAttempt, SYSTEM_PROMPT_GUARD } from "../../core/promptSanitizer";

const router = Router();

const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY;
const DEEPSEEK_API_KEY  = process.env.DEEPSEEK_API_KEY;

export type ModelKey = "auto" | "gemini" | "claude" | "openai" | "ollama" | "deepseek";

/* ══════════════════════════════════════════════════════════════════
   COST TIER CLASSIFIER
   ─────────────────────────────────────────────────────────────────
   cheap   → DeepSeek (0.5pt) — بسيط، قصير، غير قانوني
   mid     → Gemini   (1pt)   — متوسط أو قانوني أساسي
   premium → Claude/OpenAI (3pt) — تحليل قانوني معقد
══════════════════════════════════════════════════════════════════ */
export type CostTier = "cheap" | "mid" | "premium";

const PREMIUM_KEYWORDS = ["عقد", "تحليل", "مخاطر", "دعوى", "صياغة", "مراجعة", "استئناف", "تحكيم", "حكم", "مذكرة", "لائحة", "طعن"];

export function classifyPrompt(input: string): CostTier {
  const len = input.length;
  const isLegal = PREMIUM_KEYWORDS.some(k => input.includes(k));
  if (len < 80 && !isLegal) return "cheap";
  if (len < 600 && !isLegal) return "mid";
  if (isLegal && len >= 400) return "premium";
  return "mid";
}

/* ── Usage logging ─────────────────────────────────────────────────────────
   prompt_text + response_text are saved for legal traceability:
   if a dispute arises about "what did the AI say?", we have the full record.
   Text is capped at 8000 / 16000 chars to prevent DB bloat.
─────────────────────────────────────────────────────────────────────────── */
export async function logAIUsage(opts: {
  officeId:     string;
  queryType:    string;
  modelUsed:    string;
  tier:         CostTier;
  costPoints:   number;
  cached:       boolean;
  responseMs?:  number;
  promptLength?: number;
  promptText?:  string;
  responseText?: string;
  caseId?:      string;
}): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO ai_usage_logs
        (office_id, query_type, model_used, tier, cost_points, cached,
         response_ms, prompt_length, prompt_text, response_text, case_id)
      VALUES
        (${opts.officeId}, ${opts.queryType}, ${opts.modelUsed}, ${opts.tier},
         ${opts.costPoints}, ${opts.cached}, ${opts.responseMs ?? null}, ${opts.promptLength ?? null},
         ${opts.promptText  ? opts.promptText.slice(0, 8000)  : null},
         ${opts.responseText ? opts.responseText.slice(0, 16000) : null},
         ${opts.caseId ?? null})
    `);
  } catch { /* non-blocking */ }
}

async function ensureUsageTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id            SERIAL PRIMARY KEY,
        office_id     TEXT NOT NULL DEFAULT 'default',
        query_type    TEXT NOT NULL DEFAULT 'custom',
        model_used    TEXT NOT NULL,
        tier          TEXT NOT NULL DEFAULT 'mid',
        cost_points   REAL NOT NULL DEFAULT 1,
        cached        BOOLEAN NOT NULL DEFAULT FALSE,
        response_ms   INTEGER,
        prompt_length INTEGER,
        prompt_text   TEXT,
        response_text TEXT,
        case_id       TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    /* Migrations for existing tables */
    await db.execute(sql`ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS prompt_text   TEXT`).catch(() => {});
    await db.execute(sql`ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS response_text TEXT`).catch(() => {});
    await db.execute(sql`ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS case_id       TEXT`).catch(() => {});
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_usage_office  ON ai_usage_logs(office_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_logs(created_at)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ai_usage_case    ON ai_usage_logs(case_id) WHERE case_id IS NOT NULL`).catch(() => {});
  } catch { /* already exists */ }
}
ensureUsageTable();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL;
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL ?? "gemma3:4b";
const OLLAMA_FALLBACK = process.env.OLLAMA_FALLBACK_ENABLED === "true";

export function getAvailableModels() {
  return {
    gemini:  !!GEMINI_API_KEY,
    claude:  !!ANTHROPIC_API_KEY,
    openai:  !!OPENAI_API_KEY,
    ollama:  !!OLLAMA_BASE_URL,
  };
}

/* ── Ollama (نموذج AI محلي على الخادم) ─────────────────────── */
async function callOllamaAI(
  systemPrompt: string,
  userMessage:  string,
  history: { role: string; content: string }[] = []
): Promise<string> {
  if (!OLLAMA_BASE_URL) throw new Error("OLLAMA_BASE_URL غير مضبوط");
  const messages = [
    { role: "system",    content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: "user",      content: userMessage },
  ];
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model:    OLLAMA_MODEL,
      messages,
      stream:   false,
      options:  { num_predict: 4096, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Ollama error: ${txt}`);
  }
  const data = await res.json() as any;
  return data.message?.content ?? data.response ?? "لم أتمكن من معالجة الطلب.";
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

/* ── DeepSeek (اقتصادي للطلبات البسيطة) ────────────────────────── */
async function callDeepSeekAI(systemPrompt: string, userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
  if (!DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY غير متوفر");
  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: userMessage },
  ];
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: "deepseek-chat", max_tokens: 2048, messages }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(data.error.message ?? "خطأ DeepSeek");
  return data.choices?.[0]?.message?.content ?? "عذراً، لم أتمكن من معالجة الطلب.";
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

const MODEL_CREDIT_COST: Record<string, number> = { gemini: 1, claude: 3, openai: 3, deepseek: 0.5, ollama: 0, fallback: 0 };

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
  officeId: string = "default",
  queryType: string = "custom",
  userId: string = "unknown",
): Promise<{ reply: string; modelUsed: string; tier: CostTier }> {

  const t0 = Date.now();

  /* ── Prompt Injection Protection ──────────────────────────────────── */
  const { sanitized: safeMessage, wasInjectionAttempt, detectedPatterns } = sanitizePrompt(userMessage);
  if (wasInjectionAttempt) {
    logInjectionAttempt(officeId, userId, userMessage, detectedPatterns).catch(() => {});
    return {
      reply: "⚠️ تم اكتشاف محاولة تجاوز غير مصرح بها. تم تسجيل هذه المحاولة.",
      modelUsed: "security-block",
      tier: "cheap",
    };
  }
  const guardedSystemPrompt = `${SYSTEM_PROMPT_GUARD}\n\n${systemPrompt}`;

  /* ── Daily / Monthly Limit Check ──────────────────────────────── */
  if (officeId && officeId !== "default") {
    try {
      const cr = await db.execute(sql`
        SELECT daily_used, daily_limit, monthly_used, monthly_limit,
               daily_reset_at
        FROM office_ai_credits WHERE office_id = ${officeId}
      `) as any;
      const crows = Array.isArray(cr) ? cr : (cr?.rows ?? []);
      if (crows.length > 0) {
        const c = crows[0];
        /* reset daily counter if a new UTC day started */
        const lastReset = c.daily_reset_at ? new Date(c.daily_reset_at) : null;
        const nowDay = new Date().toISOString().slice(0, 10);
        const resetDay = lastReset?.toISOString().slice(0, 10);
        if (!lastReset || resetDay !== nowDay) {
          await db.execute(sql`
            UPDATE office_ai_credits
            SET daily_used = 0, daily_reset_at = NOW()
            WHERE office_id = ${officeId}
          `).catch(() => {});
          c.daily_used = 0;
        }
        if (c.daily_limit > 0 && c.daily_used >= c.daily_limit) {
          return { reply: "⚠️ تم تجاوز الحد اليومي لاستخدام الذكاء الاصطناعي. يُعاد ضبطه غداً أو يمكنك رفع الحد من لوحة التحكم.", modelUsed: "quota-exceeded", tier: "cheap" };
        }
        if (c.monthly_limit > 0 && c.monthly_used >= c.monthly_limit) {
          return { reply: "⚠️ تم تجاوز الحد الشهري لاستخدام الذكاء الاصطناعي. يُرجى التواصل مع مدير المنصة لرفع الحد.", modelUsed: "quota-exceeded", tier: "cheap" };
        }
        /* increment usage counters (non-blocking) */
        db.execute(sql`
          UPDATE office_ai_credits
          SET daily_used = daily_used + 1, monthly_used = monthly_used + 1
          WHERE office_id = ${officeId}
        `).catch(() => {});
      }
    } catch { /* non-blocking — don't fail the AI call */ }
  }

  /* ── Forced model (explicit choice) ────────────────────────────── */
  const forced = async (model: string, fn: () => Promise<string>): Promise<{ reply: string; modelUsed: string; tier: CostTier }> => {
    const reply = await fn();
    const tier = classifyPrompt(safeMessage);
    deductCredits(officeId, model);
    logAIUsage({ officeId, queryType, modelUsed: model, tier, costPoints: MODEL_CREDIT_COST[model] ?? 1, cached: false, responseMs: Date.now() - t0, promptLength: safeMessage.length, promptText: safeMessage, responseText: reply });
    return { reply, modelUsed: model, tier };
  };

  if (preferredModel === "deepseek" && DEEPSEEK_API_KEY)
    return forced("deepseek", () => callDeepSeekAI(guardedSystemPrompt, safeMessage, history));
  if (preferredModel === "gemini"   && GEMINI_API_KEY)
    return forced("gemini",   () => callGeminiAI(guardedSystemPrompt, safeMessage, history));
  if (preferredModel === "claude"   && ANTHROPIC_API_KEY)
    return forced("claude",   () => callClaudeAI(guardedSystemPrompt, safeMessage, history));
  if (preferredModel === "openai"   && OPENAI_API_KEY)
    return forced("openai",   () => callOpenAI(guardedSystemPrompt, safeMessage, history));
  if (preferredModel === "ollama"   && OLLAMA_BASE_URL)
    return forced(`ollama:${OLLAMA_MODEL}`, () => callOllamaAI(guardedSystemPrompt, safeMessage, history));
  /* forced model not available → fall through to smart auto */

  /* ── Smart auto routing by cost tier ───────────────────────────── */
  const tier = classifyPrompt(safeMessage);

  const tryModel = async (model: string, fn: () => Promise<string>): Promise<{ reply: string; modelUsed: string; tier: CostTier } | null> => {
    try {
      const reply = await fn();
      deductCredits(officeId, model);
      logAIUsage({ officeId, queryType, modelUsed: model, tier, costPoints: MODEL_CREDIT_COST[model] ?? 1, cached: false, responseMs: Date.now() - t0, promptLength: safeMessage.length, promptText: safeMessage, responseText: reply });
      return { reply, modelUsed: model, tier };
    } catch { return null; }
  };

  if (tier === "cheap") {
    /* cheap: DeepSeek → Gemini → Ollama */
    if (DEEPSEEK_API_KEY)  { const r = await tryModel("deepseek", () => callDeepSeekAI(guardedSystemPrompt, safeMessage, history)); if (r) return r; }
    if (GEMINI_API_KEY)    { const r = await tryModel("gemini",   () => callGeminiAI(guardedSystemPrompt, safeMessage, history));   if (r) return r; }
    if (OLLAMA_BASE_URL)   { const r = await tryModel(`ollama:${OLLAMA_MODEL}`, () => callOllamaAI(guardedSystemPrompt, safeMessage, history)); if (r) return r; }
  }

  if (tier === "mid") {
    /* mid: Gemini → DeepSeek → Ollama */
    if (GEMINI_API_KEY)    { const r = await tryModel("gemini",   () => callGeminiAI(guardedSystemPrompt, safeMessage, history));   if (r) return r; }
    if (DEEPSEEK_API_KEY)  { const r = await tryModel("deepseek", () => callDeepSeekAI(guardedSystemPrompt, safeMessage, history)); if (r) return r; }
    if (OLLAMA_BASE_URL)   { const r = await tryModel(`ollama:${OLLAMA_MODEL}`, () => callOllamaAI(guardedSystemPrompt, safeMessage, history)); if (r) return r; }
  }

  if (tier === "premium") {
    /* premium: Claude → OpenAI → Gemini → Ollama */
    if (ANTHROPIC_API_KEY) { const r = await tryModel("claude",   () => callClaudeAI(guardedSystemPrompt, safeMessage, history));   if (r) return r; }
    if (OPENAI_API_KEY)    { const r = await tryModel("openai",   () => callOpenAI(guardedSystemPrompt, safeMessage, history));     if (r) return r; }
    if (GEMINI_API_KEY)    { const r = await tryModel("gemini",   () => callGeminiAI(guardedSystemPrompt, safeMessage, history));   if (r) return r; }
    if (OLLAMA_BASE_URL)   { const r = await tryModel(`ollama:${OLLAMA_MODEL}`, () => callOllamaAI(guardedSystemPrompt, safeMessage, history)); if (r) return r; }
  }

  /* final static fallback */
  logAIUsage({ officeId, queryType, modelUsed: "fallback", tier, costPoints: 0, cached: false, responseMs: Date.now() - t0, promptLength: safeMessage.length, promptText: safeMessage });
  return { reply: generateSmartResponse(safeMessage), modelUsed: "fallback", tier };
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

/* ── Available models endpoint (auth required) ── */
router.get("/ai-models/available", requireAuth, (_req, res) => {
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
      const tenantId = (req as any).tenantId as string;
      if (!tenantId) throw new Error("no tenant");
      const caseRows = await db.execute(sql`SELECT id, title, case_type, status FROM cases WHERE id = ${caseId} AND office_id = ${tenantId} LIMIT 1`) as any;
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
  const tenantId = (req as any).tenantId as string | undefined;

  try {
    const taskRows = await db.execute(sql`SELECT * FROM ai_tasks WHERE id = ${id} AND (office_id IS NULL OR office_id = ${tenantId ?? ''}) LIMIT 1`) as any;
    const taskArr = Array.isArray(taskRows) ? taskRows : (taskRows?.rows ?? []);
    if (!taskArr.length) return res.status(404).json({ error: "المهمة غير موجودة" });
    const t = taskArr[0];

    await db.execute(sql`UPDATE ai_tasks SET status = 'running' WHERE id = ${id} AND (office_id IS NULL OR office_id = ${tenantId ?? ''})`);

    let docContent = "";
    if (t.document_id) {
      /* SECURITY: scope document read to the tenant that owns the ai_task */
      const docRows = await db.execute(sql`SELECT * FROM documents WHERE id = ${t.document_id} AND (office_id IS NULL OR office_id = ${tenantId ?? ''}) LIMIT 1`) as any;
      const docArr = Array.isArray(docRows) ? docRows : (docRows?.rows ?? []);
      if (docArr.length) docContent = docArr[0].ocr_text ?? docArr[0].file_name ?? "";
    }
    if (!docContent) docContent = "مستند قانوني للتحليل";

    const result = await processAiTask(t.type ?? t.task_type ?? "summarize", docContent);

    await db.execute(sql`
      UPDATE ai_tasks SET status = 'done', output_text = ${result}, updated_at = NOW()
      WHERE id = ${id} AND (office_id IS NULL OR office_id = ${tenantId ?? ''})
    `);

    return res.json({ success: true, result });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

router.post("/ai-search", requireAuthWithTenant, async (req, res) => {
  const { query } = req.body as { query: string };
  if (!query) return res.status(400).json({ error: "استعلام البحث مطلوب" });
  const tenantId = (req as any).tenantId as string;
  if (!tenantId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });

  const systemPrompt = `أنت محرك بحث قانوني ذكي. عند تلقي استفسار، حدد المفاهيم القانونية المرتبطة به في القانون السعودي وقدم نتائج بحث منظمة.`;
  const { reply: analysis } = await callAI(systemPrompt, `ابحث عن: ${query}`);

  const like = `%${query}%`;
  const docsRaw = await db.execute(sql`
    SELECT id, file_name as title, file_type FROM documents WHERE file_name ILIKE ${like} AND office_id = ${tenantId}::uuid LIMIT 10
  `) as any;
  const casesRaw = await db.execute(sql`
    SELECT id, title, status FROM cases WHERE (title ILIKE ${like} OR description ILIKE ${like}) AND office_id = ${tenantId}::uuid LIMIT 10
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

/* ─── AI Cost Control Admin Routes ───────────────────────────────────────── */
import { Router as AICostRouter } from "express";
export const aiCostRouter = AICostRouter();

/* GET /api/ai/cost — current office usage */
aiCostRouter.get("/ai/cost", async (req: any, res: any) => {
  try {
    const tenantId = req.tenantId as string;
    const r = await db.execute(sql`
      SELECT office_id, balance, monthly_allowance, daily_limit, daily_used,
             monthly_limit, monthly_used, daily_reset_at, updated_at
      FROM office_ai_credits WHERE office_id = ${tenantId}
    `) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    if (!rows.length) return res.json({ balance: 0, daily_limit: 50, daily_used: 0, monthly_limit: 500, monthly_used: 0 });
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /api/ai/cost/limits — super admin: set daily/monthly limits for an office */
aiCostRouter.patch("/ai/cost/limits", requireSuperAdmin, async (req: any, res: any) => {
  try {
    const { officeId, dailyLimit, monthlyLimit, monthlyAllowance } = req.body;
    await db.execute(sql`
      INSERT INTO office_ai_credits (office_id, office_name, balance, monthly_allowance, daily_limit, monthly_limit)
      VALUES (${officeId}, ${officeId}, 100, ${monthlyAllowance ?? 500}, ${dailyLimit ?? 50}, ${monthlyLimit ?? 500})
      ON CONFLICT (office_id) DO UPDATE SET
        daily_limit = EXCLUDED.daily_limit,
        monthly_limit = EXCLUDED.monthly_limit,
        monthly_allowance = EXCLUDED.monthly_allowance,
        updated_at = NOW()
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/ai/cost/all — super admin: all offices usage */
aiCostRouter.get("/ai/cost/all", requireSuperAdmin, async (req: any, res: any) => {
  try {
    const r = await db.execute(sql`
      SELECT c.office_id, c.balance, c.monthly_allowance, c.daily_limit, c.daily_used,
             c.monthly_limit, c.monthly_used, c.daily_reset_at, c.updated_at,
             o.name as office_name
      FROM office_ai_credits c
      LEFT JOIN office_registry o ON o.id::text = c.office_id
      ORDER BY c.monthly_used DESC
      LIMIT 200
    `) as any;
    const rows = Array.isArray(r) ? r : (r?.rows ?? []);
    res.json({ offices: rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
