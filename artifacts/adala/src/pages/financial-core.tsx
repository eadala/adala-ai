import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, ArrowRightLeft, BarChart3,
  RefreshCw, Plus, CheckCircle, Clock, AlertCircle, Landmark,
  CreditCard, Coins, BookOpen, DollarSign, Zap, Globe, Settings,
  ChevronRight, ArrowUpRight, ArrowDownRight, Filter, Download,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const fetcher = (url: string) => fetch(`${BASE}${url}`).then(r => r.json());
const fmt = (n: number) => (n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COLORS = ["#6366f1","#22c55e","#f59e0b","#ec4899","#14b8a6","#8b5cf6"];

function KpiCard({ label, value, unit = "ر.س", icon: Icon, trend, sub, color = "indigo" }: any) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30",
    green:  "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    amber:  "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    red:    "from-rose-500/20 to-rose-500/5 border-rose-500/30",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30",
    cyan:   "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
  };
  return (
    <Card className={`bg-gradient-to-br ${colors[color] ?? colors.indigo} border`}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold tabular-nums leading-none">
              {typeof value === "number" ? fmt(value) : value}
              {unit && <span className="text-sm font-normal text-muted-foreground mr-1">{unit}</span>}
            </p>
            {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="rounded-xl p-2 bg-background/30 shrink-0 mr-2">
            <Icon className="h-5 w-5 text-foreground/70" />
          </div>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-[11px] ${trend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend)}% {trend >= 0 ? "زيادة" : "انخفاض"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any }> = {
    pending:    { label: "معلّق",     variant: "secondary" },
    processing: { label: "جاري",     variant: "default"   },
    sent:       { label: "مُرسَل",   variant: "default"   },
    failed:     { label: "فاشل",     variant: "destructive"},
    completed:  { label: "مكتمل",   variant: "default"   },
    settled:    { label: "مسوَّى",  variant: "default"   },
    unsettled:  { label: "غير مسوَّى", variant: "secondary"},
  };
  const m = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={m.variant} className="text-[10px]">{m.label}</Badge>;
}

