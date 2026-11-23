/**
 * Events Registry — عدالة AI Platform
 * السجل المركزي لجميع Domain Events في النظام
 *
 * كل حدث موثَّق بمن يُصدره ومن يستمع إليه وما الأتمتة المرتبطة به
 * المرجع الوحيد — EventBus.emit() يستخدم هذه الأنواع
 */

export type EventCategory =
  | "legal"
  | "financial"
  | "hr"
  | "ai"
  | "notification"
  | "system"
  | "bankruptcy";

export interface EventDefinition {
  type: string;                   // نوع الحدث (مطابق لـ EventType في eventBus.ts)
  nameAr: string;                 // الاسم العربي
  category: EventCategory;
  emittedBy: string[];            // الوحدات التي تُصدر الحدث
  listeners: string[];            // المستمعون المسجّلون
  automations?: string[];         // الأتمتة التلقائية المرتبطة
  persistedToDB: boolean;         // هل يُحفظ في system_events؟
  triggersNotification?: boolean; // هل يُرسل إشعاراً؟
  triggersTelegram?: boolean;
  triggersEmail?: boolean;
  description?: string;
}

export const EVENTS_REGISTRY: EventDefinition[] = [

  /* ══ القضايا ══════════════════════════════════════════════ */
  {
    type: "CASE_CREATED",
    nameAr: "إنشاء قضية",
    category: "legal",
    emittedBy: ["cases.ts"],
    listeners: ["analyticsListener", "notificationListener", "caseAutopilot"],
    automations: [
      "تحليل صحة القضية (health score) بعد 3 ثوانٍ",
      "تسجيل في event_daily_counts",
    ],
    persistedToDB: true,
    triggersNotification: true,
    description: "يُصدَر عند إنشاء قضية جديدة",
  },
  {
    type: "CASE_UPDATED",
    nameAr: "تحديث قضية",
    category: "legal",
    emittedBy: ["cases.ts"],
    listeners: ["analyticsListener", "jlwmSyncListener"],
    automations: ["تحديث التوأم الرقمي للقضية في JLWM"],
    persistedToDB: true,
    triggersNotification: false,
  },
  {
    type: "CASE_CLOSED",
    nameAr: "إغلاق قضية",
    category: "legal",
    emittedBy: ["cases.ts"],
    listeners: ["analyticsListener", "notificationListener", "financeListener"],
    automations: ["إرسال إشعار للعميل", "تحديث التحليلات"],
    persistedToDB: true,
    triggersNotification: true,
    triggersTelegram: true,
  },

  /* ══ العملاء ══════════════════════════════════════════════ */
  {
    type: "CLIENT_ADDED",
    nameAr: "إضافة عميل",
    category: "legal",
    emittedBy: ["clients.ts"],
    listeners: ["analyticsListener", "jlwmSyncListener"],
    automations: ["تحديث توأم العميل في JLWM"],
    persistedToDB: true,
    triggersNotification: false,
  },

  /* ══ المالية ══════════════════════════════════════════════ */
  {
    type: "INVOICE_CREATED",
    nameAr: "إنشاء فاتورة",
    category: "financial",
    emittedBy: ["invoices.ts"],
    listeners: ["financeListener", "analyticsListener"],
    automations: ["تسجيل قيد محاسبي تلقائي في journal_entries"],
    persistedToDB: true,
    triggersNotification: true,
    triggersEmail: true,
  },
  {
    type: "INVOICE_PAID",
    nameAr: "دفع فاتورة",
    category: "financial",
    emittedBy: ["invoices.ts", "payments.ts"],
    listeners: ["financeListener", "analyticsListener", "notificationListener"],
    automations: [
      "تسجيل في double-entry accounting",
      "تحديث رصيد المحفظة",
      "إرسال إيصال للعميل",
    ],
    persistedToDB: true,
    triggersNotification: true,
    triggersEmail: true,
    triggersTelegram: true,
  },
  {
    type: "INVOICE_OVERDUE",
    nameAr: "فاتورة متأخرة",
    category: "financial",
    emittedBy: ["emailCron.ts"],
    listeners: ["notificationListener", "financeListener"],
    automations: ["إرسال تذكير تلقائي", "تحديث تقرير التحصيل"],
    persistedToDB: true,
    triggersNotification: true,
    triggersEmail: true,
  },
  {
    type: "PAYMENT_SUCCESS",
    nameAr: "نجاح عملية دفع",
    category: "financial",
    emittedBy: ["payments.ts", "stripeWebhook.ts"],
    listeners: ["financeListener", "billingListener"],
    automations: ["تسجيل في office_ledger", "تحديث subscription"],
    persistedToDB: true,
    triggersNotification: true,
    triggersTelegram: true,
  },
  {
    type: "PAYMENT_FAILED",
    nameAr: "فشل عملية دفع",
    category: "financial",
    emittedBy: ["payments.ts", "stripeWebhook.ts"],
    listeners: ["notificationListener", "financeListener"],
    automations: ["إرسال تنبيه للمكتب"],
    persistedToDB: true,
    triggersNotification: true,
  },
  {
    type: "PAYMENT_SETTLED",
    nameAr: "تسوية دفعة",
    category: "financial",
    emittedBy: ["payments.ts"],
    listeners: ["financeListener"],
    automations: ["تحديث settlement_status في payment_transactions"],
    persistedToDB: true,
    triggersNotification: false,
  },

  /* ══ الإفلاس ══════════════════════════════════════════════ */
  {
    type: "BK_CASE_CREATED",
    nameAr: "إنشاء قضية إفلاس",
    category: "bankruptcy",
    emittedBy: ["bankruptcy.ts"],
    listeners: ["analyticsListener", "telegramListener"],
    automations: ["حفظ تقرير في Object Storage", "إرسال إشعار تيليجرام"],
    persistedToDB: true,
    triggersTelegram: true,
  },
  {
    type: "BK_CASE_CLOSED",
    nameAr: "إغلاق قضية إفلاس",
    category: "bankruptcy",
    emittedBy: ["bankruptcy.ts"],
    listeners: ["analyticsListener", "telegramListener"],
    automations: ["تحديث حالة المستفيدين", "إغلاق المستندات المرتبطة"],
    persistedToDB: true,
    triggersTelegram: true,
  },

  /* ══ الأحداث الإضافية ═══════════════════════════════════════ */
  {
    type: "CONTRACT_SIGNED",
    nameAr: "توقيع عقد",
    category: "legal",
    emittedBy: ["signatures.ts"],
    listeners: ["notificationListener", "analyticsListener"],
    automations: ["إرسال نسخة موقّعة للعميل", "تحديث حالة المستند"],
    persistedToDB: true,
    triggersNotification: true,
    triggersEmail: true,
    description: "يُصدَر عند اكتمال التوقيع الإلكتروني",
  },
  {
    type: "REMINDER_DUE",
    nameAr: "حلول تذكير",
    category: "notification",
    emittedBy: ["emailCron.ts"],
    listeners: ["notificationListener"],
    automations: ["إرسال بريد تذكير", "تحديث حالة التذكير"],
    persistedToDB: true,
    triggersEmail: true,
  },
  {
    type: "PORTAL_UPDATED",
    nameAr: "تحديث بوابة العميل",
    category: "legal",
    emittedBy: ["clientPortal.ts"],
    listeners: ["notificationListener"],
    automations: ["إشعار العميل بالتحديث"],
    persistedToDB: true,
    triggersNotification: false,
  },
  {
    type: "AI_QUERY",
    nameAr: "استعلام ذكاء اصطناعي",
    category: "ai",
    emittedBy: ["aiGateway.ts", "aiChat.ts"],
    listeners: ["analyticsListener"],
    automations: ["خصم رصيد AI Credits", "تسجيل في ai_tasks"],
    persistedToDB: true,
    triggersNotification: false,
    description: "يُصدَر مع كل استدعاء للذكاء الاصطناعي",
  },
  {
    type: "SUBSCRIPTION_RENEWED",
    nameAr: "تجديد الاشتراك",
    category: "system",
    emittedBy: ["stripeWebhook.ts"],
    listeners: ["entitlementsListener", "notificationListener"],
    automations: ["تحديث تاريخ انتهاء الباقة", "إرسال إيصال"],
    persistedToDB: true,
    triggersEmail: true,
    description: "يُصدَر عند تجديد الاشتراك الشهري/السنوي",
  },

  {
    type: "SUBSCRIPTION_EXPIRED",
    nameAr: "انتهاء الاشتراك",
    category: "system",
    emittedBy: ["billing.ts", "stripeWebhook.ts"],
    listeners: ["entitlementsListener", "notificationListener"],
    automations: ["تخفيض الصلاحيات لباقة trial", "إرسال تنبيه للمكتب"],
    persistedToDB: true,
    triggersEmail: true,
  },
  {
    type: "USER_LOGIN",
    nameAr: "تسجيل دخول مستخدم",
    category: "system",
    emittedBy: ["requireAuth.ts"],
    listeners: ["analyticsListener"],
    automations: ["تسجيل في login_logs"],
    persistedToDB: true,
    triggersNotification: false,
  },
  {
    type: "DOCUMENT_GENERATED",
    nameAr: "إنشاء مستند",
    category: "legal",
    emittedBy: ["legalAI.ts", "smartDocuments.ts"],
    listeners: ["analyticsListener"],
    automations: ["حفظ في Object Storage", "خصم رصيد AI"],
    persistedToDB: true,
    triggersNotification: false,
  },
  {
    type: "SESSION_REMINDER",
    nameAr: "تذكير جلسة",
    category: "notification",
    emittedBy: ["emailCron.ts"],
    listeners: ["notificationListener"],
    automations: ["إرسال بريد تذكير بموعد الجلسة"],
    persistedToDB: true,
    triggersEmail: true,
  },
  {
    type: "TASK_DUE",
    nameAr: "استحقاق مهمة",
    category: "legal",
    emittedBy: ["emailCron.ts"],
    listeners: ["notificationListener"],
    automations: ["إرسال تذكير بالمهمة المستحقة"],
    persistedToDB: true,
    triggersEmail: true,
  },

  /* ══ النظام ════════════════════════════════════════════════ */
  {
    type: "OFFICE_CREATED",
    nameAr: "إنشاء مكتب",
    category: "system",
    emittedBy: ["onboarding.ts"],
    listeners: ["analyticsListener"],
    automations: ["تهيئة إعدادات المكتب الافتراضية", "بدء فترة التجربة"],
    persistedToDB: true,
    triggersEmail: true,
  },
  {
    type: "SUBSCRIPTION_CHANGED",
    nameAr: "تغيير الاشتراك",
    category: "system",
    emittedBy: ["billing.ts", "stripeWebhook.ts"],
    listeners: ["entitlementsListener", "notificationListener"],
    automations: ["تحديث feature flags", "إرسال إيصال"],
    persistedToDB: true,
    triggersEmail: true,
  },
];

/* ── Helpers ─────────────────────────────────────────────── */
export const EVENT_TYPES = EVENTS_REGISTRY.map(e => e.type);

export function getEvent(type: string): EventDefinition | undefined {
  return EVENTS_REGISTRY.find(e => e.type === type);
}

export function getEventsByCategory(category: EventCategory): EventDefinition[] {
  return EVENTS_REGISTRY.filter(e => e.category === category);
}

export function getEventsWithTelegram(): EventDefinition[] {
  return EVENTS_REGISTRY.filter(e => e.triggersTelegram);
}

export function isValidEventType(type: string): boolean {
  return EVENT_TYPES.includes(type);
}
