import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, Users, FileText, Receipt, TrendingUp, TrendingDown,
  Landmark, Wallet, MessageSquare, BarChart3, Bot, ArrowLeft,
  Briefcase, Star, CheckCircle, Clock, AlertCircle, DollarSign,
  Building2, Phone, Mail, Calendar, Shield, Zap, Sparkles,
  ChevronRight, Eye, Plus, Search, Filter, MoreVertical,
  UserCircle, FileCheck, CreditCard, Activity, Award,
  Banknote, BookOpen, PieChart, Send, Mic, CircleCheck, Globe,
  Brain, Layers, HardDrive, Palette, CheckSquare, Store,
  TrendingUp as TU, ArrowUpRight, LayoutGrid, ExternalLink,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── ICON MAP (for platform modules) ──────── */
const ICON_MAP: Record<string, any> = {
  Scale, Users, FileText, Receipt, TrendingUp, Landmark, Wallet,
  MessageSquare, BarChart3, Bot, Briefcase, Calendar, Shield, Sparkles,
  Search, Globe, Brain, Activity, Layers, HardDrive, Palette,
  CheckSquare, Store, DollarSign, CreditCard, UserCircle, Award,
  FileCheck, Building2,
};

/* ── DUMMY DATA ─────────────────────────────── */
const CASES = [
  { id: "QD-2025-001", title: "نزاع تجاري - شركة الأفق العقارية", client: "أحمد محمد السعيد", type: "تجاري", status: "جارية", priority: "عالية", date: "2025-01-15", amount: "450,000", judge: "المحكمة التجارية - الرياض" },
  { id: "QD-2025-002", title: "عقد عمل - شركة النخيل للتقنية", client: "سارة أحمد الزهراني", type: "عمالي", status: "مجدولة", priority: "متوسطة", date: "2025-02-20", amount: "85,000", judge: "المحكمة العمالية - جدة" },
  { id: "QD-2025-003", title: "قضية عقارية - ورثة الحربي", client: "خالد عبدالله الحربي", type: "عقاري", status: "فائزة", priority: "عالية", date: "2025-03-05", amount: "1,200,000", judge: "المحكمة العامة - الدمام" },
  { id: "QD-2026-001", title: "توثيق عقد شراكة - مجموعة الوطن", client: "فيصل ناصر القحطاني", type: "تجاري", status: "جارية", priority: "منخفضة", date: "2026-03-18", amount: "220,000", judge: "المحكمة التجارية - الرياض" },
  { id: "QD-2026-002", title: "دعوى استحقاق مالي - البنك الأهلي", client: "مريم سلطان الدوسري", type: "مدني", status: "مؤجلة", priority: "عالية", date: "2026-04-02", amount: "670,000", judge: "المحكمة المدنية - الرياض" },
];

const CLIENTS = [
  { name: "أحمد محمد السعيد", type: "شركة", phone: "+966 50 123 4567", email: "ahmed@alfuq.com", cases: 3, totalBilled: "850,000", status: "نشط", joined: "يناير 2024", rating: 5 },
  { name: "سارة أحمد الزهراني", type: "فرد", phone: "+966 55 987 6543", email: "sara.z@mail.com", cases: 1, totalBilled: "85,000", status: "نشط", joined: "مارس 2025", rating: 4 },
  { name: "خالد عبدالله الحربي", type: "ورثة", phone: "+966 50 456 7890", email: "khalid.h@mail.com", cases: 2, totalBilled: "1,350,000", status: "نشط", joined: "يوليو 2024", rating: 5 },
  { name: "فيصل ناصر القحطاني", type: "شركة", phone: "+966 56 321 0987", email: "faisal@watangroup.com", cases: 4, totalBilled: "620,000", status: "نشط", joined: "أبريل 2025", rating: 5 },
  { name: "مريم سلطان الدوسري", type: "فرد", phone: "+966 54 111 2233", email: "mariam.d@mail.com", cases: 1, totalBilled: "200,000", status: "معلق", joined: "فبراير 2026", rating: 3 },
];

const CONTRACTS = [
  { title: "عقد توكيل عام - شركة الأفق", client: "أحمد محمد السعيد", value: "50,000", type: "توكيل", start: "2025-01-01", end: "2026-01-01", status: "ساري" },
  { title: "اتفاقية أتعاب - مجموعة الوطن", client: "فيصل القحطاني", value: "120,000", type: "أتعاب", start: "2025-10-01", end: "2026-09-30", status: "ساري" },
  { title: "عقد استشارة قانونية سنوية", client: "شركة النخيل", value: "200,000", type: "استشارة", start: "2026-01-01", end: "2026-12-31", status: "ساري" },
  { title: "عقد تمثيل قانوني - ورثة الحربي", client: "خالد الحربي", value: "85,000", type: "تمثيل", start: "2025-07-15", end: "2026-07-14", status: "ساري" },
];

const EMPLOYEES = [
  { name: "المحامي / عبدالرحمن الشمري", role: "محامٍ أول", dept: "القسم التجاري", salary: "18,000", status: "نشط", perf: 92, joined: "2021-03-01" },
  { name: "المحامية / ريم الغامدي", role: "محامية", dept: "القسم العمالي", salary: "14,000", status: "نشط", perf: 88, joined: "2022-06-15" },
  { name: "السكرتيرة / لمياء الشهراني", role: "مساعدة إدارية", dept: "الإدارة", salary: "8,000", status: "نشط", perf: 95, joined: "2023-01-10" },
  { name: "المحامي / تركي الدوسري", role: "محامٍ", dept: "القسم المدني", salary: "12,000", status: "إجازة", perf: 74, joined: "2022-09-01" },
];

const REVENUES = [
  { desc: "أتعاب - قضية الأفق العقارية", client: "أحمد السعيد", amount: "45,000", date: "2026-04-01", category: "أتعاب", status: "مُحصّل" },
  { desc: "استشارة قانونية شهرية - شركة النخيل", client: "النخيل للتقنية", amount: "16,667", date: "2026-04-05", category: "استشارة", status: "مُحصّل" },
  { desc: "عقد تمثيل - مجموعة الوطن", client: "فيصل القحطاني", amount: "10,000", date: "2026-04-10", category: "أتعاب", status: "معلق" },
  { desc: "أتعاب قضية الحربي", client: "خالد الحربي", amount: "85,000", date: "2026-04-15", category: "أتعاب", status: "مُحصّل" },
];

const EXPENSES = [
  { desc: "إيجار مقر المكتب - الشهر الرابع", amount: "12,000", date: "2026-04-01", category: "إيجار", vendor: "شركة الإدارة العقارية", status: "مُسدَّد" },
  { desc: "رواتب الموظفين - أبريل 2026", amount: "52,000", date: "2026-04-30", category: "رواتب", vendor: "موظفو المكتب", status: "مُسدَّد" },
  { desc: "اشتراك منصة عدالة AI", amount: "2,500", date: "2026-04-01", category: "تقنية", vendor: "عدالة AI", status: "مُسدَّد" },
  { desc: "مستلزمات مكتبية وقرطاسية", amount: "1,200", date: "2026-04-08", category: "مستلزمات", vendor: "مكتبة الدار", status: "مُسدَّد" },
];

