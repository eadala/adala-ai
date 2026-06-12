import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  BrainCircuit, Send, Sparkles, Bot, Gavel, Swords,
  BookOpen, RotateCcw, Copy, ChevronLeft, ChevronRight,
  Loader2, Terminal, MessageSquare, User, Check, ArrowRight,
  ChevronDown, Cpu, Zap, Lock,
} from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ══════════════════════════════════════════════
   MODEL OPTIONS
══════════════════════════════════════════════ */
type ModelKey = "auto" | "gemini" | "claude" | "openai";

const MODEL_OPTIONS: {
  key: ModelKey; label: string; shortLabel: string; color: string;
  badgeLabel: string; free: boolean; desc: string; icon: any;
}[] = [
  { key: "auto",   label: "تلقائي",       shortLabel: "Auto",   color: "#6B7280", badgeLabel: "", free: true,  desc: "يختار الأفضل المتاح تلقائياً",  icon: Zap },
  { key: "gemini", label: "Gemini Flash", shortLabel: "Gemini", color: "#4285F4", badgeLabel: "مجاني", free: true,  desc: "سريع ومجاني · Gemini 2.5 Flash", icon: Sparkles },
  { key: "claude", label: "Claude Haiku", shortLabel: "Claude", color: "#D97706", badgeLabel: "مدفوع", free: false, desc: "دقيق وموثوق · Claude 3.5 Haiku", icon: Cpu },
  { key: "openai", label: "GPT-4o mini",  shortLabel: "GPT-4o", color: "#10A37F", badgeLabel: "مدفوع", free: false, desc: "قوي وشامل · GPT-4o mini",          icon: Cpu },
];

const MODEL_USED_LABELS: Record<string, { label: string; color: string }> = {
  gemini:   { label: "Gemini",     color: "#4285F4" },
  claude:   { label: "Claude",     color: "#D97706" },
  openai:   { label: "GPT-4o",     color: "#10A37F" },
  fallback: { label: "محلي",       color: "#6B7280" },
};

/* ══════════════════════════════════════════════
   MODES CONFIG
══════════════════════════════════════════════ */
const MODES = [
  {
    key: "assistant",
    name: "المساعد الذكي",
    nameEn: "Smart Assistant",
    icon: BrainCircuit,
    color: "#6366F1",
    gradient: "from-indigo-500/20 via-indigo-500/5 to-transparent",
    border: "border-indigo-500/30",
    badge: "bg-indigo-500/10 text-indigo-400",
    desc: "مساعد يطّلع على بيانات مكتبك الحقيقية — قضايا، فواتير، عملاء",
    api: `${BASE}/api/ai-assistant`,
    bodyKey: "message",
    replyKey: "reply",
    prompts: [
      "ملخص أداء المكتب اليوم",
      "الجلسات القادمة هذا الأسبوع",
      "الفواتير المتأخرة",
      "القضايا المفتوحة",
      "آخر العملاء المضافين",
    ],
  },
  {
    key: "chat",
    name: "المحادثة القانونية",
    nameEn: "Legal Chat",
    icon: MessageSquare,
    color: "#10B981",
    gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/10 text-emerald-400",
    desc: "محادثة مفتوحة في كل ما يخص الأنظمة السعودية والقانون",
    api: `${BASE}/api/ai-chat/message`,
    bodyKey: "message",
    replyKey: "reply",
    prompts: [
      "ما مدة التقادم في المطالبات التجارية؟",
      "أركان العقد الصحيح في النظام السعودي",
      "كيف أرفع دعوى عبر منصة ناجز؟",
      "الفرق بين التحكيم والقضاء",
      "حقوق العامل عند إنهاء الخدمة",
    ],
  },
  {
    key: "command",
    name: "القيادة الطبيعية",
    nameEn: "Natural Commands",
    icon: Terminal,
    color: "#F59E0B",
    gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
    border: "border-amber-500/30",
    badge: "bg-amber-500/10 text-amber-400",
    desc: "أصدر أوامر بالعربية تُنفَّذ مباشرة: 'أنشئ قضية'، 'أضف عميل'",
    api: `${BASE}/api/ai-agent/execute`,
    bodyKey: "command",
    replyKey: "result",
    prompts: [
      "الإحاطة اليومية الكاملة",
      "اعرض قائمة القضايا النشطة",
      "الفواتير المتأخرة عن الدفع",
      "أنشئ قضية جديدة",
      "تقرير تنفيذي شامل عن المكتب",
    ],
  },
] as const;

