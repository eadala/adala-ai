/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";
import {
  Users, Star, TrendingUp, TrendingDown, DollarSign, Award,
  AlertCircle, Plus, Trash2, Sparkles, BarChart3, Brain,
  CheckCircle2, XCircle, Minus, Target, Zap, ChevronUp, ChevronDown,
  UserCheck, Scale, ClipboardList, Settings, Calculator,
  Briefcase, ArrowUpRight, Medal, Info, RefreshCw, Download,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ══════════════════════════════════════════════ TYPES */
interface Employee { id: string; full_name: string; job_title: string; department: string; salary: string; status: string }
interface Evaluation { id: number; employee_id: string; employee_name: string; job_title: string; period: string; performance_score: number; role: string; cases_closed: number; cases_delayed: number; tasks_completed: number; errors: number; on_time_days: number; late_days: number; absent_days: number; notes?: string; created_at: string }
interface Incentive { id: number; employee_id: string; employee_name: string; job_title: string; type: string; amount: number; reason: string; period?: string; created_at: string }

/* ══════════════════════════════════════════════ CONSTANTS */
const ROLES = [
  { value: "lawyer",    label: "محامي" },
  { value: "secretary", label: "سكرتير" },
  { value: "admin",     label: "إداري" },
  { value: "accountant",label: "محاسب" },
];

const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const currYear = new Date().getFullYear();
const currMonth = MONTHS_AR[new Date().getMonth()];

function scoreColor(s: number) {
  if (s >= 90) return { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", bar: "bg-emerald-500", label: "ممتاز" };
  if (s >= 80) return { text: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30",    bar: "bg-blue-500",    label: "جيد جداً" };
  if (s >= 70) return { text: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/30", bar: "bg-yellow-500", label: "جيد" };
  if (s >= 60) return { text: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30", bar: "bg-orange-400", label: "مقبول" };
  return { text: "text-red-400", bg: "bg-red-500/10 border-red-500/30", bar: "bg-red-500", label: "يحتاج تحسين" };
}

function fmt(n: number) { return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 }); }

/* ══════════════════════════════════════════════ SCORE PREVIEW */
function calcScoreLocal(form: any): number {
  let score = 100;
  const role = form.role ?? "lawyer";
  if (role === "secretary") {
    score += (form.tasksCompleted ?? 0) * 3;
    score += (form.clientsHandled ?? 0) * 2;
    score -= (form.dataErrors ?? 0) * 8;
    score -= (form.errors ?? 0) * 5;
  } else if (role === "admin") {
    score += (form.opsHandled ?? 0) * 4;
    score += (form.incidentsResolved ?? 0) * 5;
    score -= (form.systemErrors ?? 0) * 6;
    score -= (form.errors ?? 0) * 4;
  } else {
    score += (form.casesClosed ?? 0) * 5;
    score -= (form.casesDelayed ?? 0) * 8;
    score += (form.tasksCompleted ?? 0) * 2;
    score -= (form.errors ?? 0) * 7;
  }
  score += (form.onTimeDays ?? 0) * 3;
  score -= (form.lateDays ?? 0) * 5;
  score -= (form.absentDays ?? 0) * 10;
  return Math.max(0, Math.min(100, score));
}

/* ══════════════════════════════════════════════ EVAL DIALOG */
function EvalDialog({ open, onClose, employees }: { open: boolean; onClose: () => void; employees: Employee[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    employeeId: "", period: `${currMonth} ${currYear}`, role: "lawyer",
    casesClosed: 0, casesDelayed: 0, tasksCompleted: 0, errors: 0,
    onTimeDays: 0, lateDays: 0, absentDays: 0,
    clientsHandled: 0, dataErrors: 0,
    opsHandled: 0, incidentsResolved: 0, systemErrors: 0,
    notes: "",
  });

  const preview = useMemo(() => calcScoreLocal(form), [form]);
  const sc = scoreColor(preview);
  const num = (k: string) => parseInt((form as any)[k] ?? "0") || 0;
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: typeof v === "string" ? (parseInt(v) || 0) : v }));
  const updStr = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`${BASE}/api/hr-perf/evaluate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId, period: form.period, role: form.role,
          casesClosed: num("casesClosed"), casesDelayed: num("casesDelayed"),
          tasksCompleted: num("tasksCompleted"), errors: num("errors"),
          onTimeDays: num("onTimeDays"), lateDays: num("lateDays"), absentDays: num("absentDays"),
          clientsHandled: num("clientsHandled"), dataErrors: num("dataErrors"),
          opsHandled: num("opsHandled"), incidentsResolved: num("incidentsResolved"),
          systemErrors: num("systemErrors"), notes: form.notes,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast({ title: "✅ تم حفظ التقييم" });
      qc.invalidateQueries({ queryKey: ["hr-evaluations"] });
      qc.invalidateQueries({ queryKey: ["hr-dashboard"] });
      qc.invalidateQueries({ queryKey: ["smart-payroll"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const emp = employees.find(e => e.id === form.employeeId);
  if (emp && form.role === "lawyer" && !ROLES.some(r => r.value === form.role)) updStr("role", "lawyer");

  return (
    <AdaptiveDialog open={open} onOpenChange={onClose}>
      <AdaptiveDialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Star className="h-5 w-5 text-yellow-400" />
            إضافة تقييم أداء
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2 border-b border-border/50">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الموظف *</Label>
            <Select value={form.employeeId} onValueChange={v => updStr("employeeId", v)}>
              <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>{employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الفترة</Label>
            <Input value={form.period} onChange={e => updStr("period", e.target.value)} placeholder="مايو 2026" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">الدور الوظيفي</Label>
            <Select value={form.role} onValueChange={v => updStr("role", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Score Preview */}
        <div className={`rounded-xl border p-3 flex items-center gap-4 ${sc.bg}`}>
          <div className="text-center shrink-0">
            <div className={`text-4xl font-black ${sc.text}`}>{preview}</div>
            <div className="text-[10px] text-muted-foreground">/ 100</div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className={`font-semibold ${sc.text}`}>{sc.label}</span>
              <span className="text-muted-foreground">معاينة فورية</span>
            </div>
            <Progress value={preview} className="h-2" />
            <p className="text-[10px] text-muted-foreground mt-1">
              {preview >= 90 ? "مكافأة 30% من الراتب" : preview >= 80 ? "مكافأة 20% من الراتب" : preview >= 70 ? "مكافأة 10% من الراتب" : preview < 60 ? "خصم 15% من الراتب" : "بدون مكافأة أو خصم"}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-3">
          {/* CASE METRICS - lawyers + accountants */}
          {(form.role === "lawyer" || form.role === "accountant") && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Scale className="h-3.5 w-3.5" />مؤشرات القضايا</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { k: "casesClosed",   label: "قضايا مغلقة",    bonus: true,  pts: "+5 لكل" },
                  { k: "casesDelayed",  label: "قضايا متأخرة",   bonus: false, pts: "-8 لكل" },
                  { k: "tasksCompleted",label: "مهام منجزة",     bonus: true,  pts: "+2 لكل" },
                ].map(f => (
                  <div key={f.k} className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1">
                      {f.bonus ? <ChevronUp className="h-3 w-3 text-emerald-400" /> : <ChevronDown className="h-3 w-3 text-red-400" />}
                      {f.label} <span className="text-muted-foreground">({f.pts})</span>
                    </Label>
                    <Input type="number" min="0" value={(form as any)[f.k]} onChange={e => upd(f.k, e.target.value)} className="h-8 text-xs" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECRETARY METRICS */}
          {form.role === "secretary" && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />مؤشرات السكرتير</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { k: "tasksCompleted",  label: "مهام مكتملة",   bonus: true,  pts: "+3 لكل" },
                  { k: "clientsHandled",  label: "عملاء خُدموا",  bonus: true,  pts: "+2 لكل" },
                  { k: "dataErrors",      label: "أخطاء بيانات",  bonus: false, pts: "-8 لكل" },
                ].map(f => (
                  <div key={f.k} className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1">
                      {f.bonus ? <ChevronUp className="h-3 w-3 text-emerald-400" /> : <ChevronDown className="h-3 w-3 text-red-400" />}
                      {f.label} <span className="text-muted-foreground">({f.pts})</span>
                    </Label>
                    <Input type="number" min="0" value={(form as any)[f.k]} onChange={e => upd(f.k, e.target.value)} className="h-8 text-xs" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADMIN METRICS */}
          {form.role === "admin" && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />مؤشرات الإداري</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { k: "opsHandled",         label: "عمليات مُنجزة",   bonus: true,  pts: "+4 لكل" },
                  { k: "incidentsResolved",   label: "مشكلات محلولة",  bonus: true,  pts: "+5 لكل" },
                  { k: "systemErrors",        label: "أخطاء تشغيل",   bonus: false, pts: "-6 لكل" },
                ].map(f => (
                  <div key={f.k} className="space-y-1">
                    <Label className="text-[10px] flex items-center gap-1">
                      {f.bonus ? <ChevronUp className="h-3 w-3 text-emerald-400" /> : <ChevronDown className="h-3 w-3 text-red-400" />}
                      {f.label} <span className="text-muted-foreground">({f.pts})</span>
                    </Label>
                    <Input type="number" min="0" value={(form as any)[f.k]} onChange={e => upd(f.k, e.target.value)} className="h-8 text-xs" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ATTENDANCE */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><UserCheck className="h-3.5 w-3.5" />الدوام والالتزام</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { k: "onTimeDays",  label: "أيام الحضور",   bonus: true,  pts: "+3 لكل" },
                { k: "lateDays",    label: "أيام التأخير",  bonus: false, pts: "-5 لكل" },
                { k: "absentDays",  label: "أيام الغياب",   bonus: false, pts: "-10 لكل" },
              ].map(f => (
                <div key={f.k} className="space-y-1">
                  <Label className="text-[10px] flex items-center gap-1">
                    {f.bonus ? <ChevronUp className="h-3 w-3 text-emerald-400" /> : <ChevronDown className="h-3 w-3 text-red-400" />}
                    {f.label} <span className="text-muted-foreground">({f.pts})</span>
                  </Label>
                  <Input type="number" min="0" value={(form as any)[f.k]} onChange={e => upd(f.k, e.target.value)} className="h-8 text-xs" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">ملاحظات</Label>
            <Textarea placeholder="ملاحظات التقييم..." value={form.notes} onChange={e => updStr("notes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.employeeId || mut.isPending}>
            {mut.isPending ? "جارٍ الحفظ..." : "حفظ التقييم"}
          </Button>
        </DialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ══════════════════════════════════════════════ INCENTIVE DIALOG */
function IncentiveDialog({ open, onClose, employees }: { open: boolean; onClose: () => void; employees: Employee[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ employeeId: "", type: "bonus", amount: "", reason: "", period: `${currMonth} ${currYear}` });
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`${BASE}/api/hr-perf/incentives`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: form.employeeId, type: form.type, amount: parseFloat(form.amount), reason: form.reason, period: form.period }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast({ title: form.type === "bonus" ? "✅ تمت إضافة المكافأة" : "✅ تمت إضافة الخصم" });
      qc.invalidateQueries({ queryKey: ["hr-incentives"] });
      qc.invalidateQueries({ queryKey: ["smart-payroll"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <AdaptiveDialog open={open} onOpenChange={onClose}>
      <AdaptiveDialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            {form.type === "bonus" ? "إضافة مكافأة" : "إضافة خصم"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">النوع</Label>
              <Select value={form.type} onValueChange={v => upd("type", v)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus"><span className="text-emerald-400">مكافأة ↑</span></SelectItem>
                  <SelectItem value="deduction"><span className="text-red-400">خصم ↓</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">الفترة</Label>
              <Input value={form.period} onChange={e => upd("period", e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">الموظف *</Label>
            <Select value={form.employeeId} onValueChange={v => upd("employeeId", v)}>
              <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
              <SelectContent>{employees.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">المبلغ (ريال) *</Label>
            <Input type="number" min="0" value={form.amount} onChange={e => upd("amount", e.target.value)} placeholder="500" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">السبب</Label>
            <Input value={form.reason} onChange={e => upd("reason", e.target.value)} placeholder="سبب المكافأة أو الخصم..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.employeeId || !form.amount || mut.isPending}>
            {mut.isPending ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ══════════════════════════════════════════════ MAIN */
export default function HRCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard");
  const [evalDialog, setEvalDialog] = useState(false);
  const [incDialog, setIncDialog] = useState(false);
  const [payPeriod, setPayPeriod] = useState(`${currMonth} ${currYear}`);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["hr-employees-list"],
    queryFn: () => authFetch(`${BASE}/api/hr/employees`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });
  const activeEmps = employees.filter(e => e.status === "active");

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useQuery<any>({
    queryKey: ["hr-dashboard"],
    queryFn: () => authFetch(`${BASE}/api/hr-perf/dashboard`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: evaluations = [], isLoading: evalLoading } = useQuery<Evaluation[]>({
    queryKey: ["hr-evaluations"],
    queryFn: () => authFetch(`${BASE}/api/hr-perf/evaluations`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: incentives = [], isLoading: incLoading } = useQuery<Incentive[]>({
    queryKey: ["hr-incentives"],
    queryFn: () => authFetch(`${BASE}/api/hr-perf/incentives`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: smartPayroll, isLoading: payLoading, refetch: refetchPay } = useQuery<any>({
    queryKey: ["smart-payroll", payPeriod],
    queryFn: () => authFetch(`${BASE}/api/hr-perf/smart-payroll/preview?period=${encodeURIComponent(payPeriod)}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const delEval = useMutation({
    mutationFn: (id: number) => authFetch(`${BASE}/api/hr-perf/evaluations/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-evaluations"] }); qc.invalidateQueries({ queryKey: ["hr-dashboard"] }); toast({ title: "تم حذف التقييم" }); },
  });

  const delInc = useMutation({
    mutationFn: (id: number) => authFetch(`${BASE}/api/hr-perf/incentives/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-incentives"] }); toast({ title: "تم الحذف" }); },
  });

  const topEmps = useMemo(() => {
    const map = new Map<string, { name: string; job: string; score: number; count: number }>();
    for (const e of evaluations) {
      const ex = map.get(e.employee_id);
      if (!ex) map.set(e.employee_id, { name: e.employee_name, job: e.job_title, score: e.performance_score, count: 1 });
      else { ex.score = Math.max(ex.score, e.performance_score); ex.count++; }
    }
    return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [evaluations]);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            مركز الموارد البشرية
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تقييم الأداء · الحوافز والخصومات · الرواتب الذكية · تحليلات AI</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setIncDialog(true)} className="gap-1.5">
            <Award className="h-3.5 w-3.5" />حافز / خصم
          </Button>
          <Button size="sm" onClick={() => setEvalDialog(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />تقييم جديد
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto p-1 bg-muted/50 rounded-xl gap-0.5 flex-wrap">
          <TabsTrigger value="dashboard" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />لوحة التحكم</TabsTrigger>
          <TabsTrigger value="evaluation" className="text-xs gap-1.5"><Star className="h-3.5 w-3.5" />التقييمات</TabsTrigger>
          <TabsTrigger value="incentives" className="text-xs gap-1.5"><Award className="h-3.5 w-3.5" />الحوافز</TabsTrigger>
          <TabsTrigger value="payroll" className="text-xs gap-1.5"><Calculator className="h-3.5 w-3.5" />الرواتب الذكية</TabsTrigger>
          <TabsTrigger value="insights" className="text-xs gap-1.5"><Brain className="h-3.5 w-3.5" />تحليلات AI</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs gap-1.5"><Settings className="h-3.5 w-3.5" />الإعدادات</TabsTrigger>
        </TabsList>

        {/* ══ DASHBOARD ══ */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "موظفون نشطون",  value: dashboard?.empCount ?? activeEmps.length,                icon: Users,       color: "#6366F1" },
              { label: "متوسط الأداء",  value: `${Math.round(dashboard?.avgScore ?? 0)}%`,              icon: Target,      color: "#10B981" },
              { label: "مكافآت مسجّلة", value: `${fmt(dashboard?.bonusTotal ?? 0)} ر.س`,              icon: TrendingUp,  color: "#2563EB" },
              { label: "خصومات مسجّلة", value: `${fmt(dashboard?.deductTotal ?? 0)} ر.س`,             icon: TrendingDown, color: "#EF4444" },
            ].map(c => (
              <div key={c.label} className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${c.color}15` }}>
                  <c.icon className="h-5 w-5" style={{ color: c.color }} />
                </div>
                <div>
                  <div className="text-lg font-bold">{c.value}</div>
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Performers */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Medal className="h-4 w-4 text-yellow-400" />
                  أفضل 5 موظفين أداءً
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashLoading ? Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-12 rounded-xl" />) :
                 topEmps.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">لا توجد تقييمات بعد — أضف أول تقييم</div>
                ) : topEmps.map((emp, i) => {
                  const sc = scoreColor(emp.score);
                  return (
                    <div key={emp.name} className="flex items-center gap-3 rounded-xl border border-border/40 px-3 py-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? "bg-yellow-500/20 text-yellow-400" : i === 1 ? "bg-slate-400/20 text-muted-foreground" : "bg-amber-700/20 text-amber-600"}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{emp.name}</p>
                        <p className="text-[10px] text-muted-foreground">{emp.job}</p>
                      </div>
                      <div className="text-left shrink-0">
                        <div className={`text-sm font-bold ${sc.text}`}>{emp.score}%</div>
                        <div className="text-[9px] text-muted-foreground">{emp.count} تقييم</div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Need Attention */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-400" />
                  يحتاجون اهتماماً (أداء &lt; 70%)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dashLoading ? Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-12 rounded-xl" />) :
                 (dashboard?.needAttention ?? []).length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400/50" />
                    <p className="text-sm text-muted-foreground">جميع الموظفين بأداء جيد ✓</p>
                  </div>
                ) : (dashboard?.needAttention ?? []).map((emp: any) => (
                  <div key={emp.employee_id} className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
                    <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{emp.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{emp.job_title}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30 shrink-0">
                      {Math.round(emp.performance_score)}%
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Recent Evals */}
          {(dashboard?.recentEvals ?? []).length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  آخر التقييمات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 border-b border-border/50">
                    <tr>
                      <th className="text-right px-4 py-2 font-semibold">الموظف</th>
                      <th className="text-right px-4 py-2 font-semibold">الفترة</th>
                      <th className="text-right px-4 py-2 font-semibold">الأداء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(dashboard.recentEvals ?? []).map((ev: any) => {
                      const sc = scoreColor(parseFloat(ev.performance_score));
                      return (
                        <tr key={ev.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2 font-medium">{ev.employee_name}</td>
                          <td className="px-4 py-2 text-muted-foreground">{ev.period}</td>
                          <td className="px-4 py-2">
                            <span className={`font-bold ${sc.text}`}>{parseFloat(ev.performance_score).toFixed(0)}%</span>
                            <span className="text-muted-foreground me-1">— {sc.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ EVALUATIONS TAB ══ */}
        <TabsContent value="evaluation" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{evaluations.length} تقييم مسجّل</p>
            <Button size="sm" onClick={() => setEvalDialog(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />تقييم جديد
            </Button>
          </div>

          {evalLoading ? (
            <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : evaluations.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/50 py-20 text-center">
              <Star className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">لا توجد تقييمات بعد</p>
              <Button size="sm" className="mt-4 gap-1.5" onClick={() => setEvalDialog(true)}><Plus className="h-3.5 w-3.5" />أضف أول تقييم</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {evaluations.map(ev => {
                const sc = scoreColor(ev.performance_score);
                return (
                  <div key={ev.id} className={`rounded-xl border p-4 ${sc.bg}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-sm">{ev.employee_name}</p>
                        <p className="text-[10px] text-muted-foreground">{ev.job_title} · {ev.period}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-center">
                          <div className={`text-2xl font-black ${sc.text}`}>{Math.round(ev.performance_score)}</div>
                          <div className={`text-[9px] ${sc.text}`}>{sc.label}</div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => delEval.mutate(ev.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={ev.performance_score} className="h-1.5 mb-2" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs font-bold text-emerald-400">{ev.cases_closed}</div>
                        <div className="text-[9px] text-muted-foreground">قضايا مغلقة</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-red-400">{ev.cases_delayed}</div>
                        <div className="text-[9px] text-muted-foreground">متأخرة</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-400">{ev.tasks_completed}</div>
                        <div className="text-[9px] text-muted-foreground">مهام</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-orange-400">{ev.late_days}</div>
                        <div className="text-[9px] text-muted-foreground">تأخير</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-red-400">{ev.absent_days}</div>
                        <div className="text-[9px] text-muted-foreground">غياب</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-400">{ev.on_time_days}</div>
                        <div className="text-[9px] text-muted-foreground">حضور</div>
                      </div>
                    </div>
                    {ev.notes && <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/40 pt-2">{ev.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ══ INCENTIVES TAB ══ */}
        <TabsContent value="incentives" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{incentives.length} سجل حافز / خصم</p>
            <Button size="sm" onClick={() => setIncDialog(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />إضافة
            </Button>
          </div>

          {incLoading ? (
            <div className="space-y-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : incentives.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/50 py-16 text-center">
              <Award className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">لا توجد مكافآت أو خصومات مسجّلة</p>
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border/50">
                    <tr>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">الموظف</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold hidden sm:table-cell">الفترة</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">النوع</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold">المبلغ</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold hidden md:table-cell">السبب</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {incentives.map(inc => (
                      <tr key={inc.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-xs">{inc.employee_name}</p>
                          <p className="text-[10px] text-muted-foreground">{inc.job_title}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{inc.period ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {inc.type === "bonus"
                            ? <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10"><TrendingUp className="h-3 w-3 ms-1" />مكافأة</Badge>
                            : <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30 bg-red-500/10"><TrendingDown className="h-3 w-3 ms-1" />خصم</Badge>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`font-bold text-sm ${inc.type === "bonus" ? "text-emerald-400" : "text-red-400"}`}>
                            {inc.type === "bonus" ? "+" : "-"}{fmt(inc.amount)} ر.س
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-muted-foreground hidden md:table-cell max-w-[150px] truncate">{inc.reason}</td>
                        <td className="px-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => delInc.mutate(inc.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ SMART PAYROLL ══ */}
        <TabsContent value="payroll" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Input
                value={payPeriod}
                onChange={e => setPayPeriod(e.target.value)}
                className="h-8 w-44 text-xs"
                placeholder="مايو 2026"
              />
              <Button size="sm" variant="outline" onClick={() => refetchPay()} className="gap-1 h-8">
                <RefreshCw className="h-3.5 w-3.5" />حساب
              </Button>
            </div>
            {smartPayroll && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">الإجمالي:</span>
                <span className="font-bold text-lg text-primary">{fmt(smartPayroll.totalNet)} ر.س</span>
                <Badge variant="outline" className="text-[10px]">متوسط الأداء: {smartPayroll.avgScore}%</Badge>
              </div>
            )}
          </div>

          {payLoading ? (
            <div className="space-y-2">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : !smartPayroll?.employees?.length ? (
            <div className="rounded-2xl border-2 border-dashed border-border/50 py-16 text-center">
              <Calculator className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">لا يوجد موظفون نشطون أو لم يتم الحساب بعد</p>
            </div>
          ) : (
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[700px]">
                    <thead className="bg-muted/30 border-b border-border/50">
                      <tr>
                        <th className="text-right px-4 py-2.5 font-semibold">الموظف</th>
                        <th className="text-right px-4 py-2.5 font-semibold">الأساسي</th>
                        <th className="text-right px-4 py-2.5 font-semibold">الأداء</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-emerald-400">مكافأة</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-red-400">خصومات</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-orange-400">GOSI</th>
                        <th className="text-right px-4 py-2.5 font-semibold text-primary">الصافي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {smartPayroll.employees.map((emp: any) => {
                        const sc = scoreColor(emp.performanceScore);
                        return (
                          <tr key={emp.employeeId} className="hover:bg-muted/20">
                            <td className="px-4 py-3">
                              <p className="font-semibold">{emp.employeeName}</p>
                              <p className="text-[10px] text-muted-foreground">{emp.jobTitle}</p>
                              {!emp.hasEvaluation && (
                                <Badge variant="outline" className="text-[9px] text-yellow-400 border-yellow-500/30 mt-0.5">بدون تقييم</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium">{fmt(emp.baseSalary)}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${sc.text}`}>{Math.round(emp.performanceScore)}%</span>
                              <div className="text-[9px] text-muted-foreground">{sc.label}</div>
                            </td>
                            <td className="px-4 py-3 text-emerald-400 font-semibold">
                              {emp.performanceBonus + emp.manualBonus > 0 ? `+${fmt(emp.performanceBonus + emp.manualBonus)}` : <Minus className="h-3 w-3 text-muted-foreground" />}
                            </td>
                            <td className="px-4 py-3 text-red-400 font-semibold">
                              {emp.deduction > 0 ? `-${fmt(emp.deduction)}` : <Minus className="h-3 w-3 text-muted-foreground" />}
                            </td>
                            <td className="px-4 py-3 text-orange-400">{fmt(emp.gosi)}</td>
                            <td className="px-4 py-3">
                              <span className="font-black text-sm text-primary">{fmt(emp.netSalary)}</span>
                              <span className="text-[9px] text-muted-foreground me-1">ر.س</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t border-border/50 bg-muted/30">
                      <tr>
                        <td className="px-4 py-2.5 font-bold text-xs" colSpan={6}>الإجمالي الكلي</td>
                        <td className="px-4 py-2.5 font-black text-sm text-primary">{fmt(smartPayroll.totalNet)} ر.س</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ AI INSIGHTS ══ */}
        <TabsContent value="insights" className="mt-4 space-y-4">
          <div className="rounded-xl bg-gradient-to-l from-primary/5 to-purple-500/5 border border-primary/20 p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm mb-1">تحليل ذكي للموارد البشرية</p>
              <p className="text-xs text-muted-foreground">بناءً على بيانات التقييمات والدوام والأداء — محدّث تلقائياً</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetchDash()} className="shrink-0 h-8 gap-1">
              <RefreshCw className="h-3.5 w-3.5" />تحديث
            </Button>
          </div>

          {/* Insights Cards */}
          <div className="space-y-3">
            {dashLoading ? Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-16 rounded-xl" />) :
             (dashboard?.insights ?? []).map((insight: string, i: number) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card px-4 py-3 flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>

          {/* Score Distribution */}
          {evaluations.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  توزيع مستويات الأداء
                </CardTitle>
              </CardHeader>
              <CardContent>
                {[
                  { label: "ممتاز (≥90%)",     min: 90, max: 101, color: "#10B981" },
                  { label: "جيد جداً (80-89%)", min: 80, max: 90,  color: "#3B82F6" },
                  { label: "جيد (70-79%)",      min: 70, max: 80,  color: "#F59E0B" },
                  { label: "مقبول (60-69%)",    min: 60, max: 70,  color: "#F97316" },
                  { label: "يحتاج تطوير (<60%)",min: 0,  max: 60,  color: "#EF4444" },
                ].map(tier => {
                  const cnt = evaluations.filter(e => e.performance_score >= tier.min && e.performance_score < tier.max).length;
                  const pct = evaluations.length > 0 ? (cnt / evaluations.length) * 100 : 0;
                  return (
                    <div key={tier.label} className="flex items-center gap-3 mb-2">
                      <div className="w-28 text-[11px] text-muted-foreground shrink-0">{tier.label}</div>
                      <div className="flex-1 h-4 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tier.color }} />
                      </div>
                      <div className="w-14 text-right text-xs font-bold shrink-0">{cnt} تقييم</div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ SETTINGS ══ */}
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>

      <EvalDialog open={evalDialog} onClose={() => setEvalDialog(false)} employees={activeEmps} />
      <IncentiveDialog open={incDialog} onClose={() => setIncDialog(false)} employees={activeEmps} />
    </div>
  );
}

/* ══════════════════════════════════════════════ SETTINGS TAB */
function SettingsTab() {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: cfg, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["hr-perf-settings"],
    queryFn: () => authFetch(`${BASE}/api/hr-perf/settings`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d: any) => setForm(d),
  } as any);

  const mut = useMutation({
    mutationFn: () => authFetch(`${BASE}/api/hr-perf/settings`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => toast({ title: "✅ تم حفظ الإعدادات" }),
  });

  if (isLoading) return <div className="space-y-2">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-12 rounded-xl" />)}</div>;

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const sections = [
    {
      title: "حدود المكافآت",
      fields: [
        { k: "threshold_excellent",   label: "الحد الأدنى للممتاز (%)" },
        { k: "threshold_good",        label: "الحد الأدنى للجيد جداً (%)" },
        { k: "threshold_above_avg",   label: "الحد الأدنى للجيد (%)" },
      ],
    },
    {
      title: "نسب المكافآت",
      fields: [
        { k: "bonus_rate_excellent",  label: "مكافأة الممتاز (نسبة)" },
        { k: "bonus_rate_good",       label: "مكافأة الجيد جداً (نسبة)" },
        { k: "bonus_rate_above_avg",  label: "مكافأة الجيد (نسبة)" },
      ],
    },
    {
      title: "الخصومات",
      fields: [
        { k: "deduct_late_threshold", label: "حد أيام التأخير للخصم" },
        { k: "deduct_late_rate",      label: "نسبة خصم التأخير" },
        { k: "deduct_absent_threshold",label: "حد أيام الغياب للخصم" },
        { k: "deduct_absent_rate",    label: "نسبة خصم الغياب" },
        { k: "deduct_poor_threshold", label: "حد الأداء الضعيف للخصم (%)" },
        { k: "deduct_poor_rate",      label: "نسبة خصم الأداء الضعيف" },
      ],
    },
    {
      title: "إعدادات الراتب",
      fields: [
        { k: "gosi_rate",       label: "نسبة التأمينات الاجتماعية (GOSI)" },
        { k: "allowance_rate",  label: "نسبة البدلات" },
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-start gap-2">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">هذه الإعدادات تحكم آلية حساب الرواتب الذكية والمكافآت والخصومات.</p>
      </div>
      {sections.map(sec => (
        <Card key={sec.title} className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground">{sec.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sec.fields.map(f => (
                <div key={f.k} className="space-y-1">
                  <Label className="text-[11px]">{f.label}</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={form[f.k] ?? cfg?.[f.k] ?? ""}
                    onChange={e => upd(f.k, e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="gap-2">
        {mut.isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
      </Button>
    </div>
  );
}
