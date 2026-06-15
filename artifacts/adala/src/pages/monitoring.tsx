import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Shield, Zap, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, Play, Database, Cpu, Server, Clock, TrendingUp,
  Wifi, WifiOff, ChevronRight, Terminal, BarChart3, FlaskConical
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}${path}`;

function fetchJ(url: string, opts?: RequestInit) {
  return fetch(url, opts).then(r => {
    if (!r.ok) throw new Error("خطأ في الخادم");
    return r.json();
  });
}

function ScoreRing({ score }: { score: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const dash = (pct / 100) * circ;
  const color = pct >= 85 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={110} height={110} className="rotate-[-90deg]">
      <circle cx={55} cy={55} r={r} fill="none" stroke="#E5E7EB" strokeWidth={10} />
      <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray .8s ease" }} />
      <text x={55} y={60} fill={color} fontSize={22} fontWeight={700}
        textAnchor="middle" className="rotate-90 origin-center"
        style={{ transform: "rotate(90deg)", transformOrigin: "55px 55px" }}>
        {pct}
      </text>
    </svg>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
      ${ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
           : "bg-red-50 text-red-700 border border-red-200"}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </div>
  );
}

function SeverityChip({ s }: { s: string }) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-700 border-red-200",
    high:     "bg-orange-100 text-orange-700 border-orange-200",
    medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
    low:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  const labels: Record<string, string> = {
    critical: "حرج", high: "عالٍ", medium: "متوسط", low: "منخفض"
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${map[s] ?? map.medium}`}>
      {labels[s] ?? s}
    </span>
  );
}

const TAB_ITEMS = [
  { id: "overview",  label: "نظرة عامة",  icon: Activity },
  { id: "events",    label: "أحداث الإصلاح", icon: Zap },
  { id: "metrics",   label: "المقاييس",   icon: BarChart3 },
  { id: "simulate",  label: "محاكاة الأخطاء", icon: FlaskConical },
];

