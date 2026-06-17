import { useState, useRef } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Inbox, Send, FileText, Archive, Search, Plus, RefreshCw,
  Paperclip, Trash2, MoreVertical, ChevronDown, X, Users,
  CheckCircle2, Eye, Monitor, Smartphone, Tablet, Clock,
  AlertCircle, Mail, MessageSquare
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Folder = "inbox" | "sent" | "drafts" | "archive";

interface Recipient { userId: string; userName: string; }
interface Attachment { id: string; fileName: string; fileUrl: string; fileSize?: number; }
interface Message {
  id: string;
  subject: string;
  body: string;
  sender_id: string;
  sender_name: string;
  sender_ip?: string;
  device_info?: string;
  created_at: string;
  folder: string;
  tags: string[];
  recipients: Array<{ userId: string; userName: string; isRead: boolean; readAt?: string; readerIp?: string; }>;
  attachments: Attachment[];
  is_read?: boolean;
  read_at?: string;
  reader_ip?: string;
}

const FOLDER_META: Record<Folder, { label: string; icon: any; color: string }> = {
  inbox:   { label: "الوارد",   icon: Inbox,    color: "text-blue-400" },
  sent:    { label: "المُرسَل",  icon: Send,     color: "text-emerald-400" },
  drafts:  { label: "المسودات", icon: FileText,  color: "text-amber-400" },
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

export default function Messages() {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Message | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  // Counts
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

  // Messages list
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

  // Open message detail
  const { data: msgDetail } = useQuery<Message>({
    queryKey: ["internal-message-detail", selected?.id],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/internal-messages/${selected!.id}`);
      if (!r.ok) throw new Error("not found");
      return r.json();
    },
    enabled: !!selected?.id,
  });

  // Archive
  const archiveMut = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/api/internal-messages/${id}/archive`, { method: "PUT" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal-messages"] }); setSelected(null); toast({ title: "تم أرشفة الرسالة" }); },
  });

  // Delete
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${BASE}/api/internal-messages/${id}`, { method: "DELETE" });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["internal-messages"] }); setSelected(null); toast({ title: "تم حذف الرسالة" }); },
  });

  const detail = msgDetail ?? selected;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0 overflow-hidden rounded-xl border bg-card">
      {/* ── Sidebar ── */}
      <div className="w-56 flex-shrink-0 border-l flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <Button size="sm" className="w-full gap-2 bg-primary hover:bg-primary/90 text-white font-bold" onClick={() => setComposeOpen(true)}>
            <Plus className="h-4 w-4" />رسالة جديدة
          </Button>
        </div>
        <div className="p-2 space-y-0.5 flex-1">
          {(Object.keys(FOLDER_META) as Folder[]).map(f => {
            const meta = FOLDER_META[f];
            const Icon = meta.icon;
            const unread = f === "inbox" ? counts?.inbox?.unread : 0;
            return (
              <button
                key={f}
                onClick={() => { setFolder(f); setSelected(null); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all",
                  folder === f ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 flex-shrink-0", folder === f ? meta.color : "")} />
                <span className="flex-1 text-right">{meta.label}</span>
                {unread > 0 && (
                  <Badge className="h-5 text-[10px] bg-blue-500 text-white">{unread}</Badge>
                )}
                {f === "drafts" && counts?.drafts?.total > 0 && (
                  <Badge className="h-5 text-[10px] bg-amber-500/20 text-amber-400">{counts.drafts.total}</Badge>
                )}
              </button>
            );
          })}
        </div>
        <div className="p-3 border-t">
          <p className="text-[11px] text-muted-foreground text-center">
            {counts?.inbox?.total ?? 0} رسالة في الوارد
          </p>
        </div>
      </div>

      {/* ── Message List ── */}
      <div className="w-72 flex-shrink-0 border-l flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="بحث..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-7 text-xs pr-8"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Mail className={cn("h-3.5 w-3.5", FOLDER_META[folder].color)} />
            <span className="text-xs font-medium">{FOLDER_META[folder].label}</span>
            <span className="text-[11px] text-muted-foreground">({messages.length})</span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
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
                  <button
                    key={msg.id}
                    onClick={() => setSelected(msg)}
                    className={cn(
                      "w-full text-right p-3 hover:bg-muted/50 transition-colors block",
                      isActive && "bg-muted/70",
                      isUnread && "bg-blue-500/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className={cn("text-xs truncate", isUnread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                            {folder === "inbox" ? msg.sender_name : (msg.recipients?.[0]?.userName ?? "—")}
                          </p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                        <p className={cn("text-xs truncate", isUnread ? "font-medium" : "text-muted-foreground")}>
                          {msg.subject}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {msg.body.slice(0, 60)}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          {msg.attachments?.length > 0 && (
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                          )}
                          {msg.recipients?.length > 1 && (
                            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {msg.recipients.length}
                            </div>
                          )}
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

      {/* ── Message Detail ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <Mail className="h-16 w-16 opacity-10" />
            <p className="text-sm">اختر رسالة لعرضها</p>
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold truncate">{detail?.subject ?? selected.subject}</h2>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>من: <strong className="text-foreground">{detail?.sender_name ?? selected.sender_name}</strong></span>
                  {detail?.sender_ip && (
                    <span className="flex items-center gap-1">
                      {deviceIcon(detail.device_info)}
                      IP: {detail.sender_ip}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(detail?.created_at ?? selected.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => archiveMut.mutate(selected.id)}>
                  <Archive className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => { if (window.confirm("هل تريد حذف هذه الرسالة نهائياً؟")) deleteMut.mutate(selected.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {/* Recipients */}
              {(detail?.recipients ?? selected.recipients)?.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-muted/30 border">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />المستلمون
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(detail?.recipients ?? selected.recipients).map((r: any) => (
                      <div key={r.userId} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1">
                        <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-[10px] text-primary font-bold">{(r.userName ?? r.userId).charAt(0)}</span>
                        </div>
                        <span className="text-xs">{r.userName ?? r.userId}</span>
                        {r.isRead ? (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            {r.readAt && <span className="text-[10px]">{formatDate(r.readAt)}</span>}
                            {r.readerIp && <span className="text-[10px] opacity-60">({r.readerIp})</span>}
                          </div>
                        ) : (
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Body */}
              <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                {detail?.body ?? selected.body}
              </div>

              {/* Attachments */}
              {(detail?.attachments ?? selected.attachments)?.length > 0 && (
                <div className="mt-6">
                  <Separator className="mb-3" />
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />المرفقات
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(detail?.attachments ?? selected.attachments).map((att: Attachment) => (
                      <a
                        key={att.id}
                        href={att.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors text-xs"
                      >
                        <Paperclip className="h-3.5 w-3.5 text-primary" />
                        <span>{att.fileName}</span>
                        {att.fileSize && <span className="text-muted-foreground">({(att.fileSize / 1024).toFixed(0)} KB)</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* IP Tracking Info */}
              {detail?.sender_ip && (
                <div className="mt-6 p-3 rounded-lg bg-muted/30 5 border border-slate-500/10">
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

      {/* ── Compose Dialog ── */}
      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} onSent={() => { setComposeOpen(false); qc.invalidateQueries({ queryKey: ["internal-messages"] }); qc.invalidateQueries({ queryKey: ["msg-counts"] }); }} />
    </div>
  );
}

// ── ComposeDialog ─────────────────────────────────────────────────────────────
function ComposeDialog({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [showRecipients, setShowRecipients] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
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
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />رسالة داخلية جديدة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipients */}
          <div>
            <Label className="text-xs mb-1.5 block">المستلمون</Label>
            <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[42px] cursor-text" onClick={() => setShowRecipients(true)}>
              {recipients.map(r => (
                <span key={r.userId} className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-xs">
                  {r.userName}
                  <button onClick={() => setRecipients(prev => prev.filter(x => x.userId !== r.userId))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                placeholder={recipients.length === 0 ? "اكتب اسم الموظف..." : "إضافة آخر..."}
                value={recipientSearch}
                onChange={e => { setRecipientSearch(e.target.value); setShowRecipients(true); }}
                onFocus={() => setShowRecipients(true)}
                className="flex-1 min-w-32 bg-transparent outline-none text-xs"
              />
            </div>
            {showRecipients && filteredUsers.length > 0 && (
              <div className="border rounded-lg mt-1 overflow-hidden max-h-40 overflow-y-auto bg-popover z-10 relative shadow-lg">
                {filteredUsers.slice(0, 8).map(u => (
                  <button
                    key={u.id}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 text-sm text-right"
                    onClick={() => {
                      setRecipients(prev => [...prev, { userId: u.id, userName: u.fullName ?? u.full_name ?? u.email }]);
                      setRecipientSearch("");
                      setShowRecipients(false);
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

          {/* Subject */}
          <div>
            <Label className="text-xs mb-1.5 block">الموضوع</Label>
            <Input placeholder="موضوع الرسالة" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          {/* Body */}
          <div>
            <Label className="text-xs mb-1.5 block">نص الرسالة</Label>
            <Textarea
              placeholder="اكتب رسالتك هنا..."
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            onClick={() => sendMut.mutate("sent")}
            disabled={!subject.trim() || !body.trim() || recipients.length === 0 || sendMut.isPending}
            className="gap-2 bg-primary hover:bg-primary/90 text-white"
          >
            <Send className="h-4 w-4" />
            {sendMut.isPending ? "جارٍ الإرسال..." : `إرسال (${recipients.length})`}
          </Button>
          <Button
            variant="outline"
            onClick={() => sendMut.mutate("draft")}
            disabled={!subject.trim() || sendMut.isPending}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />حفظ كمسودة
          </Button>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
