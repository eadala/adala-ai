import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Scale, Users, Receipt, Handshake, Bell, Zap, BrainCircuit,
  TrendingUp, Activity, Wifi, WifiOff, RefreshCw, Filter,
  CreditCard, FileText, Shield, Clock, ChevronRight, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/* ── Event meta ─────────────────────────────────────── */
interface LiveEvent {
  id: string;
  type: string;
  label: string;
  officeId?: string;
  actorId?: string;
  data: Record<string, any>;
  timestamp: string;
}

const EVENT_META: Record<string, { icon: any; color: string; bg: string; ring: string }> = {
  CASE_CREATED:        { icon: Scale,       color: "text-blue-400",    bg: "bg-blue-500/10",    ring: "ring-blue-500/30" },
  CASE_UPDATED:        { icon: Scale,       color: "text-blue-300",    bg: "bg-blue-500/8",     ring: "ring-blue-500/20" },
  CASE_CLOSED:         { icon: Scale,       color: "text-slate-400",   bg: "bg-slate-500/10",   ring: "ring-slate-500/20" },
  CLIENT_ADDED:        { icon: Users,       color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30" },
  INVOICE_CREATED:     { icon: Receipt,     color: "text-amber-400",   bg: "bg-amber-500/10",   ring: "ring-amber-500/30" },
  INVOICE_PAID:        { icon: Receipt,     color: "text-green-400",   bg: "bg-green-500/10",   ring: "ring-green-500/30" },
  INVOICE_OVERDUE:     { icon: Receipt,     color: "text-red-400",     bg: "bg-red-500/10",     ring: "ring-red-500/30" },
  PAYMENT_SUCCESS:     { icon: CreditCard,  color: "text-primary",   bg: "bg-primary/10",  ring: "ring-primary/30" },
  PAYMENT_FAILED:      { icon: CreditCard,  color: "text-red-400",     bg: "bg-red-500/10",     ring: "ring-red-500/30" },
  PAYMENT_SETTLED:     { icon: TrendingUp,  color: "text-teal-400",    bg: "bg-teal-500/10",    ring: "ring-teal-500/30" },
  CONTRACT_SIGNED:     { icon: Handshake,   color: "text-violet-400",  bg: "bg-violet-500/10",  ring: "ring-violet-500/30" },
  REMINDER_DUE:        { icon: Bell,        color: "text-orange-400",  bg: "bg-orange-500/10",  ring: "ring-orange-500/30" },
  PORTAL_UPDATED:      { icon: Shield,      color: "text-cyan-400",    bg: "bg-cyan-500/10",    ring: "ring-cyan-500/30" },
  AI_QUERY:            { icon: BrainCircuit,color: "text-purple-400",  bg: "bg-purple-500/10",  ring: "ring-purple-500/30" },
  SUBSCRIPTION_RENEWED:{ icon: Zap,         color: "text-primary",   bg: "bg-primary/10",  ring: "ring-primary/30" },
  DOCUMENT_GENERATED:  { icon: FileText,    color: "text-indigo-400",  bg: "bg-indigo-500/10",  ring: "ring-indigo-500/30" },
  USER_LOGIN:          { icon: Shield,      color: "text-slate-400",   bg: "bg-slate-500/10",   ring: "ring-slate-500/20" },
};

const DEFAULT_META = { icon: Activity, color: "text-muted-foreground", bg: "bg-muted/30", ring: "ring-border" };

function getEventMeta(type: string) { return EVENT_META[type] ?? DEFAULT_META; }

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000)    return `منذ ${Math.floor(diff / 1000)} ث`;
  if (diff < 3_600_000) return `منذ ${Math.floor(diff / 60_000)} د`;
  if (diff < 86_400_000)return `منذ ${Math.floor(diff / 3_600_000)} س`;
  return new Date(ts).toLocaleDateString("ar-SA");
}

