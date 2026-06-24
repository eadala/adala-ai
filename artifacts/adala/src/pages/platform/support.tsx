/**
 * مركز الدعم الفني — Support Center
 * تذاكر دعم متخصصة ترسل لفريق إدارة المنصة
 */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  HeadphonesIcon, Plus, Loader2, Send, Clock, CheckCircle2,
  AlertCircle, XCircle, ChevronLeft, LifeBuoy, Bot,
  Shield, Bug, CreditCard, Zap, Star, RefreshCw, MessageSquare,
  Ticket, ArrowUpRight, Inbox, User2, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Constants ─────────────────────────────────────────────── */
const PRIORITY: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  low:      { label: "منخفض",  bg: "bg-muted/50 dark:bg-slate-800",   text: "text-muted-foreground dark:text-slate-300",   ring: "ring-slate-300" },
  medium:   { label: "متوسط",  bg: "bg-amber-50 dark:bg-amber-950/40",  text: "text-amber-700 dark:text-amber-300",   ring: "ring-amber-300" },
  high:     { label: "عالٍ",   bg: "bg-orange-50 dark:bg-orange-950/30",text: "text-orange-700 dark:text-orange-300", ring: "ring-orange-300" },
  urgent:   { label: "عاجل",   bg: "bg-red-50 dark:bg-red-950/30",      text: "text-red-700 dark:text-red-300",       ring: "ring-red-400" },
  critical: { label: "حرج",    bg: "bg-red-100 dark:bg-red-900/40",     text: "text-red-800 dark:text-red-200",       ring: "ring-red-600" },
};

