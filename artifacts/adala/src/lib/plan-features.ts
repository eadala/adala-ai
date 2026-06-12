export type PlanSlug = "free" | "basic" | "pro" | "growth" | "advanced" | "enterprise" | "elite";

export interface PlanFeatures {
  /* ── Core (all plans) ── */
  cases: boolean;
  invoices: boolean;
  reminders: boolean;
  calendar: boolean;
  exportPdf: boolean;
  aiBasic: boolean;
  reportsBasic: boolean;
  /* ── Basic+ ── */
  website: boolean;
  serviceStore: boolean;
  payments: boolean;
  contractsAi: boolean;
  mobileApp: boolean;
  documentTemplates: boolean;
  /* ── Pro+ ── */
  ai: boolean;
  aiAnalytics: boolean;
  reportsAdvanced: boolean;
  ocr: boolean;
  backup: boolean;
  /* ── Growth+ ── */
  clientPortal: boolean;
  branches: number | "unlimited";
  whatsapp: boolean;
  workflow: boolean;
  /* ── Advanced+ ── */
  customDomain: boolean;
  apiAccess: boolean;
  aiCfo: boolean;
  whiteLabel: boolean;
  /* ── Enterprise+ ── */
  sla: boolean;
  dedicatedManager: boolean;
  /* ── Elite only ── */
  customAiTraining: boolean;
  priorityInfrastructure: boolean;
  /* ── Meta ── */
  users: number | "unlimited";
  storage: string;
  aiRequests: number | "unlimited";
  label: string;
  labelEn: string;
  color: string;
  slaValue: string;
}

