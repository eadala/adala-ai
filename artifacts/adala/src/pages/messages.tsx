import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Search, Send, MessageCircle, Mail, Phone, Plus,
  Check, CheckCheck, Clock, Star, StarOff, Archive,
  Trash2, Filter, ChevronDown, Paperclip, Smile,
  MoreVertical, RefreshCw, PhoneCall, Video,
  FileText, AlertCircle, Users, X, Zap
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

type Channel = "whatsapp" | "email" | "sms" | "internal";
type MsgStatus = "sent" | "delivered" | "read" | "failed";

interface Message {
  id: string;
  from: "me" | "client";
  content: string;
  time: string;
  status?: MsgStatus;
  channel: Channel;
}

interface Conversation {
  id: string;
  name: string;
  channel: Channel;
  lastMsg: string;
  time: string;
  unread: number;
  starred: boolean;
  online: boolean;
  caseRef?: string;
  messages: Message[];
}

const TEMPLATES = [
  { label: "تأكيد الموعد", text: "نؤكد موعدك يوم {{date}} الساعة {{time}}. يُرجى الحضور في الوقت المحدد." },
  { label: "طلب مستند", text: "نرجو تزويدنا بـ {{document}} في أقرب وقت ممكن لاستكمال ملف القضية." },
  { label: "تحديث القضية", text: "نود إعلامكم بتحديث جلسة القضية رقم {{case}}. سيتم إخطاركم بالتفاصيل قريباً." },
  { label: "طلب رسوم", text: "يُرجى سداد الرسوم المستحقة بمبلغ {{amount}} ريال خلال {{days}} أيام." },
  { label: "ترحيب بعميل", text: "أهلاً وسهلاً {{name}}، نشكرك على ثقتك بمكتبنا. نحن هنا لخدمتك في أي وقت." },
  { label: "إغلاق القضية", text: "يسعدنا إبلاغكم بإغلاق القضية رقم {{case}} بنجاح. شكراً لتعاونكم معنا." },
];

const INITIAL_CONVS: Conversation[] = [
  {
    id: "1", name: "محمد العمري", channel: "whatsapp", unread: 3, starred: true, online: true,
    caseRef: "QD-2024-001",
    lastMsg: "متى موعد الجلسة القادمة؟",
    time: "الآن",
    messages: [
      { id: "m1", from: "client", content: "السلام عليكم، كيف حال القضية؟", time: "10:00 ص", channel: "whatsapp" },
      { id: "m2", from: "me", content: "وعليكم السلام، القضية تسير بشكل جيد. جلسة الاستماع محددة الأسبوع القادم.", time: "10:15 ص", status: "read", channel: "whatsapp" },
      { id: "m3", from: "client", content: "الحمدلله، متى موعد الجلسة القادمة؟", time: "10:20 ص", channel: "whatsapp" },
    ],
  },
  {
    id: "2", name: "شركة الرواد للتطوير", channel: "email", unread: 1, starred: false, online: false,
    caseRef: "QD-2024-008",
    lastMsg: "نرجو مراجعة العقد المرفق وإبداء ملاحظاتكم",
    time: "منذ ساعة",
    messages: [
      { id: "m1", from: "client", content: "تحية طيبة،\n\nنرجو مراجعة العقد المرفق وإبداء ملاحظاتكم القانونية في أقرب وقت ممكن.\n\nمع التقدير", time: "أمس", channel: "email" },
    ],
  },
  {
    id: "3", name: "سارة الزهراني", channel: "whatsapp", unread: 0, starred: true, online: true,
    caseRef: "QD-2024-012",
    lastMsg: "شكراً جزيلاً على متابعتكم",
    time: "أمس",
    messages: [
      { id: "m1", from: "me", content: "تم رفع المستندات المطلوبة إلى المحكمة بنجاح.", time: "أمس", status: "delivered", channel: "whatsapp" },
      { id: "m2", from: "client", content: "شكراً جزيلاً على متابعتكم الممتازة!", time: "أمس", channel: "whatsapp" },
    ],
  },
  {
    id: "4", name: "عبدالله الحربي", channel: "sms", unread: 0, starred: false, online: false,
    lastMsg: "حسناً، سأكون في مكتبكم غداً",
    time: "منذ يومين",
    messages: [
      { id: "m1", from: "me", content: "يرجى الحضور لتوقيع وكالة الدعوى.", time: "منذ يومين", status: "read", channel: "sms" },
      { id: "m2", from: "client", content: "حسناً، سأكون في مكتبكم غداً", time: "منذ يومين", channel: "sms" },
    ],
  },
  {
    id: "5", name: "مجموعة القانون التجاري", channel: "internal", unread: 5, starred: false, online: true,
    lastMsg: "هل راجعتم ملف الشركة الجديدة؟",
    time: "منذ 30 دقيقة",
    messages: [
      { id: "m1", from: "client", content: "يا شباب، هل راجعتم ملف شركة النخيل؟", time: "11:00 ص", channel: "internal" },
      { id: "m2", from: "me", content: "نعم، جارٍ مراجعته الآن.", time: "11:05 ص", status: "read", channel: "internal" },
      { id: "m3", from: "client", content: "ممتاز، هل راجعتم ملف الشركة الجديدة؟", time: "11:30 ص", channel: "internal" },
    ],
  },
  {
    id: "6", name: "فاطمة القحطاني", channel: "email", unread: 0, starred: false, online: false,
    caseRef: "QD-2024-003",
    lastMsg: "تم استلام الرد، شكراً",
    time: "الاثنين",
    messages: [
      { id: "m1", from: "client", content: "استفسار عن موعد البت في القضية.", time: "الاثنين", channel: "email" },
      { id: "m2", from: "me", content: "يُتوقع البت خلال أسبوعين من الآن.", time: "الاثنين", status: "read", channel: "email" },
      { id: "m3", from: "client", content: "تم استلام الرد، شكراً", time: "الاثنين", channel: "email" },
    ],
  },
];

