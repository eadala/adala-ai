import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion, useInView } from "framer-motion";
import { Link } from "wouter";
import {
  CreditCard, ArrowLeft, Check, TrendingUp, Bell, FileText,
  Globe, Zap, AlertCircle, BarChart3, Receipt, Users,
  ChevronDown, Sparkles, ShieldCheck,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── palette ──────────────────────────────────────────────────── */
const BLUE   = "#1A56DB";
const BLUE_D = "#1344B5";
const BLUE_L = "#EFF6FF";
const BLUE_M = "#DBEAFE";
const BLUE_T = "#93C5FD";
const WHITE  = "#FFFFFF";
const BG     = "#F8FAFC";
const BG2    = "#F1F5F9";
const DARK   = "#0F172A";
const BODY   = "#334155";
const MUTED  = "#64748B";
const BORDER = "#E2E8F0";

/* ── StatCard ─────────────────────────────────────────────────── */
function StatCard({ icon: Icon, value, label, sub, color, delay = 0 }: {
  icon: React.ElementType; value: string; label: string; sub: string; color: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{ background: WHITE, border: `1px solid ${color}30`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10" style={{ background: color }} />
      <div className="relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
          style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="text-3xl font-black mb-0.5" style={{ color: DARK }}>{value}</div>
        <div className="text-sm font-bold mb-1" style={{ color: BODY }}>{label}</div>
        <div className="text-xs" style={{ color: MUTED }}>{sub}</div>
      </div>
    </motion.div>
  );
}

/* ── JourneyStep ──────────────────────────────────────────────── */
function JourneyStep({ icon, label, desc, color, delay, isLast }: {
  icon: string; label: string; desc: string; color: string; delay: number; isLast: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <div ref={ref} className="flex flex-col items-center relative">
      <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }} className="relative z-10">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm mb-2"
          style={{ background: `${color}10`, border: `1.5px solid ${color}30` }}>{icon}</div>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: delay + 0.1 }} className="text-center">
        <div className="text-xs font-bold mb-0.5" style={{ color: DARK }}>{label}</div>
        <div className="text-[10px] leading-tight max-w-[80px]" style={{ color: MUTED }}>{desc}</div>
      </motion.div>
      {!isLast && (
        <div className="hidden md:flex absolute right-0 translate-x-1/2 top-5 z-20">
          <ChevronDown className="w-4 h-4 rotate-90" style={{ color: `${color}50` }} />
        </div>
      )}
    </div>
  );
}

