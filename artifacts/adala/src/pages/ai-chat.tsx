import { useState, useRef, useEffect } from "react";
import { Bot, Send, Trash2, Scale, Sparkles, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  "ما هي مدة التقادم في دعاوى العمال؟",
  "حلل مخاطر عقد الإيجار التجاري",
  "ما هي أركان العقد الصحيح في النظام السعودي؟",
  "كيف أرفع دعوى عبر منصة ناجز؟",
  "ما الفرق بين التحكيم والقضاء؟",
];

function formatContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**")) {
      return <div key={i} className="font-bold text-[#C9A84C] mt-3 mb-1">{line.slice(2, -2)}</div>;
    }
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return <div key={i} className="flex gap-2 mr-2 my-0.5"><span className="text-[#C9A84C] mt-1">•</span><span>{line.slice(2)}</span></div>;
    }
    if (/^\d+\./.test(line)) {
      return <div key={i} className="mr-2 my-0.5 text-white/90">{line}</div>;
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <div key={i} className="text-white/90 leading-relaxed">{line}</div>;
  });
}

export default function AiChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "مرحباً! أنا المساعد القانوني لمنصة عدالة AI.\n\nيمكنني مساعدتك في:\n- **تحليل القضايا** القانونية المعقدة\n- **مراجعة العقود** وتحديد المخاطر\n- **البحث في الأنظمة** السعودية والتشريعات\n- **استشارات قانونية** سريعة باللغة العربية\n\nكيف يمكنني مساعدتك اليوم؟",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg || isLoading) return;

    const userMsg: Message = { role: "user", content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai-chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply ?? "عذراً، حدث خطأ أثناء المعالجة.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      toast({ title: "خطأ في الاتصال", description: "تعذر الاتصال بالمساعد", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "تم مسح المحادثة. كيف يمكنني مساعدتك؟",
      timestamp: new Date(),
    }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            المساعد القانوني الذكي
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            استشارات قانونية فورية مدعومة بالذكاء الاصطناعي
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={clearChat} className="gap-2">
          <Trash2 className="h-4 w-4" />
          مسح المحادثة
        </Button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 rounded-2xl border bg-card overflow-hidden flex flex-col shadow-lg">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div
                  className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-sidebar text-white"
                  }`}
                >
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Scale className="w-4 h-4 text-[#C9A84C]" />}
                </div>
                <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tl-sm"
                        : "bg-muted rounded-tr-sm text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="space-y-0.5">{formatContent(msg.content)}</div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground px-1">
                    {msg.timestamp.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-sidebar flex items-center justify-center flex-shrink-0">
                  <Scale className="w-4 h-4 text-[#C9A84C]" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">يحلل ويعالج...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="px-4 py-3 border-t bg-muted/30 flex gap-2 flex-wrap">
            {QUICK_PROMPTS.map(p => (
              <Badge
                key={p}
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs py-1 px-3"
                onClick={() => sendMessage(p)}
              >
                {p}
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t bg-card">
          <div className="flex gap-3">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="اكتب سؤالك القانوني هنا..."
              className="flex-1 bg-muted/50 border-none focus-visible:ring-1 text-sm"
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={isLoading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            هذا المساعد للاستشارة العامة ولا يغني عن الاستشارة القانونية المتخصصة
          </p>
        </div>
      </div>
    </div>
  );
}
