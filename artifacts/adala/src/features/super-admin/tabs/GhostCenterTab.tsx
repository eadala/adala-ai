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

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
import { StatCard } from "../shared/components";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";

const GHOST_QUICK_LINKS = [
  { label: "لوحة التحكم",    path: "/dashboard",  Icon: Layout,       color: "#2563EB" },
  { label: "القضايا",        path: "/cases",       Icon: Gavel,        color: "#8B5CF6" },
  { label: "العملاء",        path: "/clients",     Icon: Users,        color: "#06B6D4" },
  { label: "الفواتير",       path: "/invoices",    Icon: Receipt,      color: "#10B981" },
  { label: "العقود",         path: "/contracts",   Icon: FileText,     color: "#F59E0B" },
  { label: "التحليلات",      path: "/analytics",   Icon: BarChart3,    color: "#EF4444" },
  { label: "الموارد البشرية",path: "/hr",          Icon: Briefcase,    color: "#84CC16" },
  { label: "الرسائل",        path: "/messages",    Icon: Bell,         color: "#EC4899" },
  { label: "الإعدادات",      path: "/settings",    Icon: Settings,     color: "#64748B" },
  { label: "المحاسبة",       path: "/accounting",  Icon: DollarSign,   color: "#0EA5E9" },
  { label: "التقويم",        path: "/calendar",    Icon: CalendarClock,color: "#D946EF" },
  { label: "الأمان",         path: "/my-sessions", Icon: Shield,       color: "#F97316" },
];
const GHOST_CASE_STATUS: Record<string, string> = {
  open:"مفتوحة", closed:"مغلقة", pending:"معلقة", active:"نشطة", new:"جديدة",
};
const GHOST_INV_COLOR: Record<string, string> = {
  paid:"text-emerald-400", pending:"text-amber-400", overdue:"text-red-400", draft:"text-muted-foreground",
};
const GHOST_INV_LABEL: Record<string, string> = {
  paid:"مدفوعة", pending:"معلقة", overdue:"متأخرة", draft:"مسودة",
};