type ModeKey = "assistant" | "chat" | "command";

/* ══════════════════════════════════════════════
   SPECIALIZED TOOLS
══════════════════════════════════════════════ */
const TOOLS = [
  {
    key: "agents",
    name: "الوكلاء المتخصصون",
    icon: Bot,
    color: "#8B5CF6",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    textColor: "text-violet-400",
    href: "/ai-agents",
    desc: "6 وكلاء: عقود · تقاضٍ · شركات · امتثال · ملكية فكرية · تحصيل",
    badge: "6 وكلاء",
  },
  {
    key: "research",
    name: "البحث القانوني",
    icon: BookOpen,
    color: "#3B82F6",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    textColor: "text-blue-400",
    href: "/legal-research",
    desc: "بحث في الأنظمة السعودية والتشريعات عبر الذكاء الاصطناعي",
    badge: "RAG",
  },
  {
    key: "judge",
    name: "الاستعداد للجلسة",
    icon: Gavel,
    color: "#EF4444",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    textColor: "text-red-400",
    href: "/judge-prep",
    desc: "تحليل القضية وتوقع أسئلة القاضي وإعداد المرافعة",
    badge: "تحليل",
  },
  {
    key: "opponent",
    name: "محاكي الخصم",
    icon: Swords,
    color: "#F97316",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    textColor: "text-orange-400",
    href: "/opponent-simulator",
    desc: "تدرّب أمام محامٍ خصم افتراضي بمستويات متعددة",
    badge: "تدريب",
  },
] as const;

/* ══════════════════════════════════════════════
   MESSAGE FORMATTING
══════════════════════════════════════════════ */
function formatMsg(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const bold = line.replace(/\*\*(.+?)\*\*/g, (_, m) => `<strong class="text-foreground">${m}</strong>`);
    if (/^\*\*(.+)\*\*$/.test(line.trim())) {
      return <p key={i} className="font-bold text-primary mt-3 mb-1">{line.trim().slice(2, -2)}</p>;
    }
    if (line.startsWith("## ")) return <p key={i} className="font-black text-sm mt-4 mb-1.5 text-foreground">{line.slice(3)}</p>;
    if (line.startsWith("### ")) return <p key={i} className="font-bold text-xs mt-3 mb-1 text-muted-foreground uppercase tracking-wide">{line.slice(4)}</p>;
    if (line.startsWith("- ") || line.startsWith("• ")) {
      const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, (_, m) => `<strong class="text-foreground">${m}</strong>`);
      return <p key={i} className="flex gap-2 mb-0.5 text-sm leading-relaxed"><span className="text-primary mt-1 shrink-0">•</span><span dangerouslySetInnerHTML={{ __html: content }} /></p>;
    }
    if (/^\d+\.\s/.test(line)) {
      return <p key={i} className="mb-1 text-sm leading-relaxed mr-2" dangerouslySetInnerHTML={{ __html: bold }} />;
    }
    if (line.trim() === "") return <div key={i} className="h-1.5" />;
    return <p key={i} className="text-sm leading-relaxed mb-0.5" dangerouslySetInnerHTML={{ __html: bold }} />;
  });
}

/* ══════════════════════════════════════════════
   CHAT MESSAGE COMPONENT
══════════════════════════════════════════════ */
interface Msg { role: "user" | "ai"; content: string; ts: Date; }

