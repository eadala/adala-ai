import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Link, useLocation } from "wouter";
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
  X, RefreshCw, Target, Gauge, Star, FlameKindling, ChevronRight,
  CircleDot, TriangleAlert, BadgeCheck,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLang } from "@/hooks/use-lang";
import { useOfficePlan } from "@/hooks/use-office-plan";
import { Crown } from "lucide-react";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

/* ══════════════════════════════════════════════════════
   PLAN SUBSCRIPTION BAR — لوحة الاشتراك والباقة
══════════════════════════════════════════════════════ */
function PlanSubscriptionBar() {
  const { planName, planColor, planSlug, isTrial, trialDaysLeft, limits, isLoaded } = useOfficePlan();
  if (!isLoaded) return null;
  const isUpgradable = ["free", "starter", "basic"].includes(planSlug);

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      {/* Left: plan info */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Crown className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest font-bold leading-none mb-0.5">باقتك الحالية</p>
            <p className="text-sm font-bold leading-none" style={{ color: planColor }}>{planName}</p>
          </div>
        </div>

        {isTrial && trialDaysLeft !== null && (
          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs px-2.5 py-1 rounded-full font-semibold">
            تجريبية · {trialDaysLeft} يوم متبقي
          </span>
        )}

        {limits && (
          <div className="hidden md:flex items-center gap-4 text-[11px] text-muted-foreground/70">
            <span className="flex items-center gap-1.5">
              <Bot className="h-3 w-3 text-primary/50" />
              ذكاء اصطناعي: {limits.maxAiCalls === -1 ? "غير محدود" : limits.maxAiCalls.toLocaleString("ar-SA")} طلب/شهر
            </span>
            <span className="flex items-center gap-1.5">
              <Scale className="h-3 w-3 text-primary/50" />
              قضايا: {limits.maxCases === -1 ? "غير محدودة" : limits.maxCases}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3 w-3 text-primary/50" />
              مستخدمون: {limits.maxUsers === -1 ? "غير محدود" : limits.maxUsers}
            </span>
          </div>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/billing">
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg border-border/60">
            <CreditCard className="h-3 w-3" />
            إدارة الاشتراك
          </Button>
        </Link>
        {isUpgradable && (
          <Link href="/billing">
            <Button size="sm" className="h-8 text-xs gap-1.5 rounded-lg">
              <Crown className="h-3 w-3" />
              ترقية الباقة
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

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
    queryFn: () => fetch(`${BASE}/api/ai-events`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
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
          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
            <Brain className="h-3.5 w-3.5 text-primary" />
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
                className="text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0 mt-0.5 p-0.5 rounded hover:bg-sidebar-accent/50"
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

/* ══════════════════════════════════════════════════════
   INTELLIGENCE DATA TYPE
══════════════════════════════════════════════════════ */
type IntelData = {
  scores: { engagement: number; collection: number; activity: number; ai: number; risk: number };
  officeScore: number;
  tier: string;
  smartActions: { priority: number; urgent: boolean; type: string; title: string; body: string; href: string; icon: string }[];
  clientRisks: { id: string; name: string; activeCases: number; unpaidAmount: number; overdueCount: number; daysSince: number | null; risk: string }[];
  stats: any;
};

/* ══════════════════════════════════════════════════════
   Smart Briefing — Adaptive Daily Briefing Header
══════════════════════════════════════════════════════ */
function SmartBriefing({ user }: { user: any }) {
  const { tx, isAr, dateLocale } = useLang();
  const { data, isLoading } = useQuery<IntelData>({
    queryKey: ["dashboard-intelligence"],
    queryFn: () => fetch(`${BASE}/api/dashboard/intelligence`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 5 * 60_000,
  });

  const hr = new Date().getHours();
  const name = user?.firstName ?? (isAr ? "المحامي" : "Counselor");
  const greeting = isAr
    ? hr < 12 ? `صباح الخير، ${name} ⚖️` : hr < 17 ? `مساء الخير، ${name}` : `مساء النور، ${name}`
    : hr < 12 ? `Good morning, ${name} ⚖️` : hr < 17 ? `Good afternoon, ${name}` : `Good evening, ${name}`;

  const ICON_MAP: Record<string, any> = {
    gavel: Scale, receipt: Receipt, scale: Scale, file: FileText,
    sparkles: Sparkles, alert: AlertCircle, clock: Clock,
  };

  const urgentActions  = (data?.smartActions ?? []).filter(a => a.urgent).slice(0, 2);
  const normalActions  = (data?.smartActions ?? []).filter(a => !a.urgent).slice(0, 2);
  const hasActions = urgentActions.length + normalActions.length > 0;

  const tierStyles: Record<string, string> = {
    "ممتاز": "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
    "متقدم": "bg-blue-500/15 border-blue-500/30 text-blue-400",
    "نشط":   "bg-primary/15 border-primary/30 text-primary",
    "ناشئ":  "bg-muted/30 15 border-slate-500/30 text-muted-foreground",
  };

  return (
    <div className="flex flex-col lg:flex-row items-start justify-between gap-4">
      {/* Left — Greeting + tier */}
      <div className="flex-1">
        <h1 className="text-3xl font-black tracking-tight leading-tight">{greeting}</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        {data && (
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${tierStyles[data.tier] ?? tierStyles["نشط"]}`}>
              <BadgeCheck className="h-3 w-3" />
              مكتب {data.tier} — {data.officeScore}/100
            </span>
          </div>
        )}
      </div>

      {/* Right — Prioritised smart actions */}
      {(isLoading || hasActions) && (
        <div className="w-full lg:w-[420px] space-y-1.5">
          {isLoading && Array(2).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          {!isLoading && urgentActions.map((action, i) => {
            const Icon = ICON_MAP[action.icon] ?? AlertCircle;
            return (
              <Link key={i} href={action.href}>
                <div className="flex items-start gap-3 p-2.5 rounded-xl border border-red-500/30 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-all">
                  <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-red-300 leading-tight">{action.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{action.body}</p>
                  </div>
                  <ChevronLeft className="h-3 w-3 text-red-400/60 flex-shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
          {!isLoading && normalActions.map((action, i) => {
            const Icon = ICON_MAP[action.icon] ?? Target;
            return (
              <Link key={i} href={action.href}>
                <div className="flex items-start gap-3 p-2.5 rounded-xl border border-border/40 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-all">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight">{action.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{action.body}</p>
                  </div>
                  <ChevronLeft className="h-3 w-3 text-muted-foreground/50 flex-shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Office Perf Score — 5-Dimension Intelligence Bars
══════════════════════════════════════════════════════ */
function OfficePerfScore() {
  const { data, isLoading } = useQuery<IntelData>({
    queryKey: ["dashboard-intelligence"],
    staleTime: 5 * 60_000,
    queryFn: () => fetch(`${BASE}/api/dashboard/intelligence`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const DIMS = [
    { key: "engagement" as const, label: "التفاعل",  icon: Zap,        color: "#6366F1" },
    { key: "collection" as const, label: "التحصيل", icon: DollarSign,  color: "#10B981" },
    { key: "activity"   as const, label: "النشاط",  icon: Activity,    color: "#3B82F6" },
    { key: "ai"         as const, label: "ذكاء AI", icon: Brain,        color: "#2563EB" },
    { key: "risk"       as const, label: "الأمان",  icon: ShieldCheck, color: "#F59E0B" },
  ];

  const scores = data?.scores ?? { engagement: 0, collection: 0, activity: 0, ai: 0, risk: 0 };
  const overall = data?.officeScore ?? 0;
  const overallColor = overall >= 85 ? "#10B981" : overall >= 65 ? "#3B82F6" : overall >= 40 ? "#2563EB" : "#EF4444";

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ذكاء المكتب — 5 أبعاد</span>
        </div>
        {data && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">الدرجة الكلية</span>
            <span className="text-sm font-black tabular-nums" style={{ color: overallColor }}>{overall}/100</span>
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="overflow-x-auto"><div className="grid grid-cols-5 gap-px bg-border/10 p-0 min-w-[280px]">
          {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-none" />)}
        </div></div>
      ) : (
        <div className="overflow-x-auto"><div className="grid grid-cols-5 divide-x divide-x-reverse divide-border/20 min-w-[280px]">
          {DIMS.map(dim => {
            const score = scores[dim.key] ?? 0;
            const pct = Math.max(2, score);
            const Icon = dim.icon;
            const scoreColor = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-blue-400" : score >= 40 ? "text-amber-400" : "text-red-400";
            return (
              <div key={dim.key} className="flex flex-col items-center gap-1.5 px-2 py-3 text-center hover:bg-accent/30 transition-all">
                <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: dim.color }} />
                <span className={`text-sm font-black tabular-nums leading-none ${scoreColor}`}>{score}</span>
                <div className="w-full h-1 rounded-full bg-muted/50 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: dim.color }} />
                </div>
                <span className="text-[9px] text-muted-foreground/70 leading-tight">{dim.label}</span>
              </div>
            );
          })}
        </div></div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Client Risk Matrix — AI-Driven Client Health
══════════════════════════════════════════════════════ */
function ClientRiskMatrix() {
  const { data, isLoading } = useQuery<IntelData>({
    queryKey: ["dashboard-intelligence"],
    staleTime: 5 * 60_000,
    queryFn: () => fetch(`${BASE}/api/dashboard/intelligence`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const risks = data?.clientRisks ?? [];
  if (!isLoading && risks.length === 0) return null;

  const RISK_CFG = {
    high:   { label: "مرتفع",  bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20",    dot: "bg-red-400" },
    medium: { label: "متوسط",  bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20",  dot: "bg-amber-400" },
    low:    { label: "منخفض",  bg: "bg-emerald-500/10",text: "text-emerald-400",border: "border-emerald-500/20",dot: "bg-emerald-400" },
  };

  const highCount = risks.filter(r => r.risk === "high").length;

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">مصفوفة مخاطر العملاء</span>
          {highCount > 0 && (
            <span className="bg-red-500/15 text-red-400 border border-red-500/25 text-[10px] font-bold rounded-full px-1.5 py-0.5">
              {highCount} مرتفع
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" asChild>
          <Link href="/clients"><ExternalLink className="h-3 w-3" />كل العملاء</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-3 space-y-2">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-9 rounded-lg" />)}</div>
      ) : (
        <div className="overflow-x-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-1.5 border-b border-border/10 bg-muted/10 overflow-x-auto">
            <span className="text-[10px] text-muted-foreground/50">العميل</span>
            <span className="text-[10px] text-muted-foreground/50 w-14 text-center">قضايا</span>
            <span className="text-[10px] text-muted-foreground/50 w-20 text-left rtl:text-right">مستحق</span>
            <span className="text-[10px] text-muted-foreground/50 w-10 text-center">أيام</span>
            <span className="text-[10px] text-muted-foreground/50 w-14 text-center">المخاطرة</span>
          </div>
          <div className="divide-y divide-border/20">
            {risks.slice(0, 8).map(client => {
              const rc = RISK_CFG[client.risk as keyof typeof RISK_CFG] ?? RISK_CFG.low;
              return (
                <Link key={client.id} href="/clients">
                  <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center px-4 py-2.5 hover:bg-accent/30 transition-all cursor-pointer overflow-x-auto">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rc.dot}`} />
                      <span className="text-xs font-medium truncate">{client.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground w-14 text-center">{client.activeCases}</span>
                    <span className={`text-[11px] font-mono font-bold w-20 text-left rtl:text-right ${
                      client.unpaidAmount > 0
                        ? client.overdueCount > 0 ? "text-red-400" : "text-amber-400"
                        : "text-emerald-400"
                    }`}>
                      {client.unpaidAmount > 0 ? `${client.unpaidAmount.toLocaleString("ar-SA")}` : "✓"}
                    </span>
                    <span className={`text-[10px] w-10 text-center ${client.daysSince !== null && client.daysSince > 30 ? "text-red-400/80" : "text-muted-foreground/60"}`}>
                      {client.daysSince !== null ? `${client.daysSince}ي` : "—"}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold w-14 text-center ${rc.bg} ${rc.text} ${rc.border}`}>
                      {rc.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="px-4 py-1.5 border-t border-border/10 bg-muted/10 overflow-x-auto">
            <span className="text-[10px] text-muted-foreground/40">أيام = منذ آخر نشاط · المستحق بالريال</span>
          </div>
        </div>
      )}
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
  PAYMENT_SUCCESS: { icon: CreditCard,   color: "#2563EB" },
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
    queryFn: () => fetch(`${BASE}/api/dashboard/executive`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 3 * 60_000,
    refetchInterval: 5 * 60_000,
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
    neutral: { bg: "bg-muted/30 hover:bg-muted/50 border-border/40",                   text: "text-muted-foreground", dot: "bg-muted/30" },
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border/20 p-3">
          {Array(10).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-3">
          {metrics.map((m, i) => {
            const s = statusStyle[m.status];
            const Icon = m.icon;
            return (
              <Link key={i} href={m.href}>
                <div className={`flex flex-col gap-2 p-3.5 rounded-xl border cursor-pointer transition-all hover:-translate-y-0.5 ${s.bg}`}>
                  <div className="flex items-center justify-between">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg}`} style={{opacity: 0.9}}>
                      <Icon className={`h-4 w-4 ${s.text}`} />
                    </div>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  </div>
                  <div>
                    <span className={`text-xl font-black tabular-nums leading-none block ${s.text}`}>{m.value}</span>
                    <span className="text-xs text-muted-foreground/70 leading-tight mt-0.5 block">{m.label}</span>
                  </div>
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
      .then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); })
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
                <div key={ev.id} className={`flex items-center gap-3 px-4 py-2 transition-colors hover:bg-accent/30 ${i === 0 ? "bg-primary/3" : ""}`}>
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

/* ══════════════════════════════════════════════════════
   TRIAL EXPIRED GUARD
   - Shows overlay immediately when trial expires (plan = 'free')
   - Auto-redirects to /billing after 24-hour grace period
══════════════════════════════════════════════════════ */
function TrialExpiredGuard() {
  const [, navigate] = useLocation();
  const { planSlug, isLoaded } = useOfficePlan();

  const { data: trialStatus } = useQuery<{
    isTrial: boolean; expired: boolean; daysLeft: number;
    trialEnd: string | null; officeName: string;
  }>({
    queryKey: ["trial-status-guard"],
    queryFn: () => fetch(`${BASE}/api/onboarding/trial-status`).then(r => r.json()),
    staleTime: 5 * 60_000,
    retry: false,
    enabled: isLoaded,
  });

  const GRACE_MS = 24 * 60 * 60 * 1000;

  const isExpired  = trialStatus?.expired === true;
  const isFree     = planSlug === "free";
  const trialEndMs = trialStatus?.trialEnd ? new Date(trialStatus.trialEnd).getTime() : null;
  const graceOver  = trialEndMs ? Date.now() > trialEndMs + GRACE_MS : false;

  /* Auto-redirect once 24-hour grace has elapsed */
  useEffect(() => {
    if (isLoaded && isExpired && isFree && graceOver) {
      navigate("/billing");
    }
  }, [isLoaded, isExpired, isFree, graceOver, navigate]);

  /* Countdown to end of grace period */
  const [msLeft, setMsLeft] = useState<number>(0);
  useEffect(() => {
    if (!trialEndMs || !isExpired || !isFree || graceOver) return;
    const update = () => setMsLeft(Math.max(0, trialEndMs + GRACE_MS - Date.now()));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [trialEndMs, isExpired, isFree, graceOver]);

  const hoursLeft = Math.ceil(msLeft / (60 * 60 * 1000));

  /* Only show overlay when: expired + free + grace still active */
  if (!isLoaded || !isExpired || !isFree || graceOver) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
    >
      <div className="max-w-md w-full mx-4 rounded-2xl border border-amber-500/30 bg-card shadow-2xl overflow-hidden">
        {/* Header strip */}
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="font-bold text-foreground text-base leading-tight">انتهت فترة التجربة</p>
            <p className="text-xs text-amber-600 mt-0.5">
              متبقٍ {hoursLeft} ساعة قبل تعليق الحساب تلقائياً
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 text-center">
          <p className="text-muted-foreground text-sm leading-relaxed">
            انتهت فترة التجربة، يرجى اختيار باقة للاستمرار
          </p>
          <p className="text-xs text-muted-foreground/60">
            بياناتك محفوظة بالكامل وستبقى متاحة فور تفعيل أي باقة.
          </p>

          <Link href="/billing">
            <Button className="w-full gap-2 h-10 text-sm font-semibold mt-2">
              <Crown className="h-4 w-4" />
              اختر باقتك الآن
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const { tx, isAr, dateLocale } = useLang();

  const { data, isLoading } = useQuery<Overview>({
    queryKey: ["dashboard-overview"],
    queryFn: () => fetch(`${BASE}/api/dashboard/overview`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 3 * 60_000,
    refetchInterval: 5 * 60_000,
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
    draft:    { label: tx("مسودة", "Draft"),      color: "text-muted-foreground" },
    sent:     { label: tx("مُرسَلة", "Sent"),      color: "text-blue-400" },
    paid:     { label: tx("مدفوعة", "Paid"),       color: "text-green-400" },
    overdue:  { label: tx("متأخرة", "Overdue"),    color: "text-red-400" },
    cancelled:{ label: tx("ملغاة", "Cancelled"),   color: "text-orange-400" },
  };

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

  /* ── KPI card configs with gradient accents ── */
  const KPI_ACCENTS = [
    { gradient: "from-blue-500/10 to-blue-600/5",   iconBg: "bg-blue-500/15",   iconColor: "text-blue-600",   valueCls: "text-blue-700"   },
    { gradient: "from-violet-500/10 to-violet-600/5",iconBg: "bg-violet-500/15", iconColor: "text-violet-600", valueCls: "text-violet-700" },
    { gradient: "from-emerald-500/10 to-emerald-600/5",iconBg:"bg-emerald-500/15",iconColor:"text-emerald-600",valueCls:"text-emerald-700"},
    { gradient: "from-purple-500/10 to-purple-600/5", iconBg: "bg-purple-500/15", iconColor: "text-purple-600", valueCls: "text-purple-700" },
  ];

  return (
    <div className="space-y-6 max-w-7xl">

      <TrialExpiredGuard />

      {/* ══════════════════════════════════════════════
          HERO BRIEFING — same bold Arabic energy as landing
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-1 rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
        {/* Blue accent top strip */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #2563EB 0%, #0B1F3B 100%)" }} />
        <div className="p-5 sm:p-6">
          <SmartBriefing user={user} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          PLAN SUBSCRIPTION STATUS
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-2">
        <PlanSubscriptionBar />
      </div>

      {/* ══════════════════════════════════════════════
          EXECUTIVE PULSE — 10 مؤشرات فورية
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-2">
        <ExecutivePulseBar />
      </div>

      {/* ══════════════════════════════════════════════
          KPI STAT CARDS — landing page stat style
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-3">
        <div className="section-label">{tx("المؤشرات الرئيسية", "Key Metrics")}</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
            : kpiCards.map((k, i) => {
                const Icon = k.icon;
                const accent = KPI_ACCENTS[i % KPI_ACCENTS.length];
                return (
                  <Link key={k.label} href={k.href}>
                    <div className={`stat-card bg-gradient-to-br ${accent.gradient} cursor-pointer`}>
                      {/* Icon top-left */}
                      <div className={`stat-icon ${accent.iconBg}`}>
                        <Icon className={`h-6 w-6 ${accent.iconColor}`} />
                      </div>
                      {/* Value — large + bold */}
                      <div className="mt-8">
                        <div className={`stat-value ${accent.valueCls} font-mono`}>{k.value}</div>
                        <div className="stat-label">{k.label}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-1.5 leading-tight">{k.sub}</div>
                      </div>
                      {/* Hover arrow */}
                      <ChevronRight className="absolute bottom-3 left-3 h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          OFFICE INTELLIGENCE SCORE
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-3">
        <OfficePerfScore />
      </div>

      {/* ══════════════════════════════════════════════
          AI INTELLIGENCE PANEL
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-4">
        <AiEventsPanel />
      </div>

      {/* ══════════════════════════════════════════════
          SMART ALERTS
      ══════════════════════════════════════════════ */}
      {(data?.alerts ?? []).length > 0 && (
        <div className="app-fade app-fade-4">
          <div className="section-label">{tx("تنبيهات ذكية", "Smart Alerts")}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(data?.alerts ?? []).map((alert, i) => (
              <Link key={i} href={alert.action}>
                <div className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  alert.type === "warning" ? "border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50" :
                  alert.type === "info"    ? "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/50" :
                  "border-primary/30 bg-primary/5 hover:border-primary/50"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    alert.type === "warning" ? "bg-orange-500/15" : alert.type === "info" ? "bg-blue-500/15" : "bg-primary/15"
                  }`}>
                    <AlertCircle className={`h-4 w-4 ${
                      alert.type === "warning" ? "text-orange-500" : alert.type === "info" ? "text-blue-500" : "text-primary"
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{alert.body}</p>
                  </div>
                  <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          EXECUTIVE ASSISTANT
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-4">
        <ExecutiveAssistant />
      </div>

      {/* ══════════════════════════════════════════════
          REVENUE CHART + TODAY SCHEDULE
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-5">
        <div className="section-label">{tx("التحليلات والجدول", "Analytics & Schedule")}</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Revenue Chart — 2/3 width */}
          <div className="lg:col-span-2 bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{tx("الإيرادات", "Revenue")}</p>
                  <p className="text-[11px] text-muted-foreground">{tx("آخر 6 أشهر", "Last 6 months")}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1 rounded-lg" asChild>
                <Link href="/revenues"><ExternalLink className="h-3 w-3" />{tx("تفاصيل", "Details")}</Link>
              </Button>
            </div>
            <div className="p-5">
              {isLoading ? <Skeleton className="h-[220px] rounded-xl" /> : (
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.revenueChart ?? []} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false}
                        tickFormatter={v => `${(v/1000).toFixed(0)}k`} width={40} />
                      <Tooltip
                        contentStyle={{ background: "white", border: "1px solid hsl(var(--border))", borderRadius: "10px", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                        formatter={(v: any) => [`${Number(v).toLocaleString(dateLocale)} ${tx("ر.س","SAR")}`, tx("الإيرادات","Revenue")]}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2.5} fill="url(#revGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Today Schedule — 1/3 width */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <CalendarDays className="h-4 w-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{tx("جدول اليوم", "Today")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date().toLocaleDateString(dateLocale, { weekday: "long" })}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 rounded-lg" asChild>
                <Link href="/calendar"><ExternalLink className="h-3 w-3" /></Link>
              </Button>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
              ) : (data?.todayEvents ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{tx("يوم فارغ — أضف موعداً", "Free day — add an event")}</p>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5 h-8 rounded-lg" asChild>
                    <Link href="/calendar"><Plus className="h-3 w-3" />{tx("إضافة موعد", "Add")}</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {(data?.todayEvents ?? []).map((ev: any) => {
                    const colorClass = EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.other;
                    const time = ev.all_day ? tx("طوال اليوم","All day") : new Date(ev.start_at).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={ev.id} className={`rounded-xl border p-3 ${colorClass}`}>
                        <p className="text-xs font-semibold leading-tight truncate">{ev.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] flex items-center gap-1 opacity-80">
                            <Clock className="h-2.5 w-2.5" />{time}
                          </span>
                          {ev.location && (
                            <span className="text-[10px] flex items-center gap-1 truncate opacity-70">
                              <MapPin className="h-2.5 w-2.5" />{ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          RECENT ACTIVITY — Cases + Invoices + Quick Actions
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-5">
        <div className="section-label">{tx("النشاط الأخير والإجراءات السريعة", "Recent Activity & Quick Actions")}</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Recent Cases */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">{tx("آخر القضايا", "Recent Cases")}</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 rounded-lg" asChild>
                <Link href="/cases"><ArrowLeft className="h-3 w-3" />{tx("الكل", "All")}</Link>
              </Button>
            </div>
            <div className="p-3 space-y-2">
              {isLoading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />) :
                (data?.recentCases ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">{tx("لا توجد قضايا بعد", "No cases yet")}</p>
                ) : (
                  (data?.recentCases ?? []).map((c: any) => {
                    const st = STATUS_MAP[c.status] ?? STATUS_MAP.open;
                    return (
                      <Link key={c.id} href="/cases">
                        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-all cursor-pointer group">
                          <div className="p-1.5 rounded-lg bg-primary/8 group-hover:bg-primary/15 transition-colors">
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
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-bold">{tx("آخر الفواتير", "Recent Invoices")}</span>
              </div>
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 rounded-lg" asChild>
                <Link href="/invoices"><ArrowLeft className="h-3 w-3" />{tx("الكل", "All")}</Link>
              </Button>
            </div>
            <div className="p-3 space-y-2">
              {isLoading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />) :
                (data?.recentInvoices ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">{tx("لا توجد فواتير بعد", "No invoices yet")}</p>
                ) : (
                  (data?.recentInvoices ?? []).map((inv: any) => {
                    const st = INV_STATUS[inv.status] ?? INV_STATUS.draft;
                    return (
                      <Link key={inv.id} href="/invoices">
                        <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-all cursor-pointer group">
                          <div className="p-1.5 rounded-lg bg-emerald-500/8 group-hover:bg-emerald-500/15 transition-colors">
                            <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{inv.title}</p>
                            <p className={`text-[10px] font-mono font-semibold ${st.color}`}>{((inv.total ?? 0) / 100).toLocaleString(dateLocale)} {tx("ر.س","SAR")}</p>
                          </div>
                          <span className={`text-[10px] font-medium ${st.color}`}>{st.label}</span>
                        </div>
                      </Link>
                    );
                  })
                )
              }
            </div>
          </div>

          {/* Quick Actions — landing page CTA style */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border/40">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-bold">{tx("إجراءات سريعة", "Quick Actions")}</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {quickActions.map(a => {
                const Icon = a.icon;
                return (
                  <Link key={a.label} href={a.href}>
                    <div className="quick-action">
                      <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center transition-colors group-hover:bg-primary/10">
                        <Icon className="h-4 w-4 text-foreground/70" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground/80 leading-tight">{a.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          CLIENT RISK MATRIX + LIVE FEED
      ══════════════════════════════════════════════ */}
      <div className="app-fade app-fade-6">
        <ClientRiskMatrix />
      </div>

      <div className="app-fade app-fade-6">
        <LiveEventFeed />
      </div>

      {/* ══════════════════════════════════════════════
          UPCOMING EVENTS
      ══════════════════════════════════════════════ */}
      {(data?.upcomingEvents ?? []).length > 0 && (
        <div className="app-fade app-fade-6">
          <div className="section-label">{tx("المواعيد القادمة", "Upcoming Events")}</div>
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold">{tx("المواعيد القادمة (7 أيام)", "Upcoming (7 days)")}</span>
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7 rounded-lg" asChild>
                <Link href="/calendar">{tx("عرض التقويم", "Calendar")}</Link>
              </Button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(data?.upcomingEvents ?? []).map((ev: any) => {
                const colorClass = EVENT_COLORS[ev.event_type] ?? EVENT_COLORS.other;
                const date = new Date(ev.start_at);
                const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000);
                return (
                  <div key={ev.id} className={`rounded-xl border p-3.5 ${colorClass} transition-all hover:shadow-sm`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold leading-tight truncate">{ev.title}</p>
                        <p className="text-[10px] mt-1.5 opacity-80">
                          {date.toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "short" })}
                          {" · "}
                          {ev.all_day ? tx("طوال اليوم","All day") : date.toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0.5 shrink-0 font-bold ${
                        diffDays <= 1 ? "border-red-500/40 text-red-400 bg-red-500/10" :
                        diffDays <= 3 ? "border-orange-500/40 text-orange-400 bg-orange-500/10" :
                        "border-current/20 bg-white/50"
                      }`}>
                        {diffDays <= 0 ? tx("اليوم","Today") : diffDays === 1 ? tx("غداً","Tomorrow") : `${diffDays} ${tx("أيام","days")}`}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