/* ── ProblemCard ──────────────────────────────────────────────── */
function ProblemCard({ icon: Icon, problem, solution, delay }: {
  icon: React.ElementType; problem: string; solution: string; delay: number;
}) {
  const { t } = useTranslation();
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl overflow-hidden"
      style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <Icon className="w-4 h-4 text-red-500" />
        </div>
        <div>
          <div className="text-xs font-bold text-red-500 mb-0.5">{t("landing.payment.problemLabel")}</div>
          <div className="text-sm" style={{ color: BODY }}>{problem}</div>
        </div>
      </div>
      <div className="h-px mx-4" style={{ background: BORDER }} />
      <div className="flex items-start gap-3 p-4 pt-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <Check className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <div className="text-xs font-bold text-emerald-600 mb-0.5">{t("landing.payment.solutionLabel")}</div>
          <div className="text-sm" style={{ color: BODY }}>{solution}</div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function PaymentShowcase() {
  const { t } = useTranslation();
  const heroRef  = useRef<HTMLDivElement>(null);
  const heroInView = useInView(heroRef, { once: true });

  const JOURNEY_ICONS = [
    { icon: "👤", color: "#6366F1" }, { icon: "📋", color: "#8B5CF6" },
    { icon: "🧾", color: BLUE },      { icon: "🔗", color: "#10B981" },
    { icon: "💳", color: "#06B6D4" }, { icon: "✅", color: "#22C55E" },
    { icon: "📊", color: BLUE },
  ];
  const journeyT = t("landing.payment.journeySteps", { returnObjects: true }) as { label: string; desc: string }[];
  const JOURNEY  = JOURNEY_ICONS.map((j, i) => ({ ...j, ...journeyT[i] }));

  const FEATURES     = t("landing.payment.features",      { returnObjects: true }) as string[];
  const PROBLEM_ICONS = [Bell, AlertCircle, FileText, Users];
  const problemsT    = t("landing.payment.problems",      { returnObjects: true }) as { problem: string; solution: string }[];
  const PROBLEMS     = PROBLEM_ICONS.map((icon, i) => ({ icon, ...problemsT[i] }));

  const statsT = t("landing.payment.stats", { returnObjects: true }) as { label: string; sub: string }[];
  const STATS  = [
    { icon: Receipt,    value: "121",  color: "#6366F1", delay: 0    },
    { icon: Check,      value: "89",   color: "#10B981", delay: 0.08 },
    { icon: TrendingUp, value: "1.8M", color: BLUE,      delay: 0.16 },
    { icon: BarChart3,  value: "96%",  color: "#22C55E", delay: 0.24 },
  ].map((s, i) => ({ ...s, ...statsT[i] }));

  const GLOBAL_METHOD_ICONS = ["🌍", "🇸🇦", "⚡", "🔒"];
  const globalMethods = t("landing.payment.globalMethods", { returnObjects: true }) as { label: string; desc: string }[];

  return (
    <section id="payment-showcase" className="relative py-28 px-4 overflow-hidden"
      style={{ background: BG2, borderTop: `1px solid ${BORDER}` }}>

      {/* Subtle orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full opacity-[0.4]"
          style={{ background: "radial-gradient(ellipse 60% 50% at 20% 40%, #DBEAFE, transparent)" }} />
        <div className="absolute top-0 right-0 w-full h-full opacity-[0.3]"
          style={{ background: "radial-gradient(ellipse 50% 40% at 80% 20%, #EDE9FE, transparent)" }} />
      </div>

      <div className="max-w-7xl mx-auto relative">

        {/* ── HERO HEADER ─────────────────────────────────────────── */}
        <div ref={heroRef} className="text-center mb-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
            style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", color: "#059669" }}>
            <Globe className="w-4 h-4" />
            {t("landing.payment.badge")}
            <ShieldCheck className="w-4 h-4" />
          </motion.div>

          <motion.p initial={{ opacity: 0, y: 10 }} animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="text-sm font-bold mb-3" style={{ color: "#059669" }}>
            {t("landing.payment.tagline")}
          </motion.p>

          <motion.h2 initial={{ opacity: 0, y: 24 }} animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black mb-5 leading-tight" style={{ color: DARK }}>
            {t("landing.payment.title")}{" "}
            <br className="hidden sm:block" />
            <span style={{ color: BLUE }}>{t("landing.payment.titleHighlight")}</span>
          </motion.h2>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: BODY, lineHeight: "1.75" }}>
            {t("landing.payment.subtitle")}
          </motion.p>

          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={heroInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm"
            style={{ background: BLUE_L, border: `1px solid ${BLUE_T}`, color: BLUE }}>
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="font-bold">{t("landing.payment.tagline2")}</span>
          </motion.div>
        </div>

        {/* ── STATS ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {STATS.map(s => <StatCard key={s.label} {...s} />)}
        </div>

        {/* ── JOURNEY ─────────────────────────────────────────────── */}
        <motion.div className="mb-20" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-3"
              style={{ background: BLUE_M, border: `1px solid ${BLUE_T}`, color: BLUE }}>
              {t("landing.payment.journeyBadge")}
            </div>
            <h3 className="text-2xl sm:text-3xl font-black" style={{ color: DARK }}>
              {t("landing.payment.journeyTitle")}
            </h3>
          </div>

          <div className="relative">
            <div className="hidden md:block absolute top-7 right-[calc(100%/14)] left-[calc(100%/14)] h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${BLUE_T}, ${BLUE}, ${BLUE_T}, transparent)` }} />
            <div className="grid grid-cols-3 md:grid-cols-7 gap-6 md:gap-2">
              {JOURNEY.map((j, i) => (
                <JourneyStep key={i} {...j} delay={i * 0.07} isLast={i === JOURNEY.length - 1} />
              ))}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-8 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-4 text-center md:text-right"
            style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 2px 12px rgba(16,185,129,0.08)" }}>
            <div className="text-4xl shrink-0">💰</div>
            <div className="flex-1">
              <div className="font-black text-lg mb-0.5" style={{ color: DARK }}>{t("landing.payment.resultTitle")}</div>
              <div className="text-sm" style={{ color: MUTED }}>{t("landing.payment.resultDesc")}</div>
            </div>
            <div className="shrink-0">
              <div className="text-3xl font-black" style={{ color: "#059669" }}>96%</div>
              <div className="text-xs" style={{ color: MUTED }}>{t("landing.payment.collectionRate")}</div>
            </div>
          </motion.div>
        </motion.div>

        {/* ── FEATURES GRID ───────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-5"
              style={{ background: "#EDE9FE", border: "1px solid #A5B4FC", color: "#6D28D9" }}>
              <Zap className="w-3.5 h-3.5" />
              {t("landing.payment.featuresBadge")}
            </div>
            <h3 className="text-2xl sm:text-3xl font-black mb-6" style={{ color: DARK }}>
              {t("landing.payment.featuresTitle")}{" "}
              <span style={{ color: BLUE }}>{t("landing.payment.featuresTitleHighlight")}</span>
            </h3>
            <div className="space-y-3">
              {FEATURES.map((f, i) => (
                <motion.div key={f} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.07 }}
                  className="flex items-center gap-3 p-3.5 rounded-xl transition-all"
                  style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: BLUE_M, border: `1px solid ${BLUE_T}` }}>
                    <Check className="w-3.5 h-3.5" style={{ color: BLUE }} />
                  </div>
                  <span className="text-sm font-medium" style={{ color: BODY }}>{f}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Invoice mock */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            <div className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${BORDER}`, background: WHITE, boxShadow: "0 8px 32px rgba(26,86,219,0.10)" }}>
              {/* Invoice header */}
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ background: BG2, borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: BLUE }}>
                    <Receipt className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-black" style={{ color: DARK }}>عدالة — فاتورة إلكترونية</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-bold"
                  style={{ background: "#D1FAE5", color: "#059669" }}>
                  {t("landing.payment.invoiceActive")}
                </span>
              </div>

              <div className="p-5 space-y-4">
                {/* Invoice meta */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: "رقم الفاتورة", v: "INV-2025-093" },
                    { l: "تاريخ الإصدار", v: "15 مارس 2025" },
                    { l: "العميل",        v: "مجموعة النور العقارية" },
                    { l: "تاريخ الاستحقاق", v: "30 مارس 2025" },
                  ].map(({ l, v }) => (
                    <div key={l} className="rounded-xl p-3" style={{ background: BG }}>
                      <div className="text-[10px] mb-0.5" style={{ color: MUTED }}>{l}</div>
                      <div className="text-xs font-bold" style={{ color: DARK }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Line items */}
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
                  <div className="px-4 py-2 flex items-center justify-between text-[10px] font-bold"
                    style={{ background: BG2, color: MUTED }}>
                    <span>الخدمة</span><span>المبلغ</span>
                  </div>
                  {[
                    ["تمثيل قانوني — قضية العقار", "85,000 ريال"],
                    ["استشارة قانونية (4 جلسات)",  "24,000 ريال"],
                    ["رسوم إدارية ووثائق",         "16,000 ريال"],
                  ].map(([s, a]) => (
                    <div key={s as string} className="px-4 py-2.5 flex items-center justify-between"
                      style={{ borderTop: `1px solid ${BORDER}` }}>
                      <span className="text-xs" style={{ color: BODY }}>{s as string}</span>
                      <span className="text-xs font-bold" style={{ color: DARK }}>{a as string}</span>
                    </div>
                  ))}
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{ background: BLUE_L, borderTop: `1px solid ${BLUE_T}` }}>
                    <span className="text-sm font-black" style={{ color: BLUE }}>الإجمالي</span>
                    <span className="text-lg font-black" style={{ color: BLUE }}>125,000 ريال</span>
                  </div>
                </div>

                {/* Payment link */}
                <div className="rounded-xl p-4" style={{ background: "#F0FDF4", border: "1px solid #A7F3D0" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-emerald-700">{t("landing.payment.paymentLink")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg text-[10px] truncate"
                      style={{ background: WHITE, border: `1px solid ${BORDER}`, color: MUTED }}>
                      pay.adalah-ai.sa/inv/2025-093
                    </div>
                    <div className="px-3 py-2 rounded-lg text-[10px] font-bold text-white shrink-0"
                      style={{ background: "#10B981" }}>
                      {t("landing.payment.sendWhatsapp")}
                    </div>
                  </div>
                </div>

                {/* Payment methods */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px]" style={{ color: MUTED }}>{t("landing.payment.accepts")}</span>
                  {["Visa", "Mastercard", "Mada", "Apple Pay", "STC Pay"].map(m => (
                    <span key={m} className="text-[9px] px-2 py-0.5 rounded-md font-bold"
                      style={{ background: BG2, color: BODY, border: `1px solid ${BORDER}` }}>{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── PROBLEMS ────────────────────────────────────────────── */}
        <motion.div className="mb-20" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>
              <AlertCircle className="w-3.5 h-3.5" />
              {t("landing.payment.problemsBadge")}
            </div>
            <h3 className="text-2xl sm:text-3xl font-black max-w-2xl mx-auto" style={{ color: DARK }}>
              {t("landing.payment.problemsTitle")}{" "}
              <span className="text-red-500">{t("landing.payment.problemsTitleRed")}</span>
              {" "}{t("landing.payment.problemsTitleSuffix")}
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {PROBLEMS.map((p, i) => <ProblemCard key={i} {...p} delay={i * 0.08} />)}
          </div>
        </motion.div>

        {/* ── GLOBAL ──────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="rounded-3xl p-8 md:p-12 mb-14 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${BLUE_L}, #EDE9FE)`, border: `1px solid ${BLUE_T}` }}>
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-[100px] opacity-30"
            style={{ background: BLUE_M }} />
          <div className="relative grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-black mb-5"
                style={{ background: "#D1FAE5", border: "1px solid #6EE7B7", color: "#059669" }}>
                <Globe className="w-4 h-4" />
                {t("landing.payment.globalBadge")}
              </div>
              <h3 className="text-2xl sm:text-3xl font-black mb-4" style={{ color: DARK }}>
                {t("landing.payment.globalTitle")}
              </h3>
              <p className="leading-relaxed" style={{ color: BODY, lineHeight: "1.75" }}>
                {t("landing.payment.globalSubtitle")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {globalMethods.map(({ label, desc }, i) => (
                <div key={i} className="rounded-2xl p-4"
                  style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div className="text-2xl mb-2">{GLOBAL_METHOD_ICONS[i]}</div>
                  <div className="text-sm font-bold mb-0.5" style={{ color: DARK }}>{label}</div>
                  <div className="text-xs leading-tight" style={{ color: MUTED }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={`${BASE}/sign-up`}>
              <button className="flex items-center gap-2.5 font-black px-9 py-4 rounded-2xl text-base transition-all hover:opacity-90 hover:scale-[1.02]"
                style={{ background: "#10B981", color: WHITE, boxShadow: "0 8px 32px rgba(16,185,129,0.25)" }}>
                <CreditCard className="w-5 h-5" />
                {t("landing.payment.ctaStart")}
              </button>
            </Link>
            <Link href={`${BASE}/sign-up`}>
              <button className="flex items-center gap-2.5 font-bold px-9 py-4 rounded-2xl text-base transition-all hover:opacity-90"
                style={{ background: BLUE_L, border: `1px solid ${BLUE_T}`, color: BLUE }}>
                <ArrowLeft className="w-5 h-5" />
                {t("landing.payment.ctaView")}
              </button>
            </Link>
          </div>
          <p className="text-sm mt-5" style={{ color: MUTED }}>{t("landing.payment.ctaFooter")}</p>
        </motion.div>

      </div>
    </section>
  );
}
