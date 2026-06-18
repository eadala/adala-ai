/**
 * 🏛️ Adala Control Tower — SOC + Admin Observatory
 * لوحة المراقبة الاحترافية — رؤية ٣٦٠° للمنصة
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Badge }    from "@/components/ui/badge";
import { Button }   from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, Zap, Activity, Users, Building2, AlertTriangle,
  Eye, Snowflake, RefreshCw, Wifi, WifiOff, Lock, Unlock,
  CheckCircle2, XCircle, Brain, Server, Clock,
  ChevronRight, Play, Square, Radio,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────── */
interface LiveTick {
  timestamp: number; memory: { used: number; total: number; percent: number };
  dbLatency: number; errorRate: number; uptime: number;
  totalRequests: number; failedRequests: number;
  activeUsers: number; aiLoad: number;
  mode: "stable" | "degraded" | "safe_mode";
  aiLock: boolean; tenantCount: number; frozenCount: number;
}
interface Tenant {
  office_id: string; office_name: string;
  members: number; cases: number; invoices: number;
  last_activity: string | null; frozen: boolean;
}
interface SecurityEvent {
  event_type: string; office_id: string | null;
  severity: "HIGH" | "MEDIUM" | "LOW"; created_at: string; source: string;
}
interface Metrics {
  systemHealth: {
    status: string; aiLock: boolean; productionMode: boolean;
    dbHealth: boolean; dbLatency: number; memory: { used: number; total: number; percent: number };
    uptime: number; errorRate: number; totalRequests: number; failedRequests: number;
    webhookFailures: number;
  };
  activeUsers: number; aiLoad: number;
  tenantMatrix: Tenant[]; securityFeed: SecurityEvent[];
  frozenTenants: string[]; timestamp: number;
}
interface InspectData {
  tenantId: string; frozen: boolean;
  cases: any[]; clients: any[]; invoices: any[];
  auditLogs: any[]; members: any[]; aiActivity: any[];
}

/* ── API helper ─────────────────────────────────────────────────────── */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiUrl(path: string) { return `${BASE}/api${path}`; }

/* ── Severity config ─────────────────────────────────────────────────── */
const SEV: Record<string, { color: string; dot: string; label: string }> = {
  HIGH:   { color: "text-red-400",    dot: "bg-red-500",    label: "خطر عالٍ"  },
  MEDIUM: { color: "text-amber-400",  dot: "bg-amber-500",  label: "متوسط"     },
  LOW:    { color: "text-emerald-400", dot: "bg-emerald-500", label: "منخفض"   },
};

