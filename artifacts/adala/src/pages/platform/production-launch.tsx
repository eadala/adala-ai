/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
/**
 * مركز إطلاق الإنتاج — Production Launch Center
 * ═══════════════════════════════════════════════
 * Architecture layers + readiness + Docker config + launch confirmation
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Rocket, CheckCircle2, XCircle, AlertTriangle, Copy, Download,
  RefreshCw, Shield, Database, Cpu, Globe, Layers, Zap,
  BrainCircuit, Server, ClipboardCheck, History, Play,
  ArrowRight, Activity, Lock, Code2, Settings2, ChevronDown,
  ChevronRight, Sparkles, Terminal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ────────────────────────────────────────────────────────── */
interface LayerCheck { label: string; ok: boolean }
interface ArchLayer {
  id: string; name: string; nameEn: string; color: string;
  score: number; checks: LayerCheck[]; components: string[];
}
interface Readiness {
  layers: ArchLayer[]; overall: number;
  decision: "GO" | "CONDITIONAL_GO" | "NO_GO";
  lastLaunch: any; checkedAt: string;
}

/* ── Color maps ───────────────────────────────────────────────────── */
const LAYER_META: Record<string, { icon: React.ElementType; gradient: string; border: string }> = {
  edge:     { icon: Globe,        gradient: "from-orange-950/60 to-orange-900/30", border: "border-orange-500/30" },
  frontend: { icon: Layers,       gradient: "from-cyan-950/60 to-cyan-900/30",    border: "border-cyan-500/30"   },
  api:      { icon: Server,       gradient: "from-yellow-950/60 to-yellow-900/30",border: "border-yellow-500/30" },
  ai:       { icon: BrainCircuit, gradient: "from-purple-950/60 to-purple-900/30",border: "border-purple-500/30" },
  business: { icon: Cpu,          gradient: "from-green-950/60 to-green-900/30",  border: "border-green-500/30"  },
  data:     { icon: Database,     gradient: "from-blue-950/60 to-blue-900/30",    border: "border-blue-500/30"   },
};

const DECISION_CFG = {
  GO:             { bg: "from-emerald-950/80 to-emerald-900/40", border: "border-emerald-500/40", icon: "🟢", label: "جاهز للإطلاق",   badge: "bg-emerald-500/20 text-emerald-400" },
  CONDITIONAL_GO: { bg: "from-amber-950/80 to-amber-900/40",    border: "border-amber-500/40",   icon: "🟡", label: "إطلاق مشروط",   badge: "bg-amber-500/20 text-amber-400"   },
  NO_GO:          { bg: "from-red-950/80 to-red-900/40",        border: "border-red-500/40",     icon: "🔴", label: "إطلاق محظور",   badge: "bg-red-500/20 text-red-400"       },
};

