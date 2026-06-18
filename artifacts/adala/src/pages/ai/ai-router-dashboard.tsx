import { useQuery } from "@tanstack/react-query";
import { API } from "@/lib/api";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Bot, Zap, TrendingUp, DollarSign, RefreshCw, Clock,
  CheckCircle2, Database, Cpu, BarChart3, Activity,
  ArrowUpRight, Sparkles, Brain,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

/* ─── helpers ──────────────────────────────────────────────────── */
function fmt(n: number) { return n.toLocaleString("ar-SA"); }
function pct(n: number) { return `${n}%`; }

const MODEL_COLORS: Record<string, string> = {
  gemini:   "#4F8EF7",
  claude:   "#C97B45",
  openai:   "#19C37D",
  deepseek: "#7C5CFC",
  ollama:   "#22D3EE",
  fallback: "#94A3B8",
};
const TIER_COLORS = { cheap: "#22C55E", mid: "#F59E0B", premium: "#EF4444" };
const TIER_LABELS = { cheap: "اقتصادي (DeepSeek)", mid: "متوسط (Gemini)", premium: "متميز (Claude/OpenAI)" };

const ROUTING_RULES = [
  { tier: "cheap",   color: TIER_COLORS.cheap,   model: "DeepSeek → Gemini → Ollama", desc: "طلبات قصيرة بسيطة (<80 حرف، غير قانونية)", cost: "0.5 نقطة" },
  { tier: "mid",     color: TIER_COLORS.mid,     model: "Gemini → DeepSeek → Ollama", desc: "طلبات متوسطة أو قانونية أساسية", cost: "1 نقطة" },
  { tier: "premium", color: TIER_COLORS.premium, model: "Claude → OpenAI → Gemini",   desc: "تحليل قانوني معقد، عقود، مذكرات", cost: "3 نقاط" },
];

