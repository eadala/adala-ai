import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CreditCard, Zap, Shield, Check, Star, Building2,
  Loader2, ExternalLink, AlertCircle, Download, FileText,
  Sparkles, Crown, Rocket
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PLAN_ICONS: Record<string, any> = {
  basic:        Rocket,
  professional: Star,
  enterprise:   Crown,
};

const PLAN_COLORS: Record<string, { border: string; badge: string; btn: string; glow: string }> = {
  basic:        { border: "border-blue-500/30",   badge: "bg-blue-500/10 text-blue-400 border-blue-500/30",   btn: "bg-blue-600 hover:bg-blue-700",   glow: "" },
  professional: { border: "border-[#C9A84C]/50",  badge: "bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30", btn: "bg-[#C9A84C] hover:bg-[#b8943e] text-black", glow: "shadow-[0_0_30px_rgba(201,168,76,0.15)]" },
  enterprise:   { border: "border-purple-500/30", badge: "bg-purple-500/10 text-purple-400 border-purple-500/30", btn: "bg-purple-600 hover:bg-purple-700", glow: "" },
};

export default function Billing() {
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const { data: stripeStatus } = useQuery<any>({
    queryKey: ["stripe-status"],
    queryFn: () => fetch("/api/billing/stripe-status").then(r => r.json()),
  });

  const { data: plans = [], isLoading: plansLoading } = useQuery<any[]>({
    queryKey: ["billing-plans"],
    queryFn: () => fetch("/api/billing/plans").then(r => r.json()),
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<any[]>({
    queryKey: ["billing-invoices"],
    queryFn: () => fetch("/api/billing/invoices").then(r => r.json()),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        toast({ title: "خطأ", description: data.error ?? "فشل إنشاء جلسة الدفع", variant: "destructive" });
      }
      setLoadingPlan(null);
    },
    onError: () => { setLoadingPlan(null); toast({ title: "خطأ في الاتصال", variant: "destructive" }); },
  });

  const paymentLinkMutation = useMutation({
    mutationFn: async (planId: string) => {
      const r = await fetch("/api/billing/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      return r.json();
    },
    onSuccess: (data, planId) => {
      if (data.url) {
        navigator.clipboard.writeText(data.url);
        toast({ title: "✅ رابط الدفع جاهز!", description: "تم نسخ الرابط للحافظة" });
        window.open(data.url, "_blank");
      } else {
        toast({ title: "خطأ", description: data.error ?? data.hint ?? "فشل إنشاء رابط الدفع", variant: "destructive" });
      }
      setLoadingPlan(null);
    },
    onError: () => { setLoadingPlan(null); toast({ title: "خطأ في الاتصال", variant: "destructive" }); },
  });

  const handleSubscribe = (planId: string) => {
    setLoadingPlan(planId);
    checkoutMutation.mutate(planId);
  };

  const handlePaymentLink = (planId: string) => {
    setLoadingPlan(`link-${planId}`);
    paymentLinkMutation.mutate(planId);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-[#C9A84C]" />
            الاشتراك والفوترة
          </h1>
          <p className="text-muted-foreground text-sm mt-1">اختر الخطة المناسبة لمكتبك القانوني</p>
        </div>

        {/* Stripe status badge */}
        {stripeStatus && (
          <Badge className={cn("text-xs border gap-1.5", stripeStatus.configured
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
          )}>
            <div className={cn("w-1.5 h-1.5 rounded-full", stripeStatus.configured ? "bg-emerald-400" : "bg-yellow-400")} />
            {stripeStatus.configured ? `Stripe — ${stripeStatus.mode === "test" ? "وضع تجريبي" : "وضع إنتاج"}` : "Stripe — يحتاج مفتاح سري"}
          </Badge>
        )}
      </div>

      {/* Stripe not configured warning */}
      {stripeStatus && !stripeStatus.configured && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
          <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-yellow-400">Stripe يحتاج المفتاح السري</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              أضف <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> في Replit Secrets لتفعيل الدفع.
              تجده في: Stripe Dashboard → Developers → API Keys
            </p>
          </div>
        </div>
      )}

      {/* Pricing plans */}
      <div>
        <h2 className="text-lg font-bold mb-4">خطط الاشتراك</h2>
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
              const isLoadingLink = loadingPlan === `link-${plan.id}`;

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
                        disabled={isLoadingThis || isLoadingLink}
                        onClick={() => handleSubscribe(plan.id)}
                      >
                        {isLoadingThis ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                        اشترك الآن
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 text-xs"
                        disabled={isLoadingThis || isLoadingLink}
                        onClick={() => handlePaymentLink(plan.id)}
                      >
                        {isLoadingLink ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                        إنشاء رابط دفع
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoices */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" /> سجل الفواتير
          </CardTitle>
          <CardDescription>فواتير الاشتراك السابقة</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesLoading ? (
                <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                    لا توجد فواتير بعد
                  </TableCell>
                </TableRow>
              ) : invoices.map((invoice: any) => (
                <TableRow key={invoice.id}>
                  <TableCell>{new Date(invoice.createdAt).toLocaleDateString("ar-SA")}</TableCell>
                  <TableCell className="font-bold">{invoice.amount} ر.س</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={invoice.status === "paid"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                    }>
                      {invoice.status === "paid" ? "مدفوعة" : "مستحقة"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
