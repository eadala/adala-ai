/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Send, Bot, User, Sparkles, Zap, Brain, Scale, FileText,
  Plus, Calendar, Search, DollarSign, ChevronRight, RefreshCw,
  MessageSquare, Mic, CornerDownLeft, X, Clock, TrendingUp,
  AlertTriangle, CheckCircle2, BarChart3
} from "lucide-react";

import { useAuthReady } from "@/hooks/use-auth-ready";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (p: string) => `${BASE}${p}`;

function fetchJ(url: string, opts?: RequestInit) {
  return fetch(url, opts).then(r => {
    if (!r.ok) throw new Error("خطأ");
    return r.json();
  });
}

function authFetchJ(url: string, opts?: RequestInit) {
  return authFetch(url, opts).then(r => {
    if (!r.ok) throw new Error("خطأ");
    return r.json();
  });
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  confidence?: number;
  toolUsed?: string;
  intelligence?: any;
  action?: any;
  ts: number;
}

const INTENT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  CREATE_CASE:          { label: "فتح قضية",      icon: Scale,      color: "bg-blue-100 text-blue-700" },
  CREATE_CLIENT:        { label: "إضافة عميل",    icon: User,       color: "bg-purple-100 text-purple-700" },
  CREATE_REMINDER:      { label: "تذكير",          icon: Clock,      color: "bg-amber-100 text-amber-700" },
  SCHEDULE_EVENT:       { label: "جدولة موعد",    icon: Calendar,   color: "bg-teal-100 text-teal-700" },
  DRAFT_DOCUMENT:       { label: "صياغة وثيقة",   icon: FileText,   color: "bg-emerald-100 text-emerald-700" },
  ANALYZE_CASE:         { label: "تحليل قضية",    icon: Brain,      color: "bg-indigo-100 text-indigo-700" },
  CALCULATE_PROBABILITY:{ label: "احتمالية الفوز", icon: TrendingUp, color: "bg-rose-100 text-rose-700" },
  FINANCIAL_SUMMARY:    { label: "ملخص مالي",     icon: DollarSign, color: "bg-green-100 text-green-700" },
  SEARCH_DATA:          { label: "بحث",            icon: Search,     color: "bg-muted/50 text-foreground/70" },
  NAVIGATE:             { label: "تنقل",            icon: ChevronRight, color: "bg-muted/50 text-foreground/70" },
  GENERAL_QUESTION:     { label: "سؤال",           icon: MessageSquare, color: "bg-muted/50 text-muted-foreground" },
};

const QUICK_COMMANDS = [
  { label: "افتح قضية جديدة", icon: Scale,      prompt: "افتح قضية جديدة" },
  { label: "الملخص المالي",    icon: DollarSign, prompt: "أعطني الملخص المالي للمكتب" },
  { label: "قائمة المهام",     icon: CheckCircle2, prompt: "ما هي المهام المعلقة؟" },
  { label: "جلسة قادمة",      icon: Calendar,   prompt: "ما هي الجلسات القادمة هذا الأسبوع؟" },
  { label: "تحليل قضية",      icon: Brain,      prompt: "حلل قضية c1" },
  { label: "أضف تذكير",       icon: Clock,      prompt: "أضف تذكير لمراجعة عقد الشراكة بعد أسبوع" },
];

function esc(s: string): string {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function renderMarkdown(text: string): string {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

function ProbabilityRing({ pct, size = 60 }: { pct: number; size?: number }) {
  const r = size * 0.4;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 70 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={size * 0.08} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.08}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      <text x={size / 2} y={size / 2 + 5} fill={color} fontSize={size * 0.22} fontWeight={700}
        textAnchor="middle" style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}>
        {pct}%
      </text>
    </svg>
  );
}