function StatCard({
  icon, label, value, sub, trend, color = "blue",
}: { icon: React.ReactNode; label: string; value: string; sub?: string; trend?: string; color?: string }) {
  return (
    <Card className={`border-${color}-100 dark:border-${color}-900/30`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className={`p-2.5 rounded-xl bg-${color}-50 dark:bg-${color}-950/40`}>
            {icon}
          </div>
          {trend && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-200 text-[10px]">
              <ArrowUpRight className="h-3 w-3 ms-0.5" />{trend}
            </Badge>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm font-medium mt-0.5">{label}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Custom Pie label ─────────────────────────────────────────── */
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════════ */
export default function AIRouterDashboard() {
  const qc = useQueryClient();

  const { data: summary, isLoading: loadS } = useQuery<any>({
    queryKey: ["ai-analytics-summary"],
    queryFn: () => API("/ai/analytics/summary"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: daily, isLoading: loadD } = useQuery<any>({
    queryKey: ["ai-analytics-daily"],
    queryFn: () => API("/ai/analytics/daily"),
    staleTime: 60_000,
  });

  const { data: byOffice } = useQuery<any>({
    queryKey: ["ai-analytics-offices"],
    queryFn: () => API("/ai/analytics/by-office"),
    staleTime: 60_000,
  });

  const { data: recent } = useQuery<any>({
    queryKey: ["ai-analytics-recent"],
    queryFn: () => API("/ai/analytics/recent"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ai-analytics-summary"] });
    qc.invalidateQueries({ queryKey: ["ai-analytics-daily"] });
    qc.invalidateQueries({ queryKey: ["ai-analytics-offices"] });
    qc.invalidateQueries({ queryKey: ["ai-analytics-recent"] });
  };

  /* ── Model pie data ─── */
  const modelPie = summary
    ? Object.entries(summary.models as Record<string, number>)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k, value: v, color: MODEL_COLORS[k] ?? "#94A3B8" }))
    : [];

  /* ── Tier pie data ─── */
  const tierPie = summary
    ? Object.entries(summary.tiers as Record<string, number>)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: TIER_LABELS[k as keyof typeof TIER_LABELS] ?? k, value: v, color: TIER_COLORS[k as keyof typeof TIER_COLORS] ?? "#94A3B8" }))
    : [];

  /* ── Daily chart data ─── */
  const dailyData = (daily?.data ?? []) as any[];

  /* ── Recent logs ─── */
  const recentRows = (recent?.data ?? []) as any[];

  if (loadS) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
        <Bot className="h-5 w-5 animate-spin" />
        <span>جاري تحميل لوحة AI Router…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">

      {/* ── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-violet-500" />
            لوحة التحكم — AI Router
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            توجيه ذكي لتوفير التكلفة · مصنّف التكلفة · تتبع الاستهلاك الكامل
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {/* ── Stat cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="h-5 w-5 text-blue-500" />}
          label="إجمالي الطلبات"
          value={fmt(summary?.total ?? 0)}
          sub={`${fmt(summary?.last24h ?? 0)} في آخر 24 ساعة`}
          color="blue"
        />
        <StatCard
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          label="نسبة الـ Cache"
          value={pct(summary?.cacheRate ?? 0)}
          sub={`${fmt(summary?.cacheHits ?? 0)} رد فوري`}
          trend="توفير فوري"
          color="amber"
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5 text-emerald-500" />}
          label="نقاط توفير التكلفة"
          value={fmt(summary?.savedPoints ?? 0)}
          sub="مقارنة بـ Premium لكل الطلبات"
          trend="وفّرت"
          color="emerald"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-violet-500" />}
          label="متوسط زمن الرد"
          value={`${fmt(summary?.avgResponseMs ?? 0)} ms`}
          sub={`${fmt(summary?.totalCostPoints ?? 0)} نقطة إجمالية`}
          color="violet"
        />
      </div>

      {/* ── Routing Rules ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ROUTING_RULES.map(r => (
          <Card key={r.tier} className="overflow-hidden">
            <div className="h-1" style={{ background: r.color }} />
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                <span className="font-semibold text-sm">{TIER_LABELS[r.tier as keyof typeof TIER_LABELS]}</span>
                <Badge variant="outline" className="mr-auto text-[10px] py-0">{r.cost}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
              <div className="bg-muted/50 rounded-md px-2.5 py-1.5 text-[11px] font-mono">
                {r.model}
              </div>
              <p className="text-sm font-bold text-center" style={{ color: r.color }}>
                {fmt(summary?.tiers?.[r.tier] ?? 0)} طلب
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Daily trend — full width */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              الطلبات اليومية — آخر 30 يوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadD ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                جاري التحميل…
              </div>
            ) : dailyData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <BarChart3 className="h-8 w-8" />
                <p className="text-sm">لا توجد بيانات بعد</p>
                <p className="text-xs">ستظهر البيانات بعد أول استخدام لـ AI</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dailyData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v: any, name: any) => [fmt(v), name === "total" ? "إجمالي" : name === "cached" ? "Cache" : "تكلفة"]}
                    labelFormatter={l => `يوم ${l}`}
                  />
                  <Legend formatter={v => v === "total" ? "إجمالي الطلبات" : v === "cached" ? "من الـ Cache" : "تكلفة النقاط"} />
                  <Line type="monotone" dataKey="total"  stroke="#4F8EF7" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cached" stroke="#22C55E" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="cost"   stroke="#F59E0B" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Model distribution pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-violet-500" />
              توزيع النماذج
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modelPie.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Cpu className="h-8 w-8" />
                <p className="text-sm">لا توجد بيانات بعد</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={modelPie} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                      labelLine={false} label={PieLabel}>
                      {modelPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [fmt(v), "طلب"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
                  {modelPie.map(m => (
                    <div key={m.name} className="flex items-center gap-1 text-[11px]">
                      <div className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                      <span className="capitalize">{m.name}</span>
                      <span className="text-muted-foreground">({fmt(m.value)})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Second charts row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Tier bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              توزيع طبقات التكلفة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tierPie.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Sparkles className="h-8 w-8" />
                <p className="text-sm">لا توجد بيانات بعد</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={tierPie} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} />
                    <Tooltip formatter={(v: any) => [fmt(v), "طلب"]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {tierPie.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {Object.entries(TIER_COLORS).map(([k, c]) => (
                    <div key={k} className="text-center">
                      <p className="text-lg font-bold" style={{ color: c }}>
                        {fmt(summary?.tiers?.[k] ?? 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">{k}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Per-office table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-500" />
              الاستهلاك حسب المكتب
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[280px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right text-xs">المكتب</TableHead>
                    <TableHead className="text-center text-xs">الطلبات</TableHead>
                    <TableHead className="text-center text-xs">النقاط</TableHead>
                    <TableHead className="text-center text-xs">Cache</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(byOffice?.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-8">
                        لا توجد بيانات بعد
                      </TableCell>
                    </TableRow>
                  ) : (
                    (byOffice?.data ?? []).map((row: any) => (
                      <TableRow key={row.officeId} className="text-xs">
                        <TableCell className="font-mono text-[11px] truncate max-w-[100px]">
                          {row.officeId?.slice(0, 12)}…
                        </TableCell>
                        <TableCell className="text-center font-bold">{fmt(row.total)}</TableCell>
                        <TableCell className="text-center text-amber-600">{fmt(Math.round(row.cost))}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-emerald-600">
                            {row.total > 0 ? Math.round((row.cached / row.total) * 100) : 0}%
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent queries log ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-500" />
            آخر الطلبات المعالَجة
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right text-xs">نوع الطلب</TableHead>
                  <TableHead className="text-center text-xs">النموذج</TableHead>
                  <TableHead className="text-center text-xs">الطبقة</TableHead>
                  <TableHead className="text-center text-xs">النقاط</TableHead>
                  <TableHead className="text-center text-xs">Cache</TableHead>
                  <TableHead className="text-center text-xs">الزمن (ms)</TableHead>
                  <TableHead className="text-right text-xs">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-8">
                      لا يوجد سجل بعد — سيظهر هنا فور استخدام أي وظيفة AI
                    </TableCell>
                  </TableRow>
                ) : (
                  recentRows.map((row: any) => (
                    <TableRow key={row.id} className="text-xs">
                      <TableCell className="font-medium">{row.query_type}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className="px-1.5 py-0.5 rounded text-white text-[10px] font-medium"
                          style={{ background: MODEL_COLORS[row.model_used] ?? "#94A3B8" }}
                        >
                          {row.model_used}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className="font-medium text-[11px]"
                          style={{ color: TIER_COLORS[row.tier as keyof typeof TIER_COLORS] ?? "#94A3B8" }}
                        >
                          {row.tier}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-amber-600 font-medium">{row.cost_points}</TableCell>
                      <TableCell className="text-center">
                        {row.cached
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {row.response_ms ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-[10px]">
                        {new Date(row.created_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── Cache stats footer ─── */}
      {summary?.cacheStats && (
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-cyan-500" /> حالة الـ Cache
              </span>
              <span>المدخلات: <strong>{summary.cacheStats.size}</strong></span>
              <span>الحجم الأقصى: <strong>{summary.cacheStats.maxEntries ?? "∞"}</strong></span>
              <span className="text-emerald-600">
                <Zap className="h-3 w-3 inline ms-1" />
                Cache hit = صفر تكلفة، رد فوري (&lt;5ms)
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
