import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  HeadphonesIcon, Plus, Loader2, Send, Clock, CheckCircle2,
  AlertCircle, XCircle, ChevronRight, Tag, MessageSquare, X,
  LifeBuoy, Inbox, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const PRIORITY = {
  low:    { label: "منخفض",  color: "bg-gray-500/10 text-gray-400",    dot: "bg-gray-400" },
  medium: { label: "متوسط",  color: "bg-yellow-500/10 text-yellow-400", dot: "bg-yellow-400" },
  high:   { label: "عالٍ",   color: "bg-orange-500/10 text-orange-400", dot: "bg-orange-400" },
  urgent: { label: "عاجل",   color: "bg-red-500/10 text-red-400",       dot: "bg-red-500" },
};

const STATUS = {
  open:        { label: "مفتوح",           color: "bg-blue-500/10 text-blue-400",    icon: Inbox },
  in_progress: { label: "قيد المعالجة",    color: "bg-amber-500/10 text-amber-400",  icon: Clock },
  resolved:    { label: "محلول",           color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle2 },
  closed:      { label: "مغلق",            color: "bg-muted text-muted-foreground",  icon: XCircle },
};

const CATEGORIES = [
  { value: "technical",  label: "دعم تقني" },
  { value: "billing",    label: "فواتير ومدفوعات" },
  { value: "account",    label: "إدارة الحساب" },
  { value: "feature",    label: "طلب ميزة" },
  { value: "bug",        label: "الإبلاغ عن خلل" },
  { value: "other",      label: "أخرى" },
];

