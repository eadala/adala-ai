import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Landmark, LayoutDashboard, Users, FileText, Building2,
  CalendarDays, TrendingDown, BarChart3, Bot, Settings,
  Plus, RefreshCw, Loader2, AlertTriangle, CheckCircle2,
  Clock, Archive, Scale, Banknote, Brain, ChevronLeft,
  ChevronRight, Trash2, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  active:    { label: "نشط",     color: "bg-blue-100 text-blue-700" },
  suspended: { label: "موقوف",   color: "bg-amber-100 text-amber-700" },
  closed:    { label: "مغلق",    color: "bg-zinc-100 text-zinc-600" },
  archived:  { label: "مؤرشف",  color: "bg-slate-100 text-slate-500" },
  pending:   { label: "معلق",    color: "bg-amber-100 text-amber-700" },
  approved:  { label: "مقبول",   color: "bg-emerald-100 text-emerald-700" },
  rejected:  { label: "مرفوض",  color: "bg-red-100 text-red-700" },
  paid:      { label: "مدفوع",   color: "bg-emerald-100 text-emerald-700" },
  scheduled: { label: "مجدول",   color: "bg-blue-100 text-blue-700" },
  completed: { label: "مكتمل",  color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "ملغي",   color: "bg-red-100 text-red-700" },
  draft:     { label: "مسودة",  color: "bg-zinc-100 text-zinc-600" },
  executed:  { label: "منفذ",    color: "bg-emerald-100 text-emerald-700" },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, color: "bg-zinc-100 text-zinc-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>;
}

/* ══════════════════════════════════════════════════════════
   SIDEBAR NAVIGATION
══════════════════════════════════════════════════════════ */
const SECTIONS = [
  { id: "dashboard",     label: "لوحة التحكم",   icon: LayoutDashboard },
  { id: "cases",         label: "ملفات الإفلاس",  icon: Landmark },
  { id: "creditors",     label: "الدائنون",        icon: Users },
  { id: "claims",        label: "المطالبات",       icon: FileText },
  { id: "assets",        label: "الأصول",          icon: Building2 },
  { id: "meetings",      label: "الاجتماعات",      icon: CalendarDays },
  { id: "distributions", label: "التوزيعات",       icon: TrendingDown },
  { id: "reports",       label: "التقارير",         icon: BarChart3 },
  { id: "ai",            label: "الذكاء الاصطناعي", icon: Bot },
];

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════ */
export default function BankruptcyPage() {
  const [section, setSection] = useState("dashboard");
  const [selectedCase, setSelectedCase] = useState<BkCase | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border/50 bg-card" dir="rtl">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-52" : "w-14"} flex-shrink-0 border-l border-border/50 bg-muted/30 flex flex-col transition-all duration-200`}>
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
          {SECTIONS.map(s => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium transition-all
                  ${active ? "bg-amber-500/10 text-amber-700 border-l-2 border-amber-500" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"}`}>
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{s.label}</span>}
              </button>
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
        {section === "dashboard"     && <DashboardSection onSelectCase={(c) => { setSelectedCase(c); setSection("cases"); }} />}
        {section === "cases"         && <CasesSection selectedCase={selectedCase} onSelectCase={setSelectedCase} />}
        {section === "creditors"     && <CreditorsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "claims"        && <ClaimsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "assets"        && <AssetsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "meetings"      && <MeetingsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "distributions" && <DistributionsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "reports"       && <ReportsSection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
        {section === "ai"            && <AISection selectedCase={selectedCase} onNeedCase={() => setSection("cases")} />}
      </main>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-claims"] }); setShowForm(false); toast.success("تم إضافة المطالبة"); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-assets"] }); setShowForm(false); toast.success("تم إضافة الأصل"); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-meetings"] }); setShowForm(false); toast.success("تم جدولة الاجتماع"); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-distributions"] }); setShowForm(false); toast.success("تم إنشاء جولة التوزيع"); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bk-reports"] }); setShowForm(false); toast.success("تم إنشاء التقرير"); },
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
