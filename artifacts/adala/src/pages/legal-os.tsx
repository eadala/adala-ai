import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Scale, DollarSign, FileText, CheckSquare, Bot, Activity,
  Lock, Shield, RefreshCw, TrendingUp, TrendingDown,
  Circle, Cpu, Wifi, Database
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;
async function get(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }

const LAYER_ICONS: Record<string, any> = {
  "case-layer":      Scale,
  "client-layer":    Database,
  "finance-layer":   DollarSign,
  "task-layer":      CheckSquare,
  "doc-layer":       FileText,
  "ai-layer":        Bot,
  "isolation-layer": Shield,
  "hardening-layer": Lock,
};

const STATUS_COLOR: Record<string, string> = {
  operational: "text-emerald-500 bg-emerald-50 border-emerald-200",
  degraded:    "text-amber-500 bg-amber-50 border-amber-200",
  offline:     "text-red-500 bg-red-50 border-red-200",
};
const STATUS_DOT: Record<string, string> = {
  operational: "bg-emerald-400",
  degraded:    "bg-amber-400",
  offline:     "bg-red-500",
};
const STATUS_LABEL: Record<string, string> = {
  operational: "يعمل", degraded: "متدهور", offline: "غير متاح",
};

const MODE_STYLE: Record<string, string> = {
  stable:    "bg-emerald-100 text-emerald-800",
  degraded:  "bg-amber-100 text-amber-800",
  safe_mode: "bg-red-100 text-red-800",
};

function ScoreDial({ score }: { score: number }) {
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
  const color = score >= 90 ? "#10b981" : score >= 75 ? "#3b82f6" : score >= 60 ? "#f59e0b" : "#ef4444";
  const r = 42, cx = 54, cy = 54;
  const circ = 2 * Math.PI * r;
  const arc  = circ * (score / 100);

  return (
    <div className="relative flex flex-col items-center">
      <svg width={108} height={108}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${arc} ${circ - arc}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round" style={{ transition: "stroke-dasharray .6s ease" }} />
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize={22} fontWeight="800" fill={color}>{grade}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="#6b7280">{score}</text>
      </svg>
      <div className="text-xs text-gray-500 mt-1">صحة النظام</div>
    </div>
  );
}

function MetricPill({ label, value, trend }: { label: string; value: string | number; trend?: "up" | "down" | "flat" }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-1">
        {trend === "up"   && <TrendingUp   className="h-3 w-3 text-emerald-500" />}
        {trend === "down" && <TrendingDown  className="h-3 w-3 text-red-400" />}
        <span className="text-xs font-semibold text-gray-800">{value}</span>
      </div>
    </div>
  );
}

