/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
/**
 * Legal OS — نظام التشغيل القانوني
 * ───────────────────────────────────
 * سطح مكتب قانوني موحّد يعرض كل طبقات المنصة كنظام تشغيل حقيقي
 *
 * 4 views: Desktop · Processes · AI Intelligence · Event Bus
 */

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { authFetch } from "@/lib/authFetch";
import {
  Scale, DollarSign, FileText, CheckSquare, Bot, Activity,
  Lock, Shield, RefreshCw, TrendingUp, TrendingDown,
  Cpu, Wifi, Database, Brain, Bell, Calendar,
  ChevronRight, Circle, Zap, Receipt, Users,
  AlertTriangle, CheckCircle2, Clock, Layers,
  BarChart3, MessageSquare, Sparkles, Network,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
async function get(url: string) {
  const r = await authFetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ── Constants ──────────────────────────────────────── */
const CASE_TYPE_AR: Record<string, string> = {
  criminal: "جنائية", civil: "مدنية", commercial: "تجارية",
  labor: "عمالية", real_estate: "عقارية",
};
const STATE_CFG: Record<string, { dot: string; label: string }> = {
  open:        { dot: "bg-blue-400",   label: "مفتوحة" },
  in_progress: { dot: "bg-amber-400",  label: "جارية"  },
  closed:      { dot: "bg-muted/30",   label: "مغلقة"  },
};
const EVENT_ICON: Record<string, string> = {
  hearing: "📅", note: "📝", document: "📎",
  decision: "⚖️", consultation: "💬",
};
const LAYER_ICON: Record<string, any> = {
  "case-layer":      Scale,
  "client-layer":    Users,
  "finance-layer":   DollarSign,
  "task-layer":      CheckSquare,
  "ai-layer":        Brain,
  "invoice-layer":   Receipt,
  "isolation-layer": Shield,
  "hardening-layer": Lock,
};

/* ── ScoreDial ──────────────────────────────────────── */
function ScoreDial({ score }: { score: number }) {
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
  const color = score >= 90 ? "#10b981" : score >= 75 ? "#3b82f6"
              : score >= 60 ? "#f59e0b" : "#ef4444";
  const r = 44, cx = 56, cy = 56;
  const circ = 2 * Math.PI * r;
  const arc  = circ * (score / 100);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={112} height={112}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1f2937" strokeWidth={10} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeDashoffset={circ / 4} strokeLinecap="round"
          style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1)" }} />
        <text x={cx} y={cy - 4}  textAnchor="middle" fontSize={26} fontWeight="800" fill={color}>{grade}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={12} fill="#6b7280">{score}</text>
      </svg>
      <span className="text-xs text-muted-foreground">صحة النظام</span>
    </div>
  );
}

