/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart, Zap, AlertTriangle, CheckCircle2, XCircle, RefreshCw,
  Activity, Shield, Clock, TrendingUp, SkipForward, BookOpen,
  Circle, ChevronDown, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;
async function get(u: string) { const r = await authFetch(u); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function post(u: string, b?: object) {
  const r = await authFetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b ?? {}) });
  if (!r.ok) throw new Error(await r.text()); return r.json();
}

const TABS = [
  { id: "dashboard", label: "لوحة التحكم",   icon: Heart     },
  { id: "events",    label: "سجل الأحداث",   icon: Activity  },
  { id: "state",     label: "الحالة الآمنة", icon: Shield    },
  { id: "rules",     label: "قواعد الإصلاح", icon: BookOpen  },
];

const SEV_STYLE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  low:      "bg-blue-100 text-blue-700 border-blue-200",
};
const RESULT_ICON = (r: string) =>
  r === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> :
  r === "failed"  ? <XCircle      className="h-4 w-4 text-red-500 shrink-0"     /> :
                    <SkipForward  className="h-4 w-4 text-muted-foreground shrink-0"    />;

const HEALTH_COLOR = (s: number) =>
  s >= 90 ? "text-emerald-600" : s >= 70 ? "text-blue-600" : s >= 50 ? "text-amber-600" : "text-red-600";
const HEALTH_BG = (s: number) =>
  s >= 90 ? "bg-emerald-50 border-emerald-200" : s >= 70 ? "bg-blue-50 border-blue-200" :
  s >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

