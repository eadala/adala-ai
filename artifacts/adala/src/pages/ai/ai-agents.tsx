import { useState, useRef, useEffect } from "react";
import {
  Bot, FileText, Gavel, Shield, Lightbulb, BadgeDollarSign,
  Send, Loader2, RotateCcw, Sparkles, ChevronLeft, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const AGENTS = [
  {
    key: "contracts", name: "وكيل العقود", icon: FileText, color: "#6366F1",
    bg: "bg-indigo-500/10", border: "border-indigo-500/20",
    desc: "صياغة العقود ومراجعتها ومقارنة النسخ",
    capabilities: ["صياغة عقد جديد", "مراجعة عقد موجود", "مقارنة نسختين", "استخراج البنود الرئيسية"],
    placeholder: "مثال: أحتاج صياغة عقد إيجار تجاري لمحل في الرياض لمدة 3 سنوات...",
  },
  {
    key: "litigation", name: "وكيل التقاضي", icon: Gavel, color: "#EF4444",
    bg: "bg-red-500/10", border: "border-red-500/20",
    desc: "تحليل القضايا وإعداد المذكرات واقتراح الدفوع",
    capabilities: ["تحليل وقائع القضية", "إعداد مذكرة دفاع", "اقتراح الدفوع", "استراتيجية التقاضي"],
    placeholder: "مثال: قضية نزاع عمالي، الموظف يطالب بتعويض الفصل التعسفي بعد 5 سنوات خدمة...",
  },
  {
    key: "corporate", name: "وكيل الشركات", icon: Bot, color: "#10B981",
    bg: "bg-emerald-500/10", border: "border-emerald-500/20",
    desc: "تأسيس الشركات وإدارة القرارات وإعداد المحاضر",
    capabilities: ["تأسيس شركة", "إعداد محضر اجتماع", "قرارات مجلس الإدارة", "تعديل النظام الأساسي"],
    placeholder: "مثال: أريد تأسيس شركة ذات مسؤولية محدودة في قطاع التقنية بمشاركين اثنين...",
  },
  {
    key: "compliance", name: "وكيل الامتثال", icon: Shield, color: "#F59E0B",
    bg: "bg-amber-500/10", border: "border-amber-500/20",
    desc: "مراقبة الالتزام وإصدار تقارير الامتثال",
    capabilities: ["تقييم الامتثال", "PDPL وحماية البيانات", "مكافحة غسل الأموال", "متطلبات الحوكمة"],
    placeholder: "مثال: شركتي تعمل في التجارة الإلكترونية وتجمع بيانات المستخدمين، ما متطلبات PDPL؟",
  },
  {
    key: "ip", name: "وكيل الملكية الفكرية", icon: Lightbulb, color: "#8B5CF6",
    bg: "bg-violet-500/10", border: "border-violet-500/20",
    desc: "العلامات التجارية وحقوق المؤلف وبراءات الاختراع",
    capabilities: ["تسجيل علامة تجارية", "حماية براءة اختراع", "حقوق المؤلف", "مكافحة التقليد"],
    placeholder: "مثال: أريد حماية اسم منتجي الجديد وشعاره كعلامة تجارية في السعودية...",
  },
  {
    key: "collections", name: "وكيل التحصيل", icon: BadgeDollarSign, color: "#2563EB",
    bg: "bg-yellow-500/10", border: "border-yellow-500/20",
    desc: "متابعة الديون وصياغة الإنذارات واقتراح التسويات",
    capabilities: ["إنذار مدين", "خطة التحصيل", "اقتراح تسوية", "أمر الأداء"],
    placeholder: "مثال: مورّد مديون بمبلغ 200,000 ريال منذ 6 أشهر ولا يرد على التواصل...",
  },
];

interface Message { role: "user" | "agent"; content: string; }

function MessageBubble({ msg, agentColor }: { msg: Message; agentColor: string }) {
  const isUser = msg.role === "user";
  const lines = msg.content.split("\n").map((line, i) => {
    if (line.startsWith("**") && line.endsWith("**"))
      return <p key={i} className="font-bold mt-2 mb-0.5 text-sm" style={{ color: agentColor }}>{line.slice(2, -2)}</p>;
    if (line.startsWith("- "))
      return <p key={i} className="text-sm text-foreground/85 pe-2 before:content-['•'] before:ms-2">{line.slice(2)}</p>;
    if (/^\d+\./.test(line))
      return <p key={i} className="text-sm text-foreground/85">{line}</p>;
    if (!line.trim()) return <div key={i} className="h-1" />;
    return <p key={i} className="text-sm leading-relaxed">{line}</p>;
  });

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "")}>
      <div className={cn("w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold",
        isUser ? "bg-primary/20 text-primary" : "bg-muted"
      )} style={!isUser ? { borderLeft: `3px solid ${agentColor}` } : {}}>
        {isUser ? "أنت" : <Bot className="w-4 h-4" style={{ color: agentColor }} />}
      </div>
      <div className={cn("max-w-[80%] px-4 py-3 rounded-2xl text-foreground space-y-0.5",
        isUser ? "bg-primary/10 border border-primary/20 rounded-tl-sm" : "bg-muted/60 border border-border/50 rounded-tr-sm"
      )}>
        {lines}
      </div>
    </div>
  );
}

