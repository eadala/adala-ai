import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Check, X, Minus, ChevronDown, Zap, Shield, Building2,
  Crown, Rocket, Star, Sparkles, ArrowLeft, MessageCircle,
  Users, HardDrive, Brain, Globe, ShoppingBag, Calendar,
  GitBranch, Code2, BarChart3, Headphones, Wifi,
  BadgeCheck, Phone, Plus, TrendingUp, FileText, Smartphone,
  Database, ScanText, CloudUpload, Layers, Bot, Lock, Award, CreditCard,
  Scale, Flame, Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════ CONSTANTS ══════════════════════════════ */

const GOLD = "#1A56DB";

/* ═══════════════════════════════════════ PLANS DATA ═════════════════════════════ */
/* Fallback used only when API call fails — mirrors DEFAULT_PLANS in planCms.ts */

const PLANS = [
  {
    id: "free",
    nameAr: "استكشف",
    nameEn: "Explorer",
    icon: Zap,
    color: "#64748B",
    monthly: 0,
    yearly: 0,
    desc: "جرّب النظام كاملاً · لا بطاقة ائتمان · لا التزام",
    cta: "ابدأ مجاناً",
    recommended: false,
    enterprise: false,
    badge: "🎁 مجاني · 90 يوم تجربة",
    features: [
      "قضايا أساسية (حتى ٥)",
      "مستخدم واحد",
      "١ جيجا تخزين",
      "٥٬٠٠٠ AI credit",
      "تذكيرات ذكية",
      "تقويم قانوني",
      "تصدير PDF",
    ],
  },
  {
    id: "basic",
    nameAr: "انطلق",
    nameEn: "Launch",
    icon: Rocket,
    color: "#3B82F6",
    monthly: 399,
    yearly: 319,
    desc: "للمحامي المستقل — مكتب رقمي احترافي من اليوم الأول",
    cta: "اشترك الآن",
    recommended: false,
    enterprise: false,
    badge: null,
    features: [
      "٢ مستخدم",
      "١٠ جيجا تخزين",
      "٢٠٬٠٠٠ AI credit/شهر",
      "إدارة قضايا + عقود AI",
      "فواتير إلكترونية",
      "قوالب مستندات",
      "موقع المكتب الرقمي",
    ],
  },
  {
    id: "pro",
    nameAr: "أتقن",
    nameEn: "Professional",
    icon: Star,
    color: GOLD,
    monthly: 899,
    yearly: 719,
    desc: "للمكاتب النشطة — AI متقدم + تحليلات + نمو حقيقي",
    cta: "اشترك الآن",
    recommended: true,
    enterprise: false,
    badge: "⭐ الأكثر شعبية",
    features: [
      "٥ مستخدمين",
      "٥٠ جيجا تخزين",
      "١٠٠٬٠٠٠ AI credit/شهر",
      "كل مزايا انطلق +",
      "🤖 AI متقدم (GPT-4/Claude)",
      "📊 تحليلات AI للقضايا",
      "🔍 OCR — استخراج النصوص",
      "💾 نسخ احتياطي يومي",
      "تقارير متقدمة + KPIs",
    ],
  },
  {
    id: "growth",
    nameAr: "توسّع",
    nameEn: "Business",
    icon: TrendingUp,
    color: "#8B5CF6",
    monthly: 1799,
    yearly: 1439,
    desc: "المكتب الذكي — فروع + واتساب + بوابة عملاء + تشغيل آلي",
    cta: "اشترك الآن",
    recommended: false,
    enterprise: false,
    badge: "🏢 للمكاتب الذكية",
    features: [
      "١٥ مستخدماً",
      "١٥٠ جيجا تخزين",
      "٣٠٠٬٠٠٠ AI credit/شهر",
      "كل مزايا أتقن +",
      "🏢 ٣ فروع مستقلة",
      "💬 WhatsApp Business",
      "📲 Telegram Bot",
      "👥 بوابة الموكّلين",
      "⚙️ سير عمل آلي",
    ],
  },
  {
    id: "advanced",
    nameAr: "تميّز",
    nameEn: "Advanced",
    icon: Shield,
    color: "#EC4899",
    monthly: 3999,
    yearly: 3199,
    desc: "نظام تشغيل مكتب قانوني متكامل — محاسبة + HR + هوية كاملة",
    cta: "اشترك الآن",
    recommended: false,
    enterprise: false,
    badge: "🔥 ERP قانوني كامل",
    features: [
      "٣٠ مستخدماً",
      "٣٠٠ جيجا تخزين",
      "٨٠٠٬٠٠٠ AI credit/شهر",
      "كل مزايا توسّع +",
      "١٠ فروع",
      "🌐 نطاق خاص",
      "🔌 API كامل",
      "🏷️ وايت لابل",
      "🧠 CFO ذكي",
    ],
  },
  {
    id: "enterprise",
    nameAr: "هيمن",
    nameEn: "Enterprise",
    icon: Building2,
    color: "#10B981",
    monthly: 0,
    yearly: 0,
    desc: "بنية تحتية خاصة · AI غير محدود · مدير حساب مخصص · SLA 24/7",
    cta: "تواصل معنا",
    recommended: false,
    enterprise: true,
    badge: "🏆 للمجموعات الكبرى",
    features: [
      "مستخدمون غير محدود",
      "تخزين غير محدود",
      "AI credits غير محدودة",
      "فروع غير محدودة",
      "🤝 مدير حساب مخصص",
      "🛡️ SLA 24/7",
      "☁️ Private Cloud",
      "🔗 تكاملات ERP خارجية",
      "📜 عقد SLA ملزم",
    ],
  },
  {
    id: "elite",
    nameAr: "الأسطورة",
    nameEn: "Elite",
    icon: Crown,
    color: "#F59E0B",
    monthly: 0,
    yearly: 0,
    desc: "AI مدرَّب على بياناتك · بنية تحتية مخصصة · لا سقف ولا حدود",
    cta: "تواصل معنا",
    recommended: false,
    enterprise: true,
    badge: "👑 القمة المطلقة",
    features: [
      "كل Enterprise +",
      "🤖 AI مدرَّب على بيانات مكتبك",
      "🏗️ بنية تحتية معزولة",
      "📜 SLA 99.99% قانوني",
      "🚀 هجرة مجانية من أي نظام",
      "🌟 مدير نجاح ٢٤/٧",
    ],
  },
];

