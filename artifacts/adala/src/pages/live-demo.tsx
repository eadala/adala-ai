import { useState, useEffect, type ReactElement } from "react";
import { useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, Users, FileText, Receipt, TrendingUp, TrendingDown, Landmark,
  MessageSquare, BarChart3, Bot, ArrowLeft, Briefcase, Star, CheckCircle,
  Clock, AlertCircle, DollarSign, Building2, Phone, Mail, Calendar,
  Shield, Sparkles, Search, UserCircle, FileCheck, Activity, Award,
  BookOpen, ChevronDown, LayoutDashboard, Bell, ClipboardList, Globe,
  LogOut, Menu, Gavel, Zap, Brain, BarChart2, CreditCard, Wallet,
  TrendingUp as TU, ArrowUpRight, Plus, X, Send, Loader2, ChevronRight,
  CalendarDays, PieChart, Handshake, BadgeCheck,
  FileSignature, MessageCircle, UserCog, ArrowRightLeft, Network,
  Palette, Database, HardDrive, Wand2, Swords, LifeBuoy,
  ShoppingBag, Crown, AlertTriangle, Cpu, BrainCircuit, LibraryBig,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ══ OFFICES DATA ══════════════════════════════════════════════════════ */
const OFFICES = {
  north: {
    name: "مكتب الشمال القانوني",
    tagline: "قانون تجاري · مدني · عقاري",
    city: "الرياض",
    color: "#6366F1",
    plan: "باقة Ultimate",
    users: [
      { name: "أ. خالد الشمري",   role: "محامٍ أول — مدير المكتب", avatar: "خ", color: "bg-indigo-600" },
      { name: "أ. سلطان القحطاني", role: "محامٍ شريك",              avatar: "س", color: "bg-blue-600"   },
    ],
    stats: { cases: 47, clients: 38, revenues: "156,667", pending: 3, winRate: "91%", activeContracts: 12 },
    cases: [
      { id: "QD-2026-047", title: "نزاع تجاري – شركة الأفق العقارية",    client: "أحمد السعيد",        type: "تجاري",  status: "جارية",   priority: "عالية",    amount: "450,000", court: "المحكمة التجارية – الرياض",  next: "2026-07-10" },
      { id: "QD-2026-046", title: "دعوى استحقاق مالي – البنك الأهلي",    client: "مريم الدوسري",       type: "مدني",   status: "مجدولة",  priority: "عالية",    amount: "670,000", court: "المحكمة المدنية – الرياض",   next: "2026-07-14" },
      { id: "QD-2025-031", title: "قضية عقارية – ورثة الحربي",           client: "خالد الحربي",        type: "عقاري",  status: "فائزة",   priority: "منخفضة",  amount: "1,200,000", court: "المحكمة العامة – الدمام",   next: "—"          },
      { id: "QD-2025-018", title: "توثيق شراكة – مجموعة الوطن",          client: "فيصل القحطاني",      type: "تجاري",  status: "جارية",   priority: "متوسطة",  amount: "220,000", court: "المحكمة التجارية – الرياض",  next: "2026-07-20" },
      { id: "QD-2025-009", title: "عقد عمل – شركة النخيل للتقنية",       client: "سارة الزهراني",      type: "عمالي",  status: "مؤجلة",   priority: "متوسطة",  amount: "85,000",  court: "المحكمة العمالية – جدة",     next: "2026-08-01" },
    ],
    clients: [
      { name: "أحمد محمد السعيد",    type: "فرد",    cases: 3, status: "نشط",   value: "450,000", joined: "2024-01" },
      { name: "مريم سلطان الدوسري",  type: "فرد",    cases: 1, status: "نشط",   value: "670,000", joined: "2024-03" },
      { name: "شركة الأفق العقارية", type: "شركة",   cases: 4, status: "نشط",   value: "980,000", joined: "2023-09" },
      { name: "مجموعة الوطن التجارية",type: "شركة",  cases: 2, status: "نشط",   value: "560,000", joined: "2024-06" },
      { name: "خالد عبدالله الحربي", type: "فرد",    cases: 2, status: "منتهي", value: "1,285,000", joined: "2023-05" },
    ],
    invoices: [
      { id: "INV-2026-051", client: "أحمد السعيد",         amount: "45,000",  status: "مدفوع",  due: "2026-06-30" },
      { id: "INV-2026-050", client: "شركة الأفق العقارية",  amount: "125,000", status: "معلق",   due: "2026-07-15" },
      { id: "INV-2026-049", client: "مجموعة الوطن",         amount: "35,000",  status: "مدفوع",  due: "2026-06-20" },
      { id: "INV-2026-048", client: "مريم الدوسري",         amount: "80,000",  status: "متأخر",  due: "2026-06-10" },
    ],
    employees: [
      { name: "أ. خالد الشمري",    role: "محامٍ أول",  dept: "إدارة", salary: "22,000", perf: 97, status: "نشط" },
      { name: "أ. سلطان القحطاني", role: "محامٍ شريك", dept: "تجاري", salary: "18,000", perf: 91, status: "نشط" },
      { name: "أ. ريم الغامدي",    role: "محامية",     dept: "عمالي", salary: "14,000", perf: 88, status: "نشط" },
      { name: "أ. فيصل العمري",    role: "محامٍ",      dept: "عقاري", salary: "12,500", perf: 83, status: "نشط" },
    ],
    aiSummary: "لديك 3 قضايا تستحق مراجعة عاجلة هذا الأسبوع. قضية الأفق العقارية لديها موعد جلسة بعد 4 أيام — يُنصح بإعداد المرافعة الختامية اليوم. دعوى البنك الأهلي تحتاج إيداع مذكرة رد خلال 48 ساعة. نسبة الفوز هذا الربع 91% — أعلى مستوى منذ التأسيس.",
  },
  south: {
    name: "مكتب الجنوب للمحاماة",
    tagline: "قانون أسرة · عمالي · جنائي",
    city: "جدة",
    color: "#10B981",
    plan: "باقة Ultimate",
    users: [
      { name: "أ. منى الغامدي",    role: "محامية أولى — مديرة المكتب", avatar: "م", color: "bg-emerald-600" },
      { name: "أ. ريم الزهراني",   role: "محامية",                    avatar: "ر", color: "bg-teal-600"    },
    ],
    stats: { cases: 31, clients: 24, revenues: "89,400", pending: 2, winRate: "87%", activeContracts: 8 },
    cases: [
      { id: "QJ-2026-031", title: "قضية طلاق وحضانة – المطيري",       client: "نورة المطيري",        type: "أسرة",   status: "جارية",   priority: "عالية",   amount: "45,000",  court: "محكمة الأحوال الشخصية – جدة", next: "2026-07-08" },
      { id: "QJ-2026-030", title: "نزاع عمالي – شركة الجوهرة",        client: "محمد العتيبي",        type: "عمالي",  status: "مجدولة",  priority: "متوسطة",  amount: "38,500",  court: "المحكمة العمالية – جدة",       next: "2026-07-15" },
      { id: "QJ-2025-022", title: "قضية نفقة – أسرة الشهري",          client: "ليلى الشهري",         type: "أسرة",   status: "فائزة",   priority: "منخفضة",  amount: "25,000",  court: "محكمة الأحوال الشخصية – جدة", next: "—"          },
      { id: "QJ-2025-017", title: "إساءة وظيفية – شركة الرياح",       client: "عمر الدوسري",         type: "عمالي",  status: "جارية",   priority: "متوسطة",  amount: "62,000",  court: "المحكمة العمالية – جدة",       next: "2026-07-22" },
      { id: "QJ-2025-011", title: "قضية ميراث – آل الغامدي",           client: "صالح الغامدي",        type: "أسرة",   status: "مؤجلة",   priority: "متوسطة",  amount: "180,000", court: "المحكمة العامة – جدة",        next: "2026-08-05" },
    ],
    clients: [
      { name: "نورة المطيري",       type: "فرد",  cases: 2, status: "نشط",   value: "70,000",  joined: "2025-03" },
      { name: "محمد العتيبي",       type: "فرد",  cases: 1, status: "نشط",   value: "38,500",  joined: "2025-06" },
      { name: "شركة الجوهرة التجارية", type: "شركة", cases: 3, status: "نشط", value: "155,000", joined: "2024-11" },
      { name: "ليلى الشهري",        type: "فرد",  cases: 2, status: "منتهي", value: "40,000",  joined: "2024-07" },
      { name: "صالح غانم الغامدي",  type: "فرد",  cases: 1, status: "نشط",   value: "180,000", joined: "2024-09" },
    ],
    invoices: [
      { id: "INV-2026-031", client: "شركة الجوهرة",    amount: "28,000", status: "مدفوع",  due: "2026-06-25" },
      { id: "INV-2026-030", client: "نورة المطيري",    amount: "12,500", status: "معلق",   due: "2026-07-10" },
      { id: "INV-2026-029", client: "محمد العتيبي",    amount: "9,500",  status: "مدفوع",  due: "2026-06-18" },
      { id: "INV-2026-028", client: "صالح الغامدي",    amount: "45,000", status: "متأخر",  due: "2026-06-05" },
    ],
    employees: [
      { name: "أ. منى الغامدي",   role: "محامية أولى", dept: "إدارة", salary: "16,000", perf: 94, status: "نشط" },
      { name: "أ. ريم الزهراني",  role: "محامية",      dept: "أسرة",  salary: "12,000", perf: 86, status: "نشط" },
      { name: "أ. سلمى الحربي",   role: "محامية",      dept: "عمالي", salary: "11,500", perf: 81, status: "نشط" },
    ],
    aiSummary: "لديك قضية الأسرة (نورة المطيري) بجلسة خلال 4 أيام — التوصية بإعداد شهادة الشهود. الفاتورة INV-028 متأخرة 11 يوماً — أرسل تذكيراً للعميل اليوم. نسبة الفوز 87% هذا الربع. اقتراح AI: قضية الميراث تحتاج تقييم الأصول قبل الجلسة القادمة.",
  },
} as const;

type OfficeKey = keyof typeof OFFICES;

/* ══ STATUS COLORS ══════════════════════════════════════════════════ */
const ST: Record<string, string> = {
  "جارية":  "bg-blue-50 text-blue-700 border-blue-200",
  "مجدولة": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "فائزة":  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "مؤجلة":  "bg-amber-50 text-amber-700 border-amber-200",
  "مدفوع":  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "معلق":   "bg-amber-50 text-amber-700 border-amber-200",
  "متأخر":  "bg-red-50 text-red-700 border-red-200",
  "نشط":    "bg-emerald-50 text-emerald-700 border-emerald-200",
  "منتهي":  "bg-slate-100 text-slate-500 border-slate-200",
};
function Badge({ label }: { label: string }) {
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ST[label] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>{label}</span>;
}
function PriBadge({ p }: { p: string }) {
  const c = p === "عالية" ? "text-red-600" : p === "متوسطة" ? "text-amber-600" : "text-slate-400";
  return <span className={`text-xs font-bold ${c}`}>{p}</span>;
}

/* ══ NAV STRUCTURE ══════════════════════════════════════════════════ */
type Page =
  | "dashboard" | "cases" | "calendar" | "tasks" | "reminders"
  | "clients" | "client-portal" | "mediators"
  | "contracts" | "documents" | "doc-templates" | "letters"
  | "ai-copilot" | "ai-hub" | "adoul" | "ui-builder" | "ai-agents"
  | "legal-ai" | "legal-research" | "judge-prep" | "opponent-sim" | "arbitration"
  | "finance" | "invoices" | "collections" | "payment-center" | "revenues"
  | "expenses" | "cashflow" | "bank-accounts" | "advances"
  | "financial-reports" | "financial-statements" | "financial-core" | "billing"
  | "messages" | "email-notif" | "whatsapp" | "telegram"
  | "office-mgmt" | "marketplace" | "support"
  | "hr-enterprise" | "hr-center" | "hr-systems" | "employees"
  | "attendance" | "leaves" | "payroll" | "warnings"
  | "analytics" | "fin-intelligence" | "risk-mgmt" | "activity-stream"
  | "audit-logs" | "compliance" | "firm-admin" | "org-structure"
  | "team" | "office-settings" | "theme-builder" | "backup" | "storage";

interface CenterDef { id: string; label: string; icon: any; color: string; items: { id: Page; label: string; icon: any }[] }
const CENTERS: CenterDef[] = [
  { id: "cases", label: "إدارة القضايا", icon: Scale, color: "#6366F1", items: [
    { id: "dashboard",   label: "لوحة التحكم",   icon: LayoutDashboard },
    { id: "cases",       label: "القضايا",         icon: Scale },
    { id: "calendar",    label: "المواعيد",         icon: CalendarDays },
    { id: "tasks",       label: "المهام",            icon: ClipboardList },
    { id: "reminders",   label: "التذكيرات",        icon: Bell },
  ]},
  { id: "crm", label: "إدارة العملاء", icon: UserCircle, color: "#0EA5E9", items: [
    { id: "clients",       label: "الموكلون",          icon: Users },
    { id: "client-portal", label: "بوابة الموكل",      icon: Globe },
    { id: "mediators",     label: "الوسطاء",            icon: Handshake },
  ]},
  { id: "docs", label: "العقود والمستندات", icon: FileSignature, color: "#F59E0B", items: [
    { id: "contracts",     label: "العقود",             icon: Handshake },
    { id: "documents",     label: "المستندات",          icon: BookOpen },
    { id: "doc-templates", label: "قوالب المستندات",    icon: FileSignature },
    { id: "letters",       label: "المراسلات",           icon: Mail },
  ]},
  { id: "ai", label: "مركز الذكاء الاصطناعي", icon: Sparkles, color: "#8B5CF6", items: [
    { id: "ai-copilot",    label: "المساعد القانوني AI", icon: BrainCircuit },
    { id: "ai-hub",        label: "مركز الذكاء AI",     icon: Sparkles },
    { id: "adoul",         label: "عدول AI",             icon: Scale },
    { id: "ui-builder",    label: "منشئ الواجهات AI",   icon: Wand2 },
    { id: "ai-agents",     label: "وكلاء AI",            icon: Bot },
    { id: "legal-ai",      label: "المحرر القانوني",     icon: FileText },
    { id: "legal-research",label: "البحث القانوني",      icon: LibraryBig },
    { id: "judge-prep",    label: "تحضير الجلسة",        icon: Gavel },
    { id: "opponent-sim",  label: "محاكاة الخصم",        icon: Swords },
    { id: "arbitration",   label: "التحكيم الذكي",       icon: Handshake },
  ]},
  { id: "finance", label: "العمليات المالية", icon: DollarSign, color: "#10B981", items: [
    { id: "finance",            label: "لوحة المالية",      icon: DollarSign },
    { id: "invoices",           label: "الفواتير",           icon: Receipt },
    { id: "collections",        label: "التحصيل",            icon: TrendingUp },
    { id: "payment-center",     label: "مركز الدفع",         icon: Landmark },
    { id: "revenues",           label: "الإيرادات",          icon: TrendingUp },
    { id: "expenses",           label: "المصروفات",          icon: TrendingDown },
    { id: "cashflow",           label: "التدفق النقدي",      icon: ArrowRightLeft },
    { id: "bank-accounts",      label: "الحسابات البنكية",   icon: Landmark },
    { id: "advances",           label: "السلف",               icon: Wallet },
    { id: "financial-reports",  label: "التقارير المالية",   icon: BarChart2 },
    { id: "financial-statements",label: "القوائم المالية",   icon: Scale },
    { id: "financial-core",     label: "المحرك المالي",      icon: BarChart3 },
    { id: "billing",            label: "الاشتراك والباقة",   icon: CreditCard },
  ]},
  { id: "comms", label: "مركز الاتصالات", icon: MessageCircle, color: "#F97316", items: [
    { id: "messages",     label: "الرسائل الداخلية",   icon: MessageCircle },
    { id: "email-notif",  label: "إشعارات البريد",     icon: Mail },
    { id: "whatsapp",     label: "واتساب",              icon: MessageSquare },
    { id: "telegram",     label: "تيليغرام",            icon: Send },
    { id: "office-mgmt",  label: "المكتب الإلكتروني",  icon: Globe },
    { id: "marketplace",  label: "سوق الخدمات",         icon: ShoppingBag },
    { id: "support",      label: "الدعم الفني",          icon: LifeBuoy },
  ]},
  { id: "hr", label: "رأس المال البشري", icon: Users, color: "#F43F5E", items: [
    { id: "hr-enterprise", label: "HR المؤسسي",          icon: Shield },
    { id: "hr-center",     label: "مركز HR",              icon: Award },
    { id: "hr-systems",    label: "أنظمة HR",             icon: Building2 },
    { id: "employees",     label: "الموظفون",             icon: UserCog },
    { id: "attendance",    label: "الحضور والغياب",       icon: Clock },
    { id: "leaves",        label: "الإجازات",             icon: CalendarDays },
    { id: "payroll",       label: "الرواتب",              icon: DollarSign },
    { id: "warnings",      label: "التنبيهات التأديبية",  icon: AlertTriangle },
  ]},
  { id: "settings", label: "التحليلات والإعدادات", icon: BarChart3, color: "#64748B", items: [
    { id: "analytics",         label: "تحليلات الأداء",   icon: BarChart3 },
    { id: "fin-intelligence",  label: "الذكاء المالي",    icon: BrainCircuit },
    { id: "risk-mgmt",         label: "إدارة المخاطر",    icon: AlertTriangle },
    { id: "activity-stream",   label: "سجل النشاط",       icon: Activity },
    { id: "audit-logs",        label: "سجلات التدقيق",    icon: Activity },
    { id: "compliance",        label: "الامتثال",          icon: Shield },
    { id: "firm-admin",        label: "إدارة المكتب",     icon: Crown },
    { id: "org-structure",     label: "الهيكل التنظيمي",  icon: Network },
    { id: "team",              label: "الفريق والصلاحيات", icon: Shield },
    { id: "office-settings",   label: "إعدادات المكتب",   icon: Building2 },
    { id: "theme-builder",     label: "منشئ الثيم",        icon: Palette },
    { id: "backup",            label: "النسخ الاحتياطي",  icon: Database },
    { id: "storage",           label: "إدارة التخزين",    icon: HardDrive },
  ]},
];

/* ══ SIDEBAR ════════════════════════════════════════════════════════ */
function Sidebar({ office, userIdx, activePage, onNav, onClose }: {
  office: typeof OFFICES[OfficeKey]; userIdx: number; activePage: Page;
  onNav: (p: Page) => void; onClose?: () => void;
}) {
  const [open, setOpen] = useState<Record<string,boolean>>({ cases: true, crm: true, docs: true, ai: true, finance: true, comms: true, hr: true, settings: true });
  const user = office.users[userIdx] ?? office.users[0];
  const color = office.color;

  return (
    <aside className="flex h-full w-64 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center px-4 border-b border-sidebar-border gap-3 shrink-0">
        <div className="h-9 w-9 rounded-md flex items-center justify-center text-white font-bold text-base shrink-0"
          style={{ backgroundColor: color }}>
          <Scale className="h-5 w-5" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold tracking-tight text-sidebar-foreground truncate leading-tight">{office.name}</span>
          <span className="text-[10px] text-sidebar-foreground/50 truncate leading-tight">{office.tagline}</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="mr-auto text-sidebar-foreground/50 hover:text-sidebar-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 scrollbar-thin">
        {CENTERS.map(c => {
          const isAny = c.items.some(i => i.id === activePage);
          const CIcon = c.icon;
          return (
            <div key={c.id}>
              <button onClick={() => setOpen(o => ({ ...o, [c.id]: !o[c.id] }))}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all mb-0.5 ${isAny ? "text-sidebar-foreground" : "text-sidebar-foreground/40 hover:text-sidebar-foreground/70"}`}>
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: isAny ? `${c.color}25` : "transparent" }}>
                  <CIcon className="h-3 w-3" style={{ color: isAny ? c.color : "currentColor" }} />
                </div>
                <span className="flex-1 text-right truncate">{c.label}</span>
                <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${open[c.id] ? "rotate-180" : ""}`} style={{ color: isAny ? c.color : "currentColor" }} />
              </button>
              {open[c.id] && (
                <div className="mb-2 space-y-0.5 pr-2 mr-3 border-r border-dashed" style={{ borderColor: `${c.color}35` }}>
                  {c.items.map(item => {
                    const IIcon = item.icon;
                    const isActive = activePage === item.id;
                    return (
                      <button key={item.id} onClick={() => { onNav(item.id); onClose?.(); }}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all w-full text-right ${isActive ? "text-primary font-semibold" : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"}`}
                        style={isActive ? { backgroundColor: `${c.color}18`, borderRight: `2px solid ${c.color}` } : {}}>
                        <IIcon className="h-3.5 w-3.5 flex-shrink-0" style={isActive ? { color: c.color } : {}} />
                        <span className="flex-1">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-full ${user.color} flex items-center justify-center text-white font-black text-sm shrink-0`}>{user.avatar}</div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</span>
            <span className="text-xs text-sidebar-foreground/60 truncate">{user.role}</span>
          </div>
          <a href={`${BASE}/`} title="الخروج من التجربة"
            className="h-7 w-7 flex items-center justify-center rounded text-sidebar-foreground/50 hover:text-red-500 hover:bg-red-500/10 transition-all">
            <LogOut className="h-4 w-4" />
          </a>
        </div>
      </div>
    </aside>
  );
}

/* ══ DASHBOARD PAGE ══════════════════════════════════════════════════ */
function DashboardPage({ office, userIdx, onNav }: { office: typeof OFFICES[OfficeKey]; userIdx: number; onNav:(p:Page)=>void }) {
  const user = office.users[userIdx] ?? office.users[0];
  const [aiShown, setAiShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAiShown(true), 800); return () => clearTimeout(t); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">مرحباً، {user.name.split("أ. ")[1] ?? user.name} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">لوحة تحكم {office.name} · {new Date().toLocaleDateString("ar-SA", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "القضايا النشطة",  value: office.stats.cases,    icon: Scale,       color: "text-indigo-600", bg: "bg-indigo-50", page: "cases"    as Page },
          { label: "الموكلون",         value: office.stats.clients,  icon: Users,       color: "text-sky-600",    bg: "bg-sky-50",    page: "clients"  as Page },
          { label: "الإيرادات (﷼)",    value: office.stats.revenues, icon: TrendingUp,  color: "text-emerald-600",bg: "bg-emerald-50",page: "invoices" as Page },
          { label: "قضايا معلقة",      value: office.stats.pending,  icon: Clock,       color: "text-amber-600",  bg: "bg-amber-50",  page: "cases"    as Page },
          { label: "نسبة الفوز",       value: office.stats.winRate,  icon: Award,       color: "text-rose-600",   bg: "bg-rose-50",   page: "cases"    as Page },
          { label: "العقود النشطة",    value: office.stats.activeContracts, icon: FileCheck, color: "text-violet-600", bg: "bg-violet-50", page: "contracts" as Page },
        ].map(s => {
          const IIcon = s.icon;
          return (
            <button key={s.label} onClick={() => onNav(s.page)}
              className="bg-card border border-border rounded-xl p-4 text-right hover:shadow-md transition-all hover:border-primary/30 group">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <IIcon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Cases */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground flex items-center gap-2"><Scale className="h-4 w-4 text-indigo-600" />آخر القضايا</h3>
            <button onClick={() => onNav("cases")} className="text-xs text-primary hover:underline flex items-center gap-1">عرض الكل <ArrowLeft className="h-3 w-3" /></button>
          </div>
          <div className="space-y-2">
            {office.cases.slice(0, 4).map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer border border-border/50">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <Scale className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.client} · {c.type}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge label={c.status} />
                  <span className="text-xs text-muted-foreground">{c.amount} ﷼</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* AI Insight */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">تحليل عدالة AI</h3>
              <p className="text-[10px] text-muted-foreground">محدَّث الآن</p>
            </div>
          </div>
          {!aiShown ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1">
              <p className="text-sm text-muted-foreground leading-relaxed">{office.aiSummary}</p>
              <button onClick={() => onNav("ai-hub")} className="mt-4 w-full py-2 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold transition-colors border border-violet-200">
                افتح مساعد AI ←
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" />إجراءات سريعة</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "قضية جديدة",   icon: Scale,     page: "cases"     as Page, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
            { label: "موكل جديد",    icon: UserCircle,page: "clients"   as Page, color: "text-sky-600 bg-sky-50 border-sky-200"           },
            { label: "فاتورة جديدة", icon: Receipt,   page: "invoices"  as Page, color: "text-emerald-600 bg-emerald-50 border-emerald-200"},
            { label: "سجل موعداً",   icon: CalendarDays, page: "calendar" as Page, color: "text-rose-600 bg-rose-50 border-rose-200"     },
          ].map(a => {
            const AIcon = a.icon;
            return (
              <button key={a.label} onClick={() => onNav(a.page)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all hover:shadow-sm hover:scale-[1.02] ${a.color}`}>
                <AIcon className="h-4 w-4 shrink-0" />{a.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══ CASES PAGE ══════════════════════════════════════════════════════ */
function CasesPage({ office }: { office: typeof OFFICES[OfficeKey] }) {
  const [search, setSearch] = useState("");
  const filtered = office.cases.filter(c => c.title.includes(search) || c.client.includes(search));
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-black text-foreground">القضايا</h1><p className="text-sm text-muted-foreground">{office.cases.length} قضية إجمالاً</p></div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all"><Plus className="h-4 w-4" />قضية جديدة</button>
      </div>
      <div className="relative mb-4"><Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في القضايا..." className="w-full bg-card border border-border rounded-xl py-2.5 pr-9 pl-4 text-sm focus:outline-none focus:border-primary/60" /></div>
      <div className="space-y-3">
        {filtered.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                <Scale className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground font-mono">{c.id}</span>
                  <Badge label={c.status} />
                  <PriBadge p={c.priority} />
                </div>
                <p className="font-bold text-foreground mb-1">{c.title}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><UserCircle className="h-3 w-3"/>{c.client}</span>
                  <span className="flex items-center gap-1"><Gavel className="h-3 w-3"/>{c.court}</span>
                  {c.next !== "—" && <span className="flex items-center gap-1 text-amber-600"><CalendarDays className="h-3 w-3"/>الجلسة: {c.next}</span>}
                </div>
              </div>
              <div className="text-left shrink-0">
                <p className="text-base font-black text-foreground">{c.amount} <span className="text-xs font-normal">﷼</span></p>
                <p className="text-xs text-muted-foreground">{c.type}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ══ CLIENTS PAGE ════════════════════════════════════════════════════ */
function ClientsPage({ office }: { office: typeof OFFICES[OfficeKey] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-black text-foreground">الموكلون</h1><p className="text-sm text-muted-foreground">{office.clients.length} موكل</p></div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all"><Plus className="h-4 w-4" />موكل جديد</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {office.clients.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-all cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-black text-base shrink-0">{c.name[0]}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground truncate">{c.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{c.type}</span>
                  <Badge label={c.status} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center border-t border-border pt-3 mt-3">
              <div><p className="text-sm font-black text-indigo-600">{c.cases}</p><p className="text-[10px] text-muted-foreground">قضايا</p></div>
              <div><p className="text-sm font-black text-emerald-600">{c.value} ﷼</p><p className="text-[10px] text-muted-foreground">إجمالي الأتعاب</p></div>
              <div><p className="text-sm font-black text-muted-foreground">{c.joined}</p><p className="text-[10px] text-muted-foreground">تاريخ الانضمام</p></div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ══ INVOICES PAGE ═══════════════════════════════════════════════════ */
function InvoicesPage({ office }: { office: typeof OFFICES[OfficeKey] }) {
  const total = office.invoices.reduce((s, i) => s + Number(i.amount.replace(",","")), 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-black text-foreground">الفواتير</h1><p className="text-sm text-muted-foreground">إجمالي: {total.toLocaleString()} ﷼</p></div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90"><Plus className="h-4 w-4" />فاتورة جديدة</button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/30">
            <tr className="text-xs text-muted-foreground font-semibold">
              <th className="text-right px-4 py-3">رقم الفاتورة</th>
              <th className="text-right px-4 py-3">الموكل</th>
              <th className="text-right px-4 py-3">المبلغ</th>
              <th className="text-right px-4 py-3">تاريخ الاستحقاق</th>
              <th className="text-right px-4 py-3">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {office.invoices.map((inv, i) => (
              <motion.tr key={inv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="hover:bg-muted/30 transition-colors cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.id}</td>
                <td className="px-4 py-3 font-medium text-foreground">{inv.client}</td>
                <td className="px-4 py-3 font-black text-emerald-600">{inv.amount} ﷼</td>
                <td className="px-4 py-3 text-muted-foreground">{inv.due}</td>
                <td className="px-4 py-3"><Badge label={inv.status} /></td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══ EMPLOYEES PAGE ══════════════════════════════════════════════════ */
function EmployeesPage({ office }: { office: typeof OFFICES[OfficeKey] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-black text-foreground">الموظفون</h1><p className="text-sm text-muted-foreground">{office.employees.length} موظف</p></div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"><Plus className="h-4 w-4" />موظف جديد</button>
      </div>
      <div className="space-y-3">
        {office.employees.map((e, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-black text-base shrink-0">{e.name[3] ?? e.name[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground">{e.name}</p>
              <p className="text-xs text-muted-foreground">{e.role} · {e.dept}</p>
            </div>
            <div className="text-center shrink-0">
              <p className="text-sm font-black text-foreground">{e.salary} ﷼</p>
              <p className="text-[10px] text-muted-foreground">الراتب</p>
            </div>
            <div className="text-center shrink-0">
              <div className="flex items-center gap-1">
                <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${e.perf}%` }} />
                </div>
                <span className="text-xs font-bold text-emerald-600">{e.perf}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">الأداء</p>
            </div>
            <Badge label={e.status} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ══ AI PAGE ═════════════════════════════════════════════════════════ */
function AiPage({ office }: { office: typeof OFFICES[OfficeKey] }) {
  const [messages, setMessages] = useState<{ role: "ai" | "user"; text: string }[]>([
    { role: "ai", text: `مرحباً! أنا مساعد عدالة AI لـ ${office.name}. كيف يمكنني مساعدتك اليوم؟ يمكنني تلخيص القضايا، إنشاء المستندات، وتحليل الوضع القانوني.` },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const QUICK = ["لخّص لي آخر قضية","ما القضايا ذات الأولوية العالية؟","أنشئ مذكرة دفاعية","ما إجمالي الإيرادات هذا الشهر؟"];
  const RESPONSES: Record<string, string> = {
    "لخّص لي آخر قضية": `آخر قضية مسجّلة: **${office.cases[0].title}** للموكل ${office.cases[0].client}. القيمة: ${office.cases[0].amount} ﷼، الحالة: ${office.cases[0].status}، الجلسة القادمة: ${office.cases[0].next}. التوصية: مراجعة ملف الأدلة وإعداد المرافعة قبل 48 ساعة من الجلسة.`,
    "ما القضايا ذات الأولوية العالية؟": `لديك **${office.cases.filter(c=>c.priority==="عالية").length} قضايا عالية الأولوية**:\n${office.cases.filter(c=>c.priority==="عالية").map(c=>`• ${c.title} (${c.client}) — الجلسة: ${c.next}`).join("\n")}`,
    "أنشئ مذكرة دفاعية": `تم إنشاء مسوّدة المذكرة الدفاعية لقضية **${office.cases[0].title}**:\n\n**بسم الله الرحمن الرحيم**\nإلى المحكمة الموقّرة، يتشرف مكتب **${office.name}** بتقديم هذه المذكرة دفاعاً عن موكله ${office.cases[0].client}...\n\n✅ يمكنك تعديل المذكرة أو حفظها من صفحة المستندات.`,
    "ما إجمالي الإيرادات هذا الشهر؟": `إجمالي الإيرادات لهذا الشهر: **${office.stats.revenues} ﷼**\n• مدفوع: ${office.invoices.filter(i=>i.status==="مدفوع").map(i=>i.amount).join(" + ")} ﷼\n• معلق: ${office.invoices.filter(i=>i.status==="معلق").map(i=>i.amount).join(", ")} ﷼\n• متأخر: ${office.invoices.filter(i=>i.status==="متأخر").map(i=>i.amount).join(", ")} ﷼`,
  };
  function send(text: string) {
    if (!text.trim()) return;
    setMessages(m => [...m, { role: "user", text }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const resp = RESPONSES[text] ?? `فهمت سؤالك: "${text}". أنا أعمل على تحليل بيانات المكتب للإجابة بدقة. في النسخة الحقيقية، سيتصل AI بملفاتك وقضاياك وعملائك مباشرةً لإعطاء إجابة دقيقة ومخصّصة.`;
      setMessages(m => [...m, { role: "ai", text: resp }]);
      setThinking(false);
    }, 1200);
  }
  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-200px)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center"><Sparkles className="h-5 w-5 text-violet-600" /></div>
        <div><h1 className="text-xl font-black text-foreground">مساعد عدالة AI</h1><p className="text-xs text-muted-foreground">متصل ببيانات {office.name}</p></div>
      </div>
      <div className="flex-1 bg-card border border-border rounded-xl p-4 overflow-y-auto space-y-3 mb-4 min-h-[300px]">
        {messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "ai" ? "bg-violet-100" : "bg-primary"}`}>
              {m.role === "ai" ? <Sparkles className="h-4 w-4 text-violet-600" /> : <span className="text-primary-foreground text-xs font-bold">أ</span>}
            </div>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${m.role === "ai" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"}`}>
              {m.text}
            </div>
          </motion.div>
        ))}
        {thinking && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center"><Sparkles className="h-4 w-4 text-violet-600" /></div>
            <div className="bg-muted px-4 py-3 rounded-2xl flex items-center gap-1.5">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {QUICK.map(q => <button key={q} onClick={() => send(q)} className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/60 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all">{q}</button>)}
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="اكتب سؤالك..." className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary/60" />
        <button onClick={() => send(input)} disabled={!input.trim()} className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-40 hover:opacity-90 transition-all">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ══ SIMPLE PAGES ════════════════════════════════════════════════════ */
function CalendarPage({ office }: { office: typeof OFFICES[OfficeKey] }) {
  const upcoming = office.cases.filter(c => c.next !== "—");
  return (
    <div>
      <h1 className="text-xl font-black text-foreground mb-6">المواعيد والجلسات</h1>
      <div className="space-y-3">
        {upcoming.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-200 flex flex-col items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5 text-amber-600 mb-0.5" />
              <span className="text-[10px] font-bold text-amber-700">{c.next.split("-")[2]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground truncate">{c.title}</p>
              <p className="text-xs text-muted-foreground">{c.court}</p>
              <p className="text-xs text-amber-600 font-semibold mt-1">{c.next}</p>
            </div>
            <Badge label={c.status} />
          </motion.div>
        ))}
        {upcoming.length === 0 && <p className="text-muted-foreground text-sm text-center py-8">لا توجد جلسات قادمة</p>}
      </div>
    </div>
  );
}

function ContractsPage() {
  const CONTRACTS = [
    { title: "عقد تمثيل قانوني – ورثة الحربي",     client: "خالد الحربي",   value: "85,000",  type: "تمثيل",    status: "ساري",   start: "2025-07-15", end: "2026-07-14" },
    { title: "عقد استشارة دورية – شركة الأفق",      client: "شركة الأفق",    value: "180,000", type: "استشارة",  status: "ساري",   start: "2025-01-01", end: "2026-12-31" },
    { title: "عقد تمثيل – البنك الأهلي",            client: "مريم الدوسري",  value: "40,000",  type: "تمثيل",    status: "ساري",   start: "2026-02-01", end: "2026-12-01" },
  ];
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-foreground">العقود</h1>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"><Plus className="h-4 w-4" />عقد جديد</button>
      </div>
      <div className="space-y-3">
        {CONTRACTS.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground mb-1">{c.title}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span><UserCircle className="inline h-3 w-3 ml-1"/>{c.client}</span>
                  <span>{c.start} → {c.end}</span>
                  <span className="bg-muted px-2 rounded">{c.type}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Badge label={c.status} />
                <span className="text-sm font-black text-amber-600">{c.value} ﷼</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function DocumentsPage() {
  const DOCS = [
    { name: "لائحة الدعوى – الأفق العقارية",   type: "لائحة دعوى",    size: "245 KB", date: "2026-06-01", status: "مُفهرس" },
    { name: "عقد الشراكة – مجموعة الوطن",       type: "عقد",           size: "128 KB", date: "2026-05-18", status: "مُفهرس" },
    { name: "مذكرة دفاعية – قضية البنك",        type: "مذكرة",         size: "312 KB", date: "2026-06-10", status: "مسوّدة" },
    { name: "توكيل رسمي – الحربي",              type: "توكيل",         size: "88 KB",  date: "2025-07-15", status: "مُفهرس" },
    { name: "حكم قضية ورثة الحربي",             type: "حكم",           size: "540 KB", date: "2026-03-22", status: "مُفهرس" },
  ];
  const iconColor: Record<string, string> = { "لائحة دعوى": "text-indigo-600", "عقد": "text-amber-600", "مذكرة": "text-violet-600", "توكيل": "text-blue-600", "حكم": "text-emerald-600" };
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-black text-foreground">المستندات</h1>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"><Plus className="h-4 w-4" />رفع مستند</button>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {DOCS.map((d, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
            className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer ${i < DOCS.length-1 ? "border-b border-border" : ""}`}>
            <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
              <FileText className={`h-4 w-4 ${iconColor[d.type] ?? "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.type} · {d.size} · {d.date}</p>
            </div>
            <Badge label={d.status} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ══ FEATURE SHOWCASE PAGE (for pages without full implementations) ══ */
const FEATURE_META: Record<string, { title: string; desc: string; color: string; icon: any; highlights: string[]; stats?: { label: string; value: string }[] }> = {
  "tasks":             { title: "إدارة المهام",           color: "#6366F1", icon: ClipboardList, desc: "تنظيم مهام الفريق وتوزيعها على المحامين مع متابعة الإنجاز بشكل لحظي.", highlights: ["إنشاء مهام وتعيينها للمحامين","تتبع حالة الإنجاز","أولويات ومواعيد نهائية","ربط المهام بالقضايا"], stats: [{label:"مهمة نشطة",value:"14"},{label:"مكتملة هذا الشهر",value:"67"},{label:"معدل الإنجاز",value:"91%"}] },
  "reminders":         { title: "التذكيرات الذكية",        color: "#6366F1", icon: Bell,          desc: "تذكيرات آلية للجلسات والمواعيد والفواتير — واتساب وبريد وتيليغرام في آنٍ واحد.", highlights: ["تذكيرات متعددة القنوات","توقيت مخصص قبل الحدث","ربط بالقضايا والعملاء","لوجز الإرسال"], stats: [{label:"تذكير مُرسَل هذا الشهر",value:"143"},{label:"معدل الاستلام",value:"99%"}] },
  "client-portal":     { title: "بوابة الموكل",            color: "#0EA5E9", icon: Globe,         desc: "بوابة خاصة لكل موكل يتابع فيها قضاياه ومستنداته وفواتيره بشكل آمن.", highlights: ["دخول آمن بكلمة مرور","متابعة حالة القضايا","تحميل المستندات","سداد الفواتير عبر البوابة"], stats: [{label:"موكل نشط في البوابة",value:"24"},{label:"رضا العملاء",value:"4.9/5"}] },
  "mediators":         { title: "الوسطاء والمحكمون",       color: "#0EA5E9", icon: Handshake,     desc: "قاعدة بيانات شاملة للوسطاء والمحكمين مع إدارة ملفاتهم وتواصل مباشر.", highlights: ["قاعدة وسطاء معتمدين","ربط بقضايا التحكيم","تقييمات وسجلات","جدولة جلسات وساطة"] },
  "doc-templates":     { title: "قوالب المستندات",         color: "#F59E0B", icon: FileSignature,  desc: "مكتبة قوالب قانونية جاهزة تُملأ آلياً ببيانات الموكل والقضية.", highlights: ["50+ قالب قانوني جاهز","ملء آلي بالبيانات","تخصيص القوالب","توقيع إلكتروني مدمج"], stats: [{label:"قالب جاهز",value:"54"},{label:"مستند مُنشأ هذا الشهر",value:"29"}] },
  "letters":           { title: "المراسلات الرسمية",        color: "#F59E0B", icon: Mail,          desc: "إنشاء خطابات وإشعارات رسمية مع إمكانية الإرسال المباشر بريدياً.", highlights: ["قوالب خطابات رسمية","إرسال بريدي مباشر","أرشفة المراسلات","ختم رقمي"] },
  "ai-copilot":        { title: "المساعد القانوني AI",      color: "#8B5CF6", icon: BrainCircuit,  desc: "مساعد ذكي يتفهم سياق قضاياك ويُجيب بعمق قانوني مُستند إلى ملفاتك الفعلية.", highlights: ["ذاكرة قضايا المكتب","مرجع أنظمة سعودية","اقتراحات استراتيجية","ربط بالمستندات"], stats: [{label:"استعلام هذا الشهر",value:"312"},{label:"دقة الإجابات",value:"96%"}] },
  "ai-hub":            { title: "مركز الذكاء AI",           color: "#8B5CF6", icon: Sparkles,      desc: "مركز موحّد لجميع أدوات الذكاء الاصطناعي في المنصة — كل الطاقة في مكان واحد.", highlights: ["7 أوضاع محادثة AI","أدوات قانونية متخصصة","تاريخ المحادثات","مشاركة التحليلات"] },
  "adoul":             { title: "عدول AI",                  color: "#8B5CF6", icon: Scale,         desc: "توثيق العقود وصياغتها بذكاء اصطناعي وفق الأنظمة السعودية.", highlights: ["صياغة عقود آلية","توثيق رقمي","امتثال أنظمة المملكة","توقيع إلكتروني"] },
  "ui-builder":        { title: "منشئ الواجهات AI",         color: "#8B5CF6", icon: Wand2,         desc: "أنشئ صفحات ولوحات تحكم مخصصة لمكتبك بمجرد وصف ما تريد.", highlights: ["توليد واجهات من النص","7 أنواع مكونات","قوالب قانونية جاهزة","تصدير مباشر"], stats: [{label:"واجهة مُنشأة",value:"12"}] },
  "ai-agents":         { title: "وكلاء AI",                 color: "#8B5CF6", icon: Bot,           desc: "وكلاء ذكاء اصطناعي يعملون باستقلالية لأتمتة المهام المتكررة.", highlights: ["وكيل متابعة الجلسات","وكيل التحصيل","وكيل تحضير المرافعات","سجل تفصيلي للأفعال"] },
  "legal-ai":          { title: "المحرر القانوني",           color: "#8B5CF6", icon: FileText,      desc: "توليد لوائح ومذكرات ومستندات قانونية احترافية بضغطة واحدة.", highlights: ["11 نوع مستند","صياغة باللغة القانونية","تعديل وتخصيص","تصدير PDF/Word"], stats: [{label:"مستند مُنشأ",value:"48"},{label:"ساعة وُفّرت",value:"96"}] },
  "legal-research":    { title: "البحث القانوني",            color: "#8B5CF6", icon: LibraryBig,    desc: "بحث فوري في الأنظمة واللوائح والأحكام السعودية مدعوم بالذكاء الاصطناعي.", highlights: ["قاعدة أنظمة سعودية كاملة","بحث طبيعي","اقتباس تلقائي","مقارنة الأحكام"] },
  "judge-prep":        { title: "تحضير الجلسة",              color: "#8B5CF6", icon: Gavel,         desc: "أداة ذكية تُحضّر لك حزمة الجلسة الكاملة: ملخص + حجج + أسئلة متوقعة.", highlights: ["ملخص القضية تلقائياً","توقع أسئلة القاضي","ترتيب الحجج","تقدير نسبة الفوز"] },
  "opponent-sim":      { title: "محاكاة الخصم",              color: "#8B5CF6", icon: Swords,        desc: "ذكاء اصطناعي يُمثّل محامي الخصم ويُدرّبك على الرد على حججه.", highlights: ["محاكاة حجج الخصم","كشف نقاط الضعف","تدريب تفاعلي","تقرير نقاط القوة"] },
  "arbitration":       { title: "التحكيم الذكي",             color: "#8B5CF6", icon: Handshake,     desc: "إدارة قضايا التحكيم من الألف إلى الياء مع دعم AI للإجراءات.", highlights: ["إدارة دورة التحكيم","ربط الوسطاء","جلسات افتراضية","قرارات موثقة"] },
  "finance":           { title: "لوحة المالية",              color: "#10B981", icon: DollarSign,    desc: "نظرة شاملة على الوضع المالي: إيرادات، مصروفات، تدفق نقدي، ومؤشرات الأداء.", highlights: ["لوحة تحكم مالية متكاملة","مؤشرات KPI مالية","مقارنة الأهداف","توقعات الإيرادات"], stats: [{label:"إيرادات هذا الشهر",value:"156,667 ﷼"},{label:"نمو عن الشهر السابق",value:"+18%"}] },
  "collections":       { title: "مركز التحصيل",              color: "#10B981", icon: TrendingUp,    desc: "تتبع المبالغ المستحقة وأتمتة التذكيرات وإدارة خطط السداد.", highlights: ["قائمة المتأخرين تلقائياً","تذكيرات آلية","خطط تقسيط","تقارير التحصيل"] },
  "payment-center":    { title: "مركز الدفع",                color: "#10B981", icon: Landmark,      desc: "بوابة دفع متكاملة تدعم مدى وبطاقات ائتمانية وتحويل بنكي.", highlights: ["Stripe + مدى","رسوم منصة شفافة","سجل كامل للمعاملات","تسويات تلقائية"] },
  "revenues":          { title: "الإيرادات",                 color: "#10B981", icon: TrendingUp,    desc: "تسجيل وتصنيف جميع إيرادات المكتب مع ربطها بالقضايا والعملاء.", highlights: ["تسجيل آلي من الفواتير","تصنيف حسب نوع القضية","رسوم بيانية شهرية","مقارنة سنوية"] },
  "expenses":          { title: "المصروفات",                 color: "#10B981", icon: TrendingDown,  desc: "تتبع مصروفات المكتب وتصنيفها بالفئات مع رفع الإيصالات.", highlights: ["رفع الإيصالات","تصنيف المصروفات","حدود الميزانية","تقارير الإنفاق"] },
  "cashflow":          { title: "التدفق النقدي",              color: "#10B981", icon: ArrowRightLeft,desc: "تحليل مدفوعات ومقبوضات المكتب بشكل أسبوعي وشهري وسنوي.", highlights: ["رسم بياني تفاعلي","توقعات 90 يوم","تنبيه نقص السيولة","تصدير Excel"] },
  "bank-accounts":     { title: "الحسابات البنكية",           color: "#10B981", icon: Landmark,      desc: "ربط وإدارة حسابات المكتب البنكية مع تسوية آلية.", highlights: ["ربط بالبنوك السعودية","تسوية آلية","كشف حساب مفصّل","فصل الأموال"] },
  "advances":          { title: "السلف والمُقدَّمات",          color: "#10B981", icon: Wallet,        desc: "إدارة السلف المدفوعة للموظفين والمُقدَّمات المستلمة من العملاء.", highlights: ["سلف الموظفين","مُقدَّمات العملاء","خصم تلقائي من الراتب","تقارير السلف"] },
  "financial-reports": { title: "التقارير المالية",           color: "#10B981", icon: BarChart2,     desc: "تقارير مالية احترافية جاهزة للطباعة: الأرباح والخسائر، المقارنات، التوقعات.", highlights: ["P&L تلقائي","مقارنة الأشهر","تصدير PDF","تقارير مخصصة"] },
  "financial-statements":{ title:"القوائم المالية",          color: "#10B981", icon: Scale,         desc: "قوائم مالية محاسبية: الميزانية العمومية، قائمة الدخل، التدفقات النقدية.", highlights: ["قيد مزدوج محاسبي","ميزانية عمومية","قائمة دخل","ميزان المراجعة"] },
  "financial-core":    { title: "المحرك المالي",              color: "#10B981", icon: BarChart3,     desc: "طبقة الدفع المتقدمة: Stripe + Moyasar + Checkout.com مع تسويات لحظية.", highlights: ["3 بوابات دفع MENA","عمولات شفافة","مستوى المؤسسة","Mada + Apple Pay"] },
  "billing":           { title: "الاشتراك والباقة",           color: "#10B981", icon: CreditCard,    desc: "إدارة خطة اشتراكك والفوترة وسجل المدفوعات.", highlights: ["تغيير الباقة","فواتير الاشتراك","رموز الخصم","هدايا الاشتراك"] },
  "messages":          { title: "الرسائل الداخلية",           color: "#F97316", icon: MessageCircle, desc: "نظام مراسلة داخلي آمن بين أعضاء الفريق مع مرفقات وتنبيهات.", highlights: ["محادثات فريق","مرفقات","تنبيهات فورية","أرشيف منظّم"], stats: [{label:"رسالة هذا الشهر",value:"234"},{label:"عضو الفريق",value:"4"}] },
  "email-notif":       { title: "إشعارات البريد الإلكتروني", color: "#F97316", icon: Mail,          desc: "إرسال إشعارات بريد آلية للعملاء: جلسات، فواتير، عقود، مواعيد.", highlights: ["قوالب بريد عربية","جدولة الإرسال","متابعة الفتح","سجل الإرسال"] },
  "whatsapp":          { title: "واتساب للأعمال",             color: "#F97316", icon: MessageSquare, desc: "ربط رقم واتساب المكتب لإرسال تذكيرات وإشعارات آلية للموكلين.", highlights: ["واتساب Business API","قوالب رسائل","إرسال جماعي","رد آلي"] },
  "telegram":          { title: "تيليغرام",                  color: "#F97316", icon: Send,          desc: "إشعارات فورية عبر تيليغرام لأعضاء الفريق عند أي حدث مهم.", highlights: ["بوت تيليغرام مخصص","تنبيهات القضايا","إشعارات الدفع","تقارير يومية"] },
  "office-mgmt":       { title: "المكتب الإلكتروني",         color: "#F97316", icon: Globe,         desc: "صفحة عامة لمكتبك على الإنترنت: معلومات، خدمات، تقييمات، حجوزات.", highlights: ["صفحة مكتب احترافية","عرض الخدمات","تقييمات الموكلين","حجز استشارة"] },
  "marketplace":       { title: "سوق الخدمات القانونية",     color: "#F97316", icon: ShoppingBag,   desc: "نشر خدماتك القانونية على سوق عدالة وتلقّي عملاء جدد تلقائياً.", highlights: ["نشر الخدمات بالسعر","طلبات مباشرة","دفع آمن عبر المنصة","إنشاء قضية تلقائي"] },
  "support":           { title: "الدعم الفني",               color: "#F97316", icon: LifeBuoy,      desc: "فريق دعم متاح 24/7 بالعربية — محادثة فورية، تذاكر، قاعدة المعرفة.", highlights: ["دعم 24/7 عربي","محادثة فورية","تذاكر الدعم","قاعدة المعرفة"] },
  "hr-enterprise":     { title: "HR المؤسسي",               color: "#F43F5E", icon: Shield,        desc: "حلول الموارد البشرية على مستوى المؤسسة: سياسات، امتثال، تخطيط.", highlights: ["سياسات HR رسمية","امتثال نظام العمل","تخطيط الكوادر","تقارير الإنتاجية"] },
  "hr-center":         { title: "مركز HR",                   color: "#F43F5E", icon: Award,         desc: "تقييم أداء المحامين والموظفين مع خطط التطوير والحوافز.", highlights: ["تقييم الأداء الدوري","خطط التطوير","الحوافز والمكافآت","مؤشرات الإنتاجية"] },
  "hr-systems":        { title: "أنظمة HR",                  color: "#F43F5E", icon: Building2,     desc: "ربط منظومة الموارد البشرية بنظام حماية الأجور GOSI وسجلات HRDF.", highlights: ["حماية الأجور WPS","GOSI آلي","تسجيل HRDF","سجلات التأمين"] },
  "attendance":        { title: "الحضور والغياب",            color: "#F43F5E", icon: Clock,         desc: "تتبع حضور الموظفين يومياً مع تقارير الالتزام وربط بالرواتب.", highlights: ["تسجيل رقمي يومي","تقارير الالتزام","ربط بالرواتب","إشعارات التأخر"] },
  "leaves":            { title: "الإجازات",                  color: "#F43F5E", icon: CalendarDays,  desc: "إدارة طلبات الإجازات والموافقات مع رصيد الإجازات لكل موظف.", highlights: ["طلب إجازة إلكتروني","موافقة المدير","رصيد تلقائي","تقارير الغياب"] },
  "payroll":           { title: "مسير الرواتب",              color: "#F43F5E", icon: DollarSign,    desc: "احتساب الرواتب الشهرية آلياً مع البدلات والخصومات والضرائب.", highlights: ["احتساب آلي","بدلات وخصومات","ملف WPS","قسائم راتب PDF"] },
  "warnings":          { title: "التنبيهات التأديبية",        color: "#F43F5E", icon: AlertTriangle, desc: "توثيق الإنذارات والإجراءات التأديبية وفق نظام العمل السعودي.", highlights: ["إنذار رسمي رقمي","امتثال نظام العمل","سجل تأديبي","موافقة القانونية"] },
  "analytics":         { title: "تحليلات الأداء",            color: "#64748B", icon: BarChart3,     desc: "تحليلات عميقة لأداء المكتب: نسب الفوز، الإيرادات، رضا العملاء، إنتاجية الفريق.", highlights: ["17 مؤشر KPI","تحليل AI ذكي","مقارنة الأشهر","تصدير التقارير"], stats: [{label:"نسبة الفوز",value:"91%"},{label:"معدل رضا الموكلين",value:"4.9/5"},{label:"متوسط مدة القضية",value:"4.2 شهر"}] },
  "fin-intelligence":  { title: "الذكاء المالي",             color: "#64748B", icon: BrainCircuit,  desc: "تحليل ذكي للوضع المالي مع توقعات الإيرادات ومؤشرات المخاطر.", highlights: ["توقعات إيرادات AI","كشف الشذوذ المالي","مؤشرات المخاطر","تنبيهات ذكية"] },
  "risk-mgmt":         { title: "إدارة المخاطر",             color: "#64748B", icon: AlertTriangle, desc: "تحليل مخاطر القضايا والعملاء مع تنبيهات استباقية.", highlights: ["درجة مخاطر القضية","تنبيه مواعيد التقادم","مخاطر العميل","خطط التخفيف"] },
  "activity-stream":   { title: "سجل النشاط",               color: "#64748B", icon: Activity,      desc: "سجل شامل لجميع الأحداث والعمليات في المنصة بشكل لحظي.", highlights: ["أحداث لحظية","فلترة حسب النوع","بحث في السجل","تصدير سجلات"] },
  "audit-logs":        { title: "سجلات التدقيق",            color: "#64748B", icon: Activity,      desc: "سجل قانوني لمن قام بماذا ومتى — لأغراض التدقيق والامتثال.", highlights: ["سجل كامل لكل حدث","من/متى/ماذا","حماية من التعديل","تقارير التدقيق"] },
  "compliance":        { title: "الامتثال",                  color: "#64748B", icon: Shield,        desc: "أدوات الامتثال القانوني والتنظيمي: PDPL، نظام مكافحة الفساد، الأنظمة المهنية.", highlights: ["امتثال PDPL","أنظمة هيئة المحامين","فحص تضارب المصالح","تقارير الامتثال"] },
  "firm-admin":        { title: "إدارة المكتب",              color: "#64748B", icon: Crown,         desc: "لوحة تحكم المدير العام: نظرة شاملة على كل شيء في مكتبك.", highlights: ["نظرة مدير كاملة","إدارة الصلاحيات","سياسات المكتب","إعدادات متقدمة"] },
  "org-structure":     { title: "الهيكل التنظيمي",           color: "#64748B", icon: Network,       desc: "رسم الهيكل التنظيمي للمكتب مع الأقسام والوظائف والصلاحيات.", highlights: ["شجرة تنظيمية تفاعلية","الأقسام والوحدات","ربط الوظائف","تصدير PDF"] },
  "team":              { title: "الفريق والصلاحيات",          color: "#64748B", icon: Shield,        desc: "إدارة أعضاء الفريق وتحديد صلاحيات كل دور بدقة.", highlights: ["أدوار مخصصة","صلاحيات دقيقة","دعوة أعضاء","سجل الدخول"] },
  "office-settings":   { title: "إعدادات المكتب",            color: "#64748B", icon: Building2,     desc: "إعدادات المكتب الأساسية: الاسم، الشعار، اللغة، التوقيت، الضريبة.", highlights: ["بيانات المكتب","الشعار والهوية","ضريبة القيمة المضافة","إعدادات الفواتير"] },
  "theme-builder":     { title: "منشئ الثيم",                color: "#64748B", icon: Palette,       desc: "خصّص مظهر منصتك بالكامل: ألوان، خطوط، 12 ثيم جاهز بالعربي.", highlights: ["12 ثيم عربي جاهز","ألوان مخصصة","فاتح/داكن","معاينة فورية"] },
  "backup":            { title: "النسخ الاحتياطي",           color: "#64748B", icon: Database,      desc: "نسخ احتياطية آلية لبيانات مكتبك مع استعادة بنقرة واحدة.", highlights: ["نسخ يومية آلية","استعادة فورية","تشفير البيانات","تاريخ 90 يوم"] },
  "storage":           { title: "إدارة التخزين",             color: "#64748B", icon: HardDrive,     desc: "إدارة مساحة تخزين الملفات مع صلاحيات المجلدات والمشاركة الآمنة.", highlights: ["مجلدات مع صلاحيات","مشاركة آمنة","بحث فوري","50 GB مضمونة"] },
};

function FeaturePage({ page }: { page: Page }) {
  const meta = FEATURE_META[page];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${meta.color}15` }}>
          <Icon className="h-7 w-7" style={{ color: meta.color }} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">{meta.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{meta.desc}</p>
        </div>
      </div>

      {/* Stats if available */}
      {meta.stats && (
        <div className="grid grid-cols-3 gap-4">
          {meta.stats.map((s, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 text-right">
              <p className="text-2xl font-black" style={{ color: meta.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Feature highlights */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          ما ستجده في هذه الوحدة
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {meta.highlights.map((h, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}20` }}>
                <CheckCircle className="h-3.5 w-3.5" style={{ color: meta.color }} />
              </div>
              <span className="text-sm text-foreground font-medium">{h}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl p-6 border text-center" style={{ backgroundColor: `${meta.color}08`, borderColor: `${meta.color}25` }}>
        <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: `${meta.color}15` }}>
          <Zap className="h-5 w-5" style={{ color: meta.color }} />
        </div>
        <h3 className="font-bold text-foreground mb-1">هذه الوحدة متاحة الآن في نسختك التجريبية</h3>
        <p className="text-sm text-muted-foreground mb-4">بعد الاشتراك ستجد بياناتك الحقيقية هنا — كل شيء محفوظ وجاهز</p>
        <a href={`${BASE}/sign-up`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: meta.color }}>
          <ArrowLeft className="h-4 w-4" /> ابدأ الاشتراك مجاناً
        </a>
      </div>
    </motion.div>
  );
}

/* ══ MAIN LIVE DEMO PAGE ═════════════════════════════════════════════ */
export default function LiveDemoPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const officeKey: OfficeKey = (params.get("office") as OfficeKey) ?? "north";
  const userIdx = Number(params.get("user") ?? 0);
  const office = OFFICES[officeKey] ?? OFFICES.north;

  const [activePage, setActivePage] = useState<Page>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [activePage]);

  const FP = (p: Page) => <FeaturePage page={p} />;
  const CONTENT: Record<Page, ReactElement> = {
    /* ── Dedicated pages ── */
    dashboard:   <DashboardPage office={office} userIdx={userIdx} onNav={setActivePage} />,
    cases:       <CasesPage office={office} />,
    clients:     <ClientsPage office={office} />,
    contracts:   <ContractsPage />,
    documents:   <DocumentsPage />,
    invoices:    <InvoicesPage office={office} />,
    employees:   <EmployeesPage office={office} />,
    "ai-hub":    <AiPage office={office} />,
    calendar:    <CalendarPage office={office} />,
    /* ── Feature showcase pages ── */
    tasks:               FP("tasks"),
    reminders:           FP("reminders"),
    "client-portal":     FP("client-portal"),
    mediators:           FP("mediators"),
    "doc-templates":     FP("doc-templates"),
    letters:             FP("letters"),
    "ai-copilot":        FP("ai-copilot"),
    adoul:               FP("adoul"),
    "ui-builder":        FP("ui-builder"),
    "ai-agents":         FP("ai-agents"),
    "legal-ai":          FP("legal-ai"),
    "legal-research":    FP("legal-research"),
    "judge-prep":        FP("judge-prep"),
    "opponent-sim":      FP("opponent-sim"),
    arbitration:         FP("arbitration"),
    finance:             FP("finance"),
    collections:         FP("collections"),
    "payment-center":    FP("payment-center"),
    revenues:            FP("revenues"),
    expenses:            FP("expenses"),
    cashflow:            FP("cashflow"),
    "bank-accounts":     FP("bank-accounts"),
    advances:            FP("advances"),
    "financial-reports": FP("financial-reports"),
    "financial-statements": FP("financial-statements"),
    "financial-core":    FP("financial-core"),
    billing:             FP("billing"),
    messages:            FP("messages"),
    "email-notif":       FP("email-notif"),
    whatsapp:            FP("whatsapp"),
    telegram:            FP("telegram"),
    "office-mgmt":       FP("office-mgmt"),
    marketplace:         FP("marketplace"),
    support:             FP("support"),
    "hr-enterprise":     FP("hr-enterprise"),
    "hr-center":         FP("hr-center"),
    "hr-systems":        FP("hr-systems"),
    attendance:          FP("attendance"),
    leaves:              FP("leaves"),
    payroll:             FP("payroll"),
    warnings:            FP("warnings"),
    analytics:           FP("analytics"),
    "fin-intelligence":  FP("fin-intelligence"),
    "risk-mgmt":         FP("risk-mgmt"),
    "activity-stream":   FP("activity-stream"),
    "audit-logs":        FP("audit-logs"),
    compliance:          FP("compliance"),
    "firm-admin":        FP("firm-admin"),
    "org-structure":     FP("org-structure"),
    team:                FP("team"),
    "office-settings":   FP("office-settings"),
    "theme-builder":     FP("theme-builder"),
    backup:              FP("backup"),
    storage:             FP("storage"),
  };

  return (
    <div dir="rtl" className="flex h-screen overflow-hidden bg-background" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar office={office} userIdx={userIdx} activePage={activePage} onNav={setActivePage} />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[200] md:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[280px] shadow-2xl">
            <Sidebar office={office} userIdx={userIdx} activePage={activePage} onNav={setActivePage} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="hidden md:flex items-center max-w-xs flex-1">
              <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-muted/30 text-sm text-muted-foreground">
                <Search className="h-3.5 w-3.5 shrink-0" />
                <span>ابحث أو اكتب أمراً...</span>
                <kbd className="mr-auto text-[10px] border border-border/60 rounded px-1.5 py-0.5 bg-background/60">⌘K</kbd>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Demo badge */}
            <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              وضع تجريبي — {office.plan}
            </span>
            <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
            </button>
            <a href={`${BASE}/sign-up`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all">
              <ArrowLeft className="h-3.5 w-3.5" /> اشترك الآن
            </a>
            <a href={`${BASE}/`} title="الخروج"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 transition-all">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </a>
          </div>
        </header>

        {/* Trial banner */}
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 text-xs text-emerald-700 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-2"><span className="text-sm">🎁</span> فترة تجريبية مجانية — جميع الميزات مفعّلة — <strong>تبقى 14 يوماً</strong></span>
          <a href={`${BASE}/sign-up`} className="px-2.5 py-1 rounded-full font-bold border border-emerald-300 hover:bg-emerald-100 transition-colors">عرض الخطط</a>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div key={activePage} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                {CONTENT[activePage]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
