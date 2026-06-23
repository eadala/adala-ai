/**
 * Case Detail — Control Center
 * ─────────────────────────────
 * Layout: Header → Action Bar → [Feed | Sidebar]
 * No tabs — كل شيء في صفحة واحدة
 */

import { useState, useEffect, useRef } from "react";
import { useGetCase, getGetCaseQueryKey, useUpdateCase } from "@workspace/api-client-react";
import { useQuery, useQueryClient }                       from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle }       from "@/components/ui/card";
import { Button }                                          from "@/components/ui/button";
import { Badge }                                           from "@/components/ui/badge";
import { Skeleton }                                        from "@/components/ui/skeleton";
import { Input }                                           from "@/components/ui/input";
import { Label }                                           from "@/components/ui/label";
import { Textarea }                                        from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowRight, Plus, MessageSquare, Bot, User, Clock,
  FileText, CalendarDays, CheckCheck, CheckSquare, Circle,
  Loader2, Send, History, Receipt, AlertTriangle,
  Sparkles, Shield, TrendingUp, ChevronRight, Scale,
  Paperclip, Zap, X, ListTodo,
  Brain, ThumbsUp, ThumbsDown, ShieldAlert, Lightbulb,
  BellRing, CheckCircle2, XCircle, RefreshCw,
  Gavel, MapPin, Hash, Building2, Edit3, Trash2, GanttChartSquare,
  FolderOpen, Upload, Download, ImageIcon, FileIcon,
} from "lucide-react";
import { useUser } from "@clerk/react";
import { Link }           from "wouter";
import SmartDocumentsTab  from "@/components/smart-documents-tab";
import { useToast }       from "@/hooks/use-toast";
import { useLang }        from "@/hooks/use-lang";
import { cn }             from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ══════════════════ CONSTANTS ══════════════════ */
const STATUS_CFG: Record<string, { label: string; bg: string; dot: string }> = {
  open:        { label: "مفتوحة",       bg: "bg-blue-50 text-blue-700 border-blue-200",   dot: "bg-blue-500"   },
  in_progress: { label: "قيد التنفيذ",  bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500"  },
  closed:      { label: "مغلقة",        bg: "bg-muted/50 text-muted-foreground border-border", dot: "bg-slate-400"  },
};
const TYPE_MAP: Record<string, string> = {
  criminal: "جنائية", civil: "مدنية", commercial: "تجارية",
  labor: "عمالية", real_estate: "عقارية",
};
const ENTRY_ICON: Record<string, any> = {
  hearing: CalendarDays, note: FileText, document: Paperclip,
  decision: CheckCheck, consultation: MessageSquare,
};
const ENTRY_COLOR: Record<string, string> = {
  hearing:      "bg-blue-100 text-blue-700 border-blue-200",
  note:         "bg-muted/50 text-muted-foreground border-border",
  document:     "bg-violet-100 text-violet-700 border-violet-200",
  decision:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  consultation: "bg-amber-100 text-amber-700 border-amber-200",
};
const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-600", B: "text-blue-600",
  C: "text-amber-600",   D: "text-orange-600", F: "text-red-600",
};
const PRIORITY_DOT: Record<string, string> = {
  high: "bg-red-500", medium: "bg-amber-400", low: "bg-slate-300",
};

/* ══════════════════ HOOKS ══════════════════ */
function useApi<T>(key: any[], url: string) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => fetch(`${BASE}${url}`).then(r => r.json()),
    enabled: !url.includes("undefined"),
    staleTime: 30_000,
  });
}

/* ══════════════════ SCORE RING ══════════════════ */
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 22, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const col = score >= 70 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={60} height={60} viewBox="0 0 56 56">
      <circle cx={28} cy={28} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle cx={28} cy={28} r={r} fill="none" stroke={col} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 28 28)" />
      <text x={28} y={32} textAnchor="middle" fontSize={13} fontWeight={700} fill={col}>{score}</text>
    </svg>
  );
}

