import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard, Zap, Shield, Check, Star, Building2,
  Loader2, ExternalLink, AlertCircle, Download, FileText,
  Sparkles, Crown, Rocket, Key, BookOpen, TrendingUp,
  Plus, Copy, Eye, EyeOff, Trash2, ToggleLeft, ToggleRight,
  ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2, XCircle,
  ArrowUp, ArrowDown, X, Phone, Minus, ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useOfficePlan } from "@/hooks/use-office-plan";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─── Plan visual config ──────────────────────────────── */
const PLAN_ICONS: Record<string, any> = {
  advisor:    BookOpen,
  solo:       Star,
  office:     Building2,
  advanced:   Rocket,
  corporate:  TrendingUp,
  enterprise: Crown,
};
const PLAN_COLORS: Record<string, { border: string; badge: string; btn: string; glow: string }> = {
  advisor:    { border: "border-sky-500/30",      badge: "bg-sky-500/10 text-sky-400 border-sky-500/30",           btn: "bg-sky-600 hover:bg-sky-700 text-white",          glow: "" },
  solo:       { border: "border-[#C9A84C]/50",    badge: "bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30",     btn: "bg-[#C9A84C] hover:bg-[#b8943e] text-black",     glow: "shadow-[0_0_30px_rgba(201,168,76,0.15)]" },
  office:     { border: "border-emerald-500/30",  badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", btn: "bg-emerald-600 hover:bg-emerald-700 text-white",  glow: "" },
  advanced:   { border: "border-violet-500/30",   badge: "bg-violet-500/10 text-violet-400 border-violet-500/30",   btn: "bg-violet-600 hover:bg-violet-700 text-white",    glow: "" },
  corporate:  { border: "border-orange-500/30",   badge: "bg-orange-500/10 text-orange-400 border-orange-500/30",   btn: "bg-orange-600 hover:bg-orange-700 text-white",    glow: "" },
  enterprise: { border: "border-slate-500/30",    badge: "bg-slate-500/10 text-slate-300 border-slate-500/30",      btn: "bg-slate-700 hover:bg-slate-600 text-white",      glow: "" },
};

/* ─── Plan ordering & comparison data ────────────────── */
const PLAN_ORDER = ["advisor","solo","office","advanced","corporate","enterprise"];

interface PlanMeta {
  aiOps: string; cases: string; users: string; storage: string;
  portal: boolean; ai: boolean; reports: boolean; support: string;
}
const PLAN_COMPARE: Record<string, PlanMeta> = {
  advisor:    { aiOps: "50",          cases: "محدودة",       users: "2",        storage: "5 GB",   portal: false, ai: false, reports: false, support: "بريد إلكتروني" },
  solo:       { aiOps: "200",         cases: "100",          users: "5",        storage: "20 GB",  portal: false, ai: true,  reports: true,  support: "أولوية" },
  office:     { aiOps: "1,000",       cases: "غير محدودة",   users: "15",       storage: "50 GB",  portal: true,  ai: true,  reports: true,  support: "أولوية" },
  advanced:   { aiOps: "5,000",       cases: "غير محدودة",   users: "30",       storage: "100 GB", portal: true,  ai: true,  reports: true,  support: "مخصص" },
  corporate:  { aiOps: "غير محدودة", cases: "غير محدودة",   users: "غير محدود", storage: "500 GB", portal: true,  ai: true,  reports: true,  support: "SLA مضمون" },
  enterprise: { aiOps: "غير محدودة", cases: "غير محدودة",   users: "غير محدود", storage: "غير محدودة", portal: true, ai: true, reports: true, support: "24/7 مخصص" },
};

const COMPARE_ROWS: { key: keyof PlanMeta; label: string; icon: string; isBool?: boolean }[] = [
  { key: "aiOps",    label: "عمليات الذكاء الاصطناعي", icon: "🤖" },
  { key: "cases",    label: "القضايا",                  icon: "⚖️" },
  { key: "users",    label: "المستخدمون",               icon: "👥" },
  { key: "storage",  label: "التخزين",                  icon: "💾" },
  { key: "portal",   label: "بوابة الموكل",             icon: "🌐", isBool: true },
  { key: "ai",       label: "أدوات الذكاء الاصطناعي",  icon: "✨", isBool: true },
  { key: "reports",  label: "تقارير متقدمة",            icon: "📊", isBool: true },
  { key: "support",  label: "مستوى الدعم",              icon: "🎧" },
];

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
  { id: "plans",            label: "الباقات والدفع",    icon: CreditCard },
  { id: "entitlements",     label: "الاستخدام والحدود", icon: TrendingUp },
  { id: "apikeys",          label: "مفاتيح API",        icon: Key },
  { id: "ledger",           label: "السجل المالي",      icon: BookOpen },
  { id: "platform_invoices", label: "فواتير الاشتراك",  icon: FileText },
];