async function apiCall(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

export default function SupportPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({
    subject: "", body: "", priority: "medium", category: "technical",
  });

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["support-tickets"],
    queryFn: () => apiCall("/support/tickets"),
  });

  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["support-ticket", selectedId],
    queryFn: () => apiCall(`/support/tickets/${selectedId}`),
    enabled: !!selectedId,
    refetchInterval: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiCall("/support/tickets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (ticket) => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      setShowCreate(false);
      setSelectedId(ticket.id);
      setForm({ subject: "", body: "", priority: "medium", category: "technical" });
      toast({ title: "تم إرسال طلب الدعم ✓" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const replyMutation = useMutation({
    mutationFn: (data: any) => apiCall(`/support/tickets/${selectedId}/messages`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-ticket", selectedId] });
      setReply("");
    },
    onError: (e: any) => toast({ title: "خطأ في الإرسال", description: e.message, variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiCall(`/support/tickets/${selectedId}/close`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-ticket", selectedId] });
      toast({ title: "تم إغلاق التذكرة" });
    },
  });

  const handleCreate = () => {
    if (!form.subject.trim() || !form.body.trim()) {
      toast({ title: "يرجى ملء الموضوع والتفاصيل", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      ...form,
      userEmail: user?.primaryEmailAddress?.emailAddress ?? "",
      userName: user?.fullName ?? user?.firstName ?? "مستخدم",
    });
  };

  const handleReply = () => {
    if (!reply.trim()) return;
    replyMutation.mutate({
      message: reply,
      senderName: user?.fullName ?? user?.firstName ?? "المستخدم",
    });
  };

  const ticket = detail?.ticket;
  const messages = detail?.messages ?? [];
  const openCount = tickets.filter((t: any) => t.status === "open" || t.status === "in_progress").length;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#C9A84C]/10 flex items-center justify-center">
            <HeadphonesIcon className="h-5 w-5 text-[#C9A84C]" />
          </div>
          <div>
            <h1 className="text-lg font-black">مركز الدعم الفني</h1>
            <p className="text-xs text-muted-foreground">
              {openCount > 0 ? `${openCount} تذكرة نشطة` : "لا توجد تذاكر نشطة"}
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-2 bg-[#C9A84C] hover:bg-[#b8973d] text-[#1A2744] font-bold"
          onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> تذكرة جديدة
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "إجمالي التذاكر", value: tickets.length, color: "#C9A84C" },
          { label: "مفتوحة",          value: tickets.filter((t: any) => t.status === "open").length, color: "#3B82F6" },
          { label: "قيد المعالجة",    value: tickets.filter((t: any) => t.status === "in_progress").length, color: "#F59E0B" },
          { label: "محلولة",          value: tickets.filter((t: any) => t.status === "resolved").length, color: "#10B981" },
        ].map(s => (
          <Card key={s.label} className="border-0 bg-card/60">
            <CardContent className="p-4">
              <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main layout */}
      <div className="grid md:grid-cols-5 gap-4">

        {/* Tickets List */}
        <div className="md:col-span-2 space-y-2">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1 mb-3">
            التذاكر
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <LifeBuoy className="h-12 w-12 opacity-20" />
              <p className="text-sm text-center">لا توجد تذاكر بعد<br />
                <span className="text-xs">أنشئ تذكرة جديدة للتواصل مع الدعم الفني</span>
              </p>
            </div>
          ) : (
            tickets.map((t: any) => {
              const statusMeta = (STATUS as any)[t.status] ?? STATUS.open;
              const priorityMeta = (PRIORITY as any)[t.priority] ?? PRIORITY.medium;
              const StatusIcon = statusMeta.icon;
              return (
                <div key={t.id} onClick={() => setSelectedId(t.id)}
                  className={cn("p-3.5 rounded-xl border cursor-pointer transition-all", selectedId === t.id
                    ? "border-[#C9A84C]/50 bg-[#C9A84C]/5 shadow-sm"
                    : "border-border/50 hover:bg-muted/20 hover:border-border")}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-semibold text-sm line-clamp-1 flex-1">{t.subject}</span>
                    <Badge className={cn("text-[9px] shrink-0 px-1.5 font-medium", statusMeta.color)}>
                      {statusMeta.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityMeta.dot)} />
                    <span>{priorityMeta.label}</span>
                    <span>·</span>
                    <span>{new Date(t.createdAt).toLocaleDateString("ar-SA")}</span>
                    <ChevronRight className="h-3 w-3 mr-auto opacity-40" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Ticket Detail + Thread */}
        <div className="md:col-span-3">
          {!selectedId ? (
            <Card className="h-[400px] flex items-center justify-center border-dashed border-2">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">اختر تذكرة لعرض المحادثة</p>
              </div>
            </Card>
          ) : detailLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
          ) : ticket ? (
            <Card>
              {/* Ticket Header */}
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-base line-clamp-1">{ticket.subject}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={cn("text-[9px]", (STATUS as any)[ticket.status]?.color)}>
                        {(STATUS as any)[ticket.status]?.label}
                      </Badge>
                      <Badge className={cn("text-[9px]", (PRIORITY as any)[ticket.priority]?.color)}>
                        {(PRIORITY as any)[ticket.priority]?.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {CATEGORIES.find(c => c.value === ticket.category)?.label ?? ticket.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground mr-auto">
                        {new Date(ticket.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  {ticket.status !== "closed" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 gap-1"
                      onClick={() => closeMutation.mutate()}>
                      {closeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      إغلاق
                    </Button>
                  )}
                </div>
              </CardHeader>

              {/* Messages Thread */}
              <CardContent className="p-4 space-y-3 max-h-[320px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6 text-sm">لا توجد رسائل بعد</div>
                ) : (
                  messages.map((msg: any) => (
                    <div key={msg.id} className={cn("flex gap-3", msg.senderType === "admin" ? "flex-row-reverse" : "")}>
                      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                        msg.senderType === "admin" ? "bg-[#C9A84C]/20 text-[#C9A84C]" : "bg-blue-500/20 text-blue-400")}>
                        {msg.senderType === "admin" ? "دعم" : "أنا"}
                      </div>
                      <div className={cn("flex-1 max-w-[80%]", msg.senderType === "admin" ? "items-end" : "")}>
                        <div className={cn("rounded-xl p-3 text-sm leading-relaxed",
                          msg.senderType === "admin"
                            ? "bg-[#C9A84C]/10 border border-[#C9A84C]/20"
                            : "bg-muted/40 border border-border/30")}>
                          {msg.message}
                        </div>
                        <div className={cn("flex items-center gap-1 mt-1", msg.senderType === "admin" ? "justify-end" : "")}>
                          <span className="text-[10px] text-muted-foreground">{msg.senderName}</span>
                          <span className="text-[10px] text-muted-foreground">·</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Admin written response (legacy field) */}
                {ticket.response && !messages.some((m: any) => m.senderType === "admin") && (
                  <div className="p-3 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                        <HeadphonesIcon className="h-3 w-3 text-[#C9A84C]" />
                      </div>
                      <span className="text-xs font-semibold text-[#C9A84C]">رد الدعم الفني</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ticket.response}</p>
                  </div>
                )}
              </CardContent>

              {/* Reply Input */}
              {ticket.status !== "closed" && (
                <div className="px-4 pb-4 pt-2 border-t border-border/40">
                  <div className="flex gap-2">
                    <Textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleReply(); }}
                      placeholder="اكتب ردك هنا... (Ctrl+Enter للإرسال)"
                      rows={2}
                      className="resize-none text-sm flex-1"
                    />
                    <Button size="icon" className="h-full aspect-square bg-[#C9A84C] hover:bg-[#b8973d] text-[#1A2744]"
                      onClick={handleReply} disabled={!reply.trim() || replyMutation.isPending}>
                      {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>

      {/* Create Ticket Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeadphonesIcon className="h-5 w-5 text-[#C9A84C]" />
              تذكرة دعم فني جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">الموضوع *</Label>
              <Input placeholder="وصف مختصر للمشكلة أو الطلب" value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">الأولوية</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY).map(([v, meta]) => (
                      <SelectItem key={v} value={v}>{meta.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">التصنيف</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">التفاصيل *</Label>
              <Textarea placeholder="اشرح المشكلة أو الطلب بالتفصيل..." value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={5} className="resize-none text-sm" />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="gap-2 bg-[#C9A84C] hover:bg-[#b8973d] text-[#1A2744] font-bold">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              إرسال التذكرة
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
