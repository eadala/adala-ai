/**
 * عدول — مساعد قانوني ذكي (v3 · Light Professional)
 * خلفية بيضاء · أزرق احترافي · تصميم هادئ ونظيف
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Scale, Send, RotateCcw, BookOpen, FileText, Users,
  Building2, Shield, Gavel, Copy, Check, ChevronDown,
  MessageSquare, PenLine, Search, BarChart3, X, Mic, MicOff,
} from "lucide-react";

/* ─── لوحة الألوان ───────────────────────────────────────────── */
const BLUE      = "#1A56DB";
const BLUE_D    = "#1344B5";
const BLUE_L    = "#EFF6FF";
const BLUE_M    = "#DBEAFE";
const BLUE_T    = "#93C5FD";
const WHITE     = "#FFFFFF";
const BG        = "#F1F5F9";      /* خلفية الصفحة — رمادي فاتح جداً */
const SURFACE   = "#FFFFFF";     /* الكروت والـ header */
const DARK      = "#0F172A";     /* النص الرئيسي */
const MUTED     = "#64748B";     /* نصوص ثانوية */
const BORDER    = "#E2E8F0";     /* الحدود */

/* ─── ألوان الأوضاع ──────────────────────────────────────────── */
const MODE_COLORS = {
  consultation: { main: BLUE,      light: BLUE_L, mid: BLUE_M },
  drafting:     { main: "#7C3AED", light: "#F5F3FF", mid: "#EDE9FE" },
  analysis:     { main: "#059669", light: "#ECFDF5", mid: "#D1FAE5" },
  research:     { main: "#B45309", light: "#FFFBEB", mid: "#FEF3C7" },
};

const BASE_URL    = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const STREAM_PATH = `${BASE_URL}/api/adoul/stream`;
const CHAT_PATH   = `${BASE_URL}/api/adoul/chat`;

/* ─── أوضاع عدول ─────────────────────────────────────────────── */
type Mode = "consultation" | "drafting" | "analysis" | "research";

interface ModeConfig {
  id: Mode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  placeholder: string;
  suggestions: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; text: string; cat: string }[];
}

