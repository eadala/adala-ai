import { useState } from "react";
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
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── DUMMY DATA ─────────────────────────────── */
const CASES = [
  { id: "QD-2024-001", title: "نزاع تجاري - شركة الأفق العقارية", client: "أحمد محمد السعيد", type: "تجاري", status: "جارية", priority: "عالية", date: "2024-01-15", amount: "450,000", judge: "المحكمة التجارية - الرياض" },
  { id: "QD-2024-002", title: "عقد عمل - شركة النخيل للتقنية", client: "سارة أحمد الزهراني", type: "عمالي", status: "مجدولة", priority: "متوسطة", date: "2024-02-20", amount: "85,000", judge: "المحكمة العمالية - جدة" },
  { id: "QD-2024-003", title: "قضية عقارية - ورثة الحربي", client: "خالد عبدالله الحربي", type: "عقاري", status: "فائزة", priority: "عالية", date: "2024-03-05", amount: "1,200,000", judge: "المحكمة العامة - الدمام" },
  { id: "QD-2024-004", title: "توثيق عقد شراكة - مجموعة الوطن", client: "فيصل ناصر القحطاني", type: "تجاري", status: "جارية", priority: "منخفضة", date: "2024-03-18", amount: "220,000", judge: "المحكمة التجارية - الرياض" },
  { id: "QD-2024-005", title: "دعوى استحقاق مالي - البنك الأهلي", client: "مريم سلطان الدوسري", type: "مدني", status: "مؤجلة", priority: "عالية", date: "2024-04-02", amount: "670,000", judge: "المحكمة المدنية - الرياض" },
];

const CLIENTS = [
  { name: "أحمد محمد السعيد", type: "شركة", phone: "+966 50 123 4567", email: "ahmed@alfuq.com", cases: 3, totalBilled: "850,000", status: "نشط", joined: "يناير 2023", rating: 5 },
  { name: "سارة أحمد الزهراني", type: "فرد", phone: "+966 55 987 6543", email: "sara.z@mail.com", cases: 1, totalBilled: "85,000", status: "نشط", joined: "مارس 2024", rating: 4 },
  { name: "خالد عبدالله الحربي", type: "ورثة", phone: "+966 50 456 7890", email: "khalid.h@mail.com", cases: 2, totalBilled: "1,350,000", status: "نشط", joined: "يوليو 2023", rating: 5 },
  { name: "فيصل ناصر القحطاني", type: "شركة", phone: "+966 56 321 0987", email: "faisal@watangroup.com", cases: 4, totalBilled: "620,000", status: "نشط", joined: "أبريل 2023", rating: 5 },
  { name: "مريم سلطان الدوسري", type: "فرد", phone: "+966 54 111 2233", email: "mariam.d@mail.com", cases: 1, totalBilled: "200,000", status: "معلق", joined: "فبراير 2024", rating: 3 },
];

const CONTRACTS = [
  { title: "عقد توكيل عام - شركة الأفق", client: "أحمد محمد السعيد", value: "50,000", type: "توكيل", start: "2024-01-01", end: "2025-01-01", status: "ساري" },
  { title: "اتفاقية أتعاب - مجموعة الوطن", client: "فيصل القحطاني", value: "120,000", type: "أتعاب", start: "2023-10-01", end: "2024-09-30", status: "ساري" },
  { title: "عقد استشارة قانونية سنوية", client: "شركة النخيل", value: "200,000", type: "استشارة", start: "2024-01-01", end: "2024-12-31", status: "ساري" },
  { title: "عقد تمثيل قانوني - ورثة الحربي", client: "خالد الحربي", value: "85,000", type: "تمثيل", start: "2023-07-15", end: "2024-07-14", status: "منتهي" },
];

const EMPLOYEES = [
  { name: "المحامي / عبدالرحمن الشمري", role: "محامٍ أول", dept: "القسم التجاري", salary: "18,000", status: "نشط", joined: "2021-03-01", phone: "+966 50 111 2222" },
  { name: "المحامية / ريم الغامدي", role: "محامية", dept: "القسم العمالي", salary: "14,000", status: "نشط", joined: "2022-06-15", phone: "+966 55 333 4444" },
  { name: "السكرتيرة / لمياء الشهراني", role: "مساعدة إدارية", dept: "الإدارة", salary: "8,000", status: "نشط", joined: "2023-01-10", phone: "+966 50 555 6666" },
  { name: "المحامي / تركي الدوسري", role: "محامٍ", dept: "القسم المدني", salary: "12,000", status: "إجازة", joined: "2022-09-01", phone: "+966 56 777 8888" },
];

