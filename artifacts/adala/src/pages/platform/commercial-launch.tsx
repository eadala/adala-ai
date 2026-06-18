/**
 * لوحة الإطلاق التجاري — Commercial Launch Dashboard
 * ────────────────────────────────────────────────────────────────
 * Super-admin: MRR, ARR, Tenants, AI, Go-Live Checklist, Growth Charts
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, Sparkles, CreditCard,
  Crown, CheckCircle2, AlertTriangle, XCircle, Building2,
  ArrowUpRight, Activity, Zap, DollarSign, ShieldCheck,
  BarChart3, Globe, Rocket, RefreshCw, ExternalLink,
} from "lucide-react";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/* ── Types ─────────────────────────────────────────────────────── */
interface GoLiveData {
  mrr: number;
  arr: number;
  total: number;
  active: number;
  inactive: number;
  churnRate: number;
  ltv: number;
  totalRevenue: number;
  aiUsedCredits: number;
  aiTotalAllowed: number;
  dailyTrend: { day: string; signups: number; revenue: number }[];
  planDist: { plan: string; count: number; price: number; mrrContrib: number }[];
  recentFeed: { id: string; name: string; plan: string; status: string; joined: string; mrr: number }[];
  checklist: { id: string; label: string; status: "ok" | "warn" | "error"; detail: string }[];
  goLiveScore: number;
  checksPassed: number;
  checksTotal: number;
}

/* ── Plan color map ─────────────────────────────────────────────── */
const PLAN_COLOR: Record<string, string> = {
  free:         "#6B7280",
  starter:      "#6B7280",
  basic:        "#6B7280",
  pro:          "#3B82F6",
  professional: "#3B82F6",
  growth:       "#10B981",
  business:     "#10B981",
  advanced:     "#8B5CF6",
  enterprise:   "#F59E0B",
  elite:        "#EF4444",
};
const planLabel = (s: string) => ({
  free: "مجاني", starter: "مبتدئ", basic: "أساسي",
  pro: "احترافي", professional: "احترافي",
  growth: "نمو", business: "أعمال",
  advanced: "متقدم", enterprise: "مؤسسي", elite: "نخبة",
}[s] ?? s);