/* ─── Upgrade / Downgrade Modal ───────────────────────── */
function UpgradeModal({
  open, onClose, currentPlanId, targetPlan, plans, onConfirmStripe, onConfirmDirect,
  isLoading, stripeConfigured,
}: {
  open: boolean; onClose: () => void; currentPlanId: string;
  targetPlan: any | null; plans: any[];
  onConfirmStripe: (id: string) => void; onConfirmDirect: (id: string) => void;
  isLoading: boolean; stripeConfigured: boolean;
}) {
  if (!targetPlan) return null;

  const currentPlan = plans.find((p: any) => p.id === currentPlanId);
  const curMeta  = PLAN_COMPARE[currentPlanId]  ?? PLAN_COMPARE.advisor;
  const tgtMeta  = PLAN_COMPARE[targetPlan.id]  ?? PLAN_COMPARE.advisor;
  const curOrder = PLAN_ORDER.indexOf(currentPlanId);
  const tgtOrder = PLAN_ORDER.indexOf(targetPlan.id);
  const isUpgrade   = tgtOrder > curOrder;
  const isDowngrade = tgtOrder < curOrder;
  const priceDiff = targetPlan.contactOnly
    ? null
    : (targetPlan.price ?? 0) - (currentPlan?.price ?? 0);

  const Icon = PLAN_ICONS[targetPlan.id] ?? Star;
  const colors = PLAN_COLORS[targetPlan.id] ?? PLAN_COLORS.advisor;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-border/60"
        style={{ background: "linear-gradient(180deg,#1A2744 0%,#141E38 100%)" }}>

        {/* ── Header ── */}
        <div className="px-6 pt-6 pb-4 border-b border-border/30"
          style={{ background: isUpgrade ? "rgba(201,168,76,0.06)" : "rgba(239,68,68,0.05)" }}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("w-10 h-10 rounded-xl border-2 flex items-center justify-center", colors.badge)}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black">
                  {isUpgrade ? "ترقية إلى" : isDowngrade ? "التخفيض إلى" : "التبديل إلى"}{" "}
                  <span style={{ color: isUpgrade ? "#C9A84C" : isDowngrade ? "#EF4444" : "#94A3B8" }}>
                    {targetPlan.name}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {isUpgrade
                    ? "ستحصل على المزايا الإضافية التالية فور التأكيد"
                    : isDowngrade
                    ? "ستفقد بعض المزايا عند التخفيض"
                    : "مراجعة تفاصيل الباقة المحددة"}
                </DialogDescription>
              </div>
            </div>

            {/* Price badge */}
            {priceDiff !== null && priceDiff !== 0 && (
              <div className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border",
                priceDiff > 0
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/10 text-red-400 border-red-500/30"
              )}>
                {priceDiff > 0 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                {priceDiff > 0 ? "+" : ""}{priceDiff.toLocaleString("ar-SA")} ر.س/شهر
              </div>
            )}
          </DialogHeader>
        </div>

        {/* ── Comparison table ── */}
        <div className="px-6 py-4 max-h-72 overflow-y-auto">
          <div className="space-y-2">
            {COMPARE_ROWS.map(row => {
              const curVal = curMeta[row.key];
              const tgtVal = tgtMeta[row.key];
              const changed = curVal !== tgtVal;
              const isBetter = row.isBool
                ? tgtVal === true && curVal === false
                : typeof tgtVal === "string" && typeof curVal === "string" && tgtVal !== curVal && isUpgrade;
              const isWorse = row.isBool
                ? tgtVal === false && curVal === true
                : typeof tgtVal === "string" && typeof curVal === "string" && tgtVal !== curVal && isDowngrade;

              return (
                <div key={row.key}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                    changed
                      ? isBetter ? "bg-emerald-500/8 border border-emerald-500/20"
                        : isWorse ? "bg-red-500/8 border border-red-500/20"
                        : "bg-muted/30"
                      : "bg-muted/20"
                  )}>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{row.icon}</span>
                    <span>{row.label}</span>
                  </div>
                  <div className="flex items-center gap-3 font-medium">
                    {/* Current */}
                    <span className="text-muted-foreground text-xs line-through opacity-60">
                      {row.isBool ? (curVal ? "✓" : "✗") : String(curVal)}
                    </span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    {/* Target */}
                    <span className={cn(
                      "font-bold",
                      isBetter ? "text-emerald-400" : isWorse ? "text-red-400" : "text-foreground"
                    )}>
                      {row.isBool ? (tgtVal ? "✓" : "✗") : String(tgtVal)}
                      {isBetter && <ArrowUp className="h-3 w-3 inline mr-1" />}
                      {isWorse  && <ArrowDown className="h-3 w-3 inline mr-1" />}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {isDowngrade && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-orange-500/8 border border-orange-500/20">
              <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-300">
                سيتم تخفيض حدود الاستخدام فوراً. البيانات المخزنة لن تُحذف، لكن قد تصبح بعض الميزات غير متاحة.
              </p>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>
            إلغاء
          </Button>
          {stripeConfigured && !isLoading ? (
            <Button
              className={cn("flex-1 font-bold gap-2", colors.btn)}
              onClick={() => onConfirmStripe(targetPlan.id)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {isUpgrade ? "ترقية عبر Stripe" : "تأكيد التخفيض"}
            </Button>
          ) : (
            <Button
              className={cn("flex-1 font-bold gap-2", colors.btn)}
              onClick={() => onConfirmDirect(targetPlan.id)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              تأكيد التغيير
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Billing() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("plans");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [changingPlan, setChangingPlan] = useState(false);

  /* ─── Current plan from office subscription ───────── */
  const { planSlug: currentPlanSlug } = useOfficePlan();

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
  });
  const { data: platInvoices = [], isLoading: platInvLoading, refetch: refetchPlatInv } = useQuery<any[]>({
    queryKey: ["platform-invoices"],
    queryFn: () => fetch(`${BASE}/api/billing/platform-invoices`).then(r => r.json()),
    enabled: tab === "platform_invoices",
  });
  const { data: platStats } = useQuery<any>({
    queryKey: ["platform-invoice-stats"],
    queryFn: () => fetch(`${BASE}/api/billing/platform-invoices/stats`).then(r => r.json()),
    enabled: tab === "platform_invoices",
  });
  const payInvoiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/billing/pay/${id}`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم تسجيل الدفع!", description: "تم تحديث حالة الفاتورة إلى مدفوعة" });
      qc.invalidateQueries({ queryKey: ["platform-invoices"] });
      qc.invalidateQueries({ queryKey: ["platform-invoice-stats"] });
    },
    onError: () => toast({ title: "خطأ", variant: "destructive" }),
  });
  const genInvoiceMutation = useMutation({
    mutationFn: async (planId: string) => {
      const r = await fetch(`${BASE}/api/billing/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم إنشاء فاتورة الاشتراك!" });
      refetchPlatInv();
      qc.invalidateQueries({ queryKey: ["platform-invoice-stats"] });
    },
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

  /* ─── Change plan (direct — no Stripe) ────────────── */
  const changePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      const r = await fetch(`${BASE}/api/billing/change-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      setChangingPlan(false);
      setSelectedPlan(null);
      if (data.ok) {
        const emoji = data.direction === "upgrade" ? "🎉" : data.direction === "downgrade" ? "⚠️" : "✅";
        toast({ title: `${emoji} تم تغيير الباقة!`, description: `الانتقال إلى: ${data.planName}` });
        qc.invalidateQueries({ queryKey: ["office-subscription"] });
        qc.invalidateQueries({ queryKey: ["entitlements"] });
        qc.invalidateQueries({ queryKey: ["plan-notifications"] });
      } else {
        toast({ title: "خطأ", description: data.error ?? "فشل تغيير الباقة", variant: "destructive" });
      }
    },
    onError: () => {
      setChangingPlan(false);
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    },
  });

  const handleConfirmDirect = (planId: string) => {
    setChangingPlan(true);
    changePlanMutation.mutate(planId);
  };

  const handleConfirmStripe = (planId: string) => {
    setSelectedPlan(null);
    setLoadingPlan(planId);
    checkoutMutation.mutate(planId);
  };

  /* ─── Plan button logic ────────────────────────────── */
  const getPlanAction = (plan: any): "current" | "upgrade" | "downgrade" | "contact" => {
    if (plan.contactOnly) return "contact";
    if (plan.id === currentPlanSlug) return "current";
    const cur = PLAN_ORDER.indexOf(currentPlanSlug);
    const tgt = PLAN_ORDER.indexOf(plan.id);
    return tgt > cur ? "upgrade" : "downgrade";
  };

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

          {/* Current plan banner */}
          {currentPlanSlug && currentPlanSlug !== "starter" && (() => {
            const cur = plans.find((p: any) => p.id === currentPlanSlug);
            const Icon = cur ? (PLAN_ICONS[cur.id] ?? Star) : Star;
            const colors = cur ? (PLAN_COLORS[cur.id] ?? PLAN_COLORS.advisor) : PLAN_COLORS.advisor;
            return cur ? (
              <div className="flex items-center gap-3 p-4 rounded-xl border"
                style={{ background: "rgba(201,168,76,0.06)", borderColor: "rgba(201,168,76,0.3)" }}>
                <div className={cn("w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0", colors.badge)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#C9A84C]">باقتك الحالية: {cur.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cur.contactOnly ? "تواصل معنا" : `${cur.price.toLocaleString("ar-SA")} ر.س / شهر`}
                    {" — "}اختر باقة أخرى للترقية أو التخفيض
                  </p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] border">
                  نشطة ✓
                </Badge>
              </div>
            ) : null;
          })()}

          {/* Plans grid */}
          {plansLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-80" />)}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
              {plans.map((plan: any) => {
                const Icon = PLAN_ICONS[plan.id] ?? Star;
                const colors = PLAN_COLORS[plan.id] ?? PLAN_COLORS.advisor;
                const isPopular = plan.popular === true;
                const isEnterprise = plan.contactOnly === true;
                const isLoadingThis = loadingPlan === plan.id;
                const action = getPlanAction(plan);
                const isCurrent = action === "current";

                return (
                  <Card key={plan.id} className={cn(
                    "relative border-2 transition-all duration-200 flex flex-col",
                    isCurrent
                      ? "border-[#C9A84C]/60 ring-2 ring-[#C9A84C]/20"
                      : colors.border,
                    !isCurrent && colors.glow,
                    isPopular && !isCurrent && "scale-[1.02] z-10"
                  )}>
                    {/* Badges row */}
                    <div className="absolute -top-3 right-1/2 translate-x-1/2 flex gap-1.5">
                      {isCurrent && (
                        <Badge className="bg-[#C9A84C] text-black text-[10px] font-black px-3 py-1">
                          ✓ باقتك الحالية
                        </Badge>
                      )}
                      {isPopular && !isCurrent && (
                        <Badge className="bg-[#C9A84C] text-black text-[10px] font-black px-3 py-1">
                          ⭐ الأكثر طلباً
                        </Badge>
                      )}
                    </div>

                    <CardHeader className="pb-3 pt-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border-2", colors.badge)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {plan.trialMonth && !isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              الشهر الأول مجاناً 🎁
                            </span>
                          )}
                          {/* Direction badge */}
                          {!isCurrent && action === "upgrade" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                              <ArrowUp className="h-2.5 w-2.5" /> ترقية
                            </span>
                          )}
                          {!isCurrent && action === "downgrade" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-0.5">
                              <ArrowDown className="h-2.5 w-2.5" /> تخفيض
                            </span>
                          )}
                        </div>
                      </div>

                      <CardTitle className="text-base font-bold">{plan.name}</CardTitle>

                      <div className="flex items-baseline gap-1 mt-1">
                        {isEnterprise ? (
                          <span className="text-lg font-bold text-muted-foreground">تواصل معنا</span>
                        ) : (
                          <>
                            <span className="text-3xl font-black">{plan.price.toLocaleString("ar-SA")}</span>
                            <span className="text-sm text-muted-foreground">ر.س / شهر</span>
                          </>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 flex-1 flex flex-col">
                      <ul className="space-y-2 flex-1">
                        {plan.features.map((f: string) => (
                          <li key={f} className="flex items-start gap-2 text-sm">
                            <Check className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{f}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="space-y-2 pt-2">
                        {/* ── Action button ── */}
                        {isCurrent ? (
                          <Button
                            className="w-full gap-2 font-bold bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/15"
                            disabled
                          >
                            <Check className="h-4 w-4" />
                            باقتك الحالية
                          </Button>
                        ) : isEnterprise ? (
                          <Button
                            className={cn("w-full gap-2 font-bold", colors.btn)}
                            onClick={() => window.open("mailto:sales@adalaai.com?subject=طلب عرض سعر - باقة المؤسسات", "_blank")}
                          >
                            <Phone className="h-4 w-4" />
                            تواصل معنا
                          </Button>
                        ) : action === "upgrade" ? (
                          <Button
                            className={cn("w-full gap-2 font-bold", colors.btn)}
                            disabled={isLoadingThis}
                            onClick={() => setSelectedPlan(plan)}
                          >
                            {isLoadingThis
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <ArrowUp className="h-4 w-4" />}
                            ترقية إلى هذه الباقة
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-full gap-2 font-bold border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                            disabled={isLoadingThis}
                            onClick={() => setSelectedPlan(plan)}
                          >
                            {isLoadingThis
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <ArrowDown className="h-4 w-4" />}
                            التخفيض إلى هذه الباقة
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ── Upgrade Modal ── */}
          <UpgradeModal
            open={!!selectedPlan}
            onClose={() => setSelectedPlan(null)}
            currentPlanId={currentPlanSlug}
            targetPlan={selectedPlan}
            plans={plans}
            onConfirmStripe={handleConfirmStripe}
            onConfirmDirect={handleConfirmDirect}
            isLoading={changingPlan || changePlanMutation.isPending}
            stripeConfigured={!!stripeStatus?.configured}
          />
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

      {/* ══════════════════════════════════════════════
          TAB: PLATFORM INVOICES (فواتير الاشتراك)
      ══════════════════════════════════════════════ */}
      {tab === "platform_invoices" && (
        <div className="space-y-5" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold">فواتير اشتراك المنصة</h2>
              <p className="text-xs text-muted-foreground mt-0.5">سجل كامل بفواتير الاشتراك السنوية والشهرية لعدالة AI</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2 text-xs"
                onClick={() => { qc.invalidateQueries({ queryKey: ["platform-invoices"] }); qc.invalidateQueries({ queryKey: ["platform-invoice-stats"] }); }}>
                <RefreshCw className="h-3.5 w-3.5" /> تحديث
              </Button>
              <Button size="sm" className="gap-2 text-xs bg-[#C9A84C] hover:bg-[#b8943e] text-black font-bold"
                onClick={() => genInvoiceMutation.mutate(currentPlanSlug || "advisor")}
                disabled={genInvoiceMutation.isPending}>
                {genInvoiceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                إنشاء فاتورة اشتراك
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "إجمالي الفواتير",  value: platStats?.total ?? 0,   color: "text-blue-400 bg-blue-500/15", suffix: "" },
              { label: "مدفوعة",           value: platStats?.paid ?? 0,    color: "text-emerald-400 bg-emerald-500/15", suffix: "" },
              { label: "قيد الانتظار",     value: platStats?.unpaid ?? 0,  color: "text-amber-400 bg-amber-500/15", suffix: "" },
              { label: "متأخرة",           value: platStats?.overdue ?? 0, color: "text-red-400 bg-red-500/15", suffix: "" },
              { label: "الإيرادات المحصّلة", value: Number(platStats?.total_paid ?? 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 }), color: "text-[#C9A84C] bg-[#C9A84C]/15", suffix: " ر.س" },
            ].map(({ label, value, color, suffix }) => (
              <Card key={label} className="border-border/50 bg-sidebar">
                <CardContent className="p-4 text-center">
                  <div className={cn("text-2xl font-black mb-1", color.split(" ")[0])}>
                    {value}{suffix}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Invoices Table */}
          <Card className="border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الباقة</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الإصدار</TableHead>
                    <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                    <TableHead className="text-right">تاريخ الدفع</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platInvLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                    ))
                  ) : platInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12 text-sm">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        لا توجد فواتير اشتراك بعد — اضغط "إنشاء فاتورة اشتراك" لإضافة الأولى
                      </TableCell>
                    </TableRow>
                  ) : platInvoices.map((inv: any) => {
                    const statusMap: Record<string, { label: string; cls: string }> = {
                      paid:    { label: "مدفوعة",       cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
                      unpaid:  { label: "قيد الانتظار", cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
                      overdue: { label: "متأخرة",       cls: "bg-red-500/10 text-red-400 border-red-500/30" },
                    };
                    const st = statusMap[inv.status] ?? statusMap.unpaid;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium text-sm">{inv.plan_name}</TableCell>
                        <TableCell className="font-bold text-[#C9A84C]">
                          {Number(inv.amount).toLocaleString("ar-SA")} {inv.currency}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] border", st.cls)}>{st.label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("ar-SA") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.due_date ? new Date(inv.due_date).toLocaleDateString("ar-SA") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString("ar-SA") : "—"}
                        </TableCell>
                        <TableCell>
                          {inv.status !== "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              onClick={() => payInvoiceMutation.mutate(inv.id)}
                              disabled={payInvoiceMutation.isPending}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> تسديد
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Info box */}
          <div className="p-4 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 space-y-1">
            <p className="text-sm font-semibold text-[#C9A84C] flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> معلومات الفوترة
            </p>
            <p className="text-xs text-muted-foreground">
              الفواتير تُصدر تلقائياً في بداية كل دورة اشتراك. الدفع يُفعّل جميع ميزات الباقة خلال لحظات.
              للدفع بواسطة Stripe أو Apple Pay اضغط زر "الترقية" في تبويب الباقات.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
