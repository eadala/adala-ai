import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark, LayoutDashboard, Users, FileText, Building2,
  CalendarDays, TrendingDown, BarChart3, Bot,
  Plus, Loader2, AlertTriangle,
  Archive, Banknote, Brain, ChevronLeft,
  ChevronRight, Trash2, Eye, Pencil,
  Activity, Bell, TrendingUp, Sparkles, Shield, CheckCheck,
  GitBranch, ListTodo, BookOpen, AlertCircle, Package,
  CheckSquare, Circle, Clock, X, Check, RefreshCw,
  ChevronDown, Copy, Star, Zap, TriangleAlert,
  FilePlus2, ClipboardList, BarChart2, ArrowRightCircle,
  FileCheck2, ChevronUp, Upload, Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

/* ── API Helper ─────────────────────────────────────────── */
const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
async function api(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? r.statusText); }
  return r.json();
}

/* ── Types ──────────────────────────────────────────────── */
interface BkCase { id: string; case_number: string; debtor_name: string; debtor_type: string; procedure_type: string; court_name: string; trustee_name: string; status: string; start_date: string; creditor_count?: number; claim_count?: number; }
interface Creditor { id: string; name: string; type: string; email: string; phone: string; total_claims: number; claim_count: number; }
interface Claim { id: string; creditor_id: string; creditor_name: string; claim_number: string; amount: number; currency: string; priority_level: string; status: string; submitted_at: string; }
interface Asset { id: string; asset_name: string; asset_type: string; estimated_value: number; market_value: number; status: string; location: string; }
interface Meeting { id: string; title: string; meeting_date: string; location: string; meeting_type: string; status: string; }
interface Distribution { id: string; distribution_round: number; total_amount: number; distribution_date: string; status: string; item_count: number; }