export function GhostCenterTab({ toast, onRefreshHeader }: { toast: any; onRefreshHeader?: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch]         = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [subtab, setSubtab]         = useState<"offices"|"session"|"log">("offices");
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [countdown, setCountdown]   = useState("—");

  const { data: offices = [], isLoading: officesLoad, refetch: refetchOffices } = useQuery<any[]>({
    queryKey: ["ghost", "offices"],
    queryFn: () => DEV_API("/offices"),
    retry: false,
    refetchInterval: 60_000,
  });

  const { data: ghostStatus, refetch: refetchStatus } = useQuery<any>({
    queryKey: ["ghost", "status"],
    queryFn: () => DEV_API("/impersonate/status"),
    retry: false,
    refetchInterval: 60_000,
  });

  const { data: ghostLog = [], refetch: refetchLog } = useQuery<any[]>({
    queryKey: ["ghost", "log"],
    queryFn: () => DEV_API("/ghost-log"),
    retry: false,
    enabled: subtab === "log",
    staleTime: 0,
  });

  const { data: snapshot, isLoading: snapshotLoad } = useQuery<any>({
    queryKey: ["ghost", "snapshot", expandedId],
    queryFn: () => DEV_API(`/office-snapshot/${expandedId}`),
    retry: false,
    enabled: !!expandedId,
    staleTime: 30_000,
  });

  /* Live countdown — ticks every second */
  useEffect(() => {
    if (!ghostStatus?.active || !ghostStatus?.startedAt) { setCountdown("—"); return; }
    const tick = () => {
      const expires = new Date(ghostStatus.startedAt).getTime() + 4 * 3600 * 1000;
      const left = expires - Date.now();
      if (left <= 0) { setCountdown("منتهية"); return; }
      const h = Math.floor(left / 3_600_000);
      const m = Math.floor((left % 3_600_000) / 60_000);
      const s = Math.floor((left % 60_000) / 1_000);
      setCountdown(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    };
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [ghostStatus?.active, ghostStatus?.startedAt]);

  const startGhost = useMutation({
    mutationFn: (officeId: string) => DEV_API(`/impersonate/${officeId}`, { method: "POST" }),
    onSuccess: () => {
      refetchStatus(); onRefreshHeader?.();
      qc.invalidateQueries({ queryKey: ["ghost"] });
      toast({ title: "🔮 دخول خفي — الجلسة نشطة الآن" });
      setSubtab("session");
    },
    onError: () => toast({ title: "فشل الدخول الخفي", variant: "destructive" }),
  });

  const stopGhost = useMutation({
    mutationFn: () => DEV_API("/impersonate", { method: "DELETE" }),
    onSuccess: () => {
      refetchStatus(); onRefreshHeader?.();
      qc.invalidateQueries({ queryKey: ["ghost"] });
      toast({ title: "✅ انتهت الجلسة الخفية" });
      setSubtab("offices");
    },
  });

  const openPage = (path: string) =>
    window.open(`${BASE}${path}`, "_blank", "noopener,noreferrer");

  const uniquePlans = [...new Set((offices as any[]).map((o: any) => o.plan).filter(Boolean))];
  const filtered = (offices as any[]).filter((o: any) => {
    const m = !search || (o.office_name ?? "").toLowerCase().includes(search.toLowerCase());
    const p = planFilter === "all" || o.plan === planFilter;
    return m && p;
  });

  const activeOffice  = ghostStatus?.active
    ? (offices as any[]).find((o: any) => o.id === ghostStatus.officeId)
    : null;
  const progressPct = ghostStatus?.startedAt
    ? Math.min(100, Math.round((Date.now() - new Date(ghostStatus.startedAt).getTime()) / (4 * 3_600_000) * 100))
    : 0;

  return (
    <div className="space-y-5" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-black flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-violet-400" />
            لوحة التحكم المطلقة
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            دخول كامل الصلاحيات لجميع المكاتب — بدون إشعار، بدون أثر، انتهاء تلقائي بعد{" "}
            <strong className="text-violet-400">4 ساعات</strong>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 gap-1.5">
            <EyeOff className="h-3 w-3" /> وضع خفي كامل
          </Badge>
          {ghostStatus?.active && (
            <Badge
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 cursor-pointer animate-pulse"
              onClick={() => setSubtab("session")}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              جلسة نشطة
            </Badge>
          )}
        </div>
      </div>

      {/* ── Sub-tabs ── */}
      <div className="flex gap-1 bg-muted/30 border border-border/40 rounded-xl p-1 w-fit">
        {([
          { id: "offices", label: "المكاتب",      Icon: Building2   },
          { id: "session", label: "الجلسة النشطة", Icon: Fingerprint, disabled: !ghostStatus?.active },
          { id: "log",     label: "سجل الدخول",   Icon: Activity    },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => { if (!(t as any).disabled) setSubtab(t.id); }}
            disabled={(t as any).disabled}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              subtab === t.id
                ? "bg-background shadow-sm text-foreground"
                : (t as any).disabled
                  ? "text-muted-foreground/30 cursor-not-allowed"
                  : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.Icon className="h-3.5 w-3.5" />
            {t.label}
            {t.id === "session" && ghostStatus?.active && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════ TAB: OFFICES ══════════ */}
      {subtab === "offices" && (
        <div className="space-y-4">

          {/* Search + filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ابحث بالاسم..." className="pr-9 text-sm" />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-36 text-xs">
                <SelectValue placeholder="كل الباقات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الباقات</SelectItem>
                {uniquePlans.map((p: string) => (
                  <SelectItem key={p} value={p}>{PLAN_SLUG_LABELS[p] ?? p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-9 w-9 p-0"
              onClick={() => { refetchOffices(); refetchStatus(); }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "إجمالي المكاتب", value: (offices as any[]).length,                                                   color: "text-primary" },
              { label: "جلسات نشطة",    value: ghostStatus?.active ? "1" : "0",                                              color: "text-violet-400" },
              { label: "إجمالي القضايا", value: (offices as any[]).reduce((s: number, o: any) => s + (o.case_count ?? 0), 0), color: "text-blue-400"   },
              { label: "إجمالي العملاء", value: (offices as any[]).reduce((s: number, o: any) => s + (o.client_count ?? 0), 0), color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Count */}
          {!officesLoad && (
            <p className="text-xs text-muted-foreground">
              {filtered.length === (offices as any[]).length
                ? `${filtered.length} مكتب`
                : `${filtered.length} من ${(offices as any[]).length} مكتب`}
            </p>
          )}

          {/* List */}
          {officesLoad ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Fingerprint className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا توجد مكاتب مطابقة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((office: any) => {
                const isActive   = ghostStatus?.active && ghostStatus.officeId === office.id;
                const isExpanded = expandedId === office.id;
                const planColor  = PLAN_SLUG_COLORS[office.plan] ?? "#64748B";
                const planLabel  = PLAN_SLUG_LABELS[office.plan] ?? office.plan ?? "—";
                return (
                  <Card key={office.id} className={cn(
                    "border-border/50 transition-all duration-200",
                    isActive
                      ? "border-violet-500/50 bg-violet-500/5 shadow-sm shadow-violet-500/10"
                      : "hover:border-border/80 hover:bg-muted/20"
                  )}>
                    <CardContent className="p-4 space-y-3">

                      {/* Row 1: icon + info + actions */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center border"
                            style={{ background: `${planColor}12`, borderColor: `${planColor}30` }}>
                            <Building2 className="h-5 w-5" style={{ color: planColor }} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold truncate">{office.office_name || "مكتب بلا اسم"}</p>
                              {isActive && (
                                <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/20 text-[10px] px-1.5 gap-1 shrink-0">
                                  <span className="h-1.5 w-1.5 rounded-full bg-violet-400 inline-block animate-pulse" />
                                  نشطة
                                </Badge>
                              )}
                            </div>
                            {/* Mini stats */}
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-[11px] font-semibold" style={{ color: planColor }}>{planLabel}</span>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <Users className="h-3 w-3" /> {office.member_count ?? 0}
                              </span>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <Gavel className="h-3 w-3" /> {office.case_count ?? 0} قضية
                              </span>
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <User className="h-3 w-3" /> {office.client_count ?? 0} عميل
                              </span>
                              {(office.invoice_count ?? 0) > 0 && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                  <Receipt className="h-3 w-3" /> {office.invoice_count} فاتورة
                                </span>
                              )}
                              {(office.revenue_total ?? 0) > 0 && (
                                <span className="text-[11px] text-emerald-400 flex items-center gap-0.5">
                                  <DollarSign className="h-3 w-3" />
                                  {Number(office.revenue_total).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground"
                            title="تفاصيل" onClick={() => setExpandedId(isExpanded ? null : office.id)}>
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                          </Button>
                          {isActive ? (
                            <>
                              <Button size="sm" className="h-8 text-xs bg-violet-600 hover:bg-violet-700 gap-1"
                                onClick={() => openPage("/dashboard")}>
                                <Globe className="h-3.5 w-3.5" /> فتح
                              </Button>
                              <Button size="sm" variant="outline"
                                className="h-8 w-8 p-0 border-red-400/30 text-red-300 hover:bg-red-500/10"
                                onClick={() => stopGhost.mutate()} disabled={stopGhost.isPending}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button size="sm"
                              className="h-8 text-xs bg-violet-600/80 hover:bg-violet-600 text-white gap-1.5"
                              onClick={() => startGhost.mutate(office.id)}
                              disabled={startGhost.isPending}>
                              {startGhost.isPending
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Fingerprint className="h-3.5 w-3.5" />}
                              دخول خفي
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expandable snapshot */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-border/30">
                          {snapshotLoad ? (
                            <div className="space-y-1.5">{[1,2,3].map(i => <Skeleton key={i} className="h-3.5 w-full rounded" />)}</div>
                          ) : snapshot ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {/* Recent cases */}
                              <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <Gavel className="h-3 w-3" /> آخر القضايا
                                </p>
                                {(snapshot.recentCases ?? []).length ? (snapshot.recentCases as any[]).map((c: any) => (
                                  <div key={c.id} className="flex items-center justify-between py-0.5">
                                    <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">{c.title || "—"}</span>
                                    <span className="text-[10px] text-violet-400/80">{GHOST_CASE_STATUS[c.status] ?? c.status}</span>
                                  </div>
                                )) : <p className="text-[11px] text-muted-foreground/40">لا توجد قضايا</p>}
                              </div>
                              {/* Recent clients */}
                              <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <Users className="h-3 w-3" /> آخر العملاء
                                </p>
                                {(snapshot.recentClients ?? []).length ? (snapshot.recentClients as any[]).map((cl: any) => (
                                  <p key={cl.id} className="text-[11px] text-muted-foreground py-0.5 truncate">{cl.full_name}</p>
                                )) : <p className="text-[11px] text-muted-foreground/40">لا يوجد عملاء</p>}
                              </div>
                              {/* Invoice summary */}
                              <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                                  <Receipt className="h-3 w-3" /> ملخص الفواتير
                                </p>
                                {(snapshot.invoiceSummary ?? []).length ? (snapshot.invoiceSummary as any[]).map((iv: any) => (
                                  <div key={iv.status} className="flex items-center justify-between py-0.5">
                                    <span className={cn("text-[11px]", GHOST_INV_COLOR[iv.status] ?? "text-muted-foreground")}>
                                      {GHOST_INV_LABEL[iv.status] ?? iv.status}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {iv.count} · {Number(iv.total).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
                                    </span>
                                  </div>
                                )) : <p className="text-[11px] text-muted-foreground/40">لا توجد فواتير</p>}
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/40 text-center py-2">لا توجد بيانات</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: ACTIVE SESSION ══════════ */}
      {subtab === "session" && (
        ghostStatus?.active ? (
          <div className="space-y-5">

            {/* Session hero card */}
            <Card className="border-violet-500/40 bg-gradient-to-l from-violet-500/8 to-transparent overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                      <Fingerprint className="h-7 w-7 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-violet-400 font-bold tracking-widest uppercase mb-1">جلسة خفية نشطة</p>
                      <p className="text-xl font-black">{ghostStatus.officeName}</p>
                      <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          بدأت: {ghostStatus.startedAt
                            ? new Date(ghostStatus.startedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </span>
                        <span className="text-violet-300 font-mono text-sm font-black flex items-center gap-1">
                          <Timer className="h-3.5 w-3.5 text-violet-400" />
                          {countdown}
                        </span>
                      </div>
                      <div className="mt-2.5 h-1.5 w-64 bg-violet-500/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-l from-violet-600 to-violet-400 rounded-full transition-all duration-1000"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      {activeOffice && (
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-0.5"><Gavel className="h-3 w-3" /> {activeOffice.case_count ?? 0} قضية</span>
                          <span className="flex items-center gap-0.5"><User className="h-3 w-3" /> {activeOffice.client_count ?? 0} عميل</span>
                          <span className="flex items-center gap-0.5"><Receipt className="h-3 w-3" /> {activeOffice.invoice_count ?? 0} فاتورة</span>
                          {(activeOffice.revenue_total ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-emerald-400">
                              <DollarSign className="h-3 w-3" />
                              {Number(activeOffice.revenue_total).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س إيرادات
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline"
                    className="h-8 text-xs border-red-400/30 text-red-300 hover:bg-red-500/10 gap-1.5 flex-shrink-0"
                    onClick={() => stopGhost.mutate()} disabled={stopGhost.isPending}>
                    {stopGhost.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    إنهاء الجلسة
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick links grid */}
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                وصول سريع — فتح في نافذة جديدة بصلاحية المدير
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {GHOST_QUICK_LINKS.map(({ label, path, Icon, color }) => (
                  <button
                    key={path}
                    onClick={() => openPage(path)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 hover:border-border/80 transition-all group text-center"
                  >
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center border transition-all group-hover:scale-105"
                      style={{ background: `${color}15`, borderColor: `${color}30`, color }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Warning */}
            <Card className="border-dashed border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-3 flex gap-3 items-start">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-amber-400">صلاحيات حقيقية وكاملة:</span>{" "}
                  جميع التغييرات تؤثر فعلاً على بيانات المكتب. لا يُرسل أي إشعار أو بريد. المكتب لا يرى أي دليل. السجلات محفوظة على الخادم فقط.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Fingerprint className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-semibold mb-1">لا توجد جلسة نشطة</p>
            <p className="text-xs">اختر مكتباً من تبويب "المكاتب" وابدأ الدخول الخفي</p>
            <Button size="sm" variant="outline" className="mt-4 gap-1.5"
              onClick={() => setSubtab("offices")}>
              <Building2 className="h-3.5 w-3.5" /> عرض المكاتب
            </Button>
          </div>
        )
      )}

      {/* ══════════ TAB: LOG ══════════ */}
      {subtab === "log" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> سجل الدخول الخفي (خاص بك · مشفّر)
            </p>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => refetchLog()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {(ghostLog as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا يوجد سجل دخول بعد</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {(ghostLog as any[]).map((entry: any, idx: number) => (
                <div key={entry.id ?? idx}
                  className="flex items-center justify-between gap-3 bg-muted/20 border border-border/30 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black",
                      entry.action === "enter"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/15 text-red-400 border border-red-500/20"
                    )}>
                      {entry.action === "enter" ? "▶" : "■"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{entry.office_name || entry.office_id || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {entry.action === "enter" ? "بدأ الجلسة الخفية" : "أنهى الجلسة الخفية"}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 flex-shrink-0 font-mono">
                    {entry.logged_at
                      ? new Date(entry.logged_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="text-[11px] text-muted-foreground/40 text-center leading-relaxed pt-2 border-t border-border/20">
        🔒 مشفّر · بدون إشعار · بدون أثر للمكتب · سجل الخادم فقط · 4 ساعات انتهاء تلقائي
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM COMMAND CENTER TAB
═══════════════════════════════════════════════════ */
const SA_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