/* ══════════════════ ACTION BAR ══════════════════ */
function ActionBar({
  onTask, onMessage, onTimeline, onAI, onHearing, onDocument, onClose,
  status, closing,
}: {
  onTask: () => void; onMessage: () => void; onTimeline: () => void;
  onAI: () => void; onHearing: () => void; onDocument: () => void; onClose: () => void;
  status: string; closing: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-xl border">
      <Button size="sm" onClick={onTask} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />مهمة
      </Button>
      <Button size="sm" variant="outline" onClick={onHearing} className="gap-1.5">
        <Gavel className="h-3.5 w-3.5" />جلسة
      </Button>
      <Button size="sm" variant="outline" onClick={onDocument} className="gap-1.5">
        <Paperclip className="h-3.5 w-3.5" />مستند
      </Button>
      <Button size="sm" variant="outline" onClick={onMessage} className="gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" />رسالة
      </Button>
      <Button size="sm" variant="outline" onClick={onTimeline} className="gap-1.5">
        <History className="h-3.5 w-3.5" />قيد جديد
      </Button>
      <Button size="sm" variant="outline" onClick={onAI} className="gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />تحليل AI
      </Button>
      {status !== "closed" && (
        <Button size="sm" variant="destructive" onClick={onClose} disabled={closing} className="gap-1.5 ms-auto">
          {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          إغلاق القضية
        </Button>
      )}
    </div>
  );
}

/* ══════════════════ TIMELINE FEED ══════════════════ */
function TimelineFeed({ caseId, open, setOpen }: { caseId: string; open: boolean; setOpen: (v: boolean) => void }) {
  const { data: entries = [], refetch } = useApi<any[]>(["case-timeline", caseId], `/api/cases/${caseId}/timeline`);
  const [form, setForm]   = useState({ entry_type: "note", title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const add = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch(`${BASE}/api/cases/${caseId}/timeline`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ entry_type: "note", title: "", description: "" });
      refetch();
      toast({ title: "✅ تمت الإضافة" });
    } catch { toast({ variant: "destructive", title: "خطأ" }); }
    setSaving(false);
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />السجل الزمني
        </CardTitle>
        <span className="text-xs text-muted-foreground">{entries.length} قيد</span>
      </CardHeader>
      <CardContent className="space-y-0 pt-0">
        {entries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <History className="h-8 w-8 mx-auto mb-2 opacity-20" />لا يوجد سجل بعد
          </div>
        )}
        <div className="relative">
          {entries.length > 0 && (
            <div className="absolute start-[18px] top-0 bottom-0 w-px bg-border" />
          )}
          <div className="space-y-3">
            {entries.map((e: any) => {
              const Icon = ENTRY_ICON[e.entry_type] ?? Circle;
              const col  = ENTRY_COLOR[e.entry_type] ?? "bg-muted/50 text-muted-foreground border-border";
              return (
                <div key={e.id} className="flex gap-3 relative">
                  <div className={cn("w-9 h-9 rounded-full border flex items-center justify-center z-10 shrink-0", col)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 bg-muted/20 rounded-xl px-3 py-2.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug">{e.title}</p>
                      <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                        {e.happened_at ? new Date(e.happened_at).toLocaleDateString("ar-SA") : ""}
                      </span>
                    </div>
                    {e.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{e.description}</p>}
                    {e.created_by && <p className="text-xs text-muted-foreground/60 mt-1">{e.created_by}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>

      {/* Add timeline dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة قيد للسجل</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={form.entry_type} onValueChange={v => setForm(p => ({ ...p, entry_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hearing">جلسة محكمة</SelectItem>
                  <SelectItem value="note">ملاحظة قانونية</SelectItem>
                  <SelectItem value="document">رفع مستند</SelectItem>
                  <SelectItem value="decision">قرار</SelectItem>
                  <SelectItem value="consultation">استشارة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الوصف *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="ما الذي حدث؟" />
            </div>
            <div className="space-y-1.5">
              <Label>تفاصيل إضافية</Label>
              <Textarea rows={3} className="resize-none" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={add} disabled={saving || !form.title.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ══════════════════ MESSAGES CHAT ══════════════════ */
function MessagesChat({ caseId, open, setOpen }: { caseId: string; open: boolean; setOpen: (v: boolean) => void }) {
  const { data: msgs = [], refetch } = useApi<any[]>(["case-msgs", caseId], `/api/cases/${caseId}/messages`);
  const [body, setBody]     = useState("");
  const [sending, setSending] = useState(false);
  const endRef              = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await fetch(`${BASE}/api/cases/${caseId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, sender_name: "المحامي" }),
      });
      setBody("");
      refetch();
    } catch { toast({ variant: "destructive", title: "فشل الإرسال" }); }
    setSending(false);
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />مراسلات الفريق
        </CardTitle>
        <span className="text-xs text-muted-foreground">{msgs.length} رسالة</span>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Message thread */}
        <div className="max-h-64 overflow-y-auto space-y-2 ps-1">
          {msgs.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <MessageSquare className="h-6 w-6 mx-auto mb-1.5 opacity-20" />لا توجد رسائل بعد
            </div>
          )}
          {msgs.map((m: any) => (
            <div key={m.id} className="flex gap-2.5 group">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-semibold">{m.sender_name ?? "المحامي"}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.created_at ? new Date(m.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
                <div className="bg-muted/50 rounded-xl rounded-ss-none px-3 py-2 text-sm">{m.body}</div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* Compose — visible when dialog open or as expand */}
        <div className="flex gap-2 border-t pt-3">
          <Input
            className="flex-1 text-sm h-9"
            placeholder="اكتب رسالة للفريق... (Enter للإرسال)"
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
          />
          <Button size="sm" onClick={send} disabled={sending || !body.trim()} className="h-9 px-3">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ══════════════════ SIDEBAR CARDS ══════════════════ */

/* Case info */
function InfoCard({ c }: { c: any }) {
  const s = STATUS_CFG[c.status] ?? STATUS_CFG.open;
  const rows = [
    { icon: User,        label: "الموكل",       val: c.clientName ?? "—" },
    { icon: Scale,       label: "المحامي",       val: c.assignedTo ?? "—" },
    { icon: FileText,    label: "نوع القضية",    val: TYPE_MAP[c.caseType] ?? c.caseType },
    { icon: Clock,       label: "تاريخ الإنشاء", val: c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-SA") : "—" },
  ];
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4 space-y-3">
        {/* Status pill */}
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", s.dot)} />
          <Badge variant="outline" className={cn("text-xs", s.bg)}>{s.label}</Badge>
        </div>
        <div className="space-y-2.5">
          {rows.map(({ icon: Icon, label, val }) => (
            <div key={label} className="flex items-center gap-2.5">
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs font-medium ms-auto text-end max-w-[140px] truncate">{val}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* AI Health mini */
function AIHealthCard({ caseId, onAnalyze }: { caseId: string; onAnalyze: () => void }) {
  const { data, isLoading, refetch } = useApi<any>(
    ["case-health", caseId],
    `/api/cases/${caseId}/health`,
  );
  const [running, setRunning] = useState(false);
  const { toast } = useToast();

  const analyze = async () => {
    setRunning(true);
    try {
      await fetch(`${BASE}/api/cases/${caseId}/autopilot`, { method: "POST" });
      refetch();
      toast({ title: "✅ اكتمل التحليل" });
    } catch { toast({ variant: "destructive", title: "خطأ في التحليل" }); }
    setRunning(false);
  };

  return (
    <Card className="border shadow-sm bg-gradient-to-br from-background to-primary/3">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5 text-primary" />تحليل AI Autopilot
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {isLoading && <Skeleton className="h-12 w-full rounded-lg" />}
        {!isLoading && data && (
          <>
            <div className="flex items-center gap-3">
              <ScoreRing score={data.healthScore ?? 0} grade={data.grade ?? "C"} />
              <div>
                <p className="text-xs text-muted-foreground">درجة الصحة</p>
                <p className={cn("text-2xl font-bold", GRADE_COLOR[data.grade] ?? "text-foreground")}>
                  {data.grade}
                </p>
                {data.outcomePrediction?.successProbability != null && (
                  <p className="text-xs text-muted-foreground">
                    نجاح: <span className="font-medium text-foreground">{data.outcomePrediction.successProbability}%</span>
                  </p>
                )}
              </div>
            </div>
            {(data.risks ?? []).slice(0, 2).map((r: string, i: number) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />{r}
              </div>
            ))}
          </>
        )}
        {!isLoading && !data && (
          <p className="text-xs text-muted-foreground text-center py-2">لم يتم التحليل بعد</p>
        )}
        <Button size="sm" variant="outline" onClick={analyze} disabled={running} className="w-full text-xs h-7">
          {running ? <Loader2 className="h-3 w-3 animate-spin me-1" /> : <Zap className="h-3 w-3 me-1" />}
          {data ? "إعادة التحليل" : "تحليل الآن"}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════
   AUTONOMOUS AI PANEL
══════════════════════════════════════════════════════ */
const ACTION_TYPE_LABEL: Record<string, string> = {
  CREATE_TASK:       "مهمة جديدة",
  REQUEST_DOCUMENT:  "طلب مستند",
  SCHEDULE_HEARING:  "جدولة جلسة",
  SEND_MESSAGE:      "إرسال رسالة",
  ALERT_ONLY:        "تنبيه",
};
const PRIORITY_BADGE: Record<string, string> = {
  high:   "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-muted/30 text-muted-foreground border-border",
};
const PRIORITY_LABEL: Record<string, string> = {
  high: "عالية", medium: "متوسطة", low: "منخفضة",
};

function AutonomousAIPanel({ caseId }: { caseId: string }) {
  const { toast }                        = useToast();
  const qc                               = useQueryClient();
  const [running, setRunning]            = useState(false);
  const [approving, setApproving]        = useState<string | null>(null);
  const [rejecting, setRejecting]        = useState<string | null>(null);
  const [expanded, setExpanded]          = useState(true);

  const { data: insight, refetch } = useApi<any>(
    ["case-ai-insights", caseId],
    `/api/cases/${caseId}/ai-insights`,
  );

  const analyze = async () => {
    setRunning(true);
    try {
      const r = await fetch(`${BASE}/api/cases/${caseId}/analyze`, { method: "POST" });
      if (!r.ok) throw new Error("فشل التحليل");
      await refetch();
      toast({ title: "✅ اكتمل التحليل الذكي" });
    } catch {
      toast({ variant: "destructive", title: "خطأ أثناء التحليل" });
    }
    setRunning(false);
  };

  const approveTask = async (taskId: string) => {
    if (!insight?.id) return;
    setApproving(taskId);
    try {
      const r = await fetch(`${BASE}/api/cases/${caseId}/ai-insights/approve-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId: insight.id, taskId }),
      });
      if (!r.ok) throw new Error();
      await refetch();
      qc.invalidateQueries({ queryKey: ["case-tasks", caseId] });
      toast({ title: "✅ تمت الموافقة وإنشاء المهمة" });
    } catch {
      toast({ variant: "destructive", title: "خطأ في الموافقة" });
    }
    setApproving(null);
  };

  const rejectTask = async (taskId: string) => {
    if (!insight?.id) return;
    setRejecting(taskId);
    try {
      await fetch(`${BASE}/api/cases/${caseId}/ai-insights/reject-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId: insight.id, taskId }),
      });
      await refetch();
      toast({ title: "تم رفض الاقتراح" });
    } catch {
      toast({ variant: "destructive", title: "خطأ" });
    }
    setRejecting(null);
  };

  const risks       = insight?.risks       ?? [];
  const suggestions = insight?.suggestions ?? [];
  const alerts      = insight?.alerts      ?? [];
  const autoTasks   = (insight?.auto_tasks ?? []) as any[];
  const pending     = autoTasks.filter((t: any) => t.status === "pending_approval");

  return (
    <Card className="border shadow-sm overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-2 bg-gradient-to-l from-violet-50 to-background">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-violet-600" />
            المساعد القانوني الذكي
            {pending.length > 0 && (
              <Badge className="text-xs h-4 px-1.5 rounded-full bg-amber-100 text-amber-700 border-amber-200 border">
                {pending.length}
              </Badge>
            )}
          </CardTitle>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-2 space-y-3">
          {/* No data yet */}
          {!insight && (
            <div className="text-center py-4 space-y-2">
              <Brain className="h-8 w-8 text-violet-200 mx-auto" />
              <p className="text-xs text-muted-foreground">لم يتم التحليل بعد</p>
              <p className="text-xs text-muted-foreground/70">اضغط التحليل لتشغيل المساعد الذكي</p>
            </div>
          )}

          {insight && (
            <>
              {/* Alerts — urgent */}
              {alerts.length > 0 && (
                <div className="space-y-1.5">
                  {alerts.map((a: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg px-2.5 py-2">
                      <BellRing className="h-3 w-3 shrink-0 mt-0.5" />
                      <span>{a}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Risks */}
              {risks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-amber-600" />المخاطر
                  </p>
                  <div className="space-y-1">
                    {risks.map((r: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Lightbulb className="h-3 w-3 text-blue-500" />الاقتراحات
                  </p>
                  <div className="space-y-1">
                    {suggestions.map((s: string, i: number) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1.5">
                        <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-blue-400" />
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto-tasks requiring approval */}
              {autoTasks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-violet-500" />
                    الإجراءات المقترحة
                  </p>
                  <div className="space-y-2">
                    {autoTasks.map((t: any) => (
                      <div
                        key={t.id}
                        className={cn(
                          "rounded-lg border px-2.5 py-2 text-xs space-y-1.5 transition-all",
                          t.status === "pending_approval" && "bg-violet-50 border-violet-200",
                          t.status === "approved"         && "bg-emerald-50 border-emerald-200 opacity-70",
                          t.status === "rejected"         && "bg-muted/30 border-border opacity-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="font-medium text-foreground">{t.title}</span>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <Badge variant="outline" className={cn("text-xs h-4 px-1.5", PRIORITY_BADGE[t.priority] ?? "")}>
                                {PRIORITY_LABEL[t.priority] ?? t.priority}
                              </Badge>
                              <span className="text-muted-foreground text-xs">
                                {ACTION_TYPE_LABEL[t.type] ?? t.type}
                              </span>
                            </div>
                          </div>
                          {t.status === "approved" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                          {t.status === "rejected" && <XCircle     className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                        </div>

                        {t.description && (
                          <p className="text-muted-foreground text-xs">{t.description}</p>
                        )}

                        {t.status === "pending_approval" && (
                          <div className="flex gap-1.5 pt-0.5">
                            <Button
                              size="sm"
                              className="h-6 text-xs flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                              onClick={() => approveTask(t.id)}
                              disabled={!!approving}
                            >
                              {approving === t.id
                                ? <Loader2 className="h-3 w-3 animate-spin me-1" />
                                : <ThumbsUp className="h-3 w-3 me-1" />}
                              موافقة
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs flex-1 border-border text-muted-foreground hover:text-red-600"
                              onClick={() => rejectTask(t.id)}
                              disabled={!!rejecting}
                            >
                              {rejecting === t.id
                                ? <Loader2 className="h-3 w-3 animate-spin me-1" />
                                : <ThumbsDown className="h-3 w-3 me-1" />}
                              رفض
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              {insight.created_at && (
                <p className="text-xs text-muted-foreground/50 text-center">
                  آخر تحليل: {new Date(insight.created_at).toLocaleDateString("ar-SA")}
                </p>
              )}
            </>
          )}

          {/* Analyze button */}
          <Button
            size="sm"
            onClick={analyze}
            disabled={running}
            className="w-full text-xs h-7 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {running
              ? <><Loader2 className="h-3 w-3 animate-spin me-1" />جارِ التحليل...</>
              : <><RefreshCw className="h-3 w-3 me-1" />{insight ? "تحديث التحليل" : "تحليل بالذكاء الاصطناعي"}</>
            }
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

/* Tasks mini */
function TasksMini({ caseId, onAdd }: { caseId: string; onAdd: () => void }) {
  const { data: tasks = [], refetch } = useApi<any[]>(["case-tasks", caseId], `/api/cases/${caseId}/tasks`);
  const pending = tasks.filter((t: any) => t.status !== "done");

  const toggle = async (id: string, cur: string) => {
    const next = cur === "done" ? "todo" : "done";
    await fetch(`${BASE}/api/office-tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => {});
    refetch();
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <ListTodo className="h-3.5 w-3.5 text-primary" />المهام
          {pending.length > 0 && (
            <Badge className="text-xs h-4 px-1.5 rounded-full bg-primary/10 text-primary border-0">{pending.length}</Badge>
          )}
        </CardTitle>
        <button onClick={onAdd} className="text-primary hover:text-primary/80 transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="pt-0 space-y-1.5">
        {tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">لا توجد مهام</p>}
        {tasks.slice(0, 5).map((t: any) => (
          <div key={t.id} className="flex items-start gap-2 group">
            <button onClick={() => toggle(t.id, t.status)} className="shrink-0 mt-0.5">
              {t.status === "done"
                ? <CheckSquare className="h-4 w-4 text-emerald-500" />
                : <Circle className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs leading-snug", t.status === "done" && "line-through text-muted-foreground")}>
                {t.title}
              </p>
              {t.due_date && (
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  📅 {new Date(t.due_date).toLocaleDateString("ar-SA")}
                </p>
              )}
            </div>
            <span className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", PRIORITY_DOT[t.priority] ?? "bg-slate-300")} />
          </div>
        ))}
        {tasks.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-1">+{tasks.length - 5} مهام أخرى</p>
        )}
      </CardContent>
    </Card>
  );
}

/* Hub mini (docs + invoices) */
function HubMini({ caseId }: { caseId: string }) {
  const { data: hub } = useApi<any>(["case-hub", caseId], `/api/cases/${caseId}/hub`);
  const docs     = hub?.documents ?? [];
  const invoices = hub?.invoices  ?? [];
  const events   = hub?.events    ?? [];
  const total    = invoices.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-primary" />ملفات &amp; فواتير
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "فواتير",  val: invoices.length,  color: "text-blue-600" },
            { label: "مستندات", val: docs.length,       color: "text-violet-600" },
            { label: "جلسات",   val: events.length,    color: "text-amber-600" },
          ].map(({ label, val, color }) => (
            <div key={label} className="text-center bg-muted/30 rounded-lg py-1.5">
              <p className={cn("text-base font-bold", color)}>{val}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Recent invoices */}
        {invoices.slice(0, 3).map((inv: any) => (
          <div key={inv.id} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate max-w-[120px]">{inv.title ?? inv.invoice_number}</span>
            <span className={cn("font-medium", inv.status === "paid" ? "text-emerald-600" : inv.status === "overdue" ? "text-red-600" : "text-foreground")}>
              {Number(inv.total ?? 0).toLocaleString("ar-SA")} ر.س
            </span>
          </div>
        ))}

        {total > 0 && (
          <div className="flex items-center justify-between text-xs border-t pt-2">
            <span className="text-muted-foreground">إجمالي الفواتير</span>
            <span className="font-semibold">{total.toLocaleString("ar-SA")} ر.س</span>
          </div>
        )}

        {/* Recent docs */}
        {docs.slice(0, 2).map((d: any) => (
          <div key={d.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3 w-3 shrink-0" />
            <span className="truncate">{d.file_name}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ══════════════════ COURT INFO CARD ══════════════════ */
const DISTRICT_TYPE: Record<string, string> = {
  appeal: "استئناف", first: "ابتدائي", summary: "جزئي", admin: "إداري",
};
function CourtInfoCard({ c, caseId, onSaved }: { c: any; caseId: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    caseNumber:   c.caseNumber   ?? "",
    courtName:    c.courtName    ?? "",
    courtCode:    c.courtCode    ?? "",
    courtCity:    c.courtCity    ?? "",
    districtNumber: String(c.courtDistrictNumber ?? ""),
    districtType:   c.courtDistrictType   ?? "",
  });
  const { toast } = useToast();

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${BASE}/api/cases/${caseId}/court`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          districtNumber: form.districtNumber ? Number(form.districtNumber) : null,
        }),
      });
      setEditing(false);
      onSaved();
      toast({ title: "✅ تم حفظ بيانات المحكمة" });
    } catch { toast({ variant: "destructive", title: "خطأ في الحفظ" }); }
    setSaving(false);
  };

  const hasData = c.courtName || c.caseNumber;
  const nextHearing = c.nextHearingDate ? new Date(c.nextHearingDate) : null;
  const daysUntil   = nextHearing ? Math.ceil((nextHearing.getTime() - Date.now()) / 86400000) : null;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-primary" />بيانات المحكمة
        </CardTitle>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditing(true)}>
          <Edit3 className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-2 text-xs">
        {!hasData && !editing && (
          <p className="text-muted-foreground text-center py-2">
            لم تُضَف بيانات المحكمة بعد
          </p>
        )}
        {hasData && !editing && (
          <div className="space-y-1.5">
            {c.caseNumber && (
              <div className="flex items-center gap-1.5">
                <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-mono font-semibold">{c.caseNumber}</span>
              </div>
            )}
            {c.courtName && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                <span>{c.courtName}</span>
                {c.courtCode && <span className="text-muted-foreground">({c.courtCode})</span>}
              </div>
            )}
            {c.courtCity && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <span>{c.courtCity}</span>
              </div>
            )}
            {(c.courtDistrictNumber || c.courtDistrictType) && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Scale className="h-3 w-3 shrink-0" />
                <span>
                  {c.courtDistrictNumber && `دائرة ${c.courtDistrictNumber}`}
                  {c.courtDistrictType && ` · ${DISTRICT_TYPE[c.courtDistrictType] ?? c.courtDistrictType}`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Next hearing badge */}
        {nextHearing && (
          <div className={cn(
            "mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium",
            daysUntil !== null && daysUntil <= 3
              ? "bg-red-50 text-red-700 border border-red-200"
              : daysUntil !== null && daysUntil <= 7
              ? "bg-amber-50 text-amber-700 border border-amber-200"
              : "bg-blue-50 text-blue-700 border border-blue-200",
          )}>
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>
              الجلسة القادمة: {nextHearing.toLocaleDateString("ar-SA")}
              {daysUntil !== null && daysUntil >= 0 && ` · بعد ${daysUntil} يوم`}
              {daysUntil !== null && daysUntil < 0 && ` · مضى ${Math.abs(daysUntil)} يوم`}
            </span>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="space-y-2 pt-1 border-t mt-2">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <Label className="text-xs">رقم القضية</Label>
                <Input className="h-7 text-xs mt-0.5" value={form.caseNumber}
                  onChange={e => setForm(p => ({ ...p, caseNumber: e.target.value }))} placeholder="1234/2025" />
              </div>
              <div>
                <Label className="text-xs">رمز المحكمة</Label>
                <Input className="h-7 text-xs mt-0.5" value={form.courtCode}
                  onChange={e => setForm(p => ({ ...p, courtCode: e.target.value }))} placeholder="BHR" />
              </div>
            </div>
            <div>
              <Label className="text-xs">اسم المحكمة</Label>
              <Input className="h-7 text-xs mt-0.5" value={form.courtName}
                onChange={e => setForm(p => ({ ...p, courtName: e.target.value }))} placeholder="محكمة الاستئناف" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <Label className="text-xs">المدينة</Label>
                <Input className="h-7 text-xs mt-0.5" value={form.courtCity}
                  onChange={e => setForm(p => ({ ...p, courtCity: e.target.value }))} placeholder="الرياض" />
              </div>
              <div>
                <Label className="text-xs">رقم الدائرة</Label>
                <Input className="h-7 text-xs mt-0.5" type="number" value={form.districtNumber}
                  onChange={e => setForm(p => ({ ...p, districtNumber: e.target.value }))} placeholder="3" />
              </div>
            </div>
            <div>
              <Label className="text-xs">نوع الدائرة</Label>
              <Select value={form.districtType || "__none__"} onValueChange={v => setForm(p => ({ ...p, districtType: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- اختر --</SelectItem>
                  <SelectItem value="appeal">استئناف</SelectItem>
                  <SelectItem value="first">ابتدائي</SelectItem>
                  <SelectItem value="summary">جزئي</SelectItem>
                  <SelectItem value="admin">إداري</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1.5 pt-1">
              <Button size="sm" className="h-7 text-xs flex-1" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "حفظ"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)}>إلغاء</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════ HEARINGS SECTION ══════════════════ */
const HEARING_STATUS: Record<string, { label: string; color: string }> = {
  scheduled:  { label: "مجدولة",  color: "bg-blue-100 text-blue-700 border-blue-200" },
  completed:  { label: "منتهية",  color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  postponed:  { label: "مؤجلة",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled:  { label: "ملغاة",   color: "bg-red-100 text-red-700 border-red-200" },
};

function HearingRow({
  h, caseId, onEdit, onDelete,
}: {
  h: any; caseId: string; onEdit: (h: any) => void; onDelete: (id: string) => void;
}) {
  const st  = HEARING_STATUS[h.status] ?? HEARING_STATUS.scheduled;
  const dt  = new Date(h.hearing_date);
  const isPast = dt < new Date();
  return (
    <div className={cn("flex items-start gap-3 p-3 rounded-xl border", isPast ? "bg-muted/20" : "bg-background")}>
      <div className="shrink-0 text-center min-w-[48px]">
        <p className="text-lg font-bold text-primary leading-none">{dt.getDate()}</p>
        <p className="text-xs text-muted-foreground">{dt.toLocaleDateString("ar-SA", { month: "short" })}</p>
        <p className="text-xs text-muted-foreground/70">{dt.getFullYear()}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", st.color)}>{st.label}</span>
          {h.court_room && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />{h.court_room}
            </span>
          )}
          <span className="text-xs text-muted-foreground ms-auto">
            {dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        {h.notes && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{h.notes}</p>}
        {h.outcome && (
          <div className="mt-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2 py-1">
            <span className="font-medium">النتيجة:</span> {h.outcome}
          </div>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(h)}>
          <Edit3 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(h.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function HearingsSection({
  caseId, addOpen, setAddOpen,
}: {
  caseId: string; addOpen: boolean; setAddOpen: (v: boolean) => void;
}) {
  const { data: hearings = [], refetch } = useApi<any[]>(["case-hearings", caseId], `/api/cases/${caseId}/hearings`);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteHearing = async (id: string) => {
    if (!confirm("حذف هذه الجلسة؟")) return;
    try {
      await fetch(`${BASE}/api/cases/${caseId}/hearings/${id}`, { method: "DELETE" });
      refetch();
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      toast({ title: "تم الحذف" });
    } catch { toast({ variant: "destructive", title: "خطأ" }); }
  };

  const upcoming = hearings.filter((h: any) => new Date(h.hearing_date) >= new Date() && h.status !== "cancelled");
  const past     = hearings.filter((h: any) => new Date(h.hearing_date) < new Date() || h.status === "cancelled");

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Gavel className="h-4 w-4 text-primary" />جلسات المحكمة
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{hearings.length} جلسة</span>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-3 w-3" />إضافة
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {hearings.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Gavel className="h-8 w-8 mx-auto mb-2 opacity-20" />لا توجد جلسات مسجلة بعد
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">القادمة</p>
            {upcoming.map((h: any) => (
              <HearingRow key={h.id} h={h} caseId={caseId} onEdit={setEditTarget} onDelete={deleteHearing} />
            ))}
          </div>
        )}

        {past.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">السابقة</p>
            {past.slice(0, 5).map((h: any) => (
              <HearingRow key={h.id} h={h} caseId={caseId} onEdit={setEditTarget} onDelete={deleteHearing} />
            ))}
            {past.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">+{past.length - 5} جلسة أخرى</p>
            )}
          </div>
        )}
      </CardContent>

      <HearingDialog
        open={addOpen || !!editTarget}
        editing={editTarget}
        caseId={caseId}
        onClose={() => { setAddOpen(false); setEditTarget(null); }}
        onSaved={() => {
          refetch();
          qc.invalidateQueries({ queryKey: ["case", caseId] });
          setAddOpen(false);
          setEditTarget(null);
        }}
      />
    </Card>
  );
}

/* ══════════════════ HEARING DIALOG ══════════════════ */
function HearingDialog({
  open, editing, caseId, onClose, onSaved,
}: {
  open: boolean; editing: any | null; caseId: string; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!editing;
  const [form, setForm] = useState({
    hearingDate: "", courtRoom: "", status: "scheduled", notes: "", outcome: "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editing) {
      const d = new Date(editing.hearing_date);
      const pad = (n: number) => String(n).padStart(2, "0");
      const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setForm({
        hearingDate: local,
        courtRoom:   editing.court_room ?? "",
        status:      editing.status ?? "scheduled",
        notes:       editing.notes  ?? "",
        outcome:     editing.outcome ?? "",
      });
    } else {
      setForm({ hearingDate: "", courtRoom: "", status: "scheduled", notes: "", outcome: "" });
    }
  }, [editing, open]);

  const save = async () => {
    if (!form.hearingDate) return;
    setSaving(true);
    try {
      const url    = isEdit
        ? `${BASE}/api/cases/${caseId}/hearings/${editing.id}`
        : `${BASE}/api/cases/${caseId}/hearings`;
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, hearingDate: new Date(form.hearingDate).toISOString() }),
      });
      if (!r.ok) throw new Error();
      toast({ title: isEdit ? "✅ تم التحديث" : "✅ تمت إضافة الجلسة" });
      onSaved();
    } catch { toast({ variant: "destructive", title: "خطأ في الحفظ" }); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            {isEdit ? "تعديل الجلسة" : "إضافة جلسة جديدة"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>تاريخ ووقت الجلسة *</Label>
            <Input type="datetime-local" value={form.hearingDate}
              onChange={e => setForm(p => ({ ...p, hearingDate: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>قاعة / دائرة</Label>
              <Input value={form.courtRoom}
                onChange={e => setForm(p => ({ ...p, courtRoom: e.target.value }))} placeholder="قاعة 5" />
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">مجدولة</SelectItem>
                  <SelectItem value="completed">منتهية</SelectItem>
                  <SelectItem value="postponed">مؤجلة</SelectItem>
                  <SelectItem value="cancelled">ملغاة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea rows={2} className="resize-none" value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="ملاحظات قبل الجلسة..." />
          </div>
          {(isEdit || form.status === "completed") && (
            <div className="space-y-1.5">
              <Label>نتيجة الجلسة</Label>
              <Textarea rows={2} className="resize-none" value={form.outcome}
                onChange={e => setForm(p => ({ ...p, outcome: e.target.value }))}
                placeholder="ما الذي تقرر في الجلسة؟" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving || !form.hearingDate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "تحديث" : "إضافة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════ DOCUMENTS SECTION ══════════════════ */

/* Helper — pick icon + color by mime type */
function DocIcon({ type }: { type: string }) {
  const t = (type ?? "").toLowerCase();
  if (t.includes("pdf"))                         return <FileText className="h-5 w-5 text-red-500" />;
  if (t.includes("image") || t.includes("png") || t.includes("jpg") || t.includes("jpeg"))
                                                 return <ImageIcon className="h-5 w-5 text-emerald-500" />;
  if (t.includes("word") || t.includes("docx") || t.includes("doc"))
                                                 return <FileText className="h-5 w-5 text-blue-500" />;
  if (t.includes("sheet") || t.includes("xlsx") || t.includes("xls") || t.includes("csv"))
                                                 return <FileText className="h-5 w-5 text-green-600" />;
  return <FileIcon className="h-5 w-5 text-muted-foreground" />;
}

function sizeLabel(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1024*1024) return `${(bytes/1024).toFixed(0)} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

function DocumentRow({
  doc, caseId, onDelete,
}: { doc: any; caseId: string; onDelete: (id: string) => void }) {
  const dt = new Date(doc.created_at);
  const dateStr = dt.toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" });
  const timeStr = dt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });

  /* ext badge */
  const rawName: string = doc.file_name ?? "";
  const ext = rawName.split(".").pop()?.toUpperCase() ?? "FILE";

  const download = () => {
    const a = document.createElement("a");
    a.href = `${BASE}/api/cases/${caseId}/documents/${doc.id}/download`;
    a.download = rawName;
    a.click();
  };

  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-background hover:bg-muted/30 transition-colors group">
      {/* File icon + extension */}
      <div className="shrink-0 flex flex-col items-center gap-1">
        <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center border">
          <DocIcon type={doc.file_type ?? ""} />
        </div>
        <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">{ext}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight truncate">{rawName || "مستند"}</p>
        {/* Uploader + date + size */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {doc.uploaded_by_name && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <User className="h-3 w-3" />{doc.uploaded_by_name}
            </span>
          )}
          <span className="text-muted-foreground/40 text-[11px]">·</span>
          <span className="text-[11px] text-muted-foreground">
            {dateStr} {timeStr}
          </span>
          {doc.file_size ? (
            <>
              <span className="text-muted-foreground/40 text-[11px]">·</span>
              <span className="text-[11px] text-muted-foreground/70">{sizeLabel(Number(doc.file_size))}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="تحميل" onClick={download}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          title="حذف"
          onClick={() => { if (confirm("حذف هذا المستند؟")) onDelete(doc.id); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DocumentsSection({
  caseId, addOpen, setAddOpen,
}: { caseId: string; addOpen: boolean; setAddOpen: (v: boolean) => void }) {
  const { data: docs = [], refetch } = useApi<any[]>(
    ["case-documents", caseId],
    `/api/cases/${caseId}/documents`,
  );
  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteDoc = async (id: string) => {
    try {
      await fetch(`${BASE}/api/cases/${caseId}/documents/${id}`, { method: "DELETE" });
      refetch();
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      toast({ title: "تم حذف المستند" });
    } catch { toast({ variant: "destructive", title: "خطأ في الحذف" }); }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-violet-500" />مستندات القضية
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{docs.length} مستند</span>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddOpen(true)}>
            <Upload className="h-3 w-3" />رفع مستند
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {docs.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-15" />
            <p>لا توجد مستندات مرفوعة بعد</p>
            <p className="text-xs mt-1 text-muted-foreground/60">ارفع المستندات القانونية المتعلقة بهذه القضية</p>
          </div>
        )}
        {docs.map((doc: any) => (
          <DocumentRow key={doc.id} doc={doc} caseId={caseId} onDelete={deleteDoc} />
        ))}
      </CardContent>

      <DocumentUploadDialog
        open={addOpen}
        caseId={caseId}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          refetch();
          qc.invalidateQueries({ queryKey: ["case", caseId] });
          setAddOpen(false);
        }}
      />
    </Card>
  );
}

/* ══════════════════ DOCUMENT UPLOAD DIALOG ══════════════════ */
function DocumentUploadDialog({
  open, caseId, onClose, onSaved,
}: { open: boolean; caseId: string; onClose: () => void; onSaved: () => void }) {
  const { user } = useUser();
  const [file, setFile]           = useState<File | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  /* Reset when dialog opens */
  useEffect(() => {
    if (open) { setFile(null); setProgress(0); }
  }, [open]);

  const pickFile = (f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "حجم الملف يتجاوز 10 MB" });
      return;
    }
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0]);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(20);
    try {
      const reader = new FileReader();
      const fileData: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      setProgress(60);

      const uploaderName = [user?.firstName, user?.lastName].filter(Boolean).join(" ")
        || user?.username
        || user?.primaryEmailAddress?.emailAddress
        || "";

      const r = await fetch(`${BASE}/api/cases/${caseId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileData,
          uploadedByName: uploaderName,
        }),
      });
      setProgress(90);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "خطأ في الرفع");
      }
      setProgress(100);
      toast({ title: "✅ تم رفع المستند بنجاح" });
      onSaved();
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message ?? "خطأ في الرفع" });
    }
    setUploading(false);
  };

  const fmt = (bytes: number) =>
    bytes < 1024 ? `${bytes} B` :
    bytes < 1024*1024 ? `${(bytes/1024).toFixed(0)} KB` :
    `${(bytes/(1024*1024)).toFixed(1)} MB`;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-violet-500" />رفع مستند للقضية
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Drop zone */}
          <div
            className={cn(
              "relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-violet-400 bg-violet-50"
                : file
                ? "border-emerald-400 bg-emerald-50/50"
                : "border-border hover:border-violet-300 hover:bg-muted/30",
            )}
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.txt"
              onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])}
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                  <DocIcon type={file.type} />
                </div>
                <p className="text-sm font-semibold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(file.size)}</p>
                <button
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                >
                  تغيير الملف
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8 opacity-30" />
                <p className="text-sm font-medium">اسحب الملف هنا أو انقر للاختيار</p>
                <p className="text-xs opacity-60">PDF، Word، Excel، صور — حجم أقصى 10 MB</p>
              </div>
            )}
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>جاري الرفع…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Uploader info preview */}
          {user && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
              <User className="h-3.5 w-3.5" />
              <span>سيُسجَّل باسم:</span>
              <span className="font-medium text-foreground">
                {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "موظف"}
              </span>
              <span className="opacity-50">·</span>
              <span>{new Date().toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={uploading}>إلغاء</Button>
          <Button
            onClick={upload}
            disabled={!file || uploading}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {uploading
              ? <><Loader2 className="h-4 w-4 animate-spin" />جاري الرفع…</>
              : <><Upload className="h-4 w-4" />رفع المستند</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════ DIALOGS ══════════════════ */
function TaskDialog({ open, onClose, caseId, caseTitle }: { open: boolean; onClose: () => void; caseId: string; caseTitle: string }) {
  const [form, setForm] = useState({ title: "", priority: "medium", assignee_name: "", due_date: "" });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch(`${BASE}/api/cases/${caseId}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      qc.invalidateQueries({ queryKey: ["case-tasks", caseId] });
      onClose();
      setForm({ title: "", priority: "medium", assignee_name: "", due_date: "" });
      toast({ title: "✅ تمت إضافة المهمة" });
    } catch { toast({ variant: "destructive", title: "خطأ" }); }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>مهمة جديدة</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>عنوان المهمة *</Label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="ماذا يجب القيام به؟" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">عالية 🔴</SelectItem>
                  <SelectItem value="medium">متوسطة 🟡</SelectItem>
                  <SelectItem value="low">منخفضة 🟢</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الاستحقاق</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>المسؤول</Label>
            <Input value={form.assignee_name} onChange={e => setForm(p => ({ ...p, assignee_name: e.target.value }))} placeholder="المحامي أو الموظف" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════ MAIN COMPONENT ══════════════════ */
export default function CaseDetail({ id }: { id: string }) {
  const { data: c, isLoading } = useGetCase(id, {
    query: { enabled: !!id, queryKey: getGetCaseQueryKey(id) },
  });
  const updateCase  = useUpdateCase();
  const qc          = useQueryClient();
  const { toast }   = useToast();
  const { dir }     = useLang();

  /* Dialog states */
  const [taskOpen,      setTaskOpen]     = useState(false);
  const [timelineOpen,  setTimelineOpen] = useState(false);
  const [msgFocus,      setMsgFocus]     = useState(false);
  const [hearingOpen,   setHearingOpen]  = useState(false);
  const [documentOpen,  setDocumentOpen] = useState(false);
  const msgRef = useRef<HTMLDivElement>(null);

  const changeStatus = (status: string) => {
    updateCase.mutate(
      { id, data: { status } as any },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCaseQueryKey(id) });
          qc.invalidateQueries({ queryKey: ["cases-stats"] });
          toast({ title: "✅ تم تحديث الحالة" });
        },
        onError: () => toast({ variant: "destructive", title: "خطأ في التحديث" }),
      }
    );
  };

  const handleMsgAction = () => {
    msgRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setMsgFocus(true);
    setTimeout(() => setMsgFocus(false), 100);
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse" dir="rtl">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!c) {
    return (
      <div className="text-center py-24 space-y-4" dir="rtl">
        <AlertTriangle className="h-14 w-14 text-muted-foreground/20 mx-auto" />
        <p className="text-muted-foreground font-medium">القضية غير موجودة أو ليس لديك صلاحية الوصول</p>
        <Link href="/cases">
          <Button variant="outline" size="sm"><ArrowRight className="h-4 w-4 me-2" />العودة للقضايا</Button>
        </Link>
      </div>
    );
  }

  const s = STATUS_CFG[c.status as string] ?? STATUS_CFG.open;

  return (
    <div className="space-y-5" dir={dir}>

      {/* ══ HEADER ══ */}
      <div className="flex items-start gap-3">
        <Link href="/cases">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0 mt-0.5">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground leading-tight">{c.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn("inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium", s.bg)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />{s.label}
            </span>
            <Badge variant="outline" className="text-xs">{TYPE_MAP[c.caseType as string] ?? c.caseType}</Badge>
            {c.clientName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />{c.clientName as string}
              </span>
            )}
          </div>
        </div>

        {/* Status selector */}
        <Select value={c.status as string} onValueChange={changeStatus} disabled={updateCase.isPending}>
          <SelectTrigger className="w-36 h-9 text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">مفتوحة</SelectItem>
            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
            <SelectItem value="closed">مغلقة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ══ ACTION BAR ══ */}
      <ActionBar
        onTask={()       => setTaskOpen(true)}
        onMessage={()    => handleMsgAction()}
        onTimeline={()   => setTimelineOpen(true)}
        onAI={()         => {}}
        onHearing={()    => setHearingOpen(true)}
        onDocument={()   => setDocumentOpen(true)}
        onClose={()      => changeStatus("closed")}
        status={c.status as string}
        closing={updateCase.isPending}
      />

      {/* ══ MAIN GRID ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── CENTER (Documents + Hearings + Timeline + Messages) ── */}
        <div className="lg:col-span-2 space-y-5">
          <DocumentsSection
            caseId={id}
            addOpen={documentOpen}
            setAddOpen={setDocumentOpen}
          />
          <HearingsSection
            caseId={id}
            addOpen={hearingOpen}
            setAddOpen={setHearingOpen}
          />
          <TimelineFeed
            caseId={id}
            open={timelineOpen}
            setOpen={setTimelineOpen}
          />
          <div ref={msgRef}>
            <MessagesChat
              caseId={id}
              open={msgFocus}
              setOpen={setMsgFocus}
            />
          </div>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="space-y-4">
          <InfoCard c={c} />
          <CourtInfoCard
            c={c}
            caseId={id}
            onSaved={() => qc.invalidateQueries({ queryKey: getGetCaseQueryKey(id) })}
          />
          <AIHealthCard caseId={id} onAnalyze={() => {}} />
          <AutonomousAIPanel caseId={id} />
          <TasksMini caseId={id} onAdd={() => setTaskOpen(true)} />
          <HubMini caseId={id} />
        </div>
      </div>

      {/* ══ DIALOGS ══ */}
      <TaskDialog
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        caseId={id}
        caseTitle={c.title as string}
      />
    </div>
  );
}
