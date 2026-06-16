import {
  ShieldCheck, Building2, Users, Package, Tag, KeyRound, Activity,
  Settings, FolderTree, BookOpen, HeadphonesIcon, Plus,
  Trash2, BarChart3, Crown, Zap, Bell, Lock, Code2, Cpu,
  Server, Fingerprint, Wifi, Database, Shield, Smartphone,
  Gift, Percent, Bot, Radar, Globe, CreditCard, Banknote,
  FileBarChart2, Gavel, FileSignature, ShieldCheck as SecurityIcon,
  Layout, Globe2, AlertOctagon, RotateCcw, ScanLine, Palette,
} from "lucide-react";

export const PLAN_SLUG_COLORS: Record<string, string> = {
  free:         "#64748B",
  basic:        "#3B82F6",
  pro:          "#8B5CF6",
  growth:       "#8B5CF6",
  advanced:     "#EC4899",
  enterprise:   "#10B981",
  elite:        "#F59E0B",
  /* legacy */
  starter:      "#3B82F6",
  professional: "#6366F1",
  business:     "#8B5CF6",
};
export const PLAN_SLUG_LABELS: Record<string, string> = {
  free:         "مجاني",
  basic:        "مبتدئ",
  pro:          "احترافي",
  growth:       "نمو",
  advanced:     "متقدم",
  enterprise:   "مؤسسي",
  elite:        "النخبة",
  /* legacy */
  starter:      "مبتدئ (قديم)",
  professional: "احترافي (قديم)",
  business:     "أعمال (قديم)",
};

/* Arabic → Latin slug suggestion helper */
export function arabicToSlug(name: string): string {
  const map: Record<string, string> = {
    'ا':'a','أ':'a','إ':'a','آ':'aa','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
    'د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z',
    'ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w',
    'ي':'y','ى':'a','ة':'a','ء':'','ئ':'y','ؤ':'w','لا':'la','ال':'al',
  };
  let result = '';
  for (const ch of name) {
    if (map[ch] !== undefined) result += map[ch];
    else if (/[a-z0-9]/i.test(ch)) result += ch.toLowerCase();
    else if (/\s/.test(ch)) result += '-';
  }
  return result.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || `office-${Date.now().toString(36)}`;
}

export const PLAN_FEATURE_FLAGS = [
  /* ── Core ── */
  { key: "website",         label: "الموقع الإلكتروني",        icon: "🌐", desc: "صفحة تعريفية عامة للمكتب" },
  { key: "serviceStore",    label: "متجر الخدمات",             icon: "🛒", desc: "بيع الخدمات والاستشارات أونلاين" },
  { key: "payments",        label: "الدفع الإلكتروني",         icon: "💳", desc: "استقبال المدفوعات من العملاء" },
  { key: "booking",         label: "الحجوزات",                  icon: "📆", desc: "نظام حجز المواعيد الاستشارية" },
  { key: "calendar",        label: "التقويم القانوني",         icon: "📅", desc: "جدولة المواعيد والجلسات" },
  /* ── Marketing ── */
  { key: "blog",            label: "المدونة القانونية",         icon: "📝", desc: "نشر مقالات ومحتوى قانوني" },
  { key: "seo",             label: "تحسين SEO",                 icon: "🔍", desc: "تحسين الظهور في محركات البحث" },
  { key: "customDomain",    label: "دومين خاص",                icon: "🔗", desc: "نطاق إنترنت مخصص للمكتب" },
  /* ── Intelligence ── */
  { key: "ai",              label: "الذكاء الاصطناعي",         icon: "🤖", desc: "تحليل قانوني وتوليد وثائق" },
  { key: "ocr",             label: "OCR المستندات",             icon: "📄", desc: "استخراج نصوص من المستندات الممسوحة" },
  { key: "assistant",       label: "المساعد الإداري",          icon: "🧠", desc: "مساعد ذكي للمهام الإدارية اليومية" },
  /* ── Portal ── */
  { key: "clientPortal",    label: "بوابة العملاء",             icon: "👥", desc: "منصة متابعة مخصصة للعملاء" },
  { key: "advancedReports", label: "تقارير متقدمة",            icon: "📊", desc: "تحليلات وتقارير تفصيلية" },
  /* ── Enterprise ── */
  { key: "api",             label: "API Access",                icon: "⚡", desc: "ربط التطبيقات والأنظمة الخارجية" },
  { key: "whatsapp",        label: "واتساب أعمال",             icon: "💬", desc: "تواصل تلقائي عبر واتساب" },
  { key: "branches",        label: "فروع متعددة",              icon: "🏢", desc: "إدارة عدة فروع للمكتب" },
  { key: "workflow",        label: "Workflow آلي",              icon: "⚙️", desc: "مسارات عمل تلقائية متقدمة" },
  { key: "sla",             label: "SLA مميّز",                 icon: "🛡️", desc: "ضمان مستوى خدمة مميّز" },
  { key: "whiteLabel",      label: "White Label",               icon: "🏷️", desc: "إزالة علامة عدالة AI من الواجهة" },
];

