import { useState, useCallback } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Terminal, Cpu, Shield, Database, Activity, ClipboardList, ScrollText,
  Code2, RefreshCw, Plus, Trash2, CheckCircle2, XCircle, Clock,
  AlertTriangle, ShieldCheck, Globe, Loader2, Send, Copy, ChevronRight,
  HardDrive, Server, Zap, Lock, KeyRound, Wifi, Eye, BarChart3,
  CircleCheck, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
let _getToken: (() => Promise<string | null>) | null = null;

async function ENG(path: string, opts: RequestInit = {}) {
  const token = _getToken ? await _getToken() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/engineering${path}`, { ...opts, headers });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(e.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function fmt(bytes: number, decimals = 1) {
  if (!bytes) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i] ?? "B"}`;
}

function fmtUptime(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}ي ${h}س` : h > 0 ? `${h}س ${m}د` : `${m}د`;
}

function renderAIText(text: string) {
  return text.split("\n").map((line, i) => {
    const bold = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    if (line.startsWith("### ")) return <h3 key={i} className="text-sm font-bold mt-3 mb-1 text-violet-300">{line.slice(4)}</h3>;
    if (line.startsWith("## "))  return <h2 key={i} className="text-base font-black mt-4 mb-1">{line.slice(3)}</h2>;
    if (line.startsWith("# "))   return <h1 key={i} className="text-lg font-black mt-4 mb-1">{line.slice(2)}</h1>;
    if (line.startsWith("- ") || line.startsWith("* "))
      return <li key={i} className="mr-4 text-sm text-muted-foreground list-disc" dangerouslySetInnerHTML={{ __html: bold }} />;
    return <p key={i} className="text-sm text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: bold }} />;
  });
}

const SEVERITY_STYLES: Record<string, string> = {
  ok:       "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  info:     "bg-blue-500/10 text-blue-300 border-blue-500/20",
  warning:  "bg-amber-500/10 text-amber-300 border-amber-500/20",
  high:     "bg-red-500/10 text-red-400 border-red-500/20",
  critical: "bg-red-900/30 text-red-300 border-red-400/30",
  secure:   "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  disabled: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  active:   "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  planned:  "bg-violet-500/10 text-violet-300 border-violet-500/20",
};

const PRIORITY_COLORS: Record<string, string> = {
  low:      "text-slate-400",
  medium:   "text-amber-400",
  high:     "text-orange-400",
  critical: "text-red-400",
};

const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-slate-500/20 text-slate-300",
  running:    "bg-blue-500/20 text-blue-300",
  done:       "bg-emerald-500/20 text-emerald-300",
  failed:     "bg-red-500/20 text-red-300",
};

const CATEGORIES = [
  { value: "general",     label: "عام" },
  { value: "security",    label: "أمان" },
  { value: "performance", label: "أداء" },
  { value: "database",    label: "قاعدة البيانات" },
  { value: "code",        label: "مراجعة كود" },
  { value: "deployment",  label: "نشر" },
];

const REVIEW_TYPES = [
  { value: "general",     label: "تحليل عام" },
  { value: "security",    label: "فحص أمني" },
  { value: "performance", label: "تحليل أداء" },
  { value: "code",        label: "مراجعة كود" },
  { value: "database",    label: "تحليل قاعدة بيانات" },
];

export default function EngineeringCenter() {
  const { getToken } = useAuth();
  _getToken = getToken;

  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");

  /* AI Review state */
  const [aiTopic,      setAiTopic]      = useState("");
  const [aiContext,    setAiContext]     = useState("");
  const [aiType,       setAiType]       = useState("general");
  const [aiResult,     setAiResult]     = useState("");
  const [aiLoading,    setAiLoading]    = useState(false);

  /* Security scan state */
  const [scanResult,   setScanResult]   = useState<any>(null);
  const [scanLoading,  setScanLoading]  = useState(false);

  /* IP Whitelist state */
  const [newIp,        setNewIp]        = useState("");
  const [newIpLabel,   setNewIpLabel]   = useState("");

  /* Task state */
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium", category: "general" });
  const [showTaskForm, setShowTaskForm] = useState(false);

  /* DB search */
  const [dbSearch, setDbSearch] = useState("");

  /* Queries */
  const { data: map = {},  isLoading: mapLoading,  refetch: refetchMap }  = useQuery<any>({
    queryKey: ["eng", "map"],
    queryFn:  () => ENG("/platform-map"),
    staleTime: 30_000,
  });
  const { data: perf = {}, isLoading: perfLoading, refetch: refetchPerf } = useQuery<any>({
    queryKey: ["eng", "perf"],
    queryFn:  () => ENG("/performance"),
    staleTime: 15_000,
  });
  const { data: dbStats = { tables: [], indexes: [] }, isLoading: dbLoading, refetch: refetchDb } = useQuery<any>({
    queryKey: ["eng", "db"],
    queryFn:  () => ENG("/db-stats"),
    staleTime: 60_000,
  });
  const { data: tasks = [], refetch: refetchTasks } = useQuery<any[]>({
    queryKey: ["eng", "tasks"],
    queryFn:  () => ENG("/tasks"),
    staleTime: 10_000,
  });
  const { data: logs = [], refetch: refetchLogs } = useQuery<any[]>({
    queryKey: ["eng", "logs"],
    queryFn:  () => ENG("/logs"),
    staleTime: 10_000,
  });
  const { data: ips = [], refetch: refetchIps } = useQuery<any[]>({
    queryKey: ["eng", "ips"],
    queryFn:  () => ENG("/ip-whitelist"),
    staleTime: 30_000,
  });
  const { data: ipCheck = { authorized: true, whitelistActive: false, ip: "" } } = useQuery<any>({
    queryKey: ["eng", "ip-check"],
    queryFn:  () => ENG("/ip-check"),
    staleTime: 60_000,
  });
  const { data: scans = [], refetch: refetchScans } = useQuery<any[]>({
    queryKey: ["eng", "scans"],
    queryFn:  () => ENG("/scans"),
    staleTime: 30_000,
  });

  /* Mutations */
  const addIpMut = useMutation({
    mutationFn: () => ENG("/ip-whitelist", {
      method: "POST",
      body: JSON.stringify({ ip_address: newIp.trim(), label: newIpLabel.trim() || undefined }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eng", "ips"] });
      setNewIp(""); setNewIpLabel("");
      toast({ title: "✅ تم إضافة الـ IP" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const removeIpMut = useMutation({
    mutationFn: (id: string) => ENG(`/ip-whitelist/${id}`, { method: "DELETE" }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["eng", "ips"] }); toast({ title: "✅ تم حذف الـ IP" }); },
    onError:    (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const createTaskMut = useMutation({
    mutationFn: () => ENG("/tasks", { method: "POST", body: JSON.stringify(taskForm) }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["eng", "tasks"] });
      setTaskForm({ title: "", description: "", priority: "medium", category: "general" });
      setShowTaskForm(false);
      toast({ title: "✅ تم إنشاء المهمة" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const updateTaskMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      ENG(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["eng", "tasks"] }); },
  });

  const deleteTaskMut = useMutation({
    mutationFn: (id: string) => ENG(`/tasks/${id}`, { method: "DELETE" }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ["eng", "tasks"] }); toast({ title: "✅ تم حذف المهمة" }); },
  });

  /* AI Review */
  const runAiReview = useCallback(async () => {
    if (!aiTopic && !aiContext) return;
    setAiLoading(true); setAiResult("");
    try {
      const res = await ENG("/ai-review", {
        method: "POST",
        body: JSON.stringify({ topic: aiTopic, context: aiContext, reviewType: aiType }),
      });
      setAiResult(res.reply ?? "");
      qc.invalidateQueries({ queryKey: ["eng", "logs"] });
    } catch (e: any) {
      toast({ title: "خطأ في AI", description: e.message, variant: "destructive" });
    } finally { setAiLoading(false); }
  }, [aiTopic, aiContext, aiType, qc, toast]);

  /* Security Scan */
  const runSecurityScan = useCallback(async () => {
    setScanLoading(true); setScanResult(null);
    try {
      const res = await ENG("/security-scan", { method: "POST" });
      setScanResult(res);
      refetchScans();
      qc.invalidateQueries({ queryKey: ["eng", "logs"] });
      toast({ title: "✅ اكتمل الفحص الأمني" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setScanLoading(false); }
  }, [qc, toast, refetchScans]);

  /* Helpers */
  const memPercent = perf.memory
    ? Math.round((perf.memory.heapUsed / perf.memory.heapTotal) * 100)
    : 0;
  const sysPercent = perf.memory
    ? Math.round(((perf.memory.systemTotal - perf.memory.systemFree) / perf.memory.systemTotal) * 100)
    : 0;

  const filteredTables = (dbStats.tables ?? []).filter((t: any) =>
    t.name?.toLowerCase().includes(dbSearch.toLowerCase())
  );

  return (
    <Layout>
      <div className="flex flex-col h-full min-h-0">

        {/* ── Header ── */}
        <div className="border-b px-6 py-4 flex items-center justify-between bg-gradient-to-r from-violet-900/20 to-indigo-900/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Terminal className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight">مركز الهندسة</h1>
              <p className="text-[11px] text-muted-foreground font-mono">Adala Engineering Center — Platform Owner Console</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ipCheck.whitelistActive && (
              <Badge className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Lock className="h-3 w-3" />IP Whitelist مفعّل
              </Badge>
            )}
            <Badge className={`text-[10px] gap-1 border ${ipCheck.authorized ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" : "bg-red-500/10 text-red-300 border-red-500/20"}`}>
              <Wifi className="h-3 w-3" />{ipCheck.ip || "—"}
            </Badge>
          </div>
        </div>

        {/* ── Main Tabs ── */}
        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-hidden flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 shrink-0 flex-wrap h-auto gap-1 bg-transparent p-0">
            {[
              { v: "overview",     label: "نظرة عامة",   icon: BarChart3 },
              { v: "code-review",  label: "تحليل AI",     icon: Code2 },
              { v: "security",     label: "الأمان",        icon: Shield },
              { v: "performance",  label: "الأداء",        icon: Activity },
              { v: "database",     label: "قاعدة البيانات", icon: Database },
              { v: "tasks",        label: "المهام",         icon: ClipboardList },
              { v: "logs",         label: "السجلات",        icon: ScrollText },
            ].map(t => (
              <TabsTrigger key={t.v} value={t.v}
                className="text-xs gap-1.5 data-[state=active]:bg-violet-600/20 data-[state=active]:text-violet-300 data-[state=active]:border-violet-500/30 border border-transparent rounded-lg px-3 py-2">
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 overflow-y-auto px-6 pb-6 mt-4">

            {/* ══════════ OVERVIEW ══════════ */}
            <TabsContent value="overview" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "المكاتب",     value: map.offices,     icon: Globe,       color: "text-blue-400" },
                  { label: "المستخدمون", value: map.users,       icon: Cpu,          color: "text-violet-400" },
                  { label: "القضايا",    value: map.cases,       icon: ClipboardList, color: "text-amber-400" },
                  { label: "العملاء",    value: map.clients,     icon: Server,        color: "text-emerald-400" },
                  { label: "الفواتير",   value: map.invoices,    icon: BarChart3,     color: "text-cyan-400" },
                  { label: "العقود",     value: map.contracts,   icon: ScrollText,    color: "text-pink-400" },
                  { label: "مهام AI",    value: map.aiTasks,     icon: Zap,           color: "text-yellow-400" },
                  { label: "جداول DB",   value: map.dbTables,    icon: Database,      color: "text-indigo-400" },
                ].map((stat, i) => (
                  <Card key={i} className="border-white/5 bg-white/2">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                      {mapLoading
                        ? <div className="h-6 w-12 bg-white/5 rounded animate-pulse" />
                        : <p className="text-2xl font-black">{Number(stat.value ?? 0).toLocaleString()}</p>
                      }
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* System Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Server className="h-4 w-4 text-violet-400" />معلومات النظام
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Uptime</span>
                      <span className="font-mono font-bold">{fmtUptime(map.uptime ?? 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Node.js</span>
                      <span className="font-mono font-bold text-emerald-400">{map.nodeVersion ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform</span>
                      <span className="font-mono">{map.platform ?? "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">جداول DB</span>
                      <span className="font-bold text-indigo-400">{map.dbTables ?? 0} جدول</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Security Layers */}
                <Card className="border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4 text-emerald-400" />طبقات الحماية الأمنية (5 طبقات)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {(map.securityLayers ?? [
                      { id: 1, name: "Role Permission",  status: "active" },
                      { id: 2, name: "Clerk Auth (JWT)", status: "active" },
                      { id: 3, name: "IP Allowlist",     status: "disabled" },
                      { id: 4, name: "Approval Key",     status: "planned" },
                      { id: 5, name: "Audit Logs",       status: "active" },
                    ]).map((layer: any) => (
                      <div key={layer.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4">{layer.id}.</span>
                          <span className="text-xs font-mono">{layer.name}</span>
                        </div>
                        <Badge className={`text-[10px] px-2 border ${SEVERITY_STYLES[layer.status] ?? SEVERITY_STYLES.info}`}>
                          {layer.status === "active" ? "✓ فعّال" : layer.status === "planned" ? "مخطط" : "معطل"}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              {(map.recentActivity?.length > 0) && (
                <Card className="border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ScrollText className="h-4 w-4 text-amber-400" />آخر نشاط هندسي
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {map.recentActivity.map((log: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground py-1">
                          <ChevronRight className="h-3 w-3 text-violet-400 shrink-0" />
                          <span className="font-mono text-violet-300">{log.action}</span>
                          <span className="flex-1 truncate">{JSON.stringify(log.details)}</span>
                          <span className="shrink-0">{new Date(log.created_at).toLocaleTimeString("ar")}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => { refetchMap(); }}>
                  <RefreshCw className="h-3.5 w-3.5" />تحديث البيانات
                </Button>
              </div>
            </TabsContent>

            {/* ══════════ AI CODE REVIEW ══════════ */}
            <TabsContent value="code-review" className="mt-0 space-y-4">
              <Card className="border-white/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-violet-400" />تحليل AI الهندسي
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">أدخل موضوع التحليل والكود أو السياق، واختر نوع المراجعة</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">الموضوع</label>
                      <Input
                        placeholder="مثال: تحسين أداء استعلامات الدashboard"
                        value={aiTopic}
                        onChange={e => setAiTopic(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">نوع التحليل</label>
                      <Select value={aiType} onValueChange={setAiType}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REVIEW_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">الكود أو السياق (اختياري)</label>
                    <Textarea
                      placeholder="الصق الكود أو اكتب السياق الذي تريد تحليله..."
                      value={aiContext}
                      onChange={e => setAiContext(e.target.value)}
                      rows={6}
                      className="text-sm font-mono resize-none"
                    />
                  </div>
                  <Button
                    onClick={runAiReview}
                    disabled={aiLoading || (!aiTopic && !aiContext)}
                    className="gap-2 bg-violet-600 hover:bg-violet-700"
                  >
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {aiLoading ? "جاري التحليل..." : "تشغيل التحليل"}
                  </Button>
                </CardContent>
              </Card>

              {aiResult && (
                <Card className="border-violet-500/20 bg-violet-900/5">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CircleCheck className="h-4 w-4 text-emerald-400" />نتيجة التحليل
                    </CardTitle>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                      onClick={() => { navigator.clipboard.writeText(aiResult); toast({ title: "✅ تم النسخ" }); }}>
                      <Copy className="h-3 w-3" />نسخ
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {renderAIText(aiResult)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ══════════ SECURITY ══════════ */}
            <TabsContent value="security" className="mt-0 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Security Scan */}
                <Card className="border-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />الفحص الأمني الشامل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      onClick={runSecurityScan}
                      disabled={scanLoading}
                      className="w-full gap-2 bg-emerald-700/80 hover:bg-emerald-700"
                    >
                      {scanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      {scanLoading ? "جاري الفحص..." : "بدء فحص أمني"}
                    </Button>

                    {scanResult && (
                      <div className="space-y-2">
                        {(scanResult.findings ?? []).map((f: any) => (
                          <div key={f.id} className={`p-3 rounded-lg border text-xs ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info}`}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-bold">{f.label}</span>
                              <Badge className={`text-[10px] px-2 ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info}`}>
                                {f.severity}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground">القيمة: {f.value} — {f.recommendation}</p>
                          </div>
                        ))}
                        {scanResult.aiAnalysis && (
                          <div className="mt-3 p-3 bg-white/3 rounded-lg border border-white/5">
                            <p className="text-xs font-bold mb-2 text-violet-300">تحليل AI:</p>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {renderAIText(scanResult.aiAnalysis)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent Scans */}
                    {scans.length > 0 && !scanResult && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">آخر فحص: {new Date(scans[0]?.created_at).toLocaleString("ar")}</p>
                        <Button size="sm" variant="outline" className="text-xs gap-1 w-full"
                          onClick={() => setScanResult({ findings: scans[0]?.findings, aiAnalysis: scans[0]?.summary })}>
                          <Eye className="h-3 w-3" />عرض آخر فحص
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* IP Whitelist */}
                <Card className="border-white/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lock className="h-4 w-4 text-amber-400" />القائمة البيضاء للـ IP
                      {ips.length > 0 && (
                        <Badge className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">{ips.length}</Badge>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {ips.length === 0
                        ? "لا توجد قيود حالياً — أي IP مصادق عليه يمكنه الوصول"
                        : `مقيّد على ${ips.length} عنوان IP فقط`}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="192.168.1.1"
                        value={newIp}
                        onChange={e => setNewIp(e.target.value)}
                        className="text-xs font-mono"
                      />
                      <Input
                        placeholder="تسمية (اختياري)"
                        value={newIpLabel}
                        onChange={e => setNewIpLabel(e.target.value)}
                        className="text-xs"
                      />
                      <Button size="sm" onClick={() => addIpMut.mutate()} disabled={!newIp.trim() || addIpMut.isPending} className="shrink-0">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {ips.length === 0
                        ? <p className="text-xs text-muted-foreground text-center py-4">لا توجد قيود IP</p>
                        : ips.map((ip: any) => (
                          <div key={ip.id} className="flex items-center justify-between p-2 rounded border border-white/5 bg-white/2">
                            <div>
                              <p className="text-xs font-mono font-bold">{ip.ip_address}</p>
                              {ip.label && <p className="text-[10px] text-muted-foreground">{ip.label}</p>}
                            </div>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                              onClick={() => removeIpMut.mutate(ip.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      }
                    </div>
                    {ipCheck.ip && (
                      <div className="flex items-center justify-between p-2 rounded border border-violet-500/20 bg-violet-500/5 text-xs">
                        <span className="text-muted-foreground">IP الحالي:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{ipCheck.ip}</span>
                          <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2 text-violet-400"
                            onClick={() => { setNewIp(ipCheck.ip); setNewIpLabel("IP الحالي"); }}>
                            + إضافة
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ══════════ PERFORMANCE ══════════ */}
            <TabsContent value="performance" className="mt-0 space-y-4">
              {perfLoading
                ? <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>
                : (
                  <>
                    <div className="grid md:grid-cols-3 gap-3">
                      {[
                        { label: "Heap Used / Total", value: `${fmt(perf.memory?.heapUsed)} / ${fmt(perf.memory?.heapTotal)}`, pct: memPercent, color: memPercent > 80 ? "bg-red-500" : memPercent > 60 ? "bg-amber-500" : "bg-emerald-500" },
                        { label: "RAM النظام", value: `${fmt(perf.memory?.systemTotal - perf.memory?.systemFree)} / ${fmt(perf.memory?.systemTotal)}`, pct: sysPercent, color: sysPercent > 80 ? "bg-red-500" : "bg-blue-500" },
                        { label: "DB Size", value: perf.db?.size ?? "—", pct: null, color: "bg-indigo-500" },
                      ].map((item, i) => (
                        <Card key={i} className="border-white/5">
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                            <p className="text-sm font-bold mb-2">{item.value}</p>
                            {item.pct !== null && (
                              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                              </div>
                            )}
                            {item.pct !== null && <p className="text-[10px] text-muted-foreground mt-1">{item.pct}%</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <Card className="border-white/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">معلومات الخادم</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {[
                            ["Uptime", fmtUptime(perf.uptime ?? 0)],
                            ["Node.js", perf.nodeVersion ?? "—"],
                            ["CPUs", `${perf.cpuCount ?? 0} × ${perf.cpuModel ?? "—"}`],
                            ["Platform", perf.platform ?? "—"],
                            ["DB Connections", String(perf.activeDbConnections ?? 0)],
                          ].map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-muted-foreground text-xs">{k}</span>
                              <span className="font-mono text-xs font-bold">{v}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card className="border-white/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">أكبر 10 جداول</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5 max-h-52 overflow-y-auto">
                          {(perf.topTables ?? []).map((t: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="font-mono text-muted-foreground truncate">{t.name}</span>
                              <span className="font-bold text-indigo-300 shrink-0">{t.total_size}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => refetchPerf()}>
                        <RefreshCw className="h-3.5 w-3.5" />تحديث
                      </Button>
                    </div>
                  </>
                )}
            </TabsContent>

            {/* ══════════ DATABASE ══════════ */}
            <TabsContent value="database" className="mt-0 space-y-4">
              <div className="flex items-center gap-3">
                <Input
                  placeholder="ابحث عن جدول..."
                  value={dbSearch}
                  onChange={e => setDbSearch(e.target.value)}
                  className="text-sm max-w-xs"
                />
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => refetchDb()}>
                  <RefreshCw className="h-3.5 w-3.5" />تحديث
                </Button>
                <p className="text-xs text-muted-foreground">{filteredTables.length} جدول</p>
              </div>
              {dbLoading
                ? <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>
                : (
                  <div className="rounded-lg border border-white/5 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-white/3 border-b border-white/5">
                        <tr>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">#</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">اسم الجدول</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">الحجم</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">صفوف (تقدير)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTables.map((t: any, i: number) => (
                          <tr key={t.name} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                            <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2 font-mono font-bold">{t.name}</td>
                            <td className="px-4 py-2 text-indigo-300">{t.total_size}</td>
                            <td className="px-4 py-2 text-muted-foreground">{Number(t.row_estimate ?? 0).toLocaleString()}</td>
                          </tr>
                        ))}
                        {filteredTables.length === 0 && (
                          <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">لا توجد نتائج</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
            </TabsContent>

            {/* ══════════ TASKS ══════════ */}
            <TabsContent value="tasks" className="mt-0 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{tasks.length} مهمة هندسية</p>
                <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700" onClick={() => setShowTaskForm(v => !v)}>
                  <Plus className="h-3.5 w-3.5" />مهمة جديدة
                </Button>
              </div>

              {showTaskForm && (
                <Card className="border-violet-500/20 bg-violet-900/5">
                  <CardContent className="pt-4 space-y-3">
                    <Input
                      placeholder="عنوان المهمة *"
                      value={taskForm.title}
                      onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                      className="text-sm"
                    />
                    <Textarea
                      placeholder="وصف المهمة (اختياري)"
                      value={taskForm.description}
                      onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                      rows={2}
                      className="text-sm resize-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Select value={taskForm.priority} onValueChange={v => setTaskForm(f => ({ ...f, priority: v }))}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">منخفض</SelectItem>
                          <SelectItem value="medium">متوسط</SelectItem>
                          <SelectItem value="high">مرتفع</SelectItem>
                          <SelectItem value="critical">حرج</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={taskForm.category} onValueChange={v => setTaskForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => createTaskMut.mutate()} disabled={!taskForm.title || createTaskMut.isPending}
                        className="gap-1.5 bg-violet-600 hover:bg-violet-700">
                        <Send className="h-3.5 w-3.5" />حفظ
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowTaskForm(false)}>إلغاء</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                {tasks.length === 0
                  ? <div className="text-center py-12 text-muted-foreground text-sm">لا توجد مهام بعد — أضف مهمتك الأولى</div>
                  : tasks.map((task: any) => (
                    <Card key={task.id} className="border-white/5">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold ${PRIORITY_COLORS[task.priority] ?? "text-muted-foreground"}`}>
                                {task.priority?.toUpperCase()}
                              </span>
                              <Badge className={`text-[10px] px-2 ${STATUS_COLORS[task.status] ?? STATUS_COLORS.pending}`}>
                                {task.status === "pending" ? "قيد الانتظار" : task.status === "running" ? "جاري" : task.status === "done" ? "مكتمل" : "فشل"}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {CATEGORIES.find(c => c.value === task.category)?.label ?? task.category}
                              </span>
                            </div>
                            <p className="text-sm font-medium">{task.title}</p>
                            {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {task.status !== "done" && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-emerald-400"
                                onClick={() => updateTaskMut.mutate({ id: task.id, status: "done" })}>
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {task.status !== "running" && task.status !== "done" && (
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-400"
                                onClick={() => updateTaskMut.mutate({ id: task.id, status: "running" })}>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400/60 hover:text-red-400"
                              onClick={() => deleteTaskMut.mutate(task.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          {new Date(task.created_at).toLocaleDateString("ar-EG")}
                          {task.completed_at && ` — اكتمل: ${new Date(task.completed_at).toLocaleDateString("ar-EG")}`}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                }
              </div>
            </TabsContent>

            {/* ══════════ LOGS ══════════ */}
            <TabsContent value="logs" className="mt-0 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{logs.length} سجل عملية</p>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => refetchLogs()}>
                  <RefreshCw className="h-3.5 w-3.5" />تحديث
                </Button>
              </div>
              <div className="space-y-1.5">
                {logs.length === 0
                  ? <div className="text-center py-12 text-muted-foreground text-sm">لا توجد سجلات بعد</div>
                  : logs.map((log: any) => (
                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/1 text-xs">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-violet-300 w-32 shrink-0">{log.action}</span>
                      <span className="flex-1 text-muted-foreground truncate font-mono text-[10px]">
                        {JSON.stringify(log.details)}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {new Date(log.created_at).toLocaleString("ar")}
                      </span>
                    </div>
                  ))
                }
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </div>
    </Layout>
  );
}
