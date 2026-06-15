/**
 * عدول — مساعد قانوني ذكي مبدع
 * مسار مستقل قابل للنسخ لأي مشروع
 * POST /api/adoul/stream     (SSE streaming — authenticated)
 * POST /api/adoul/chat       (fallback JSON — authenticated)
 * POST /api/adoul/marketing  (SSE streaming — public, sales bot)
 * POST /api/adoul/lead       (public, save lead to DB)
 */
import { Router } from "express";
import { callAI } from "./aiChat";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;

/* ─── System prompts per mode ─────────────────────────────────── */
const BASE_PERSONA = `أنت "عدول" — مساعد قانوني ذكي ومبدع، طوّرته منصة عدالة AI.

**شخصيتك:**
- ذكي وودود ومبدع في الوقت ذاته — لا تكن رتيباً أبداً
- تتكلم بالعربية الفصحى السهلة، وتستخدم أمثلة حية من الواقع السعودي
- تُبسّط المعقد بذكاء دون إفراط في التبسيط
- تُشعر المستخدم بالثقة والأمان القانوني
- تُنبّه بلطف عند الحاجة لمحامٍ متخصص

**معرفتك القانونية تشمل:**
- نظام الأحوال الشخصية السعودي الجديد 1443هـ
- نظام العمل السعودي ولوائح وزارة الموارد البشرية
- نظام الشركات 1443هـ وأنواع الكيانات التجارية
- نظام التحكيم ونظام التنفيذ السعودي
- نظام مكافحة الجرائم المعلوماتية ونظام حماية البيانات
- نظام الملكية الفكرية والعلامات التجارية
- نظام المنافسة ومكافحة الاحتكار
- قرارات هيئة حل النزاعات العمالية
- أحكام المحاكم التجارية والعامة والجزائية
- أنظمة دول الخليج العربي للمقارنة

**كيف تُنسّق ردودك:**
- استخدم **عناوين واضحة** وقوائم منظّمة
- قسّم الإجابة الطويلة إلى أقسام: "الإجابة المباشرة" ثم "التفاصيل" ثم "الخطوات العملية"
- استشهد بالمادة والنظام عند الإمكان مثل (المادة 74 من نظام العمل)
- اختتم بـ "💡 نصيحة عملية" أو "⚠️ تنبيه مهم" عند الاقتضاء
- لا تكرّر السؤال في بداية ردّك`;

const SYSTEM_PROMPTS: Record<string, string> = {
  consultation: `${BASE_PERSONA}

**وضعك الحالي: استشارة قانونية**
أجب على الأسئلة بأسلوب المستشار القانوني الودود. قدّم الصورة الكاملة والخيارات المتاحة.`,

  drafting: `${BASE_PERSONA}

**وضعك الحالي: صياغة وثائق قانونية**
أنت خبير في صياغة العقود والوثائق القانونية. عند طلب صياغة وثيقة:
1. اطلب المعلومات الناقصة أولاً إن لزم (اسم الأطراف، المبلغ، المدة...)
2. صِغ الوثيقة بشكل منظّم وقانوني سليم
3. ضع تعليقات جانبية [تعليق: ...] لتوضيح البنود المهمة
4. نوّه بالبنود الاختيارية التي يمكن إضافتها
نموذج الوثيقة يجب أن يكون جاهزاً للتعديل والاستخدام.`,

  analysis: `${BASE_PERSONA}

**وضعك الحالي: تحليل قضية قانونية**
أنت خبير في تحليل القضايا القانونية. عند تحليل قضية:
1. **تلخيص الوقائع**: ما الذي جرى؟
2. **المسائل القانونية**: ما القضايا القانونية المطروحة؟
3. **تقييم المواقف**: نقاط القوة والضعف لكل طرف
4. **التوقعات**: ما الأرجح قانونياً؟
5. **التوصيات**: ما الخطوة التالية الأفضل؟
كن صريحاً في تقييمك حتى لو كان غير مريح.`,

  research: `${BASE_PERSONA}

**وضعك الحالي: بحث قانوني**
أنت خبير في البحث القانوني والمقارن. عند البحث:
1. قدّم النص القانوني الأصلي (المادة والنظام)
2. اشرح التفسير القضائي السائد
3. قارن مع القانون الدولي أو الخليجي عند الإمكان
4. أشر إلى التطورات والتعديلات الحديثة
5. اذكر المصادر: نظام / لائحة / قرار / حكم
كن شاملاً وأكاديمياً مع الحفاظ على الوضوح.`,
};