/* ══════════════════════════════════════════════════════════ */
export default function FinancialCore() {
  const [tab, setTab] = useState("dashboard");
  const [payoutFilter, setPayoutFilter] = useState("all");
  const [ledgerLimit, setLedgerLimit] = useState(50);
  const [period, setPeriod] = useState("6m");
  const [newPayoutOpen, setNewPayoutOpen] = useState(false);
  const [newLedgerOpen, setNewLedgerOpen] = useState(false);
  const [newPayout, setNewPayout] = useState({ officeId: "", ownerLabel: "", amount: "", fee: "10", notes: "" });
  const [newLedger, setNewLedger] = useState({ debitAccount: "", creditAccount: "", amount: "", description: "", entryType: "payment" });
  const { toast } = useToast();
  const qc = useQueryClient();

  /* ── Queries ─────────────────────────────────────────── */
  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ["fincore-dashboard"],
    queryFn: () => fetcher(`${BASE}/api/fincore/dashboard`),
    enabled: tab === "dashboard",
    staleTime: 30_000,
  });

  const { data: ledgerData, isLoading: ledgerLoading, refetch: refetchLedger } = useQuery({
    queryKey: ["fincore-ledger", ledgerLimit],
    queryFn: () => fetcher(`${BASE}/api/fincore/ledger?limit=${ledgerLimit}`),
    enabled: tab === "ledger",
    staleTime: 30_000,
  });

  const { data: wallets = [], isLoading: walletsLoading } = useQuery<any[]>({
    queryKey: ["fincore-wallets"],
    queryFn: () => fetcher(`${BASE}/api/fincore/wallets`),
    enabled: tab === "wallets",
    staleTime: 60_000,
  });

  const { data: allPayouts = [], isLoading: payoutsLoading, refetch: refetchPayouts } = useQuery<any[]>({
    queryKey: ["fincore-payouts", payoutFilter],
    queryFn: () => fetcher(`${BASE}/api/fincore/payouts${payoutFilter !== "all" ? `?status=${payoutFilter}` : ""}`),
    enabled: tab === "payouts",
    staleTime: 30_000,
  });

  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ["fincore-reports", period],
    queryFn: () => fetcher(`${BASE}/api/fincore/reports?period=${period}`),
    enabled: tab === "reports",
    staleTime: 60_000,
  });

  const { data: providers = [] } = useQuery<any[]>({
    queryKey: ["fincore-providers"],
    queryFn: () => fetcher(`${BASE}/api/fincore/providers`),
    enabled: tab === "gateways",
  });

  /* ── Mutations ───────────────────────────────────────── */
  const processPayout = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`${BASE}/api/fincore/payouts/${id}/process`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => { refetchPayouts(); toast({ title: "تم تحديث حالة التحويل" }); },
  });

  const deletePayout = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/api/fincore/payouts/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { refetchPayouts(); toast({ title: "تم حذف التحويل" }); },
  });

  const runSettlement = useMutation({
    mutationFn: () => fetch(`${BASE}/api/fincore/settlement`, { method: "POST" }).then(r => r.json()),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["fincore-payouts"] });
      toast({ title: `التسوية مكتملة`, description: `${d.payoutsProcessed} تحويل — ${d.transactionsSettled} معاملة` });
    },
  });

  const createPayout = useMutation({
    mutationFn: (body: any) => fetch(`${BASE}/api/fincore/payouts`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: () => {
      setNewPayoutOpen(false); setNewPayout({ officeId: "", ownerLabel: "", amount: "", fee: "10", notes: "" });
      refetchPayouts(); toast({ title: "تم إنشاء التحويل" });
    },
  });

  const createLedger = useMutation({
    mutationFn: (body: any) => fetch(`${BASE}/api/fincore/ledger`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: () => {
      setNewLedgerOpen(false); setNewLedger({ debitAccount: "", creditAccount: "", amount: "", description: "", entryType: "payment" });
      refetchLedger(); toast({ title: "تم تسجيل القيد المحاسبي" });
    },
  });

  const exportCsv = useCallback(() => {
    const data = tab === "ledger" ? ledgerData?.entries : allPayouts;
    if (!data?.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(","), ...data.map((r: any) => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `fincore-${tab}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }, [tab, ledgerData, allPayouts]);

  const kpi = dashboard?.kpi ?? {};

  /* ══════════════════════════════════════════════════════ */
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> لوحة التحكم المالية المتقدمة
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">النواة المالية — دفتر الأستاذ | المحافظ | التحويلات | بوابات الدفع</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> تصدير CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => runSettlement.mutate()} disabled={runSettlement.isPending} className="gap-1.5">
            <Zap className="h-3.5 w-3.5" /> {runSettlement.isPending ? "جاري التسوية..." : "تسوية يومية"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refetchDash(); }} className="gap-1">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-9 gap-1 flex-wrap">
          <TabsTrigger value="dashboard" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />لوحة القيادة</TabsTrigger>
          <TabsTrigger value="ledger"    className="text-xs gap-1.5"><BookOpen className="h-3.5 w-3.5" />دفتر الأستاذ</TabsTrigger>
          <TabsTrigger value="wallets"   className="text-xs gap-1.5"><Wallet className="h-3.5 w-3.5" />المحافظ</TabsTrigger>
          <TabsTrigger value="payouts"   className="text-xs gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5" />التحويلات</TabsTrigger>
          <TabsTrigger value="reports"   className="text-xs gap-1.5"><TrendingUp className="h-3.5 w-3.5" />التقارير</TabsTrigger>
          <TabsTrigger value="gateways"  className="text-xs gap-1.5"><Globe className="h-3.5 w-3.5" />بوابات الدفع</TabsTrigger>
        </TabsList>

        {/* ── DASHBOARD ─────────────────────────────────── */}
        <TabsContent value="dashboard" className="mt-5 space-y-5">
          {dashLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({length:6}).map((_,i) => <Card key={i} className="h-24 animate-pulse bg-muted/30" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="إجمالي الإيرادات"   value={kpi.totalRevenue}    icon={DollarSign}   color="indigo" />
              <KpiCard label="ربح المنصة"          value={kpi.platformProfit}  icon={Coins}        color="green"  />
              <KpiCard label="صافي الإيرادات"     value={kpi.totalNet}        icon={TrendingUp}   color="cyan"   />
              <KpiCard label="معدل التحويل"        value={kpi.conversionRate}  unit="%" icon={CheckCircle} color="purple" />
              <KpiCard label="تحويلات معلّقة"    value={kpi.pendingPayouts}  unit="" icon={Clock}       color="amber"  sub={`${fmt(kpi.pendingPayoutAmount ?? 0)} ر.س`} />
              <KpiCard label="غير مسوَّاة"        value={kpi.unsettledNet}    icon={AlertCircle}  color="red"    />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Monthly Revenue Chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">الإيرادات الشهرية (6 أشهر)</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-2">
                {dashLoading ? <div className="h-48 animate-pulse bg-muted/30 rounded" /> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={dashboard?.monthly ?? []} margin={{top:4,right:8,left:8,bottom:0}}>
                      <defs>
                        <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="month" tick={{fontSize:10}} />
                      <YAxis tick={{fontSize:10}} width={55} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: any) => [`${fmt(v)} ر.س`]} contentStyle={{fontSize:11}} />
                      <Legend wrapperStyle={{fontSize:11}} />
                      <Area type="monotone" dataKey="revenue" name="الإيرادات" fill="url(#gRev)" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="profit"  name="الربح"    fill="url(#gProfit)" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* By Gateway Pie */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">توزيع بوابات الدفع</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center pb-4">
                {dashLoading ? <div className="h-48 animate-pulse bg-muted/30 rounded w-full" /> : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={dashboard?.byGateway ?? []} dataKey="total" nameKey="gateway" cx="50%" cy="50%" outerRadius={65} label={false}>
                          {(dashboard?.byGateway ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => [`${fmt(v)} ر.س`]} contentStyle={{fontSize:11}} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center">
                      {(dashboard?.byGateway ?? []).map((g: any, i: number) => (
                        <span key={g.gateway} className="flex items-center gap-1 text-[10px]">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{background: COLORS[i%COLORS.length]}} />
                          {g.gateway} ({g.count})
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Transaction Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-emerald-500/10 border-emerald-500/20">
              <CardContent className="pt-4 pb-3 text-center">
                <CheckCircle className="h-6 w-6 text-emerald-400 mx-auto mb-1" />
                <p className="text-xl font-bold">{kpi.paidCount ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">معاملات مكتملة</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-500/10 border-amber-500/20">
              <CardContent className="pt-4 pb-3 text-center">
                <Clock className="h-6 w-6 text-amber-400 mx-auto mb-1" />
                <p className="text-xl font-bold">{kpi.pendingCount ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">معلّقة</p>
              </CardContent>
            </Card>
            <Card className="bg-rose-500/10 border-rose-500/20">
              <CardContent className="pt-4 pb-3 text-center">
                <AlertCircle className="h-6 w-6 text-rose-400 mx-auto mb-1" />
                <p className="text-xl font-bold">{kpi.failedCount ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">فاشلة</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Ledger */}
          {(dashboard?.recentLedger?.length > 0) && (
            <Card>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">آخر القيود المحاسبية</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setTab("ledger")}>
                  عرض الكل <ChevronRight className="h-3 w-3" />
                </Button>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1.5">
                  {dashboard.recentLedger.slice(0,5).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate text-muted-foreground">{e.description || e.entry_type}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-rose-400 text-[11px]">مدين: {e.debit_account}</span>
                        <span className="text-emerald-400 text-[11px]">دائن: {e.credit_account}</span>
                        <span className="font-semibold">{fmt(parseFloat(e.amount))} ر.س</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── LEDGER ────────────────────────────────────── */}
        <TabsContent value="ledger" className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">دفتر الأستاذ العام</h2>
              <p className="text-xs text-muted-foreground">قيود مزدوجة القيد — مدين / دائن</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={newLedgerOpen} onOpenChange={setNewLedgerOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />قيد جديد</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>قيد محاسبي جديد</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">الحساب المدين</Label>
                        <Input placeholder="معرف الحساب" value={newLedger.debitAccount} onChange={e => setNewLedger(p => ({...p, debitAccount: e.target.value}))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">الحساب الدائن</Label>
                        <Input placeholder="معرف الحساب" value={newLedger.creditAccount} onChange={e => setNewLedger(p => ({...p, creditAccount: e.target.value}))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">المبلغ (ر.س)</Label>
                      <Input type="number" placeholder="0.00" value={newLedger.amount} onChange={e => setNewLedger(p => ({...p, amount: e.target.value}))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">نوع القيد</Label>
                      <Select value={newLedger.entryType} onValueChange={v => setNewLedger(p => ({...p, entryType: v}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="payment">دفعة</SelectItem>
                          <SelectItem value="fee">رسوم</SelectItem>
                          <SelectItem value="payout">تحويل</SelectItem>
                          <SelectItem value="refund">استرداد</SelectItem>
                          <SelectItem value="adjustment">تسوية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">الوصف</Label>
                      <Input placeholder="وصف القيد" value={newLedger.description} onChange={e => setNewLedger(p => ({...p, description: e.target.value}))} />
                    </div>
                    <Button className="w-full" disabled={createLedger.isPending || !newLedger.debitAccount || !newLedger.creditAccount || !newLedger.amount}
                      onClick={() => createLedger.mutate(newLedger)}>
                      {createLedger.isPending ? "جاري الحفظ..." : "تسجيل القيد"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" onClick={() => refetchLedger()} className="gap-1"><RefreshCw className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          <Card>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
              <p className="text-xs text-muted-foreground">
                {ledgerData?.total ?? 0} قيد — عرض {Math.min(ledgerLimit, ledgerData?.total ?? 0)}
              </p>
              <Select value={String(ledgerLimit)} onValueChange={v => setLedgerLimit(Number(v))}>
                <SelectTrigger className="h-7 text-xs w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ledgerLoading ? <div className="h-48 animate-pulse bg-muted/30 m-4 rounded" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-right py-2 px-3 font-medium">التاريخ</th>
                      <th className="text-right py-2 px-3 font-medium">النوع</th>
                      <th className="text-right py-2 px-3 font-medium">الحساب المدين</th>
                      <th className="text-right py-2 px-3 font-medium">الحساب الدائن</th>
                      <th className="text-right py-2 px-3 font-medium">المبلغ</th>
                      <th className="text-right py-2 px-3 font-medium">الوصف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ledgerData?.entries ?? []).length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">لا توجد قيود محاسبية بعد</td></tr>
                    ) : (ledgerData?.entries ?? []).map((e: any) => (
                      <tr key={e.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">{new Date(e.created_at).toLocaleDateString("ar-SA")}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px]">{e.entry_type}</Badge>
                        </td>
                        <td className="py-2 px-3 text-rose-400 font-mono">{e.debit_account}</td>
                        <td className="py-2 px-3 text-emerald-400 font-mono">{e.credit_account}</td>
                        <td className="py-2 px-3 font-semibold tabular-nums">{fmt(parseFloat(e.amount))} ر.س</td>
                        <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate">{e.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── WALLETS ───────────────────────────────────── */}
        <TabsContent value="wallets" className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">المحافظ الرقمية</h2>
              <p className="text-xs text-muted-foreground">رصيد متاح + معلّق لكل مكتب/محامٍ</p>
            </div>
          </div>

          {walletsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({length:3}).map((_,i) => <Card key={i} className="h-32 animate-pulse bg-muted/30" />)}
            </div>
          ) : wallets.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد محافظ بعد</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {wallets.map((w: any) => (
                <Card key={w.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm">{w.owner_label || w.owner_id}</p>
                        <p className="text-[11px] text-muted-foreground">{w.currency}</p>
                      </div>
                      <Wallet className="h-5 w-5 text-primary/60" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-500/10 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">متاح</p>
                        <p className="font-bold text-emerald-400 tabular-nums">{fmt(parseFloat(w.available_balance ?? 0))}</p>
                      </div>
                      <div className="bg-amber-500/10 rounded-lg p-2.5 text-center">
                        <p className="text-[10px] text-muted-foreground mb-0.5">معلّق</p>
                        <p className="font-bold text-amber-400 tabular-nums">{fmt(parseFloat(w.pending_balance ?? 0))}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/40 grid grid-cols-2 gap-1">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">إجمالي الكسب</p>
                        <p className="text-xs font-semibold text-indigo-400">{fmt(parseFloat(w.total_earned ?? 0))}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">إجمالي السحب</p>
                        <p className="text-xs font-semibold text-rose-400">{fmt(parseFloat(w.total_withdrawn ?? 0))}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {wallets.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-semibold">مقارنة أرصدة المحافظ</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={wallets.slice(0,10)} margin={{top:4,right:8,left:8,bottom:20}}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="owner_label" tick={{fontSize:9}} angle={-25} textAnchor="end" />
                    <YAxis tick={{fontSize:10}} width={55} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => [`${fmt(v)} ر.س`]} contentStyle={{fontSize:11}} />
                    <Legend wrapperStyle={{fontSize:11}} />
                    <Bar dataKey="available_balance" name="متاح" fill="#22c55e" radius={[3,3,0,0]} />
                    <Bar dataKey="pending_balance"   name="معلّق" fill="#f59e0b" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── PAYOUTS ───────────────────────────────────── */}
        <TabsContent value="payouts" className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold">إدارة التحويلات</h2>
              <p className="text-xs text-muted-foreground">سير العمل: معلّق ← جاري التحويل ← مُرسَل</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={payoutFilter} onValueChange={setPayoutFilter}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <Filter className="h-3 w-3 ml-1" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="pending">معلّق</SelectItem>
                  <SelectItem value="processing">جاري</SelectItem>
                  <SelectItem value="sent">مُرسَل</SelectItem>
                  <SelectItem value="failed">فاشل</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={newPayoutOpen} onOpenChange={setNewPayoutOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />تحويل جديد</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>إنشاء تحويل جديد</DialogTitle></DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1">
                      <Label className="text-xs">معرف المكتب</Label>
                      <Input placeholder="office_id" value={newPayout.officeId} onChange={e => setNewPayout(p => ({...p, officeId: e.target.value}))} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">اسم المستفيد</Label>
                      <Input placeholder="اسم المكتب / المحامي" value={newPayout.ownerLabel} onChange={e => setNewPayout(p => ({...p, ownerLabel: e.target.value}))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">المبلغ الإجمالي (ر.س)</Label>
                        <Input type="number" placeholder="0.00" value={newPayout.amount} onChange={e => setNewPayout(p => ({...p, amount: e.target.value}))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">عمولة المنصة %</Label>
                        <Input type="number" placeholder="10" value={newPayout.fee} onChange={e => setNewPayout(p => ({...p, fee: e.target.value}))} />
                      </div>
                    </div>
                    {newPayout.amount && (
                      <div className="bg-muted/30 rounded p-2 text-xs text-center">
                        صافي التحويل: <strong>{fmt(parseFloat(newPayout.amount||"0") * (1 - parseFloat(newPayout.fee||"0")/100))} ر.س</strong>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">ملاحظات</Label>
                      <Input placeholder="ملاحظات اختيارية" value={newPayout.notes} onChange={e => setNewPayout(p => ({...p, notes: e.target.value}))} />
                    </div>
                    <Button className="w-full" disabled={createPayout.isPending || !newPayout.officeId || !newPayout.amount}
                      onClick={() => createPayout.mutate({ officeId: newPayout.officeId, ownerLabel: newPayout.ownerLabel, amount: parseFloat(newPayout.amount), platformFee: parseFloat(newPayout.fee||"0"), notes: newPayout.notes })}>
                      {createPayout.isPending ? "جاري الإنشاء..." : "إنشاء التحويل"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {payoutsLoading ? (
            <div className="space-y-2">{Array.from({length:4}).map((_,i) => <Card key={i} className="h-16 animate-pulse bg-muted/30" />)}</div>
          ) : allPayouts.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-muted-foreground">لا توجد تحويلات</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {allPayouts.map((p: any) => (
                <Card key={p.id} className="hover:border-border/70 transition-colors">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-lg p-2 bg-muted/40 shrink-0">
                          <Landmark className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{p.owner_label || p.office_id}</p>
                          <p className="text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("ar-SA")} · {p.provider || "manual"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">الإجمالي</p>
                          <p className="font-semibold tabular-nums">{fmt(parseFloat(p.amount))} ر.س</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">صافي</p>
                          <p className="font-semibold text-emerald-400 tabular-nums">{fmt(parseFloat(p.net_amount))} ر.س</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">عمولة</p>
                          <p className="font-semibold text-rose-400 tabular-nums">{fmt(parseFloat(p.platform_fee))} ر.س</p>
                        </div>
                        <StatusBadge status={p.status} />
                        <div className="flex gap-1">
                          {p.status === "pending" && (
                            <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
                              onClick={() => processPayout.mutate({ id: p.id, status: "processing" })}>
                              <ArrowRightLeft className="h-3 w-3" />تحويل
                            </Button>
                          )}
                          {p.status === "processing" && (
                            <Button size="sm" className="text-xs h-7 gap-1"
                              onClick={() => processPayout.mutate({ id: p.id, status: "sent" })}>
                              <CheckCircle className="h-3 w-3" />مُرسَل
                            </Button>
                          )}
                          {(p.status === "pending" || p.status === "failed") && (
                            <Button size="sm" variant="ghost" className="text-xs h-7 text-rose-400"
                              onClick={() => deletePayout.mutate(p.id)}>حذف</Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {p.notes && <p className="text-[11px] text-muted-foreground mt-2 pr-11">{p.notes}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── REPORTS ───────────────────────────────────── */}
        <TabsContent value="reports" className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">التقارير المالية التفصيلية</h2>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3m">3 أشهر</SelectItem>
                <SelectItem value="6m">6 أشهر</SelectItem>
                <SelectItem value="1y">سنة كاملة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reportsLoading ? <div className="h-64 animate-pulse bg-muted/30 rounded-xl" /> : (
            <>
              {reports?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <KpiCard label="الإيرادات الإجمالية"  value={reports.summary.gross}         icon={DollarSign}  color="indigo" />
                  <KpiCard label="رسوم المنصة"           value={reports.summary.fees}           icon={Coins}       color="purple" />
                  <KpiCard label="صافي الإيرادات"       value={reports.summary.net}            icon={TrendingUp}  color="green"  />
                  <KpiCard label="متوسط المعاملة"        value={reports.summary.avgTransaction} icon={CreditCard}  color="cyan"   />
                  <KpiCard label="عدد المعاملات"         value={reports.summary.total} unit=""  icon={CheckCircle} color="amber"  />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">الإيرادات الشهرية</CardTitle></CardHeader>
                  <CardContent className="pb-4 px-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={reports?.monthly ?? []} margin={{top:4,right:8,left:8,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                        <XAxis dataKey="month" tick={{fontSize:10}} />
                        <YAxis tick={{fontSize:10}} width={55} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => [`${fmt(v)} ر.س`]} contentStyle={{fontSize:11}} />
                        <Legend wrapperStyle={{fontSize:11}} />
                        <Bar dataKey="gross" name="إجمالي"  fill="#6366f1" radius={[3,3,0,0]} />
                        <Bar dataKey="fees"  name="رسوم"    fill="#ec4899" radius={[3,3,0,0]} />
                        <Bar dataKey="net"   name="صافي"    fill="#22c55e" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-semibold">أعلى العملاء إيراداً</CardTitle></CardHeader>
                  <CardContent className="pb-4">
                    {(reports?.topClients ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
                    ) : (
                      <div className="space-y-2">
                        {(reports?.topClients ?? []).slice(0,8).map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-4 shrink-0">{i+1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs truncate font-medium">{c.name}</span>
                                <span className="text-xs font-semibold tabular-nums shrink-0 mr-2">{fmt(c.total)} ر.س</span>
                              </div>
                              <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-indigo-500"
                                  style={{width:`${Math.round((c.total / (reports.topClients[0]?.total || 1)) * 100)}%`}} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── GATEWAYS ──────────────────────────────────── */}
        <TabsContent value="gateways" className="mt-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold">بوابات الدفع المتكاملة</h2>
            <p className="text-xs text-muted-foreground">طبقة التجريد المالي — Payment Abstraction Layer</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {providers.map((p: any) => (
              <Card key={p.id} className={`transition-colors ${p.configured ? "border-emerald-500/30" : "border-border/50"}`}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-bold text-base">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.region}</p>
                    </div>
                    <Badge variant={p.configured ? "default" : "secondary"} className="text-[10px] gap-1">
                      {p.configured ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                      {p.configured ? "مفعّل" : "غير مكوَّن"}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {p.id === "stripe" && (
                      <>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" />دفع فوري بالبطاقة</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" />Stripe Connect للمحافظ</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" />Webhook متكامل</p>
                      </>
                    )}
                    {p.id === "moyasar" && (
                      <>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" />مدى / Visa / Mastercard</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" />Apple Pay</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" />دعم السوق السعودي</p>
                      </>
                    )}
                    {p.id === "checkout" && (
                      <>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" />بطاقات عالمية</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" />3DS Authentication</p>
                        <p className="flex items-center gap-1.5"><CheckCircle className="h-3 w-3 text-emerald-400" />Tokenization</p>
                      </>
                    )}
                  </div>
                  {!p.configured && (
                    <div className="mt-4 p-2 bg-muted/30 rounded text-[10px] text-muted-foreground">
                      أضف <code className="font-mono bg-muted/50 px-1 rounded">
                        {p.id === "stripe" ? "STRIPE_SECRET_KEY" : p.id === "moyasar" ? "MOYASAR_SECRET_KEY" : "CHECKOUT_SECRET_KEY"}
                      </code> في متغيرات البيئة
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4" /> هيكل طبقة التجريد
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <div className="flex flex-col items-center gap-3 text-xs">
                <div className="bg-primary/10 border border-primary/30 rounded-xl px-6 py-3 font-semibold text-primary">
                  PaymentService.createPayment(provider, data)
                </div>
                <div className="flex gap-1 text-muted-foreground">↓</div>
                <div className="flex flex-wrap gap-3 justify-center">
                  {["StripeAdapter", "MoyasarAdapter", "CheckoutAdapter"].map(a => (
                    <div key={a} className="bg-muted/30 border border-border/50 rounded-lg px-4 py-2 font-mono text-[11px]">{a}</div>
                  ))}
                </div>
                <div className="flex gap-1 text-muted-foreground">↓</div>
                <div className="flex flex-wrap gap-3 justify-center">
                  {["Stripe API", "Moyasar API", "Checkout.com API"].map(a => (
                    <div key={a} className="bg-background border border-border rounded-lg px-4 py-2 text-[11px] text-muted-foreground">{a}</div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
