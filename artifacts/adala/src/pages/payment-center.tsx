import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, TrendingUp, Wallet, ArrowRightLeft,
  Plus, Loader2, RefreshCw, ExternalLink, Check, X, AlertCircle,
  CircleCheck, DollarSign, Banknote, ShieldCheck, Clock,
  Trash2, Receipt, Link2, ChevronRight, Building2, Landmark,
  BarChart3, BadgeCheck, Send, Copy, Zap, Settings, QrCode,
  ArrowDownToLine, Package, CheckCircle2, Circle,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...opts }).then(r => r.json());

/* ── helpers ─────────────────────────────────────── */
function fmt(n: number) {
  return (n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function copyToClipboard(text: string, label: string, toast: any) {
  navigator.clipboard.writeText(text).then(() => toast({ title: `✅ تم نسخ ${label}` }));
}

/* ── Maps ─────────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: "قيد المعالجة", color: "#F59E0B" },
  completed: { label: "مكتمل",        color: "#10B981" },
  failed:    { label: "فشل",           color: "#EF4444" },
  refunded:  { label: "مسترجع",       color: "#6B7280" },
  cancelled: { label: "ملغى",         color: "#6B7280" },
};
const SETTLE_MAP: Record<string, { label: string; color: string }> = {
  settled:   { label: "محوَّل",       color: "#10B981" },
  unsettled: { label: "بانتظار التحويل", color: "#F59E0B" },
};
const METHOD_LABELS: Record<string, string> = {
  card: "بطاقة ائتمانية", bank_transfer: "تحويل بنكي",
  cash: "نقداً", stripe: "Stripe", moyasar: "Moyasar", checkout: "Checkout.com",
};
const GATEWAY_COLORS: Record<string, string> = {
  manual: "#6B7280", stripe: "#635BFF", moyasar: "#1DB954", checkout: "#0ABD8C",
};

/* ══════════════════════════════════════════════════ */
export default function PaymentCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();
  const [tab, setTab] = useState("overview");

  /* dialog states */
  const [showNewTx, setShowNewTx]         = useState(false);
  const [showConnect, setShowConnect]     = useState(false);
  const [showPayLink, setShowPayLink]     = useState(false);
  const [showSettleDialog, setShowSettleDialog] = useState<string | null>(null);
  const [settleRef, setSettleRef]         = useState("");

  const [connectForm, setConnectForm] = useState({ email: "", commissionPercent: "10" });
  const [txForm, setTxForm] = useState({
    clientName: "", description: "", amount: "", status: "completed",
    paymentMethod: "bank_transfer", invoiceId: "", caseId: "",
  });
  const [payLinkForm, setPayLinkForm] = useState({
    amountSAR: "", description: "أتعاب قانونية", clientName: "",
    clientEmail: "", clientPhone: "", invoiceId: "", caseId: "",
  });
  const [generatedLink, setGeneratedLink] = useState<any>(null);

  /* Moyasar settings form */
  const [moyasarForm, setMoyasarForm] = useState({
    publishableKey: "", secretKey: "", webhookSecret: "",
    testMode: true, enabled: false,
  });

  /* Checkout.com settings form */
  const [checkoutForm, setCheckoutForm] = useState({
    secretKey: "", publicKey: "", webhookSecret: "",
    testMode: true, enabled: false,
  });

  /* Handle Stripe / Moyasar return */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "complete")
      toast({ title: "✅ تم إعداد Stripe!", description: "يمكنك الآن استقبال المدفوعات." });
    if (params.get("gateway") === "moyasar") {
      const result = params.get("result");
      if (result === "paid" || result === "captured")
        toast({ title: "✅ تم استلام الدفعة عبر Moyasar" });
      else
        toast({ title: "نتيجة الدفع: " + result, variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["payment-wallet"] });
      qc.invalidateQueries({ queryKey: ["payment-transactions"] });
    }
    if (params.get("gateway") === "checkout") {
      const result = params.get("result");
      if (result === "captured")
        toast({ title: "✅ تم استلام الدفعة عبر Checkout.com" });
      else
        toast({ title: "نتيجة Checkout.com: " + result, variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["payment-wallet"] });
      qc.invalidateQueries({ queryKey: ["payment-transactions"] });
    }
  }, []);

  /* ── Queries ────────────────────────────────────── */
  const { data: wallet, isLoading: walletLoad } = useQuery<any>({
    queryKey: ["payment-wallet"],
    queryFn: () => API(`${BASE}/api/payments/wallet`),
  });
  const { data: stats } = useQuery<any>({
    queryKey: ["payment-stats"],
    queryFn: () => API(`${BASE}/api/payments/stats`),
  });
  const { data: transactions = [], isLoading: txLoad } = useQuery<any[]>({
    queryKey: ["payment-transactions"],
    queryFn: () => API(`${BASE}/api/payments/transactions`),
    select: d => Array.isArray(d) ? d : [],
  });
  const { data: connectStatus, isLoading: connectLoad } = useQuery<any>({
    queryKey: ["connect-status"],
    queryFn: () => API(`${BASE}/api/payments/connect/status`),
  });
  const { data: moyasarSettings, isLoading: moyasarLoad } = useQuery<any>({
    queryKey: ["moyasar-settings"],
    queryFn: () => API(`${BASE}/api/payments/moyasar/settings`),
    onSuccess: (d: any) => {
      if (d) setMoyasarForm(f => ({ ...f, testMode: d.testMode ?? true, enabled: d.enabled ?? false }));
    },
  });
  const { data: checkoutSettings } = useQuery<any>({
    queryKey: ["checkout-settings"],
    queryFn: () => API(`${BASE}/api/payments/checkout/settings`),
    onSuccess: (d: any) => {
      if (d) setCheckoutForm(f => ({ ...f, testMode: d.testMode ?? true, enabled: d.enabled ?? false }));
    },
  });

  /* ── Mutations ──────────────────────────────────── */
  const createConnect = useMutation({
    mutationFn: (body: any) => API(`${BASE}/api/payments/connect/create`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      if (data.error) { toast({ title: "خطأ", description: data.error, variant: "destructive" }); return; }
      qc.invalidateQueries({ queryKey: ["connect-status"] });
      getOnboardingLink.mutate({ stripeAccountId: data.stripeAccountId });
      setShowConnect(false);
    },
  });
  const getOnboardingLink = useMutation({
    mutationFn: (body: any) => API(`${BASE}/api/payments/connect/onboarding`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => { if (data.url) window.open(data.url, "_blank"); },
  });
  const getLoginLink = useMutation({
    mutationFn: (accountId: string) => API(`${BASE}/api/payments/connect/login-link`, { method: "POST", body: JSON.stringify({ stripeAccountId: accountId }) }),
    onSuccess: (data) => { if (data.url) window.open(data.url, "_blank"); },
  });
  const addTransaction = useMutation({
    mutationFn: (body: any) => API(`${BASE}/api/payments/transactions`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-transactions"] });
      qc.invalidateQueries({ queryKey: ["payment-wallet"] });
      setShowNewTx(false);
      setTxForm({ clientName: "", description: "", amount: "", status: "completed", paymentMethod: "bank_transfer", invoiceId: "", caseId: "" });
      toast({ title: "تم إضافة المعاملة" });
    },
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: any) => API(`${BASE}/api/payments/transactions/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-transactions"] }); qc.invalidateQueries({ queryKey: ["payment-wallet"] }); },
  });
  const settleOne = useMutation({
    mutationFn: ({ id, ref }: any) => API(`${BASE}/api/payments/transactions/${id}/settle`, { method: "PATCH", body: JSON.stringify({ settlementRef: ref }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-transactions"] });
      qc.invalidateQueries({ queryKey: ["payment-wallet"] });
      setShowSettleDialog(null); setSettleRef("");
      toast({ title: "✅ تم تأكيد التحويل" });
    },
  });
  const batchSettle = useMutation({
    mutationFn: () => API(`${BASE}/api/payments/batch-settle`, { method: "POST", body: JSON.stringify({ settlementRef: `BATCH-${Date.now()}` }) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["payment-transactions"] });
      qc.invalidateQueries({ queryKey: ["payment-wallet"] });
      toast({ title: `✅ تم تسوية ${data.settled} معاملة` });
    },
  });
  const deleteTx = useMutation({
    mutationFn: (id: string) => API(`${BASE}/api/payments/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment-transactions"] }); qc.invalidateQueries({ queryKey: ["payment-wallet"] }); toast({ title: "تم الحذف" }); },
  });
  const saveMoyasar = useMutation({
    mutationFn: (body: any) => API(`${BASE}/api/payments/moyasar/settings`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["moyasar-settings"] }); toast({ title: "✅ تم حفظ إعدادات Moyasar" }); },
  });
  const saveCheckout = useMutation({
    mutationFn: (body: any) => API(`${BASE}/api/payments/checkout/settings`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checkout-settings"] }); toast({ title: "✅ تم حفظ إعدادات Checkout.com" }); },
  });
  const generatePayLink = useMutation({
    mutationFn: (body: any) => API(`${BASE}/api/payments/payment-link`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      setGeneratedLink(data);
      qc.invalidateQueries({ queryKey: ["payment-transactions"] });
      qc.invalidateQueries({ queryKey: ["payment-wallet"] });
      toast({ title: "✅ تم إنشاء رابط الدفع" });
    },
  });

  const COMMISSION = connectStatus?.commissionPercent ?? 10;
  const unsettled = transactions.filter(t => t.status === "completed" && (!t.settlement_status || t.settlement_status === "unsettled"));

  /* ── Render ─────────────────────────────────────── */
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
            <p className="text-xs text-muted-foreground">دورة حياة المدفوعات — من العميل للمكتب</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => {
            qc.invalidateQueries({ queryKey: ["payment-wallet"] });
            qc.invalidateQueries({ queryKey: ["payment-transactions"] });
          }}>
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowPayLink(true)}>
            <Send className="h-3.5 w-3.5" /> رابط دفع
          </Button>
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => setShowNewTx(true)}>
            <Plus className="h-3.5 w-3.5" /> معاملة يدوية
          </Button>
        </div>
      </div>

      {/* ── Payment Lifecycle Flow ── */}
      <Card className="border-border/40 bg-gradient-to-l from-emerald-500/5 to-blue-500/5">
        <CardContent className="p-4">
          <p className="text-[10px] text-muted-foreground mb-2 font-semibold">دورة حياة الدفعة</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { step: "العميل يدفع",               color: "#3B82F6", icon: <DollarSign className="h-3 w-3" /> },
              { arrow: true },
              { step: "Moyasar / Stripe يستلم",    color: "#8B5CF6", icon: <CreditCard className="h-3 w-3" /> },
              { arrow: true },
              { step: `عدالة AI تقتطع ${COMMISSION}%`, color: "#C9A84C", icon: <Building2 className="h-3 w-3" /> },
              { arrow: true },
              { step: `المكتب يستلم ${100 - COMMISSION}%`, color: "#10B981", icon: <Wallet className="h-3 w-3" /> },
              { arrow: true },
              { step: "تسوية بنكية",               color: "#06B6D4", icon: <BadgeCheck className="h-3 w-3" /> },
            ].map((item: any, i) =>
              item.arrow
                ? <ChevronRight key={i} className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                : (
                  <div key={i} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: item.color + "18", color: item.color, border: `1px solid ${item.color}30` }}>
                    {item.icon} {item.step}
                  </div>
                )
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="overview"     className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><BarChart3 className="h-3.5 w-3.5" /> نظرة عامة</TabsTrigger>
          <TabsTrigger value="wallet"       className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><Wallet className="h-3.5 w-3.5" /> المحفظة</TabsTrigger>
          <TabsTrigger value="settlements"  className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5 relative">
            <ArrowDownToLine className="h-3.5 w-3.5" /> التسويات
            {unsettled.length > 0 && (
              <span className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
                {unsettled.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><ArrowRightLeft className="h-3.5 w-3.5" /> المعاملات</TabsTrigger>
          <TabsTrigger value="gateway"      className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><Zap className="h-3.5 w-3.5" /> بوابة الدفع</TabsTrigger>
          <TabsTrigger value="stripe"       className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><CreditCard className="h-3.5 w-3.5" /> Stripe</TabsTrigger>
          <TabsTrigger value="checkout"     className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Checkout.com</TabsTrigger>
        </TabsList>

        {/* ══ OVERVIEW TAB ══ */}
        <TabsContent value="overview" className="mt-4 space-y-5">
          {walletLoad ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_,i) => <Card key={i} className="border-border/50 animate-pulse"><CardContent className="p-5 h-24" /></Card>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "إجمالي المدفوعات",       value: `${fmt(wallet?.completedAmount ?? 0)} ر.س`, sub: `${wallet?.totalTransactions ?? 0} معاملة`,        icon: <TrendingUp className="h-4 w-4" />,      color: "#10B981" },
                { label: `عمولة المنصة (${COMMISSION}%)`, value: `${fmt(wallet?.totalCommission ?? 0)} ر.س`, sub: "صافي إيراد عدالة AI",                    icon: <Building2 className="h-4 w-4" />,       color: "#C9A84C" },
                { label: "صافي تحويل المكتب",       value: `${fmt(wallet?.totalNet ?? 0)} ر.س`,       sub: `${100 - COMMISSION}% من الإجمالي`,             icon: <Wallet className="h-4 w-4" />,          color: "#3B82F6" },
                { label: "في انتظار التأكيد",        value: `${fmt(wallet?.pendingAmount ?? 0)} ر.س`,  sub: "قيد المعالجة",                                  icon: <Clock className="h-4 w-4" />,           color: "#F59E0B" },
              ].map((c) => (
                <Card key={c.label} className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground mb-1 leading-tight">{c.label}</p>
                        <p className="text-xl font-black" style={{ color: c.color }}>{c.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
                      </div>
                      <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.color + "15", color: c.color }}>
                        {c.icon}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-border/50 col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> المدفوعات الشهرية (آخر 6 أشهر)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!(wallet?.monthly?.length) ? (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات بعد</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={wallet.monthly} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any, n: any) => [`${Number(v).toLocaleString()} ر.س`, n === "total" ? "الإجمالي" : n === "commission" ? "العمولة" : "الصافي"]}
                      />
                      <Bar dataKey="total"      fill="#3B82F6" radius={[4,4,0,0]} />
                      <Bar dataKey="commission" fill="#C9A84C" radius={[4,4,0,0]} />
                      <Bar dataKey="net"        fill="#10B981" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> توزيع البوابات
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!(wallet?.byGateway?.length) ? (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">لا بيانات</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={130}>
                      <PieChart>
                        <Pie data={wallet.byGateway} dataKey="total" nameKey="gateway" cx="50%" cy="50%" outerRadius={55} label={({ gateway, percent }: any) => `${gateway} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                          {wallet.byGateway.map((g: any, i: number) => (
                            <Cell key={g.gateway} fill={GATEWAY_COLORS[g.gateway] ?? "#94A3B8"} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} ر.س`]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-2">
                      {wallet.byGateway.map((g: any) => (
                        <div key={g.gateway} className="flex justify-between text-xs">
                          <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ background: GATEWAY_COLORS[g.gateway] ?? "#94A3B8" }} />
                            {g.gateway}
                          </span>
                          <span className="font-mono">{fmt(g.total)} ر.س</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
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
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد معاملات</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {transactions.slice(0, 5).map((tx: any) => {
                    const st = STATUS_MAP[tx.status] ?? STATUS_MAP.pending;
                    const ss = SETTLE_MAP[tx.settlement_status ?? "unsettled"] ?? SETTLE_MAP.unsettled;
                    return (
                      <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: st.color + "15", color: st.color }}>
                          <Banknote className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{tx.description}</p>
                          <p className="text-[11px] text-muted-foreground">{tx.client_name ?? "—"} · {new Date(tx.created_at).toLocaleDateString("ar-SA")}</p>
                        </div>
                        <div className="text-left flex-shrink-0 flex flex-col items-end gap-1">
                          <p className="text-sm font-bold">{fmt(parseFloat(tx.amount))} ر.س</p>
                          <div className="flex gap-1">
                            <Badge style={{ background: st.color + "20", color: st.color, border: `1px solid ${st.color}40` }} className="text-[9px] py-0 px-1.5">{st.label}</Badge>
                            {tx.status === "completed" && (
                              <Badge style={{ background: ss.color + "20", color: ss.color, border: `1px solid ${ss.color}40` }} className="text-[9px] py-0 px-1.5">{ss.label}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ WALLET TAB ══ */}
        <TabsContent value="wallet" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: "إجمالي المستلم",
                value: wallet?.completedAmount ?? 0,
                sub: "جميع المدفوعات المكتملة",
                color: "#3B82F6",
                icon: <DollarSign className="h-5 w-5" />,
              },
              {
                label: "عمولة عدالة AI",
                value: wallet?.totalCommission ?? 0,
                sub: `${COMMISSION}% من الإجمالي`,
                color: "#C9A84C",
                icon: <Building2 className="h-5 w-5" />,
              },
              {
                label: "صافي رصيدك",
                value: wallet?.totalNet ?? 0,
                sub: `${100 - COMMISSION}% لحسابك`,
                color: "#10B981",
                icon: <Wallet className="h-5 w-5" />,
              },
            ].map(c => (
              <Card key={c.label} className="border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: c.color + "18", color: c.color }}>
                      {c.icon}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                  </div>
                  <p className="text-3xl font-black" style={{ color: c.color }}>{fmt(c.value)}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-semibold">ريال سعودي</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Settlement summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm font-semibold text-emerald-400">تم التحويل للبنك</p>
                </div>
                <p className="text-2xl font-black text-emerald-400">{fmt(wallet?.settledNet ?? 0)} <span className="text-sm">ر.س</span></p>
                <p className="text-[10px] text-muted-foreground mt-1">الصافي المحوَّل فعلياً لحسابك البنكي</p>
              </CardContent>
            </Card>
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <p className="text-sm font-semibold text-amber-400">ينتظر التحويل</p>
                  </div>
                  {(wallet?.unsettledCount ?? 0) > 0 && (
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-amber-500/40 text-amber-400"
                      onClick={() => setTab("settlements")}>
                      تسوية <ChevronRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-2xl font-black text-amber-400">{fmt(wallet?.unsettledNet ?? 0)} <span className="text-sm">ر.س</span></p>
                <p className="text-[10px] text-muted-foreground mt-1">{wallet?.unsettledCount ?? 0} معاملة بانتظار التحويل</p>
              </CardContent>
            </Card>
          </div>

          {/* Distribution bars */}
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> توزيع الإيرادات</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "إجمالي المستلم",   val: wallet?.totalAmount ?? 0,      color: "#3B82F6", pct: 100 },
                { label: "عمولة المنصة",      val: wallet?.totalCommission ?? 0,  color: "#C9A84C", pct: COMMISSION },
                { label: "صافي المكتب",       val: wallet?.totalNet ?? 0,         color: "#10B981", pct: 100 - COMMISSION },
                { label: "تم التسوية",        val: wallet?.settledNet ?? 0,       color: "#06B6D4", pct: wallet?.totalNet ? Math.round((wallet.settledNet / wallet.totalNet) * (100 - COMMISSION)) : 0 },
              ].map(({ label, val, color, pct }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono font-bold">{fmt(val)} ر.س</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ SETTLEMENTS TAB ══ */}
        <TabsContent value="settlements" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold">نظام التسويات</h3>
              <p className="text-xs text-muted-foreground">{unsettled.length} معاملة مكتملة بانتظار تأكيد التحويل</p>
            </div>
            {unsettled.length > 0 && (
              <Button size="sm" className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={batchSettle.isPending}
                onClick={() => batchSettle.mutate()}>
                {batchSettle.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                تسوية الكل ({unsettled.length})
              </Button>
            )}
          </div>

          {/* Unsettled */}
          {unsettled.length > 0 ? (
            <Card className="border-amber-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> بانتظار التحويل البنكي
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right text-xs">الوصف</TableHead>
                      <TableHead className="text-right text-xs">العميل</TableHead>
                      <TableHead className="text-center text-xs">الإجمالي</TableHead>
                      <TableHead className="text-center text-xs">صافي المكتب</TableHead>
                      <TableHead className="text-center text-xs">التاريخ</TableHead>
                      <TableHead className="text-center text-xs">تسوية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unsettled.map((tx: any) => (
                      <TableRow key={tx.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm max-w-[150px] truncate">{tx.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{tx.client_name ?? "—"}</TableCell>
                        <TableCell className="text-center font-mono text-sm font-bold">{fmt(parseFloat(tx.amount))} ر.س</TableCell>
                        <TableCell className="text-center font-mono text-sm text-emerald-400">{fmt(parseFloat(tx.net_amount ?? 0))} ر.س</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("ar-SA")}</TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1 text-emerald-500 border-emerald-500/30"
                            onClick={() => { setShowSettleDialog(tx.id); setSettleRef(""); }}>
                            <CheckCircle2 className="h-3 w-3" /> تأكيد التحويل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="py-10 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-400 opacity-60" />
                <p className="text-sm font-bold text-emerald-400">جميع المدفوعات محوَّلة ✅</p>
                <p className="text-xs text-muted-foreground mt-1">لا توجد معاملات بانتظار التسوية</p>
              </CardContent>
            </Card>
          )}

          {/* Settled history */}
          {transactions.filter(t => t.settlement_status === "settled").length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4" /> سجل التسويات المنجزة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right text-xs">الوصف</TableHead>
                      <TableHead className="text-center text-xs">المبلغ الصافي</TableHead>
                      <TableHead className="text-center text-xs">رقم المرجع</TableHead>
                      <TableHead className="text-center text-xs">تاريخ التسوية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.filter(t => t.settlement_status === "settled").map((tx: any) => (
                      <TableRow key={tx.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm max-w-[150px] truncate">{tx.description}</TableCell>
                        <TableCell className="text-center font-mono text-sm text-emerald-400">{fmt(parseFloat(tx.net_amount ?? 0))} ر.س</TableCell>
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">{tx.settlement_ref ?? "—"}</TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {tx.settled_at ? new Date(tx.settled_at).toLocaleDateString("ar-SA") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
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
                        <TableHead className="text-center text-xs">البوابة</TableHead>
                        <TableHead className="text-center text-xs">الإجمالي</TableHead>
                        <TableHead className="text-center text-xs">العمولة</TableHead>
                        <TableHead className="text-center text-xs">الصافي</TableHead>
                        <TableHead className="text-center text-xs">الحالة</TableHead>
                        <TableHead className="text-center text-xs">التسوية</TableHead>
                        <TableHead className="text-center text-xs">التاريخ</TableHead>
                        <TableHead className="text-center text-xs">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx: any) => {
                        const st = STATUS_MAP[tx.status] ?? STATUS_MAP.pending;
                        const ss = SETTLE_MAP[tx.settlement_status ?? "unsettled"] ?? SETTLE_MAP.unsettled;
                        const gwColor = GATEWAY_COLORS[tx.gateway ?? "manual"] ?? "#94A3B8";
                        return (
                          <TableRow key={tx.id} className="hover:bg-muted/30">
                            <TableCell className="text-sm max-w-[140px] truncate">{tx.description}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{tx.client_name ?? "—"}</TableCell>
                            <TableCell className="text-center">
                              <Badge className="text-[9px] py-0 px-1.5" style={{ background: gwColor + "20", color: gwColor, border: `1px solid ${gwColor}40` }}>
                                {tx.gateway ?? "يدوي"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-mono text-sm font-bold">{fmt(parseFloat(tx.amount))} ر.س</TableCell>
                            <TableCell className="text-center font-mono text-xs text-yellow-500">{fmt(parseFloat(tx.platform_fee ?? 0))} ر.س</TableCell>
                            <TableCell className="text-center font-mono text-sm text-emerald-400">{fmt(parseFloat(tx.net_amount ?? 0))} ر.س</TableCell>
                            <TableCell className="text-center">
                              <Badge style={{ background: st.color + "20", color: st.color, border: `1px solid ${st.color}40` }} className="text-[10px] py-0">{st.label}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {tx.status === "completed" ? (
                                <Badge style={{ background: ss.color + "20", color: ss.color, border: `1px solid ${ss.color}40` }} className="text-[10px] py-0">{ss.label}</Badge>
                              ) : <span className="text-[10px] text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("ar-SA")}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {tx.status === "pending" && (
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-500" onClick={() => updateStatus.mutate({ id: tx.id, status: "completed" })}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                )}
                                {tx.status === "completed" && (!tx.settlement_status || tx.settlement_status === "unsettled") && (
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-cyan-500" title="تأكيد التحويل"
                                    onClick={() => { setShowSettleDialog(tx.id); setSettleRef(""); }}>
                                    <ArrowDownToLine className="h-3 w-3" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => deleteTx.mutate(tx.id)}>
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

        {/* ══ PAYMENT GATEWAY TAB (Moyasar) ══ */}
        <TabsContent value="gateway" className="mt-4 space-y-4">
          {/* Header info */}
          <Card className="border-dashed border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex gap-3">
              <Zap className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Moyasar</strong> — بوابة الدفع المعتمدة في المملكة العربية السعودية.
                تدعم مدى، Visa، Mastercard، Apple Pay، وSTC Pay.
                يصل Webhook URL التلقائي: <code className="bg-muted px-1 rounded text-[10px] font-mono">/api/webhook/moyasar</code>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Settings form */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" /> إعدادات Moyasar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">تفعيل Moyasar</p>
                    <p className="text-[10px] text-muted-foreground">استقبال المدفوعات عبر Moyasar</p>
                  </div>
                  <Switch checked={moyasarForm.enabled} onCheckedChange={v => setMoyasarForm(f => ({ ...f, enabled: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">وضع الاختبار</p>
                    <p className="text-[10px] text-muted-foreground">Test mode — بدون مدفوعات حقيقية</p>
                  </div>
                  <Switch checked={moyasarForm.testMode} onCheckedChange={v => setMoyasarForm(f => ({ ...f, testMode: v }))} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Publishable Key</Label>
                  <Input dir="ltr" placeholder="pk_test_..." value={moyasarForm.publishableKey}
                    onChange={e => setMoyasarForm(f => ({ ...f, publishableKey: e.target.value }))}
                    className="font-mono text-xs" />
                  {moyasarSettings?.publishableKey && !moyasarForm.publishableKey && (
                    <p className="text-[10px] text-emerald-400 mt-0.5">✓ محفوظ — اترك فارغاً للإبقاء عليه</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Secret Key</Label>
                  <Input dir="ltr" type="password" placeholder="sk_test_..." value={moyasarForm.secretKey}
                    onChange={e => setMoyasarForm(f => ({ ...f, secretKey: e.target.value }))}
                    className="font-mono text-xs" />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Webhook Secret (اختياري)</Label>
                  <Input dir="ltr" type="password" placeholder="للتحقق من صحة الإشعارات" value={moyasarForm.webhookSecret}
                    onChange={e => setMoyasarForm(f => ({ ...f, webhookSecret: e.target.value }))}
                    className="font-mono text-xs" />
                </div>

                {/* Webhook URL */}
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground font-semibold mb-1">Webhook URL (أضفه في لوحة Moyasar)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] font-mono text-emerald-400 flex-1 truncate">
                      {moyasarSettings?.webhookUrl ?? (window.location.origin + "/api/webhook/moyasar")}
                    </code>
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => copyToClipboard(moyasarSettings?.webhookUrl ?? (window.location.origin + "/api/webhook/moyasar"), "Webhook URL", toast)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <Button className="w-full gap-2 text-xs" disabled={saveMoyasar.isPending}
                  onClick={() => saveMoyasar.mutate(moyasarForm)}>
                  {saveMoyasar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  حفظ الإعدادات
                </Button>
              </CardContent>
            </Card>

            {/* Payment Link Generator */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" /> مولّد رابط الدفع
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!generatedLink ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-semibold mb-1 block">المبلغ (ر.س) *</Label>
                        <Input type="number" dir="ltr" placeholder="1000" value={payLinkForm.amountSAR}
                          onChange={e => setPayLinkForm(f => ({ ...f, amountSAR: e.target.value }))} className="text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold mb-1 block">اسم العميل</Label>
                        <Input placeholder="أحمد محمد" value={payLinkForm.clientName}
                          onChange={e => setPayLinkForm(f => ({ ...f, clientName: e.target.value }))} className="text-xs" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold mb-1 block">الوصف *</Label>
                      <Input placeholder="أتعاب قضية رقم..." value={payLinkForm.description}
                        onChange={e => setPayLinkForm(f => ({ ...f, description: e.target.value }))} className="text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs font-semibold mb-1 block">بريد العميل</Label>
                        <Input type="email" dir="ltr" placeholder="client@email.com" value={payLinkForm.clientEmail}
                          onChange={e => setPayLinkForm(f => ({ ...f, clientEmail: e.target.value }))} className="text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold mb-1 block">جوال العميل</Label>
                        <Input dir="ltr" placeholder="05xxxxxxxx" value={payLinkForm.clientPhone}
                          onChange={e => setPayLinkForm(f => ({ ...f, clientPhone: e.target.value }))} className="text-xs" />
                      </div>
                    </div>
                    {payLinkForm.amountSAR && (
                      <div className="bg-muted/50 rounded-xl p-3 text-xs">
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">الإجمالي</span>
                          <span className="font-bold">{fmt(parseFloat(payLinkForm.amountSAR) || 0)} ر.س</span>
                        </div>
                        <div className="flex justify-between mb-1">
                          <span className="text-yellow-500">عمولة المنصة ({COMMISSION}%)</span>
                          <span className="font-bold text-yellow-500">- {fmt((parseFloat(payLinkForm.amountSAR) || 0) * COMMISSION / 100)} ر.س</span>
                        </div>
                        <div className="flex justify-between border-t border-border/50 pt-1 mt-1">
                          <span className="text-emerald-400 font-bold">صافيك</span>
                          <span className="font-bold text-emerald-400">{fmt((parseFloat(payLinkForm.amountSAR) || 0) * (1 - COMMISSION / 100))} ر.س</span>
                        </div>
                      </div>
                    )}
                    <Button className="w-full gap-2 text-xs" disabled={!payLinkForm.amountSAR || !payLinkForm.description || generatePayLink.isPending}
                      onClick={() => generatePayLink.mutate({ ...payLinkForm, amountSAR: parseFloat(payLinkForm.amountSAR), commissionPercent: COMMISSION })}>
                      {generatePayLink.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      توليد رابط الدفع
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                      <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                      <p className="text-sm font-bold text-emerald-400">تم إنشاء رابط الدفع!</p>
                      <p className="text-xs text-muted-foreground mt-1">{fmt(generatedLink.amount)} ر.س · صافيك: {fmt(generatedLink.netAmount)} ر.س</p>
                    </div>

                    {generatedLink.paymentUrl ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold">رابط Moyasar</p>
                        <div className="flex gap-2">
                          <Input dir="ltr" readOnly value={generatedLink.paymentUrl} className="text-[10px] font-mono" />
                          <Button size="icon" variant="outline" onClick={() => copyToClipboard(generatedLink.paymentUrl, "رابط Moyasar", toast)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => window.open(generatedLink.paymentUrl, "_blank")}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-400">
                        ⚠️ أضف Moyasar Publishable Key في الإعدادات للحصول على رابط Moyasar مباشر.
                        <p className="mt-1 text-muted-foreground">تم تسجيل المعاملة ويمكنك تحديث حالتها يدوياً.</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => { setGeneratedLink(null); setPayLinkForm({ amountSAR: "", description: "أتعاب قانونية", clientName: "", clientEmail: "", clientPhone: "", invoiceId: "", caseId: "" }); }}>
                        رابط جديد
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => setTab("transactions")}>
                        عرض المعاملات
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Supported methods */}
          <Card className="border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">طرق الدفع المدعومة</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {["مدى", "Visa", "Mastercard", "Apple Pay", "STC Pay", "Tabby (تقسيط)"].map(m => (
                  <Badge key={m} variant="outline" className="text-xs gap-1">
                    <CircleCheck className="h-3 w-3 text-emerald-500" /> {m}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ STRIPE CONNECT TAB ══ */}
        <TabsContent value="stripe" className="mt-4 space-y-4">
          <Card className="border-dashed border-blue-500/30 bg-blue-500/5">
            <CardContent className="p-4 flex gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Stripe Connect Express</strong> يتيح للمكتب استقبال المدفوعات الدولية.
                عدالة AI تقتطع <strong className="text-yellow-400">{COMMISSION}%</strong> كعمولة منصة تلقائياً،
                ويُحوَّل الباقي <strong className="text-emerald-400">({100 - COMMISSION}%)</strong> لحساب المكتب.
              </div>
            </CardContent>
          </Card>

          {connectLoad ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : connectStatus?.connected ? (
            <div className="space-y-4">
              <Card className={cn("border-2", connectStatus.chargesEnabled ? "border-emerald-500/40" : "border-yellow-500/40")}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
                      connectStatus.chargesEnabled ? "bg-emerald-500/10" : "bg-yellow-500/10")}>
                      {connectStatus.chargesEnabled ? <CircleCheck className="h-6 w-6 text-emerald-400" /> : <Clock className="h-6 w-6 text-yellow-400" />}
                    </div>
                    <div className="flex-1">
                      <h3 className={cn("font-black text-base", connectStatus.chargesEnabled ? "text-emerald-400" : "text-yellow-400")}>
                        {connectStatus.chargesEnabled ? "الحساب متصل وجاهز" : "في انتظار إكمال الإعداد"}
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
                        <Badge variant="outline" className="text-xs">عمولة: {connectStatus.commissionPercent}%</Badge>
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
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Link2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-black mb-2">ربط Stripe Connect</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                  اربط حسابك البنكي عبر Stripe لاستقبال المدفوعات الدولية مباشرةً.
                </p>
                <Button className="gap-2" onClick={() => setShowConnect(true)}>
                  <CreditCard className="h-4 w-4" /> ربط Stripe الآن
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ CHECKOUT.COM TAB ══ */}
        <TabsContent value="checkout" className="mt-4 space-y-4">
          {/* Info banner */}
          <Card className="border-dashed border-[#0ABD8C]/30 bg-[#0ABD8C]/5">
            <CardContent className="p-4 flex gap-3">
              <ShieldCheck className="h-5 w-5 text-[#0ABD8C] mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Checkout.com</strong> — بوابة دفع عالمية معتمدة في المنطقة العربية.
                تدعم <strong className="text-foreground">مدى</strong>، Apple Pay، STC Pay، Visa، Mastercard، وKNET.
                Webhook URL: <code className="bg-muted px-1 rounded text-[10px] font-mono">/api/webhook/checkout</code>
              </div>
            </CardContent>
          </Card>

          {/* Payment methods badges */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: "مدى",         color: "bg-green-500/10 text-green-400 border-green-500/20" },
              { label: "Apple Pay",   color: "bg-gray-500/10 text-gray-300 border-gray-500/20" },
              { label: "STC Pay",     color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
              { label: "Visa",        color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
              { label: "Mastercard",  color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
              { label: "KNET",        color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
            ].map(m => (
              <span key={m.label} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${m.color}`}>
                {m.label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Settings form */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Settings className="h-4 w-4 text-[#0ABD8C]" /> إعدادات Checkout.com
                  {checkoutSettings?.enabled && (
                    <Badge className="text-[10px] bg-[#0ABD8C]/20 text-[#0ABD8C] border-[#0ABD8C]/30 mr-auto">مفعّل</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">تفعيل Checkout.com</p>
                    <p className="text-[10px] text-muted-foreground">استقبال المدفوعات عبر Checkout.com</p>
                  </div>
                  <Switch checked={checkoutForm.enabled} onCheckedChange={v => setCheckoutForm(f => ({ ...f, enabled: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">وضع الاختبار (Sandbox)</p>
                    <p className="text-[10px] text-muted-foreground">بدون مدفوعات حقيقية</p>
                  </div>
                  <Switch checked={checkoutForm.testMode} onCheckedChange={v => setCheckoutForm(f => ({ ...f, testMode: v }))} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Secret Key</Label>
                  <Input dir="ltr" type="password" placeholder="sk_test_..." value={checkoutForm.secretKey}
                    onChange={e => setCheckoutForm(f => ({ ...f, secretKey: e.target.value }))}
                    className="font-mono text-xs" />
                  {checkoutSettings?.secretKey && !checkoutForm.secretKey && (
                    <p className="text-[10px] text-[#0ABD8C] mt-0.5">✓ محفوظ — اترك فارغاً للإبقاء عليه</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Public Key</Label>
                  <Input dir="ltr" placeholder="pk_test_..." value={checkoutForm.publicKey}
                    onChange={e => setCheckoutForm(f => ({ ...f, publicKey: e.target.value }))}
                    className="font-mono text-xs" />
                  {checkoutSettings?.publicKey && !checkoutForm.publicKey && (
                    <p className="text-[10px] text-[#0ABD8C] mt-0.5">✓ محفوظ</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">Webhook Secret (اختياري)</Label>
                  <Input dir="ltr" type="password" placeholder="للتحقق من إشعارات Checkout" value={checkoutForm.webhookSecret}
                    onChange={e => setCheckoutForm(f => ({ ...f, webhookSecret: e.target.value }))}
                    className="font-mono text-xs" />
                </div>

                {/* Webhook URL */}
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground font-semibold mb-1">Webhook URL (أضفه في لوحة Checkout.com)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] font-mono text-[#0ABD8C] flex-1 truncate">
                      {checkoutSettings?.webhookUrl ?? (window.location.origin + "/api/webhook/checkout")}
                    </code>
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => copyToClipboard(
                        checkoutSettings?.webhookUrl ?? (window.location.origin + "/api/webhook/checkout"),
                        "Webhook URL", toast
                      )}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <Button className="w-full gap-2 text-xs bg-[#0ABD8C] hover:bg-[#099b76] text-white"
                  disabled={saveCheckout.isPending}
                  onClick={() => saveCheckout.mutate(checkoutForm)}>
                  {saveCheckout.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  حفظ الإعدادات
                </Button>
              </CardContent>
            </Card>

            {/* Setup guide */}
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Package className="h-4 w-4 text-[#0ABD8C]" /> دليل الإعداد
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { n: 1, title: "أنشئ حساباً في Checkout.com", desc: "checkout.com/ar-ae → طلب حساب تجاري" },
                  { n: 2, title: "احصل على المفاتيح", desc: 'لوحة التحكم → Settings → Channels → API keys' },
                  { n: 3, title: "أدخل المفاتيح هنا", desc: "Secret Key + Public Key في الخانات على اليسار" },
                  { n: 4, title: "أضف Webhook URL", desc: "لوحة Checkout → Webhooks → أضف الرابط أعلاه" },
                  { n: 5, title: "فعّل البوابة", desc: "شغّل مفتاح التفعيل واحفظ — جاهز!" },
                ].map(step => (
                  <div key={step.n} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-[#0ABD8C]/15 text-[#0ABD8C] text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                      {step.n}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{step.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-border/50">
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs border-[#0ABD8C]/30 text-[#0ABD8C] hover:bg-[#0ABD8C]/10"
                    onClick={() => window.open("https://www.checkout.com/ar-ae", "_blank")}>
                    <ExternalLink className="h-3.5 w-3.5" /> فتح موقع Checkout.com
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status card */}
          <Card className={`border-2 ${checkoutSettings?.enabled ? "border-[#0ABD8C]/40" : "border-dashed border-border/50"}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${checkoutSettings?.enabled ? "bg-[#0ABD8C]/15" : "bg-muted/50"}`}>
                {checkoutSettings?.enabled
                  ? <CircleCheck className="h-5 w-5 text-[#0ABD8C]" />
                  : <Circle className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">
                  {checkoutSettings?.enabled ? "Checkout.com مفعّل" : "Checkout.com غير مفعّل"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {checkoutSettings?.enabled
                    ? checkoutSettings?.testMode ? "وضع الاختبار (Sandbox) — لا مدفوعات حقيقية" : "وضع الإنتاج — المدفوعات الحقيقية مفعّلة"
                    : "أدخل المفاتيح وفعّل البوابة لبدء استقبال المدفوعات"}
                </p>
              </div>
              {checkoutSettings?.enabled && !checkoutSettings?.testMode && (
                <Badge className="bg-[#0ABD8C]/20 text-[#0ABD8C] border-[#0ABD8C]/30 text-xs">Live</Badge>
              )}
              {checkoutSettings?.enabled && checkoutSettings?.testMode && (
                <Badge variant="secondary" className="text-xs">Sandbox</Badge>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ════ Settle Single Dialog ════ */}
      <Dialog open={!!showSettleDialog} onOpenChange={() => setShowSettleDialog(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-emerald-500" /> تأكيد تحويل الدفعة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">هذا يؤكد أن المبلغ الصافي تم تحويله فعلياً لحسابك البنكي.</p>
            <div>
              <Label className="text-xs font-semibold mb-1 block">رقم المرجع البنكي (اختياري)</Label>
              <Input dir="ltr" placeholder="مثال: TRF-2024-001" value={settleRef} onChange={e => setSettleRef(e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettleDialog(null)}>إلغاء</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2" disabled={settleOne.isPending}
              onClick={() => settleOne.mutate({ id: showSettleDialog, ref: settleRef })}>
              {settleOne.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              تأكيد التحويل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Add Transaction Dialog ════ */}
      <Dialog open={showNewTx} onOpenChange={setShowNewTx}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> معاملة مالية يدوية</DialogTitle></DialogHeader>
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
                  <SelectContent>{Object.entries(METHOD_LABELS).map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">الحالة</Label>
                <Select value={txForm.status} onValueChange={v => setTxForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_MAP).map(([v, { label }]) => <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>)}</SelectContent>
                </Select>
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
              onClick={() => addTransaction.mutate({ ...txForm, amount: parseFloat(txForm.amount) })} className="gap-2">
              {addTransaction.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Check className="h-4 w-4" /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Payment Link Dialog (from header button) ════ */}
      <Dialog open={showPayLink} onOpenChange={v => { setShowPayLink(v); if (!v) { setGeneratedLink(null); setPayLinkForm({ amountSAR: "", description: "أتعاب قانونية", clientName: "", clientEmail: "", clientPhone: "", invoiceId: "", caseId: "" }); } }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> إنشاء رابط دفع</DialogTitle></DialogHeader>
          {!generatedLink ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">المبلغ (ر.س) *</Label>
                  <Input type="number" dir="ltr" placeholder="1000" value={payLinkForm.amountSAR} onChange={e => setPayLinkForm(f => ({ ...f, amountSAR: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">اسم العميل</Label>
                  <Input placeholder="أحمد محمد" value={payLinkForm.clientName} onChange={e => setPayLinkForm(f => ({ ...f, clientName: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">الوصف *</Label>
                <Input placeholder="أتعاب قضية..." value={payLinkForm.description} onChange={e => setPayLinkForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">بريد العميل</Label>
                  <Input type="email" dir="ltr" placeholder="client@email.com" value={payLinkForm.clientEmail} onChange={e => setPayLinkForm(f => ({ ...f, clientEmail: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">جوال العميل</Label>
                  <Input dir="ltr" placeholder="05xxxxxxxx" value={payLinkForm.clientPhone} onChange={e => setPayLinkForm(f => ({ ...f, clientPhone: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPayLink(false)}>إلغاء</Button>
                <Button disabled={!payLinkForm.amountSAR || !payLinkForm.description || generatePayLink.isPending}
                  onClick={() => generatePayLink.mutate({ ...payLinkForm, amountSAR: parseFloat(payLinkForm.amountSAR), commissionPercent: COMMISSION })} className="gap-2">
                  {generatePayLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  توليد الرابط
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <p className="font-bold text-emerald-400">تم إنشاء الرابط!</p>
                <p className="text-xs text-muted-foreground mt-1">{fmt(generatedLink.amount)} ر.س — مرجع: {generatedLink.ref}</p>
              </div>
              {generatedLink.paymentUrl ? (
                <div>
                  <Label className="text-xs font-semibold mb-1 block">رابط الدفع (Moyasar)</Label>
                  <div className="flex gap-2">
                    <Input dir="ltr" readOnly value={generatedLink.paymentUrl} className="text-[10px] font-mono" />
                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(generatedLink.paymentUrl, "الرابط", toast)}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="outline" onClick={() => window.open(generatedLink.paymentUrl, "_blank")}><ExternalLink className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 rounded-lg p-3 text-xs text-amber-400">
                  أضف Publishable Key في إعدادات Moyasar للحصول على رابط مباشر.
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setGeneratedLink(null); setShowPayLink(false); }}>إغلاق</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════ Stripe Connect Dialog ════ */}
      <Dialog open={showConnect} onOpenChange={setShowConnect}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> ربط Stripe Connect</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">البريد الإلكتروني *</Label>
              <Input type="email" value={connectForm.email} onChange={e => setConnectForm(f => ({ ...f, email: e.target.value }))} placeholder="office@example.com" dir="ltr" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">نسبة عمولة المنصة (%)</Label>
              <Input type="number" min="0" max="50" value={connectForm.commissionPercent} onChange={e => setConnectForm(f => ({ ...f, commissionPercent: e.target.value }))} dir="ltr" />
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">ستُعاد توجيهك إلى Stripe لإكمال بيانات حسابك البنكي (IBAN).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnect(false)}>إلغاء</Button>
            <Button disabled={!connectForm.email || createConnect.isPending}
              onClick={() => createConnect.mutate({ email: connectForm.email, commissionPercent: parseFloat(connectForm.commissionPercent) })} className="gap-2">
              {createConnect.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              ربط الآن <ExternalLink className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
