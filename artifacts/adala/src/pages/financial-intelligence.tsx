/**
 * Financial Intelligence Center — مركز الذكاء المالي
 * Unified dashboard: KPIs + AI Insights + Anomaly Detection + Forecast + Charts
 */
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart2, AlertTriangle,
  CheckCircle2, Info, XCircle, RefreshCw, Lightbulb, Zap,
  ArrowUpRight, ArrowDownRight, PieChart, Target, BrainCircuit
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid
} from "recharts";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const BASE  = import.meta.env.BASE_URL.replace(/\/$/, "");
const GOLD  = "#C9A84C";
const GREEN = "#10B981";
const RED   = "#EF4444";
const BLUE  = "#3B82F6";
const PIE_COLORS = ["#C9A84C","#3B82F6","#10B981","#8B5CF6","#F59E0B","#06B6D4","#EC4899","#14B8A6"];

/* ── Helpers ──────────────────────────────────────────── */
function fmt(n: number) {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}
function fmtMonth(m: string) {
  try {
    const [y, mo] = m.split("-");
    return new Date(+y, +mo - 1).toLocaleString("ar-SA", { month: "short", year: "2-digit" });
  } catch { return m; }
}

/* ── KPI Card ─────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, color, growth }: any) {
  const isPos = growth > 0;
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
            <Icon className="h-4 w-4" style={{ color }} />
          </div>
        </div>
        <p className="text-2xl font-black mb-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        {growth !== undefined && (
          <div className={cn("flex items-center gap-1 mt-2 text-xs font-medium",
            isPos ? "text-emerald-400" : "text-red-400")}>
            {isPos ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(growth)}٪ عن الشهر الماضي
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Insight Card ─────────────────────────────────────── */
function InsightCard({ insight }: { insight: any }) {
  const cfg: Record<string, any> = {
    success: { icon: CheckCircle2, color: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)" },
    warning: { icon: AlertTriangle, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
    error:   { icon: XCircle, color: "#EF4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)" },
    info:    { icon: Info, color: "#3B82F6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)" },
  };
  const c = cfg[insight.level] ?? cfg.info;
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <c.icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: c.color }} />
      <p className="text-sm leading-relaxed">{insight.text}</p>
    </div>
  );
}

/* ── Risk Badge ───────────────────────────────────────── */
function RiskBadge({ level }: { level: string }) {
  if (level === "HIGH")   return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 border text-xs">خطر عالٍ</Badge>;
  if (level === "MEDIUM") return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 border text-xs">متوسط</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 border text-xs">آمن</Badge>;
}

