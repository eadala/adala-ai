/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  عدول — مساعد قانوني ذكي                                   ║
 * ║  ملف مستقل قابل للنسخ إلى أي مشروع React                   ║
 * ║  كل المنطق والواجهة في ملف واحد                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * للنسخ إلى مشروع آخر:
 * 1. انسخ هذا الملف
 * 2. أنشئ مسار POST /api/adoul/chat في backend
 * 3. غيّر BASE_URL ليطابق مشروعك
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Scale, Send, RotateCcw, ChevronDown, Sparkles, BookOpen,
  FileText, Users, Building2, Briefcase, Shield, Gavel, X } from "lucide-react";

/* ─── إعدادات قابلة للتغيير ─────────────────────────────────── */
const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API_PATH = `${BASE_URL}/api/adoul/chat`;
const BRAND_COLOR = "#C9A84C";
const BRAND_COLOR_DARK = "#0D1626";
const BG_MAIN = "#080F1E";
const BG_CARD = "#0D1626";
const BG_CARD2 = "#111827";

/* ─── أنواع البيانات ─────────────────────────────────────────── */
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

/* ─── اقتراحات البداية ───────────────────────────────────────── */
const SUGGESTIONS = [
  { icon: FileText,   text: "كيف أصيغ عقد إيجار سكني صحيح قانوناً؟",               category: "عقود" },
  { icon: Users,      text: "ما حقوقي في حال فصلي من العمل تعسفياً؟",              category: "عمل" },
  { icon: Building2,  text: "ما إجراءات تأسيس شركة ذات مسؤولية محدودة في السعودية؟",category: "تجارة" },
  { icon: Shield,     text: "كيف أحمي علامتي التجارية من التقليد؟",                 category: "ملكية فكرية" },
  { icon: Gavel,      text: "ما الفرق بين الدعوى المدنية والجنائية؟",               category: "قضاء" },
  { icon: BookOpen,   text: "ما حقوق المرأة في عقد الزواج وفق نظام الأحوال الشخصية؟", category: "أحوال شخصية" },
];

/* ─── تنسيق الردود (Bold ومسافات) ──────────────────────────── */
function RenderContent({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="font-bold" style={{ color: BRAND_COLOR }}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </span>
  );
}

