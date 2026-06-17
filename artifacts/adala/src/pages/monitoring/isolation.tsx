import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2,
  Lock, Database, Code2, Activity, RefreshCw, Zap, Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;
async function get(url: string) { const r = await fetch(url); if (!r.ok) throw new Error(await r.text()); return r.json(); }
async function post(url: string, body?: object) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  if (!r.ok) throw new Error(await r.text()); return r.json();
}

const TABS = [
  { id: "summary",  label: "درجة العزل",     icon: Shield },
  { id: "rls",      label: "حماية DB",        icon: Database },
  { id: "code",     label: "تدقيق الكود",    icon: Code2 },
  { id: "runtime",  label: "كاشف التسرب",    icon: Activity },
];

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-600", B: "text-blue-600", C: "text-amber-600", D: "text-red-600",
};
const GRADE_BG: Record<string, string> = {
  A: "bg-emerald-50 border-emerald-300", B: "bg-blue-50 border-blue-300",
  C: "bg-amber-50 border-amber-300",     D: "bg-red-50 border-red-300",
};
const RISK_BADGE: Record<string, string> = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-blue-100 text-blue-700",
};

export default function IsolationPage() {
  const { toast } = useToast();
  const qc   = useQueryClient();
  const [tab, setTab]   = useState("summary");
  const [testTable, setTestTable] = useState("cases");
  const [enableTable, setEnableTable] = useState("");

  const summaryQ = useQuery({ queryKey: ["iso-summary"],  queryFn: () => get(api("/api/isolation/summary")),  refetchInterval: 30000 });
  const rlsQ     = useQuery({ queryKey: ["iso-rls"],      queryFn: () => get(api("/api/isolation/rls-status")), enabled: tab === "rls",   refetchInterval: 30000 });
  const auditQ   = useQuery({ queryKey: ["iso-audit"],    queryFn: () => get(api("/api/isolation/audit")),    enabled: tab === "code",  staleTime: 60000 });
  const leakQ    = useQuery({ queryKey: ["iso-leaks"],    queryFn: () => get(api("/api/isolation/leak-log")), enabled: tab === "runtime", refetchInterval: 10000 });

  const testMut   = useMutation({
    mutationFn: () => post(api("/api/isolation/test"), { table: testTable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["iso-leaks"] }),
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });
  const enableMut = useMutation({
    mutationFn: () => post(api("/api/isolation/enable-rls"), { table: enableTable }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["iso-rls"] }); qc.invalidateQueries({ queryKey: ["iso-summary"] }); setEnableTable(""); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const s     = summaryQ.data ?? {};
  const grade = s.grade ?? "—";

  return (
    <div className="min-h-screen bg-muted/30 p-6 rtl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
            <Lock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">عزل المستأجرين</h1>
            <p className="text-sm text-muted-foreground">Zero Cross-Tenant Leakage System</p>
          </div>
        </div>
        <button onClick={() => { qc.invalidateQueries({ queryKey: ["iso-summary"] }); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-card border border-border hover:bg-muted/50 transition">
          <RefreshCw className="h-3 w-3" /> تحديث
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
              ${tab === t.id ? "bg-slate-800 text-white shadow-sm" : "text-muted-foreground hover:bg-muted/50"}`}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ══ Summary Tab ══ */}
      {tab === "summary" && (
        <div className="space-y-5">
          {/* Grade + Score */}
          <div className={`rounded-2xl p-8 border flex items-center gap-8 ${GRADE_BG[grade] ?? "bg-card border-border"}`}>
            <div className="text-center shrink-0">
              <div className={`text-7xl font-black ${GRADE_COLORS[grade] ?? "text-muted-foreground"}`}>{grade}</div>
              <div className="text-xs text-muted-foreground mt-1">درجة العزل</div>
            </div>
            <div className="flex-1">
              <div className="text-3xl font-bold text-foreground mb-1">{s.isolationScore ?? "—"}<span className="text-base text-muted-foreground">/100</span></div>
              <div className="w-full bg-muted/30 rounded-full h-3 mt-2 overflow-hidden border border-border">
                <div className={`h-3 rounded-full transition-all ${
                  (s.isolationScore ?? 0) >= 90 ? "bg-emerald-500" : (s.isolationScore ?? 0) >= 75 ? "bg-blue-500" : (s.isolationScore ?? 0) >= 60 ? "bg-amber-400" : "bg-red-500"
                }`} style={{ width: `${s.isolationScore ?? 0}%` }} />
              </div>
              <div className="text-sm text-muted-foreground mt-2">
                {grade === "A" ? "✅ عزل قوي — النظام يمنع التسرب تلقائياً" :
                 grade === "B" ? "🔵 عزل جيد — بعض الجداول تحتاج تحديث" :
                 grade === "C" ? "⚠️ عزل متوسط — يُنصح بمراجعة الكود" :
                                 "🔴 عزل ضعيف — تصرف فوراً"}
              </div>
            </div>
          </div>

          {/* 3 pillars */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              {
                label: "حماية DB (RLS)",
                score: s.rls?.coverage ?? 0,
                detail: `${s.rls?.rlsTables ?? 0} / ${s.rls?.totalTables ?? 0} جدول`,
                icon: Database,
                color: (s.rls?.coverage ?? 0) >= 80 ? "emerald" : "amber",
              },
              {
                label: "جودة الكود",
                score: s.code?.overallScore ?? 0,
                detail: `${s.code?.riskFiles ?? 0} ملف خطر`,
                icon: Code2,
                color: (s.code?.overallScore ?? 0) >= 80 ? "emerald" : "amber",
              },
              {
                label: "حوادث التشغيل",
                score: (s.runtime?.leakCount ?? 0) === 0 ? 100 : Math.max(0, 100 - (s.runtime?.leakCount ?? 0) * 5),
                detail: `${s.runtime?.leakCount ?? 0} حادثة`,
                icon: Activity,
                color: (s.runtime?.leakCount ?? 0) === 0 ? "emerald" : "red",
              },
            ].map((p, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <p.icon className={`h-4 w-4 text-${p.color}-600`} />
                  <span className="text-sm font-medium text-foreground/70">{p.label}</span>
                </div>
                <div className={`text-3xl font-bold text-${p.color}-600 mb-1`}>{p.score}<span className="text-sm text-muted-foreground">/100</span></div>
                <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-1.5 rounded-full bg-${p.color}-500`} style={{ width: `${p.score}%` }} />
                </div>
                <div className="text-xs text-muted-foreground mt-2">{p.detail}</div>
              </div>
            ))}
          </div>

          {/* Architecture Layers */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-semibold text-foreground mb-4">طبقات العزل المُطبَّقة</div>
            <div className="space-y-2">
              {[
                { label: "Clerk Auth — التحقق من الهوية",                 status: true  },
                { label: "requireAuthWithTenant — حقن office_id في الطلب", status: true  },
                { label: "PostgreSQL set_config — متغير الجلسة",           status: true  },
                { label: "Row Level Security — الفرض على مستوى DB",       status: (s.rls?.rlsTables ?? 0) > 0 },
                { label: "AsyncLocalStorage — سياق المستأجر المتزامن",    status: true  },
                { label: "Response Leak Detector — فحص الاستجابات",       status: true  },
                { label: "Code Audit — فحص الكود الثابت",                 status: true  },
              ].map((layer, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                  {layer.status
                    ? <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    : <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0" />}
                  <span className="text-sm text-foreground/70 flex-1">{layer.label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${layer.status ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {layer.status ? "مُفعَّل" : "جزئي"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ RLS Tab ══ */}
      {tab === "rls" && (
        <div className="space-y-5">
          {/* Summary */}
          {rlsQ.data?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "إجمالي الجداول",    value: rlsQ.data.summary.totalTables    },
                { label: "لديها tenant key",   value: rlsQ.data.summary.withTenantKey  },
                { label: "RLS مُفعَّل",        value: rlsQ.data.summary.rlsEnabled     },
                { label: "تغطية %",           value: `${rlsQ.data.summary.coveragePct}%`, warn: rlsQ.data.summary.coveragePct < 80 },
              ].map((m, i) => (
                <div key={i} className={`bg-card border rounded-2xl p-5 text-center ${m.warn ? "border-amber-300" : "border-border"}`}>
                  <div className={`text-2xl font-bold ${m.warn ? "text-amber-600" : "text-foreground"}`}>{m.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Enable RLS manually */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-semibold text-foreground mb-3">تفعيل RLS يدوياً</div>
            <div className="flex gap-2">
              <input value={enableTable} onChange={e => setEnableTable(e.target.value)}
                placeholder="اسم الجدول (مثال: lawyers)"
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" />
              <button onClick={() => enableMut.mutate()} disabled={!enableTable || enableMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-slate-800 text-white hover:bg-slate-900 transition disabled:opacity-50">
                <Lock className="h-3.5 w-3.5" /> تفعيل RLS
              </button>
            </div>
            {enableMut.isSuccess && <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> تم تفعيل RLS بنجاح</div>}
            {enableMut.isError && <div className="mt-2 text-xs text-red-600">{(enableMut.error as any)?.message}</div>}
          </div>

          {/* Tables list */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {rlsQ.isLoading && <div className="p-8 text-center text-muted-foreground text-sm">جارٍ الفحص…</div>}
            <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-50">
              {(rlsQ.data?.tables ?? []).map((t: any) => (
                <div key={t.tablename} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                  {t.rls_enabled
                    ? <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                    : t.has_office_id
                    ? <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
                    : <Shield className="h-4 w-4 text-gray-300 shrink-0" />}
                  <span className="text-sm text-foreground flex-1 font-mono">{t.tablename}</span>
                  {t.has_office_id && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">has office_id</span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                    ${t.rls_enabled ? "bg-emerald-100 text-emerald-700" : t.has_office_id ? "bg-amber-100 text-amber-700" : "bg-muted/50 text-muted-foreground"}`}>
                    {t.rls_enabled ? `✅ محمي (${t.policy_count} سياسة)` : t.has_office_id ? "⚠️ يحتاج RLS" : "— عام"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Missing tables */}
          {(rlsQ.data?.missing ?? []).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">جداول تحتوي office_id لكن بدون RLS ({rlsQ.data.missing.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rlsQ.data.missing.map((t: string) => (
                  <span key={t} className="text-xs bg-amber-50/20 border border-amber-300 text-amber-700 px-2 py-0.5 rounded-lg font-mono">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Code Audit Tab ══ */}
      {tab === "code" && (
        <div className="space-y-4">
          {auditQ.isLoading && <div className="p-8 text-center text-muted-foreground text-sm">جارٍ فحص الكود…</div>}
          {auditQ.data && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "إجمالي الملفات",    value: auditQ.data.summary.totalFiles },
                  { label: "آمنة (≥80)",         value: auditQ.data.summary.safeFiles  },
                  { label: "تحتاج مراجعة",       value: auditQ.data.summary.riskFiles, warn: auditQ.data.summary.riskFiles > 0 },
                  { label: "متوسط الدرجة",       value: `${auditQ.data.summary.avgScore}%` },
                ].map((m, i) => (
                  <div key={i} className={`bg-card border rounded-2xl p-5 text-center ${m.warn ? "border-amber-300" : "border-border"}`}>
                    <div className={`text-2xl font-bold ${m.warn ? "text-amber-600" : "text-foreground"}`}>{m.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* File list */}
              <div className="space-y-2">
                {auditQ.data.results.map((r: any) => (
                  <div key={r.file} className={`bg-card border rounded-xl overflow-hidden ${r.score < 80 ? "border-amber-300/60" : "border-border"}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <Code2 className={`h-4 w-4 shrink-0 ${r.score >= 80 ? "text-emerald-500" : r.score >= 60 ? "text-amber-500" : "text-red-500"}`} />
                      <span className="text-sm font-mono text-foreground/70 flex-1">{r.file}</span>
                      <span className="text-xs text-muted-foreground">{r.linesChecked} سطر</span>
                      <div className="w-20 bg-muted/50 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${r.score >= 80 ? "bg-emerald-500" : r.score >= 60 ? "bg-amber-400" : "bg-red-500"}`}
                          style={{ width: `${r.score}%` }} />
                      </div>
                      <span className={`text-xs font-bold w-10 text-right ${r.score >= 80 ? "text-emerald-600" : r.score >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {r.score}%
                      </span>
                    </div>
                    {r.findings.length > 0 && (
                      <div className="border-t border-border/40 px-4 pb-3 pt-2 space-y-1.5">
                        {r.findings.slice(0, 3).map((f: any, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${RISK_BADGE[f.risk]}`}>{f.risk}</span>
                            <span className="text-xs text-muted-foreground">سطر {f.line}: {f.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ Runtime Tab ══ */}
      {tab === "runtime" && (
        <div className="space-y-4">
          {/* Stats */}
          {leakQ.data?.stats && (() => {
            const st = leakQ.data.stats;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "طلبات فُحصت",   value: st.totalChecked                                          },
                  { label: "طلبات حُجبت",   value: st.totalBlocked, warn: st.totalBlocked > 0               },
                  { label: "حوادث تسرب",    value: st.leakCount,    warn: st.leakCount > 0                  },
                  { label: "حوادث حرجة",    value: st.criticalCount, warn: st.criticalCount > 0              },
                ].map((m, i) => (
                  <div key={i} className={`bg-card border rounded-2xl p-5 text-center ${m.warn ? "border-red-300" : "border-border"}`}>
                    <div className={`text-2xl font-bold ${m.warn ? "text-red-600" : "text-foreground"}`}>{m.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Test Runner */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Search className="h-4 w-4" /> اختبار العزل
            </div>
            <div className="flex gap-2">
              <select value={testTable} onChange={e => setTestTable(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/60">
                {["cases","clients","revenues","expenses","tasks","documents"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button onClick={() => testMut.mutate()} disabled={testMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-slate-800 text-white hover:bg-slate-900 transition disabled:opacity-50">
                <Zap className="h-3.5 w-3.5" /> {testMut.isPending ? "جارٍ…" : "اختبر العزل"}
              </button>
            </div>
            {testMut.data && (
              <div className={`mt-3 p-3 rounded-xl border text-sm flex items-start gap-2
                ${testMut.data.isolationClean ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-300 text-red-800"}`}>
                {testMut.data.isolationClean ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-semibold">{testMut.data.message}</div>
                  <div className="text-xs mt-1 opacity-70">{testMut.data.rowsReturned} صف فُحص · جدول: {testMut.data.table}</div>
                </div>
              </div>
            )}
          </div>

          {/* Leak Events */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 font-semibold text-sm text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-red-500" /> سجل أحداث التسرب
            </div>
            {leakQ.isLoading && <div className="p-6 text-center text-muted-foreground text-sm">جارٍ التحميل…</div>}
            {(leakQ.data?.events ?? []).length === 0 && !leakQ.isLoading && (
              <div className="p-8 flex flex-col items-center gap-2 text-center">
                <ShieldCheck className="h-10 w-10 text-emerald-300" />
                <div className="text-sm font-medium text-muted-foreground">لا توجد حوادث تسرب مسجّلة</div>
                <div className="text-xs text-muted-foreground">النظام يحمي البيانات بنجاح</div>
              </div>
            )}
            <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
              {(leakQ.data?.events ?? []).map((ev: any) => (
                <div key={ev.id} className={`px-5 py-3 ${ev.severity === "critical" ? "bg-red-50" : "bg-amber-50"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${ev.severity === "critical" ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"}`}>
                      {ev.severity}
                    </span>
                    <span className="text-xs text-muted-foreground">{ev.requestMethod} {ev.requestPath}</span>
                    <span className="text-xs text-muted-foreground mr-auto">{new Date(ev.timestamp).toLocaleString("ar-SA")}</span>
                  </div>
                  <div className="text-xs text-foreground/70">
                    المتوقع: <strong>{ev.expectedTenant}</strong> · وُجد: <strong className="text-red-700">{ev.foundTenants.join(", ")}</strong>
                    · {ev.rowCount} صف
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