/* ── Custom Tooltip ───────────────────────────────────── */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-xs" style={{ background: "#0f1e35", border: "1px solid rgba(255,255,255,0.1)" }}>
      <p className="font-bold mb-1.5 text-white">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)} ر.س</p>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function FinancialIntelligencePage() {
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["finance-intelligence"],
    queryFn:  () => fetch(`${BASE}/api/finance/intelligence`).then(r => r.json()),
    refetchInterval: 120_000,
  });

  const kpis       = data?.kpis       ?? {};
  const trend      = (data?.trend      ?? []).map((t: any) => ({ ...t, month: fmtMonth(t.month) }));
  const categories = data?.categories  ?? [];
  const anomalies  = data?.anomalies   ?? {};
  const forecast   = data?.forecast    ?? {};
  const insights   = data?.aiInsights  ?? [];

  /* Empty state: platform has no data yet */
  const noData = !isLoading && !isError && kpis.totalRevenue === 0 && kpis.totalExpenses === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-[#C9A84C]" />
            مركز الذكاء المالي
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            تحليل مالي موحد — إيرادات · مصروفات · توقعات · تنبيهات ذكية
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && <RiskBadge level={anomalies.riskLevel ?? "LOW"} />}
          <Button variant="outline" size="sm" className="gap-2"
            onClick={() => qc.invalidateQueries({ queryKey: ["finance-intelligence"] })}>
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="إجمالي الإيرادات"    value={`${fmt(kpis.totalRevenue ?? 0)} ر.س`}
            icon={DollarSign} color={GOLD}  growth={kpis.revenueGrowth}
            sub={`هذا الشهر: ${fmt(kpis.thisMonthRevenue ?? 0)} ر.س`} />
          <KpiCard label="إجمالي المصروفات"    value={`${fmt(kpis.totalExpenses ?? 0)} ر.س`}
            icon={TrendingDown} color={RED}
            sub={`ذكاء اصطناعي: ${fmt(kpis.aiCost ?? 0)} ر.س`} />
          <KpiCard label="صافي الربح"           value={`${fmt(kpis.profit ?? 0)} ر.س`}
            icon={TrendingUp} color={GREEN}
            sub={`هامش الربح: ${kpis.profitMargin ?? 0}٪`} />
          <KpiCard label="الفواتير المعلقة"     value={kpis.invoiceStats?.pending ?? 0}
            icon={BarChart2} color={BLUE}
            sub={`إجمالي الفواتير: ${kpis.invoiceStats?.total ?? 0}`} />
        </div>
      )}

      {/* ── AI Insights ──────────────────────────────── */}
      {!isLoading && insights.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-[#C9A84C]" /> تحليلات الذكاء الاصطناعي
            </CardTitle>
            <CardDescription>رؤى مالية مولّدة تلقائياً من بياناتك</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-3">
            {insights.map((ins: any, i: number) => <InsightCard key={i} insight={ins} />)}
          </CardContent>
        </Card>
      )}

      {/* ── No data banner ────────────────────────────── */}
      {noData && (
        <Card className="border-dashed border-2 border-border/40">
          <CardContent className="py-16 text-center">
            <BarChart2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-base font-semibold text-muted-foreground">لا توجد بيانات مالية بعد</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              أضف إيرادات أو مصروفات أو أصدر فواتير وستظهر التحليلات هنا تلقائياً
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Charts ───────────────────────────────────── */}
      {!isLoading && trend.length > 0 && (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Revenue vs Expenses trend */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">الإيرادات والمصروفات (آخر 6 أشهر)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD}  stopOpacity={0.3} />
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={RED}  stopOpacity={0.25} />
                      <stop offset="95%" stopColor={RED} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="revenue"  name="الإيرادات"  stroke={GOLD}  fill="url(#gRev)" strokeWidth={2} />
                  <Area type="monotone" dataKey="expenses" name="المصروفات" stroke={RED}   fill="url(#gExp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue by category */}
          {categories.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">الإيرادات حسب الفئة</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={180}>
                  <RePieChart>
                    <Pie data={categories} dataKey="total" nameKey="category"
                      cx="50%" cy="50%" outerRadius={70} strokeWidth={0}>
                      {categories.map((_: any, i: number) =>
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${fmt(v)} ر.س`, ""]} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {categories.slice(0, 5).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground truncate max-w-[80px]">{c.category ?? "أخرى"}</span>
                      </div>
                      <span className="font-semibold">{fmt(c.total)} ر.س</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Forecast + Anomalies ─────────────────────── */}
      {!isLoading && (
        <div className="grid md:grid-cols-2 gap-5">
          {/* Forecast */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-400" /> التوقع المالي
              </CardTitle>
              <CardDescription>
                مستوى الثقة: {forecast.confidence === "high" ? "عالٍ" : forecast.confidence === "medium" ? "متوسط" : "منخفض"}
                {forecast.growthRate !== undefined && ` · معدل النمو: ${forecast.growthRate}٪`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-4 rounded-xl"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
                <span className="text-sm">الشهر القادم</span>
                <span className="text-lg font-black" style={{ color: "#8B5CF6" }}>
                  {fmt(forecast.nextMonth ?? 0)} ر.س
                </span>
              </div>
              <div className="flex justify-between items-center p-4 rounded-xl"
                style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)" }}>
                <span className="text-sm">3 أشهر القادمة</span>
                <span className="text-lg font-black" style={{ color: "#06B6D4" }}>
                  {fmt(forecast.threeMonths ?? 0)} ر.س
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Anomalies */}
          <Card className={cn("border-border/50",
            anomalies.riskLevel === "HIGH" ? "border-red-500/30" :
            anomalies.riskLevel === "MEDIUM" ? "border-yellow-500/30" : "")}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" /> كشف الشذوذ
              </CardTitle>
              <CardDescription>تحليل تلقائي للمخاطر المالية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(anomalies.count ?? 0) === 0 ? (
                <div className="flex items-center gap-2 p-4 rounded-xl"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm">لا توجد شذوذات مالية — الوضع سليم</span>
                </div>
              ) : (
                <>
                  {(anomalies.issues ?? []).map((issue: string, i: number) => {
                    const labels: Record<string, string> = {
                      expense_spike:         "المصروفات تتجاوز ٨٠٪ من الإيرادات",
                      revenue_decline:       "تراجع في الإيرادات أكثر من ١٠٪",
                      low_margin:            "هامش ربح منخفض (أقل من ١٥٪)",
                      high_ai_cost:          "تكاليف الذكاء الاصطناعي مرتفعة",
                      high_pending_invoices: "نسبة الفواتير المعلقة مرتفعة",
                    };
                    return (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl"
                        style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-400" />
                        <span className="text-xs">{labels[issue] ?? issue}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Monthly bar chart ────────────────────────── */}
      {!isLoading && trend.length > 1 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">مقارنة شهرية — الإيرادات مقابل المصروفات</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={(v) => v === "revenue" ? "الإيرادات" : "المصروفات"} />
                <Bar dataKey="revenue"  name="revenue"  fill={GOLD}  radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name="expenses" fill={RED}   radius={[4,4,0,0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* timestamp */}
      {data?.generatedAt && (
        <p className="text-center text-xs text-muted-foreground/40">
          آخر تحليل: {new Date(data.generatedAt).toLocaleString("ar-SA")}
        </p>
      )}
    </div>
  );
}
