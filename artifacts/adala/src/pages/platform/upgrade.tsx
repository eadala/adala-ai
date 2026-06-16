import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, Zap, Shield, Crown, ArrowLeft,
  Building2, Users, FileText, BarChart3, Headphones, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    nameAr: "مبدئي",
    price: { monthly: 99, yearly: 79 },
    color: "from-slate-500 to-slate-700",
    accent: "border-slate-300",
    icon: FileText,
    badge: null,
    features: [
      "حتى 50 قضية نشطة",
      "3 مستخدمين",
      "الفوترة الأساسية",
      "العقود الرقمية",
      "تطبيق الجوال",
      "دعم بريدي",
    ],
    limits: ["بدون ذكاء اصطناعي", "بدون موقع مكتب", "بدون تقارير متقدمة"],
  },
  {
    id: "pro",
    name: "Pro",
    nameAr: "احترافي",
    price: { monthly: 249, yearly: 199 },
    color: "from-blue-600 to-blue-800",
    accent: "border-blue-500",
    icon: Zap,
    badge: "الأكثر شعبية",
    features: [
      "قضايا غير محدودة",
      "10 مستخدمين",
      "ذكاء اصطناعي — 500 استفسار/شهر",
      "موقع مكتب مخصص",
      "التقارير المالية",
      "بوابة العملاء",
      "العلامة التجارية",
      "دعم أولوية",
    ],
    limits: [],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    nameAr: "مؤسسي",
    price: { monthly: 599, yearly: 479 },
    color: "from-violet-600 to-violet-900",
    accent: "border-violet-500",
    icon: Crown,
    badge: "للمكاتب الكبيرة",
    features: [
      "كل ميزات Pro",
      "مستخدمون غير محدودون",
      "ذكاء اصطناعي غير محدود",
      "API مخصص",
      "نطاق مخصص (domain)",
      "تكامل SAP / Oracle",
      "مدير حساب مخصص",
      "SLA 99.9%",
    ],
    limits: [],
  },
];

const FEATURE_COMPARE = [
  { label: "القضايا", starter: "50", pro: "غير محدود", enterprise: "غير محدود" },
  { label: "المستخدمون", starter: "3", pro: "10", enterprise: "غير محدود" },
  { label: "الذكاء الاصطناعي", starter: "—", pro: "500/شهر", enterprise: "غير محدود" },
  { label: "موقع المكتب", starter: "—", pro: "✓", enterprise: "✓" },
  { label: "بوابة العملاء", starter: "—", pro: "✓", enterprise: "✓" },
  { label: "التقارير المالية", starter: "أساسي", pro: "متقدم", enterprise: "متقدم" },
  { label: "API مخصص", starter: "—", pro: "—", enterprise: "✓" },
  { label: "نطاق مخصص", starter: "—", pro: "—", enterprise: "✓" },
  { label: "SLA", starter: "—", pro: "—", enterprise: "99.9%" },
];

