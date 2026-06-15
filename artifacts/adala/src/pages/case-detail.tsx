/**
 * Case Detail — صفحة تفاصيل القضية
 * ────────────────────────────────────
 * Architecture: Clean tabs — each tab is an isolated component
 * 7 tabs: Overview | Timeline | Tasks | Documents | Sessions | Messages | AI
 */

import { useState, useCallback, useEffect } from "react";
import { useGetCase, getGetCaseQueryKey, useUpdateCase } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient }          from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle }       from "@/components/ui/card";
import { Button }                                          from "@/components/ui/button";
import { Badge }                                           from "@/components/ui/badge";
import { Skeleton }                                        from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger }        from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input }                                           from "@/components/ui/input";
import { Label }                                           from "@/components/ui/label";
import { Textarea }                                        from "@/components/ui/textarea";
import { Separator }                                       from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowRight, FileText, MessageSquare, Bot, User, Clock, Scale,
  Receipt, CalendarDays, Sparkles, AlertTriangle, Plus,
  CheckCheck, Circle, Loader2, Send, Paperclip, History,
  CheckSquare, ListTodo, Shield, TrendingUp, Lightbulb,
} from "lucide-react";
import { Link }            from "wouter";
import { useToast }        from "@/hooks/use-toast";
import { useLang }         from "@/hooks/use-lang";
import { cn }              from "@/lib/utils";
import { CaseAutopilotCard } from "@/components/case-autopilot-card";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const STATUS_MAP: Record<string, { label: string; bg: string }> = {
  open:        { label: "مفتوحة",       bg: "bg-blue-50 text-blue-700 border-blue-200" },
  in_progress: { label: "قيد التنفيذ",  bg: "bg-amber-50 text-amber-700 border-amber-200" },
  closed:      { label: "مغلقة",        bg: "bg-slate-100 text-slate-600 border-slate-200" },
};
const TYPE_MAP: Record<string, string> = {
  criminal:    "جنائية",
  civil:       "مدنية",
  commercial:  "تجارية",
  labor:       "عمالية",
  real_estate: "عقارية",
};
const TASK_STATUS: Record<string, { label: string; color: string }> = {
  todo:        { label: "لم تبدأ",  color: "text-slate-500" },
  in_progress: { label: "جارية",    color: "text-amber-600" },
  done:        { label: "منجزة",    color: "text-emerald-600" },
};
const PRIORITY_COLOR: Record<string, string> = {
  high:   "text-red-600",
  medium: "text-amber-600",
  low:    "text-slate-400",
};
const ENTRY_ICON: Record<string, any> = {
  hearing:      CalendarDays,
  note:         FileText,
  document:     Paperclip,
  decision:     CheckCheck,
  consultation: MessageSquare,
};

/* ══════════════════════════════════════════
   HOOKS
══════════════════════════════════════════ */
function useHub(id: string) {
  return useQuery<any>({
    queryKey: ["case-hub", id],
    queryFn: () => fetch(`${BASE}/api/cases/${id}/hub`).then(r => r.json()),
    enabled: !!id,
  });
}
function useTimeline(id: string) {
  return useQuery<any[]>({
    queryKey: ["case-timeline", id],
    queryFn: () => fetch(`${BASE}/api/cases/${id}/timeline`).then(r => r.json()),
    enabled: !!id,
  });
}
function useCaseTasks(id: string) {
  return useQuery<any[]>({
    queryKey: ["case-tasks", id],
    queryFn: () => fetch(`${BASE}/api/cases/${id}/tasks`).then(r => r.json()),
    enabled: !!id,
  });
}
function useCaseMessages(id: string) {
  return useQuery<any[]>({
    queryKey: ["case-msgs", id],
    queryFn: () => fetch(`${BASE}/api/cases/${id}/messages`).then(r => r.json()),
    enabled: !!id,
    staleTime: 15_000,
  });
}

/* ══════════════════════════════════════════
   SUB-COMPONENTS
══════════════════════════════════════════ */

