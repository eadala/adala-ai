/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; authFetch migration */
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, TrendingUp, TrendingDown, DollarSign, BarChart2,
  ArrowUpRight, ArrowDownRight, Printer, Users, Briefcase,
  AlertCircle, Bot, Send, Clock, FileText, Scale,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
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
  .text-muted-foreground { color: #555 !important; }
}
`;

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م ر.س";
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "ك ر.س";
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س";
}
function fmtFull(n: number) {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 2 }) + " ر.س";
}
function num(v: any) { return parseFloat(String(v ?? "0")) || 0; }

const COLORS = ["#2563EB","#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#F97316"];
const CHART_COLORS = { revenue: "#10B981", expenses: "#EF4444", profit: "#2563EB" };

function KPICard({ title, value, sub, icon: Icon, color, trend }: any) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: color + "22" }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          {trend !== undefined && (
            <Badge variant="outline" className={trend >= 0 ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}>
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3 ms-0.5" /> : <ArrowDownRight className="h-3 w-3 ms-0.5" />}
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

/* ── Tab 1: الملخص الرئيسي ── */
function SummaryTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["accounting-summary"],
    queryFn: () => authFetch(`${BASE}/api/accounting/reports/summary`).then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const { data: unified } = useQuery<any>({
    queryKey: ["accounting-unified-summary"],
    queryFn: () => authFetch(`${BASE}/api/accounting/unified-summary`).then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin me-2" /> جارٍ التحميل...</div>;

  const d = data ?? {};
  const u = unified ?? {};
  const monthly  = u.monthlyChart ?? d.monthly ?? [];
  const expCats  = d.expenseCategories ?? [];
  const revCats  = d.revenueCategories ?? [];
  const kpi      = u.kpi ?? {};
  const invStats = u.invoices ?? {};

  const hasChart = monthly.some((m: any) => m.revenue > 0 || m.expenses > 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="إجمالي الإيرادات" value={fmt(kpi.revenue ?? d.totalRevenue ?? 0)} icon={TrendingUp} color="#10B981"
          sub={`مُفوتَر: ${fmt(invStats.invoicedTotal ?? 0)} · محصَّل: ${fmt(invStats.collectedTotal ?? 0)}`} />
        <KPICard title="إجمالي المصاريف" value={fmt(kpi.expenses ?? d.totalExpenses ?? 0)} icon={TrendingDown} color="#EF4444"
          sub={`رواتب: ${fmt(kpi.payroll ?? d.expenseBreakdown?.payroll ?? 0)}`} />
        <KPICard title="صافي الربح" value={fmt(kpi.netProfit ?? d.netProfit ?? 0)} icon={DollarSign}
          color={(kpi.netProfit ?? d.netProfit ?? 0) >= 0 ? "#2563EB" : "#EF4444"}
          sub={(kpi.netProfit ?? d.netProfit ?? 0) >= 0 ? "✓ المكتب رابح" : "⚠ خسارة صافية"} />
        <KPICard title="الذمم المدينة" value={fmt(kpi.accountsReceivable ?? d.outstandingAdvances ?? 0)} icon={BarChart2} color="#8B5CF6"
          sub={`متأخرة: ${invStats.overdueCount ?? 0} فاتورة`} />
      </div>

      {/* Monthly Bar Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">الإيرادات والمصاريف الشهرية</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasChart ? (
            <div className="flex flex-col items-center py-10 text-muted-foreground">
              <BarChart2 className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">لا توجد بيانات — أضف إيرادات ومصاريف لعرض الرسم البياني</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthly} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
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
        {[
          { title: "توزيع الإيرادات حسب الفئة", cats: revCats },
          { title: "توزيع المصاريف حسب الفئة",  cats: expCats },
        ].map(({ title, cats }) => (
          <Card key={title} className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-foreground">{title}</CardTitle></CardHeader>
            <CardContent>
              {cats.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">لا توجد بيانات</div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={130} height={130}>
                    <PieChart>
                      <Pie data={cats} dataKey="value" cx="50%" cy="50%" outerRadius={58} innerRadius={28}>
                        {cats.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {cats.slice(0, 5).map((cat: any, i: number) => (
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
        ))}
      </div>

      {/* Monthly Summary Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm text-foreground">الملخص الشهري التفصيلي</CardTitle></CardHeader>
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
                  <tr key={m.label ?? m.month} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-2.5 text-foreground">{m.label ?? m.month}</td>
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

/* ── Tab 2: حسب القضية والعميل ── */
function LegalLinkTab() {
  const [view, setView] = useState<"case"|"client"|"lawyer">("client");

  const { data: byClient, isLoading: lcLoad } = useQuery<any[]>({
    queryKey: ["reports-by-client"],
    queryFn: () => authFetch(`${BASE}/api/accounting/reports/by-client`).then(r => r.json()),
    staleTime: 5 * 60_000,
  });
  const { data: byCase, isLoading: csLoad } = useQuery<any>({
    queryKey: ["reports-by-case"],
    queryFn: () => authFetch(`${BASE}/api/accounting/reports/by-case`).then(r => r.json()),
    staleTime: 5 * 60_000,
  });
  const { data: byLawyer, isLoading: lwLoad } = useQuery<any[]>({
    queryKey: ["reports-by-lawyer"],
    queryFn: () => authFetch(`${BASE}/api/accounting/reports/by-lawyer`).then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  const isLoading = lcLoad || csLoad || lwLoad;
  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin me-2" /> جارٍ التحميل...</div>;

  const clients = byClient ?? [];
  const cases   = (byCase?.revenues ?? []);
  const lawyers = byLawyer ?? [];

  const views = [
    { key: "client", label: "حسب العميل",  icon: Users },
    { key: "case",   label: "حسب القضية",  icon: Scale },
    { key: "lawyer", label: "حسب المحامي", icon: Briefcase },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {views.map(v => (
          <Button key={v.key} size="sm" variant={view === v.key ? "default" : "outline"}
            onClick={() => setView(v.key)} className="gap-1.5">
            <v.icon className="h-3.5 w-3.5" />{v.label}
          </Button>
        ))}
      </div>

      {view === "client" && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">الإيرادات حسب العميل</CardTitle></CardHeader>
          <CardContent className="p-0">
            {clients.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد بيانات مرتبطة بعملاء</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-right">
                      <th className="px-4 py-2.5 font-medium">العميل</th>
                      <th className="px-4 py-2.5 font-medium">الفواتير</th>
                      <th className="px-4 py-2.5 font-medium text-green-400">إجمالي الفواتير</th>
                      <th className="px-4 py-2.5 font-medium text-primary">المحصَّل</th>
                      <th className="px-4 py-2.5 font-medium text-amber-400">المعلق</th>
                      <th className="px-4 py-2.5 font-medium">متأخرة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c: any, i: number) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-foreground font-medium">{c.client_name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.invoices_count}</td>
                        <td className="px-4 py-2.5 text-green-400">{fmtFull(num(c.grand_total))}</td>
                        <td className="px-4 py-2.5 text-primary font-bold">{fmtFull(num(c.paid_total))}</td>
                        <td className="px-4 py-2.5 text-amber-400">{fmtFull(num(c.outstanding))}</td>
                        <td className="px-4 py-2.5">
                          {Number(c.overdue_count) > 0 ? (
                            <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">{c.overdue_count} فاتورة</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">منتظم</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === "case" && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">الإيرادات حسب القضية</CardTitle></CardHeader>
          <CardContent className="p-0">
            {cases.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد إيرادات مرتبطة بقضايا</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-right">
                      <th className="px-4 py-2.5 font-medium">القضية</th>
                      <th className="px-4 py-2.5 font-medium">رقم القضية</th>
                      <th className="px-4 py-2.5 font-medium">عدد القيود</th>
                      <th className="px-4 py-2.5 font-medium text-green-400">إجمالي الإيرادات</th>
                      <th className="px-4 py-2.5 font-medium">الفئات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map((c: any, i: number) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-foreground font-medium">{c.case_title ?? "بدون عنوان"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{c.case_number ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.entries_count}</td>
                        <td className="px-4 py-2.5 text-green-400 font-bold">{fmtFull(num(c.total_revenue))}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(c.categories ?? []).slice(0, 2).map((cat: string, j: number) => (
                              <Badge key={j} variant="outline" className="text-[10px]">{cat}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {view === "lawyer" && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm">الإيرادات حسب المحامي</CardTitle></CardHeader>
          <CardContent className="p-0">
            {lawyers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">لا توجد بيانات مرتبطة بمحامين</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-right">
                      <th className="px-4 py-2.5 font-medium">المحامي</th>
                      <th className="px-4 py-2.5 font-medium">القضايا</th>
                      <th className="px-4 py-2.5 font-medium">الفواتير</th>
                      <th className="px-4 py-2.5 font-medium text-green-400">إجمالي المُفوتَر</th>
                      <th className="px-4 py-2.5 font-medium text-primary">المحصَّل</th>
                      <th className="px-4 py-2.5 font-medium text-amber-400">المعلق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lawyers.map((l: any, i: number) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-foreground font-medium">{l.lawyer_name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{l.cases_count}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{l.invoices_count}</td>
                        <td className="px-4 py-2.5 text-green-400">{fmtFull(num(l.invoiced_total))}</td>
                        <td className="px-4 py-2.5 text-primary font-bold">{fmtFull(num(l.collected_total))}</td>
                        <td className="px-4 py-2.5 text-amber-400">{fmtFull(num(l.outstanding))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Tab 3: الذمم المدينة (AR Aging) ── */
function ARAgingTab() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["ar-aging"],
    queryFn: () => authFetch(`${BASE}/api/accounting/reports/ar-aging`).then(r => r.json()),
    staleTime: 3 * 60_000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin me-2" /> جارٍ التحميل...</div>;

  const summary = data?.summary ?? {};
  const details = data?.details ?? {};

  const buckets = [
    { key: "current",   label: "حالية (لم تستحق)",   color: "#10B981", stats: summary.current },
    { key: "days30",    label: "1–30 يوم متأخرة",     color: "#F59E0B", stats: summary.days1_30 },
    { key: "days60",    label: "31–60 يوم متأخرة",    color: "#F97316", stats: summary.days31_60 },
    { key: "days90",    label: "61–90 يوم متأخرة",    color: "#EF4444", stats: summary.days61_90 },
    { key: "over90",    label: "+90 يوم متأخرة",      color: "#7F1D1D", stats: summary.over90 },
  ] as const;

  const totalAR = num(summary.grandTotal);

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {buckets.map(b => (
          <Card key={b.key}
            className={`bg-card border-border cursor-pointer transition-all ${expanded === b.key ? "ring-1 ring-primary" : "hover:border-primary/40"}`}
            onClick={() => setExpanded(expanded === b.key ? null : b.key)}>
            <CardContent className="p-4">
              <div className="w-2.5 h-2.5 rounded-full mb-2" style={{ backgroundColor: b.color }} />
              <p className="text-[11px] text-muted-foreground mb-1">{b.label}</p>
              <p className="text-lg font-bold text-foreground">{fmt(b.stats?.total ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{b.stats?.count ?? 0} فاتورة</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grand total */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-bold text-foreground">إجمالي الذمم المدينة</p>
              <p className="text-xs text-muted-foreground">المبالغ غير المحصَّلة من جميع العملاء</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-primary">{fmtFull(totalAR)}</p>
        </CardContent>
      </Card>

      {/* Expanded details */}
      {expanded && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {buckets.find(b => b.key === expanded)?.label} — التفاصيل
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(details[expanded as keyof typeof details] ?? []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">لا توجد فواتير في هذه الفئة</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-right">
                      <th className="px-4 py-2.5 font-medium">رقم الفاتورة</th>
                      <th className="px-4 py-2.5 font-medium">العميل</th>
                      <th className="px-4 py-2.5 font-medium">القضية</th>
                      <th className="px-4 py-2.5 font-medium">تاريخ الاستحقاق</th>
                      <th className="px-4 py-2.5 font-medium">أيام التأخر</th>
                      <th className="px-4 py-2.5 font-medium text-amber-400">المبلغ المعلق</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(details[expanded as keyof typeof details] as any[]).map((inv: any) => (
                      <tr key={inv.id} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{inv.invoice_number ?? "—"}</td>
                        <td className="px-4 py-2.5 text-foreground font-medium">{inv.client_name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{inv.case_title ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{inv.due_date ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {Number(inv.days_overdue) > 0 ? (
                            <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400">
                              {inv.days_overdue} يوم
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">حالية</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-amber-400 font-bold">{fmtFull(num(inv.outstanding))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Tab 4: مقارنة الفترات ── */
function PeriodComparisonTab() {
  const [period, setPeriod] = useState<"month"|"quarter"|"year">("month");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["period-comparison", period],
    queryFn: () => authFetch(`${BASE}/api/accounting/reports/period-comparison?period=${period}`).then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin me-2" /> جارٍ التحميل...</div>;

  const curr = data?.current ?? {};
  const prev = data?.previous ?? {};
  const growth = data?.growth ?? {};

  const periodLabel: Record<string, { curr: string; prev: string }> = {
    month:   { curr: "الشهر الحالي",    prev: "الشهر الماضي" },
    quarter: { curr: "الربع الحالي",    prev: "الربع الماضي" },
    year:    { curr: "السنة الحالية",   prev: "السنة الماضية" },
  };
  const labels = periodLabel[period];

  const rows = [
    { label: "الإيرادات",         curr: curr.revenue,   prev: prev.revenue,   growth: growth.revenue,   color: "#10B981" },
    { label: "المصاريف",          curr: curr.expenses,  prev: prev.expenses,  growth: growth.expenses,  color: "#EF4444" },
    { label: "صافي الربح",        curr: curr.profit,    prev: prev.profit,    growth: growth.profit,    color: "#2563EB" },
    { label: "إجمالي الفواتير",   curr: curr.invoiced,  prev: prev.invoiced,  growth: growth.invoiced,  color: "#8B5CF6" },
    { label: "المبالغ المحصَّلة", curr: curr.collected, prev: prev.collected, growth: growth.collected, color: "#06B6D4" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["month","quarter","year"] as const).map(p => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"}
            onClick={() => setPeriod(p)}>
            {{ month: "شهري", quarter: "ربع سنوي", year: "سنوي" }[p]}
          </Button>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-right">
                  <th className="px-4 py-3 font-medium">البند</th>
                  <th className="px-4 py-3 font-medium text-primary">{labels.curr}</th>
                  <th className="px-4 py-3 font-medium">{labels.prev}</th>
                  <th className="px-4 py-3 font-medium">التغيير</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                        <span className="text-foreground font-medium">{r.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-primary font-bold">{fmtFull(num(r.curr))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtFull(num(r.prev))}</td>
                    <td className="px-4 py-3">
                      {r.growth !== undefined && (
                        <Badge variant="outline" className={
                          (r.label === "المصاريف" ? r.growth <= 0 : r.growth >= 0)
                            ? "border-green-500/30 text-green-400"
                            : "border-red-500/30 text-red-400"
                        }>
                          {r.growth >= 0 ? <ArrowUpRight className="h-3 w-3 inline" /> : <ArrowDownRight className="h-3 w-3 inline" />}
                          {Math.abs(r.growth ?? 0).toFixed(1)}%
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bar chart comparison */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">مقارنة بيانية</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { name: labels.prev, revenue: num(prev.revenue), expenses: num(prev.expenses), profit: num(prev.profit) },
              { name: labels.curr, revenue: num(curr.revenue), expenses: num(curr.expenses), profit: num(curr.profit) },
            ]} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? (v/1000)+"ك" : String(v)} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="revenue"  name="الإيرادات" fill={CHART_COLORS.revenue}  radius={[4,4,0,0]} maxBarSize={50} />
              <Bar dataKey="expenses" name="المصاريف"  fill={CHART_COLORS.expenses} radius={[4,4,0,0]} maxBarSize={50} />
              <Bar dataKey="profit"   name="الربح"     fill={CHART_COLORS.profit}   radius={[4,4,0,0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Tab 5: مساعد AI المالي ── */
function AIAssistantTab() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string; snap?: any }[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: (q: string) =>
      authFetch(`${BASE}/api/accounting/ai-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      }).then(r => r.json()),
    onSuccess: (data, vars) => {
      setHistory(h => [...h, { q: vars, a: data.answer ?? "لا توجد إجابة", snap: data.dataSnapshot }]);
      setQuestion("");
      setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }), 100);
    },
  });

  const suggested = [
    "ما وضع التدفق النقدي هذا الشهر؟",
    "أي العملاء لديهم فواتير متأخرة تحتاج متابعة؟",
    "ما القضايا الأكثر ربحية هذه السنة؟",
    "كيف يمكن تحسين معدل التحصيل؟",
  ];

  return (
    <div className="space-y-4">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Bot className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">المساعد المالي الذكي</p>
            <p className="text-xs text-muted-foreground">
              يحلل بياناتك المالية ويجيب على أسئلتك بالعربية. <strong>للقراءة فقط — لا يُعدِّل أي بيانات.</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Chat history */}
      <div ref={chatRef} className="space-y-3 max-h-[380px] overflow-y-auto">
        {history.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">اطرح سؤالاً عن وضعك المالي</p>
          </div>
        )}
        {history.map((h, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-start">
              <div className="bg-primary/10 text-primary rounded-lg px-4 py-2.5 text-sm max-w-[85%]">{h.q}</div>
            </div>
            <div className="flex justify-end">
              <div className="bg-card border border-border rounded-lg px-4 py-3 text-sm max-w-[90%] text-foreground leading-relaxed whitespace-pre-wrap">
                {h.a}
              </div>
            </div>
          </div>
        ))}
        {isPending && (
          <div className="flex justify-end">
            <div className="bg-card border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline me-2" />جارٍ التحليل...
            </div>
          </div>
        )}
      </div>

      {/* Suggested questions */}
      {history.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggested.map((s, i) => (
            <button key={i} onClick={() => { setQuestion(s); }}
              className="text-right text-xs bg-card border border-border rounded-lg p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors text-muted-foreground">
              <Clock className="h-3.5 w-3.5 inline me-1.5 text-primary" />{s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && question.trim()) { e.preventDefault(); mutate(question.trim()); } }}
          placeholder="اسأل عن الوضع المالي، الفواتير المتأخرة، ربحية القضايا..."
          className="flex-1 text-sm resize-none min-h-[60px]"
          rows={2}
        />
        <Button onClick={() => question.trim() && mutate(question.trim())} disabled={isPending || !question.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function FinancialReports() {
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
            <p className="text-xs text-muted-foreground">تحليل مالي شامل · مناسب لمكاتب المحاماة</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 print:hidden">
          <Printer className="h-4 w-4" /> طباعة / PDF
        </Button>
      </div>

      <Tabs defaultValue="summary" dir="rtl">
        <TabsList className="w-full sm:w-auto grid grid-cols-5 sm:flex sm:flex-wrap gap-0.5 print:hidden">
          <TabsTrigger value="summary"     className="gap-1.5 text-xs sm:text-sm"><BarChart2 className="h-3.5 w-3.5" />الملخص</TabsTrigger>
          <TabsTrigger value="legal"       className="gap-1.5 text-xs sm:text-sm"><Scale className="h-3.5 w-3.5" />القانوني</TabsTrigger>
          <TabsTrigger value="ar-aging"    className="gap-1.5 text-xs sm:text-sm"><AlertCircle className="h-3.5 w-3.5" />الذمم</TabsTrigger>
          <TabsTrigger value="comparison"  className="gap-1.5 text-xs sm:text-sm"><FileText className="h-3.5 w-3.5" />المقارنة</TabsTrigger>
          <TabsTrigger value="ai"          className="gap-1.5 text-xs sm:text-sm"><Bot className="h-3.5 w-3.5" />مساعد AI</TabsTrigger>
        </TabsList>

        <TabsContent value="summary"   className="mt-4"><SummaryTab /></TabsContent>
        <TabsContent value="legal"     className="mt-4"><LegalLinkTab /></TabsContent>
        <TabsContent value="ar-aging"  className="mt-4"><ARAgingTab /></TabsContent>
        <TabsContent value="comparison"className="mt-4"><PeriodComparisonTab /></TabsContent>
        <TabsContent value="ai"        className="mt-4"><AIAssistantTab /></TabsContent>
      </Tabs>
    </div>
  );
}
