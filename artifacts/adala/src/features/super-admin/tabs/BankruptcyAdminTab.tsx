import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark, Building2, FileText, Users, BarChart3, AlertCircle,
  Loader2, Eye, RefreshCw, Search, Shield, GitBranch, FilePlus2,
  Clock, ArrowUpRight, TrendingUp, TrendingDown, Activity,
  Database, HardDrive, Server, Zap, DollarSign, CreditCard,
  AlertTriangle, Lock, Unlock, XCircle, CheckCircle2,
  BarChart2, PieChart, Cpu, Archive, ShieldAlert, ShieldOff,
  Ban, RotateCcw, Wifi, WifiOff, Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPie, Pie,
} from "recharts";
import { API } from "../shared/api";

/* ── helpers ── */
function fmt(n: any) { return Number(n ?? 0).toLocaleString("ar-SA"); }
function fmtBytes(b: any) {
  const v = Number(b ?? 0);
  if (v >= 1_073_741_824) return (v / 1_073_741_824).toFixed(1) + " GB";
  if (v >= 1_048_576)     return (v / 1_048_576).toFixed(1) + " MB";
  if (v >= 1024)          return (v / 1024).toFixed(0) + " KB";
  return v + " B";
}
function fmtMoney(n: any) { return Number(n ?? 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س"; }
function healthColor(s: number) {
  if (s >= 90) return { text: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-950/30", label: "ممتاز" };
  if (s >= 75) return { text: "text-blue-500",    bg: "bg-blue-100 dark:bg-blue-950/30",    label: "جيد" };
  if (s >= 50) return { text: "text-amber-500",   bg: "bg-amber-100 dark:bg-amber-950/30",  label: "يحتاج انتباه" };
  return         { text: "text-red-500",     bg: "bg-red-100 dark:bg-red-950/30",     label: "حرج" };
}

const CASE_STATUS_AR: Record<string, string> = { open:"مفتوح", closed:"مغلق", suspended:"موقوف" };
const REQ_STATUS_AR: Record<string, string> = {
  draft:"مسودة", under_assessment:"تحت التقييم", documents_pending:"ينتظر مستندات",
  ai_analysis:"تحليل AI", ready_for_filing:"جاهز للتقديم", under_legal_review:"مراجعة قانونية",
  approved_for_submission:"معتمد", submitted_to_court:"مقدَّم", converted_to_case:"تحوّل لملف",
  closed:"مغلق", cancelled:"ملغي",
};
const PROC_AR: Record<string, string> = {
  preventive_settlement:"التسوية الوقائية", financial_reorganization:"إعادة التنظيم",
  liquidation:"التصفية", administrative_liquidation:"تصفية إدارية", not_eligible:"غير مؤهل",
};
const LOCK_TYPE_AR: Record<string, { label: string; icon: any; color: string }> = {
  office_freeze:  { label: "تجميد مكتب",      icon: Building2, color: "text-red-500" },
  user_lock:      { label: "قفل مستخدم",       icon: Lock,      color: "text-orange-500" },
  case_lock:      { label: "قفل ملف إفلاس",   icon: Landmark,  color: "text-amber-500" },
  portal_lock:    { label: "قفل البوابة العامة", icon: WifiOff, color: "text-violet-500" },
  creditor_lock:  { label: "قفل بوابة الدائنين", icon: ShieldOff, color: "text-pink-500" },
};
const PLAN_COLORS: Record<string, string> = {
  free:"#94a3b8", trial:"#f59e0b", basic:"#3b82f6",
  pro:"#8b5cf6", growth:"#ec4899", enterprise:"#10b981", elite:"#f97316",
};
const PIE_COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#f97316"];

const SUB_TABS = [
  { id: "stats",     label: "الإحصائيات",      icon: BarChart3,    group: "أساسي" },
  { id: "offices",   label: "المكاتب",           icon: Building2,    group: "أساسي" },
  { id: "cases",     label: "الملفات",           icon: Landmark,     group: "أساسي" },
  { id: "requests",  label: "طلبات الافتتاح",   icon: FilePlus2,    group: "أساسي" },
  { id: "audit",     label: "سجل التدقيق",      icon: Shield,       group: "أساسي" },
  { id: "health",    label: "مركز الصحة",        icon: Activity,     group: "EOC" },
  { id: "revenue",   label: "مركز الإيرادات",   icon: DollarSign,   group: "EOC" },
  { id: "ai",        label: "تحليلات AI",         icon: Cpu,          group: "EOC" },
  { id: "storage",   label: "التخزين والنسخ",   icon: Database,     group: "EOC" },
  { id: "emergency", label: "التحكم الطارئ",     icon: ShieldAlert,  group: "EOC" },
  { id: "demo",      label: "البيئة التجريبية",  icon: Package,      group: "Demo" },
] as const;
type TabId = typeof SUB_TABS[number]["id"];

/* ══════════════════════════════════════════════════════════ */
export function BankruptcyAdminTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<TabId>("stats");
  const [caseQ,  setCaseQ]  = useState("");
  const [reqQ,   setReqQ]   = useState("");
  const [officeFilter, setOfficeFilter] = useState("");

  /* emergency form */
  const [emgOffice, setEmgOffice]   = useState("");
  const [emgType,   setEmgType]     = useState("office_freeze");
  const [emgTarget, setEmgTarget]   = useState("");
  const [emgReason, setEmgReason]   = useState("");
  const [emgHours,  setEmgHours]    = useState("");

  /* ── base queries (loaded on tab) ── */
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["sa-bk-stats"],
    queryFn: () => API("/bankruptcy/stats"),
    staleTime: 30_000,
  });
  const { data: offices = [] } = useQuery<any[]>({
    queryKey: ["sa-bk-offices"],
    queryFn: () => API("/bankruptcy/offices"),
    staleTime: 60_000,
  });
  const { data: cases = [], isLoading: casesLoading } = useQuery<any[]>({
    queryKey: ["sa-bk-cases", caseQ, officeFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (caseQ) qs.set("q", caseQ);
      if (officeFilter) qs.set("office_id", officeFilter);
      return API(`/bankruptcy/cases?${qs}`);
    },
    staleTime: 30_000, enabled: subTab === "cases",
  });
  const { data: requests = [], isLoading: reqLoading } = useQuery<any[]>({
    queryKey: ["sa-bk-reqs", reqQ, officeFilter],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (reqQ) qs.set("q", reqQ);
      if (officeFilter) qs.set("office_id", officeFilter);
      return API(`/bankruptcy/opening-requests?${qs}`);
    },
    staleTime: 30_000, enabled: subTab === "requests",
  });
  const { data: auditLogs = [], isLoading: auditLoading, refetch: refetchAudit } = useQuery<any[]>({
    queryKey: ["sa-bk-audit", officeFilter],
    queryFn: () => API(`/bankruptcy/audit-logs${officeFilter ? `?office_id=${officeFilter}` : ""}`),
    staleTime: 20_000, enabled: subTab === "audit",
  });

  /* ── EOC queries ── */
  const { data: healthData = [], isLoading: healthLoading, refetch: refetchHealth } = useQuery<any[]>({
    queryKey: ["sa-bk-eoc-health"],
    queryFn: () => API("/bankruptcy/eoc/health"),
    staleTime: 60_000, enabled: subTab === "health",
  });
  const { data: revenueData, isLoading: revLoading } = useQuery<any>({
    queryKey: ["sa-bk-eoc-revenue"],
    queryFn: () => API("/bankruptcy/eoc/revenue"),
    staleTime: 60_000, enabled: subTab === "revenue",
  });
  const { data: aiData, isLoading: aiLoading } = useQuery<any>({
    queryKey: ["sa-bk-eoc-ai"],
    queryFn: () => API("/bankruptcy/eoc/ai-analytics"),
    staleTime: 60_000, enabled: subTab === "ai",
  });
  const { data: storageData, isLoading: storageLoading } = useQuery<any>({
    queryKey: ["sa-bk-eoc-storage"],
    queryFn: () => API("/bankruptcy/eoc/storage"),
    staleTime: 60_000, enabled: subTab === "storage",
  });
  const { data: emergencyData, isLoading: emgLoading, refetch: refetchEmg } = useQuery<any>({
    queryKey: ["sa-bk-eoc-emergency"],
    queryFn: () => API("/bankruptcy/eoc/emergency"),
    staleTime: 10_000, enabled: subTab === "emergency",
  });
  const { data: demoStatus, isLoading: demoStatusLoading, refetch: refetchDemoStatus } = useQuery<any>({
    queryKey: ["sa-bk-demo-status"],
    queryFn: () => API("/bankruptcy/demo/status"),
    staleTime: 10_000, enabled: subTab === "demo",
  });

  /* ── mutations ── */
  const logAudit = useMutation({
    mutationFn: (body: object) => API("/bankruptcy/audit-logs", { method: "POST", body: JSON.stringify(body) }),
  });
  const applyLock = useMutation({
    mutationFn: (body: object) => API("/bankruptcy/eoc/emergency", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ title: "تم تطبيق القيد", description: "سُجّل في سجل التدقيق" });
      qc.invalidateQueries({ queryKey: ["sa-bk-eoc-emergency"] });
      setEmgOffice(""); setEmgType("office_freeze"); setEmgTarget(""); setEmgReason(""); setEmgHours("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const releaseLock = useMutation({
    mutationFn: (id: string) => API(`/bankruptcy/eoc/emergency/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم رفع القيد" }); qc.invalidateQueries({ queryKey: ["sa-bk-eoc-emergency"] }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });
  const seedDemo = useMutation({
    mutationFn: () => API("/bankruptcy/demo/seed", { method: "POST" }),
    onSuccess: (data: any) => {
      toast({ title: "✅ تم إنشاء البيئة التجريبية", description: `شمال: ${data?.north?.cases} ملف | جنوب: ${data?.south?.cases} ملف` });
      refetchDemoStatus();
      qc.invalidateQueries({ queryKey: ["sa-bk-stats"] });
    },
    onError: (e: any) => toast({ title: "خطأ في الزرع", description: e.message, variant: "destructive" }),
  });
  const deleteDemo = useMutation({
    mutationFn: () => API("/bankruptcy/demo", { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "🗑️ تم حذف البيئة التجريبية", description: "جميع السجلات is_demo=true حُذفت" });
      refetchDemoStatus();
      qc.invalidateQueries({ queryKey: ["sa-bk-stats"] });
    },
    onError: (e: any) => toast({ title: "خطأ في الحذف", description: e.message, variant: "destructive" }),
  });

  const s: any = stats ?? {};
  const c: any = s.cases ?? {};
  const r: any = s.opening_requests ?? {};
  const cl: any = s.claims ?? {};
  const as_: any = s.assets ?? {};
  const ta: any = s.tasks ?? {};
  const al: any = s.alerts ?? {};

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Landmark className="h-5 w-5 text-amber-500" />
            مركز العمليات المؤسسي للإفلاس
            <span className="text-[10px] bg-amber-100 dark:bg-amber-950/30 text-amber-700 px-1.5 py-0.5 rounded font-bold">EOC</span>
          </h2>
          <p className="text-xs text-muted-foreground">طبقة الحوكمة والرقابة المؤسسية — Super Admin فقط</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs"
          onClick={() => { refetchStats(); qc.invalidateQueries({ queryKey: ["sa-bk-"] }); }}>
          <RefreshCw className="h-3.5 w-3.5" />تحديث
        </Button>
      </div>

      {/* Sub-tab nav — three groups */}
      <div className="space-y-1">
        {(["أساسي", "EOC", "Demo"] as const).map(grp => (
          <div key={grp} className="flex gap-1 items-center flex-wrap">
            <span className="text-[10px] text-muted-foreground/60 w-10 text-left shrink-0">{grp}</span>
            {SUB_TABS.filter(t => t.group === grp).map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all
                  ${subTab === t.id
                    ? grp === "EOC"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-400/30"
                      : "bg-background shadow text-foreground font-semibold border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"}`}>
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* ═══════════════ 1. STATS ═══════════════ */}
      {subTab === "stats" && (
        <div className="space-y-4">
          {statsLoading ? <Spinner /> : <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "ملفات الإفلاس",    value: fmt(c.total),     sub: `${fmt(c.open)} مفتوح`,    icon: Landmark,    color: "text-amber-500" },
                { label: "مكاتب نشطة",       value: fmt(c.offices),   sub: "تستخدم نظام الإفلاس",    icon: Building2,   color: "text-blue-500" },
                { label: "طلبات الافتتاح",   value: fmt(r.total),     sub: `${fmt(r.ready)} جاهز`,    icon: FilePlus2,   color: "text-violet-500" },
                { label: "تحوّلت لملف",      value: fmt(r.converted), sub: "من طلبات الافتتاح",     icon: ArrowUpRight, color: "text-emerald-500" },
              ].map(k => <KpiCard key={k.label} {...k} />)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "إجمالي المطالبات",  value: fmt(cl.total),    sub: fmtMoney(cl.total_amount), icon: FileText,     color: "text-indigo-500" },
                { label: "الأصول المقيَّمة",  value: fmt(as_.total),   sub: fmtMoney(as_.total_value), icon: TrendingUp,   color: "text-teal-500" },
                { label: "مهام متأخرة",       value: fmt(ta.overdue),  sub: `من ${fmt(ta.total)} مهمة`, icon: Clock,      color: "text-orange-500" },
                { label: "تنبيهات حرجة",      value: fmt(al.critical), sub: `من ${fmt(al.total)} نشط`, icon: AlertCircle, color: "text-red-500" },
              ].map(k => <KpiCard key={k.label} {...k} />)}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatMini label="سير العمل" value={fmt(s.workflows?.total)} sub={`${fmt(s.workflows?.completed)} مكتمل`} color="text-blue-500" />
              <StatMini label="القوالب القانونية" value={fmt(s.templates?.total)} color="text-teal-500" />
              <StatMini label="متوسط الأهلية" value={`${r.avg_eligibility ?? "—"}`} sub="من 100" color="text-violet-500" />
            </div>
          </>}
        </div>
      )}

      {/* ═══════════════ 2. OFFICES ═══════════════ */}
      {subTab === "offices" && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">{offices.length} مكتب يستخدم نظام الإفلاس</p>
          <div className="space-y-2">
            {offices.map((o: any) => (
              <Card key={o.office_id} className="border-border/50 hover:border-amber-300/50 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{o.office_name ?? o.office_id}</p>
                        <span className="text-[10px] text-muted-foreground font-mono">{o.office_id}</span>
                      </div>
                      <div className="flex gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Landmark className="h-3 w-3" />{fmt(o.cases_count)} ملف</span>
                        <span className="flex items-center gap-1"><FilePlus2 className="h-3 w-3" />{fmt(o.opening_requests_count)} طلب</span>
                        {Number(o.overdue_tasks) > 0 && <span className="text-orange-500 flex items-center gap-1"><Clock className="h-3 w-3" />{fmt(o.overdue_tasks)} متأخر</span>}
                        {Number(o.active_alerts) > 0 && <span className="text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{fmt(o.active_alerts)} تنبيه</span>}
                        {o.last_case_at && <span className="mr-auto">{new Date(o.last_case_at).toLocaleDateString("ar-SA")}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs gap-1.5 shrink-0"
                      onClick={() => { setOfficeFilter(o.office_id); setSubTab("cases"); logAudit.mutate({ office_id: o.office_id, action_type: "bankruptcy.view_office", resource_type: "office" }); }}>
                      <Eye className="h-3.5 w-3.5" />عرض الملفات
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ 3. CASES ═══════════════ */}
      {subTab === "cases" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <SearchBox value={caseQ} onChange={setCaseQ} placeholder="بحث باسم المدين أو رقم القضية..." />
            {officeFilter && <ClearFilter onClick={() => setOfficeFilter("")} />}
          </div>
          <p className="text-xs text-muted-foreground">{cases.length} نتيجة</p>
          {casesLoading ? <Spinner /> : (
            <div className="space-y-2">
              {cases.map((c: any) => (
                <Card key={c.id} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{c.debtor_name}</p>
                          <StatusBadge label={CASE_STATUS_AR[c.status] ?? c.status}
                            color={c.status === "open" ? "emerald" : "zinc"} />
                          {c.office_name && <OfficeBadge name={c.office_name} />}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>{c.case_number}</span>
                          <span>{fmt(c.creditors_count)} دائن</span>
                          <span>{fmt(c.claims_count)} مطالبة</span>
                          <span>{fmt(c.assets_count)} أصل</span>
                          <span className="mr-auto">{new Date(c.created_at).toLocaleDateString("ar-SA")}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                        onClick={() => logAudit.mutate({ office_id: c.office_id, action_type: "bankruptcy.view_case", resource_type: "bankruptcy_case", resource_id: c.id })}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {cases.length === 0 && <EmptyState icon={Landmark} label="لا توجد ملفات" />}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ 4. REQUESTS ═══════════════ */}
      {subTab === "requests" && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <SearchBox value={reqQ} onChange={setReqQ} placeholder="بحث باسم الشركة أو رقم الطلب..." />
            {officeFilter && <ClearFilter onClick={() => setOfficeFilter("")} />}
          </div>
          <p className="text-xs text-muted-foreground">{requests.length} نتيجة</p>
          {reqLoading ? <Spinner /> : (
            <div className="space-y-2">
              {requests.map((r: any) => (
                <Card key={r.id} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <ReadinessRing score={r.readiness_score} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{r.company_name}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-medium">{REQ_STATUS_AR[r.status] ?? r.status}</span>
                          {r.procedure_recommendation && <span className="text-[10px] font-semibold text-blue-600">{PROC_AR[r.procedure_recommendation] ?? r.procedure_recommendation}</span>}
                          {r.office_name && <OfficeBadge name={r.office_name} />}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>{r.request_number}</span>
                          {r.eligibility_score != null && <span className="text-emerald-600">أهلية: {r.eligibility_score}/100</span>}
                          <span className="mr-auto">{new Date(r.created_at).toLocaleDateString("ar-SA")}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {requests.length === 0 && <EmptyState icon={FilePlus2} label="لا توجد طلبات" />}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ 5. AUDIT ═══════════════ */}
      {subTab === "audit" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-500" />سجل تدقيق نظام الإفلاس
              <span className="text-xs font-normal text-muted-foreground">({auditLogs.length} سجل)</span>
            </p>
            <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => refetchAudit()}>
              <RefreshCw className="h-3.5 w-3.5" />تحديث
            </Button>
          </div>
          {auditLoading ? <Spinner /> : auditLogs.length === 0
            ? <EmptyState icon={Shield} label="لا يوجد سجل بعد — كل وصول سيظهر هنا" />
            : (
              <div className="space-y-1.5">
                {auditLogs.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 hover:bg-accent/20">
                    <div className="h-8 w-8 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{a.action_type}</p>
                      <div className="flex gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        {a.office_name && <span><Building2 className="h-3 w-3 inline ml-1" />{a.office_name}</span>}
                        {a.ip_address && <span className="font-mono text-[10px]">{a.ip_address}</span>}
                        <span className="mr-auto">{new Date(a.created_at).toLocaleString("ar-SA")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ═══════════════ 6. HEALTH CENTER (EOC) ═══════════════ */}
      {subTab === "health" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2"><Activity className="h-4 w-4 text-amber-500" />مركز صحة المكاتب</h3>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => refetchHealth()}><RefreshCw className="h-3.5 w-3.5" />تحديث</Button>
          </div>
          {healthLoading ? <Spinner /> : (
            <>
              {/* summary bar */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "ممتاز (90+)",     count: healthData.filter((o:any) => o.health_score >= 90).length, color: "text-emerald-500" },
                  { label: "جيد (75-89)",     count: healthData.filter((o:any) => o.health_score >= 75 && o.health_score < 90).length, color: "text-blue-500" },
                  { label: "يحتاج انتباه",   count: healthData.filter((o:any) => o.health_score >= 50 && o.health_score < 75).length, color: "text-amber-500" },
                  { label: "حرج (<50)",       count: healthData.filter((o:any) => o.health_score < 50).length, color: "text-red-500" },
                ].map(x => (
                  <div key={x.label} className="text-center p-3 rounded-xl bg-muted/40">
                    <p className={`text-2xl font-black ${x.color}`}>{x.count}</p>
                    <p className="text-[10px] text-muted-foreground">{x.label}</p>
                  </div>
                ))}
              </div>
              {/* office list sorted by health score ASC (worst first) */}
              <div className="space-y-2">
                {healthData.map((o: any) => {
                  const hc = healthColor(o.health_score);
                  return (
                    <Card key={o.office_id} className={`border ${hc.bg} border-transparent`}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className={`h-12 w-12 rounded-full ${hc.bg} flex flex-col items-center justify-center shrink-0`}>
                            <span className={`text-lg font-black ${hc.text}`}>{o.health_score}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold">{o.office_name ?? o.office_id}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${hc.text} bg-white/50`}>{hc.label}</span>
                            </div>
                            <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span><Landmark className="h-3 w-3 inline ml-1" />{fmt(o.total_cases)} ملف ({fmt(o.open_cases)} مفتوح)</span>
                              {Number(o.overdue_tasks) > 0 && <span className="text-orange-500"><Clock className="h-3 w-3 inline ml-1" />{fmt(o.overdue_tasks)} متأخر</span>}
                              {Number(o.critical_alerts) > 0 && <span className="text-red-500"><AlertCircle className="h-3 w-3 inline ml-1" />{fmt(o.critical_alerts)} حرج</span>}
                              <span><GitBranch className="h-3 w-3 inline ml-1" />{fmt(o.pending_claims)} مطالبة معلقة</span>
                              {o.last_activity && <span className="mr-auto">{new Date(o.last_activity).toLocaleDateString("ar-SA")}</span>}
                            </div>
                          </div>
                          {/* health bar */}
                          <div className="w-24 shrink-0">
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${o.health_score >= 90 ? 'bg-emerald-500' : o.health_score >= 75 ? 'bg-blue-500' : o.health_score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${o.health_score}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground text-center mt-0.5">{o.health_score}/100</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {healthData.length === 0 && <EmptyState icon={Activity} label="لا توجد بيانات صحة — لا مكاتب تستخدم نظام الإفلاس بعد" />}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════ 7. REVENUE CENTER (EOC) ═══════════════ */}
      {subTab === "revenue" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" />مركز الإيرادات</h3>
          {revLoading ? <Spinner /> : (() => {
            const sm: any = revenueData?.summary ?? {};
            const byPlan: any[] = revenueData?.by_plan ?? [];
            const monthly: any[] = revenueData?.monthly ?? [];
            const topOffices: any[] = revenueData?.top_offices ?? [];
            return (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "إجمالي المكاتب",   value: fmt(sm.total_offices),   sub: "مسجلة في المنصة",       icon: Building2,  color: "text-blue-500" },
                    { label: "مشتركون مدفوعون",  value: fmt(sm.paid_offices),    sub: "خطة مدفوعة فعّالة",     icon: CreditCard, color: "text-emerald-500" },
                    { label: "تجارب مجانية",     value: fmt(sm.trial_offices),   sub: "في فترة التجربة",        icon: Package,    color: "text-amber-500" },
                    { label: "إجمالي الإيرادات", value: fmtMoney(sm.total_revenue), sub: `ARPU: ${fmtMoney(sm.avg_revenue_per_office)}`, icon: DollarSign, color: "text-teal-500" },
                  ].map(k => <KpiCard key={k.label} {...k} />)}
                </div>
                {/* Charts row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Monthly revenue */}
                  {monthly.length > 0 && (
                    <Card className="border-border/50">
                      <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground">الإيرادات الشهرية (12 شهر)</CardTitle></CardHeader>
                      <CardContent className="px-2 pb-3">
                        <ResponsiveContainer width="100%" height={140}>
                          <AreaChart data={monthly}>
                            <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                            <YAxis tick={{ fontSize: 9 }} />
                            <Tooltip formatter={(v: any) => fmtMoney(v)} />
                            <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}
                  {/* Plan distribution */}
                  {byPlan.length > 0 && (
                    <Card className="border-border/50">
                      <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground">توزيع الخطط</CardTitle></CardHeader>
                      <CardContent className="flex items-center gap-4 px-4 pb-3">
                        <ResponsiveContainer width={100} height={100}>
                          <RechartsPie>
                            <Pie data={byPlan} dataKey="office_count" nameKey="plan_slug" cx="50%" cy="50%" outerRadius={45}>
                              {byPlan.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip />
                          </RechartsPie>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-1">
                          {byPlan.map((p: any, i: number) => (
                            <div key={p.plan_slug} className="flex items-center gap-2 text-xs">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="flex-1 text-muted-foreground">{p.plan_slug ?? "—"}</span>
                              <span className="font-semibold">{fmt(p.office_count)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                {/* Top offices */}
                {topOffices.length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground">أعلى المكاتب إيراداً</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3 space-y-1.5">
                      {topOffices.slice(0, 10).map((o: any, i: number) => (
                        <div key={o.office_id} className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground w-5 text-left">{i + 1}</span>
                          <span className="flex-1 font-medium">{o.name ?? o.office_id}</span>
                          <span className="text-[10px] bg-muted px-1.5 rounded">{o.plan}</span>
                          <span className="font-semibold text-emerald-600">{fmtMoney(o.revenue)}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ═══════════════ 8. AI ANALYTICS (EOC) ═══════════════ */}
      {subTab === "ai" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2"><Cpu className="h-4 w-4 text-violet-500" />تحليلات الذكاء الاصطناعي</h3>
          {aiLoading ? <Spinner /> : (() => {
            const sm: any = aiData?.summary ?? {};
            const perOffice: any[] = aiData?.per_office ?? [];
            const daily: any[] = aiData?.daily ?? [];
            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "إجمالي المعاملات",   value: fmt(sm.total_transactions), sub: "كل الوقت",             icon: Zap,       color: "text-violet-500" },
                    { label: "مكاتب تستخدم AI",    value: fmt(sm.offices_using_ai),  sub: "استخدمت الذكاء",       icon: Building2, color: "text-blue-500" },
                    { label: "نقاط مستهلكة (30ي)", value: fmt(sm.credits_used_30d),  sub: "آخر 30 يوم",           icon: Zap,       color: "text-amber-500" },
                    { label: "معاملات (30 يوم)",   value: fmt(sm.transactions_30d),  sub: "طلب AI",               icon: Activity,  color: "text-teal-500" },
                  ].map(k => <KpiCard key={k.label} {...k} />)}
                </div>
                {daily.length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground">استهلاك AI اليومي (30 يوم)</CardTitle></CardHeader>
                    <CardContent className="px-2 pb-3">
                      <ResponsiveContainer width="100%" height={130}>
                        <BarChart data={daily}>
                          <XAxis dataKey="day" tick={{ fontSize: 8 }} tickFormatter={d => d.slice(5)} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <Tooltip />
                          <Bar dataKey="credits_used" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
                <Card className="border-border/50">
                  <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground">استهلاك AI لكل مكتب</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-3 space-y-1.5">
                    {perOffice.slice(0, 15).map((o: any, i: number) => (
                      <div key={o.office_id} className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground w-5 text-left">{i + 1}</span>
                        <span className="flex-1 font-medium">{o.office_name ?? o.office_id}</span>
                        <span className="text-muted-foreground">{fmt(o.credits_used)} نقطة</span>
                        <span className="text-[10px] bg-violet-100 dark:bg-violet-950/30 text-violet-600 px-1.5 rounded">{fmt(o.transactions_30d)} / 30ي</span>
                      </div>
                    ))}
                    {perOffice.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">لا توجد بيانات AI بعد</p>}
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </div>
      )}

      {/* ═══════════════ 9. STORAGE & BACKUPS (EOC) ═══════════════ */}
      {subTab === "storage" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2"><Database className="h-4 w-4 text-blue-500" />التخزين والنسخ الاحتياطية</h3>
          {storageLoading ? <Spinner /> : (() => {
            const st: any = storageData?.storage ?? {};
            const bk: any = storageData?.backup ?? {};
            const perOffice: any[] = storageData?.per_office ?? [];
            const recentBk: any[] = storageData?.recent_backups ?? [];

            /* Backup health score */
            const bkTotal = Number(bk.total_jobs ?? 0);
            const bkCompleted = Number(bk.completed_jobs ?? 0);
            const bkScore = bkTotal > 0 ? Math.round((bkCompleted / bkTotal) * 100) : 100;
            const bkColor = bkScore >= 90 ? "text-emerald-500" : bkScore >= 70 ? "text-amber-500" : "text-red-500";

            return (
              <>
                {/* Storage KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "إجمالي الملفات",   value: fmt(st.total_files),   sub: `${fmt(st.archived_count)} محفوظ`,  icon: Archive,   color: "text-blue-500" },
                    { label: "مساحة مستخدمة",    value: fmtBytes(st.total_bytes), sub: `${fmt(st.offices_with_files)} مكتب`, icon: HardDrive, color: "text-indigo-500" },
                    { label: "صحة النسخ",        value: `${bkScore}%`,         sub: `${fmt(bkCompleted)}/${fmt(bkTotal)} ناجح`, icon: Database,  color: bkColor },
                    { label: "آخر نسخة ناجحة",  value: bk.last_successful_backup ? new Date(bk.last_successful_backup).toLocaleDateString("ar-SA") : "—", sub: fmtBytes(bk.total_backup_bytes), icon: Server, color: "text-teal-500" },
                  ].map(k => <KpiCard key={k.label} {...k} />)}
                </div>
                {/* Backup status grid */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "مكتملة", value: bk.completed_jobs, color: "text-emerald-500" },
                    { label: "فاشلة",  value: bk.failed_jobs,    color: "text-red-500" },
                    { label: "جارية",  value: bk.running_jobs,   color: "text-blue-500" },
                  ].map(x => <StatMini key={x.label} label={x.label} value={fmt(x.value)} color={x.color} />)}
                </div>
                {/* Per office storage */}
                {perOffice.length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground">استهلاك التخزين لكل مكتب</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3 space-y-2">
                      {perOffice.slice(0, 15).map((o: any) => {
                        const pct = o.max_bytes > 0 ? Math.min(100, Math.round((Number(o.used_bytes) / Number(o.max_bytes)) * 100)) : 0;
                        return (
                          <div key={o.office_id} className="space-y-0.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="flex-1 font-medium">{o.office_name ?? o.office_id}</span>
                              <span className="text-muted-foreground">{fmtBytes(o.used_bytes)} / {fmtBytes(o.max_bytes)}</span>
                              <span className={`text-[10px] font-bold ${pct >= 90 ? "text-red-500" : pct >= 70 ? "text-amber-500" : "text-muted-foreground"}`}>{pct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
                {/* Recent backups */}
                {recentBk.length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-xs font-semibold text-muted-foreground">آخر عمليات النسخ</CardTitle></CardHeader>
                    <CardContent className="px-4 pb-3 space-y-1.5">
                      {recentBk.slice(0, 10).map((b: any) => (
                        <div key={b.id ?? b.created_at} className="flex items-center gap-3 text-xs">
                          {b.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : b.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /> : <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />}
                          <span className="flex-1">{b.office_name ?? b.office_id}</span>
                          <span className="text-muted-foreground">{b.type}</span>
                          <span className="text-muted-foreground">{fmtBytes(b.size_bytes)}</span>
                          <span className="text-muted-foreground">{b.completed_at ? new Date(b.completed_at).toLocaleDateString("ar-SA") : "—"}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ═══════════════ 10. EMERGENCY CONTROLS (EOC) ═══════════════ */}
      {subTab === "emergency" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            <div>
              <h3 className="text-sm font-black text-red-500">لوحة التحكم الطارئ</h3>
              <p className="text-xs text-muted-foreground">تجميد مكاتب وقفل مستخدمين — يُسجَّل كل إجراء في سجل التدقيق</p>
            </div>
          </div>

          {/* Apply lock form */}
          <Card className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10">
            <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"><Ban className="h-4 w-4" />تطبيق قيد طارئ جديد</CardTitle></CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">معرّف المكتب *</label>
                  <Input className="text-sm h-8" placeholder="office_id" value={emgOffice} onChange={e => setEmgOffice(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">نوع القيد *</label>
                  <Select value={emgType} onValueChange={setEmgType}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LOCK_TYPE_AR).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-sm">{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {emgType !== "office_freeze" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">معرّف الهدف (user_id / case_id)</label>
                    <Input className="text-sm h-8" placeholder="target_id" value={emgTarget} onChange={e => setEmgTarget(e.target.value)} />
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">مدة الانتهاء (ساعات، اتركه فارغاً = دائم)</label>
                  <Input className="text-sm h-8" type="number" min="1" placeholder="مثال: 24" value={emgHours} onChange={e => setEmgHours(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">سبب الإجراء *</label>
                <Textarea className="text-sm min-h-[60px] resize-none" placeholder="اذكر سبباً واضحاً للإجراء الطارئ..." value={emgReason} onChange={e => setEmgReason(e.target.value)} />
              </div>
              <Button size="sm" variant="destructive" className="gap-2 text-sm"
                disabled={!emgOffice || !emgReason || applyLock.isPending}
                onClick={() => applyLock.mutate({ office_id: emgOffice, lock_type: emgType, target_id: emgTarget || undefined, reason: emgReason, expires_hours: emgHours ? Number(emgHours) : undefined })}>
                {applyLock.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                تطبيق القيد الطارئ
              </Button>
            </CardContent>
          </Card>

          {/* Active locks */}
          {emgLoading ? <Spinner /> : (() => {
            const active: any[] = emergencyData?.active ?? [];
            const history: any[] = emergencyData?.history ?? [];
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Lock className="h-4 w-4 text-red-500" />
                    القيود النشطة
                    {active.length > 0 && <span className="h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">{active.length}</span>}
                  </p>
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => refetchEmg()}><RefreshCw className="h-3.5 w-3.5" />تحديث</Button>
                </div>

                {active.length === 0
                  ? <EmptyState icon={Unlock} label="لا توجد قيود نشطة — المنصة تعمل بشكل طبيعي" />
                  : (
                    <div className="space-y-2">
                      {active.map((lock: any) => {
                        const lt = LOCK_TYPE_AR[lock.lock_type] ?? { label: lock.lock_type, icon: Lock, color: "text-zinc-500" };
                        return (
                          <Card key={lock.id} className="border-red-200 dark:border-red-900/50">
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-950/30 flex items-center justify-center shrink-0">
                                  <lt.icon className={`h-4 w-4 ${lt.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-semibold">{lt.label}</p>
                                    <span className="text-[10px] bg-red-100 dark:bg-red-950/30 text-red-600 px-1.5 rounded font-medium">نشط</span>
                                    {lock.office_name && <OfficeBadge name={lock.office_name} />}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">{lock.reason}</p>
                                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                                    {lock.target_id && <span>الهدف: <span className="font-mono">{lock.target_id}</span></span>}
                                    {lock.expires_at && <span>ينتهي: {new Date(lock.expires_at).toLocaleString("ar-SA")}</span>}
                                    <span className="mr-auto">{new Date(lock.created_at).toLocaleString("ar-SA")}</span>
                                  </div>
                                </div>
                                <Button size="sm" variant="outline" className="text-xs gap-1 shrink-0 border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                                  disabled={releaseLock.isPending}
                                  onClick={() => releaseLock.mutate(lock.id)}>
                                  <Unlock className="h-3.5 w-3.5" />رفع
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )
                }

                {/* History */}
                {history.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">سجل القيود المنتهية</p>
                    <div className="space-y-1.5">
                      {history.slice(0, 8).map((lock: any) => {
                        const lt = LOCK_TYPE_AR[lock.lock_type] ?? { label: lock.lock_type, icon: Lock, color: "text-zinc-500" };
                        return (
                          <div key={lock.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs opacity-70">
                            <lt.icon className={`h-3.5 w-3.5 ${lt.color} shrink-0`} />
                            <span className="font-medium">{lt.label}</span>
                            <span className="text-muted-foreground">{lock.office_name ?? lock.office_id}</span>
                            <span className="text-muted-foreground truncate flex-1">{lock.reason}</span>
                            <span className="text-[10px] shrink-0">{new Date(lock.released_at ?? lock.created_at).toLocaleDateString("ar-SA")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══════════════ 11. DEMO ENVIRONMENT ═══════════════ */}
      {subTab === "demo" && (
        <div className="space-y-5">
          {/* Status card */}
          {demoStatusLoading ? <Spinner /> : (
            <Card className={`border-2 ${demoStatus?.exists ? "border-emerald-400/60 bg-emerald-50/50 dark:bg-emerald-950/10" : "border-dashed border-border/50"}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Package className={`h-5 w-5 ${demoStatus?.exists ? "text-emerald-500" : "text-muted-foreground"}`} />
                      <h3 className="font-bold text-base">
                        {demoStatus?.exists ? "البيئة التجريبية نشطة" : "لا توجد بيانات تجريبية"}
                      </h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${demoStatus?.exists ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                        {demoStatus?.exists ? "مُفعَّل" : "غير مُفعَّل"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      جميع البيانات التجريبية محاطة بـ <code className="bg-muted px-1 rounded text-[10px]">is_demo = true</code> ويمكن حذفها دون أي تأثير على البيانات الحقيقية.
                    </p>
                    {demoStatus?.exists && (
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1.5">
                          <Landmark className="h-3.5 w-3.5 text-amber-500" />
                          <strong>{demoStatus?.north_cases}</strong> ملف — مكتب الشمال
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Landmark className="h-3.5 w-3.5 text-blue-500" />
                          <strong>{demoStatus?.south_cases}</strong> ملف — مكتب الجنوب
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={seedDemo.isPending}
                      onClick={() => seedDemo.mutate()}>
                      {seedDemo.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                      {demoStatus?.exists ? "إعادة زرع البيانات" : "زرع البيئة التجريبية"}
                    </Button>
                    {demoStatus?.exists && (
                      <Button size="sm" variant="destructive" className="gap-1.5 text-xs"
                        disabled={deleteDemo.isPending}
                        onClick={() => deleteDemo.mutate()}>
                        {deleteDemo.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        حذف البيئة التجريبية
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data plan grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* North */}
            <Card className="border-border/50">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-amber-500" />مكتب الشمال
                  <span className="text-[10px] font-normal text-muted-foreground mr-auto">aaaabbbb-0001-…-000000000001</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "ملفات إفلاس", value: 8, icon: Landmark, color: "text-amber-500" },
                    { label: "طلبات افتتاح", value: 3, icon: FilePlus2, color: "text-violet-500" },
                    { label: "دائنون", value: 45, icon: Users, color: "text-blue-500" },
                    { label: "مطالبات", value: 120, icon: FileText, color: "text-indigo-500" },
                    { label: "أصول", value: 35, icon: Archive, color: "text-teal-500" },
                    { label: "اجتماعات", value: 18, icon: Clock, color: "text-cyan-500" },
                    { label: "توزيعات", value: 6, icon: DollarSign, color: "text-emerald-500" },
                    { label: "تقارير", value: 25, icon: BarChart2, color: "text-orange-500" },
                    { label: "مهام", value: 40, icon: CheckCircle2, color: "text-pink-500" },
                    { label: "تنبيهات", value: 15, icon: AlertTriangle, color: "text-red-500" },
                  ].map(item => (
                    <div key={item.label} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30 text-center">
                      <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                      <span className="text-base font-black">{item.value}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* South */}
            <Card className="border-border/50">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />مكتب الجنوب
                  <span className="text-[10px] font-normal text-muted-foreground mr-auto">bbbbcccc-0002-…-000000000002</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "ملفات إفلاس", value: 6, icon: Landmark, color: "text-amber-500" },
                    { label: "طلبات افتتاح", value: 2, icon: FilePlus2, color: "text-violet-500" },
                    { label: "دائنون", value: 30, icon: Users, color: "text-blue-500" },
                    { label: "مطالبات", value: 75, icon: FileText, color: "text-indigo-500" },
                    { label: "أصول", value: 20, icon: Archive, color: "text-teal-500" },
                    { label: "اجتماعات", value: 12, icon: Clock, color: "text-cyan-500" },
                    { label: "توزيعات", value: 4, icon: DollarSign, color: "text-emerald-500" },
                    { label: "تقارير", value: 18, icon: BarChart2, color: "text-orange-500" },
                    { label: "مهام", value: 25, icon: CheckCircle2, color: "text-pink-500" },
                    { label: "تنبيهات", value: 10, icon: AlertTriangle, color: "text-red-500" },
                  ].map(item => (
                    <div key={item.label} className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/30 text-center">
                      <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                      <span className="text-base font-black">{item.value}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Companies seeded */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FilePlus2 className="h-4 w-4 text-violet-500" />طلبات الافتتاح التجريبية — الشركات المُولَّدة
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {[
                  { name: "شركة الأفق للاستثمار",    industry: "استثمار",  elig: 78, status: "ready_for_filing",     office: "شمال" },
                  { name: "شركة الوطن للمقاولات",    industry: "مقاولات",  elig: 65, status: "ai_analysis",          office: "شمال" },
                  { name: "شركة التطوير العمراني",   industry: "عقارات",   elig: 88, status: "under_legal_review",   office: "شمال" },
                  { name: "شركة الجزيرة التجارية",  industry: "تجارة",   elig: 72, status: "submitted_to_court",   office: "جنوب" },
                  { name: "شركة الأصالة للصناعة",  industry: "صناعة",   elig: 55, status: "documents_pending",    office: "جنوب" },
                ].map(co => (
                  <div key={co.name} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/20">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${co.elig >= 80 ? "bg-emerald-100 text-emerald-700" : co.elig >= 65 ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {co.elig}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{co.name}</p>
                      <p className="text-[10px] text-muted-foreground">{co.industry} · {co.office}</p>
                      <p className="text-[10px] text-muted-foreground">{REQ_STATUS_AR[co.status] ?? co.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Case statuses chart */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-amber-500" />توزيع حالات الملفات — البيئة التجريبية
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { label: "نشط",          value: 4 },
                    { label: "مراجعة مطالبات", value: 2 },
                    { label: "إدارة أصول",    value: 2 },
                    { label: "توزيع",          value: 2 },
                    { label: "مغلق",           value: 2 },
                    { label: "موقوف",          value: 1 },
                    { label: "مؤرشف",         value: 1 },
                  ]} barSize={28}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip formatter={(v) => [v, "ملفات"]} />
                    <Bar dataKey="value" radius={[4,4,0,0]}>
                      {[
                        "#10b981","#3b82f6","#f59e0b","#8b5cf6","#6b7280","#ef4444","#94a3b8"
                      ].map((c, i) => <Cell key={i} fill={c} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Warning box */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">ملاحظة مهمة</p>
              <p>البيانات مُخزَّنة في <strong>مكتب الشمال</strong> و<strong>مكتب الجنوب</strong> الفعليين مع تعليم <code className="bg-amber-100 dark:bg-amber-900/30 px-1 rounded text-[10px]">is_demo = true</code>. تظهر مباشرةً عند تسجيل الدخول بأي من المكتبين. زر "حذف البيئة التجريبية" يمسح السجلات المُعلَّمة فقط دون المساس بأي بيانات حقيقية.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Micro-components ── */
function Spinner() {
  return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}
function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className={`h-5 w-5 ${color} opacity-50`} />
        </div>
      </CardContent>
    </Card>
  );
}
function StatMini({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className="border-border/50"><CardContent className="p-3 text-center">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );
}
function EmptyState({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <Card className="border-border/50"><CardContent className="py-10 text-center text-muted-foreground text-sm">
      <Icon className="h-10 w-10 mx-auto mb-2 opacity-20" />{label}
    </CardContent></Card>
  );
}
function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input className="pr-8 text-sm h-8" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
function ClearFilter({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" className="text-xs gap-1 h-8" onClick={onClick}>
      <XCircle className="h-3.5 w-3.5" />إزالة فلتر المكتب
    </Button>
  );
}
function StatusBadge({ label, color }: { label: string; color: string }) {
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-${color}-100 text-${color}-700 dark:bg-${color}-950/30 dark:text-${color}-400`}>{label}</span>;
}
function OfficeBadge({ name }: { name: string }) {
  return (
    <span className="text-[10px] text-muted-foreground border border-border/50 px-1.5 rounded flex items-center gap-0.5">
      <Building2 className="h-2.5 w-2.5" />{name}
    </span>
  );
}
function ReadinessRing({ score }: { score: number | null }) {
  const s = score ?? 0;
  const color = s >= 80 ? 'bg-emerald-500' : s >= 50 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className={`h-9 w-9 rounded-xl ${color} flex items-center justify-center shrink-0 text-white text-xs font-bold`}>
      {score != null ? `${s}%` : "—"}
    </div>
  );
}
