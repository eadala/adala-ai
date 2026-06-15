/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  عدول — مساعد قانوني ذكي مبدع (v2)                         ║
 * ║  ملف مستقل قابل للنسخ إلى أي مشروع React                   ║
 * ║  يدعم: Streaming · أوضاع ذكية · Markdown · نسخ             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Scale, Send, RotateCcw, Sparkles, BookOpen, FileText,
  Users, Building2, Shield, Gavel, Copy, Check, ChevronDown,
  MessageSquare, PenLine, Search, BarChart3, X, Mic, MicOff,
} from "lucide-react";

/* ─── إعدادات ────────────────────────────────────────────────── */
const BASE_URL    = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const STREAM_PATH = `${BASE_URL}/api/adoul/stream`;
const CHAT_PATH   = `${BASE_URL}/api/adoul/chat`;
const GOLD        = "#C9A84C";
const GOLD_LIGHT  = "#E0C060";
const DARK        = "#0D1626";
const BG          = "#080F1E";
const SURFACE     = "#0D1626";
const SURFACE2    = "#111827";

/* ─── أوضاع عدول ─────────────────────────────────────────────── */
type Mode = "consultation" | "drafting" | "analysis" | "research";

interface ModeConfig {
  id: Mode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  desc: string;
  placeholder: string;
  suggestions: { icon: React.ComponentType<{ className?: string }>; text: string; cat: string }[];
}

const MODES: ModeConfig[] = [
  {
    id: "consultation",
    label: "استشارة قانونية",
    icon: MessageSquare,
    color: GOLD,
    desc: "أسئلة وإجابات قانونية شاملة",
    placeholder: "اسأل عدول عن أي مسألة قانونية…",
    suggestions: [
      { icon: Users,      text: "ما حقوقي في حال فصلي من العمل تعسفياً؟",                cat: "عمل" },
      { icon: Building2,  text: "ما إجراءات تأسيس شركة ذات مسؤولية محدودة في السعودية؟", cat: "تجارة" },
      { icon: Shield,     text: "كيف أحمي علامتي التجارية من التقليد؟",                  cat: "ملكية فكرية" },
      { icon: BookOpen,   text: "ما حقوق المرأة في عقد الزواج وفق نظام الأحوال الشخصية؟", cat: "أحوال شخصية" },
      { icon: Gavel,      text: "ما الفرق بين الدعوى المدنية والجنائية؟",                cat: "قضاء" },
      { icon: FileText,   text: "ما حقوق المستأجر إذا رفض المالك إعادة مبلغ التأمين؟",  cat: "إيجار" },
    ],
  },
  {
    id: "drafting",
    label: "صياغة وثائق",
    icon: PenLine,
    color: "#818CF8",
    desc: "صياغة عقود ووثائق قانونية جاهزة",
    placeholder: "اطلب صياغة عقد أو وثيقة قانونية…",
    suggestions: [
      { icon: FileText,   text: "صِغ لي عقد إيجار سكني بين مالك ومستأجر",               cat: "إيجار" },
      { icon: Building2,  text: "صِغ عقد شراكة تجارية بين شريكين بالتساوي",             cat: "تجارة" },
      { icon: Users,      text: "صِغ عقد عمل لموظف بدوام كامل مع راتب وعمولة",          cat: "عمل" },
      { icon: Shield,     text: "صِغ اتفاقية سرية وعدم إفصاح (NDA) باللغة العربية",      cat: "حماية" },
      { icon: FileText,   text: "صِغ توكيلاً رسمياً لإدارة أعمال عقارية",               cat: "توكيل" },
      { icon: Gavel,      text: "صِغ إشعار إنهاء عقد مع سرد الأسباب القانونية",         cat: "إنهاء" },
    ],
  },
  {
    id: "analysis",
    label: "تحليل قضية",
    icon: BarChart3,
    color: "#34D399",
    desc: "تحليل قانوني عميق لوقائعك",
    placeholder: "اشرح وقائع قضيتك وسأحللها قانونياً…",
    suggestions: [
      { icon: Users,      text: "صاحب العمل أنهى عقدي دون سابق إنذار ويرفض مكافأة نهاية الخدمة", cat: "عمل" },
      { icon: Building2,  text: "شريكي في الشركة سحب أموالاً دون إذن وأريد حل الشراكة",  cat: "تجارة" },
      { icon: FileText,   text: "اشتريت شقة ووجدت عيوباً خفية بعد التسليم والبائع يرفض التعويض", cat: "عقار" },
      { icon: Shield,     text: "جهة استخدمت شعار شركتي دون إذن وأريد اتخاذ إجراء قانوني", cat: "ملكية فكرية" },
      { icon: Gavel,      text: "حكم ضدي في قضية وأريد معرفة إمكانية الاستئناف",         cat: "قضاء" },
      { icon: Users,      text: "عميل لم يسدّد ما اتفقنا عليه وانقطع التواصل معه",       cat: "مطالبات" },
    ],
  },
  {
    id: "research",
    label: "بحث قانوني",
    icon: Search,
    color: "#F59E0B",
    desc: "بحث في الأنظمة والمواد القانونية",
    placeholder: "ابحث عن نظام أو مادة أو حكم قانوني…",
    suggestions: [
      { icon: BookOpen,   text: "ما نص المادة 77 من نظام العمل السعودي وتفسيرها؟",        cat: "عمل" },
      { icon: Building2,  text: "ما الفرق بين الشركة المساهمة والشركة ذات المسؤولية المحدودة؟", cat: "شركات" },
      { icon: Shield,     text: "ما عقوبة انتهاك الملكية الفكرية في نظام حماية الملكية الفكرية؟", cat: "ملكية" },
      { icon: Gavel,      text: "ما مواعيد الطعن بالاستئناف في المحاكم التجارية السعودية؟", cat: "إجراءات" },
      { icon: FileText,   text: "ما اشتراطات عقد الإيجار الإلكتروني عبر إيجار؟",          cat: "إيجار" },
      { icon: Users,      text: "ما حقوق الزوجة المالية عند الطلاق وفق نظام الأحوال الشخصية الجديد؟", cat: "أحوال شخصية" },
    ],
  },
];

