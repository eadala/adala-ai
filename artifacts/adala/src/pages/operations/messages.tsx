import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Inbox, Send, FileText, Archive, Search, Plus, RefreshCw,
  Paperclip, Trash2, X, Users, MessageSquare,
  CheckCircle2, Eye, Monitor, Smartphone, Tablet, Clock,
  Mail, ChevronRight, Menu, ArrowRight, MessageSquareDot,
} from "lucide-react";
import { useAuth } from "@clerk/react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ─── Shared Types ──────────────────────────────────────────────────────── */
type AppMode = "mail" | "conversations";
type Folder  = "inbox" | "sent" | "drafts" | "archive";
type MobileView = "folders" | "list" | "detail";

interface Recipient  { userId: string; userName: string; }
interface Attachment { id: string; fileName: string; fileUrl: string; fileSize?: number; }
interface Message {
  id: string; subject: string; body: string;
  sender_id: string; sender_name: string; sender_ip?: string; device_info?: string;
  created_at: string; folder: string; tags: string[];
  recipients: Array<{ userId: string; userName: string; isRead: boolean; readAt?: string; readerIp?: string; }>;
  attachments: Attachment[];
  is_read?: boolean; read_at?: string; reader_ip?: string;
}
interface Conversation {
  id: string; title: string | null; type: "direct" | "group";
  created_by: string; created_at: string; updated_at: string;
  last_message: string | null; last_message_at: string | null;
  member_count: number; my_role: "admin" | "member";
}
interface ConvMessage {
  id: string; body: string; sender_id: string; sender_name: string; created_at: string;
}

const FOLDER_META: Record<Folder, { label: string; icon: any; color: string }> = {
  inbox:   { label: "الوارد",   icon: Inbox,   color: "text-blue-400" },
  sent:    { label: "المُرسَل",  icon: Send,    color: "text-emerald-400" },
  drafts:  { label: "المسودات", icon: FileText, color: "text-amber-400" },
  archive: { label: "الأرشيف",  icon: Archive,  color: "text-muted-foreground" },
};

