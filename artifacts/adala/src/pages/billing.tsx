import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Zap, Shield, Check, Star, Building2,
  Loader2, ExternalLink, AlertCircle, Download, FileText,
  Sparkles, Crown, Rocket, Key, BookOpen, TrendingUp,
  Plus, Copy, Eye, EyeOff, Trash2, ToggleLeft, ToggleRight,
  ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─── Plan visual config ──────────────────────────────── */
const PLAN_ICONS: Record<string, any> = {
  basic: Rocket, professional: Star, enterprise: Crown,
};
const PLAN_COLORS: Record<string, { border: string; badge: string; btn: string; glow: string }> = {
  basic:        { border: "border-blue-500/30",   badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",   btn: "bg-blue-600 hover:bg-blue-700 text-white",   glow: "" },
  professional: { border: "border-[#C9A84C]/50",  badge: "bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30", btn: "bg-[#C9A84C] hover:bg-[#b8943e] text-black", glow: "shadow-[0_0_30px_rgba(201,168,76,0.15)]" },
  enterprise:   { border: "border-purple-500/30", badge: "bg-purple-500/10 text-purple-400 border-purple-500/30", btn: "bg-purple-600 hover:bg-purple-700 text-white", glow: "" },
};

/* ─── Entitlement key labels ──────────────────────────── */
const KEY_LABELS: Record<string, { ar: string; icon: string }> = {
  AI_CALLS:   { ar: "استدعاءات الذكاء الاصطناعي", icon: "🤖" },
  CASES:      { ar: "القضايا",                    icon: "⚖️" },
  CLIENTS:    { ar: "الموكلون",                   icon: "👥" },
  USERS:      { ar: "المستخدمون",                 icon: "🧑‍💼" },
  STORAGE_GB: { ar: "التخزين (GB)",               icon: "💾" },
  DOCUMENTS:  { ar: "المستندات",                  icon: "📄" },
  INVOICES:   { ar: "الفواتير",                   icon: "🧾" },
};

/* ─── Tabs ────────────────────────────────────────────── */
const TABS = [
  { id: "plans",        label: "الباقات والدفع",   icon: CreditCard },
  { id: "entitlements", label: "الاستخدام والحدود", icon: TrendingUp },
  { id: "apikeys",      label: "مفاتيح API",        icon: Key },
  { id: "ledger",       label: "السجل المالي",      icon: BookOpen },
];

export default function Billing() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("plans");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  /* ─── Queries ─────────────────────────────────────── */
  const { data: stripeStatus } = useQuery<any>({
    queryKey: ["stripe-status"],
    queryFn: () => fetch(`${BASE}/api/billing/stripe-status`).then(r => r.json()),
  });
  const { data: plans = [], isLoading: plansLoading } = useQuery<any[]>({
    queryKey: ["billing-plans"],
    queryFn: () => fetch(`${BASE}/api/billing/plans`).then(r => r.json()),
  });
  const { data: entitlements = [], isLoading: entLoading } = useQuery<any[]>({
    queryKey: ["entitlements"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/entitlements`);
      const d = await r.json();
      return d.entitlements ?? [];
    },
    enabled: tab === "entitlements",
  });
  const { data: apiKeys = [], isLoading: keysLoading, refetch: refetchKeys } = useQuery<any[]>({
    queryKey: ["office-api-keys"],
    queryFn: () => fetch(`${BASE}/api/office/api-keys`).then(r => r.json()),
    enabled: tab === "apikeys",
  });
  const { data: ledger = [], isLoading: ledgerLoading } = useQuery<any[]>({
    queryKey: ["billing-ledger"],
    queryFn: () => fetch(`${BASE}/api/billing/ledger`).then(r => r.json()),
    enabled: tab === "ledger",
  });

  /* ─── Checkout mutation ───────────────────────────── */
  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const r = await fetch(`${BASE}/api/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
      else toast({ title: "خطأ", description: data.error ?? data.hint ?? "فشل إنشاء جلسة الدفع", variant: "destructive" });
      setLoadingPlan(null);
    },
    onError: () => { setLoadingPlan(null); toast({ title: "خطأ في الاتصال", variant: "destructive" }); },
  });

  const handleSubscribe = (planId: string) => {
    setLoadingPlan(planId);
    checkoutMutation.mutate(planId);
  };

  /* ─── Activate plan (test/admin) ──────────────────── */
  const activateMutation = useMutation({
    mutationFn: async (plan: string) => {
      const r = await fetch(`${BASE}/api/billing/activate-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      return r.json();
    },
    onSuccess: (data, plan) => {
      if (data.ok) {
        toast({ title: "✅ تم تفعيل الباقة!", description: `تم تفعيل باقة ${plan} وإنشاء الصلاحيات` });
        qc.invalidateQueries({ queryKey: ["entitlements"] });
        qc.invalidateQueries({ queryKey: ["billing-ledger"] });
        setTab("entitlements");
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" });
      }
    },
  });

  /* ─── API Key mutations ───────────────────────────── */
  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch(`${BASE}/api/office/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions: ["read", "write"] }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      if (data.rawKey) {
        setRevealedKey(data.rawKey);
        toast({ title: "✅ تم إنشاء المفتاح!", description: "احتفظ بالمفتاح الآن — لن يظهر مرة أخرى" });
        refetchKeys();
        setNewKeyName("");
        setShowNewKey(false);
      } else {
        toast({ title: "خطأ", description: data.error, variant: "destructive" });
      }
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const r = await fetch(`${BASE}/api/office/api-keys/${id}/${active ? "revoke" : "activate"}`, {
        method: "PATCH",
      });
      return r.json();
    },
    onSuccess: () => refetchKeys(),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/office/api-keys/${id}`, { method: "DELETE" });
      return r.json();
    },
    onSuccess: () => { toast({ title: "تم حذف المفتاح" }); refetchKeys(); },
  });

  /* ─── Render ──────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-[#C9A84C]" />
            الاشتراك والفوترة
          </h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة الباقة والمدفوعات وصلاحيات الاستخدام</p>
        </div>
        {stripeStatus && (
          <Badge className={cn("text-xs border gap-1.5", stripeStatus.configured
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", stripeStatus.configured ? "bg-emerald-400" : "bg-yellow-400")} />
            {stripeStatus.configured ? `Stripe — ${stripeStatus.mode === "test" ? "تجريبي" : "إنتاج"}` : "Stripe — يحتاج إعداد"}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/40 w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-background text-foreground shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════
          TAB: PLANS
      ══════════════════════════════════════════════ */}
      {tab === "plans" && (
        <div className="space-y-6">
          {/* Stripe warning */}
          {stripeStatus && !stripeStatus.configured && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
              <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-400">Stripe يحتاج المفتاح السري</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  أضف <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> في Replit Secrets لتفعيل الدفع.
                </p>
              </div>
            </div>
          )}

          {/* Commission notice */}
          <div className="flex items-start gap-3 p-4 rounded-xl border" style={{ background: "rgba(201,168,76,0.06)", borderColor: "rgba(201,168,76,0.25)" }}>
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-[#C9A84C]" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">رسوم معالجة المدفوعات: </span>
              عمولة تشغيل قدرها{" "}
              <span className="font-bold text-[#C9A84C]">10%</span>{" "}
              من قيمة المدفوعات المحصلة عبر المنصة، بالإضافة إلى رسوم بوابات الدفع.
            </p>
          </div>

          {/* Plans grid */}
          {plansLoading ? (
            <div className="grid md:grid-cols-3 gap-4">
              {[1,2,3].map(i => <Skeleton key={i} className="h-80" />)}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {plans.map((plan: any) => {
                const Icon = PLAN_ICONS[plan.id] ?? Star;
                const colors = PLAN_COLORS[plan.id] ?? PLAN_COLORS.basic;
                const isPro = plan.id === "professional";
                const isLoadingThis = loadingPlan === plan.id;

                return (
                  <Card key={plan.id} className={cn(
                    "relative border-2 transition-all duration-200",
                    colors.border, colors.glow,
                    isPro && "scale-[1.02]"
                  )}>
                    {isPro && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-[#C9A84C] text-black text-[10px] font-black px-3">الأكثر شيوعاً ⭐</Badge>
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", colors.badge)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <Badge className={cn("text-[10px] border", colors.badge)}>{plan.name}</Badge>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black">{plan.price.toLocaleString("ar-SA")}</span>
                        <span className="text-sm text-muted-foreground">ر.س / شهر</span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ul className="space-y-2">
                        {plan.features.map((f: string) => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <Check className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{f}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="space-y-2 pt-2">
                        <Button
                          className={cn("w-full gap-2 font-bold", colors.btn)}
                          disabled={isLoadingThis}
                          onClick={() => handleSubscribe(plan.id)}
                        >
                          {isLoadingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          اشترك الآن
                        </Button>
                        {/* Dev-mode: activate without payment */}
                        {stripeStatus?.mode === "test" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-xs text-muted-foreground"
                            onClick={() => activateMutation.mutate(plan.id)}
                            disabled={activateMutation.isPending}
                          >
                            {activateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                            تفعيل تجريبي (بدون دفع)
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: ENTITLEMENTS
      ══════════════════════════════════════════════ */}
      {tab === "entitlements" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">الاستخدام والحدود</h2>
              <p className="text-xs text-muted-foreground mt-0.5">حدود باقتك الحالية وما تم استخدامه</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2 text-xs"
              onClick={() => qc.invalidateQueries({ queryKey: ["entitlements"] })}>
              <RefreshCw className="h-3.5 w-3.5" /> تحديث
            </Button>
          </div>

          {entLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : entitlements.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center text-2xl">📊</div>
                <p className="font-semibold text-center">لا توجد صلاحيات مفعّلة بعد</p>
                <p className="text-sm text-muted-foreground text-center">اشترك في إحدى الباقات لتفعيل حدود الاستخدام</p>
                <Button size="sm" onClick={() => setTab("plans")} className="gap-2">
                  <CreditCard className="h-3.5 w-3.5" /> اختر باقة
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {entitlements.map((ent: any) => {
                const meta = KEY_LABELS[ent.key] ?? { ar: ent.key, icon: "📦" };
                const pct = ent.percent ?? 0;
                const isOver = pct >= 90;
                const isWarning = pct >= 70 && pct < 90;

                return (
                  <Card key={ent.key} className={cn(
                    "border transition-all",
                    isOver ? "border-red-500/30 bg-red-500/5" : isWarning ? "border-yellow-500/30" : "border-border/50"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{meta.icon}</span>
                          <div>
                            <p className="font-semibold text-sm">{meta.ar}</p>
                            <p className="text-[10px] text-muted-foreground">{ent.key}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <span className={cn("text-lg font-black", isOver ? "text-red-400" : isWarning ? "text-yellow-400" : "text-foreground")}>
                            {ent.used.toLocaleString("ar-SA")}
                          </span>
                          <span className="text-xs text-muted-foreground"> / {ent.limit.toLocaleString("ar-SA")}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isOver ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-muted-foreground">{pct}% مستخدم</span>
                        <span className="text-[10px] text-muted-foreground">
                          {ent.remaining.toLocaleString("ar-SA")} متبقٍ
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: API KEYS
      ══════════════════════════════════════════════ */}
      {tab === "apikeys" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">مفاتيح API</h2>
              <p className="text-xs text-muted-foreground mt-0.5">مفاتيح الوصول للتكامل مع أنظمة خارجية</p>
            </div>
            <Button size="sm" className="gap-2 bg-[#C9A84C] hover:bg-[#b8943e] text-black font-bold"
              onClick={() => setShowNewKey(v => !v)}>
              <Plus className="h-3.5 w-3.5" /> مفتاح جديد
            </Button>
          </div>

          {/* Revealed raw key banner */}
          {revealedKey && (
            <div className="p-4 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" /> احتفظ بهذا المفتاح — لن يظهر مرة أخرى!
              </div>
              <div className="flex items-center gap-2 font-mono text-xs bg-background/60 rounded-lg p-3 border border-border/40">
                <span className="flex-1 break-all">{revealedKey}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                  onClick={() => { navigator.clipboard.writeText(revealedKey); toast({ title: "تم النسخ ✅" }); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
                onClick={() => setRevealedKey(null)}>
                إخفاء
              </Button>
            </div>
          )}

          {/* New key form */}
          {showNewKey && (
            <Card className="border-[#C9A84C]/30 bg-[#C9A84C]/5">
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3">إنشاء مفتاح جديد</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="اسم المفتاح (مثال: نظام CRM)"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/40"
                  />
                  <Button
                    className="bg-[#C9A84C] hover:bg-[#b8943e] text-black font-bold"
                    disabled={!newKeyName.trim() || createKeyMutation.isPending}
                    onClick={() => createKeyMutation.mutate(newKeyName.trim())}
                  >
                    {createKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء"}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowNewKey(false)}>إلغاء</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Keys table */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">المفتاح</TableHead>
                    <TableHead className="text-right">الصلاحيات</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keysLoading ? (
                    <TableRow><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ) : apiKeys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                        لا توجد مفاتيح بعد — أنشئ مفتاحك الأول
                      </TableCell>
                    </TableRow>
                  ) : apiKeys.map((k: any) => (
                    <TableRow key={k.id} className={!k.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{k.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{k.key_preview}</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(k.permissions ?? []).map((p: string) => (
                            <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px] border", k.is_active
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/10 text-red-400 border-red-500/30"
                        )}>
                          {k.is_active ? "نشط" : "معطّل"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(k.created_at).toLocaleDateString("ar-SA")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            title={k.is_active ? "تعطيل" : "تفعيل"}
                            onClick={() => revokeKeyMutation.mutate({ id: k.id, active: k.is_active })}>
                            {k.is_active ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300"
                            onClick={() => deleteKeyMutation.mutate(k.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* API usage info */}
          <div className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2"><Key className="h-4 w-4 text-[#C9A84C]" /> كيف تستخدم المفاتيح؟</p>
            <code className="block text-xs bg-background/80 rounded-lg p-3 border border-border/40 font-mono text-muted-foreground">
              {"curl -H \"Authorization: Bearer sk_adala_...\" \\\n     https://api.adala.ai/v1/cases"}
            </code>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          TAB: LEDGER
      ══════════════════════════════════════════════ */}
      {tab === "ledger" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">السجل المالي</h2>
              <p className="text-xs text-muted-foreground mt-0.5">سجل كامل بجميع الحركات المالية للمكتب</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2 text-xs"
              onClick={() => qc.invalidateQueries({ queryKey: ["billing-ledger"] })}>
              <RefreshCw className="h-3.5 w-3.5" /> تحديث
            </Button>
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الوصف</TableHead>
                    <TableHead className="text-right">المرجع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerLoading ? (
                    <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  ) : ledger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                        لا توجد حركات مالية بعد
                      </TableCell>
                    </TableRow>
                  ) : ledger.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {entry.type === "credit"
                            ? <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                            : entry.type === "refund"
                            ? <ArrowDownRight className="h-4 w-4 text-blue-400" />
                            : <ArrowDownRight className="h-4 w-4 text-red-400" />}
                          <Badge variant="outline" className={cn("text-[10px] border", entry.type === "credit"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : entry.type === "refund"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                            : "bg-red-500/10 text-red-400 border-red-500/30"
                          )}>
                            {entry.type === "credit" ? "دائن" : entry.type === "refund" ? "استرداد" : "مدين"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-48 truncate">{entry.description ?? "—"}</TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{entry.ref ?? "—"}</code>
                      </TableCell>
                      <TableCell className={cn("font-bold", entry.type === "credit" ? "text-emerald-400" : "text-red-400")}>
                        {entry.type === "credit" ? "+" : "-"}{Number(entry.amount).toLocaleString("ar-SA")} {entry.currency}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(entry.created_at).toLocaleDateString("ar-SA")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
