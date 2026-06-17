import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, AlertTriangle, Clock, Search, Send, CreditCard,
  Mail, Phone, Calendar, Loader2, CheckCircle2, ExternalLink,
  TrendingUp, Receipt, Filter, BarChart3, Users, Activity,
  Check, Minus, X, RefreshCw, Target, Layers, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function fmtSAR(n: number) {
  const r = n / 100;
  return r.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}
function isOverdue(inv: any) {
  return inv.status === "overdue" || (inv.status === "sent" && inv.due_date && new Date(inv.due_date) < new Date());
}
function daysLate(inv: any) {
  if (!inv.due_date) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000));
}

const STAGES: Record<number, { label: string; color: string; bg: string; border: string }> = {
  0: { label: "جديدة",        color: "#64748B", bg: "bg-muted/30 15", border: "border-slate-500/25"  },
  1: { label: "تواصل أولي",   color: "#3B82F6", bg: "bg-blue-500/15",  border: "border-blue-500/25"   },
  2: { label: "تذكير ثاني",   color: "#F59E0B", bg: "bg-amber-500/15", border: "border-amber-500/25"  },
  3: { label: "إشعار أخير",   color: "#F97316", bg: "bg-orange-500/15",border: "border-orange-500/25" },
  4: { label: "إجراء قانوني", color: "#EF4444", bg: "bg-red-500/15",   border: "border-red-500/25"    },
};

const AGING_BUCKETS = [
  { key: "bucket30",   label: "0-30 يوم",  color: "#3B82F6", light: "rgba(59,130,246,0.12)"  },
  { key: "bucket60",   label: "31-60 يوم", color: "#F59E0B", light: "rgba(245,158,11,0.12)"  },
  { key: "bucket90",   label: "61-90 يوم", color: "#F97316", light: "rgba(249,115,22,0.12)"  },
  { key: "bucketPlus", label: "+90 يوم",   color: "#EF4444", light: "rgba(239,68,68,0.12)"   },
];

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "cash",          label: "نقداً"        },
  { value: "check",         label: "شيك"          },
  { value: "card",          label: "بطاقة ائتمانية" },
  { value: "online",        label: "دفع إلكتروني"  },
  { value: "other",         label: "أخرى"          },
];

type Tab = "dashboard" | "invoices" | "profitability";

