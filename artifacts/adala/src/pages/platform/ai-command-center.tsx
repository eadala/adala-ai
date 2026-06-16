import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scale, TrendingUp, Users, Shield, BarChart3, Rocket,
  Zap, Terminal, Send, Loader2, RefreshCw, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Clock, Cpu, Database,
  Activity, Bot, Sparkles, Trash2, Eye, MemoryStick,
  Server, Globe, Lock, CircleDot, TrendingDown, HeartPulse,
  Lightbulb, Play, Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Agent catalogue ─────────────────────────────────────────────────────── */
const AGENTS = [
  { id: "legal",     name: "وكيل قانوني",          icon: Scale,      color: "#6366F1", desc: "تحليل حي للقضايا والجلسات والعقود" },
  { id: "finance",   name: "وكيل مالي",              icon: TrendingUp, color: "#10B981", desc: "بيانات الإيرادات والفواتير والتدفق النقدي" },
  { id: "hr",        name: "وكيل الموارد البشرية",   icon: Users,      color: "#F59E0B", desc: "الأداء والرواتب والإجازات الفعلية" },
  { id: "security",  name: "وكيل أمني",              icon: Shield,     color: "#EF4444", desc: "تحليل سجلات الأمان والصلاحيات" },
  { id: "analytics", name: "وكيل التحليلات",         icon: BarChart3,  color: "#8B5CF6", desc: "توجهات حقيقية من قاعدة البيانات" },
  { id: "growth",    name: "وكيل النمو",              icon: Rocket,     color: "#06B6D4", desc: "استراتيجيات مبنية على أداء المكتب الفعلي" },
  { id: "operations",name: "وكيل التشغيل",           icon: Zap,        color: "#F97316", desc: "المهام والتذكيرات والعمليات الحية" },
  { id: "developer", name: "قائد التطوير",            icon: Terminal,   color: "#64748B", desc: "تشخيص المنصة واقتراح الإصلاحات" },
] as const;

type AgentId = typeof AGENTS[number]["id"];

interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string;
  agent?: string;
  context?: any;
}

interface Proposal {
  id: string; title: string; description: string; severity: string;
  category: string; affected: string; fix_type: string; status: string; created_at: string;
}

interface OfficeHealth {
  score: number;
  issues: string[];
  strengths: string[];
}

interface DailyReport {
  title: string;
  summary: string;
  recommendations: string[];
  score: number;
}