const CHANNEL_CONFIG: Record<Channel, { label: string; color: string; bg: string; icon: any }> = {
  whatsapp: { label: "واتساب", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: MessageCircle },
  email:    { label: "البريد", color: "text-blue-400",    bg: "bg-blue-500/10",    icon: Mail },
  sms:      { label: "SMS",    color: "text-orange-400",  bg: "bg-orange-500/10",  icon: Phone },
  internal: { label: "داخلي", color: "text-purple-400",  bg: "bg-purple-500/10",  icon: Users },
};

function StatusIcon({ status }: { status?: MsgStatus }) {
  if (!status) return null;
  if (status === "read")      return <CheckCheck className="h-3 w-3 text-blue-400" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  if (status === "sent")      return <Check className="h-3 w-3 text-muted-foreground" />;
  return <AlertCircle className="h-3 w-3 text-destructive" />;
}

function ChannelBadge({ channel }: { channel: Channel }) {
  const cfg = CHANNEL_CONFIG[channel];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium", cfg.bg, cfg.color)}>
      <Icon className="h-2.5 w-2.5" /> {cfg.label}
    </span>
  );
}

type FilterTab = "all" | "unread" | "starred" | "whatsapp" | "email" | "internal";

export default function Messages() {
  const [convs, setConvs] = useState<Conversation[]>(INITIAL_CONVS);
  const [selected, setSelected] = useState<string | null>("1");
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [msgText, setMsgText] = useState("");
  const [sendChannel, setSendChannel] = useState<Channel>("whatsapp");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [newName, setNewName] = useState("");
  const [newChannel, setNewChannel] = useState<Channel>("whatsapp");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = convs.find(c => c.id === selected) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected, activeConv?.messages.length]);

  useEffect(() => {
    if (selected) {
      setConvs(prev => prev.map(c => c.id === selected ? { ...c, unread: 0 } : c));
      if (activeConv) setSendChannel(activeConv.channel);
    }
  }, [selected]);

  const filtered = convs.filter(c => {
    const matchSearch = c.name.includes(search) || c.lastMsg.includes(search);
    if (!matchSearch) return false;
    if (filterTab === "unread")   return c.unread > 0;
    if (filterTab === "starred")  return c.starred;
    if (filterTab === "whatsapp") return c.channel === "whatsapp";
    if (filterTab === "email")    return c.channel === "email";
    if (filterTab === "internal") return c.channel === "internal";
    return true;
  });

  const totalUnread = convs.reduce((s, c) => s + c.unread, 0);

  const handleSend = () => {
    if (!msgText.trim() || !selected) return;
    const now = new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
    const newMsg: Message = { id: Date.now().toString(), from: "me", content: msgText.trim(), time: now, status: "sent", channel: sendChannel };
    setConvs(prev => prev.map(c => c.id === selected
      ? { ...c, messages: [...c.messages, newMsg], lastMsg: msgText.trim(), time: "الآن" }
      : c
    ));
    setMsgText("");
    setTimeout(() => {
      setConvs(prev => prev.map(c => c.id === selected
        ? { ...c, messages: c.messages.map(m => m.id === newMsg.id ? { ...m, status: "delivered" } : m) }
        : c
      ));
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const toggleStar = (id: string) => setConvs(prev => prev.map(c => c.id === id ? { ...c, starred: !c.starred } : c));

  const handleCreateConv = () => {
    if (!newName.trim()) return;
    const id = Date.now().toString();
    setConvs(prev => [{
      id, name: newName.trim(), channel: newChannel, unread: 0, starred: false, online: true,
      lastMsg: "بدء محادثة جديدة", time: "الآن", messages: [],
    }, ...prev]);
    setSelected(id);
    setShowNewConv(false);
    setNewName("");
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all",      label: "الكل" },
    { key: "unread",   label: "غير مقروء" },
    { key: "starred",  label: "المميزة" },
    { key: "whatsapp", label: "واتساب" },
    { key: "email",    label: "البريد" },
    { key: "internal", label: "داخلي" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-0">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            تواصل
            {totalUnread > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs px-2">{totalUnread}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">واتساب · بريد إلكتروني · SMS · محادثات داخلية</p>
        </div>
        <Button onClick={() => setShowNewConv(true)} className="gap-2">
          <Plus className="h-4 w-4" /> محادثة جديدة
        </Button>
      </div>

      <Card className="flex-1 flex overflow-hidden border-border/60 shadow-sm min-h-0">
        {/* ─── SIDEBAR ─── */}
        <div className="w-72 border-l border-border/60 flex flex-col flex-shrink-0 bg-sidebar/20">
          {/* Search */}
          <div className="p-3 border-b border-border/40">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث في المحادثات..."
                className="pr-9 h-8 text-sm bg-muted/30"
              />
              {search && <button onClick={() => setSearch("")} className="absolute left-2 top-1/2 -translate-y-1/2"><X className="h-3 w-3 text-muted-foreground" /></button>}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-0.5 p-2 border-b border-border/40 flex-wrap">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setFilterTab(t.key)}
                className={cn(
                  "text-[10px] font-medium px-2 py-1 rounded-md transition-all whitespace-nowrap",
                  filterTab === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}>{t.label}</button>
            ))}
          </div>

          {/* Conversation list */}
          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
                <MessageCircle className="h-8 w-8 mb-2 opacity-20" />
                لا توجد محادثات
              </div>
            ) : (
              filtered.map(conv => {
                const cfg = CHANNEL_CONFIG[conv.channel];
                const Icon = cfg.icon;
                const isActive = selected === conv.id;
                return (
                  <div key={conv.id}
                    onClick={() => setSelected(conv.id)}
                    className={cn(
                      "flex items-start gap-2.5 px-3 py-3 cursor-pointer border-b border-border/30 transition-all group",
                      isActive ? "bg-primary/10 border-r-2 border-r-primary" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs font-bold" style={{ background: isActive ? "hsl(var(--primary)/0.2)" : undefined }}>
                          {conv.name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      {conv.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn("text-sm font-semibold truncate", conv.unread > 0 && "font-bold")}>{conv.name}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">{conv.time}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon className={cn("h-3 w-3 flex-shrink-0", cfg.color)} />
                        <p className={cn("text-xs truncate flex-1", conv.unread > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                          {conv.lastMsg}
                        </p>
                        {conv.unread > 0 && (
                          <Badge className="h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground rounded-full flex-shrink-0">
                            {conv.unread}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <ChannelBadge channel={conv.channel} />
                        {conv.caseRef && <span className="text-[10px] text-muted-foreground/60">{conv.caseRef}</span>}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleStar(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    >
                      {conv.starred
                        ? <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                        : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                  </div>
                );
              })
            )}
          </ScrollArea>
        </div>

        {/* ─── MAIN CHAT AREA ─── */}
        {activeConv ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Chat header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card/60 backdrop-blur flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-sm font-bold">{activeConv.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  {activeConv.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{activeConv.name}</span>
                    <ChannelBadge channel={activeConv.channel} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {activeConv.online ? "متصل الآن" : "غير متصل"}
                    {activeConv.caseRef && ` · ${activeConv.caseRef}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" title="اتصال"><PhoneCall className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="فيديو"><Video className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" title="ملف العميل"><FileText className="h-4 w-4" /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toggleStar(activeConv.id)}>
                      <Star className="h-4 w-4 ml-2" /> {activeConv.starred ? "إزالة من المميزة" : "تمييز المحادثة"}
                    </DropdownMenuItem>
                    <DropdownMenuItem><Archive className="h-4 w-4 ml-2" /> أرشفة</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="h-4 w-4 ml-2" /> حذف المحادثة
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              <div className="space-y-3 max-w-2xl mx-auto">
                {activeConv.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <MessageCircle className="h-12 w-12 mb-3 opacity-20" />
                    <p className="text-sm">ابدأ المحادثة</p>
                  </div>
                ) : (
                  activeConv.messages.map((msg, i) => {
                    const isMe = msg.from === "me";
                    const showDate = i === 0 || activeConv.messages[i - 1].time !== msg.time;
                    return (
                      <div key={msg.id}>
                        {i === 0 && (
                          <div className="text-center mb-3">
                            <span className="text-[10px] text-muted-foreground bg-muted/40 px-3 py-1 rounded-full">اليوم</span>
                          </div>
                        )}
                        <div className={cn("flex", isMe ? "justify-start" : "justify-end")}>
                          <div className={cn(
                            "max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm",
                            isMe
                              ? "bg-primary text-primary-foreground rounded-tr-sm"
                              : "bg-card border border-border/60 rounded-tl-sm"
                          )}>
                            {msg.channel !== activeConv.channel && (
                              <div className="mb-1"><ChannelBadge channel={msg.channel} /></div>
                            )}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            <div className={cn("flex items-center gap-1 mt-1", isMe ? "justify-start flex-row-reverse" : "justify-end")}>
                              <span className={cn("text-[10px]", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>{msg.time}</span>
                              {isMe && <StatusIcon status={msg.status} />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Templates panel */}
            {showTemplates && (
              <div className="border-t border-border/60 bg-muted/20 p-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold flex items-center gap-1"><Zap className="h-3 w-3 text-primary" /> قوالب سريعة</span>
                  <button onClick={() => setShowTemplates(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {TEMPLATES.map(t => (
                    <button key={t.label} onClick={() => { setMsgText(t.text); setShowTemplates(false); }}
                      className="text-right text-[11px] p-2.5 rounded-lg bg-card border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all">
                      <div className="font-semibold text-foreground mb-0.5">{t.label}</div>
                      <div className="text-muted-foreground line-clamp-2 leading-snug">{t.text}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Composer */}
            <div className="p-3 border-t border-border/60 bg-card flex-shrink-0">
              <div className="flex items-end gap-2">
                {/* Channel selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 px-2.5 flex-shrink-0 text-xs", CHANNEL_CONFIG[sendChannel].color)}>
                      {(() => { const cfg = CHANNEL_CONFIG[sendChannel]; const Icon = cfg.icon; return <Icon className="h-3.5 w-3.5" />; })()}
                      {CHANNEL_CONFIG[sendChannel].label}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <DropdownMenuItem key={key} onClick={() => setSendChannel(key as Channel)} className={cn("gap-2", cfg.color)}>
                          <Icon className="h-4 w-4" /> {cfg.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex-1 relative">
                  <Textarea
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="اكتب رسالتك... (Enter للإرسال، Shift+Enter لسطر جديد)"
                    className="min-h-[40px] max-h-32 resize-none text-sm py-2 pr-3 pl-20 rounded-xl bg-muted/30 border-border/50"
                    rows={1}
                  />
                  <div className="absolute left-2 bottom-2 flex items-center gap-1">
                    <button className="text-muted-foreground hover:text-foreground transition-colors p-1"><Paperclip className="h-3.5 w-3.5" /></button>
                    <button
                      onClick={() => setShowTemplates(!showTemplates)}
                      className={cn("transition-colors p-1", showTemplates ? "text-primary" : "text-muted-foreground hover:text-foreground")}
                      title="قوالب سريعة"
                    ><Zap className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                <Button
                  onClick={handleSend}
                  disabled={!msgText.trim()}
                  size="icon"
                  className="h-9 w-9 rounded-xl flex-shrink-0"
                >
                  <Send className="h-4 w-4 rotate-180" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                الإرسال عبر {CHANNEL_CONFIG[sendChannel].label} · Enter للإرسال
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
            <MessageCircle className="h-16 w-16 opacity-10 mb-4" />
            <p className="text-lg font-medium">اختر محادثة للبدء</p>
            <p className="text-sm mt-1">أو أنشئ محادثة جديدة مع عميل</p>
          </div>
        )}
      </Card>

      {/* New Conversation Dialog */}
      {showNewConv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowNewConv(false)}>
          <Card className="w-96 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">محادثة جديدة</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">اسم العميل / المجموعة</label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="مثال: أحمد الغامدي" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">قناة التواصل</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(CHANNEL_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={key} onClick={() => setNewChannel(key as Channel)}
                        className={cn(
                          "flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all",
                          newChannel === key ? "border-primary bg-primary/10 " + cfg.color : "border-border/60 text-muted-foreground hover:border-primary/30"
                        )}>
                        <Icon className="h-4 w-4" /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowNewConv(false)}>إلغاء</Button>
              <Button className="flex-1" onClick={handleCreateConv} disabled={!newName.trim()}>إنشاء</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
