import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, DollarSign, BarChart2, ArrowUpRight, ArrowDownRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const PRINT_CSS = `
@media print {
  body { background: #fff !important; color: #111 !important; font-family: 'Cairo', sans-serif; direction: rtl; }
  .print\\:hidden { display: none !important; }
  nav, aside, header { display: none !important; }
  .recharts-wrapper, .recharts-surface { page-break-inside: avoid; }
  * { box-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bg-card { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; }
  .text-white { color: #111 !important; }
  .text-muted-foreground { color: #555 !important; }
  h1, h2 { color: #0D1526 !important; }
}
`;

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م ر.س";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "ك ر.س";
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س";
}
function fmtFull(n: number) {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 2 }) + " ر.س";
}

const COLORS = ["#2563EB","#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#F97316"];
const CHART_COLORS = { revenue: "#10B981", expenses: "#EF4444", profit: "#2563EB" };

function KPICard({ title, value, sub, icon: Icon, color, trend }: any) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: color + "22" }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          {trend !== undefined && (
            <Badge variant="outline" className={trend >= 0 ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}>
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3 ml-0.5" /> : <ArrowDownRight className="h-3 w-3 ml-0.5" />}
              {Math.abs(trend).toFixed(1)}%
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs mb-1">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl" dir="rtl">
      <p className="text-primary font-medium mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="text-foreground font-medium">{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function FinancialReports() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["accounting-summary"],
    queryFn: () => fetch(`${BASE}/api/accounting/reports/summary`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin ml-2" /> جارٍ تحميل التقارير...
    </div>
  );

  const d = data ?? {};
  const monthly = d.monthly ?? [];
  const expCats = d.expenseCategories ?? [];
  const revCats = d.revenueCategories ?? [];

  const hasMonthlyData = monthly.some((m: any) => m.revenue > 0 || m.expenses > 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <style>{PRINT_CSS}</style>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <BarChart2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">التقارير المالية</h1>
              <p className="text-xs text-muted-foreground">قائمة الأرباح والخسائر · العام الحالي</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 print:hidden">
            <Printer className="h-4 w-4" /> تصدير PDF
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="إجمالي الإيرادات" value={fmt(d.totalRevenue ?? 0)} icon={TrendingUp} color="#10B981"
            sub={`مباشرة: ${fmt(d.revenueBreakdown?.direct ?? 0)} · فواتير: ${fmt(d.revenueBreakdown?.invoices ?? 0)}`} />
          <KPICard title="إجمالي المصاريف" value={fmt(d.totalExpenses ?? 0)} icon={TrendingDown} color="#EF4444"
            sub={`مباشرة: ${fmt(d.expenseBreakdown?.direct ?? 0)} · رواتب: ${fmt(d.expenseBreakdown?.payroll ?? 0)}`} />
          <KPICard title="صافي الربح" value={fmt(d.netProfit ?? 0)} icon={DollarSign}
            color={(d.netProfit ?? 0) >= 0 ? "#2563EB" : "#EF4444"}
            sub={(d.netProfit ?? 0) >= 0 ? "✓ المكتب رابح" : "⚠ خسارة صافية"} />
          <KPICard title="هامش الربح" value={`${(d.profitMargin ?? 0).toFixed(1)}%`} icon={BarChart2} color="#8B5CF6"
            sub={`سلف قائمة: ${fmt(d.outstandingAdvances ?? 0)}`} />
        </div>

        {/* Monthly Bar Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">الإيرادات والمصاريف الشهرية</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasMonthlyData ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <BarChart2 className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">لا توجد بيانات بعد — أضف إيرادات ومصاريف لعرض الرسم البياني</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? (v / 1000) + "ك" : String(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "#9CA3AF" }} />
                  <Bar dataKey="revenue" name="الإيرادات" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="expenses" name="المصاريف" fill={CHART_COLORS.expenses} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="profit" name="صافي الربح" fill={CHART_COLORS.profit} radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category Pie Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Revenue categories */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">توزيع الإيرادات حسب الفئة</CardTitle>
            </CardHeader>
            <CardContent>
              {revCats.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">لا توجد بيانات</div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={revCats} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                        {revCats.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {revCats.slice(0, 5).map((cat: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground flex-1 truncate">{cat.name}</span>
                        <span className="text-foreground font-medium">{fmt(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense categories */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">توزيع المصاريف حسب الفئة</CardTitle>
            </CardHeader>
            <CardContent>
              {expCats.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">لا توجد بيانات</div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={expCats} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                        {expCats.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {expCats.slice(0, 5).map((cat: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground flex-1 truncate">{cat.name}</span>
                        <span className="text-foreground font-medium">{fmt(cat.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Summary Table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground">الملخص الشهري</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-right">
                    <th className="px-4 py-2 font-medium">الشهر</th>
                    <th className="px-4 py-2 font-medium text-green-400">الإيرادات</th>
                    <th className="px-4 py-2 font-medium text-red-400">المصاريف</th>
                    <th className="px-4 py-2 font-medium text-primary">صافي الربح</th>
                    <th className="px-4 py-2 font-medium">الوضع</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m: any) => (
                    <tr key={m.month} className="border-b border-border/40 hover:bg-card-accent/20">
                      <td className="px-4 py-2.5 text-foreground">{m.month}</td>
                      <td className="px-4 py-2.5 text-green-400">{fmtFull(m.revenue)}</td>
                      <td className="px-4 py-2.5 text-red-400">{fmtFull(m.expenses)}</td>
                      <td className={`px-4 py-2.5 font-bold ${m.profit >= 0 ? "text-primary" : "text-red-400"}`}>{fmtFull(m.profit)}</td>
                      <td className="px-4 py-2.5">
                        {m.revenue === 0 && m.expenses === 0 ? (
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">لا بيانات</Badge>
                        ) : m.profit >= 0 ? (
                          <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">رابح</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">خاسر</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
