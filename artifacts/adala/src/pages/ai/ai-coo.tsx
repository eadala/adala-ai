import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Brain, RefreshCw, AlertTriangle, AlertCircle, Info,
  TrendingUp, Users, Scale, CheckSquare, DollarSign,
  Zap, Send, ChevronRight, Activity, Target, Clock,
  BarChart3, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@clerk/react";

/* ── Types ── */
interface Employee { id: string; name: string; title: string; dept: string; caseCount: number; load: "high" | "medium" | "low" }
interface Alert    { level: "critical" | "warning" | "info"; domain: string; message: string }
interface CooData {
  healthScore: number;
  domains: {
    cases:   { score: number; total: number; active: number; overdue: number; byStatus: Record<string, number> };
    hr:      { score: number; total: number; highLoad: number; medLoad: number; employees: Employee[] };
    finance: { score: number; monthlyRevenue: number; overdueAmount: number; totalAmount: number; paidCount: number; overdueCount: number; pendingCount: number };
    tasks:   { score: number; total: number; overdue: number; urgent: number; byPriority: Record<string, number> };
  };
  alerts: Alert[];
  aiSummary: string;
  recommendations: string[];
  timestamp: string;
}

/* ── Score Ring ── */
function ScoreRing({ score, size = 100, stroke = 9, label }: { score: number; size?: number; stroke?: number; label?: string }) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const cx = size / 2;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/30" />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ transition: "stroke-dasharray .6s ease" }} />
      </svg>
      <div className="absolute" style={{ marginTop: -(size / 2 + 10) }}>
        <span className="text-xl font-black" style={{ color }}>{score}</span>
      </div>
      {label && <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>}
    </div>
  );
}

