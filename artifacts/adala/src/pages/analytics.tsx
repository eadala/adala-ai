import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Scale, FileText, Users, DollarSign,
  Clock, Award, Target, BarChart3, Printer, RefreshCw,
  CheckCircle2, AlertCircle, Building2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

const COLORS = ["#C9A84C", "#6366F1", "#10B981", "#3B82F6", "#EC4899", "#F59E0B", "#8B5CF6", "#06B6D4"];

type Period = "30d" | "3m" | "6m" | "1y";
const PERIODS: { label: string; value: Period }[] = [
  { label: "آخر 30 يوم", value: "30d" },
  { label: "3 أشهر",     value: "3m"  },
  { label: "6 أشهر",     value: "6m"  },
  { label: "سنة كاملة",  value: "1y"  },
];

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "م";
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + "ك";
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}

/* ── Custom Tooltip ─────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A2744] border border-[#2D3D6B] rounded-xl p-3 text-xs shadow-2xl min-w-[130px]">
      <p className="font-bold text-primary mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">
            {typeof p.value === "number" && p.value > 999
              ? p.value.toLocaleString("ar-SA")
              : p.value}
            {p.name === "نسبة" ? "%" : ""}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── KPI Card ───────────────────────────────────────────── */
function KPICard({ icon: Icon, label, value, sub, color, trend, trendUp }: {
  icon: any; label: string; value: string | number; sub?: string;
  color: string; trend?: string; trendUp?: boolean;
}) {
  return (
    <Card className="border-0 bg-card/60 hover:bg-card transition-all duration-200 group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
               style={{ background: `${color}18` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          {trend && (
            <Badge variant="outline"
              className={`text-[10px] gap-0.5 ${trendUp !== false ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/8" : "text-red-400 border-red-400/30 bg-red-400/8"}`}>
              {trendUp !== false ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
              {trend}
            </Badge>
          )}
        </div>
        <div className="text-2xl font-black mb-0.5 tracking-tight" style={{ color }}>{value}</div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/* ── Section Header ─────────────────────────────────────── */
function SectionTitle({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span>{title}</span>
        {sub && <span className="text-xs text-muted-foreground font-normal">— {sub}</span>}
      </CardTitle>
    </CardHeader>
  );
}

/* ── Pie legend ─────────────────────────────────────────── */
function PieLegend({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex-1 space-y-2">
      {data.map((item, i) => (
        <div key={item.name} className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-muted-foreground truncate">{item.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-bold">{item.value}</span>
            {total > 0 && <span className="text-muted-foreground/60">({Math.round((item.value / total) * 100)}%)</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function Analytics() {
  const [period, setPeriod] = useState<Period>("1y");

  const qOpts = (key: string[]) => ({
    queryKey: [...key, period],
    queryFn: () => fetch(`${BASE}/api/analytics/${key[0]}?period=${period}`).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: financial = {}, isFetching: fLoading } = useQuery<any>(qOpts(["financial"]));
  const { data: cases = {},    isFetching: cLoading } = useQuery<any>(qOpts(["cases"]));
  const { data: team = {},     isFetching: tLoading } = useQuery<any>(qOpts(["team"]));
  const { data: clients = {},  isFetching: clLoading } = useQuery<any>(qOpts(["clients"]));

  const isLoading = fLoading || cLoading || tLoading || clLoading;

  const printReport = useCallback(() => {
    const fin = financial as any;
    const cas = cases as any;
    const cl = clients as any;
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>تقرير التحليلات — عدالة AI</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:18mm 20mm}
body{font-family:'Cairo',Arial,sans-serif;color:#1a1a2e;background:#fff;font-size:11pt}
.cover{background:linear-gradient(135deg,#0f1c35,#1A2744);color:#fff;padding:32px;margin-bottom:24px;border-radius:8px}
.cover h1{font-size:22pt;font-weight:900;color:#C9A84C;margin-bottom:4px}
.cover p{color:rgba(255,255,255,0.6);font-size:9pt}
.section{margin-bottom:20px;padding:16px;border:1px solid #e8e8e8;border-radius:8px}
.section h2{font-size:11pt;font-weight:700;color:#1A2744;border-bottom:2px solid #C9A84C;padding-bottom:6px;margin-bottom:12px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.kpi{background:#f8f9fa;border-radius:6px;padding:10px;text-align:center}
.kpi .val{font-size:15pt;font-weight:900;color:#C9A84C}
.kpi .lbl{font-size:8pt;color:#666;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:9pt}
th{background:#1A2744;color:#C9A84C;padding:8px;text-align:right}
td{padding:7px 8px;border-bottom:1px solid #eee}
tr:nth-child(even) td{background:#fafafa}
.footer{text-align:center;color:#aaa;font-size:8pt;margin-top:20px;border-top:1px solid #eee;padding-top:10px}
</style>
</head>
<body>
<div class="cover">
  <h1>تقرير تحليلات الأداء</h1>
  <p>عدالة AI · منصة إدارة المكاتب القانونية · ${new Date().toLocaleDateString("ar-SA")} · الفترة: ${PERIODS.find(p => p.value === period)?.label}</p>
</div>
<div class="kpi-grid">
  <div class="kpi"><div class="val">${fmt(fin.totalRevenue ?? 0)}</div><div class="lbl">إجمالي الإيرادات</div></div>
  <div class="kpi"><div class="val">${fmt(fin.netProfit ?? 0)}</div><div class="lbl">صافي الربح</div></div>
  <div class="kpi"><div class="val">${(fin.profitMargin ?? 0).toFixed(1)}%</div><div class="lbl">هامش الربح</div></div>
  <div class="kpi"><div class="val">${(fin.collectionRate ?? 0).toFixed(0)}%</div><div class="lbl">معدل التحصيل</div></div>
</div>
<div class="section">
  <h2>📊 ملخص القضايا</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="val">${cas.total ?? 0}</div><div class="lbl">إجمالي القضايا</div></div>
    <div class="kpi"><div class="val">${cas.successRate ?? 0}%</div><div class="lbl">معدل النجاح</div></div>
    <div class="kpi"><div class="val">${cas.avgDays ?? 0}</div><div class="lbl">متوسط الأيام</div></div>
    <div class="kpi"><div class="val">${cas.inProgress ?? 0}</div><div class="lbl">قيد النظر</div></div>
  </div>
  <table>
    <thead><tr><th>نوع القضية</th><th>العدد</th></tr></thead>
    <tbody>${(cas.byType ?? []).map((r: any) => `<tr><td>${r.name}</td><td>${r.value}</td></tr>`).join("")}</tbody>
  </table>
</div>
<div class="section">
  <h2>👥 أبرز العملاء</h2>
  <table>
    <thead><tr><th>اسم العميل</th><th>عدد القضايا</th><th>الإيرادات (ر.س)</th></tr></thead>
    <tbody>${(cl.topClients ?? []).map((r: any) => `<tr><td>${r.name}</td><td>${r.قضايا}</td><td>${r.إيرادات.toLocaleString()}</td></tr>`).join("")}</tbody>
  </table>
</div>
<div class="footer">عدالة AI · تقرير مُولَّد تلقائياً · ${new Date().toLocaleString("ar-SA")}</div>
<script>setTimeout(()=>window.print(),500)</script>
</body>
</html>`;
    const win = window.open("", "_blank", "width=900,height=1100");
    if (win) { win.document.write(html); win.document.close(); }
  }, [financial, cases, clients, period]);

  const fin = financial as any;
  const cas = cases as any;
  const tm = team as any;
  const cl = clients as any;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> تحليلات الأداء
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">مؤشرات أداء المكتب القانوني في الزمن الفعلي</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period filter */}
          <div className="flex bg-muted/40 rounded-xl p-1 gap-1">
            {PERIODS.map(p => (
              <button key={p.value}
                onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  period === p.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={printReport} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" /> PDF
          </Button>
          {isLoading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={DollarSign}  label="إجمالي الإيرادات"   color="#10B981"
          value={`${fmt(fin.totalRevenue ?? 0)} ر.س`}
          sub={`مصاريف: ${fmt(fin.totalExpenses ?? 0)} ر.س`} trend="مالية" />
        <KPICard icon={TrendingUp}  label="صافي الربح"          color="#C9A84C"
          value={`${fmt(fin.netProfit ?? 0)} ر.س`}
          sub={`هامش: ${(fin.profitMargin ?? 0).toFixed(1)}%`}
          trendUp={(fin.netProfit ?? 0) >= 0} trend={(fin.netProfit ?? 0) >= 0 ? "رابح" : "خاسر"} />
        <KPICard icon={Scale}       label="إجمالي القضايا"      color="#6366F1"
          value={cas.total ?? 0}
          sub={`نجاح: ${cas.successRate ?? 0}% · قيد: ${cas.inProgress ?? 0}`} />
        <KPICard icon={Award}       label="معدل تحصيل الفواتير" color="#F59E0B"
          value={`${(fin.collectionRate ?? 0).toFixed(0)}%`}
          sub={`${fin.paidInvoices ?? 0} مدفوعة من ${fin.totalInvoices ?? 0}`} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="financial">
        <TabsList className="w-full md:w-auto bg-muted/40 p-1">
          <TabsTrigger value="financial" className="gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5" /> الأداء المالي
          </TabsTrigger>
          <TabsTrigger value="cases" className="gap-1.5 text-xs">
            <Scale className="h-3.5 w-3.5" /> القضايا
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> الفريق
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" /> العملاء
          </TabsTrigger>
        </TabsList>

        {/* ── FINANCIAL TAB ────────────────────────────────── */}
        <TabsContent value="financial" className="mt-4 space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "الإيرادات", value: `${fmt(fin.totalRevenue ?? 0)} ر.س`, color: "#10B981", icon: TrendingUp },
              { label: "المصروفات", value: `${fmt(fin.totalExpenses ?? 0)} ر.س`, color: "#EF4444", icon: TrendingDown },
              { label: "صافي الربح", value: `${fmt(fin.netProfit ?? 0)} ر.س`, color: "#C9A84C", icon: DollarSign },
            ].map(s => (
              <div key={s.label} className="text-center p-3 bg-muted/30 rounded-xl border border-border/40">
                <s.icon className="h-4 w-4 mx-auto mb-1" style={{ color: s.color }} />
                <div className="text-base font-black" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Revenue + Expenses area chart */}
          <Card>
            <SectionTitle icon={TrendingUp} title="الإيرادات والمصروفات الشهرية" />
            <CardContent>
              {(fin.monthly ?? []).length === 0 ? (
                <EmptyState msg="لا توجد بيانات مالية بعد — أضف إيرادات ومصاريف" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={fin.monthly}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#C9A84C" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D3D6B" />
                    <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#A0ADB8", fontSize: 10 }}
                      tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="revenue"  name="الإيرادات"  stroke="#10B981" fill="url(#gRev)" strokeWidth={2.5} dot={{ fill: "#10B981", r: 3 }} />
                    <Area type="monotone" dataKey="expenses" name="المصروفات"  stroke="#EF4444" fill="url(#gExp)" strokeWidth={2.5} dot={{ fill: "#EF4444", r: 3 }} />
                    <Area type="monotone" dataKey="profit"   name="صافي الربح" stroke="#C9A84C" fill="url(#gPro)" strokeWidth={2} dot={{ fill: "#C9A84C", r: 3 }} strokeDasharray="4 2" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Category breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <SectionTitle icon={TrendingUp} title="توزيع الإيرادات" />
              <CardContent>
                {!(fin.revCategories ?? []).length ? <EmptyState msg="لا بيانات" /> : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="45%" height={180}>
                      <PieChart>
                        <Pie data={fin.revCategories} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                          {(fin.revCategories ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <PieLegend data={fin.revCategories ?? []} />
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <SectionTitle icon={TrendingDown} title="توزيع المصروفات" />
              <CardContent>
                {!(fin.expCategories ?? []).length ? <EmptyState msg="لا بيانات" /> : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="45%" height={180}>
                      <PieChart>
                        <Pie data={fin.expCategories} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={3}>
                          {(fin.expCategories ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <PieLegend data={fin.expCategories ?? []} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Invoice KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "فواتير مدفوعة",   value: fin.paidInvoices ?? 0,        color: "#10B981", icon: CheckCircle2 },
              { label: "إجمالي الفواتير", value: fin.totalInvoices ?? 0,       color: "#6366F1", icon: FileText },
              { label: "معدل التحصيل",    value: `${(fin.collectionRate ?? 0).toFixed(0)}%`, color: "#C9A84C", icon: Target },
              { label: "هامش الربح",      value: `${(fin.profitMargin ?? 0).toFixed(1)}%`,  color: "#F59E0B", icon: Award },
            ].map(k => (
              <Card key={k.label} className="border-0 bg-muted/30">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}18` }}>
                    <k.icon className="h-4 w-4" style={{ color: k.color }} />
                  </div>
                  <div>
                    <div className="text-sm font-black" style={{ color: k.color }}>{k.value}</div>
                    <div className="text-[10px] text-muted-foreground">{k.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── CASES TAB ───────────────────────────────────── */}
        <TabsContent value="cases" className="mt-4 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Scale}        label="إجمالي القضايا"   color="#6366F1"  value={cas.total ?? 0} />
            <KPICard icon={Award}        label="معدل النجاح"       color="#10B981"  value={`${cas.successRate ?? 0}%`} />
            <KPICard icon={Clock}        label="متوسط مدة القضية"  color="#F59E0B"  value={`${cas.avgDays ?? 0} يوم`} />
            <KPICard icon={AlertCircle}  label="قيد النظر"         color="#EC4899"  value={cas.inProgress ?? 0} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly trend */}
            <Card>
              <SectionTitle icon={BarChart3} title="المستجدات الشهرية" />
              <CardContent>
                {!(cas.monthly ?? []).some((m: any) => m.total > 0) ? <EmptyState msg="لا توجد قضايا في هذه الفترة" /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={cas.monthly} barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D3D6B" />
                      <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#A0ADB8", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="total"  name="الإجمالي" fill="#6366F1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="closed" name="مغلقة"    fill="#10B981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="open"   name="مفتوحة"   fill="#C9A84C" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* By type */}
            <Card>
              <SectionTitle icon={Scale} title="توزيع القضايا حسب النوع" />
              <CardContent>
                {!(cas.byType ?? []).length ? <EmptyState msg="لا بيانات" /> : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie data={cas.byType} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                          {(cas.byType ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <PieLegend data={cas.byType ?? []} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* By status */}
          <Card>
            <SectionTitle icon={CheckCircle2} title="توزيع القضايا حسب الحالة" />
            <CardContent>
              {!(cas.byStatus ?? []).length ? <EmptyState msg="لا بيانات" /> : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(cas.byStatus ?? []).map((s: any, i: number) => (
                    <div key={s.name} className="p-3 rounded-xl border border-border/40 text-center">
                      <div className="text-xl font-black mb-1" style={{ color: COLORS[i % COLORS.length] }}>{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TEAM TAB ─────────────────────────────────────── */}
        <TabsContent value="team" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Users}  label="إجمالي الفريق"     color="#6366F1" value={tm.teamTotal ?? 0} />
            <KPICard icon={Users}  label="الموظفون النشطون"  color="#10B981" value={tm.teamActive ?? 0} />
            <KPICard icon={Scale}  label="قضايا مُسنَدة"     color="#C9A84C"
              value={(tm.casesByMember ?? []).reduce((s: number, r: any) => s + (r.قضايا ?? 0), 0)} />
            <KPICard icon={Award}  label="أفضل معدل نجاح"    color="#F59E0B"
              value={`${Math.max(...(tm.casesByMember ?? [{ نسبة: 0 }]).map((r: any) => r.نسبة ?? 0))}%`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cases by member */}
            <Card>
              <SectionTitle icon={BarChart3} title="القضايا حسب المسؤول" />
              <CardContent>
                {!(tm.casesByMember ?? []).length ? <EmptyState msg="لا توجد قضايا مُسنَدة" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={tm.casesByMember} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D3D6B" horizontal={false} />
                      <XAxis type="number" tick={{ fill: "#A0ADB8", fontSize: 9 }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" tick={{ fill: "#A0ADB8", fontSize: 9 }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="قضايا" fill="#6366F1" radius={[0, 3, 3, 0]} />
                      <Bar dataKey="مغلقة" fill="#10B981" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Revenue by member */}
            <Card>
              <SectionTitle icon={DollarSign} title="الإيرادات المُحقَّقة حسب المحامي" />
              <CardContent>
                {!(tm.revenueByMember ?? []).length ? <EmptyState msg="لا توجد فواتير مدفوعة مرتبطة" /> : (
                  <div className="space-y-3">
                    {(tm.revenueByMember ?? []).map((r: any, i: number) => {
                      const max = Math.max(...(tm.revenueByMember ?? []).map((x: any) => x.إيرادات ?? 0));
                      const pct = max > 0 ? Math.round((r.إيرادات / max) * 100) : 0;
                      return (
                        <div key={r.name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{r.name}</span>
                            <span className="font-black" style={{ color: COLORS[i % COLORS.length] }}>
                              {r.إيرادات.toLocaleString("ar-SA")} ر.س
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Employees table */}
          {(tm.employees ?? []).length > 0 && (
            <Card>
              <SectionTitle icon={Users} title="قائمة الفريق" />
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-right">
                        <th className="px-4 py-2 font-semibold">الاسم</th>
                        <th className="px-4 py-2 font-semibold">المسمى الوظيفي</th>
                        <th className="px-4 py-2 font-semibold">القسم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tm.employees ?? []).map((e: any, i: number) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium">{e.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{e.title ?? "—"}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{e.dept ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── CLIENTS TAB ──────────────────────────────────── */}
        <TabsContent value="clients" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Users}     label="إجمالي العملاء"   color="#6366F1" value={cl.totalClients ?? 0} />
            <KPICard icon={CheckCircle2} label="عملاء نشطون"   color="#10B981" value={cl.activeClients ?? 0} />
            <KPICard icon={ArrowUpRight} label="جدد في الفترة" color="#C9A84C" value={cl.newInPeriod ?? 0} />
            <KPICard icon={Building2} label="الشركات"          color="#8B5CF6"
              value={(cl.byType ?? []).find((t: any) => t.name === "شركات")?.value ?? 0} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* New clients monthly */}
            <Card>
              <SectionTitle icon={TrendingUp} title="العملاء الجدد شهرياً" />
              <CardContent>
                {!(cl.monthly ?? []).some((m: any) => m.عملاء > 0) ? <EmptyState msg="لا بيانات" /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={cl.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2D3D6B" />
                      <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#A0ADB8", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="عملاء" stroke="#6366F1" strokeWidth={2.5}
                        dot={{ fill: "#6366F1", r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* By type */}
            <Card>
              <SectionTitle icon={Building2} title="توزيع العملاء حسب النوع" />
              <CardContent>
                {!(cl.byType ?? []).length ? <EmptyState msg="لا بيانات" /> : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={200}>
                      <PieChart>
                        <Pie data={cl.byType} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                          {(cl.byType ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <PieLegend data={cl.byType ?? []} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top clients table */}
          <Card>
            <SectionTitle icon={Award} title="أبرز العملاء" sub="مُرتَّب حسب الإيرادات" />
            <CardContent className="p-0">
              {!(cl.topClients ?? []).length ? (
                <div className="p-6"><EmptyState msg="لا توجد فواتير مدفوعة" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-right bg-muted/20">
                        <th className="px-4 py-3 font-semibold">#</th>
                        <th className="px-4 py-3 font-semibold">اسم العميل</th>
                        <th className="px-4 py-3 font-semibold">النوع</th>
                        <th className="px-4 py-3 font-semibold">القضايا</th>
                        <th className="px-4 py-3 font-semibold text-primary">الإيرادات (ر.س)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cl.topClients ?? []).map((c: any, i: number) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground font-mono">{i + 1}</td>
                          <td className="px-4 py-3 font-semibold">{c.name}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-[9px]">
                              {c.type === "individual" ? "فرد" : c.type === "company" ? "شركة" : c.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-indigo-400">{c.قضايا}</td>
                          <td className="px-4 py-3 font-black text-primary">
                            {c.إيرادات.toLocaleString("ar-SA")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-muted-foreground">
      <BarChart3 className="h-8 w-8 mb-2 opacity-20" />
      <p className="text-sm">{msg}</p>
    </div>
  );
}
