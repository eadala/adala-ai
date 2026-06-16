import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scale, TrendingUp, Users, Shield, BarChart3, Rocket,
  Zap, Terminal, Send, Loader2, RefreshCw, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Clock, Cpu, Database,
  Activity, Bot, Sparkles, Trash2, Plus, Eye, MemoryStick,
  Server, Globe, Lock, CircleDot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Agent catalogue ─────────────────────────────────────────────────────── */
const AGENTS = [
  { id: "legal",     name: "وكيل قانوني",          icon: Scale,      color: "#6366F1", desc: "تحليل القضايا والمخاطر والاستراتيجية القانونية" },
  { id: "financial", name: "وكيل مالي",              icon: TrendingUp,  color: "#10B981", desc: "الإيرادات والتحصيل والتوقعات المالية" },
  { id: "hr",        name: "وكيل الموارد البشرية",   icon: Users,      color: "#F59E0B", desc: "الأداء والرواتب والإجازات والتطوير" },
  { id: "security",  name: "وكيل أمني",              icon: Shield,     color: "#EF4444", desc: "مراجعة الأمان وكشف التهديدات والصلاحيات" },
  { id: "analytics", name: "وكيل التحليلات",         icon: BarChart3,  color: "#8B5CF6", desc: "مؤشرات الأداء وتحليل الاستخدام والتوجهات" },
  { id: "growth",    name: "وكيل النمو",              icon: Rocket,     color: "#06B6D4", desc: "اكتساب العملاء والتسويق والتوسع" },
  { id: "operations",name: "وكيل التشغيل",           icon: Zap,        color: "#F97316", desc: "إدارة المهام وتحسين العمليات" },
  { id: "developer", name: "قائد التطوير",            icon: Terminal,   color: "#64748B", desc: "تشخيص المنصة واقتراح الإصلاحات" },
] as const;

type AgentId = typeof AGENTS[number]["id"];

interface Message { role: "user" | "assistant"; content: string; model?: string; }
interface Proposal {
  id: string; title: string; description: string; severity: string;
  category: string; affected: string; fix_type: string; status: string;
  created_at: string;
}

const SEVERITY_STYLE: Record<string, { label: string; cls: string }> = {
  critical: { label: "حرجة 🔴", cls: "border-red-500/50 bg-red-500/10 text-red-400" },
  high:     { label: "عالية 🟠", cls: "border-orange-500/50 bg-orange-500/10 text-orange-400" },
  medium:   { label: "متوسطة 🟡", cls: "border-yellow-500/50 bg-yellow-500/10 text-yellow-400" },
  low:      { label: "منخفضة 🟢", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" },
};

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, "<br/>");
}

