import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, FileText, RefreshCw,
  AlertTriangle, CheckCircle2, Clock, Minus, Printer,
  BarChart2, Activity, Lightbulb, CreditCard,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;
async function get(url: string) {
  const r = await fetch(url); if (!r.ok) throw new Error(await r.text()); return r.json();
}

const SAR = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} م ر.س`;
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)} ك ر.س`;
  return `${Number(n ?? 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س`;
};
const SAR_FULL = (n: number) => `${Number(n ?? 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

const PIE_COLORS = ["#10B981","#3B82F6","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#F97316","#EC4899"];
const TABS = [
  { id: "overview",  label: "نظرة عامة",     icon: BarChart2 },
  { id: "cashflow",  label: "التدفق النقدي",  icon: Activity },
  { id: "invoices",  label: "الفواتير",       icon: FileText },
  { id: "insights",  label: "الرؤى المالية",  icon: Lightbulb },
];
const PERIODS = [{ v: "7", l: "7 أيام" }, { v: "30", l: "شهر" }, { v: "90", l: "3 أشهر" }, { v: "365", l: "سنة" }];

/* ─── Custom Tooltip ─── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs rtl" dir="rtl">
      <div className="font-semibold text-foreground/70 mb-2">{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <strong>{SAR(p.value)}</strong>
        </div>
      ))}
    </div>
  );
};

export default function FinanceDashboard() {
  const [tab, setTab]       = useState("overview");
  const [period, setPeriod] = useState("30");

  const overviewQ = useQuery({
    queryKey: ["fin-dash-overview", period],
    queryFn: () => get(api(`/api/finance-dashboard/overview?period=${period}`)),
    refetchInterval: 30_000,
  });
  const cashflowQ = useQuery({
    queryKey: ["fin-dash-cashflow"],
    queryFn: () => get(api("/api/finance-dashboard/cashflow?months=6")),
    enabled: tab === "cashflow",
    refetchInterval: 60_000,
  });
  const invoicesQ = useQuery({
    queryKey: ["fin-dash-invoices"],
    queryFn: () => get(api("/api/finance-dashboard/invoices")),
    enabled: tab === "invoices",
    refetchInterval: 30_000,
  });

  const s  = overviewQ.data?.summary ?? {};
  const iv = overviewQ.data?.invoices ?? {};
  const insights: string[] = overviewQ.data?.insights ?? [];
  const revCats: any[]     = overviewQ.data?.revenueByCategory ?? [];
  const expCats: any[]     = overviewQ.data?.expenseByCategory ?? [];
  const recentTx: any[]    = overviewQ.data?.recentTransactions ?? [];
  const cf                 = cashflowQ.data;

  const GW_ICON: Record<string, string> = { stripe: "💳", manual: "✏️", system: "⚙️", moyasar: "🌐" };
  const STATUS_STYLE: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    pending:   "bg-amber-100 text-amber-700",
    failed:    "bg-red-100 text-red-700",
  };

  /* KPI growth arrow */
  const Growth = ({ pct }: { pct: number }) =>
    pct === 0 ? <Minus className="h-3 w-3 text-muted-foreground inline" />
    : pct > 0  ? <TrendingUp  className="h-3 w-3 text-emerald-500 inline ms-1" />
    :             <TrendingDown className="h-3 w-3 text-red-500 inline ms-1" />;

  return (
    <div className="min-h-screen bg-background p-6 rtl" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">لوحة التقارير المالية</h1>
            <p className="text-sm text-muted-foreground">Financial Reporting Dashboard — SaaS Grade</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex gap-1 bg-card border border-border rounded-lg p-0.5">
            {PERIODS.map(p => (
              <button key={p.v} onClick={() => setPeriod(p.v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition
                  ${period === p.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
                {p.l}
              </button>
            ))}
          </div>
          <button onClick={() => overviewQ.refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-card border border-border hover:bg-muted/30 transition">
            <RefreshCw className={`h-3 w-3 ${overviewQ.isFetching ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-card border border-border hover:bg-muted/30 transition print:hidden">
            <Printer className="h-3 w-3" /> طباعة
          </button>
        </div>
      </div>

      {/* ── Insights Banner (always visible) ── */}
      {insights.length > 0 && (
        <div className="mb-5 grid gap-2">
          {insights.slice(0, 2).map((ins, i) => {
            const isWarn = ins.startsWith("⚠️") || ins.startsWith("🔴") || ins.startsWith("📉");
            return (
              <div key={i} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border
                ${isWarn ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
                <span>{ins}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/50"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ════════════ OVERVIEW ════════════ */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "إجمالي الإيرادات", value: SAR(s.totalRevenue ?? 0), growth: s.revenueGrowth, icon: TrendingUp,   color: "emerald", sub: "مقارنة بالفترة السابقة" },
              { label: "صافي الأرباح",     value: SAR(s.netProfit    ?? 0), growth: 0,               icon: DollarSign,  color: s.netProfit >= 0 ? "blue" : "red", sub: `مصاريف: ${SAR(s.totalExpenses ?? 0)}` },
              { label: "الرصيد التراكمي",  value: SAR_FULL(s.currentBalance ?? 0), growth: 0,        icon: BarChart2,   color: "violet",  sub: "من دفتر الأستاذ" },
              { label: "الفواتير المعلقة", value: iv.pending ?? 0,          growth: 0,               icon: FileText,    color: "amber",   sub: `${iv.overdue ?? 0} متأخرة`, warn: (iv.overdue ?? 0) > 0 },
            ].map((kpi, i) => (
              <div key={i} className={`bg-card border rounded-2xl p-5 ${kpi.warn ? "border-amber-300" : "border-border"}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                  <div className={`w-8 h-8 rounded-xl bg-${kpi.color}-50 flex items-center justify-center`}>
                    <kpi.icon className={`h-4 w-4 text-${kpi.color}-600`} />
                  </div>
                </div>
                <div className={`text-2xl font-bold ${kpi.warn ? "text-amber-600" : "text-foreground"}`}>{kpi.value}</div>
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  {kpi.growth !== undefined && kpi.growth !== 0 && (
                    <span className={kpi.growth > 0 ? "text-emerald-600" : "text-red-500"}>
                      <Growth pct={kpi.growth} /> {Math.abs(kpi.growth).toFixed(0)}%
                    </span>
                  )}
                  <span>{kpi.sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Revenue by Category */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> الإيرادات حسب الفئة
              </div>
              {revCats.length === 0
                ? <div className="text-center text-muted-foreground text-sm py-6">لا توجد إيرادات مسجّلة</div>
                : <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={revCats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {revCats.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => SAR(v)} />
                    </PieChart>
                  </ResponsiveContainer>
              }
            </div>

            {/* Expenses by Category */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" /> المصاريف حسب الفئة
              </div>
              {expCats.length === 0
                ? <div className="text-center text-muted-foreground text-sm py-6">لا توجد مصاريف مسجّلة</div>
                : <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={expCats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {expCats.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => SAR(v)} />
                    </PieChart>
                  </ResponsiveContainer>
              }
            </div>
          </div>

          {/* Invoice Status + Recent Tx */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* Invoice quick status */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" /> حالة الفواتير
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: "مدفوعة",    value: iv.paid ?? 0,    amount: iv.paidAmount ?? 0,    color: "emerald", icon: CheckCircle2 },
                  { label: "معلقة",     value: iv.pending ?? 0, amount: iv.pendingAmount ?? 0, color: "amber",   icon: Clock },
                  { label: "مسودة",     value: iv.draft ?? 0,   amount: 0,                     color: "gray",    icon: FileText },
                  { label: "متأخرة",    value: iv.overdue ?? 0, amount: 0,                     color: "red",     icon: AlertTriangle },
                ].map((s, i) => (
                  <div key={i} className={`p-3 rounded-xl bg-${s.color}-50 border border-${s.color}-100`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <s.icon className={`h-3.5 w-3.5 text-${s.color}-600`} />
                      <span className={`text-xs font-medium text-${s.color}-700`}>{s.label}</span>
                    </div>
                    <div className={`text-2xl font-bold text-${s.color}-700`}>{s.value}</div>
                    {s.amount > 0 && <div className="text-xs text-muted-foreground mt-0.5">{SAR(s.amount)}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-violet-600" /> آخر الحركات المالية
              </div>
              <div className="space-y-2">
                {recentTx.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">لا توجد حركات</div>}
                {recentTx.map((tx: any) => (
                  <div key={tx.id} className="flex items-center gap-2 py-1 border-b border-border/20 last:border-0">
                    <span className="text-base shrink-0">{GW_ICON[tx.gateway] ?? "💰"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground truncate">{tx.client_name ?? tx.description ?? "معاملة"}</div>
                      <div className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("ar-SA")}</div>
                    </div>
                    <div className="text-sm font-semibold text-emerald-700 shrink-0">{SAR(tx.amount)}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[tx.status] ?? "bg-muted/50 text-muted-foreground"}`}>{tx.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ CASHFLOW ════════════ */}
      {tab === "cashflow" && (
        <div className="space-y-5">
          {cashflowQ.isLoading && <div className="p-8 text-center text-muted-foreground text-sm">جارٍ تحليل التدفق النقدي…</div>}
          {cf && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "إجمالي الإيرادات",  value: cf.totals.revenue,  color: "emerald" },
                  { label: "إجمالي المصاريف",   value: cf.totals.expenses, color: "red" },
                  { label: "صافي التدفق",        value: cf.totals.net,      color: cf.totals.net >= 0 ? "blue" : "red" },
                ].map((m, i) => (
                  <div key={i} className="bg-card border border-border rounded-2xl p-5 text-center">
                    <div className="text-xs text-muted-foreground mb-2">{m.label}</div>
                    <div className={`text-xl font-bold text-${m.color}-600`}>{SAR(m.value)}</div>
                    <div className="flex items-center justify-center gap-1 mt-1 text-xs text-muted-foreground">
                      {cf.trend === "up" ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : cf.trend === "down" ? <TrendingDown className="h-3 w-3 text-red-500" /> : <Minus className="h-3 w-3" />}
                      اتجاه {cf.trend === "up" ? "صاعد" : cf.trend === "down" ? "هابط" : "مستقر"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar Chart */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="font-semibold text-foreground mb-5">التدفق النقدي الشهري</div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={cf.cashflow} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <YAxis tickFormatter={v => SAR(v)} tick={{ fontSize: 10, fill: "#6B7280" }} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend formatter={v => v === "revenue" ? "الإيرادات" : v === "expenses" ? "المصاريف" : "الصافي"} />
                    <Bar dataKey="revenue"  fill="#10B981" radius={[4,4,0,0]} name="revenue" />
                    <Bar dataKey="expenses" fill="#EF4444" radius={[4,4,0,0]} name="expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Net Flow Area */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="font-semibold text-foreground mb-5">صافي التدفق الشهري</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={cf.cashflow}>
                    <defs>
                      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                    <YAxis tickFormatter={v => SAR(v)} tick={{ fontSize: 10, fill: "#6B7280" }} width={70} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="net" stroke="#3B82F6" strokeWidth={2} fill="url(#netGrad)" name="الصافي" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Table */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border/50 font-semibold text-foreground text-sm">تفصيل شهري</div>
                <div className="overflow-x-auto"><table className="w-full text-sm min-w-[380px]">
                  <thead className="bg-muted/30">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-right px-5 py-2">الشهر</th>
                      <th className="text-right py-2">الإيرادات</th>
                      <th className="text-right py-2">المصاريف</th>
                      <th className="text-right py-2">الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cf.cashflow.map((row: any) => (
                      <tr key={row.month} className="border-t border-border/20 hover:bg-muted/30">
                        <td className="px-5 py-2.5 font-medium text-foreground/70">{row.label}</td>
                        <td className="py-2.5 text-emerald-700 font-semibold">{SAR(row.revenue)}</td>
                        <td className="py-2.5 text-red-600">{SAR(row.expenses)}</td>
                        <td className={`py-2.5 font-bold ${row.net >= 0 ? "text-blue-700" : "text-red-600"}`}>
                          {row.net >= 0 ? "+" : ""}{SAR(row.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════ INVOICES ════════════ */}
      {tab === "invoices" && (
        <div className="space-y-5">
          {invoicesQ.isLoading && <div className="p-8 text-center text-muted-foreground text-sm">جارٍ التحميل…</div>}
          {invoicesQ.data && (() => {
            const d = invoicesQ.data;
            const byStatus: any[] = d.byStatus ?? [];
            const overdue: any[]  = d.overdueList ?? [];
            const monthly: any[]  = d.monthlyTrend ?? [];

            const statusLabel: Record<string, string> = {
              paid: "مدفوعة", pending: "معلقة", draft: "مسودة", cancelled: "ملغاة",
            };
            const statusColor: Record<string, string> = {
              paid: "#10B981", pending: "#F59E0B", draft: "#9CA3AF", cancelled: "#EF4444",
            };

            return (
              <>
                {/* Donut + Monthly */}
                <div className="grid md:grid-cols-2 gap-5">
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="font-semibold text-foreground mb-4">توزيع الفواتير</div>
                    {byStatus.length === 0
                      ? <div className="text-center text-muted-foreground text-sm py-6">لا توجد فواتير</div>
                      : <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={byStatus.map(r => ({ name: statusLabel[r.status] ?? r.status, value: Number(r.count), amount: Number(r.amount) }))}
                              dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                              {byStatus.map((r: any, i: number) => <Cell key={i} fill={statusColor[r.status] ?? PIE_COLORS[i]} />)}
                            </Pie>
                            <Tooltip formatter={(v: any, _: any, p: any) => [v + " فاتورة", p?.payload?.name]} />
                          </PieChart>
                        </ResponsiveContainer>
                    }
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5">
                    <div className="font-semibold text-foreground mb-4">الفواتير الشهرية</div>
                    {monthly.length === 0
                      ? <div className="text-center text-muted-foreground text-sm py-6">لا توجد بيانات</div>
                      : <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={monthly.map(r => ({ label: r.month, count: Number(r.count), amount: Number(r.amount) }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" tickFormatter={v => SAR(v)} tick={{ fontSize: 9 }} width={65} />
                            <Tooltip />
                            <Bar yAxisId="left"  dataKey="count"  fill="#3B82F6" name="عدد" radius={[3,3,0,0]} />
                            <Bar yAxisId="right" dataKey="amount" fill="#10B981" name="المبلغ" radius={[3,3,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                    }
                  </div>
                </div>

                {/* Overdue List */}
                {overdue.length > 0 && (
                  <div className="bg-card border border-red-500/30 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-red-100 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-semibold text-red-700 text-sm">فواتير تجاوزت تاريخ الاستحقاق ({overdue.length})</span>
                    </div>
                    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[380px]">
                      <thead className="bg-red-50">
                        <tr className="text-xs text-red-600">
                          <th className="text-right px-5 py-2">رقم الفاتورة</th>
                          <th className="text-right py-2">المبلغ</th>
                          <th className="text-right py-2">تاريخ الاستحقاق</th>
                          <th className="text-right py-2">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overdue.map((inv: any) => (
                          <tr key={inv.id} className="border-t border-red-50">
                            <td className="px-5 py-2.5 font-mono text-xs text-foreground/70">{inv.number ?? inv.id?.slice(0, 8)}</td>
                            <td className="py-2.5 font-semibold text-red-700">{SAR(inv.total / 100)}</td>
                            <td className="py-2.5 text-red-600">{inv.due_date}</td>
                            <td className="py-2.5">
                              <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{inv.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  </div>
                )}
                {overdue.length === 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" /> لا توجد فواتير متأخرة — ممتاز!
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ════════════ INSIGHTS ════════════ */}
      {tab === "insights" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-foreground">الرؤى المالية التلقائية</span>
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 me-2">Rules-Based Engine</span>
            </div>
            <div className="space-y-3">
              {insights.map((ins, i) => {
                const isWarn = ins.startsWith("⚠️") || ins.startsWith("🔴") || ins.startsWith("📉");
                const isGood = ins.startsWith("✅") || ins.startsWith("📈") || ins.startsWith("💡");
                return (
                  <div key={i} className={`flex items-start gap-3 p-4 rounded-xl border
                    ${isWarn ? "bg-amber-50 border-amber-200" : isGood ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"}`}>
                    <span className="text-xl shrink-0">{ins.slice(0, 2)}</span>
                    <div>
                      <p className={`text-sm font-medium ${isWarn ? "text-amber-800" : isGood ? "text-emerald-800" : "text-blue-800"}`}>
                        {ins.slice(2).trim()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial ratios */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="font-semibold text-foreground mb-4">المؤشرات المالية الرئيسية</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                {
                  label: "هامش الربح",
                  value: s.totalRevenue > 0 ? `${((s.netProfit / s.totalRevenue) * 100).toFixed(1)}%` : "—",
                  desc: "الأرباح كنسبة من الإيرادات",
                  good: s.netProfit > 0,
                },
                {
                  label: "معدل تحصيل الفواتير",
                  value: (iv.paid + iv.pending + iv.draft) > 0
                    ? `${((iv.paid / Math.max(iv.paid + iv.pending + iv.draft, 1)) * 100).toFixed(0)}%`
                    : "—",
                  desc: "الفواتير المدفوعة من الإجمالي",
                  good: iv.paid > iv.pending,
                },
                {
                  label: "رسوم الدفع الرقمي",
                  value: s.grossPayments > 0
                    ? `${(((s.platformFees ?? 0) / s.grossPayments) * 100).toFixed(1)}%`
                    : "—",
                  desc: "كنسبة من مدفوعات البوابة",
                  good: true,
                },
              ].map((r, i) => (
                <div key={i} className={`p-4 rounded-xl border ${r.good ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                  <div className="text-xs text-muted-foreground mb-1">{r.label}</div>
                  <div className={`text-2xl font-bold ${r.good ? "text-emerald-700" : "text-red-600"}`}>{r.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{r.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
