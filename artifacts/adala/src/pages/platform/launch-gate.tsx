import { useState, useEffect } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Rocket, Play,
  RefreshCw, Lock, Brain, Zap, DollarSign, FileText, Bell,
  ClipboardList, Activity, Eye, Ban, Wifi, WifiOff, Server,
  ChevronDown, ChevronUp, Cpu, Database, Search, Globe
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type GateStatus = "PASS" | "FAIL" | "WARN";
type Decision   = "GO" | "CONDITIONAL_GO" | "NO_GO";

interface CheckResult {
  label: string; passed: boolean; value?: string | number; critical?: boolean;
}
interface GateResult {
  gate: number; name: string; nameAr: string; status: GateStatus;
  score: number; weight: number; checks: CheckResult[];
  blockingReasons: string[]; details: string; durationMs: number;
}
interface LaunchReport {
  runAt: string; durationMs: number; gates: GateResult[];
  finalScore: number; decision: Decision; decisionColor: string;
  blockingReasons: string[];
  summary: { totalGates: number; passed: number; failed: number; warned: number };
}

const GATE_ICONS: Record<number, React.ElementType> = {
  1: Lock, 2: Shield, 3: Brain, 4: Zap,
  5: DollarSign, 6: FileText, 7: Bell, 8: ClipboardList,
};

const STATUS_CONFIG: Record<GateStatus, { color: string; icon: React.ElementType; label: string }> = {
  PASS: { color: "text-emerald-400", icon: CheckCircle2, label: "اجتاز" },
  FAIL: { color: "text-red-400",     icon: XCircle,      label: "فشل" },
  WARN: { color: "text-amber-400",   icon: AlertTriangle, label: "تحذير" },
};

const DECISION_CONFIG: Record<Decision, { bg: string; border: string; icon: string; label: string; desc: string }> = {
  GO:              { bg: "from-emerald-950/80 to-emerald-900/40", border: "border-emerald-500/50", icon: "🟢", label: "انطلق للإنتاج", desc: "جميع البوابات اجتازت — النظام جاهز" },
  CONDITIONAL_GO:  { bg: "from-amber-950/80 to-amber-900/40",    border: "border-amber-500/50",   icon: "🟡", label: "إطلاق مشروط",  desc: "إصلح المشكلات الثانوية قبل الإطلاق" },
  NO_GO:           { bg: "from-red-950/80 to-red-900/40",        border: "border-red-500/50",     icon: "🔴", label: "إطلاق محظور",  desc: "وجود فشل حرج — يمنع الإطلاق" },
};

