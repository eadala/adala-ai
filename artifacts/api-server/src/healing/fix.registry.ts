import { AnomalyCode } from "../observability/anomaly.detector";

export interface FixDefinition {
  name: string;
  description: string;
  safeForAutoApply: boolean;
  affectsFinancialData: boolean;
  requiresRestart: boolean;
}

export const FIX_REGISTRY: Record<AnomalyCode, FixDefinition> = {
  DB_DOWN: {
    name: "reconnectDatabase",
    description: "إعادة الاتصال بقاعدة البيانات",
    safeForAutoApply: true,
    affectsFinancialData: false,
    requiresRestart: false,
  },
  HIGH_ERROR_RATE: {
    name: "clearRequestQueue",
    description: "تنظيف قائمة انتظار الطلبات وإعادة ضبط العدادات",
    safeForAutoApply: true,
    affectsFinancialData: false,
    requiresRestart: false,
  },
  DB_SLOWDOWN: {
    name: "runDbVacuum",
    description: "تحسين أداء قاعدة البيانات",
    safeForAutoApply: true,
    affectsFinancialData: false,
    requiresRestart: false,
  },
  MEMORY_PRESSURE: {
    name: "garbageCollect",
    description: "تحرير الذاكرة غير المستخدمة",
    safeForAutoApply: true,
    affectsFinancialData: false,
    requiresRestart: false,
  },
  WEBHOOK_SPIKE: {
    name: "resetWebhookCounters",
    description: "إعادة ضبط عدادات Webhook وإعادة المحاولة",
    safeForAutoApply: true,
    affectsFinancialData: false,
    requiresRestart: false,
  },
  HIGH_ACTIVE_REQUESTS: {
    name: "throttleIncoming",
    description: "تفعيل تحديد معدل الطلبات مؤقتاً",
    safeForAutoApply: true,
    affectsFinancialData: false,
    requiresRestart: false,
  },
};

export function canAutoFix(code: AnomalyCode): boolean {
  const fix = FIX_REGISTRY[code];
  return fix?.safeForAutoApply && !fix.affectsFinancialData;
}