/* ── Utils ──────────────────────────────────────────────────────────── */
function fmtUptime(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}
function fmtBytes(b: number) {
  if (b > 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  return `${(b / 1e6).toFixed(0)} MB`;
}
function relTime(ts: string | null) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return "الآن";
  if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} د`;
  if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} س`;
  return new Date(ts).toLocaleDateString("ar-SA");
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */
export default function ControlTower() {
  const { getToken } = useAuth();
  const { toast }    = useToast();
  const qc           = useQueryClient();

  /* live SSE state */
  const [live, setLive]     = useState<LiveTick | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  /* inspect modal */
  const [inspectId, setInspectId]     = useState<string | null>(null);
  const [inspectTab, setInspectTab]   = useState("cases");

  /* async token (for authenticated fetch) */
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { getToken().then(t => setToken(t ?? null)); }, [getToken]);

  /* authenticated fetch helper */
  const authFetch = useCallback(async (url: string, opts: RequestInit = {}) => {
    const t = token ?? await getToken();
    return fetch(url, {
      ...opts,
      headers: { ...(opts.headers ?? {}), Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    });
  }, [token, getToken]);

  /* ── SSE connection ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!token) return;
    function connect() {
      if (esRef.current) esRef.current.close();
      const url = `${apiUrl("/control-tower/stream")}?_auth=${encodeURIComponent(token!)}`;
      const es   = new EventSource(url);
      esRef.current = es;

      es.onopen    = () => setConnected(true);
      es.onerror   = () => { setConnected(false); setTimeout(connect, 5000); };
      es.onmessage = (e) => {
        try { setLive(JSON.parse(e.data)); } catch {}
      };
    }
    connect();
    return () => esRef.current?.close();
  }, [token]);

  /* ── Main metrics query (polls every 30 s as fallback) ─────────── */
  const { data: metrics, refetch: refreshMetrics } = useQuery<Metrics>({
    queryKey: ["control-tower-metrics"],
    queryFn: async () => {
      const r = await authFetch(apiUrl("/control-tower/metrics"));
      if (!r.ok) throw new Error("Unauthorized");
      return r.json();
    },
    enabled: !!token,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  /* ── Deep Inspect query ─────────────────────────────────────────── */
  const { data: inspectData, isLoading: inspecting } = useQuery<InspectData>({
    queryKey: ["ct-inspect", inspectId],
    queryFn: async () => {
      const r = await authFetch(apiUrl(`/control-tower/inspect/${inspectId}`));
      return r.json();
    },
    enabled: !!inspectId && !!token,
  });

  /* ── Mutations ─────────────────────────────────────────────────── */
  const freezeMut = useMutation({
    mutationFn: async ({ id, freeze }: { id: string; freeze: boolean }) => {
      const r = await authFetch(apiUrl(`/control-tower/freeze/${id}`), {
        method: freeze ? "POST" : "DELETE",
        body: JSON.stringify({ reason: "Control Tower action" }),
      });
      return r.json();
    },
    onSuccess: (_, { freeze }) => {
      toast({ title: freeze ? "تم تجميد المكتب ❄️" : "تم رفع التجميد ✅" });
      qc.invalidateQueries({ queryKey: ["control-tower-metrics"] });
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),

  });

  const aiLockMut = useMutation({
    mutationFn: async (locked: boolean) => {
      const r = await authFetch(apiUrl("/control-tower/ai-lock"), {
        method: "POST", body: JSON.stringify({ locked }),
      });
      return r.json();
    },
    onSuccess: (_, locked) => {
      toast({ title: locked ? "🔒 AI مُقفَل" : "🤖 AI مفعَّل مجدداً" });
      refreshMetrics();
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),

  });

  /* ── Derived values ─────────────────────────────────────────────── */
  const tenants    = metrics?.tenantMatrix ?? [];
  const secFeed    = metrics?.securityFeed ?? [];
  const health     = metrics?.systemHealth;
  const memPct     = live?.memory.percent ?? health?.memory.percent ?? 0;
  const dbLatency  = live?.dbLatency      ?? health?.dbLatency ?? 0;
  const errorRate  = live?.errorRate      ?? health?.errorRate ?? 0;
  const uptime     = live?.uptime         ?? health?.uptime ?? 0;
  const aiLocked   = live?.aiLock         ?? health?.aiLock ?? false;
  const sysMode    = live?.mode           ?? (health?.status as any) ?? "stable";
  const activeUsers = live?.activeUsers   ?? metrics?.activeUsers ?? 0;
  const aiLoad     = live?.aiLoad         ?? metrics?.aiLoad ?? 0;

  const statusColor = sysMode === "safe_mode"
    ? "text-red-400 border-red-400/30 bg-red-400/10"
    : sysMode === "degraded"
    ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
    : "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";

  const highEvents = secFeed.filter(e => e.severity === "HIGH").length;

  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#070D1A] text-slate-200 p-4 md:p-6" dir="rtl">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Shield className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Control Tower
                <Badge className={`text-[10px] border ${statusColor} font-mono`}>
                  {sysMode.toUpperCase()}
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground font-mono">منصة عدالة AI — مركز المراقبة المركزي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* SSE indicator */}
            <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-mono ${
              connected ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                        : "text-muted-foreground border-slate-600/30 bg-slate-800/50"
            }`}>
              {connected
                ? <><Radio className="h-3 w-3 animate-pulse" /> LIVE</>
                : <><WifiOff className="h-3 w-3" /> OFFLINE</>}
            </div>
            <Button size="sm" variant="outline"
              className="border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700"
              onClick={() => refreshMetrics()}>
              <RefreshCw className="h-3.5 w-3.5 me-1" />
              تحديث
            </Button>
          </div>
        </div>

        {/* ── Top KPI Row ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
          <KpiCard icon={<Activity className="h-4 w-4" />} label="DB Latency" value={`${dbLatency} ms`}
            status={dbLatency < 100 ? "good" : dbLatency < 300 ? "warn" : "bad"} mono />
          <KpiCard icon={<Server className="h-4 w-4" />} label="RAM" value={`${memPct}%`}
            status={memPct < 70 ? "good" : memPct < 90 ? "warn" : "bad"}>
            <Progress value={memPct} className="h-1 mt-1 bg-slate-700" />
          </KpiCard>
          <KpiCard icon={<XCircle className="h-4 w-4" />} label="Error Rate" value={`${errorRate}%`}
            status={errorRate < 1 ? "good" : errorRate < 5 ? "warn" : "bad"} mono />
          <KpiCard icon={<Clock className="h-4 w-4" />} label="Uptime" value={fmtUptime(uptime)} status="good" mono />
          <KpiCard icon={<Users className="h-4 w-4" />} label="المستخدمون الآن" value={String(activeUsers)} status="good" />
          <KpiCard icon={<Brain className="h-4 w-4" />} label="AI Tasks" value={String(aiLoad)}
            status={aiLoad < 10 ? "good" : aiLoad < 50 ? "warn" : "bad"} />
        </div>

        {/* ── Main Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── Tenant Matrix (left 2 cols) ──────────────────── */}
          <div className="lg:col-span-2 bg-[#0D1629] border border-slate-800/60 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Building2 className="h-4 w-4 text-blue-400" />
                Tenant Matrix
                <Badge variant="secondary" className="text-[10px] bg-slate-800 text-muted-foreground border-slate-700">
                  {tenants.length} مكتب
                </Badge>
              </div>
              {live && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(live.timestamp).toLocaleTimeString("ar-SA")}
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800/40">
                    <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">المكتب</th>
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">أعضاء</th>
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">قضايا</th>
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">فواتير</th>
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">آخر نشاط</th>
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">الحالة</th>
                    <th className="text-center px-3 py-2.5 text-muted-foreground font-medium">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-muted-foreground">
                        <Building2 className="h-6 w-6 mx-auto mb-2 opacity-30" />
                        لا توجد مكاتب
                      </td>
                    </tr>
                  ) : tenants.map((t) => (
                    <tr key={t.office_id}
                      className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {t.frozen && <Snowflake className="h-3 w-3 text-blue-400 shrink-0" />}
                          <div>
                            <p className="font-medium text-slate-200 truncate max-w-[140px]">{t.office_name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{t.office_id.slice(0, 8)}…</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 text-muted-foreground tabular-nums">{t.members}</td>
                      <td className="text-center px-3 py-3 text-muted-foreground tabular-nums">{t.cases}</td>
                      <td className="text-center px-3 py-3 text-muted-foreground tabular-nums">{t.invoices}</td>
                      <td className="text-center px-3 py-3 text-muted-foreground text-[10px]">
                        {relTime(t.last_activity)}
                      </td>
                      <td className="text-center px-3 py-3">
                        {t.frozen ? (
                          <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">❄️ مجمَّد</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">✓ نشط</Badge>
                        )}
                      </td>
                      <td className="text-center px-3 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10"
                                onClick={() => { setInspectId(t.office_id); setInspectTab("cases"); }}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>فحص عميق</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost"
                                className={`h-7 w-7 p-0 ${t.frozen
                                  ? "text-blue-400 hover:text-slate-300 hover:bg-slate-700/50"
                                  : "text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10"}`}
                                onClick={() => freezeMut.mutate({ id: t.office_id, freeze: !t.frozen })}
                                disabled={freezeMut.isPending}>
                                {t.frozen
                                  ? <Unlock className="h-3.5 w-3.5" />
                                  : <Snowflake className="h-3.5 w-3.5" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t.frozen ? "رفع التجميد" : "تجميد المكتب"}</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Right Column ─────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* System Health */}
            <div className="bg-[#0D1629] border border-slate-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-200">
                <Zap className="h-4 w-4 text-amber-400" />
                System Health
              </div>
              <div className="space-y-2.5">
                <HealthRow label="Database" value={health?.dbHealth ? "Healthy" : "DOWN"}
                  ok={!!health?.dbHealth} />
                <HealthRow label="API Server" value="Operational" ok={true} />
                <HealthRow label="Stripe" value={health?.webhookFailures === 0 ? "OK" : `${health?.webhookFailures} failures`}
                  ok={(health?.webhookFailures ?? 0) === 0} />
                <HealthRow label="Production Lock" value={health?.productionMode ? "Active" : "Off"}
                  ok={!!health?.productionMode} />
                <HealthRow label="RAM"
                  value={health ? `${fmtBytes(health.memory.used)} / ${fmtBytes(health.memory.total)}` : "—"}
                  ok={(health?.memory.percent ?? 0) < 85} />
              </div>
            </div>

            {/* AI Control Panel */}
            <div className="bg-[#0D1629] border border-slate-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-200">
                <Brain className="h-4 w-4 text-purple-400" />
                AI Control Panel
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-300">AI Kill Switch</p>
                    <p className="text-[10px] text-muted-foreground">
                      {aiLocked ? "كل عمليات الذكاء الاصطناعي مُوقفة" : "الذكاء الاصطناعي يعمل بشكل طبيعي"}
                    </p>
                  </div>
                  <Button size="sm"
                    onClick={() => aiLockMut.mutate(!aiLocked)}
                    disabled={aiLockMut.isPending}
                    className={aiLocked
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs"
                      : "bg-red-600/80 hover:bg-red-600 text-white h-8 text-xs"}>
                    {aiLocked
                      ? <><Play className="h-3 w-3 me-1" />تفعيل</>
                      : <><Square className="h-3 w-3 me-1" />إيقاف</>}
                  </Button>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <p className="text-xs text-muted-foreground">مهام AI معلّقة</p>
                  <Badge className={`text-[10px] font-mono ${
                    aiLoad === 0 ? "bg-slate-800 text-muted-foreground"
                    : aiLoad < 10 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  }`}>
                    {aiLoad}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-[#0D1629] border border-slate-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-200">
                <Activity className="h-4 w-4 text-blue-400" />
                نظرة عامة
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatMini label="المكاتب" value={tenants.length} />
                <StatMini label="مجمَّد" value={tenants.filter(t => t.frozen).length} highlight />
                <StatMini label="المستخدمون الآن" value={activeUsers} />
                <StatMini label="أحداث عالية الخطورة" value={highEvents} highlight={highEvents > 0} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Security Feed ─────────────────────────────────────── */}
        <div className="mt-4 bg-[#0D1629] border border-slate-800/60 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/60">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-200">Security Feed</span>
            {highEvents > 0 && (
              <Badge className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30 animate-pulse">
                {highEvents} HIGH
              </Badge>
            )}
          </div>
          <div className="divide-y divide-slate-800/30 max-h-64 overflow-y-auto">
            {secFeed.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-2 opacity-30" />
                لا أحداث أمنية مسجّلة
              </div>
            ) : secFeed.map((ev, i) => {
              const s = SEV[ev.severity] ?? SEV.LOW;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/20">
                  <div className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-mono font-medium ${s.color}`}>{ev.event_type}</p>
                    {ev.office_id && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{ev.office_id.slice(0, 16)}…</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-[10px] border shrink-0 ${
                    ev.source === "audit" ? "border-purple-500/30 text-purple-400" : "border-slate-600 text-muted-foreground"
                  }`}>{ev.source}</Badge>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden md:block">
                    {relTime(ev.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Deep Inspect Modal ───────────────────────────────── */}
        <Dialog open={!!inspectId} onOpenChange={(o) => !o && setInspectId(null)}>
          <DialogContent className="max-w-3xl bg-[#0D1629] border-slate-700 text-slate-200" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-100">
                <Eye className="h-4 w-4 text-blue-400" />
                فحص عميق — {tenants.find(t => t.office_id === inspectId)?.office_name ?? inspectId?.slice(0, 12)}
                {inspectData?.frozen && <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">❄️ مجمَّد</Badge>}
              </DialogTitle>
            </DialogHeader>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-700/60 pb-0 -mb-1">
              {[
                { id: "cases",    label: `قضايا (${inspectData?.cases.length ?? 0})`     },
                { id: "clients",  label: `عملاء (${inspectData?.clients.length ?? 0})`    },
                { id: "invoices", label: `فواتير (${inspectData?.invoices.length ?? 0})`  },
                { id: "audit",    label: `سجل (${inspectData?.auditLogs.length ?? 0})`    },
                { id: "members",  label: `أعضاء (${inspectData?.members.length ?? 0})`    },
              ].map(t => (
                <button key={t.id}
                  onClick={() => setInspectTab(t.id)}
                  className={`text-xs px-3 py-2 rounded-t-md transition-colors border-b-2 -mb-px ${
                    inspectTab === t.id
                      ? "border-blue-500 text-blue-400 bg-blue-500/5"
                      : "border-transparent text-muted-foreground hover:text-slate-300"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-80 overflow-y-auto">
              {inspecting ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-xs gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" /> جارٍ التحميل…
                </div>
              ) : (
                <InspectPanel data={inspectData} tab={inspectTab} />
              )}
            </div>

            {/* Actions in modal */}
            {inspectId && inspectData && (
              <div className="flex gap-2 pt-2 border-t border-slate-700/60">
                <Button size="sm" variant="outline"
                  className="border-slate-700 text-slate-300 hover:bg-slate-700 text-xs"
                  onClick={() => {
                    freezeMut.mutate({ id: inspectId, freeze: !inspectData.frozen });
                    qc.invalidateQueries({ queryKey: ["ct-inspect", inspectId] });
                  }}
                  disabled={freezeMut.isPending}>
                  {inspectData.frozen
                    ? <><Unlock className="h-3 w-3 me-1" />رفع التجميد</>
                    : <><Snowflake className="h-3 w-3 me-1" />تجميد المكتب</>}
                </Button>
                <Button size="sm" variant="ghost"
                  className="text-muted-foreground hover:text-slate-300 text-xs"
                  onClick={() => setInspectId(null)}>
                  إغلاق
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </AdminLayout>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────── */

function KpiCard({ icon, label, value, status, mono, children }: {
  icon: React.ReactNode; label: string; value: string;
  status: "good" | "warn" | "bad"; mono?: boolean; children?: React.ReactNode;
}) {
  const colors = { good: "text-emerald-400", warn: "text-amber-400", bad: "text-red-400" };
  return (
    <div className="bg-[#0D1629] border border-slate-800/60 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1.5">
        {icon} {label}
      </div>
      <p className={`text-lg font-bold ${colors[status]} ${mono ? "font-mono" : ""}`}>{value}</p>
      {children}
    </div>
  );
}

function HealthRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {ok
          ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          : <XCircle className="h-3 w-3 text-red-400" />}
        <span className={`text-[11px] font-mono ${ok ? "text-emerald-400" : "text-red-400"}`}>{value}</span>
      </div>
    </div>
  );
}

function StatMini({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
      <p className={`text-lg font-bold font-mono ${highlight && value > 0 ? "text-amber-400" : "text-slate-200"}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function InspectPanel({ data, tab }: { data: InspectData | undefined; tab: string }) {
  if (!data) return null;
  const rows = {
    cases:    data.cases.map(r => ({ key: r.id, cols: [r.title ?? "—", r.status, relTime(r.created_at)] })),
    clients:  data.clients.map(r => ({ key: r.id, cols: [r.name, r.email ?? "—", relTime(r.created_at)] })),
    invoices: data.invoices.map(r => ({ key: r.id, cols: [r.invoice_number ?? r.id.slice(0,8), `${r.amount ?? 0}`, r.status, relTime(r.created_at)] })),
    audit:    data.auditLogs.map((r, i) => ({ key: i, cols: [r.action, r.resource ?? "—", r.user_full_name ?? "—", relTime(r.created_at)] })),
    members:  data.members.map((r, i) => ({ key: i, cols: [r.user_id?.slice(0, 16) ?? "—", r.role ?? "member", relTime(r.created_at)] })),
  } as Record<string, { key: any; cols: string[] }[]>;

  const items = rows[tab] ?? [];
  if (items.length === 0)
    return <div className="text-center py-8 text-muted-foreground text-xs">لا توجد بيانات</div>;

  return (
    <table className="w-full text-xs">
      <tbody>
        {items.map(row => (
          <tr key={row.key} className="border-b border-slate-800/30 hover:bg-slate-800/20">
            {row.cols.map((c, ci) => (
              <td key={ci} className="px-3 py-2 text-muted-foreground font-mono truncate max-w-[180px]">{c}</td>
            ))}
            <td className="px-3 py-2 text-right">
              <ChevronRight className="h-3 w-3 text-foreground/70" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
