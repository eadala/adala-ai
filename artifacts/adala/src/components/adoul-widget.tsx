/**
 * AdoulWidget — Sales Bot لصفحة Landing
 * يرحب بالزوار ويعرض الخدمات والباقات ويجمع رقم التواصل
 * ملف مستقل — انسخه كاملاً لأي مشروع
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Scale, Send, X, ChevronDown, Sparkles, MessageCircle } from "lucide-react";

/* ─── إعدادات ────────────────────────────────────────────────── */
const BASE_URL      = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const MARKETING_URL = `${BASE_URL}/api/adoul/marketing`;
const LEAD_URL      = `${BASE_URL}/api/adoul/lead`;
const SIGN_UP_URL   = `${BASE_URL}/sign-up`;
const GOLD          = "#C9A84C";
const GOLD_L        = "#E0C060";
const DARK          = "#0D1626";
const BG            = "#080F1E";
const SURFACE       = "#0D1B30";
const SURFACE2      = "#0F2040";

/* ─── Quick chips بداية المحادثة ─────────────────────────────── */
const QUICK_CHIPS = [
  "ما مميزات المنصة؟",
  "ما أسعار الباقات؟",
  "هل يوجد نسخة مجانية؟",
  "أريد تجربة المنصة",
];

/* ─── الرسالة الترحيبية الأولى ──────────────────────────────── */
const WELCOME_MSG = `مرحباً بك في منصة **عدالة AI** 👋

أنا عدول — مساعدك الذكي. أساعدك في اكتشاف كيف تُحوّل منصتنا طريقة إدارة مكتبك القانوني.

سواء كنت محامياً مستقلاً أو تدير مكتباً متكاملاً — لدينا الحل المناسب لك.

بم يمكنني مساعدتك؟ 😊`;

/* ─── أنواع البيانات ─────────────────────────────────────────── */
interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