const INVOICES = [
  { id: "INV-2026-041", client: "أحمد محمد السعيد", amount: "45,000", issued: "2026-04-01", due: "2026-04-30", status: "مدفوع", items: 2 },
  { id: "INV-2026-042", client: "شركة النخيل للتقنية", amount: "16,667", issued: "2026-04-05", due: "2026-05-05", status: "معلق", items: 1 },
  { id: "INV-2026-043", client: "فيصل ناصر القحطاني", amount: "10,000", issued: "2026-04-10", due: "2026-04-25", status: "متأخر", items: 3 },
  { id: "INV-2026-044", client: "خالد عبدالله الحربي", amount: "85,000", issued: "2026-04-15", due: "2026-05-15", status: "مدفوع", items: 1 },
];

const MESSAGES = [
  { from: "أحمد محمد السعيد", avatar: "أ", time: "منذ ٥ دقائق", text: "السلام عليكم، هل هناك أي تطورات في قضية الأفق؟ ننتظر ردكم بفارغ الصبر.", unread: true },
  { from: "فيصل ناصر القحطاني", avatar: "ف", time: "منذ ٢ ساعة", text: "تم توقيع العقد من قِبلنا، نرجو التأكيد على موعد الجلسة القادمة.", unread: true },
  { from: "المحامي عبدالرحمن الشمري", avatar: "ع", time: "أمس", text: "المستندات المطلوبة جاهزة، سأرفعها على المنصة خلال ساعة.", unread: false },
  { from: "مريم سلطان الدوسري", avatar: "م", time: "أمس", text: "شكراً جزيلاً على متابعة القضية، نرجو إبلاغنا بأي تطورات.", unread: false },
];

const AI_PROMPTS = [
  { q: "لخّص لي قضية الأفق العقارية", a: "قضية الأفق العقارية (QD-2025-001) هي نزاع تجاري بقيمة 450,000 ريال، تمثّل فيها موكلنا أحمد السعيد ضد الشركة المدعى عليها. الجلسة القادمة بتاريخ 15 يونيو 2026 أمام المحكمة التجارية بالرياض. نقاط القوة: وجود عقد مكتوب + شهود. المخاطر: تأخر في تقديم المستندات المالية." },
  { q: "ما الفواتير المتأخرة هذا الشهر؟", a: "لديك فاتورة واحدة متأخرة: INV-2026-043 للعميل فيصل ناصر القحطاني بقيمة 10,000 ريال، مستحقة منذ 25 أبريل 2026 (تأخر 5 أيام). أنصح بإرسال تذكير فوري عبر البريد الإلكتروني أو رسالة نصية." },
  { q: "هل هناك نزاعات مشابهة في قانون الشركات السعودي؟", a: "نعم، وفق نظام الشركات السعودي الجديد 2022، هناك عدة أحكام محكمة في منازعات الشراكة (المادتان 108 و114) تدعم موقف موكلك. سأقترح إضافتها كمرجع قانوني في المذكرة القادمة." },
];

const DOCUMENTS = [
  { name: "عقد توكيل - أحمد السعيد.pdf", case: "QD-2025-001", size: "1.2 MB", date: "2026-04-01", status: "مُفهرس", ocr: true },
  { name: "حكم محكمة تجارية 2026.pdf", case: "QD-2025-001", size: "3.8 MB", date: "2026-04-05", status: "مُفهرس", ocr: true },
  { name: "عقد استشارة - شركة النخيل.docx", case: "QD-2025-002", size: "0.4 MB", date: "2026-04-10", status: "مُعالج", ocr: false },
  { name: "صورة بطاقة - خالد الحربي.jpg", case: "QD-2025-003", size: "0.8 MB", date: "2026-04-12", status: "مُفهرس", ocr: true },
];

const SESSIONS = [
  { title: "جلسة قضية الأفق العقارية", case: "QD-2025-001", court: "المحكمة التجارية - الرياض", date: "2026-06-15", time: "10:00 ص", type: "مرافعة", status: "قادمة" },
  { title: "جلسة عقد عمل النخيل", case: "QD-2025-002", court: "المحكمة العمالية - جدة", date: "2026-06-18", time: "09:30 ص", type: "صلح", status: "قادمة" },
  { title: "استشارة - فيصل القحطاني", case: "QD-2026-001", court: "مكتب المحامي", date: "2026-06-20", time: "02:00 م", type: "استشارة", status: "مؤكدة" },
  { title: "تقديم مستندات - ورثة الحربي", case: "QD-2025-003", court: "المحكمة العامة - الدمام", date: "2026-06-22", time: "11:00 ص", type: "إجراء", status: "قادمة" },
];

const LEGAL_RESULTS = [
  { title: "نظام الشركات السعودي 2022 - المادة 108", source: "وزارة التجارة", relevance: 97, type: "نظام", date: "2022-11-16" },
  { title: "حكم محكمة الاستئناف التجارية رقم 4521/2025", source: "ديوان المظالم", relevance: 91, type: "سابقة قضائية", date: "2025-08-22" },
  { title: "نظام العمل السعودي - الباب الخامس", source: "وزارة الموارد البشرية", relevance: 85, type: "نظام", date: "2021-03-01" },
  { title: "لائحة التحكيم التجاري - المادة 35", source: "هيئة التحكيم التجاري", relevance: 78, type: "لائحة", date: "2023-01-15" },
];

const OPPONENT_ROUNDS = [
  { counter: "العقد وُقِّع تحت إكراه مالي، والمادة 178 من نظام الأحوال الشخصية تُجيز إبطاله. علاوةً على ذلك، لم يلتزم الطرف الآخر بالتسليم في الموعد المحدد مما يُسقط الالتزام المقابل." },
  { counter: "وثيقة الاستلام المقدمة غير موثقة من طرف ثالث محايد. المحكمة التجارية الرياض سبق أن رفضت مستندات مشابهة في قضية رقم 3841/2024. يجب توثيقها من الغرفة التجارية." },
];

const LEGAL_AI_TYPES = [
  { id: "memo", label: "مذكرة دفاعية", icon: FileText, color: "#818CF8", desc: "مذكرة قانونية احترافية بناءً على وقائع القضية" },
  { id: "contract", label: "عقد تجاري", icon: FileCheck, color: "#34D399", desc: "عقد توريد أو شراكة أو استشارة مخصص" },
  { id: "poa", label: "توكيل رسمي", icon: Scale, color: "#C9A84C", desc: "توكيل عام أو خاص بصياغة قانونية دقيقة" },
  { id: "complaint", label: "لائحة دعوى", icon: AlertCircle, color: "#F87171", desc: "صياغة لائحة دعوى مدنية أو تجارية" },
  { id: "notice", label: "إنذار رسمي", icon: Send, color: "#FB923C", desc: "إنذار قانوني رسمي مع الأثر القانوني" },
  { id: "opinion", label: "مذكرة رأي", icon: BookOpen, color: "#60A5FA", desc: "رأي قانوني مدعوم بالأنظمة واللوائح" },
];

