import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  BrainCircuit, Send, Sparkles, Clock, Database,
  RefreshCw, Trash2, MessageSquare, ChevronDown,
  Scale, Receipt, Handshake, CalendarDays, FileText, Inbox
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  contextUsed?: string;
  timestamp: Date;
}

interface HistoryItem {
  id: string;
  question: string;
  response: string;
  context_used: string;
  created_at: string;
}

const CONTEXT_ICONS: Record<string, any> = {
  cases: Scale,
  clients: Database,
  invoices: Receipt,
  contracts: Handshake,
  events: CalendarDays,
  documents: FileText,
  messages: Inbox,
};

const CAPABILITY_CARDS = [
  { icon: Scale,       label: "القضايا",        example: "ما هي القضايا المفتوحة؟",      color: "text-blue-400",    bg: "bg-blue-500/10" },
  { icon: CalendarDays,label: "الجلسات",        example: "ما هي الجلسات القادمة؟",       color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { icon: Receipt,     label: "الفواتير",       example: "ملخص الفواتير المتأخرة",       color: "text-amber-400",   bg: "bg-amber-500/10" },
  { icon: Handshake,   label: "العقود",         example: "ما العقود التي ستنتهي قريباً؟",color: "text-violet-400",  bg: "bg-violet-500/10" },
  { icon: Database,    label: "العملاء",        example: "كم عدد العملاء النشطين؟",       color: "text-pink-400",    bg: "bg-pink-500/10" },
  { icon: Sparkles,    label: "ملخص المكتب",   example: "ملخص المكتب اليوم",            color: "text-gold",        bg: "bg-gold/10" },
];

function formatResponse(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return <p key={i} className="font-bold text-foreground mb-1">{line.slice(2, -2)}</p>;
    }
    if (/^\d+\.\s\*\*(.+?)\*\*(.*)/.test(line)) {
      return (
        <p key={i} className="mb-1">
          {line.replace(/\*\*(.+?)\*\*/g, (_, m) => `<b>${m}</b>`).split(/<b>|<\/b>/).map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          )}
        </p>
      );
    }
    if (line.startsWith("• ") || line.startsWith("- ")) {
      const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, (_, m) => `<b>${m}</b>`);
      return (
        <p key={i} className="flex gap-2 mb-0.5">
          <span className="text-gold flex-shrink-0">•</span>
          <span dangerouslySetInnerHTML={{ __html: content }} />
        </p>
      );
    }
    const boldParsed = line.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: boldParsed }} />;
  });
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: suggestions = [] } = useQuery<string[]>({
    queryKey: ["ai-suggestions"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ai-assistant/suggestions`);
      return r.json();
    },
  });

  const { data: history = [], refetch: refetchHistory } = useQuery<HistoryItem[]>({
    queryKey: ["ai-history"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/ai-assistant/history`);
      return r.json();
    },
    enabled: showHistory,
  });

  const askMut = useMutation({
    mutationFn: async (question: string) => {
      const r = await fetch(`${BASE}/api/ai-assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!r.ok) throw new Error("فشل الاتصال بالمساعد");
      return r.json();
    },
    onMutate: (question: string) => {
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: question,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
    },
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response,
        contextUsed: data.contextUsed,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    },
    onError: (e: any) => {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `عذراً، حدث خطأ: ${e.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const q = input.trim();
    if (!q || askMut.isPending) return;
    askMut.mutate(q);
  };

  const handleSuggestion = (s: string) => {
    setInput(s);
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* ── Main Chat ── */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <BrainCircuit className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold">المساعد الإداري الذكي</h1>
              <p className="text-xs text-muted-foreground">اسأل بالعربية عن أي شيء في المكتب</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
              متصل
            </Badge>
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => { setShowHistory(!showHistory); if (!showHistory) refetchHistory(); }}>
              <Clock className="h-3.5 w-3.5" />السجل
            </Button>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMessages([])}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
            {messages.length === 0 ? (
              <div className="space-y-6 py-4">
                {/* Welcome */}
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 text-gold" />
                  </div>
                  <h2 className="text-lg font-semibold mb-1">مرحباً! كيف يمكنني مساعدتك؟</h2>
                  <p className="text-sm text-muted-foreground">أنا قادر على الوصول إلى بيانات المكتب والإجابة على أسئلتك بالعربية</p>
                </div>

                {/* Capability Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {CAPABILITY_CARDS.map((cap) => {
                    const Icon = cap.icon;
                    return (
                      <button
                        key={cap.example}
                        onClick={() => handleSuggestion(cap.example)}
                        className="flex flex-col items-start gap-2 p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-all text-right group"
                      >
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", cap.bg)}>
                          <Icon className={cn("h-4 w-4", cap.color)} />
                        </div>
                        <div>
                          <p className="text-xs font-medium group-hover:text-foreground">{cap.label}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{cap.example}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Suggestions */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />أسئلة مقترحة
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        onClick={() => handleSuggestion(s)}
                        className="text-xs px-3 py-1.5 rounded-full border bg-muted/20 hover:bg-muted/50 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(msg => (
                  <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                    {/* Avatar */}
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center",
                      msg.role === "user" ? "bg-gold/15" : "bg-blue-500/10"
                    )}>
                      {msg.role === "user"
                        ? <span className="text-sm font-bold text-gold">أ</span>
                        : <BrainCircuit className="h-4 w-4 text-blue-400" />
                      }
                    </div>

                    {/* Bubble */}
                    <div className={cn(
                      "flex-1 max-w-[80%] rounded-xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-gold/10 text-foreground ml-auto"
                        : "bg-muted/50 text-foreground"
                    )}>
                      <div className="leading-relaxed">
                        {msg.role === "assistant" ? formatResponse(msg.content) : msg.content}
                      </div>
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {msg.timestamp.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {msg.contextUsed && msg.contextUsed !== "none" && msg.contextUsed !== "error" && (
                          <div className="flex items-center gap-1">
                            {msg.contextUsed.split(",").map(ctx => {
                              const Icon = CONTEXT_ICONS[ctx.trim()];
                              return Icon ? <Icon key={ctx} className="h-3 w-3 text-muted-foreground" title={ctx} /> : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Thinking indicator */}
                {askMut.isPending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <BrainCircuit className="h-4 w-4 text-blue-400 animate-pulse" />
                    </div>
                    <div className="bg-muted/50 rounded-xl px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                        <span className="text-xs text-muted-foreground mr-1">أبحث في بيانات المكتب...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t">
            {messages.length > 0 && suggestions.length > 0 && (
              <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                {suggestions.slice(0, 4).map(s => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="text-[11px] px-2.5 py-1 rounded-full border bg-muted/20 hover:bg-muted/50 transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="اسأل عن القضايا، الفواتير، الجلسات..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                className="flex-1 text-sm"
                dir="rtl"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || askMut.isPending}
                className="gap-2 bg-gold hover:bg-gold/90 text-navy"
              >
                {askMut.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                إرسال
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
              يمكنك الكتابة بالعربية • Enter للإرسال
            </p>
          </div>
        </Card>
      </div>

      {/* ── History Panel ── */}
      {showHistory && (
        <div className="w-72 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gold" />سجل المحادثات
                </span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowHistory(false)}>
                  <span className="text-lg leading-none">×</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1">
              {history.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Clock className="h-6 w-6 opacity-20 mb-2" />
                  <p className="text-xs">لا يوجد سجل بعد</p>
                </div>
              ) : (
                <div className="px-3 space-y-2">
                  {history.map(item => (
                    <button
                      key={item.id}
                      className="w-full text-right p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setMessages(prev => [
                          ...prev,
                          { id: item.id + "-q", role: "user", content: item.question, timestamp: new Date(item.created_at) },
                          { id: item.id + "-a", role: "assistant", content: item.response, contextUsed: item.context_used, timestamp: new Date(item.created_at) },
                        ]);
                        setShowHistory(false);
                      }}
                    >
                      <p className="text-xs font-medium truncate">{item.question}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                        </span>
                        {item.context_used && item.context_used !== "none" && (
                          <span className="text-[10px] text-gold">{item.context_used}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      )}
    </div>
  );
}