const REVENUES = [
  { desc: "أتعاب - قضية الأفق العقارية", client: "أحمد السعيد", amount: "45,000", date: "2024-04-01", category: "أتعاب", status: "مُحصّل" },
  { desc: "استشارة قانونية شهرية - شركة النخيل", client: "النخيل للتقنية", amount: "16,667", date: "2024-04-05", category: "استشارة", status: "مُحصّل" },
  { desc: "عقد تمثيل - مجموعة الوطن", client: "فيصل القحطاني", amount: "10,000", date: "2024-04-10", category: "أتعاب", status: "معلق" },
  { desc: "أتعاب قضية الحربي", client: "خالد الحربي", amount: "85,000", date: "2024-04-15", category: "أتعاب", status: "مُحصّل" },
  { desc: "رسوم توثيق عقد شراكة", client: "فيصل القحطاني", amount: "5,000", date: "2024-04-20", category: "توثيق", status: "مُحصّل" },
];

const EXPENSES = [
  { desc: "إيجار مقر المكتب - الشهر الرابع", amount: "12,000", date: "2024-04-01", category: "إيجار", vendor: "شركة الإدارة العقارية", status: "مُسدَّد" },
  { desc: "رواتب الموظفين - أبريل 2024", amount: "52,000", date: "2024-04-30", category: "رواتب", vendor: "موظفو المكتب", status: "مُسدَّد" },
  { desc: "اشتراك منصة عدالة AI", amount: "2,500", date: "2024-04-01", category: "تقنية", vendor: "عدالة AI", status: "مُسدَّد" },
  { desc: "مستلزمات مكتبية وقرطاسية", amount: "1,200", date: "2024-04-08", category: "مستلزمات", vendor: "مكتبة الدار", status: "مُسدَّد" },
  { desc: "رسوم التسجيل في المحكمة", amount: "850", date: "2024-04-12", category: "رسوم قانونية", vendor: "وزارة العدل", status: "مُسدَّد" },
];

const INVOICES = [
  { id: "INV-2024-041", client: "أحمد محمد السعيد", amount: "45,000", issued: "2024-04-01", due: "2024-04-30", status: "مدفوع", items: 2 },
  { id: "INV-2024-042", client: "شركة النخيل للتقنية", amount: "16,667", issued: "2024-04-05", due: "2024-05-05", status: "معلق", items: 1 },
  { id: "INV-2024-043", client: "فيصل ناصر القحطاني", amount: "10,000", issued: "2024-04-10", due: "2024-04-25", status: "متأخر", items: 3 },
  { id: "INV-2024-044", client: "خالد عبدالله الحربي", amount: "85,000", issued: "2024-04-15", due: "2024-05-15", status: "مدفوع", items: 1 },
];

const MESSAGES = [
  { from: "أحمد محمد السعيد", avatar: "أ", time: "منذ ٥ دقائق", text: "السلام عليكم، هل هناك أي تطورات في قضية الأفق؟ ننتظر ردكم بفارغ الصبر.", unread: true },
  { from: "فيصل ناصر القحطاني", avatar: "ف", time: "منذ ٢ ساعة", text: "تم توقيع العقد من قِبلنا، نرجو التأكيد على موعد الجلسة القادمة.", unread: true },
  { from: "المحامي عبدالرحمن الشمري", avatar: "ع", time: "أمس", text: "المستندات المطلوبة جاهزة، سأرفعها على المنصة خلال ساعة.", unread: false },
  { from: "مريم سلطان الدوسري", avatar: "م", time: "أمس", text: "شكراً جزيلاً على متابعة القضية، نرجو إبلاغنا بأي تطورات.", unread: false },
];