function deviceIcon(info?: string) {
  if (!info) return <Monitor className="h-3.5 w-3.5" />;
  if (/جوال/.test(info)) return <Smartphone className="h-3.5 w-3.5" />;
  if (/لوحي/.test(info)) return <Tablet className="h-3.5 w-3.5" />;
  return <Monitor className="h-3.5 w-3.5" />;
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function timeAgo(d: string | null) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  return new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function Messages() {
  const [mode, setMode] = useState<AppMode>("mail");

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] gap-0 overflow-hidden rounded-xl border bg-card">
      {/* ── Mode switcher ── */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b bg-muted/20 flex-shrink-0">
        <button
          onClick={() => setMode("mail")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
            mode === "mail"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <Mail className="h-4 w-4" />
          <span className="hidden sm:inline">البريد الداخلي</span>
        </button>
        <button
          onClick={() => setMode("conversations")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
            mode === "conversations"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <MessageSquareDot className="h-4 w-4" />
          <span className="hidden sm:inline">المحادثات</span>
        </button>
      </div>

      {/* ── Panels ── */}
      <div className="flex-1 overflow-hidden">
        {mode === "mail"          && <MailPanel />}
        {mode === "conversations" && <ConversationsPanel />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIL PANEL  (existing system — untouched logic)
══════════════════════════════════════════════════════════════════════════════ */
function MailPanel() {
  const [folder, setFolder]       = useState<Folder>("inbox");
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<Message | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [mobileView, setMobileView]   = useState<MobileView>("list");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: counts } = useQuery({
    queryKey: ["msg-counts"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/internal-messages/stats/counts`);
      if (!r.ok) return { inbox: { total: 0, unread: 0 }, sent: { total: 0 }, drafts: { total: 0 } };
      return r.json();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: messages = [], isLoading, refetch } = useQuery<Message[]>({
    queryKey: ["internal-messages", folder, search],
    queryFn: async () => {
      const params = new URLSearchParams({ folder });
      if (search) params.set("search", search);
      const r = await fetch(`${BASE}/api/internal-messages?${params}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const { data: msgDetail } = useQuery<Message>({
    queryKey: ["internal-message-detail", selected?.id],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/internal-messages/${selected!.id}`);
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
    enabled: !!selected?.id,
  });

  const archiveMut = useMutation({
    mutationFn: async (id: string) => { await fetch(`${BASE}/api/internal-messages/${id}/archive`, { method: "PUT" }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal-messages"] }); setSelected(null); setMobileView("list"); toast({ title: "تم أرشفة الرسالة" }); },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });
  const deleteMut = useMutation({
    mutationFn: async (id: string) => { await fetch(`${BASE}/api/internal-messages/${id}`, { method: "DELETE" }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal-messages"] }); setSelected(null); setMobileView("list"); toast({ title: "تم حذف الرسالة" }); },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  const detail = msgDetail ?? selected;
  const selectFolder  = (f: Folder) => { setFolder(f); setSelected(null); setMobileView("list"); };
  const selectMessage = (msg: Message) => { setSelected(msg); setMobileView("detail"); };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className={cn("flex-shrink-0 border-l flex flex-col bg-muted/20 transition-all w-full md:w-56", mobileView === "folders" ? "flex" : "hidden md:flex")}>
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileView("list")}><ChevronRight className="h-4 w-4" /></Button>
          <span className="text-sm font-medium">المجلدات</span>
        </div>
        <div className="p-3 border-b">
          <Button size="sm" className="w-full gap-2 bg-primary hover:bg-primary/90 text-white font-bold" onClick={() => { setComposeOpen(true); setMobileView("list"); }}>
            <Plus className="h-4 w-4" />رسالة جديدة
          </Button>
        </div>
        <div className="p-2 space-y-0.5 flex-1">
          {(Object.keys(FOLDER_META) as Folder[]).map(f => {
            const meta = FOLDER_META[f]; const Icon = meta.icon;
            const unread = f === "inbox" ? counts?.inbox?.unread : 0;
            return (
              <button key={f} onClick={() => selectFolder(f)} className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all", folder === f ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")}>
                <Icon className={cn("h-4 w-4 flex-shrink-0", folder === f ? meta.color : "")} />
                <span className="flex-1 text-right">{meta.label}</span>
                {unread > 0 && <Badge className="h-5 text-[10px] bg-blue-500 text-white">{unread}</Badge>}
                {f === "drafts" && counts?.drafts?.total > 0 && <Badge className="h-5 text-[10px] bg-amber-500/20 text-amber-400">{counts.drafts.total}</Badge>}
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t"><p className="text-[11px] text-muted-foreground text-center">{counts?.inbox?.total ?? 0} رسالة في الوارد</p></div>
      </div>

      {/* Message List */}
      <div className={cn("flex-shrink-0 border-l flex flex-col w-full md:w-72", mobileView === "list" ? "flex" : "hidden md:flex")}>
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-muted/10">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileView("folders")}><Menu className="h-4 w-4" /></Button>
          <span className="flex-1 text-sm font-medium text-center">{FOLDER_META[folder].label}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setComposeOpen(true)}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs pe-8" />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="hidden md:flex items-center gap-1">
            <Mail className={cn("h-3.5 w-3.5", FOLDER_META[folder].color)} />
            <span className="text-xs font-medium">{FOLDER_META[folder].label}</span>
            <span className="text-[11px] text-muted-foreground">({messages.length})</span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground px-4">
              <MessageSquare className="h-8 w-8 opacity-20" />
              <p className="text-xs text-center">لا توجد رسائل في {FOLDER_META[folder].label}</p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.map(msg => {
                const isUnread = folder === "inbox" && !msg.is_read;
                const isActive = selected?.id === msg.id;
                return (
                  <button key={msg.id} onClick={() => selectMessage(msg)} className={cn("w-full text-right p-3 hover:bg-muted/50 transition-colors block", isActive && "bg-muted/70", isUnread && "bg-blue-500/5")}>
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className={cn("text-xs truncate", isUnread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                            {folder === "inbox" ? msg.sender_name : (msg.recipients?.[0]?.userName ?? "—")}
                          </p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatDate(msg.created_at)}</span>
                        </div>
                        <p className={cn("text-xs truncate", isUnread ? "font-medium" : "text-muted-foreground")}>{msg.subject}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{msg.body.slice(0, 60)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {msg.attachments?.length > 0 && <Paperclip className="h-3 w-3 text-muted-foreground" />}
                          {msg.recipients?.length > 1 && <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Users className="h-3 w-3" />{msg.recipients.length}</div>}
                          {isUnread && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-auto" />}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message Detail */}
      <div className={cn("flex-1 flex flex-col min-w-0", mobileView === "detail" ? "flex w-full" : "hidden md:flex")}>
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <Mail className="h-16 w-16 opacity-10" />
            <p className="text-sm">اختر رسالة لعرضها</p>
          </div>
        ) : (
          <>
            <div className="p-3 sm:p-4 border-b flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 flex-shrink-0 mt-0.5" onClick={() => setMobileView("list")}><ArrowRight className="h-4 w-4" /></Button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm sm:text-base font-semibold truncate">{detail?.subject ?? selected.subject}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>من: <strong className="text-foreground">{detail?.sender_name ?? selected.sender_name}</strong></span>
                    {detail?.sender_ip && <span className="hidden sm:flex items-center gap-1">{deviceIcon(detail.device_info)} IP: {detail.sender_ip}</span>}
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(detail?.created_at ?? selected.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="أرشفة" onClick={() => archiveMut.mutate(selected.id)}><Archive className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" title="حذف" onClick={() => { if (window.confirm("هل تريد حذف هذه الرسالة نهائياً؟")) deleteMut.mutate(selected.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <ScrollArea className="flex-1 p-3 sm:p-4">
              {(detail?.recipients ?? selected.recipients)?.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />المستلمون</p>
                  <div className="flex flex-wrap gap-2">
                    {(detail?.recipients ?? selected.recipients).map((r: any) => (
                      <div key={r.userId} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-[10px] text-primary font-bold">{(r.userName ?? r.userId).charAt(0)}</span>
                        </div>
                        <span className="text-xs">{r.userName ?? r.userId}</span>
                        {r.isRead ? (
                          <div className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="h-3 w-3" />{r.readAt && <span className="text-[10px] hidden sm:inline">{formatDate(r.readAt)}</span>}</div>
                        ) : (
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">{detail?.body ?? selected.body}</div>
              {(detail?.attachments ?? selected.attachments)?.length > 0 && (
                <div className="mt-6">
                  <Separator className="mb-3" />
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5" />المرفقات</p>
                  <div className="flex flex-wrap gap-2">
                    {(detail?.attachments ?? selected.attachments).map((att: Attachment) => (
                      <a key={att.id} href={att.fileUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors text-xs">
                        <Paperclip className="h-3.5 w-3.5 text-primary" />
                        <span>{att.fileName}</span>
                        {att.fileSize && <span className="text-muted-foreground">({(att.fileSize / 1024).toFixed(0)} KB)</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {detail?.sender_ip && (
                <div className="mt-6 p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-[11px] text-muted-foreground font-medium mb-1.5">معلومات الإرسال</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <span>IP المرسِل: <strong className="text-foreground">{detail.sender_ip}</strong></span>
                    <span className="flex items-center gap-1">{deviceIcon(detail.device_info)} الجهاز: <strong className="text-foreground">{detail.device_info ?? "—"}</strong></span>
                  </div>
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </div>

      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} onSent={() => { setComposeOpen(false); qc.invalidateQueries({ queryKey: ["internal-messages"] }); qc.invalidateQueries({ queryKey: ["msg-counts"] }); }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONVERSATIONS PANEL
══════════════════════════════════════════════════════════════════════════════ */
function ConversationsPanel() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [newConvOpen, setNewConvOpen]   = useState(false);
  const [replyBody, setReplyBody]       = useState("");
  const [mobileView, setMobileView]     = useState<"list" | "thread">("list");
  const threadBottomRef = useRef<HTMLDivElement>(null);

  /* ── List of conversations ── */
  const { data: convList = [], isLoading: listLoading, refetch: refetchList } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/conversations`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  /* ── Messages inside selected conversation ── */
  const { data: threadData, isLoading: threadLoading } = useQuery<{ conversation: any; messages: ConvMessage[]; total: number }>({
    queryKey: ["conv-messages", selectedConv?.id],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/conversations/${selectedConv!.id}/messages?pageSize=50`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: !!selectedConv?.id,
    staleTime: 10_000,
  });

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadData?.messages?.length]);

  /* ── SSE: refresh conversations when NEW_MESSAGE arrives ── */
  const locationRef = useRef(window.location.href);
  useEffect(() => {
    locationRef.current = window.location.href;
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent;
      const payload = ev.detail?.payload;
      if (!payload) return;
      /* refresh conversation list */
      qc.invalidateQueries({ queryKey: ["conversations"] });
      /* if the current open thread received a new message, refresh it */
      if (payload.conversationId) {
        qc.invalidateQueries({ queryKey: ["conv-messages", payload.conversationId] });
      }
    };
    window.addEventListener("sse:NEW_MESSAGE", handler);
    return () => window.removeEventListener("sse:NEW_MESSAGE", handler);
  }, [qc]);

  /* ── Send reply ── */
  const sendMut = useMutation({
    mutationFn: async (body: string) => {
      const r = await fetch(`${BASE}/api/conversations/${selectedConv!.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!r.ok) throw new Error("فشل الإرسال");
      return r.json();
    },
    onSuccess: () => {
      setReplyBody("");
      qc.invalidateQueries({ queryKey: ["conv-messages", selectedConv?.id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const handleSend = () => {
    if (!replyBody.trim() || !selectedConv) return;
    sendMut.mutate(replyBody);
  };

  const selectConv = (c: Conversation) => { setSelectedConv(c); setMobileView("thread"); };

  const convLabel = (c: Conversation) => {
    if (c.title) return c.title;
    if (c.type === "direct") return "محادثة مباشرة";
    return "مجموعة";
  };

  const messages = threadData?.messages ?? [];

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Conversation list ── */}
      <div className={cn("flex-shrink-0 border-l flex flex-col w-full md:w-72", mobileView === "list" ? "flex" : "hidden md:flex")}>
        <div className="p-3 border-b flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold"
            onClick={() => setNewConvOpen(true)}
          >
            <Plus className="h-4 w-4" />محادثة جديدة
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetchList()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {listLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : convList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground px-4">
              <MessageSquareDot className="h-8 w-8 opacity-20" />
              <p className="text-xs text-center">لا توجد محادثات بعد</p>
              <Button size="sm" variant="outline" onClick={() => setNewConvOpen(true)}>ابدأ محادثة</Button>
            </div>
          ) : (
            <div className="divide-y">
              {convList.map(c => {
                const isActive = selectedConv?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => selectConv(c)}
                    className={cn("w-full text-right p-3 hover:bg-muted/50 transition-colors block", isActive && "bg-muted/70")}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Avatar */}
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold",
                        c.type === "group" ? "bg-violet-500/20 text-violet-400" : "bg-primary/15 text-primary",
                      )}>
                        {c.type === "group" ? <Users className="h-4 w-4" /> : convLabel(c).charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="text-xs font-semibold text-foreground truncate">{convLabel(c)}</p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(c.last_message_at ?? c.created_at)}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{c.last_message ?? "لا توجد رسائل بعد"}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {c.type === "group" && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Users className="h-3 w-3" />{c.member_count}
                            </span>
                          )}
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4", c.type === "group" ? "border-violet-500/40 text-violet-400" : "border-primary/40 text-primary")}>
                            {c.type === "group" ? "مجموعة" : "مباشرة"}
                          </Badge>
                          {c.my_role === "admin" && <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-400 border-0">مسؤول</Badge>}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right: Thread ── */}
      <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden", mobileView === "thread" ? "flex w-full" : "hidden md:flex")}>
        {!selectedConv ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <MessageSquareDot className="h-16 w-16 opacity-10" />
            <p className="text-sm">اختر محادثة لعرض الرسائل</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="p-3 border-b flex items-center gap-3 flex-shrink-0">
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileView("list")}>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0", selectedConv.type === "group" ? "bg-violet-500/20 text-violet-400" : "bg-primary/15 text-primary")}>
                {selectedConv.type === "group" ? <Users className="h-4 w-4" /> : convLabel(selectedConv).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{convLabel(selectedConv)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {selectedConv.member_count} {selectedConv.member_count === 1 ? "عضو" : "أعضاء"}
                  {" · "}
                  {selectedConv.type === "group" ? "مجموعة" : "محادثة مباشرة"}
                </p>
              </div>
              {/* Member info from thread data */}
              {threadData?.conversation?.members && (
                <div className="flex -space-x-1.5">
                  {(threadData.conversation.members as any[]).slice(0, 4).map((m: any) => (
                    <div key={m.userId} title={m.userName} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center">
                      <span className="text-[9px] text-primary font-bold">{(m.userName ?? "?").charAt(0)}</span>
                    </div>
                  ))}
                </div>
              )}
              <AddMemberButton convId={selectedConv.id} isAdmin={selectedConv.my_role === "admin"} onAdded={() => { qc.invalidateQueries({ queryKey: ["conv-messages", selectedConv.id] }); }} />
            </div>

            {/* Messages scroll area */}
            <ScrollArea className="flex-1 px-3 py-2">
              {threadLoading ? (
                <div className="flex items-center justify-center py-12"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 opacity-20" />
                  <p className="text-xs">لا توجد رسائل — كن أول من يكتب!</p>
                </div>
              ) : (
                <div className="space-y-3 pb-2">
                  {messages.map(msg => {
                    const isMe = msg.sender_id === userId;
                    return (
                      <div key={msg.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1", isMe ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                          {(msg.sender_name ?? "؟").charAt(0)}
                        </div>
                        <div className={cn("max-w-[75%] flex flex-col", isMe ? "items-end" : "items-start")}>
                          <div className={cn("rounded-2xl px-3 py-2 text-sm leading-relaxed", isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm")}>
                            {msg.body}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                            {isMe ? "أنت" : msg.sender_name} · {timeAgo(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadBottomRef} />
                </div>
              )}
            </ScrollArea>

            {/* Reply box */}
            <div className="p-3 border-t flex-shrink-0 bg-background">
              <div className="flex gap-2 items-end">
                <Textarea
                  placeholder="اكتب رسالتك..."
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  rows={2}
                  className="flex-1 text-sm resize-none min-h-[56px]"
                  dir="rtl"
                />
                <Button
                  size="sm"
                  className="gap-1.5 self-end"
                  onClick={handleSend}
                  disabled={!replyBody.trim() || sendMut.isPending}
                >
                  {sendMut.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">إرسال</span>
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Enter للإرسال · Shift+Enter لسطر جديد</p>
            </div>
          </>
        )}
      </div>

      <NewConversationDialog
        open={newConvOpen}
        onClose={() => setNewConvOpen(false)}
        onCreated={(conv) => {
          setNewConvOpen(false);
          qc.invalidateQueries({ queryKey: ["conversations"] });
          setSelectedConv(conv);
          setMobileView("thread");
        }}
      />
    </div>
  );
}

/* ── Add Member Button ──────────────────────────────────────────────────── */
function AddMemberButton({ convId, isAdmin, onAdded }: { convId: string; isAdmin: boolean; onAdded: () => void }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const { toast }           = useToast();

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["users-for-compose"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/users`);
      if (!r.ok) return [];
      const d = await r.json();
      return d.users ?? d;
    },
    enabled: open,
  });

  const addMut = useMutation({
    mutationFn: async ({ newUserId, newUserName }: { newUserId: string; newUserName: string }) => {
      const r = await fetch(`${BASE}/api/conversations/${convId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUserId, newUserName }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "فشل"); }
    },
    onSuccess: () => { toast({ title: "تم إضافة العضو" }); setOpen(false); onAdded(); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  if (!isAdmin) return null;

  const filtered = users.filter(u =>
    (u.fullName ?? u.full_name ?? u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="إضافة عضو" onClick={() => setOpen(true)}>
        <Users className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={v => !v && setOpen(false)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" />إضافة عضو للمجموعة</DialogTitle></DialogHeader>
          <Input placeholder="ابحث عن موظف..." value={search} onChange={e => setSearch(e.target.value)} className="text-sm" />
          <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border p-1">
            {filtered.slice(0, 10).map(u => (
              <button
                key={u.id}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 rounded-md text-sm text-right"
                onClick={() => addMut.mutate({ newUserId: u.id, newUserName: u.fullName ?? u.full_name ?? u.email })}
              >
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] text-primary font-bold">{(u.fullName ?? u.email ?? "").charAt(0)}</div>
                <div><p className="text-xs font-medium">{u.fullName ?? u.full_name}</p><p className="text-[10px] text-muted-foreground">{u.email}</p></div>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">لا نتائج</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── New Conversation Dialog ────────────────────────────────────────────── */
function NewConversationDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (conv: Conversation) => void }) {
  const [type, setType]         = useState<"direct" | "group">("direct");
  const [title, setTitle]       = useState("");
  const [members, setMembers]   = useState<Recipient[]>([]);
  const [search, setSearch]     = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [caseId, setCaseId]     = useState<string>("");
  const [caseSearch, setCaseSearch] = useState("");
  const [showCaseDrop, setShowCaseDrop] = useState(false);
  const { toast } = useToast();

  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ["cases-for-conv"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/cases?limit=50`);
      if (!r.ok) return [];
      const d = await r.json();
      return d.cases ?? d;
    },
    enabled: open,
    staleTime: 60_000,
  });

  const filteredCases = cases.filter((c: any) =>
    (c.title ?? "").toLowerCase().includes(caseSearch.toLowerCase()) ||
    (c.case_number ?? "").includes(caseSearch)
  );
  const selectedCase = cases.find((c: any) => c.id === caseId);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["users-for-compose"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/users`);
      if (!r.ok) return [];
      const d = await r.json();
      return d.users ?? d;
    },
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:     title.trim() || undefined,
          type,
          memberIds: members.map(m => m.userId),
          caseId:    caseId || null,
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "فشل"); }
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "تم إنشاء المحادثة" });
      setTitle(""); setMembers([]); setSearch(""); setCaseId(""); setCaseSearch("");
      onCreated(data.conversation);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = users.filter(u =>
    (u.fullName ?? u.full_name ?? u.email ?? "").toLowerCase().includes(search.toLowerCase()) &&
    !members.find(m => m.userId === u.id)
  );

  const reset = () => {
    setTitle(""); setMembers([]); setSearch(""); setType("direct");
    setCaseId(""); setCaseSearch(""); setShowCaseDrop(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareDot className="h-5 w-5 text-primary" />محادثة جديدة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div>
            <Label className="text-xs mb-2 block">نوع المحادثة</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["direct", "group"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border text-sm transition-all",
                    type === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {t === "direct" ? <MessageSquare className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                  {t === "direct" ? "مباشرة" : "مجموعة"}
                </button>
              ))}
            </div>
          </div>

          {/* Group title */}
          {type === "group" && (
            <div>
              <Label className="text-xs mb-1.5 block">عنوان المجموعة *</Label>
              <Input placeholder="مثال: فريق القضايا التجارية" value={title} onChange={e => setTitle(e.target.value)} className="text-sm" />
            </div>
          )}

          {/* Members */}
          <div>
            <Label className="text-xs mb-1.5 block">الأعضاء{type === "direct" ? " (اختر شخصاً واحداً)" : ""}</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[42px] cursor-text" onClick={() => setShowDrop(true)}>
              {members.map(m => (
                <span key={m.userId} className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs">
                  {m.userName}
                  <button onClick={(e) => { e.stopPropagation(); setMembers(prev => prev.filter(x => x.userId !== m.userId)); }}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                placeholder={members.length === 0 ? "اكتب اسم الموظف..." : type === "direct" ? "" : "إضافة آخر..."}
                value={search}
                onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
                onFocus={() => setShowDrop(true)}
                className="flex-1 min-w-28 bg-transparent outline-none text-xs"
                readOnly={type === "direct" && members.length >= 1}
              />
            </div>
            {showDrop && filtered.length > 0 && (
              <div className="border rounded-lg mt-1 overflow-hidden max-h-40 overflow-y-auto bg-popover z-10 relative shadow-lg">
                {filtered.slice(0, 8).map(u => (
                  <button
                    key={u.id}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-sm text-right"
                    onClick={() => {
                      const rec = { userId: u.id, userName: u.fullName ?? u.full_name ?? u.email };
                      setMembers(type === "direct" ? [rec] : prev => [...prev, rec]);
                      setSearch(""); setShowDrop(false);
                    }}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-[10px] text-primary font-bold">{(u.fullName ?? u.email ?? "").charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium">{u.fullName ?? u.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

          {/* Optional: Link to case */}
          <div>
            <Label className="text-xs mb-1.5 block">ربط بقضية <span className="text-muted-foreground">(اختياري)</span></Label>
            <div className="relative">
              <div
                className="flex items-center gap-2 p-2 border rounded-lg cursor-text min-h-[38px]"
                onClick={() => setShowCaseDrop(true)}
              >
                {selectedCase ? (
                  <span className="flex items-center gap-1.5 bg-violet-500/10 text-violet-500 rounded-full px-2.5 py-0.5 text-xs flex-1">
                    {selectedCase.title}
                    <button onClick={(e) => { e.stopPropagation(); setCaseId(""); setCaseSearch(""); }}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : (
                  <input
                    placeholder="ابحث عن قضية..."
                    value={caseSearch}
                    onChange={e => { setCaseSearch(e.target.value); setShowCaseDrop(true); }}
                    onFocus={() => setShowCaseDrop(true)}
                    className="flex-1 bg-transparent outline-none text-xs"
                  />
                )}
              </div>
              {showCaseDrop && !selectedCase && filteredCases.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 border rounded-lg overflow-hidden max-h-36 overflow-y-auto bg-popover z-20 shadow-lg">
                  {filteredCases.slice(0, 6).map((c: any) => (
                    <button
                      key={c.id}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-sm text-right"
                      onClick={() => { setCaseId(c.id); setCaseSearch(""); setShowCaseDrop(false); }}
                    >
                      <span className="text-xs font-medium truncate flex-1">{c.title}</span>
                      {c.case_number && <span className="text-[10px] text-muted-foreground flex-shrink-0">#{c.case_number}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>إلغاء</Button>
          <Button
            size="sm"
            onClick={() => createMut.mutate()}
            disabled={members.length === 0 || createMut.isPending || (type === "group" && !title.trim())}
          >
            {createMut.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin ml-1" /> : <Plus className="h-3.5 w-3.5 ml-1" />}
            إنشاء المحادثة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSE DIALOG  (old direct-messages system — unchanged)
══════════════════════════════════════════════════════════════════════════════ */
function ComposeDialog({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject]           = useState("");
  const [body, setBody]                 = useState("");
  const [recipients, setRecipients]     = useState<Recipient[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [showRecipients, setShowRecipients]   = useState(false);
  const { toast } = useToast();

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["users-for-compose"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/users`);
      if (!r.ok) return [];
      const d = await r.json();
      return d.users ?? d;
    },
  });

  const filteredUsers = users.filter(u =>
    (u.fullName ?? u.full_name ?? u.email ?? "").toLowerCase().includes(recipientSearch.toLowerCase()) &&
    !recipients.find(r => r.userId === u.id)
  );

  const sendMut = useMutation({
    mutationFn: async (folder: "sent" | "draft") => {
      const r = await fetch(`${BASE}/api/internal-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, recipients, folder }),
      });
      if (!r.ok) throw new Error("فشل الإرسال");
    },
    onSuccess: (_, folder) => {
      toast({ title: folder === "draft" ? "تم حفظ المسودة" : "تم إرسال الرسالة" });
      setSubject(""); setBody(""); setRecipients([]);
      onSent();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-full max-w-lg sm:max-w-2xl mx-2 sm:mx-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" />رسالة داخلية جديدة</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs mb-1.5 block">المستلمون</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[42px] cursor-text" onClick={() => setShowRecipients(true)}>
              {recipients.map(r => (
                <span key={r.userId} className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs">
                  {r.userName}
                  <button onClick={() => setRecipients(prev => prev.filter(x => x.userId !== r.userId))}><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input
                placeholder={recipients.length === 0 ? "اكتب اسم الموظف..." : "إضافة آخر..."}
                value={recipientSearch}
                onChange={e => { setRecipientSearch(e.target.value); setShowRecipients(true); }}
                onFocus={() => setShowRecipients(true)}
                className="flex-1 min-w-28 bg-transparent outline-none text-xs"
              />
            </div>
            {showRecipients && filteredUsers.length > 0 && (
              <div className="border rounded-lg mt-1 overflow-hidden max-h-40 overflow-y-auto bg-popover z-10 relative shadow-lg">
                {filteredUsers.slice(0, 8).map(u => (
                  <button
                    key={u.id}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-sm text-right"
                    onClick={() => { setRecipients(prev => [...prev, { userId: u.id, userName: u.fullName ?? u.full_name ?? u.email }]); setRecipientSearch(""); setShowRecipients(false); }}
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-[10px] text-primary font-bold">{(u.fullName ?? u.email ?? "").charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium">{u.fullName ?? u.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">الموضوع</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="موضوع الرسالة" className="text-sm" />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">الرسالة</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="اكتب رسالتك هنا..." rows={5} className="text-sm resize-none" dir="rtl" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => sendMut.mutate("draft")} disabled={sendMut.isPending}>حفظ مسودة</Button>
          <Button size="sm" onClick={() => sendMut.mutate("sent")} disabled={!subject || !body || recipients.length === 0 || sendMut.isPending}>
            {sendMut.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin ml-1" /> : <Send className="h-3.5 w-3.5 ml-1" />}إرسال
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