function ScoreRing({ score }: { score: number }) {
  const r = 38, cx = 48, cy = 48, circ = 2 * Math.PI * r;
  const arc = circ * (score / 100);
  const color = score >= 90 ? "#10b981" : score >= 70 ? "#3b82f6" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={96} height={96}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={8} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${arc} ${circ - arc}`} strokeDashoffset={circ / 4} strokeLinecap="round"
        style={{ transition: "stroke-dasharray .5s ease" }} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={18} fontWeight="800" fill={color}>{score}</text>
    </svg>
  );
}

export default function SelfHealingPage() {
  const { toast } = useToast();
  const qc    = useQueryClient();
  const [tab, setTab]   = useState("dashboard");
  const [expand, setExpand] = useState<string | null>(null);

  const statusQ = useQuery({ queryKey: ["heal-status"], queryFn: () => get(api("/api/healing/status")), refetchInterval: 20000 });
  const eventsQ = useQuery({ queryKey: ["heal-events"], queryFn: () => get(api("/api/healing/events")), enabled: tab === "events", refetchInterval: 15000 });
  const stateQ  = useQuery({ queryKey: ["heal-state"],  queryFn: () => get(api("/api/healing/safe-state")), enabled: tab === "state" });
  const rulesQ  = useQuery({ queryKey: ["heal-rules"],  queryFn: () => get(api("/api/healing/rules")),  enabled: tab === "rules" });

  const runMut  = useMutation({
    mutationFn: () => post(api("/api/healing/run")),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["heal-status"] }); qc.invalidateQueries({ queryKey: ["heal-events"] }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const d = statusQ.data ?? {} as any;
  const health = d.healthScore ?? 0;
  const anomalies: any[] = d.anomalies ?? [];
  const stats = d.stats ?? { total: 0, success: 0, skipped: 0, failed: 0 };
  const bySev = d.bySeverity ?? {};

  return (
    <div className="min-h-screen bg-muted/30 p-6 rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">نظام الإصلاح الذاتي</h1>
            <p className="text-sm text-muted-foreground">Self-Healing Production System</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => runMut.mutate()} disabled={runMut.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-emerald-700 text-white hover:bg-emerald-800 transition disabled:opacity-50">
            <Zap className="h-4 w-4" /> {runMut.isPending ? "جارٍ الفحص…" : "تشغيل دورة الإصلاح"}
          </button>
          <button onClick={() => qc.invalidateQueries({ queryKey: ["heal-status"] })}
            className="p-2 rounded-lg bg-card border border-border hover:bg-muted/50 transition">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Run Result */}
      {runMut.data && (
        <div className={`mb-4 p-4 rounded-xl border text-sm flex items-start gap-2
          ${runMut.data.anomalies?.length === 0 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {runMut.data.anomalies?.length === 0
            ? <><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> النظام سليم — لا أعطال مكتشفة. تم تسجيل الحالة الآمنة.</>
            : <><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                اكتُشف {runMut.data.anomalies.length} عطل · نُفِّذ {runMut.data.actions?.length ?? 0} إجراء ·
                وضع النظام: <strong className="mx-1">{runMut.data.mode}</strong>
              </>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.id ? "bg-emerald-700 text-white shadow-sm" : "text-muted-foreground hover:bg-muted/50"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ══ Dashboard ══ */}
      {tab === "dashboard" && (
        <div className="space-y-5">
          {/* Health + KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`col-span-1 rounded-2xl border p-5 flex flex-col items-center justify-center ${HEALTH_BG(health)}`}>
              <ScoreRing score={health} />
              <div className={`text-xs font-semibold mt-2 ${HEALTH_COLOR(health)}`}>
                {health >= 90 ? "سليم" : health >= 70 ? "جيد" : health >= 50 ? "متدهور" : "حرج"}
              </div>
              <div className="text-xs text-muted-foreground">صحة النظام</div>
            </div>
            <div className="col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "إجراءات (24h)",  value: stats.total,   color: "gray"    },
                { label: "ناجحة",          value: stats.success, color: "emerald" },
                { label: "تجاوزت (يدوي)", value: stats.skipped, color: "amber"   },
              ].map((m, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 text-center">
                  <div className={`text-2xl font-bold text-${m.color}-600`}>{m.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                </div>
              ))}
              {[
                { label: "تأخر DB",     value: `${d.dbLatencyMs ?? "—"}ms`,           color: (d.dbLatencyMs ?? 0) > 600 ? "red" : "emerald" },
                { label: "Throttle",   value: d.queryThrottleActive ? "مفعّل" : "غير مفعّل", color: d.queryThrottleActive ? "amber" : "emerald" },
                { label: "وضع النظام", value: d.system?.mode ?? "—",                   color: d.system?.mode === "stable" ? "emerald" : "red" },
              ].map((m, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 text-center">
                  <div className={`text-lg font-bold text-${m.color}-600`}>{m.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Anomalies */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 font-semibold text-sm text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              الأعطال المكتشفة الآن
              {anomalies.length > 0 && (
                <span className="mr-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{anomalies.length} عطل</span>
              )}
            </div>
            {statusQ.isLoading && <div className="p-6 text-center text-muted-foreground text-sm animate-pulse">جارٍ الفحص…</div>}
            {anomalies.length === 0 && !statusQ.isLoading && (
              <div className="p-8 flex flex-col items-center gap-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-300" />
                <div className="text-sm font-medium text-muted-foreground">لا أعطال مكتشفة</div>
                <div className="text-xs text-muted-foreground">النظام يعمل بصحة جيدة</div>
              </div>
            )}
            <div className="divide-y divide-gray-50">
              {anomalies.map((a: any, i: number) => (
                <div key={i} className={`px-5 py-3 flex items-center gap-3 ${a.severity === "critical" ? "bg-red-50" : a.severity === "high" ? "bg-orange-50" : ""}`}>
                  <Circle className={`h-2 w-2 shrink-0 fill-current ${a.severity === "critical" ? "text-red-500" : a.severity === "high" ? "text-orange-500" : "text-amber-400"}`} />
                  <div className="flex-1">
                    <div className="text-sm text-foreground">{a.message}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 font-mono">{a.type} · قيمة: {a.metric} / حد: {a.threshold}</div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SEV_STYLE[a.severity]}`}>{a.severity}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${a.autoHealable ? "bg-emerald-100 text-emerald-700" : "bg-muted/50 text-muted-foreground"}`}>
                    {a.autoHealable ? "🔧 تلقائي" : "👤 يدوي"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Severity breakdown */}
          {Object.keys(bySev).length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="font-semibold text-sm text-foreground mb-4">توزيع الأحداث (24h) حسب الخطورة</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(["critical","high","medium","low"] as const).map(sev => (
                  <div key={sev} className={`p-3 rounded-xl text-center border ${SEV_STYLE[sev]}`}>
                    <div className="text-xl font-bold">{bySev[sev] ?? 0}</div>
                    <div className="text-xs mt-0.5">{sev}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Events ══ */}
      {tab === "events" && (
        <div className="space-y-2">
          {eventsQ.isLoading && <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">جارٍ التحميل…</div>}
          {(eventsQ.data?.events ?? []).length === 0 && !eventsQ.isLoading && (
            <div className="p-8 text-center text-muted-foreground text-sm">لا سجلات بعد — شغّل دورة إصلاح أولاً</div>
          )}
          {(eventsQ.data?.events ?? []).map((ev: any) => (
            <div key={ev.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setExpand(expand === ev.id ? null : ev.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-right">
                {RESULT_ICON(ev.action_result)}
                <div className="flex-1 text-right">
                  <div className="text-sm text-foreground font-mono">{ev.anomaly_type}</div>
                  <div className="text-xs text-muted-foreground">{ev.action_taken}</div>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${SEV_STYLE[ev.severity]}`}>{ev.severity}</span>
                <span className="text-xs text-muted-foreground">{ev.duration_ms}ms</span>
                <span className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleTimeString("ar-SA")}</span>
                {expand === ev.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expand === ev.id && (
                <div className="border-t border-border/40 px-4 pb-3 pt-2 text-xs text-muted-foreground space-y-1 bg-muted/30">
                  <div><strong>التفاصيل:</strong> {ev.detail}</div>
                  <div><strong>التحقق:</strong> {ev.verified ? "✅ تم التحقق" : "⏳ لم يتحقق بعد"}</div>
                  {ev.metrics && <div><strong>المقاييس:</strong> <span className="font-mono">{JSON.stringify(ev.metrics)}</span></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══ Safe State ══ */}
      {tab === "state" && (
        <div className="space-y-4">
          {stateQ.data?.current ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" /> آخر حالة مستقرة (في الذاكرة)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: "الإصدار",   value: stateQ.data.current.version },
                  { label: "درجة الصحة", value: `${stateQ.data.current.healthScore}/100` },
                  { label: "التوقيت",   value: new Date(stateQ.data.current.timestamp).toLocaleString("ar-SA") },
                ].map((m, i) => (
                  <div key={i} className="bg-card rounded-xl p-3 text-center border border-emerald-200/40">
                    <div className="font-bold text-emerald-700">{m.value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              لم تُسجَّل حالة مستقرة بعد — شغّل دورة إصلاح ناجحة
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 font-semibold text-sm text-foreground/70">
              تاريخ الحالات المستقرة
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {(stateQ.data?.history ?? []).map((snap: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs font-mono text-foreground/70 flex-1">v{snap.version}</span>
                  <span className="text-xs font-bold text-emerald-600">{snap.health_score}/100</span>
                  <span className="text-xs text-muted-foreground">{new Date(snap.created_at).toLocaleString("ar-SA")}</span>
                </div>
              ))}
              {(stateQ.data?.history ?? []).length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">لا سجلات بعد</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Rules ══ */}
      {tab === "rules" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 font-semibold text-sm text-foreground">قواعد الإصلاح التلقائي</div>
            <div className="divide-y divide-gray-50">
              {(rulesQ.data?.rules ?? []).map((rule: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${SEV_STYLE[rule.severity]}`}>{rule.severity}</span>
                  <div className="flex-1">
                    <div className="text-xs font-mono text-foreground/70">{rule.trigger}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">→ {rule.action}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0
                    ${rule.autoHeal ? "bg-emerald-100 text-emerald-700" : "bg-muted/50 text-muted-foreground"}`}>
                    {rule.autoHeal ? "🔧 تلقائي" : "👤 يدوي"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4" /> ما هو محظور على الإصلاح الذاتي
            </div>
            <div className="space-y-1.5">
              {(rulesQ.data?.forbidden ?? []).map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm text-red-700">
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" /> {f}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