/* ── Overview tab ── */
function OverviewTab({ caseData, hub }: { caseData: any; hub: any }) {
  const invoices  = hub?.invoices  ?? [];
  const contracts = hub?.contracts ?? [];
  const events    = hub?.events    ?? [];
  const documents = hub?.documents ?? [];

  const totalInvoiced = invoices.reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
  const paidCount     = invoices.filter((i: any) => i.status === "paid").length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Client + Case info ── */}
      <div className="space-y-4">
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />بيانات الموكل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="الاسم"     value={caseData.clientName ?? "—"} />
            <Row label="المحامي"   value={caseData.assignedTo ?? "—"} />
            <Row label="نوع القضية" value={TYPE_MAP[caseData.caseType] ?? caseData.caseType} />
            <Row label="المصدر"    value={caseData.source === "store" ? "متجر" : "يدوي"} />
            {caseData.createdBy && <Row label="أنشأها" value={caseData.createdBy} />}
            <Row
              label="تاريخ الإنشاء"
              value={caseData.createdAt ? new Date(caseData.createdAt).toLocaleDateString("ar-SA") : "—"}
            />
          </CardContent>
        </Card>

        {caseData.description && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">وصف القضية</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{caseData.description}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Stats + Recent entities ── */}
      <div className="lg:col-span-2 space-y-4">
        {/* Mini KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="فواتير"   value={invoices.length}  color="bg-blue-50 text-blue-700" />
          <MiniStat label="عقود"     value={contracts.length} color="bg-violet-50 text-violet-700" />
          <MiniStat label="جلسات"    value={events.length}    color="bg-amber-50 text-amber-700" />
          <MiniStat label="مستندات"  value={documents.length} color="bg-emerald-50 text-emerald-700" />
        </div>

        {/* Recent Invoices */}
        {invoices.length > 0 && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />الفواتير ({invoices.length})
                <span className="text-xs text-muted-foreground me-auto">
                  مدفوع: {paidCount} · الإجمالي: {totalInvoiced.toLocaleString("ar-SA")} ر.س
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {invoices.slice(0, 4).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{inv.title ?? inv.invoice_number}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{Number(inv.total ?? 0).toLocaleString("ar-SA")} ر.س</span>
                    <Badge variant="outline" className={cn("text-xs",
                      inv.status === "paid"    ? "bg-emerald-50 text-emerald-700" :
                      inv.status === "overdue" ? "bg-red-50 text-red-700"         : "")}>
                      {inv.status === "paid" ? "مدفوعة" : inv.status === "overdue" ? "متأخرة" : "معلقة"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Events */}
        {events.length > 0 && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />الجلسات ({events.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {events.slice(0, 3).map((ev: any) => (
                <div key={ev.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{ev.title}</span>
                    {ev.location && <span className="text-xs text-muted-foreground ms-2">📍{ev.location}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ev.start_at ? new Date(ev.start_at).toLocaleDateString("ar-SA") : "—"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── Timeline tab ── */
function TimelineTab({ id }: { id: string }) {
  const { data: entries = [], refetch } = useTimeline(id);
  const [open, setOpen]   = useState(false);
  const [form, setForm]   = useState({ entry_type: "note", title: "", description: "", is_shared: true });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const add = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch(`${BASE}/api/cases/${id}/timeline`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ entry_type: "note", title: "", description: "", is_shared: true });
      refetch();
      toast({ title: "✅ تم إضافة القيد" });
    } catch { toast({ variant: "destructive", title: "خطأ في الحفظ" }); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 me-2" />إضافة قيد
        </Button>
      </div>

      {entries.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <History className="h-10 w-10 mx-auto opacity-20" />
          <p className="text-sm">لا يوجد سجل بعد</p>
        </div>
      )}

      <div className="relative">
        {entries.length > 0 && <div className="absolute start-5 top-0 bottom-0 w-px bg-border" />}
        <div className="space-y-4">
          {entries.map((entry: any) => {
            const Icon = ENTRY_ICON[entry.entry_type] ?? Circle;
            return (
              <div key={entry.id} className="flex gap-4 relative">
                <div className="flex-none w-10 h-10 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center z-10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <Card className="flex-1 border shadow-sm hover:shadow transition-shadow">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{entry.title}</p>
                        {entry.description && <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {entry.happened_at ? new Date(entry.happened_at).toLocaleDateString("ar-SA") : "—"}
                        </p>
                        {entry.created_by && <p className="text-xs text-muted-foreground">{entry.created_by}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة قيد للجدول الزمني</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <Select value={form.entry_type} onValueChange={v => setForm(p => ({ ...p, entry_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hearing">جلسة</SelectItem>
                  <SelectItem value="note">ملاحظة</SelectItem>
                  <SelectItem value="document">مستند</SelectItem>
                  <SelectItem value="decision">قرار</SelectItem>
                  <SelectItem value="consultation">استشارة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>العنوان *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="وصف القيد..." />
            </div>
            <div className="space-y-1.5">
              <Label>تفاصيل</Label>
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
    </div>
  );
}

/* ── Tasks tab ── */
function TasksTab({ id, caseTitle }: { id: string; caseTitle: string }) {
  const { data: tasks = [], refetch } = useCaseTasks(id);
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm]   = useState({ title: "", priority: "medium", assignee_name: "", due_date: "" });
  const { toast } = useToast();

  const add = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch(`${BASE}/api/cases/${id}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({ title: "", priority: "medium", assignee_name: "", due_date: "" });
      refetch();
      toast({ title: "✅ تم إضافة المهمة" });
    } catch { toast({ variant: "destructive", title: "خطأ" }); }
    setSaving(false);
  };

  const toggle = async (taskId: string, current: string) => {
    const next = current === "done" ? "todo" : current === "todo" ? "in_progress" : "done";
    await fetch(`${BASE}/api/tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => {});
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{tasks.length} مهمة</span>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 me-2" />مهمة جديدة
        </Button>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <ListTodo className="h-10 w-10 mx-auto opacity-20" />
          <p className="text-sm">لا توجد مهام مرتبطة بهذه القضية</p>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map((t: any) => (
          <Card key={t.id} className="border shadow-sm hover:shadow transition-shadow">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(t.id, t.status)} className="mt-0.5 shrink-0">
                  {t.status === "done"
                    ? <CheckSquare className="h-5 w-5 text-emerald-500" />
                    : <Circle className="h-5 w-5 text-slate-300 hover:text-primary transition-colors" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", t.status === "done" && "line-through text-muted-foreground")}>
                    {t.title}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className={PRIORITY_COLOR[t.priority ?? "medium"]}>
                      {t.priority === "high" ? "عالية" : t.priority === "low" ? "منخفضة" : "متوسطة"}
                    </span>
                    {t.assignee_name && <span>👤 {t.assignee_name}</span>}
                    {t.due_date && <span>📅 {new Date(t.due_date).toLocaleDateString("ar-SA")}</span>}
                    <span className={TASK_STATUS[t.status]?.color}>{TASK_STATUS[t.status]?.label}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
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
                <Label>تاريخ الاستحقاق</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>المسؤول</Label>
              <Input value={form.assignee_name} onChange={e => setForm(p => ({ ...p, assignee_name: e.target.value }))} placeholder="اسم المحامي أو الموظف" />
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
    </div>
  );
}

/* ── Documents tab ── */
function DocumentsTab({ hub }: { hub: any }) {
  const documents = hub?.documents ?? [];
  return (
    <div className="space-y-3">
      {documents.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <FileText className="h-10 w-10 mx-auto opacity-20" />
          <p className="text-sm">لا توجد مستندات مرفقة</p>
        </div>
      )}
      {documents.map((doc: any) => (
        <Card key={doc.id} className="border shadow-sm hover:shadow transition-shadow">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.file_name}</p>
              <p className="text-xs text-muted-foreground">{doc.file_type} · {new Date(doc.created_at).toLocaleDateString("ar-SA")}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Sessions tab ── */
function SessionsTab({ hub }: { hub: any }) {
  const events = hub?.events ?? [];
  return (
    <div className="space-y-3">
      {events.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <CalendarDays className="h-10 w-10 mx-auto opacity-20" />
          <p className="text-sm">لا توجد جلسات مسجلة</p>
        </div>
      )}
      {events.map((ev: any) => (
        <Card key={ev.id} className="border shadow-sm hover:shadow transition-shadow">
          <CardContent className="py-3 px-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{ev.title}</p>
                {ev.location && <p className="text-xs text-muted-foreground mt-0.5">📍 {ev.location}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">{ev.start_at ? new Date(ev.start_at).toLocaleDateString("ar-SA") : "—"}</p>
                <Badge variant="outline" className="text-xs mt-1">
                  {ev.event_type === "hearing" ? "جلسة" : ev.event_type === "meeting" ? "اجتماع" : ev.event_type}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Messages tab ── */
function MessagesTab({ id }: { id: string }) {
  const { data: messages = [], refetch } = useCaseMessages(id);
  const [body, setBody]     = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await fetch(`${BASE}/api/cases/${id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, sender_name: "المحامي" }),
      });
      setBody("");
      refetch();
    } catch { toast({ variant: "destructive", title: "خطأ في الإرسال" }); }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16 text-muted-foreground space-y-2">
            <MessageSquare className="h-10 w-10 mx-auto opacity-20" />
            <p className="text-sm">لا توجد رسائل بعد</p>
          </div>
        )}
        {messages.map((msg: any) => (
          <div key={msg.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold">{msg.sender_name ?? "المحامي"}</span>
                <span className="text-xs text-muted-foreground">
                  {msg.created_at ? new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
              <div className="bg-muted/50 rounded-xl px-3 py-2 text-sm">{msg.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Compose */}
      <div className="border-t pt-4 flex gap-2">
        <Textarea
          className="flex-1 resize-none min-h-[60px] text-sm"
          placeholder="اكتب رسالة داخلية للفريق..."
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button size="sm" onClick={send} disabled={sending || !body.trim()} className="self-end">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

/* ── AI tab ── */
function AITab({ id, caseData }: { id: string; caseData: any }) {
  const [brief, setBrief]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  const loadBrief = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/ai/case-brief/${id}`);
      if (r.ok) { const d = await r.json(); setBrief(d.brief); }
    } catch {}
    setLoading(false);
    setLoaded(true);
  }, [id, loaded]);

  useEffect(() => { loadBrief(); }, [loadBrief]);

  return (
    <div className="space-y-6">
      {/* Autopilot health card */}
      <CaseAutopilotCard caseId={id} />

      {/* AI Brief */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />ملخص القضية بالذكاء الاصطناعي
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />جارٍ التحليل...
            </div>
          )}
          {!loading && brief && (
            <p className="text-sm leading-relaxed text-foreground">{brief}</p>
          )}
          {!loading && !brief && (
            <div className="text-center py-6 space-y-2">
              <Bot className="h-8 w-8 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">لم يتمكن AI من توليد ملخص</p>
              <Button size="sm" variant="outline" onClick={() => { setLoaded(false); loadBrief(); }}>
                إعادة المحاولة
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Helpers ── */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-end">{value}</span>
    </div>
  );
}
function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={cn("rounded-xl p-3 text-center", color)}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

/* ══════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════ */
export default function CaseDetail({ id }: { id: string }) {
  const { data: caseData, isLoading } = useGetCase(id, {
    query: { enabled: !!id, queryKey: getGetCaseQueryKey(id) },
  });
  const { data: hub, isLoading: hubLoading } = useHub(id);
  const updateCase = useUpdateCase();
  const qc         = useQueryClient();
  const { toast }  = useToast();
  const { dir }    = useLang();

  const handleStatusChange = (status: string) => {
    updateCase.mutate(
      { params: { id }, body: { status } as any },
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

  if (isLoading) {
    return (
      <div className="space-y-6" dir="rtl">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Skeleton className="h-48 lg:col-span-1" />
          <Skeleton className="h-48 lg:col-span-3" />
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-20 space-y-3">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto" />
        <p className="text-muted-foreground">القضية غير موجودة أو لا تملك صلاحية الوصول</p>
        <Link href="/cases">
          <Button variant="outline" size="sm">
            <ArrowRight className="h-4 w-4 me-2" />العودة للقضايا
          </Button>
        </Link>
      </div>
    );
  }

  const s = STATUS_MAP[caseData.status as string] ?? STATUS_MAP.open;

  return (
    <div className="space-y-6" dir={dir}>
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Link href="/cases">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 mt-0.5 shrink-0">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold truncate">{caseData.title}</h1>
            <Badge variant="outline" className={cn("text-xs shrink-0", s.bg)}>{s.label}</Badge>
            <Badge variant="outline" className="text-xs shrink-0">
              {TYPE_MAP[caseData.caseType as string] ?? caseData.caseType}
            </Badge>
          </div>
          {caseData.clientName && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />{caseData.clientName}
              {caseData.assignedTo && <><span className="mx-1">·</span><span>{caseData.assignedTo}</span></>}
            </p>
          )}
        </div>

        {/* Status selector */}
        <Select value={caseData.status as string} onValueChange={handleStatusChange} disabled={updateCase.isPending}>
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

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-9 gap-1 flex-wrap">
          <TabsTrigger value="overview"  className="text-xs gap-1.5"><Scale className="h-3.5 w-3.5" />نظرة عامة</TabsTrigger>
          <TabsTrigger value="timeline"  className="text-xs gap-1.5"><History className="h-3.5 w-3.5" />السجل</TabsTrigger>
          <TabsTrigger value="tasks"     className="text-xs gap-1.5"><CheckSquare className="h-3.5 w-3.5" />المهام</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs gap-1.5"><FileText className="h-3.5 w-3.5" />المستندات</TabsTrigger>
          <TabsTrigger value="sessions"  className="text-xs gap-1.5"><CalendarDays className="h-3.5 w-3.5" />الجلسات</TabsTrigger>
          <TabsTrigger value="messages"  className="text-xs gap-1.5"><MessageSquare className="h-3.5 w-3.5" />الرسائل</TabsTrigger>
          <TabsTrigger value="ai"        className="text-xs gap-1.5"><Bot className="h-3.5 w-3.5" />AI</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab caseData={caseData} hub={hub} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab id={id} />
        </TabsContent>

        <TabsContent value="tasks">
          <TasksTab id={id} caseTitle={caseData.title as string} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab hub={hub} />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsTab hub={hub} />
        </TabsContent>

        <TabsContent value="messages">
          <MessagesTab id={id} />
        </TabsContent>

        <TabsContent value="ai">
          <AITab id={id} caseData={caseData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