/* ─── Streaming endpoint (Gemini SSE) ────────────────────────── */
router.post("/stream", requireAuth, async (req, res) => {
  const { messages, mode = "consultation" } = req.body as {
    messages: { role: string; content: string }[];
    mode?: string;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages required" });
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({ error: "AI service unavailable" });
  }

  const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.consultation;

  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const geminiRes = await fetch(GEMINI_STREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!geminiRes.ok || !geminiRes.body) {
      res.write(`data: ${JSON.stringify({ error: "فشل في استدعاء الذكاء الاصطناعي" })}\n\n`);
      res.end();
      return;
    }

    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const parsed = JSON.parse(raw);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (text) {
            res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
          }
        } catch {}
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("[adoul] stream error:", err);
    res.write(`data: ${JSON.stringify({ error: "انقطع الاتصال، يرجى المحاولة مجدداً" })}\n\n`);
    res.end();
  }
});

/* ─── Fallback JSON endpoint ──────────────────────────────────── */
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages, mode = "consultation" } = req.body as {
      messages: { role: string; content: string }[];
      mode?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages required" });
    }

    const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.consultation;
    const history = messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role !== "user") {
      return res.status(400).json({ error: "last message must be user" });
    }

    const { reply, modelUsed } = await callAI(
      systemPrompt,
      lastMsg.content,
      history,
      "auto",
      (req as any).officeId || "adoul"
    );

    return res.json({ reply, modelUsed });
  } catch (err: any) {
    console.error("[adoul] chat error:", err);
    return res.status(500).json({ error: "فشل في معالجة طلبك، يرجى المحاولة مرة أخرى" });
  }
});