const MODES: ModeConfig[] = [
  {
    id: "consultation",
    label: "استشارة قانونية",
    icon: MessageSquare,
    desc: "أسئلة وإجابات قانونية شاملة",
    placeholder: "اسأل عدول عن أي مسألة قانونية…",
    suggestions: [
      { icon: Users,     text: "ما حقوقي في حال فصلي من العمل تعسفياً؟",                 cat: "عمل" },
      { icon: Building2, text: "ما إجراءات تأسيس شركة ذات مسؤولية محدودة في السعودية؟",  cat: "تجارة" },
      { icon: Shield,    text: "كيف أحمي علامتي التجارية من التقليد؟",                   cat: "ملكية فكرية" },
      { icon: BookOpen,  text: "ما حقوق المرأة في عقد الزواج وفق نظام الأحوال الشخصية؟", cat: "أحوال شخصية" },
      { icon: Gavel,     text: "ما الفرق بين الدعوى المدنية والجنائية؟",                 cat: "قضاء" },
      { icon: FileText,  text: "ما حقوق المستأجر إذا رفض المالك إعادة مبلغ التأمين؟",   cat: "إيجار" },
    ],
  },
  {
    id: "drafting",
    label: "صياغة وثائق",
    icon: PenLine,
    desc: "صياغة عقود ووثائق قانونية جاهزة",
    placeholder: "اطلب صياغة عقد أو وثيقة قانونية…",
    suggestions: [
      { icon: FileText,  text: "صِغ لي عقد إيجار سكني بين مالك ومستأجر",               cat: "إيجار" },
      { icon: Building2, text: "صِغ عقد شراكة تجارية بين شريكين بالتساوي",             cat: "تجارة" },
      { icon: Users,     text: "صِغ عقد عمل لموظف بدوام كامل مع راتب وعمولة",          cat: "عمل" },
      { icon: Shield,    text: "صِغ اتفاقية سرية وعدم إفصاح (NDA) باللغة العربية",      cat: "حماية" },
      { icon: FileText,  text: "صِغ توكيلاً رسمياً لإدارة أعمال عقارية",               cat: "توكيل" },
      { icon: Gavel,     text: "صِغ إشعار إنهاء عقد مع سرد الأسباب القانونية",         cat: "إنهاء" },
    ],
  },
  {
    id: "analysis",
    label: "تحليل قضية",
    icon: BarChart3,
    desc: "تحليل قانوني عميق لوقائعك",
    placeholder: "اشرح وقائع قضيتك وسأحللها قانونياً…",
    suggestions: [
      { icon: Users,     text: "صاحب العمل أنهى عقدي دون إنذار ويرفض مكافأة نهاية الخدمة", cat: "عمل" },
      { icon: Building2, text: "شريكي سحب أموالاً دون إذن وأريد حل الشراكة",              cat: "تجارة" },
      { icon: FileText,  text: "اشتريت شقة ووجدت عيوباً خفية بعد التسليم",               cat: "عقار" },
      { icon: Shield,    text: "جهة استخدمت شعار شركتي دون إذن",                          cat: "ملكية فكرية" },
      { icon: Gavel,     text: "حكم ضدي في قضية وأريد معرفة إمكانية الاستئناف",           cat: "قضاء" },
      { icon: Users,     text: "عميل لم يسدّد ما اتفقنا عليه وانقطع التواصل معه",         cat: "مطالبات" },
    ],
  },
  {
    id: "research",
    label: "بحث قانوني",
    icon: Search,
    desc: "بحث في الأنظمة والمواد القانونية",
    placeholder: "ابحث عن نظام أو مادة أو حكم قانوني…",
    suggestions: [
      { icon: BookOpen,  text: "ما نص المادة 77 من نظام العمل السعودي وتفسيرها؟",          cat: "عمل" },
      { icon: Building2, text: "ما الفرق بين الشركة المساهمة والمسؤولية المحدودة؟",        cat: "شركات" },
      { icon: Shield,    text: "ما عقوبة انتهاك الملكية الفكرية في نظام حمايتها؟",         cat: "ملكية" },
      { icon: Gavel,     text: "ما مواعيد الطعن بالاستئناف في المحاكم التجارية؟",          cat: "إجراءات" },
      { icon: FileText,  text: "ما اشتراطات عقد الإيجار الإلكتروني عبر إيجار؟",            cat: "إيجار" },
      { icon: Users,     text: "ما حقوق الزوجة المالية عند الطلاق في نظام الأحوال الجديد؟", cat: "أحوال شخصية" },
    ],
  },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  mode?: Mode;
}

const FOLLOWUPS: Record<Mode, string[]> = {
  consultation: ["وضّح المادة القانونية التي استشهدت بها", "ما الخطوات العملية الآن؟", "هل هناك بدائل أخرى؟", "متى أحتاج محامياً متخصصاً؟"],
  drafting:     ["أضف بنداً لحل النزاعات بالتحكيم", "أضف غرامات تأخيرية", "ما البنود الأهم في هذا العقد؟", "أحتاج نسخة إنجليزية"],
  analysis:     ["ما احتمالية نجاح القضية؟", "ما الأدلة التي تقوي موقفي؟", "هل التسوية أفضل من الدعوى؟", "ما المدة الزمنية المتوقعة؟"],
  research:     ["هل هناك أحكام قضائية مرتبطة؟", "ما التعديلات الأخيرة على هذا النظام؟", "كيف يختلف عن نظيره الخليجي؟", "قارنه بالقانون الدولي"],
};