export default function LegalOSPage() {
  const qc    = useQueryClient();
  const [view, setView] = useState<"desktop" | "processes">("desktop");

  const snapQ = useQuery({
    queryKey:       ["legalos-snap"],
    queryFn:        () => get(api("/api/legal-os/snapshot")),
    refetchInterval: 15000,
  });

  const snap    = snapQ.data ?? {} as any;
  const layers  = snap.layers  ?? [];
  const procs   = snap.processes ?? [];
  const alerts  = snap.alerts ?? { critical: 0, warning: 0, info: 0 };
  const health  = snap.healthScore ?? 0;
  const sysMode = snap.systemMode ?? "stable";

  return (
    <div className="min-h-screen bg-gray-950 text-white rtl" dir="rtl">
      {/* OS Top Bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Cpu className="h-5 w-5 text-blue-400" />
          <span className="font-bold text-white text-sm tracking-wide">عدالة Legal OS</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODE_STYLE[sysMode]}`}>
            {sysMode === "stable" ? "🟢 مستقر" : sysMode === "degraded" ? "🟡 متدهور" : "🔴 وضع آمن"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {alerts.critical > 0 && (
            <span className="text-xs bg-red-900 text-red-300 px-2 py-0.5 rounded-full">{alerts.critical} حرج</span>
          )}
          {alerts.warning > 0 && (
            <span className="text-xs bg-amber-900 text-amber-300 px-2 py-0.5 rounded-full">{alerts.warning} تحذير</span>
          )}
          <div className="flex gap-1">
            <button onClick={() => setView("desktop")}
              className={`text-xs px-3 py-1 rounded-lg transition ${view === "desktop" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}>
              سطح المكتب
            </button>
            <button onClick={() => setView("processes")}
              className={`text-xs px-3 py-1 rounded-lg transition ${view === "processes" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-800"}`}>
              العمليات
            </button>
          </div>
          <button onClick={() => qc.invalidateQueries({ queryKey: ["legalos-snap"] })}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition">
            <RefreshCw className="h-3.5 w-3.5 text-gray-400" />
          </button>
          <Wifi className="h-4 w-4 text-emerald-400" />
        </div>
      </div>

      {snapQ.isLoading && (
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500 text-sm animate-pulse">جارٍ تحميل بيانات النظام…</div>
        </div>
      )}

      {/* Desktop View */}
      {!snapQ.isLoading && view === "desktop" && (
        <div className="p-6 space-y-6">
          {/* System Health + Alerts */}
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col items-center justify-center">
              <ScoreDial score={health} />
            </div>
            <div className="col-span-3 grid grid-cols-3 gap-4">
              {[
                { label: "قضايا نشطة",    icon: Scale,      color: "blue",    value: layers.find((l: any) => l.id === "case-layer")?.metrics?.active ?? 0 },
                { label: "إجمالي العملاء", icon: Database,   color: "violet",  value: layers.find((l: any) => l.id === "client-layer")?.metrics?.total ?? 0 },
                { label: "مهام معلقة",    icon: CheckSquare, color: "amber",   value: layers.find((l: any) => l.id === "task-layer")?.metrics?.pending ?? 0 },
              ].map((m, i) => {
                const Icon = m.icon;
                return (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                    <div className={`w-8 h-8 rounded-xl bg-${m.color}-900 flex items-center justify-center mb-3`}>
                      <Icon className={`h-4 w-4 text-${m.color}-400`} />
                    </div>
                    <div className="text-2xl font-bold text-white">{m.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OS Layers Grid */}
          <div>
            <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider">طبقات نظام التشغيل</div>
            <div className="grid grid-cols-4 gap-3">
              {layers.map((layer: any) => {
                const Icon = LAYER_ICONS[layer.id] ?? Activity;
                const metrics = Object.entries(layer.metrics ?? {}).slice(0, 3);
                return (
                  <div key={layer.id}
                    className={`bg-gray-900 border rounded-2xl p-4 transition ${layer.status === "operational" ? "border-gray-800 hover:border-gray-700" : "border-amber-800"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <Icon className={`h-4 w-4 ${layer.status === "operational" ? "text-blue-400" : "text-amber-400"}`} />
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[layer.status] ?? "bg-gray-500"}`} />
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded border ${STATUS_COLOR[layer.status]}`}>
                          {STATUS_LABEL[layer.status]}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-white mb-2">{layer.nameAr}</div>
                    <div className="space-y-0.5">
                      {metrics.map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-xs text-gray-600">{k}</span>
                          <span className="text-xs font-mono text-gray-300">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System Status Bar */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold text-gray-300">حالة الطبقات</span>
            </div>
            <div className="flex gap-2">
              {layers.map((layer: any) => (
                <div key={layer.id} className="flex-1 flex flex-col items-center gap-1">
                  <div className={`h-1 w-full rounded-full ${layer.status === "operational" ? "bg-emerald-500" : layer.status === "degraded" ? "bg-amber-400" : "bg-red-500"}`} />
                  <span className="text-xs text-gray-600 truncate w-full text-center">{layer.nameAr}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Processes View */}
      {!snapQ.isLoading && view === "processes" && (
        <div className="p-6">
          <div className="text-xs text-gray-500 mb-4 uppercase tracking-wider">العمليات النشطة — Legal Processes</div>
          {procs.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">لا توجد عمليات نشطة حالياً</div>
          )}
          <div className="space-y-2">
            {procs.map((proc: any) => (
              <div key={proc.id} className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 flex items-center gap-4 hover:border-gray-700 transition">
                <Circle className="h-2 w-2 text-emerald-400 fill-emerald-400 shrink-0" />
                <Scale className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="text-sm text-white flex-1 truncate">{proc.title || "قضية بلا عنوان"}</span>
                <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">{proc.state}</span>
                <span className="text-xs text-gray-600 font-mono">{proc.id?.slice(0, 8)}</span>
                <span className="text-xs text-gray-600">{proc.createdAt ? new Date(proc.createdAt).toLocaleDateString("ar-SA") : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* OS Status Footer */}
      <div className="fixed bottom-0 right-0 left-0 px-6 py-2 bg-gray-900 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>Legal OS v2.0</span>
          <span>طبقات: {layers.length}</span>
          <span>عمليات نشطة: {procs.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{new Date().toLocaleTimeString("ar-SA")}</span>
          <div className={`w-2 h-2 rounded-full ${health >= 80 ? "bg-emerald-400" : health >= 60 ? "bg-amber-400" : "bg-red-500"} animate-pulse`} />
        </div>
      </div>
    </div>
  );
}