const AUDIT_EVENTS = [
  { user: "المحامي عبدالرحمن", action: "إنشاء", resource: "قضية", detail: "QD-2026-002 — دعوى استحقاق مالي", time: "منذ ٥ دقائق", type: "create" },
  { user: "ريم الغامدي", action: "تعديل", resource: "عقد", detail: "تحديث تاريخ انتهاء عقد مجموعة الوطن", time: "منذ ٢٢ دقيقة", type: "update" },
  { user: "لمياء الشهراني", action: "حذف", resource: "مستند", detail: "مستند مكرر — صورة بطاقة قديمة", time: "منذ ساعة", type: "delete" },
  { user: "المحامي عبدالرحمن", action: "دخول", resource: "النظام", detail: "تسجيل دخول ناجح من الرياض", time: "منذ ٣ ساعات", type: "login" },
  { user: "ريم الغامدي", action: "توليد", resource: "وثيقة AI", detail: "توليد مذكرة دفاعية لقضية QD-2025-001", time: "أمس", type: "ai" },
];

const COLLECTIONS = [
  { client: "فيصل ناصر القحطاني", invoice: "INV-2026-043", amount: "10,000", due: "2026-04-25", delay: "47 يوماً", risk: "عالي" },
  { client: "شركة النخيل للتقنية", invoice: "INV-2026-042", amount: "16,667", due: "2026-05-05", delay: "37 يوماً", risk: "متوسط" },
];

