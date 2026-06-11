import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, TrendingUp, TrendingDown, Wallet, ArrowRightLeft,
  Plus, Loader2, RefreshCw, ExternalLink, Check, X, AlertCircle,
  CircleCheck, DollarSign, Banknote, ShieldCheck, Clock,
  Trash2, MoreHorizontal, Receipt, Link2, Unlink, ChevronRight,
  Building2, Landmark, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...opts }).then(r => r.json());

/* ── Status badge ─────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: "قيد المعالجة", color: "#F59E0B" },
  completed: { label: "مكتمل",        color: "#10B981" },
  failed:    { label: "فشل",           color: "#EF4444" },
  refunded:  { label: "مسترجع",       color: "#6B7280" },
  cancelled: { label: "ملغى",         color: "#6B7280" },
};

const METHOD_LABELS: Record<string, string> = {
  card:          "بطاقة ائتمانية",
  bank_transfer: "تحويل بنكي",
  cash:          "نقداً",
  stripe:        "Stripe",
};

function fmt(n: number) { return n?.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* ════════════════════════════════════════════════ */
export default function PaymentCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();
  const [tab, setTab] = useState("overview");
  const [showNewTx, setShowNewTx] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [connectForm, setConnectForm] = useState({ email: "", commissionPercent: "10" });
  const [txForm, setTxForm] = useState({
    clientName: "", description: "", amount: "", status: "completed",
    paymentMethod: "bank_transfer", invoiceId: "", caseId: "",
  });

  /* Handle Stripe onboarding return */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "complete") {
      toast({ title: "✅ تم إكمال إعداد Stripe!", description: "يمكنك الآن استقبال المدفوعات." });
      qc.invalidateQueries({ queryKey: ["connect-status"] });
    } else if (params.get("onboarding") === "refresh") {
      toast({ title: "إعداد Stripe غير مكتمل", description: "يرجى إعادة المحاولة.", variant: "destructive" });
    }
  }, []);

  /* Queries */
  const { data: stats, isLoading: statsLoad } = useQuery<any>({
    queryKey: ["payment-stats"],
    queryFn: () => API(`${BASE}/api/payments/stats`),
  });

  const { data: transactions = [], isLoading: txLoad, refetch: refetchTx } = useQuery<any[]>({
    queryKey: ["payment-transactions"],
    queryFn: () => API(`${BASE}/api/payments/transactions`),
    select: d => Array.isArray(d) ? d : [],
  });

  const { data: connectStatus, isLoading: connectLoad } = useQuery<any>({
    queryKey: ["connect-status"],
    queryFn: () => API(`${BASE}/api/payments/connect/status`),
  });

  /* Mutations */
  const createConnect = useMutation({
    mutationFn: (body: any) => API(`${BASE}/api/payments/connect/create`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      if (data.error) { toast({ title: "خطأ", description: data.error, variant: "destructive" }); return; }
      qc.invalidateQueries({ queryKey: ["connect-status"] });
      toast({ title: "تم إنشاء حساب Stripe Connect", description: "الآن أكمل إعداد بياناتك البنكية" });
      /* Get onboarding link */
      getOnboardingLink.mutate({ stripeAccountId: data.stripeAccountId });
      setShowConnect(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const getOnboardingLink = useMutation({
    mutationFn: (body: any) => API(`${BASE}/api/payments/connect/onboarding`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => { if (data.url) window.open(data.url, "_blank"); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const getLoginLink = useMutation({
    mutationFn: (accountId: string) => API(`${BASE}/api/payments/connect/login-link`, {
      method: "POST", body: JSON.stringify({ stripeAccountId: accountId }),
    }),
    onSuccess: (data) => { if (data.url) window.open(data.url, "_blank"); },
  });

  const addTransaction = useMutation({
    mutationFn: (body: any) => API(`${BASE}/api/payments/transactions`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-transactions"] });
      qc.invalidateQueries({ queryKey: ["payment-stats"] });
      setShowNewTx(false);
      setTxForm({ clientName: "", description: "", amount: "", status: "completed", paymentMethod: "bank_transfer", invoiceId: "", caseId: "" });
      toast({ title: "تم إضافة المعاملة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: any) => API(`${BASE}/api/payments/transactions/${id}/status`, {
      method: "PATCH", body: JSON.stringify({ status }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-transactions"] }); qc.invalidateQueries({ queryKey: ["payment-stats"] }); },
  });

  const deleteTx = useMutation({
    mutationFn: (id: string) => API(`${BASE}/api/payments/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-transactions"] }); qc.invalidateQueries({ queryKey: ["payment-stats"] }); toast({ title: "تم الحذف" }); },
  });

  const COMMISSION = connectStatus?.commissionPercent ?? 10;

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Landmark className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-black">المركز المالي</h1>
            <p className="text-xs text-muted-foreground">إدارة المدفوعات وربط Stripe Connect</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => { qc.invalidateQueries({ queryKey: ["payment-stats"] }); qc.invalidateQueries({ queryKey: ["payment-transactions"] }); }}>
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowNewTx(true)}>
            <Plus className="h-3.5 w-3.5" /> معاملة جديدة
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview"      className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><BarChart3 className="h-3.5 w-3.5" /> نظرة عامة</TabsTrigger>
          <TabsTrigger value="transactions"  className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><ArrowRightLeft className="h-3.5 w-3.5" /> المعاملات</TabsTrigger>
          <TabsTrigger value="stripe"        className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><CreditCard className="h-3.5 w-3.5" /> Stripe Connect</TabsTrigger>
        </TabsList>

        {/* ══ OVERVIEW TAB ══ */}
        <TabsContent value="overview" className="mt-4 space-y-5">

          {/* KPI Cards */}
          {statsLoad ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_,i) => <Card key={i} className="border-border/50 animate-pulse"><CardContent className="p-5 h-24" /></Card>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "إجمالي المدفوعات", value: `${fmt(stats?.completedAmount ?? 0)} ر.س`, sub: `${stats?.totalTransactions ?? 0} معاملة`, icon: <TrendingUp className="h-4 w-4" />, color: "#10B981" },
                { label: `عمولة المنصة (${COMMISSION}%)`, value: `${fmt(stats?.totalCommission ?? 0)} ر.س`, sub: "صافي إيراد عدالة AI", icon: <Building2 className="h-4 w-4" />, color: "#C9A84C" },
                { label: "صافي تحويل المكتب", value: `${fmt(stats?.totalNet ?? 0)} ر.س`, sub: `${100 - COMMISSION}% من الإجمالي`, icon: <Wallet className="h-4 w-4" />, color: "#3B82F6" },
                { label: "في انتظار التأكيد", value: `${fmt(stats?.pendingAmount ?? 0)} ر.س`, sub: "قيد المعالجة", icon: <Clock className="h-4 w-4" />, color: "#F59E0B" },
              ].map((c) => (
                <Card key={c.label} className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-1 leading-tight">{c.label}</p>
                        <p className="text-xl font-black" style={{ color: c.color }}>{c.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
                      </div>
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: c.color + "15", color: c.color }}>
                        {c.icon}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Commission breakdown card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-border/50 col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> المدفوعات الشهرية (آخر 6 أشهر)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!stats?.monthly?.length) ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات بعد</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.monthly} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any, n) => [`${Number(v).toLocaleString()} ر.س`, n === "total" ? "الإجمالي" : n === "commission" ? "العمولة" : "الصافي"]}
                      />
                      <Bar dataKey="total"      fill="#3B82F6" radius={[4,4,0,0]} name="total" />
                      <Bar dataKey="commission" fill="#C9A84C" radius={[4,4,0,0]} name="commission" />
                      <Bar dataKey="net"        fill="#10B981" radius={[4,4,0,0]} name="net" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Commission breakdown */}
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" /> توزيع الإيرادات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {[
                  { label: "إجمالي المستلم",   val: stats?.totalAmount ?? 0,     color: "#3B82F6", pct: 100 },
                  { label: "عمولة المنصة",      val: stats?.totalCommission ?? 0, color: "#C9A84C", pct: COMMISSION },
                  { label: "صافي المكتب",       val: stats?.totalNet ?? 0,        color: "#10B981", pct: 100 - COMMISSION },
                ].map(({ label, val, color, pct }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-mono font-bold">{fmt(val)} ر.س</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{pct}%</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Recent transactions */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> آخر المعاملات
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setTab("transactions")}>
                عرض الكل <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {txLoad ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد معاملات — أضف معاملة للبدء</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {transactions.slice(0, 5).map((tx: any) => {
                    const st = STATUS_MAP[tx.status] ?? STATUS_MAP.pending;
                    return (
                      <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: st.color + "15", color: st.color }}>
                          <Banknote className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tx.description}</p>
                          <p className="text-[11px] text-muted-foreground">{tx.client_name ?? "—"} · {new Date(tx.created_at).toLocaleDateString("ar-SA")}</p>
                        </div>
                        <div className="text-left flex-shrink-0">
                          <p className="text-sm font-bold">{fmt(parseFloat(tx.amount))} ر.س</p>
                          <Badge style={{ background: st.color + "20", color: st.color, border: `1px solid ${st.color}40` }} className="text-[9px] py-0 px-1.5">
                            {st.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ TRANSACTIONS TAB ══ */}
        <TabsContent value="transactions" className="mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" /> سجل المعاملات
                <Badge variant="secondary" className="text-xs">{transactions.length}</Badge>
              </CardTitle>
              <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowNewTx(true)}>
                <Plus className="h-3.5 w-3.5" /> جديد
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {txLoad ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowRightLeft className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">لا توجد معاملات</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right text-xs">الوصف</TableHead>
                        <TableHead className="text-right text-xs">العميل</TableHead>
                        <TableHead className="text-center text-xs">الإجمالي</TableHead>
                        <TableHead className="text-center text-xs">العمولة</TableHead>
                        <TableHead className="text-center text-xs">الصافي</TableHead>
                        <TableHead className="text-center text-xs">الحالة</TableHead>
                        <TableHead className="text-center text-xs">التاريخ</TableHead>
                        <TableHead className="text-center text-xs">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx: any) => {
                        const st = STATUS_MAP[tx.status] ?? STATUS_MAP.pending;
                        return (
                          <TableRow key={tx.id} className="hover:bg-muted/30">
                            <TableCell className="text-sm max-w-[160px] truncate">{tx.description}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{tx.client_name ?? "—"}</TableCell>
                            <TableCell className="text-center font-mono text-sm font-bold">{fmt(parseFloat(tx.amount))} ر.س</TableCell>
                            <TableCell className="text-center font-mono text-xs text-yellow-500">{fmt(parseFloat(tx.platform_fee ?? 0))} ر.س</TableCell>
                            <TableCell className="text-center font-mono text-sm text-emerald-400">{fmt(parseFloat(tx.net_amount ?? 0))} ر.س</TableCell>
                            <TableCell className="text-center">
                              <Badge style={{ background: st.color + "20", color: st.color, border: `1px solid ${st.color}40` }} className="text-[10px] py-0">
                                {st.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString("ar-SA")}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {tx.status === "pending" && (
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-500"
                                    onClick={() => updateStatus.mutate({ id: tx.id, status: "completed" })}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500"
                                  onClick={() => deleteTx.mutate(tx.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ STRIPE CONNECT TAB ══ */}
        <TabsContent value="stripe" className="mt-4 space-y-4">
          {/* Explainer */}
          <Card className="border-dashed border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 flex gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Stripe Connect Express</strong> يتيح للمكتب استقبال المدفوعات مباشرة.
                عدالة AI تقتطع <strong className="text-yellow-400">{COMMISSION}%</strong> كعمولة منصة تلقائياً،
                ويُحوَّل الباقي <strong className="text-emerald-400">({100 - COMMISSION}%)</strong> لحساب المكتب فوراً.
              </div>
            </CardContent>
          </Card>

          {/* Connect Status */}
          {connectLoad ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : connectStatus?.connected ? (
            <div className="space-y-4">
              {/* Status card */}
              <Card className={cn("border-2", connectStatus.chargesEnabled ? "border-emerald-500/40" : "border-yellow-500/40")}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      connectStatus.chargesEnabled ? "bg-emerald-500/10" : "bg-yellow-500/10")}>
                      {connectStatus.chargesEnabled
                        ? <CircleCheck className="h-6 w-6 text-emerald-400" />
                        : <Clock className="h-6 w-6 text-yellow-400" />}
                    </div>
                    <div className="flex-1">
                      <h3 className={cn("font-black text-base", connectStatus.chargesEnabled ? "text-emerald-400" : "text-yellow-400")}>
                        {connectStatus.chargesEnabled ? "الحساب متصل وجاهز للاستقبال" : "في انتظار إكمال الإعداد"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{connectStatus.stripeAccountId}</p>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <Badge variant={connectStatus.chargesEnabled ? "default" : "secondary"} className="text-xs gap-1">
                          {connectStatus.chargesEnabled ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          الدفعات: {connectStatus.chargesEnabled ? "مفعّلة" : "معطّلة"}
                        </Badge>
                        <Badge variant={connectStatus.payoutsEnabled ? "default" : "secondary"} className="text-xs gap-1">
                          {connectStatus.payoutsEnabled ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          التحويلات: {connectStatus.payoutsEnabled ? "مفعّلة" : "معطّلة"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          عمولة المنصة: {connectStatus.commissionPercent}%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {!connectStatus.onboardingCompleted && (
                        <Button size="sm" className="gap-1.5 text-xs"
                          onClick={() => getOnboardingLink.mutate({ stripeAccountId: connectStatus.stripeAccountId })}
                          disabled={getOnboardingLink.isPending}>
                          {getOnboardingLink.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          إكمال الإعداد <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                        onClick={() => getLoginLink.mutate(connectStatus.stripeAccountId)}
                        disabled={getLoginLink.isPending}>
                        {getLoginLink.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        لوحة Stripe <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* How it works */}
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">كيف تعمل المدفوعات</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    {[
                      { step: "العميل يدفع", color: "#3B82F6" },
                      { sep: true },
                      { step: `عدالة AI تقتطع ${COMMISSION}%`, color: "#C9A84C" },
                      { sep: true },
                      { step: `المكتب يستلم ${100 - COMMISSION}%`, color: "#10B981" },
                      { sep: true },
                      { step: "تحويل تلقائي", color: "#8B5CF6" },
                    ].map((item: any, i) =>
                      item.sep
                        ? <ChevronRight key={i} className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        : <div key={i} className="px-2 py-1 rounded-md font-medium" style={{ background: item.color + "15", color: item.color }}>{item.step}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Not connected */
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Link2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-black mb-2">ربط Stripe Connect</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  اربط حسابك ببنكك عبر Stripe لاستقبال المدفوعات من العملاء مباشرةً.
                  عدالة AI تقتطع {COMMISSION}% كعمولة منصة فقط.
                </p>
                <Button className="gap-2" onClick={() => setShowConnect(true)}>
                  <CreditCard className="h-4 w-4" /> ربط Stripe الآن
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ════ Add Transaction Dialog ════ */}
      <Dialog open={showNewTx} onOpenChange={setShowNewTx}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> معاملة مالية جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">المبلغ (ر.س) *</Label>
                <Input type="number" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} placeholder="1000" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">اسم العميل</Label>
                <Input value={txForm.clientName} onChange={e => setTxForm(f => ({ ...f, clientName: e.target.value }))} placeholder="أحمد محمد" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">الوصف *</Label>
              <Input value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} placeholder="أتعاب قضية رقم 2024-001" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">طريقة الدفع</Label>
                <Select value={txForm.paymentMethod} onValueChange={v => setTxForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(METHOD_LABELS).map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">الحالة</Label>
                <Select value={txForm.status} onValueChange={v => setTxForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([v, { label }]) => <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1 block">رقم الفاتورة</Label>
                <Input value={txForm.invoiceId} onChange={e => setTxForm(f => ({ ...f, invoiceId: e.target.value }))} placeholder="اختياري" dir="ltr" />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">رقم القضية</Label>
                <Input value={txForm.caseId} onChange={e => setTxForm(f => ({ ...f, caseId: e.target.value }))} placeholder="اختياري" dir="ltr" />
              </div>
            </div>
            {txForm.amount && (
              <div className="bg-muted/50 rounded-xl p-3 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">الإجمالي</span>
                  <span className="font-bold">{fmt(parseFloat(txForm.amount) || 0)} ر.س</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-yellow-500">عمولة المنصة ({COMMISSION}%)</span>
                  <span className="font-bold text-yellow-500">- {fmt((parseFloat(txForm.amount) || 0) * COMMISSION / 100)} ر.س</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                  <span className="text-emerald-400 font-bold">صافي المكتب</span>
                  <span className="font-bold text-emerald-400">{fmt((parseFloat(txForm.amount) || 0) * (1 - COMMISSION / 100))} ر.س</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTx(false)}>إلغاء</Button>
            <Button disabled={!txForm.amount || !txForm.description || addTransaction.isPending}
              onClick={() => addTransaction.mutate({ ...txForm, amount: parseFloat(txForm.amount) })}
              className="gap-2">
              {addTransaction.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Check className="h-4 w-4" /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Stripe Connect Dialog ════ */}
      <Dialog open={showConnect} onOpenChange={setShowConnect}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> ربط Stripe Connect
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">البريد الإلكتروني *</Label>
              <Input type="email" value={connectForm.email} onChange={e => setConnectForm(f => ({ ...f, email: e.target.value }))}
                placeholder="office@example.com" dir="ltr" />
              <p className="text-[10px] text-muted-foreground mt-1">سيُستخدم لتسجيل حساب Stripe Express الخاص بالمكتب</p>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">نسبة عمولة المنصة (%)</Label>
              <Input type="number" min="0" max="50" value={connectForm.commissionPercent}
                onChange={e => setConnectForm(f => ({ ...f, commissionPercent: e.target.value }))} dir="ltr" />
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                بعد الربط ستُعاد التوجيه إلى Stripe لإكمال بيانات حسابك البنكي (IBAN).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnect(false)}>إلغاء</Button>
            <Button disabled={!connectForm.email || createConnect.isPending}
              onClick={() => createConnect.mutate({ email: connectForm.email, commissionPercent: parseInt(connectForm.commissionPercent) })}
              className="gap-2">
              {createConnect.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <CreditCard className="h-4 w-4" /> ربط الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
