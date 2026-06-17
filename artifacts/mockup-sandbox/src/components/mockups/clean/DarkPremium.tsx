import { useState, useEffect } from "react";

const ACCENT  = "#3B82F6";
const ACCENT2 = "#60A5FA";
const DARK    = "#0B1F3B";
const GREEN   = "#34D399";
const WARN    = "#FBBF24";
const PURPLE  = "#A78BFA";
const WHITE   = "#FFFFFF";

function AiChatLive() {
  const [phase, setPhase] = useState(0);
  const DELAYS = [800, 900, 1700, 1100, 900, 1700, 1000, 3500];
  useEffect(() => {
    const d = DELAYS[Math.min(phase, DELAYS.length - 1)];
    const t = setTimeout(() => setPhase(p => (p >= 8 ? 0 : p + 1)), d);
    return () => clearTimeout(t);
  }, [phase]);

  const Bubble = ({ fromUser, children }: { fromUser?: boolean; children: React.ReactNode }) => (
    <div className={`flex ${fromUser ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed text-right"
        style={fromUser
          ? { background: "rgba(255,255,255,0.09)", color: "rgba(255,255,255,0.80)", borderRadius: "16px 16px 16px 4px" }
          : { background: ACCENT, color: WHITE, borderRadius: "16px 16px 4px 16px" }}>
        {children}
      </div>
    </div>
  );
  const Typing = () => (
    <div className="flex justify-end">
      <div className="px-4 py-3 rounded-2xl flex gap-1.5"
        style={{ background: ACCENT, borderRadius: "16px 16px 4px 16px" }}>
        {[0,1,2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full bg-white animate-bounce"
            style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col h-full"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-white">المساعد القانوني</p>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Gemini + Claude</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[11px]" style={{ color: GREEN }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
          متصل
        </span>
      </div>
      {/* Messages */}
      <div className="flex-1 px-4 py-3 space-y-2.5 overflow-hidden" style={{ minHeight: 160 }}>
        {phase >= 1 && <Bubble fromUser>اكتب عقد إيجار تجاري لمحل في الرياض لمدة سنتين</Bubble>}
        {phase === 2 && <Typing />}
        {phase >= 3 && <Bubble><span className="font-medium">تم إنشاء العقد ✅</span><span className="block text-[11px] opacity-75 mt-0.5">١٤ بنداً • متوافق مع نظام الإيجار السعودي</span></Bubble>}
        {phase >= 4 && <Bubble fromUser>أضف شرط غرامة تأخير 5% شهرياً</Bubble>}
        {phase === 5 && <Typing />}
        {phase >= 6 && <Bubble>تم إضافة البند ١٥ ✓ — العقد جاهز للتوقيع</Bubble>}
        {phase >= 7 && (
          <div className="flex justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold"
              style={{ background: "rgba(52,211,153,0.12)", color: GREEN, border: "1px solid rgba(52,211,153,0.2)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              جاهز للتوقيع الإلكتروني
            </div>
          </div>
        )}
      </div>
      {/* Input */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="flex-1 text-xs text-right" style={{ color: "rgba(255,255,255,0.25)" }}>اسأل المساعد القانوني...</span>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: ACCENT }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniDashboard() {
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
      {/* chrome */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "rgba(0,0,0,0.20)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex gap-1">
          {["#FC8181", WARN, GREEN].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.7 }} />)}
        </div>
        <div className="flex-1 mx-3 text-[10px] text-center" style={{ color: "rgba(255,255,255,0.3)" }}>app.adalah-ai.sa</div>
      </div>
      {/* kpis */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {[
          { l: "قضايا مفتوحة", v: "٤٧", c: "#818CF8" },
          { l: "جلسات الأسبوع", v: "١٢", c: ACCENT2 },
          { l: "عملاء نشطون", v: "١٨٣", c: GREEN },
          { l: "فواتير معلقة", v: "٨", c: WARN },
        ].map(({ l, v, c }) => (
          <div key={l} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{l}</p>
            <p className="text-xl font-black mt-1" style={{ color: c }}>{v}</p>
          </div>
        ))}
      </div>
      {/* cases mini */}
      <div className="px-3 pb-3 space-y-1.5">
        {[
          ["قضية العقار — الأمل",    "مفتوحة",     GREEN],
          ["نزاع تجاري — المطيري",   "قيد التنفيذ", WARN],
          ["عقد استشارة — تقنية",    "جلسة قريبة", PURPLE],
        ].map(([n, s, c]) => (
          <div key={n} className="flex items-center justify-between px-3 py-2 rounded-lg"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.70)" }}>{n}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${c}20`, color: c }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DarkPremium() {
  return (
    <div dir="rtl" className="min-h-screen flex flex-col overflow-hidden"
      style={{ background: DARK, fontFamily: "'IBM Plex Sans Arabic', sans-serif", position: "relative" }}>

      {/* Background glow blobs */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "10%", right: "15%", width: 500, height: 500, borderRadius: "50%", background: `${ACCENT}18`, filter: "blur(120px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "10%", width: 350, height: 350, borderRadius: "50%", background: `${PURPLE}15`, filter: "blur(100px)" }} />
        <div style={{ position: "absolute", top: "40%", left: "40%", width: 250, height: 250, borderRadius: "50%", background: `${GREEN}10`, filter: "blur(80px)" }} />
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
          backgroundSize: "60px 60px"
        }} />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative flex items-center justify-between px-10 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(12px)", background: "rgba(11,31,59,0.8)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT, boxShadow: `0 4px 14px rgba(59,130,246,0.45)` }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="font-black text-lg text-white">عدالة <span style={{ color: ACCENT2 }}>AI</span></span>
        </div>
        <div className="flex items-center gap-6">
          {["المميزات", "الخدمات", "الأسعار", "الأسئلة"].map(l => (
            <a key={l} className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button className="text-sm font-semibold px-4 py-2 rounded-lg"
            style={{ color: "rgba(255,255,255,0.70)" }}>تسجيل الدخول</button>
          <button className="text-sm font-bold px-5 py-2.5 rounded-xl"
            style={{ background: ACCENT, color: WHITE, boxShadow: `0 4px 16px rgba(59,130,246,0.40)` }}>
            ابدأ مجاناً
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="relative flex-1 flex flex-col items-center px-10 pt-14">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
          style={{ background: "rgba(59,130,246,0.12)", color: ACCENT2, border: "1px solid rgba(59,130,246,0.25)" }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ACCENT }} />
          منصة قانونية SaaS — أول نظام عربي بالذكاء الاصطناعي
        </div>

        {/* Headline */}
        <h1 className="text-center font-black mb-5 text-white" style={{ fontSize: 52, lineHeight: 1.12, letterSpacing: "-0.025em" }}>
          مكتبك القانوني<br />
          <span style={{
            background: `linear-gradient(135deg, ${ACCENT2}, ${PURPLE})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>يعمل بذكاء اصطناعي</span>
        </h1>

        {/* Subtext */}
        <p className="text-center text-lg mb-8 max-w-xl" style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.75 }}>
          قضايا، عملاء، عقود، فواتير، ومحاسبة — كلها مع مساعد AI يعمل على مدار الساعة بالعربية.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-4 mb-12">
          <button className="flex items-center gap-2 font-bold px-8 py-4 rounded-xl text-base"
            style={{ background: ACCENT, color: WHITE, boxShadow: `0 8px 30px rgba(59,130,246,0.42)` }}>
            ابدأ مجاناً — 90 يوماً
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <button className="flex items-center gap-2 font-semibold px-6 py-4 rounded-xl text-base"
            style={{ color: "rgba(255,255,255,0.85)", border: "1.5px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.05)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT2} strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            احجز عرضاً تجريبياً
          </button>
        </div>

        {/* ── Two-column mockups ── */}
        <div className="w-full max-w-5xl grid grid-cols-2 gap-5">
          {/* Left: AI Chat */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${ACCENT}20` }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={ACCENT2} strokeWidth="2">
                  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                </svg>
              </div>
              <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.60)" }}>المساعد القانوني الذكي</p>
            </div>
            <AiChatLive />
          </div>
          {/* Right: Dashboard */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${GREEN}20` }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
              <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.60)" }}>لوحة التحكم المباشرة</p>
            </div>
            <MiniDashboard />
          </div>
        </div>

        {/* Stats bar */}
        <div className="w-full max-w-5xl mt-6 grid grid-cols-4 gap-4">
          {[
            { v: "٥٠٠+",  l: "مكتب محاماة",      c: ACCENT2  },
            { v: "٥٠ألف+", l: "قضية مُدارة",       c: PURPLE },
            { v: "٩٩.٩%", l: "وقت تشغيل مستمر",  c: GREEN  },
            { v: "٤ دول", l: "دول الخليج",         c: WARN   },
          ].map(({ v, l, c }) => (
            <div key={l} className="text-center py-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-2xl font-black" style={{ color: c }}>{v}</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>{l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