/* ── Status helpers ─────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  // Case statuses
  active:             { label: "نشط",              color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  suspended:          { label: "موقوف",             color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  claims_review:      { label: "مراجعة المطالبات", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  asset_management:   { label: "إدارة الأصول",    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  distribution:       { label: "مرحلة التوزيع",   color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  closed:             { label: "مغلق",              color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  archived:           { label: "مؤرشف",             color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  // Claim statuses
  pending:            { label: "معلق",              color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  submitted:          { label: "مُقدَّم",           color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  under_review:       { label: "قيد المراجعة",     color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  approved:           { label: "مقبول",             color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  partially_approved: { label: "مقبول جزئياً",    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300" },
  rejected:           { label: "مرفوض",             color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  disputed:           { label: "متنازع عليه",      color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  finalized:          { label: "منتهي",             color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  // Asset statuses
  identified:         { label: "محدد",              color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  valuation:          { label: "قيد التقييم",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  listed:             { label: "مُدرج للبيع",       color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  sold:               { label: "مُباع",             color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  collected:          { label: "محصَّل",            color: "bg-emerald-200 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  // Distribution statuses
  draft:              { label: "مسودة",             color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
  executing:          { label: "قيد التنفيذ",      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  executed:           { label: "منفذ",              color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  // Meeting statuses
  scheduled:          { label: "مجدول",             color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  completed:          { label: "مكتمل",             color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled:          { label: "ملغي",              color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  // Payment
  paid:               { label: "مدفوع",             color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: "bg-zinc-100 text-zinc-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

/* ══════════════════════════════════════════════════════════
   SIDEBAR NAVIGATION
══════════════════════════════════════════════════════════ */
const SECTIONS: { id: string; label: string; icon: any; divider?: boolean }[] = [
  { id: "dashboard",        label: "لوحة التحكم",             icon: LayoutDashboard },
  { id: "opening_requests", label: "طلبات افتتاح الإجراءات",  icon: FilePlus2 },
  { id: "cases",            label: "ملفات الإفلاس",            icon: Landmark },
  { id: "creditors",     label: "الدائنون",            icon: Users },
  { id: "claims",        label: "المطالبات",           icon: FileText },
  { id: "assets",        label: "الأصول",              icon: Building2 },
  { id: "meetings",      label: "الاجتماعات",          icon: CalendarDays },
  { id: "distributions", label: "التوزيعات",           icon: TrendingDown },
  { id: "reports",       label: "التقارير",             icon: BarChart3 },
  { id: "ai",            label: "الذكاء الاصطناعي",    icon: Bot },
  { id: "workflow",      label: "سير العمل",            icon: GitBranch,    divider: true },
  { id: "tasks",         label: "إدارة المهام",         icon: ListTodo },
  { id: "templates",     label: "القوالب القانونية",    icon: BookOpen },
  { id: "alerts",        label: "التنبيهات",            icon: AlertCircle },
  { id: "court_package", label: "حزمة المحكمة",        icon: Package },
  { id: "executive",     label: "لوحة تنفيذية",        icon: TrendingUp,   divider: true },
  { id: "assistant",     label: "المساعد الذكي",        icon: Sparkles },
  { id: "timeline",      label: "السجل الزمني",        icon: Activity },
  { id: "notifications", label: "الإشعارات",           icon: Bell },
];

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export default function BankruptcyPage() {
  const [section, setSection] = useState("dashboard");
  const [selectedCase, setSelectedCase] = useState<BkCase | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: notifData } = useQuery({
    queryKey: ["bk-notifs-count"],
    queryFn: () => api("/bankruptcy/notifications?limit=1"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const unreadCount: number = (notifData as any)?.unreadCount ?? 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border/50 bg-card" dir="rtl">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-56" : "w-14"} flex-shrink-0 border-l border-border/50 bg-muted/30 flex flex-col transition-all duration-200`}>
        <div className="flex items-center gap-2 px-3 py-4 border-b border-border/50">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Landmark className="h-4 w-4 text-amber-600" />
          </div>
          {sidebarOpen && <span className="text-sm font-bold text-foreground">عدالة إفلاس</span>}
          <button onClick={() => setSidebarOpen(v => !v)} className="mr-auto text-muted-foreground hover:text-foreground">
            {sidebarOpen ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = section === s.id;
            const isNotif = s.id === "notifications";
            return (
              <div key={s.id}>
                {s.divider && <div className="mx-3 my-1.5 border-t border-border/40" />}
                <button onClick={() => setSection(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-all
                    ${active ? "bg-amber-500/10 text-amber-700 border-l-2 border-amber-500" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}>
                  <div className="relative shrink-0">
                    <Icon className="h-4 w-4" />
                    {isNotif && unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  {sidebarOpen && <span className="truncate flex-1 text-right">{s.label}</span>}
                  {sidebarOpen && isNotif && unreadCount > 0 && (
                    <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
        {sidebarOpen && selectedCase && (
          <div className="p-3 border-t border-border/50 bg-amber-50/50 dark:bg-amber-950/20">
            <p className="text-[10px] text-amber-600 font-bold mb-0.5">ملف محدد</p>
            <p className="text-xs font-semibold truncate">{selectedCase.debtor_name}</p>
            <p className="text-[10px] text-muted-foreground">{selectedCase.case_number}</p>
            <button onClick={() => setSelectedCase(null)} className="text-[10px] text-red-500 mt-1">إلغاء التحديد</button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        {section === "dashboard"        && <DashboardSection onSelectCase={(c) => { setSelectedCase(c); setSection("cases"); }} />}
        {section === "opening_requests" && <OpeningRequestsSection onConvert={(caseId) => { setSection("cases"); }} />}
        {section === "cases"            && <CasesSection selectedCase={selectedCase} onSelectCase={setSelectedCase} />}
        {section === "creditors"     && <CreditorsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "claims"        && <ClaimsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "assets"        && <AssetsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "meetings"      && <MeetingsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "distributions" && <DistributionsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "reports"       && <ReportsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "ai"            && <AISection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "workflow"      && <WorkflowSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "tasks"         && <TasksSection selectedCase={selectedCase} />}
        {section === "templates"     && <TemplatesSection selectedCase={selectedCase} />}
        {section === "alerts"        && <AlertsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "court_package" && <CourtPackageSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "executive"     && <ExecutiveDashboard />}
        {section === "assistant"     && <AIAssistantSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "timeline"      && <TimelineSection selectedCase={selectedCase} />}
        {section === "notifications" && <NotificationsSection />}
      </main>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   OPENING REQUESTS — V3
══════════════════════════════════════════════════════════ */
const STATUS_AR: Record<string, string> = {
  draft:                   "مسودة",
  under_assessment:        "تحت التقييم",
  documents_pending:       "في انتظار المستندات",
  ai_analysis:             "تحليل الذكاء الاصطناعي",
  ready_for_filing:        "جاهز للتقديم",
  under_legal_review:      "مراجعة قانونية",
  approved_for_submission: "معتمد للتقديم",
  submitted_to_court:      "مقدَّم للمحكمة",
  converted_to_case:       "تحوّل لملف إفلاس",
  closed:                  "مغلق",
  cancelled:               "ملغي",
};
const STATUS_COLOR: Record<string, string> = {
  draft:                   "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  under_assessment:        "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  documents_pending:       "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  ai_analysis:             "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  ready_for_filing:        "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  under_legal_review:      "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  approved_for_submission: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  submitted_to_court:      "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  converted_to_case:       "bg-emerald-600 text-white",
  closed:                  "bg-zinc-200 text-zinc-500",
  cancelled:               "bg-red-100 text-red-600",
};
const PROCEDURE_AR: Record<string, string> = {
  preventive_settlement:    "التسوية الوقائية",
  financial_reorganization: "إعادة التنظيم المالي",
  liquidation:              "التصفية",
  administrative_liquidation:"التصفية الإدارية",
  not_eligible:             "غير مؤهل",
};
const PROCEDURE_COLOR: Record<string, string> = {
  preventive_settlement:    "text-emerald-600",
  financial_reorganization: "text-blue-600",
  liquidation:              "text-red-600",
  administrative_liquidation:"text-orange-600",
  not_eligible:             "text-zinc-400",
};
const DOC_TYPES = [
  "القوائم المالية المدققة","كشف حساب بنكي","عقود القروض","عقود الموردين",
  "سجلات الموظفين","وثائق ضريبية","عقود الإيجار","أحكام قضائية",
  "صكوك التنفيذ","فواتير","مستندات داعمة","أخرى",
];

function OpeningRequestsSection({ onConvert }: { onConvert: (caseId: string) => void }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selected, setSelected] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"info" | "ai" | "docs" | "package">("info");
  const [statusFilter, setStatusFilter] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pkgLoading, setPkgLoading] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState({ document_type: "", file_name: "", notes: "" });

  const [form, setForm] = useState({
    company_name: "", commercial_registration: "", entity_type: "company",
    industry: "", employee_count: "", annual_revenue: "",
    total_assets: "", total_liabilities: "", available_cash: "", due_debts: "", notes: "",
  });

  /* ── Queries ── */
  const { data: requests = [], isLoading, refetch: refetchList } = useQuery<any[]>({
    queryKey: ["bk-opening-requests", statusFilter],
    queryFn: () => api(`/bankruptcy/opening-requests${statusFilter ? `?status=${statusFilter}` : ""}`),
    staleTime: 20_000,
  });

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ["bk-opening-req-detail", selected?.id],
    queryFn: () => api(`/bankruptcy/opening-requests/${selected!.id}`),
    enabled: !!selected?.id && view === "detail",
    staleTime: 10_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["bk-opening-stats"],
    queryFn: () => api("/bankruptcy/opening-requests-stats"),
    staleTime: 60_000,
  });

  /* ── Mutations ── */
  const createReq = useMutation({
    mutationFn: () => api("/bankruptcy/opening-requests", { method: "POST", body: JSON.stringify({
      ...form,
      employee_count: form.employee_count ? Number(form.employee_count) : undefined,
      annual_revenue: form.annual_revenue ? Number(form.annual_revenue) : undefined,
      total_assets: form.total_assets ? Number(form.total_assets) : undefined,
      total_liabilities: form.total_liabilities ? Number(form.total_liabilities) : undefined,
      available_cash: form.available_cash ? Number(form.available_cash) : undefined,
      due_debts: form.due_debts ? Number(form.due_debts) : undefined,
    })}),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["bk-opening-requests"] });
      qc.invalidateQueries({ queryKey: ["bk-opening-stats"] });
      toast.success("تم إنشاء الطلب");
      setSelected(r);
      setView("detail");
      setActiveTab("info");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/bankruptcy/opening-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bk-opening-req-detail", selected?.id] });
      qc.invalidateQueries({ queryKey: ["bk-opening-requests"] });
    },
  });

  const deleteReq = useMutation({
    mutationFn: (id: string) => api(`/bankruptcy/opening-requests/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bk-opening-requests"] });
      qc.invalidateQueries({ queryKey: ["bk-opening-stats"] });
      toast.success("تم حذف الطلب");
      setView("list");
      setSelected(null);
    },
  });

  const addDoc = useMutation({
    mutationFn: () => api(`/bankruptcy/opening-requests/${selected!.id}/documents`, {
      method: "POST", body: JSON.stringify(docForm),
    }),
    onSuccess: () => {
      refetchDetail();
      setShowDocForm(false);
      setDocForm({ document_type: "", file_name: "", notes: "" });
      toast.success("تم إضافة المستند");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delDoc = useMutation({
    mutationFn: (docId: string) =>
      api(`/bankruptcy/opening-requests/${selected!.id}/documents/${docId}`, { method: "DELETE" }),
    onSuccess: () => { refetchDetail(); toast.success("تم حذف المستند"); },
  });

  async function runAI() {
    if (!selected) return;
    setAiLoading(true);
    try {
      const r: any = await api(`/bankruptcy/opening-requests/${selected.id}/ai-analysis`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["bk-opening-req-detail", selected.id] });
      qc.invalidateQueries({ queryKey: ["bk-opening-requests"] });
      qc.invalidateQueries({ queryKey: ["bk-opening-stats"] });
      setActiveTab("ai");
      toast.success("اكتمل تحليل الذكاء الاصطناعي");
    } catch (e: any) { toast.error(e.message); }
    finally { setAiLoading(false); }
  }

  async function generatePackage() {
    if (!selected) return;
    setPkgLoading(true);
    try {
      await api(`/bankruptcy/opening-requests/${selected.id}/court-package`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["bk-opening-req-detail", selected.id] });
      setActiveTab("package");
      toast.success("تم توليد حزمة التقديم القضائي");
    } catch (e: any) { toast.error(e.message); }
    finally { setPkgLoading(false); }
  }

  async function convertToCase() {
    if (!selected) return;
    setConvertLoading(true);
    try {
      const r: any = await api(`/bankruptcy/opening-requests/${selected.id}/convert`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["bk-opening-req-detail", selected.id] });
      qc.invalidateQueries({ queryKey: ["bk-opening-requests"] });
      toast.success(`تم تحويل الطلب إلى ملف إفلاس — ${r.caseNumber}`);
      onConvert(r.caseId);
    } catch (e: any) { toast.error(e.message); }
    finally { setConvertLoading(false); }
  }

  const d: any = detail ?? selected ?? {};
  const ai: any = d.ai_analysis ?? {};
  const docs: any[] = d.documents ?? [];
  const readiness: any = d.readiness_details ?? {};

  /* ══════════════════════════════════════════════════════
     VIEW: CREATE FORM
  ══════════════════════════════════════════════════════ */
  if (view === "create") {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="h-5 w-5 rotate-90" />
          </button>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FilePlus2 className="h-5 w-5 text-blue-600" />طلب افتتاح إجراءات إفلاس جديد
            </h2>
            <p className="text-xs text-muted-foreground">أدخل بيانات الشركة والبيانات المالية</p>
          </div>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-semibold text-blue-600 flex items-center gap-2">
              <Briefcase className="h-4 w-4" />بيانات الشركة
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">اسم الشركة *</label>
                <Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} placeholder="الاسم القانوني الكامل" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">السجل التجاري</label>
                <Input value={form.commercial_registration} onChange={e => setForm(p => ({ ...p, commercial_registration: e.target.value }))} placeholder="رقم السجل التجاري" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">نوع الكيان</label>
                <select value={form.entity_type} onChange={e => setForm(p => ({ ...p, entity_type: e.target.value }))}
                  className="w-full text-sm border border-border/50 rounded-lg px-2 py-1.5 bg-background">
                  <option value="company">شركة ذات مسؤولية محدودة</option>
                  <option value="joint_stock">شركة مساهمة</option>
                  <option value="individual">مؤسسة فردية</option>
                  <option value="partnership">شركة تضامن</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">القطاع</label>
                <Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} placeholder="مثال: مقاولات، تجزئة، تصنيع" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">عدد الموظفين</label>
                <Input type="number" value={form.employee_count} onChange={e => setForm(p => ({ ...p, employee_count: e.target.value }))} placeholder="0" />
              </div>
            </div>

            <hr className="border-border/30" />
            <p className="text-sm font-semibold text-violet-600 flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />البيانات المالية (ريال سعودي)
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "total_assets",      label: "إجمالي الأصول" },
                { key: "total_liabilities", label: "إجمالي الخصوم" },
                { key: "available_cash",    label: "السيولة المتاحة" },
                { key: "annual_revenue",    label: "الإيرادات السنوية" },
                { key: "due_debts",         label: "الديون المستحقة فوراً" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                  <Input type="number" value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder="0.00" />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">ملاحظات</label>
                <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="اختياري" />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setView("list")}>إلغاء</Button>
              <Button onClick={() => createReq.mutate()} disabled={!form.company_name.trim() || createReq.isPending} className="gap-2">
                {createReq.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
                إنشاء الطلب
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════
     VIEW: DETAIL
  ══════════════════════════════════════════════════════ */
  if (view === "detail" && selected) {
    const readPct   = readiness.score ?? 0;
    const missingItems: string[] = readiness.missing ?? [];

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3 flex-wrap">
          <button onClick={() => { setView("list"); setSelected(null); }} className="text-muted-foreground hover:text-foreground mt-1">
            <ChevronDown className="h-5 w-5 rotate-90" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold">{d.company_name ?? selected.company_name}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[d.status ?? selected.status] ?? ""}`}>
                {STATUS_AR[d.status ?? selected.status] ?? d.status}
              </span>
              {d.procedure_recommendation && (
                <span className={`text-xs font-semibold ${PROCEDURE_COLOR[d.procedure_recommendation] ?? ""}`}>
                  ← {PROCEDURE_AR[d.procedure_recommendation] ?? d.procedure_recommendation}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{d.request_number ?? selected.request_number}</p>
          </div>

          {/* Readiness Badge */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold
              ${readPct >= 80 ? "border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20" :
                readPct >= 50 ? "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20" :
                "border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20"}`}>
              <FileCheck2 className="h-4 w-4" />
              {readPct}% جاهز للتقديم
            </div>
          </div>
        </div>

        {/* Readiness bar */}
        <div className="w-full bg-border/30 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all duration-700
            ${readPct >= 80 ? "bg-emerald-500" : readPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${readPct}%` }} />
        </div>
        {missingItems.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {missingItems.map((m, i) => (
              <span key={i} className="text-[10px] bg-red-50 dark:bg-red-950/20 text-red-600 border border-red-200 dark:border-red-800/40 px-2 py-0.5 rounded-full">
                ✗ {m}
              </span>
            ))}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={runAI} disabled={aiLoading || d.status === "ai_analysis"}>
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            تشغيل تحليل AI
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={generatePackage} disabled={pkgLoading}>
            {pkgLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
            توليد حزمة التقديم
          </Button>
          {(d.status === "approved_for_submission" || d.status === "ready_for_filing") && d.status !== "converted_to_case" && (
            <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={convertToCase} disabled={convertLoading}>
              {convertLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightCircle className="h-3.5 w-3.5" />}
              تحويل لملف إفلاس
            </Button>
          )}
          <select value={d.status ?? selected.status}
            onChange={e => patchStatus.mutate({ id: selected.id, status: e.target.value })}
            className="text-xs border border-border/50 rounded-lg px-2 py-1 bg-background">
            {Object.entries(STATUS_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1 flex-wrap">
          {([
            { id: "info",    label: "البيانات الأساسية", icon: ClipboardList },
            { id: "ai",      label: "تحليل AI",           icon: Sparkles },
            { id: "docs",    label: `المستندات (${docs.length})`, icon: FileText },
            { id: "package", label: "حزمة التقديم",       icon: Package },
          ] as any[]).map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all
                ${activeTab === t.id ? "bg-background shadow text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="h-3.5 w-3.5" />{t.label}
            </button>
          ))}
        </div>

        {/* TAB: INFO */}
        {activeTab === "info" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "السجل التجاري",      value: d.commercial_registration },
              { label: "نوع الكيان",         value: d.entity_type },
              { label: "القطاع",             value: d.industry },
              { label: "عدد الموظفين",        value: d.employee_count },
              { label: "إجمالي الأصول",      value: d.total_assets ? Number(d.total_assets).toLocaleString("ar-SA") + " ر.س" : null },
              { label: "إجمالي الخصوم",      value: d.total_liabilities ? Number(d.total_liabilities).toLocaleString("ar-SA") + " ر.س" : null },
              { label: "السيولة المتاحة",    value: d.available_cash ? Number(d.available_cash).toLocaleString("ar-SA") + " ر.س" : null },
              { label: "الإيرادات السنوية",   value: d.annual_revenue ? Number(d.annual_revenue).toLocaleString("ar-SA") + " ر.س" : null },
              { label: "الديون المستحقة",    value: d.due_debts ? Number(d.due_debts).toLocaleString("ar-SA") + " ر.س" : null },
            ].filter(f => f.value).map(f => (
              <Card key={f.label} className="border-border/50">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground">{f.label}</p>
                  <p className="text-sm font-semibold mt-0.5">{f.value}</p>
                </CardContent>
              </Card>
            ))}
            {d.notes && (
              <div className="col-span-full">
                <p className="text-xs text-muted-foreground">ملاحظات</p>
                <p className="text-sm mt-0.5">{d.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: AI ANALYSIS */}
        {activeTab === "ai" && (
          <div className="space-y-4">
            {!ai.eligibility_score ? (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center space-y-3">
                  <Sparkles className="h-12 w-12 mx-auto text-violet-200" />
                  <p className="text-muted-foreground">لم يتم تشغيل تحليل الذكاء الاصطناعي بعد</p>
                  <Button onClick={runAI} disabled={aiLoading} className="gap-2 bg-violet-600 hover:bg-violet-700">
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    تشغيل تحليل AI الآن
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Score cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { label: "الأهلية",        value: ai.eligibility_score,        color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
                    { label: "الضائقة المالية", value: ai.financial_distress_score, color: "text-red-600",     bg: "bg-red-50 dark:bg-red-950/20" },
                    { label: "مخاطر السيولة",  value: ai.liquidity_risk_score,     color: "text-orange-600",  bg: "bg-orange-50 dark:bg-orange-950/20" },
                    { label: "إمكانية الاسترداد",value:ai.recovery_potential_score,color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/20" },
                    { label: "مستوى الثقة",    value: ai.confidence_level,         color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-950/20" },
                  ].map(s => (
                    <Card key={s.label} className={`border-border/50 ${s.bg}`}>
                      <CardContent className="p-3 text-center">
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <div className="w-full bg-white/50 dark:bg-black/20 rounded-full h-1 mt-1">
                          <div className={`h-1 rounded-full ${s.color.replace("text-", "bg-")}`} style={{ width: `${s.value}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Recommendation */}
                <Card className={`border-2 ${d.procedure_recommendation === "not_eligible" ? "border-red-300 bg-red-50/40 dark:bg-red-950/10" : "border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10"}`}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">الإجراء الموصى به</p>
                    <p className={`text-xl font-black ${PROCEDURE_COLOR[d.procedure_recommendation ?? ""] ?? "text-foreground"}`}>
                      {PROCEDURE_AR[d.procedure_recommendation ?? ""] ?? d.procedure_recommendation}
                    </p>
                    {ai.procedure_reasoning && <p className="text-sm mt-2 text-muted-foreground leading-relaxed">{ai.procedure_reasoning}</p>}
                  </CardContent>
                </Card>

                {/* Assessment blocks */}
                {[
                  { title: "الملخص التنفيذي",       content: ai.executive_summary },
                  { title: "تقييم الصحة المالية",    content: ai.financial_health_assessment },
                  { title: "تقييم المخاطر",          content: ai.risk_assessment },
                  { title: "الملاحظات القانونية",    content: ai.legal_observations },
                ].filter(b => b.content).map(b => (
                  <Card key={b.title} className="border-border/50">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">{b.title}</p>
                      <p className="text-sm leading-relaxed">{b.content}</p>
                    </CardContent>
                  </Card>
                ))}

                {/* Lists */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { title: "الإجراءات الموصى بها", items: ai.recommended_actions,  color: "border-blue-200 bg-blue-50/40 dark:bg-blue-950/10" },
                    { title: "الإجراءات ذات الأولوية", items: ai.priority_actions,   color: "border-red-200 bg-red-50/40 dark:bg-red-950/10" },
                    { title: "المستندات المطلوبة",    items: ai.required_documents,  color: "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10" },
                  ].map(b => b.items?.length > 0 && (
                    <Card key={b.title} className={`border ${b.color}`}>
                      <CardContent className="p-3">
                        <p className="text-xs font-semibold mb-2">{b.title}</p>
                        <ul className="space-y-1">
                          {b.items.map((it: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <Check className="h-3 w-3 text-current mt-0.5 shrink-0" />{it}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {ai.missing_information?.length > 0 && (
                  <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/10">
                    <CardContent className="p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />معلومات ناقصة
                      </p>
                      <ul className="space-y-1">
                        {ai.missing_information.map((it: string, i: number) => (
                          <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                            <X className="h-3 w-3 mt-0.5 shrink-0" />{it}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB: DOCUMENTS */}
        {activeTab === "docs" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{docs.length} مستند مرفق</p>
              <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowDocForm(v => !v)}>
                <Upload className="h-3.5 w-3.5" />إضافة مستند
              </Button>
            </div>

            {showDocForm && (
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground mb-1 block">نوع المستند *</label>
                      <select value={docForm.document_type} onChange={e => setDocForm(p => ({ ...p, document_type: e.target.value }))}
                        className="w-full text-sm border border-border/50 rounded-lg px-2 py-1.5 bg-background">
                        <option value="">-- اختر النوع --</option>
                        {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">اسم الملف *</label>
                      <Input value={docForm.file_name} onChange={e => setDocForm(p => ({ ...p, file_name: e.target.value }))} placeholder="مثال: القوائم_المالية_2024.pdf" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">ملاحظات</label>
                      <Input value={docForm.notes} onChange={e => setDocForm(p => ({ ...p, notes: e.target.value }))} placeholder="اختياري" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setShowDocForm(false)}>إلغاء</Button>
                    <Button size="sm" onClick={() => addDoc.mutate()}
                      disabled={!docForm.document_type || !docForm.file_name.trim() || addDoc.isPending}>
                      {addDoc.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "إضافة"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {docs.length === 0 && !showDocForm && (
              <Card className="border-border/50">
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />لا توجد مستندات مرفقة
                </CardContent>
              </Card>
            )}
            <div className="space-y-2">
              {docs.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-accent/30">
                  <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground bg-muted rounded px-1.5">{doc.document_type}</span>
                      {doc.notes && <span className="text-[10px] text-muted-foreground">{doc.notes}</span>}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground shrink-0">{new Date(doc.uploaded_at).toLocaleDateString("ar-SA")}</p>
                  <button onClick={() => delDoc.mutate(doc.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: COURT PACKAGE */}
        {activeTab === "package" && (
          <div className="space-y-3">
            {!d.court_package_content ? (
              <Card className="border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/40 dark:bg-indigo-950/10">
                <CardContent className="py-12 text-center space-y-3">
                  <Package className="h-14 w-14 mx-auto text-indigo-200" />
                  <p className="font-semibold text-indigo-700 dark:text-indigo-300">لم تُولَّد حزمة التقديم بعد</p>
                  <p className="text-xs text-muted-foreground">تأكد من اكتمال تحليل AI أولاً للحصول على أفضل نتيجة</p>
                  <Button onClick={generatePackage} disabled={pkgLoading} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    {pkgLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                    توليد حزمة التقديم القضائي
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4 text-indigo-600" />حزمة التقديم القضائي
                    </p>
                    {d.court_package_generated_at && (
                      <p className="text-xs text-muted-foreground">تاريخ التوليد: {new Date(d.court_package_generated_at).toLocaleString("ar-SA")}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs gap-1.5"
                      onClick={() => { navigator.clipboard?.writeText(d.court_package_content); toast.success("تم النسخ"); }}>
                      <Copy className="h-3.5 w-3.5" />نسخ
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={generatePackage} disabled={pkgLoading}>
                      <RefreshCw className="h-3.5 w-3.5" />تحديث
                    </Button>
                  </div>
                </div>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="bg-muted/30 rounded-xl p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[65vh] overflow-y-auto font-mono" dir="rtl">
                      {d.court_package_content}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════
     VIEW: LIST
  ══════════════════════════════════════════════════════ */
  return (
    <div className="space-y-4">
      {/* Header + Stats */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-blue-600" />طلبات افتتاح إجراءات الإفلاس
          </h2>
          <p className="text-sm text-muted-foreground">{requests.length} طلب</p>
        </div>
        <Button className="gap-1.5" onClick={() => setView("create")}>
          <Plus className="h-4 w-4" />طلب جديد
        </Button>
      </div>

      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الطلبات",       value: (stats as any).total ?? 0,          color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-950/20" },
            { label: "جاهز للتقديم",          value: (stats as any).ready ?? 0,          color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/20" },
            { label: "مقدَّم للمحكمة",         value: (stats as any).submitted ?? 0,      color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/20" },
            { label: "تحوّل لملف إفلاس",      value: (stats as any).converted ?? 0,      color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-950/20" },
          ].map(k => (
            <Card key={k.label} className={`border-border/50 ${k.bg}`}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-2xl font-black ${k.color}`}>{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["", "draft","under_assessment","documents_pending","ai_analysis","ready_for_filing","under_legal_review","approved_for_submission","submitted_to_court","converted_to_case","closed","cancelled"] as string[]).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${statusFilter === s ? "bg-blue-600 text-white border-blue-600" : "border-border/50 hover:bg-accent"}`}>
            {s === "" ? "الكل" : STATUS_AR[s] ?? s}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>}
      {!isLoading && requests.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center space-y-3">
            <FilePlus2 className="h-14 w-14 mx-auto text-blue-100" />
            <p className="text-muted-foreground">لا توجد طلبات بعد</p>
            <Button onClick={() => setView("create")} className="gap-2">
              <Plus className="h-4 w-4" />إنشاء أول طلب
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="space-y-2">
        {requests.map((r: any) => {
          const readPct = r.readiness_score ?? 0;
          return (
            <Card key={r.id} className="border-border/50 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer"
              onClick={() => { setSelected(r); setView("detail"); setActiveTab("info"); }}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold
                    ${readPct >= 80 ? "bg-emerald-500" : readPct >= 50 ? "bg-amber-500" : "bg-blue-500"}`}>
                    {readPct}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{r.company_name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? ""}`}>
                        {STATUS_AR[r.status] ?? r.status}
                      </span>
                      {r.procedure_recommendation && (
                        <span className={`text-[10px] font-semibold ${PROCEDURE_COLOR[r.procedure_recommendation] ?? ""}`}>
                          {PROCEDURE_AR[r.procedure_recommendation]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-muted-foreground">
                      <span>{r.request_number}</span>
                      {r.commercial_registration && <span>س.ت: {r.commercial_registration}</span>}
                      {r.total_assets && <span>أصول: {Number(r.total_assets).toLocaleString("ar-SA")} ر.س</span>}
                      {r.eligibility_score != null && <span className="text-emerald-600 font-medium">أهلية: {r.eligibility_score}/100</span>}
                      <span className="mr-auto">{new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
                    </div>
                    {readPct > 0 && (
                      <div className="mt-2 w-full bg-border/30 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${readPct >= 80 ? "bg-emerald-500" : readPct >= 50 ? "bg-amber-500" : "bg-blue-500"}`}
                          style={{ width: `${readPct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={e => { e.stopPropagation(); deleteReq.mutate(r.id); }}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════ */
function DashboardSection({ onSelectCase }: { onSelectCase: (c: BkCase) => void }) {
  const { data: stats, isLoading } = useQuery({ queryKey: ["bk-dashboard"], queryFn: () => api("/bankruptcy/dashboard"), staleTime: 30_000 });
  const { data: cases = [] } = useQuery<BkCase[]>({ queryKey: ["bk-cases"], queryFn: () => api("/bankruptcy/cases"), staleTime: 30_000 });

  const kpis = [
    { label: "ملفات الإفلاس", value: stats?.totalCases ?? 0, icon: Landmark, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
    { label: "الدائنون",       value: stats?.totalCreditors ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { label: "المطالبات",      value: stats?.totalClaims ?? 0, icon: FileText, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
    { label: "إجمالي المطالبات", value: `${Number(stats?.totalClaimsAmount ?? 0).toLocaleString("ar-SA")} ر.س`, icon: Banknote, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
    { label: "إجمالي الأصول",  value: `${Number(stats?.totalAssetsValue ?? 0).toLocaleString("ar-SA")} ر.س`, icon: Building2, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-950/30" },
    { label: "اجتماعات قادمة", value: stats?.upcomingMeetings ?? 0, icon: CalendarDays, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/30" },
  ];

  if (isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Landmark className="h-5 w-5 text-amber-600" /> لوحة تحكم عدالة إفلاس</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة شاملة على ملفات الإفلاس وإجراءات إعادة التنظيم المالي</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className={`border-border/50 ${k.bg}`}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${k.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-5 w-5 ${k.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-xl font-bold">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Cases */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">آخر ملفات الإفلاس</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cases.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">لا توجد ملفات بعد — ابدأ بإنشاء ملف إفلاس جديد</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[500px]">
                <thead><tr className="border-b border-border/40 bg-muted/30">
                  <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">رقم الملف</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">المدين</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">نوع الإجراء</th>
                  <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">الحالة</th>
                  <th className="py-2.5 px-4"></th>
                </tr></thead>
                <tbody>
                  {cases.slice(0, 5).map(c => (
                    <tr key={c.id} className="border-b border-border/20 hover:bg-accent/30 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs">{c.case_number}</td>
                      <td className="py-2.5 px-4 font-medium">{c.debtor_name}</td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs">{PROC_TYPE_LABEL[c.procedure_type] ?? c.procedure_type}</td>
                      <td className="py-2.5 px-4"><StatusBadge status={c.status} /></td>
                      <td className="py-2.5 px-4">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => onSelectCase(c)}>
                          <Eye className="h-3 w-3" /> عرض
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Labels ── */
const PROC_TYPE_LABEL: Record<string, string> = {
  liquidation: "تصفية", reorganization: "إعادة تنظيم", protective_settlement: "تسوية وقائية", restructuring: "إعادة هيكلة",
};
const DEBTOR_TYPE_LABEL: Record<string, string> = { individual: "فرد", company: "شركة", partnership: "شراكة" };

/* ══════════════════════════════════════════════════════════
   CASES SECTION
══════════════════════════════════════════════════════════ */
function CasesSection({ selectedCase, onSelectCase }: { selectedCase: BkCase | null; onSelectCase: (c: BkCase) => void }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ case_number: "", debtor_name: "", debtor_type: "company", procedure_type: "liquidation", court_name: "", trustee_name: "", notes: "", start_date: "" });

  const { data: cases = [], isLoading } = useQuery<BkCase[]>({ queryKey: ["bk-cases"], queryFn: () => api("/bankruptcy/cases"), staleTime: 30_000 });

  const create = useMutation({
    mutationFn: (data: any) => api("/bankruptcy/cases", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-cases"] }); qc.invalidateQueries({ queryKey: ["bk-dashboard"] }); setShowForm(false); setForm({ case_number: "", debtor_name: "", debtor_type: "company", procedure_type: "liquidation", court_name: "", trustee_name: "", notes: "", start_date: "" }); toast.success("تم إنشاء ملف الإفلاس بنجاح"); },
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api(`/bankruptcy/cases/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-cases"] }); toast.success("تم أرشفة الملف"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Landmark className="h-5 w-5 text-amber-600" /> ملفات الإفلاس</h2>
          <p className="text-sm text-muted-foreground">{cases.length} ملف مسجل</p>
        </div>
        <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setShowForm(v => !v)}>
          <Plus className="h-3.5 w-3.5" /> ملف جديد
        </Button>
      </div>

      {showForm && (
        <Card className="border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="pb-3"><CardTitle className="text-sm">إنشاء ملف إفلاس جديد</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">رقم الملف *</Label><Input placeholder="BK-2025-001" value={form.case_number} onChange={e => setForm(f => ({ ...f, case_number: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">اسم المدين *</Label><Input placeholder="اسم الشركة أو الفرد" value={form.debtor_name} onChange={e => setForm(f => ({ ...f, debtor_name: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">نوع المدين</Label>
                <Select value={form.debtor_type} onValueChange={v => setForm(f => ({ ...f, debtor_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="company">شركة</SelectItem><SelectItem value="individual">فرد</SelectItem><SelectItem value="partnership">شراكة</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">نوع الإجراء</Label>
                <Select value={form.procedure_type} onValueChange={v => setForm(f => ({ ...f, procedure_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="liquidation">تصفية</SelectItem><SelectItem value="reorganization">إعادة تنظيم</SelectItem><SelectItem value="protective_settlement">تسوية وقائية</SelectItem><SelectItem value="restructuring">إعادة هيكلة</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">المحكمة</Label><Input placeholder="المحكمة التجارية" value={form.court_name} onChange={e => setForm(f => ({ ...f, court_name: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">أمين الإفلاس</Label><Input placeholder="اسم أمين الإفلاس" value={form.trustee_name} onChange={e => setForm(f => ({ ...f, trustee_name: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">تاريخ البدء</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label className="text-xs mb-1 block">ملاحظات</Label><Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => create.mutate(form)} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div> : (
        <Card className="border-border/50">
          <CardContent className="p-0">
            {cases.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm space-y-2">
                <Landmark className="h-8 w-8 mx-auto opacity-30" />
                <p>لا توجد ملفات إفلاس — أنشئ أول ملف الآن</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead><tr className="border-b border-border/40 bg-muted/30">
                    <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">رقم الملف</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">المدين</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">النوع</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">الإجراء</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">الدائنون</th>
                    <th className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">الحالة</th>
                    <th className="py-2.5 px-4 text-xs text-muted-foreground">إجراءات</th>
                  </tr></thead>
                  <tbody>
                    {cases.map(c => (
                      <tr key={c.id} className={`border-b border-border/20 hover:bg-accent/30 transition-colors ${selectedCase?.id === c.id ? "bg-amber-50/40 dark:bg-amber-950/10" : ""}`}>
                        <td className="py-2.5 px-4 font-mono text-xs">{c.case_number}</td>
                        <td className="py-2.5 px-4 font-medium">{c.debtor_name}</td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">{DEBTOR_TYPE_LABEL[c.debtor_type] ?? c.debtor_type}</td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">{PROC_TYPE_LABEL[c.procedure_type] ?? c.procedure_type}</td>
                        <td className="py-2.5 px-4 text-center">{c.creditor_count ?? 0}</td>
                        <td className="py-2.5 px-4"><StatusBadge status={c.status} /></td>
                        <td className="py-2.5 px-4 flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onSelectCase(c)}>
                            <Eye className="h-3 w-3" />{selectedCase?.id === c.id ? "محدد" : "تحديد"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-orange-500" onClick={() => archive.mutate(c.id)} disabled={archive.isPending}>
                            <Archive className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   NEED CASE BANNER
══════════════════════════════════════════════════════════ */
function NeedCaseBanner({ onGo }: { onGo: () => void }) {
  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
      <CardContent className="py-8 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
        <p className="text-sm font-medium">حدّد ملف إفلاس أولاً</p>
        <p className="text-xs text-muted-foreground">اختر ملفاً من قائمة ملفات الإفلاس لعرض بياناته</p>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5" onClick={onGo}>
          <Landmark className="h-3.5 w-3.5" /> اذهب إلى الملفات
        </Button>
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════
   CREDITORS
══════════════════════════════════════════════════════════ */
function CreditorsSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", type: "unsecured", email: "", phone: "", national_id: "", address: "" });

  const { data: creditors = [], isLoading } = useQuery<Creditor[]>({
    queryKey: ["bk-creditors", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/creditors`),
    enabled: !!selectedCase,
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (data: any) => api(`/bankruptcy/cases/${selectedCase!.id}/creditors`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-creditors", selectedCase?.id] }); setShowForm(false); setForm({ name: "", type: "unsecured", email: "", phone: "", national_id: "", address: "" }); toast.success("تم إضافة الدائن"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/bankruptcy/creditors/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-creditors", selectedCase?.id] }); toast.success("تم حذف الدائن"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!selectedCase) return <NeedCaseBanner onGo={onNeedCase} />;

  const CREDITOR_TYPES = [{ v: "secured", l: "دائن مضمون" }, { v: "unsecured", l: "دائن غير مضمون" }, { v: "preferred", l: "دائن مفضل" }, { v: "government", l: "حكومي" }];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" /> الدائنون</h2>
          <p className="text-sm text-muted-foreground">ملف: {selectedCase.debtor_name} ({selectedCase.case_number})</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5" /> دائن جديد</Button>
      </div>

      {showForm && (
        <Card className="border-blue-200 dark:border-blue-800/50 bg-blue-50/30">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">اسم الدائن *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم الشخص أو الجهة" /></div>
              <div><Label className="text-xs mb-1 block">نوع الدائن</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CREDITOR_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">رقم الجوال</Label><Input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">رقم الهوية / السجل</Label><Input value={form.national_id} onChange={e => setForm(f => ({ ...f, national_id: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">العنوان</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={() => create.mutate(form)} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <Card className="border-border/50">
          <CardContent className="p-0">
            {creditors.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm"><Users className="h-8 w-8 mx-auto opacity-30 mb-2" /><p>لا يوجد دائنون مسجلون</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[540px]">
                  <thead><tr className="border-b border-border/40 bg-muted/30">
                    {["اسم الدائن", "النوع", "المطالبات", "إجمالي المطالبات", ""].map(h => <th key={h} className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {creditors.map(c => (
                      <tr key={c.id} className="border-b border-border/20 hover:bg-accent/30">
                        <td className="py-2.5 px-4 font-medium">{c.name}</td>
                        <td className="py-2.5 px-4 text-xs">{CREDITOR_TYPES.find(t => t.v === c.type)?.l ?? c.type}</td>
                        <td className="py-2.5 px-4 text-center">{c.claim_count ?? 0}</td>
                        <td className="py-2.5 px-4 font-mono text-xs">{Number(c.total_claims ?? 0).toLocaleString("ar-SA")} ر.س</td>
                        <td className="py-2.5 px-4"><Button size="sm" variant="ghost" className="h-7 text-red-500" onClick={() => remove.mutate(c.id)}><Trash2 className="h-3 w-3" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CLAIMS
══════════════════════════════════════════════════════════ */
function ClaimsSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ creditor_id: "", claim_number: "", amount: "", currency: "SAR", priority_level: "unsecured", submitted_at: "", notes: "" });

  const { data: claims = [], isLoading } = useQuery<Claim[]>({
    queryKey: ["bk-claims", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/claims`),
    enabled: !!selectedCase, staleTime: 30_000,
  });
  const { data: creditors = [] } = useQuery<Creditor[]>({
    queryKey: ["bk-creditors", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/creditors`),
    enabled: !!selectedCase, staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (data: any) => api(`/bankruptcy/cases/${selectedCase!.id}/claims`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-claims", selectedCase?.id] }); qc.invalidateQueries({ queryKey: ["bk-dashboard"] }); setShowForm(false); setForm({ creditor_id: "", claim_number: "", amount: "", currency: "SAR", priority_level: "unsecured", submitted_at: "", notes: "" }); toast.success("تم إضافة المطالبة"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!selectedCase) return <NeedCaseBanner onGo={onNeedCase} />;
  const totalAmount = claims.reduce((s, c) => s + Number(c.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-violet-600" /> المطالبات</h2>
          <p className="text-sm text-muted-foreground">{claims.length} مطالبة · إجمالي: {totalAmount.toLocaleString("ar-SA")} ر.س</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5" /> مطالبة جديدة</Button>
      </div>

      {showForm && (
        <Card className="border-violet-200 bg-violet-50/30">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">الدائن *</Label>
                <Select value={form.creditor_id} onValueChange={v => setForm(f => ({ ...f, creditor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر الدائن" /></SelectTrigger>
                  <SelectContent>{creditors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">رقم المطالبة</Label><Input placeholder="CL-001" value={form.claim_number} onChange={e => setForm(f => ({ ...f, claim_number: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">المبلغ *</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">العملة</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="SAR">ريال سعودي</SelectItem><SelectItem value="USD">دولار</SelectItem><SelectItem value="EUR">يورو</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">الأولوية</Label>
                <Select value={form.priority_level} onValueChange={v => setForm(f => ({ ...f, priority_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="secured">مضمون</SelectItem><SelectItem value="preferred">مفضل</SelectItem><SelectItem value="unsecured">غير مضمون</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">تاريخ التقديم</Label><Input type="date" value={form.submitted_at} onChange={e => setForm(f => ({ ...f, submitted_at: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label className="text-xs mb-1 block">ملاحظات</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={() => create.mutate(form)} disabled={create.isPending || !form.creditor_id}>
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : claims.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm"><FileText className="h-8 w-8 mx-auto opacity-30 mb-2" /><p>لا توجد مطالبات</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[620px]">
                <thead><tr className="border-b border-border/40 bg-muted/30">
                  {["رقم المطالبة", "الدائن", "المبلغ", "العملة", "الأولوية", "الحالة", "تاريخ التقديم"].map(h => <th key={h} className="text-right py-2.5 px-4 font-semibold text-xs text-muted-foreground">{h}</th>)}
                </tr></thead>
                <tbody>
                  {claims.map(c => (
                    <tr key={c.id} className="border-b border-border/20 hover:bg-accent/30">
                      <td className="py-2.5 px-4 font-mono text-xs">{c.claim_number || "—"}</td>
                      <td className="py-2.5 px-4 font-medium">{c.creditor_name}</td>
                      <td className="py-2.5 px-4 font-mono text-xs text-emerald-700">{Number(c.amount).toLocaleString("ar-SA")}</td>
                      <td className="py-2.5 px-4 text-xs">{c.currency}</td>
                      <td className="py-2.5 px-4 text-xs">{c.priority_level}</td>
                      <td className="py-2.5 px-4"><StatusBadge status={c.status} /></td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">{c.submitted_at ? new Date(c.submitted_at).toLocaleDateString("ar-SA") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ASSETS
══════════════════════════════════════════════════════════ */
function AssetsSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ asset_name: "", asset_type: "real_estate", description: "", estimated_value: "", market_value: "", location: "" });

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["bk-assets", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/assets`),
    enabled: !!selectedCase, staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (data: any) => api(`/bankruptcy/cases/${selectedCase!.id}/assets`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-assets", selectedCase?.id] }); qc.invalidateQueries({ queryKey: ["bk-dashboard"] }); setShowForm(false); setForm({ asset_name: "", asset_type: "real_estate", description: "", estimated_value: "", market_value: "", location: "" }); toast.success("تم إضافة الأصل"); },
    onError: (e: any) => toast.error(e.message),
  });

  const ASSET_TYPES = [{ v: "real_estate", l: "عقار" }, { v: "vehicle", l: "مركبة" }, { v: "equipment", l: "معدات" }, { v: "inventory", l: "مخزون" }, { v: "cash", l: "نقد" }, { v: "receivables", l: "ذمم مدينة" }, { v: "intellectual", l: "ملكية فكرية" }, { v: "other", l: "أخرى" }];

  if (!selectedCase) return <NeedCaseBanner onGo={onNeedCase} />;
  const totalValue = assets.reduce((s, a) => s + Number(a.estimated_value), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Building2 className="h-5 w-5 text-pink-600" /> الأصول</h2>
          <p className="text-sm text-muted-foreground">{assets.length} أصل · القيمة التقديرية: {totalValue.toLocaleString("ar-SA")} ر.س</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5" /> أصل جديد</Button>
      </div>

      {showForm && (
        <Card className="border-pink-200 bg-pink-50/30">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">اسم الأصل *</Label><Input value={form.asset_name} onChange={e => setForm(f => ({ ...f, asset_name: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">نوع الأصل</Label>
                <Select value={form.asset_type} onValueChange={v => setForm(f => ({ ...f, asset_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ASSET_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">القيمة التقديرية (ر.س)</Label><Input type="number" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">القيمة السوقية (ر.س)</Label><Input type="number" value={form.market_value} onChange={e => setForm(f => ({ ...f, market_value: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">الموقع</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">الوصف</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={() => create.mutate(form)} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {isLoading ? <div className="col-span-3 flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        : assets.length === 0 ? (
          <div className="col-span-3 py-10 text-center text-muted-foreground text-sm"><Building2 className="h-8 w-8 mx-auto opacity-30 mb-2" /><p>لا توجد أصول مسجلة</p></div>
        ) : assets.map(a => (
          <Card key={a.id} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-sm">{a.asset_name}</p>
                <StatusBadge status={a.status} />
              </div>
              <p className="text-xs text-muted-foreground mb-3">{ASSET_TYPES.find(t => t.v === a.asset_type)?.l ?? a.asset_type}{a.location ? ` · ${a.location}` : ""}</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">القيمة التقديرية</span><span className="font-mono font-semibold">{Number(a.estimated_value).toLocaleString("ar-SA")} ر.س</span></div>
                {Number(a.market_value) > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">القيمة السوقية</span><span className="font-mono">{Number(a.market_value).toLocaleString("ar-SA")} ر.س</span></div>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MEETINGS
══════════════════════════════════════════════════════════ */
function MeetingsSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", meeting_date: "", location: "", meeting_type: "creditors" });

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["bk-meetings", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/meetings`),
    enabled: !!selectedCase, staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (data: any) => api(`/bankruptcy/cases/${selectedCase!.id}/meetings`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-meetings", selectedCase?.id] }); qc.invalidateQueries({ queryKey: ["bk-dashboard"] }); setShowForm(false); setForm({ title: "", meeting_date: "", location: "", meeting_type: "creditors" }); toast.success("تم جدولة الاجتماع"); },
    onError: (e: any) => toast.error(e.message),
  });

  const MEETING_TYPES = [{ v: "creditors", l: "اجتماع الدائنين" }, { v: "trustee", l: "اجتماع أمين الإفلاس" }, { v: "court", l: "جلسة قضائية" }, { v: "committee", l: "لجنة الدائنين" }];

  if (!selectedCase) return <NeedCaseBanner onGo={onNeedCase} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><CalendarDays className="h-5 w-5 text-cyan-600" /> الاجتماعات</h2>
          <p className="text-sm text-muted-foreground">{meetings.length} اجتماع</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5" /> اجتماع جديد</Button>
      </div>

      {showForm && (
        <Card className="border-cyan-200 bg-cyan-50/30">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Label className="text-xs mb-1 block">عنوان الاجتماع *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">نوع الاجتماع</Label>
                <Select value={form.meeting_type} onValueChange={v => setForm(f => ({ ...f, meeting_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MEETING_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">التاريخ والوقت</Label><Input type="datetime-local" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label className="text-xs mb-1 block">المكان</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={() => create.mutate(form)} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : meetings.length === 0 ? (
        <Card className="border-border/50"><CardContent className="py-10 text-center text-muted-foreground text-sm"><CalendarDays className="h-8 w-8 mx-auto opacity-30 mb-2" /><p>لا توجد اجتماعات مجدولة</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => (
            <Card key={m.id} className="border-border/50 hover:border-cyan-300 transition-colors">
              <CardContent className="py-3 px-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center shrink-0">
                  <CalendarDays className="h-4 w-4 text-cyan-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground">{MEETING_TYPES.find(t => t.v === m.meeting_type)?.l ?? m.meeting_type}{m.location ? ` · ${m.location}` : ""}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono">{m.meeting_date ? new Date(m.meeting_date).toLocaleDateString("ar-SA") : "—"}</p>
                  <StatusBadge status={m.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   DISTRIBUTIONS
══════════════════════════════════════════════════════════ */
function DistributionsSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ total_amount: "", distribution_round: "1", distribution_date: "", notes: "" });

  const { data: distributions = [], isLoading } = useQuery<Distribution[]>({
    queryKey: ["bk-distributions", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/distributions`),
    enabled: !!selectedCase, staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (data: any) => api(`/bankruptcy/cases/${selectedCase!.id}/distributions`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-distributions", selectedCase?.id] }); qc.invalidateQueries({ queryKey: ["bk-dashboard"] }); setShowForm(false); setForm({ total_amount: "", distribution_round: "1", distribution_date: "", notes: "" }); toast.success("تم إنشاء جولة التوزيع"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!selectedCase) return <NeedCaseBanner onGo={onNeedCase} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><TrendingDown className="h-5 w-5 text-emerald-600" /> التوزيعات</h2>
          <p className="text-sm text-muted-foreground">{distributions.length} جولة توزيع</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5" /> جولة جديدة</Button>
      </div>

      {showForm && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">إجمالي المبلغ *</Label><Input type="number" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">رقم الجولة</Label><Input type="number" min="1" value={form.distribution_round} onChange={e => setForm(f => ({ ...f, distribution_round: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">تاريخ التوزيع</Label><Input type="date" value={form.distribution_date} onChange={e => setForm(f => ({ ...f, distribution_date: e.target.value }))} /></div>
              <div><Label className="text-xs mb-1 block">ملاحظات</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={() => create.mutate(form)} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : distributions.length === 0 ? (
        <Card className="border-border/50"><CardContent className="py-10 text-center text-muted-foreground text-sm"><TrendingDown className="h-8 w-8 mx-auto opacity-30 mb-2" /><p>لا توجد جولات توزيع</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {distributions.map(d => (
            <Card key={d.id} className="border-border/50">
              <CardContent className="py-3 px-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                  <span className="text-emerald-700 font-black text-sm">#{d.distribution_round}</span>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">جولة التوزيع #{d.distribution_round}</p>
                  <p className="text-xs text-muted-foreground">{d.item_count ?? 0} مستفيد</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-sm">{Number(d.total_amount).toLocaleString("ar-SA")} ر.س</p>
                  <StatusBadge status={d.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   REPORTS
══════════════════════════════════════════════════════════ */
function ReportsSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ report_type: "progress", report_title: "", content: "" });

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["bk-reports", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/reports`),
    enabled: !!selectedCase, staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: (data: any) => api(`/bankruptcy/cases/${selectedCase!.id}/reports`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-reports", selectedCase?.id] }); setShowForm(false); setForm({ report_type: "progress", report_title: "", content: "" }); toast.success("تم إنشاء التقرير"); },
    onError: (e: any) => toast.error(e.message),
  });

  const REPORT_TYPES = [{ v: "progress", l: "تقرير تقدم" }, { v: "financial", l: "تقرير مالي" }, { v: "assets", l: "تقرير الأصول" }, { v: "claims", l: "تقرير المطالبات" }, { v: "final", l: "تقرير ختامي" }];

  if (!selectedCase) return <NeedCaseBanner onGo={onNeedCase} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-600" /> التقارير</h2>
          <p className="text-sm text-muted-foreground">{reports.length} تقرير</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(v => !v)}><Plus className="h-3.5 w-3.5" /> تقرير جديد</Button>
      </div>

      {showForm && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs mb-1 block">نوع التقرير</Label>
                <Select value={form.report_type} onValueChange={v => setForm(f => ({ ...f, report_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REPORT_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs mb-1 block">عنوان التقرير *</Label><Input value={form.report_title} onChange={e => setForm(f => ({ ...f, report_title: e.target.value }))} /></div>
              <div className="sm:col-span-2"><Label className="text-xs mb-1 block">المحتوى</Label><Textarea rows={4} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={() => create.mutate(form)} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : reports.length === 0 ? (
        <Card className="border-border/50"><CardContent className="py-10 text-center text-muted-foreground text-sm"><BarChart3 className="h-8 w-8 mx-auto opacity-30 mb-2" /><p>لا توجد تقارير</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <Card key={r.id} className="border-border/50 hover:border-indigo-300 transition-colors">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                  <BarChart3 className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{r.report_title}</p>
                  <p className="text-xs text-muted-foreground">{REPORT_TYPES.find(t => t.v === r.report_type)?.l ?? r.report_type}</p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleDateString("ar-SA")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   AI SECTION
══════════════════════════════════════════════════════════ */
function AISection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [analysisType, setAnalysisType] = useState("general");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["bk-ai-history", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/ai-history`),
    enabled: !!selectedCase, staleTime: 60_000,
  });

  async function runAnalysis() {
    if (!selectedCase || !prompt.trim()) return;
    setLoading(true); setResult("");
    try {
      const data = await api(`/bankruptcy/cases/${selectedCase.id}/ai-analysis`, {
        method: "POST",
        body: JSON.stringify({ analysis_type: analysisType, prompt }),
      });
      setResult(data.result ?? "");
      toast.success("اكتمل التحليل");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  const ANALYSIS_TYPES = [
    { v: "general", l: "تحليل عام" }, { v: "claims", l: "تحليل المطالبات" },
    { v: "assets", l: "تحليل الأصول" }, { v: "risk", l: "استخراج المخاطر" },
    { v: "financial", l: "تحليل مالي" }, { v: "summary", l: "ملخص الملف" },
  ];

  if (!selectedCase) return <NeedCaseBanner onGo={onNeedCase} />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Brain className="h-5 w-5 text-blue-600" /> الذكاء الاصطناعي — تحليل الإفلاس</h2>
        <p className="text-sm text-muted-foreground">ملف: {selectedCase.debtor_name} ({selectedCase.case_number})</p>
      </div>

      <Card className="border-blue-200 dark:border-blue-800/50">
        <CardContent className="pt-4 space-y-3">
          <div className="flex gap-2">
            <Select value={analysisType} onValueChange={setAnalysisType}>
              <SelectTrigger className="w-48 shrink-0"><SelectValue /></SelectTrigger>
              <SelectContent>{ANALYSIS_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Textarea
            rows={3}
            placeholder="اكتب سؤالك أو طلب التحليل هنا... مثال: ما هي نسبة استرداد الدائنين المتوقعة؟"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
          <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700" onClick={runAnalysis} disabled={loading || !prompt.trim()}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري التحليل…</> : <><Brain className="h-4 w-4" /> تشغيل التحليل</>}
          </Button>

          {result && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed border border-border/50 max-h-80 overflow-y-auto">
              {result}
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">سجل التحليلات السابقة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {history.slice(0, 5).map((h: any) => (
              <div key={h.id} className="p-3 rounded-lg bg-muted/30 border border-border/30 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">{ANALYSIS_TYPES.find(t => t.v === h.analysis_type)?.l ?? h.analysis_type}</Badge>
                  <span className="text-muted-foreground">{new Date(h.generated_at).toLocaleDateString("ar-SA")}</span>
                </div>
                <p className="text-muted-foreground line-clamp-2">{h.result}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SVG MINI CHARTS
══════════════════════════════════════════════════════════ */
const CHART_COLORS = ["#f59e0b","#3b82f6","#10b981","#ef4444","#8b5cf6","#06b6d4","#f97316","#84cc16"];

function MiniPieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="text-center text-muted-foreground text-xs py-4">لا توجد بيانات</div>;
  let cAngle = -90;
  function toXY(r: number, a: number) {
    return { x: 50 + r * Math.cos(a * Math.PI / 180), y: 50 + r * Math.sin(a * Math.PI / 180) };
  }
  function arc(a1: number, a2: number) {
    const s = toXY(45, a1); const e = toXY(45, a2);
    return `M50,50 L${s.x},${s.y} A45,45 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${e.x},${e.y} Z`;
  }
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
        {data.map((d, i) => {
          const sweep = (d.value / total) * 360;
          const path = arc(cAngle, cAngle + sweep);
          cAngle += sweep;
          return <path key={i} d={path} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity="0.9" />;
        })}
        <circle cx="50" cy="50" r="22" fill="white" className="dark:fill-card" />
        <text x="50" y="55" textAnchor="middle" fontSize="11" fill="#6b7280">{total}</text>
      </svg>
      <div className="space-y-1 text-xs w-full">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="text-muted-foreground flex-1">{d.label}</span>
            <span className="font-bold">{d.value}</span>
            <span className="text-muted-foreground w-8 text-left">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color = "bg-amber-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className="space-y-1">
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{pct}%</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   EXECUTIVE DASHBOARD (Phase 4)
══════════════════════════════════════════════════════════ */
function ExecutiveDashboard() {
  const { data: d, isLoading } = useQuery({
    queryKey: ["bk-executive"],
    queryFn: () => api("/bankruptcy/executive-dashboard"),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
    </div>
  );

  const claimLabels: Record<string, string> = { pending:"معلق", submitted:"مُقدَّم", under_review:"مراجعة", approved:"مقبول", partially_approved:"مقبول جزئياً", rejected:"مرفوض", disputed:"متنازع", finalized:"منتهي" };
  const assetLabels: Record<string, string>  = { real_estate:"عقار", vehicle:"مركبة", equipment:"معدات", inventory:"مخزون", cash:"نقد", receivables:"ذمم", intellectual:"ملكية فكرية", other:"أخرى" };

  const claimPie = ((d as any)?.claimsByStatus ?? []).map((r: any) => ({ label: claimLabels[r.status] ?? r.status, value: Number(r.cnt) }));
  const assetPie = ((d as any)?.assetsByType ?? []).map((r: any) => ({ label: assetLabels[r.asset_type] ?? r.asset_type, value: Number(r.cnt) }));

  const kpis = [
    { label:"إجمالي الملفات",     value:(d as any)?.totalCases ?? 0,         color:"text-amber-600",   bg:"bg-amber-50 dark:bg-amber-950/30" },
    { label:"ملفات نشطة",         value:(d as any)?.activeCases ?? 0,         color:"text-blue-600",    bg:"bg-blue-50 dark:bg-blue-950/30" },
    { label:"ملفات مغلقة",         value:(d as any)?.closedCases ?? 0,         color:"text-emerald-600", bg:"bg-emerald-50 dark:bg-emerald-950/30" },
    { label:"إجمالي المطالبات",   value:(d as any)?.totalClaims ?? 0,         color:"text-violet-600",  bg:"bg-violet-50 dark:bg-violet-950/30" },
    { label:"قيمة المطالبات ر.س", value:Number((d as any)?.totalClaimsAmount ?? 0).toLocaleString("ar-SA"), color:"text-rose-600", bg:"bg-rose-50 dark:bg-rose-950/30" },
    { label:"قيمة الأصول ر.س",    value:Number((d as any)?.totalAssetsValue ?? 0).toLocaleString("ar-SA"),  color:"text-cyan-600",  bg:"bg-cyan-50 dark:bg-cyan-950/30" },
    { label:"تم توزيعه ر.س",      value:Number((d as any)?.totalDistributed ?? 0).toLocaleString("ar-SA"), color:"text-teal-600",  bg:"bg-teal-50 dark:bg-teal-950/30" },
    { label:"أحداث السجل الزمني", value:(d as any)?.timelineEvents ?? 0,       color:"text-indigo-600", bg:"bg-indigo-50 dark:bg-indigo-950/30" },
  ];

  const monthly: any[] = (d as any)?.monthlyActivity ?? [];
  const maxMo = Math.max(...monthly.map((m: any) => Number(m.cnt)), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-amber-600" /> اللوحة التنفيذية</h1>
        <p className="text-sm text-muted-foreground mt-0.5">مؤشرات الأداء الرئيسية لجميع ملفات الإفلاس</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label} className={`border-border/50 ${k.bg}`}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
              <p className={`text-lg font-bold ${k.color}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:"نسبة الاسترداد",          val:(d as any)?.recoveryRate ?? 0,         color:"text-emerald-600", bar:"bg-emerald-500", sub:"من إجمالي المطالبات" },
          { label:"نسبة التوزيع",            val:(d as any)?.distributionRate ?? 0,      color:"text-blue-600",    bar:"bg-blue-500",    sub:"من المطالبات المقبولة" },
          { label:"معدل إغلاق الملفات",      val:(d as any)?.caseCompletionRate ?? 0,   color:"text-amber-600",   bar:"bg-amber-500",   sub:"من إجمالي الملفات" },
        ].map(m => (
          <Card key={m.label} className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">{m.label}</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold mb-2 ${m.color}`}>{m.val}%</p>
              <ProgressBar value={m.val} max={100} color={m.bar} />
              <p className="text-xs text-muted-foreground mt-2">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">المطالبات حسب الحالة</CardTitle></CardHeader>
          <CardContent><MiniPieChart data={claimPie} /></CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">الأصول حسب الفئة</CardTitle></CardHeader>
          <CardContent><MiniPieChart data={assetPie} /></CardContent>
        </Card>
      </div>

      {monthly.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">النشاط الشهري (آخر 6 أشهر)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1.5 h-20">
              {monthly.map((m: any, i: number) => {
                const h = Math.max(8, Math.round((Number(m.cnt) / maxMo) * 72));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="w-full bg-amber-400 dark:bg-amber-600 rounded-t" style={{ height: `${h}px` }} title={`${m.cnt} ملفات`} />
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center">{String(m.month ?? "").slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   AI ASSISTANT QUICK ACTIONS (Phase 5)
══════════════════════════════════════════════════════════ */
const QUICK_ACTIONS = [
  { id:"analyze_claims",     label:"تحليل المطالبات",        Icon:FileText,      color:"bg-violet-50 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/20 dark:border-violet-800/40" },
  { id:"financial_analysis", label:"تحليل القوائم المالية",  Icon:Banknote,      color:"bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-800/40" },
  { id:"trustee_report",     label:"تقرير أمين الإفلاس",     Icon:BarChart3,     color:"bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/20 dark:border-blue-800/40" },
  { id:"meeting_minutes",    label:"محضر الاجتماع",           Icon:CalendarDays,  color:"bg-cyan-50 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-950/20 dark:border-cyan-800/40" },
  { id:"case_summary",       label:"ملخص الملف",              Icon:Archive,       color:"bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/20 dark:border-amber-800/40" },
  { id:"legal_risks",        label:"المخاطر القانونية",       Icon:Shield,        color:"bg-red-50 border-red-200 hover:bg-red-100 dark:bg-red-950/20 dark:border-red-800/40" },
  { id:"financial_risks",    label:"المخاطر المالية",         Icon:AlertTriangle, color:"bg-orange-50 border-orange-200 hover:bg-orange-100 dark:bg-orange-950/20 dark:border-orange-800/40" },
  { id:"recommendations",    label:"التوصيات الاستراتيجية",   Icon:Sparkles,      color:"bg-pink-50 border-pink-200 hover:bg-pink-100 dark:bg-pink-950/20 dark:border-pink-800/40" },
];

function AIAssistantSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const [result, setResult] = useState("");
  const [runningAction, setRunningAction] = useState("");
  const qc = useQueryClient();

  const { data: aiHistory = [] } = useQuery<any[]>({
    queryKey: ["bk-ai-hist", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/ai-analysis`),
    enabled: !!selectedCase, staleTime: 60_000,
  });

  async function runAction(actionId: string) {
    if (!selectedCase) return;
    setRunningAction(actionId); setResult("");
    try {
      const data = await api(`/bankruptcy/cases/${selectedCase.id}/ai-assistant`, {
        method: "POST", body: JSON.stringify({ action: actionId }),
      });
      setResult((data as any).result ?? "");
      qc.invalidateQueries({ queryKey: ["bk-ai-hist", selectedCase.id] });
      toast.success("اكتمل التحليل");
    } catch (e: any) { toast.error(e.message); }
    finally { setRunningAction(""); }
  }

  if (!selectedCase) return <NeedCaseBanner onGo={onNeedCase} />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" /> المساعد الذكي — إجراءات سريعة</h2>
        <p className="text-sm text-muted-foreground">ملف: {selectedCase.debtor_name} ({selectedCase.case_number})</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map(({ id, label, Icon, color }) => {
          const isRunning = runningAction === id;
          return (
            <button key={id} onClick={() => runAction(id)} disabled={!!runningAction}
              className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border text-sm font-medium transition-all disabled:opacity-50 cursor-pointer ${color}`}>
              {isRunning ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
              <span className="text-xs text-center leading-tight">{label}</span>
            </button>
          );
        })}
      </div>

      {result && (
        <Card className="border-violet-200 dark:border-violet-800/40">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1.5"><Brain className="h-4 w-4 text-violet-600" /> نتيجة التحليل</CardTitle>
            <button onClick={() => setResult("")} className="text-xs text-muted-foreground hover:text-foreground">مسح</button>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed border border-border/50 max-h-96 overflow-y-auto">
              {result}
            </div>
          </CardContent>
        </Card>
      )}

      {aiHistory.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">سجل التحليلات السابقة</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {aiHistory.slice(0, 8).map((h: any) => (
              <div key={h.id} className="p-3 rounded-lg bg-muted/30 border border-border/30 text-xs cursor-pointer hover:bg-muted/50"
                onClick={() => setResult(h.result)}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px]">{h.analysis_type}</Badge>
                  <span className="text-muted-foreground mr-auto">{new Date(h.generated_at).toLocaleDateString("ar-SA")}</span>
                </div>
                <p className="text-muted-foreground line-clamp-2">{String(h.result ?? "").slice(0, 120)}…</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TIMELINE SECTION (Phase 1)
══════════════════════════════════════════════════════════ */
const TL_ICONS: Record<string, { Icon: any; color: string }> = {
  case_created:          { Icon:Landmark,     color:"text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
  creditor_added:        { Icon:Users,         color:"text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  claim_submitted:       { Icon:FileText,      color:"text-violet-600 bg-violet-50 dark:bg-violet-950/30" },
  claim_approved:        { Icon:CheckCheck,    color:"text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
  claim_rejected:        { Icon:AlertTriangle, color:"text-red-600 bg-red-50 dark:bg-red-950/30" },
  asset_created:         { Icon:Building2,     color:"text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30" },
  meeting_scheduled:     { Icon:CalendarDays,  color:"text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" },
  distribution_approved: { Icon:TrendingDown,  color:"text-teal-600 bg-teal-50 dark:bg-teal-950/30" },
  distribution_executed: { Icon:Banknote,      color:"text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
  report_generated:      { Icon:BarChart3,     color:"text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" },
  ai_assistant_executed: { Icon:Sparkles,      color:"text-pink-600 bg-pink-50 dark:bg-pink-950/30" },
};

function TimelineSection({ selectedCase }: { selectedCase: BkCase | null }) {
  const url = selectedCase
    ? `/bankruptcy/cases/${selectedCase.id}/timeline`
    : "/bankruptcy/timeline";

  const { data: events = [], isLoading } = useQuery<any[]>({
    queryKey: ["bk-timeline", selectedCase?.id ?? "all"],
    queryFn: () => api(url),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-600" /> السجل الزمني</h2>
        <p className="text-sm text-muted-foreground">
          {selectedCase ? `ملف: ${selectedCase.debtor_name}` : "جميع ملفات المكتب"} — {events.length} حدث
        </p>
      </div>

      {isLoading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>}

      {!isLoading && events.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            لا توجد أحداث مسجلة — ستظهر هنا جميع الإجراءات تلقائياً
          </CardContent>
        </Card>
      )}

      {events.length > 0 && (
        <div className="relative">
          <div className="absolute right-5 top-0 bottom-0 w-0.5 bg-border/40" />
          <div className="space-y-3">
            {events.map((e: any) => {
              const meta = TL_ICONS[e.action_type] ?? { Icon: Activity, color: "text-muted-foreground bg-muted" };
              const Icon = meta.Icon;
              return (
                <div key={e.id} className="flex items-start gap-3 pr-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10 ${meta.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 bg-card border border-border/50 rounded-lg p-3 min-w-0">
                    <p className="text-sm font-medium">{e.description}</p>
                    {!selectedCase && e.debtor_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{e.debtor_name} — {e.case_number}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(e.created_at).toLocaleString("ar-SA")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   WORKFLOW SECTION (V2 Phase 1)
══════════════════════════════════════════════════════════ */
function WorkflowSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const qc = useQueryClient();
  const [initLoading, setInitLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["bk-workflow", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/workflow`),
    enabled: !!selectedCase,
    staleTime: 30_000,
  });

  const { data: widgetData = [] } = useQuery<any[]>({
    queryKey: ["bk-workflow-widget"],
    queryFn: () => api("/bankruptcy/workflow-widget"),
    staleTime: 30_000,
    enabled: !selectedCase,
  });

  const updateStep = useMutation({
    mutationFn: ({ stepId, status }: { stepId: string; status: string }) =>
      api(`/bankruptcy/workflow-steps/${stepId}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-workflow", selectedCase?.id] }); toast.success("تم تحديث الخطوة"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function initWorkflow() {
    if (!selectedCase) return;
    setInitLoading(true);
    try {
      await api(`/bankruptcy/cases/${selectedCase.id}/workflow`, { method: "POST" });
      toast.success("تم تهيئة سير العمل بنجاح");
      refetch();
    } catch (e: any) { toast.error(e.message); }
    finally { setInitLoading(false); }
  }

  const STEP_COLORS: Record<string, string> = {
    pending:     "border-border/50 bg-card",
    in_progress: "border-blue-300 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/20",
    completed:   "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/20",
    blocked:     "border-red-300 bg-red-50/60 dark:border-red-700 dark:bg-red-950/20",
    skipped:     "border-zinc-200 bg-zinc-50/60 opacity-60",
  };
  const STEP_ICON: Record<string, any> = {
    pending:     Circle,
    in_progress: Clock,
    completed:   CheckSquare,
    blocked:     X,
    skipped:     ChevronDown,
  };

  if (!selectedCase) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><GitBranch className="h-5 w-5 text-blue-600" /> سير العمل — نظرة عامة</h2>
          <p className="text-sm text-muted-foreground">جميع ملفات الإفلاس النشطة</p>
        </div>
        {widgetData.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              <GitBranch className="h-10 w-10 mx-auto mb-3 opacity-20" />
              لا توجد ملفات نشطة. حدد ملفاً لتهيئة سير العمل.
            </CardContent>
          </Card>
        )}
        <div className="space-y-3">
          {widgetData.map((w: any) => (
            <Card key={w.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">{w.debtor_name}</p>
                    <p className="text-xs text-muted-foreground">{w.case_number}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{w.completionPct}% مكتمل</Badge>
                </div>
                <div className="w-full bg-border/30 rounded-full h-2 mb-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${w.completionPct}%` }} />
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {w.current_label && <span>📍 {w.current_label}</span>}
                  {Number(w.blocked) > 0 && <span className="text-red-500">⛔ {w.blocked} محظور</span>}
                  {Number(w.overdue) > 0 && <span className="text-orange-500">⚠️ {w.overdue} متأخر</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>;

  const workflow  = (data as any)?.workflow;
  const steps: any[] = (data as any)?.steps ?? [];
  const pct: number  = (data as any)?.completionPct ?? 0;

  if (!workflow) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><GitBranch className="h-5 w-5 text-blue-600" /> سير العمل — {selectedCase.debtor_name}</h2>
        <Card className="border-border/50">
          <CardContent className="py-12 text-center space-y-4">
            <GitBranch className="h-14 w-14 mx-auto text-blue-200" />
            <p className="text-muted-foreground">لم يُهيَّأ سير العمل لهذا الملف بعد</p>
            <Button onClick={initWorkflow} disabled={initLoading} className="gap-2">
              {initLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              تهيئة سير العمل (١٢ خطوة)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><GitBranch className="h-5 w-5 text-blue-600" /> سير العمل</h2>
          <p className="text-sm text-muted-foreground">{selectedCase.debtor_name} — {pct}% مكتمل</p>
        </div>
        <Badge className={pct === 100 ? "bg-emerald-500" : "bg-blue-500"}>{pct}%</Badge>
      </div>

      <div className="w-full bg-border/30 rounded-full h-3">
        <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-2">
        {steps.map((step: any, idx: number) => {
          const StatusIcon = STEP_ICON[step.status] ?? Circle;
          return (
            <div key={step.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${STEP_COLORS[step.status] ?? STEP_COLORS.pending}`}>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${step.status === 'completed' ? 'bg-emerald-500 text-white' :
                    step.status === 'in_progress' ? 'bg-blue-500 text-white' :
                    step.status === 'blocked' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                  {step.status === 'completed' ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                {idx < steps.length - 1 && <div className="w-0.5 h-3 bg-border/40" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">{step.step_label}</p>
                  <StatusIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {step.due_date && <span className="text-xs text-muted-foreground">📅 {new Date(step.due_date).toLocaleDateString("ar-SA")}</span>}
                </div>
                {step.notes && <p className="text-xs text-muted-foreground mt-0.5">{step.notes}</p>}
                {step.required_docs?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">📎 {step.required_docs.join("، ")}</p>
                )}
              </div>
              {step.status !== 'completed' && step.status !== 'skipped' && (
                <div className="flex gap-1.5 shrink-0">
                  {step.status === 'pending' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                      onClick={() => updateStep.mutate({ stepId: step.id, status: 'in_progress' })}>
                      ابدأ
                    </Button>
                  )}
                  {step.status === 'in_progress' && (
                    <Button size="sm" className="h-7 text-xs px-2 bg-emerald-500 hover:bg-emerald-600"
                      onClick={() => updateStep.mutate({ stepId: step.id, status: 'completed' })}>
                      <Check className="h-3.5 w-3.5 ml-1" /> أكمل
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TASKS SECTION (V2 Phase 4)
══════════════════════════════════════════════════════════ */
function TasksSection({ selectedCase }: { selectedCase: BkCase | null }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", due_date: "" });
  const [filterStatus, setFilterStatus] = useState<string>("");

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["bk-tasks", selectedCase?.id, filterStatus],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (selectedCase) qs.set("case_id", selectedCase.id);
      if (filterStatus) qs.set("status", filterStatus);
      return api(`/bankruptcy/tasks?${qs}`);
    },
    staleTime: 20_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["bk-tasks-stats"],
    queryFn: () => api("/bankruptcy/tasks/stats"),
    staleTime: 60_000,
  });

  const createTask = useMutation({
    mutationFn: () => api("/bankruptcy/tasks", { method: "POST", body: JSON.stringify({
      ...form, case_id: selectedCase?.id ?? undefined,
    })}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-tasks"] }); qc.invalidateQueries({ queryKey: ["bk-tasks-stats"] }); setShowForm(false); setForm({ title: "", description: "", priority: "medium", due_date: "" }); toast.success("تم إنشاء المهمة"); },
    onError: (e: any) => toast.error(e.message),
  });

  const patchTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/bankruptcy/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-tasks"] }); qc.invalidateQueries({ queryKey: ["bk-tasks-stats"] }); },
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api(`/bankruptcy/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-tasks"] }); toast.success("تم حذف المهمة"); },
  });

  const autoGenerate = useMutation({
    mutationFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/auto-tasks`, { method: "POST" }),
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ["bk-tasks"] }); toast.success(`تم إنشاء ${(d as any).created} مهمة تلقائية`); },
    onError: (e: any) => toast.error(e.message),
  });

  const PRIORITY_COLOR: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300",
    high:     "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
    medium:   "bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    low:      "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  const PRIORITY_LABEL: Record<string, string> = { critical:"حرج", high:"مرتفع", medium:"متوسط", low:"منخفض" };
  const STATUS_COLOR: Record<string, string> = {
    pending:     "text-amber-600",
    in_progress: "text-blue-600",
    completed:   "text-emerald-600",
    cancelled:   "text-zinc-400",
    overdue:     "text-red-600",
  };
  const STATUS_LABEL: Record<string, string> = { pending:"معلق", in_progress:"جارٍ", completed:"مكتمل", cancelled:"ملغي", overdue:"متأخر" };

  const overdueCount = (stats as any)?.overdueCount ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-violet-600" />
            إدارة المهام
            {overdueCount > 0 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{overdueCount} متأخرة</span>}
          </h2>
          <p className="text-sm text-muted-foreground">{selectedCase ? selectedCase.debtor_name : "جميع الملفات"}</p>
        </div>
        <div className="flex gap-2">
          {selectedCase && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs"
              onClick={() => autoGenerate.mutate()} disabled={autoGenerate.isPending}>
              {autoGenerate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              توليد تلقائي
            </Button>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowForm(v => !v)}>
            <Plus className="h-3.5 w-3.5" /> مهمة جديدة
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["","pending","in_progress","completed","overdue"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${filterStatus === s ? "bg-violet-600 text-white border-violet-600" : "border-border/50 hover:bg-accent"}`}>
            {s === "" ? "الكل" : STATUS_LABEL[s] ?? s}
          </button>
        ))}
      </div>

      {showForm && (
        <Card className="border-violet-200 dark:border-violet-800/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm">مهمة جديدة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="عنوان المهمة *" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            <Input placeholder="الوصف (اختياري)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className="w-full text-sm border border-border/50 rounded-lg px-2 py-1.5 bg-background">
                <option value="low">منخفض</option>
                <option value="medium">متوسط</option>
                <option value="high">مرتفع</option>
                <option value="critical">حرج</option>
              </select>
              <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
              <Button size="sm" onClick={() => createTask.mutate()} disabled={!form.title.trim() || createTask.isPending}>
                {createTask.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></div>}

      {!isLoading && tasks.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <ListTodo className="h-10 w-10 mx-auto mb-3 opacity-20" />
            لا توجد مهام
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {tasks.map((t: any) => (
          <div key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all
            ${t.status === 'completed' ? 'opacity-60 bg-card border-border/30' : 'bg-card border-border/50 hover:border-violet-200'}`}>
            <button onClick={() => patchTask.mutate({ id: t.id, status: t.status === 'completed' ? 'pending' : 'completed' })}
              className={`h-5 w-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-all
                ${t.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border/50 hover:border-emerald-400'}`}>
              {t.status === 'completed' && <Check className="h-3 w-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={`text-sm font-medium ${t.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{t.title}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[t.priority] ?? PRIORITY_COLOR.medium}`}>{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                {t.status !== 'completed' && <span className={`text-xs font-medium ${STATUS_COLOR[t.status] ?? ''}`}>{STATUS_LABEL[t.status] ?? t.status}</span>}
              </div>
              {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {!selectedCase && t.debtor_name && <span className="text-xs text-muted-foreground">{t.debtor_name}</span>}
                {t.due_date && <span className={`text-xs flex items-center gap-1 ${new Date(t.due_date) < new Date() && t.status !== 'completed' ? 'text-red-500' : 'text-muted-foreground'}`}><Clock className="h-3 w-3" />{new Date(t.due_date).toLocaleDateString("ar-SA")}</span>}
                {t.task_type === 'auto' && <span className="text-[10px] text-blue-500">⚡ تلقائي</span>}
                {t.task_type === 'ai_suggested' && <span className="text-[10px] text-violet-500">🤖 AI</span>}
              </div>
            </div>
            <button onClick={() => deleteTask.mutate(t.id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TEMPLATES SECTION (V2 Phase 5)
══════════════════════════════════════════════════════════ */
const TEMPLATE_TYPES = [
  { value: "opening_petition",    label: "عريضة الإفلاس" },
  { value: "trustee_report",      label: "تقرير أمين الإفلاس" },
  { value: "meeting_minutes",     label: "محضر الاجتماع" },
  { value: "distribution_report", label: "تقرير التوزيع" },
  { value: "claim_review",        label: "تقرير مراجعة المطالبات" },
  { value: "asset_evaluation",    label: "تقرير تقييم الأصول" },
  { value: "court_correspondence","label": "مراسلة المحكمة" },
  { value: "executive_summary",   label: "الملخص التنفيذي" },
  { value: "creditors_register",  label: "سجل الدائنين" },
];

function TemplatesSection({ selectedCase }: { selectedCase: BkCase | null }) {
  const qc = useQueryClient();
  const [viewTemplate, setViewTemplate] = useState<any>(null);
  const [genType, setGenType] = useState("opening_petition");
  const [genLoading, setGenLoading] = useState(false);
  const [filterType, setFilterType] = useState("");

  const { data: templates = [], isLoading } = useQuery<any[]>({
    queryKey: ["bk-templates", filterType],
    queryFn: () => api(`/bankruptcy/templates${filterType ? `?type=${filterType}` : ""}`),
    staleTime: 60_000,
  });

  const approveTemplate = useMutation({
    mutationFn: (id: string) => api(`/bankruptcy/templates/${id}`, { method: "PATCH", body: JSON.stringify({ approved: true }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-templates"] }); toast.success("تم اعتماد القالب"); },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api(`/bankruptcy/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-templates"] }); toast.success("تم حذف القالب"); setViewTemplate(null); },
  });

  async function generateAI() {
    setGenLoading(true);
    try {
      const result = await api("/bankruptcy/templates/ai-generate", {
        method: "POST",
        body: JSON.stringify({ template_type: genType, case_id: selectedCase?.id }),
      });
      qc.invalidateQueries({ queryKey: ["bk-templates"] });
      setViewTemplate((result as any).template);
      toast.success("تم إنشاء القالب — يحتاج إلى اعتماد");
    } catch (e: any) { toast.error(e.message); }
    finally { setGenLoading(false); }
  }

  if (viewTemplate) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewTemplate(null)} className="text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-4 w-4 rotate-90" />
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold">{viewTemplate.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {viewTemplate.ai_generated && <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" /> AI</Badge>}
              {viewTemplate.approved
                ? <Badge className="text-[10px] bg-emerald-500">معتمد</Badge>
                : <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">في انتظار الاعتماد</Badge>}
            </div>
          </div>
          <div className="flex gap-2">
            {!viewTemplate.approved && (
              <Button size="sm" className="gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-xs"
                onClick={() => approveTemplate.mutate(viewTemplate.id)}>
                <Check className="h-3.5 w-3.5" /> اعتماد
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-xs gap-1.5"
              onClick={() => { navigator.clipboard?.writeText(viewTemplate.content); toast.success("تم النسخ"); }}>
              <Copy className="h-3.5 w-3.5" /> نسخ
            </Button>
            <Button size="sm" variant="outline" className="text-xs text-red-500"
              onClick={() => deleteTemplate.mutate(viewTemplate.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto font-mono text-right" dir="rtl">
              {viewTemplate.content}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><BookOpen className="h-5 w-5 text-teal-600" /> القوالب القانونية</h2>
        <p className="text-sm text-muted-foreground">{templates.length} قالب متاح</p>
      </div>

      <Card className="border-teal-200 dark:border-teal-800/40 bg-teal-50/40 dark:bg-teal-950/10">
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-teal-600" /> إنشاء قالب بالذكاء الاصطناعي</p>
          <div className="flex gap-2 flex-wrap">
            <select value={genType} onChange={e => setGenType(e.target.value)}
              className="flex-1 text-sm border border-border/50 rounded-lg px-2 py-1.5 bg-background min-w-[180px]">
              {TEMPLATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <Button size="sm" onClick={generateAI} disabled={genLoading} className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-xs">
              {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              إنشاء
            </Button>
          </div>
          {selectedCase && <p className="text-xs text-muted-foreground mt-2">سيستخدم بيانات ملف: {selectedCase.debtor_name}</p>}
        </CardContent>
      </Card>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterType("")}
          className={`text-xs px-3 py-1 rounded-full border transition-all ${filterType === "" ? "bg-teal-600 text-white border-teal-600" : "border-border/50 hover:bg-accent"}`}>
          الكل
        </button>
        {TEMPLATE_TYPES.map(t => (
          <button key={t.value} onClick={() => setFilterType(t.value)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${filterType === t.value ? "bg-teal-600 text-white border-teal-600" : "border-border/50 hover:bg-accent"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-teal-500" /></div>}

      {!isLoading && templates.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
            لا توجد قوالب — أنشئ أول قالب بالذكاء الاصطناعي
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {templates.map((t: any) => (
          <Card key={t.id} className="border-border/50 hover:border-teal-300 transition-all cursor-pointer" onClick={() => setViewTemplate(t)}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <BookOpen className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{t.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{TEMPLATE_TYPES.find(tt => tt.value === t.template_type)?.label ?? t.template_type}</span>
                    {t.ai_generated && <Badge variant="outline" className="text-[10px]">AI</Badge>}
                    {t.approved ? <Badge className="text-[10px] bg-emerald-500">معتمد</Badge> : <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">انتظار</Badge>}
                    <span className="text-[10px] text-muted-foreground mr-auto">{t.usage_count} استخدام</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ALERTS SECTION (V2 Phase 6)
══════════════════════════════════════════════════════════ */
function AlertsSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["bk-alerts"],
    queryFn: () => api("/bankruptcy/alerts"),
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const alerts: any[] = (data as any)?.alerts ?? [];
  const counts: any[] = (data as any)?.counts ?? [];

  const ackAlert = useMutation({
    mutationFn: (id: string) => api(`/bankruptcy/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status: "acknowledged" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-alerts"] }); },
  });

  const resolveAlert = useMutation({
    mutationFn: (id: string) => api(`/bankruptcy/alerts/${id}`, { method: "PATCH", body: JSON.stringify({ status: "resolved" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-alerts"] }); toast.success("تم حل التنبيه"); },
  });

  async function scanCase() {
    if (!selectedCase) return onNeedCase();
    setScanning(true);
    try {
      const r = await api(`/bankruptcy/cases/${selectedCase.id}/alerts/scan`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["bk-alerts"] });
      toast.success(`فحص مكتمل — ${(r as any).newAlerts} تنبيه جديد`);
    } catch (e: any) { toast.error(e.message); }
    finally { setScanning(false); }
  }

  const SEVERITY: Record<string, { color: string; bg: string; label: string; Icon: any }> = {
    critical: { color: "text-red-600",    bg: "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/40",       label: "حرج",     Icon: AlertCircle },
    high:     { color: "text-orange-600", bg: "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800/40", label: "مرتفع", Icon: TriangleAlert },
    warning:  { color: "text-amber-600",  bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40",   label: "تحذير",  Icon: AlertTriangle },
    info:     { color: "text-blue-600",   bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/40",       label: "معلومة", Icon: Bell },
  };

  const criticalCount = Number(counts.find((c: any) => c.severity === "critical")?.cnt ?? 0);
  const highCount     = Number(counts.find((c: any) => c.severity === "high")?.cnt ?? 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            مركز التنبيهات
            {criticalCount > 0 && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">{criticalCount} حرج</span>}
            {highCount > 0 && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">{highCount} مرتفع</span>}
          </h2>
          <p className="text-sm text-muted-foreground">{alerts.length} تنبيه نشط</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={scanCase} disabled={scanning}>
          {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          فحص الملف
        </Button>
      </div>

      {isLoading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-red-500" /></div>}

      {!isLoading && alerts.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center space-y-2">
            <CheckSquare className="h-12 w-12 text-emerald-400 mx-auto" />
            <p className="font-semibold text-emerald-600">لا توجد تنبيهات نشطة</p>
            <p className="text-xs text-muted-foreground">جميع الملفات في حالة جيدة</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {alerts.map((a: any) => {
          const sev = SEVERITY[a.severity] ?? SEVERITY.info;
          const SevIcon = sev.Icon;
          return (
            <div key={a.id} className={`p-3 rounded-xl border transition-all ${sev.bg}`}>
              <div className="flex items-start gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${sev.color} bg-white/60 dark:bg-black/20`}>
                  <SevIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${sev.color}`}>{sev.label}</span>
                  </div>
                  {a.message && <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>}
                  {a.debtor_name && <p className="text-xs text-muted-foreground mt-0.5">{a.debtor_name} — {a.case_number}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(a.created_at).toLocaleString("ar-SA")}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => ackAlert.mutate(a.id)}>
                    استلام
                  </Button>
                  <Button size="sm" className="h-7 text-xs px-2 bg-emerald-500 hover:bg-emerald-600" onClick={() => resolveAlert.mutate(a.id)}>
                    حل
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   COURT PACKAGE SECTION (V2 Phase 2)
══════════════════════════════════════════════════════════ */
function CourtPackageSection({ selectedCase, onNeedCase }: { selectedCase: BkCase | null; onNeedCase: () => void }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const { data: prevReports = [] } = useQuery<any[]>({
    queryKey: ["bk-court-reports", selectedCase?.id],
    queryFn: () => api(`/bankruptcy/cases/${selectedCase!.id}/reports`),
    enabled: !!selectedCase,
    staleTime: 60_000,
    select: (rows: any[]) => rows.filter((r: any) => r.category === "court_package"),
  });

  async function generate() {
    if (!selectedCase) return onNeedCase();
    setGenerating(true);
    setResult(null);
    try {
      const r = await api(`/bankruptcy/cases/${selectedCase.id}/court-package`, { method: "POST" });
      setResult(r);
      qc.invalidateQueries({ queryKey: ["bk-court-reports", selectedCase.id] });
      toast.success("تم توليد حزمة المحكمة");
    } catch (e: any) { toast.error(e.message); }
    finally { setGenerating(false); }
  }

  if (!selectedCase) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><Package className="h-5 w-5 text-indigo-600" /> حزمة المحكمة</h2>
        <Card className="border-border/50">
          <CardContent className="py-10 text-center">
            <Package className="h-12 w-12 mx-auto mb-3 text-indigo-200" />
            <p className="text-muted-foreground text-sm mb-3">حدد ملف إفلاس أولاً</p>
            <Button size="sm" onClick={onNeedCase}>تحديد ملف</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2"><Package className="h-5 w-5 text-indigo-600" /> حزمة المحكمة</h2>
        <p className="text-sm text-muted-foreground">توليد وثائق قضائية شاملة لملف: {selectedCase.debtor_name}</p>
      </div>

      <Card className="border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/40 dark:bg-indigo-950/10">
        <CardContent className="p-5 text-center space-y-3">
          <Package className="h-12 w-12 text-indigo-400 mx-auto" />
          <div>
            <p className="font-bold text-indigo-900 dark:text-indigo-200">توليد حزمة مستندات قضائية</p>
            <p className="text-xs text-muted-foreground mt-1">تشمل: عريضة الإفلاس، الملخص المالي، سجل الأصول، سجل الدائنين، الجدول الزمني، الملخص التنفيذي، وفهرس المستندات</p>
          </div>
          <Button onClick={generate} disabled={generating} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ التوليد…</>
            ) : (
              <><Package className="h-4 w-4" /> توليد حزمة المحكمة</>
            )}
          </Button>
          {generating && <p className="text-xs text-muted-foreground animate-pulse">قد يستغرق هذا دقيقة…</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "الدائنون",       value: (result as any).stats?.creditors },
              { label: "المطالبات",     value: (result as any).stats?.claims },
              { label: "الأصول",        value: (result as any).stats?.assets },
              { label: "نسبة الاسترداد", value: `${(result as any).stats?.recoveryRate ?? 0}%` },
            ].map(k => (
              <Card key={k.label} className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-lg font-bold text-indigo-600">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-indigo-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4 text-indigo-600" /> المستندات المولَّدة</CardTitle>
              <Button size="sm" variant="outline" className="text-xs gap-1.5"
                onClick={() => { navigator.clipboard?.writeText((result as any).content ?? ""); toast.success("تم نسخ المستند"); }}>
                <Copy className="h-3.5 w-3.5" /> نسخ
              </Button>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto" dir="rtl">
                {(result as any).content}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {prevReports.length > 0 && !result && (
        <div>
          <p className="text-sm font-semibold mb-2 text-muted-foreground">حزم سابقة ({prevReports.length})</p>
          <div className="space-y-2">
            {prevReports.slice(0, 5).map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-accent/30 cursor-pointer"
                onClick={() => setResult({ content: r.content, stats: {}, caseNumber: selectedCase.case_number, debtorName: selectedCase.debtor_name })}>
                <Package className="h-4 w-4 text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.report_title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   NOTIFICATIONS SECTION (Phase 3)
══════════════════════════════════════════════════════════ */
const NOTIF_META: Record<string, { Icon: any; color: string }> = {
  claim:        { Icon:FileText,     color:"text-violet-600 bg-violet-50 dark:bg-violet-950/30" },
  meeting:      { Icon:CalendarDays, color:"text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
  distribution: { Icon:Banknote,     color:"text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" },
  info:         { Icon:Bell,         color:"text-amber-600 bg-amber-50 dark:bg-amber-950/30" },
};

function NotificationsSection() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["bk-notifications"],
    queryFn: () => api("/bankruptcy/notifications"),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const notifications: any[] = (data as any)?.notifications ?? [];
  const unreadCount: number  = (data as any)?.unreadCount ?? 0;

  const markAllRead = useMutation({
    mutationFn: () => api("/bankruptcy/notifications/read-all", { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bk-notifications"] });
      qc.invalidateQueries({ queryKey: ["bk-notifs-count"] });
      toast.success("تم تعيين جميع الإشعارات كمقروءة");
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/bankruptcy/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bk-notifications"] });
      qc.invalidateQueries({ queryKey: ["bk-notifs-count"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            مركز الإشعارات
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">{notifications.length} إشعار</p>
        </div>
        {unreadCount > 0 && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck className="h-3.5 w-3.5" /> تعيين الكل كمقروء
          </Button>
        )}
      </div>

      {isLoading && <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>}

      {!isLoading && notifications.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">لا توجد إشعارات</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {notifications.map((n: any) => {
          const meta = NOTIF_META[n.type] ?? NOTIF_META.info;
          const Icon = meta.Icon;
          const isUnread = n.status === "unread";
          return (
            <div key={n.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer
                ${isUnread
                  ? "bg-amber-50/60 border-amber-200 dark:bg-amber-950/10 dark:border-amber-800/40 hover:bg-amber-50"
                  : "bg-card border-border/50 hover:bg-accent/30 opacity-70"}`}
              onClick={() => isUnread && markRead.mutate(n.id)}>
              <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${meta.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {isUnread && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
                </div>
                {n.message && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>}
                {n.debtor_name && <p className="text-xs text-muted-foreground mt-0.5">{n.debtor_name} — {n.case_number}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar-SA")}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