/* ── HELPERS ─────────────────────────────────── */
const statusColors: Record<string, string> = {
  جارية:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  مجدولة:   "bg-purple-500/20 text-purple-300 border-purple-500/30",
  فائزة:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  مؤجلة:    "bg-amber-500/20 text-amber-300 border-amber-500/30",
  ساري:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  منتهي:    "bg-gray-500/20 text-gray-300 border-gray-500/30",
  نشط:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  إجازة:    "bg-amber-500/20 text-amber-300 border-amber-500/30",
  معلق:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "مُحصّل": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "مُسدَّد":"bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  مدفوع:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  متأخر:    "bg-red-500/20 text-red-300 border-red-500/30",
  قادمة:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "مؤكدة":  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "مُعالج": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "مُفهرس": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  قائم:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "مُسوَّى":"bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  جديد:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

const priorityColors: Record<string, string> = {
  عالية:    "text-red-400",
  متوسطة:   "text-amber-400",
  منخفضة:   "text-emerald-400",
};

const auditColors: Record<string, { bg: string; text: string; label: string }> = {
  create: { bg: "bg-emerald-500/15 border-emerald-500/20", text: "text-emerald-400", label: "إنشاء" },
  update: { bg: "bg-amber-500/15 border-amber-500/20", text: "text-amber-400", label: "تعديل" },
  delete: { bg: "bg-red-500/15 border-red-500/20", text: "text-red-400", label: "حذف" },
  login:  { bg: "bg-blue-500/15 border-blue-500/20", text: "text-blue-400", label: "دخول" },
  ai:     { bg: "bg-purple-500/15 border-purple-500/20", text: "text-purple-400", label: "AI" },
};

function StatusBadge({ label }: { label: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[label] ?? "bg-white/10 text-white/50 border-white/10"}`}>
      {label}
    </span>
  );
}

function SectionHeader({ title, count, icon: Icon }: { title: string; count?: number; icon: any }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-amber-400" />
        </div>
        <h3 className="text-base font-bold text-white">{title}</h3>
        {count !== undefined && <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{count}</span>}
      </div>
      <button className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors">
        <Plus className="w-3 h-3" /> إضافة جديد
      </button>
    </div>
  );
}

function SearchBar({ placeholder }: { placeholder: string }) {
  return (
    <div className="flex gap-2 mb-4">
      <div className="relative flex-1">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input placeholder={placeholder} className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pr-9 pl-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40" />
      </div>
      <button className="flex items-center gap-1.5 text-xs text-white/50 bg-white/5 border border-white/10 px-3 rounded-lg hover:bg-white/10 transition-colors">
        <Filter className="w-3.5 h-3.5" /> فلتر
      </button>
    </div>
  );
}

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">
      DEMO
    </span>
  );
}

/* ── PLATFORM OVERVIEW ──────────────────────── */
interface PlatformModule {
  id: string; group: string; title: string; description: string;
  route: string; icon: string; color: string; enabled: boolean; badge: string | null;
}
interface ModulesData {
  modules: PlatformModule[];
  groups: Record<string, { label: string; color: string }>;
  stats: { totalModules: number; aiPowered: number; groups: number };
}

function PlatformOverviewSection() {
  const [data, setData] = useState<ModulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string>("all");

  useEffect(() => {
    fetch(`${BASE}/api/platform/modules`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const groups = data ? Object.entries(data.groups) : [];
  const filtered = data
    ? (activeGroup === "all" ? data.modules : data.modules.filter(m => m.group === activeGroup))
    : [];

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      {data && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "إجمالي الوحدات", value: data.stats.totalModules, icon: LayoutGrid, color: "text-amber-400" },
            { label: "مدعوم بالذكاء AI", value: data.stats.aiPowered, icon: Brain, color: "text-purple-400" },
            { label: "أقسام المنصة", value: data.stats.groups, icon: Layers, color: "text-blue-400" },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
              <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
              <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Group filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveGroup("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all border ${
            activeGroup === "all"
              ? "bg-amber-500 text-black border-amber-500"
              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/8"
          }`}
        >
          الكل
        </button>
        {groups.map(([id, g]) => (
          <button key={id} onClick={() => setActiveGroup(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all border ${
              activeGroup === id
                ? "text-black border-transparent"
                : "bg-white/5 border-white/10 text-white/60 hover:bg-white/8"
            }`}
            style={activeGroup === id ? { background: g.color, borderColor: g.color } : {}}>
            {g.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-white/5 border border-white/8 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(m => {
            const Icon = ICON_MAP[m.icon] || LayoutGrid;
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="group relative bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 rounded-xl p-4 cursor-pointer transition-all"
                style={{ "--hover-border": m.color + "40" } as any}
                onMouseEnter={e => (e.currentTarget.style.borderColor = m.color + "35")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: m.color + "18", border: `1px solid ${m.color}30` }}>
                    <Icon className="w-4.5 h-4.5" style={{ color: m.color }} />
                  </div>
                  {m.badge && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: m.color + "20", color: m.color, border: `1px solid ${m.color}30` }}>
                      {m.badge}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-white mb-1">{m.title}</h4>
                <p className="text-xs text-white/45 leading-relaxed">{m.description}</p>
                <div className="mt-3 flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: m.color }}>
                  <span>عرض في النظام الحقيقي</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-12 text-white/30 text-sm">
          تعذّر تحميل وحدات المنصة — يرجى المحاولة لاحقاً
        </div>
      )}

      <div className="mt-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-xs text-amber-400/80 text-center">
        ⟳ هذه القائمة تُحدَّث تلقائياً مع كل إصدار جديد من المنصة
      </div>
    </div>
  );
}

/* ── SECTION COMPONENTS ──────────────────────── */
function CasesSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية — لا تؤثر على النظام الحقيقي</span></div>
      <SectionHeader title="القضايا النشطة" count={CASES.length} icon={Scale} />
      <SearchBar placeholder="ابحث في القضايا..." />
      <div className="space-y-2">
        {CASES.map(c => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 hover:bg-white/8 border border-white/8 hover:border-amber-500/20 rounded-xl p-4 cursor-pointer transition-all group">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-amber-400/70 font-mono">{c.id}</span>
                  <span className={`text-xs font-medium ${priorityColors[c.priority]}`}>● {c.priority}</span>
                </div>
                <p className="text-sm font-semibold text-white mb-1 truncate">{c.title}</p>
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span><UserCircle className="inline w-3 h-3 ml-1" />{c.client}</span>
                  <span><Briefcase className="inline w-3 h-3 ml-1" />{c.type}</span>
                  <span><Calendar className="inline w-3 h-3 ml-1" />{c.date}</span>
                </div>
                <p className="text-xs text-white/30 mt-1">{c.judge}</p>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <StatusBadge label={c.status} />
                <span className="text-sm font-bold text-amber-400">{c.amount} ﷼</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ClientsSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <SectionHeader title="العملاء (CRM)" count={CLIENTS.length} icon={Users} />
      <SearchBar placeholder="ابحث في العملاء..." />
      <div className="space-y-3">
        {CLIENTS.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 hover:bg-white/8 border border-white/8 hover:border-amber-500/20 rounded-xl p-4 cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600/40 to-amber-400/20 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                {c.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{c.name}</p>
                  <span className="text-xs text-white/30 bg-white/5 px-1.5 rounded">{c.type}</span>
                  <StatusBadge label={c.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                  <span><Phone className="inline w-3 h-3 ml-0.5" />{c.phone}</span>
                  <span><Mail className="inline w-3 h-3 ml-0.5" />{c.email}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/40 mt-0.5">
                  <span>{c.cases} قضية</span>
                  <span>إجمالي الفوترة: <span className="text-amber-400">{c.totalBilled} ﷼</span></span>
                  <div className="flex gap-0.5">{Array.from({length: 5}).map((_, j) => <Star key={j} className={`w-3 h-3 ${j < c.rating ? "text-amber-400 fill-amber-400" : "text-white/20"}`} />)}</div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ContractsSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <SectionHeader title="العقود والاتفاقيات" count={CONTRACTS.length} icon={FileCheck} />
      <SearchBar placeholder="ابحث في العقود..." />
      <div className="space-y-2">
        {CONTRACTS.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl p-4 cursor-pointer transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white mb-1">{c.title}</p>
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span><UserCircle className="inline w-3 h-3 ml-1" />{c.client}</span>
                  <span>{c.start} ← {c.end}</span>
                  <span className="text-white/30 bg-white/5 px-1.5 rounded">{c.type}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <StatusBadge label={c.status} />
                <span className="text-sm font-bold text-amber-400">{c.value} ﷼</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EmployeesSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <SectionHeader title="الموظفون" count={EMPLOYEES.length} icon={UserCircle} />
      <SearchBar placeholder="ابحث في الموظفين..." />
      <div className="space-y-3">
        {EMPLOYEES.map((e, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl p-4 transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600/40 to-blue-400/20 flex items-center justify-center text-blue-300 font-bold text-sm shrink-0">
                {e.name.split("/ ")[1]?.[0] ?? "م"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{e.name}</p>
                  <StatusBadge label={e.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                  <span>{e.role}</span>
                  <span>{e.dept}</span>
                  <span className="text-amber-400 font-medium">{e.salary} ﷼/شهر</span>
                </div>
              </div>
              <div className="shrink-0 text-center">
                <div className={`text-base font-black ${e.perf >= 90 ? "text-emerald-400" : e.perf >= 75 ? "text-amber-400" : "text-red-400"}`}>{e.perf}%</div>
                <div className="text-xs text-white/30">أداء</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RevenuesSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "إجمالي الإيرادات", value: "156,667 ﷼", color: "text-emerald-400", icon: TrendingUp },
          { label: "مُحصَّل", value: "146,667 ﷼", color: "text-blue-400", icon: CheckCircle },
          { label: "معلق", value: "10,000 ﷼", color: "text-amber-400", icon: Clock },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <SectionHeader title="الإيرادات" count={REVENUES.length} icon={TrendingUp} />
      <div className="space-y-2">
        {REVENUES.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl transition-all">
            <div className="min-w-0">
              <p className="text-sm text-white font-medium">{r.desc}</p>
              <div className="flex gap-3 text-xs text-white/40 mt-0.5">
                <span>{r.client}</span><span>{r.date}</span>
                <span className="bg-white/5 px-1.5 rounded">{r.category}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-sm font-bold text-emerald-400">+{r.amount} ﷼</span>
              <StatusBadge label={r.status} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ExpensesSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "إجمالي المصاريف", value: "67,700 ﷼", color: "text-red-400", icon: TrendingDown },
          { label: "مُسدَّد", value: "67,700 ﷼", color: "text-white/60", icon: CheckCircle },
          { label: "صافي الربح", value: "88,967 ﷼", color: "text-emerald-400", icon: Activity },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <SectionHeader title="المصاريف" count={EXPENSES.length} icon={TrendingDown} />
      <div className="space-y-2">
        {EXPENSES.map((e, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl transition-all">
            <div className="min-w-0">
              <p className="text-sm text-white font-medium">{e.desc}</p>
              <div className="flex gap-3 text-xs text-white/40 mt-0.5">
                <span>{e.vendor}</span><span>{e.date}</span>
                <span className="bg-white/5 px-1.5 rounded">{e.category}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-sm font-bold text-red-400">-{e.amount} ﷼</span>
              <StatusBadge label={e.status} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function InvoicesSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <SectionHeader title="الفواتير" count={INVOICES.length} icon={Receipt} />
      <SearchBar placeholder="ابحث في الفواتير..." />
      <div className="space-y-2">
        {INVOICES.map((inv, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-amber-400/70">{inv.id}</span>
                  <StatusBadge label={inv.status} />
                </div>
                <p className="text-sm font-semibold text-white">{inv.client}</p>
                <div className="flex gap-3 text-xs text-white/40 mt-1">
                  <span>إصدار: {inv.issued}</span>
                  <span>استحقاق: {inv.due}</span>
                  <span>{inv.items} بنود</span>
                </div>
              </div>
              <span className="text-lg font-bold text-amber-400">{inv.amount} ﷼</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MessagesSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <SectionHeader title="المراسلات الداخلية" count={MESSAGES.length} icon={MessageSquare} />
      <div className="space-y-2 mb-4">
        {MESSAGES.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={`p-3 border rounded-xl cursor-pointer transition-all ${m.unread ? "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/8" : "bg-white/5 border-white/8 hover:bg-white/8"}`}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-600/40 to-amber-400/20 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                {m.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-sm font-semibold ${m.unread ? "text-white" : "text-white/70"}`}>{m.from}</span>
                  <span className="text-xs text-white/30">{m.time}</span>
                </div>
                <p className="text-xs text-white/50 line-clamp-2">{m.text}</p>
              </div>
              {m.unread && <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1.5" />}
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex gap-2">
        <input placeholder="اكتب رسالة..." className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2.5 px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40" />
        <button className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ReportsSection() {
  const bars = [
    { month: "يناير", rev: 95, exp: 55 },
    { month: "فبراير", rev: 118, exp: 61 },
    { month: "مارس", rev: 142, exp: 59 },
    { month: "أبريل 2026", rev: 157, exp: 68 },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <SectionHeader title="التقارير المالية" icon={BarChart3} />
      <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-4">
        <p className="text-xs text-white/40 mb-3">الإيرادات مقابل المصاريف (آلاف ريال) — 2026</p>
        <div className="flex items-end gap-4 h-32">
          {bars.map(b => (
            <div key={b.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5 h-24">
                <div className="flex-1 bg-emerald-500/60 rounded-t-sm transition-all hover:bg-emerald-500/80" style={{ height: `${b.rev * 0.6}%` }} />
                <div className="flex-1 bg-red-500/40 rounded-t-sm transition-all hover:bg-red-500/60" style={{ height: `${b.exp * 0.6}%` }} />
              </div>
              <span className="text-xs text-white/40">{b.month}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1 text-xs text-white/40"><span className="w-3 h-2 rounded-sm bg-emerald-500/60 inline-block" /> إيرادات</span>
          <span className="flex items-center gap-1 text-xs text-white/40"><span className="w-3 h-2 rounded-sm bg-red-500/40 inline-block" /> مصاريف</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "إجمالي الإيرادات", val: "156,667 ﷼", trend: "+22%", up: true },
          { label: "إجمالي المصاريف", val: "67,700 ﷼", trend: "+4%", up: false },
          { label: "صافي الربح", val: "88,967 ﷼", trend: "+38%", up: true },
          { label: "نسبة الربحية", val: "56.8%", trend: "+10%", up: true },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-xs text-white/40 mb-1">{s.label}</p>
            <p className="text-base font-bold text-white">{s.val}</p>
            <p className={`text-xs font-medium mt-0.5 ${s.up ? "text-emerald-400" : "text-red-400"}`}>
              {s.up ? "↑" : "↑"} {s.trend} من الربع الماضي
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DocumentsSection() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <SectionHeader title="إدارة المستندات" count={DOCUMENTS.length} icon={FileText} />
      <SearchBar placeholder="ابحث في المستندات أو استخدم OCR عربي..." />
      <div className="space-y-2">
        {DOCUMENTS.map((d, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl transition-all cursor-pointer">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{d.name}</p>
                <div className="flex gap-2 text-xs text-white/40 mt-0.5">
                  <span>{d.case}</span><span>{d.size}</span><span>{d.date}</span>
                  {d.ocr && <span className="text-emerald-400">✓ OCR</span>}
                </div>
              </div>
            </div>
            <StatusBadge label={d.status} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CalendarSection() {
  const highlighted = [15, 18, 20, 22];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <SectionHeader title="المواعيد والجلسات" count={SESSIONS.length} icon={Calendar} />
      <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-4">
        <p className="text-xs text-white/40 mb-3">يونيو 2026</p>
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {["أح","إث","ثل","أر","خم","جم","سب"].map(d => (
            <div key={d} className="text-xs text-white/30 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {[...Array(30)].map((_, i) => {
            const day = i + 1;
            const has = highlighted.includes(day);
            return (
              <div key={i} className={`text-xs py-1.5 rounded-lg cursor-pointer transition-colors ${
                has ? "bg-amber-500 text-black font-bold" :
                day === 12 ? "bg-white/15 text-white font-bold" :
                "text-white/40 hover:bg-white/8"
              }`}>{day}</div>
            );
          })}
        </div>
      </div>
      <div className="space-y-2">
        {SESSIONS.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl transition-all">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-white/5 px-2 py-0.5 rounded text-white/50">{s.type}</span>
                  <StatusBadge label={s.status} />
                </div>
                <p className="text-sm font-semibold text-white mb-0.5">{s.title}</p>
                <p className="text-xs text-white/40">{s.court}</p>
              </div>
              <div className="text-left shrink-0">
                <p className="text-sm font-bold text-amber-400">{s.time}</p>
                <p className="text-xs text-white/40">{s.date}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function BankSection() {
  const accounts = [
    { bank: "البنك الأهلي السعودي", iban: "SA44 2000 0001 2345 6789 0123", balance: "412,000", type: "جاري" },
    { bank: "بنك الراجحي", iban: "SA36 8000 0001 9876 5432 1098", balance: "138,500", type: "توفير" },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <SectionHeader title="الحسابات البنكية والسلف" icon={Landmark} />
      <div className="space-y-3 mb-6">
        {accounts.map((a, i) => (
          <div key={i} className="bg-gradient-to-l from-white/5 to-white/3 border border-white/8 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-white mb-1">{a.bank}</p>
                <p className="text-xs text-white/30 font-mono">{a.iban}</p>
                <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded mt-1 inline-block">{a.type}</span>
              </div>
              <div className="text-left">
                <p className="text-xs text-white/40">الرصيد الحالي</p>
                <p className="text-xl font-black text-emerald-400">{a.balance}</p>
                <p className="text-xs text-white/30">ريال سعودي</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <SectionHeader title="العهد والسلف" count={2} icon={Wallet} />
      <div className="space-y-2">
        {[
          { name: "عبدالرحمن الشمري", amount: "2,000", purpose: "رسوم محاكم - قضية الأفق", date: "2026-04-10", status: "قائم" },
          { name: "ريم الغامدي", amount: "800", purpose: "نثريات ومستلزمات مكتبية", date: "2026-04-15", status: "مُسوَّى" },
        ].map((ad, i) => (
          <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/8 rounded-xl">
            <div>
              <p className="text-sm text-white font-medium">{ad.name}</p>
              <p className="text-xs text-white/40">{ad.purpose} • {ad.date}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-sm font-bold text-amber-400">{ad.amount} ﷼</span>
              <StatusBadge label={ad.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiHubSection() {
  const [selected, setSelected] = useState(0);
  const [typing, setTyping] = useState(false);
  const [shown, setShown] = useState(false);
  const [mode, setMode] = useState<"chat"|"case"|"contract">("chat");

  const modes = [
    { id: "chat", label: "مساعد المكتب", icon: Bot, desc: "أسئلة عامة وإجراءات المكتب" },
    { id: "case", label: "تحليل قضية", icon: Scale, desc: "تلخيص وتحليل ملف القضية" },
    { id: "contract", label: "مراجعة عقد", icon: FileCheck, desc: "فحص العقود وتحديد المخاطر" },
  ] as const;

  function ask(i: number) {
    setSelected(i); setTyping(true); setShown(false);
    setTimeout(() => { setTyping(false); setShown(true); }, 1400);
  }

  return (
    <div>
      <SectionHeader title="مساعد عدالة AI" icon={Bot} />
      <div className="flex gap-2 mb-4">
        {modes.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border text-xs transition-all ${
              mode === m.id
                ? "bg-purple-500/20 border-purple-500/30 text-purple-300"
                : "bg-white/5 border-white/8 text-white/50 hover:bg-white/8"
            }`}>
            <m.icon className="w-4 h-4" />
            <span className="font-medium">{m.label}</span>
            <span className="text-white/30 text-center leading-tight">{m.desc}</span>
          </button>
        ))}
      </div>
      <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-4">
        <p className="text-xs text-white/40 mb-3">جرّب الأسئلة التالية:</p>
        <div className="flex flex-col gap-2">
          {AI_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => ask(i)}
              className={`text-right text-sm px-4 py-2.5 rounded-xl border transition-all ${selected === i ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-white/5 border-white/8 text-white/60 hover:bg-white/8 hover:text-white"}`}>
              <Sparkles className="inline w-3.5 h-3.5 ml-2 text-amber-400" />
              {p.q}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-gradient-to-br from-[#0D2137] to-[#0B1B2B] border border-amber-500/20 rounded-xl p-4 min-h-[140px]">
        {!shown && !typing && (
          <div className="flex items-center gap-2 text-white/30 text-sm">
            <Bot className="w-5 h-5" /> اختر سؤالاً من الأعلى لترى الذكاء الاصطناعي في العمل...
          </div>
        )}
        {typing && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex gap-1">
              {[0,1,2].map(d => (
                <motion.div key={d} className="w-2 h-2 rounded-full bg-amber-400/60"
                  animate={{ y: [0,-6,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.15 }} />
              ))}
            </div>
          </div>
        )}
        {shown && !typing && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-amber-400">مساعد عدالة AI</span>
            </div>
            <p className="text-sm text-white/80 leading-7 pr-9">{AI_PROMPTS[selected].a}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function LegalAISection() {
  const [selected, setSelected] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  function generate() {
    if (!selected) return;
    setGenerating(true); setGenerated(false);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2000);
  }

  return (
    <div>
      <SectionHeader title="محرك توليد الوثائق القانونية" icon={Sparkles} />
      <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-xs text-purple-300">
        <Brain className="inline w-3.5 h-3.5 ml-1" />
        11 نوع وثيقة قانونية مدعومة • صياغة بالذكاء الاصطناعي • متوافقة مع الأنظمة السعودية
      </div>
      <p className="text-xs text-white/40 mb-3">اختر نوع الوثيقة:</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {LEGAL_AI_TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setSelected(t.id); setGenerated(false); }}
              className={`p-3 rounded-xl border text-right transition-all ${
                selected === t.id
                  ? "border-transparent"
                  : "bg-white/5 border-white/8 hover:bg-white/8"
              }`}
              style={selected === t.id ? { background: t.color + "18", borderColor: t.color + "40" } : {}}>
              <Icon className="w-4 h-4 mb-2" style={{ color: selected === t.id ? t.color : undefined }} />
              <p className="text-xs font-bold text-white">{t.label}</p>
              <p className="text-xs text-white/40 mt-0.5 leading-tight">{t.desc}</p>
            </button>
          );
        })}
      </div>
      <button onClick={generate} disabled={!selected || generating}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
          selected && !generating
            ? "hover:opacity-90 hover:scale-[1.01]"
            : "opacity-40 cursor-not-allowed"
        }`}
        style={{ background: selected ? "linear-gradient(135deg,#C9A84C,#E0C060)" : "#444", color: "#0D1626" }}>
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <motion.div className="w-4 h-4 rounded-full border-2 border-[#0D1626] border-t-transparent"
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
            يتم التوليد...
          </span>
        ) : selected ? (
          <span><Sparkles className="inline w-4 h-4 ml-1" /> توليد الوثيقة بالذكاء الاصطناعي</span>
        ) : "اختر نوع الوثيقة أولاً"}
      </button>
      {generated && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">تمت الصياغة بنجاح</span>
            <DemoBadge />
          </div>
          <p className="text-xs text-white/60 leading-6">
            بسم الله الرحمن الرحيم — المملكة العربية السعودية<br/>
            {LEGAL_AI_TYPES.find(t => t.id === selected)?.label}<br/>
            الأطراف: [يُعبأ تلقائياً من ملف العميل]<br/>
            بناءً على الوقائع والمستندات المتوفرة في النظام، يتشرف المحامي بتقديم هذه الوثيقة...
            <span className="text-white/30"> [تُستكمل الصياغة تلقائياً من بيانات المكتب]</span>
          </p>
          <div className="flex gap-2 mt-3">
            <button className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/15 transition-colors">
              تحميل PDF
            </button>
            <button className="text-xs text-white/50 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/8 transition-colors">
              تعديل النص
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function FinanceCenterSection() {
  return (
    <div>
      <SectionHeader title="مركز التحصيل المالي" icon={DollarSign} />
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "إجمالي المتأخرات", value: "26,667 ﷼", color: "text-red-400", icon: AlertCircle },
          { label: "عدد الملفات", value: "2", color: "text-amber-400", icon: Receipt },
          { label: "أعمر متأخرة", value: "47 يوماً", color: "text-red-300", icon: Clock },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <h4 className="text-sm font-bold text-white mb-3">الفواتير المستحقة التحصيل</h4>
      <div className="space-y-3">
        {COLLECTIONS.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white mb-1">{c.client}</p>
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span className="font-mono text-amber-400/70">{c.invoice}</span>
                  <span>استحقاق: {c.due}</span>
                  <span className="text-red-400">تأخر: {c.delay}</span>
                </div>
              </div>
              <div className="shrink-0 text-left">
                <div className="text-base font-black text-amber-400">{c.amount} ﷼</div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.risk === "عالي" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"}`}>
                  خطر {c.risk}
                </span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-500/15 transition-colors flex items-center gap-1">
                <Send className="w-3 h-3" /> إرسال تذكير
              </button>
              <button className="text-xs text-white/50 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/8 transition-colors">
                خطة التحصيل
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsSection() {
  const [aiLoaded, setAiLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAiLoaded(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const kpis = [
    { label: "قضايا نشطة", value: "5", change: "+2 هذا الشهر", up: true, color: "#C9A84C" },
    { label: "موكلون جدد", value: "3", change: "+60% عن الشهر الماضي", up: true, color: "#34D399" },
    { label: "معدل الكسب", value: "78%", change: "+5 نقاط", up: true, color: "#818CF8" },
    { label: "التحصيل المعلق", value: "26.7K", change: "₂ فواتير", up: false, color: "#F87171" },
  ];

  return (
    <div>
      <SectionHeader title="التحليلات والتقارير" icon={BarChart3} />
      <div className="flex items-center gap-2 mb-4"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية — يونيو 2026</span></div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-xs text-white/40 mb-1">{k.label}</p>
            <p className="text-2xl font-black" style={{ color: k.color }}>{k.value}</p>
            <p className={`text-xs mt-1 ${k.up ? "text-emerald-400" : "text-red-400"}`}>
              {k.up ? "↑" : "⚠"} {k.change}
            </p>
          </div>
        ))}
      </div>
      <div className="bg-gradient-to-br from-purple-900/20 to-[#0B1B2B] border border-purple-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-bold text-purple-300">التحليل الذكي — AI Insights</span>
          {aiLoaded && <span className="text-xs text-purple-400/60 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">مولّد تلقائياً</span>}
        </div>
        {!aiLoaded ? (
          <div className="flex items-center gap-2 text-white/30 text-xs">
            <motion.div className="w-3 h-3 rounded-full border border-purple-500/40 border-t-transparent"
              animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
            يحلّل الذكاء الاصطناعي بيانات مكتبك...
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-sm text-white/70 leading-7">
              📈 <span className="text-white font-medium">نقطة قوة:</span> معدل الكسب 78% أعلى من متوسط المكاتب المماثلة (64%). قضية الحربي العقارية رفعت الرقم بشكل ملحوظ.
            </p>
            <p className="text-sm text-white/70 leading-7 mt-2">
              ⚠ <span className="text-amber-400 font-medium">تنبيه:</span> فاتورتان متأخرتان تجاوزتا 30 يوماً — ينصح بتفعيل التحصيل التلقائي من مركز المالية.
            </p>
            <p className="text-sm text-white/70 leading-7 mt-2">
              🎯 <span className="text-white font-medium">فرصة:</span> 3 موكلين جدد هذا الشهر، مما يشير لنمو قادم — يُنصح بتوسيع القسم التجاري.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function AuditSection() {
  return (
    <div>
      <SectionHeader title="سجل المراقبة والأمان" icon={Activity} />
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "أحداث اليوم", value: "47", color: "text-blue-400", icon: Activity },
          { label: "تنبيهات أمنية", value: "0", color: "text-emerald-400", icon: Shield },
          { label: "مستخدمون نشطون", value: "3", color: "text-amber-400", icon: Users },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3 text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <h4 className="text-sm font-bold text-white mb-3">آخر الأحداث</h4>
      <div className="space-y-2">
        {AUDIT_EVENTS.map((e, i) => {
          const style = auditColors[e.type];
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-3 p-3 border rounded-xl ${style.bg}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-white/5`}>
                <Activity className={`w-3 h-3 ${style.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>{e.action}</span>
                  <span className="text-xs text-white/40">{e.resource}</span>
                  <span className="text-xs text-white/25 mr-auto">{e.time}</span>
                </div>
                <p className="text-xs text-white/60">{e.detail}</p>
                <p className="text-xs text-white/30 mt-0.5">بواسطة: {e.user}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function OpponentSection() {
  const [phase, setPhase] = useState<"idle"|"thinking"|"done">("idle");
  const [round, setRound] = useState(0);

  function simulate() {
    setPhase("thinking");
    setTimeout(() => { setPhase("done"); setRound(r => (r + 1) % OPPONENT_ROUNDS.length); }, 1800);
  }

  return (
    <div>
      <SectionHeader title="محاكي الخصم" icon={Shield} />
      <div className="bg-gradient-to-br from-red-950/30 to-[#0B1B2B] border border-red-500/20 rounded-xl p-4 mb-4">
        <p className="text-xs text-red-400/80 mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> الوضع: محاكاة — المحامي الافتراضي يمثل الخصم
        </p>
        <p className="text-sm text-white/60 mb-4 leading-6">اكتب حجتك القانونية وسيردّ عليك محامي AI كخصم حقيقي لاكتشاف نقاط ضعفك قبل الجلسة.</p>
        <div className="flex gap-2">
          <input placeholder="مثال: العقد الموقع يُثبت التزام موكلي..." className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/40" />
          <button onClick={simulate} className="px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors whitespace-nowrap">
            جرّب الآن
          </button>
        </div>
      </div>
      {phase === "thinking" && (
        <div className="flex items-center gap-3 p-4 bg-red-900/10 border border-red-500/20 rounded-xl">
          <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex gap-1">
            {[0,1,2].map(d => (
              <motion.div key={d} className="w-2 h-2 rounded-full bg-red-400/60"
                animate={{ y: [0,-5,0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.15 }} />
            ))}
          </div>
          <span className="text-xs text-red-400/70">المحامي الافتراضي يحضّر ردّه...</span>
        </div>
      )}
      {phase === "done" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-900/15 border border-red-500/25 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 text-red-400" />
            </div>
            <span className="text-xs font-bold text-red-400">محامي الخصم — ردّه:</span>
          </div>
          <p className="text-sm text-white/80 leading-7">{OPPONENT_ROUNDS[round].counter}</p>
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-400 font-semibold">⚡ نقطة ضعف مكتشفة:</p>
            <p className="text-xs text-white/60 mt-1">يُنصح بتقوية الحجة بمستندات موثقة أو سوابق قضائية داعمة قبل الجلسة.</p>
          </div>
        </motion.div>
      )}
      {phase === "idle" && (
        <div className="p-3 bg-white/3 border border-white/5 rounded-xl">
          <p className="text-xs text-white/30 mb-2">مثال من جلسة سابقة:</p>
          <p className="text-xs text-blue-300/60 mb-1">⚖ الحجة: العقد الموقع يُثبت الالتزام بالدفع خلال 30 يوماً</p>
          <p className="text-xs text-red-300/60">{OPPONENT_ROUNDS[0].counter.slice(0,120)}...</p>
        </div>
      )}
    </div>
  );
}

function LegalResearchSection() {
  const [searched, setSearched] = useState(false);
  return (
    <div>
      <SectionHeader title="البحث القانوني الذكي" icon={Search} />
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input defaultValue="منازعات الشراكة التجارية" placeholder="ابحث في الأنظمة والسوابق القضائية..."
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pr-9 pl-4 text-sm text-white focus:outline-none focus:border-amber-500/40" />
        </div>
        <button onClick={() => setSearched(true)} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-sm font-bold transition-colors">
          بحث AI
        </button>
      </div>
      {searched && (
        <div className="mb-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-300">
          ✓ تم تحليل 14,382 وثيقة قانونية مُحدَّثة حتى 2026 — إليك أعلى النتائج صلةً:
        </div>
      )}
      <div className="space-y-2">
        {LEGAL_RESULTS.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-4 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl cursor-pointer transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full">{r.type}</span>
                  <span className="text-xs text-white/30">{r.source}</span>
                </div>
                <p className="text-sm font-semibold text-white">{r.title}</p>
                <p className="text-xs text-white/30 mt-0.5">{r.date}</p>
              </div>
              <div className="shrink-0 text-center">
                <div className="text-lg font-black text-emerald-400">{r.relevance}%</div>
                <div className="text-xs text-white/30">صلة</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ClientPortalSection() {
  return (
    <div>
      <SectionHeader title="بوابة العملاء الذاتية" count={CLIENTS.length} icon={Globe} />
      <div className="bg-gradient-to-l from-indigo-900/20 to-transparent border border-indigo-500/15 rounded-xl p-4 mb-4">
        <p className="text-xs text-indigo-400 mb-2">كل موكل لديه رابط خاص ومشفر للوصول لملفه في أي وقت — بدون حاجة لحساب</p>
        <div className="flex items-center gap-2 bg-black/20 rounded-lg p-2.5">
          <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs text-white/50 font-mono truncate">adalah.ai/portal/tk_a8f2c9e1...</span>
          <button className="mr-auto text-xs text-indigo-400 hover:text-indigo-300 shrink-0">نسخ</button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3"><DemoBadge /><span className="text-xs text-white/40">بيانات تجريبية</span></div>
      <div className="space-y-3">
        {CLIENTS.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-3 bg-white/5 border border-white/8 rounded-xl transition-all hover:border-indigo-500/20">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600/40 to-indigo-400/20 flex items-center justify-center text-indigo-300 font-bold text-sm shrink-0">
                {c.name[0]}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{c.name}</p>
                <p className="text-xs text-white/40">{c.cases} قضايا • آخر دخول: منذ {i + 1} أيام</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge label={c.status} />
              <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">إرسال الرابط</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── MAIN TABS CONFIG ─────────────────────────── */
const TABS = [
  { id: "overview",   label: "نظرة عامة",       icon: LayoutGrid,    component: PlatformOverviewSection, isNew: true },
  { id: "cases",      label: "القضايا",          icon: Scale,         component: CasesSection,            isNew: false },
  { id: "clients",    label: "العملاء",          icon: Users,         component: ClientsSection,          isNew: false },
  { id: "contracts",  label: "العقود",            icon: FileCheck,     component: ContractsSection,        isNew: false },
  { id: "documents",  label: "المستندات",         icon: FileText,      component: DocumentsSection,        isNew: false },
  { id: "calendar",   label: "المواعيد",          icon: Calendar,      component: CalendarSection,         isNew: false },
  { id: "employees",  label: "الموظفون",          icon: UserCircle,    component: EmployeesSection,        isNew: false },
  { id: "revenues",   label: "الإيرادات",         icon: TrendingUp,    component: RevenuesSection,         isNew: false },
  { id: "expenses",   label: "المصاريف",          icon: TrendingDown,  component: ExpensesSection,         isNew: false },
  { id: "bank",       label: "الحسابات البنكية",  icon: Landmark,      component: BankSection,             isNew: false },
  { id: "invoices",   label: "الفواتير",          icon: Receipt,       component: InvoicesSection,         isNew: false },
  { id: "messages",   label: "المراسلات",         icon: MessageSquare, component: MessagesSection,         isNew: false },
  { id: "reports",    label: "التقارير",          icon: BarChart3,     component: ReportsSection,          isNew: false },
  { id: "analytics",  label: "التحليلات",         icon: Brain,         component: AnalyticsSection,        isNew: true },
  { id: "ai-hub",     label: "مساعد AI",          icon: Bot,           component: AiHubSection,            isNew: false },
  { id: "legal-ai",   label: "توليد الوثائق",     icon: Sparkles,      component: LegalAISection,          isNew: true },
  { id: "finance",    label: "التحصيل المالي",    icon: DollarSign,    component: FinanceCenterSection,    isNew: true },
  { id: "audit",      label: "سجل الأمان",        icon: Activity,      component: AuditSection,            isNew: true },
  { id: "opponent",   label: "محاكي الخصم",       icon: Shield,        component: OpponentSection,         isNew: false },
  { id: "research",   label: "البحث القانوني",    icon: Search,        component: LegalResearchSection,    isNew: false },
  { id: "portal",     label: "بوابة العملاء",    icon: Globe,         component: ClientPortalSection,     isNew: false },
];

/* ── PAGE ─────────────────────────────────────── */
export default function DemoPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const current = TABS.find(t => t.id === activeTab)!;
  const Section = current.component;

  return (
    <div dir="rtl" className="min-h-screen bg-[#0B1B2B]" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div className="sticky top-0 z-50 bg-[#0B1B2B]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Scale className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-base font-black text-white">عدالة AI</span>
              <span className="mr-2 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">معاينة تفاعلية</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`${BASE}/sign-in`}>
              <button className="text-sm text-white/60 hover:text-white px-4 py-2 rounded-lg hover:bg-white/5 transition-colors">
                تسجيل الدخول
              </button>
            </Link>
            <Link href={`${BASE}/sign-up`}>
              <button className="text-sm font-bold px-5 py-2 rounded-xl transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626" }}>
                ابدأ مجاناً
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── HERO BANNER ── */}
      <div className="bg-gradient-to-b from-[#0D2137]/60 to-transparent py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4"
              style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C" }}>
              <Sparkles className="w-3.5 h-3.5" />
              استكشاف تفاعلي حقيقي للمنصة — البيانات التجريبية معزولة تماماً
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">
              استكشف <span className="text-amber-400">عدالة AI</span> بالكامل
            </h1>
            <p className="text-white/50 text-sm max-w-xl mx-auto">
              ابدأ من "نظرة عامة" لاستعراض جميع الوحدات الحقيقية للمنصة، ثم انتقل لأي قسم لترى التفاصيل ببيانات تجريبية معزولة.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="max-w-6xl mx-auto px-4 pb-32">
        {/* Tab List */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 scrollbar-hide">
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                    : "bg-white/5 border border-white/8 text-white/60 hover:bg-white/10 hover:text-white"
                }`}>
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-black" : ""}`} />
                {t.label}
                {t.isNew && !isActive && (
                  <span className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-purple-500 border border-[#0B1B2B]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}>
            <Section />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── STICKY CTA ── */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-gradient-to-t from-[#0B1B2B] via-[#0B1B2B]/95 to-transparent pb-4 pt-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="bg-gradient-to-r from-[#0D2137] to-[#112940] border border-amber-500/25 rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">جاهز لتجربة المنصة الحقيقية؟</p>
              <p className="text-xs text-white/40 mt-0.5">ابدأ نسختك مجاناً — لا بطاقة ائتمانية، إعداد في 5 دقائق</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href={`${BASE}/sign-up`}>
                <button className="font-bold text-sm px-5 py-2.5 rounded-xl transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg"
                  style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626", boxShadow: "0 6px 24px rgba(201,168,76,0.3)" }}>
                  ابدأ مجاناً
                  <ArrowLeft className="inline w-4 h-4 mr-1.5" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