const AI_PROMPTS = [
  { q: "لخّص لي قضية الأفق العقارية", a: "قضية الأفق العقارية (QD-2024-001) هي نزاع تجاري بقيمة 450,000 ريال، تمثّل فيها موكلنا أحمد السعيد ضد الشركة المدعى عليها. الجلسة القادمة بتاريخ 15 مايو 2024 أمام المحكمة التجارية بالرياض. نقاط القوة: وجود عقد مكتوب + شهود. المخاطر: تأخر في تقديم المستندات المالية." },
  { q: "ما الفواتير المتأخرة هذا الشهر؟", a: "لديك فاتورة واحدة متأخرة: INV-2024-043 للعميل فيصل ناصر القحطاني بقيمة 10,000 ريال، مستحقة منذ 25 أبريل 2024 (تأخر 5 أيام). أنصح بإرسال تذكير فوري عبر البريد الإلكتروني أو رسالة نصية." },
  { q: "هل هناك نزاعات مشابهة في قانون الشركات السعودي؟", a: "نعم، وفق نظام الشركات السعودي الجديد 2022، هناك عدة أحكام محكمة في منازعات الشراكة (المادتان 108 و114) تدعم موقف موكلك. سأقترح إضافتها كمرجع قانوني في المذكرة القادمة." },
];

const DOCUMENTS = [
  { name: "عقد توكيل - أحمد السعيد.pdf", case: "QD-2024-001", size: "1.2 MB", date: "2024-04-01", status: "مُفهرس", ocr: true },
  { name: "حكم محكمة تجارية 2024.pdf", case: "QD-2024-001", size: "3.8 MB", date: "2024-04-05", status: "مُفهرس", ocr: true },
  { name: "عقد استشارة - شركة النخيل.docx", case: "QD-2024-002", size: "0.4 MB", date: "2024-04-10", status: "مُعالج", ocr: false },
  { name: "صورة بطاقة - خالد الحربي.jpg", case: "QD-2024-003", size: "0.8 MB", date: "2024-04-12", status: "مُفهرس", ocr: true },
  { name: "كشف حساب بنكي - أبريل.pdf", case: "QD-2024-005", size: "2.1 MB", date: "2024-04-20", status: "جديد", ocr: false },
];

const SESSIONS = [
  { title: "جلسة قضية الأفق العقارية", case: "QD-2024-001", court: "المحكمة التجارية - الرياض", date: "2024-05-15", time: "10:00 ص", type: "مرافعة", status: "قادمة" },
  { title: "جلسة عقد عمل النخيل", case: "QD-2024-002", court: "المحكمة العمالية - جدة", date: "2024-05-18", time: "09:30 ص", type: "صلح", status: "قادمة" },
  { title: "استشارة - فيصل القحطاني", case: "QD-2024-004", court: "مكتب المحامي", date: "2024-05-20", time: "02:00 م", type: "استشارة", status: "مؤكدة" },
  { title: "تقديم مستندات - ورثة الحربي", case: "QD-2024-003", court: "المحكمة العامة - الدمام", date: "2024-05-22", time: "11:00 ص", type: "إجراء", status: "قادمة" },
];

const LEGAL_RESULTS = [
  { title: "نظام الشركات السعودي 2022 - المادة 108", source: "وزارة التجارة", relevance: 97, type: "نظام", date: "2022-11-16" },
  { title: "حكم محكمة الاستئناف التجارية رقم 4521/2023", source: "ديوان المظالم", relevance: 91, type: "سابقة قضائية", date: "2023-08-22" },
  { title: "نظام العمل السعودي - الباب الخامس", source: "وزارة الموارد البشرية", relevance: 85, type: "نظام", date: "2021-03-01" },
  { title: "لائحة التحكيم التجاري - المادة 35", source: "هيئة التحكيم التجاري", relevance: 78, type: "لائحة", date: "2023-01-15" },
];

const OPPONENT_ROUNDS = [
  { counter: "العقد وُقِّع تحت إكراه مالي، والمادة 178 من نظام الأحوال الشخصية تُجيز إبطاله. علاوةً على ذلك، لم يلتزم الطرف الآخر بالتسليم في الموعد المحدد مما يُسقط الالتزام المقابل." },
  { counter: "وثيقة الاستلام المقدمة غير موثقة من طرف ثالث محايد. المحكمة التجارية الرياض سبق أن رفضت مستندات مشابهة في قضية رقم 3841/2022. يجب توثيقها من الغرفة التجارية." },
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
  مُحصّل:   "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  مُسدَّد:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  مدفوع:    "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  متأخر:    "bg-red-500/20 text-red-300 border-red-500/30",
};

