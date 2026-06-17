import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Scale, Building2, Users, DollarSign, CreditCard, Shield,
  Search, ExternalLink, CheckCircle, Clock, AlertCircle,
  Globe, Briefcase, Home, Heart, GraduationCap, Car,
  BarChart3, FileText, Landmark, Phone, Zap, Lock
} from "lucide-react";

type SystemStatus = "available" | "connected" | "coming_soon";

interface SaudiSystem {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  url: string;
  status: SystemStatus;
  category: string;
  tags: string[];
  icon: any;
  color: string;
}

const SYSTEMS: SaudiSystem[] = [
  // ─── القضاء والمحاكم ───
  {
    id: "najiz", name: "ناجز", nameEn: "Najiz",
    description: "بوابة وزارة العدل — تتبع القضايا والجلسات والأحكام وحجز المواعيد وتوثيق العقود",
    url: "https://najiz.moj.gov.sa", status: "available", category: "القضاء والمحاكم",
    tags: ["قضايا", "جلسات", "أحكام", "توثيق"], icon: Scale, color: "#1e3a5f",
  },
  {
    id: "nafith", name: "نافذ", nameEn: "Nafith",
    description: "نظام تنفيذ الأحكام القضائية — متابعة طلبات التنفيذ والحجز والاعتراضات",
    url: "https://nafith.moj.gov.sa", status: "available", category: "القضاء والمحاكم",
    tags: ["تنفيذ", "أحكام", "حجز"], icon: Landmark, color: "#2563EB",
  },
  {
    id: "moj", name: "وزارة العدل", nameEn: "Ministry of Justice",
    description: "البوابة الرئيسية لوزارة العدل — خدمات الكتّاب والتوثيق والاستفسارات القانونية",
    url: "https://moj.gov.sa", status: "available", category: "القضاء والمحاكم",
    tags: ["توثيق", "كتّاب", "استفسار"], icon: Scale, color: "#1e5f3a",
  },
  {
    id: "court-zoom", name: "جلسات المحاكم عن بُعد", nameEn: "Remote Court Sessions",
    description: "منصة التقاضي الإلكتروني عن بُعد — انضمام للجلسات عبر الفيديو مع المحاكم",
    url: "https://najiz.moj.gov.sa", status: "available", category: "القضاء والمحاكم",
    tags: ["جلسات", "فيديو", "عن بُعد"], icon: Globe, color: "#6366f1",
  },
  {
    id: "wathiq", name: "وثّق", nameEn: "Wathiq",
    description: "منصة التوثيق الإلكتروني — توثيق العقود وصكوك الملكية والوكالات رقمياً",
    url: "https://wathiq.moj.gov.sa", status: "available", category: "القضاء والمحاكم",
    tags: ["توثيق", "عقود", "وكالة"], icon: FileText, color: "#0ea5e9",
  },
  {
    id: "adl", name: "بوابة إدارة الدعاوى", nameEn: "Case Management Portal",
    description: "متابعة مراحل الدعوى وتواريخ الجلسات والمستجدات القضائية",
    url: "https://najiz.moj.gov.sa", status: "coming_soon", category: "القضاء والمحاكم",
    tags: ["دعاوى", "جلسات", "متابعة"], icon: Briefcase, color: "#8b5cf6",
  },

  // ─── المحامون والمهن القانونية ───
  {
    id: "sba", name: "هيئة المحامين السعوديين", nameEn: "Saudi Bar Association",
    description: "تجديد ترخيص المحاماة، الاطلاع على سجل المحامين، الدورات التدريبية المعتمدة",
    url: "https://sba.org.sa", status: "available", category: "المحامون والمهن القانونية",
    tags: ["ترخيص", "محامون", "تدريب"], icon: Users, color: "#2563EB",
  },
  {
    id: "nafath", name: "نفاذ", nameEn: "Nafath",
    description: "التحقق من الهوية الوطنية الرقمية — مصادقة العملاء والتحقق من السجل المدني",
    url: "https://nafath.sa", status: "available", category: "المحامون والمهن القانونية",
    tags: ["هوية", "تحقق", "مصادقة"], icon: Lock, color: "#10b981",
  },
  {
    id: "absher", name: "أبشر أفراد", nameEn: "Absher Individuals",
    description: "بوابة الخدمات الحكومية — تجديد الوثائق، الخدمات الأمنية، تفعيل الخدمات المدنية",
    url: "https://www.absher.sa", status: "available", category: "المحامون والمهن القانونية",
    tags: ["خدمات حكومية", "وثائق", "مدني"], icon: Shield, color: "#0369a1",
  },
  {
    id: "absher-biz", name: "أبشر أعمال", nameEn: "Absher Business",
    description: "خدمات الأعمال الحكومية — تأسيس منشآت، استقدام، خدمات العمالة",
    url: "https://business.absher.sa", status: "available", category: "المحامون والمهن القانونية",
    tags: ["أعمال", "منشآت", "استقدام"], icon: Briefcase, color: "#7c3aed",
  },

  // ─── العمل والموارد البشرية ───
  {
    id: "mudad", name: "مدد", nameEn: "Mudad",
    description: "امتثال نظام حماية الأجور — تحقق من صرف الرواتب ونسبة السعودة والمخالفات",
    url: "https://mudad.com.sa", status: "available", category: "العمل والموارد البشرية",
    tags: ["رواتب", "سعودة", "امتثال"], icon: DollarSign, color: "#059669",
  },
  {
    id: "qiwa", name: "قوى", nameEn: "Qiwa",
    description: "منصة وزارة الموارد البشرية — التأشيرات، تصاريح العمل، نقل الكفالة، العقود",
    url: "https://qiwa.sa", status: "available", category: "العمل والموارد البشرية",
    tags: ["تأشيرات", "عمل", "كفالة"], icon: Users, color: "#d97706",
  },
  {
    id: "gosi", name: "التأمينات الاجتماعية", nameEn: "GOSI",
    description: "الاطلاع على اشتراكات التأمينات، الإصابات، مزايا التقاعد، خدمات صاحب العمل",
    url: "https://gosi.gov.sa", status: "available", category: "العمل والموارد البشرية",
    tags: ["تأمين", "تقاعد", "اشتراكات"], icon: Shield, color: "#0891b2",
  },
  {
    id: "musaned", name: "مساند", nameEn: "Musaned",
    description: "استقدام العمالة المنزلية — طلبات الاستقدام، العقود، الشكاوى، التأمين",
    url: "https://musaned.com.sa", status: "available", category: "العمل والموارد البشرية",
    tags: ["استقدام", "عمالة", "عقود"], icon: Home, color: "#7c3aed",
  },
  {
    id: "mol", name: "وزارة الموارد البشرية", nameEn: "HRSD",
    description: "البوابة الرئيسية لوزارة الموارد البشرية والتنمية الاجتماعية وخدماتها",
    url: "https://hrsd.gov.sa", status: "available", category: "العمل والموارد البشرية",
    tags: ["موارد بشرية", "خدمات"], icon: Users, color: "#be185d",
  },
  {
    id: "nitaqat", name: "نطاقات", nameEn: "Nitaqat",
    description: "الاستعلام عن تصنيف نطاقات المنشأة ونسبة السعودة والامتثال لمتطلبات التوطين",
    url: "https://nitaqat.hrsd.gov.sa", status: "available", category: "العمل والموارد البشرية",
    tags: ["سعودة", "نطاقات", "امتثال"], icon: BarChart3, color: "#0369a1",
  },

  // ─── الضرائب والمالية ───
  {
    id: "zatca", name: "هيئة الزكاة والضريبة والجمارك", nameEn: "ZATCA",
    description: "تسجيل ضريبة القيمة المضافة، الإقرارات الضريبية، الفواتير الإلكترونية، الجمارك",
    url: "https://zatca.gov.sa", status: "available", category: "الضرائب والمالية",
    tags: ["ضرائب", "زكاة", "جمارك", "فاتورة"], icon: DollarSign, color: "#2563EB",
  },
  {
    id: "sama", name: "البنك المركزي السعودي (ساما)", nameEn: "SAMA",
    description: "الاستفسار عن التراخيص المصرفية، الشكاوى المالية، ضوابط الأنشطة المالية",
    url: "https://sama.gov.sa", status: "available", category: "الضرائب والمالية",
    tags: ["مصارف", "تراخيص", "شكاوى"], icon: Landmark, color: "#1e3a5f",
  },
  {
    id: "sadad", name: "سداد", nameEn: "Sadad",
    description: "بوابة الدفع الحكومي — سداد الرسوم والغرامات والفواتير الحكومية إلكترونياً",
    url: "https://www.sadad.com.sa", status: "available", category: "الضرائب والمالية",
    tags: ["دفع", "رسوم", "فواتير"], icon: CreditCard, color: "#059669",
  },
  {
    id: "cma", name: "هيئة السوق المالية", nameEn: "CMA",
    description: "تراخيص الأنشطة الاستثمارية، الإفصاحات، القضايا الاستثمارية، الشكاوى",
    url: "https://cma.org.sa", status: "available", category: "الضرائب والمالية",
    tags: ["استثمار", "أوراق مالية", "تراخيص"], icon: BarChart3, color: "#7c3aed",
  },
  {
    id: "monsha", name: "منشآت", nameEn: "Monshaat",
    description: "دعم المنشآت الصغيرة والمتوسطة — التمويل، التراخيص، برامج الدعم الحكومي",
    url: "https://monshaat.gov.sa", status: "available", category: "الضرائب والمالية",
    tags: ["منشآت", "تمويل", "دعم"], icon: Briefcase, color: "#0891b2",
  },

  // ─── السجل التجاري ───
  {
    id: "mc", name: "وزارة التجارة", nameEn: "Ministry of Commerce",
    description: "تأسيس الشركات، تجديد السجل التجاري، العلامات التجارية، حماية المستهلك",
    url: "https://mc.gov.sa", status: "available", category: "السجل التجاري والأعمال",
    tags: ["سجل تجاري", "شركات", "علامات"], icon: Briefcase, color: "#2563EB",
  },
  {
    id: "maroof", name: "معروف", nameEn: "Maroof",
    description: "التحقق من السجلات التجارية، الشكاوى التجارية، منصة التجارة الإلكترونية المرخصة",
    url: "https://maroof.sa", status: "available", category: "السجل التجاري والأعمال",
    tags: ["تجارة إلكترونية", "شكاوى", "تحقق"], icon: Globe, color: "#10b981",
  },
  {
    id: "eservice-mc", name: "خدمات الاستفسار التجاري", nameEn: "Commercial Inquiry",
    description: "الاستعلام عن السجلات التجارية، وكالات الشركات، الإفلاس والتصفية",
    url: "https://eservices.mc.gov.sa", status: "available", category: "السجل التجاري والأعمال",
    tags: ["استعلام", "سجلات", "إفلاس"], icon: Search, color: "#0369a1",
  },
  {
    id: "balady", name: "بلدي", nameEn: "Balady",
    description: "تراخيص البلديات — البناء، البيئة، التشغيل التجاري، إزالة المخالفات",
    url: "https://balady.gov.sa", status: "available", category: "السجل التجاري والأعمال",
    tags: ["بلديات", "تراخيص", "بناء"], icon: Building2, color: "#65a30d",
  },
  {
    id: "sabic-invest", name: "الهيئة العامة للاستثمار", nameEn: "MISA",
    description: "تراخيص الاستثمار الأجنبي، فرص الاستثمار في السوق السعودية",
    url: "https://misa.gov.sa", status: "available", category: "السجل التجاري والأعمال",
    tags: ["استثمار", "أجنبي", "ترخيص"], icon: Globe, color: "#1e3a5f",
  },

  // ─── العقارات ───
  {
    id: "reb", name: "الصندوق العقاري", nameEn: "Real Estate Development Fund",
    description: "قروض الإسكان، الدعم العقاري، طلبات الصندوق، تمويل المساكن",
    url: "https://reb.sa", status: "available", category: "العقارات",
    tags: ["إسكان", "قروض", "تمويل"], icon: Home, color: "#059669",
  },
  {
    id: "srca", name: "الهيئة العامة للعقار", nameEn: "SRCA",
    description: "تراخيص الوساطة العقارية، تسجيل المطورين، الشكاوى العقارية والنزاعات",
    url: "https://srca.gov.sa", status: "available", category: "العقارات",
    tags: ["وساطة", "مطورون", "نزاعات"], icon: Home, color: "#2563EB",
  },
  {
    id: "mmc", name: "وزارة الشؤون البلدية والقروية", nameEn: "MOMRA",
    description: "خدمات التخطيط العمراني، المشاريع البلدية، العقود الحكومية",
    url: "https://momra.gov.sa", status: "available", category: "العقارات",
    tags: ["تخطيط", "بلديات", "مشاريع"], icon: Building2, color: "#7c3aed",
  },

  // ─── الصحة ───
  {
    id: "moh", name: "وزارة الصحة", nameEn: "MOH",
    description: "التقارير الطبية، الخبرات الصحية، التراخيص الطبية، قضايا الأخطاء الطبية",
    url: "https://moh.gov.sa", status: "available", category: "الصحة",
    tags: ["طبي", "أخطاء طبية", "تقارير"], icon: Heart, color: "#dc2626",
  },
  {
    id: "scfhs", name: "الهيئة السعودية للتخصصات الصحية", nameEn: "SCFHS",
    description: "ترخيص المهن الصحية، التحقق من المؤهلات الطبية، الشكاوى المهنية",
    url: "https://scfhs.org.sa", status: "available", category: "الصحة",
    tags: ["ترخيص طبي", "مؤهلات", "شكاوى"], icon: Shield, color: "#0891b2",
  },
  {
    id: "cchi", name: "مجلس الضمان الصحي", nameEn: "CCHI",
    description: "التأمين الصحي الإلزامي، نزاعات التأمين، الشكاوى الصحية",
    url: "https://cchi.gov.sa", status: "available", category: "الصحة",
    tags: ["تأمين صحي", "نزاعات", "شكاوى"], icon: Heart, color: "#be185d",
  },

  // ─── التعليم والمؤهلات ───
  {
    id: "moe", name: "وزارة التعليم", nameEn: "MOE",
    description: "قضايا التعليم، التحقق من الشهادات، الخدمات الأكاديمية والنزاعات",
    url: "https://moe.gov.sa", status: "available", category: "التعليم والمؤهلات",
    tags: ["تعليم", "شهادات", "نزاعات"], icon: GraduationCap, color: "#0369a1",
  },
  {
    id: "etec", name: "هيئة تقويم التعليم والتدريب", nameEn: "ETEC",
    description: "اعتماد المؤهلات التعليمية، قياس القدرات، الشهادات المهنية",
    url: "https://etec.gov.sa", status: "available", category: "التعليم والمؤهلات",
    tags: ["اعتماد", "قدرات", "مهني"], icon: GraduationCap, color: "#7c3aed",
  },
  {
    id: "dataflow", name: "التحقق من الشهادات الأجنبية", nameEn: "Foreign Credentials",
    description: "التحقق من صحة الشهادات الأجنبية والمؤهلات غير السعودية",
    url: "https://mohe.gov.sa", status: "available", category: "التعليم والمؤهلات",
    tags: ["شهادات", "أجنبية", "تحقق"], icon: FileText, color: "#059669",
  },

  // ─── الاتصالات والرقابة ───
  {
    id: "citc", name: "هيئة الاتصالات والفضاء والتقنية", nameEn: "CST",
    description: "تراخيص الاتصالات والتقنية، شكاوى المستهلكين، حماية البيانات",
    url: "https://cst.gov.sa", status: "available", category: "الرقابة والهيئات",
    tags: ["اتصالات", "تقنية", "بيانات"], icon: Phone, color: "#0891b2",
  },
  {
    id: "nazaha", name: "هيئة مكافحة الفساد (نزاهة)", nameEn: "Nazaha",
    description: "الإبلاغ عن الفساد، البلاغات، حماية المبلّغين، قضايا النزاهة",
    url: "https://nazaha.gov.sa", status: "available", category: "الرقابة والهيئات",
    tags: ["فساد", "نزاهة", "بلاغات"], icon: Shield, color: "#dc2626",
  },
  {
    id: "hrcomm", name: "هيئة حقوق الإنسان", nameEn: "NSHR",
    description: "الشكاوى المتعلقة بحقوق الإنسان، التظلمات، قضايا الانتهاكات",
    url: "https://www.nshr.org.sa", status: "available", category: "الرقابة والهيئات",
    tags: ["حقوق", "شكاوى", "تظلم"], icon: Users, color: "#7c3aed",
  },
  {
    id: "stats", name: "الهيئة العامة للإحصاء", nameEn: "GASTAT",
    description: "البيانات الإحصائية الرسمية — ديموغرافيا، اقتصاد، سوق العمل",
    url: "https://stats.gov.sa", status: "available", category: "الرقابة والهيئات",
    tags: ["إحصاء", "بيانات", "سوق عمل"], icon: BarChart3, color: "#2563EB",
  },
  {
    id: "transport", name: "وزارة النقل والخدمات اللوجستية", nameEn: "MOT",
    description: "تراخيص النقل، قضايا الحوادث والمطالبات، السلامة المرورية",
    url: "https://mot.gov.sa", status: "available", category: "الرقابة والهيئات",
    tags: ["نقل", "حوادث", "مطالبات"], icon: Car, color: "#0369a1",
  },
  {
    id: "spa-energy", name: "وزارة الطاقة", nameEn: "MOE Energy",
    description: "تراخيص الطاقة والتعدين، العقود والنزاعات في قطاع الطاقة",
    url: "https://moenergy.gov.sa", status: "available", category: "الرقابة والهيئات",
    tags: ["طاقة", "تعدين", "تراخيص"], icon: Zap, color: "#d97706",
  },
];

