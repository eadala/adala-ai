import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExecutiveAssistant } from "@/components/executive-assistant";
import {
  Scale, Users, Receipt, TrendingUp, Bot, AlertCircle, CalendarDays,
  FileText, Clock, ArrowLeft, Zap, ChevronLeft, CheckCircle2, Banknote,
  Activity, Bell, BarChart3, MapPin, Plus, ExternalLink, CreditCard, BrainCircuit,
  DollarSign, ShieldCheck, Sparkles, UserCheck, TrendingDown, HeartPulse, Brain,
  X, RefreshCw,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLang } from "@/hooks/use-lang";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/* ══════════════════════════════════════════════════════
   AI Events Intelligence Panel — Autonomous Monitoring
══════════════════════════════════════════════════════ */
const SEV_CONFIG: Record<string, { bg: string; border: string; dot: string; text: string; label: string }> = {
  critical: { bg: "bg-red-500/6",    border: "border-red-500/20",    dot: "bg-red-400",    text: "text-red-400",    label: "حرج" },
  high:     { bg: "bg-amber-500/6",  border: "border-amber-500/20",  dot: "bg-amber-400",  text: "text-amber-400",  label: "مهم" },
  info:     { bg: "bg-blue-500/6",   border: "border-blue-500/20",   dot: "bg-blue-400",   text: "text-blue-400",   label: "معلومة" },
};