export default function UpgradePage() {
  const [, nav] = useLocation();
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [selected, setSelected] = useState("pro");

  const { data: trial } = useQuery({
    queryKey: ["trial-status"],
    queryFn: () => fetch(`${BASE}/api/onboarding/trial-status`).then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const daysLeft = trial?.daysLeft ?? 0;
  const urgent = daysLeft <= 3;

  function handleChoose(planId: string) {
    nav(`/billing?plan=${planId}&billing=${billing}`);
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-6xl mx-auto px-4 py-10">

        <button
          onClick={() => nav("/dashboard")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          العودة للداشبورد
        </button>

        {daysLeft > 0 && (
          <div className={cn(
            "mb-8 rounded-2xl p-4 flex items-center justify-between border",
            urgent
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          )}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{urgent ? "⚠️" : "🎁"}</span>
              <div>
                <p className="font-bold text-sm">
                  {urgent ? "تنتهي تجربتك المجانية قريباً!" : "أنت في الفترة التجريبية المجانية"}
                </p>
                <p className="text-xs mt-0.5 opacity-80">
                  تبقى <span className="font-black text-base mx-1">{daysLeft}</span>
                  {daysLeft === 1 ? "يوم" : "أيام"} قبل إيقاف الخدمة
                </p>
              </div>
            </div>
            <Badge variant="outline" className={urgent ? "border-red-400 text-red-700" : "border-amber-400 text-amber-700"}>
              {urgent ? "عاجل" : "فعّال الآن"}
            </Badge>
          </div>
        )}

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-black text-foreground mb-3">
            اختر خطة مكتبك
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            اشترك الآن وحافظ على بياناتك مع كامل الميزات. ألغِ في أي وقت.
          </p>

          <div className="inline-flex items-center gap-1 bg-muted rounded-xl p-1 mt-6">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-all",
                billing === "monthly" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              )}
            >شهري</button>
            <button
              onClick={() => setBilling("yearly")}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                billing === "yearly" ? "bg-background shadow text-foreground" : "text-muted-foreground"
              )}
            >
              سنوي
              <Badge className="bg-green-100 text-green-700 text-[10px] px-1.5 border-0">وفّر 20%</Badge>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const price = plan.price[billing];
            const isSelected = selected === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelected(plan.id)}
                className={cn(
                  "relative rounded-2xl border-2 p-6 cursor-pointer transition-all duration-200",
                  isSelected ? `${plan.accent} shadow-xl scale-[1.02]` : "border-border hover:border-primary/40",
                  plan.id === "pro" ? "ring-2 ring-blue-500/20" : ""
                )}
              >
                {plan.badge && (
                  <div className="absolute -top-3 right-5">
                    <Badge className={cn(
                      "text-white text-xs px-3 py-1",
                      plan.id === "pro" ? "bg-blue-600" : "bg-violet-600"
                    )}>
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4", plan.color)}>
                  <Icon className="h-5 w-5 text-white" />
                </div>

                <h3 className="text-lg font-bold text-foreground">{plan.nameAr}</h3>
                <p className="text-xs text-muted-foreground mb-4">{plan.name}</p>

                <div className="flex items-end gap-1 mb-6">
                  <span className="text-3xl font-black text-foreground">{price}</span>
                  <span className="text-muted-foreground text-sm mb-1">ر.س / شهر</span>
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                  {plan.limits.map(l => (
                    <li key={l} className="flex items-start gap-2 text-sm text-muted-foreground/60 line-through">
                      <span className="h-4 w-4 mt-0.5 shrink-0 text-center leading-4">✕</span>
                      {l}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleChoose(plan.id)}
                  className={cn(
                    "w-full font-bold",
                    plan.id === "pro"
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : plan.id === "enterprise"
                      ? "bg-violet-600 hover:bg-violet-700 text-white"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground"
                  )}
                >
                  اشترك الآن
                </Button>
              </div>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-12">
          <div className="p-5 border-b border-border bg-muted/30">
            <h2 className="font-bold text-foreground text-base">مقارنة الخطط</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right p-4 font-semibold text-muted-foreground w-40">الميزة</th>
                  {PLANS.map(p => (
                    <th key={p.id} className="p-4 text-center font-bold text-foreground">{p.nameAr}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {FEATURE_COMPARE.map(row => (
                  <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-muted-foreground font-medium">{row.label}</td>
                    <td className="p-4 text-center text-foreground">{row.starter}</td>
                    <td className="p-4 text-center text-foreground font-medium">{row.pro}</td>
                    <td className="p-4 text-center text-foreground">{row.enterprise}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { icon: Shield, title: "بيانات آمنة", sub: "تشفير كامل + RLS" },
            { icon: Headphones, title: "دعم 24/7", sub: "عربي وإنجليزي" },
            { icon: Globe, title: "SaaS عالمي", sub: "متاح من أي مكان" },
            { icon: Users, title: "لا عقود طويلة", label: "ألغِ في أي وقت", sub: "ألغِ في أي وقت" },
          ].map(item => (
            <div key={item.title} className="bg-muted/30 rounded-xl p-4 text-center">
              <item.icon className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="font-semibold text-sm text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground">{item.sub}</p>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          جميع الأسعار بالريال السعودي • الاشتراك السنوي يُحسب شهرياً • ضريبة القيمة المضافة 15% مضافة عند الدفع
        </div>
      </div>
    </div>
  );
}