function IntelligenceCard({ intel }: { intel: any }) {
  const riskColor = intel.riskLevel === "low" ? "text-emerald-600" : intel.riskLevel === "medium" ? "text-amber-600" : "text-red-600";
  const riskLabel = intel.riskLevel === "low" ? "منخفضة" : intel.riskLevel === "medium" ? "متوسطة" : "عالية";
  return (
    <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl space-y-3">
      <div className="flex items-center gap-4">
        <ProbabilityRing pct={intel.probabilityOfWin} size={70} />
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">احتمالية الفوز</div>
          <div className="text-2xl font-bold text-blue-700">{intel.probabilityOfWin}%</div>
          <div className={`text-sm font-medium ${riskColor}`}>خطر: {riskLabel}</div>
        </div>
      </div>
      {intel.keyStrengths?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-emerald-700 mb-1">✅ نقاط القوة</div>
          {intel.keyStrengths.map((s: string, i: number) => (
            <div key={i} className="text-xs text-foreground/70 flex gap-1.5"><span className="text-emerald-500">•</span>{s}</div>
          ))}
        </div>
      )}
      {intel.keyWeakPoints?.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-red-600 mb-1">⚠️ نقاط الضعف</div>
          {intel.keyWeakPoints.map((w: string, i: number) => (
            <div key={i} className="text-xs text-foreground/70 flex gap-1.5"><span className="text-red-400">•</span>{w}</div>
          ))}
        </div>
      )}
      {intel.recommendedStrategy && (
        <div className="bg-card rounded-xl p-3 text-xs text-muted-foreground border border-blue-200/50">
          <div className="font-semibold text-blue-700 mb-1">💡 الاستراتيجية</div>
          {intel.recommendedStrategy}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, onAction }: { msg: Message; onAction: (url: string) => void }) {
  const isUser = msg.role === "user";
  const intentMeta = msg.intent ? INTENT_LABELS[msg.intent] : null;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} mb-4`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5
        ${isUser ? "bg-blue-600" : "bg-gradient-to-br from-indigo-500 to-purple-600"}`}>
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
      </div>
      <div className={`max-w-[80%] space-y-2`}>
        {/* Intent badge */}
        {!isUser && intentMeta && msg.intent !== "GENERAL_QUESTION" && (
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${intentMeta.color}`}>
            <intentMeta.icon className="h-3 w-3" />
            {intentMeta.label}
            {msg.toolUsed && <span className="opacity-60">• نُفِّذ</span>}
          </div>
        )}

        {/* Bubble */}
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "bg-blue-600 text-white rounded-tr-sm"
            : "bg-white border border-border text-foreground rounded-tl-sm shadow-sm"}`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />

        {/* Intelligence card */}
        {!isUser && msg.intelligence && <IntelligenceCard intel={msg.intelligence} />}

        {/* Action button */}
        {!isUser && msg.action?.url && (
          <button onClick={() => onAction(msg.action.url)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition">
            <ChevronRight className="h-3 w-3" /> انتقل للصفحة
          </button>
        )}

        <div className="text-xs text-muted-foreground px-1">
          {new Date(msg.ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

export default function AICopilotPage() {
  const [, nav] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "مرحباً! أنا **عدل** — مساعدك القانوني الذكي.\n\nأستطيع مساعدتك في:\n• فتح القضايا وتحليلها\n• إضافة العملاء والتذكيرات\n• صياغة الوثائق القانونية\n• الملخص المالي للمكتب\n• حساب احتمالية الفوز في القضايا\n\nاسألني أي شيء أو اختر أمراً سريعاً أدناه 👇",
      intent: "GENERAL_QUESTION",
      ts: Date.now(),
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();

  const authReady = useAuthReady();
  const snapshotQ = useQuery({
    queryKey: ["copilot-snapshot"],
    queryFn: () => authFetchJ(api("/api/copilot/snapshot")),
    staleTime: 60000,
    enabled: authReady,
  });
  const snap = snapshotQ.data;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;
    const userMsg: Message = { id: Date.now() + "u", role: "user", content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const history = messages
        .filter(m => m.id !== "welcome")
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      const data = await fetchJ(api("/api/copilot/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, pageContext: "AI Copilot" }),
      });

      const botMsg: Message = {
        id: Date.now() + "b",
        role: "assistant",
        content: data.reply,
        intent: data.intent,
        confidence: data.confidence,
        toolUsed: data.toolUsed,
        intelligence: data.intelligence,
        action: data.action,
        ts: Date.now(),
      };
      setMessages(prev => [...prev, botMsg]);
      qc.invalidateQueries({ queryKey: ["copilot-snapshot"] });

      if (data.action?.type === "navigate" && data.action.url) {
        setTimeout(() => nav(data.action.url), 1500);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + "e", role: "assistant",
        content: "عذراً، حدث خطأ. حاول مرة أخرى.", ts: Date.now()
      }]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }, [messages, isTyping, nav, qc]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearChat = () => setMessages(prev => [prev[0]]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-muted/30" dir="rtl">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-foreground text-lg">عدل — المساعد القانوني الذكي</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              AI Legal Copilot v2 — Intent Engine + Tool Registry + Memory
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {snap && (
            <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground bg-muted/30 border border-border rounded-xl px-3 py-2">
              <span><Scale className="h-3 w-3 inline ms-1 text-blue-500" />{snap.activeCases} قضية</span>
              <span><Clock className="h-3 w-3 inline ms-1 text-amber-500" />{snap.pendingTasks} مهمة</span>
              <span><Calendar className="h-3 w-3 inline ms-1 text-purple-500" />{snap.upcomingEvents} موعد</span>
              {snap.overdueInvoices > 0 && <span className="text-red-500"><AlertTriangle className="h-3 w-3 inline ms-1" />{snap.overdueInvoices} متأخرة</span>}
            </div>
          )}
          <button onClick={clearChat} title="مسح المحادثة"
            className="p-2 rounded-xl hover:bg-muted/50 text-muted-foreground hover:text-foreground/70 transition">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="bg-card border-b border-border/50 px-4 py-2 flex gap-2 overflow-x-auto shrink-0 scrollbar-hide">
        {QUICK_COMMANDS.map((cmd) => (
          <button key={cmd.label} onClick={() => sendMessage(cmd.prompt)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/30 border border-border
              text-xs font-medium text-foreground/70 whitespace-nowrap hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition shrink-0">
            <cmd.icon className="h-3.5 w-3.5" />
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} onAction={(url) => nav(url)} />
          ))}
          {isTyping && (
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-5">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-card border-t border-border px-4 md:px-8 py-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-muted/30 border border-border rounded-2xl p-3
            focus-within:border-blue-400 focus-within:bg-white transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="اكتب أمرك… مثلاً: افتح قضية ضد شركة X، أو حلل قضية c1، أو الملخص المالي"
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder-gray-400 resize-none
                outline-none max-h-32 leading-relaxed"
              style={{ minHeight: "24px" }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 128) + "px";
              }}
            />
            <div className="flex items-center gap-1 shrink-0">
              <kbd className="text-xs text-muted-foreground hidden sm:block">⏎ إرسال</kbd>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center
                  hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              يعمل بـ Gemini 2.5 Flash + Intent Engine + Tool Registry
            </div>
            <div className="text-xs text-muted-foreground">Shift+Enter للسطر الجديد</div>
          </div>
        </div>
      </div>
    </div>
  );
}
