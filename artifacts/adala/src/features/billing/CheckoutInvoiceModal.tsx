import { useState } from "react";
import {
  Check, CreditCard, Link2, Loader2, Shield, ShieldCheck,
  X, Zap, Calendar, Star, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── Plan visual config (mirror from billing.tsx) ── */
const PLAN_ICONS: Record<string, any> = {
  free: Zap, basic: Star, pro: Star, growth: Star,
  advanced: Shield, enterprise: ShieldCheck, elite: Star,
};
const PLAN_COLORS: Record<string, { color: string; gradient: string; glow: string; badge: string }> = {
  free:       { color: "#64748B", gradient: "from-slate-500/20 to-slate-600/10",  glow: "",                                       badge: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  basic:      { color: "#3B82F6", gradient: "from-blue-500/20 to-blue-600/10",    glow: "shadow-[0_0_60px_rgba(59,130,246,0.12)]", badge: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  pro:        { color: "#2563EB", gradient: "from-primary/20 to-primary/5",       glow: "shadow-[0_0_60px_rgba(37,99,235,0.15)]",  badge: "bg-primary/15 text-primary border-primary/30" },
  growth:     { color: "#8B5CF6", gradient: "from-violet-500/20 to-violet-600/10",glow: "shadow-[0_0_60px_rgba(139,92,246,0.12)]", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  advanced:   { color: "#EC4899", gradient: "from-pink-500/20 to-pink-600/10",    glow: "shadow-[0_0_60px_rgba(236,72,153,0.12)]", badge: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  enterprise: { color: "#10B981", gradient: "from-emerald-500/20 to-emerald-600/10",glow:"shadow-[0_0_60px_rgba(16,185,129,0.12)]",badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  elite:      { color: "#F59E0B", gradient: "from-amber-500/20 to-amber-600/10",  glow: "shadow-[0_0_60px_rgba(245,158,11,0.18)]", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
};

interface Plan {
  id: string; name: string; price: number; monthlyPrice: number; yearlyPrice: number;
  features: string[]; color?: string; popular?: boolean; isFree?: boolean; isContactOnly?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  plan: Plan | null;
  billingPeriod: "monthly" | "annual";
  onBillingPeriodChange: (p: "monthly" | "annual") => void;
  onCheckoutSuccess?: () => void;
}

const VAT_PCT = 0.15; // 15% Saudi VAT

export function CheckoutInvoiceModal({ open, onClose, plan, billingPeriod, onBillingPeriodChange, onCheckoutSuccess }: Props) {
  const { toast } = useToast();
  const [paying,    setPaying]    = useState(false);
  const [copying,   setCopying]   = useState(false);

  if (!open || !plan) return null;

  /* ── Price calculations ── */
  const monthlyBase  = plan.monthlyPrice;
  const annualPer    = plan.yearlyPrice > 0 ? plan.yearlyPrice : Math.round(monthlyBase * 0.8);
  const isAnnual     = billingPeriod === "annual";
  const unitPrice    = isAnnual ? annualPer * 12 : monthlyBase;
  const vat          = parseFloat((unitPrice * VAT_PCT).toFixed(2));
  const total        = parseFloat((unitPrice + vat).toFixed(2));
  const monthlySave  = isAnnual ? monthlyBase * 12 - annualPer * 12 : 0;
  const savePct      = monthlyBase > 0 ? Math.round((1 - annualPer / monthlyBase) * 100) : 0;

  const pc    = PLAN_COLORS[plan!.id] ?? PLAN_COLORS.pro;
  const Icon  = PLAN_ICONS[plan!.id] ?? Star;

  /* ── Handlers ── */
  async function handlePay() {
    setPaying(true);
    try {
      const r = await fetch(`${BASE}/api/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan!.id,
          billingPeriod,
          successUrl: `${window.location.origin}${BASE}/billing?checkout_success=1&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl:  `${window.location.origin}${BASE}/billing?checkout_canceled=1`,
        }),
      });
      const data = await r.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({ title: "خطأ في الدفع", description: data.error ?? data.hint ?? "لم يتم إنشاء رابط الدفع", variant: "destructive" });
        setPaying(false);
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
      setPaying(false);
    }
  }

  async function handleCopyLink() {
    setCopying(true);
    try {
      const r = await fetch(`${BASE}/api/billing/payment-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan!.id }),
      });
      const data = await r.json();
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        toast({ title: "✅ تم نسخ رابط الدفع!", description: "شارك الرابط مع العميل لإتمام الدفع" });
      } else {
        toast({ title: "خطأ", description: data.error ?? "فشل إنشاء رابط الدفع", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>

      <div className={cn(
        "relative w-full max-w-2xl rounded-3xl overflow-hidden border border-border/40",
        pc.glow,
      )} style={{ background: "linear-gradient(135deg,#0F1729 0%,#111827 60%,#0A0F1E 100%)" }}>

        {/* ── Gradient mesh top ── */}
        <div className={cn("absolute inset-x-0 top-0 h-64 bg-gradient-to-b opacity-40 pointer-events-none", pc.gradient)} />

        {/* ── Close ── */}
        <button onClick={onClose}
          className="absolute top-4 left-4 z-10 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all">
          <X className="h-4 w-4" />
        </button>

        {/* ── Header ── */}
        <div className="relative px-8 pt-8 pb-6 border-b border-white/5">
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center border-2 shrink-0",
              pc.badge
            )}>
              <Icon className="h-7 w-7" style={{ color: pc.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-foreground">مراجعة الطلب</h2>
                {plan.popular && (
                  <Badge className="text-[10px] font-bold bg-primary/15 text-primary border-primary/30 border">
                    🔥 الأكثر اختياراً
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm mt-1">
                باقة <span className="font-bold" style={{ color: pc.color }}>{plan.name}</span>
                {" "}— عدالة AI للإدارة القانونية
              </p>
            </div>
          </div>

          {/* Billing toggle */}
          {!plan.isFree && !plan.isContactOnly && (
            <div className="mt-5 inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              {(["monthly", "annual"] as const).map(period => (
                <button key={period}
                  onClick={() => onBillingPeriodChange(period)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
                    billingPeriod === period
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                  {period === "monthly" ? "شهري" : "سنوي"}
                  {period === "annual" && (
                    <span className="mr-1.5 text-[10px] font-bold text-emerald-400">وفّر {savePct}%</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="relative px-8 py-6 grid md:grid-cols-2 gap-6">

          {/* Left: Features */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              ما يشمله الاشتراك
            </p>
            <ul className="space-y-2.5">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: pc.color + "20", color: pc.color }}>
                    <Check className="h-3 w-3" />
                  </div>
                  <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Price breakdown */}
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                تفاصيل الفاتورة
              </p>
              <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                {/* Period */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>دورة الفوترة</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {isAnnual ? "سنوي" : "شهري"}
                  </span>
                </div>
                {/* Plan */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">باقة {plan.name}</span>
                  <span className="text-sm font-semibold">
                    {isAnnual
                      ? `${annualPer.toLocaleString("ar-SA")} × 12 شهر`
                      : `${monthlyBase.toLocaleString("ar-SA")} ر.س / شهر`
                    }
                  </span>
                </div>
                {/* Subtotal */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">المجموع الفرعي</span>
                  <span className="text-sm font-semibold">{unitPrice.toLocaleString("ar-SA")} ر.س</span>
                </div>
                {/* Savings */}
                {isAnnual && monthlySave > 0 && (
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-emerald-500/5">
                    <span className="text-sm text-emerald-400">🎉 التوفير السنوي</span>
                    <span className="text-sm font-bold text-emerald-400">− {monthlySave.toLocaleString("ar-SA")} ر.س</span>
                  </div>
                )}
                {/* VAT */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">ضريبة القيمة المضافة (15%)</span>
                  <span className="text-sm font-semibold">{vat.toLocaleString("ar-SA")} ر.س</span>
                </div>
                {/* Total */}
                <div className="flex items-center justify-between px-4 py-4 bg-white/3">
                  <span className="text-base font-black">الإجمالي</span>
                  <div className="text-left">
                    <span className="text-2xl font-black" style={{ color: pc.color }}>
                      {total.toLocaleString("ar-SA")}
                    </span>
                    <span className="text-sm text-muted-foreground mr-1">ر.س</span>
                    {isAnnual && (
                      <p className="text-[10px] text-muted-foreground">يُفاتَر مرة واحدة سنوياً</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Security badges */}
            <div className="flex flex-wrap gap-2">
              {["SSL آمن", "PCI DSS", "Stripe مشفّر"].map(b => (
                <div key={b} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-muted-foreground">
                  <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                  {b}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer: CTA ── */}
        <div className="relative px-8 pb-8 flex flex-col gap-3">
          <Button
            onClick={handlePay}
            disabled={paying}
            className="w-full h-14 text-lg font-black rounded-2xl gap-3 shadow-lg transition-all hover:scale-[1.01]"
            style={{ background: `linear-gradient(135deg, ${pc.color}, ${pc.color}CC)`, color: "#fff" }}>
            {paying
              ? <><Loader2 className="h-5 w-5 animate-spin" /> جاري التوجيه لصفحة الدفع…</>
              : <><CreditCard className="h-5 w-5" /> إتمام الدفع الآن — {total.toLocaleString("ar-SA")} ر.س</>
            }
          </Button>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2 border-white/10 bg-white/5 hover:bg-white/10"
              onClick={handleCopyLink} disabled={copying}>
              {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              نسخ رابط الدفع
            </Button>
            <Button variant="ghost" className="flex-1 gap-1.5 text-muted-foreground" onClick={onClose}>
              <ChevronLeft className="h-4 w-4" /> العودة
            </Button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-1">
            بالدفع توافق على شروط الخدمة وسياسة الخصوصية · ضمان استرداد 14 يوم
          </p>
        </div>
      </div>
    </div>
  );
}
