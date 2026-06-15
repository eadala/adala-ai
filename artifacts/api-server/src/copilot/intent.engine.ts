import { callAI } from "../modules/ai/aiChat";

export type IntentType =
  | "CREATE_CASE"
  | "CREATE_CLIENT"
  | "CREATE_REMINDER"
  | "CREATE_INVOICE"
  | "DRAFT_DOCUMENT"
  | "ANALYZE_CASE"
  | "CALCULATE_PROBABILITY"
  | "SEARCH_DATA"
  | "NAVIGATE"
  | "FINANCIAL_SUMMARY"
  | "SCHEDULE_EVENT"
  | "GENERAL_QUESTION";

export interface Intent {
  type: IntentType;
  confidence: number;
  entities: Record<string, any>;
  raw: string;
}

const INTENT_SYSTEM = `أنت محرك تصنيف نوايا لنظام قانوني. مهمتك: تحليل نص المستخدم وإرجاع JSON فقط — بدون أي نص إضافي.

أنواع النوايا:
- CREATE_CASE: إنشاء/فتح قضية
- CREATE_CLIENT: إضافة عميل جديد
- CREATE_REMINDER: إضافة تذكير أو مهمة
- CREATE_INVOICE: إنشاء فاتورة
- DRAFT_DOCUMENT: صياغة وثيقة قانونية أو عقد
- ANALYZE_CASE: تحليل قضية موجودة
- CALCULATE_PROBABILITY: حساب احتمالية الفوز
- SEARCH_DATA: البحث في البيانات
- NAVIGATE: الانتقال لصفحة معينة
- FINANCIAL_SUMMARY: ملخص مالي أو تقارير
- SCHEDULE_EVENT: جدولة جلسة أو موعد
- GENERAL_QUESTION: سؤال عام

استخرج الكيانات المتاحة: clientName, defendant, amount, caseType, documentType, caseId, dateStr, location, priority

أرجع JSON بهذا الشكل فقط:
{"type":"...","confidence":0.95,"entities":{...}}`;

export async function detectIntent(userInput: string): Promise<Intent> {
  try {
    const { reply } = await callAI(INTENT_SYSTEM, userInput, [], "gemini");
    const clean = reply.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return { ...parsed, raw: userInput };
  } catch {
    return {
      type: "GENERAL_QUESTION",
      confidence: 0.5,
      entities: {},
      raw: userInput,
    };
  }
}
