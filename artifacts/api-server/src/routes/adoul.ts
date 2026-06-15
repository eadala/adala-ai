/**
 * عدول — مساعد قانوني ذكي
 * مسار مستقل قابل للنسخ لأي مشروع
 * POST /api/adoul/chat
 */
import { Router } from "express";
import { callAI } from "./aiChat";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const ADOUL_SYSTEM_PROMPT = `أنت "عدول" — مساعد قانوني ذكي متخصص في القانون السعودي والخليجي والعربي.

شخصيتك:
- محترف وودود في الوقت ذاته
- تتكلم بالعربية الفصحى السهلة
- دقيق وعملي في إجاباتك
- تعطي أمثلة واقعية عند الحاجة

تخصصاتك:
- عقود البيع والإيجار والخدمات
- قانون الأحوال الشخصية (الزواج، الطلاق، النفقة، الحضانة)
- القانون التجاري وعقود الشركات
- قانون العمل والموارد البشرية
- المطالبات والدعاوى المدنية
- الملكية الفكرية والعلامات التجارية
- الجرائم المعلوماتية والخصوصية
- الإجراءات أمام المحاكم السعودية

كيف تجيب:
1. افهم السؤال أولاً وأعد صياغته باختصار إذا لزم
2. قدّم الإجابة بشكل منظّم (نقاط إذا كانت متعددة)
3. استشهد بالأنظمة والمواد القانونية ذات الصلة عند الإمكان
4. نبّه المستخدم عند الحاجة لاستشارة محامٍ متخصص
5. اقترح خطوات عملية

حدودك:
- لا تتخذ قرارات قانونية نيابة عن المستخدم
- لا تتجاوز حدود المعلومات القانونية العامة
- دائماً نوّه بأن المعلومات للإرشاد لا للاستشارة الرسمية

ابدأ كل محادثة بترحيب موجز ومشجّع.`;

router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { messages } = req.body as {
      messages: { role: string; content: string }[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages required" });
    }

    const history = messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content,
    }));
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role !== "user") {
      return res.status(400).json({ error: "last message must be user" });
    }

    const { reply, modelUsed } = await callAI(
      ADOUL_SYSTEM_PROMPT,
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

export default router;