/* ═══════════════════════════════════════ ICON MAP (by plan ID) ══════════════════ */
const PLAN_ICONS: Record<string, any> = {
  free: Zap, basic: Rocket, pro: Star, growth: TrendingUp,
  advanced: Shield, enterprise: Building2, elite: Crown,
  "bk-starter": Scale, "bk-pro": Flame, "bk-enterprise": Building,
};

/* ── Bankruptcy plans fallback (mirrors DEFAULT_PLANS in planCms.ts) ── */
const BK_PLANS = [
  {
    id: "bk-starter", nameAr: "بداية", nameEn: "Adalah Bankruptcy Basic",
    icon: Scale, color: "#EA580C",
    monthly: 1999, yearly: 1599,
    desc: "للمحامين والمكاتب الصغيرة المتخصصة في الإفلاس وإعادة الهيكلة",
    cta: "اشترك الآن", recommended: false, enterprise: false,
    badge: null,
    features: [
      "٥ ملفات إفلاس نشطة", "٣ مستخدمين", "٢٠ جيجا تخزين",
      "لوحة تحكم الإفلاس الكاملة",
      "إدارة الدائنين والمطالبات",
      "إدارة الأصول والعقارات",
      "اجتماعات الدائنين وتوثيق المحاضر",
      "بوابة الدائنين العامة",
      "تقديم المطالبات إلكترونياً",
    ],
  },
  {
    id: "bk-pro", nameAr: "احتراف", nameEn: "Adalah Bankruptcy Professional",
    icon: Flame, color: "#7C3AED",
    monthly: 4999, yearly: 3999,
    desc: "لأمناء الإفلاس ومكاتب المحاماة المتوسطة",
    cta: "اشترك الآن", recommended: true, enterprise: false,
    badge: "⭐ الأكثر طلباً",
    features: [
      "٢٥ ملف إفلاس نشط", "١٥ مستخدماً", "١٠٠ جيجا تخزين",
      "كل مزايا بداية +",
      "💸 التوزيعات وتقييم الأصول",
      "🤖 مساعد AI للإفلاس",
      "📊 تحليلات متقدمة",
      "متابعة المطالبات في الوقت الفعلي",
      "تقارير تفصيلية للأمانة",
    ],
  },
  {
    id: "bk-enterprise", nameAr: "مؤسسات", nameEn: "Adalah Bankruptcy Enterprise",
    icon: Building, color: "#0F172A",
    monthly: 9999, yearly: 7999,
    desc: "للشركات الاستشارية ومكاتب الأمناء الكبيرة",
    cta: "اشترك الآن", recommended: false, enterprise: false,
    badge: "🏆 للمؤسسات الكبرى",
    features: [
      "ملفات إفلاس غير محدودة",
      "مستخدمون غير محدود",
      "تخزين غير محدود",
      "كل مزايا احتراف +",
      "🔌 API كامل + تكاملات خارجية",
      "🏷️ وايت لابل — هويتك الكاملة",
      "⚙️ سير عمل مخصص",
      "📋 تقارير تنفيذية",
      "🛡️ دعم أولوية ٢٤/٧",
    ],
  },
];

