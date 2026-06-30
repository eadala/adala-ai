/**
 * Feature Flags Registry — عدالة AI Platform
 * السجل المركزي لجميع Feature Flags وارتباطها بالباقات
 *
 * كل ميزة مسجّلة بالباقات التي تدعمها والـ Routes/APIs المرتبطة
 * المرجع الوحيد — useOfficePlan() و requireFeature() يعتمدان عليه
 */

export type PlanLevel = "trial" | "starter" | "professional" | "enterprise" | "bankruptcy";

export interface FeatureFlagDefinition {
  key: string;                      // المفتاح الداخلي
  nameAr: string;                   // الاسم العربي
  description?: string;
  plans: PlanLevel[];               // الباقات التي تدعم الميزة
  routes?: string[];                // Routes التي تحتاجها
  apiPaths?: string[];              // API paths المرتبطة
  limits?: Record<PlanLevel, number | "unlimited" | null>; // حدود الاستخدام
  isDefault?: boolean;              // مفعّلة للجميع؟
}

export const FEATURE_FLAGS_REGISTRY: FeatureFlagDefinition[] = [

  /* ══ الميزات الأساسية (لجميع الباقات) ═══════════════════ */
  {
    key: "cases",
    nameAr: "إدارة القضايا",
    plans: ["trial", "starter", "professional", "enterprise"],
    routes: ["/cases", "/cases/:id"],
    limits: { trial: 5, starter: 50, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
    isDefault: true,
  },
  {
    key: "clients",
    nameAr: "إدارة العملاء",
    plans: ["trial", "starter", "professional", "enterprise"],
    routes: ["/clients", "/clients/:id"],
    limits: { trial: 10, starter: 100, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
    isDefault: true,
  },
  {
    key: "documents",
    nameAr: "إدارة المستندات",
    plans: ["trial", "starter", "professional", "enterprise"],
    routes: ["/documents", "/contracts", "/letters"],
    limits: { trial: 20, starter: 200, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
    isDefault: true,
  },
  {
    key: "invoices",
    nameAr: "الفواتير",
    plans: ["trial", "starter", "professional", "enterprise"],
    routes: ["/invoices"],
    limits: { trial: 10, starter: "unlimited", professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
    isDefault: true,
  },

  /* ══ الميزات المميزة (starter+) ══════════════════════════ */
  {
    key: "ai",
    nameAr: "الذكاء الاصطناعي",
    plans: ["starter", "professional", "enterprise"],
    routes: ["/ai-hub", "/ai-coo", "/legal-ai", "/opponent-simulator"],
    apiPaths: ["/api/ai-chat/*", "/api/legal-ai/*", "/api/ai-gateway/*"],
    limits: { trial: null, starter: 100, professional: 1000, enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "jlwm",
    nameAr: "مركز القيادة القانونية",
    description: "JLWM — نظام الذكاء القانوني المتكامل",
    plans: ["professional", "enterprise"],
    routes: ["/jlwm", "/jlwm/*"],
    apiPaths: ["/api/jlwm/*"],
    limits: { trial: null, starter: null, professional: 50, enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "hrModule",
    nameAr: "الموارد البشرية",
    plans: ["starter", "professional", "enterprise"],
    routes: ["/employees", "/attendance", "/leaves", "/payroll", "/hr-center"],
    limits: { trial: null, starter: 10, professional: 50, enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "financialReports",
    nameAr: "التقارير المالية",
    plans: ["starter", "professional", "enterprise"],
    routes: ["/financial-reports", "/financial-statements"],
    apiPaths: ["/api/accounting/reports/*"],
    limits: { trial: null, starter: "unlimited", professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
  },

  /* ══ الميزات المؤسسية (professional+) ════════════════════ */
  {
    key: "clientPortal",
    nameAr: "بوابة العميل",
    plans: ["professional", "enterprise"],
    routes: ["/client-portal", "/portal/:token"],
    apiPaths: ["/api/portal/*", "/api/client-auth/*"],
    limits: { trial: null, starter: null, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "serviceStore",
    nameAr: "متجر الخدمات",
    plans: ["professional", "enterprise"],
    routes: ["/marketplace", "/firms/:slug/store"],
    limits: { trial: null, starter: null, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "calendar",
    nameAr: "التقويم المتقدم",
    plans: ["starter", "professional", "enterprise"],
    routes: ["/calendar"],
    isDefault: false,
  },
  {
    key: "whatsapp",
    nameAr: "تكامل واتساب",
    plans: ["professional", "enterprise"],
    routes: ["/whatsapp-settings"],
    apiPaths: ["/api/whatsapp/*"],
    limits: { trial: null, starter: null, professional: 500, enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "telegram",
    nameAr: "تكامل تيليجرام",
    plans: ["professional", "enterprise"],
    routes: ["/telegram-settings"],
    apiPaths: ["/api/telegram/*"],
    limits: { trial: null, starter: null, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "bankruptcy",
    nameAr: "وحدة الإفلاس",
    plans: ["enterprise", "bankruptcy"],
    routes: ["/bankruptcy", "/bankruptcy/:section"],
    apiPaths: ["/api/bankruptcy/*"],
    limits: { trial: null, starter: null, professional: null, enterprise: "unlimited", bankruptcy: "unlimited" },
  },
  {
    key: "backup",
    nameAr: "النسخ الاحتياطي التلقائي",
    plans: ["professional", "enterprise"],
    routes: ["/backup"],
    apiPaths: ["/api/backup/*"],
    limits: { trial: null, starter: null, professional: 7, enterprise: 90, bankruptcy: null },
    description: "عدد الأيام للاحتفاظ بالنسخ",
  },
  {
    key: "websiteBuilder",
    nameAr: "منشئ الموقع",
    plans: ["professional", "enterprise"],
    routes: ["/website-builder"],
    limits: { trial: null, starter: null, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "aiCredits",
    nameAr: "رصيد الذكاء الاصطناعي",
    plans: ["starter", "professional", "enterprise"],
    apiPaths: ["/api/ai-credits/*"],
    limits: { trial: null, starter: 100, professional: 500, enterprise: 2000, bankruptcy: null },
  },

  /* ══ ميزات إضافية (subscription.ts) ════════════════════════ */
  {
    key: "exportPdf",
    nameAr: "تصدير PDF",
    plans: ["starter", "professional", "enterprise"],
    limits: { trial: null, starter: 50, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "website",
    nameAr: "الموقع الإلكتروني للمكتب",
    plans: ["professional", "enterprise"],
    routes: ["/website-builder", "/office-management"],
    limits: { trial: null, starter: null, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "contractsAi",
    nameAr: "تحليل العقود بالذكاء",
    plans: ["professional", "enterprise"],
    apiPaths: ["/api/legal-ai/contracts/*"],
    limits: { trial: null, starter: null, professional: "unlimited", enterprise: "unlimited", bankruptcy: null },
  },
  {
    key: "customDomain",
    nameAr: "النطاق المخصص",
    plans: ["enterprise"],
    routes: ["/office-management"],
    limits: { trial: null, starter: null, professional: null, enterprise: "unlimited", bankruptcy: null },
    subscription: "enterprise",
  },
  {
    key: "sla",
    nameAr: "اتفاقية مستوى الخدمة",
    plans: ["enterprise"],
    limits: { trial: null, starter: null, professional: null, enterprise: "unlimited", bankruptcy: null },
    subscription: "enterprise",
    description: "SLA مضمون مع وقت استجابة دعم أولوي",
  },
  {
    key: "api",
    nameAr: "وصول API للمطورين",
    plans: ["enterprise"],
    routes: ["/integrations"],
    apiPaths: ["/api/developer/*"],
    limits: { trial: null, starter: null, professional: null, enterprise: "unlimited", bankruptcy: null },
    subscription: "enterprise",
  },
];

/* ── Helpers ─────────────────────────────────────────────── */
export const FEATURE_KEYS = FEATURE_FLAGS_REGISTRY.map(f => f.key);

export function isFeatureEnabled(key: string, plan: PlanLevel): boolean {
  const flag = FEATURE_FLAGS_REGISTRY.find(f => f.key === key);
  if (!flag) return false;
  return flag.plans.includes(plan);
}

export function getFeatureLimit(key: string, plan: PlanLevel): number | "unlimited" | null {
  const flag = FEATURE_FLAGS_REGISTRY.find(f => f.key === key);
  if (!flag?.limits) return null;
  return flag.limits[plan] ?? null;
}

export function getFeaturesForPlan(plan: PlanLevel): FeatureFlagDefinition[] {
  return FEATURE_FLAGS_REGISTRY.filter(f => f.plans.includes(plan));
}

export function isValidFeatureKey(key: string): boolean {
  return FEATURE_KEYS.includes(key);
}

export const PLAN_HIERARCHY: PlanLevel[] = ["trial", "starter", "professional", "enterprise"];