export default function AiAgents() {
  const [selectedAgent, setSelectedAgent] = useState<typeof AGENTS[0] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const selectAgent = (agent: typeof AGENTS[0]) => {
    setSelectedAgent(agent);
    setMessages([{
      role: "agent",
      content: `**مرحباً! أنا ${agent.name}**\n\nيمكنني مساعدتك في:\n${agent.capabilities.map(c => `- ${c}`).join("\n")}\n\nكيف يمكنني مساعدتك؟`,
    }]);
    setInput("");
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !selectedAgent) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const history = messages.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      const res = await fetch("/api/ai-agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType: selectedAgent.key, input: userMsg.content, history }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: "agent", content: data.response }]);
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally { setLoading(false); }
  };

  if (!selectedAgent) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-black">منظومة الوكلاء الذكيين</h1>
          <p className="text-muted-foreground text-sm">6 وكلاء متخصصون مدعومون بالذكاء الاصطناعي — اختر الوكيل المناسب لمهمتك</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map(agent => (
            <button key={agent.key} onClick={() => selectAgent(agent)}
              className={cn("text-right p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] group", agent.bg, agent.border)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${agent.color}20` }}>
                  <agent.icon className="w-5 h-5" style={{ color: agent.color }} />
                </div>
                <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <h3 className="font-bold text-base mb-1">{agent.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">{agent.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {agent.capabilities.slice(0, 2).map(c => (
                  <Badge key={c} variant="secondary" className="text-[10px] px-2 py-0">{c}</Badge>
                ))}
                {agent.capabilities.length > 2 && (
                  <Badge variant="outline" className="text-[10px] px-2 py-0">+{agent.capabilities.length - 2}</Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}>
          <ChevronLeft className="w-4 h-4 ms-1 rotate-180" /> الوكلاء
        </Button>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${selectedAgent.color}20` }}>
          <selectedAgent.icon className="w-5 h-5" style={{ color: selectedAgent.color }} />
        </div>
        <div>
          <h1 className="text-base font-bold">{selectedAgent.name}</h1>
          <p className="text-xs text-muted-foreground">{selectedAgent.desc}</p>
        </div>
        <Button variant="ghost" size="sm" className="mr-auto" onClick={() => selectAgent(selectedAgent)}>
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex-1 rounded-2xl border bg-card overflow-hidden flex flex-col shadow">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} agentColor={selectedAgent.color} />)}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center" style={{ borderLeft: `3px solid ${selectedAgent.color}` }}>
                  <Bot className="w-4 h-4" style={{ color: selectedAgent.color }} />
                </div>
                <div className="bg-muted/60 rounded-2xl rounded-tr-sm px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">الوكيل يعمل...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <div className="border-t p-4 bg-card space-y-2">
          <div className="flex gap-2">
            <Textarea value={input} onChange={e => setInput(e.target.value)} placeholder={selectedAgent.placeholder}
              className="flex-1 resize-none min-h-[60px] max-h-[120px] bg-muted/50 border-none focus-visible:ring-1 text-sm"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              disabled={loading} />
            <Button onClick={sendMessage} disabled={!input.trim() || loading} className="self-end h-10 px-4">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedAgent.capabilities.map(c => (
              <button key={c} onClick={() => setInput(c)} className="text-xs px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