function EventSummary({ event }: { event: LiveEvent }) {
  const d = event.data;
  switch (event.type) {
    case "CASE_CREATED":    return <>{d.title ? `"${d.title}"` : ""}{d.clientName ? ` — ${d.clientName}` : ""}</>;
    case "CASE_UPDATED":    return <>{d.title ? `"${d.title}"` : ""}{d.status ? ` → ${d.status}` : ""}</>;
    case "CASE_CLOSED":     return <>{d.title ? `"${d.title}"` : ""}</>;
    case "CLIENT_ADDED":    return <>{d.fullName ?? ""}{d.email ? ` — ${d.email}` : ""}</>;
    case "INVOICE_CREATED": return <>{d.invoiceNumber ? `${d.invoiceNumber} — ` : ""}{d.total ? `${Number(d.total).toLocaleString("ar-SA")} ر.س` : ""}</>;
    case "INVOICE_PAID":    return <>{d.invoiceNumber ? `${d.invoiceNumber} — ` : ""}<span className="text-green-400 font-semibold">{d.total ? `${Number(d.total).toLocaleString("ar-SA")} ر.س` : ""}</span></>;
    case "PAYMENT_SUCCESS": return <><span className="text-primary font-semibold">{d.amount ? `${Number(d.amount).toLocaleString("ar-SA")} ر.س` : ""}</span>{d.clientName ? ` من ${d.clientName}` : ""}{d.gateway ? ` عبر ${d.gateway}` : ""}</>;
    case "PAYMENT_FAILED":  return <><span className="text-red-400">{d.amount ? `${Number(d.amount).toLocaleString("ar-SA")} ر.س` : ""}</span>{d.reason ? ` — ${d.reason}` : ""}</>;
    case "DOCUMENT_GENERATED": return <>{d.title ?? d.docType ?? ""}</>;
    case "AI_QUERY":        return <>{d.question ? `"${String(d.question).slice(0, 60)}…"` : ""}</>;
    default:                return <>{JSON.stringify(d).slice(0, 80)}</>;
  }
}