/* ─── Markdown renderer (light theme) ───────────────────────── */
function MarkdownContent({ text, color }: { text: string; color: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;

  const inline = (s: string, k: string | number): React.ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return (
      <span key={k}>
        {parts.map((p, pi) => {
          if (p.startsWith("**") && p.endsWith("**"))
            return <strong key={pi} style={{ color, fontWeight: 700 }}>{p.slice(2, -2)}</strong>;
          if (p.startsWith("`") && p.endsWith("`"))
            return (
              <code key={pi} className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-muted/40 text-foreground border border-border">
                {p.slice(1, -1)}
              </code>
            );
          if (p.startsWith("*") && p.endsWith("*"))
            return <em key={pi} className="italic" style={{ color: MUTED }}>{p.slice(1, -1)}</em>;
          return <span key={pi}>{p}</span>;
        })}
      </span>
    );
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### "))
      out.push(<h4 key={i} className="text-sm font-bold mt-4 mb-1.5" style={{ color }}>{line.slice(4)}</h4>);
    else if (line.startsWith("## "))
      out.push(<h3 key={i} className="text-base font-bold mt-4 mb-2" style={{ color }}>{line.slice(3)}</h3>);
    else if (line.startsWith("# "))
      out.push(<h2 key={i} className="text-lg font-bold mt-3 mb-2" style={{ color }}>{line.slice(2)}</h2>);
    else if (line.startsWith("---"))
      out.push(<hr key={i} className="my-3" style={{ borderColor: BORDER }} />);
    else if (line.startsWith("> "))
      out.push(
        <blockquote key={i} className="border-r-4 pr-3 my-2 text-sm italic rounded-r"
          style={{ borderColor: color, background: MODE_COLORS[("consultation" as Mode)].light, color: MUTED, padding: "6px 12px" }}>
          {inline(line.slice(2), i)}
        </blockquote>
      );
    else if (/^[-*•]\s/.test(line)) {
      const bullets: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) { bullets.push(lines[i].replace(/^[-*•]\s/, "")); i++; }
      out.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5">
          {bullets.map((b, bi) => (
            <li key={bi} className="flex gap-2.5 text-sm" style={{ color: DARK }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ background: color }} />
              <span style={{ lineHeight: "1.78" }}>{inline(b, bi)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, "")); i++; }
      out.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1.5">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2.5 text-sm" style={{ color: DARK }}>
              <span className="font-bold shrink-0 w-5 text-right" style={{ color }}>{ii + 1}.</span>
              <span style={{ lineHeight: "1.78" }}>{inline(item, ii)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    } else if (line.trim() === "") {
      out.push(<div key={i} className="h-2" />);
    } else {
      out.push(<p key={i} className="text-sm" style={{ color: DARK, lineHeight: "1.78" }}>{inline(line, i)}</p>);
    }
    i++;
  }
  return <div className="space-y-0.5">{out}</div>;
}

