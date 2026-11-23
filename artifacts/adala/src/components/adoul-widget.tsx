/**
 * AdoulWidget — Sales Bot (Light / Professional / Blue)
 * خلفية بيضاء · أزرق احترافي · تصميم هادئ ونظيف
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Scale, Send, X, ChevronDown, Sparkles, MessageCircle, Minimize2 } from "lucide-react";

/* ─── ألوان اللوحة ──────────────────────────────────────────── */
const BLUE       = "#1A56DB";   // الأزرق الرئيسي
const BLUE_D     = "#1344B5";   // أزرق داكن (hover)
const BLUE_L     = "#EFF6FF";   // خلفية فاتحة جداً
const BLUE_M     = "#DBEAFE";   // أزرق فاتح (chips)
const BLUE_T     = "#93C5FD";   // أزرق شفاف (حدود)
const WHITE      = "#FFFFFF";
const GRAY_50    = "#F8FAFC";   // خلفية الرسائل
const GRAY_100   = "#F1F5F9";   // الـ input area
const GRAY_200   = "#E2E8F0";   // الحدود
const GRAY_500   = "#64748B";   // نصوص ثانوية
const DARK       = "#0F172A";   // النص الرئيسي
const BASE_URL   = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const MKTG_URL   = `${BASE_URL}/api/adoul/marketing`;
const LEAD_URL   = `${BASE_URL}/api/adoul/lead`;
const SIGNUP_URL = `${BASE_URL}/sign-up`;

/* ─── Quick chips ────────────────────────────────────────────── */
const CHIPS = [
  "ما مميزات المنصة؟",
  "ما أسعار الباقات؟",
  "هل يوجد نسخة مجانية؟",
  "أريد تجربة المنصة",
];

const WELCOME = `مرحباً بك في **عدالة AI** 👋

أنا عدول — مساعدك الذكي. أساعدك في اكتشاف كيف تُحوّل منصتنا طريقة إدارة مكتبك القانوني.

سواء كنت محامياً مستقلاً أو تدير مكتباً متكاملاً — لدينا الحل المناسب لك.

بم يمكنني مساعدتك؟ 😊`;

interface Msg { id: string; role: "user" | "assistant"; content: string }

/* ─── Markdown بسيط (أزرق) ──────────────────────────────────── */
function MD({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  const inline = (s: string, k: string | number) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={k}>
        {parts.map((p, pi) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={pi} style={{ color: BLUE, fontWeight: 700 }}>{p.slice(2, -2)}</strong>
            : <span key={pi}>{p}</span>
        )}
      </span>
    );
  };

  while (i < lines.length) {
    const l = lines[i];
    if (/^[-*]\s/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].slice(2)); i++; }
      nodes.push(
        <ul key={`u${i}`} className="my-1.5 space-y-1">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ background: BLUE }} />
              <span style={{ color: "#334155", lineHeight: "1.75" }}>{inline(it, ii)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (l.trim() === "") {
      nodes.push(<div key={i} className="h-1" />);
    } else {
      nodes.push(
        <p key={i} className="text-xs" style={{ color: "#334155", lineHeight: "1.75" }}>
          {inline(l, i)}
        </p>
      );
    }
    i++;
  }
  return <div className="space-y-0.5">{nodes}</div>;
}