/* ── Mini stat card ─────────────────────────────────── */
function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}/10`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-black text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════ */
export default function ActivityStream() {
  const [liveEvents,   setLiveEvents]   = useState<LiveEvent[]>([]);
  const [connected,    setConnected]    = useState(false);
  const [filterType,   setFilterType]   = useState("all");
  const [newCount,     setNewCount]     = useState(0);
  const [paused,       setPaused]       = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  /* ── SSE connection ── */
  useEffect(() => {
    function connect() {
      if (esRef.current) esRef.current.close();
      const es = new EventSource(`${BASE}/api/events/stream`);
      esRef.current = es;

      es.onopen    = () => setConnected(true);
      es.onerror   = () => { setConnected(false); setTimeout(connect, 3000); };
      es.onmessage = (e) => {
        try {
          const event: LiveEvent = JSON.parse(e.data);
          if (event.type === "__CONNECTED__") return;
          if (pausedRef.current) { setNewCount(n => n + 1); return; }
          setLiveEvents(prev => [event, ...prev].slice(0, 200));
        } catch {}
      };
    }
    connect();
    return () => esRef.current?.close();
  }, []);

  const resumeFeed = () => {
    setPaused(false);
    setNewCount(0);
  };

  /* ── Historical events ── */
  const { data: history, isLoading: histLoad, refetch } = useQuery<{ events: LiveEvent[]; total: number }>({
    queryKey: ["events-recent", filterType],
    queryFn: () => fetch(
      `${BASE}/api/events/recent?limit=100${filterType !== "all" ? `&type=${filterType}` : ""}`
    ).then(r => r.json()),
    staleTime: 45_000,
    refetchInterval: 60_000,
  });

  /* ── Stats ── */
  const { data: stats } = useQuery<any>({
    queryKey: ["events-stats"],
    queryFn: () => fetch(`${BASE}/api/events/stats`).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  /* Merge live + historical, deduplicate */
  const allEvents: LiveEvent[] = (() => {
    const hist = history?.events ?? [];
    const liveIds = new Set(liveEvents.map(e => e.id));
    const unique  = hist.filter(e => !liveIds.has(e.id));
    const merged  = [...liveEvents, ...unique];
    return filterType === "all" ? merged : merged.filter(e => e.type === filterType);
  })();

  const EVENT_TYPES = [
    { v: "all",              l: "كل الأحداث" },
    { v: "CASE_CREATED",     l: "قضايا جديدة" },
    { v: "CLIENT_ADDED",     l: "عملاء جدد" },
    { v: "INVOICE_CREATED",  l: "فواتير" },
    { v: "PAYMENT_SUCCESS",  l: "مدفوعات" },
    { v: "INVOICE_PAID",     l: "فواتير مدفوعة" },
    { v: "AI_QUERY",         l: "استعلامات AI" },
    { v: "DOCUMENT_GENERATED",l:"وثائق" },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black">نبض النظام</h1>
            <p className="text-xs text-muted-foreground">تدفق الأحداث اللحظي — Event-Driven Core</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}>
            {connected
              ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> متصل</>
              : <><WifiOff className="h-3 w-3" /> منقطع</>}
          </div>
          {stats?.liveClients !== undefined && (
            <Badge variant="outline" className="text-xs gap-1">
              <Wifi className="h-3 w-3" /> {stats.liveClients} متابع
            </Badge>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="أحداث (30 يوم)"  value={stats.total30d?.toLocaleString("ar-SA") ?? "—"} icon={Activity}    color="text-primary" />
          <StatCard label="قضايا جديدة"     value={stats.byType?.find((t: any) => t.type === "CASE_CREATED")?.count ?? 0}    icon={Scale}       color="text-blue-400" />
          <StatCard label="مدفوعات ناجحة"   value={stats.byType?.find((t: any) => t.type === "PAYMENT_SUCCESS")?.count ?? 0} icon={CreditCard}  color="text-primary" />
          <StatCard label="عملاء جدد"       value={stats.byType?.find((t: any) => t.type === "CLIENT_ADDED")?.count ?? 0}    icon={Users}       color="text-emerald-400" />
        </div>
      )}

      {/* Charts row */}
      {stats?.byDay?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">الأحداث اليومية (14 يوم)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={stats.byDay}>
                  <defs>
                    <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748B" }} tickFormatter={d => d?.slice(5) ?? d} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748B" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" name="أحداث" stroke="#2563EB" fill="url(#evGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold">توزيع الأحداث حسب النوع</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={(stats.byType ?? []).slice(0, 7)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#64748B" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#64748B" }} width={85} />
                  <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="العدد" fill="#2563EB" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Live feed */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              تدفق الأحداث اللحظي
              {liveEvents.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{liveEvents.length} جديد</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {newCount > 0 && (
                <Button size="sm" className="h-7 text-xs gap-1 bg-primary hover:bg-[#a8882e] text-[#0B1B2B]"
                  onClick={resumeFeed}>
                  <ChevronRight className="h-3 w-3" /> {newCount} حدث جديد
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                onClick={() => { setPaused(p => !p); if (paused) setNewCount(0); }}>
                {paused ? "▶ استئناف" : "⏸ إيقاف"}
              </Button>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-7 text-xs w-[130px] gap-1">
                  <Filter className="h-3 w-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t.v} value={t.v} className="text-xs">{t.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {histLoad && liveEvents.length === 0 ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...
            </div>
          ) : allEvents.length === 0 ? (
            <div className="text-center py-16">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">لا أحداث بعد — ستظهر هنا فور حدوثها</p>
              <p className="text-xs text-muted-foreground/60 mt-1">جرّب إنشاء قضية أو إضافة عميل</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40 max-h-[560px] overflow-y-auto">
              {allEvents.map((event, idx) => {
                const meta = getEventMeta(event.type);
                const Icon = meta.icon;
                const isNew = liveEvents.some(e => e.id === event.id);
                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-3 px-4 py-3 transition-all duration-300 hover:bg-accent/30 ${
                      isNew && idx < 5 ? "bg-primary/3" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ${meta.bg} ${meta.ring}`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${meta.color}`}>{event.label}</span>
                        {isNew && idx < 3 && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 rounded-full font-semibold">جديد</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        <EventSummary event={event} />
                      </p>
                    </div>

                    {/* Time */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] text-muted-foreground/60">{timeAgo(event.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
