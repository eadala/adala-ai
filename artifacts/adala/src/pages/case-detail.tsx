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
} from "lucide-react";
import { Link }           from "wouter";
import { useToast }       from "@/hooks/use-toast";
import { useLang }        from "@/hooks/use-lang";
import { cn }             from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ══════════════════ CONSTANTS ══════════════════ */
const STATUS_CFG: Record<string, { label: string; bg: string; dot: string }> = {
  open:        { label: "مفتوحة",       bg: "bg-blue-50 text-blue-700 border-blue-200",   dot: "bg-blue-500"   },
  in_progress: { label: "قيد التنفيذ",  bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500"  },
  closed:      { label: "مغلقة",        bg: "bg-slate-100 text-slate-600 border-slate-300", dot: "bg-slate-400"  },
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
  note:         "bg-slate-100 text-slate-600 border-slate-200",
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
function api<T>(key: any[], url: string) {
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
  onTask, onMessage, onTimeline, onAI, onClose,
  status, closing,
}: {
  onTask: () => void; onMessage: () => void; onTimeline: () => void;
  onAI: () => void; onClose: () => void; status: string; closing: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-xl border">
      <Button size="sm" onClick={onTask} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />مهمة
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
  const { data: entries = [], refetch } = api<any[]>(["case-timeline", caseId], `/api/cases/${caseId}/timeline`);
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
              const col  = ENTRY_COLOR[e.entry_type] ?? "bg-slate-100 text-slate-600 border-slate-200";
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
  const { data: msgs = [], refetch } = api<any[]>(["case-msgs", caseId], `/api/cases/${caseId}/messages`);
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
  const { data, isLoading, refetch } = api<any>(
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

/* Tasks mini */
function TasksMini({ caseId, onAdd }: { caseId: string; onAdd: () => void }) {
  const { data: tasks = [], refetch } = api<any[]>(["case-tasks", caseId], `/api/cases/${caseId}/tasks`);
  const pending = tasks.filter((t: any) => t.status !== "done");

  const toggle = async (id: string, cur: string) => {
    const next = cur === "done" ? "todo" : "done";
    await fetch(`${BASE}/api/tasks/${id}`, {
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
  const { data: hub } = api<any>(["case-hub", caseId], `/api/cases/${caseId}/hub`);
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
  const [taskOpen,     setTaskOpen]     = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [msgFocus,     setMsgFocus]     = useState(false);
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
        onTask={()     => setTaskOpen(true)}
        onMessage={()  => handleMsgAction()}
        onTimeline={()  => setTimelineOpen(true)}
        onAI={()       => {}}
        onClose={()    => changeStatus("closed")}
        status={c.status as string}
        closing={updateCase.isPending}
      />

      {/* ══ MAIN GRID ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── CENTER (Timeline + Messages) ── */}
        <div className="lg:col-span-2 space-y-5">
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
          <AIHealthCard caseId={id} onAnalyze={() => {}} />
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