/* ─── أنواع البيانات ─────────────────────────────────────────── */
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  mode?: Mode;
}

/* ─── Markdown renderer كامل ─────────────────────────────────── */
function MarkdownContent({ text, color }: { text: string; color: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;

  const inlineRender = (s: string, key: string | number): React.ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return (
      <span key={key}>
        {parts.map((p, pi) => {
          if (p.startsWith("**") && p.endsWith("**"))
            return <strong key={pi} style={{ color, fontWeight: 700 }}>{p.slice(2, -2)}</strong>;
          if (p.startsWith("`") && p.endsWith("`"))
            return (
              <code key={pi} className="px-1.5 py-0.5 rounded text-[11px] font-mono"
                style={{ background: "rgba(255,255,255,0.08)", color: "#E2E8F0" }}>
                {p.slice(1, -1)}
              </code>
            );
          if (p.startsWith("*") && p.endsWith("*"))
            return <em key={pi} className="italic opacity-80">{p.slice(1, -1)}</em>;
          return <span key={pi}>{p}</span>;
        })}
      </span>
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      out.push(<h4 key={i} className="text-sm font-black mt-4 mb-1.5" style={{ color }}>{line.slice(4)}</h4>);
    } else if (line.startsWith("## ")) {
      out.push(<h3 key={i} className="text-base font-black mt-4 mb-2" style={{ color }}>{line.slice(3)}</h3>);
    } else if (line.startsWith("# ")) {
      out.push(<h2 key={i} className="text-lg font-black mt-3 mb-2" style={{ color }}>{line.slice(2)}</h2>);
    } else if (line.startsWith("---") || line.startsWith("═══")) {
      out.push(<hr key={i} className="my-3 border-0 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />);
    } else if (line.startsWith("> ")) {
      out.push(
        <blockquote key={i} className="border-r-2 pr-3 my-2 text-sm opacity-75 italic"
          style={{ borderColor: color }}>
          {inlineRender(line.slice(2), i)}
        </blockquote>
      );
    } else if (/^[-*•]\s/.test(line)) {
      const bullets: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        bullets.push(lines[i].replace(/^[-*•]\s/, ""));
        i++;
      }
      out.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1 pr-1">
          {bullets.map((b, bi) => (
            <li key={bi} className="flex gap-2 text-sm">
              <span style={{ color }} className="mt-0.5 shrink-0 text-xs">◆</span>
              <span className="opacity-85 leading-relaxed">{inlineRender(b, bi)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      out.push(
        <ol key={`ol-${i}`} className="my-2 space-y-1 pr-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2 text-sm">
              <span className="font-black shrink-0 w-5 text-right" style={{ color }}>{ii + 1}.</span>
              <span className="opacity-85 leading-relaxed">{inlineRender(item, ii)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    } else if (line.trim() === "") {
      out.push(<div key={i} className="h-2" />);
    } else {
      out.push(<p key={i} className="text-sm leading-relaxed opacity-85">{inlineRender(line, i)}</p>);
    }
    i++;
  }

  return <div className="space-y-0.5">{out}</div>;
}

/* ─── زر النسخ ───────────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all opacity-0 group-hover:opacity-100"
      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
      title="نسخ الرد"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "تم النسخ" : "نسخ"}
    </button>
  );
}

/* ─── اقتراحات سياقية بعد كل رد ─────────────────────────────── */
const FOLLOWUPS: Record<Mode, string[]> = {
  consultation: [
    "هل يمكنك توضيح المادة القانونية التي استشهدت بها؟",
    "ما الخطوات العملية التي يجب أن أتخذها الآن؟",
    "هل هناك بدائل أخرى لم تذكرها؟",
    "متى يجب أن أستشير محامياً متخصصاً؟",
  ],
  drafting: [
    "أضف بنداً لحل النزاعات بالتحكيم",
    "كيف أعدّل هذا العقد ليشمل الغرامات التأخيرية؟",
    "ما البنود الأكثر أهمية في هذا العقد؟",
    "أحتاج نسخة إنجليزية من هذه الوثيقة",
  ],
  analysis: [
    "ما احتمالية نجاح القضية بتقديرك؟",
    "ما الأدلة التي تحتاجها لتقوية موقفي؟",
    "هل التسوية الودية أفضل من الدعوى القضائية؟",
    "ما المدة الزمنية المتوقعة لهذه القضية؟",
  ],
  research: [
    "هل هناك أحكام قضائية مرتبطة بهذا النص؟",
    "ما التعديلات الأخيرة على هذا النظام؟",
    "كيف يختلف هذا النظام عن نظيره في دول الخليج؟",
    "هل يمكنك مقارنة هذا النص بالقانون الدولي؟",
  ],
};

/* ─── فقاعة رسالة واحدة ─────────────────────────────────────── */
function MessageBubble({
  msg, modeColor, onFollowUp, isLast,
}: {
  msg: Message;
  modeColor: string;
  onFollowUp: (text: string) => void;
  isLast: boolean;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} items-start mb-5 group`}>
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black mt-0.5"
        style={isUser
          ? { background: "rgba(99,102,241,0.2)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }
          : { background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: DARK }
        }
      >
        {isUser ? "أ" : "ع"}
      </div>

      <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} max-w-[85%]`}>
        <div
          className="px-4 py-3 rounded-2xl"
          style={isUser
            ? {
                background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.25)",
                color: "rgba(255,255,255,0.9)",
                borderBottomLeftRadius: "4px",
              }
            : {
                background: SURFACE2,
                border: `1px solid rgba(255,255,255,0.07)`,
                color: "rgba(255,255,255,0.88)",
                borderBottomRightRadius: "4px",
                width: "100%",
              }
          }
        >
          {isUser
            ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            : <MarkdownContent text={msg.content} color={modeColor} />
          }
        </div>

        <div className={`flex items-center gap-2 mt-1.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
          <span className="text-[10px] opacity-25">
            {new Date(msg.ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && <CopyButton text={msg.content} />}
        </div>

        {/* اقتراحات سياقية بعد آخر رد من عدول */}
        {!isUser && isLast && (
          <div className="flex flex-wrap gap-2 mt-3">
            {FOLLOWUPS[msg.mode ?? "consultation"].map((f, fi) => (
              <button
                key={fi}
                onClick={() => onFollowUp(f)}
                className="text-xs px-3 py-1.5 rounded-full transition-all duration-150 hover:scale-[1.02]"
                style={{
                  background: `${modeColor}10`,
                  border: `1px solid ${modeColor}25`,
                  color: modeColor,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── مؤشر الكتابة المتحرك ──────────────────────────────────── */
function TypingIndicator({ color }: { color: string }) {
  return (
    <div className="flex gap-3 items-center mb-4">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
        style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: DARK }}
      >ع</div>
      <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5"
        style={{ background: SURFACE2, border: "1px solid rgba(255,255,255,0.07)", borderBottomRightRadius: "4px" }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full block"
            style={{ background: color, animation: `adoulBounce 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.8 }} />
        ))}
      </div>
    </div>
  );
}

