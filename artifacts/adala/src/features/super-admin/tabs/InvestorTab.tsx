import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, TrendingDown, Users, Building2, DollarSign,
  Activity, Cpu, BarChart3, AlertTriangle, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PLAN_SLUG_COLORS, PLAN_SLUG_LABELS } from "../shared/constants";

/* ── Types ──────────────────────────────────────────────────────── */
interface Metrics {
  mrr: number; arr: number; totalRevenue: number; ltv: number;
  churnRate: number; momGrowth: number;
  total: number; active: number; inactive: number;
  planDist: { plan: string; count: number; price: number }[];
  growthTrend: { month: string; count: number }[];
  aiUsedCredits: number; aiTotalAllowed: number; aiCurrentBal: number;
  recentOffices: { id: string; name: string; plan: string; status: string; joined: string; mrr: number }[];
}

/* ── Helpers ────────────────────────────────────────────────────── */
const SAR = (v: number) => `${v.toLocaleString("ar-SA")} ر.س`;

function KpiCard({
  label, value, sub, icon: Icon, color = "text-foreground", trend,
}: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<any>; color?: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="border border-border/60">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="rounded-xl bg-muted/60 p-2.5 shrink-0">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${
            trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
          }`}>
            {trend === "up" ? <TrendingUp className="w-3 h-3" /> :
             trend === "down" ? <TrendingDown className="w-3 h-3" /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Mini bar chart ─────────────────────────────────────────────── */
function MiniBar({ data }: { data: { month: string; count: number }[] }) {
  if (!data.length) return <p className="text-xs text-muted-foreground">لا توجد بيانات</p>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-24 mt-2">
      {data.map(d => (
        <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full rounded-t bg-primary/80 transition-all duration-300"
            style={{ height: `${(d.count / max) * 80}px`, minHeight: 4 }}
          />
          <span className="text-[10px] text-muted-foreground">{d.month.slice(5)}</span>
          <span className="text-[10px] font-medium">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */
export function InvestorTab() {
  const { data, isLoading, error, refetch } = useQuery<Metrics>({
    queryKey: ["investor-metrics"],
    queryFn:  async () => {
      const r = await fetch("/api/admin/investor-metrics", { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
      <AlertTriangle className="w-8 h-8 text-red-400" />
      <p className="text-sm">تعذّر تحميل مؤشرات المستثمر</p>
      <button onClick={() => refetch()} className="text-xs text-primary hover:underline flex items-center gap-1">
        <RefreshCw className="w-3 h-3" /> إعادة المحاولة
      </button>
    </div>
  );

  const {
    mrr, arr, totalRevenue, ltv, churnRate, momGrowth,
    total, active, inactive, planDist, growthTrend,
    aiUsedCredits, aiTotalAllowed, aiCurrentBal, recentOffices,
  } = data;

  return (
    <div className="space-y-6 pb-8" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">مؤشرات المستثمر</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Investor-grade metrics — MRR · ARR · LTV · Churn · Growth</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border/60"
        >
          <RefreshCw className="w-3 h-3" /> تحديث
        </button>
      </div>

      {/* ── Top KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="MRR (الإيراد الشهري المتكرر)"
          value={SAR(mrr)}
          sub={`ARR: ${SAR(arr)}`}
          icon={DollarSign}
          color="text-emerald-500"
          trend="up"
        />
        <KpiCard
          label="إجمالي الإيراد المحصّل"
          value={SAR(totalRevenue)}
          sub="من فواتير العملاء"
          icon={TrendingUp}
          color="text-blue-500"
        />
        <KpiCard
          label="LTV (قيمة العميل طوال الحياة)"
          value={SAR(ltv)}
          sub="متوسط لكل مكتب"
          icon={BarChart3}
          color="text-violet-500"
        />
        <KpiCard
          label="نمو MoM"
          value={`${momGrowth >= 0 ? "+" : ""}${momGrowth}%`}
          sub="مقارنة بالشهر الماضي"
          icon={momGrowth >= 0 ? TrendingUp : TrendingDown}
          color={momGrowth >= 0 ? "text-emerald-500" : "text-red-500"}
          trend={momGrowth >= 0 ? "up" : "down"}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="إجمالي المكاتب"
          value={total.toString()}
          sub={`${active} نشط · ${inactive} غير نشط`}
          icon={Building2}
        />
        <KpiCard
          label="معدل الاضمحلال (Churn)"
          value={`${churnRate}%`}
          sub="نسبة المكاتب المتوقفة"
          icon={TrendingDown}
          color={churnRate > 15 ? "text-red-500" : churnRate > 5 ? "text-amber-500" : "text-emerald-500"}
          trend={churnRate > 15 ? "down" : "neutral"}
        />
        <KpiCard
          label="رصيد AI المستخدم"
          value={aiUsedCredits.toLocaleString()}
          sub={`من ${aiTotalAllowed.toLocaleString()} نقطة مسموح`}
          icon={Cpu}
          color="text-amber-500"
        />
        <KpiCard
          label="رصيد AI المتبقي"
          value={aiCurrentBal.toLocaleString()}
          sub="مجموع أرصدة جميع المكاتب"
          icon={Activity}
          color="text-cyan-500"
        />
      </div>

      {/* ── Growth trend + Plan distribution ── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Growth trend */}
        <Card className="border border-border/60">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">نمو المكاتب (آخر 6 أشهر)</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBar data={growthTrend} />
          </CardContent>
        </Card>

        {/* Plan distribution */}
        <Card className="border border-border/60">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">توزيع الباقات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5 mt-2">
              {planDist.map(p => {
                const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                const color = PLAN_SLUG_COLORS[p.plan] ?? "#64748B";
                return (
                  <div key={p.plan}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{PLAN_SLUG_LABELS[p.plan] ?? p.plan}</span>
                      <span className="text-muted-foreground">{p.count} مكتب ({pct}%) · {SAR(p.price)}/شهر</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent offices ── */}
      <Card className="border border-border/60">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold">آخر المكاتب المنضمة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground text-xs">
                  <th className="text-right py-2 font-medium">المكتب</th>
                  <th className="text-right py-2 font-medium">الباقة</th>
                  <th className="text-right py-2 font-medium">الحالة</th>
                  <th className="text-right py-2 font-medium">MRR</th>
                  <th className="text-right py-2 font-medium">تاريخ الانضمام</th>
                </tr>
              </thead>
              <tbody>
                {recentOffices.map(o => (
                  <tr key={o.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                    <td className="py-2 font-medium">{o.name}</td>
                    <td className="py-2">
                      <Badge
                        variant="outline"
                        style={{ borderColor: PLAN_SLUG_COLORS[o.plan] ?? "#64748B", color: PLAN_SLUG_COLORS[o.plan] ?? "#64748B" }}
                        className="text-xs"
                      >
                        {PLAN_SLUG_LABELS[o.plan] ?? o.plan}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs font-medium ${o.status === "active" ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {o.status === "active" ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                    <td className="py-2 font-medium text-emerald-600">{o.mrr > 0 ? SAR(o.mrr) : "—"}</td>
                    <td className="py-2 text-muted-foreground text-xs">{o.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Disclaimer ── */}
      <p className="text-xs text-muted-foreground text-center">
        MRR محسوب من أسعار الباقات للمكاتب النشطة · LTV = إجمالي الإيرادات ÷ عدد المكاتب · Churn = غير النشطين ÷ الإجمالي
      </p>

    </div>
  );
}