/* normalize API response → component shape */
function normalizePlan(p: any) {
  return {
    ...p,
    icon:        PLAN_ICONS[p.id] ?? Zap,
    monthly:     p.monthlyPrice ?? p.monthly ?? 0,
    yearly:      p.yearlyPrice  ?? p.yearly  ?? 0,
    desc:        p.description  ?? p.desc    ?? "",
    cta:         p.isContactOnly ? "تواصل معنا" : (p.monthlyPrice === 0 ? "ابدأ مجاناً" : "اشترك الآن"),
    enterprise:  !!p.isContactOnly,
    recommended: !!p.recommended,
    nameAr:      p.nameAr ?? p.name ?? "",
    nameEn:      p.nameEn ?? "",
    color:       p.color ?? "#64748B",
    badge:       p.badge ?? null,
    features:    p.features ?? [],
  };
}

/* ═══════════════════════════════════════ COMPARISON DATA ════════════════════════ */

type FeatureVal = string | boolean | null;
interface CompRow { label: string; icon: any; vals: FeatureVal[] }

// vals order: free, basic, pro, growth, advanced, enterprise, elite
const COMPARISON: CompRow[] = [
  { label: "القضايا النشطة",      icon: Shield,       vals: ["٥",       "٢٠",     "١٠٠",    "٥٠٠",    "٢٠٠٠",    "∞",       "∞"      ] },
  { label: "المستخدمون",          icon: Users,        vals: ["١",       "٢",      "٥",      "١٥",     "٣٠",      "١٠٠",     "∞"      ] },
  { label: "التخزين",             icon: HardDrive,    vals: ["١ GB",    "٥ GB",   "٢٥ GB",  "١٠٠ GB", "٢٠٠ GB",  "١ TB",    "∞"      ] },
  { label: "الذكاء الاصطناعي",    icon: Brain,        vals: ["٥/يوم",  "٢٠/يوم","١٠٠/يوم","٣٠٠/يوم","١٠٠٠/يوم","∞",       "∞"      ] },
  { label: "موقع فرعي من عدالة", icon: Globe,        vals: [true,      true,     true,     true,     true,      true,      true     ] },
  { label: "متجر الخدمات القانونية", icon: ShoppingBag, vals: [true,    true,     true,     true,     true,      true,      true     ] },
  { label: "بوابة الدفع الإلكتروني", icon: CreditCard,  vals: [true,    true,     true,     true,     true,      true,      true     ] },
  { label: "عقود ذكية AI",        icon: FileText,     vals: [false,     true,     true,     true,     true,      true,      true     ] },
  { label: "قوالب المستندات",     icon: Layers,       vals: [false,     true,     true,     true,     true,      true,      true     ] },
  { label: "تطبيق جوال",          icon: Smartphone,   vals: [false,     true,     true,     true,     true,      true,      true     ] },
  { label: "تحليلات AI متقدمة",   icon: Bot,          vals: [false,     false,    true,     true,     true,      true,      true     ] },
  { label: "OCR استخراج نصوص",    icon: ScanText,     vals: [false,     false,    true,     true,     true,      true,      true     ] },
  { label: "نسخ احتياطي تلقائي",  icon: Database,     vals: [false,     false,    true,     true,     true,      true,      true     ] },
  { label: "التقارير المتقدمة",   icon: BarChart3,    vals: [false,     false,    true,     true,     true,      true,      true     ] },
  { label: "بوابة العملاء",       icon: Wifi,         vals: [false,     false,    false,    true,     true,      true,      true     ] },
  { label: "الفروع",              icon: GitBranch,    vals: [false,     false,    false,    "٣",      "١٠",      "∞",       "∞"      ] },
  { label: "WhatsApp Business",   icon: MessageCircle,vals: [false,     false,    false,    true,     true,      true,      true     ] },
  { label: "محرك سير العمل",      icon: Zap,          vals: [false,     false,    false,    true,     true,      true,      true     ] },
  { label: "نطاق خاص مخصص (Custom Domain)", icon: Lock, vals: [false,  false,    false,    false,    true,      true,      true     ] },
  { label: "وصول API",            icon: Code2,        vals: [false,     false,    false,    false,    true,      true,      true     ] },
  { label: "مساعد مالي AI (CFO)", icon: TrendingUp,   vals: [false,     false,    false,    false,    true,      true,      true     ] },
  { label: "White Label",         icon: Award,        vals: [false,     false,    false,    false,    true,      true,      true     ] },
  { label: "SLA / مستوى الدعم",   icon: Headphones,   vals: ["بريد","بريد","أولوي","٨س",   "٤س",     "٢٤/٧",    "٢٤/٧"   ] },
  { label: "مدير حساب مخصص",     icon: Users,        vals: [false,     false,    false,    false,    false,     true,      true     ] },
  { label: "AI مدرَّب مخصص",      icon: Brain,        vals: [false,     false,    false,    false,    false,     false,     true     ] },
  { label: "بنية تحتية مخصصة",   icon: CloudUpload,  vals: [false,     false,    false,    false,    false,     false,     true     ] },
];