export const TABS = [
  { id: "overview",     label: "نظرة عامة",        icon: BarChart3 },
  { id: "offices",      label: "المكاتب",            icon: Building2 },
  { id: "users",        label: "المستخدمون",         icon: Users },
  { id: "cases",        label: "القضايا",            icon: Gavel },
  { id: "contracts",    label: "العقود",             icon: FileSignature },
  { id: "finance",      label: "المالية",            icon: Banknote },
  { id: "reports",      label: "التقارير",           icon: FileBarChart2 },
  { id: "plans",        label: "الباقات",            icon: Package },
  { id: "discounts",    label: "الخصومات",           icon: Tag },
  { id: "ai-keys",      label: "مفاتيح AI",          icon: KeyRound },
  { id: "ai-credits",   label: "رصيد AI",             icon: Zap },
  { id: "usage",        label: "الاستهلاك",          icon: Activity },
  { id: "departments",  label: "الأقسام",            icon: FolderTree },
  { id: "legal",        label: "الأنظمة",            icon: BookOpen },
  { id: "support",      label: "الدعم الفني",        icon: HeadphonesIcon },
  { id: "security",     label: "الأمن",              icon: SecurityIcon },
  { id: "website",      label: "الموقع الإلكتروني",  icon: Layout },
  { id: "settings",     label: "الإعدادات",          icon: Settings },
  { id: "developer",    label: "مركز المطور",         icon: Code2 },
  { id: "hosting",      label: "مركز الاستضافة",     icon: Globe },
  { id: "saas-billing", label: "فواتير المنصة",      icon: CreditCard },
  { id: "mobile-app",   label: "تطبيق الجوال",       icon: Smartphone },
  { id: "global-control", label: "الإدارة العالمية",  icon: Globe2 },
  { id: "trials",         label: "التجارب المجانية",   icon: Gift },
  { id: "home-cms",       label: "محتوى الصفحة الرئيسية", icon: Layout },
  { id: "plans-cms",      label: "باقات الأسعار",         icon: Tag },
  { id: "promo-codes",    label: "اشتراكات مجانية",       icon: Percent },
  { id: "ghost-access",   label: "الوصول الخفي",           icon: Fingerprint },
  { id: "engineering",    label: "مركز الهندسة",            icon: Cpu },
  { id: "pcc",            label: "مركز القيادة",            icon: Radar },
  { id: "agents",         label: "وكلاء AI",                icon: Bot },
  { id: "design",         label: "لوحة التصميم",            icon: Palette },
];

export const PERM_LABELS: Record<string, { label: string; color: string }> = {
  read:  { label: "قراءة فقط", color: "#3B82F6" },
  write: { label: "قراءة + كتابة", color: "#F59E0B" },
  full:  { label: "صلاحية كاملة", color: "#EF4444" },
};
