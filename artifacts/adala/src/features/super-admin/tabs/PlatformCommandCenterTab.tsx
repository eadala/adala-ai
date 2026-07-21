/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Building2, Users, Package, Tag, KeyRound, Activity,
  Settings, FolderTree, BookOpen, HeadphonesIcon, Plus, Loader2,
  Trash2, Edit2, Check, X, TrendingUp, DollarSign, BarChart3,
  AlertCircle, CheckCircle2, Clock, ChevronDown, Eye, EyeOff,
  Save, RefreshCw, Globe, Star, MessageSquare, Upload, FileText,
  ToggleLeft, ToggleRight, Search, Badge as BadgeIcon, Briefcase,
  Crown, Zap, Bell, Lock, Code2, Terminal, Cpu, HardDrive,
  Server, Copy, Fingerprint, Wifi, Database, ShieldAlert,
  CircleCheck, CircleX, KeySquare, Cloud, Link2,
  Shield, CheckCircle, XCircle, Layers, PlugZap, Smartphone,
  Gift, CalendarClock, Ban, PlusCircle, Timer, TrendingDown, Percent,
  Phone, Mail, Twitter, Linkedin, Youtube,
  Bot, Radar, Command, Network, Gauge, Play, Pause, RotateCcw,
  AlertOctagon as AOctagon, TrendingUp as TUp, Boxes,
  MonitorDot, Cpu as CpuIcon, MemoryStick, ArrowUpRight,
  Workflow, ScanLine, FlaskConical,
  FileBarChart2, Gavel, FileSignature, ShieldCheck as SecurityIcon,
  Layout, AlertOctagon, Download, ChevronRight, Filter as FilterIcon,
  User, Banknote, CheckSquare, AlertCircle as ACircle,
  Globe2, Newspaper, ListOrdered, HelpCircle, PenLine, Info,
  CreditCard, Receipt, AlertTriangle,
  ArrowRight, ClipboardList, ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { API, DEV_API, useAdmin } from "../shared/api";
import { StatCard } from "../shared/components";
import { authFetch } from "@/lib/authFetch";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";