/* ─── Markdown بسيط ─────────────────────────────────────────── */
function MD({ text, color = GOLD }: { text: string; color?: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  const inline = (s: string, k: string | number) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={k}>
        {parts.map((p, pi) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={pi} style={{ color, fontWeight: 700 }}>{p.slice(2, -2)}</strong>
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
        <ul key={`u${i}`} className="my-1 space-y-0.5">
          {items.map((it, ii) => (
            <li key={ii} className="flex gap-1.5 text-xs">
              <span style={{ color }} className="shrink-0 mt-0.5 text-[9px]">◆</span>
              <span className="opacity-80 leading-relaxed">{inline(it, ii)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (l.trim() === "") {
      nodes.push(<div key={i} className="h-1.5" />);
    } else {
      nodes.push(<p key={i} className="text-xs leading-relaxed opacity-85">{inline(l, i)}</p>);
    }
    i++;
  }
  return <div className="space-y-0.5">{nodes}</div>;
}

/* ─── Widget ─────────────────────────────────────────────────── */
export default function AdoulWidget() {
  const [open, setOpen]           = useState(false);
  const [msgs, setMsgs]           = useState<Msg[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [streaming, setStreaming] = useState("");
  const [notif, setNotif]         = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);
  const [msgCount, setMsgCount]   = useState(0);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const abortRef                  = useRef<AbortController | null>(null);

  /* إظهار notification bubble بعد ٥ ثوانٍ */
  useEffect(() => {
    const t = setTimeout(() => setNotif(true), 5000);
    return () => clearTimeout(t);
  }, []);

  /* إغلاق notification عند الفتح */
  const openChat = () => { setOpen(true); setNotif(false); };

  /* رسالة الترحيب عند أول فتح */
  useEffect(() => {
    if (!open || msgs.length > 0) return;
    setMsgs([{ id: "w0", role: "assistant", content: WELCOME_MSG }]);
  }, [open]);

  /* تمرير للأسفل */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, streaming]);

  /* استخراج رقم الهاتف من النص */
  const extractPhone = (text: string) => {
    const m = text.match(/(\+?[0-9]{9,14})/);
    return m ? m[1] : null;
  };

  /* حفظ الـ lead */
  const saveLead = async (phone: string, message: string) => {
    if (leadSaved) return;
    try {
      await fetch(LEAD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, message }),
      });
      setLeadSaved(true);
    } catch {}
  };

  /* إرسال رسالة */
  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: Msg = { id: Date.now().toString(), role: "user", content };
    const nextMsgs = [...msgs, userMsg];
    setMsgs(nextMsgs);
    setMsgCount(c => c + 1);
    setLoading(true);
    setStreaming("");

    /* تحقق من رقم الهاتف في رسالة المستخدم */
    const phone = extractPhone(content);
    if (phone) saveLead(phone, content);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    let fullText = "";

    try {
      const res = await fetch(MARKETING_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("failed");

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
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.done) break;
            if (parsed.chunk) { fullText += parsed.chunk; setStreaming(fullText); }
          } catch {}
        }
      }

      if (fullText) {
        setMsgs(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: fullText }]);
        /* تحقق من رقم الهاتف في رد عدول إن أعطاه المستخدم ضمن السياق */
        const p2 = extractPhone(fullText);
        if (p2) saveLead(p2, "extracted from context");
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMsgs(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "عذراً، انقطع الاتصال. يمكنك التواصل معنا مباشرة على الواتساب أو إعادة المحاولة. 😊",
        }]);
      }
    } finally {
      setLoading(false);
      setStreaming("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, msgs, loading, leadSaved]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); send(); }
  };

  /* ── Floating button ────────────────────────────────────────── */
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3" dir="rtl">

      {/* notification bubble */}
      {notif && !open && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-br-sm shadow-2xl cursor-pointer text-sm max-w-[220px] animate-bounce-in"
          style={{ background: SURFACE, border: `1px solid ${GOLD}40`, color: "rgba(255,255,255,0.9)" }}
          onClick={openChat}
        >
          <span>👋 مرحباً! هل تريد معرفة المزيد؟</span>
          <button onClick={e => { e.stopPropagation(); setNotif(false); }}
            className="shrink-0 opacity-40 hover:opacity-80">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* نافذة الشات */}
      {open && (
        <div
          className="flex flex-col rounded-3xl shadow-2xl overflow-hidden"
          style={{
            width: "min(360px, calc(100vw - 32px))",
            height: "min(520px, calc(100vh - 120px))",
            background: BG,
            border: `1px solid ${GOLD}30`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px ${GOLD}15`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: SURFACE, borderBottom: `1px solid ${GOLD}20` }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_L})` }}>
                <Scale className="w-4 h-4" style={{ color: DARK }} />
              </div>
              <div>
                <p className="font-black text-white text-sm leading-none">عدول</p>
                <p className="text-[10px] mt-0.5" style={{ color: GOLD }}>مساعد عدالة AI</p>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                style={{ background: "rgba(16,185,129,0.1)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                متاح
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick chips — تظهر في البداية فقط */}
          {msgs.length <= 1 && (
            <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0"
              style={{ borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
              {QUICK_CHIPS.map((c, i) => (
                <button key={i} onClick={() => send(c)}
                  className="shrink-0 text-[10px] px-2.5 py-1.5 rounded-full font-medium transition-all hover:scale-105"
                  style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}28` }}>
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
            style={{ scrollbarWidth: "thin", scrollbarColor: `${GOLD}20 transparent` }}>
            {msgs.map(m => (
              <div key={m.id}
                className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"} items-end`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-black"
                    style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_L})`, color: DARK }}>ع</div>
                )}
                <div className="max-w-[82%] px-3 py-2 rounded-xl text-xs"
                  style={m.role === "user"
                    ? { background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)", color: "rgba(255,255,255,0.9)", borderBottomLeftRadius: "4px" }
                    : { background: SURFACE2, border: `1px solid rgba(255,255,255,0.07)`, color: "rgba(255,255,255,0.88)", borderBottomRightRadius: "4px" }
                  }>
                  {m.role === "user"
                    ? <span className="leading-relaxed whitespace-pre-wrap">{m.content}</span>
                    : <MD text={m.content} color={GOLD} />
                  }
                </div>
              </div>
            ))}

            {/* streaming رد عدول */}
            {streaming && (
              <div className="flex gap-2 items-end">
                <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-black"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_L})`, color: DARK }}>ع</div>
                <div className="max-w-[82%] px-3 py-2 rounded-xl"
                  style={{ background: SURFACE2, border: `1px solid ${GOLD}20`, borderBottomRightRadius: "4px" }}>
                  <MD text={streaming} color={GOLD} />
                  <span className="inline-block w-1 h-3.5 rounded-sm mr-0.5 animate-pulse align-middle"
                    style={{ background: GOLD }} />
                </div>
              </div>
            )}

            {/* typing */}
            {loading && !streaming && (
              <div className="flex gap-2 items-center">
                <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-black"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_L})`, color: DARK }}>ع</div>
                <div className="px-3 py-2 rounded-xl flex gap-1"
                  style={{ background: SURFACE2, border: "1px solid rgba(255,255,255,0.07)" }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full block"
                      style={{ background: GOLD, opacity: 0.7, animation: `aw-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* CTA ثابت */}
          <div className="shrink-0 px-3 pt-2 pb-1"
            style={{ borderTop: `1px solid ${GOLD}15` }}>
            <a href={SIGN_UP_URL}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-black transition-all hover:opacity-90 hover:scale-[1.01]"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_L})`, color: DARK }}>
              <Sparkles className="w-3.5 h-3.5" />
              ابدأ مجاناً — الآن
            </a>
          </div>

          {/* Input */}
          <div className="shrink-0 px-3 pb-3 pt-1.5">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: SURFACE, border: `1px solid ${loading ? GOLD + "40" : "rgba(255,255,255,0.08)"}` }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="اكتب سؤالك هنا…"
                disabled={loading}
                className="flex-1 bg-transparent outline-none text-xs text-white/85 placeholder-white/25"
                style={{ fontFamily: "Cairo, sans-serif" }}
              />
              <button onClick={() => send()} disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
                style={{
                  background: input.trim() && !loading ? `linear-gradient(135deg, ${GOLD}, ${GOLD_L})` : "rgba(255,255,255,0.05)",
                  color: input.trim() && !loading ? DARK : "rgba(255,255,255,0.2)",
                }}>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[9px] text-center mt-1 opacity-20">عدول يمثّل عدالة AI — منصة قانونية ذكية</p>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => open ? setOpen(false) : openChat()}
        className="relative flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_L})`,
          boxShadow: `0 8px 32px rgba(201,168,76,0.45)`,
          color: DARK,
        }}
      >
        {/* pulsing ring */}
        {!open && (
          <span className="absolute inset-0 rounded-2xl animate-ping opacity-30"
            style={{ background: GOLD }} />
        )}
        {open
          ? <ChevronDown className="w-5 h-5" />
          : <MessageCircle className="w-5 h-5" />
        }
        <span className="font-black text-sm">عدول</span>
        {!open && msgCount === 0 && (
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        )}
      </button>

      <style>{`
        @keyframes aw-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes bounce-in { 0%{opacity:0;transform:translateY(8px) scale(.95)} 100%{opacity:1;transform:none} }
        .animate-bounce-in { animation: bounce-in 0.35s ease-out }
      `}</style>
    </div>
  );
}