export const PLAN_FEATURES: Record<PlanSlug, PlanFeatures> = {
  free: {
    label: "مجاني", labelEn: "Free", color: "#64748B",
    cases: true, invoices: true, reminders: true, calendar: true,
    exportPdf: true, aiBasic: true, reportsBasic: true,
    website: false, serviceStore: false, payments: false,
    contractsAi: false, mobileApp: false, documentTemplates: false,
    ai: false, aiAnalytics: false, reportsAdvanced: false, ocr: false, backup: false,
    clientPortal: false, branches: 0, whatsapp: false, workflow: false,
    customDomain: false, apiAccess: false, aiCfo: false, whiteLabel: false,
    sla: false, dedicatedManager: false,
    customAiTraining: false, priorityInfrastructure: false,
    users: 1, storage: "١ GB", aiRequests: 5, slaValue: "بريد إلكتروني",
  },
  basic: {
    label: "مبتدئ", labelEn: "Basic", color: "#3B82F6",
    cases: true, invoices: true, reminders: true, calendar: true,
    exportPdf: true, aiBasic: true, reportsBasic: true,
    website: true, serviceStore: true, payments: true,
    contractsAi: true, mobileApp: true, documentTemplates: true,
    ai: false, aiAnalytics: false, reportsAdvanced: false, ocr: false, backup: false,
    clientPortal: false, branches: 0, whatsapp: false, workflow: false,
    customDomain: false, apiAccess: false, aiCfo: false, whiteLabel: false,
    sla: false, dedicatedManager: false,
    customAiTraining: false, priorityInfrastructure: false,
    users: 2, storage: "٥ GB", aiRequests: 20, slaValue: "بريد إلكتروني",
  },
  pro: {
    label: "احترافي", labelEn: "Professional", color: "#C9A84C",
    cases: true, invoices: true, reminders: true, calendar: true,
    exportPdf: true, aiBasic: true, reportsBasic: true,
    website: true, serviceStore: true, payments: true,
    contractsAi: true, mobileApp: true, documentTemplates: true,
    ai: true, aiAnalytics: true, reportsAdvanced: true, ocr: true, backup: true,
    clientPortal: false, branches: 0, whatsapp: false, workflow: false,
    customDomain: false, apiAccess: false, aiCfo: false, whiteLabel: false,
    sla: false, dedicatedManager: false,
    customAiTraining: false, priorityInfrastructure: false,
    users: 5, storage: "٢٥ GB", aiRequests: 100, slaValue: "دعم أولوي",
  },
  growth: {
    label: "نمو", labelEn: "Growth", color: "#8B5CF6",
    cases: true, invoices: true, reminders: true, calendar: true,
    exportPdf: true, aiBasic: true, reportsBasic: true,
    website: true, serviceStore: true, payments: true,
    contractsAi: true, mobileApp: true, documentTemplates: true,
    ai: true, aiAnalytics: true, reportsAdvanced: true, ocr: true, backup: true,
    clientPortal: true, branches: 3, whatsapp: true, workflow: true,
    customDomain: false, apiAccess: false, aiCfo: false, whiteLabel: false,
    sla: false, dedicatedManager: false,
    customAiTraining: false, priorityInfrastructure: false,
    users: 15, storage: "١٠٠ GB", aiRequests: 300, slaValue: "٨ ساعات",
  },
  advanced: {
    label: "متقدم", labelEn: "Advanced", color: "#EC4899",
    cases: true, invoices: true, reminders: true, calendar: true,
    exportPdf: true, aiBasic: true, reportsBasic: true,
    website: true, serviceStore: true, payments: true,
    contractsAi: true, mobileApp: true, documentTemplates: true,
    ai: true, aiAnalytics: true, reportsAdvanced: true, ocr: true, backup: true,
    clientPortal: true, branches: 10, whatsapp: true, workflow: true,
    customDomain: true, apiAccess: true, aiCfo: true, whiteLabel: true,
    sla: false, dedicatedManager: false,
    customAiTraining: false, priorityInfrastructure: false,
    users: 30, storage: "٢٠٠ GB", aiRequests: 1000, slaValue: "٤ ساعات",
  },
  enterprise: {
    label: "مؤسسي", labelEn: "Enterprise", color: "#10B981",
    cases: true, invoices: true, reminders: true, calendar: true,
    exportPdf: true, aiBasic: true, reportsBasic: true,
    website: true, serviceStore: true, payments: true,
    contractsAi: true, mobileApp: true, documentTemplates: true,
    ai: true, aiAnalytics: true, reportsAdvanced: true, ocr: true, backup: true,
    clientPortal: true, branches: "unlimited", whatsapp: true, workflow: true,
    customDomain: true, apiAccess: true, aiCfo: true, whiteLabel: true,
    sla: true, dedicatedManager: true,
    customAiTraining: false, priorityInfrastructure: false,
    users: 100, storage: "١ تيرابايت", aiRequests: "unlimited", slaValue: "٢٤/٧",
  },
  elite: {
    label: "النخبة", labelEn: "Elite", color: "#F59E0B",
    cases: true, invoices: true, reminders: true, calendar: true,
    exportPdf: true, aiBasic: true, reportsBasic: true,
    website: true, serviceStore: true, payments: true,
    contractsAi: true, mobileApp: true, documentTemplates: true,
    ai: true, aiAnalytics: true, reportsAdvanced: true, ocr: true, backup: true,
    clientPortal: true, branches: "unlimited", whatsapp: true, workflow: true,
    customDomain: true, apiAccess: true, aiCfo: true, whiteLabel: true,
    sla: true, dedicatedManager: true,
    customAiTraining: true, priorityInfrastructure: true,
    users: "unlimited", storage: "غير محدود", aiRequests: "unlimited", slaValue: "٢٤/٧ + SLA ٩٩.٩٩٪",
  },
};

export function getPlanFeatures(plan?: string | null): PlanFeatures {
  const slug = (plan ?? "free") as PlanSlug;
  return PLAN_FEATURES[slug] ?? PLAN_FEATURES.free;
}

export function canUseFeature(plan: string | null | undefined, feature: keyof PlanFeatures): boolean {
  const f = getPlanFeatures(plan);
  const val = f[feature];
  return val === true || (typeof val === "number" && val > 0) || val === "unlimited";
}

export function generateSubdomain(slug: string): string {
  return `${slug}.adala-ai.sa`;
}

/* Plan order for display/comparison */
export const PLAN_ORDER: PlanSlug[] = ["free", "basic", "pro", "growth", "advanced", "enterprise", "elite"];
