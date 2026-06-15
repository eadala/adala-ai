import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, ShieldCheck, ShieldOff, Zap, AlertTriangle, CheckCircle2,
  RefreshCw, XCircle, Activity, Database, CreditCard, Cpu,
  ToggleLeft, ToggleRight, Play, BookOpen
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string) => `${BASE}${path}`;
async function fetchJ(url: string, opts?: RequestInit) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  low:      "bg-blue-100 text-blue-700 border-blue-200",
};
const ACTION_COLORS: Record<string, string> = {
  BLOCK_PAYMENT_FLOW: "text-red-600 bg-red-50 border-red-200",
  THROTTLE_REQUESTS:  "text-orange-600 bg-orange-50 border-orange-200",
  OPEN_CIRCUIT:       "text-purple-600 bg-purple-50 border-purple-200",
  REJECT_REQUEST:     "text-red-600 bg-red-50 border-red-200",
  LOG_WARN:           "text-amber-600 bg-amber-50 border-amber-200",
  ALLOW:              "text-emerald-600 bg-emerald-50 border-emerald-200",
};
const STATE_COLORS: Record<string, string> = {
  CLOSED:    "text-emerald-700 bg-emerald-50 border-emerald-200",
  OPEN:      "text-red-700 bg-red-50 border-red-200",
  HALF_OPEN: "text-amber-700 bg-amber-50 border-amber-200",
};

const TAB_ITEMS = [
  { id: "dashboard", label: "لوحة التحكم", icon: Shield },
  { id: "circuits",  label: "Circuit Breakers", icon: Zap },
  { id: "rules",     label: "قواعد المنع", icon: BookOpen },
  { id: "events",    label: "سجل الأحداث", icon: Activity },
];