/* ═══════════════════════════════════════ ADD-ONS ════════════════════════════════ */

const ADDONS = [
  { icon: Users,          label: "مستخدم إضافي",         price: 25,  per: "مستخدم/شهر",  color: "#3B82F6" },
  { icon: HardDrive,      label: "50 GB إضافية",          price: 50,  per: "شهرياً",      color: "#8B5CF6" },
  { icon: GitBranch,      label: "فرع إضافي",             price: 199, per: "فرع/شهر",     color: "#F97316" },
  { icon: MessageCircle,  label: "WhatsApp Business",     price: 299, per: "شهرياً",      color: "#10B981" },
  { icon: Brain,          label: "AI Plus — طلبات إضافية",price: 149, per: "شهرياً",      color: GOLD      },
  { icon: Lock,           label: "نطاق خاص",              price: 99,  per: "شهرياً",      color: "#EC4899" },
  { icon: ScanText,       label: "OCR إضافي",             price: 79,  per: "شهرياً",      color: "#06B6D4" },
  { icon: Database,       label: "نسخ احتياطي يومي",      price: 49,  per: "شهرياً",      color: "#84CC16" },
];

/* ═══════════════════════════════════════ FAQ ════════════════════════════════════ */

const FAQS = [
  { q: "هل توجد فترة تجريبية مجانية؟", a: "نعم، جميع الباقات المدفوعة تأتي مع تجربة مجانية لمدة ٣٠ يوماً بدون أي قيود. لا حاجة لبطاقة ائتمانية. أما الباقة المجانية فهي متاحة دائماً بدون انتهاء أو قيود زمنية." },
  { q: "هل أحتاج بطاقة ائتمانية للتسجيل؟", a: "لا. يمكنك البدء مجاناً فوراً بدون أي بيانات دفع. تُطلب معلومات الدفع فقط عند الترقية لباقة مدفوعة." },
  { q: "هل يمكنني تغيير باقتي في أي وقت؟", a: "نعم، يمكنك الترقية أو التخفيض في أي وقت. عند الترقية يتم احتساب الفرق بشكل تناسبي فوراً، وعند التخفيض يسري التغيير من بداية الدورة القادمة." },
  { q: "ما الفرق بين باقة مؤسسي والنخبة؟", a: "باقة مؤسسي (٢٩٩٩ ر.س) تناسب المجموعات القانونية الكبيرة مع ١٠٠ مستخدم وتخزين ١ تيرابايت. باقة النخبة (٩٩٩٩ ر.س) توفر بنية تحتية مخصصة وAI مدرَّب على بياناتك وSLA قانوني ملزم بنسبة تشغيل ٩٩.٩٩٪." },
  { q: "هل بياناتي آمنة ومحمية؟", a: "بالكامل. نستخدم تشفير AES-256 للبيانات في حالة السكون وTLS 1.3 في النقل. خوادمنا معتمدة وفق ISO 27001 ومتوافقة مع نظام حماية البيانات الشخصية السعودي." },
  { q: "هل يوجد عقد طويل الأمد؟", a: "لا. الاشتراك شهري افتراضياً ويمكن الإلغاء في أي وقت. الباقة السنوية توفر ٢٠٪ لكنها اختيارية تماماً." },
  { q: "كيف يتم الدفع؟", a: "نقبل جميع البطاقات الائتمانية (فيزا، ماستركارد، مدى)، إضافة إلى التحويل البنكي والفواتير الشهرية للباقات المؤسسية." },
];

/* ═══════════════════════════════════════ HELPERS ════════════════════════════════ */

function FeatureVal({ val }: { val: FeatureVal }) {
  if (val === true)  return <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" />;
  if (val === false) return <X className="h-3.5 w-3.5 text-slate-200 mx-auto" />;
  if (val === null)  return <Minus className="h-3.5 w-3.5 text-slate-200 mx-auto" />;
  return <span className="text-[11px] text-slate-600 font-medium">{val}</span>;
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  if (inView && v === 0 && to > 0) {
    let start = 0;
    const step = Math.ceil(to / 40);
    const iv = setInterval(() => {
      start += step;
      if (start >= to) { setV(to); clearInterval(iv); } else setV(start);
    }, 20);
  }
  return <span ref={ref}>{inView ? v : 0}{suffix}</span>;
}

