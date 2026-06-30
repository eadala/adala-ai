/**
 * Integrations Registry — عدالة AI Platform
 * السجل المركزي لجميع التكاملات الخارجية
 *
 * كل تكامل موثَّق بحالته وإعداداته ومتطلبات الأمان
 * المرجع الوحيد — /api/integrations ومنطق الإشعارات يعتمدان عليه
 */

export type IntegrationStatus = "active" | "configurable" | "planned" | "deprecated";
export type IntegrationCategory =
  | "communication"
  | "payment"
  | "government"
  | "storage"
  | "auth"
  | "analytics"
  | "ai"
  | "erp";

export interface IntegrationDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  requiredEnvVars: string[];       // متغيرات البيئة المطلوبة
  optionalEnvVars?: string[];
  webhookPath?: string;            // مسار webhook إذا وُجد
  apiRoutes?: string[];            // API routes المرتبطة
  settingsPage?: string;           // صفحة الإعدادات
  dbTable?: string;                // جدول DB المرتبط
  plans: string[];                 // الباقات التي تدعمه
  hasWebhook?: boolean;
  webhookSecurity?: string;        // آلية الأمان: "hmac" | "token" | "signature"
  retryPolicy?: string;
  description?: string;
}

export const INTEGRATIONS_REGISTRY: IntegrationDefinition[] = [

  /* ══ الاتصالات ═════════════════════════════════════════════ */
  {
    id: "whatsapp",
    nameAr: "واتساب للأعمال",
    nameEn: "WhatsApp Business API",
    category: "communication",
    status: "configurable",
    requiredEnvVars: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_APP_SECRET"],
    webhookPath: "/api/whatsapp/webhook",
    apiRoutes: ["/api/whatsapp/*"],
    settingsPage: "/whatsapp-settings",
    dbTable: "whatsapp_settings",
    plans: ["professional", "enterprise"],
    hasWebhook: true,
    webhookSecurity: "hmac-sha256 X-Hub-Signature-256",
    retryPolicy: "3x exponential backoff",
    description: "إرسال الإشعارات ومتابعة القضايا عبر واتساب",
  },
  {
    id: "telegram",
    nameAr: "تيليجرام",
    nameEn: "Telegram Bot API",
    category: "communication",
    status: "configurable",
    requiredEnvVars: ["TELEGRAM_BOT_TOKEN"],
    optionalEnvVars: ["TELEGRAM_CHAT_ID"],
    webhookPath: "/api/telegram/webhook",
    apiRoutes: ["/api/telegram/*"],
    settingsPage: "/telegram-settings",
    dbTable: "telegram_settings",
    plans: ["professional", "enterprise"],
    hasWebhook: false,
    description: "إشعارات فورية للقضايا والفواتير والأحداث المهمة",
  },
  {
    id: "email-smtp",
    nameAr: "البريد الإلكتروني (SMTP)",
    nameEn: "SMTP Email",
    category: "communication",
    status: "active",
    requiredEnvVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"],
    apiRoutes: ["/api/email/*"],
    plans: ["starter", "professional", "enterprise"],
    hasWebhook: false,
    description: "إرسال الفواتير والتذكيرات والإشعارات بالبريد",
  },

  /* ══ المدفوعات ═════════════════════════════════════════════ */
  {
    id: "stripe",
    nameAr: "Stripe",
    nameEn: "Stripe Payments",
    category: "payment",
    status: "active",
    requiredEnvVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    optionalEnvVars: ["STRIPE_PLATFORM_COMMISSION_PERCENT"],
    webhookPath: "/api/billing/stripe-webhook",
    apiRoutes: ["/api/billing/*", "/api/payments/*"],
    settingsPage: "/payment-center",
    dbTable: "office_stripe_accounts",
    plans: ["starter", "professional", "enterprise"],
    hasWebhook: true,
    webhookSecurity: "stripe-signature header",
    retryPolicy: "Stripe retries automatically for 72h",
    description: "الدفع الإلكتروني، الاشتراكات، Stripe Connect",
  },
  {
    id: "moyasar",
    nameAr: "Moyasar (مدى وأبل باي)",
    nameEn: "Moyasar Payment Gateway",
    category: "payment",
    status: "configurable",
    requiredEnvVars: ["MOYASAR_SECRET_KEY", "MOYASAR_PUBLISHABLE_KEY"],
    webhookPath: "/api/fincore/moyasar-webhook",
    apiRoutes: ["/api/fincore/moyasar/*"],
    settingsPage: "/financial-core",
    plans: ["professional", "enterprise"],
    hasWebhook: true,
    webhookSecurity: "timingSafeEqual + X-Moyasar-Signature",
    description: "بوابة دفع MENA — مدى، أبل باي، Visa، Mastercard",
  },
  {
    id: "checkout-com",
    nameAr: "Checkout.com",
    nameEn: "Checkout.com",
    category: "payment",
    status: "planned",
    requiredEnvVars: ["CHECKOUT_SECRET_KEY", "CHECKOUT_PUBLIC_KEY"],
    plans: ["enterprise"],
    hasWebhook: true,
    description: "بوابة دفع مؤسسية — Mada، Apple Pay، Tabby، Tamara",
  },

  /* ══ التخزين ═══════════════════════════════════════════════ */
  {
    id: "object-storage",
    nameAr: "التخزين السحابي",
    nameEn: "Replit Object Storage",
    category: "storage",
    status: "active",
    requiredEnvVars: ["DEFAULT_OBJECT_STORAGE_BUCKET_ID"],
    optionalEnvVars: ["PRIVATE_OBJECT_DIR", "PUBLIC_OBJECT_SEARCH_PATHS"],
    apiRoutes: ["/api/storage/*", "/api/documents/*"],
    dbTable: "storage_files",
    plans: ["starter", "professional", "enterprise"],
    hasWebhook: false,
    description: "تخزين المستندات والصور والنسخ الاحتياطية",
  },

  /* ══ الحكومة والجهات الرسمية ════════════════════════════════ */
  {
    id: "najiz",
    nameAr: "ناجز — وزارة العدل السعودية",
    nameEn: "Najiz — Saudi MOJ",
    category: "government",
    status: "planned",
    requiredEnvVars: ["NAJIZ_API_KEY", "NAJIZ_CLIENT_ID"],
    plans: ["enterprise"],
    description: "استعلام عن القضايا وتقديم الطلبات إلكترونياً",
  },
  {
    id: "zatca",
    nameAr: "هيئة الزكاة والضريبة والجمارك",
    nameEn: "ZATCA e-Invoicing",
    category: "government",
    status: "configurable",
    requiredEnvVars: ["ZATCA_API_KEY", "ZATCA_CERT"],
    apiRoutes: ["/api/financial-completions/zatca/*"],
    plans: ["professional", "enterprise"],
    description: "الفوترة الإلكترونية ZATCA — المرحلة الثانية",
  },

  /* ══ الذكاء الاصطناعي ════════════════════════════════════════ */
  {
    id: "gemini-ai",
    nameAr: "Gemini AI (Google)",
    nameEn: "Google Gemini",
    category: "ai",
    status: "active",
    requiredEnvVars: ["GEMINI_API_KEY"],
    apiRoutes: ["/api/ai-gateway/*"],
    plans: ["starter", "professional", "enterprise"],
    description: "النموذج الأساسي للذكاء الاصطناعي في المنصة",
  },
  {
    id: "anthropic-ai",
    nameAr: "Claude AI (Anthropic)",
    nameEn: "Anthropic Claude",
    category: "ai",
    status: "configurable",
    requiredEnvVars: ["ANTHROPIC_API_KEY"],
    apiRoutes: ["/api/ai-gateway/*"],
    plans: ["professional", "enterprise"],
    description: "نموذج بديل للمهام المعقدة والمستندات الطويلة",
  },
  {
    id: "openai",
    nameAr: "OpenAI GPT",
    nameEn: "OpenAI GPT-4",
    category: "ai",
    status: "configurable",
    requiredEnvVars: ["OPENAI_API_KEY"],
    apiRoutes: ["/api/ai-gateway/*"],
    plans: ["professional", "enterprise"],
    description: "نموذج بديل للمحادثة والتحليل",
  },

  /* ══ المصادقة ══════════════════════════════════════════════ */
  {
    id: "clerk",
    nameAr: "Clerk — إدارة المستخدمين",
    nameEn: "Clerk Authentication",
    category: "auth",
    status: "active",
    requiredEnvVars: ["VITE_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    apiRoutes: ["/api/__clerk/*"],
    plans: ["trial", "starter", "professional", "enterprise"],
    hasWebhook: true,
    webhookSecurity: "svix signature",
    description: "تسجيل الدخول، MFA، إدارة الجلسات، Google OAuth",
  },

  /* ══ GitHub ════════════════════════════════════════════════ */
  {
    id: "github",
    nameAr: "GitHub",
    nameEn: "GitHub",
    category: "erp",
    status: "active",
    requiredEnvVars: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
    plans: ["enterprise"],
    description: "Push إلى GitHub لحفظ الكود في المستودع",
  },
];

/* ── Helpers ─────────────────────────────────────────────── */
export function getIntegration(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS_REGISTRY.find(i => i.id === id);
}

export function getActiveIntegrations(): IntegrationDefinition[] {
  return INTEGRATIONS_REGISTRY.filter(i => i.status === "active");
}

export function getIntegrationsByCategory(cat: IntegrationCategory): IntegrationDefinition[] {
  return INTEGRATIONS_REGISTRY.filter(i => i.category === cat);
}

export function getIntegrationsForPlan(plan: string): IntegrationDefinition[] {
  return INTEGRATIONS_REGISTRY.filter(i => i.plans.includes(plan));
}

export function getWebhookIntegrations(): IntegrationDefinition[] {
  return INTEGRATIONS_REGISTRY.filter(i => i.hasWebhook);
}

export function getMissingEnvVars(integrationId: string, env: Record<string, string | undefined>): string[] {
  const integration = getIntegration(integrationId);
  if (!integration) return [];
  return integration.requiredEnvVars.filter(k => !env[k]);
}