export default function PreventionPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard");

  const statusQ = useQuery({
    queryKey: ["prevention-status"],
    queryFn: () => fetchJ(api("/api/prevention/status")),
    refetchInterval: 15000,
  });
  const rulesQ = useQuery({
    queryKey: ["prevention-rules"],
    queryFn: () => fetchJ(api("/api/prevention/rules")),
    enabled: tab === "rules",
  });
  const eventsQ = useQuery({
    queryKey: ["prevention-events"],
    queryFn: () => fetchJ(api("/api/prevention/events?limit=60")),
    enabled: tab === "events",
    refetchInterval: 15000,
  });

  const resetMut = useMutation({
    mutationFn: (name: string) => fetchJ(api(`/api/prevention/circuits/${name}/reset`), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prevention-status"] }),
  });
  const openMut = useMutation({
    mutationFn: (name: string) => fetchJ(api(`/api/prevention/circuits/${name}/open`), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prevention-status"] }),
  });
  const checkMut = useMutation({
    mutationFn: () => fetchJ(api("/api/prevention/run-check"), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prevention-status"] }),
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["prevention-status"] });
    qc.invalidateQueries({ queryKey: ["prevention-events"] });
  }, [qc]);

  const d = statusQ.data;
  const circuits: any[] = d?.circuits ?? [];
  const triggered: any[] = d?.triggeredRules ?? [];
  const counters = d?.counters ?? {};
  const metrics = d?.metrics ?? {};
  const systemStatus = d?.status ?? "normal";

  const statusBg = systemStatus === "blocking" ? "bg-red-50 border-red-300"
    : systemStatus === "throttling" ? "bg-amber-50 border-amber-300"
    : "bg-emerald-50 border-emerald-300";
  const statusIcon = systemStatus === "blocking" ? <ShieldOff className="h-6 w-6 text-red-600" />
    : systemStatus === "throttling" ? <AlertTriangle className="h-6 w-6 text-amber-600" />
    : <ShieldCheck className="h-6 w-6 text-emerald-600" />;
  const statusLabel = systemStatus === "blocking" ? "يمنع تدفقات خطرة"
    : systemStatus === "throttling" ? "يقلّل حركة المرور"
    : "يعمل بصحة جيدة";

  return (
    <div className="min-h-screen bg-gray-50 p-6 rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">نظام منع الانهيار</h1>
            <p className="text-sm text-gray-500">Auto Prevention System — Circuit Breakers + Rules Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 transition">
            <RefreshCw className="h-3 w-3" /> تحديث
          </button>
          <button onClick={() => checkMut.mutate()} disabled={checkMut.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-60">
            <Play className="h-3 w-3" />
            {checkMut.isPending ? "جارٍ الفحص…" : "تشغيل فحص يدوي"}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {d && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border mb-6 ${statusBg}`}>
          {statusIcon}
          <div>
            <div className="font-semibold text-gray-900">{statusLabel}</div>
            <div className="text-xs text-gray-500">
              {triggered.length > 0
                ? `${triggered.length} قاعدة مُفعَّلة — ${triggered.map((r: any) => r.ruleId).join(", ")}`
                : "لا توجد قواعد مُفعَّلة — النظام سليم"}
            </div>
          </div>
          <div className="mr-auto flex items-center gap-4 text-xs text-gray-500">
            <span>محجوب: <strong className="text-red-600">{counters.blocked ?? 0}</strong></span>
            <span>مُقلَّل: <strong className="text-orange-600">{counters.throttled ?? 0}</strong></span>
            <span>احتياطي: <strong className="text-blue-600">{counters.fallback ?? 0}</strong></span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TAB_ITEMS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard Tab ── */}
      {tab === "dashboard" && (
        <div className="space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "تأخر قاعدة البيانات", value: `${metrics.dbLatency ?? 0}ms`, icon: Database, warn: (metrics.dbLatency ?? 0) > 600 },
              { label: "استهلاك الذاكرة", value: `${metrics.memoryPercent ?? 0}%`, icon: Cpu, warn: (metrics.memoryPercent ?? 0) > 80 },
              { label: "معدل الأخطاء", value: `${((metrics.errorRate ?? 0) * 100).toFixed(1)}%`, icon: Activity, warn: (metrics.errorRate ?? 0) > 0.05 },
              { label: "فشل Webhooks", value: `${metrics.webhookFailures ?? 0}`, icon: CreditCard, warn: (metrics.webhookFailures ?? 0) >= 5 },
            ].map((m, i) => (
              <div key={i} className={`bg-white border rounded-2xl p-5 ${m.warn ? "border-orange-300" : "border-gray-200"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <m.icon className={`h-4 w-4 ${m.warn ? "text-orange-500" : "text-gray-400"}`} />
                  <span className="text-xs text-gray-500">{m.label}</span>
                </div>
                <div className={`text-2xl font-bold ${m.warn ? "text-orange-600" : "text-gray-900"}`}>{m.value}</div>
                {m.warn && <div className="text-xs text-orange-500 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />يتجاوز الحد</div>}
              </div>
            ))}
          </div>

          {/* Circuit Breakers summary */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Zap className="h-4 w-4 text-indigo-500" />
              <span className="font-semibold text-gray-800 text-sm">Circuit Breakers</span>
            </div>
            <div className="divide-y divide-gray-50">
              {circuits.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">لم تُستخدم الدوائر بعد — تعمل في الوضع CLOSED</div>
              )}
              {circuits.map((c: any) => (
                <div key={c.name} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${STATE_COLORS[c.state] ?? "text-gray-600 bg-gray-50 border-gray-200"}`}>
                      {c.state}
                    </span>
                    <span className="text-sm font-medium text-gray-800 capitalize">{c.name}</span>
                    <span className="text-xs text-gray-400">{(c.failureRate * 100).toFixed(0)}% فشل ({c.failures}/{c.total})</span>
                  </div>
                  <div className="flex gap-2">
                    {c.state !== "CLOSED" && (
                      <button onClick={() => resetMut.mutate(c.name)} disabled={resetMut.isPending}
                        className="px-2 py-1 rounded-lg text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition">
                        <CheckCircle2 className="h-3 w-3 inline ml-1" />إعادة ضبط
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Triggered rules */}
          {triggered.length > 0 && (
            <div className="bg-white border border-orange-200 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-orange-100 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="font-semibold text-gray-800 text-sm">قواعد مُفعَّلة الآن ({triggered.length})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {triggered.map((r: any) => (
                  <div key={r.ruleId} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${SEVERITY_COLORS[r.severity] ?? ""}`}>
                        {r.severity}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-gray-800">{r.message}</div>
                        <div className="text-xs text-gray-400 font-mono">{r.ruleId} · {r.condition}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${ACTION_COLORS[r.action] ?? ""}`}>
                      {r.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {triggered.length === 0 && d && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="font-semibold text-emerald-800">لا توجد تهديدات نشطة</div>
                <div className="text-sm text-emerald-600">جميع القواعد سليمة — النظام محمي بالكامل</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Circuits Tab ── */}
      {tab === "circuits" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            فتح دائرة يدوياً يوقف جميع الطلبات لتلك الخدمة مؤقتاً. استخدم هذا فقط في حالات الطوارئ.
          </div>
          {["stripe", "database", "ai", "email", "webhook"].map(name => {
            const c = circuits.find((x: any) => x.name === name);
            const state: string = c?.state ?? "CLOSED";
            return (
              <div key={name} className={`bg-white border rounded-2xl p-5 flex items-center justify-between
                ${state === "OPEN" ? "border-red-300" : state === "HALF_OPEN" ? "border-amber-300" : "border-gray-200"}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${state === "CLOSED" ? "bg-emerald-500" : state === "OPEN" ? "bg-red-500" : "bg-amber-400"}`} />
                  <div>
                    <div className="font-semibold text-gray-800 capitalize">{name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {c ? `${c.failures} فشل / ${c.total} طلب — ${(c.failureRate * 100).toFixed(0)}% معدل فشل` : "لم تُستخدم بعد"}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${STATE_COLORS[state] ?? ""}`}>
                    {state}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openMut.mutate(name)} disabled={openMut.isPending || state === "OPEN"}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition disabled:opacity-40">
                    <XCircle className="h-3 w-3" /> فتح (طوارئ)
                  </button>
                  <button onClick={() => resetMut.mutate(name)} disabled={resetMut.isPending || state === "CLOSED"}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-40">
                    <CheckCircle2 className="h-3 w-3" /> إعادة ضبط
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Rules Tab ── */}
      {tab === "rules" && (
        <div className="space-y-3">
          {rulesQ.isLoading && <div className="p-8 text-center text-gray-400 text-sm">جارٍ التحميل…</div>}
          {(rulesQ.data?.rules ?? []).map((rule: any) => {
            const isTriggered = triggered.some((t: any) => t.ruleId === rule.id);
            return (
              <div key={rule.id}
                className={`bg-white border rounded-2xl p-5 flex items-center justify-between
                  ${isTriggered ? "border-orange-300 bg-orange-50/30" : "border-gray-200"}`}>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-mono text-gray-400">{rule.id}</span>
                    {isTriggered && <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-800">{rule.description}</div>
                    <div className="text-xs font-mono text-gray-400 mt-1">{rule.condition}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${SEVERITY_COLORS[rule.severity] ?? ""}`}>
                    {rule.severity}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${ACTION_COLORS[rule.action] ?? ""}`}>
                    {rule.action}
                  </span>
                  {isTriggered
                    ? <span className="flex items-center gap-1 text-xs text-orange-600 font-bold"><AlertTriangle className="h-3 w-3" />مُفعَّلة</span>
                    : <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" />سليمة</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Events Tab ── */}
      {tab === "events" && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-500" />
              <span className="font-semibold text-gray-800">سجل أحداث المنع</span>
            </div>
            <span className="text-xs text-gray-400">{eventsQ.data?.events?.length ?? 0} حدث</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[540px] overflow-y-auto">
            {eventsQ.isLoading && <div className="p-8 text-center text-gray-400 text-sm">جارٍ التحميل…</div>}
            {!eventsQ.isLoading && (eventsQ.data?.events ?? []).length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center gap-2">
                <Shield className="h-8 w-8 text-gray-300" />
                لا أحداث منع مسجَّلة — طبقة الحماية تعمل بصمت
              </div>
            )}
            {(eventsQ.data?.events ?? []).map((ev: any) => {
              const meta = ev.metadata ?? {};
              return (
                <div key={ev.id} className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0
                    ${ev.severity === "critical" ? "bg-red-500"
                      : ev.severity === "high" ? "bg-orange-400"
                      : ev.severity === "medium" ? "bg-amber-400"
                      : "bg-blue-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800">{ev.message}</div>
                    {meta.path && <div className="text-xs font-mono text-gray-400 mt-0.5">{meta.path}</div>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(ev.created_at).toLocaleString("ar-SA")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