/* ─── زر النسخ ───────────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all opacity-0 group-hover:opacity-100 hover:scale-105"
      style={{ background: BLUE_L, color: BLUE, border: `1px solid ${BLUE_M}` }}
    >
      {copied ? <Check className="w-3 h-3" style={{ color: "hsl(var(--chart-2))" }} /> : <Copy className="w-3 h-3" />}
      {copied ? "تم النسخ" : "نسخ"}
    </button>
  );
}

/* ─── فقاعة رسالة ────────────────────────────────────────────── */
function MessageBubble({ msg, modeColor, modeLight, onFollowUp, isLast }: {
  msg: Message; modeColor: string; modeLight: string;
  onFollowUp: (t: string) => void; isLast: boolean;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} items-start mb-5 group`}>

      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold mt-0.5"
        style={isUser
          ? { background: BLUE_M, color: BLUE, border: `1px solid ${BLUE_T}` }
          : { background: modeColor, color: WHITE }
        }>
        {isUser ? "أ" : "ع"}
      </div>

      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%]`}>

        {/* Bubble */}
        <div className="px-4 py-3 rounded-2xl"
          style={isUser
            ? {
                background: BLUE,
                color: WHITE,
                borderBottomLeftRadius: "4px",
                boxShadow: `0 2px 12px rgba(26,86,219,0.2)`,
              }
            : {
                background: WHITE,
                border: `1px solid ${BORDER}`,
                color: DARK,
                borderBottomRightRadius: "4px",
                boxShadow: "0 1px 6px rgba(15,23,42,0.06)",
                width: "100%",
              }
          }>
          {isUser
            ? <p className="text-sm leading-relaxed whitespace-pre-wrap text-white">{msg.content}</p>
            : <MarkdownContent text={msg.content} color={modeColor} />
          }
        </div>

        {/* Timestamp + copy */}
        <div className={`flex items-center gap-2 mt-1.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          <span className="text-[10px]" style={{ color: MUTED }}>
            {new Date(msg.ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && <CopyButton text={msg.content} />}
        </div>

        {/* Follow-up chips */}
        {!isUser && isLast && (
          <div className="flex flex-wrap gap-2 mt-3">
            {FOLLOWUPS[msg.mode ?? "consultation"].map((f, fi) => (
              <button key={fi} onClick={() => onFollowUp(f)}
                className="text-xs px-3 py-1.5 rounded-full transition-all hover:scale-[1.02] font-medium"
                style={{ background: modeLight, color: modeColor, border: `1px solid ${modeColor}30` }}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Typing Indicator ───────────────────────────────────────── */
function TypingIndicator({ color }: { color: string }) {
  return (
    <div className="flex gap-3 items-center mb-4">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
        style={{ background: color, color: WHITE }}>ع</div>
      <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
        style={{ background: WHITE, border: `1px solid ${BORDER}`, borderBottomRightRadius: "4px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full block"
            style={{ background: BLUE_T, animation: `adb 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

/* ─── شاشة الترحيب ───────────────────────────────────────────── */
function WelcomeScreen({ mode, colors, onSuggest }: {
  mode: ModeConfig;
  colors: { main: string; light: string; mid: string };
  onSuggest: (t: string) => void;
}) {
  const Icon = mode.icon;
  const TAGS = ["عقود", "عمل", "تجارة", "أحوال شخصية", "قضاء", "ملكية فكرية", "عقار", "جرائم معلوماتية"];
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 pb-6 text-center">

      {/* Logo */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: BLUE, boxShadow: `0 12px 36px rgba(26,86,219,0.25)` }}>
          <Scale className="w-10 h-10 text-white" />
        </div>
        <div className="absolute -bottom-1.5 -left-1.5 w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
          style={{ background: colors.main, border: `3px solid ${WHITE}` }}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-1" style={{ color: DARK }}>
        أنا <span style={{ color: BLUE }}>عدول</span>
      </h1>
      <p className="text-sm mb-2" style={{ color: MUTED }}>{mode.desc}</p>

      {/* Tags */}
      <div className="flex flex-wrap justify-center gap-2 mb-8 mt-3">
        {TAGS.map(tag => (
          <span key={tag} className="text-xs px-3 py-1 rounded-full font-medium"
            style={{ background: BLUE_M, color: BLUE, border: `1px solid ${BLUE_T}` }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Suggestion cards */}
      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {mode.suggestions.map((s, i) => {
          const SIcon = s.icon;
          return (
            <button key={i} onClick={() => onSuggest(s.text)}
              className="text-right p-4 rounded-2xl transition-all duration-200 hover:scale-[1.01] hover:shadow-md group"
              style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${colors.main}50`; e.currentTarget.style.background = colors.light; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.background = WHITE; }}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: colors.mid, border: `1px solid ${colors.main}30` }}>
                  <SIcon className="w-4 h-4" style={{ color: colors.main }} />
                </div>
                <div>
                  <div className="text-[10px] mb-1 font-bold uppercase tracking-wide" style={{ color: colors.main }}>{s.cat}</div>
                  <p className="text-xs leading-relaxed text-right" >{s.text}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── الصفحة الرئيسية ────────────────────────────────────────── */
export default function AdoulPage() {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [streaming, setStreaming] = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [modeId, setModeId]       = useState<Mode>("consultation");
  const [listening, setListening] = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLTextAreaElement>(null);
  const abortRef                  = useRef<AbortController | null>(null);

  const mode   = MODES.find(m => m.id === modeId) ?? MODES[0];
  const colors = MODE_COLORS[modeId];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("adoul_v3_messages");
      if (saved) setMessages(JSON.parse(saved));
      const savedMode = localStorage.getItem("adoul_v3_mode") as Mode | null;
      if (savedMode) setModeId(savedMode);
    } catch {}
  }, []);

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem("adoul_v3_messages", JSON.stringify(messages.slice(-60)));
  }, [messages]);

  useEffect(() => { localStorage.setItem("adoul_v3_mode", modeId); }, [modeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, loading]);

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setError(null);
    const userMsg: Message = { id: Date.now().toString(), role: "user", content, ts: Date.now(), mode: modeId };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setLoading(true);
    setStreaming("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    let fullText = "";

    try {
      const res = await fetch(STREAM_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMsgs.map(m => ({ role: m.role, content: m.content })), mode: modeId }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("stream_failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6).trim());
            if (parsed.error) { setError(parsed.error); break; }
            if (parsed.chunk) { fullText += parsed.chunk; setStreaming(fullText); }
          } catch {}
        }
      }

      if (fullText) setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: fullText, ts: Date.now(), mode: modeId }]);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      try {
        const fb = await fetch(CHAT_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMsgs.map(m => ({ role: m.role, content: m.content })), mode: modeId }),
        });
        const data = await fb.json();
        if (data.reply) setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: data.reply, ts: Date.now(), mode: modeId }]);
        else setError(data.error || "فشل الاتصال");
      } catch { setError("فشل الاتصال. تأكد من اتصالك بالإنترنت."); }
    } finally {
      setLoading(false);
      setStreaming("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, messages, loading, modeId]);

  const clear = () => { abortRef.current?.abort(); setMessages([]); setStreaming(""); setError(null); setLoading(false); localStorage.removeItem("adoul_v3_messages"); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); }
  };

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { setListening(false); return; }
    const rec = new SR();
    rec.lang = "ar-SA";
    rec.interimResults = false;
    rec.onresult = (e: any) => setInput(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  };

  const lastAIIndex = messages.map((m, i) => ({ m, i })).filter(x => x.m.role === "assistant").at(-1)?.i ?? -1;

  return (
    <div className="flex flex-col h-full" style={{ background: BG, fontFamily: "Cairo, sans-serif" }} dir="rtl">
      <style>{`
        @keyframes adb { 0%,80%,100%{transform:translateY(0);opacity:.45} 40%{transform:translateY(-5px);opacity:1} }
        .adl-scroll::-webkit-scrollbar { width:5px }
        .adl-scroll::-webkit-scrollbar-track { background:transparent }
        .adl-scroll::-webkit-scrollbar-thumb { background:${BORDER}; border-radius:4px }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: BLUE, boxShadow: `0 4px 12px rgba(26,86,219,0.25)` }}>
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-base leading-none" style={{ color: DARK }}>عدول</h2>
            <p className="text-[11px] mt-0.5" style={{ color: BLUE }}>مساعد قانوني ذكي</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold mr-1 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            متاح الآن
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-[11px]" style={{ color: MUTED }}>{messages.length} رسالة</span>
          )}
          {messages.length > 0 && (
            <button onClick={clear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105"
              style={{ background: BLUE_L, color: BLUE, border: `1px solid ${BLUE_M}` }}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Mode tabs ───────────────────────────────────────────── */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto shrink-0"
        style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}` }}>
        {MODES.map(m => {
          const active = m.id === modeId;
          const mc = MODE_COLORS[m.id];
          const MIcon = m.icon;
          return (
            <button key={m.id} onClick={() => setModeId(m.id)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all duration-150"
              style={active
                ? { background: mc.light, color: mc.main, border: `1.5px solid ${mc.main}30`, boxShadow: `0 2px 8px ${mc.main}15` }
                : { background: "transparent", color: MUTED, border: "1.5px solid transparent" }
              }>
              <MIcon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ── Messages ────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 adl-scroll">
        {messages.length === 0 && !streaming
          ? <WelcomeScreen mode={mode} colors={colors} onSuggest={t => send(t)} />
          : (
            <div className="max-w-3xl mx-auto">
              {messages.map((msg, idx) => (
                <MessageBubble key={msg.id} msg={msg}
                  modeColor={MODE_COLORS[msg.mode ?? modeId].main}
                  modeLight={MODE_COLORS[msg.mode ?? modeId].light}
                  onFollowUp={f => send(f)}
                  isLast={idx === lastAIIndex}
                />
              ))}

              {/* Streaming رد مباشر */}
              {streaming && (
                <div className="flex gap-3 items-start mb-5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold mt-0.5"
                    style={{ background: colors.main, color: WHITE }}>ع</div>
                  <div className="px-4 py-3 rounded-2xl max-w-[85%]"
                    style={{ background: WHITE, border: `1.5px solid ${colors.main}40`, borderBottomRightRadius: "4px", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                    <MarkdownContent text={streaming} color={colors.main} />
                    <span className="inline-block w-0.5 h-4 rounded-full mr-0.5 animate-pulse align-middle"
                      style={{ background: colors.main }} />
                  </div>
                </div>
              )}

              {loading && !streaming && <TypingIndicator color={colors.main} />}

              {error && (
                <div className="flex items-center justify-between p-4 rounded-2xl mb-4 text-sm bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30">
                  <span>{error}</span>
                  <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )
        }
      </div>

      {/* ── Input bar ───────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3"
        style={{ background: SURFACE, borderTop: `1px solid ${BORDER}`, boxShadow: "0 -1px 6px rgba(15,23,42,0.04)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl px-3.5 py-2.5 transition-all"
            style={{
              background: BG,
              border: `1.5px solid ${loading ? colors.main + "60" : BORDER}`,
              boxShadow: loading ? `0 0 0 3px ${colors.main}10` : "none",
            }}>

            {/* Voice */}
            <button onClick={toggleVoice}
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mb-0.5 transition-all hover:scale-105"
              style={listening
                ? { background: colors.light, color: colors.main, border: `1px solid ${colors.main}40` }
                : { background: BORDER, color: MUTED }
              }>
              {listening ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={mode.placeholder}
              disabled={loading}
              className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed"
              style={{ minHeight: "24px", maxHeight: "140px", fontFamily: "Cairo, sans-serif", color: DARK }}
            />

            <button onClick={() => send()} disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 mb-0.5 hover:scale-105"
              style={{
                background: input.trim() && !loading ? BLUE : BORDER,
                color: input.trim() && !loading ? WHITE : MUTED,
                boxShadow: input.trim() && !loading ? `0 4px 12px rgba(26,86,219,0.35)` : "none",
              }}>
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px]" style={{ color: MUTED, opacity: 0.7 }}>
              عدول يقدم معلومات إرشادية لا استشارة رسمية
            </span>
            <span className="text-[10px]" style={{ color: MUTED, opacity: 0.5 }}>Ctrl+Enter</span>
          </div>
        </div>
      </div>

      {/* Scroll to bottom */}
      {messages.length > 4 && (
        <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shadow-lg z-20 transition-all hover:scale-105"
          style={{ background: BLUE, color: WHITE, boxShadow: `0 4px 16px rgba(26,86,219,0.35)` }}>
          <ChevronDown className="w-3.5 h-3.5" />
          الأحدث
        </button>
      )}
    </div>
  );
}
