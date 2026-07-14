/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-non-null-assertion -- pre-existing lint debt; authFetch migration */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BrainCircuit, Send, X, Minimize2, Sparkles,
  Scale, Receipt, CalendarDays, Bell, BarChart3,
  ChevronRight, Loader2, Zap,
} from "lucide-react";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { authFetch } from "@/lib/authFetch";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: { type: string; url?: string; [k: string]: any };
  ts: number;
}

const PAGE_LABELS: Record<string, string> = {
  "/dashboard": "لوحة التحكم",
  "/cases": "القضايا",
  "/clients": "العملاء",
  "/invoices": "الفواتير",
  "/contracts": "العقود",
  "/reminders": "التذكيرات",
  "/analytics": "التحليلات",
  "/backup": "مركز البيانات",
};

const QUICK = [
  { icon: Scale,       label: "القضايا المفتوحة",    q: "كم عدد القضايا المفتوحة؟" },
  { icon: Receipt,     label: "الفواتير المتأخرة",   q: "ما الفواتير المتأخرة؟" },
  { icon: CalendarDays,label: "مواعيد الأسبوع",     q: "ما مواعيد هذا الأسبوع؟" },
  { icon: BarChart3,   label: "ملخص المكتب",        q: "ملخص المكتب اليوم" },
];

function renderText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-1.5" />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>
        : part
    );
    return (
      <p key={i} className="text-sm leading-relaxed text-white/85">
        {parts}
      </p>
    );
  });
}

export function FloatingCopilot() {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, navigate]  = useLocation();
  const bottomRef             = useRef<HTMLDivElement>(null);
  const taRef                 = useRef<HTMLTextAreaElement>(null);

  const pageLabel = PAGE_LABELS[location] ?? location;

  const authReady = useAuthReady();
  const { data: snapshot } = useQuery({
    queryKey: ["copilot-snapshot"],
    queryFn: () => authFetch(`${BASE}/api/copilot/snapshot`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled: authReady,
  });

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) taRef.current?.focus();
  }, [open]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: msg, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch(`${BASE}/api/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history, pageContext: pageLabel }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        action: data.action,
        ts: Date.now(),
      };
      setMessages(prev => [...prev, aMsg]);

      /* Navigate if action says so */
      if (data.action?.type === "navigate" && data.action.url) {
        setTimeout(() => {
          navigate(data.action.url);
          setOpen(false);
        }, 1200);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "assistant",
        content: `⚠️ حدث خطأ: ${e.message}`, ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, pageLabel, navigate]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* ── Floating button ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-6 z-[300] group flex items-center gap-2
            bg-gradient-to-br from-[#C9A84C] to-[#a8882e]
            text-[#0B1B2B] font-bold rounded-2xl shadow-2xl
            px-4 py-3 transition-all duration-200
            hover:scale-105 hover:shadow-[0_0_32px_rgba(201,168,76,0.45)]"
          title="المساعد الذكي عدولي"
        >
          <BrainCircuit className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm hidden sm:inline">عدولي AI</span>
          {/* Dot badges */}
          {!!snapshot?.overdueInvoices && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
              {snapshot.overdueInvoices > 9 ? "9+" : snapshot.overdueInvoices}
            </span>
          )}
          <span className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-[#C9A84C]" />
        </button>
      )}

      {/* ── Panel ── */}
      {open && (
        <div
          className="fixed bottom-6 left-6 z-[300] flex flex-col
            w-[360px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-5rem)]
            rounded-2xl overflow-hidden shadow-2xl
            border border-[#C9A84C]/25 bg-[#0D1B2A]"
          style={{ animation: "slideUpIn 0.2s ease-out" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
            bg-gradient-to-r from-[#0D1B2A] to-[#111E30]
            border-b border-[#C9A84C]/20 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center">
                <BrainCircuit className="h-4 w-4 text-[#C9A84C]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">عدولي AI</p>
                <p className="text-[10px] text-white/40 mt-0.5">{pageLabel} · كامل الصلاحيات</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] flex-shrink-0" />
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white/70"
                  onClick={() => setMessages([])}>
                  <Minimize2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white/70"
                onClick={() => setOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Snapshot bar */}
          {snapshot && (
            <div className="flex items-center gap-3 px-4 py-2 bg-[#0B1520]/60 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-[11px]">
                <Scale className="h-3 w-3 text-blue-400" />
                <span className="text-white/60">{snapshot.activeCases} قضية</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <Receipt className="h-3 w-3 text-amber-400" />
                <span className={snapshot.overdueInvoices > 0 ? "text-amber-400 font-semibold" : "text-white/60"}>
                  {snapshot.overdueInvoices} متأخرة
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <CalendarDays className="h-3 w-3 text-emerald-400" />
                <span className="text-white/60">{snapshot.upcomingEvents} موعد</span>
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 py-3 space-y-3">
              {isEmpty && (
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#C9A84C]/15 flex items-center justify-center mx-auto mb-2">
                      <Sparkles className="h-6 w-6 text-[#C9A84C]" />
                    </div>
                    <p className="text-sm font-semibold text-white">مرحباً! أنا عدولي</p>
                    <p className="text-xs text-white/45 mt-1">مساعدك القانوني الذكي — اسألني أي شيء</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK.map(q => (
                      <button
                        key={q.q}
                        onClick={() => send(q.q)}
                        className="flex flex-col items-start gap-1.5 p-3 rounded-xl
                          bg-white/5 hover:bg-white/10 border border-white/8 hover:border-[#C9A84C]/30
                          text-right transition-all duration-150 group"
                      >
                        <q.icon className="h-4 w-4 text-[#C9A84C] group-hover:scale-110 transition-transform" />
                        <span className="text-xs text-white/70 group-hover:text-white leading-tight">{q.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                    m.role === "user"
                      ? "bg-[#C9A84C]/20 border border-[#C9A84C]/25 rounded-br-sm"
                      : "bg-white/8 border border-white/10 rounded-bl-sm"
                  }`}>
                    {m.role === "user"
                      ? <p className="text-sm text-[#C9A84C]">{m.content}</p>
                      : <div className="space-y-0.5">{renderText(m.content)}</div>
                    }
                    {m.action?.type === "navigate" && m.action.url && (
                      <button
                        onClick={() => { navigate(m.action!.url!); setOpen(false); }}
                        className="mt-2 flex items-center gap-1.5 text-[11px] text-[#C9A84C] hover:text-white transition-colors"
                      >
                        <ChevronRight className="h-3 w-3" />
                        انتقل إلى الصفحة
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-end">
                  <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 text-[#C9A84C] animate-spin" />
                    <span className="text-xs text-white/50">يفكر...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-white/8 flex-shrink-0 bg-[#0B1520]/40">
            <div className="flex items-end gap-2">
              <Textarea
                ref={taRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="اكتب سؤالك أو أمرك..."
                rows={1}
                className="flex-1 resize-none bg-white/8 border-white/15 text-white placeholder:text-white/35
                  text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-[#C9A84C]/50
                  focus-visible:border-[#C9A84C]/40 min-h-[36px] max-h-[90px] py-2 px-3"
                dir="rtl"
              />
              <Button
                size="icon"
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="h-9 w-9 rounded-xl bg-[#C9A84C] hover:bg-[#a8882e] text-[#0B1B2B] flex-shrink-0
                  disabled:opacity-30 transition-all"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-white/25 mt-1.5 text-center">
              Enter للإرسال · Shift+Enter لسطر جديد
            </p>
          </div>
        </div>
      )}
    </>
  );
}