export default function MonitoringPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const healthQ = useQuery({
    queryKey: ["monitoring-health"],
    queryFn: () => fetchJ(api("/api/monitoring/health")),
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const metricsQ = useQuery({
    queryKey: ["monitoring-metrics"],
    queryFn: () => fetchJ(api("/api/monitoring/metrics")),
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const eventsQ = useQuery({
    queryKey: ["monitoring-events"],
    queryFn: () => fetchJ(api("/api/monitoring/events?limit=60")),
    enabled: tab === "events",
    refetchInterval: autoRefresh ? 15000 : false,
  });

  const healMut = useMutation({
    mutationFn: () => fetchJ(api("/api/monitoring/heal"), { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["monitoring-health"] }); },
  });

  const simulateMut = useMutation({
    mutationFn: (flags: object) => fetchJ(api("/api/monitoring/simulate"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(flags),
    }),
    onSuccess: () => {
      setTimeout(() => { qc.invalidateQueries({ queryKey: ["monitoring-metrics"] }); }, 2000);
    },
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["monitoring-health"] });
    qc.invalidateQueries({ queryKey: ["monitoring-metrics"] });
    qc.invalidateQueries({ queryKey: ["monitoring-events"] });
  }, [qc]);

  const health   = healthQ.data;
  const mData    = metricsQ.data;
  const metrics  = mData?.metrics;
  const anomalies = mData?.anomalies ?? [];
  const score    = health?.score ?? 0;
  const status   = health?.status ?? "unknown";
  const checks   = health?.checks ?? {};

  const statusColor = status === "healthy" ? "text-emerald-600"
    : status === "degraded" ? "text-amber-500" : "text-red-600";
  const statusLabel = status === "healthy" ? "يعمل بصحة جيدة"
    : status === "degraded" ? "أداء متدهور" : status === "critical" ? "حالة حرجة" : "جارٍ الفحص…";

  return (
    <div className="min-h-screen bg-gray-50 p-6 rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">مركز المراقبة والإصلاح الذاتي</h1>
            <p className="text-sm text-gray-500">Monitoring + Auto-Healing System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition
              ${autoRefresh ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                           : "bg-gray-100 text-gray-500 border-gray-200"}`}>
            {autoRefresh ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {autoRefresh ? "تحديث تلقائي" : "إيقاف التحديث"}
          </button>
          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 transition">
            <RefreshCw className="h-3 w-3" /> تحديث
          </button>
          <button
            onClick={() => healMut.mutate()}
            disabled={healMut.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60">
            <Zap className="h-3 w-3" />
            {healMut.isPending ? "جارٍ الإصلاح…" : "تشغيل الإصلاح الذاتي"}
          </button>
        </div>
      </div>

      {/* Heal result banner */}
      {healMut.data && (
        <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          تم تطبيق {healMut.data.healed} إصلاح تلقائي
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TAB_ITEMS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.id ? "bg-blue-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* Score + Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center gap-6">
              <ScoreRing score={score} />
              <div>
                <div className="text-xs text-gray-500 mb-1">صحة النظام</div>
                <div className={`text-2xl font-bold ${statusColor}`}>{statusLabel}</div>
                <div className="text-sm text-gray-400 mt-1">{anomalies.length} شذوذ نشط</div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">فحوصات النظام</div>
              {Object.entries(checks).map(([k, v]: any) => (
                <div key={k} className="flex items-center justify-between">
                  <StatusBadge ok={v.ok} label={
                    k === "database" ? "قاعدة البيانات" :
                    k === "memory"   ? "الذاكرة" :
                    k === "error_rate" ? "معدل الأخطاء" :
                    k === "db_latency" ? "سرعة DB" :
                    k === "webhook"  ? "Webhooks" : k
                  } />
                  <span className="text-xs text-gray-400">{v.detail ?? (v.latency ? `${v.latency}ms` : "")}</span>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">المقاييس الآنية</div>
              {metrics && (
                <>
                  <MetricRow icon={<Database className="h-3.5 w-3.5 text-blue-500" />}
                    label="زمن استجابة DB" value={`${metrics.dbLatency}ms`}
                    warn={metrics.dbLatency > 500} />
                  <MetricRow icon={<Cpu className="h-3.5 w-3.5 text-purple-500" />}
                    label="استهلاك الذاكرة" value={`${metrics.memory.percent}%`}
                    warn={metrics.memory.percent > 80} />
                  <MetricRow icon={<Activity className="h-3.5 w-3.5 text-emerald-500" />}
                    label="معدل الأخطاء" value={`${(metrics.errorRate * 100).toFixed(1)}%`}
                    warn={metrics.errorRate > 0.05} />
                  <MetricRow icon={<Server className="h-3.5 w-3.5 text-orange-500" />}
                    label="وقت التشغيل" value={`${Math.round(metrics.uptime / 60)}m`} />
                  <MetricRow icon={<TrendingUp className="h-3.5 w-3.5 text-indigo-500" />}
                    label="Webhook أخطاء" value={`${metrics.webhookFailures}`}
                    warn={metrics.webhookFailures > 3} />
                </>
              )}
            </div>
          </div>

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div className="bg-white border border-orange-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="font-semibold text-gray-800">شذوذات مكتشفة ({anomalies.length})</span>
              </div>
              <div className="space-y-2">
                {anomalies.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="flex items-center gap-3">
                      <SeverityChip s={a.severity} />
                      <div>
                        <div className="text-sm font-medium text-gray-800">{a.message}</div>
                        <div className="text-xs text-gray-500 font-mono">{a.code}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      القيمة: {typeof a.value === "number" && a.value < 1 ? `${(a.value * 100).toFixed(1)}%` : a.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {anomalies.length === 0 && health && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-semibold text-emerald-800">النظام يعمل بشكل مثالي</div>
                <div className="text-sm text-emerald-600">لا توجد شذوذات — جميع الخدمات تعمل بصحة جيدة</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Events Tab ── */}
      {tab === "events" && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-gray-500" />
              <span className="font-semibold text-gray-800">سجل أحداث الإصلاح الذاتي</span>
            </div>
            <span className="text-xs text-gray-400">{eventsQ.data?.events?.length ?? 0} حدث</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[520px] overflow-y-auto">
            {eventsQ.isLoading && (
              <div className="p-8 text-center text-gray-400 text-sm">جارٍ التحميل…</div>
            )}
            {(eventsQ.data?.events ?? []).length === 0 && !eventsQ.isLoading && (
              <div className="p-8 text-center text-gray-400 text-sm">لا توجد أحداث بعد — شغّل الإصلاح الذاتي أو محاكاة الأخطاء</div>
            )}
            {(eventsQ.data?.events ?? []).map((ev: any) => (
              <div key={ev.id} className="p-4 hover:bg-gray-50 transition flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0
                  ${ev.fix_success ? "bg-emerald-500" :
                    ev.fix_success === false ? "bg-red-500" : "bg-blue-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{ev.message}</span>
                    <SeverityChip s={ev.severity} />
                    {ev.fix_applied && (
                      <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {ev.fix_applied}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span className="font-mono">{ev.event_type}</span>
                    {ev.duration_ms > 0 && <span>{ev.duration_ms}ms</span>}
                    <span><Clock className="h-3 w-3 inline mr-0.5" />
                      {new Date(ev.created_at).toLocaleString("ar-SA")}
                    </span>
                  </div>
                </div>
                {ev.fix_success != null && (
                  <div className="shrink-0">
                    {ev.fix_success
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <XCircle className="h-4 w-4 text-red-500" />}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Metrics Tab ── */}
      {tab === "metrics" && metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "زمن استجابة DB", value: `${metrics.dbLatency}ms`, icon: Database, color: "blue", warn: metrics.dbLatency > 500 },
            { label: "استهلاك الذاكرة", value: `${metrics.memory.percent}%`, icon: Cpu, color: "purple", warn: metrics.memory.percent > 80 },
            { label: "معدل الأخطاء", value: `${(metrics.errorRate * 100).toFixed(2)}%`, icon: Activity, color: "red", warn: metrics.errorRate > 0.05 },
            { label: "طلبات نشطة", value: `${metrics.activeRequests}`, icon: Server, color: "emerald" },
            { label: "إجمالي الطلبات (60s)", value: `${metrics.totalRequests}`, icon: TrendingUp, color: "indigo" },
            { label: "أخطاء Webhook", value: `${metrics.webhookFailures}`, icon: Wifi, color: "orange", warn: metrics.webhookFailures > 3 },
            { label: "وقت التشغيل", value: `${Math.floor(metrics.uptime / 3600)}h ${Math.floor((metrics.uptime % 3600) / 60)}m`, icon: Clock, color: "teal" },
            { label: "ذاكرة مستخدمة", value: `${Math.round(metrics.memory.used / 1024 / 1024)}MB`, icon: Cpu, color: "violet" },
            { label: "صحة DB", value: metrics.dbHealth ? "متصل" : "منقطع", icon: Database, color: "green", warn: !metrics.dbHealth },
          ].map((m, i) => (
            <div key={i} className={`bg-white border rounded-2xl p-5 ${m.warn ? "border-orange-300" : "border-gray-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                <m.icon className={`h-4 w-4 text-${m.color}-500`} />
                <span className="text-xs text-gray-500">{m.label}</span>
              </div>
              <div className={`text-2xl font-bold ${m.warn ? "text-orange-600" : "text-gray-900"}`}>{m.value}</div>
              {m.warn && <div className="text-xs text-orange-500 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />يتجاوز الحد</div>}
            </div>
          ))}
        </div>
      )}

      {/* ── Simulate Tab ── */}
      {tab === "simulate" && (
        <div className="max-w-lg space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            هذه الأدوات لاختبار نظام الإصلاح الذاتي فقط — تُحقن أخطاء وهمية لا تؤثر على البيانات الحقيقية.
          </div>
          {[
            { label: "محاكاة فشل Stripe Webhooks", key: "stripeWebhookFailure", icon: "⚡", desc: "يُضخ 5 أخطاء webhook" },
            { label: "محاكاة معدل أخطاء عالٍ", key: "highErrorRate", icon: "🔴", desc: "يُضخ 30 طلب فاشل" },
            { label: "محاكاة تأخر DB", key: "dbLatency", icon: "🐌", desc: "يُسجل تحذير تأخر" },
          ].map(sim => (
            <div key={sim.key} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{sim.icon}</span>
                <div>
                  <div className="font-semibold text-gray-800 text-sm">{sim.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{sim.desc}</div>
                </div>
              </div>
              <button
                onClick={() => simulateMut.mutate({ [sim.key]: true })}
                disabled={simulateMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition disabled:opacity-50">
                <Play className="h-3 w-3" /> تشغيل
              </button>
            </div>
          ))}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔄</span>
              <div>
                <div className="font-semibold text-gray-800 text-sm">تشغيل دورة إصلاح ذاتي كاملة</div>
                <div className="text-xs text-gray-400 mt-0.5">يفحص + يصلح كل الشذوذات</div>
              </div>
            </div>
            <button
              onClick={() => healMut.mutate()}
              disabled={healMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50">
              <Zap className="h-3 w-3" /> {healMut.isPending ? "جارٍ…" : "إصلاح"}
            </button>
          </div>
          {simulateMut.isSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> تم حقن الخطأ — شغّل الإصلاح الذاتي لمعالجته
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetricRow({ icon, label, value, warn }: {
  icon: React.ReactNode; label: string; value: string; warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        {icon} {label}
      </div>
      <span className={`text-xs font-semibold ${warn ? "text-orange-600" : "text-gray-800"}`}>
        {warn && <AlertTriangle className="h-3 w-3 inline ml-1" />}{value}
      </span>
    </div>
  );
}
