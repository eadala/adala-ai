import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bot, Send, Zap, Eye, CheckCircle2, XCircle, Loader2,
  Briefcase, Scale, DollarSign, Users, ShieldCheck, Cpu,
  Gavel, FileText, Receipt, CalendarPlus, UserPlus, List,
  Clock, History, Trash2, Plus, Sparkles, Terminal, RotateCcw,
  AlertTriangle, ChartBarIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";

const AI_ROLES = [
  { key: "partner", label: "الشريك الإداري", icon: Briefcase, color: "from-amber-500/20 to-amber-600/10 border-amber-500/30 text-amber-400" },
  { key: "lawyer",  label: "المحامي",          icon: Scale,     color: "from-blue-500/20  to-blue-600/10  border-blue-500/30  text-blue-400" },
  { key: "finance", label: "المالي",            icon: DollarSign,color: "from-green-500/20 to-green-600/10 border-green-500/30 text-green-400" },
  { key: "hr",      label: "الموارد البشرية",   icon: Users,     color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400" },
  { key: "comply",  label: "الامتثال",          icon: ShieldCheck,color:"from-rose-500/20  to-rose-600/10  border-rose-500/30  text-rose-400" },
] as const;

const QUICK_CMDS = [
  { group: "القضايا", items: [
    { label: "القضايا النشطة",    icon: List,        cmd: "اعرض قائمة القضايا النشطة" },
    { label: "قضية جديدة",        icon: Gavel,       cmd: "أنشئ قضية جديدة" },
    { label: "أغلق قضية",         icon: XCircle,     cmd: "أغلق قضية" },
  ]},
  { group: "العملاء", items: [
    { label: "قائمة العملاء",     icon: Users,       cmd: "اعرض قائمة العملاء" },
    { label: "عميل جديد",         icon: UserPlus,    cmd: "أضف عميلاً جديداً" },
  ]},
  { group: "الفواتير", items: [
    { label: "الفواتير المتأخرة", icon: AlertTriangle, cmd: "اعرض الفواتير المتأخرة" },
    { label: "فاتورة جديدة",      icon: Receipt,     cmd: "أنشئ فاتورة خدمات قانونية" },
    { label: "آخر الفواتير",      icon: List,        cmd: "اعرض آخر الفواتير" },
  ]},
  { group: "تقارير وتقويم", items: [
    { label: "الإحاطة اليومية",   icon: Sparkles,    cmd: "أعطني الإحاطة اليومية" },
    { label: "جدوِّل حدثاً",       icon: CalendarPlus,cmd: "جدوِّل اجتماعاً للغد" },
    { label: "الأحداث القادمة",   icon: Clock,       cmd: "اعرض الأحداث القادمة" },
    { label: "تقرير تنفيذي",       icon: ChartBarIcon,cmd: "أنشئ تقريراً تنفيذياً شاملاً عن أداء المكتب" },
  ]},
];

const INTENT_META: Record<string, { label: string; icon: string; color: string }> = {
  create_case:          { label: "إنشاء قضية",      icon: "⚖️", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  close_case:           { label: "إغلاق قضية",       icon: "🔒", color: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  list_cases:           { label: "عرض القضايا",      icon: "📋", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  create_client:        { label: "إضافة عميل",       icon: "👤", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  list_clients:         { label: "عرض العملاء",      icon: "👥", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
  create_invoice:       { label: "إنشاء فاتورة",     icon: "🧾", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  get_overdue_invoices: { label: "فواتير متأخرة",    icon: "⚠️", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  list_invoices:        { label: "عرض الفواتير",     icon: "📄", color: "bg-green-500/10 text-green-400 border-green-500/20" },
  schedule_event:       { label: "جدولة حدث",        icon: "📅", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  list_events:          { label: "عرض الأحداث",      icon: "🗓️", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  send_reminder:        { label: "إرسال تذكير",      icon: "🔔", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  generate_report:      { label: "تقرير تنفيذي",     icon: "📊", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  get_briefing:         { label: "إحاطة يومية",      icon: "☀️", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  unknown:              { label: "غير محدد",          icon: "❓", color: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
};

type MsgEntry = {
  id: string; type: "user" | "ai"; text: string;
  intent?: string; explanation?: string; result?: any;
  success?: boolean; pending?: boolean; ts: Date; userCmd?: string;
};

type WorkflowRow = {
  id: string; name: string; description?: string;
  trigger_type: string; mode: string; is_active: boolean;
  action_type: string; run_count: number; last_run_at?: string;
};

const DEFAULT_WFS = [
  { name: "متابعة الفواتير المتأخرة يومياً",  triggerType: "daily",  actionType: "get_overdue_invoices", description: "فحص الفواتير المتأخرة يومياً",       mode: "semi_auto" },
  { name: "تقرير أداء أسبوعي",                triggerType: "weekly", actionType: "generate_report",      description: "تقرير أداء المكتب الأسبوعي",         mode: "manual" },
  { name: "إحاطة صباحية يومية",               triggerType: "daily",  actionType: "get_briefing",          description: "إحاطة يومية تلقائية عند بدء العمل", mode: "auto" },
];

function ResultData({ data, intent }: { data: any; intent?: string }) {
  if (!data) return null;

  if (intent === "get_briefing" && data.summary) {
    const s = data.summary;
    return (
      <div className="grid grid-cols-2 gap-2 mt-3">
        {[
          { label: "جلسات اليوم",     value: s.hearingsToday,   icon: "⚖️", c: "text-blue-400" },
          { label: "فواتير متأخرة",   value: s.overdueInvoices, icon: "⚠️", c: "text-red-400" },
          { label: "قضايا مفتوحة",   value: s.openCases,       icon: "📋", c: "text-amber-400" },
          { label: "عقود نشطة",       value: s.activeContracts, icon: "📝", c: "text-green-400" },
        ].map(item => (
          <div key={item.label} className="bg-background/40 rounded-lg p-2.5 border border-border/30 text-center">
            <div className="text-lg">{item.icon}</div>
            <div className={`text-xl font-bold ${item.c}`}>{item.value ?? 0}</div>
            <div className="text-[10px] text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
    );
  }

  if (intent === "generate_report" && data.report) {
    return (
      <div className="mt-3 p-3 bg-background/40 rounded-lg border border-border/30 text-xs leading-relaxed whitespace-pre-line text-muted-foreground max-h-48 overflow-y-auto">
        {data.report}
      </div>
    );
  }

  if (Array.isArray(data) && data.length > 0) {
    return (
      <div className="mt-3 space-y-1.5">
        {data.slice(0, 5).map((row: any, i) => (
          <div key={i} className="flex items-center gap-2 bg-background/40 rounded-lg px-2.5 py-2 border border-border/20 text-xs">
            <span className="text-primary font-medium truncate flex-1">
              {row.title || row.full_name || row.invoice_number || row.name || "—"}
            </span>
            {(row.status || row.event_type) && (
              <Badge variant="outline" className="text-[10px] shrink-0">{row.status || row.event_type}</Badge>
            )}
            {row.total != null && (
              <span className="text-green-400 shrink-0 font-mono">{Number(row.total).toLocaleString()} ر</span>
            )}
          </div>
        ))}
        {data.length > 5 && (
          <p className="text-[10px] text-muted-foreground/50 text-center">+ {data.length - 5} نتيجة أخرى</p>
        )}
      </div>
    );
  }
  return null;
}

export default function CommandCenter() {
  const { user } = useUser();
  const { toast } = useToast();
  const [msgs, setMsgs] = useState<MsgEntry[]>([]);
  const [input, setInput] = useState("");
  const [role, setRole] = useState("partner");
  const [autoExec, setAutoExec] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const { data: workflows = [], refetch: refetchWf } = useQuery<WorkflowRow[]>({
    queryKey: ["ai-workflows"],
    queryFn: () => fetch(`${BASE}api/ai-agent/workflows`).then(r => r.json()),
  });

  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["ai-agent-logs"],
    queryFn: () => fetch(`${BASE}api/ai-agent/logs?limit=20`).then(r => r.json()),
    refetchInterval: 15_000,
  });

  const execMut = useMutation({
    mutationFn: (body: { command: string; mode: string }) =>
      fetch(`${BASE}api/ai-agent/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, userEmail: user?.primaryEmailAddress?.emailAddress }),
      }).then(r => r.json()),
  });

  const toggleWf = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) =>
      fetch(`${BASE}api/ai-agent/workflows/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: v }),
      }).then(r => r.json()),
    onSuccess: () => refetchWf(),
  });

  const deleteWf = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}api/ai-agent/workflows/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => refetchWf(),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function sendCommand(cmd: string, direct = false) {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const userMsg: MsgEntry = { id: crypto.randomUUID(), type: "user", text: trimmed, ts: new Date() };
    const aiId = crypto.randomUUID();
    const aiMsg: MsgEntry = { id: aiId, type: "ai", text: "", pending: true, ts: new Date(), userCmd: trimmed };
    setMsgs(p => [...p, userMsg, aiMsg]);
    setInput("");

    const mode = (direct || autoExec) ? "execute" : "preview";
    try {
      const res = await execMut.mutateAsync({ command: trimmed, mode });
      if (mode === "preview") {
        setMsgs(p => p.map(m => m.id === aiId ? {
          ...m, pending: false, text: res.explanation || "هذا ما سأقوم بتنفيذه...",
          intent: res.intent, result: { _preview: true, params: res.params, confidence: res.confidence },
        } : m));
      } else {
        setMsgs(p => p.map(m => m.id === aiId ? {
          ...m, pending: false, text: res.message || res.explanation || "تم التنفيذ",
          intent: res.intent, success: res.success, result: res.data,
        } : m));
        if (res.success) toast({ title: "✅ تم التنفيذ", description: res.message });
      }
    } catch {
      setMsgs(p => p.map(m => m.id === aiId ? { ...m, pending: false, text: "حدث خطأ في الاتصال", success: false } : m));
    }
  }

  async function confirmExecute(userCmd: string, aiId: string) {
    setMsgs(p => p.map(m => m.id === aiId ? { ...m, pending: true, text: "جاري التنفيذ...", result: undefined } : m));
    try {
      const res = await execMut.mutateAsync({ command: userCmd, mode: "execute" });
      setMsgs(p => p.map(m => m.id === aiId ? {
        ...m, pending: false, text: res.message || "تم التنفيذ",
        intent: res.intent, success: res.success, result: res.data,
      } : m));
      if (res.success) toast({ title: "✅ تم التنفيذ", description: res.message });
    } catch {
      setMsgs(p => p.map(m => m.id === aiId ? { ...m, pending: false, text: "حدث خطأ", success: false } : m));
    }
  }

  async function createDefaults() {
    for (const wf of DEFAULT_WFS) {
      await fetch(`${BASE}api/ai-agent/workflows`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...wf, createdBy: user?.primaryEmailAddress?.emailAddress }),
      });
    }
    await refetchWf();
    toast({ title: "✅ تم إنشاء المهام الآلية الافتراضية" });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-7xl gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              مركز الأوامر التنفيذي
              <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">AI وكيل تنفيذي</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">اكتب أمرك بالعربية — الذكاء الاصطناعي ينفّذه مباشرة</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-1.5 border border-border/30">
            <Switch id="auto" checked={autoExec} onCheckedChange={setAutoExec} className="scale-75" />
            <Label htmlFor="auto" className="text-xs cursor-pointer select-none">
              {autoExec ? <span className="text-green-400">تنفيذ فوري ✓</span> : <span className="text-muted-foreground">مع معاينة</span>}
            </Label>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setMsgs([])}>
            <RotateCcw className="h-3.5 w-3.5" />مسح
          </Button>
        </div>
      </div>

      {/* Role Selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {AI_ROLES.map(r => {
          const Icon = r.icon;
          return (
            <button key={r.key} onClick={() => setRole(r.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                role === r.key
                  ? `bg-gradient-to-r ${r.color}`
                  : "bg-muted/20 border-border/30 text-muted-foreground hover:border-border"
              )}>
              <Icon className="h-3.5 w-3.5" />{r.label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Quick Commands Sidebar */}
        <div className="w-52 shrink-0 hidden lg:flex flex-col gap-2">
          <p className="text-[11px] text-muted-foreground font-medium px-1">أوامر سريعة</p>
          <ScrollArea className="flex-1">
            <div className="space-y-4 pl-1">
              {QUICK_CMDS.map(grp => (
                <div key={grp.group}>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1.5">{grp.group}</p>
                  {grp.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <button key={item.label} onClick={() => sendCommand(item.cmd, autoExec)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-right hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors mb-1 border border-transparent hover:border-border/30">
                        <Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 gap-3">
          <ScrollArea className="flex-1 rounded-xl border border-border/30 bg-muted/5">
            <div className="p-4 space-y-4">
              {msgs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                    <Terminal className="h-10 w-10 text-primary/30" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground">الوكيل التنفيذي الذكي جاهز</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">
                      اكتب أمراً مثل: "أنشئ قضية جديدة للعميل أحمد الزهراني"
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                    {["أعطني الإحاطة اليومية", "اعرض الفواتير المتأخرة", "اعرض القضايا النشطة", "أنشئ تقريراً تنفيذياً"].map(s => (
                      <button key={s} onClick={() => sendCommand(s, autoExec)}
                        className="text-xs px-3 py-1.5 rounded-full border border-primary/20 text-primary/70 hover:bg-primary/5 hover:text-primary transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {msgs.map((msg, idx) => {
                const prev = msg.type === "ai" && idx > 0 ? msgs[idx - 1] : null;
                const im = msg.intent ? INTENT_META[msg.intent] ?? INTENT_META.unknown : null;
                const isPreview = msg.result?._preview;
                return (
                  <div key={msg.id} className={cn("flex gap-3", msg.type === "user" ? "flex-row-reverse" : "flex-row")}>
                    <div className={cn("shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                      msg.type === "user"
                        ? "bg-primary/10 border border-primary/20 text-primary text-xs"
                        : "bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20")}>
                      {msg.type === "user" ? (user?.firstName?.[0] ?? "أ") : <Cpu className="h-4 w-4 text-amber-400" />}
                    </div>
                    <div className={cn("flex-1 max-w-[88%]", msg.type === "user" && "flex flex-col items-end")}>
                      <div className={cn("rounded-xl px-4 py-3 text-sm",
                        msg.type === "user"
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-muted/30 border border-border/30")}>
                        {msg.pending ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span className="text-xs">الوكيل الذكي يعالج الأمر...</span>
                          </div>
                        ) : (
                          <>
                            {im && (
                              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                <Badge variant="outline" className={cn("text-[10px] gap-1", im.color)}>
                                  {im.icon} {im.label}
                                </Badge>
                                {msg.success === true  && <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/20 bg-green-500/5">✅ منفّذ</Badge>}
                                {msg.success === false && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/20 bg-red-500/5">❌ فشل</Badge>}
                                {isPreview && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/20 bg-amber-500/5">👁 معاينة</Badge>}
                              </div>
                            )}
                            <p className="text-sm leading-relaxed">{msg.text}</p>
                            <ResultData data={msg.result} intent={msg.intent} />
                            {isPreview && prev && (
                              <div className="flex gap-2 mt-3 pt-3 border-t border-border/20">
                                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => confirmExecute(prev.text, msg.id)}>
                                  <Zap className="h-3 w-3" />تنفيذ الآن
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                                  onClick={() => setMsgs(p => p.filter(m => m.id !== msg.id))}>
                                  إلغاء
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/40 mt-1 px-1">
                        {msg.ts.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="relative">
            <Textarea ref={textRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCommand(input); } }}
              placeholder="اكتب أمرك هنا... مثال: أنشئ قضية نزاع عقاري للعميل خالد العمري"
              className="resize-none h-20 pl-28 bg-muted/20 border-border/40 focus:border-primary/40 text-sm" />
            <div className="absolute left-2 bottom-2 flex gap-1.5">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 px-2.5"
                onClick={() => sendCommand(input)} disabled={!input.trim() || execMut.isPending}>
                <Eye className="h-3.5 w-3.5" />معاينة
              </Button>
              <Button size="sm" className="h-8 text-xs gap-1.5 px-3"
                onClick={() => sendCommand(input, true)} disabled={!input.trim() || execMut.isPending}>
                {execMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                تنفيذ
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/40 text-center">
            Enter = معاينة قبل التنفيذ · زر "تنفيذ" = تنفيذ مباشر
          </p>
        </div>

        {/* Right Panel */}
        <div className="w-64 shrink-0 hidden xl:flex flex-col gap-3">
          <Tabs defaultValue="workflows" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-2 h-8 shrink-0">
              <TabsTrigger value="workflows" className="text-xs">المهام الآلية</TabsTrigger>
              <TabsTrigger value="logs"      className="text-xs">سجل التنفيذ</TabsTrigger>
            </TabsList>

            <TabsContent value="workflows" className="flex-1 flex flex-col gap-2 mt-2 min-h-0">
              <div className="flex items-center justify-between shrink-0">
                <p className="text-[11px] text-muted-foreground font-medium">مهام تعمل تلقائياً</p>
                {workflows.length === 0 && (
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={createDefaults}>
                    <Plus className="h-3 w-3 ml-1" />افتراضية
                  </Button>
                )}
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {workflows.map(wf => (
                    <div key={wf.id} className="p-2.5 rounded-lg border border-border/30 bg-muted/10 group">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium leading-tight">{wf.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {wf.trigger_type === "daily" ? "يومي" : wf.trigger_type === "weekly" ? "أسبوعي" : "يدوي"}
                            {" · "}
                            {wf.mode === "auto" ? "تلقائي" : wf.mode === "semi_auto" ? "شبه تلقائي" : "يدوي"}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Switch checked={wf.is_active} onCheckedChange={v => toggleWf.mutate({ id: wf.id, v })} className="scale-[0.65] origin-right" />
                          <button onClick={() => deleteWf.mutate(wf.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {wf.is_active && <div className="flex items-center gap-1 mt-1.5"><div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /><span className="text-[10px] text-green-400">نشط</span></div>}
                    </div>
                  ))}
                  {workflows.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground/40">
                      <Cpu className="h-6 w-6 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">لا توجد مهام آلية</p>
                      <p className="text-[10px] mt-1">اضغط "افتراضية" لإضافة 3 مهام جاهزة</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="logs" className="flex-1 mt-2 min-h-0">
              <ScrollArea className="h-full">
                <div className="space-y-1.5">
                  {logs.slice(0, 15).map((log: any) => {
                    const im = INTENT_META[log.intent] ?? INTENT_META.unknown;
                    return (
                      <div key={log.id} className="p-2 rounded-lg bg-muted/10 border border-border/20">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", log.success ? "bg-green-400" : "bg-red-400")} />
                          <span className="text-[9px] text-muted-foreground">{im.icon} {im.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{log.command}</p>
                        <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                          {new Date(log.created_at).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    );
                  })}
                  {logs.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground/40">
                      <History className="h-5 w-5 mx-auto mb-1 opacity-30" />
                      <p className="text-xs">لا يوجد سجل بعد</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
