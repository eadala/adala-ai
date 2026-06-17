import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Lock, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, Zap, Bot, DollarSign, FileCode2,
  ToggleLeft, ToggleRight, ClipboardList, ChevronDown, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (p: string) => `${BASE}${p}`;
async function get(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function post(url: string, body?: object) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!r.ok) throw new Error(await r.text()); return r.json();
}

const TABS = [
  { id: "status",    label: "حالة النظام",     icon: ShieldCheck },
  { id: "financial", label: "الحارس المالي",   icon: DollarSign  },
  { id: "modules",   label: "الوحدات المحمية", icon: FileCode2   },
  { id: "changelog", label: "سجل التغييرات",  icon: ClipboardList },
];

const MODE_STYLE: Record<string, string> = {
  stable:    "bg-emerald-50 border-emerald-300 text-emerald-800",
  degraded:  "bg-amber-50 border-amber-300 text-amber-800",
  safe_mode: "bg-red-50 border-red-300 text-red-800",
};
const MODE_LABEL: Record<string, string> = {
  stable: "🟢 مستقر", degraded: "🟡 متدهور", safe_mode: "🔴 الوضع الآمن",
};
const STATUS_ICON = (s: string) =>
  s === "pass" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> :
  s === "warn" ? <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" /> :
                 <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
const RISK_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high:     "bg-orange-100 text-orange-700 border-orange-200",
  medium:   "bg-amber-100 text-amber-700 border-amber-200",
  low:      "bg-muted/50 text-muted-foreground border-border",
};

