import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { useOfficePlan } from "@/hooks/use-office-plan";
import {
  BrainCircuit, Send, Sparkles, Bot, Gavel, Swords, BookOpen,
  RotateCcw, Copy, Loader2, Terminal, MessageSquare, User, Check,
  Scale, FileText, Zap, Cpu, Crown, ChevronDown, ChevronUp,
  ExternalLink, Info, Lock, Wand2, LibraryBig,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ═══════════════════════════════════════════════════
   MODEL OPTIONS
═══════════════════════════════════════════════════ */
type ModelKey = "auto" | "gemini" | "claude" | "openai";

const MODEL_OPTIONS: {
  key: ModelKey; label: string; color: string; free: boolean; icon: any; desc: string;
}[] = [
  { key: "auto",   label: "تلقائي",        color: "#6B7280", free: true,  icon: Zap,      desc: "يختار الأفضل المتاح تلقائياً" },
  { key: "gemini", label: "Gemini Flash",  color: "#4285F4", free: true,  icon: Sparkles, desc: "سريع ومجاني · Gemini 2.5 Flash" },
  { key: "claude", label: "Claude Haiku",  color: "#D97706", free: false, icon: Cpu,      desc: "دقيق · Claude 3.5 Haiku" },
  { key: "openai", label: "GPT-4o mini",   color: "#10A37F", free: false, icon: Cpu,      desc: "شامل · GPT-4o mini" },
];

/* ═══════════════════════════════════════════════════
   CHAT AGENTS (built-in conversation modes)
═══════════════════════════════════════════════════ */
const CHAT_AGENTS = [
  {
    id: "assistant" as const,
    name: "المساعد الذكي",
    nameEn: "Smart Assistant",
    icon: BrainCircuit,
    color: "#6366F1",
    badge: "بيانات المكتب",
    desc: "يطّلع على بيانات مكتبك الحقيقية — قضايا، فواتير، عملاء — ويجيب عن أسئلتك",
    api: "/api/ai-assistant",
    bodyKey: "message",
    replyKey: "reply",
    prompts: [
      "ملخص أداء المكتب اليوم",
      "الجلسات القادمة هذا الأسبوع",
      "الفواتير المتأخرة عن السداد",
      "القضايا المفتوحة حالياً",
    ],
  },
  {
    id: "legal" as const,
    name: "المحادثة القانونية",
    nameEn: "Legal Chat",
    icon: MessageSquare,
    color: "#10B981",
    badge: "أنظمة سعودية",
    desc: "محادثة مفتوحة في الأنظمة والتشريعات السعودية والفقه القانوني",
    api: "/api/ai-chat/message",
    bodyKey: "message",
    replyKey: "reply",
    prompts: [
      "مدة التقادم في المطالبات التجارية",
      "أركان العقد الصحيح في النظام السعودي",
      "حقوق العامل عند إنهاء الخدمة",
      "الفرق بين التحكيم والتقاضي",
    ],
  },
  {
    id: "adoul" as const,
    name: "عدول — المحلل القانوني",
    nameEn: "Adoul Legal Analyst",
    icon: Scale,
    color: "#0EA5E9",
    badge: "تحليل عميق",
    desc: "تحليل القضايا واستخراج الدفوع القانونية — المستشار الأعمق والأدق",
    api: "/api/adoul/chat",
    bodyKey: "message",
    replyKey: "reply",
    prompts: [
      "حلل هذه القضية واستخرج الدفوع المتاحة",
      "ما النصوص القانونية الداعمة لموكلي؟",
      "كيف أحضّر مذكرة الدفاع؟",
      "قيّم قوة موقف الخصم القانوني",
    ],
  },
  {
    id: "command" as const,
    name: "القيادة الطبيعية",
    nameEn: "Natural Commands",
    icon: Terminal,
    color: "#F59E0B",
    badge: "أوامر مباشرة",
    desc: "أصدر أوامر بالعربية تُنفَّذ مباشرة على بيانات مكتبك",
    api: "/api/ai-agent/execute",
    bodyKey: "command",
    replyKey: "result",
    prompts: [
      "الإحاطة اليومية الكاملة للمكتب",
      "اعرض القضايا النشطة هذا الشهر",
      "تقرير تنفيذي شامل",
      "الفواتير المتأخرة عن الدفع",
    ],
  },
] as const;

/* ═══════════════════════════════════════════════════
   QUICK TOOLS (links to dedicated pages)
═══════════════════════════════════════════════════ */
const QUICK_TOOLS = [
  {
    id: "legal-ai",
    name: "محرك الوثائق",
    icon: FileText,
    color: "#8B5CF6",
    href: "/legal-ai",
    desc: "إنشاء مستندات ومذكرات قانونية",
  },
  {
    id: "judge-prep",
    name: "المحاكاة القضائية",
    icon: Gavel,
    color: "#EF4444",
    href: "/judge-prep",
    desc: "توقع أسئلة القاضي وتحضير المرافعة",
  },
  {
    id: "opponent",
    name: "محلل الخصم",
    icon: Swords,
    color: "#F97316",
    href: "/opponent-simulator",
    desc: "استشراف دفوع الخصم ونقاط ضعفه",
  },
  {
    id: "research",
    name: "البحث القانوني",
    icon: LibraryBig,
    color: "#3B82F6",
    href: "/legal-research",
    desc: "بحث في الأنظمة والمراسيم السعودية",
  },
  {
    id: "ui-builder",
    name: "مُنشئ الواجهات",
    icon: Wand2,
    color: "#EC4899",
    href: "/ui-builder",
    desc: "إنشاء واجهات بالوصف الطبيعي",
  },
  {
    id: "arbitration",
    name: "التحكيم",
    icon: BookOpen,
    color: "#64748B",
    href: "/arbitration",
    desc: "إدارة قضايا التحكيم والوساطة",
  },
];

type AgentId = typeof CHAT_AGENTS[number]["id"];

interface Message {
  role: "user" | "assistant";
  content: string;
  modelUsed?: string;
  ts: number;
}

/* ═══════════════════════════════════════════════════
   PLAN WIDGET
═══════════════════════════════════════════════════ */
function PlanWidget() {
  const { planName, planColor, planSlug, isTrial, trialDaysLeft, limits } = useOfficePlan();
  const isUpgradable = ["free", "starter", "basic"].includes(planSlug);

  return (
    <div className="p-3 rounded-xl border border-border/40 bg-background/60 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">الباقة الحالية</span>
        <Link href="/billing">
          <span className="text-[10px] text-primary hover:underline cursor-pointer">إدارة الاشتراك</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-sm font-bold" style={{ color: planColor }}>{planName}</span>
        {isTrial && trialDaysLeft !== null && (
          <span className="text-[9px] bg-amber-500/15 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
            {trialDaysLeft} يوم
          </span>
        )}
      </div>
      {limits && (
        <p className="text-[10px] text-muted-foreground/60 leading-tight">
          ذكاء اصطناعي: {limits.maxAiCalls === -1 ? "غير محدود" : `${limits.maxAiCalls.toLocaleString("ar-SA")} طلب/شهر`}
        </p>
      )}
      {isUpgradable && (
        <Link href="/billing">
          <Button size="sm" className="w-full h-7 text-xs gap-1 mt-0.5 rounded-lg">
            <Crown className="h-3 w-3" />
            ترقية الباقة
          </Button>
        </Link>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export default function AIHub() {
  const [activeAgent, setActiveAgent] = useState<AgentId>("assistant");
  const [model, setModel] = useState<ModelKey>("auto");
  const [histories, setHistories] = useState<Record<AgentId, Message[]>>({
    assistant: [],
    legal: [],
    adoul: [],
    command: [],
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [toolsOpen, setToolsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const agent = CHAT_AGENTS.find(a => a.id === activeAgent)!;
  const messages = histories[activeAgent];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    const userMsg: Message = { role: "user", content: msg, ts: Date.now() };
    setHistories(prev => ({ ...prev, [activeAgent]: [...prev[activeAgent], userMsg] }));
    setLoading(true);

    try {
      const body: Record<string, string> = { [agent.bodyKey]: msg };
      if (model !== "auto") body.model = model;

      const r = await fetch(`${BASE}${agent.api}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        throw new Error(`${r.status}${errText ? `: ${errText.slice(0, 80)}` : ""}`);
      }

      const data = await r.json();
      const reply = data[agent.replyKey] ?? data.reply ?? data.result ?? data.message ?? "لا يوجد رد.";
      const modelUsed = data.modelUsed ?? data.model;

      const asstMsg: Message = { role: "assistant", content: reply, modelUsed, ts: Date.now() };
      setHistories(prev => ({ ...prev, [activeAgent]: [...prev[activeAgent], asstMsg] }));
    } catch (e: any) {
      const errMsg: Message = {
        role: "assistant",
        content: `⚠️ خطأ في الاتصال: ${e.message ?? "غير معروف"}`,
        ts: Date.now(),
      };
      setHistories(prev => ({ ...prev, [activeAgent]: [...prev[activeAgent], errMsg] }));
      toast({ title: "خطأ في الاتصال", description: e.message ?? "فشل الاتصال بالذكاء الاصطناعي", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [input, loading, activeAgent, agent, model, toast]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearHistory = () => {
    setHistories(prev => ({ ...prev, [activeAgent]: [] }));
  };

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(idx);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const AgentIcon = agent.icon;

  return (
    <div className="flex h-[calc(100vh-4.5rem)] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">

      {/* ══════════════════ LEFT SIDEBAR ══════════════════ */}
      <div className="w-[265px] shrink-0 border-l border-border/40 bg-muted/20 flex flex-col overflow-hidden">

        {/* Sidebar Header */}
        <div className="px-4 py-3.5 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-foreground leading-tight">الذكاء الاصطناعي القانوني</p>
              <p className="text-[10px] text-muted-foreground/70">Legal AI Operating System</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Chat Agents */}
          <div className="p-3 pb-1">
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.12em] font-bold px-1 mb-2">
              المحادثات الذكية
            </p>
            <div className="space-y-1">
              {CHAT_AGENTS.map(a => {
                const Icon = a.icon;
                const isActive = activeAgent === a.id;
                const msgCount = histories[a.id]?.length ?? 0;
                const convCount = Math.floor(msgCount / 2);
                return (
                  <button
                    key={a.id}
                    onClick={() => setActiveAgent(a.id)}
                    className={cn(
                      "w-full flex items-start gap-2.5 p-2.5 rounded-xl transition-all text-right",
                      isActive
                        ? "bg-primary/10 border border-primary/25 shadow-sm"
                        : "hover:bg-accent/60 border border-transparent"
                    )}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${a.color}20` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: a.color }} />
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn(
                          "text-[12px] font-semibold leading-tight truncate",
                          isActive ? "text-primary" : "text-foreground/85"
                        )}>
                          {a.name}
                        </span>
                        {convCount > 0 && (
                          <span className="text-[9px] bg-muted/80 rounded-full px-1.5 py-0.5 text-muted-foreground font-mono shrink-0">
                            {convCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground/65 mt-0.5 line-clamp-1 leading-snug">
                        {a.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Tools */}
          <div className="p-3 pt-2">
            <button
              onClick={() => setToolsOpen(v => !v)}
              className="flex items-center justify-between w-full px-1 mb-2 group"
            >
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.12em] font-bold">
                أدوات متخصصة
              </p>
              {toolsOpen
                ? <ChevronUp className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                : <ChevronDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              }
            </button>
            {toolsOpen && (
              <div className="grid grid-cols-2 gap-1.5">
                {QUICK_TOOLS.map(t => {
                  const Icon = t.icon;
                  return (
                    <Link key={t.id} href={t.href}>
                      <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer text-center group">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: `${t.color}18` }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: t.color }} />
                        </div>
                        <span className="text-[10px] font-semibold text-foreground/65 leading-tight group-hover:text-primary transition-colors line-clamp-1">
                          {t.name}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Model + Plan */}
        <div className="p-3 border-t border-border/30 space-y-2.5 bg-muted/10">
          {/* Model selector */}
          <div>
            <p className="text-[9px] text-muted-foreground/50 uppercase tracking-[0.12em] font-bold mb-1.5">نموذج الذكاء الاصطناعي</p>
            <Select value={model} onValueChange={v => setModel(v as ModelKey)}>
              <SelectTrigger className="h-8 text-xs rounded-xl border-border/50 bg-background/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map(m => {
                  const Icon = m.icon;
                  return (
                    <SelectItem key={m.key} value={m.key}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
                        <span className="text-xs">{m.label}</span>
                        {m.free && (
                          <span className="text-[9px] bg-emerald-500/15 text-emerald-600 px-1 py-0.5 rounded font-medium">
                            مجاني
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Plan widget */}
          <PlanWidget />
        </div>
      </div>

      {/* ══════════════════ CHAT AREA ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/40">

        {/* Agent Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-card/90 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${agent.color}18` }}
            >
              <AgentIcon className="h-[18px] w-[18px]" style={{ color: agent.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-foreground">{agent.name}</p>
                <span
                  className="text-[10px] border rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    borderColor: `${agent.color}35`,
                    color: agent.color,
                    background: `${agent.color}10`,
                  }}
                >
                  {agent.badge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5 max-w-md">
                {agent.desc}
              </p>
            </div>
          </div>
          <button
            onClick={clearHistory}
            title="مسح المحادثة"
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-accent/60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            مسح
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-5 space-y-4"
        >
          {messages.length === 0 ? (
            /* ── Empty State ── */
            <div className="flex flex-col items-center justify-center h-full text-center pb-10 select-none">
              <div
                className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
                style={{ background: `${agent.color}15` }}
              >
                <AgentIcon className="h-8 w-8" style={{ color: agent.color }} />
              </div>
              <p className="text-base font-bold text-foreground mb-1">{agent.name}</p>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm leading-relaxed">
                {agent.desc}
              </p>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {agent.prompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => send(p)}
                    disabled={loading}
                    className="text-right px-4 py-2.5 rounded-xl border border-border/50 bg-card/80 hover:bg-primary/5 hover:border-primary/30 text-sm text-foreground/70 hover:text-foreground transition-all disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={idx}
                  className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                      isUser ? "bg-primary/15" : undefined
                    )}
                    style={!isUser ? { background: `${agent.color}15` } : undefined}
                  >
                    {isUser
                      ? <User className="h-4 w-4 text-primary" />
                      : <AgentIcon className="h-4 w-4" style={{ color: agent.color }} />
                    }
                  </div>

                  {/* Bubble */}
                  <div className={cn("max-w-[78%] flex flex-col", isUser ? "items-end" : "items-start")}>
                    <div className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words",
                      isUser
                        ? "bg-primary text-primary-foreground rounded-tl-sm"
                        : "bg-card border border-border/40 rounded-tr-sm text-foreground"
                    )}>
                      {msg.content}
                    </div>

                    {/* Meta row */}
                    <div className={cn(
                      "flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
                      isUser ? "justify-end" : "justify-start"
                    )}>
                      {!isUser && msg.modelUsed && msg.modelUsed !== "security-block" && msg.modelUsed !== "quota-exceeded" && (
                        <span className="text-[9px] text-muted-foreground/50 font-mono">
                          {msg.modelUsed}
                        </span>
                      )}
                      <button
                        onClick={() => copyMessage(msg.content, idx)}
                        className="text-[10px] text-muted-foreground/50 hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        {copied === idx
                          ? <Check className="h-3 w-3 text-emerald-500" />
                          : <Copy className="h-3 w-3" />
                        }
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: `${agent.color}15` }}
              >
                <AgentIcon className="h-4 w-4" style={{ color: agent.color }} />
              </div>
              <div className="bg-card border border-border/40 rounded-2xl rounded-tr-sm px-4 py-3">
                <div className="flex gap-1.5 items-center h-5">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{
                        background: agent.color,
                        opacity: 0.5,
                        animationDelay: `${i * 160}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="px-4 py-3.5 border-t border-border/30 bg-card/80 shrink-0">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`اكتب رسالة إلى ${agent.name}...`}
                rows={1}
                className="min-h-[46px] max-h-36 rounded-xl resize-none pr-4 pl-4 py-3 text-sm border-border/50 focus:border-primary/40 transition-colors bg-background/80"
                disabled={loading}
              />
            </div>
            <Button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-[46px] w-[46px] rounded-xl shrink-0"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 text-center select-none">
            Enter للإرسال · Shift+Enter لسطر جديد · المحتوى تحليلي استشاري فقط
          </p>
        </div>
      </div>
    </div>
  );
}
