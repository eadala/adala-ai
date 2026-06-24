import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Scale, FileText, Users, Calendar, Search, Send, CheckCircle2, Loader2,
  AlertTriangle, ArrowRight, ArrowLeft, Phone, Mail, MessageCircle,
  Gavel, Shield, BadgeCheck, ChevronRight, ChevronLeft, Clock,
  Building, MapPin, Home, DollarSign, TrendingUp, Activity,
  ClipboardList, X, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Lang = "ar" | "en";
const t = (ar: string, en: string, lang: Lang) => lang === "en" ? en : ar;

const imgSrc = (path: string | null | undefined) => {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `/api/storage/objects${path.startsWith("/") ? path : "/" + path}`;
};

const toWaNum = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00966")) return d.slice(2);
  if (d.startsWith("966")) return d;
  if (d.startsWith("0")) return "966" + d.slice(1);
  return d.length <= 9 ? "966" + d : d;
};

/* ── Status badge ─────────────────────────────────────────── */
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  under_review: "bg-violet-50 text-violet-700 border-violet-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_approved: "bg-teal-50 text-teal-700 border-teal-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
  finalized: "bg-slate-100 text-slate-600 border-slate-200",
};

/* ── Claim Submit Dialog ─────────────────────────────────── */
function ClaimDialog({
  slug, lang, primaryColor, onClose,
}: { slug: string; lang: Lang; primaryColor: string; onClose: () => void }) {
  const { toast } = useToast();
  const c = primaryColor;
  const cLight = `${c}15`;
  const [step, setStep] = useState<"form" | "done">("form");
  const [claimRef, setClaimRef] = useState("");
  const [form, setForm] = useState({
    creditorName: "", creditorId: "", phone: "", email: "",
    amount: "", description: "",
  });

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/office/public/${slug}/bankruptcy/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "حدث خطأ");
      return d;
    },
    onSuccess: (d) => { setClaimRef(d.claimNumber ?? d.claimId?.slice(0, 8).toUpperCase()); setStep("done"); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const ok = form.creditorName.trim() && form.phone.trim() && Number(form.amount) > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="font-black text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" style={{ color: c }} />
            {t("تقديم مطالبة دائن", "Submit Creditor Claim", lang)}
          </DialogTitle>
        </DialogHeader>

        {step === "done" ? (
          <div className="text-center py-8">
            <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: cLight }}>
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="font-black text-xl mb-2 text-slate-800">{t("تم تقديم المطالبة!", "Claim Submitted!", lang)}</h3>
            <p className="text-sm text-slate-500 mb-4">
              {t("رقم المطالبة:", "Claim Reference:", lang)}
            </p>
            <div className="text-2xl font-black tracking-widest p-4 rounded-xl mb-6" style={{ background: cLight, color: c }}>
              {claimRef}
            </div>
            <p className="text-xs text-slate-400 mb-6">
              {t("احتفظ بهذا الرقم لمتابعة حالة مطالبتك. سيتواصل معك فريق المكتب قريباً.", "Keep this reference number to track your claim. The office team will contact you soon.", lang)}
            </p>
            <Button className="w-full font-bold" onClick={onClose} style={{ background: c, color: "#fff" }}>
              {t("إغلاق", "Close", lang)}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">{t("الاسم الكامل *", "Full Name *", lang)}</Label>
                <Input value={form.creditorName} onChange={e => setForm(f => ({ ...f, creditorName: e.target.value }))}
                  placeholder={t("اسم الدائن", "Creditor name", lang)} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">{t("رقم الهوية / السجل", "ID / CR Number", lang)}</Label>
                <Input value={form.creditorId} onChange={e => setForm(f => ({ ...f, creditorId: e.target.value }))}
                  placeholder="1XXXXXXXXX" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">{t("رقم الجوال *", "Phone *", lang)}</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="05XXXXXXXX" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">{t("البريد الإلكتروني", "Email", lang)}</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  type="email" placeholder="email@domain.com" dir="ltr" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">{t("مبلغ المطالبة (ر.س) *", "Claim Amount (SAR) *", lang)}</Label>
              <Input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                type="number" min="1" placeholder="0.00" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">{t("تفاصيل المطالبة", "Claim Details", lang)}</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder={t("اشرح طبيعة الدين وأسبابه...", "Describe the nature and basis of the debt...", lang)}
                className="resize-none" />
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {t("يُعدّ تقديم معلومات مضللة مخالفة قانونية. تأكد من صحة جميع البيانات.", "Submitting false information is a legal violation. Ensure all data is accurate.", lang)}
            </div>
            <Button className="w-full font-bold gap-2 text-white" onClick={() => mut.mutate()}
              disabled={mut.isPending || !ok} style={{ background: c }}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("تقديم المطالبة", "Submit Claim", lang)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Track Dialog ────────────────────────────────────────── */
function TrackDialog({
  slug, lang, primaryColor, onClose,
}: { slug: string; lang: Lang; primaryColor: string; onClose: () => void }) {
  const c = primaryColor;
  const cLight = `${c}15`;
  const [query, setQuery] = useState("");
  const [queryType, setQueryType] = useState<"claimId" | "phone">("claimId");
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);

  const searchMut = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams({ [queryType]: query });
      const r = await fetch(`${BASE}/api/office/public/${slug}/bankruptcy/track?${params}`);
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "لم يتم العثور على نتائج"); }
      return r.json();
    },
    onSuccess: (data) => { setResults(data); setSearched(true); },
    onError: (e: any) => { setResults([]); setSearched(true); },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="font-black text-lg flex items-center gap-2">
            <Search className="h-5 w-5" style={{ color: c }} />
            {t("متابعة حالة المطالبة", "Track Claim Status", lang)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            <button onClick={() => setQueryType("claimId")}
              className={cn("flex-1 py-2.5 text-xs font-bold transition-colors", queryType === "claimId" ? "text-white" : "text-slate-500 bg-white hover:bg-slate-50")}
              style={queryType === "claimId" ? { background: c } : {}}>
              {t("رقم المطالبة", "Claim ID", lang)}
            </button>
            <button onClick={() => setQueryType("phone")}
              className={cn("flex-1 py-2.5 text-xs font-bold transition-colors", queryType === "phone" ? "text-white" : "text-slate-500 bg-white hover:bg-slate-50")}
              style={queryType === "phone" ? { background: c } : {}}>
              {t("رقم الجوال", "Phone Number", lang)}
            </button>
          </div>

          <div className="flex gap-2">
            <Input value={query} onChange={e => setQuery(e.target.value)}
              dir={queryType === "phone" ? "ltr" : "ltr"}
              placeholder={queryType === "claimId" ? t("أدخل رقم المطالبة", "Enter claim reference", lang) : "05XXXXXXXX"}
              onKeyDown={e => e.key === "Enter" && query.trim() && searchMut.mutate()} />
            <Button onClick={() => searchMut.mutate()} disabled={!query.trim() || searchMut.isPending}
              style={{ background: c, color: "#fff" }}>
              {searchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {searched && results.length === 0 && (
            <div className="text-center py-6 text-slate-400">
              <Search className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{t("لم يتم العثور على مطالبات", "No claims found", lang)}</p>
            </div>
          )}

          {results.map((r: any) => (
            <div key={r.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">{t("رقم المطالبة", "Claim #", lang)}</p>
                  <p className="font-black text-sm tracking-wider" style={{ color: c }}>{r.claimNumber}</p>
                </div>
                <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full border", STATUS_COLOR[r.status] ?? "bg-slate-50 text-slate-600 border-slate-200")}>
                  {r.statusAr ?? r.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400">{t("الدائن", "Creditor", lang)}</p>
                  <p className="font-semibold text-slate-700">{r.creditor_name}</p>
                </div>
                <div>
                  <p className="text-slate-400">{t("المبلغ المطالب به", "Claimed Amount", lang)}</p>
                  <p className="font-semibold text-slate-700">{r.amountFormatted}</p>
                </div>
                <div>
                  <p className="text-slate-400">{t("ملف الإفلاس", "Case", lang)}</p>
                  <p className="font-semibold text-slate-700">{r.case_number ?? "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400">{t("المدين", "Debtor", lang)}</p>
                  <p className="font-semibold text-slate-700">{r.debtor_name ?? "—"}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                {t("تاريخ التقديم:", "Submitted:", lang)} {new Date(r.created_at).toLocaleDateString("ar-SA")}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
export default function OfficeBankruptcyPortal() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { toast } = useToast();

  const [lang, setLang] = useState<Lang>("ar");
  const [activeTab, setActiveTab] = useState<"overview" | "claim" | "track" | "meetings" | "services">("overview");
  const [claimDialog, setClaimDialog] = useState(false);
  const [trackDialog, setTrackDialog] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["office-bankruptcy-portal", slug],
    queryFn: () => fetch(`${BASE}/api/office/public/${slug}/bankruptcy`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
  });

  const { data: meetings = [] } = useQuery<any[]>({
    queryKey: ["office-bankruptcy-meetings", slug],
    queryFn: () => fetch(`${BASE}/api/office/public/${slug}/bankruptcy/meetings`).then(r => r.json()),
    enabled: !!data?.enabled,
  });

  const dir = lang === "ar" ? "rtl" : "ltr";

  /* Loading */
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
      <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
    </div>
  );

  /* Portal disabled */
  if (isError || !data?.enabled) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center px-6" dir="rtl">
      <div>
        <Scale className="h-16 w-16 mx-auto mb-6 text-slate-200" />
        <h1 className="text-3xl font-black mb-3 text-slate-800">بوابة الإفلاس غير متاحة</h1>
        <p className="text-slate-500 text-sm mb-6">هذا المكتب لم يفعّل بوابة الإفلاس العامة بعد</p>
        <a href={`/firms/${slug}`}>
          <Button variant="outline">العودة لصفحة المكتب</Button>
        </a>
      </div>
    </div>
  );

  const { office, stats, bankruptcyServices = [], allowOnlineClaims, enableCreditorPortal } = data;
  const c = office.primaryColor ?? "#EA580C";
  const cLight = `${c}15`;
  const cBorder = `${c}30`;
  const officeName = office.name ?? "المكتب القانوني";

  const waNum = toWaNum(office.whatsapp ?? office.phone ?? "");

  /* ── TABS ── */
  const TABS = [
    { id: "overview", label: t("نظرة عامة", "Overview", lang), icon: Home },
    ...(allowOnlineClaims ? [{ id: "claim", label: t("تقديم مطالبة", "Submit Claim", lang), icon: ClipboardList }] : []),
    { id: "track", label: t("متابعة المطالبة", "Track Claim", lang), icon: Search },
    { id: "meetings", label: t("الاجتماعات", "Meetings", lang), icon: Calendar },
    ...(bankruptcyServices.length ? [{ id: "services", label: t("الخدمات", "Services", lang), icon: Gavel }] : []),
  ] as Array<{ id: string; label: string; icon: React.ComponentType<any> }>;

  const MEETING_TYPE_AR: Record<string, string> = {
    creditors: "اجتماع الدائنين", voting: "جلسة التصويت",
    distribution: "توزيع الأصول", court: "جلسة المحكمة",
    general: "اجتماع عام", liquidation: "اجتماع التصفية",
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC]" dir={dir}
      style={{ fontFamily: lang === "ar" ? "'Cairo','Tajawal',sans-serif" : "system-ui,sans-serif" }}>

      {/* ── NAVBAR ── */}
      <nav className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200" : "bg-white/80 backdrop-blur",
      )}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          {/* Back + branding */}
          <div className="flex items-center gap-3">
            <a href={`/firms/${slug}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-semibold">
              {lang === "ar" ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
              {t("المكتب", "Office", lang)}
            </a>
            <span className="text-slate-200">/</span>
            {office.logo && (
              <img src={imgSrc(office.logo)} alt={officeName} className="h-7 w-7 rounded-lg object-cover" />
            )}
            <span className="font-black text-slate-900 text-sm hidden sm:block">{officeName}</span>
          </div>

          {/* Title badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border font-bold text-sm"
            style={{ background: "#FFF7ED", color: "#C2410C", borderColor: "#FED7AA" }}>
            <Scale className="h-4 w-4" />
            {t("بوابة الإفلاس العامة", "Bankruptcy Portal", lang)}
          </div>

          {/* Lang toggle */}
          <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
            className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 font-bold text-slate-500 hover:border-slate-300">
            {lang === "ar" ? "EN" : "ع"}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-16 pb-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950 via-slate-900 to-slate-950" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)", backgroundSize: "24px 24px" }} />
        <div className="absolute top-1/4 right-1/3 w-[500px] h-[500px] rounded-full blur-[100px] opacity-20"
          style={{ background: c }} />

        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-20 text-center text-white">
          {/* Icon */}
          <div className="h-20 w-20 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl ring-2 ring-white/10"
            style={{ background: `${c}40`, backdropFilter: "blur(8px)" }}>
            <Scale className="h-10 w-10 text-orange-300" />
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 text-orange-300 text-xs font-bold mb-4 border border-orange-500/30">
            <BadgeCheck className="h-3.5 w-3.5" />
            {t("بوابة الإفلاس المعتمدة", "Certified Bankruptcy Portal", lang)}
          </div>

          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight drop-shadow-xl">
            {t("بوابة الإفلاس العامة", "Bankruptcy Public Portal", lang)}
          </h1>
          <p className="text-lg text-white/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            {officeName} — {t("تقديم المطالبات ومتابعة ملفات الإفلاس والتواصل مع الدائنين بشفافية كاملة", "Submit claims, track bankruptcy cases, and communicate with creditors transparently", lang)}
          </p>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-3 justify-center">
            {allowOnlineClaims && (
              <button onClick={() => setClaimDialog(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-white shadow-xl hover:opacity-90 transition-all hover:scale-105"
                style={{ background: c }}>
                <ClipboardList className="h-4 w-4" />
                {t("قدّم مطالبتك الآن", "Submit Your Claim", lang)}
              </button>
            )}
            <button onClick={() => setTrackDialog(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm bg-white/10 backdrop-blur hover:bg-white/20 transition-all border border-white/20">
              <Search className="h-4 w-4" />
              {t("متابعة حالة المطالبة", "Track Claim Status", lang)}
            </button>
            {waNum && (
              <a href={`https://wa.me/${waNum}`} target="_blank" rel="noreferrer">
                <button className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm bg-emerald-600/80 hover:bg-emerald-600 transition-all border border-emerald-500/50">
                  <MessageCircle className="h-4 w-4" />
                  {t("تواصل مباشر", "Direct Contact", lang)}
                </button>
              </a>
            )}
          </div>
        </div>

        {/* Decorative wave */}
        <div className="relative h-12 overflow-hidden">
          <svg viewBox="0 0 1440 48" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full" fill="#F7F8FC">
            <path d="M0,48L1440,0L1440,48L0,48Z" />
          </svg>
        </div>
      </section>

      {/* ── STATS ── */}
      {stats && (
        <div className="bg-white border-y border-slate-200 py-8">
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: t("ملفات نشطة", "Active Cases", lang), value: stats.activeCases, icon: Gavel, color: "#EF4444" },
              { label: t("الدائنون", "Creditors", lang),       value: stats.creditors,   icon: Users, color: "#8B5CF6" },
              { label: t("المطالبات", "Claims", lang),          value: stats.claims,      icon: ClipboardList, color: "#F97316" },
              { label: t("اجتماعات قادمة", "Upcoming Meetings", lang), value: stats.upcomingMeetings, icon: Calendar, color: "#10B981" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label}>
                <div className="h-11 w-11 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: `${color}15` }}>
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <div className="text-3xl font-black" style={{ color }}>{value.toLocaleString("ar-SA")}</div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TABS ── */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-40">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-hide">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id as any)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap text-xs font-bold px-4 py-2.5 rounded-xl transition-all shrink-0",
                  activeTab === id ? "text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50",
                )}
                style={activeTab === id ? { background: c } : {}}>
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* About */}
            {office.about && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8">
                <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Building className="h-5 w-5" style={{ color: c }} />
                  {t("عن المكتب", "About the Firm", lang)}
                </h2>
                <p className="text-slate-600 leading-relaxed">{office.about}</p>
              </div>
            )}

            {/* How it works */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <h2 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <Activity className="h-5 w-5" style={{ color: c }} />
                {t("كيف تعمل البوابة؟", "How does the portal work?", lang)}
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {[
                  {
                    num: "١", icon: ClipboardList, title: t("تقديم المطالبة", "Submit Claim", lang),
                    desc: t("أدخل بياناتك ومعلومات الدين عبر نموذج إلكتروني آمن", "Enter your data and debt details through a secure online form", lang),
                  },
                  {
                    num: "٢", icon: Search, title: t("مراجعة الملف", "Case Review", lang),
                    desc: t("يراجع فريق المكتب مطالبتك ويتحقق من صحة المستندات", "The office team reviews your claim and verifies documentation", lang),
                  },
                  {
                    num: "٣", icon: TrendingUp, title: t("التوزيع", "Distribution", lang),
                    desc: t("يتم إخطارك بنتيجة المطالبة وحصتك من التوزيعات عند صدورها", "You will be notified of the claim result and your share of distributions", lang),
                  },
                ].map(({ num, icon: Icon, title, desc }) => (
                  <div key={num} className="text-center">
                    <div className="h-14 w-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: cLight }}>
                      <Icon className="h-7 w-7" style={{ color: c }} />
                    </div>
                    <div className="text-2xl font-black mb-1" style={{ color: c }}>{num}</div>
                    <h3 className="font-black text-slate-800 mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Legal disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-black text-amber-800 mb-2">{t("إشعار قانوني", "Legal Notice", lang)}</h3>
                <p className="text-sm text-amber-700 leading-relaxed">
                  {t(
                    "هذه البوابة مخصصة لتقديم المطالبات في إطار إجراءات الإفلاس المنظّمة وفق نظام الإفلاس السعودي. يُعدّ تقديم معلومات مضللة جريمة يُعاقب عليها القانون. جميع المطالبات تخضع للمراجعة والتحقق من قِبل المصفّي المعيَّن.",
                    "This portal is dedicated to submitting claims under Saudi bankruptcy proceedings. Submitting false information is a punishable criminal offense. All claims are subject to review and verification by the appointed trustee.",
                    lang,
                  )}
                </p>
              </div>
            </div>

            {/* Contact */}
            {(office.phone || office.email || office.city) && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h2 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Phone className="h-4 w-4" style={{ color: c }} />
                  {t("تواصل مع المكتب", "Contact the Office", lang)}
                </h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {office.phone && (
                    <a href={`tel:${office.phone}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: cLight }}>
                        <Phone className="h-4 w-4" style={{ color: c }} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">{t("الهاتف", "Phone", lang)}</p>
                        <p className="font-bold text-sm text-slate-700" dir="ltr">{office.phone}</p>
                      </div>
                    </a>
                  )}
                  {office.email && (
                    <a href={`mailto:${office.email}`} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: cLight }}>
                        <Mail className="h-4 w-4" style={{ color: c }} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">{t("البريد", "Email", lang)}</p>
                        <p className="font-bold text-sm text-slate-700">{office.email}</p>
                      </div>
                    </a>
                  )}
                  {office.city && (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: cLight }}>
                        <MapPin className="h-4 w-4" style={{ color: c }} />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">{t("المدينة", "City", lang)}</p>
                        <p className="font-bold text-sm text-slate-700">{office.city}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CLAIM TAB */}
        {activeTab === "claim" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <div className="text-center mb-8">
                <div className="h-16 w-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: cLight }}>
                  <ClipboardList className="h-8 w-8" style={{ color: c }} />
                </div>
                <h2 className="text-xl font-black text-slate-800 mb-2">
                  {t("تقديم مطالبة دائن", "Submit Creditor Claim", lang)}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("إذا كانت لديك مطالبة مالية على المدين، يمكنك تقديمها إلكترونياً عبر هذه البوابة", "If you have a financial claim against the debtor, you can submit it electronically through this portal", lang)}
                </p>
              </div>
              <button onClick={() => setClaimDialog(true)}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-base text-white shadow-lg hover:opacity-90 transition-all hover:scale-[1.01]"
                style={{ background: c }}>
                <ClipboardList className="h-5 w-5" />
                {t("ابدأ تقديم المطالبة", "Start Claim Submission", lang)}
              </button>
              <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                {[
                  { label: t("آمن ومشفّر", "Secure & Encrypted", lang), icon: Shield, color: "#10B981" },
                  { label: t("معالجة سريعة", "Fast Processing", lang), icon: Clock, color: "#6366F1" },
                  { label: t("متابعة فورية", "Instant Tracking", lang), icon: Activity, color: "#F97316" },
                ].map(({ label, icon: Icon, color }) => (
                  <div key={label} className="text-center">
                    <div className="h-10 w-10 rounded-xl mx-auto mb-2 flex items-center justify-center" style={{ background: `${color}15` }}>
                      <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <p className="text-xs font-semibold text-slate-600">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TRACK TAB */}
        {activeTab === "track" && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 p-8">
              <div className="text-center mb-8">
                <div className="h-16 w-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-violet-50">
                  <Search className="h-8 w-8 text-violet-600" />
                </div>
                <h2 className="text-xl font-black text-slate-800 mb-2">
                  {t("متابعة حالة المطالبة", "Track Claim Status", lang)}
                </h2>
                <p className="text-sm text-slate-500">
                  {t("أدخل رقم المطالبة أو رقم جوالك للاطلاع على حالة مطالبتك", "Enter your claim reference or phone number to check your claim status", lang)}
                </p>
              </div>
              <button onClick={() => setTrackDialog(true)}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-base bg-violet-600 text-white hover:bg-violet-700 transition-all shadow-lg">
                <Search className="h-5 w-5" />
                {t("ابحث عن مطالبتك", "Search Your Claim", lang)}
              </button>
            </div>
          </div>
        )}

        {/* MEETINGS TAB */}
        {activeTab === "meetings" && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Calendar className="h-6 w-6" style={{ color: c }} />
              {t("الاجتماعات والجلسات", "Meetings & Sessions", lang)}
            </h2>
            {meetings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-200" />
                <p className="text-slate-400">{t("لا توجد اجتماعات مجدولة حالياً", "No scheduled meetings at this time", lang)}</p>
              </div>
            ) : (
              meetings.map((m: any) => (
                <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex gap-5">
                  <div className="h-12 w-12 rounded-2xl shrink-0 flex items-center justify-center" style={{ background: cLight }}>
                    <Calendar className="h-6 w-6" style={{ color: c }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-black text-slate-800">{m.title}</h3>
                      <Badge variant="outline" className="shrink-0 text-[11px]">
                        {MEETING_TYPE_AR[m.meeting_type] ?? m.meeting_type ?? t("اجتماع", "Meeting", lang)}
                      </Badge>
                    </div>
                    {m.meeting_date && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(m.meeting_date).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
                      </div>
                    )}
                    {m.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                        <MapPin className="h-3.5 w-3.5" />
                        {m.location}
                      </div>
                    )}
                    {m.debtor_name && (
                      <div className="text-xs text-slate-400">
                        {t("المدين:", "Debtor:", lang)} <span className="font-semibold text-slate-600">{m.debtor_name}</span>
                        {m.case_number && <span className="ml-2 rtl:mr-2 rtl:ml-0">— {m.case_number}</span>}
                      </div>
                    )}
                    {m.agenda && (
                      <p className="mt-2 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2">{m.agenda}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SERVICES TAB */}
        {activeTab === "services" && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Gavel className="h-6 w-6" style={{ color: c }} />
              {t("خدمات الإفلاس", "Bankruptcy Services", lang)}
            </h2>
            <p className="text-sm text-slate-500">
              {t("يقدّم المكتب مجموعة من الخدمات المتخصصة في مجال الإفلاس وإعادة الهيكلة", "The firm offers specialized bankruptcy and restructuring services", lang)}
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {bankruptcyServices.map((svc: any) => (
                <div key={svc.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-all">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: cLight }}>
                      <Gavel className="h-5 w-5" style={{ color: c }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-slate-800 mb-1">{svc.name}</h3>
                      {svc.category && <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: cLight, color: c }}>{svc.category}</span>}
                    </div>
                  </div>
                  {svc.description && <p className="text-sm text-slate-500 mb-4 leading-relaxed">{svc.description}</p>}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div>
                      {svc.isCustomQuote ? (
                        <span className="text-sm font-bold text-slate-500">{t("سعر حسب الطلب", "Custom Quote", lang)}</span>
                      ) : (
                        <div>
                          <span className="text-xl font-black" style={{ color: c }}>{Number(svc.price).toLocaleString("ar-SA")}</span>
                          <span className="text-xs text-slate-400 ms-1">{t("ر.س", "SAR", lang)}</span>
                        </div>
                      )}
                    </div>
                    <a href={`/firms/${slug}/store`}>
                      <button className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl font-bold text-white"
                        style={{ background: c }}>
                        {t("اطلب الخدمة", "Request Service", lang)}
                        {lang === "ar" ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-white mt-16 py-10">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Scale className="h-5 w-5 text-orange-400" />
            <span className="font-black">{officeName}</span>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            {t("بوابة الإفلاس العامة — مُدارة بموجب نظام الإفلاس السعودي", "Bankruptcy Public Portal — Managed under the Saudi Bankruptcy Law", lang)}
          </p>
          <a href={`/firms/${slug}`} className="text-xs text-orange-400 hover:text-orange-300 transition-colors font-semibold">
            {t("العودة لصفحة المكتب الرئيسية →", "Back to the firm's main page →", lang)}
          </a>
        </div>
      </footer>

      {/* ── DIALOGS ── */}
      {claimDialog  && <ClaimDialog  slug={slug} lang={lang} primaryColor={c} onClose={() => setClaimDialog(false)}  />}
      {trackDialog  && <TrackDialog  slug={slug} lang={lang} primaryColor={c} onClose={() => setTrackDialog(false)}  />}
    </div>
  );
}