export default function Collections() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("dashboard");

  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());

  const [payDialog,     setPayDialog]     = useState<any>(null);
  const [payForm,       setPayForm]       = useState({ amount: "", method: "bank_transfer", notes: "" });
  const [partialDialog, setPartialDialog] = useState<any>(null);
  const [partialForm,   setPartialForm]   = useState({ amount: "", method: "bank_transfer", reference: "", notes: "" });
  const [stageDialog,   setStageDialog]   = useState<any>(null);
  const [stageForm,     setStageForm]     = useState({ stage: "1", notes: "" });
  const [activityInv,   setActivityInv]   = useState<any>(null);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["collections", statusFilter],
    queryFn: () => fetch(`${BASE}/api/finance/collections?status=${statusFilter}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 30_000,
  });
  const { data: analytics, isLoading: analyticsLoading } = useQuery<any>({
    queryKey: ["collections-analytics"],
    queryFn: () => fetch(`${BASE}/api/finance/collections/analytics`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
    enabled: tab === "dashboard",
  });
  const { data: profitability = [], isLoading: profLoading } = useQuery<any[]>({
    queryKey: ["collections-profitability"],
    queryFn: () => fetch(`${BASE}/api/finance/collections/profitability`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
    enabled: tab === "profitability",
  });

  const invoices: any[] = data?.invoices ?? [];
  const summary = data?.summary ?? {};
  const filtered = invoices.filter((inv: any) =>
    !search ||
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    inv.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.title?.toLowerCase().includes(search.toLowerCase())
  );

  const recordPayMut = useMutation({
    mutationFn: () => fetch(`${BASE}/api/finance/collections/${payDialog.id}/payment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(payForm.amount) || undefined, paymentMethod: payForm.method, notes: payForm.notes }),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: d => {
      if (d.error) { toast({ title: "خطأ", description: d.error, variant: "destructive" }); return; }
      toast({ title: "✅ تم تسجيل الدفعة بنجاح" });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["collections-analytics"] });
      qc.invalidateQueries({ queryKey: ["collections-profitability"] });
      setPayDialog(null);
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const partialPayMut = useMutation({
    mutationFn: () => fetch(`${BASE}/api/finance/collections/${partialDialog.id}/partial-payment`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(partialForm.amount), paymentMethod: partialForm.method, referenceNumber: partialForm.reference, notes: partialForm.notes }),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: d => {
      if (d.error) { toast({ title: "خطأ", description: d.error, variant: "destructive" }); return; }
      toast({ title: d.autoMarkedPaid ? "✅ الفاتورة مسددة بالكامل!" : "✅ تم تسجيل الدفعة الجزئية" });
      qc.invalidateQueries({ queryKey: ["collections"] });
      setPartialDialog(null);
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const stageMut = useMutation({
    mutationFn: () => fetch(`${BASE}/api/finance/collections/${stageDialog.id}/stage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: Number(stageForm.stage), notes: stageForm.notes }),
    }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      toast({ title: "✅ تم تحديث مرحلة التحصيل" });
      setStageDialog(null);
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const [bulkLoading, setBulkLoading] = useState(false);
  const bulkReminder = async () => {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    try {
      const r = await fetch(`${BASE}/api/finance/collections/bulk-reminder`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceIds: Array.from(selectedIds) }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
      toast({ title: `✅ أُرسل ${r.sent} تذكير`, description: r.skipped > 0 ? `تجاوز ${r.skipped} (لا بريد / SMTP)` : undefined });
      setSelectedIds(new Set());
    } catch { toast({ title: "خطأ في الإرسال الجماعي", variant: "destructive" }); }
    finally { setBulkLoading(false); }
  };

  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const sendReminder = async (inv: any) => {
    setReminderLoading(inv.id);
    try {
      const r = await fetch(`${BASE}/api/finance/collections/${inv.id}/reminder`, { method: "POST" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
      if (r.success) toast({ title: "✅ تم إرسال التذكير" });
      else toast({ title: "تنبيه", description: r.reason ?? "لم يُرسَل التذكير", variant: "destructive" });
    } catch { toast({ title: "خطأ في إرسال التذكير", variant: "destructive" }); }
    finally { setReminderLoading(null); }
  };

  const TABS = [
    { id: "dashboard"     as Tab, label: "لوحة التحليلات", icon: BarChart3 },
    { id: "invoices"      as Tab, label: "الفواتير",        icon: Receipt   },
    { id: "profitability" as Tab, label: "ربحية العملاء",  icon: Users     },
  ];

  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            نظام التحصيل الذكي
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">تحليلات متقدمة · مراحل التحصيل · ربحية العملاء</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 text-xs" onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["collections-analytics"] }); }}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {/* KPI Strip — always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "فواتير متأخرة",  icon: <AlertTriangle className="h-4 w-4 text-red-400" />,     bg: "bg-red-500/10",     val: String(summary.overdue_count ?? 0),  sub: fmtSAR(Number(summary.overdue_amount ?? 0)),              color: "text-red-400"    },
          { label: "قيد التحصيل",    icon: <Clock className="h-4 w-4 text-amber-400" />,            bg: "bg-amber-500/10",   val: String(summary.pending_count ?? 0),  sub: fmtSAR(Number(summary.pending_amount ?? 0)),              color: "text-amber-400"  },
          { label: "معدل التحصيل",   icon: <Target className="h-4 w-4 text-emerald-400" />,         bg: "bg-emerald-500/10", val: analyticsLoading ? "…" : `${analytics?.collectionRate ?? 0}%`, sub: "من إجمالي الفواتير", color: "text-emerald-400" },
          { label: "إجمالي المستحق", icon: <TrendingUp className="h-4 w-4 text-primary" />,      bg: "bg-primary/10",   val: fmtSAR(Number(summary.overdue_amount ?? 0) + Number(summary.pending_amount ?? 0)), sub: "ريال سعودي", color: "text-primary" },
        ].map(k => (
          <Card key={k.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", k.bg)}>{k.icon}</div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{k.label}</p>
                  <p className={cn("text-lg font-black leading-tight", k.color)}>{k.val}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{k.sub}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/40 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-background text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              <Icon className="h-3.5 w-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {/* ════════ TAB: DASHBOARD ════════ */}
      {tab === "dashboard" && (
        <div className="space-y-5">
          {analyticsLoading ? (
            <div className="grid md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-52" />)}</div>
          ) : !analytics ? (
            <Card className="border-border/50"><CardContent className="py-14 text-center text-muted-foreground text-sm">فشل تحميل البيانات — اضغط تحديث</CardContent></Card>
          ) : (
            <>
              {/* Aging Analysis */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    تحليل الأعمار — Aging Analysis
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">توزيع الفواتير المستحقة حسب أيام التأخر</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const totalAmt = AGING_BUCKETS.reduce((s, b) => s + (analytics.aging?.[b.key]?.amount ?? 0), 0) || 1;
                    return AGING_BUCKETS.map(b => {
                      const bucket = analytics.aging?.[b.key] ?? { count: 0, amount: 0 };
                      const pct = Math.round((bucket.amount / totalAmt) * 100);
                      return (
                        <div key={b.key} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: b.color }} />
                              <span className="font-semibold">{b.label}</span>
                              <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-border/50">
                                {bucket.count} فاتورة
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold tabular-nums" style={{ color: b.color }}>
                                {fmtSAR(bucket.amount)}
                              </span>
                              <span className="text-[10px] text-muted-foreground w-8 text-left">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-2.5 bg-muted/40 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: b.color }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Monthly Collections Chart */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      التحصيل الشهري — آخر 6 أشهر
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.monthlyCollections?.length > 0 ? (
                      <ResponsiveContainer width="100%" height={190}>
                        <BarChart data={analytics.monthlyCollections} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }}
                            tickFormatter={v => (v / 100).toLocaleString("ar-SA", { notation: "compact" })} />
                          <Tooltip
                            contentStyle={{ background: "#0d1b2a", border: "1px solid rgba(201,168,76,0.25)", borderRadius: "8px", fontSize: "12px" }}
                            formatter={(v: any) => [fmtSAR(v), "المحصّل"]}
                          />
                          <Bar dataKey="collected" radius={[5,5,0,0]} fill="#2563EB" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات تحصيل بعد</div>
                    )}
                  </CardContent>
                </Card>

                {/* Top Debtors */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                      أكبر المدينين
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {!analytics.topDebtors?.length ? (
                      <div className="py-10 text-center text-muted-foreground text-sm">لا يوجد مدينون حالياً 🎉</div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {analytics.topDebtors.map((d: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                              i === 0 ? "bg-red-500/20 text-red-400" : i === 1 ? "bg-orange-500/20 text-orange-400" : "bg-muted text-muted-foreground"
                            )}>{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate">{d.clientName}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {d.invCount} فاتورة · أقصى تأخر: {d.maxDaysOverdue} يوم
                              </p>
                            </div>
                            <p className="text-sm font-black text-red-400 shrink-0">{fmtSAR(d.outstanding)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "معدل التحصيل (عدد)",   val: `${analytics.collectionRate ?? 0}%`,       color: "text-emerald-400" },
                  { label: "معدل التحصيل (قيمة)",  val: `${analytics.amtCollectionRate ?? 0}%`,    color: "text-blue-400"    },
                  { label: "متوسط أيام التأخر",     val: `${analytics.avgDaysOverdue ?? 0} يوم`,    color: "text-amber-400"   },
                  { label: "عدد المدينين",           val: analytics.topDebtors?.length ?? 0,         color: "text-primary"   },
                ].map(s => (
                  <Card key={s.label} className="border-border/50">
                    <CardContent className="p-4 text-center">
                      <p className={cn("text-2xl font-black", s.color)}>{s.val}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════ TAB: INVOICES ════════ */}
      {tab === "invoices" && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="بحث بالاسم أو رقم الفاتورة..." value={search}
                    onChange={e => setSearch(e.target.value)} className="pr-9 bg-muted/30 border-none" />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-44 bg-muted/30 border-none">
                    <Filter className="h-4 w-4 ml-1" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفواتير</SelectItem>
                    <SelectItem value="overdue">المتأخرة فقط</SelectItem>
                    <SelectItem value="pending">قيد التحصيل</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/25 shrink-0">
                    {selectedIds.size} محددة
                  </Badge>
                  <Button size="sm" variant="outline"
                    className="h-7 text-xs gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    onClick={bulkReminder} disabled={bulkLoading}>
                    {bulkLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    إرسال تذكير للمحددين
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs mr-auto text-muted-foreground"
                    onClick={() => setSelectedIds(new Set())}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* List */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  الفواتير ({filtered.length})
                </CardTitle>
                {filtered.length > 0 && (
                  <Button size="sm" variant="ghost" className="text-xs text-muted-foreground"
                    onClick={() => {
                      if (selectedIds.size === filtered.length) setSelectedIds(new Set());
                      else setSelectedIds(new Set(filtered.map((i: any) => i.id)));
                    }}>
                    {selectedIds.size === filtered.length ? "إلغاء الكل" : "تحديد الكل"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3 opacity-60" />
                  <p className="text-muted-foreground text-sm">لا توجد فواتير معلقة 🎉</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map((inv: any) => {
                    const overdue  = isOverdue(inv);
                    const days     = daysLate(inv);
                    const isSelected = selectedIds.has(inv.id);
                    const ageBucket = days > 90 ? AGING_BUCKETS[3] : days > 60 ? AGING_BUCKETS[2] : days > 30 ? AGING_BUCKETS[1] : AGING_BUCKETS[0];

                    return (
                      <div key={inv.id} className={cn("p-4 transition-colors hover:bg-muted/10", isSelected && "bg-blue-500/5")}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox" checked={isSelected}
                            onChange={e => {
                              const next = new Set(selectedIds);
                              e.target.checked ? next.add(inv.id) : next.delete(inv.id);
                              setSelectedIds(next);
                            }}
                            className="mt-1.5 h-3.5 w-3.5 rounded accent-[#2563EB] cursor-pointer shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-sm">{inv.invoice_number ?? inv.id}</span>
                              <Badge variant="outline" className={cn("text-[10px]",
                                overdue ? "bg-red-500/15 text-red-400 border-red-500/25" : "bg-blue-500/15 text-blue-400 border-blue-500/25")}>
                                {overdue ? "متأخرة" : "قيد التحصيل"}
                              </Badge>
                              {overdue && days > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border"
                                  style={{ color: ageBucket.color, borderColor: ageBucket.color + "40", background: ageBucket.light }}>
                                  {days} يوم تأخر
                                </span>
                              )}
                            </div>

                            <p className="text-sm truncate text-muted-foreground mb-1">{inv.title}</p>

                            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                              {inv.client_name  && <span className="text-xs text-muted-foreground flex items-center gap-1"><Phone    className="h-3 w-3" />{inv.client_name}</span>}
                              {inv.client_email && <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail     className="h-3 w-3" />{inv.client_email}</span>}
                              {inv.due_date     && <span className={cn("text-xs flex items-center gap-1", overdue ? "text-red-400" : "text-muted-foreground")}><Calendar className="h-3 w-3" />الاستحقاق: {fmtDate(inv.due_date)}</span>}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <p className={cn("text-base font-black", overdue ? "text-red-400" : "text-primary")}>
                              {fmtSAR(Number(inv.total ?? 0))}
                            </p>
                            <div className="flex flex-wrap gap-1 justify-end">
                              <Button size="sm" variant="ghost"
                                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                title="سجل النشاط"
                                onClick={() => setActivityInv(inv)}>
                                <History className="h-3.5 w-3.5" />
                              </Button>
                              {inv.stripe_payment_link_url && (
                                <a href={inv.stripe_payment_link_url} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10">
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </a>
                              )}
                              <Button size="sm" variant="outline"
                                className="h-7 text-xs gap-1 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                                onClick={() => { setStageDialog(inv); setStageForm({ stage: "1", notes: "" }); }}>
                                <Layers className="h-3 w-3" />مرحلة
                              </Button>
                              <Button size="sm" variant="outline"
                                className="h-7 text-xs gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                                onClick={() => sendReminder(inv)}
                                disabled={reminderLoading === inv.id || !inv.client_email}>
                                {reminderLoading === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                تذكير
                              </Button>
                              <Button size="sm" variant="outline"
                                className="h-7 text-xs gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                onClick={() => { setPartialDialog(inv); setPartialForm({ amount: "", method: "bank_transfer", reference: "", notes: "" }); }}>
                                <Minus className="h-3 w-3" />جزئي
                              </Button>
                              <Button size="sm"
                                className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                                onClick={() => { setPayDialog(inv); setPayForm({ amount: String(Number(inv.total ?? 0) / 100), method: "bank_transfer", notes: "" }); }}>
                                <CreditCard className="h-3 w-3" />كامل
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════════ TAB: PROFITABILITY ════════ */}
      {tab === "profitability" && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              ربحية العملاء — تحليل شامل
            </CardTitle>
            <p className="text-xs text-muted-foreground">مقارنة الفوترة والتحصيل ومعدل الدفع لكل موكل</p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {profLoading ? (
              <div className="p-4 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : (profitability as any[]).length === 0 ? (
              <div className="py-14 text-center text-muted-foreground text-sm">لا توجد بيانات بعد — أضف موكلين وفواتير</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40">
                    {["العميل", "الفواتير", "الإجمالي", "المحصّل", "المتبقي", "معدل التحصيل", "متوسط أيام الدفع"].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(profitability as any[]).map((c: any, i: number) => {
                    const rate = c.collectionRate ?? 0;
                    const rateColor = rate >= 80 ? "#10B981" : rate >= 50 ? "#F59E0B" : "#EF4444";
                    return (
                      <tr key={c.clientId ?? i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sm font-black text-primary shrink-0">
                              {(c.clientName ?? "؟")[0]}
                            </div>
                            <div>
                              <p className="font-semibold leading-tight">{c.clientName}</p>
                              {c.clientPhone && <p className="text-[10px] text-muted-foreground">{c.clientPhone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge variant="outline" className="text-[10px] border-border/50">{c.totalInvoices}</Badge>
                        </td>
                        <td className="px-3 py-3 font-bold whitespace-nowrap">{fmtSAR(c.totalBilled)}</td>
                        <td className="px-3 py-3 font-bold text-emerald-400 whitespace-nowrap">{fmtSAR(c.totalCollected)}</td>
                        <td className="px-3 py-3 font-bold whitespace-nowrap">
                          {c.outstanding > 0
                            ? <span className="text-red-400">{fmtSAR(c.outstanding)}</span>
                            : <Check className="h-4 w-4 text-emerald-400" />}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-start gap-1 min-w-[80px]">
                            <span className="font-black text-sm" style={{ color: rateColor }}>{rate}%</span>
                            <div className="w-16 bg-muted/40 rounded-full h-1.5">
                              <div className="h-full rounded-full" style={{ width: `${rate}%`, background: rateColor }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-muted-foreground text-xs">
                          {c.avgDaysToPay > 0 ? `${c.avgDaysToPay} يوم` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Full Payment Dialog ─── */}
      <Dialog open={!!payDialog} onOpenChange={v => !v && setPayDialog(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />تسجيل دفعة كاملة
            </DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">رقم الفاتورة</span><span className="font-medium">{payDialog.invoice_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">العميل</span><span className="font-medium">{payDialog.client_name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">المبلغ</span><span className="font-bold text-primary">{fmtSAR(Number(payDialog.total ?? 0))}</span></div>
              </div>
              <div className="space-y-1.5">
                <Label>المبلغ المحصَّل (ر.س)</Label>
                <Input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="bg-muted/30 border-none" />
              </div>
              <div className="space-y-1.5">
                <Label>طريقة الدفع</Label>
                <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="bg-muted/30 border-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="..." className="bg-muted/30 border-none" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayDialog(null)}>إلغاء</Button>
            <Button onClick={() => recordPayMut.mutate()} disabled={recordPayMut.isPending || !payForm.amount}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2">
              {recordPayMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}تأكيد الدفعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Partial Payment Dialog ─── */}
      <Dialog open={!!partialDialog} onOpenChange={v => !v && setPartialDialog(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Minus className="h-5 w-5 text-amber-400" />دفعة جزئية
            </DialogTitle>
          </DialogHeader>
          {partialDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">الفاتورة</span><span className="font-medium">{partialDialog.invoice_number}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">الإجمالي</span><span className="font-bold text-amber-400">{fmtSAR(Number(partialDialog.total ?? 0))}</span></div>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
                ✦ إذا بلغ مجموع الدفعات الجزئية الإجمالي، ستُغلَق الفاتورة تلقائياً.
              </p>
              <div className="space-y-1.5">
                <Label>مبلغ الدفعة (ر.س)</Label>
                <Input type="number" value={partialForm.amount} onChange={e => setPartialForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="bg-muted/30 border-none" />
              </div>
              <div className="space-y-1.5">
                <Label>طريقة الدفع</Label>
                <Select value={partialForm.method} onValueChange={v => setPartialForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="bg-muted/30 border-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>رقم المرجع / الحوالة</Label>
                <Input value={partialForm.reference} onChange={e => setPartialForm(f => ({ ...f, reference: e.target.value }))} placeholder="اختياري..." className="bg-muted/30 border-none" />
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات</Label>
                <Input value={partialForm.notes} onChange={e => setPartialForm(f => ({ ...f, notes: e.target.value }))} placeholder="..." className="bg-muted/30 border-none" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPartialDialog(null)}>إلغاء</Button>
            <Button onClick={() => partialPayMut.mutate()} disabled={partialPayMut.isPending || !partialForm.amount}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-2">
              {partialPayMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}تسجيل الدفعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Stage Dialog ─── */}
      <Dialog open={!!stageDialog} onOpenChange={v => !v && setStageDialog(null)}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-violet-400" />تحديث مرحلة التحصيل
            </DialogTitle>
          </DialogHeader>
          {stageDialog && (
            <div className="space-y-4 py-1">
              <p className="text-sm text-muted-foreground">الفاتورة: <span className="font-bold text-foreground">{stageDialog.invoice_number}</span></p>
              <div className="space-y-2">
                {Object.entries(STAGES).filter(([k]) => k !== "0").map(([k, s]) => (
                  <button key={k} onClick={() => setStageForm(f => ({ ...f, stage: k }))}
                    className={cn("w-full flex items-center gap-3 p-3 rounded-xl border-2 text-right transition-all",
                      stageForm.stage === k ? "border-current" : "border-border/40 hover:border-border")}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                      style={{ background: s.color + "25", color: s.color }}>{k}</div>
                    <span className="font-semibold text-sm" style={{ color: s.color }}>{s.label}</span>
                    {stageForm.stage === k && <Check className="h-4 w-4 mr-auto" style={{ color: s.color }} />}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>ملاحظات (اختياري)</Label>
                <Input value={stageForm.notes} onChange={e => setStageForm(f => ({ ...f, notes: e.target.value }))} placeholder="سبب تغيير المرحلة..." className="bg-muted/30 border-none" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStageDialog(null)}>إلغاء</Button>
            <Button onClick={() => stageMut.mutate()} disabled={stageMut.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-2">
              {stageMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}تحديث المرحلة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Activity Dialog ─── */}
      <Dialog open={!!activityInv} onOpenChange={v => !v && setActivityInv(null)}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              سجل النشاط — {activityInv?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {activityInv && <ActivityLog invoiceId={activityInv.id} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityInv(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

/* ─── Activity Log Component ─── */
function ActivityLog({ invoiceId }: { invoiceId: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["collection-activities", invoiceId],
    queryFn: () => fetch(`${BASE}/api/finance/collections/${invoiceId}/activities`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 10_000,
  });

  if (isLoading) return (
    <div className="py-10 flex justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  const activities: any[] = data?.activities ?? [];
  const currentStage: number = data?.currentStage ?? 0;
  const partials: any[]     = data?.partials ?? [];

  const ICONS: Record<string, { icon: any; color: string }> = {
    reminder_sent:    { icon: Send,       color: "text-blue-400"    },
    payment_recorded: { icon: CreditCard, color: "text-emerald-400" },
    partial_payment:  { icon: Minus,      color: "text-amber-400"   },
    stage_changed:    { icon: Layers,     color: "text-violet-400"  },
    note_added:       { icon: Receipt,    color: "text-muted-foreground"   },
  };

  const stg = STAGES[currentStage] ?? STAGES[0];

  return (
    <div className="space-y-4 max-h-[55vh] overflow-y-auto">
      {/* Current stage */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
        <Layers className="h-4 w-4 text-violet-400 shrink-0" />
        <span className="text-sm text-muted-foreground">المرحلة الحالية:</span>
        <Badge variant="outline" className={cn("text-[10px]", stg.bg, stg.border)} style={{ color: stg.color }}>
          {stg.label}
        </Badge>
      </div>

      {/* Partial payments */}
      {partials.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2 px-1">الدفعات الجزئية</p>
          <div className="space-y-1.5">
            {partials.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm">
                <span className="font-bold text-amber-400">{(Number(p.amount) / 100).toLocaleString("ar-SA")} ر.س</span>
                {p.reference_number && <span className="text-xs text-muted-foreground">مرجع: {p.reference_number}</span>}
                <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar-SA")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      {activities.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">لا يوجد نشاط مسجّل بعد</div>
      ) : (
        <div className="relative">
          <div className="absolute right-[18px] top-0 bottom-0 w-px bg-border/40" />
          <div className="space-y-3">
            {activities.map((a: any) => {
              const meta = ICONS[a.type] ?? ICONS.note_added;
              const Icon = meta.icon;
              return (
                <div key={a.id} className="flex gap-3 items-start">
                  <div className={cn("w-9 h-9 rounded-full bg-background border border-border/60 flex items-center justify-center shrink-0 z-10", meta.color)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className="text-sm leading-snug">{a.note}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(a.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
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