/* ── LayerCard ──────────────────────────────────────── */
function LayerCard({ layer }: { layer: any }) {
  const Icon = LAYER_ICON[layer.id] ?? Activity;
  const isOp = layer.status === "operational";
  const metrics = Object.entries(layer.metrics ?? {}).slice(0, 4);

  return (
    <div className={`
      bg-gray-900 rounded-2xl p-4 border transition-all duration-200 hover:scale-[1.02]
      ${isOp ? "border-gray-800 hover:border-gray-700" : "border-amber-800/60 shadow-amber-900/20 shadow-lg"}
    `}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg
          ${isOp ? "bg-blue-900/50" : "bg-amber-900/50"}`}>
          {layer.icon}
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse
            ${isOp ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium
            ${isOp
              ? "text-emerald-400 border-emerald-800/50 bg-emerald-900/20"
              : "text-amber-400 border-amber-800/50 bg-amber-900/20"
            }`}>
            {isOp ? "يعمل" : "متدهور"}
          </span>
        </div>
      </div>
      <div className="text-sm font-semibold text-white mb-2.5">{layer.nameAr}</div>
      <div className="space-y-1">
        {metrics.map(([k, v]) => (
          <div key={k} className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{k.replace(/_/g, " ")}</span>
            <span className="text-xs font-mono text-gray-300 tabular-nums">{String(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── ProcessRow ─────────────────────────────────────── */
function ProcessRow({ proc }: { proc: any }) {
  const st = STATE_CFG[proc.state] ?? STATE_CFG.open;
  const typeAr = CASE_TYPE_AR[proc.caseType] ?? proc.caseType;

  return (
    <Link href={`/cases/${proc.id}`}>
      <div className="group bg-gray-900 border border-gray-800 rounded-xl px-4 py-3
        flex items-center gap-4 hover:border-blue-700/60 hover:bg-gray-800/50
        transition-all duration-150 cursor-pointer">
        <div className={`w-2 h-2 rounded-full ${st.dot} shrink-0`} />
        <Scale className="h-4 w-4 text-blue-400 shrink-0" />
        <span className="text-sm text-white flex-1 truncate font-medium">{proc.title}</span>
        <span className="text-xs text-muted-foreground shrink-0">{proc.clientName}</span>
        <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full shrink-0 border border-blue-800/40">
          {typeAr}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0
          ${proc.state === "open" ? "bg-blue-900/30 text-blue-300" : "bg-amber-900/30 text-amber-300"}`}>
          {st.label}
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />{proc.tasks}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />{proc.messages}
          </span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-foreground/70 group-hover:text-blue-400 transition-colors shrink-0" />
      </div>
    </Link>
  );
}

/* ── EventEntry ─────────────────────────────────────── */
function EventEntry({ ev }: { ev: any }) {
  const icon  = EVENT_ICON[ev.eventType] ?? "📌";
  const when  = ev.createdAt
    ? new Date(ev.createdAt).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-800/60 last:border-0">
      <span className="text-base shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white font-medium truncate">{ev.title}</p>
        {ev.body && <p className="text-xs text-muted-foreground truncate">{ev.body}</p>}
      </div>
      <span className="text-xs text-foreground/70 shrink-0 whitespace-nowrap">{when}</span>
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; trend?: "up" | "down" | "flat";
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        {trend === "up"   && <TrendingUp   className="h-3 w-3 text-emerald-500" />}
        {trend === "down" && <TrendingDown  className="h-3 w-3 text-red-400" />}
      </div>
      {sub && <div className="text-xs text-foreground/70 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────── */
type View = "desktop" | "processes" | "ai" | "events";

export default function LegalOSPage() {
  const qc  = useQueryClient();
  const [view, setView] = useState<View>("desktop");
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("ar-SA"));

  /* live clock */
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString("ar-SA")), 1000);
    return () => clearInterval(id);
  }, []);

  const snapQ = useQuery({
    queryKey:       ["legalos-snap"],
    queryFn:        () => get(`${BASE}/api/legal-os/snapshot`),
    refetchInterval: 20_000,
    staleTime:      10_000,
  });

  const snap     = snapQ.data ?? {} as any;
  const layers   = snap.layers   ?? [];
  const procs    = snap.processes ?? [];
  const events   = snap.eventBus  ?? [];
  const alerts   = snap.alerts    ?? { critical: 0, warning: 0, info: 0 };
  const health   = snap.healthScore ?? 0;
  const sysMode  = snap.systemMode  ?? "stable";
  const aiData   = snap.ai          ?? { pendingApprovals: 0, totalInsights: 0 };
  const finance  = snap.finance     ?? { totalRevenue: 0, totalExpenses: 0, pendingInvoices: 0, balance: 0 };

  const casesLayer = layers.find((l: any) => l.id === "case-layer") ?? {};
  const tasksLayer = layers.find((l: any) => l.id === "task-layer") ?? {};

  const tabs: { id: View; label: string; badge?: number }[] = [
    { id: "desktop",   label: "🖥️ سطح المكتب"    },
    { id: "processes", label: "⚙️ العمليات",      badge: procs.length },
    { id: "ai",        label: "🧠 الذكاء",         badge: aiData.pendingApprovals || undefined },
    { id: "events",    label: "⚡ جدار الأحداث",  badge: events.length || undefined },
  ];

  const modeColor = sysMode === "stable"
    ? "bg-emerald-900/60 text-emerald-300 border-emerald-800/50"
    : "bg-amber-900/60 text-amber-300 border-amber-800/50";

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">

      {/* ══ OS TOP BAR ══ */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-2.5
        bg-gray-900/95 border-b border-gray-800 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-blue-400" />
          <span className="font-bold text-white text-sm tracking-wide">عدالة Legal OS</span>
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${modeColor}`}>
            {sysMode === "stable" ? "🟢 مستقر" : sysMode === "degraded" ? "🟡 متدهور" : "🔴 وضع آمن"}
          </span>
          {alerts.critical > 0 && (
            <span className="text-xs bg-red-900/60 text-red-300 border border-red-800/50 px-2 py-0.5 rounded-full animate-pulse">
              {alerts.critical} حرج
            </span>
          )}
          {alerts.warning > 0 && (
            <span className="text-xs bg-amber-900/60 text-amber-300 border border-amber-800/50 px-2 py-0.5 rounded-full">
              {alerts.warning} تحذير
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* view tabs */}
          {tabs.map(tab => (
            <button key={tab.id}
              onClick={() => setView(tab.id)}
              className={`relative text-xs px-3 py-1.5 rounded-lg transition font-medium
                ${view === tab.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                  : "text-muted-foreground hover:bg-gray-800 hover:text-gray-200"}`}>
              {tab.label}
              {tab.badge ? (
                <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center text-white font-bold">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}

          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["legalos-snap"] })}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition text-muted-foreground hover:text-gray-300">
            <RefreshCw className={`h-3.5 w-3.5 ${snapQ.isFetching ? "animate-spin" : ""}`} />
          </button>
          <div className="flex items-center gap-1 text-xs text-emerald-400">
            <Wifi className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">متصل</span>
          </div>
        </div>
      </div>

      {/* ══ LOADING ══ */}
      {snapQ.isLoading && (
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <Cpu className="h-10 w-10 text-blue-700 animate-pulse" />
          <div className="text-muted-foreground text-sm animate-pulse">جارٍ تحميل نظام التشغيل…</div>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {!snapQ.isLoading && (
        <div className="pb-14"> {/* leave space for footer */}

          {/* ══════════════════════════════════════════
              DESKTOP VIEW
          ══════════════════════════════════════════ */}
          {view === "desktop" && (
            <div className="p-6 space-y-6">

              {/* Row 1: Health Dial + 5 KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-5
                  flex flex-col items-center justify-center">
                  <ScoreDial score={health} />
                </div>

                <KpiCard label="قضايا مفتوحة"   value={casesLayer.metrics?.["مفتوحة"] ?? 0}
                  sub={`إجمالي: ${casesLayer.metrics?.["الإجمالي"] ?? 0}`}
                  icon={Scale} color="bg-blue-600" trend="flat" />

                <KpiCard label="مهام معلقة"    value={tasksLayer.metrics?.["معلقة"] ?? 0}
                  sub={`متأخرة: ${tasksLayer.metrics?.["متأخرة"] ?? 0}`}
                  icon={CheckSquare} color="bg-amber-600"
                  trend={(tasksLayer.metrics?.["متأخرة"] ?? 0) > 0 ? "down" : "flat"} />

                <KpiCard label="الرصيد المالي"
                  value={`${Number(finance.balance).toLocaleString("ar")} ر.س`}
                  sub={`إيرادات: ${Number(finance.totalRevenue).toLocaleString("ar")}`}
                  icon={DollarSign} color={finance.balance >= 0 ? "bg-emerald-600" : "bg-red-600"}
                  trend={finance.balance >= 0 ? "up" : "down"} />

                <KpiCard label="تحليلات AI"    value={aiData.totalInsights}
                  sub={aiData.pendingApprovals > 0 ? `${aiData.pendingApprovals} بانتظار موافقة` : "لا توجد مهام معلقة"}
                  icon={Brain} color="bg-violet-600"
                  trend={aiData.pendingApprovals > 0 ? "down" : "flat"} />

                <KpiCard label="فواتير معلقة"  value={finance.pendingInvoices}
                  icon={Receipt} color="bg-rose-600" trend="flat" />
              </div>

              {/* Row 2: OS Layers Grid */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    طبقات نظام التشغيل — {layers.length} طبقة
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {layers.map((layer: any) => (
                    <LayerCard key={layer.id} layer={layer} />
                  ))}
                </div>
              </div>

              {/* Row 3: System Status Bar */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-semibold text-gray-300">مؤشر حالة الطبقات</span>
                </div>
                <div className="flex gap-2">
                  {layers.map((layer: any) => (
                    <div key={layer.id} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className={`h-1.5 w-full rounded-full transition-all duration-500
                        ${layer.status === "operational" ? "bg-emerald-500"
                          : layer.status === "degraded"   ? "bg-amber-400"
                          : "bg-red-500"}`} />
                      <span className="text-xs text-foreground/70 truncate w-full text-center">
                        {layer.nameAr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 4: Recent events preview */}
              {events.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-400" />
                      <span className="text-xs font-semibold text-gray-300">آخر أحداث النظام</span>
                    </div>
                    <button onClick={() => setView("events")}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      عرض الكل <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6">
                    {events.slice(0, 6).map((ev: any) => (
                      <EventEntry key={ev.id} ev={ev} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              PROCESSES VIEW
          ══════════════════════════════════════════ */}
          {view === "processes" && (
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Network className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  العمليات النشطة — Legal Processes
                </span>
                <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded-full">
                  {procs.length} عملية
                </span>
              </div>

              {procs.length === 0 ? (
                <div className="text-center py-16">
                  <Scale className="h-12 w-12 text-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">لا توجد عمليات نشطة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* header */}
                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 pb-1.5
                    text-xs text-foreground/70 uppercase tracking-wider font-medium border-b border-gray-800">
                    <span />
                    <span>عنوان القضية</span>
                    <span>الموكّل</span>
                    <span>النوع</span>
                    <span>الحالة</span>
                    <span>المهام / الرسائل</span>
                    <span />
                  </div>
                  {procs.map((proc: any) => (
                    <ProcessRow key={proc.id} proc={proc} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              AI INTELLIGENCE VIEW
          ══════════════════════════════════════════ */}
          {view === "ai" && (
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 mb-0">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  طبقة الذكاء الاصطناعي
                </span>
              </div>

              {/* AI KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-900 border border-violet-800/40 rounded-2xl p-5">
                  <Brain className="h-6 w-6 text-violet-400 mb-3" />
                  <div className="text-3xl font-bold text-white">{aiData.totalInsights}</div>
                  <div className="text-xs text-muted-foreground mt-1">تحليل AI مخزّن</div>
                </div>
                <div className={`bg-gray-900 border rounded-2xl p-5
                  ${aiData.pendingApprovals > 0 ? "border-amber-700/60" : "border-gray-800"}`}>
                  <Sparkles className="h-6 w-6 text-amber-400 mb-3" />
                  <div className="text-3xl font-bold text-white">{aiData.pendingApprovals}</div>
                  <div className="text-xs text-muted-foreground mt-1">إجراء بانتظار موافقتك</div>
                  {aiData.pendingApprovals > 0 && (
                    <Link href="/cases">
                      <button className="mt-3 text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition">
                        راجع الإجراءات →
                      </button>
                    </Link>
                  )}
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                  <Activity className="h-6 w-6 text-blue-400 mb-3" />
                  <div className="text-3xl font-bold text-white">{aiData.totalInsights}</div>
                  <div className="text-xs text-muted-foreground mt-1">جلسات المساعد الذكي</div>
                  {aiData.lastAnalysis && (
                    <div className="text-xs text-foreground/70 mt-1">
                      آخر تحليل: {new Date(aiData.lastAnalysis).toLocaleDateString("ar-SA")}
                    </div>
                  )}
                </div>
              </div>

              {/* AI Architecture Diagram */}
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <div className="text-sm font-semibold text-gray-300 mb-6 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-blue-400" />
                  بنية Autonomous Legal AI
                </div>
                <div className="flex flex-col items-center gap-0">
                  {[
                    { label: "بيانات القضية", icon: "📁", color: "border-blue-800 bg-blue-900/20 text-blue-300" },
                    { label: "Gemini 2.5 Flash", icon: "🧠", color: "border-violet-700 bg-violet-900/20 text-violet-300" },
                    { label: "تحليل المخاطر + اقتراح الإجراءات", icon: "⚡", color: "border-amber-700 bg-amber-900/20 text-amber-300" },
                    { label: "Approval Gate — موافقة المحامي", icon: "🔐", color: "border-red-800 bg-red-900/20 text-red-300" },
                    { label: "تنفيذ: إنشاء مهمة حقيقية", icon: "✅", color: "border-emerald-800 bg-emerald-900/20 text-emerald-300" },
                    { label: "Audit Log — تسجيل كامل", icon: "📋", color: "border-gray-700 bg-gray-800/40 text-muted-foreground" },
                  ].map((step, i) => (
                    <div key={i} className="flex flex-col items-center w-full max-w-sm">
                      <div className={`w-full border rounded-xl px-4 py-2.5 flex items-center gap-3
                        text-sm font-medium ${step.color}`}>
                        <span className="text-base">{step.icon}</span>
                        {step.label}
                      </div>
                      {i < 5 && (
                        <div className="flex flex-col items-center py-1">
                          <div className="w-px h-4 bg-gray-700" />
                          <ChevronRight className="h-3 w-3 text-foreground/70 rotate-90" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Safety Rules */}
              <div className="bg-gray-900 border border-red-900/30 rounded-2xl p-5">
                <div className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-red-400" />
                  قواعد السلامة — Safety Kernel
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "❌ لا تعديل مباشر على القضايا",
                    "❌ لا تغيير للحالة بدون إذن",
                    "❌ لا تعديل على البيانات المالية",
                    "❌ لا تجاوز لعزل المكاتب",
                    "✅ اقتراح فقط — Propose Only",
                    "✅ الإنسان يوافق دائماً — Human-in-the-Loop",
                  ].map((rule, i) => (
                    <div key={i} className={`text-xs px-3 py-2 rounded-lg
                      ${rule.startsWith("❌")
                        ? "bg-red-900/20 text-red-400 border border-red-900/30"
                        : "bg-emerald-900/20 text-emerald-400 border border-emerald-900/30"}`}>
                      {rule}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              EVENT BUS VIEW
          ══════════════════════════════════════════ */}
          {view === "events" && (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  جدار الأحداث — Event Bus
                </span>
                <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded-full">
                  {events.length} حدث
                </span>
              </div>

              {events.length === 0 ? (
                <div className="text-center py-16">
                  <Activity className="h-12 w-12 text-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">لا توجد أحداث حديثة</p>
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl">
                  {/* terminal-style header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/60" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">legal-os event-bus — live stream</span>
                    <div className="flex-1" />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-500 font-mono">LIVE</span>
                  </div>
                  <div className="p-4 divide-y divide-gray-800/60">
                    {events.map((ev: any) => {
                      const icon = EVENT_ICON[ev.eventType] ?? "📌";
                      const when = ev.createdAt
                        ? new Date(ev.createdAt).toLocaleString("ar-SA", {
                            year: "numeric", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })
                        : "—";
                      return (
                        <div key={ev.id} className="flex items-start gap-4 py-3">
                          <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-muted-foreground font-mono">
                                {ev.eventType}
                              </span>
                              <span className="text-xs text-foreground/70 font-mono">{ev.caseId?.slice(0, 8)}…</span>
                            </div>
                            <p className="text-sm text-white font-medium">{ev.title}</p>
                            {ev.body && <p className="text-xs text-muted-foreground mt-0.5">{ev.body}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-xs text-foreground/70 font-mono">{when}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ OS STATUS FOOTER ══ */}
      <div className="fixed bottom-0 right-0 left-0 px-6 py-2
        bg-gray-900/95 border-t border-gray-800 flex items-center justify-between
        text-xs text-muted-foreground backdrop-blur-sm z-20">
        <div className="flex items-center gap-4">
          <span className="font-mono">Legal OS v3.0</span>
          <span>طبقات: {layers.length}</span>
          <span>عمليات: {procs.length}</span>
          <span>أحداث: {events.length}</span>
          {aiData.pendingApprovals > 0 && (
            <span className="text-amber-500 animate-pulse font-medium">
              ⚡ {aiData.pendingApprovals} إجراء AI بانتظار الموافقة
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono">{clock}</span>
          <span>{new Date().toLocaleDateString("ar-SA")}</span>
          <div className={`w-2 h-2 rounded-full animate-pulse
            ${health >= 80 ? "bg-emerald-400" : health >= 60 ? "bg-amber-400" : "bg-red-500"}`} />
          <span className={health >= 80 ? "text-emerald-500" : health >= 60 ? "text-amber-500" : "text-red-500"}>
            {health}%
          </span>
        </div>
      </div>
    </div>
  );
}