const priorityColors: Record<string, string> = {
  عالية:    "text-red-400",
  متوسطة:   "text-amber-400",
  منخفضة:   "text-emerald-400",
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

/* ── SECTION COMPONENTS ──────────────────────── */
function CasesSection() {
  return (
    <div>
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
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RevenuesSection() {
  const total = 161667;
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "إجمالي الإيرادات", value: "161,667 ﷼", color: "text-emerald-400", icon: TrendingUp },
          { label: "مُحصَّل", value: "146,667 ﷼", color: "text-blue-400", icon: CheckCircle },
          { label: "معلق", value: "15,000 ﷼", color: "text-amber-400", icon: Clock },
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
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "إجمالي المصاريف", value: "68,550 ﷼", color: "text-red-400", icon: TrendingDown },
          { label: "مُسدَّد", value: "68,550 ﷼", color: "text-white/60", icon: CheckCircle },
          { label: "صافي الربح", value: "93,117 ﷼", color: "text-emerald-400", icon: Activity },
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
      <SectionHeader title="المراسلات والرسائل" count={MESSAGES.length} icon={MessageSquare} />
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
    { month: "فبراير", rev: 110, exp: 60 },
    { month: "مارس", rev: 130, exp: 58 },
    { month: "أبريل", rev: 162, exp: 69 },
  ];
  return (
    <div>
      <SectionHeader title="التقارير المالية" icon={BarChart3} />
      <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-4">
        <p className="text-xs text-white/40 mb-3">الإيرادات مقابل المصاريف (آلاف ريال)</p>
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
          { label: "إجمالي الإيرادات", val: "161,667 ﷼", trend: "+18%", up: true },
          { label: "إجمالي المصاريف", val: "68,550 ﷼", trend: "+5%", up: false },
          { label: "صافي الربح", val: "93,117 ﷼", trend: "+31%", up: true },
          { label: "نسبة الربحية", val: "57.6%", trend: "+8%", up: true },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-xs text-white/40 mb-1">{s.label}</p>
            <p className="text-base font-bold text-white">{s.val}</p>
            <p className={`text-xs font-medium mt-0.5 ${s.up ? "text-emerald-400" : "text-red-400"}`}>
              {s.up ? "↑" : "↑"} {s.trend} من الشهر الماضي
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiSection() {
  const [selected, setSelected] = useState(0);
  const [typing, setTyping] = useState(false);
  const [shown, setShown] = useState(false);

  function ask(i: number) {
    setSelected(i);
    setTyping(true);
    setShown(false);
    setTimeout(() => { setTyping(false); setShown(true); }, 1400);
  }

  return (
    <div>
      <SectionHeader title="الذكاء الاصطناعي القانوني" icon={Bot} />
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
                  animate={{ y: [0, -6, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.15 }} />
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

function BankSection() {
  const accounts = [
    { bank: "البنك الأهلي السعودي", iban: "SA44 2000 0001 2345 6789 0123", balance: "385,000", type: "جاري" },
    { bank: "بنك الراجحي", iban: "SA36 8000 0001 9876 5432 1098", balance: "127,500", type: "توفير" },
  ];
  return (
    <div>
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
          { name: "عبدالرحمن الشمري", amount: "2,000", purpose: "رسوم محاكم - قضية الأفق", date: "2024-04-10", status: "قائم" },
          { name: "ريم الغامدي", amount: "800", purpose: "نثريات ومستلزمات مكتبية", date: "2024-04-15", status: "مُسوَّى" },
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

function DocumentsSection() {
  return (
    <div>
      <SectionHeader title="إدارة المستندات" count={DOCUMENTS.length} icon={FileText} />
      <SearchBar placeholder="ابحث في المستندات أو استخدم OCR..." />
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
                  <span>{d.case}</span>
                  <span>{d.size}</span>
                  <span>{d.date}</span>
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
      <SectionHeader title="المواعيد والجلسات" count={SESSIONS.length} icon={Calendar} />
      <div className="bg-white/5 border border-white/8 rounded-xl p-4 mb-4">
        <p className="text-xs text-white/40 mb-3">مايو 2024</p>
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {["أح","إث","ثل","أر","خم","جم","سب"].map(d => (
            <div key={d} className="text-xs text-white/30 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {[...Array(31)].map((_, i) => {
            const day = i + 1;
            const has = highlighted.includes(day);
            return (
              <div key={i} className={`text-xs py-1.5 rounded-lg cursor-pointer transition-colors ${
                has ? "bg-amber-500 text-black font-bold" :
                day === 11 ? "bg-white/15 text-white font-bold" :
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
          ✓ تم تحليل 12,847 وثيقة قانونية — إليك أعلى النتائج صلةً:
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
      <SectionHeader title="بوابة الموكلين" count={CLIENTS.length} icon={Globe} />
      <div className="bg-gradient-to-l from-indigo-900/20 to-transparent border border-indigo-500/15 rounded-xl p-4 mb-4">
        <p className="text-xs text-indigo-400 mb-2">كل موكل لديه رابط خاص ومشفر للوصول لملفه في أي وقت</p>
        <div className="flex items-center gap-2 bg-black/20 rounded-lg p-2.5">
          <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs text-white/50 font-mono truncate">portal.adalah.ai/client/tk_a8f2c9e1...</span>
          <button className="mr-auto text-xs text-indigo-400 hover:text-indigo-300 shrink-0">نسخ</button>
        </div>
      </div>
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
  { id: "cases",     label: "القضايا",        icon: Scale,          component: CasesSection },
  { id: "clients",   label: "الموكلين",        icon: Users,          component: ClientsSection },
  { id: "contracts", label: "العقود",          icon: FileCheck,      component: ContractsSection },
  { id: "documents", label: "المستندات",       icon: FileText,       component: DocumentsSection },
  { id: "calendar",  label: "المواعيد",        icon: Calendar,       component: CalendarSection },
  { id: "employees", label: "الموظفون",        icon: UserCircle,     component: EmployeesSection },
  { id: "revenues",  label: "الإيرادات",       icon: TrendingUp,     component: RevenuesSection },
  { id: "expenses",  label: "المصاريف",        icon: TrendingDown,   component: ExpensesSection },
  { id: "bank",      label: "البنك والسلف",    icon: Landmark,       component: BankSection },
  { id: "invoices",  label: "الفواتير",        icon: Receipt,        component: InvoicesSection },
  { id: "messages",  label: "المراسلات",       icon: MessageSquare,  component: MessagesSection },
  { id: "reports",   label: "التقارير",        icon: BarChart3,      component: ReportsSection },
  { id: "opponent",  label: "محاكي الخصم",     icon: Shield,         component: OpponentSection },
  { id: "research",  label: "البحث القانوني",  icon: Search,         component: LegalResearchSection },
  { id: "portal",    label: "بوابة الموكلين",  icon: Globe,          component: ClientPortalSection },
  { id: "ai",        label: "الذكاء AI",       icon: Bot,            component: AiSection },
];

/* ── PAGE ─────────────────────────────────────── */
export default function DemoPage() {
  const [activeTab, setActiveTab] = useState("cases");

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
              <span className="mr-2 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">تجربة تفاعلية</span>
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
              بيئة تجريبية كاملة — جميع البيانات افتراضية للعرض
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-3">
              استكشف عدالة AI <span className="text-amber-400">كأنك محامٍ حقيقي</span>
            </h1>
            <p className="text-white/50 text-sm max-w-xl mx-auto">
              انقر على أي قسم واستعرض منصة إدارة قانونية متكاملة مع قضايا وعملاء وتقارير مالية حقيقية — جاهزة للتجربة الفورية.
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
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                    : "bg-white/5 border border-white/8 text-white/60 hover:bg-white/10 hover:text-white"
                }`}>
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-black" : ""}`} />
                {t.label}
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
              <p className="text-sm font-bold text-white">أعجبك ما رأيت؟</p>
              <p className="text-xs text-white/40 mt-0.5">ابدأ نسختك الحقيقية مجاناً — لا بطاقة ائتمانية</p>
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