/* ─── فقاعة رسالة واحدة ─────────────────────────────────────── */
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} items-end mb-4`}>
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
        style={isUser
          ? { background: "rgba(99,102,241,0.2)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }
          : { background: `linear-gradient(135deg, ${BRAND_COLOR}, #E0C060)`, color: BRAND_COLOR_DARK }
        }
      >
        {isUser ? "أ" : "ع"}
      </div>

      {/* Bubble */}
      <div
        className="max-w-[80%] px-4 py-3 rounded-2xl text-sm"
        style={isUser
          ? {
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              color: "rgba(255,255,255,0.9)",
              borderBottomLeftRadius: "4px",
            }
          : {
              background: BG_CARD2,
              border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.85)",
              borderBottomRightRadius: "4px",
            }
        }
      >
        <RenderContent text={msg.content} />
        <div className="text-[10px] mt-1.5 opacity-30 text-left dir-ltr">
          {new Date(msg.ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

/* ─── مؤشر الكتابة ──────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex gap-3 items-end mb-4">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
        style={{ background: `linear-gradient(135deg, ${BRAND_COLOR}, #E0C060)`, color: BRAND_COLOR_DARK }}
      >ع</div>
      <div
        className="px-4 py-3 rounded-2xl text-sm flex items-center gap-1"
        style={{ background: BG_CARD2, border: "1px solid rgba(255,255,255,0.07)", borderBottomRightRadius: "4px" }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full inline-block"
            style={{
              background: BRAND_COLOR,
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.7,
            }}
          />
        ))}
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

/* ─── شاشة الترحيب ──────────────────────────────────────────── */
function WelcomeScreen({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 pb-8 text-center">
      {/* Logo */}
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-2xl"
        style={{ background: `linear-gradient(135deg, ${BRAND_COLOR}, #E0C060)` }}
      >
        <Scale className="w-10 h-10" style={{ color: BRAND_COLOR_DARK }} />
      </div>

      <h1 className="text-3xl font-black text-white mb-2">
        مرحباً، أنا <span style={{ color: BRAND_COLOR }}>عدول</span>
      </h1>
      <p className="text-white/50 max-w-sm mb-10 leading-relaxed">
        مساعدك القانوني الذكي — أجيب على أسئلتك القانونية وأساعدك في فهم حقوقك وإعداد وثائقك
      </p>

      {/* Quick badges */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {["عقود", "عمل", "تجارة", "أحوال شخصية", "قضاء", "ملكية فكرية"].map(tag => (
          <span
            key={tag}
            className="text-xs px-3 py-1 rounded-full font-medium"
            style={{ background: `${BRAND_COLOR}15`, color: BRAND_COLOR, border: `1px solid ${BRAND_COLOR}30` }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Suggestion cards */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SUGGESTIONS.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => onSuggest(s.text)}
              className="text-right p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-100 group"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${BRAND_COLOR}40`; e.currentTarget.style.background = `${BRAND_COLOR}08`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${BRAND_COLOR}15`, border: `1px solid ${BRAND_COLOR}25` }}
                >
                  <Icon className="w-4 h-4" style={{ color: BRAND_COLOR }} />
                </div>
                <div>
                  <div className="text-[10px] mb-1 font-bold" style={{ color: BRAND_COLOR }}>{s.category}</div>
                  <p className="text-white/75 text-xs leading-relaxed">{s.text}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── صفحة عدول الرئيسية ─────────────────────────────────────── */
export default function AdoulPage() {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLTextAreaElement>(null);

  /* تحميل المحادثة من localStorage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("adoul_messages");
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
  }, []);

  /* حفظ المحادثة */
  useEffect(() => {
    if (messages.length > 0)
      localStorage.setItem("adoul_messages", JSON.stringify(messages.slice(-40)));
  }, [messages]);

  /* تمرير للأسفل */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* ضبط ارتفاع الـ textarea تلقائياً */
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  /* إرسال الرسالة */
  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setError(null);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content, ts: Date.now() };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setLoading(true);

    try {
      const res = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "خطأ في الاتصال" }));
        throw new Error(err.error || "خطأ غير متوقع");
      }

      const data = await res.json();
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        ts: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      setError(e.message || "فشل الاتصال. تأكد من الاتصال بالإنترنت وحاول مرة أخرى.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, messages, loading]);

  /* مسح المحادثة */
  const clear = () => {
    setMessages([]);
    setError(null);
    localStorage.removeItem("adoul_messages");
  };

  /* Ctrl/Cmd+Enter = إرسال */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: BG_MAIN, fontFamily: "Cairo, sans-serif" }} dir="rtl">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: BG_CARD }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${BRAND_COLOR}, #E0C060)` }}
          >
            <Scale className="w-5 h-5" style={{ color: BRAND_COLOR_DARK }} />
          </div>
          <div>
            <h2 className="font-black text-white text-base leading-none">عدول</h2>
            <p className="text-[10px] mt-0.5" style={{ color: BRAND_COLOR }}>مساعد قانوني ذكي</p>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold mr-2"
            style={{ background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            متاح الآن
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
              title="محادثة جديدة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">جديد</span>
            </button>
          )}
          <div className="text-xs text-white/20">{messages.length > 0 ? `${messages.length} رسالة` : ""}</div>
        </div>
      </div>

      {/* ── Messages area ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <WelcomeScreen onSuggest={text => send(text)} />
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
            {loading && <TypingIndicator />}
            {error && (
              <div
                className="flex items-center justify-between p-4 rounded-2xl mb-4 text-sm"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}
              >
                <span>{error}</span>
                <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input bar ────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: BG_CARD }}
      >
        <div className="max-w-3xl mx-auto">
          <div
            className="flex items-end gap-3 rounded-2xl px-4 py-3"
            style={{ background: BG_MAIN, border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="اسأل عدول عن أي مسألة قانونية…"
              disabled={loading}
              className="flex-1 bg-transparent outline-none resize-none text-sm text-white/90 placeholder-white/25 leading-relaxed"
              style={{ minHeight: "24px", maxHeight: "120px", fontFamily: "Cairo, sans-serif" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200"
              style={{
                background: input.trim() && !loading ? `linear-gradient(135deg, ${BRAND_COLOR}, #E0C060)` : "rgba(255,255,255,0.05)",
                color: input.trim() && !loading ? BRAND_COLOR_DARK : "rgba(255,255,255,0.2)",
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-white/20 text-center mt-2">
            عدول يقدم معلومات قانونية إرشادية · Ctrl+Enter للإرسال
          </p>
        </div>
      </div>

      {/* Scroll to bottom button */}
      {messages.length > 3 && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg transition-all z-10"
          style={{ background: BRAND_COLOR, color: BRAND_COLOR_DARK }}
        >
          <ChevronDown className="w-3.5 h-3.5" />
          الأحدث
        </button>
      )}
    </div>
  );
}

/* ─── للنسخ إلى مشروع آخر ───────────────────────────────────────
 * 1. انسخ هذا الملف كاملاً
 * 2. أنشئ في backend:
 *    POST /api/adoul/chat
 *    Body: { messages: [{role, content}] }
 *    Returns: { reply: string, modelUsed: string }
 * 3. غيّر BASE_URL في أعلى الملف
 * 4. ضع في index.html: <script src="https://fonts.googleapis.com/css2?family=Cairo"/>
 * ───────────────────────────────────────────────────────────── */