const STATUS: Record<string, { label: string; color: string; icon: any; dot: string }> = {
  open:        { label: "مفتوح",        color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",    icon: AlertCircle,   dot: "bg-blue-500" },
  in_progress: { label: "قيد المعالجة",color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock,         dot: "bg-amber-500" },
  resolved:    { label: "محلول",        color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2, dot: "bg-emerald-500" },
  closed:      { label: "مغلق",         color: "bg-muted/50 text-muted-foreground dark:bg-slate-800",      icon: XCircle,       dot: "bg-slate-400" },
};

const CATEGORIES = [
  { value: "technical",    label: "دعم تقني",          icon: Zap,         color: "text-blue-500",    desc: "مشاكل تقنية وأخطاء في النظام" },
  { value: "billing",      label: "فواتير ومدفوعات",   icon: CreditCard,  color: "text-green-500",   desc: "أسئلة عن الاشتراكات والدفع" },
  { value: "account",      label: "إدارة الحساب",      icon: User2,       color: "text-violet-500",  desc: "صلاحيات وإعدادات الحساب" },
  { value: "feature",      label: "طلب ميزة جديدة",   icon: Star,        color: "text-amber-500",   desc: "اقتراح تحسين أو ميزة" },
  { value: "bug",          label: "الإبلاغ عن خلل",   icon: Bug,         color: "text-red-500",     desc: "خطأ أو سلوك غير متوقع" },
  { value: "security",     label: "مخاوف أمنية",       icon: Shield,      color: "text-rose-600",    desc: "ثغرات أو مشاكل أمنية" },
  { value: "performance",  label: "مشكلة أداء",        icon: Zap,         color: "text-orange-500",  desc: "بطء أو استهلاك موارد" },
  { value: "other",        label: "أخرى",              icon: MessageSquare, color: "text-muted-foreground", desc: "استفسار عام" },
];

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

function ticketNumber(id: string) {
  return "#" + id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/* ── Empty state ────────────────────────────────────────────── */
function EmptyTickets({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Ticket className="h-10 w-10 text-primary opacity-60" />
      </div>
      <div>
        <p className="font-bold text-foreground mb-1">لا توجد تذاكر دعم بعد</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          هل تواجه مشكلة؟ فريق دعم عدالة AI جاهز للمساعدة
        </p>
      </div>
      <Button onClick={onNew} className="gap-2 bg-primary hover:bg-primary/90 text-white font-bold">
        <Plus className="h-4 w-4" /> افتح تذكرة الآن
      </Button>
    </div>
  );
}

/* ── Ticket Row ─────────────────────────────────────────────── */
function TicketRow({ ticket, selected, onClick }: { ticket: any; selected: boolean; onClick: () => void }) {
  const sm = STATUS[ticket.status] ?? STATUS.open;
  const pm = PRIORITY[ticket.priority] ?? PRIORITY.medium;
  const StatusIcon = sm.icon;
  const cat = CATEGORIES.find(c => c.value === ticket.category);
  const CatIcon = cat?.icon ?? MessageSquare;

  return (
    <div onClick={onClick}
      className={cn(
        "group relative p-4 rounded-xl border cursor-pointer transition-all duration-150",
        selected
          ? "border-primary/60 bg-primary/5 shadow-sm shadow-primary/10"
          : "border-border/60 hover:border-border hover:bg-muted/30",
      )}>
      {selected && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-primary rounded-l-full" />
      )}
      <div className="flex items-start gap-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", pm.bg)}>
          <CatIcon className={cn("h-4 w-4", cat?.color ?? "text-muted-foreground")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-semibold text-sm line-clamp-1 text-foreground flex-1">{ticket.subject}</span>
            <Badge className={cn("text-[10px] shrink-0 gap-1 font-medium border-0", sm.color)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", sm.dot)} />
              {sm.label}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="font-mono text-primary/70 font-medium">{ticketNumber(ticket.id)}</span>
            <span>·</span>
            <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium", pm.bg, pm.text)}>
              {pm.label}
            </span>
            <span>·</span>
            <span>{new Date(ticket.createdAt ?? ticket.created_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}</span>
          </div>
        </div>
        <ChevronLeft className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5 group-hover:text-primary/50 transition-colors" />
      </div>
    </div>
  );
}

/* ── Message bubble ─────────────────────────────────────────── */
function Bubble({ msg }: { msg: any }) {
  const isAdmin = msg.senderType === "admin" || msg.sender_type === "admin";
  const isBot   = (msg.senderName ?? msg.sender_name ?? "")?.includes("🤖");

  return (
    <div className={cn("flex items-end gap-2.5", isAdmin ? "flex-row-reverse" : "")}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black",
        isBot   ? "bg-primary/20 text-primary"
        : isAdmin ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
        : "bg-muted text-muted-foreground",
      )}>
        {isBot ? <Bot className="h-3.5 w-3.5" /> : isAdmin ? <HeadphonesIcon className="h-3 w-3" /> : <User2 className="h-3 w-3" />}
      </div>
      <div className={cn("max-w-[78%]", isAdmin ? "items-end" : "")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line",
          isBot   ? "bg-primary/10 border border-primary/20 rounded-tr-sm"
          : isAdmin ? "bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-tl-sm"
          : "bg-muted/60 border border-border/40 rounded-tr-sm",
        )}>
          {msg.message}
        </div>
        <div className={cn("flex items-center gap-1.5 mt-1 px-1", isAdmin ? "justify-end" : "")}>
          <span className="text-[10px] text-muted-foreground font-medium">{msg.senderName ?? msg.sender_name}</span>
          <span className="text-[10px] text-muted-foreground/50">·</span>
          <span className="text-[10px] text-muted-foreground/70">
            {new Date(msg.createdAt ?? msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CREATE DIALOG
══════════════════════════════════════════════════════════════ */
function CreateDialog({
  open, onClose, onCreated, user,
}: { open: boolean; onClose: () => void; onCreated: (id: string) => void; user: any }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"category" | "form">("category");
  const [form, setForm] = useState({
    subject: "", body: "", priority: "medium", category: "",
  });

  const create = useMutation({
    mutationFn: (data: any) => api("/support/tickets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (t) => {
      toast({ title: "✅ تم إرسال تذكرتك", description: "فريق الدعم سيرد قريباً" });
      onCreated(t.id);
      setForm({ subject: "", body: "", priority: "medium", category: "" });
      setStep("category");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  function handleClose() {
    onClose();
    setTimeout(() => { setStep("category"); setForm({ subject: "", body: "", priority: "medium", category: "" }); }, 300);
  }

  const selectedCat = CATEGORIES.find(c => c.value === form.category);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden" dir="rtl">
        {/* Top bar */}
        <div className="bg-gradient-to-r from-primary to-primary/80 p-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <HeadphonesIcon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-white">فتح تذكرة دعم فني</DialogTitle>
              <p className="text-xs text-primary-foreground/70 mt-0.5">سيصلك رد من فريق عدالة AI خلال 24 ساعة</p>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {[{ n: 1, label: "التصنيف" }, { n: 2, label: "التفاصيل" }].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                {i > 0 && <div className="h-px w-6 bg-white/30" />}
                <div className={cn("flex items-center gap-1.5", step === (s.n === 1 ? "category" : "form") ? "opacity-100" : "opacity-50")}>
                  <div className={cn("w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center",
                    step === (s.n === 1 ? "category" : "form") ? "bg-white text-primary" : "bg-white/30 text-white"
                  )}>{s.n}</div>
                  <span className="text-xs font-medium text-white">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {step === "category" ? (
              <motion.div key="category" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <p className="text-sm font-bold text-foreground mb-3">ما نوع مشكلتك؟</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button key={cat.value}
                        onClick={() => { setForm(f => ({ ...f, category: cat.value })); setStep("form"); }}
                        className={cn(
                          "flex items-start gap-3 p-3.5 rounded-xl border-2 text-right transition-all hover:border-primary/40 hover:bg-primary/5",
                          form.category === cat.value ? "border-primary bg-primary/5" : "border-border/50 bg-muted/20",
                        )}>
                        <div className="w-8 h-8 rounded-lg bg-background shadow-sm border border-border/50 flex items-center justify-center shrink-0">
                          <Icon className={cn("h-4 w-4", cat.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground leading-tight">{cat.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{cat.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                {selectedCat && (
                  <button onClick={() => setStep("category")}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
                    <selectedCat.icon className={cn("h-3.5 w-3.5", selectedCat.color)} />
                    <span className="font-medium">{selectedCat.label}</span>
                    <span className="text-muted-foreground/50">— تغيير التصنيف</span>
                  </button>
                )}

                <div>
                  <Label className="text-xs font-bold mb-1.5 block">موضوع التذكرة <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="وصف مختصر وواضح للمشكلة"
                    value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold mb-1.5 block">مستوى الأولوية</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(["low", "medium", "high", "urgent"] as const).map(p => (
                      <button key={p}
                        onClick={() => setForm(f => ({ ...f, priority: p }))}
                        className={cn(
                          "py-2 rounded-lg text-[11px] font-bold border-2 transition-all",
                          form.priority === p
                            ? `${PRIORITY[p].bg} ${PRIORITY[p].text} border-current/40`
                            : "bg-muted/30 text-muted-foreground border-transparent hover:border-border",
                        )}>
                        {PRIORITY[p].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold mb-1.5 block">تفاصيل المشكلة <span className="text-red-500">*</span></Label>
                  <Textarea
                    placeholder={`اشرح المشكلة بالتفصيل:\n• ماذا كنت تفعل؟\n• ما الخطأ الذي ظهر؟\n• هل حدث فجأة أم تدريجياً؟`}
                    value={form.body}
                    onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    rows={5}
                    className="resize-none text-sm"
                  />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <Building2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                    تذكرتك سترسل مباشرة لفريق دعم <strong>عدالة AI</strong> — وليس لمراسلات القضايا. متوسط وقت الرد أقل من 24 ساعة.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step === "form" && (
          <DialogFooter className="px-5 pb-5 flex-row-reverse gap-2">
            <Button
              disabled={!form.subject.trim() || !form.body.trim() || create.isPending}
              onClick={() => create.mutate({
                ...form,
                userEmail: user?.primaryEmailAddress?.emailAddress ?? "",
                userName: user?.fullName ?? user?.firstName ?? "مستخدم",
              })}
              className="gap-2 bg-primary hover:bg-primary/90 text-white font-bold flex-1">
              {create.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              {create.isPending ? "جارٍ الإرسال..." : "إرسال التذكرة"}
            </Button>
            <Button variant="outline" onClick={() => setStep("category")}>رجوع</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════════
   TICKET DETAIL PANEL
══════════════════════════════════════════════════════════════ */
function TicketDetail({
  ticketId, currentUser, onClose,
}: { ticketId: string; currentUser: any; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["support-ticket", ticketId],
    queryFn: () => api(`/support/tickets/${ticketId}`),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  const sendReply = useMutation({
    mutationFn: (msg: string) => api(`/support/tickets/${ticketId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message: msg, senderName: currentUser?.fullName ?? "المستخدم" }),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      setReply("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const closeTicket = useMutation({
    mutationFn: () => api(`/support/tickets/${ticketId}/close`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] });
      toast({ title: "تم إغلاق التذكرة" });
    },
  });

  const reAnalyze = useMutation({
    mutationFn: () => api(`/support/tickets/${ticketId}/ai-analyze`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "🤖 AI يعيد التحليل..." });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["support-ticket", ticketId] }), 5000);
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );

  const ticket = data?.ticket;
  const messages: any[] = data?.messages ?? [];
  if (!ticket) return null;

  const sm = STATUS[ticket.status] ?? STATUS.open;
  const pm = PRIORITY[ticket.priority] ?? PRIORITY.medium;
  const cat = CATEGORIES.find(c => c.value === ticket.category);
  const CatIcon = cat?.icon ?? MessageSquare;
  const StatusIcon = sm.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Detail header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-border/40">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs text-primary/70 font-bold">{ticketNumber(ticket.id)}</span>
            <Badge className={cn("text-[10px] gap-1 border-0", sm.color)}>
              <span className={cn("w-1.5 h-1.5 rounded-full", sm.dot)} />
              {sm.label}
            </Badge>
            <Badge className={cn("text-[10px] border-0", pm.bg, pm.text)}>{pm.label}</Badge>
          </div>
          <h2 className="font-bold text-sm text-foreground leading-tight line-clamp-2">{ticket.subject}</h2>
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
            <CatIcon className={cn("h-3 w-3", cat?.color)} />
            <span>{cat?.label ?? ticket.category}</span>
            <span>·</span>
            <span>{new Date(ticket.createdAt ?? ticket.created_at).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => reAnalyze.mutate()} disabled={reAnalyze.isPending}>
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", reAnalyze.isPending && "animate-spin")} />
          </Button>
          {ticket.status !== "closed" && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => closeTicket.mutate()} disabled={closeTicket.isPending}>
              <XCircle className="h-3 w-3" /> إغلاق
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-10">
            <Inbox className="h-8 w-8 opacity-30" />
            <p className="text-xs">لا توجد رسائل بعد</p>
          </div>
        ) : messages.map((msg: any) => (
          <Bubble key={msg.id} msg={msg} />
        ))}
      </div>

      {/* Reply input */}
      {ticket.status !== "closed" ? (
        <div className="p-4 border-t border-border/40 bg-muted/10">
          <div className="flex gap-2">
            <Textarea
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && e.ctrlKey && reply.trim()) {
                  sendReply.mutate(reply.trim());
                }
              }}
              placeholder="اكتب ردك... (Ctrl+Enter للإرسال)"
              rows={2}
              className="resize-none text-sm flex-1 min-h-[56px]"
            />
            <Button
              size="icon"
              className="h-full aspect-square bg-primary hover:bg-primary/90 text-white shrink-0"
              onClick={() => { if (reply.trim()) sendReply.mutate(reply.trim()); }}
              disabled={!reply.trim() || sendReply.isPending}>
              {sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <Bot className="h-3 w-3" />
            ردك يصل لفريق دعم عدالة AI مباشرةً — لا لمراسلات القضايا
          </p>
        </div>
      ) : (
        <div className="p-4 border-t border-border/40">
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-muted/30 border border-dashed border-border/60">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">هذه التذكرة مغلقة</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function SupportPage() {
  const { user } = useUser();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "resolved" | "closed">("all");

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["support-tickets"],
    queryFn: () => api("/support/tickets"),
    staleTime: 30_000,
  });

  const allTickets = tickets as any[];
  const filtered = filter === "all" ? allTickets : allTickets.filter(t => {
    if (filter === "open") return t.status === "open" || t.status === "in_progress";
    return t.status === filter;
  });

  const counts = {
    all:      allTickets.length,
    open:     allTickets.filter(t => t.status === "open" || t.status === "in_progress").length,
    resolved: allTickets.filter(t => t.status === "resolved").length,
    closed:   allTickets.filter(t => t.status === "closed").length,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-90px)] overflow-hidden" dir="rtl">
      {/* ── Top Hero Bar ── */}
      <div className="shrink-0 bg-gradient-to-l from-primary/8 via-card to-card border-b border-border/50 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm shadow-primary/20">
              <HeadphonesIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-foreground">مركز الدعم الفني</h1>
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 font-medium gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  فريق الدعم متاح
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                تواصل مباشرة مع فريق عدالة AI · رد ضمان أقل من 24 ساعة
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2 bg-primary hover:bg-primary/90 text-white font-bold shadow-sm shadow-primary/20">
            <Plus className="h-4 w-4" />
            تذكرة جديدة
          </Button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { key: "all",      label: "جميع التذاكر",   color: "text-foreground",            bg: "bg-background" },
            { key: "open",     label: "نشطة",            color: "text-blue-600 dark:text-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30" },
            { key: "resolved", label: "محلولة",          color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { key: "closed",   label: "مغلقة",           color: "text-muted-foreground",             bg: "bg-muted/30 dark:bg-slate-800/40" },
          ].map(s => (
            <button key={s.key}
              onClick={() => { setFilter(s.key as any); setSelectedId(null); }}
              className={cn(
                "p-3 rounded-xl border-2 text-right transition-all",
                filter === s.key
                  ? `${s.bg} border-current/30`
                  : "bg-background border-border/40 hover:border-border",
              )}>
              <div className={cn("text-xl font-black", s.color)}>{(counts as any)[s.key]}</div>
              <div className="text-[11px] text-muted-foreground font-medium">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main split panel ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: ticket list */}
        <div className={cn(
          "flex flex-col border-l border-border/40 overflow-hidden transition-all",
          selectedId ? "w-[340px] shrink-0" : "flex-1",
        )}>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyTickets onNew={() => setShowCreate(true)} />
            ) : filtered.map((t: any) => (
              <TicketRow
                key={t.id}
                ticket={t}
                selected={selectedId === t.id}
                onClick={() => setSelectedId(t.id)}
              />
            ))}
          </div>
        </div>

        {/* Right: ticket detail */}
        <AnimatePresence>
          {selectedId && (
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col overflow-hidden border-r-0">
              <TicketDetail
                ticketId={selectedId}
                currentUser={user}
                onClose={() => setSelectedId(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right placeholder when no ticket selected and list is full-width */}
        {!selectedId && !isLoading && filtered.length > 0 && (
          <div className="hidden md:flex flex-col items-center justify-center flex-1 text-muted-foreground bg-muted/10 border-r border-border/40">
            <LifeBuoy className="h-14 w-14 opacity-10 mb-3" />
            <p className="text-sm font-medium opacity-50">اختر تذكرة لعرض المحادثة</p>
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CreateDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(id) => {
          qc.invalidateQueries({ queryKey: ["support-tickets"] });
          setSelectedId(id);
          setShowCreate(false);
        }}
        user={user}
      />
    </div>
  );
}