function ChatBubble({ msg, modeColor }: { msg: Msg; modeColor: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const isAI = msg.role === "ai";

  return (
    <div className={cn("flex gap-3 mb-4 group", isAI ? "flex-row-reverse" : "flex-row-reverse justify-start")}>
      {isAI && (
        <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center" style={{ background: `${modeColor}20`, border: `1px solid ${modeColor}30` }}>
          <Sparkles className="h-4 w-4" style={{ color: modeColor }} />
        </div>
      )}
      {!isAI && (
        <div className="w-8 h-8 rounded-xl bg-muted/50 border border-border/50 shrink-0 flex items-center justify-center">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className={cn("max-w-[78%] relative", isAI ? "items-end" : "items-start", "flex flex-col")}>
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm",
          isAI
            ? "bg-card border border-border/50 rounded-tr-sm"
            : "rounded-tl-sm text-white",
        )} style={!isAI ? { background: `linear-gradient(135deg, ${modeColor}dd, ${modeColor}99)` } : {}}>
          {isAI ? <div className="text-foreground/90 leading-relaxed">{formatMsg(msg.content)}</div>
                 : <p className="leading-relaxed">{msg.content}</p>}
        </div>
        <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isAI && (
            <button onClick={copy} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              {copied ? <><Check className="h-3 w-3 text-emerald-400" />تم النسخ</> : <><Copy className="h-3 w-3" />نسخ</>}
            </button>
          )}
          <span className="text-[10px] text-muted-foreground">{msg.ts.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   TYPING INDICATOR
══════════════════════════════════════════════ */
function TypingDots({ color }: { color: string }) {
  return (
    <div className="flex gap-3 mb-4 flex-row-reverse">
      <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
        <Sparkles className="h-4 w-4" style={{ color }} />
      </div>
      <div className="bg-card border border-border/50 rounded-2xl rounded-tr-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: color, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN AI HUB
══════════════════════════════════════════════ */
export default function AIHub() {
  const { toast } = useToast();
  const [modeKey, setModeKey] = useState<ModeKey>("assistant");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState<ModelKey>("auto");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [messages, setMessages] = useState<Map<ModeKey, Msg[]>>(new Map([
    ["assistant", []],
    ["chat",      []],
    ["command",   []],
  ]));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* Fetch which models have API keys configured */
  const { data: availableModels } = useQuery<{ gemini: boolean; claude: boolean; openai: boolean }>({
    queryKey: ["ai-models-available"],
    queryFn: () => fetch(`${BASE}/api/ai-models/available`).then(r => r.json()),
    staleTime: 60_000,
  });

  /* Fetch AI credits balance */
  const { data: credits, refetch: refetchCredits } = useQuery<{ balance: number; monthly_allowance: number; used_this_month: number }>({
    queryKey: ["office-ai-credits"],
    queryFn: () => fetch(`${BASE}/api/office/ai-credits`).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const mode = MODES.find(m => m.key === modeKey)!;
  const msgs = messages.get(modeKey) ?? [];

  const addMsg = useCallback((key: ModeKey, msg: Msg) => {
    setMessages(prev => {
      const next = new Map(prev);
      next.set(key, [...(next.get(key) ?? []), msg]);
      return next;
    });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);
  useEffect(() => { inputRef.current?.focus(); }, [modeKey]);

  const handleSend = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: msg, ts: new Date() };
    addMsg(modeKey, userMsg);
    setLoading(true);

    try {
      const body: any = {};
      body[mode.bodyKey] = msg;
      /* pass history for chat modes */
      if (modeKey === "chat") body.history = msgs.slice(-6).map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));
      if (modeKey === "assistant") body.context = msgs.slice(-6).map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.content }));
      /* pass selected model for /ai-chat/message */
      if (modeKey === "chat" || modeKey === "command") body.model = selectedModel;

      const res = await fetch(mode.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      const reply = data[mode.replyKey]
        ?? data.reply ?? data.answer ?? data.result
        ?? data.message ?? "عذراً، لم أتمكن من المعالجة.";
      addMsg(modeKey, { role: "ai", content: typeof reply === "object" ? JSON.stringify(reply, null, 2) : String(reply), ts: new Date() });
      /* refresh credit balance after each AI call */
      refetchCredits();
    } catch (e: any) {
      toast({ title: "خطأ في الاتصال", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages(prev => { const n = new Map(prev); n.set(modeKey, []); return n; });
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isEmpty = msgs.length === 0;

  return (
    <div className="flex h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-border/50 bg-background" dir="rtl">

      {/* ── SIDEBAR ── */}
      <aside className={cn(
        "flex flex-col border-l border-border/50 bg-card/50 transition-all duration-300 shrink-0",
        sidebarOpen ? "w-64" : "w-14"
      )}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50 h-14">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="font-black text-sm">الذكاء الاصطناعي</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(v => !v)} className="w-7 h-7 rounded-lg hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-auto">
            {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Chat Modes */}
        <div className="p-2 border-b border-border/50">
          {sidebarOpen && <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-2 pb-2 pt-1">أوضاع المحادثة</p>}
          {MODES.map(m => {
            const Icon = m.icon;
            const isActive = modeKey === m.key;
            const msgCount = (messages.get(m.key as ModeKey) ?? []).filter(x => x.role === "user").length;
            return (
              <button
                key={m.key}
                onClick={() => setModeKey(m.key as ModeKey)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-right transition-all mb-0.5",
                  isActive ? "bg-card border border-border shadow-sm" : "hover:bg-muted/40",
                  !sidebarOpen && "justify-center"
                )}
              >
                <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center transition-colors" style={{ background: isActive ? `${m.color}20` : "transparent", border: isActive ? `1px solid ${m.color}30` : "1px solid transparent" }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: isActive ? m.color : undefined }} />
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs font-semibold truncate", isActive ? "text-foreground" : "text-muted-foreground")}>{m.name}</span>
                      {msgCount > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${m.color}20`, color: m.color }}>{msgCount}</span>}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Specialized Tools */}
        <div className="p-2 flex-1 overflow-y-auto">
          {sidebarOpen && <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest px-2 pb-2 pt-1">أدوات متخصصة</p>}
          {TOOLS.map(t => {
            const Icon = t.icon;
            return (
              <Link key={t.key} href={t.href}>
                <a className={cn("w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-right hover:bg-muted/40 transition-all mb-0.5 group", !sidebarOpen && "justify-center")}>
                  <div className={cn("w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border", t.bg, t.border)}>
                    <Icon className={cn("h-3.5 w-3.5", t.textColor)} />
                  </div>
                  {sidebarOpen && (
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground group-hover:text-foreground truncate transition-colors">{t.name}</span>
                      <Badge className={cn("text-[9px] px-1.5 py-0 h-4 border-0", t.bg, t.textColor)}>{t.badge}</Badge>
                    </div>
                  )}
                </a>
              </Link>
            );
          })}
        </div>

        {/* AI Credits Balance */}
        <div className={cn("p-2 border-t border-border/50 shrink-0", !sidebarOpen && "flex justify-center")}>
          {sidebarOpen ? (
            <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">رصيد AI</span>
                </div>
                <button onClick={() => refetchCredits()} className="text-muted-foreground hover:text-foreground transition-colors">
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-end gap-1 mb-2">
                <span className={cn("text-2xl font-black", (credits?.balance ?? 100) <= 10 ? "text-red-400" : "text-foreground")}>{(credits?.balance ?? 100).toLocaleString("ar-SA")}</span>
                <span className="text-[10px] text-muted-foreground mb-1">/ {(credits?.monthly_allowance ?? 100).toLocaleString("ar-SA")} نقطة</span>
              </div>
              {/* progress bar */}
              {(() => {
                const used = credits?.used_this_month ?? 0;
                const total = credits?.monthly_allowance ?? 100;
                const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                return (
                  <div className="space-y-1">
                    <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[9px] text-muted-foreground">استُهلك {used} نقطة هذا الشهر ({pct}%)</p>
                  </div>
                );
              })()}
              {(credits?.balance ?? 100) <= 10 && (
                <p className="text-[9px] text-red-400 mt-1.5 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  رصيد منخفض — تواصل مع الإدارة
                </p>
              )}
            </div>
          ) : (
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center border", (credits?.balance ?? 100) <= 10 ? "bg-red-500/10 border-red-500/30" : "bg-amber-500/10 border-amber-500/20")}>
              <Zap className={cn("h-3.5 w-3.5", (credits?.balance ?? 100) <= 10 ? "text-red-400" : "text-amber-400")} />
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CHAT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top Bar */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-border/50 shrink-0" style={{ background: `linear-gradient(135deg, ${mode.color}08, transparent)` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${mode.color}20`, border: `1px solid ${mode.color}30` }}>
              <mode.icon className="h-4 w-4" style={{ color: mode.color }} />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{mode.name}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{mode.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {msgs.length > 0 && (
              <button onClick={clearChat} className="h-7 px-2.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center gap-1.5 transition-colors">
                <RotateCcw className="h-3 w-3" />محادثة جديدة
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-4">
          {isEmpty ? (
            /* Welcome State */
            <div className="h-full flex flex-col items-center justify-center py-8 max-w-xl mx-auto">
              {/* Glowing Icon */}
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${mode.color}30, ${mode.color}10)`, border: `1px solid ${mode.color}30`, boxShadow: `0 0 40px ${mode.color}20` }}>
                  <mode.icon className="h-9 w-9" style={{ color: mode.color }} />
                </div>
                <div className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-background flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping absolute" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
              </div>

              <h2 className="text-xl font-black mb-2">{mode.name}</h2>
              <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed max-w-sm">{mode.desc}</p>

              {/* Quick Prompts */}
              <div className="w-full space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center mb-3">ابدأ بسؤال</p>
                <div className="grid grid-cols-1 gap-2">
                  {mode.prompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(p)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/50 px-4 py-2.5 text-right hover:border-border hover:bg-card text-sm text-muted-foreground hover:text-foreground transition-all group"
                    >
                      <span>{p}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: mode.color }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Specialized Tools hint */}
              <div className="mt-8 w-full">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center mb-3">أدوات متخصصة</p>
                <div className="grid grid-cols-2 gap-2">
                  {TOOLS.map(t => {
                    const Icon = t.icon;
                    return (
                      <Link key={t.key} href={t.href}>
                        <a className={cn("flex items-center gap-2.5 rounded-xl border p-3 hover:bg-muted/30 transition-all group", t.border)}>
                          <div className={cn("w-8 h-8 rounded-lg shrink-0 flex items-center justify-center", t.bg)}>
                            <Icon className={cn("h-4 w-4", t.textColor)} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{t.name}</p>
                            <Badge className={cn("text-[9px] px-1.5 py-0 h-3.5 border-0 mt-0.5", t.bg, t.textColor)}>{t.badge}</Badge>
                          </div>
                        </a>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* Chat Messages */
            <div className="max-w-2xl mx-auto">
              {msgs.map((m, i) => <ChatBubble key={i} msg={m} modeColor={mode.color} />)}
              {loading && <TypingDots color={mode.color} />}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t border-border/50 shrink-0">
          <div className="max-w-2xl mx-auto">
            {/* Mode Switcher Pills */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {MODES.map(m => {
                const Icon = m.icon;
                const isActive = modeKey === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setModeKey(m.key as ModeKey)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                      isActive
                        ? "text-white shadow-sm"
                        : "text-muted-foreground bg-muted/50 hover:bg-muted border border-transparent"
                    )}
                    style={isActive ? { background: mode.color } : {}}
                  >
                    <Icon className="h-3 w-3" />
                    {m.name}
                  </button>
                );
              })}
            </div>

            {/* Model Picker (only for chat/command modes that use /ai-chat/message) */}
            {(modeKey === "chat" || modeKey === "command") && (
              <div className="relative mb-2.5">
                <button
                  onClick={() => setModelPickerOpen(v => !v)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 transition-all text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {(() => {
                    const m = MODEL_OPTIONS.find(x => x.key === selectedModel)!;
                    const MIcon = m.icon;
                    return <>
                      <MIcon className="h-3 w-3" style={{ color: m.color }} />
                      <span style={{ color: m.color }}>{m.label}</span>
                      {m.badgeLabel && (
                        <span className="px-1 py-0 rounded text-[9px] font-bold" style={{ background: `${m.color}20`, color: m.color }}>{m.badgeLabel}</span>
                      )}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </>;
                  })()}
                </button>

                {modelPickerOpen && (
                  <div className="absolute bottom-full mb-1 right-0 bg-card border border-border rounded-xl shadow-xl z-50 min-w-[220px] p-1.5">
                    {MODEL_OPTIONS.map(m => {
                      const MIcon = m.icon;
                      const isAvailable = m.key === "auto" || (availableModels?.[m.key as keyof typeof availableModels] ?? false);
                      const isSelected = selectedModel === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => { if (isAvailable) { setSelectedModel(m.key); setModelPickerOpen(false); } }}
                          disabled={!isAvailable}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-right transition-all",
                            isSelected ? "bg-muted" : "hover:bg-muted/60",
                            !isAvailable && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          <MIcon className="h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold">{m.label}</span>
                              {m.badgeLabel && (
                                <span className="text-[9px] px-1 rounded font-bold" style={{ background: `${m.color}20`, color: m.color }}>{m.badgeLabel}</span>
                              )}
                              {!isAvailable && <Lock className="h-2.5 w-2.5 text-muted-foreground" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                          </div>
                          {isSelected && <Check className="h-3 w-3 text-foreground shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Input Box */}
            <div className="relative rounded-2xl border transition-all" style={{ borderColor: loading ? `${mode.color}50` : undefined }}>
              <Textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`اسأل ${mode.name}...`}
                rows={1}
                className="resize-none bg-transparent border-0 focus-visible:ring-0 py-3 pl-14 pr-4 text-sm min-h-[48px] max-h-[160px] overflow-y-auto"
                style={{ direction: "rtl" }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="absolute left-2.5 bottom-2.5 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                style={{ background: input.trim() && !loading ? mode.color : undefined }}
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: mode.color }} />
                  : <Send className="h-4 w-4 text-white" />
                }
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">Enter للإرسال · Shift+Enter لسطر جديد</p>
          </div>
        </div>
      </div>
    </div>
  );
}