/* ═══════════════════════════════════════ PAGE ═══════════════════════════════════ */

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function PricingPage() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  /* Read ?product= from URL to default to bankruptcy tab */
  const [product, setProduct] = useState<"main" | "bankruptcy">(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("product");
      return p === "bankruptcy" ? "bankruptcy" : "main";
    } catch { return "main"; }
  });

  /* Sync product state when URL changes */
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("product");
      setProduct(p === "bankruptcy" ? "bankruptcy" : "main");
    } catch {}
  }, []);

  /* fetch live plans from DB (falls back to hardcoded PLANS) */
  const { data: apiPlans } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => fetch(`${BASE}/api/billing/plans`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const ALL_PLANS_LIVE = (apiPlans && apiPlans.length > 0 ? apiPlans : PLANS).map(normalizePlan);
  const BK_PLANS_LIVE = (() => {
    const fromApi = ALL_PLANS_LIVE.filter((p: any) => String(p.id).startsWith("bk-"));
    return fromApi.length > 0 ? fromApi : BK_PLANS.map(p => ({ ...p, nameAr: `عدالة إفلاس — ${p.nameAr}` }));
  })();
  const MAIN_PLANS_LIVE = ALL_PLANS_LIVE.filter((p: any) => !String(p.id).startsWith("bk-"));
  const PLANS_LIVE = product === "bankruptcy" ? BK_PLANS_LIVE : MAIN_PLANS_LIVE;

  return (
    <div
      className="min-h-screen font-['Cairo',sans-serif] text-slate-800"
      dir="rtl"
      style={{ background: "#F8FAFC" }}
    >
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            الرئيسية
          </a>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}20` }}>
              <BadgeCheck className="h-4 w-4" style={{ color: GOLD }} />
            </div>
            <span className="font-black text-sm">عدالة AI</span>
          </div>
          <a href="/sign-up">
            <Button size="sm" style={{ background: GOLD, color: "#fff" }} className="font-bold gap-1.5 text-xs">
              ابدأ مجاناً
            </Button>
          </a>
        </div>
      </nav>

      {/* ── PRODUCT TAB TOGGLE ── */}
      <div className="flex justify-center pt-10 pb-2 px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="inline-flex p-1 rounded-2xl gap-1"
          style={{ background: "#F1F5F9", border: "1px solid #E2E8F0" }}
        >
          <button
            onClick={() => setProduct("main")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
              product === "main" ? "bg-white text-slate-800 shadow-md" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <BadgeCheck className="h-4 w-4" style={{ color: product === "main" ? GOLD : undefined }} />
            عدالة AI
            <span className="text-[9px] font-black px-2 py-0.5 rounded-md" style={{ background: `${GOLD}20`, color: GOLD }}>٧ باقات</span>
          </button>
          <button
            onClick={() => setProduct("bankruptcy")}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
              product === "bankruptcy" ? "bg-white text-slate-800 shadow-md" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Scale className="h-4 w-4" style={{ color: product === "bankruptcy" ? "#EA580C" : undefined }} />
            عدالة إفلاس
            <span className="text-[9px] font-black px-2 py-0.5 rounded-md" style={{ background: "#FFF7ED", color: "#EA580C", border: "1px solid #FED7AA" }}>متخصص</span>
          </button>
        </motion.div>
      </div>

      {/* ── HERO ── */}
      <section className="text-center pt-10 pb-12 px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          {product === "main" ? (
            <>
              <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-6"
                style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}40` }}>
                <Sparkles className="h-3.5 w-3.5" />
                ٧ باقات · شفافية كاملة · بدون رسوم خفية
              </div>
              <h1 className="text-5xl md:text-6xl font-black mb-5 leading-tight text-slate-900">
                خطط تناسب
                <span className="block" style={{ color: GOLD }}>جميع المكاتب القانونية</span>
              </h1>
              <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
                من المحامي المستقل إلى المجموعة القانونية الكبرى — ابدأ مجاناً وقم بالترقية عندما ينمو مكتبك.
              </p>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-6"
                style={{ background: "#FFF7ED", color: "#EA580C", border: "1px solid #FED7AA" }}>
                <Scale className="h-3.5 w-3.5" />
                حلول متخصصة — الإفلاس وإعادة الهيكلة
              </div>
              <h1 className="text-5xl md:text-6xl font-black mb-5 leading-tight text-slate-900">
                عدالة إفلاس
                <span className="block" style={{ color: "#EA580C" }}>٣ باقات متخصصة</span>
              </h1>
              <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
                منصة متخصصة لأمناء الإفلاس والمحامين والمستشارين الماليين في مسارات التعثر والإعادة الهيكلة.
              </p>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-8 mt-10 text-center"
        >
          {(product === "main"
            ? [
                { n: 850, suf: "+", label: "مكتب يثق بنا", color: GOLD },
                { n: 7,   suf: " باقات", label: "لجميع الأحجام", color: GOLD },
                { n: 30,  suf: " يوم", label: "تجربة مجانية", color: GOLD },
                { n: 99,  suf: "٪", label: "رضا العملاء", color: GOLD },
              ]
            : [
                { n: 3,   suf: " باقات", label: "متخصصة في الإفلاس", color: "#EA580C" },
                { n: 25,  suf: "+", label: "ميزة متخصصة", color: "#EA580C" },
                { n: 100, suf: "٪", label: "مطابق لنظام الإفلاس السعودي", color: "#EA580C" },
                { n: 24,  suf: "/٧", label: "دعم متخصص", color: "#EA580C" },
              ]
          ).map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-black" style={{ color: s.color }}>
                <Counter to={s.n} suffix={s.suf} />
              </div>
              <div className="text-xs text-slate-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── BILLING TOGGLE ── */}
      <div className="flex justify-center mb-10 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
          className="p-1.5 rounded-2xl flex gap-1"
          style={{ background: "#F1F5F9", border: "1px solid #E2E8F0" }}
        >
          {(["monthly", "yearly"] as const).map(c => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                "relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2",
                cycle === c ? "text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
              style={cycle === c ? { background: GOLD } : {}}
            >
              {c === "monthly" ? "شهري" : "سنوي"}
              {c === "yearly" && (
                <span className={cn(
                  "text-[10px] font-black px-1.5 py-0.5 rounded-md",
                  cycle === "yearly" ? "bg-primary/15 text-primary" : "bg-emerald-500/20 text-emerald-600"
                )}>
                  وفّر ٢٠٪
                </span>
              )}
            </button>
          ))}
        </motion.div>
      </div>

      {/* ── PRICING CARDS ── */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className={cn(
          "gap-4",
          product === "bankruptcy"
            ? "grid sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto"
            : "grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        )}>
          {PLANS_LIVE.map((plan: any, i: number) => {
            const price = cycle === "monthly" ? plan.monthly : plan.yearly;
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.07 * i + 0.15 }}
                whileHover={{ y: -6 }}
                className={cn("relative rounded-3xl flex flex-col overflow-hidden", plan.recommended && "ring-2")}
                style={{
                  background: plan.recommended
                    ? `linear-gradient(160deg, ${plan.color}12, ${plan.color}05)`
                    : "#ffffff",
                  border: `1px solid ${plan.color}${plan.recommended ? "50" : "20"}`,
                  boxShadow: plan.recommended ? `0 8px 40px ${plan.color}18` : "0 1px 4px rgba(0,0,0,0.06)",
                  ...(plan.recommended ? { ringColor: plan.color } : {}),
                }}
              >
                {/* Top glow line */}
                {plan.recommended && (
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
                )}

                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <div
                      className="text-[9px] font-black px-3 py-1 rounded-b-xl whitespace-nowrap"
                      style={plan.recommended
                        ? { background: GOLD, color: "#fff" }
                        : { background: `${plan.color}30`, color: plan.color, border: `1px solid ${plan.color}40`, borderTop: "none" }}
                    >
                      {plan.badge}
                    </div>
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col">
                  {/* Header */}
                  <div className="flex items-center gap-2.5 mb-4 mt-2">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${plan.color}20`, border: `1px solid ${plan.color}30` }}>
                      <Icon className="h-4.5 w-4.5" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <div className="font-black text-sm text-slate-800">{plan.nameAr}</div>
                      <div className="text-[10px] text-slate-400">{plan.nameEn}</div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-2">
                    {plan.id === "elite" && plan.enterprise ? (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={`${plan.id}-${cycle}`}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="text-3xl font-black"
                              style={{ color: plan.color }}
                            >
                              {price?.toLocaleString("ar-SA")}
                            </motion.span>
                          </AnimatePresence>
                          <span className="text-slate-400 text-xs">ر.س / شهر</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">أو تواصل للحصول على عرض خاص</div>
                      </div>
                    ) : plan.monthly === 0 ? (
                      <div>
                        <div className="text-3xl font-black" style={{ color: plan.color }}>مجاناً</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">دائماً · بدون انتهاء</div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={`${plan.id}-${cycle}`}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              className="text-3xl font-black"
                              style={{ color: plan.color }}
                            >
                              {price?.toLocaleString("ar-SA")}
                            </motion.span>
                          </AnimatePresence>
                          <span className="text-slate-400 text-xs">ر.س / شهر</span>
                        </div>
                        {cycle === "yearly" && plan.monthly && plan.yearly && (
                          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                            توفر {((plan.monthly - plan.yearly) * 12).toLocaleString("ar-SA")} ر.س سنوياً
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">{plan.desc}</p>

                  {/* Features */}
                  <div className="space-y-2 flex-1 mb-5">
                    {plan.features.map((f: any, fi: number) => (
                      <div key={fi} className="flex items-start gap-2">
                        <div className="h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${plan.color}20` }}>
                          <Check className="h-2 w-2" style={{ color: plan.color }} />
                        </div>
                        <span className="text-[11px] text-slate-600 leading-relaxed">{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <a href={plan.id === "elite" ? "mailto:sales@adalah-ai.sa" : plan.monthly === 0 ? "/sign-up" : "/sign-up"}>
                    <Button
                      className="w-full py-5 font-black text-xs gap-1.5 transition-all hover:opacity-90"
                      style={plan.recommended
                        ? { background: GOLD, color: "#fff" }
                        : plan.monthly === 0
                        ? { background: `${plan.color}25`, color: plan.color, border: `1px solid ${plan.color}35` }
                        : { background: `${plan.color}18`, color: plan.color, border: `1px solid ${plan.color}30` }}
                    >
                      {plan.cta}
                      {plan.id !== "elite" && <ArrowLeft className="h-3.5 w-3.5 rotate-180" />}
                    </Button>
                  </a>

                  {plan.monthly !== 0 && plan.id !== "elite" && (
                    <p className="text-center text-[9px] text-slate-400 mt-1.5">
                      ٣٠ يوم تجربة مجانية · بدون بطاقة
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="max-w-[1400px] mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-4"
            style={{ background: `${GOLD}15`, color: GOLD, border: `1px solid ${GOLD}35` }}>
            مقارنة شاملة لجميع الباقات
          </div>
          <h2 className="text-3xl font-black text-slate-900">قارن جميع المزايا</h2>
          <p className="text-slate-400 text-sm mt-2">٧ باقات · ٢٥ ميزة · اختر ما يناسب مكتبك</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl overflow-hidden"
          style={{ border: "1px solid #E2E8F0", background: "#ffffff" }}
        >
          <div className="overflow-x-auto">
            <div style={{ minWidth: "1000px" }}>
              {/* Table header */}
              <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: "220px repeat(7, 1fr)" }}>
                <div className="p-4 text-sm font-bold text-slate-400">الميزة</div>
                {PLANS_LIVE.map((p: any, i: number) => (
                  <div
                    key={p.id}
                    className="p-3 text-center cursor-pointer transition-all"
                    style={hoveredCol === i ? { background: `${p.color}10` } : {}}
                    onMouseEnter={() => setHoveredCol(i)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <div className="font-black text-xs" style={{ color: p.color }}>{p.nameAr}</div>
                    {p.monthly !== null && (
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        {p.monthly === 0 ? "مجاناً" : `${cycle === "monthly" ? p.monthly : p.yearly} ر.س`}
                      </div>
                    )}
                    {p.recommended && (
                      <div className="text-[8px] font-bold mt-1 px-1.5 py-0.5 rounded-full inline-block"
                        style={{ background: `${GOLD}20`, color: GOLD }}>الأشهر</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {COMPARISON.map((row, ri) => {
                const Icon = row.icon;
                return (
                  <div
                    key={ri}
                    className={cn("transition-colors", ri % 2 === 0 ? "" : "bg-slate-50")}
                    style={{ display: "grid", gridTemplateColumns: "220px repeat(7, 1fr)" }}
                  >
                    <div className="p-3 flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${GOLD}10` }}>
                        <Icon className="h-3 w-3" style={{ color: GOLD }} />
                      </div>
                      <span className="text-[11px] text-slate-600 font-semibold">{row.label}</span>
                    </div>
                    {row.vals.map((v, vi) => (
                      <div
                        key={vi}
                        className="p-3 flex items-center justify-center transition-all"
                        style={hoveredCol === vi ? { background: `${PLANS_LIVE[vi]?.color ?? "#64748B"}08` } : {}}
                        onMouseEnter={() => setHoveredCol(vi)}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        <FeatureVal val={v} />
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Footer CTAs */}
              <div
                className="border-t border-slate-100 p-3"
                style={{ display: "grid", gridTemplateColumns: "220px repeat(7, 1fr)" }}
              >
                <div />
                {PLANS_LIVE.map((plan: any, i: number) => (
                  <div key={i} className="px-1.5">
                    <a href={plan.enterprise ? "mailto:sales@adalah-ai.sa" : "/sign-up"}>
                      <Button
                        size="sm"
                        className="w-full text-[10px] font-bold py-3"
                        style={plan.recommended
                          ? { background: GOLD, color: "#fff" }
                          : { background: `${plan.color}15`, color: plan.color, border: `1px solid ${plan.color}25` }}
                      >
                        {plan.cta}
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── ADD-ONS ── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-4"
            style={{ background: "#3B82F620", color: "#3B82F6", border: "1px solid #3B82F625" }}>
            <Plus className="h-3.5 w-3.5" />
            إضافات اختيارية
          </div>
          <h2 className="text-3xl font-black text-slate-900">خصّص باقتك</h2>
          <p className="text-slate-400 text-sm mt-2">أضف ما تحتاجه فقط — ادفع مقابل ما تستخدمه</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ADDONS.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -4 }}
                className="p-4 rounded-2xl flex items-center gap-3"
                style={{ background: `${a.color}08`, border: `1px solid ${a.color}20` }}
              >
                <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${a.color}15` }}>
                  <Icon className="h-5 w-5" style={{ color: a.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-slate-800">{a.label}</div>
                  <div className="text-xs text-slate-400">{a.per}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-black" style={{ color: a.color }}>{a.price}</div>
                  <div className="text-[10px] text-slate-400">ر.س</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-4"
            style={{ background: "#8B5CF620", color: "#8B5CF6", border: "1px solid #8B5CF625" }}>
            الأسئلة الشائعة
          </div>
          <h2 className="text-3xl font-black text-slate-900">هل لديك أسئلة؟</h2>
        </motion.div>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid #E2E8F0", background: "#ffffff" }}
            >
              <button
                className="w-full p-5 flex items-center justify-between text-right gap-4 hover:bg-slate-50 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-bold text-sm text-slate-800">{faq.q}</span>
                <motion.div
                  animate={{ rotate: openFaq === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0"
                >
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </motion.div>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden text-center py-20 px-8"
          style={{ background: `linear-gradient(135deg, ${GOLD}10, #EFF6FF 60%, #F8FAFC 100%)`, border: `1px solid ${GOLD}30` }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${GOLD}08, transparent 70%)` }} />

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative z-10"
          >
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}40` }}>
              <Sparkles className="h-8 w-8" style={{ color: GOLD }} />
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-slate-900">
              ابدأ رحلتك نحو
              <span className="block" style={{ color: GOLD }}>مكتب قانوني أكثر ذكاءً</span>
            </h2>
            <p className="text-slate-500 text-base mb-8 max-w-lg mx-auto leading-relaxed">
              انضم لأكثر من ٨٥٠ مكتباً قانونياً يستخدمون عدالة AI لتحسين كفاءتهم وتنمية أعمالهم.
            </p>
            <div className="flex items-start gap-3 max-w-sm mx-auto mb-6 text-right">
              <Checkbox
                id="terms-cta"
                checked={acceptedTerms}
                onCheckedChange={(v) => setAcceptedTerms(!!v)}
                className="mt-0.5 shrink-0"
              />
              <label htmlFor="terms-cta" className="text-sm text-slate-500 cursor-pointer leading-relaxed">
                أقر بأنني اطلعت على{" "}
                <Link href="/terms"><span className="text-blue-600 hover:underline cursor-pointer">الشروط والأحكام</span></Link>
                {" "}و{" "}
                <Link href="/privacy"><span className="text-blue-600 hover:underline cursor-pointer">سياسة الخصوصية</span></Link>
                {" "}وأوافق عليهما
              </label>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <a href={acceptedTerms ? "/sign-up" : undefined} onClick={!acceptedTerms ? (e) => e.preventDefault() : undefined}>
                <Button
                  size="lg"
                  className="gap-2 px-8 py-6 text-base font-black shadow-2xl transition-opacity"
                  style={{ background: acceptedTerms ? GOLD : "#E2E8F0", color: acceptedTerms ? "#fff" : "#94A3B8" }}
                  disabled={!acceptedTerms}
                >
                  <Zap className="h-5 w-5" />
                  ابدأ مجاناً لمدة ٣٠ يوماً
                </Button>
              </a>
              <a href="mailto:sales@adalah-ai.sa">
                <Button size="lg" variant="outline" className="gap-2 px-8 py-6 text-base border-slate-300 text-slate-600 hover:bg-slate-50">
                  <Phone className="h-5 w-5" />
                  تحدث مع فريق المبيعات
                </Button>
              </a>
            </div>
            <div className="flex flex-wrap gap-6 justify-center mt-8 text-xs text-slate-400">
              {["✓ لا بطاقة ائتمانية", "✓ لا عقود طويلة", "✓ إلغاء في أي وقت", "✓ دعم كامل بالعربية"].map(t => (
                <span key={t} className="font-medium">{t}</span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <p className="mb-3">© ٢٠٢٦ عدالة AI · جميع الحقوق محفوظة</p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/terms"><span className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">الشروط والأحكام</span></Link>
          <span className="text-slate-200">•</span>
          <Link href="/privacy"><span className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">سياسة الخصوصية</span></Link>
          <span className="text-slate-200">•</span>
          <Link href="/security"><span className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">الأمان</span></Link>
        </div>
      </footer>

      {/* WhatsApp float */}
      <a href="https://wa.me/966500000000" target="_blank" rel="noreferrer"
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 bg-emerald-500 hover:bg-emerald-600 transition-colors">
        <MessageCircle className="h-7 w-7 text-white" />
      </a>
    </div>
  );
}