/* ── Helpers ──────────────────────────────────────────────────────── */
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 85 ? "#10b981" : score >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff0d" strokeWidth={10} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize={size < 70 ? 14 : 18} fontWeight="bold"
        style={{ transform: `rotate(90deg) translate(0px, -${size}px)` }}
        transform={`rotate(90, ${size/2}, ${size/2})`}>
        {score}%
      </text>
    </svg>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  return (
    <Button size="sm" variant="outline"
      className="gap-2 border-white/10 text-slate-300 hover:bg-white/5"
      onClick={() => { navigator.clipboard.writeText(text); toast({ title: `✅ تم نسخ ${label}` }); }}>
      <Copy className="w-3.5 h-3.5" /> نسخ {label}
    </Button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LAYER CARD
══════════════════════════════════════════════════════════════════ */
function LayerCard({ layer }: { layer: ArchLayer }) {
  const [open, setOpen] = useState(false);
  const meta = LAYER_META[layer.id] ?? LAYER_META.api;
  const Icon = meta.icon;
  const allOk = layer.checks.every(c => c.ok);
  const failCount = layer.checks.filter(c => !c.ok).length;

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${meta.gradient} ${meta.border} overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-4 text-right">
        <div className={`p-2.5 rounded-xl bg-white/5 border border-white/10`}>
          <Icon className="w-5 h-5 text-white/80" />
        </div>
        <div className="flex-1 text-right">
          <p className="text-sm font-semibold text-white">{layer.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{layer.nameEn}</p>
          {failCount > 0 && (
            <p className="text-xs text-amber-400 mt-0.5">⚠ {failCount} نقطة تحتاج مراجعة</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ScoreRing score={layer.score} size={60} />
          <div className={`p-1 rounded-full ${allOk ? "text-emerald-400" : "text-amber-400"}`}>
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          <div className="space-y-2">
            {layer.checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {c.ok
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                }
                <span className={c.ok ? "text-slate-300" : "text-amber-300"}>{c.label}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {layer.components.map(c => (
              <span key={c} className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-slate-400 border border-white/10">{c}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ARCHITECTURE FLOW DIAGRAM
══════════════════════════════════════════════════════════════════ */
function ArchDiagram({ layers }: { layers: ArchLayer[] }) {
  const order = ["edge", "frontend", "api", "ai", "business", "data"];
  const sorted = order.map(id => layers.find(l => l.id === id)).filter(Boolean) as ArchLayer[];

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 mb-3 text-center">
        تدفق الطلب من المستخدم إلى قاعدة البيانات — انقر على أي طبقة للتفاصيل
      </p>
      {sorted.map((layer, idx) => {
        const meta = LAYER_META[layer.id] ?? LAYER_META.api;
        const Icon = meta.icon;
        const color = layer.score >= 85 ? "emerald" : layer.score >= 70 ? "amber" : "red";
        return (
          <div key={layer.id}>
            <div className={`flex items-center gap-3 p-3 rounded-xl border
              ${color === "emerald" ? "border-emerald-500/20 bg-emerald-950/20" :
                color === "amber"   ? "border-amber-500/20 bg-amber-950/20"     :
                "border-red-500/20 bg-red-950/20"}`}>
              <div className="p-2 rounded-lg bg-white/5">
                <Icon className={`w-4 h-4 ${
                  color === "emerald" ? "text-emerald-400" :
                  color === "amber"   ? "text-amber-400"   : "text-red-400"
                }`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{layer.name}</p>
                <p className="text-xs text-slate-500">{layer.nameEn}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  {layer.components.slice(0, 3).map(c => (
                    <span key={c} className="inline-block px-1.5 py-0.5 text-xs rounded bg-white/5 text-slate-400 ml-1">{c}</span>
                  ))}
                </div>
                <span className={`text-sm font-bold ${
                  color === "emerald" ? "text-emerald-400" :
                  color === "amber"   ? "text-amber-400"   : "text-red-400"
                }`}>{layer.score}%</span>
              </div>
            </div>
            {idx < sorted.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="w-0.5 h-4 bg-white/10 rounded-full" />
              </div>
            )}
          </div>
        );
      })}

      {/* Security annotation */}
      <div className="mt-4 p-3 rounded-xl border border-white/5 bg-white/2">
        <p className="text-xs text-slate-500 text-center mb-2">طبقات الحماية الأمنية</p>
        <div className="flex flex-wrap justify-center gap-2">
          {["Clerk JWT", "requireAuthWithTenant", "requirePermission()", "WHERE office_id", "Prompt Sanitizer"].map(s => (
            <span key={s} className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
              <Lock className="w-3 h-3" /> {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   DOCKER CONFIG TAB
══════════════════════════════════════════════════════════════════ */
function DockerTab() {
  const [tab, setTab] = useState<"compose" | "coolify" | "nginx">("compose");

  const { data, isLoading } = useQuery({
    queryKey: ["prod-launch-docker"],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/production-launch/docker-config`);
      return r.json();
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
    </div>
  );

  const tabs: { id: "compose" | "coolify" | "nginx"; label: string; key: "compose" | "coolify" | "nginx" }[] = [
    { id: "compose", label: "Docker Compose", key: "compose" },
    { id: "coolify", label: "Coolify Config", key: "coolify" },
    { id: "nginx",   label: "Nginx Proxy",    key: "nginx"   },
  ];

  const currentContent = data?.[tab] ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-slate-400 hover:text-slate-300 hover:bg-white/5"
              }`}>{t.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <CopyBtn text={currentContent} label={tab} />
          <Button size="sm" variant="outline"
            className="gap-2 border-white/10 text-slate-300 hover:bg-white/5"
            onClick={() => {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([currentContent], { type: "text/plain" }));
              a.download = tab === "compose" ? "docker-compose.yml" : tab === "coolify" ? "coolify.yml" : "nginx.conf";
              a.click();
            }}>
            <Download className="w-3.5 h-3.5" /> تحميل
          </Button>
        </div>
      </div>

      <div className="relative rounded-xl border border-white/10 bg-slate-950 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/2">
          <Terminal className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs text-slate-500 font-mono">
            {tab === "compose" ? "docker-compose.yml" : tab === "coolify" ? "coolify.yml" : "nginx.conf"}
          </span>
        </div>
        <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed max-h-96 overflow-y-auto">
          {currentContent}
        </pre>
      </div>

      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-950/20">
        <p className="text-sm font-semibold text-blue-300 mb-2">🚀 خطوات النشر على Hetzner + Coolify</p>
        <ol className="space-y-1.5 text-xs text-slate-400">
          {[
            "أنشئ VPS على Hetzner (CX21 — 2vCPU, 4GB RAM كحد أدنى)",
            "ثبّت Coolify: curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash",
            "في Coolify: New Resource → Docker Compose → الصق محتوى docker-compose.yml",
            "أضف متغيرات البيئة من قائمة env_required في ملف coolify.yml",
            "أنشئ domain وأشر DNS إلى IP الـ VPS",
            'اضغط "Deploy" وانتظر Health Check الأخضر',
          ].map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-blue-500/70 font-bold flex-shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LAUNCH CONFIRM TAB
══════════════════════════════════════════════════════════════════ */
function LaunchTab({ readiness }: { readiness?: Readiness }) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<"staging" | "production">("production");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["launch-history"],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/production-launch/history`);
      return r.json();
    },
  });

  const launch = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`${BASE}/api/production-launch/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase, notes,
          gateScore: readiness?.overall,
          decision: readiness?.decision,
        }),
      });
      return r.json();
    },
    onSuccess: (data) => {
      if (data.ok) {
        setConfirmed(true);
        refetchHistory();
        toast({ title: "🚀 تم تسجيل إطلاق الإنتاج بنجاح!" });
      }
    },
    onError: () => toast({ title: "❌ خطأ في تسجيل الإطلاق", variant: "destructive" }),
  });

  const canLaunch = readiness && (readiness.decision === "GO" || readiness.decision === "CONDITIONAL_GO");
  const dcfg = readiness ? DECISION_CFG[readiness.decision] : null;

  return (
    <div className="space-y-5">
      {/* Decision Banner */}
      {readiness && dcfg && (
        <div className={`p-5 rounded-2xl border bg-gradient-to-br ${dcfg.bg} ${dcfg.border}`}>
          <div className="flex items-center gap-4">
            <div className="text-5xl">{dcfg.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-white">{dcfg.label}</h3>
                <span className={`px-3 py-0.5 rounded-full text-sm font-medium ${dcfg.badge}`}>
                  {readiness.decision}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">درجة الجاهزية الإجمالية: <strong className="text-white">{readiness.overall}%</strong></p>
            </div>
            <ScoreRing score={readiness.overall} size={80} />
          </div>
        </div>
      )}

      {/* Launch Form */}
      {!confirmed ? (
        <div className="p-5 rounded-2xl border border-white/10 bg-white/2 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-400" /> تأكيد الإطلاق
          </h3>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">مرحلة الإطلاق</label>
            <div className="flex gap-2">
              {[
                { id: "staging", label: "🧪 Staging", desc: "بيئة اختبار" },
                { id: "production", label: "🚀 Production", desc: "إنتاج فعلي" },
              ].map(p => (
                <button key={p.id} onClick={() => setPhase(p.id as any)}
                  className={`flex-1 p-3 rounded-xl border text-right transition-colors ${
                    phase === p.id
                      ? "border-blue-500/50 bg-blue-950/40"
                      : "border-white/10 bg-white/2 hover:bg-white/5"
                  }`}>
                  <p className="text-sm font-medium text-white">{p.label}</p>
                  <p className="text-xs text-slate-500">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">ملاحظات الإطلاق (اختياري)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="مثال: إطلاق الإصدار 2.1 بعد اكتمال مراجعة RBAC والنسخ الاحتياطي"
              className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-white/10 bg-white/5 text-slate-300 placeholder:text-slate-600 resize-none focus:outline-none focus:border-blue-500/50"
              dir="rtl"
            />
          </div>

          {!canLaunch && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-red-500/20 bg-red-950/20">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-300">لا يمكن الإطلاق — يوجد بوابات فاشلة. راجع تبويب المعمارية وصحّح المشكلات أولاً.</p>
            </div>
          )}

          <Button
            onClick={() => launch.mutate()}
            disabled={!canLaunch || launch.isPending}
            className="w-full gap-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold py-3 rounded-xl disabled:opacity-40"
          >
            {launch.isPending ? (
              <><RefreshCw className="w-5 h-5 animate-spin" /> جاري التسجيل...</>
            ) : (
              <><Rocket className="w-5 h-5" /> 🚀 إطلاق {phase === "production" ? "الإنتاج" : "Staging"} الآن</>
            )}
          </Button>
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-center space-y-3">
          <div className="text-5xl">🎉</div>
          <h3 className="text-xl font-bold text-emerald-400">تم تسجيل الإطلاق بنجاح!</h3>
          <p className="text-slate-400 text-sm">تم تسجيل حدث الإطلاق في سجل المراجعة (Audit Log)</p>
          <Button variant="outline" onClick={() => setConfirmed(false)}
            className="border-white/10 text-slate-300 hover:bg-white/5">
            إطلاق جديد
          </Button>
        </div>
      )}

      {/* Launch History */}
      {Array.isArray(history) && history.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
            <History className="w-4 h-4" /> سجل الإطلاقات
          </h4>
          <div className="space-y-2">
            {history.slice(0, 5).map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-right">
                  <p className="text-sm text-white font-medium">
                    {e.phase === "production" ? "🚀 إطلاق إنتاج" : "🧪 Staging"}
                    {e.decision && <span className="mr-2 text-xs text-slate-500">({e.decision})</span>}
                  </p>
                  {e.notes && <p className="text-xs text-slate-500 mt-0.5">{e.notes}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  {e.gate_score != null && (
                    <span className="text-sm font-bold text-blue-400">{e.gate_score}%</span>
                  )}
                  <p className="text-xs text-slate-600">
                    {new Date(e.launched_at).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════ */
export default function ProductionLaunchCenter() {
  const { data, isLoading, refetch, isFetching } = useQuery<Readiness>({
    queryKey: ["production-launch-readiness"],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/production-launch/readiness`);
      if (!r.ok) throw new Error("fetch failed");
      return r.json();
    },
    staleTime: 60_000,
  });

  const overall = data?.overall ?? 0;
  const dcfg = data ? DECISION_CFG[data.decision] : null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">مركز إطلاق الإنتاج</h1>
            </div>
            <p className="text-slate-400 text-sm mr-14">
              معمارية النظام · جاهزية الإطلاق · بنية Docker · تأكيد الإطلاق
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline"
            size="sm" className="gap-2 border-white/10 text-slate-300 hover:bg-white/5 flex-shrink-0">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            تحديث
          </Button>
        </div>

        {/* ── Decision Banner ── */}
        {!isLoading && data && dcfg && (
          <div className={`flex items-center gap-5 p-5 rounded-2xl border bg-gradient-to-br ${dcfg.bg} ${dcfg.border}`}>
            <div className="relative flex-shrink-0">
              <ScoreRing score={overall} size={90} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${dcfg.badge}`}>
                  {dcfg.icon} {dcfg.label}
                </span>
              </div>
              <p className="text-slate-400 text-sm">
                {data.layers.filter(l => l.score >= 85).length} طبقات ممتازة ·{" "}
                {data.layers.filter(l => l.score >= 70 && l.score < 85).length} مقبولة ·{" "}
                {data.layers.filter(l => l.score < 70).length} تحتاج عمل
              </p>
              {data.lastLaunch && (
                <p className="text-xs text-slate-600 mt-1">
                  آخر إطلاق:{" "}
                  {new Date(data.lastLaunch.launched_at).toLocaleDateString("ar-SA")}
                  {" · "}{data.lastLaunch.phase}
                </p>
              )}
            </div>
            <div className="hidden md:flex flex-col gap-1.5 flex-shrink-0">
              {data.layers.map(l => (
                <div key={l.id} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    l.score >= 85 ? "bg-emerald-400" :
                    l.score >= 70 ? "bg-amber-400" : "bg-red-400"
                  }`} />
                  <span className="text-xs text-slate-400 w-32 text-right truncate">{l.name}</span>
                  <span className={`text-xs font-mono ${
                    l.score >= 85 ? "text-emerald-400" :
                    l.score >= 70 ? "text-amber-400" : "text-red-400"
                  }`}>{l.score}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <Tabs defaultValue="arch" className="space-y-4" dir="rtl">
          <TabsList className="grid grid-cols-2 sm:grid-cols-4 bg-white/5 rounded-xl p-1">
            {[
              { id: "arch",    icon: Layers,        label: "المعمارية" },
              { id: "layers",  icon: ClipboardCheck, label: "الجاهزية" },
              { id: "docker",  icon: Code2,          label: "بنية النشر" },
              { id: "launch",  icon: Rocket,         label: "الإطلاق" },
            ].map(t => (
              <TabsTrigger key={t.id} value={t.id}
                className="flex items-center gap-1.5 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-lg py-2">
                <t.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ARCHITECTURE FLOW */}
          <TabsContent value="arch" className="space-y-4">
            <div className="p-4 rounded-xl border border-white/5 bg-white/2">
              <h3 className="text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" /> معمارية النظام — 6 طبقات
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                كل طبقة لها مسؤولية واحدة. الفشل في طبقة لا يكسر الطبقات الأخرى.
              </p>
              {isLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
                </div>
              ) : data ? (
                <ArchDiagram layers={data.layers} />
              ) : null}
            </div>

            {/* Security Principles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: Lock,     color: "blue",   title: "لا ثقة في الواجهة الأمامية", body: "officeId لا يُقبَل من العميل أبداً — يُحدَّد فقط في requireAuthWithTenant" },
                { icon: Shield,   color: "purple", title: "عزل المستأجرين في DB", body: "كل استعلام يحتوي WHERE office_id = tenantId — لا استثناء" },
                { icon: Zap,      color: "amber",  title: "RBAC على كل مسار حيوي", body: "requirePermission() على DELETE/POST/PUT في الموارد الحساسة" },
                { icon: Activity, color: "green",  title: "تسجيل كل فشل", body: "audit_logs يسجّل كل خرق RBAC وتسرب tenant وفشل نسخ احتياطي" },
              ].map(p => {
                const Icon = p.icon;
                return (
                  <div key={p.title} className={`p-3 rounded-xl border border-${p.color}-500/20 bg-${p.color}-950/20`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 text-${p.color}-400`} />
                      <p className="text-sm font-medium text-white">{p.title}</p>
                    </div>
                    <p className="text-xs text-slate-400">{p.body}</p>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* LAYER READINESS */}
          <TabsContent value="layers" className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-blue-400" /> جاهزية كل طبقة
              </h3>
              {data && (
                <div className="flex items-center gap-2">
                  <Progress value={overall} className="w-24 h-2" />
                  <span className="text-sm font-bold text-white">{overall}%</span>
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="h-40 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 animate-spin text-slate-500" />
              </div>
            ) : data ? (
              <>
                {["edge", "frontend", "api", "ai", "business", "data"].map(id => {
                  const layer = data.layers.find(l => l.id === id);
                  return layer ? <LayerCard key={id} layer={layer} /> : null;
                })}

                {/* Audit scores */}
                <div className="p-4 rounded-xl border border-white/5 bg-white/2">
                  <p className="text-sm font-semibold text-slate-300 mb-3">نتائج التدقيقات المكتملة</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "عزل المستأجرين", score: 94, color: "emerald" },
                      { label: "عزل AI",          score: 88, color: "emerald" },
                      { label: "RBAC",             score: 82, color: "emerald" },
                      { label: "النسخ الاحتياطي", score: 52, color: "amber"   },
                    ].map(a => (
                      <div key={a.label} className={`p-3 rounded-xl border text-center
                        ${a.color === "emerald" ? "border-emerald-500/20 bg-emerald-950/20" : "border-amber-500/20 bg-amber-950/20"}`}>
                        <ScoreRing score={a.score} size={56} />
                        <p className="text-xs text-slate-400 mt-2">{a.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-500 py-10">فشل تحميل البيانات</div>
            )}
          </TabsContent>

          {/* DOCKER CONFIG */}
          <TabsContent value="docker">
            <DockerTab />
          </TabsContent>

          {/* LAUNCH */}
          <TabsContent value="launch">
            <LaunchTab readiness={data} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