/* ── KPI Card ─────────────────────────────────────────────────── */
function KPI({
  label, value, sub, icon: Icon, color, gradient, href,
}: {
  label: string; value: string; sub?: string;
  icon: any; color: string; gradient: string; href?: string;
}) {
  const inner = (
    <div className={`relative rounded-2xl border border-border/50 bg-gradient-to-br ${gradient} p-5 overflow-hidden group hover:shadow-md transition-all cursor-pointer`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: `${color}20` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        {href && <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
      </div>
      <p className="text-2xl font-black tracking-tight" style={{ color }}>{value}</p>
      <p className="text-xs font-semibold text-foreground/70 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-1 leading-tight">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/* ── Check status icon ─────────────────────────────────────────── */
function CheckIcon({ status }: { status: "ok" | "warn" | "error" }) {
  if (status === "ok")    return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "warn")  return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
  return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
}

/* ── Score ring ─────────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 90 ? "#10B981" : score >= 70 ? "#F59E0B" : "#EF4444";
  const label = score >= 90 ? "جاهز للإطلاق" : score >= 70 ? "شبه جاهز" : "يحتاج إعداد";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="rotate-[-90deg]" viewBox="0 0 88 88" width="80" height="80">
          <circle cx="44" cy="44" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
          <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black" style={{ color }}>{score}%</span>
        </div>
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

/* ── Main ─────────────────────────────────────────────────────── */
export default function CommercialLaunchDashboard() {
  const { data, isLoading, refetch, isFetching } = useQuery<GoLiveData>({
    queryKey: ["go-live-metrics"],
    queryFn: () => fetch(`${BASE}/api/admin/go-live-metrics`).then(r => {
      if (!r.ok) throw new Error("Unauthorized or server error");
      return r.json();
    }),
    staleTime: 60_000,
    retry: 1,
  });

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}م`
    : n >= 1_000   ? `${(n / 1_000).toFixed(1)}ك`
    : n.toLocaleString("ar-SA");

  const fmtSar = (n: number) => `${fmt(n)} ر.س`;

  const kpis = data ? [
    {
      label: "الإيرادات الشهرية MRR",
      value: fmtSar(data.mrr),
      sub: `ARR: ${fmtSar(data.arr)}`,
      icon: DollarSign, color: "#10B981",
      gradient: "from-emerald-500/8 to-emerald-600/3",
      href: "/billing",
    },
    {
      label: "المكاتب النشطة",
      value: String(data.active),
      sub: `${data.total} إجمالي · ${data.inactive} غير نشط`,
      icon: Building2, color: "#3B82F6",
      gradient: "from-blue-500/8 to-blue-600/3",
      href: "/super-admin",
    },
    {
      label: "معدل التوقف (Churn)",
      value: `${data.churnRate}%`,
      sub: `LTV متوسط: ${fmtSar(data.ltv)}`,
      icon: data.churnRate < 10 ? TrendingUp : TrendingDown,
      color: data.churnRate < 10 ? "#10B981" : "#EF4444",
      gradient: data.churnRate < 10 ? "from-emerald-500/8 to-emerald-600/3" : "from-red-500/8 to-red-600/3",
    },
    {
      label: "استخدام الذكاء الاصطناعي",
      value: fmt(data.aiUsedCredits),
      sub: `من ${fmt(data.aiTotalAllowed)} نقطة مُخصَّصة`,
      icon: Sparkles, color: "#8B5CF6",
      gradient: "from-violet-500/8 to-violet-600/3",
      href: "/ai-hub",
    },
    {
      label: "إجمالي الإيرادات",
      value: fmtSar(data.totalRevenue),
      sub: "كامل العمر التشغيلي",
      icon: CreditCard, color: "#F59E0B",
      gradient: "from-amber-500/8 to-amber-600/3",
      href: "/billing",
    },
  ] : [];

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-xl font-black text-foreground">لوحة الإطلاق التجاري</h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">Go-Live</Badge>
          </div>
          <p className="text-sm text-muted-foreground mr-12">
            نظرة تجارية شاملة — MRR · Growth · Tenants · AI · Readiness Checklist
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 text-xs gap-1.5 rounded-lg"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Link href="/super-admin">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg">
              <ExternalLink className="h-3.5 w-3.5" />
              لوحة المشرف
            </Button>
          </Link>
        </div>
      </div>

      {/* ── KPI Row ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {kpis.map((k, i) => <KPI key={i} {...k} />)}
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Revenue & Signups Trend — 2/3 */}
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold">الإيرادات والتسجيلات اليومية</p>
                <p className="text-[11px] text-muted-foreground">آخر 30 يوماً</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />إيرادات</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />تسجيلات</span>
            </div>
          </div>
          <div className="p-5">
            {isLoading ? <Skeleton className="h-48 rounded-xl" /> : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.dailyTrend ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="revenue" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false}
                      tickFormatter={v => v > 0 ? `${(v/1000).toFixed(0)}k` : "0"} width={35} />
                    <YAxis yAxisId="signups" orientation="left" hide />
                    <Tooltip
                      contentStyle={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px", direction: "rtl" }}
                      formatter={(v: any, name: string) => [
                        name === "revenue" ? `${Number(v).toLocaleString("ar-SA")} ر.س` : `${v} تسجيل`,
                        name === "revenue" ? "إيرادات" : "تسجيلات",
                      ]}
                    />
                    <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#gRevenue)" dot={false} />
                    <Area yAxisId="signups" type="monotone" dataKey="signups" stroke="#10B981" strokeWidth={2} fill="url(#gSignups)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Plan Distribution — 1/3 */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/40">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Crown className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold">توزيع الباقات</p>
              <p className="text-[11px] text-muted-foreground">MRR لكل باقة</p>
            </div>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-8 rounded-lg" />)}</div>
            ) : (
              <div className="space-y-2.5">
                {(data?.planDist ?? []).map(p => {
                  const color = PLAN_COLOR[p.plan] ?? "#6B7280";
                  const maxMrr = Math.max(...(data?.planDist ?? []).map(x => x.mrrContrib), 1);
                  const pct    = Math.round((p.mrrContrib / maxMrr) * 100);
                  return (
                    <div key={p.plan}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="font-semibold text-foreground/80">{planLabel(p.plan)}</span>
                          <span className="text-muted-foreground/60">({p.count})</span>
                        </div>
                        <span className="font-mono font-bold" style={{ color }}>
                          {p.mrrContrib.toLocaleString("ar-SA")} ر.س
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
                {(data?.planDist ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد بيانات</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Go-Live Checklist + Recent Activations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Checklist */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-bold">قائمة جاهزية الإطلاق</p>
                <p className="text-[11px] text-muted-foreground">Go-Live Readiness Checklist</p>
              </div>
            </div>
            {!isLoading && data && (
              <ScoreRing score={data.goLiveScore} />
            )}
          </div>
          <div className="p-4 space-y-2">
            {isLoading ? (
              Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-10 rounded-xl" />)
            ) : (
              (data?.checklist ?? []).map(item => (
                <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  item.status === "ok"    ? "border-emerald-500/20 bg-emerald-500/5"
                  : item.status === "warn" ? "border-amber-500/20 bg-amber-500/5"
                  : "border-red-500/20 bg-red-500/5"
                }`}>
                  <CheckIcon status={item.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground/85 leading-tight">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">{item.detail}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                    item.status === "ok"    ? "bg-emerald-500/15 text-emerald-600"
                    : item.status === "warn" ? "bg-amber-500/15 text-amber-600"
                    : "bg-red-500/15 text-red-600"
                  }`}>
                    {item.status === "ok" ? "✓" : item.status === "warn" ? "⚠" : "✗"}
                  </span>
                </div>
              ))
            )}
            {!isLoading && data && (
              <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                <span>{data.checksPassed}/{data.checksTotal} فحص اجتاز</span>
                <span className={`font-bold ${data.goLiveScore >= 90 ? "text-emerald-600" : data.goLiveScore >= 70 ? "text-amber-600" : "text-red-600"}`}>
                  {data.goLiveScore >= 90 ? "🟢 جاهز للإطلاق" : data.goLiveScore >= 70 ? "🟡 شبه جاهز" : "🔴 يحتاج إعداد"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activations */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/40">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-bold">آخر التسجيلات</p>
              <p className="text-[11px] text-muted-foreground">أحدث المكاتب المنضمة</p>
            </div>
          </div>
          <div className="divide-y divide-border/30">
            {isLoading ? (
              <div className="p-4 space-y-2">{Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : (data?.recentFeed ?? []).length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">لا توجد تسجيلات بعد</div>
            ) : (
              (data?.recentFeed ?? []).map(o => {
                const color  = PLAN_COLOR[o.plan] ?? "#6B7280";
                const joined = new Date(o.joined).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
                return (
                  <div key={o.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black"
                      style={{ background: `${color}20`, color }}>
                      {(o.name || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground/85 truncate">{o.name || "—"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: `${color}15`, color }}>
                          {planLabel(o.plan)}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">{joined}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold" style={{ color }}>
                        {o.mrr > 0 ? `${o.mrr.toLocaleString("ar-SA")} ر.س` : "مجاني"}
                      </p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        o.status === "active" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted/50 text-muted-foreground"
                      }`}>
                        {o.status === "active" ? "نشط" : "غير نشط"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {!isLoading && (
            <div className="px-5 py-3 border-t border-border/30">
              <Link href="/super-admin">
                <Button variant="ghost" size="sm" className="w-full h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                  <Users className="h-3.5 w-3.5" />
                  عرض كل المكاتب في لوحة المشرف
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Revenue Architecture Summary ── */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground mb-2">معمارية الإيرادات — Revenue Stack</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
              {[
                { label: "بوابة الدفع",       val: "Stripe + مدى",         icon: CreditCard,   color: "#10B981" },
                { label: "التفعيل التلقائي",  val: "Webhook → Provision",  icon: Zap,          color: "#3B82F6" },
                { label: "الذكاء الاصطناعي", val: "Gemini + Claude + GPT", icon: Sparkles,     color: "#8B5CF6" },
                { label: "الحوكمة والأمان",  val: "Clerk + RBAC + Audit",  icon: ShieldCheck,  color: "#F59E0B" },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-2 p-2.5 rounded-xl bg-background/60 border border-border/40">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${item.color}20` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="font-bold text-foreground/80 leading-tight">{item.label}</p>
                      <p className="text-muted-foreground/60 leading-tight">{item.val}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
