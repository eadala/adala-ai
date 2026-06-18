import { useState, useCallback, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import {
  Cpu, MemoryStick, Database, Activity, AlertTriangle,
  CheckCircle2, XCircle, Zap, RefreshCw, Play,
  TrendingUp, TrendingDown, Users, Building2,
  DollarSign, ShieldAlert, Wrench, Brain,
  Clock, ArrowUpRight, ArrowDownRight, Target,
  CircleCheck, CircleDot, Loader2,
} from "lucide-react";

const API = "/api";

function apiUrl(path: string) {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}${API}${path}`;
}

async function authFetch(url: string, opts: RequestInit = {}, getToken?: () => Promise<string | null>) {
  const token = getToken ? await getToken() : null;
  const headers: Record<string,string> = { "Content-Type": "application/json", ...(opts.headers as Record<string,string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
  return res.json();
}

/* ── Severity helpers ── */
const sevColor = (s: string) =>
  s === "critical" ? "text-red-400"    :
  s === "high"     ? "text-orange-400" :
  s === "medium"   ? "text-amber-400"  : "text-emerald-400";

const sevBg = (s: string) =>
  s === "critical" ? "bg-red-500/10 border-red-500/30"       :
  s === "high"     ? "bg-orange-500/10 border-orange-500/30" :
  s === "medium"   ? "bg-amber-500/10 border-amber-500/30"   : "bg-emerald-500/10 border-emerald-500/30";

const sevBadge = (s: string) =>
  s === "critical" ? "bg-red-500/20 text-red-300 border-red-500/30"       :
  s === "high"     ? "bg-orange-500/20 text-orange-300 border-orange-500/30" :
  s === "medium"   ? "bg-amber-500/20 text-amber-300 border-amber-500/30"  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}م` :
  n >= 1_000     ? `${(n/1_000).toFixed(1)}ك`     : String(Math.round(n));

function MetricCard({ icon: Icon, label, value, sub, color = "text-blue-400" }: any) {
  return (
    <div className="p-3 rounded-xl border border-border bg-card flex items-center gap-3">
      <Icon className={`h-5 w-5 shrink-0 ${color}`} />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export default function ProductionOS() {
  const { getToken } = useAuth();
  const _getToken = getToken;
  const qc = useQueryClient();
  const [tickResult, setTickResult] = useState<any>(null);
  const [pilotResult, setPilotResult] = useState<any>(null);

  /* ── Status polling ── */
  const { data: status, refetch: refetchStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["prod-os-status"],
    queryFn: () => authFetch(apiUrl("/production-os/status"), {}, _getToken),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  /* ── Incidents ── */
  const { data: incidents, refetch: refetchIncidents } = useQuery({
    queryKey: ["prod-os-incidents"],
    queryFn: () => authFetch(apiUrl("/production-os/incidents"), {}, _getToken),
    staleTime: 30_000,
  });

  /* ── Business Pulse ── */
  const { data: pulse, refetch: refetchPulse, isLoading: pulseLoading } = useQuery({
    queryKey: ["prod-os-pulse"],
    queryFn: () => authFetch(apiUrl("/production-os/business-pulse"), {}, _getToken),
    staleTime: 60_000,
  });

  /* ── Tick mutation ── */
  const tickMut = useMutation({
    mutationFn: () => authFetch(apiUrl("/production-os/tick"), { method: "POST" }, _getToken),
    onSuccess: (data) => {
      setTickResult(data);
      qc.invalidateQueries({ queryKey: ["prod-os-status"] });
      qc.invalidateQueries({ queryKey: ["prod-os-incidents"] });
    },
  });

  /* ── Business Pilot mutation ── */
  const pilotMut = useMutation({
    mutationFn: () => authFetch(apiUrl("/production-os/business-pilot"), { method: "POST" }, _getToken),
    onSuccess: (data) => { setPilotResult(data); qc.invalidateQueries({ queryKey: ["prod-os-pulse"] }); },
  });

  /* ── Resolve incident mutation ── */
  const resolveInc = useMutation({
    mutationFn: (id: string) => authFetch(apiUrl(`/production-os/incidents/${id}/resolve`), { method: "PATCH" }, _getToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prod-os-incidents"] }),
  });

  const m = status?.metrics;
  const alerts: any[] = status?.alerts ?? [];
  const healLog: any[] = status?.healLog ?? [];
  const incList: any[] = incidents?.incidents ?? [];

  return (
    <AdminLayout>
      <div className="p-4 space-y-4 max-w-6xl mx-auto" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Cpu className="h-5 w-5 text-blue-400" />
              Production OS
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              MetricsPipeline · AlertEngine · AutoHealing · BusinessAutopilot
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`border ${status ? sevBadge(status.severity ?? "low") : "bg-muted text-muted-foreground"}`}>
              {statusLoading ? "جاري الفحص..." :
               status?.status === "healthy" ? "✓ سليم" : `⚠ ${status?.severity ?? "غير معروف"}`}
            </Badge>
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { refetchStatus(); refetchPulse(); }}>
              <RefreshCw className="h-3.5 w-3.5" />تحديث
            </Button>
          </div>
        </div>

        {/* Live Metrics Row */}
        {m && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <MetricCard icon={Cpu}      label="CPU Load Avg"   value={m.cpu}         sub="1-min average"   color={m.cpu > 2 ? "text-red-400" : "text-blue-400"} />
            <MetricCard icon={MemoryStick} label="Memory"     value={`${m.memoryPct}%`} sub={`${m.memoryUsedMB}MB used`} color={m.memoryPct > 75 ? "text-orange-400" : "text-purple-400"} />
            <MetricCard icon={Database} label="DB Latency"     value={`${m.dbLatencyMs}ms`} sub={m.dbHealth ? "متصل ✓" : "مشكلة ✗"} color={m.dbLatencyMs > 400 ? "text-red-400" : "text-emerald-400"} />
            <MetricCard icon={Activity} label="Error Rate"     value={`${m.errorRate}%`} sub={`${m.totalRequests} طلب/دقيقة`} color={m.errorRate > 2 ? "text-red-400" : "text-emerald-400"} />
            <MetricCard icon={Building2} label="مكاتب نشطة"   value={m.activeOffices} sub="office_registry" color="text-blue-400" />
            <MetricCard icon={Brain}    label="AI Pending"     value={m.aiPending}   sub="مهام معلقة"     color={m.aiPending > 30 ? "text-orange-400" : "text-violet-400"} />
            <MetricCard icon={DollarSign} label="فواتير متأخرة" value={m.overdueInvoices} sub="تحتاج متابعة" color={m.overdueInvoices > 10 ? "text-amber-400" : "text-emerald-400"} />
            <MetricCard icon={Clock}    label="Uptime"         value={`${Math.floor(m.uptimeSec/3600)}h ${Math.floor((m.uptimeSec%3600)/60)}m`} sub="منذ آخر إعادة تشغيل" color="text-slate-400" />
          </div>
        )}

        <Tabs defaultValue="system" dir="rtl">
          <TabsList className="flex-wrap h-auto gap-1 bg-transparent p-0 justify-start">
            {[
              { v: "system",   label: "System Health",    icon: Activity },
              { v: "healing",  label: "Auto-Healing",     icon: Wrench },
              { v: "incidents",label: "Incidents",         icon: AlertTriangle },
              { v: "business", label: "Business Autopilot", icon: Brain },
            ].map(t => (
              <TabsTrigger key={t.v} value={t.v}
                className="text-xs gap-1.5 data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-300 border border-transparent data-[state=active]:border-blue-500/30 rounded-lg px-3 py-2">
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ══════════ SYSTEM HEALTH ══════════ */}
          <TabsContent value="system" className="mt-4 space-y-4">

            {/* Run Tick Button */}
            <Card className="border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Play className="h-4 w-4 text-blue-400" />
                  MetricsPipeline → AlertEngine → AutoHealingEngine
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  دورة فحص كاملة — يقيس النظام، يكشف الشذوذات، وينفّذ الإصلاح تلقائياً
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => tickMut.mutate()}
                  disabled={tickMut.isPending}
                  className="w-full gap-2 bg-blue-700/80 hover:bg-blue-700"
                >
                  {tickMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {tickMut.isPending ? "جاري تشغيل دورة الإصلاح..." : "تشغيل Production Tick"}
                </Button>

                {tickResult && (
                  <div className={`p-3 rounded-lg border ${sevBg(tickResult.status)}`}>
                    <div className="flex items-center gap-3 mb-2">
                      {tickResult.healed
                        ? <Wrench className="h-5 w-5 text-amber-400" />
                        : <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                      <div>
                        <p className="text-sm font-bold">
                          {tickResult.healed ? `تم الإصلاح التلقائي — ${tickResult.actionsTaken?.length} إجراء` : "النظام سليم — لا إجراءات مطلوبة"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {tickResult.alerts?.length > 0 ? `${tickResult.alerts.length} تنبيه` : "صفر تنبيهات"}
                          {tickResult.incidentId && ` | Incident: ${String(tickResult.incidentId).slice(0,8)}…`}
                        </p>
                      </div>
                    </div>

                    {tickResult.actionsTaken?.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {tickResult.actionsTaken.map((a: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-black/20">
                            <CircleCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                            <span className="font-mono text-blue-300">{a.action}</span>
                            <span className="text-muted-foreground">{a.result}</span>
                            <span className="mr-auto text-muted-foreground">{a.ms}ms</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alert Feed */}
            {alerts.length > 0 && (
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    تنبيهات النظام الحية ({alerts.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {alerts.map((a: any, i: number) => (
                    <div key={i} className={`p-2.5 rounded-lg border ${sevBg(a.level)} text-xs flex items-center gap-3`}>
                      <span className={`font-bold ${sevColor(a.level)}`}>{a.level.toUpperCase()}</span>
                      <span className="font-mono text-blue-300">{a.id}</span>
                      <span className="font-medium">{a.title}</span>
                      <span className="text-muted-foreground mr-auto">{a.detail}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {alerts.length === 0 && !statusLoading && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                جميع مقاييس النظام ضمن الحدود الطبيعية
              </div>
            )}
          </TabsContent>

          {/* ══════════ AUTO-HEALING ══════════ */}
          <TabsContent value="healing" className="mt-4 space-y-3">

            <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300 space-y-1">
              <p className="font-bold">إجراءات الإصلاح التلقائي المتاحة</p>
              <div className="grid grid-cols-2 gap-1 mt-2">
                {[
                  { trigger: "CPU_SPIKE",    action: "إلغاء المهام الثقيلة في الخلفية" },
                  { trigger: "MEMORY_HIGH",  action: "مسح كاش جميع المكاتب + GC hint" },
                  { trigger: "AI_QUEUE",     action: "إلغاء مهام AI معلقة > 10 دقائق" },
                  { trigger: "DB_SLOW",      action: "تسجيل التحذير + تفعيل Cache Mode" },
                  { trigger: "ERROR_SPIKE",  action: "لقطة أخطاء فورية للمراجعة" },
                ].map(h => (
                  <div key={h.trigger} className="p-2 rounded border border-border bg-muted/10">
                    <p className="font-mono text-[10px] text-violet-300">{h.trigger}</p>
                    <p className="text-[10px] text-muted-foreground">{h.action}</p>
                  </div>
                ))}
              </div>
            </div>

            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-400" />
                  سجل الإصلاحات الأخيرة
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healLog.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">لا توجد إصلاحات حتى الآن — النظام سليم</p>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {healLog.map((h: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded border border-border bg-muted/5 text-xs">
                        <Wrench className="h-3 w-3 text-amber-400 shrink-0" />
                        <span className="font-mono text-blue-300 w-36 shrink-0 truncate">{h.action}</span>
                        <span className="text-muted-foreground flex-1 truncate">{h.result}</span>
                        <span className="text-muted-foreground shrink-0">
                          {new Date(h.created_at).toLocaleString("ar")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══════════ INCIDENTS ══════════ */}
          <TabsContent value="incidents" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{incList.length} حادثة مسجّلة</p>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => refetchIncidents()}>
                <RefreshCw className="h-3.5 w-3.5" />تحديث
              </Button>
            </div>

            {incList.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                لا حوادث مسجّلة — سجّل نقرة "Production Tick" لبدء المراقبة
              </div>
            )}

            <div className="space-y-2">
              {incList.map((inc: any) => {
                const alerts: any[] = typeof inc.alerts === "string" ? JSON.parse(inc.alerts) : inc.alerts ?? [];
                const actions: any[] = typeof inc.actions_taken === "string" ? JSON.parse(inc.actions_taken) : inc.actions_taken ?? [];
                return (
                  <Card key={inc.id} className={`border ${inc.status === "resolved" ? "border-border opacity-60" : sevBg(inc.severity)}`}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {inc.status === "resolved"
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            : <AlertTriangle className={`h-4 w-4 shrink-0 ${sevColor(inc.severity)}`} />}
                          <div>
                            <p className="text-xs font-bold">
                              {alerts.map((a: any) => a.id).join(" · ")}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(inc.created_at).toLocaleString("ar")}
                              {inc.resolved_at && ` → حُلّ: ${new Date(inc.resolved_at).toLocaleString("ar")}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-[10px] border ${sevBadge(inc.severity)}`}>{inc.severity}</Badge>
                          {inc.status === "open" && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                              onClick={() => resolveInc.mutate(inc.id)}>
                              حلّ
                            </Button>
                          )}
                        </div>
                      </div>
                      {actions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {actions.map((a: any, i: number) => (
                            <div key={i} className="text-[10px] flex gap-2 text-muted-foreground">
                              <span className="text-emerald-400">✓</span>
                              <span className="font-mono text-blue-300">{a.action}</span>
                              <span>{a.result}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ══════════ BUSINESS AUTOPILOT ══════════ */}
          <TabsContent value="business" className="mt-4 space-y-4">

            <div className="grid md:grid-cols-2 gap-4">
              {/* Business Metrics */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    Business Pulse (البيانات الحية)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {pulseLoading && <p className="text-xs text-muted-foreground text-center py-4">جاري تحليل البيانات...</p>}
                  {pulse && (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {[
                          { label: "مكاتب نشطة",     value: pulse.platform?.activeOffices,    color: "text-blue-400" },
                          { label: "جديدة (30 يوم)",  value: pulse.platform?.newOffices30d,    color: "text-emerald-400" },
                          { label: "خطر إلغاء",       value: `${pulse.platform?.atRiskOffices} (${pulse.platform?.churnRiskPct}%)`, color: pulse.platform?.churnRiskPct > 15 ? "text-red-400" : "text-amber-400" },
                          { label: "إيرادات 30 يوم",  value: `${fmt(pulse.finance?.rev30d)} ريال`, color: "text-emerald-400" },
                          { label: "نمو الإيرادات",   value: `${pulse.finance?.revGrowthPct > 0 ? "+" : ""}${pulse.finance?.revGrowthPct}%`, color: pulse.finance?.revGrowthPct >= 0 ? "text-emerald-400" : "text-red-400" },
                          { label: "فواتير غير مدفوعة", value: pulse.finance?.unpaidInv,       color: pulse.finance?.unpaidInv > 10 ? "text-amber-400" : "text-muted-foreground" },
                        ].map(item => (
                          <div key={item.label} className="p-2 rounded border border-border bg-muted/10">
                            <p className="text-muted-foreground">{item.label}</p>
                            <p className={`font-bold ${item.color}`}>{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Revenue Intelligence */}
                      {pulse.revenueAlerts?.length > 0 && (
                        <div className="space-y-1 mt-1">
                          {pulse.revenueAlerts.map((a: string) => (
                            <div key={a} className="flex items-center gap-2 text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20">
                              <AlertTriangle className="h-3 w-3 text-amber-400" />
                              <span className="font-mono text-amber-300">{a}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Growth Actions */}
                      {pulse.growthActions?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] text-muted-foreground mb-1 font-bold">إجراءات النمو المقترحة</p>
                          {pulse.growthActions.map((a: string) => (
                            <div key={a} className="flex items-center gap-2 text-xs p-1.5 rounded bg-blue-500/10 border border-blue-500/20 mb-1">
                              <Target className="h-3 w-3 text-blue-400" />
                              <span className="font-mono text-blue-300">{a}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* At-Risk Offices */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    مكاتب معرضة للإلغاء
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!pulse?.atRiskOffices?.length && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {pulse ? "لا مكاتب في خطر — ممتاز! ✓" : "جارٍ التحميل..."}
                    </p>
                  )}
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {(pulse?.atRiskOffices ?? []).map((o: any) => (
                      <div key={o.id} className="p-2 rounded border border-red-500/20 bg-red-500/5 text-xs">
                        <p className="font-bold truncate">{o.office_name || `مكتب ${String(o.id).slice(0,8)}…`}</p>
                        <div className="flex gap-3 text-muted-foreground mt-1">
                          <span>{o.cases ?? 0} قضية</span>
                          <span>خطة: {o.plan_name || "غير محدد"}</span>
                          {o.last_activity && <span>آخر نشاط: {new Date(o.last_activity).toLocaleDateString("ar")}</span>}
                          {!o.last_activity && <span className="text-red-400">لا نشاط</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Business Pilot */}
            <Card className="border-border border-violet-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-400" />
                  AI Business Pilot — تحليل ذكي كامل
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Gemini يحلل جميع البيانات الحية ويقدم توصيات عملية
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  onClick={() => pilotMut.mutate()}
                  disabled={pilotMut.isPending}
                  className="w-full gap-2 bg-violet-700/80 hover:bg-violet-700"
                >
                  {pilotMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  {pilotMut.isPending ? "جاري التحليل بالذكاء الاصطناعي..." : "تشغيل AI Business Pilot"}
                </Button>

                {pilotResult?.aiAnalysis && (
                  <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 text-sm leading-relaxed whitespace-pre-wrap">
                    {String(pilotResult.aiAnalysis).replace(/\*\*(.*?)\*\*/g, '$1')}
                  </div>
                )}
                {pilotResult && !pilotResult.aiAnalysis && (
                  <p className="text-xs text-amber-400 text-center">
                    لم يتمكن الذكاء الاصطناعي من الاستجابة — تحقق من مفتاح Gemini API
                  </p>
                )}
              </CardContent>
            </Card>

          </TabsContent>

        </Tabs>
      </div>
    </AdminLayout>
  );
}