/* ── DevCommander diagnostic view ────────────────────────────────────────── */
function DevCommanderPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<any>(null);
  const [devMsg, setDevMsg] = useState("");
  const [devHistory, setDevHistory] = useState<Message[]>([]);
  const [devLoading, setDevLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"scan"|"proposals"|"chat">("scan");

  const { data: proposals = [], refetch: refetchProposals } = useQuery<Proposal[]>({
    queryKey: ["dev-proposals"],
    queryFn: () => fetch(`${BASE}/api/dev-commander/proposals`).then(r => r.json()),
    staleTime: 30_000,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/api/dev-commander/proposals/${id}/approve`, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: "✅ تمت الموافقة", description: data.result });
      qc.invalidateQueries({ queryKey: ["dev-proposals"] });
    },
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/api/dev-commander/proposals/${id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "رُفض من المشرف" }),
      }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "❌ رُفض الاقتراح" });
      qc.invalidateQueries({ queryKey: ["dev-proposals"] });
    },
  });

  async function runScan() {
    setScanning(true);
    try {
      const r = await fetch(`${BASE}/api/dev-commander/scan`);
      const data = await r.json();
      setScan(data);
      setActiveTab("scan");
    } catch {
      toast({ title: "فشل الفحص", variant: "destructive" });
    } finally { setScanning(false); }
  }

  async function sendDevMsg() {
    if (!devMsg.trim() || devLoading) return;
    const msg = devMsg.trim();
    setDevMsg("");
    setDevLoading(true);
    const history = [...devHistory, { role: "user" as const, content: msg }];
    setDevHistory(history);
    try {
      const r = await fetch(`${BASE}/api/dev-commander/ai-analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, diagnostics: scan?.diagnostics }),
      });
      const data = await r.json();
      setDevHistory([...history, { role: "assistant", content: data.reply }]);
      if (data.proposals?.length > 0) {
        toast({ title: `🔍 ${data.proposals.length} اقتراح جديد`, description: "تم استخراج الاقتراحات من الرد" });
      }
    } catch { toast({ title: "خطأ", variant: "destructive" }); }
    finally { setDevLoading(false); }
  }

  const tabs = [
    { id: "scan", label: "تشخيص المنصة", icon: Activity },
    { id: "proposals", label: `الاقتراحات (${proposals.length})`, icon: Eye },
    { id: "chat", label: "محادثة التطوير", icon: Terminal },
  ] as const;

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Tabs */}
      <div className="flex gap-2 bg-muted/40 p-1 rounded-xl">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as any)}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all",
              activeTab === t.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Scan Tab */}
      {activeTab === "scan" && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <Button onClick={runScan} disabled={scanning} className="gap-2 bg-slate-700 hover:bg-slate-600">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {scanning ? "جارٍ الفحص..." : "فحص شامل للمنصة"}
          </Button>
          {scan && (
            <ScrollArea className="flex-1">
              <div className="space-y-3 pb-4">
                {/* AI Analysis */}
                {scan.aiAnalysis && (
                  <Card className="border-blue-500/30 bg-blue-500/5">
                    <CardHeader className="pb-2 pt-3 px-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-blue-400" />
                        تحليل قائد التطوير
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3">
                      <p className="text-xs text-muted-foreground leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(scan.aiAnalysis) }} />
                    </CardContent>
                  </Card>
                )}
                {/* System Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "الذاكرة", value: `${scan.diagnostics.system.memoryUsedPct}%`, icon: MemoryStick, warn: scan.diagnostics.system.memoryUsedPct > 85 },
                    { label: "المعالج", value: scan.diagnostics.system.cpuLoad1m, icon: Cpu, warn: scan.diagnostics.system.cpuLoad1m > 2 },
                    { label: "التشغيل", value: `${scan.diagnostics.system.uptime}د`, icon: Clock, warn: false },
                    { label: "الاتصالات", value: scan.diagnostics.database.activeConnections, icon: Database, warn: scan.diagnostics.database.activeConnections > 20 },
                  ].map(m => (
                    <Card key={m.label} className={cn("border", m.warn ? "border-orange-500/40 bg-orange-500/5" : "border-border/50")}>
                      <CardContent className="p-2.5 flex items-center gap-2">
                        <m.icon className={cn("h-4 w-4 shrink-0", m.warn ? "text-orange-400" : "text-muted-foreground")} />
                        <div>
                          <p className="text-xs text-muted-foreground">{m.label}</p>
                          <p className={cn("text-sm font-bold", m.warn ? "text-orange-400" : "text-foreground")}>{m.value}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {/* Platform Stats */}
                <Card className="border-border/50">
                  <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "المكاتب", value: scan.diagnostics.platform.offices, icon: Globe },
                      { label: "المستخدمون", value: scan.diagnostics.platform.users, icon: Users },
                      { label: "القضايا", value: scan.diagnostics.platform.totalCases, icon: Scale },
                      { label: "فواتير معلقة", value: scan.diagnostics.platform.unpaidInvoices, icon: AlertTriangle },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <s.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">{s.label}</p>
                          <p className="font-bold text-sm">{s.value}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                {/* Isolation */}
                <Card className={cn("border", scan.diagnostics.tenantIsolation.isolationScore === 100 ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5")}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className={cn("h-4 w-4", scan.diagnostics.tenantIsolation.isolationScore === 100 ? "text-emerald-400" : "text-red-400")} />
                      <span className="text-sm font-medium">عزل البيانات بين المكاتب</span>
                    </div>
                    <Badge className={scan.diagnostics.tenantIsolation.isolationScore === 100 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}>
                      {scan.diagnostics.tenantIsolation.isolationScore}%
                    </Badge>
                  </CardContent>
                </Card>
                {/* DB Tables */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs text-muted-foreground">أكبر الجداول</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="text-muted-foreground border-b border-border/30">
                          <th className="text-right pb-1">الجدول</th>
                          <th className="text-center pb-1">الحجم</th>
                          <th className="text-center pb-1">السجلات</th>
                        </tr></thead>
                        <tbody>
                          {(scan.diagnostics.database.tables ?? []).slice(0, 8).map((t: any) => (
                            <tr key={t.name} className="border-b border-border/20 hover:bg-muted/20">
                              <td className="py-1 font-mono">{t.name}</td>
                              <td className="text-center py-1 text-muted-foreground">{t.size}</td>
                              <td className="text-center py-1">{t.rows?.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
          {!scan && !scanning && (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <Server className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">اضغط "فحص شامل" لتحليل حالة المنصة</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proposals Tab */}
      {activeTab === "proposals" && (
        <ScrollArea className="flex-1">
          <div className="space-y-3 pb-4">
            {proposals.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500/40" />
                لا توجد اقتراحات معلقة
              </div>
            )}
            {proposals.map(p => {
              const sev = SEVERITY_STYLE[p.severity] ?? SEVERITY_STYLE.medium;
              return (
                <Card key={p.id} className={cn("border", sev.cls)}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{p.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-xs shrink-0", sev.cls)}>{sev.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      {p.category && <span className="flex items-center gap-1"><CircleDot className="h-3 w-3" />{p.category}</span>}
                      {p.affected && <span>المتأثر: {p.affected}</span>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs h-7"
                        onClick={() => approveMut.mutate(p.id)}
                        disabled={approveMut.isPending}>
                        <CheckCircle2 className="h-3 w-3" />
                        موافقة وتنفيذ
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 gap-1 border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs h-7"
                        onClick={() => rejectMut.mutate(p.id)}
                        disabled={rejectMut.isPending}>
                        <XCircle className="h-3 w-3" />
                        رفض
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div className="flex flex-col flex-1 min-h-0 gap-3">
          <ScrollArea className="flex-1">
            <div className="space-y-3 pb-2">
              {devHistory.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  <Terminal className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  اسأل قائد التطوير عن أي مشكلة في المنصة
                </div>
              )}
              {devHistory.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm",
                    m.role === "user" ? "bg-slate-700 text-white" : "bg-muted border border-border/50")}>
                    <p className="text-xs leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }} />
                  </div>
                </div>
              ))}
              {devLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted border border-border/50 rounded-xl px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex gap-2 items-end">
            <Textarea value={devMsg} onChange={e => setDevMsg(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendDevMsg(); } }}
              placeholder="اسأل قائد التطوير..." rows={2}
              className="flex-1 resize-none text-sm min-h-[60px]" />
            <Button onClick={sendDevMsg} disabled={devLoading || !devMsg.trim()} size="icon" className="bg-slate-700 hover:bg-slate-600 h-[60px] w-10 shrink-0">
              {devLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Regular agent chat ───────────────────────────────────────────────────── */
function AgentChat({ agentId, agentName, agentColor }: { agentId: AgentId; agentName: string; agentColor: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    const next = [...messages, { role: "user" as const, content: msg }];
    setMessages(next);
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/ai-command/chat/${agentId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId, history: messages }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setMessages([...next, { role: "assistant", content: data.reply, model: data.modelUsed }]);
      setSessionId(data.sessionId);
    } catch (e: any) {
      toast({ title: "خطأ في الوكيل", description: e.message, variant: "destructive" });
      setMessages(next.slice(0, -1));
    } finally { setLoading(false); }
  }

  const quickPrompts: Record<AgentId, string[]> = {
    legal:      ["حلل أبرز مخاطر قضايا اليوم", "اقترح استراتيجية للقضايا المعلقة", "ما أهم مواعيد الجلسات القادمة؟"],
    financial:  ["ملخص الإيرادات هذا الشهر", "الفواتير المتأخرة وكيفية تحصيلها", "توقعات التدفق النقدي للربع القادم"],
    hr:         ["تحليل الأداء الوظيفي الحالي", "مراجعة سياسة الإجازات", "توصيات لتحسين بيئة العمل"],
    security:   ["مراجعة صلاحيات المستخدمين", "تقرير الثغرات الأمنية المحتملة", "اقترح سياسة كلمات مرور"],
    analytics:  ["أهم مؤشرات الأداء هذا الأسبوع", "تحليل نمو قاعدة العملاء", "مقارنة أداء هذا الشهر بالسابق"],
    growth:     ["استراتيجيات لاكتساب 10 عملاء جدد", "كيف أحسّن معدل تحويل الزوار؟", "خطة توسع في سوق جديد"],
    operations: ["المهام المتأخرة وأسبابها", "تحسين توزيع العمل على الفريق", "اقترح أتمتة للعمليات المتكررة"],
    developer:  ["ما أبرز مشاكل المنصة الآن؟", "كيف أحسّن أداء قاعدة البيانات؟", "مراجعة أمان الـ API"],
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4 pb-2">
          {messages.length === 0 && (
            <div className="py-4">
              <p className="text-center text-xs text-muted-foreground mb-4">اختر سؤالاً سريعاً أو اكتب سؤالك</p>
              <div className="grid gap-2">
                {(quickPrompts[agentId] ?? []).map(q => (
                  <button key={q} onClick={() => { setInput(q); }}
                    className="text-right text-xs px-3 py-2 rounded-lg border border-border/50 hover:bg-muted/60 hover:border-border transition-colors text-muted-foreground hover:text-foreground">
                    <ChevronRight className="h-3 w-3 inline ml-1 opacity-60" />
                    {q}
                  </button>
                ))}
              </div>
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
                <p className="leading-relaxed text-xs sm:text-sm"
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(m.content) }} />
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
                <div className="flex gap-1">
                  {[0,1,2].map(d => (
                    <span key={d} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce"
                      style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border/50 p-3">
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setMessages([]); setSessionId(undefined); }}
            className="gap-1 text-xs text-muted-foreground mb-2 h-6">
            <Trash2 className="h-3 w-3" /> محادثة جديدة
          </Button>
        )}
        <div className="flex gap-2 items-end">
          <Textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`اسأل ${agentName}...`} rows={2}
            className="flex-1 resize-none text-sm min-h-[60px]" />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon"
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

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden" dir="rtl">
      {/* Left: Agent selection sidebar */}
      <aside className="w-52 sm:w-60 shrink-0 border-l border-border/50 bg-background flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">AI Command Center</p>
              <p className="text-[10px] text-muted-foreground">مركز قيادة الذكاء</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1 p-2 flex-1">
          {AGENTS.map(agent => {
            const Icon = agent.icon;
            const isActive = selected === agent.id;
            return (
              <button key={agent.id} onClick={() => setSelected(agent.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-right transition-all",
                  isActive
                    ? "shadow-sm text-foreground"
                    : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                style={isActive ? { backgroundColor: agent.color + "20", border: `1px solid ${agent.color}40` } : {}}>
                <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: agent.color + (isActive ? "30" : "15") }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: agent.color }} />
                </div>
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-xs font-medium truncate">{agent.name}</p>
                  <p className="text-[10px] opacity-60 truncate hidden sm:block">{agent.desc.split("،")[0]}</p>
                </div>
                {agent.id === "developer" && (
                  <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
        <div className="p-2 border-t border-border/50">
          <div className="rounded-xl p-2.5 bg-muted/40 text-center">
            <p className="text-[10px] text-muted-foreground">خاص بمالك المنصة</p>
            <p className="text-[10px] font-medium mt-0.5">السوبر أدمن فقط</p>
          </div>
        </div>
      </aside>

      {/* Right: Agent workspace */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
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
            <span className="text-xs text-muted-foreground">متصل</span>
          </div>
        </div>

        {/* Content */}
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