function AiEventsPanel() {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [scanning, setScanning] = useState(false);
  const { data, refetch } = useQuery<{ events: any[] }>({
    queryKey: ["ai-events"],
    queryFn: () => fetch(`${BASE}/api/ai-events`).then(r => r.json()),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const events = (data?.events ?? []).filter((e: any) => !dismissed.has(e.id));
  if (events.length === 0) return null;

  const dismiss = async (id: number) => {
    setDismissed(p => new Set([...p, id]));
    fetch(`${BASE}/api/ai-events/${id}/dismiss`, { method: "POST" }).catch(() => {});
  };

  const scan = async () => {
    setScanning(true);
    await fetch(`${BASE}/api/ai-events/scan`, { method: "POST" }).catch(() => {});
    await refetch();
    setScanning(false);
  };

  const criticalCount = events.filter((e: any) => e.severity === "critical").length;
  const highCount = events.filter((e: any) => e.severity === "high").length;

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#C9A84C]/15 flex items-center justify-center">
            <Brain className="h-3.5 w-3.5 text-[#C9A84C]" />
          </div>
          <span className="text-xs font-bold text-foreground/70 uppercase tracking-widest">
            ذكاء النظام — مراقبة تلقائية
          </span>
          <div className="flex items-center gap-1">
            {criticalCount > 0 && (
              <span className="bg-red-500/15 text-red-400 border border-red-500/25 text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {criticalCount} حرج
              </span>
            )}
            {highCount > 0 && (
              <span className="bg-amber-500/15 text-amber-400 border border-amber-500/25 text-[10px] font-bold rounded-full px-1.5 py-0.5">
                {highCount} مهم
              </span>
            )}
          </div>
        </div>
        <button
          onClick={scan}
          disabled={scanning}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${scanning ? "animate-spin" : ""}`} />
          فحص جديد
        </button>
      </div>

      {/* Events List */}
      <div className="divide-y divide-border/20">
        {events.map((ev: any) => {
          const s = SEV_CONFIG[ev.severity] ?? SEV_CONFIG.info;
          return (
            <div key={ev.id} className={`flex items-start gap-3 px-4 py-3 ${s.bg} transition-all hover:brightness-110`}>
              <div className="flex items-center gap-2 mt-1 shrink-0">
                <span className={`w-2 h-2 rounded-full ${s.dot} animate-pulse`} />
                <span className={`text-[10px] font-bold border rounded-full px-1.5 py-0.5 ${s.border} ${s.text}`}>
                  {s.label}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold leading-tight ${s.text}`}>{ev.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{ev.body}</p>
              </div>
              <button
                onClick={() => dismiss(ev.id)}
                className="text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0 mt-0.5 p-0.5 rounded hover:bg-white/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Live Event Feed widget ─────────────────────────────── */
interface LiveEv { id: string; type: string; label: string; data: Record<string, any>; timestamp: string; }

const EV_ICONS: Record<string, { icon: any; color: string }> = {
  CASE_CREATED:    { icon: Scale,        color: "#6366F1" },
  CASE_CLOSED:     { icon: Scale,        color: "#64748B" },
  CLIENT_ADDED:    { icon: Users,        color: "#10B981" },
  INVOICE_CREATED: { icon: Receipt,      color: "#F59E0B" },
  INVOICE_PAID:    { icon: Receipt,      color: "#10B981" },
  PAYMENT_SUCCESS: { icon: CreditCard,   color: "#C9A84C" },
  PAYMENT_FAILED:  { icon: CreditCard,   color: "#EF4444" },
  DOCUMENT_GENERATED:{ icon: FileText,   color: "#8B5CF6" },
  AI_QUERY:        { icon: BrainCircuit, color: "#A855F7" },
};

function timeAgo(ts: string) {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60_000)    return `${Math.floor(d/1000)}ث`;
  if (d < 3_600_000) return `${Math.floor(d/60_000)}د`;
  return `${Math.floor(d/3_600_000)}س`;
}

/* ── Executive Pulse Bar — 10 مؤشرات في ثانية ────────────────────────────── */
type ExecData = {
  todayRevenue: number; monthRevenue: number; outstanding: number;
  overdueCount: number; collectionRate: number; activeCases: number;
  criticalCases: number; newClientsThisWeek: number; aiUsageThisMonth: number;
  activeEmployees: number; healthScore: number; healthStatus: string;
};

function ExecutivePulseBar() {
  const { tx, dateLocale } = useLang();
  const { data, isLoading } = useQuery<ExecData>({
    queryKey: ["dashboard-executive"],
    queryFn: () => fetch(`${BASE}/api/dashboard/executive`).then(r => r.json()),
    refetchInterval: 120_000,
  });

  const fmt = (n: number) => n.toLocaleString(dateLocale, { maximumFractionDigits: 0 });

  const metrics = data ? [
    {
      label: tx("إيرادات اليوم", "Today Revenue"),
      value: `${fmt(data.todayRevenue)} ${tx("ر.س","SAR")}`,
      icon: DollarSign,
      status: data.todayRevenue > 0 ? "green" : "neutral",
      href: "/invoices",
    },
    {
      label: tx("إيرادات الشهر", "Month Revenue"),
      value: `${fmt(data.monthRevenue)} ${tx("ر.س","SAR")}`,
      icon: TrendingUp,
      status: "green",
      href: "/revenues",
    },
    {
      label: tx("مستحقات معلّقة", "Outstanding"),
      value: `${fmt(data.outstanding)} ${tx("ر.س","SAR")}`,
      icon: TrendingDown,
      status: data.outstanding > 10000 ? "amber" : "green",
      href: "/collections",
    },
    {
      label: tx("نسبة التحصيل", "Collection Rate"),
      value: `${data.collectionRate}%`,
      icon: ShieldCheck,
      status: data.collectionRate >= 80 ? "green" : data.collectionRate >= 60 ? "amber" : "red",
      href: "/collections",
    },
    {
      label: tx("قضايا حرجة", "Critical Cases"),
      value: String(data.criticalCases),
      icon: AlertCircle,
      status: data.criticalCases === 0 ? "green" : data.criticalCases <= 2 ? "amber" : "red",
      href: "/cases",
    },
    {
      label: tx("فواتير متأخرة", "Overdue Invoices"),
      value: String(data.overdueCount),
      icon: Receipt,
      status: data.overdueCount === 0 ? "green" : data.overdueCount <= 3 ? "amber" : "red",
      href: "/invoices",
    },
    {
      label: tx("عملاء جدد", "New Clients"),
      value: String(data.newClientsThisWeek),
      icon: UserCheck,
      status: data.newClientsThisWeek > 0 ? "green" : "neutral",
      href: "/clients",
    },
    {
      label: tx("استخدام AI", "AI Usage"),
      value: String(data.aiUsageThisMonth),
      icon: Sparkles,
      status: "green",
      href: "/ai-hub",
    },
    {
      label: tx("الموظفون النشطون", "Active Employees"),
      value: String(data.activeEmployees),
      icon: Users,
      status: "neutral",
      href: "/employees",
    },
    {
      label: tx("صحة النظام", "System Health"),
      value: data.healthStatus === "excellent" ? tx("ممتاز","Excellent") : data.healthStatus === "good" ? tx("جيد","Good") : tx("يحتاج متابعة","Attention"),
      icon: HeartPulse,
      status: data.healthStatus === "excellent" ? "green" : data.healthStatus === "good" ? "amber" : "red",
      href: "/audit-logs",
    },
  ] : [];

  const statusStyle: Record<string, { bg: string; text: string; dot: string }> = {
    green:   { bg: "bg-emerald-500/8 hover:bg-emerald-500/15 border-emerald-500/20",   text: "text-emerald-400",  dot: "bg-emerald-400" },
    amber:   { bg: "bg-amber-500/8 hover:bg-amber-500/15 border-amber-500/20",         text: "text-amber-400",    dot: "bg-amber-400" },
    red:     { bg: "bg-red-500/8 hover:bg-red-500/15 border-red-500/20",               text: "text-red-400",      dot: "bg-red-400" },
    neutral: { bg: "bg-muted/30 hover:bg-muted/50 border-border/40",                   text: "text-muted-foreground", dot: "bg-slate-500" },
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-3.5 w-3.5 text-primary animate-pulse" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {tx("نبضة التنفيذية — لمحة فورية", "Executive Pulse — 10 Seconds View")}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/50">{new Date().toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      {/* Metrics Grid */}
      {isLoading ? (
        <div className="grid grid-cols-5 lg:grid-cols-10 gap-px bg-border/20 p-0">
          {Array(10).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-none" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 divide-x divide-x-reverse divide-border/20">
          {metrics.map((m, i) => {
            const s = statusStyle[m.status];
            const Icon = m.icon;
            return (
              <Link key={i} href={m.href}>
                <div className={`flex flex-col items-center justify-center gap-1 px-2 py-3 text-center cursor-pointer transition-all border-b border-border/10 ${s.bg}`}>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                    <Icon className={`h-3 w-3 ${s.text}`} />
                  </div>
                  <span className={`text-sm font-black tabular-nums leading-none ${s.text}`}>{m.value}</span>
                  <span className="text-[9px] text-muted-foreground/60 leading-tight truncate w-full">{m.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LiveEventFeed() {
  const [events, setEvents] = useState<LiveEv[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  /* Seed from history */
  useEffect(() => {
    fetch(`${BASE}/api/events/recent?limit=7`)
      .then(r => r.json())
      .then(d => { if (d.events?.length) setEvents(d.events); })
      .catch(() => {});
  }, []);

  /* SSE live updates */
  useEffect(() => {
    function connect() {
      if (esRef.current) esRef.current.close();
      const es = new EventSource(`${BASE}/api/events/stream`);
      esRef.current = es;
      es.onopen  = () => setConnected(true);
      es.onerror = () => { setConnected(false); setTimeout(connect, 5000); };
      es.onmessage = (e) => {
        try {
          const ev: LiveEv = JSON.parse(e.data);
          if (ev.type === "__CONNECTED__") return;
          setEvents(p => [ev, ...p].slice(0, 7));
        } catch {}
      };
    }
    connect();
    return () => esRef.current?.close();
  }, []);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            نبض النظام — لحظي
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" asChild>
            <Link href="/activity-stream"><ExternalLink className="h-3 w-3" />السجل الكامل</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        {events.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Activity className="h-4 w-4" />
            <p className="text-xs">في انتظار أول حدث...</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {events.map((ev, i) => {
              const meta = EV_ICONS[ev.type] ?? { icon: Activity, color: "#64748B" };
              const Icon = meta.icon;
              return (
                <div key={ev.id} className={`flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/2 ${i === 0 ? "bg-[#C9A84C]/3" : ""}`}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${meta.color}15` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold" style={{ color: meta.color }}>{ev.label}</span>
                    <span className="text-[10px] text-muted-foreground mx-1.5">—</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {ev.data?.title ?? ev.data?.fullName ?? ev.data?.invoiceNumber ?? ev.data?.clientName ?? ""}
                      {ev.data?.amount ? ` ${Number(ev.data.amount).toLocaleString("ar-SA")} ر.س` : ""}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{timeAgo(ev.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type Overview = {
  kpis: {
    activeCases: number; totalCases: number; totalClients: number;
    paidRevenue: number; outstanding: number; aiCompleted: number;
    casesThisMonth: number; clientsThisMonth: number; successRate: number;
  };
  alerts: { type: string; icon: string; title: string; body: string; action: string }[];
  upcomingEvents: any[];
  todayEvents: any[];
  recentCases: any[];
  recentInvoices: any[];
  revenueChart: { month: string; revenue: number }[];
};

const EVENT_COLORS: Record<string, string> = {
  court_session:  "border-red-500/40 bg-red-500/5 text-red-300",
  deadline:       "border-orange-500/40 bg-orange-500/5 text-orange-300",
  client_meeting: "border-blue-500/40 bg-blue-500/5 text-blue-300",
  team_meeting:   "border-green-500/40 bg-green-500/5 text-green-300",
  task:           "border-purple-500/40 bg-purple-500/5 text-purple-300",
  other:          "border-border/50 bg-muted/30 text-muted-foreground",
};

export default function Dashboard() {
  const { user } = useUser();
  const { tx, isAr, dateLocale } = useLang();

  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["dashboard-overview"],
    queryFn: () => fetch(`${BASE}api/dashboard/overview`).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const EVENT_TYPE_LABEL: Record<string, string> = {
    court_session:  tx("جلسة محكمة", "Court Session"),
    deadline:       tx("موعد نهائي", "Deadline"),
    client_meeting: tx("اجتماع عميل", "Client Meeting"),
    team_meeting:   tx("اجتماع فريق", "Team Meeting"),
    task:           tx("مهمة", "Task"),
    other:          tx("حدث", "Event"),
  };

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    open:        { label: tx("مفتوحة", "Open"),         color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    in_progress: { label: tx("قيد التنفيذ", "In Progress"), color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
    closed:      { label: tx("مغلقة", "Closed"),         color: "bg-green-500/10 text-green-400 border-green-500/20" },
  };

  const INV_STATUS: Record<string, { label: string; color: string }> = {
    draft:    { label: tx("مسودة", "Draft"),      color: "text-gray-400" },
    sent:     { label: tx("مُرسَلة", "Sent"),      color: "text-blue-400" },
    paid:     { label: tx("مدفوعة", "Paid"),       color: "text-green-400" },
    overdue:  { label: tx("متأخرة", "Overdue"),    color: "text-red-400" },
    cancelled:{ label: tx("ملغاة", "Cancelled"),   color: "text-orange-400" },
  };

  const hr = new Date().getHours();
  const name = user?.firstName ?? (isAr ? "المحامي" : "Counselor");
  const greeting = isAr
    ? hr < 12 ? `صباح الخير، ${name} ⚖️` : hr < 17 ? `مساء الخير، ${name}` : `مساء النور، ${name}`
    : hr < 12 ? `Good morning, ${name} ⚖️` : hr < 17 ? `Good afternoon, ${name}` : `Good evening, ${name}`;
  const greetingSub = isAr
    ? hr < 12 ? "ابدأ يومك بمراجعة القضايا الجديدة ومواعيد الجلسات" : hr < 17 ? "تابع قضاياك الجارية واطلع على آخر التحديثات" : "راجع ملخص يومك وتأكد من الاستعداد لجلسات الغد"
    : hr < 12 ? "Start your day by reviewing new cases and upcoming sessions" : hr < 17 ? "Follow up on active cases and check latest updates" : "Review your day summary and prepare for tomorrow's sessions";

  const kpis = (data?.kpis ?? {}) as any;

  const kpiCards = [
    {
      label: tx("القضايا النشطة", "Active Cases"), value: kpis.activeCases ?? 0,
      sub: tx(`${kpis.totalCases ?? 0} إجمالي | +${kpis.casesThisMonth ?? 0} هذا الشهر`, `${kpis.totalCases ?? 0} total | +${kpis.casesThisMonth ?? 0} this month`),
      icon: Scale, color: "text-primary", bg: "bg-primary/10", href: "/cases",
    },
    {
      label: tx("العملاء", "Clients"), value: kpis.totalClients ?? 0,
      sub: tx(`+${kpis.clientsThisMonth ?? 0} عميل جديد هذا الشهر`, `+${kpis.clientsThisMonth ?? 0} new clients this month`),
      icon: Users, color: "text-blue-400", bg: "bg-blue-500/10", href: "/clients",
    },
    {
      label: tx("الإيرادات المحصّلة", "Collected Revenue"),
      value: `${((kpis.paidRevenue ?? 0) / 100).toLocaleString(dateLocale, { maximumFractionDigits: 0 })} ${tx("ر.س", "SAR")}`,
      sub: tx(`${((kpis.outstanding ?? 0) / 100).toLocaleString(dateLocale, { maximumFractionDigits: 0 })} ر.س مستحقة`,
               `${((kpis.outstanding ?? 0) / 100).toLocaleString(dateLocale, { maximumFractionDigits: 0 })} SAR outstanding`),
      icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10", href: "/invoices",
    },
    {
      label: tx("مهام الذكاء الاصطناعي", "AI Tasks"), value: kpis.aiCompleted ?? 0,
      sub: tx(`نسبة إنجاز القضايا ${kpis.successRate ?? 0}%`, `Case success rate ${kpis.successRate ?? 0}%`),
      icon: Bot, color: "text-purple-400", bg: "bg-purple-500/10", href: "/ai-agents",
    },
  ];

  const quickActions = [
    { label: tx("قضية جديدة", "New Case"),     icon: Scale,        href: "/cases",     color: "border-primary/30 hover:bg-primary/10" },
    { label: tx("عميل جديد", "New Client"),    icon: Users,        href: "/clients",   color: "border-blue-500/30 hover:bg-blue-500/10" },
    { label: tx("فاتورة جديدة", "New Invoice"), icon: Receipt,      href: "/invoices",  color: "border-green-500/30 hover:bg-green-500/10" },
    { label: tx("عقد جديد", "New Contract"),   icon: FileText,     href: "/contracts", color: "border-yellow-500/30 hover:bg-yellow-500/10" },
    { label: tx("المساعد الذكي", "AI Assistant"), icon: Zap,        href: "/ai-chat",   color: "border-purple-500/30 hover:bg-purple-500/10" },
    { label: tx("التقويم", "Calendar"),         icon: CalendarDays, href: "/calendar",  color: "border-orange-500/30 hover:bg-orange-500/10" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ── Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{greeting}</h1>
          <p className="text-muted-foreground text-sm mt-1">{greetingSub}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* ── Executive Pulse Bar — 10 مؤشرات فورية */}
      <ExecutivePulseBar />

      {/* ── AI Intelligence Panel — Autonomous Monitoring */}
      <AiEventsPanel />

      {/* ── Executive Assistant Widget */}
      <ExecutiveAssistant />

      {/* ── KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : kpiCards.map(k => {
              const Icon = k.icon;
              return (
                <Link key={k.label} href={k.href}>
                  <Card className="hover:border-primary/30 transition-all cursor-pointer group">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">{k.label}</p>
                          <p className={`text-2xl font-black mt-1 ${k.color} font-mono`}>{k.value}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{k.sub}</p>
                        </div>
                        <div className={`p-2 rounded-xl ${k.bg}`}>
                          <Icon className={`h-5 w-5 ${k.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
      </div>

      {/* ── Smart Alerts */}
      {(data?.alerts ?? []).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(data?.alerts ?? []).map((alert, i) => (
            <Link key={i} href={alert.action}>
              <div className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all hover:opacity-80 ${
                alert.type === "warning" ? "border-orange-500/30 bg-orange-500/5" :
                alert.type === "info"    ? "border-blue-500/30 bg-blue-500/5" :
                "border-primary/30 bg-primary/5"
              }`}>
                <AlertCircle className={`h-4 w-4 mt-0.5 shrink-0 ${
                  alert.type === "warning" ? "text-orange-400" :
                  alert.type === "info"    ? "text-blue-400" : "text-primary"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{alert.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{alert.body}</p>
                </div>
                <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              {tx("الإيرادات (6 أشهر)", "Revenue (6 months)")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[200px]" /> : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.revenueChart ?? []}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}
                      tickFormatter={v => `${v.toLocaleString(dateLocale)} ${tx("ر.س","SAR")}`} width={75} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(v: any) => [`${Number(v).toLocaleString(dateLocale)} ${tx("ر.س","SAR")}`, tx("الإيرادات","Revenue")]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))"
                      strokeWidth={2} fill="url(#revGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Today Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                {tx("جدول اليوم", "Today's Schedule")}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" asChild>
                <Link href="/calendar"><ExternalLink className="h-3 w-3" />{tx("الكل", "All")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : (data?.todayEvents ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <CalendarDays className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">{tx("لا توجد مواعيد اليوم", "No appointments today")}</p>
                <Button size="sm" variant="outline" className="text-xs gap-1 h-7 mt-1" asChild>
                  <Link href="/calendar"><Plus className="h-3 w-3" />{tx("إضافة موعد", "Add appointment")}</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {(data?.todayEvents ?? []).map((ev: any) => {
                  const colorClass = EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.other;
                  const time = ev.all_day ? tx("طوال اليوم","All day") : new Date(ev.start_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div key={ev.id} className={`rounded-xl border p-2.5 ${colorClass}`}>
                      <p className="text-xs font-semibold leading-tight truncate">{ev.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />{time}
                        </span>
                        {ev.location && (
                          <span className="text-[10px] flex items-center gap-1 truncate">
                            <MapPin className="h-2.5 w-2.5" />{ev.location}
                          </span>
                        )}
                        <span className="text-[10px] opacity-70">{EVENT_TYPE_LABEL[ev.event_type] ?? tx("حدث","Event")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Recent Cases */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />{tx("آخر القضايا", "Recent Cases")}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" asChild>
                <Link href="/cases"><ArrowLeft className="h-3 w-3" />{tx("الكل", "All")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />) :
              (data?.recentCases ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">{tx("لا توجد قضايا بعد", "No cases yet")}</p>
              ) : (
                (data?.recentCases ?? []).map((c: any) => {
                  const st = STATUS_MAP[c.status] ?? STATUS_MAP.open;
                  return (
                    <Link key={c.id} href="/cases">
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <Scale className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{c.title}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString(dateLocale)}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${st.color}`}>{st.label}</Badge>
                      </div>
                    </Link>
                  );
                })
              )
            }
          </CardContent>
        </Card>

        {/* ── Recent Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />{tx("آخر الفواتير", "Recent Invoices")}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" asChild>
                <Link href="/invoices"><ArrowLeft className="h-3 w-3" />{tx("الكل", "All")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12" />) :
              (data?.recentInvoices ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">{tx("لا توجد فواتير بعد", "No invoices yet")}</p>
              ) : (
                (data?.recentInvoices ?? []).map((inv: any) => {
                  const st = INV_STATUS[inv.status] ?? INV_STATUS.draft;
                  return (
                    <Link key={inv.id} href="/invoices">
                      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all cursor-pointer">
                        <div className="p-1.5 rounded-lg bg-green-500/10">
                          <Banknote className="h-3.5 w-3.5 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{inv.title}</p>
                          <p className={`text-[10px] font-mono ${st.color}`}>{((inv.total ?? 0) / 100).toLocaleString(dateLocale)} {tx("ر.س","SAR")}</p>
                        </div>
                        <span className={`text-[10px] ${st.color}`}>{st.label}</span>
                      </div>
                    </Link>
                  );
                })
              )
            }
          </CardContent>
        </Card>

        {/* ── Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />{tx("إجراءات سريعة", "Quick Actions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(a => {
                const Icon = a.icon;
                return (
                  <Link key={a.label} href={a.href}>
                    <button className={`w-full flex flex-col items-center gap-2 p-3 rounded-xl border ${a.color} transition-all text-center`}>
                      <Icon className="h-4 w-4" />
                      <span className="text-[10px] font-medium leading-tight">{a.label}</span>
                    </button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Live Event Feed ── */}
      <LiveEventFeed />

      {/* ── Upcoming Events */}
      {(data?.upcomingEvents ?? []).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                {tx("المواعيد القادمة (7 أيام)", "Upcoming Events (7 days)")}
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-xs h-7" asChild>
                <Link href="/calendar">{tx("عرض التقويم", "View Calendar")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {(data?.upcomingEvents ?? []).map((ev: any) => {
                const colorClass = EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.other;
                const date = new Date(ev.start_at);
                const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000);
                return (
                  <div key={ev.id} className={`rounded-xl border p-3 ${colorClass}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight truncate">{ev.title}</p>
                        <p className="text-[10px] mt-1 opacity-80">
                          {date.toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {ev.all_day ? tx("طوال اليوم","All day") : date.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 ${
                        diffDays <= 1 ? "border-red-500/40 text-red-400" :
                        diffDays <= 3 ? "border-orange-500/40 text-orange-400" : "border-current/20"
                      }`}>
                        {diffDays <= 0 ? tx("اليوم","Today") : diffDays === 1 ? tx("غداً","Tomorrow") : `${diffDays}${tx("د","d")}`}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