/* ─── شاشة الترحيب ──────────────────────────────────────────── */
function WelcomeScreen({
  mode, onSuggest,
}: {
  mode: ModeConfig;
  onSuggest: (text: string) => void;
}) {
  const ModeIcon = mode.icon;
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 pb-6 text-center">
      <div className="relative mb-6">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl"
          style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}
        >
          <Scale className="w-10 h-10" style={{ color: DARK }} />
        </div>
        <div
          className="absolute -bottom-1 -left-1 w-7 h-7 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: mode.color }}
        >
          <ModeIcon className="w-3.5 h-3.5 text-white" />
        </div>
      </div>

      <h1 className="text-3xl font-black text-white mb-1">
        أنا <span style={{ color: GOLD }}>عدول</span>
      </h1>
      <p className="text-white/40 text-sm mb-2">{mode.desc}</p>

      <div className="flex flex-wrap justify-center gap-2 mb-8 mt-3">
        {["عقود", "عمل", "تجارة", "أحوال شخصية", "قضاء", "ملكية فكرية", "عقار", "جرائم معلوماتية"].map(tag => (
          <span key={tag} className="text-xs px-3 py-1 rounded-full font-medium"
            style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}28` }}>
            {tag}
          </span>
        ))}
      </div>

      <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {mode.suggestions.map((s, i) => {
          const Icon = s.icon;
          return (
            <button key={i} onClick={() => onSuggest(s.text)}
              className="text-right p-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-100"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${mode.color}45`;
                e.currentTarget.style.background = `${mode.color}08`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                e.currentTarget.style.background = "rgba(255,255,255,0.025)";
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${mode.color}15`, border: `1px solid ${mode.color}25` }}>
                  <Icon className="w-4 h-4" style={{ color: mode.color }} />
                </div>
                <div>
                  <div className="text-[10px] mb-1 font-bold" style={{ color: mode.color }}>{s.cat}</div>
                  <p className="text-white/70 text-xs leading-relaxed">{s.text}</p>
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
  const [messages, setMessages]     = useState<Message[]>([]);
  const [input, setInput]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [streaming, setStreaming]   = useState("");
  const [error, setError]           = useState<string | null>(null);
  const [modeId, setModeId]         = useState<Mode>("consultation");
  const [listening, setListening]   = useState(false);
  const bottomRef                   = useRef<HTMLDivElement>(null);
  const inputRef                    = useRef<HTMLTextAreaElement>(null);
  const abortRef                    = useRef<AbortController | null>(null);

  const mode = MODES.find(m => m.id === modeId) ?? MODES[0];

  /* تحميل من localStorage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("adoul_v2_messages");
      if (saved) setMessages(JSON.parse(saved));
      const savedMode = localStorage.getItem("adoul_v2_mode") as Mode | null;
      if (savedMode) setModeId(savedMode);
    } catch {}
  }, []);

  /* حفظ */
  useEffect(() => {
    if (messages.length > 0)
      localStorage.setItem("adoul_v2_messages", JSON.stringify(messages.slice(-60)));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("adoul_v2_mode", modeId);
  }, [modeId]);

  /* تمرير للأسفل */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, loading]);

  /* ارتفاع textarea */
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  /* إرسال مع streaming */
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
        body: JSON.stringify({
          messages: nextMsgs.map(m => ({ role: m.role, content: m.content })),
          mode: modeId,
        }),
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
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.error) { setError(parsed.error); break; }
            if (parsed.done) break;
            if (parsed.chunk) {
              fullText += parsed.chunk;
              setStreaming(fullText);
            }
          } catch {}
        }
      }

      if (fullText) {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: fullText,
          ts: Date.now(),
          mode: modeId,
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;

      /* fallback → JSON */
      try {
        const fb = await fetch(CHAT_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMsgs.map(m => ({ role: m.role, content: m.content })),
            mode: modeId,
          }),
        });
        const data = await fb.json();
        if (data.reply) {
          const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.reply,
            ts: Date.now(),
            mode: modeId,
          };
          setMessages(prev => [...prev, aiMsg]);
        } else {
          setError(data.error || "فشل الاتصال");
        }
      } catch {
        setError("فشل الاتصال. تأكد من اتصالك بالإنترنت.");
      }
    } finally {
      setLoading(false);
      setStreaming("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [input, messages, loading, modeId]);

  /* مسح المحادثة */
  const clear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setStreaming("");
    setError(null);
    setLoading(false);
    localStorage.removeItem("adoul_v2_messages");
  };

  /* Ctrl/Cmd+Enter */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); }
  };

  /* تسجيل صوتي (Web Speech API) */
  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (listening) { setListening(false); return; }
    const rec = new SpeechRecognition();
    rec.lang = "ar-SA";
    rec.interimResults = false;
    rec.onresult = (e: any) => setInput(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  };

  const lastAssistantIndex = messages.map((m, i) => ({ m, i }))
    .filter(x => x.m.role === "assistant")
    .at(-1)?.i ?? -1;

  return (
    <div className="flex flex-col h-full" style={{ background: BG, fontFamily: "Cairo, sans-serif" }} dir="rtl">
      <style>{`
        @keyframes adoulBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        .adoul-scroll::-webkit-scrollbar { width: 4px }
        .adoul-scroll::-webkit-scrollbar-track { background: transparent }
        .adoul-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px }
      `}</style>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: SURFACE }}>

        {/* شعار */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}>
            <Scale className="w-5 h-5" style={{ color: DARK }} />
          </div>
          <div>
            <h2 className="font-black text-white text-base leading-none">عدول</h2>
            <p className="text-[10px] mt-0.5" style={{ color: GOLD }}>مساعد قانوني ذكي</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold mr-1"
            style={{ background: "rgba(16,185,129,0.1)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            متاح
          </div>
        </div>

        {/* إجراءات */}
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <span className="text-[10px] text-white/20 ml-1">{messages.length} رسالة</span>
          )}
          {messages.length > 0 && (
            <button onClick={clear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
              style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* ── أشرطة الأوضاع ──────────────────────────────────────── */}
      <div className="flex gap-1.5 px-4 py-2 shrink-0 overflow-x-auto"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: `${SURFACE}99` }}>
        {MODES.map(m => {
          const Icon = m.icon;
          const active = m.id === modeId;
          return (
            <button key={m.id} onClick={() => setModeId(m.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all duration-200"
              style={active
                ? { background: `${m.color}20`, color: m.color, border: `1px solid ${m.color}40` }
                : { background: "transparent", color: "rgba(255,255,255,0.35)", border: "1px solid transparent" }
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ── منطقة الرسائل ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 adoul-scroll">
        {messages.length === 0 && !streaming ? (
          <WelcomeScreen mode={mode} onSuggest={text => send(text)} />
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                modeColor={MODES.find(m => m.id === (msg.mode ?? modeId))?.color ?? GOLD}
                onFollowUp={f => send(f)}
                isLast={idx === lastAssistantIndex}
              />
            ))}

            {/* رد streaming مباشر */}
            {streaming && (
              <div className="flex gap-3 items-start mb-5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black mt-0.5"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`, color: DARK }}>ع</div>
                <div className="px-4 py-3 rounded-2xl max-w-[85%]"
                  style={{ background: SURFACE2, border: `1px solid ${mode.color}25`, borderBottomRightRadius: "4px" }}>
                  <MarkdownContent text={streaming} color={mode.color} />
                  <span className="inline-block w-1.5 h-4 rounded-sm ml-0.5 animate-pulse align-middle"
                    style={{ background: mode.color, opacity: 0.8 }} />
                </div>
              </div>
            )}

            {/* typing indicator قبل بدء streaming */}
            {loading && !streaming && <TypingIndicator color={mode.color} />}

            {/* خطأ */}
            {error && (
              <div className="flex items-center justify-between p-4 rounded-2xl mb-4 text-sm"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5" }}>
                <span>{error}</span>
                <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── شريط الإدخال ──────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: SURFACE }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl px-3 py-2.5 transition-all"
            style={{ background: BG, border: `1px solid ${loading ? mode.color + "40" : "rgba(255,255,255,0.08)"}` }}>

            {/* زر صوت */}
            <button onClick={toggleVoice}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mb-0.5 transition-all"
              style={listening
                ? { background: `${mode.color}25`, color: mode.color }
                : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)" }
              }
              title="إدخال صوتي"
            >
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
              className="flex-1 bg-transparent outline-none resize-none text-sm text-white/90 placeholder-white/20 leading-relaxed"
              style={{ minHeight: "24px", maxHeight: "140px", fontFamily: "Cairo, sans-serif" }}
            />

            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 mb-0.5"
              style={{
                background: input.trim() && !loading ? `linear-gradient(135deg, ${mode.color}, ${GOLD_LIGHT})` : "rgba(255,255,255,0.05)",
                color: input.trim() && !loading ? DARK : "rgba(255,255,255,0.2)",
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px] text-white/15">
              عدول يقدم معلومات إرشادية لا استشارة رسمية
            </span>
            <span className="text-[10px] text-white/15">Ctrl+Enter للإرسال</span>
          </div>
        </div>
      </div>

      {/* scroll to bottom */}
      {messages.length > 4 && (
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-xl z-20 transition-all hover:scale-105"
          style={{ background: mode.color, color: DARK }}
        >
          <ChevronDown className="w-3.5 h-3.5" />
          الأحدث
        </button>
      )}
    </div>
  );
}

/* ─── للنسخ إلى مشروع آخر ─────────────────────────────────────
 * 1. انسخ هذا الملف كاملاً
 * 2. أنشئ في backend:
 *    POST /api/adoul/stream → SSE streaming (Gemini)
 *    POST /api/adoul/chat   → JSON fallback
 *    Body: { messages: [{role, content}], mode: string }
 * 3. غيّر BASE_URL في أعلى الملف
 * ─────────────────────────────────────────────────────────── */