/* ─── Widget Component ───────────────────────────────────────── */
export default function AdoulWidget() {
  const [open, setOpen]           = useState(false);
  const [msgs, setMsgs]           = useState<Msg[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [streaming, setStreaming] = useState("");
  const [notif, setNotif]         = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const abortRef                  = useRef<AbortController | null>(null);

  /* إظهار notification بعد ٥ ثوانٍ */
  useEffect(() => {
    const t = setTimeout(() => setNotif(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const openChat = () => { setOpen(true); setNotif(false); };

  /* رسالة الترحيب */
  useEffect(() => {
    if (!open || msgs.length > 0) return;
    setMsgs([{ id: "w0", role: "assistant", content: WELCOME }]);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, streaming]);

  const extractPhone = (t: string) => t.match(/(\+?[0-9]{9,14})/)?.[1] ?? null;

  const saveLead = async (phone: string, msg: string) => {
    if (leadSaved) return;
    try {
      await fetch(LEAD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message: msg }),
      });
      setLeadSaved(true);
    } catch {}
  };

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Msg = { id: Date.now().toString(), role: "user", content };
    const nextMsgs = [...msgs, userMsg];
    setMsgs(nextMsgs);
    setLoading(true);
    setStreaming("");

    const phone = extractPhone(content);
    if (phone) saveLead(phone, content);

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    let full = "";

    try {
      const res = await fetch(MKTG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMsgs.map(m => ({ role: m.role, content: m.content })) }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const p = JSON.parse(line.slice(6).trim());
            if (p.chunk) { full += p.chunk; setStreaming(full); }
          } catch {}
        }
      }

      if (full) {
        setMsgs(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: full }]);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMsgs(prev => [...prev, {
          id: (Date.now() + 1).toString(), role: "assistant",
          content: "عذراً، انقطع الاتصال. يمكنك المحاولة مجدداً أو التواصل معنا مباشرة. 😊",
        }]);
      }
    } finally {
      setLoading(false);
      setStreaming("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [input, msgs, loading, leadSaved]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); send(); }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3" dir="rtl">

      {/* ── CSS ───────────────────────────────────────────────── */}
      <style>{`
        @keyframes aw-dot  { 0%,80%,100%{transform:translateY(0);opacity:.5} 40%{transform:translateY(-4px);opacity:1} }
        @keyframes aw-in   { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:none} }
        @keyframes aw-pop  { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
        .aw-in  { animation: aw-in  .28s cubic-bezier(.34,1.56,.64,1) }
        .aw-pop { animation: aw-pop .22s cubic-bezier(.34,1.56,.64,1) }
        .aw-scroll::-webkit-scrollbar { width:4px }
        .aw-scroll::-webkit-scrollbar-track { background:transparent }
        .aw-scroll::-webkit-scrollbar-thumb { background:${GRAY_200}; border-radius:4px }
      `}</style>

      {/* ── Notification bubble ───────────────────────────────── */}
      {notif && !open && (
        <div className="aw-in flex items-center gap-2 cursor-pointer"
          style={{
            background: WHITE,
            border: `1px solid ${GRAY_200}`,
            borderRadius: "16px 16px 4px 16px",
            padding: "10px 14px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
            maxWidth: "220px",
          }}
          onClick={openChat}
        >
          <span className="text-sm" style={{ color: DARK }}>👋 مرحباً! كيف يمكنني مساعدتك؟</span>
          <button
            onClick={e => { e.stopPropagation(); setNotif(false); }}
            className="shrink-0 transition-opacity hover:opacity-70"
            style={{ color: GRAY_500 }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── نافذة الشات ──────────────────────────────────────── */}
      {open && (
        <div className="aw-pop flex flex-col overflow-hidden"
          style={{
            width: "min(370px, calc(100vw - 24px))",
            height: "min(540px, calc(100vh - 110px))",
            background: WHITE,
            borderRadius: "20px",
            border: `1px solid ${GRAY_200}`,
            boxShadow: "0 24px 64px rgba(15,23,42,0.14), 0 4px 16px rgba(15,23,42,0.08)",
          }}
        >

          {/* Header */}
          <div style={{ background: BLUE, borderRadius: "20px 20px 0 0" }}
            className="flex items-center justify-between px-4 py-3.5 shrink-0">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.18)" }}>
                  <Scale className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                  style={{ background: "#22C55E" }} />
              </div>
              <div>
                <p className="font-bold text-white text-sm leading-tight">عدول</p>
                <p className="text-[11px] leading-tight" style={{ color: "rgba(255,255,255,0.72)" }}>
                  مساعد عدالة AI · متاح الآن
                </p>
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
              style={{ color: "rgba(255,255,255,0.7)" }}>
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Quick chips */}
          {msgs.length <= 1 && (
            <div className="flex gap-2 px-3 pt-3 pb-2 overflow-x-auto shrink-0"
              style={{ borderBottom: `1px solid ${GRAY_200}` }}>
              {CHIPS.map((c, i) => (
                <button key={i} onClick={() => send(c)}
                  className="shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full transition-all hover:scale-105 whitespace-nowrap"
                  style={{ background: BLUE_M, color: BLUE, border: `1px solid ${BLUE_T}` }}>
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 aw-scroll"
            style={{ background: GRAY_50 }}>

            {msgs.map(m => {
              const isUser = m.role === "user";
              return (
                <div key={m.id}
                  className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} items-end`}>

                  {/* Avatar عدول */}
                  {!isUser && (
                    <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                      style={{ background: BLUE }}>
                      ع
                    </div>
                  )}

                  <div className="max-w-[80%] px-3.5 py-2.5 text-xs"
                    style={isUser
                      ? {
                          background: BLUE,
                          color: WHITE,
                          borderRadius: "16px 16px 4px 16px",
                          boxShadow: `0 2px 8px rgba(26,86,219,0.25)`,
                        }
                      : {
                          background: WHITE,
                          color: DARK,
                          borderRadius: "16px 16px 16px 4px",
                          border: `1px solid ${GRAY_200}`,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                        }
                    }
                  >
                    {isUser
                      ? <span className="leading-relaxed whitespace-pre-wrap">{m.content}</span>
                      : <MD text={m.content} />
                    }
                  </div>
                </div>
              );
            })}

            {/* Streaming */}
            {streaming && (
              <div className="flex gap-2 items-end">
                <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: BLUE }}>ع</div>
                <div className="max-w-[80%] px-3.5 py-2.5 text-xs"
                  style={{
                    background: WHITE, color: DARK,
                    borderRadius: "16px 16px 16px 4px",
                    border: `1px solid ${BLUE_T}`,
                    boxShadow: "0 1px 8px rgba(26,86,219,0.08)",
                  }}>
                  <MD text={streaming} />
                  <span className="inline-block w-0.5 h-3.5 rounded-full me-0.5 align-middle animate-pulse"
                    style={{ background: BLUE }} />
                </div>
              </div>
            )}

            {/* Typing dots */}
            {loading && !streaming && (
              <div className="flex gap-2 items-end">
                <div className="w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: BLUE }}>ع</div>
                <div className="px-4 py-3 rounded-2xl flex gap-1.5 items-center"
                  style={{ background: WHITE, border: `1px solid ${GRAY_200}`, borderBottomRightRadius: "4px" }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 rounded-full block"
                      style={{ background: BLUE_T, animation: `aw-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* CTA Button */}
          <div className="shrink-0 px-3 pt-3 pb-1.5"
            style={{ borderTop: `1px solid ${GRAY_200}`, background: WHITE }}>
            <a href={SIGNUP_URL}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 hover:shadow-md"
              style={{
                background: BLUE,
                color: WHITE,
                boxShadow: `0 3px 12px rgba(26,86,219,0.22)`,
              }}>
              <Sparkles className="w-3.5 h-3.5" />
              ابدأ مجاناً — الآن
            </a>
          </div>

          {/* Input bar */}
          <div className="shrink-0 px-3 pb-3 pt-2" style={{ background: WHITE }}>
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl transition-all"
              style={{
                background: GRAY_100,
                border: `1.5px solid ${loading ? BLUE_T : GRAY_200}`,
              }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="اكتب سؤالك هنا…"
                disabled={loading}
                className="flex-1 bg-transparent outline-none text-xs leading-relaxed"
                style={{ fontFamily: "Cairo, sans-serif", color: DARK }}
              />
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all"
                style={{
                  background: input.trim() && !loading ? BLUE : GRAY_200,
                  color: input.trim() && !loading ? WHITE : GRAY_500,
                  boxShadow: input.trim() && !loading ? `0 2px 8px rgba(26,86,219,0.35)` : "none",
                }}>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[9px] text-center mt-1.5" style={{ color: GRAY_500, opacity: 0.6 }}>
              عدول — مساعد عدالة AI للمكاتب القانونية
            </p>
          </div>
        </div>
      )}

      {/* ── Floating button ───────────────────────────────────── */}
      <button
        onClick={() => open ? setOpen(false) : openChat()}
        className="relative flex items-center gap-2.5 px-4 py-3 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: open ? BLUE_D : BLUE,
          color: WHITE,
          boxShadow: `0 8px 28px rgba(26,86,219,0.40)`,
          fontFamily: "Cairo, sans-serif",
        }}
      >
        {/* Pulsing ring — يظهر عند الإغلاق فقط */}
        {!open && (
          <span className="absolute inset-0 rounded-2xl animate-ping"
            style={{ background: BLUE, opacity: 0.25 }} />
        )}

        {/* Badge عدد الرسائل غير المقروءة */}
        {!open && msgs.length === 0 && (
          <span className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
            style={{ background: "#EF4444", color: WHITE }}>
            1
          </span>
        )}

        {open
          ? <ChevronDown className="w-5 h-5" />
          : <MessageCircle className="w-5 h-5" />
        }
        <span className="font-bold text-sm">عدول</span>
      </button>

    </div>
  );
}
