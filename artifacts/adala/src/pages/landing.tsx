import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Scale, Shield, Bot, FileText, Users, ArrowLeft, CheckCircle, Star,
  ChevronDown, ChevronUp, Play, Zap, Clock, BarChart3, MessageSquare,
  Calendar, Receipt, Briefcase, Globe, Lock, Database, Activity,
  Building2, CreditCard, Phone, Mail, Twitter, Linkedin, Youtube,
  Menu, X, ArrowRight, Sparkles, TrendingUp, Award, Check,
  Brain, Layers, HardDrive, Palette, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Animated counter ──────────────────────────────────────────────────────
function Counter({ to, suffix = "", duration = 2, locale = "ar-SA" }: { to: number; suffix?: string; duration?: number; locale?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, to, duration]);
  return <span ref={ref}>{count.toLocaleString(locale)}{suffix}</span>;
}

// ── Fade-in wrapper ───────────────────────────────────────────────────────
const FadeIn = ({ children, delay = 0, y = 30, className = "" }: any) => (
  <motion.div
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

// ── Gradient text ─────────────────────────────────────────────────────────
const GoldText = ({ children }: { children: React.ReactNode }) => (
  <span style={{ background: "linear-gradient(135deg, #C9A84C, #F0D060)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
    {children}
  </span>
);

// ── FAQ Item ──────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border rounded-xl overflow-hidden cursor-pointer transition-all"
      style={{ borderColor: open ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.08)", background: open ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.02)" }}
      onClick={() => setOpen(p => !p)}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold text-white text-sm md:text-base">{q}</span>
        {open ? <ChevronUp className="w-5 h-5 text-[#C9A84C] shrink-0" /> : <ChevronDown className="w-5 h-5 text-white/40 shrink-0" />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <p className="px-6 pb-4 text-white/60 text-sm leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Dashboard mock ────────────────────────────────────────────────────────
function DashboardMock() {
  const { t } = useTranslation();
  const TABS = [
    t("landing.dashboard.tab0"),
    t("landing.dashboard.tab1"),
    t("landing.dashboard.tab2"),
    t("landing.dashboard.tab3"),
    t("landing.dashboard.tab4"),
  ];
  const [active, setActive] = useState(0);
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.12)", background: "#0D1626" }}>
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#070E1C", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-3 h-3 rounded-full bg-red-500/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
        <div className="w-3 h-3 rounded-full bg-green-400/70" />
        <div className="flex-1 mx-4 px-3 py-1 rounded text-xs text-white/30 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
          app.adalah-ai.sa
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="px-3 py-2 text-xs font-medium rounded-t transition-all"
            style={{ color: active === i ? "#C9A84C" : "rgba(255,255,255,0.4)", borderBottom: active === i ? "2px solid #C9A84C" : "2px solid transparent" }}
          >
            {tab}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="p-4 h-64 md:h-72">
        {active === 0 && (
          <div className="grid grid-cols-2 gap-3 h-full">
            {[
              [t("landing.dashboard.openCases"), "٤٧", "#6366F1"],
              [t("landing.dashboard.upcomingSessions"), "١٢", "#C9A84C"],
              [t("landing.dashboard.activeClients"), "١٨٣", "#10B981"],
              [t("landing.dashboard.pendingInvoices"), "٨", "#F59E0B"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl p-3 flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-xs text-white/40">{l as string}</p>
                <p className="text-2xl font-black" style={{ color: c as string }}>{v as string}</p>
              </div>
            ))}
          </div>
        )}
        {active === 1 && (
          <div className="space-y-2">
            {[
              ["قضية العقار - شركة الأمل", "مفتوحة", "#10B981"],
              ["نزاع تجاري - حمدان المطيري", "قيد التنفيذ", "#F59E0B"],
              ["قضية عمالية - مصنع الخليج", "جلسة قريبة", "#6366F1"],
              ["عقد استشارة - شركة تقنية", "مغلقة", "#EF4444"],
            ].map(([n, s, c]) => (
              <div key={n as string} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                <span className="text-xs text-white/70">{n as string}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${c}22`, color: c as string }}>{s as string}</span>
              </div>
            ))}
          </div>
        )}
        {active === 2 && (
          <div className="space-y-2">
            {["شركة الأمل التجارية", "حمدان المطيري", "مصنع الخليج للصناعة", "مجموعة النور العقارية"].map((n, i) => (
              <div key={n} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-bold" style={{ background: ["#6366F1","#C9A84C","#10B981","#F59E0B"][i] }}>
                  {n[0]}
                </div>
                <span className="text-xs text-white/70">{n}</span>
                <span className="mr-auto text-[10px] text-white/30">{t("landing.dashboard.activeClient")}</span>
              </div>
            ))}
          </div>
        )}
        {active === 3 && (
          <div className="space-y-2">
            {[
              ["INV-2024-091", "٨,٥٠٠ ريال", t("landing.dashboard.paid")],
              ["INV-2024-092", "٣,٢٠٠ ريال", t("landing.dashboard.pending")],
              ["INV-2024-093", "١٢,٠٠٠ ريال", t("landing.dashboard.paid")],
            ].map(([id, amt, st]) => (
              <div key={id as string} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div>
                  <p className="text-xs text-white/70">{id as string}</p>
                  <p className="text-sm font-bold text-white">{amt as string}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: st === t("landing.dashboard.paid") ? "#10B98122" : "#F59E0B22", color: st === t("landing.dashboard.paid") ? "#10B981" : "#F59E0B" }}>{st as string}</span>
              </div>
            ))}
          </div>
        )}
        {active === 4 && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl max-w-[80%]" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}>
              <p className="text-xs text-white/70">ما هي القضايا التي موعد جلستها هذا الأسبوع؟</p>
            </div>
            <div className="p-3 rounded-xl mr-8" style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)" }}>
              <p className="text-xs text-[#C9A84C] mb-1">المساعد الذكي ✦</p>
              <p className="text-xs text-white/70">لديك ٣ جلسات هذا الأسبوع: الأحد قضية العقار ١٠ص، الثلاثاء نزاع تجاري ٢م، الأربعاء استشارة قانونية ١١ص.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function Landing() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const NAV = [
    { label: t("landing.nav.features"), href: "#features" },
    { label: t("landing.nav.how"),      href: "#how" },
    { label: t("landing.nav.security"), href: "#security" },
    { label: t("landing.nav.pricing"),  href: "/pricing" },
    { label: t("landing.nav.faq"),      href: "#faq" },
  ];

  // ── Icon/color arrays (non-translatable) ────────────────────────────
  const FEATURE_ICONS  = [Scale, Bot, FileText, Users, Calendar, Receipt, Database, Globe, Shield, Activity, BarChart3, Briefcase, Clock, Building2, Mail, CreditCard, Sparkles, Brain, DollarSign, Award, Layers, HardDrive, Palette, MessageSquare];
  const FEATURE_COLORS = ["#C9A84C","#6366F1","#10B981","#F59E0B","#EC4899","#8B5CF6","#06B6D4","#F97316","#EF4444","#3B82F6","#22C55E","#14B8A6","#A855F7","#F43F5E","#60A5FA","#D946EF","#A78BFA","#8B5CF6","#34D399","#FBBF24","#6366F1","#3B82F6","#F472B6","#10B981"];
  const AI_ICONS       = [FileText, BarChart3, Zap, TrendingUp];
  const STEP_COLORS    = ["#C9A84C","#6366F1","#10B981","#F59E0B"];
  const SEC_ICONS      = [Lock, Building2, Database, Activity, Shield, Globe];
  const SEC_COLORS     = ["#10B981","#6366F1","#F59E0B","#EC4899","#C9A84C","#06B6D4"];

  // ── Translated arrays ────────────────────────────────────────────────
  const featureItems   = (t("landing.features.items",  { returnObjects: true }) as { title: string; desc: string }[]);
  const aiItems        = (t("landing.ai.items",         { returnObjects: true }) as { title: string; desc: string }[]);
  const steps          = (t("landing.how.steps",        { returnObjects: true }) as { n: string; title: string; desc: string }[]);
  const secItems       = (t("landing.security.items",   { returnObjects: true }) as { title: string; desc: string }[]);
  const testimonials   = (t("landing.testimonials.items",{ returnObjects: true }) as { name: string; role: string; text: string }[]);
  const pricingPlans   = (t("landing.pricing.plans",    { returnObjects: true }) as { name: string; price: string; period: string; cta: string; features: string[] }[]);
  const faqItems       = (t("landing.faq.items",        { returnObjects: true }) as { q: string; a: string }[]);
  const privacyItems   = (t("landing.privacy.items",    { returnObjects: true }) as { icon: string; label: string; desc: string }[]);
  const platformLinks  = (t("landing.footer.platformLinks", { returnObjects: true }) as string[]);
  const companyLinks   = (t("landing.footer.companyLinks",  { returnObjects: true }) as string[]);
  const supportLabels  = (t("landing.footer.supportLinks",  { returnObjects: true }) as string[]);
  const supportHrefs   = ["#", "/privacy", "/terms", "/security"];

  const counterLocale = isAr ? "ar-SA" : "en-US";
  const textAlign = isAr ? "text-right" : "text-left";

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen overflow-x-hidden" style={{ background: "#080F1E", fontFamily: "Cairo, sans-serif" }}>

      {/* ── Sticky Navbar ──────────────────────────────────────────────── */}
      <header
        className="fixed top-0 right-0 left-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(8,15,30,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C060)" }}>
              <Scale className="w-4 h-4 text-[#0D1626]" />
            </div>
            <span className="text-lg font-black text-white">عدالة AI</span>
          </div>
          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV.map(n => (
              <a key={n.href} href={n.href} className="text-sm text-white/60 hover:text-white transition-colors">{n.label}</a>
            ))}
          </nav>
          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Link href={`${BASE}/sign-in`}>
              <button className="text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5">{t("landing.signIn")}</button>
            </Link>
            <Link href={`${BASE}/sign-up`}>
              <button className="text-sm font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C060)", color: "#0D1626" }}>
                {t("landing.startFree")}
              </button>
            </Link>
          </div>
          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <LanguageSwitcher />
            <button className="text-white/70 hover:text-white p-2" onClick={() => setNavOpen(p => !p)}>
              {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        <AnimatePresence>
          {navOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden"
              style={{ background: "rgba(8,15,30,0.98)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="px-4 py-4 space-y-3">
                {NAV.map(n => (
                  <a key={n.href} href={n.href} className="block text-white/70 hover:text-white py-2" onClick={() => setNavOpen(false)}>{n.label}</a>
                ))}
                <Link href={`${BASE}/sign-up`}>
                  <button className="w-full font-bold py-3 rounded-xl mt-2" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C060)", color: "#0D1626" }}>
                    {t("landing.startFree")}
                  </button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20" style={{ background: "#C9A84C" }} />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full blur-[100px] opacity-15" style={{ background: "#6366F1" }} />
        </div>

        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div className={textAlign}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C" }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t("landing.hero.badge")}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6"
            >
              {t("landing.hero.titleLine1")}<br />
              {t("landing.hero.titleLine2")}<br />
              <GoldText>{t("landing.hero.titleHighlight")}</GoldText>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-white/60 mb-8 leading-relaxed max-w-lg"
            >
              {t("landing.hero.subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-3 mb-8"
            >
              <Link href={`${BASE}/sign-up`}>
                <button className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 shadow-lg"
                  style={{ background: "linear-gradient(135deg, #C9A84C, #E0C060)", color: "#0D1626", boxShadow: "0 8px 32px rgba(201,168,76,0.35)" }}>
                  {t("landing.startFree")}
                  {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </Link>
              <Link href={`${BASE}/demo`}>
                <button className="flex items-center gap-2 font-semibold px-7 py-3.5 rounded-xl text-base border transition-all hover:bg-white/5 hover:scale-[1.02]"
                  style={{ borderColor: "rgba(201,168,76,0.4)", color: "#E0C060", background: "rgba(201,168,76,0.06)" }}>
                  <Sparkles className="w-4 h-4" />
                  استكشف المنصة
                </button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-4 flex-wrap"
            >
              {[t("landing.hero.noCard"), t("landing.hero.quickSetup"), t("landing.hero.arabicSupport"), t("landing.hero.interactive")].map(label => (
                <span key={label} className="flex items-center gap-1.5 text-sm text-white/50">
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  {label}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Dashboard mock */}
          <motion.div
            initial={{ opacity: 0, x: isAr ? -40 : 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <DashboardMock />
          </motion.div>
        </div>
      </section>

      {/* ── TRUST STRIP ────────────────────────────────────────────────── */}
      <section className="py-14 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <FadeIn className="max-w-5xl mx-auto">
          <p className="text-center text-white/30 text-sm mb-10">{t("landing.trust.tagline")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { to: 1000,   suffix: "+", labelKey: "landing.trust.offices",      icon: Building2 },
              { to: 100000, suffix: "+", labelKey: "landing.trust.cases",        icon: Briefcase },
              { to: 99,    suffix: ".9%", labelKey: "landing.trust.satisfaction", icon: Award },
              { to: 40,    suffix: "%", labelKey: "landing.trust.timeSaving",   icon: Clock },
            ].map(s => (
              <div key={s.labelKey} className="space-y-1">
                <div className="text-4xl font-black" style={{ color: "#C9A84C" }}>
                  <Counter to={s.to} suffix={s.suffix} locale={counterLocale} />
                </div>
                <p className="text-white/50 text-sm">{t(s.labelKey)}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }}>
              {t("landing.features.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-4">{t("landing.features.title")}</h2>
            <p className="text-white/50 max-w-xl mx-auto">{t("landing.features.subtitle")}</p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {featureItems.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              const color = FEATURE_COLORS[i];
              return (
                <FadeIn key={i} delay={i * 0.04}>
                  <div
                    className="p-5 rounded-2xl h-full transition-all duration-300 cursor-default"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  >
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <h3 className="font-bold text-white mb-1.5 text-sm">{f.title}</h3>
                    <p className="text-white/45 text-xs leading-relaxed">{f.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── AI SECTION ─────────────────────────────────────────────────── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #6366F1, transparent)" }} />
        </div>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }}>
              {t("landing.ai.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-5">
              {t("landing.ai.title")}<br />
              <GoldText>{t("landing.ai.titleHighlight")}</GoldText>
            </h2>
            <p className="text-white/55 text-lg mb-8 leading-relaxed">
              {t("landing.ai.subtitle")}
            </p>
            <div className="space-y-3">
              {aiItems.map((item, i) => {
                const Icon = AI_ICONS[i];
                return (
                  <FadeIn key={i} delay={i * 0.08} y={15}>
                    <div className="flex items-start gap-4 p-4 rounded-xl transition-all" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.2)" }}>
                        <Icon className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{item.title}</p>
                        <p className="text-white/50 text-xs mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </FadeIn>

          {/* AI Chat Visual */}
          <FadeIn delay={0.2}>
            <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C060)" }}>
                  <Scale className="w-3.5 h-3.5 text-[#0D1626]" />
                </div>
                <span className="text-sm font-bold text-white">{t("landing.ai.assistantName")}</span>
                <span className="mr-auto text-xs px-2 py-0.5 rounded-full text-green-400" style={{ background: "rgba(16,185,129,0.15)" }}>{t("landing.ai.available")}</span>
              </div>
              {[
                { role: "user", text: "ما هي الجلسات المقررة هذا الأسبوع؟" },
                { role: "ai",   text: "لديك ٣ جلسات هذا الأسبوع:\n• الأحد ٩ يونيو — قضية العقار (١٠:٠٠ص)\n• الثلاثاء ١١ يونيو — نزاع تجاري (٢:٠٠م)\n• الأربعاء ١٢ يونيو — استشارة قانونية (١١:٠٠ص)" },
                { role: "user", text: "أي الفواتير معلقة لأكثر من ٣٠ يوماً؟" },
                { role: "ai",   text: "يوجد ٣ فواتير معلقة تجاوزت ٣٠ يوماً بإجمالي ٢٤,٥٠٠ ريال. هل تريد إرسال تذكير تلقائي؟" },
              ].map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div
                    className="max-w-[82%] px-4 py-3 rounded-xl text-xs leading-relaxed whitespace-pre-line"
                    style={{
                      background: m.role === "user" ? "rgba(255,255,255,0.06)" : "rgba(201,168,76,0.12)",
                      color: m.role === "user" ? "rgba(255,255,255,0.75)" : "#F0D060",
                      border: m.role === "user" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(201,168,76,0.25)",
                    }}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder={t("landing.ai.askPlaceholder")}
                  readOnly
                  className="flex-1 text-xs px-3 py-2.5 rounded-xl outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
                />
                <button className="px-3 py-2.5 rounded-xl" style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)" }}>
                  <ArrowRight className="w-4 h-4 text-[#0D1626]" />
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <section id="how" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}>
              {t("landing.how.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-4">{t("landing.how.title")}</h2>
            <p className="text-white/50">{t("landing.how.subtitle")}</p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="relative p-6 rounded-2xl h-full" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {i < 3 && (
                    <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 text-white/15">
                      {isAr ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                    </div>
                  )}
                  <div className="text-4xl font-black mb-4" style={{ color: STEP_COLORS[i] }}>{s.n}</div>
                  <h3 className="font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ───────────────────────────────────────────────────── */}
      <section id="security" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)" }}>
              {t("landing.security.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-4">{t("landing.security.title")}</h2>
            <p className="text-white/50 max-w-xl mx-auto">{t("landing.security.subtitle")}</p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {secItems.map((s, i) => {
              const Icon = SEC_ICONS[i];
              const color = SEC_COLORS[i];
              return (
                <FadeIn key={i} delay={i * 0.07}>
                  <div className="flex gap-4 p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm mb-1">{s.title}</h3>
                      <p className="text-white/45 text-xs leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">{t("landing.testimonials.title")}</h2>
            <p className="text-white/50">{t("landing.testimonials.subtitle")}</p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="p-6 rounded-2xl h-full flex flex-col" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-[#C9A84C]" style={{ color: "#C9A84C" }} />
                    ))}
                  </div>
                  <p className="text-white/65 text-sm leading-relaxed flex-1 mb-5">"{item.text}"</p>
                  <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-[#0D1626]" style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)" }}>
                      {item.name[0]}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{item.name}</p>
                      <p className="text-white/40 text-xs">{item.role}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}>
              {t("landing.pricing.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-4">{t("landing.pricing.title")}</h2>
            <p className="text-white/50">{t("landing.pricing.subtitle")}</p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {pricingPlans.map((p, i) => {
              const highlight = i === 1;
              const isOpen = i === pricingPlans.length - 1;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <div
                    className="p-6 rounded-2xl h-full flex flex-col relative overflow-hidden"
                    style={{
                      background: isOpen
                        ? "linear-gradient(135deg, rgba(201,168,76,0.12), rgba(99,102,241,0.08))"
                        : highlight ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.03)",
                      border: isOpen
                        ? "2px solid rgba(201,168,76,0.6)"
                        : highlight ? "2px solid rgba(201,168,76,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {highlight && !isOpen && (
                      <div className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626" }}>
                        {t("landing.pricing.mostPopular")}
                      </div>
                    )}
                    {isOpen && (
                      <div className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "linear-gradient(135deg,#C9A84C,#6366F1)", color: "#fff" }}>
                        كل الخدمات
                      </div>
                    )}
                    <p className={`font-bold text-sm mb-3 ${isOpen ? "text-amber-400 mt-6" : highlight ? "text-white/60 mt-6" : "text-white/60"}`}>{p.name}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-black text-white">{p.price}</span>
                      {p.period && <span className="text-white/40 text-sm mr-1">{p.period}</span>}
                    </div>
                    <ul className="space-y-2 flex-1 mb-6">
                      {p.features.map((f, fi) => (
                        <li key={fi} className={`flex items-start gap-2 text-sm ${isOpen ? "text-white/80" : "text-white/70"}`}>
                          <Check className="w-4 h-4 text-[#C9A84C] shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href={isOpen ? "#contact" : `${BASE}/sign-up`}>
                      <button
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                        style={isOpen
                          ? { background: "linear-gradient(135deg,#C9A84C,#6366F1)", color: "#fff" }
                          : highlight
                          ? { background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626" }
                          : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }
                        }
                      >
                        {p.cta}
                      </button>
                    </Link>
                  </div>
                </FadeIn>
              );
            })}
          </div>

          <FadeIn className="text-center mt-10">
            <Link href="/pricing">
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-80"
                style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.25)" }}>
                {t("landing.pricing.viewAll")}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 7L7 13M13 7H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">{t("landing.faq.title")}</h2>
            <p className="text-white/50">{t("landing.faq.subtitle")}</p>
          </FadeIn>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <FadeIn key={i} y={10}>
                <FAQItem q={item.q} a={item.a} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <FadeIn>
          <div
            className="max-w-4xl mx-auto rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.12), rgba(99,102,241,0.12))", border: "1px solid rgba(201,168,76,0.25)" }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-25" style={{ background: "#C9A84C" }} />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-[60px] opacity-20" style={{ background: "#6366F1" }} />
            </div>
            <div className="relative">
              <Sparkles className="w-10 h-10 mx-auto mb-5" style={{ color: "#C9A84C" }} />
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                {t("landing.cta.title")}<br />
                <GoldText>{t("landing.cta.titleHighlight")}</GoldText>
              </h2>
              <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
                {t("landing.cta.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href={`${BASE}/sign-up`}>
                  <button className="flex items-center gap-2 font-bold px-9 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02] shadow-xl"
                    style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626", boxShadow: "0 8px 32px rgba(201,168,76,0.4)" }}>
                    {t("landing.startFreeNow")}
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </Link>
                <div className="flex items-center gap-4">
                  {[t("landing.cta.noCard"), t("landing.cta.arabicSupport")].map(label => (
                    <span key={label} className="flex items-center gap-1.5 text-sm text-white/50">
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── PRIVACY / TRUST SECTION ────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-5"
            style={{ background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}>
            {t("landing.privacy.badge")}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-4">
            {t("landing.privacy.title")}
          </h2>
          <p className="text-white/50 text-base leading-relaxed mb-8 max-w-2xl mx-auto">
            {t("landing.privacy.subtitle")}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {privacyItems.map((item, i) => (
              <div key={i} className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="text-sm font-bold text-white mb-1">{item.label}</div>
                <div className="text-xs text-white/40">{item.desc}</div>
              </div>
            ))}
          </div>
          <Link href="/security">
            <button className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:opacity-90"
              style={{ background: "rgba(16,185,129,0.12)", color: "#10B981", border: "1px solid rgba(16,185,129,0.25)" }}>
              {t("landing.privacy.learnMore")}
              {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="max-w-7xl mx-auto px-4 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)" }}>
                  <Scale className="w-4 h-4 text-[#0D1626]" />
                </div>
                <span className="text-lg font-black text-white">عدالة AI</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed mb-4">{t("landing.footer.tagline")}</p>
              <div className="flex gap-3">
                {[Twitter, Linkedin, Youtube].map((Icon, i) => (
                  <a key={i} href="#" className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <Icon className="w-4 h-4 text-white/50 hover:text-white" />
                  </a>
                ))}
              </div>
            </div>
            {/* Platform links */}
            <div>
              <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.platform")}</h4>
              <ul className="space-y-2.5">
                {platformLinks.map((l, i) => (
                  <li key={i}><a href="#" className="text-white/45 text-sm hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            {/* Company links */}
            <div>
              <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.company")}</h4>
              <ul className="space-y-2.5">
                {companyLinks.map((l, i) => (
                  <li key={i}><a href="#" className="text-white/45 text-sm hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            {/* Support links */}
            <div>
              <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.support")}</h4>
              <ul className="space-y-2.5">
                {supportLabels.map((l, i) => (
                  <li key={i}>
                    <Link href={supportHrefs[i]}>
                      <span className="text-white/45 text-sm hover:text-white transition-colors cursor-pointer">{l}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/30 text-sm">{t("landing.footer.copyright")}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full text-green-400" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                {t("landing.footer.allSystemsNormal")}
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp floating button ────────────────────────────────────── */}
      <a
        href="https://wa.me/966500000000"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 z-40"
        style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.4)" }}
        title="تواصل عبر واتساب"
      >
        <Phone className="w-6 h-6 text-white" />
      </a>
    </div>
  );
}