const SA_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function saFetch(path: string, token: string) {
  return authFetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

function HealthPill({ value, label, icon: Icon, color }: { value: string | number; label: string; icon: any; color: string }) {
  return (
    <div className={`flex flex-col gap-1.5 p-4 rounded-xl border ${color} bg-muted/10`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-2xl font-black font-mono">{value}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const c = status === "healthy" ? "bg-emerald-400" : status === "slow" ? "bg-amber-400" : "bg-red-400";
  return <span className={`inline-block h-2 w-2 rounded-full ${c} animate-pulse`} />;
}

const RISK_BADGE: Record<string, string> = {
  low:    "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  high:   "bg-red-500/10 text-red-400 border-red-500/20",
};
const RISK_AR: Record<string, string> = { low: "منخفض", medium: "متوسط", high: "مرتفع" };

const SEV_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high:     "text-amber-400 bg-amber-500/10 border-amber-500/20",
  medium:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  info:     "text-blue-400 bg-blue-500/10 border-blue-500/20",
  low:      "text-slate-400 bg-slate-500/10 border-slate-500/20",
};
const SEV_AR: Record<string, string> = { critical: "حرج", high: "مهم", medium: "متوسط", info: "معلومة", low: "منخفض" };

const SRC_COLOR: Record<string, string> = {
  audit:    "bg-violet-500/10 text-violet-400",
  ai_event: "bg-yellow-500/10 text-yellow-400",
};

function fmtUptime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}ساعة ${m}د`;
}

export function PlatformCommandCenterTab({ toast }: { toast: any }) {
  const { getToken } = useAuth();
  const [pccTab, setPccTab] = useState<"health" | "tenants" | "events" | "ai">("health");
  const [tenantSearch, setTenantSearch] = useState("");
  const [evtSearch, setEvtSearch] = useState("");

  const { data: health, refetch: refetchHealth, isFetching: hFetching } = useQuery<any>({
    queryKey: ["pcc", "health"],
    queryFn: async () => saFetch(`${SA_BASE}/api/pcc/system-health`, await getToken() ?? ""),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });

  const { data: tenants, refetch: refetchTenants, isFetching: tFetching } = useQuery<any>({
    queryKey: ["pcc", "tenants"],
    queryFn: async () => saFetch(`${SA_BASE}/api/pcc/tenant-matrix`, await getToken() ?? ""),
    staleTime: 60_000,
  });

  const { data: events, refetch: refetchEvents, isFetching: eFetching } = useQuery<any>({
    queryKey: ["pcc", "events"],
    queryFn: async () => saFetch(`${SA_BASE}/api/pcc/event-stream?limit=60`, await getToken() ?? ""),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  const { data: aiOps, isFetching: aFetching } = useQuery<any>({
    queryKey: ["pcc", "ai-ops"],
    queryFn: async () => saFetch(`${SA_BASE}/api/pcc/ai-ops`, await getToken() ?? ""),
    staleTime: 120_000,
  });

  const filteredTenants = (tenants?.offices ?? []).filter((o: any) =>
    !tenantSearch || o.name?.includes(tenantSearch) || o.slug?.includes(tenantSearch)
  );
  const filteredEvents = (events?.events ?? []).filter((e: any) =>
    !evtSearch || e.type?.includes(evtSearch) || e.resource?.includes(evtSearch) || e.actor?.includes(evtSearch)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Radar className="h-5 w-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-black">مركز القيادة اللحظي</h2>
          <p className="text-xs text-muted-foreground font-mono">Platform Command Center (PCC)</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> live
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: "health",  label: "صحة النظام",     icon: MonitorDot },
          { id: "tenants", label: "مصفوفة المكاتب", icon: Boxes },
          { id: "events",  label: "تيار الأحداث",   icon: Activity },
          { id: "ai",      label: "عمليات AI",       icon: FlaskConical },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setPccTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              pccTab === t.id
                ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                : "bg-muted/20 text-muted-foreground border-border/50 hover:bg-muted/30"
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── HEALTH ── */}
      {pccTab === "health" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">يتحدث كل 10 ثوانٍ تلقائياً</p>
            <Button size="sm" variant="ghost" onClick={() => refetchHealth()} disabled={hFetching} className="gap-1.5 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", hFetching && "animate-spin")} /> تحديث
            </Button>
          </div>
          {health ? (
            <>
              {/* Process */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5" /> الخادم
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <HealthPill icon={Timer}       label="وقت التشغيل"  value={fmtUptime(health.process?.uptime ?? 0)}     color="border-border/50" />
                  <HealthPill icon={CpuIcon}     label="Heap مستخدم"  value={`${health.process?.heapUsedMB ?? 0} MB`}    color="border-border/50" />
                  <HealthPill icon={HardDrive}   label="RSS"          value={`${health.process?.rssMB ?? 0} MB`}         color="border-border/50" />
                  <HealthPill icon={Code2}       label="Node.js"      value={health.process?.nodeVersion ?? "—"}         color="border-border/50" />
                </div>
              </div>
              {/* OS */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <CpuIcon className="h-3.5 w-3.5" /> نظام التشغيل
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <HealthPill icon={Gauge}    label="Load Avg (1m)"  value={health.os?.loadAvg1m ?? 0}                           color="border-border/50" />
                  <HealthPill icon={HardDrive} label="RAM مستخدم"   value={`${health.os?.usedRamPct ?? 0}%`}                     color={`border-border/50 ${(health.os?.usedRamPct ?? 0) > 85 ? "border-red-500/30" : ""}`} />
                  <HealthPill icon={Server}   label="إجمالي RAM"     value={`${health.os?.totalRamMB ?? 0} MB`}                   color="border-border/50" />
                  <HealthPill icon={Network}  label="CPUs"           value={`${health.os?.cpuCount ?? 0} core`}                   color="border-border/50" />
                </div>
              </div>
              {/* DB */}
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" /> قاعدة البيانات
                  <StatusDot status={health.db?.status ?? "healthy"} />
                  <span className="text-muted-foreground">{health.db?.status === "healthy" ? "سليمة" : health.db?.status === "slow" ? "بطيئة" : "حرجة"}</span>
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <HealthPill icon={Wifi}     label="زمن الاستجابة"  value={`${health.db?.latencyMs ?? 0} ms`}  color={`border-border/50 ${(health.db?.latencyMs ?? 0) > 300 ? "border-amber-500/30" : ""}`} />
                  <HealthPill icon={Database} label="عدد الجداول"   value={health.db?.tableCount ?? 0}          color="border-border/50" />
                  <HealthPill icon={Building2} label="المكاتب"      value={health.platform?.offices ?? 0}       color="border-border/50" />
                </div>
              </div>
              {/* Platform */}
              <Card className="border-border/50">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-500" /> إحصائيات المنصة اللحظية
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "المكاتب الفعالة", value: health.platform?.offices ?? 0, icon: Building2, color: "text-cyan-400" },
                      { label: "القضايا المفتوحة", value: health.platform?.activeCases ?? 0, icon: Gavel, color: "text-violet-400" },
                      { label: "المستخدمون", value: health.platform?.users ?? 0, icon: Users, color: "text-emerald-400" },
                      { label: "فواتير غير مسددة", value: health.platform?.unpaidInvoices ?? 0, icon: AlertCircle, color: "text-amber-400" },
                    ].map((s, i) => (
                      <div key={i} className="text-center">
                        <s.icon className={`h-5 w-5 mx-auto mb-1 ${s.color}`} />
                        <div className="text-xl font-black">{s.value.toLocaleString("ar-SA")}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground text-left font-mono">
                آخر تحديث: {new Date(health.timestamp).toLocaleTimeString("ar-SA")}
              </p>
            </>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          )}
        </div>
      )}

      {/* ── TENANTS ── */}
      {pccTab === "tenants" && (
        <div className="space-y-3">
          {tenants?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <HealthPill icon={Building2}   label="إجمالي المكاتب"  value={tenants.summary.total}     color="border-border/50" />
              <HealthPill icon={CheckCircle} label="سليمة"           value={tenants.summary.healthy}   color="border-emerald-500/20" />
              <HealthPill icon={AlertCircle} label="في خطر"         value={tenants.summary.atRisk}    color="border-amber-500/20" />
              <HealthPill icon={XCircle}     label="حرجة"            value={tenants.summary.critical}  color="border-red-500/20" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={tenantSearch}
                onChange={e => setTenantSearch(e.target.value)}
                placeholder="ابحث باسم المكتب..."
                className="pr-9 h-8 text-xs bg-muted/20"
              />
            </div>
            <Button size="sm" variant="ghost" onClick={() => refetchTenants()} disabled={tFetching} className="gap-1.5 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", tFetching && "animate-spin")} />
            </Button>
          </div>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 bg-muted/10 hover:bg-accent/30">
                  <TableHead className="text-right text-xs">المكتب</TableHead>
                  <TableHead className="text-center text-xs">الصحة</TableHead>
                  <TableHead className="text-center text-xs">الخطر</TableHead>
                  <TableHead className="text-center text-xs">القضايا</TableHead>
                  <TableHead className="text-center text-xs">الإيرادات</TableHead>
                  <TableHead className="text-center text-xs">المستحقات</TableHead>
                  <TableHead className="text-center text-xs">AI</TableHead>
                  <TableHead className="text-center text-xs">الخامل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tFetching && !filteredTenants.length ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-border/50">
                      <TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredTenants.map((o: any) => (
                  <TableRow key={o.id} className="border-border/50 hover:bg-accent/30">
                    <TableCell className="py-2">
                      <div className="font-medium text-sm">{o.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{o.slug} · {o.plan}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <div className="h-1.5 w-16 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", o.healthScore >= 80 ? "bg-emerald-400" : o.healthScore >= 50 ? "bg-amber-400" : "bg-red-400")}
                            style={{ width: `${o.healthScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono">{o.healthScore}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={cn("text-xs border font-medium", RISK_BADGE[o.risk] ?? "")}>{RISK_AR[o.risk] ?? o.risk}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm font-mono">{o.casesCount}</TableCell>
                    <TableCell className="text-center text-sm font-mono text-emerald-400">
                      {o.revenue > 0 ? `${o.revenue.toLocaleString("ar-SA")}` : "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm font-mono text-amber-400">
                      {o.outstanding > 0 ? `${o.outstanding.toLocaleString("ar-SA")}` : "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm font-mono">{o.aiCalls > 0 ? o.aiCalls : "—"}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {o.daysSinceActivity < 999 ? `${o.daysSinceActivity}d` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredTenants.length === 0 && !tFetching && (
            <p className="text-center text-sm text-muted-foreground py-8">لا توجد نتائج</p>
          )}
        </div>
      )}

      {/* ── EVENTS ── */}
      {pccTab === "events" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={evtSearch}
                onChange={e => setEvtSearch(e.target.value)}
                placeholder="فلتر الأحداث..."
                className="pr-9 h-8 text-xs bg-muted/20"
              />
            </div>
            <Button size="sm" variant="ghost" onClick={() => refetchEvents()} disabled={eFetching} className="gap-1.5 text-xs">
              <RefreshCw className={cn("h-3.5 w-3.5", eFetching && "animate-spin")} /> تحديث
            </Button>
          </div>
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
            {eFetching && !filteredEvents.length ? (
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)
            ) : filteredEvents.map((e: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 border border-border/50 hover:bg-accent/40 transition-colors">
                <span className={cn("text-xs px-2 py-0.5 rounded font-mono shrink-0 mt-0.5", SRC_COLOR[e.source] ?? "bg-muted/50 text-white/60")}>
                  {e.source === "audit" ? "audit" : "AI"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{e.type}</span>
                    {e.resource && <span className="text-xs text-muted-foreground">· {e.resource}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{e.actor ?? "—"}</div>
                </div>
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {new Date(e.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
          {filteredEvents.length === 0 && !eFetching && (
            <p className="text-center text-sm text-muted-foreground py-8">لا توجد أحداث</p>
          )}
        </div>
      )}

      {/* ── AI OPS ── */}
      {pccTab === "ai" && (
        <div className="space-y-4">
          {aiOps ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <HealthPill icon={Zap}    label="إجمالي الطلبات (30 يوم)"  value={(aiOps.totals?.calls ?? 0).toLocaleString("ar-SA")}   color="border-violet-500/20" />
                <HealthPill icon={Cpu}    label="إجمالي الكريدت"           value={(aiOps.totals?.credits ?? 0).toLocaleString("ar-SA")} color="border-yellow-500/20" />
              </div>
              {/* By model */}
              {(aiOps.byModel ?? []).length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">توزيع الاستخدام حسب النموذج</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {aiOps.byModel.map((m: any, i: number) => {
                        const maxCalls = Math.max(...aiOps.byModel.map((x: any) => Number(x.calls ?? 0)));
                        const pct = maxCalls > 0 ? Math.round((Number(m.calls) / maxCalls) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs font-mono w-20 shrink-0 text-right">{m.model}</span>
                            <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                              <div className="h-full rounded-full bg-violet-400" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground w-16 text-left">{Number(m.calls ?? 0).toLocaleString()} طلب</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
              {/* Daily trend */}
              {(aiOps.dailyTrend ?? []).length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">اتجاه AI — 14 يوم</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={aiOps.dailyTrend.map((d: any) => ({ date: new Date(d.day).toLocaleDateString("ar-SA", { month: "numeric", day: "numeric" }), calls: Number(d.calls ?? 0) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                        <Tooltip contentStyle={{ background: "#1e1e2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
                        <Area type="monotone" dataKey="calls" stroke="#8B5CF6" fill="rgba(139,92,246,0.15)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              {/* Top offices */}
              {(aiOps.byOffice ?? []).length > 0 && (
                <Card className="border-border/50">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm">أكثر المكاتب استخداماً للـ AI</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {aiOps.byOffice.slice(0, 10).map((o: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[200px]">{o.office_name ?? o.office_id}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs">{Number(o.calls ?? 0)} طلب</span>
                            <span className="font-mono text-xs text-yellow-400">{Number(o.credits ?? 0)} pt</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