const CATEGORIES = [...new Set(SYSTEMS.map(s => s.category))];

const STATUS_CONFIG: Record<SystemStatus, { label: string; color: string; bg: string; icon: any }> = {
  connected:    { label: "مرتبط",     color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle },
  available:    { label: "متاح",      color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30",       icon: Globe },
  coming_soon:  { label: "قريباً",    color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30",   icon: Clock },
};

const CATEGORY_ICONS: Record<string, any> = {
  "القضاء والمحاكم": Scale,
  "المحامون والمهن القانونية": Users,
  "العمل والموارد البشرية": Briefcase,
  "الضرائب والمالية": DollarSign,
  "السجل التجاري والأعمال": Building2,
  "العقارات": Home,
  "الصحة": Heart,
  "التعليم والمؤهلات": GraduationCap,
  "الرقابة والهيئات": Shield,
};

export default function SaudiSystems() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("الكل");
  const [connected, setConnected] = useState<Set<string>>(new Set());

  const toggleConnect = (id: string) => {
    setConnected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = SYSTEMS.filter(s => {
    const matchSearch = !search ||
      s.name.includes(search) ||
      s.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      s.description.includes(search) ||
      s.tags.some(t => t.includes(search));
    const matchCat = activeCategory === "الكل" || s.category === activeCategory;
    return matchSearch && matchCat;
  });

  const stats = {
    total: SYSTEMS.length,
    connected: connected.size,
    categories: CATEGORIES.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <span className="text-2xl">🇸🇦</span> الأنظمة الحكومية السعودية
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            ربط مباشر بجميع الجهات الحكومية السعودية ذات الصلة بالممارسة القانونية
          </p>
        </div>
        <div className="flex gap-3">
          {[
            { label: "نظام", value: stats.total, color: "#6366f1" },
            { label: "مرتبط", value: stats.connected, color: "#10b981" },
            { label: "جهة", value: stats.categories, color: "#2563EB" },
          ].map(s => (
            <div key={s.label} className="text-center px-4 py-2 bg-card border border-border/60 rounded-xl">
              <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث في الأنظمة... (ناجز، مدد، زكاة، تأمين...)"
          className="pr-10 h-11 text-sm bg-card border-border/60"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {["الكل", ...CATEGORIES].map(cat => {
          const Icon = cat === "الكل" ? Globe : CATEGORY_ICONS[cat];
          const count = cat === "الكل" ? SYSTEMS.length : SYSTEMS.filter(s => s.category === cat).length;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all whitespace-nowrap",
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground bg-card"
              )}>
              {Icon && <Icon className="h-3 w-3" />}
              {cat}
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                activeCategory === cat ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Systems grid by category */}
      {(activeCategory === "الكل" ? CATEGORIES : [activeCategory]).map(cat => {
        const catSystems = filtered.filter(s => s.category === cat);
        if (catSystems.length === 0) return null;
        const CatIcon = CATEGORY_ICONS[cat] || Globe;
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <CatIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <h2 className="font-bold text-sm">{cat}</h2>
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-xs text-muted-foreground">{catSystems.length} أنظمة</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {catSystems.map(sys => {
                const isConnected = connected.has(sys.id);
                const status: SystemStatus = isConnected ? "connected" : sys.status;
                const statusCfg = STATUS_CONFIG[status];
                const StatusIcon = statusCfg.icon;
                const SysIcon = sys.icon;
                return (
                  <Card key={sys.id}
                    className={cn(
                      "group hover:border-primary/30 transition-all duration-200",
                      isConnected && "border-emerald-500/30 bg-emerald-500/5"
                    )}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${sys.color}18` }}>
                          <SysIcon className="h-5 w-5" style={{ color: sys.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-sm">{sys.name}</h3>
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap font-medium",
                              statusCfg.bg, statusCfg.color
                            )}>
                              <StatusIcon className="h-2.5 w-2.5" />
                              {statusCfg.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 font-medium">{sys.nameEn}</p>
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
                        {sys.description}
                      </p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {sys.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-muted/50 text-muted-foreground rounded-md">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-7 text-xs gap-1"
                          onClick={() => window.open(sys.url, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="h-3 w-3" />
                          فتح النظام
                        </Button>
                        {sys.status !== "coming_soon" && (
                          <Button
                            size="sm"
                            className={cn(
                              "flex-1 h-7 text-xs gap-1",
                              isConnected
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-primary hover:bg-primary/90"
                            )}
                            onClick={() => toggleConnect(sys.id)}
                          >
                            {isConnected ? (
                              <><CheckCircle className="h-3 w-3" /> مرتبط</>
                            ) : (
                              <><Zap className="h-3 w-3" /> ربط</>
                            )}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">لم يتم العثور على نتائج</p>
          <p className="text-sm mt-1">جرب كلمة بحث مختلفة</p>
        </div>
      )}

      {/* Info banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-primary mb-1">ملاحظة حول الربط</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              زر "ربط" يسجّل النظام كمرتبط داخل المنصة ويفتح رابطه مباشرةً. الربط التلقائي الكامل مع بعض الأنظمة يتطلب اتفاقية API رسمية مع الجهة الحكومية. بإمكانك فتح أي نظام بنقرة واحدة في أي وقت.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
