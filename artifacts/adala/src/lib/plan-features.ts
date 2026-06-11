export type PlanSlug = "starter" | "professional" | "business" | "enterprise";

export interface PlanFeatures {
  customDomain: boolean;
  clientPortal: boolean;
  legalStore: boolean;
  officePage: boolean;
  apiAccess: boolean;
  branches: number | "unlimited";
  aiRequests: number | "unlimited";
  users: number | "unlimited";
  storage: string;
  cases: number | "unlimited";
  whatsappBusiness: boolean;
  advancedReports: boolean;
  sla: string;
  label: string;
  color: string;
}

export const PLAN_FEATURES: Record<PlanSlug, PlanFeatures> = {
  starter: {
    label: "مبتدئ",
    color: "#3B82F6",
    customDomain: false,
    clientPortal: false,
    legalStore: false,
    officePage: false,
    apiAccess: false,
    branches: 0,
    aiRequests: 20,
    users: 2,
    storage: "5 GB",
    cases: 20,
    whatsappBusiness: false,
    advancedReports: false,
    sla: "بريد إلكتروني",
  },
  professional: {
    label: "احترافي",
    color: "#C9A84C",
    customDomain: false,
    clientPortal: false,
    legalStore: true,
    officePage: true,
    apiAccess: false,
    branches: 0,
    aiRequests: 100,
    users: 5,
    storage: "25 GB",
    cases: 100,
    whatsappBusiness: false,
    advancedReports: true,
    sla: "دعم أولوي",
  },
  business: {
    label: "أعمال",
    color: "#8B5CF6",
    customDomain: true,
    clientPortal: true,
    legalStore: true,
    officePage: true,
    apiAccess: true,
    branches: 3,
    aiRequests: "unlimited",
    users: 15,
    storage: "100 GB",
    cases: "unlimited",
    whatsappBusiness: true,
    advancedReports: true,
    sla: "٨ ساعات",
  },
  enterprise: {
    label: "مؤسسي",
    color: "#10B981",
    customDomain: true,
    clientPortal: true,
    legalStore: true,
    officePage: true,
    apiAccess: true,
    branches: "unlimited",
    aiRequests: "unlimited",
    users: "unlimited",
    storage: "غير محدود",
    cases: "unlimited",
    whatsappBusiness: true,
    advancedReports: true,
    sla: "٢٤/٧",
  },
};

export function getPlanFeatures(plan?: string | null): PlanFeatures {
  const slug = (plan ?? "starter") as PlanSlug;
  return PLAN_FEATURES[slug] ?? PLAN_FEATURES.starter;
}

export function canUseFeature(plan: string | null | undefined, feature: keyof PlanFeatures): boolean {
  const f = getPlanFeatures(plan);
  const val = f[feature];
  return val === true || (typeof val === "number" && val > 0) || val === "unlimited";
}

export function generateSubdomain(slug: string): string {
  return `${slug}.adala-ai.sa`;
}