function GateCard({ gate, expanded, onToggle }: { gate: GateResult; expanded: boolean; onToggle: () => void }) {
  const Icon = GATE_ICONS[gate.gate] ?? Shield;
  const sc = STATUS_CONFIG[gate.status];
  const SC = sc.icon;
  return (
    <div className={`rounded-xl border transition-all ${
      gate.status === "PASS" ? "border-emerald-500/20 bg-emerald-950/20" :
      gate.status === "FAIL" ? "border-red-500/30 bg-red-950/20" :
      "border-amber-500/20 bg-amber-950/20"
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-right"
      >
        <div className={`p-2 rounded-lg ${
          gate.status === "PASS" ? "bg-emerald-500/10" :
          gate.status === "FAIL" ? "bg-red-500/10" : "bg-amber-500/10"
        }`}>
          <Icon className={`w-4 h-4 ${sc.color}`} />
        </div>
        <div className="flex-1 text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-sm font-medium text-white">{gate.nameAr}</span>
            <span className="text-xs text-slate-400">{gate.name}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{gate.details}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className="text-lg font-bold text-white">{gate.score}%</div>
            <div className="text-xs text-slate-500">وزن {gate.weight}%</div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            gate.status === "PASS" ? "bg-emerald-500/20 text-emerald-400" :
            gate.status === "FAIL" ? "bg-red-500/20 text-red-400" :
            "bg-amber-500/20 text-amber-400"
          }`}>
            <SC className="w-3 h-3" />
            {sc.label}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <div className="grid gap-1.5">
            {gate.checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {c.passed
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  : <XCircle className={`w-3.5 h-3.5 flex-shrink-0 ${c.critical ? "text-red-400" : "text-amber-400"}`} />
                }
                <span className={c.passed ? "text-slate-300" : c.critical ? "text-red-300" : "text-amber-300"}>
                  {c.label}
                </span>
                {c.value !== undefined && (
                  <span className="mr-auto text-slate-500 text-xs">{String(c.value)}</span>
                )}
              </div>
            ))}
          </div>
          {gate.blockingReasons.length > 0 && (
            <div className="mt-3 p-2 bg-red-950/40 rounded-lg border border-red-500/20">
              <p className="text-xs text-red-400 font-medium mb-1">أسباب الحجب:</p>
              {gate.blockingReasons.map((r, i) => (
                <p key={i} className="text-xs text-red-300">• {r}</p>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-2 text-left">{gate.durationMs}ms</p>
        </div>
      )}
    </div>
  );
}

function ShieldLayer({ label, icon: Icon, active }: { label: string; icon: React.ElementType; active: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${
      active ? "border-emerald-500/20 bg-emerald-950/20" : "border-red-500/20 bg-red-950/20"
    }`}>
      <div className={`p-1.5 rounded-lg ${active ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
        <Icon className={`w-4 h-4 ${active ? "text-emerald-400" : "text-red-400"}`} />
      </div>
      <span className="text-sm text-slate-300 flex-1">{label}</span>
      <span className={`text-xs font-medium ${active ? "text-emerald-400" : "text-red-400"}`}>
        {active ? "نشط" : "معطّل"}
      </span>
    </div>
  );
}

/* ── Architecture Layer Card ── */
function ArchLayer({ color, label, items }: { color: string; label: string; items: string[] }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <h4 className="text-sm font-semibold text-white mb-3">{label}</h4>
      <div className="flex flex-wrap gap-1.5">
        {items.map(it => (
          <span key={it} className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-slate-300 border border-white/10">{it}</span>
        ))}
      </div>
    </div>
  );
}

export default function LaunchGatePage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const [expandedGates, setExpandedGates] = useState<Set<number>>(new Set());
  const [report, setReport]   = useState<LaunchReport | null>(null);
  const [running, setRunning] = useState(false);
  const [banIpInput, setBanIpInput] = useState("");

  const headers = async () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${await getToken()}`,
  });

  const { data: shieldData, refetch: refetchShield } = useQuery({
    queryKey: ["launch-gate-shield"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/launch-gate/shield`, { headers: await headers() });
      return r.json();
    },
    refetchInterval: 5000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["launch-gate-stats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/launch-gate/stats`, { headers: await headers() });
      return r.json();
    },
    refetchInterval: 10000,
  });

  const { data: threatsData, refetch: refetchThreats } = useQuery({
    queryKey: ["launch-gate-threats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/launch-gate/threats`, { headers: await headers() });
      return r.json();
    },
    refetchInterval: 8000,
  });

  const runGate = async () => {
    setRunning(true);
    try {
      const r = await fetch(`${BASE}/api/launch-gate/run`, {
        method: "POST",
        headers: await headers(),
      });
      const data: LaunchReport = await r.json();
      setReport(data);
      setExpandedGates(new Set(data.gates.filter(g => g.status !== "PASS").map(g => g.gate)));
    } catch { /* ignore */ }
    finally { setRunning(false); }
  };

  const resolveThreaten = async (id: string) => {
    await fetch(`${BASE}/api/launch-gate/resolve/${id}`, { method: "POST", headers: await headers() });
    refetchThreats();
  };

  const doBanIp = async () => {
    if (!banIpInput.trim()) return;
    await fetch(`${BASE}/api/launch-gate/ban-ip`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({ ip: banIpInput.trim() }),
    });
    setBanIpInput("");
    refetchShield();
  };

  const shield = shieldData;
  const threats = (threatsData?.events ?? []) as any[];
  const stats   = statsData;

  const shieldMode = shield?.mode ?? "PROTECTED";
  const shieldColor =
    shieldMode === "PROTECTED"   ? "text-emerald-400" :
    shieldMode === "DEGRADED"    ? "text-amber-400" :
    "text-red-400";

  const archLayers = [
    { color: "border-blue-500/20 bg-blue-950/20",    label: "🟦 طبقة العرض (Frontend)",    items: ["React + Vite","Multi-tenant UI","Role-based Dashboards","Cache Isolation"] },
    { color: "border-yellow-500/20 bg-yellow-950/20",label: "🟨 طبقة API",                  items: ["requireAuthWithTenant","Tenant Enforcement","Rate Limiting","Response Shaping"] },
    { color: "border-orange-500/20 bg-orange-950/20",label: "🟧 طبقة الخدمات",              items: ["CaseService","InvoiceService","AIService","DocumentService","HRService"] },
    { color: "border-red-500/20 bg-red-950/20",      label: "🟥 Zero Trust Core",           items: ["enforceTenantScope()","detectIDOR()","blockInjection()","runtimeShield","rateLimit"] },
    { color: "border-purple-500/20 bg-purple-950/20",label: "🟪 محرك الذكاء الاصطناعي",    items: ["RAG System","Prompt Guardrails","Tenant Filter","Legal Summarization","Contract AI"] },
    { color: "border-amber-500/20 bg-amber-950/20",  label: "🟫 طبقة DB (Multi-Tenant)",    items: ["office_id فرض","RLS Policy","Indexes","Drizzle ORM","SQL Guard"] },
    { color: "border-emerald-500/20 bg-emerald-950/20",label: "🟩 البحث والتخزين",          items: ["Tenant Scoped Search","Signed URLs","Encrypted Files","Isolated Buckets"] },
    { color: "border-slate-500/20 bg-slate-950/20",  label: "⬛ البنية التحتية",             items: ["Docker","Cloudflare","Helmet","HTTPS","WAF Rules"] },
  ];

  return (
    <div className="min-h-screen bg-[#0a0c14] text-white p-6 space-y-6" dir="rtl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <Rocket className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">بوابة الانطلاقة الذكية</h1>
              <p className="text-sm text-slate-400">GO / NO-GO Production Launch Engine + Real-Time Shield</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
            shieldMode === "PROTECTED" ? "border-emerald-500/30 bg-emerald-950/30" :
            shieldMode === "DEGRADED"  ? "border-amber-500/30 bg-amber-950/30" :
            "border-red-500/30 bg-red-950/30"
          }`}>
            {shieldMode === "PROTECTED" ? <Wifi className={`w-4 h-4 ${shieldColor}`} /> : <WifiOff className={`w-4 h-4 ${shieldColor}`} />}
            <span className={`text-sm font-bold ${shieldColor}`}>{shieldMode}</span>
          </div>
          <Button
            onClick={runGate}
            disabled={running}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "جارٍ الفحص..." : "تشغيل فحص الإطلاق"}
          </Button>
        </div>
      </div>

      {/* ── Decision Banner ── */}
      {report && (() => {
        const dc = DECISION_CONFIG[report.decision];
        return (
          <div className={`rounded-2xl border p-6 bg-gradient-to-r ${dc.bg} ${dc.border}`}>
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-5xl">{dc.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-2xl font-black">{dc.label}</h2>
                  <Badge variant="outline" className="text-lg font-bold px-3 py-1">
                    {report.finalScore}/100
                  </Badge>
                </div>
                <p className="text-slate-300">{dc.desc}</p>
                {report.blockingReasons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {report.blockingReasons.slice(0, 4).map((r, i) => (
                      <span key={i} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/20">{r}</span>
                    ))}
                    {report.blockingReasons.length > 4 && (
                      <span className="text-xs text-slate-400">+{report.blockingReasons.length - 4} أخرى</span>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "اجتازت", v: report.summary.passed, c: "text-emerald-400" },
                  { label: "فشلت",   v: report.summary.failed, c: "text-red-400" },
                  { label: "تحذير",  v: report.summary.warned, c: "text-amber-400" },
                ].map(s => (
                  <div key={s.label}>
                    <div className={`text-2xl font-black ${s.c}`}>{s.v}</div>
                    <div className="text-xs text-slate-400">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>النتيجة النهائية المرجّحة</span>
                <span>{report.finalScore}/100</span>
              </div>
              <Progress
                value={report.finalScore}
                className="h-2"
              />
            </div>
          </div>
        );
      })()}

      {/* ── Live Stats Bar ── */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "إجمالي الأحداث",   v: stats.total,      icon: Activity,    c: "text-blue-400" },
            { label: "أحداث غير محلولة", v: stats.unresolved, icon: AlertTriangle,c: "text-amber-400" },
            { label: "تهديدات P0",        v: stats.p0Count,    icon: XCircle,     c: "text-red-400" },
            { label: "أحداث اليوم",       v: stats.todayCount, icon: Eye,         c: "text-purple-400" },
          ].map(st => (
            <Card key={st.label} className="bg-white/3 border-white/8">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400">{st.label}</p>
                    <p className={`text-2xl font-black ${st.c}`}>{st.v ?? 0}</p>
                  </div>
                  <st.icon className={`w-8 h-8 ${st.c} opacity-60`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="gates" dir="rtl">
        <TabsList className="bg-white/5 border border-white/10">
          <TabsTrigger value="gates">🚦 البوابات الثماني</TabsTrigger>
          <TabsTrigger value="shield">🛡️ الدرع الحي</TabsTrigger>
          <TabsTrigger value="threats">⚡ التهديدات</TabsTrigger>
          <TabsTrigger value="arch">🏗️ المعمارية</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: GATES ── */}
        <TabsContent value="gates" className="space-y-3 mt-4">
          {!report ? (
            <div className="text-center py-16">
              <Rocket className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">اضغط "تشغيل فحص الإطلاق" لتقييم جاهزية النظام</p>
              <p className="text-slate-600 text-sm mt-2">سيتم فحص 8 بوابات وإنتاج تقرير GO/NO-GO</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 mb-4">
                {report.gates.map(g => (
                  <div key={g.gate} className="text-center">
                    <div className={`text-xs font-bold mb-1 ${
                      g.status === "PASS" ? "text-emerald-400" :
                      g.status === "FAIL" ? "text-red-400" : "text-amber-400"
                    }`}>{g.score}%</div>
                    <div className={`h-2 rounded-full ${
                      g.status === "PASS" ? "bg-emerald-500" :
                      g.status === "FAIL" ? "bg-red-500" : "bg-amber-500"
                    }`} style={{ opacity: g.score / 100 + 0.3 }} />
                    <div className="text-xs text-slate-500 mt-1 truncate">{g.gate}</div>
                  </div>
                ))}
              </div>
              {report.gates.map(g => (
                <GateCard
                  key={g.gate}
                  gate={g}
                  expanded={expandedGates.has(g.gate)}
                  onToggle={() => setExpandedGates(prev => {
                    const n = new Set(prev);
                    n.has(g.gate) ? n.delete(g.gate) : n.add(g.gate);
                    return n;
                  })}
                />
              ))}
              <p className="text-xs text-slate-500 text-left">
                آخر فحص: {new Date(report.runAt).toLocaleString("ar-SA")} — {report.durationMs}ms
              </p>
            </>
          )}
        </TabsContent>

        {/* ── TAB 2: SHIELD ── */}
        <TabsContent value="shield" className="mt-4">
          {shield ? (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Card className="bg-white/3 border-white/8">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      وضع الدرع
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-black ${shieldColor} mb-4`}>{shieldMode}</div>
                    <div className="grid grid-cols-2 gap-3 mobile-single-col">
                      {[
                        { label: "إجمالي الطلبات",    v: shield.stats?.totalRequests ?? 0 },
                        { label: "طلبات محجوبة",      v: shield.stats?.blockedRequests ?? 0 },
                        { label: "طلبات مُصلحة",      v: shield.stats?.sanitizedRequests ?? 0 },
                        { label: "نسبة الحجب",         v: shield.stats?.blockRate ?? "0%" },
                        { label: "تهديدات نشطة",       v: shield.activeThreats ?? 0 },
                        { label: "IPs محجوبة",         v: shield.stats?.bannedIps ?? 0 },
                      ].map(s => (
                        <div key={s.label} className="bg-white/5 rounded-lg p-3">
                          <p className="text-xs text-slate-400">{s.label}</p>
                          <p className="text-lg font-bold text-white">{s.v}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white/3 border-white/8">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-400" />
                      حجب IP
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <input
                        value={banIpInput}
                        onChange={e => setBanIpInput(e.target.value)}
                        placeholder="أدخل IP للحجب..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/50"
                        dir="ltr"
                      />
                      <Button onClick={doBanIp} variant="destructive" size="sm">حجب</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">طبقات الحماية (8 طبقات)</h3>
                <div className="space-y-2">
                  {[
                    { label: "L1 — درع عزل المستأجرين", icon: Lock },
                    { label: "L2 — جدار ناري للـ API", icon: Shield },
                    { label: "L3 — حارس استعلامات DB", icon: Database },
                    { label: "L4 — درع سلامة AI", icon: Brain },
                    { label: "L5 — حماية الملفات", icon: FileText },
                    { label: "L6 — عزل الأحداث", icon: Bell },
                    { label: "L7 — فلتر البحث", icon: Search },
                    { label: "L8 — سجل تدقيق شامل", icon: ClipboardList },
                  ].map(l => (
                    <ShieldLayer key={l.label} label={l.label} icon={l.icon} active={true} />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">جارٍ تحميل بيانات الدرع...</div>
          )}
        </TabsContent>

        {/* ── TAB 3: THREATS ── */}
        <TabsContent value="threats" className="mt-4">
          <ScrollArea className="h-[500px]">
            {threats.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-slate-400">لا توجد تهديدات مسجّلة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {threats.map((t: any) => (
                  <div key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border ${
                    t.resolved ? "border-white/5 bg-white/2 opacity-50" :
                    t.severity === "P0" ? "border-red-500/30 bg-red-950/20" :
                    t.severity === "P1" ? "border-orange-500/20 bg-orange-950/20" :
                    "border-white/8 bg-white/3"
                  }`}>
                    <div className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${
                      t.severity === "P0" ? "bg-red-500/20 text-red-400" :
                      t.severity === "P1" ? "bg-orange-500/20 text-orange-400" :
                      "bg-slate-500/20 text-slate-400"
                    }`}>{t.severity}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{t.description}</p>
                      <div className="flex gap-2 mt-1 text-xs text-slate-500 flex-wrap" dir="ltr">
                        <span>{t.event_type}</span>
                        <span>{t.request_method} {t.request_path}</span>
                        {t.client_ip && <span>{t.client_ip}</span>}
                        <span>{new Date(t.created_at).toLocaleString("ar-SA")}</span>
                      </div>
                    </div>
                    {!t.resolved && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0 text-xs h-7"
                        onClick={() => resolveThreaten(t.id)}
                      >
                        حلّ
                      </Button>
                    )}
                    {t.resolved && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {/* ── TAB 4: ARCHITECTURE ── */}
        <TabsContent value="arch" className="mt-4">
          <div className="mb-4 p-4 rounded-xl border border-blue-500/20 bg-blue-950/20">
            <div className="flex items-center gap-3 mb-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              <h3 className="text-base font-bold">Adalah AI — Production Architecture</h3>
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Enterprise Zero Trust</Badge>
            </div>
            <p className="text-sm text-slate-400">
              معمارية SaaS قانوني متعدد المكاتب بمستوى Enterprise — كل طبقة محمية ومعزولة بـ office_id
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {archLayers.map(l => (
              <ArchLayer key={l.label} color={l.color} label={l.label} items={l.items} />
            ))}
          </div>

          <div className="mt-6 p-4 rounded-xl border border-white/10 bg-white/3">
            <h4 className="text-sm font-bold text-white mb-3">🔐 القواعد الحرجة — Zero Trust Rules</h4>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { icon: "🔴", rule: "لا query بدون office_id", status: true },
                { icon: "🔴", rule: "لا AI بدون tenant filter", status: true },
                { icon: "🔴", rule: "لا file access بدون signed URL", status: true },
                { icon: "🔴", rule: "كل API محمي بـ middleware", status: true },
                { icon: "🔴", rule: "كل حدث مسجّل في audit logs", status: true },
                { icon: "🔴", rule: "Runtime Shield نشط 24/7", status: true },
              ].map(r => (
                <div key={r.rule} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-slate-300">{r.rule}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { icon: Globe, label: "Cloudflare CDN", active: false },
              { icon: Server, label: "Docker Ready", active: true },
              { icon: Database, label: "PostgreSQL RLS", active: true },
              { icon: Shield, label: "Zero Trust API", active: true },
              { icon: Brain, label: "AI Guardrails", active: true },
              { icon: Activity, label: "Prometheus", active: true },
            ].map(s => (
              <div key={s.label} className={`text-center p-3 rounded-xl border ${
                s.active ? "border-emerald-500/20 bg-emerald-950/20" : "border-slate-700/30 bg-slate-900/20"
              }`}>
                <s.icon className={`w-6 h-6 mx-auto mb-1.5 ${s.active ? "text-emerald-400" : "text-slate-600"}`} />
                <p className={`text-xs ${s.active ? "text-slate-300" : "text-slate-600"}`}>{s.label}</p>
                <p className={`text-xs font-medium mt-0.5 ${s.active ? "text-emerald-400" : "text-slate-600"}`}>
                  {s.active ? "✓" : "—"}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