export default function HardeningPage() {
  const { toast } = useToast();
  const qc   = useQueryClient();
  const [tab, setTab]        = useState("status");
  const [safeReason, setSafeReason] = useState("");
  const [changeMeta, setChangeMeta] = useState({ type: "config", affects: "", description: "" });
  const [validateResult, setValidateResult] = useState<any>(null);
  const [expandedLog, setExpandedLog]       = useState<string | null>(null);

  const statusQ  = useQuery({ queryKey: ["harden-status"],   queryFn: () => get(api("/api/hardening/status")),   refetchInterval: 20000 });
  const finQ     = useQuery({ queryKey: ["harden-fin"],      queryFn: () => get(api("/api/hardening/financial")), enabled: tab === "financial", refetchInterval: 30000 });
  const modulesQ = useQuery({ queryKey: ["harden-modules"],  queryFn: () => get(api("/api/hardening/modules")),   enabled: tab === "modules" });
  const logQ     = useQuery({ queryKey: ["harden-log"],      queryFn: () => get(api("/api/hardening/change-log")), enabled: tab === "changelog", refetchInterval: 30000 });

  const safeMut     = useMutation({ mutationFn: (v: { activate: boolean; reason: string }) => post(api("/api/hardening/safe-mode"), v), onSuccess: () => qc.invalidateQueries({ queryKey: ["harden-status"] }), onError: () => toast({ title: "حدث خطأ", variant: "destructive" }) });;
  const aiLockMut   = useMutation({ mutationFn: (locked: boolean) => post(api("/api/hardening/ai-lock"), { locked }), onSuccess: () => qc.invalidateQueries({ queryKey: ["harden-status"] }), onError: () => toast({ title: "حدث خطأ", variant: "destructive" }) });;
  const gateMut     = useMutation({ mutationFn: () => post(api("/api/hardening/change-gate"), { type: changeMeta.type, affects: changeMeta.affects.split(",").map(s => s.trim()).filter(Boolean), description: changeMeta.description }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["harden-log"] }); setChangeMeta({ type: "config", affects: "", description: "" }); } });
  const validateMut = useMutation({ mutationFn: () => post(api("/api/hardening/validate")), onSuccess: (d) => setValidateResult(d), onError: () => toast({ title: "حدث خطأ", variant: "destructive" }) });;

  const s = statusQ.data ?? {};
  const mode = s.mode ?? "stable";

  return (
    <div className="min-h-screen bg-muted/30 p-6 rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <Lock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">قفل الإنتاج</h1>
            <p className="text-sm text-muted-foreground">Production Hardening System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${MODE_STYLE[mode] ?? MODE_STYLE.stable}`}>
            {MODE_LABEL[mode] ?? mode}
          </span>
          <button onClick={() => qc.invalidateQueries({ queryKey: ["harden-status"] })}
            className="p-2 rounded-lg bg-card border border-border hover:bg-muted/50 transition">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.id ? "bg-slate-900 text-white shadow-sm" : "text-muted-foreground hover:bg-muted/50"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ══ Status Tab ══ */}
      {tab === "status" && (
        <div className="space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "الوضع الحالي",    value: MODE_LABEL[mode] ?? mode, sub: `منذ: ${s.activatedBy ?? "—"}` },
              { label: "درجة المالية",    value: `${s.financial?.score ?? "—"}/100`, sub: s.financial?.allPassed ? "✅ كل الفحوصات ناجحة" : "⚠️ توجد مشاكل" },
              { label: "وحدات محمية",    value: s.immutableCount ?? "—", sub: "IMMUTABLE MODULES" },
            ].map((m, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5 text-center">
                <div className="text-2xl font-bold text-foreground">{m.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Safe Mode toggle */}
          <div className={`rounded-2xl p-5 border ${mode === "safe_mode" ? "bg-red-50/20 border-red-300" : "bg-card border-border"}`}>
            <div className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" /> الوضع الآمن
            </div>
            <div className="text-sm text-muted-foreground mb-3">
              يوقف جميع العمليات الحساسة (Finance/Stripe/AI) ويتيح القراءة فقط.
            </div>
            <div className="flex gap-2">
              <input value={safeReason} onChange={e => setSafeReason(e.target.value)}
                placeholder="السبب (اختياري)"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" />
              {mode !== "safe_mode" ? (
                <button onClick={() => safeMut.mutate({ activate: true, reason: safeReason })} disabled={safeMut.isPending}
                  className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5" /> تفعيل الوضع الآمن
                </button>
              ) : (
                <button onClick={() => safeMut.mutate({ activate: false, reason: "تم الإلغاء يدوياً" })} disabled={safeMut.isPending}
                  className="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> إلغاء الوضع الآمن
                </button>
              )}
            </div>
          </div>

          {/* AI Lock */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-foreground flex items-center gap-2">
                  <Bot className="h-4 w-4 text-violet-500" /> قفل تنفيذ الذكاء الاصطناعي
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {s.aiLocked ? "🔒 AI في وضع القراءة — لا يُنفّذ أي عمليات مباشرة" : "✅ AI يعمل بشكل طبيعي (توليد فقط، لا تنفيذ)"}
                </div>
              </div>
              <button onClick={() => aiLockMut.mutate(!s.aiLocked)} disabled={aiLockMut.isPending}
                className={`p-2 rounded-xl transition ${s.aiLocked ? "bg-violet-100 text-violet-700" : "bg-muted/50 text-muted-foreground"}`}>
                {s.aiLocked ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
              </button>
            </div>
          </div>

          {/* Validation Pipeline */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" /> خط التحقق
              </div>
              <button onClick={() => validateMut.mutate()} disabled={validateMut.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-white hover:bg-slate-900 transition disabled:opacity-50">
                {validateMut.isPending ? "جارٍ الفحص…" : "▶ شغّل الفحص"}
              </button>
            </div>
            {validateResult && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium
                  ${validateResult.deployAllowed ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                  {validateResult.deployAllowed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {validateResult.deployAllowed ? "✅ النشر مسموح" : "❌ النشر محظور"} — درجة: {validateResult.score}/100
                </div>
                {validateResult.checks?.map((ch: any) => (
                  <div key={ch.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30">
                    {STATUS_ICON(ch.status)}
                    <span className="text-sm text-foreground/70 flex-1">{ch.name}</span>
                    <span className="text-xs text-muted-foreground">{ch.durationMs}ms</span>
                    <span className="text-xs text-muted-foreground">{ch.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Financial Tab ══ */}
      {tab === "financial" && (
        <div className="space-y-4">
          {finQ.isLoading && <div className="p-8 text-center text-muted-foreground text-sm">جارٍ فحص المالية…</div>}
          {finQ.data && (
            <>
              <div className={`rounded-2xl p-6 border flex items-center gap-6
                ${finQ.data.allPassed ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300"}`}>
                {finQ.data.allPassed ? <ShieldCheck className="h-10 w-10 text-emerald-500" /> : <ShieldAlert className="h-10 w-10 text-red-500" />}
                <div>
                  <div className={`text-2xl font-bold ${finQ.data.allPassed ? "text-emerald-700" : "text-red-700"}`}>
                    {finQ.data.score}/100
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {finQ.data.allPassed ? "✅ كل الفحوصات المالية ناجحة" : "⚠️ يوجد مشاكل تحتاج انتباهاً"}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                {finQ.data.checks?.map((ch: any) => (
                  <div key={ch.name} className={`flex items-center gap-3 p-4 rounded-xl border
                    ${ch.status === "pass" ? "bg-white border-border" : ch.status === "warn" ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
                    {STATUS_ICON(ch.status)}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{ch.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{ch.detail}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${RISK_BADGE[ch.severity]}`}>{ch.severity}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ Modules Tab ══ */}
      {tab === "modules" && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            هذه الوحدات <strong>محمية من التعديل</strong> — أي تغيير يمر عبر بوابة التغيير ويستوجب موافقة.
          </div>
          {(modulesQ.data?.modules ?? []).map((m: any) => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">{m.label}</div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">{m.file}</div>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${RISK_BADGE[m.risk]}`}>{m.risk}</span>
            </div>
          ))}

          {/* Change Gate form */}
          <div className="bg-card border border-border rounded-2xl p-5 mt-4">
            <div className="font-semibold text-foreground mb-3">بوابة التغيير — تسجيل طلب تعديل</div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select value={changeMeta.type} onChange={e => setChangeMeta(p => ({ ...p, type: e.target.value }))}
                  className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/60">
                  {["config","route","finance","stripe","ai","schema","module"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input value={changeMeta.affects} onChange={e => setChangeMeta(p => ({ ...p, affects: e.target.value }))}
                  placeholder="affects (فصل بفاصلة: finance, stripe)"
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/60" />
              </div>
              <div className="flex gap-2">
                <input value={changeMeta.description} onChange={e => setChangeMeta(p => ({ ...p, description: e.target.value }))}
                  placeholder="وصف التغيير"
                  className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/60" />
                <button onClick={() => gateMut.mutate()} disabled={!changeMeta.description || gateMut.isPending}
                  className="px-4 py-2 rounded-lg text-sm bg-slate-800 text-white hover:bg-slate-900 transition disabled:opacity-50">
                  تسجيل
                </button>
              </div>
              {gateMut.data && (
                <div className={`text-xs p-2 rounded-lg ${gateMut.data.allowed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {gateMut.data.allowed ? "✅ مسموح" : "🔒 يحتاج موافقة"} — خطر: {gateMut.data.riskLevel}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Changelog Tab ══ */}
      {tab === "changelog" && (
        <div className="space-y-2">
          {logQ.isLoading && <div className="p-8 text-center text-muted-foreground text-sm">جارٍ التحميل…</div>}
          {(logQ.data?.log ?? []).length === 0 && !logQ.isLoading && (
            <div className="p-8 text-center text-muted-foreground text-sm">لا سجلات بعد</div>
          )}
          {(logQ.data?.log ?? []).map((entry: any) => (
            <div key={entry.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setExpandedLog(expandedLog === entry.id ? null : entry.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-right">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${RISK_BADGE[entry.risk_level]}`}>{entry.risk_level}</span>
                <span className="text-sm text-foreground/70 flex-1">{entry.description}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${entry.approved === true ? "bg-emerald-100 text-emerald-700" : entry.approved === false ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {entry.approved === true ? "✅ موافَق" : entry.approved === false ? "❌ مرفوض" : "⏳ انتظار"}
                </span>
                {expandedLog === entry.id ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedLog === entry.id && (
                <div className="border-t border-border/40 px-4 pb-3 pt-2 text-xs text-muted-foreground space-y-1">
                  <div>النوع: <strong>{entry.change_type}</strong> · يؤثر على: <strong>{(entry.affects ?? []).join(", ") || "—"}</strong></div>
                  <div>بواسطة: {entry.created_by} · {new Date(entry.created_at).toLocaleString("ar-SA")}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
