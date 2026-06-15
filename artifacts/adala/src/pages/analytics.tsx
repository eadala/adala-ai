import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Scale, FileText, Users, DollarSign,
  Clock, Award, Target, BarChart3, Printer, RefreshCw,
  CheckCircle2, AlertCircle, Building2, ArrowUpRight, ArrowDownRight,
  BrainCircuit, Sparkles, Loader2, Zap, Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/** Escape user-controlled strings before injecting into HTML to prevent XSS */
function escHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const COLORS = ["#2563EB", "#6366F1", "#10B981", "#3B82F6", "#EC4899", "#F59E0B", "#8B5CF6", "#06B6D4"];

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
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-3 text-xs shadow-2xl min-w-[130px]">
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

/* ── Revenue Forecaster ─────────────────────────────────── */
function RevenueForecaster({ monthlyData }: { monthlyData: { month: string; revenue?: number }[] }) {
  const revenues = monthlyData.map(m => m.revenue ?? 0);
  const n = revenues.length;
  if (n < 3) return null;

  const xs = revenues.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = revenues.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * revenues[i], 0);
  const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const now = new Date();
  const forecastPts = [1, 2, 3].map(i => ({
    i,
    val: Math.max(0, Math.round(slope * (n + i - 1) + intercept)),
    name: MONTHS[(now.getMonth() + i) % 12],
  }));

  const chartData = [
    ...monthlyData.map(m => ({ month: m.month, actual: m.revenue ?? 0, forecast: null as number | null })),
    ...forecastPts.map(p => ({ month: p.name, actual: null as number | null, forecast: p.val })),
  ];

  const trendColor = slope >= 0 ? "#10B981" : "#EF4444";

  return (
    <Card>
      <SectionTitle icon={TrendingUp} title="توقعات الإيرادات" sub="الأشهر الثلاثة القادمة — انحدار خطي" />
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs px-2.5 py-1 rounded-full border font-semibold" style={{ color: trendColor, borderColor: `${trendColor}40`, background: `${trendColor}12` }}>
            {slope >= 0 ? "▲" : "▼"} اتجاه {slope >= 0 ? "صاعد" : "هابط"}
          </span>
          <span className="text-xs text-muted-foreground">معدل النمو الشهري: <span className="font-bold" style={{ color: trendColor }}>{slope >= 0 ? "+" : ""}{fmt(Math.abs(Math.round(slope)))} ر.س</span></span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="gAct2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gFore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 10 }} />
            <YAxis tick={{ fill: "#A0ADB8", fontSize: 10 }} tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="actual"   name="فعلي"   stroke="#10B981" fill="url(#gAct2)" strokeWidth={2.5} dot={{ fill: "#10B981", r: 3 }} connectNulls={false} />
            <Area type="monotone" dataKey="forecast" name="متوقع"  stroke="#2563EB" fill="url(#gFore)" strokeWidth={2} strokeDasharray="6 3" dot={{ fill: "#2563EB", r: 4 }} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-3">
          {forecastPts.map(p => (
            <div key={p.i} className="text-center p-3 rounded-xl border" style={{ borderColor: "#2563EB30", background: "#2563EB08" }}>
              <div className="text-xl font-black" style={{ color: "#2563EB" }}>{fmt(p.val)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{p.name}</div>
              <div className="text-[9px] text-muted-foreground/50">ر.س · متوقع</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center">
          التوقعات مبنية على أنماط الإيرادات التاريخية — للإرشاد الاستراتيجي فقط
        </p>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* ── simple markdown bold renderer ── */
function renderBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? <strong key={i} className="text-primary font-semibold">{p}</strong> : <span key={i}>{p}</span>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState<Period>("1y");
  const [aiRequested, setAiRequested] = useState(false);
  const [aiForce, setAiForce]         = useState(0);

  const qOpts = (key: string[]) => ({
    queryKey: [...key, period],
    queryFn: () => fetch(`${BASE}/api/analytics/${key[0]}?period=${period}`).then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: financial = {}, isFetching: fLoading } = useQuery<any>(qOpts(["financial"]));
  const { data: cases = {},    isFetching: cLoading } = useQuery<any>(qOpts(["cases"]));
  const { data: team = {},     isFetching: tLoading } = useQuery<any>(qOpts(["team"]));
  const { data: clients = {},  isFetching: clLoading } = useQuery<any>(qOpts(["clients"]));
  const { data: perf = {},     isFetching: pLoading } = useQuery<any>(qOpts(["performance"]));

  const { data: aiData, isFetching: aiLoading } = useQuery<{ insights: string; modelUsed: string; cached: boolean }>({
    queryKey: ["ai-insights", period, aiForce],
    queryFn: () => fetch(`${BASE}/api/analytics/ai-insights?period=${period}${aiForce > 0 ? "&force=1" : ""}`).then(r => r.json()),
    enabled: aiRequested,
    staleTime: Infinity,
  });

  const isLoading = fLoading || cLoading || tLoading || clLoading || pLoading;

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
.cover{background:linear-gradient(135deg,#0f1c35,#FFFFFF);color:#fff;padding:32px;margin-bottom:24px;border-radius:8px}
.cover h1{font-size:22pt;font-weight:900;color:#2563EB;margin-bottom:4px}
.cover p{color:rgba(255,255,255,0.6);font-size:9pt}
.section{margin-bottom:20px;padding:16px;border:1px solid #e8e8e8;border-radius:8px}
.section h2{font-size:11pt;font-weight:700;color:#FFFFFF;border-bottom:2px solid #2563EB;padding-bottom:6px;margin-bottom:12px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.kpi{background:#f8f9fa;border-radius:6px;padding:10px;text-align:center}
.kpi .val{font-size:15pt;font-weight:900;color:#2563EB}
.kpi .lbl{font-size:8pt;color:#666;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:9pt}
th{background:#FFFFFF;color:#2563EB;padding:8px;text-align:right}
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
    <tbody>${(cas.byType ?? []).map((r: any) => `<tr><td>${escHtml(r.name)}</td><td>${escHtml(r.value)}</td></tr>`).join("")}</tbody>
  </table>
</div>
<div class="section">
  <h2>👥 أبرز العملاء</h2>
  <table>
    <thead><tr><th>اسم العميل</th><th>عدد القضايا</th><th>الإيرادات (ر.س)</th></tr></thead>
    <tbody>${(cl.topClients ?? []).map((r: any) => `<tr><td>${escHtml(r.name)}</td><td>${escHtml(r.قضايا)}</td><td>${escHtml((r.إيرادات ?? 0).toLocaleString())}</td></tr>`).join("")}</tbody>
  </table>
</div>
<div class="footer">عدالة AI · تقرير مُولَّد تلقائياً · ${new Date().toLocaleString("ar-SA")}</div>
<script>setTimeout(()=>window.print(),500)</script>
</body>
</html>`;
    const win = window.open("", "_blank", "width=900,height=1100");
    if (win) { win.document.write(html); win.document.close(); }
  }, [financial, cases, clients, period]);

  const exportCsv = useCallback(() => {
    const fin = financial as any;
    const cas = cases as any;
    const cl  = clients as any;
    const rows: string[][] = [
      ["المؤشر", "القيمة"],
      ["إجمالي الإيرادات", fmt(fin.totalRevenue ?? 0)],
      ["صافي الربح", fmt(fin.netProfit ?? 0)],
      ["هامش الربح %", `${(fin.profitMargin ?? 0).toFixed(1)}%`],
      ["معدل التحصيل %", `${(fin.collectionRate ?? 0).toFixed(0)}%`],
      [],
      ["إجمالي القضايا", cas.total ?? 0],
      ["قضايا مفتوحة", cas.open ?? 0],
      ["قضايا مغلقة", cas.closed ?? 0],
      ["قيد التنفيذ", cas.inProgress ?? 0],
      ["معدل النجاح %", cas.successRate ?? 0],
      ["متوسط أيام القضية", cas.avgDays ?? 0],
      [],
      ...(fin.monthly ?? []).map((m: any) => [m.name, m.revenue ?? 0, m.expenses ?? 0]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `adala-analytics-${period}.csv`; a.click();
    URL.revokeObjectURL(url);
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
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
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
        <KPICard icon={TrendingUp}  label="صافي الربح"          color="#2563EB"
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
      <Tabs defaultValue="performance">
        <TabsList className="w-full md:w-auto bg-muted/40 p-1 flex-wrap h-auto">
          <TabsTrigger value="performance" className="gap-1.5 text-xs">
            <Target className="h-3.5 w-3.5" /> درجة الأداء
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5" /> المالية
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
          <TabsTrigger value="ai-insights" className="gap-1.5 text-xs">
            <BrainCircuit className="h-3.5 w-3.5" /> تحليل ذكي
          </TabsTrigger>
        </TabsList>

        {/* ── PERFORMANCE TAB ──────────────────────────────── */}
        <TabsContent value="performance" className="mt-4 space-y-4">
          {(() => {
            const p = perf as any;
            const score = p.composite ?? 0;
            const band = p.scoreBand ?? "average";
            const dim  = p.dimensions ?? {};
            const benchmarks = p.benchmarks ?? { industryAvg: 62, topQuartile: 83 };

            const BAND_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
              excellent:        { label: "ممتاز",     color: "#10B981", bg: "#10B98115" },
              good:             { label: "جيد جداً",  color: "#2563EB", bg: "#2563EB15" },
              average:          { label: "متوسط",     color: "#6366F1", bg: "#6366F115" },
              needsImprovement: { label: "يحتاج تطوير", color: "#EF4444", bg: "#EF444415" },
            };
            const cfg = BAND_CONFIG[band] ?? BAND_CONFIG.average;

            /* SVG Gauge */
            const GaugeArc = ({ pct, color }: { pct: number; color: string }) => {
              const r = 60, cx = 80, cy = 80;
              const startAngle = Math.PI;
              const endAngle   = startAngle + (Math.PI * Math.min(pct, 100)) / 100;
              const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
              const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle);
              const large = endAngle - startAngle > Math.PI ? 1 : 0;
              return (
                <svg width="160" height="100" className="mx-auto">
                  <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#ffffff10" strokeWidth="14" strokeLinecap="round" />
                  {pct > 0 && <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />}
                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize="22" fontWeight="900" fill={color}>{score}</text>
                  <text x={cx} y={cy + 18} textAnchor="middle" fontSize="9" fill="#94a3b8">/100</text>
                </svg>
              );
            };

            const DimCard = ({ label, score: s, sub, color }: { label: string; score: number; sub: string; color: string }) => (
              <div className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                  <span className="text-sm font-black" style={{ color }}>{s}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s}%`, background: color }} />
                </div>
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            );

            return (
              <div className="space-y-5">
                {/* Score Hero */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="border-0 bg-card/60">
                    <CardContent className="p-6 flex flex-col items-center gap-3">
                      <GaugeArc pct={score} color={cfg.color} />
                      <div className="text-center">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold" style={{ background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {p.trend !== undefined && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {p.trend >= 0 ? "▲" : "▼"} {Math.abs(p.trend)} نقطة مقارنة بالفترة السابقة
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground text-center">درجة أداء المكتب الشاملة</p>
                    </CardContent>
                  </Card>

                  {/* Benchmark Comparison */}
                  <Card className="border-0 bg-card/60">
                    <CardContent className="p-5 space-y-4">
                      <p className="text-sm font-bold">مقارنة بالمعايير</p>
                      {[
                        { label: "درجتك", val: score, color: cfg.color },
                        { label: "متوسط السوق", val: benchmarks.industryAvg, color: "#6366F1" },
                        { label: "أفضل ربع", val: benchmarks.topQuartile, color: "#10B981" },
                      ].map(b => (
                        <div key={b.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{b.label}</span>
                            <span className="font-bold" style={{ color: b.color }}>{b.val}</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${b.val}%`, background: b.color }} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* 4 Dimensions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DimCard label="الأداء المالي" score={dim.financial?.score ?? 0} color="#10B981"
                    sub={`تحصيل ${dim.financial?.collectionRate ?? 0}% · هامش ${dim.financial?.profitMargin ?? 0}%`} />
                  <DimCard label="القضايا" score={dim.cases?.score ?? 0} color="#6366F1"
                    sub={`نجاح ${dim.cases?.successRate ?? 0}% · متوسط ${dim.cases?.avgDays ?? 0} يوم`} />
                  <DimCard label="العملاء" score={dim.clients?.score ?? 0} color="#2563EB"
                    sub={`احتفاظ ${dim.clients?.retention?.toFixed(0) ?? 0}% · ${dim.clients?.repeat ?? 0} عميل متكرر`} />
                  <DimCard label="الذكاء الاصطناعي" score={dim.ai?.score ?? 0} color="#F59E0B"
                    sub={`${dim.ai?.calls ?? 0} طلب · ${dim.ai?.usagePct ?? 0}% مستهلك`} />
                </div>

                {/* AI Usage Detail */}
                {dim.ai && (
                  <Card className="border-0 bg-card/60">
                    <CardContent className="p-5">
                      <p className="text-sm font-bold mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#F59E0B]" /> تفاصيل استخدام الذكاء الاصطناعي
                      </p>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: "الطلبات", val: (dim.ai.calls ?? 0).toLocaleString(), color: "#F59E0B" },
                          { label: "الوحدات", val: (dim.ai.units ?? 0).toLocaleString(), color: "#2563EB" },
                          { label: "الرصيد المتبقي", val: dim.ai.balance ?? 0, color: "#10B981" },
                          { label: "المخصص الشهري", val: dim.ai.allowance ?? 0, color: "#6366F1" },
                        ].map(s => (
                          <div key={s.label} className="text-center p-2 bg-muted/30 rounded-lg">
                            <div className="text-lg font-black" style={{ color: s.color }}>{s.val}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      {dim.ai.allowance > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>الاستهلاك</span>
                            <span>{dim.ai.usagePct ?? 0}%</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${dim.ai.usagePct ?? 0}%`,
                              background: (dim.ai.usagePct ?? 0) >= 90 ? "#EF4444" : (dim.ai.usagePct ?? 0) >= 70 ? "#F59E0B" : "#10B981"
                            }} />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })()}
        </TabsContent>

        {/* ── FINANCIAL TAB ────────────────────────────────── */}
        <TabsContent value="financial" className="mt-4 space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "الإيرادات", value: `${fmt(fin.totalRevenue ?? 0)} ر.س`, color: "#10B981", icon: TrendingUp },
              { label: "المصروفات", value: `${fmt(fin.totalExpenses ?? 0)} ر.س`, color: "#EF4444", icon: TrendingDown },
              { label: "صافي الربح", value: `${fmt(fin.netProfit ?? 0)} ر.س`, color: "#2563EB", icon: DollarSign },
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
                        <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#A0ADB8", fontSize: 10 }}
                      tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="revenue"  name="الإيرادات"  stroke="#10B981" fill="url(#gRev)" strokeWidth={2.5} dot={{ fill: "#10B981", r: 3 }} />
                    <Area type="monotone" dataKey="expenses" name="المصروفات"  stroke="#EF4444" fill="url(#gExp)" strokeWidth={2.5} dot={{ fill: "#EF4444", r: 3 }} />
                    <Area type="monotone" dataKey="profit"   name="صافي الربح" stroke="#2563EB" fill="url(#gPro)" strokeWidth={2} dot={{ fill: "#2563EB", r: 3 }} strokeDasharray="4 2" />
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
              { label: "معدل التحصيل",    value: `${(fin.collectionRate ?? 0).toFixed(0)}%`, color: "#2563EB", icon: Target },
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

          {/* Revenue Forecast */}
          <RevenueForecaster monthlyData={fin.monthly ?? []} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#A0ADB8", fontSize: 10 }} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="total"  name="الإجمالي" fill="#6366F1" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="closed" name="مغلقة"    fill="#10B981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="open"   name="مفتوحة"   fill="#2563EB" radius={[3, 3, 0, 0]} />
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
            <KPICard icon={Scale}  label="قضايا مُسنَدة"     color="#2563EB"
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
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
            <KPICard icon={ArrowUpRight} label="جدد في الفترة" color="#2563EB" value={cl.newInPeriod ?? 0} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
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

        {/* ── AI INSIGHTS TAB ──────────────────────────────── */}
        <TabsContent value="ai-insights" className="mt-4">
          {!aiRequested ? (
            <div className="flex flex-col items-center justify-center py-24 gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <BrainCircuit className="w-10 h-10 text-primary" />
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
              <div className="text-center max-w-sm">
                <h3 className="text-lg font-bold text-white mb-2">التحليل الذكي لأداء مكتبك</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  يحلل الذكاء الاصطناعي بيانات الإيرادات والقضايا والفريق ويولد تقريراً تنفيذياً
                  شاملاً مع رؤى وتوصيات استراتيجية.
                </p>
              </div>
              <Button onClick={() => setAiRequested(true)} className="gap-2 h-10 px-8 text-sm font-semibold">
                <Sparkles className="w-4 h-4" />
                توليد التحليل الذكي
              </Button>
            </div>
          ) : aiLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-base font-medium text-white/70">يحلل الذكاء الاصطناعي بيانات مكتبك...</p>
                <p className="text-xs text-white/30 mt-1">قد يستغرق ذلك بضع ثوانٍ</p>
              </div>
            </div>
          ) : aiData?.insights ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {aiData.modelUsed && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary gap-1">
                      <Zap className="w-3 h-3" />{aiData.modelUsed}
                    </Badge>
                  )}
                  {aiData.cached && (
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground">محفوظ مؤقتاً</Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-white/50 hover:text-white"
                  onClick={() => setAiForce(f => f + 1)}>
                  <RefreshCw className="w-3.5 h-3.5" />تحديث التحليل
                </Button>
              </div>

              <div className="bg-gradient-to-br from-primary/8 via-transparent to-transparent border border-primary/20 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <BrainCircuit className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 space-y-3">
                    {aiData.insights.split("\n").filter((l: string) => l.trim()).map((line: string, i: number) => (
                      <p key={i} className="text-sm leading-relaxed text-white/80">
                        {renderBold(line)}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs text-white/25 text-center">
                التحليل مبني على بيانات {PERIODS.find(p => p.value === period)?.label} — يُحدَّث تلقائياً كل 6 ساعات
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-white/30 gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">تعذّر توليد التحليل — حاول مرة أخرى</p>
              <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={() => setAiForce(f => f + 1)}>
                إعادة المحاولة
              </Button>
            </div>
          )}
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