const SEV_STYLE: Record<string, { label: string; cls: string }> = {
  critical: { label: "حرجة 🔴", cls: "border-red-500/50 bg-red-500/10 text-red-400" },
  high:     { label: "عالية 🟠", cls: "border-orange-500/50 bg-orange-500/10 text-orange-400" },
  medium:   { label: "متوسطة 🟡", cls: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400" },
  low:      { label: "منخفضة 🟢", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" },
};

function fmt(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="bg-muted/80 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, "<br/>");
}

function HealthRing({ score }: { score: number }) {
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444";
  const label = score >= 80 ? "ممتاز" : score >= 60 ? "جيد" : "يحتاج تحسين";
  const r = 28; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" strokeDashoffset={circ * 0.25}
          style={{ transition: "stroke-dasharray 1s ease" }} />
        <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>{score}</text>
      </svg>
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
    </div>
  );
}

/* ── Context metrics strip ─────────────────────────────────────────────── */
function ContextStrip({ ctx }: { ctx: any }) {
  if (!ctx) return null;
  const items = [
    { label: "قضايا نشطة", value: ctx.activeCases, icon: Scale, warn: ctx.criticalCases > 0 },
    { label: "عملاء",       value: ctx.openClients,  icon: Users, warn: false },
    { label: "غير محصّل",   value: `${ctx.unpaidInvoices}`, icon: AlertTriangle, warn: ctx.unpaidInvoices > 3 },
    { label: "مهام معلقة",  value: ctx.pendingTasks, icon: Clock, warn: ctx.pendingTasks > 10 },
  ];
  return (
    <div className="px-4 py-2 border-b border-border/30 bg-muted/20">
      <div className="flex items-center gap-4 overflow-x-auto">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-1.5 shrink-0">
            <item.icon className={cn("h-3 w-3", item.warn ? "text-orange-400" : "text-muted-foreground")} />
            <span className="text-xs text-muted-foreground">{item.label}:</span>
            <span className={cn("text-xs font-semibold", item.warn ? "text-orange-400" : "text-foreground")}>{item.value}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 shrink-0">
          <Cpu className="h-3 w-3 text-blue-400" />
          <span className="text-xs text-muted-foreground">إيرادات الشهر:</span>
          <span className="text-xs font-semibold text-blue-400">{Number(ctx.monthRevenue ?? 0).toLocaleString("ar-SA")} ر.س</span>
        </div>
      </div>
    </div>
  );
}

/* ── Dev Commander panel ──────────────────────────────────────────────────── */
function DevCommanderPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<any>(null);
  const [devMsg, setDevMsg] = useState("");
  const [devHistory, setDevHistory] = useState<Message[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [tab, setTab] = useState<"scan"|"proposals"|"chat"|"health"|"report">("scan");

  const { data: proposals = [] } = useQuery<Proposal[]>({
    queryKey: ["dev-proposals"],
    queryFn: () => fetch(`${BASE}/api/dev-commander/proposals`).then(r => r.json()),
    staleTime: 30_000,
  });

  const { data: health } = useQuery<OfficeHealth>({
    queryKey: ["cc-health"],
    queryFn: () => fetch(`${BASE}/api/cc/health`).then(r => r.json()),
    staleTime: 300_000,
  });

  const { data: report, isFetching: loadingReport, refetch: fetchReport } = useQuery<DailyReport>({
    queryKey: ["cc-daily-report"],
    queryFn: () => fetch(`${BASE}/api/cc/daily-report`).then(r => r.json()),
    staleTime: 3_600_000,
    enabled: false,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/api/dev-commander/proposals/${id}/approve`, { method: "POST" }).then(r => r.json()),
    onSuccess: (d) => { toast({ title: "✅ تمت الموافقة", description: d.result }); qc.invalidateQueries({ queryKey: ["dev-proposals"] }); },
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/api/dev-commander/proposals/${id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "رُفض من المشرف" }),
      }).then(r => r.json()),
    onSuccess: () => { toast({ title: "❌ رُفض الاقتراح" }); qc.invalidateQueries({ queryKey: ["dev-proposals"] }); },
  });

  async function runScan() {
    setScanning(true);
    try { const d = await fetch(`${BASE}/api/dev-commander/scan`).then(r => r.json()); setScan(d); setTab("scan"); }
    catch { toast({ title: "فشل الفحص", variant: "destructive" }); }
    finally { setScanning(false); }
  }

  async function sendDevMsg() {
    if (!devMsg.trim() || devLoading) return;
    const msg = devMsg.trim(); setDevMsg(""); setDevLoading(true);
    const h = [...devHistory, { role: "user" as const, content: msg }];
    setDevHistory(h);
    try {
      const d = await fetch(`${BASE}/api/dev-commander/ai-analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, diagnostics: scan?.diagnostics }),
      }).then(r => r.json());
      setDevHistory([...h, { role: "assistant", content: d.reply }]);
      if (d.proposals?.length > 0) toast({ title: `🔍 ${d.proposals.length} اقتراح جديد` });
    } catch { toast({ title: "خطأ", variant: "destructive" }); }
    finally { setDevLoading(false); }
  }

  const tabs = [
    { id: "scan",      label: "تشخيص",        icon: Activity },
    { id: "health",    label: "صحة المكتب",   icon: HeartPulse },
    { id: "report",    label: "تقرير يومي",    icon: Lightbulb },
    { id: "proposals", label: `اقتراحات (${proposals.length})`, icon: Eye },
    { id: "chat",      label: "محادثة",        icon: Terminal },
  ] as const;

  return (
    <div className="flex flex-col h-full gap-3 p-3">
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn("flex items-center gap-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all shrink-0",
              tab === t.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* SCAN TAB */}
      {tab === "scan" && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <Button onClick={runScan} disabled={scanning} className="gap-2 bg-slate-700 hover:bg-slate-600">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scanning ? "جارٍ الفحص..." : "فحص شامل للمنصة"}
          </Button>
          {scan && (
            <ScrollArea className="flex-1">
              <div className="space-y-3 pb-4">
                {scan.aiAnalysis && (
                  <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-blue-400" />تحليل قائد التطوير</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-3">
                      <p className="text-xs text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: fmt(scan.aiAnalysis) }} />
                    </CardContent>
                  </Card>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "الذاكرة", value: `${scan.diagnostics?.system?.memoryUsedPct}%`, icon: MemoryStick, warn: scan.diagnostics?.system?.memoryUsedPct > 85 },
                    { label: "CPU",     value: scan.diagnostics?.system?.cpuLoad1m,            icon: Cpu,        warn: scan.diagnostics?.system?.cpuLoad1m > 2 },
                    { label: "وقت التشغيل", value: `${scan.diagnostics?.system?.uptime}د`,    icon: Clock,      warn: false },
                    { label: "الاتصالات", value: scan.diagnostics?.database?.activeConnections, icon: Database,  warn: scan.diagnostics?.database?.activeConnections > 20 },
                  ].map(m => (
                    <Card key={m.label} className={cn("border", m.warn ? "border-orange-500/40 bg-orange-500/5" : "")}>
                      <CardContent className="p-2.5 flex items-center gap-2">
                        <m.icon className={cn("h-4 w-4 shrink-0", m.warn ? "text-orange-400" : "text-muted-foreground")} />
                        <div><p className="text-xs text-muted-foreground">{m.label}</p><p className={cn("text-sm font-bold", m.warn ? "text-orange-400" : "")}>{m.value}</p></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Card className="border-border/50">
                  <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "المكاتب", value: scan.diagnostics?.platform?.offices, icon: Globe },
                      { label: "المستخدمون", value: scan.diagnostics?.platform?.users, icon: Users },
                      { label: "القضايا", value: scan.diagnostics?.platform?.totalCases, icon: Scale },
                      { label: "فواتير معلقة", value: scan.diagnostics?.platform?.unpaidInvoices, icon: AlertTriangle },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-sm">{s.value}</p></div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
          {!scan && !scanning && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div><Server className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground text-sm">اضغط "فحص شامل" للبدء</p></div>
            </div>
          )}
        </div>
      )}

      {/* HEALTH TAB */}
      {tab === "health" && (
        <ScrollArea className="flex-1">
          <div className="space-y-3 pb-4">
            {health ? (
              <>
                <div className="flex justify-center py-3"><HealthRing score={health.score} /></div>
                {health.issues.length > 0 && (
                  <Card className="border-red-500/30 bg-red-500/5">
                    <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-sm text-red-400 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />تحتاج اهتماماً</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                      {health.issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />{issue}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {health.strengths.length > 0 && (
                  <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-sm text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />نقاط قوة</CardTitle></CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                      {health.strengths.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />{s}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin opacity-40" />جارٍ تحميل درجة الصحة...
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      {/* DAILY REPORT TAB */}
      {tab === "report" && (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          <Button onClick={() => fetchReport()} disabled={loadingReport} className="gap-2">
            {loadingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {loadingReport ? "يُولّد التقرير..." : "توليد التقرير اليومي"}
          </Button>
          {report && (
            <ScrollArea className="flex-1">
              <div className="space-y-3 pb-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <HealthRing score={report.score} />
                  <div><p className="font-semibold text-sm">{report.title}</p></div>
                </div>
                <Card className="border-border/50">
                  <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-xs text-muted-foreground">الملخص التنفيذي</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-3">
                    <p className="text-sm leading-relaxed">{report.summary}</p>
                  </CardContent>
                </Card>
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2 pt-3 px-3"><CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" />التوصيات</CardTitle></CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    {report.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="h-5 w-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 font-bold">{i+1}</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
          {!report && !loadingReport && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div><Lightbulb className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-xs text-muted-foreground">اضغط لتوليد تقرير يومي ذكي</p></div>
            </div>
          )}
        </div>
      )}

      {/* PROPOSALS TAB */}
      {tab === "proposals" && (
        <ScrollArea className="flex-1">
          <div className="space-y-3 pb-4">
            {proposals.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500/40" />لا توجد اقتراحات معلقة
              </div>
            )}
            {proposals.map(p => {
              const sev = SEV_STYLE[p.severity] ?? SEV_STYLE.medium;
              return (
                <Card key={p.id} className={cn("border", sev.cls)}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1"><p className="font-medium text-sm">{p.title}</p><p className="text-xs text-muted-foreground mt-0.5">{p.description}</p></div>
                      <Badge variant="outline" className={cn("text-xs shrink-0", sev.cls)}>{sev.label}</Badge>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                        onClick={() => approveMut.mutate(p.id)} disabled={approveMut.isPending}>
                        <CheckCircle2 className="h-3 w-3" />تنفيذ
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs h-7"
                        onClick={() => rejectMut.mutate(p.id)} disabled={rejectMut.isPending}>
                        <XCircle className="h-3 w-3" />رفض
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* CHAT TAB */}
      {tab === "chat" && (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          <ScrollArea className="flex-1">
            <div className="space-y-3 pb-2">
              {devHistory.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  <Terminal className="h-8 w-8 mx-auto mb-2 opacity-30" />اسأل قائد التطوير عن حالة المنصة
                </div>
              )}
              {devHistory.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-xl px-3 py-2",
                    m.role === "user" ? "bg-slate-700 text-white text-xs" : "bg-muted border border-border/50 text-xs")}>
                    <p className="leading-relaxed" dangerouslySetInnerHTML={{ __html: fmt(m.content) }} />
                  </div>
                </div>
              ))}
              {devLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted border border-border/50 rounded-xl px-3 py-2">
                    <div className="flex gap-1">{[0,1,2].map(d => <span key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d*150}ms` }} />)}</div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex gap-2 items-end">
            <Textarea value={devMsg} onChange={e => setDevMsg(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDevMsg(); } }}
              placeholder="اسأل قائد التطوير..." rows={2} className="flex-1 resize-none text-sm min-h-[60px]" />
            <Button onClick={sendDevMsg} disabled={devLoading || !devMsg.trim()} size="icon" className="bg-slate-700 hover:bg-slate-600 h-[60px] w-10 shrink-0">
              {devLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Agent chat ───────────────────────────────────────────────────────────── */
function AgentChat({ agentId, agentName, agentColor }: { agentId: AgentId; agentName: string; agentColor: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [lastCtx, setLastCtx] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(msgOverride?: string) {
    const msg = (msgOverride ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const next = [...messages, { role: "user" as const, content: msg }];
    setMessages(next);
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/cc/chat/${agentId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId, history: messages, model: "auto" }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setMessages([...next, { role: "assistant", content: data.output, model: data.modelUsed, agent: data.agent }]);
      setSessionId(data.sessionId);
      if (data.context) setLastCtx(data.context);
    } catch (e: any) {
      toast({ title: "خطأ في الوكيل", description: e.message, variant: "destructive" });
      setMessages(next.slice(0, -1));
    } finally { setLoading(false); }
  }

  const quickPrompts: Partial<Record<AgentId, string[]>> = {
    legal:      ["حلّل أبرز مخاطر القضايا النشطة", "ما الجلسات القادمة في الأسبوعين القادمين؟", "راجع العقود التي تنتهي قريباً"],
    finance:    ["ملخص الوضع المالي لهذا الشهر", "من هم العملاء الأكثر تأخراً في الدفع؟", "هل نحن على المسار الصحيح للوصول لأهداف الإيراد؟"],
    hr:         ["تقييم أداء الفريق الحالي", "من الموظفون الأقل تقييماً ولماذا؟", "اقتراح خطة تحسين للموارد البشرية"],
    security:   ["مراجعة سجل الدخول الأسبوعي", "تحليل إجراءات المستخدمين غير الاعتيادية", "توصية بسياسة أمان محسّنة"],
    analytics:  ["ما اتجاه نمو القضايا خلال 6 أشهر؟", "مقارنة الإيرادات بين الأشهر الأخيرة", "تحليل نمو قاعدة العملاء"],
    growth:     ["استراتيجية لاكتساب 10 عملاء جدد", "كيف أحسّن معدل تحويل الزوار؟", "خطة توسع مبنية على بيانات المكتب"],
    operations: ["المهام المتأخرة والأكثر أولوية", "كيف أوزّع العمل على الفريق بكفاءة؟", "التذكيرات القادمة في الأسبوع"],
    developer:  ["ما أبرز مشاكل المنصة الآن؟", "كيف أحسّن أداء قاعدة البيانات؟", "مراجعة أمان الـ API"],
  };

  const prompts = quickPrompts[agentId] ?? [];

  return (
    <div className="flex flex-col h-full">
      {lastCtx && <ContextStrip ctx={lastCtx} />}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4 pb-2">
          {messages.length === 0 && (
            <div className="py-3">
              <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-muted/40 border border-border/30">
                <Activity className="h-4 w-4 text-green-400 shrink-0" />
                <p className="text-xs text-muted-foreground">هذا الوكيل يقرأ بيانات مكتبك الحقيقية من قاعدة البيانات قبل الإجابة</p>
              </div>
              {prompts.length > 0 && (
                <div className="grid gap-2">
                  {prompts.map(q => (
                    <button key={q} onClick={() => send(q)}
                      className="text-right text-xs px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/60 hover:border-border transition-colors text-muted-foreground hover:text-foreground">
                      <ChevronRight className="h-3 w-3 inline ml-1 opacity-60" />{q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
              {m.role === "assistant" && (
                <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: agentColor + "30", border: `1px solid ${agentColor}50` }}>
                  <Bot className="h-3.5 w-3.5" style={{ color: agentColor }} />
                </div>
              )}
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted border border-border/50 rounded-tl-sm")}>
                <p className="leading-relaxed text-xs sm:text-sm" dangerouslySetInnerHTML={{ __html: fmt(m.content) }} />
                {m.model && <p className="text-[10px] text-muted-foreground mt-1 opacity-60">{m.model}</p>}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: agentColor + "30" }}>
                <Bot className="h-3.5 w-3.5" style={{ color: agentColor }} />
              </div>
              <div className="bg-muted border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">{[0,1,2].map(d => <span key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${d*150}ms` }} />)}</div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>
      <div className="border-t border-border/50 p-3">
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setSessionId(undefined); setLastCtx(null); }}
            className="gap-1 text-xs text-muted-foreground mb-2 h-6">
            <Trash2 className="h-3 w-3" />محادثة جديدة
          </Button>
        )}
        <div className="flex gap-2 items-end">
          <Textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`اسأل ${agentName}... (الوكيل يقرأ بياناتك الحقيقية)`} rows={2}
            className="flex-1 resize-none text-sm min-h-[60px]" />
          <Button onClick={() => send()} disabled={loading || !input.trim()} size="icon"
            className="h-[60px] w-10 shrink-0" style={{ backgroundColor: agentColor }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function AICommandCenter() {
  const [selected, setSelected] = useState<AgentId>("developer");
  const currentAgent = AGENTS.find(a => a.id === selected)!;

  const { data: health } = useQuery<OfficeHealth>({
    queryKey: ["cc-health"],
    queryFn: () => fetch(`${BASE}/api/cc/health`).then(r => r.json()),
    staleTime: 300_000,
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden" dir="rtl">
      {/* Left sidebar */}
      <aside className="w-52 sm:w-60 shrink-0 border-l border-border/50 bg-background flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">AI Command Center</p>
              <p className="text-[10px] text-muted-foreground">وكلاء بيانات حقيقية</p>
            </div>
          </div>
        </div>

        {/* Health score mini */}
        {health && (
          <div className="px-3 py-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">صحة المكتب</p>
              <span className={cn("text-xs font-bold",
                health.score >= 80 ? "text-emerald-400" : health.score >= 60 ? "text-yellow-400" : "text-red-400")}>
                {health.score}/100
              </span>
            </div>
            <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
              <div className={cn("h-full rounded-full transition-all",
                health.score >= 80 ? "bg-emerald-500" : health.score >= 60 ? "bg-yellow-500" : "bg-red-500")}
                style={{ width: `${health.score}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1 p-2 flex-1">
          {AGENTS.map(agent => {
            const Icon = agent.icon;
            const isActive = selected === agent.id;
            return (
              <button key={agent.id} onClick={() => setSelected(agent.id)}
                className={cn("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-right transition-all",
                  isActive ? "shadow-sm text-foreground" : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                style={isActive ? { backgroundColor: agent.color + "20", border: `1px solid ${agent.color}40` } : {}}>
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: agent.color + (isActive ? "30" : "15") }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: agent.color }} />
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-xs font-medium truncate">{agent.name}</p>
                  <p className="text-[10px] opacity-60 truncate hidden sm:block">{agent.desc}</p>
                </div>
                {agent.id === "developer" && <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />}
              </button>
            );
          })}
        </div>

        <div className="p-2 border-t border-border/50">
          <div className="rounded-xl p-2.5 bg-muted/40 text-center">
            <p className="text-[10px] text-muted-foreground">السوبر أدمن فقط</p>
            <p className="text-[10px] font-medium mt-0.5 text-primary">بيانات حقيقية + AI</p>
          </div>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="border-b border-border/50 px-4 py-3 flex items-center gap-3 shrink-0"
          style={{ borderBottomColor: currentAgent.color + "30" }}>
          <div className="h-8 w-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: currentAgent.color + "25" }}>
            <currentAgent.icon className="h-4 w-4" style={{ color: currentAgent.color }} />
          </div>
          <div>
            <h1 className="font-semibold text-sm">{currentAgent.name}</h1>
            <p className="text-xs text-muted-foreground">{currentAgent.desc}</p>
          </div>
          <div className="mr-auto flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">يقرأ البيانات الحية</span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {selected === "developer"
            ? <DevCommanderPanel />
            : <AgentChat agentId={selected} agentName={currentAgent.name} agentColor={currentAgent.color} />
          }
        </div>
      </main>
    </div>
  );
}