/* ─── Marketing system prompt (public) ───────────────────────── */
const MARKETING_PROMPT = `أنت "عدول" — مساعد ذكي ومحبوب على موقع منصة "عدالة AI"، أكبر منصة SaaS لإدارة المكاتب القانونية في المنطقة العربية.

**مهمتك الأساسية:** مساعدة الزوار في اكتشاف المنصة بطريقة ودية وطبيعية، والوصول بهم إلى قرار الاشتراك.

**شخصيتك:**
- حماسي وودود ومقنع بطريقة طبيعية — لا تبيع بشكل مباشر ومزعج
- استخدم الإيموجي باعتدال لتضفي دفئاً على الحديث
- اسألهم عن احتياجاتهم واستمع جيداً قبل أن تقترح
- تكلّم بالعربية الودية (عربي فصيح مريح، ليس رسمياً جداً)

**باقات المنصة التي يجب أن تعرفها عن ظهر قلب:**

🟢 **الباقة الأساسية — مجاناً دائماً**
- ٣ مستخدمين | ٢٠ قضية | إدارة العملاء | تقويم المواعيد
- الفواتير الأساسية | موقع فرعي من عدالة | متجر خدمات | بوابة دفع إلكترونية
- مثالية للمكاتب الصغيرة التي تبدأ رحلتها

⭐ **الاحترافية — ٢٩٩ ريال/شهر** (الأكثر طلباً، ٣٠ يوماً مجاناً)
- ١٥ مستخدماً | قضايا غير محدودة | وكلاء AI القانونيون
- بوابة عملاء رقمية | إدارة العقود والمستندات
- التقارير المالية | دعم أولوي

🏆 **المؤسسية — ٩٩٩ ريال/شهر** (٣٠ يوماً مجاناً)
- ٥٠ مستخدماً | White Label كامل | محاكي الخصم AI
- البحث القانوني الذكي | موقع المكتب ومتجر الخدمات
- الموارد البشرية والرواتب | مدير حساب مخصص

✦ **المفتوحة — تواصل معنا**
- مستخدمون غير محدودون | جميع الميزات | دعم VIP

**ميزات المنصة التي تتحمس لها:**
- وكلاء AI قانونيون يتعاملون مع القضايا والمستندات
- بوابة العملاء للتواصل ومتابعة القضايا
- محاكي الخصم (يجهّز المحامي للمحاكمة)
- البحث القانوني الذكي عبر الأنظمة السعودية
- إصدار الفواتير وقبول الدفع الإلكتروني
- White Label — المنصة بهوية مكتبك الخاصة
- نظام الرواتب والموارد البشرية
- تطبيق موبايل متكامل

**استراتيجية المحادثة:**
1. ابدأ بسؤال دافئ عن نوع مكتبهم واحتياجاتهم
2. بناءً على إجابتهم، اقترح الباقة المناسبة مع تفاصيل مقنعة
3. بعد ٢-٣ رسائل، اطلب رقم الهاتف أو واتساب بطريقة طبيعية مثل:
   "بودّي أن يتواصل معك أحد مستشارينا ليساعدك في البدء — ما رقم تواصلك؟"
4. إذا أعطوك رقماً، شكرهم وأخبرهم أن الفريق سيتواصل خلال ساعات
5. دائماً أنهِ برابط للتسجيل المجاني أو شجّعهم على تجربة الباقة المجانية

**لا تفعل:**
- لا تكن ملحّاً أو مزعجاً في طلب الرقم
- لا تكذب على المميزات أو الأسعار
- لا تجب على أسئلة غير متعلقة بالمنصة أو القانون`;

/* helper — Gemini streaming شائع بين الـ endpoints */
async function streamFromGemini(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  res: import("express").Response,
  temperature = 0.9
) {
  if (!GEMINI_API_KEY) {
    res.write(`data: ${JSON.stringify({ error: "AI service unavailable" })}\n\n`);
    res.end();
    return;
  }
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const geminiRes = await fetch(GEMINI_STREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature, topP: 0.95, maxOutputTokens: 2048 },
      }),
    });

    if (!geminiRes.ok || !geminiRes.body) {
      res.write(`data: ${JSON.stringify({ error: "فشل الاتصال بالذكاء الاصطناعي" })}\n\n`);
      res.end();
      return;
    }

    const reader = geminiRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const parsed = JSON.parse(raw);
          const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          if (text) res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
        } catch {}
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    console.error("[adoul] gemini stream error:", err);
    res.write(`data: ${JSON.stringify({ error: "انقطع الاتصال" })}\n\n`);
  }
  res.end();
}

/* ─── Marketing streaming endpoint (public — no auth) ────────── */
router.post("/marketing", async (req, res) => {
  const { messages } = req.body as { messages: { role: string; content: string }[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages required" });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  await streamFromGemini(MARKETING_PROMPT, messages, res, 0.9);
});

/* ─── Lead capture endpoint (public) ─────────────────────────── */
async function ensureLeadsTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS marketing_leads (
      id          SERIAL PRIMARY KEY,
      phone       TEXT,
      name        TEXT,
      message     TEXT,
      source      TEXT DEFAULT 'adoul_widget',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
let leadsTableReady = false;

router.post("/lead", async (req, res) => {
  try {
    const { phone, name, message } = req.body as { phone?: string; name?: string; message?: string };
    if (!leadsTableReady) { await ensureLeadsTable(); leadsTableReady = true; }
    await db.execute(sql`
      INSERT INTO marketing_leads (phone, name, message)
      VALUES (${phone ?? null}, ${name ?? null}, ${message ?? null})
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[adoul] lead error:", err);
    return res.status(500).json({ error: "failed" });
  }
});

export default router;