/* ── Domain Card ── */
function DomainCard({ icon: Icon, label, score, sub, active }: { icon: any; label: string; score: number; sub: string; active: boolean }) {
  const color = score >= 80 ? "text-green-500" : score >= 60 ? "text-amber-500" : "text-red-500";
  const bg    = score >= 80 ? "bg-green-500/10" : score >= 60 ? "bg-amber-500/10" : "bg-red-500/10";
  return (
    <div className={`relative rounded-2xl border p-4 transition-all cursor-default ${active ? "border-primary shadow-sm bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className={`h-4.5 w-4.5 ${color}`} />
        </div>
        <span className={`text-2xl font-black leading-none ${color}`}>{score}</span>
      </div>
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

/* ── Alert Item ── */
function AlertItem({ alert }: { alert: Alert }) {
  const map = {
    critical: { icon: AlertCircle, cls: "text-red-500 bg-red-500/10 border-red-500/20" },
    warning:  { icon: AlertTriangle, cls: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    info:     { icon: Info, cls: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  };
  const { icon: Icon, cls } = map[alert.level] ?? map.info;
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${cls}`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" />
      <span className="text-sm leading-snug">{alert.message}</span>
    </div>
  );
}

/* ── Workload Bar ── */
function WorkloadBar({ pct, load }: { pct: number; load: string }) {
  const color = load === "high" ? "bg-red-500" : load === "medium" ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

/* ── Main Page ── */
type Tab = "overview" | "hr" | "finance" | "tasks" | "alerts" | "ask";

export default function AiCooPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<{ q: string; a: string }[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const { getToken } = useAuth();

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<CooData>({
    queryKey: ["ai-coo-overview"],
    queryFn: async () => {
      const tk = await getToken();
      const r = await fetch("/api/ai-coo/overview", { headers: { Authorization: `Bearer ${tk}` } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const askMut = useMutation({
    mutationFn: async (q: string) => {
      const tk = await getToken();
      const context = data ? `صحة تشغيلية: ${data.healthScore}/100 | قضايا نشطة: ${data.domains.cases.active} | موظفون: ${data.domains.hr.total} | إيرادات: ${data.domains.finance.monthlyRevenue.toLocaleString("ar-SA")} ريال` : "";
      const r = await fetch("/api/ai-coo/ask", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      return j.reply as string;
    },
    onSuccess: (reply) => {
      setChatHistory(h => [...h, { q: question, a: reply }]);
      setQuestion("");
      setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 100);
    },
  });

  useEffect(() => {
    if (tab === "ask") setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 100);
  }, [tab]);

  const hs   = data?.healthScore ?? 0;
  const hsColor = hs >= 80 ? "text-green-500" : hs >= 60 ? "text-amber-500" : "text-red-500";
  const hsLabel = hs >= 80 ? "ممتاز" : hs >= 70 ? "جيد" : hs >= 60 ? "مقبول" : "يحتاج تدخل";
  const updatedStr = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : "--:--";

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "overview", label: "نظرة عامة",  icon: Activity   },
    { id: "hr",       label: "الموظفون",   icon: Users      },
    { id: "finance",  label: "المالية",    icon: DollarSign },
    { id: "tasks",    label: "المهام",     icon: CheckSquare },
    { id: "alerts",   label: "التنبيهات", icon: AlertTriangle },
    { id: "ask",      label: "استشارة AI", icon: Brain      },
  ];

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
        <Brain className="h-6 w-6 text-primary" />
      </div>
      <p className="text-muted-foreground text-sm">يحلل AI COO بيانات المكتب…</p>
    </div>
  );

  const d = data!;

  return (
    <div className="space-y-5 pb-10" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black">المدير التنفيذي الذكي</h1>
            <p className="text-xs text-muted-foreground">AI COO — تحليل تشغيلي لحظي للمكتب</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">آخر تحديث: {updatedStr}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>
      </div>

      {/* ── Health Bar ── */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-6">
          <div className="relative flex items-center justify-center shrink-0" style={{ width: 88, height: 88 }}>
            <ScoreRing score={hs} size={88} stroke={8} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-black leading-none ${hsColor}`}>{hs}</span>
              <span className="text-[10px] text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className={`text-lg font-black ${hsColor}`}>{hsLabel}</span>
              <span className="text-sm text-muted-foreground">— الصحة التشغيلية</span>
            </div>
            {d.aiSummary && <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{d.aiSummary}</p>}
          </div>
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {d.alerts.filter(a => a.level === "critical").length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {d.alerts.filter(a => a.level === "critical").length} حرج
              </Badge>
            )}
            {d.alerts.filter(a => a.level === "warning").length > 0 && (
              <Badge className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
                <AlertTriangle className="h-3 w-3" />
                {d.alerts.filter(a => a.level === "warning").length} تحذير
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Domain Score Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DomainCard icon={Scale}       label="القضايا"   score={d.domains.cases.score}
          sub={`${d.domains.cases.active} نشطة • ${d.domains.cases.overdue} متأخرة`}
          active={tab === "overview"} />
        <DomainCard icon={Users}       label="الموارد البشرية" score={d.domains.hr.score}
          sub={`${d.domains.hr.total} موظف • ${d.domains.hr.highLoad} بضغط عالٍ`}
          active={tab === "hr"} />
        <DomainCard icon={DollarSign}  label="المالية"   score={d.domains.finance.score}
          sub={`${d.domains.finance.monthlyRevenue.toLocaleString("ar-SA")} ريال هذا الشهر`}
          active={tab === "finance"} />
        <DomainCard icon={CheckSquare} label="المهام"    score={d.domains.tasks.score}
          sub={`${d.domains.tasks.total} نشطة • ${d.domains.tasks.overdue} متأخرة`}
          active={tab === "tasks"} />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 flex-wrap border-b pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px
              ${tab === t.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {t.id === "alerts" && d.alerts.filter(a => a.level !== "info").length > 0 && (
              <span className="h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {d.alerts.filter(a => a.level !== "info").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="grid md:grid-cols-5 gap-4">
          {/* Cases status */}
          <div className="md:col-span-2 rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Scale className="h-4 w-4 text-primary" /> حالة القضايا
            </div>
            {Object.entries(d.domains.cases.byStatus).map(([status, cnt]) => {
              const labels: Record<string, string> = { open: "مفتوحة", active: "نشطة", closed: "مغلقة", won: "مكسوبة", lost: "خاسرة", pending: "معلقة" };
              const colors: Record<string, string> = { open: "bg-blue-500", active: "bg-green-500", closed: "bg-gray-400", won: "bg-green-600", lost: "bg-red-500", pending: "bg-amber-500" };
              const total = d.domains.cases.total || 1;
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{labels[status] ?? status}</span>
                    <span className="font-semibold">{cnt}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${colors[status] ?? "bg-primary"}`}
                      style={{ width: `${(cnt / total) * 100}%`, transition: "width .5s" }} />
                  </div>
                </div>
              );
            })}
            {d.domains.cases.total === 0 && <p className="text-xs text-muted-foreground text-center py-2">لا توجد قضايا مسجلة</p>}
          </div>

          {/* Recommendations */}
          <div className="md:col-span-3 rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Target className="h-4 w-4 text-primary" /> توصيات AI COO
            </div>
            {d.recommendations.length > 0
              ? d.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/15 px-3 py-2.5">
                    <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm leading-relaxed">{rec}</span>
                  </div>
                ))
              : <p className="text-sm text-muted-foreground text-center py-4">لا توجد توصيات — المنظومة تعمل بكفاءة</p>}
          </div>

          {/* Top alerts */}
          {d.alerts.filter(a => a.level !== "info").length > 0 && (
            <div className="md:col-span-5 rounded-2xl border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm mb-1">
                <Zap className="h-4 w-4 text-amber-500" /> تنبيهات تشغيلية
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {d.alerts.filter(a => a.level !== "info").slice(0, 4).map((a, i) => (
                  <AlertItem key={i} alert={a} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── HR Tab ── */}
      {tab === "hr" && (
        <div className="space-y-4">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "إجمالي الموظفين", val: d.domains.hr.total, color: "text-foreground" },
              { label: "ضغط عالٍ", val: d.domains.hr.highLoad, color: "text-red-500" },
              { label: "ضغط متوسط", val: d.domains.hr.medLoad, color: "text-amber-500" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border bg-card p-4 text-center">
                <div className={`text-3xl font-black mb-1 ${s.color}`}>{s.val}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Workload heatmap */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> خريطة حرارة العمل
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" />منخفض</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />متوسط</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" />عالٍ</span>
              </div>
            </div>
            {d.domains.hr.employees.length === 0
              ? <p className="text-sm text-muted-foreground text-center py-8">لا يوجد موظفون نشطون</p>
              : (
                <div className="space-y-3">
                  {d.domains.hr.employees.map(emp => {
                    const maxCases = Math.max(...d.domains.hr.employees.map(e => e.caseCount), 1);
                    const pct = Math.round((emp.caseCount / maxCases) * 100);
                    const loadLabel = emp.load === "high" ? "🔴 عالٍ" : emp.load === "medium" ? "🟡 متوسط" : "🟢 منخفض";
                    return (
                      <div key={emp.id} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">{(emp.name ?? "م")[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-sm font-medium truncate">{emp.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0 mr-2">{emp.caseCount} قضية</span>
                          </div>
                          <WorkloadBar pct={pct} load={emp.load} />
                        </div>
                        <span className="text-xs shrink-0 w-20 text-center">{loadLabel}</span>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
      )}

      {/* ── Finance Tab ── */}
      {tab === "finance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "إيرادات هذا الشهر", val: `${d.domains.finance.monthlyRevenue.toLocaleString("ar-SA")} ﷼`, color: "text-green-600 dark:text-green-400", icon: TrendingUp },
              { label: "فواتير متأخرة",      val: `${d.domains.finance.overdueAmount.toLocaleString("ar-SA")} ﷼`, color: "text-red-600 dark:text-red-400",   icon: AlertTriangle },
              { label: "فواتير مدفوعة",      val: d.domains.finance.paidCount.toString(),    color: "text-blue-600 dark:text-blue-400",  icon: CheckSquare },
              { label: "فواتير معلقة",       val: d.domains.finance.pendingCount.toString(), color: "text-amber-600 dark:text-amber-400", icon: Clock },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-card p-4 space-y-4">
            <div className="font-bold text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> تحليل محفظة الفواتير
            </div>
            {[
              { label: "مدفوعة", count: d.domains.finance.paidCount,    color: "bg-green-500", textColor: "text-green-600 dark:text-green-400" },
              { label: "معلقة",  count: d.domains.finance.pendingCount,  color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
              { label: "متأخرة", count: d.domains.finance.overdueCount,  color: "bg-red-500",   textColor: "text-red-600 dark:text-red-400" },
            ].map(row => {
              const total = (d.domains.finance.paidCount + d.domains.finance.pendingCount + d.domains.finance.overdueCount) || 1;
              const pct   = Math.round((row.count / total) * 100);
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={`font-bold ${row.textColor}`}>{row.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%`, transition: "width .5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tasks Tab ── */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "إجمالي المهام",   val: d.domains.tasks.total,   color: "text-foreground" },
              { label: "متأخرة",          val: d.domains.tasks.overdue, color: "text-red-500" },
              { label: "عاجلة",           val: d.domains.tasks.urgent,  color: "text-amber-500" },
              { label: "درجة الالتزام",   val: `${d.domains.tasks.score}%`, color: d.domains.tasks.score >= 80 ? "text-green-500" : d.domains.tasks.score >= 60 ? "text-amber-500" : "text-red-500" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border bg-card p-4 text-center">
                <div className={`text-3xl font-black mb-1 ${s.color}`}>{s.val}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="font-bold text-sm flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-primary" /> توزيع الأولويات
            </div>
            {[
              { key: "urgent", label: "عاجلة",   color: "bg-red-500",   textColor: "text-red-600 dark:text-red-400" },
              { key: "high",   label: "عالية",   color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
              { key: "medium", label: "متوسطة",  color: "bg-blue-500",  textColor: "text-blue-600 dark:text-blue-400" },
              { key: "low",    label: "منخفضة",  color: "bg-gray-400",  textColor: "text-gray-500" },
            ].map(row => {
              const cnt  = d.domains.tasks.byPriority[row.key] ?? 0;
              const pct  = d.domains.tasks.total ? Math.round((cnt / d.domains.tasks.total) * 100) : 0;
              return (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={`font-bold ${row.textColor}`}>{cnt} مهمة ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${row.color}`} style={{ width: `${pct}%`, transition: "width .5s" }} />
                  </div>
                </div>
              );
            })}
            {d.domains.tasks.total === 0 && <p className="text-xs text-muted-foreground text-center py-2">لا توجد مهام نشطة</p>}
          </div>
        </div>
      )}

      {/* ── Alerts Tab ── */}
      {tab === "alerts" && (
        <div className="space-y-3">
          {d.alerts.length === 0
            ? (
              <div className="rounded-2xl border bg-card p-10 text-center">
                <Shield className="h-10 w-10 text-green-500 mx-auto mb-3" />
                <p className="font-semibold">لا توجد تنبيهات</p>
                <p className="text-sm text-muted-foreground mt-1">المنظومة التشغيلية سليمة</p>
              </div>
            )
            : <>
                {["critical", "warning", "info"].map(level => {
                  const group = d.alerts.filter(a => a.level === level);
                  if (!group.length) return null;
                  const titles: Record<string, string> = { critical: "🔴 حرج", warning: "🟡 تحذير", info: "🟢 معلومة" };
                  return (
                    <div key={level} className="space-y-2">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide px-1">{titles[level]}</h3>
                      {group.map((a, i) => <AlertItem key={i} alert={a} />)}
                    </div>
                  );
                })}
              </>}
        </div>
      )}

      {/* ── Ask AI COO Tab ── */}
      {tab === "ask" && (
        <div className="rounded-2xl border bg-card overflow-hidden flex flex-col" style={{ height: 480 }}>
          <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-primary/5">
            <div className="h-7 w-7 rounded-xl bg-primary/15 flex items-center justify-center">
              <Brain className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold">استشارة AI COO</div>
              <div className="text-[11px] text-muted-foreground">اسأل مديرك التنفيذي الذكي أي سؤال تشغيلي</div>
            </div>
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <Brain className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">ابدأ بسؤال AI COO عن أي جانب تشغيلي…</p>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {["ما هي أبرز المخاطر التشغيلية؟", "كيف أحسّن أداء الفريق؟", "ما توصيتك للأسبوع القادم؟"].map(q => (
                    <button key={q} onClick={() => { setQuestion(q); }}
                      className="text-xs bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary border rounded-full px-3 py-1.5 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatHistory.map((turn, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%] text-sm">{turn.q}</div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tl-sm px-3 py-2.5 max-w-[90%] text-sm leading-relaxed whitespace-pre-wrap">{turn.a}</div>
                </div>
              </div>
            ))}
            {askMut.isPending && (
              <div className="flex justify-end">
                <div className="bg-primary/10 border border-primary/20 rounded-2xl px-4 py-3 text-sm text-muted-foreground animate-pulse">يحلل AI COO…</div>
              </div>
            )}
          </div>

          <div className="border-t p-3 flex gap-2">
            <Textarea
              value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="اسأل AI COO…"
              className="resize-none text-sm min-h-[40px] max-h-[80px]"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (question.trim()) askMut.mutate(question); } }}
            />
            <Button size="sm" onClick={() => question.trim() && askMut.mutate(question)}
              disabled={!question.trim() || askMut.isPending} className="shrink-0 self-end">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
