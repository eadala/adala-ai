import { useState } from "react";

const ACCENT = "#2563EB";
const DARK   = "#0B1F3B";
const MUTED  = "#6B7280";
const GREEN  = "#16A34A";
const WARN   = "#F59E0B";
const PURPLE = "#7C3AED";
const BORDER = "#E5E7EB";
const BG     = "#F8FAFC";

function DashboardFull() {
  const [tab, setTab] = useState(0);
  const TABS = ["لوحة التحكم", "القضايا", "العملاء", "الفواتير", "AI"];
  return (
    <div className="w-full rounded-2xl overflow-hidden flex shadow-2xl"
      style={{ border: `1px solid ${BORDER}`, background: "#fff", boxShadow: "0 32px 100px rgba(11,31,59,0.18)" }}>
      {/* Sidebar */}
      <div className="flex flex-col items-center gap-4 py-5 px-2" style={{ background: DARK, width: 52 }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: ACCENT }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        {[ACCENT, "#4F46E5", GREEN, WARN, PURPLE, MUTED].map((c, i) => (
          <div key={i} className="w-7 h-7 rounded-lg opacity-50"
            style={{ background: c + "25", border: `1px solid ${c}40` }} />
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3" style={{ background: BG, borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background: "#FC8181" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: WARN }} />
            <div className="w-3 h-3 rounded-full" style={{ background: GREEN }} />
          </div>
          <div className="flex-1 mx-4 px-3 py-1.5 rounded-lg text-xs text-center"
            style={{ background: "#fff", color: MUTED, border: `1px solid ${BORDER}`, maxWidth: 240 }}>
            app.adalah-ai.sa
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: GREEN }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} />
            نشط
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)}
              className="px-3 py-1.5 text-xs font-semibold transition-all"
              style={{ color: tab === i ? ACCENT : MUTED, borderBottom: tab === i ? `2px solid ${ACCENT}` : "2px solid transparent" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-4" style={{ background: BG }}>
          {tab === 0 && (
            <div className="space-y-3">
              {/* KPI row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { l: "قضايا مفتوحة", v: "٤٧", c: "#4F46E5" },
                  { l: "جلسات هذا الأسبوع", v: "١٢", c: ACCENT },
                  { l: "عملاء نشطون", v: "١٨٣", c: GREEN },
                  { l: "فواتير معلقة", v: "٨", c: WARN },
                ].map(({ l, v, c }) => (
                  <div key={l} className="rounded-xl p-3" style={{ background: "#fff", border: `1px solid ${BORDER}` }}>
                    <p className="text-xs mb-1" style={{ color: MUTED }}>{l}</p>
                    <p className="text-2xl font-black" style={{ color: c }}>{v}</p>
                    <p className="text-xs mt-1" style={{ color: GREEN }}>↑ 12%</p>
                  </div>
                ))}
              </div>
              {/* AI insight */}
              <div className="rounded-xl p-3 flex items-start gap-3" style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}20` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15` }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: ACCENT }}>توصية AI</p>
                  <p className="text-xs mt-0.5" style={{ color: "#374151" }}>
                    قضية "العمري vs شركة النور" — الجلسة بعد ٣ أيام. يُوصى بتحضير مستند الدفوع اليوم.
                  </p>
                </div>
              </div>
              {/* Recent cases */}
              <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${BORDER}` }}>
                <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <p className="text-xs font-bold" style={{ color: DARK }}>آخر القضايا</p>
                  <p className="text-xs" style={{ color: ACCENT }}>عرض الكل</p>
                </div>
                {[
                  ["قضية العقار — شركة الأمل",     "مفتوحة",     GREEN,  "٢٣ يونيو"],
                  ["نزاع تجاري — حمدان المطيري",   "قيد التنفيذ", WARN,  "٢٥ يونيو"],
                  ["قضية عمالية — مصنع الخليج",   "جلسة قريبة", "#4F46E5", "٢٠ يونيو"],
                ].map(([n, s, c, d]) => (
                  <div key={n} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <div>
                      <p className="text-xs font-medium" style={{ color: DARK }}>{n}</p>
                      <p className="text-[10px]" style={{ color: MUTED }}>{d}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${c}15`, color: c }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab !== 0 && (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm" style={{ color: MUTED }}>{TABS[tab]}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SpurStyle() {
  return (
    <div dir="rtl" className="min-h-screen flex flex-col" style={{ background: "#F8FAFC", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>

      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between px-10 py-4" style={{ background: "#fff", borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: ACCENT }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="font-black text-lg" style={{ color: DARK }}>عدالة <span style={{ color: ACCENT }}>AI</span></span>
        </div>
        <div className="flex items-center gap-6">
          {["المميزات", "الخدمات", "الأسعار", "الأسئلة"].map(l => (
            <a key={l} className="text-sm font-medium transition-colors" style={{ color: MUTED }}>{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            style={{ color: DARK }}>تسجيل الدخول</button>
          <button className="text-sm font-bold px-5 py-2.5 rounded-xl transition-all"
            style={{ background: ACCENT, color: "#fff", boxShadow: `0 4px 14px rgba(37,99,235,0.30)` }}>
            ابدأ مجاناً
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center px-10 pt-14 pb-0">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
          style={{ background: `${ACCENT}12`, color: ACCENT, border: `1px solid ${ACCENT}30` }}>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ACCENT }} />
          منصة قانونية SaaS للمكاتب العربية
        </div>

        {/* Headline */}
        <h1 className="text-center font-black mb-4" style={{ fontSize: 52, color: DARK, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          أدِر مكتبك القانوني<br />
          <span style={{ color: ACCENT }}>بذكاء اصطناعي حقيقي</span>
        </h1>

        {/* Subtext */}
        <p className="text-center text-lg mb-8 max-w-xl" style={{ color: MUTED, lineHeight: 1.7 }}>
          منصة متكاملة تجمع القضايا، العملاء، الفواتير، الموارد البشرية، والذكاء الاصطناعي — في مكان واحد.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-4 mb-10">
          <button className="flex items-center gap-2 font-bold px-8 py-4 rounded-xl text-base"
            style={{ background: ACCENT, color: "#fff", boxShadow: `0 8px 28px rgba(37,99,235,0.35)` }}>
            ابدأ مجاناً — 90 يوماً
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5m-7 0l7-7-7 7 7 7"/>
            </svg>
          </button>
          <button className="flex items-center gap-2 font-semibold px-6 py-4 rounded-xl text-base"
            style={{ color: DARK, border: `1.5px solid ${BORDER}`, background: "#fff" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            احجز عرضاً تجريبياً
          </button>
        </div>

        {/* Trust row */}
        <div className="flex items-center gap-6 mb-10">
          {["بدون بطاقة ائتمان", "إعداد في 5 دقائق", "SSL آمن 100%", "دعم عربي كامل"].map(l => (
            <span key={l} className="flex items-center gap-1.5 text-sm" style={{ color: MUTED }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {l}
            </span>
          ))}
        </div>

        {/* ── Full-width product mockup ── */}
        <div className="w-full max-w-5xl relative">
          {/* Floating chips */}
          <div className="absolute -top-5 right-12 z-20 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shadow-lg"
            style={{ background: "#fff", border: `1px solid ${BORDER}`, color: GREEN }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            بيانات حقيقية مباشرة
          </div>
          <div className="absolute -top-5 left-12 z-20 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shadow-lg"
            style={{ background: "#fff", border: `1px solid ${BORDER}`, color: PURPLE }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            جلسة تمييز — بعد ساعتين
          </div>
          <div className="absolute -bottom-5 left-12 z-20 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold shadow-xl"
            style={{ background: DARK, color: "#fff" }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#4ADE80" }} />
            نشط الآن — ٤٧ مكتب
          </div>
          <div className="absolute -bottom-5 right-12 z-20 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: ACCENT, color: "#fff", boxShadow: `0 8px 20px rgba(37,99,235,0.35)` }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            AI أنجز ١٢ مهمة اليوم
          </div>

          {/* Gradient fade at bottom */}
          <div className="absolute bottom-0 inset-x-0 h-20 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to bottom, transparent, #F8FAFC)" }} />

          <DashboardFull />
        </div>
      </div>
    </div>
  );
}
