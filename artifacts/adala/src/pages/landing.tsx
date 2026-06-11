import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Scale, Shield, Bot, FileText, Users, ArrowLeft, CheckCircle, Star,
  ChevronDown, ChevronUp, Play, Zap, Clock, BarChart3, MessageSquare,
  Calendar, Receipt, Briefcase, Globe, Lock, Database, Activity,
  Building2, CreditCard, Phone, Mail, Twitter, Linkedin, Youtube,
  Menu, X, ArrowRight, Sparkles, TrendingUp, Award, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Animated counter ──────────────────────────────────────────────────────
function Counter({ to, suffix = "", duration = 2 }: { to: number; suffix?: string; duration?: number }) {
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
  return <span ref={ref}>{count.toLocaleString("ar-SA")}{suffix}</span>;
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
const TABS = ["لوحة التحكم", "القضايا", "العملاء", "الفواتير", "المساعد الذكي"];
function DashboardMock() {
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
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setActive(i)}
            className="px-3 py-2 text-xs font-medium rounded-t transition-all"
            style={{ color: active === i ? "#C9A84C" : "rgba(255,255,255,0.4)", borderBottom: active === i ? "2px solid #C9A84C" : "2px solid transparent" }}
          >
            {t}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="p-4 h-64 md:h-72">
        {active === 0 && (
          <div className="grid grid-cols-2 gap-3 h-full">
            {[["القضايا المفتوحة", "٤٧", "#6366F1"], ["الجلسات القادمة", "١٢", "#C9A84C"], ["العملاء النشطين", "١٨٣", "#10B981"], ["الفواتير المعلقة", "٨", "#F59E0B"]].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl p-3 flex flex-col justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-xs text-white/40">{l as string}</p>
                <p className="text-2xl font-black" style={{ color: c as string }}>{v as string}</p>
              </div>
            ))}
          </div>
        )}
        {active === 1 && (
          <div className="space-y-2">
            {[["قضية العقار - شركة الأمل", "مفتوحة", "#10B981"], ["نزاع تجاري - حمدان المطيري", "قيد التنفيذ", "#F59E0B"], ["قضية عمالية - مصنع الخليج", "جلسة قريبة", "#6366F1"], ["عقد استشارة - شركة تقنية", "مغلقة", "#EF4444"]].map(([n, s, c]) => (
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
                <span className="mr-auto text-[10px] text-white/30">عميل نشط</span>
              </div>
            ))}
          </div>
        )}
        {active === 3 && (
          <div className="space-y-2">
            {[["INV-2024-091", "٨,٥٠٠ ريال", "مدفوعة"], ["INV-2024-092", "٣,٢٠٠ ريال", "معلقة"], ["INV-2024-093", "١٢,٠٠٠ ريال", "مدفوعة"]].map(([id, amt, st]) => (
              <div key={id as string} className="flex items-center justify-between p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div>
                  <p className="text-xs text-white/70">{id as string}</p>
                  <p className="text-sm font-bold text-white">{amt as string}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: st === "مدفوعة" ? "#10B98122" : "#F59E0B22", color: st === "مدفوعة" ? "#10B981" : "#F59E0B" }}>{st as string}</span>
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
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const NAV = [
    { label: "المميزات", href: "#features" },
    { label: "كيف يعمل", href: "#how" },
    { label: "الأمان", href: "#security" },
    { label: "الأسعار", href: "#pricing" },
    { label: "الأسئلة الشائعة", href: "#faq" },
  ];

  return (
    <div dir="rtl" className="min-h-screen overflow-x-hidden" style={{ background: "#080F1E", fontFamily: "Cairo, sans-serif" }}>

      {/* ── Sticky Navbar ─────────────────────────────────────────────── */}
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
            <Link href={`${BASE}/sign-in`}>
              <button className="text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5">تسجيل الدخول</button>
            </Link>
            <Link href={`${BASE}/sign-up`}>
              <button className="text-sm font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C060)", color: "#0D1626" }}>
                ابدأ مجاناً
              </button>
            </Link>
          </div>
          {/* Mobile hamburger */}
          <button className="md:hidden text-white/70 hover:text-white p-2" onClick={() => setNavOpen(p => !p)}>
            {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
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
                    ابدأ مجاناً
                  </button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20" style={{ background: "#C9A84C" }} />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full blur-[100px] opacity-15" style={{ background: "#6366F1" }} />
        </div>

        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <div className="text-right">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C" }}
            >
              <span>🇸🇦</span>
              المنصة القانونية الذكية الأولى في المملكة
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6"
            >
              مستقبل إدارة<br />
              المكاتب القانونية<br />
              <GoldText>مدعوم بالذكاء الاصطناعي</GoldText>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-white/60 mb-8 leading-relaxed max-w-lg"
            >
              كل ما يحتاجه مكتبك القانوني في منصة واحدة. إدارة القضايا، العقود، العملاء، الفواتير، والمراسلات — مع تحليل المستندات بالذكاء الاصطناعي.
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
                  ابدأ مجاناً
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </Link>
              <a href="#how" className="flex items-center gap-2 font-semibold px-7 py-3.5 rounded-xl text-base border transition-all hover:bg-white/5"
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)" }}>
                <Play className="w-4 h-4" />
                احجز عرضاً مباشراً
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex items-center gap-4 flex-wrap"
            >
              {["لا بطاقة ائتمانية", "إعداد في دقيقتين", "دعم كامل بالعربية"].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-sm text-white/50">
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right: dashboard */}
          <motion.div
            initial={{ opacity: 0, x: -40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <DashboardMock />
          </motion.div>
        </div>
      </section>

      {/* ── TRUST STRIP ───────────────────────────────────────────────── */}
      <section className="py-14 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <FadeIn className="max-w-5xl mx-auto">
          <p className="text-center text-white/30 text-sm mb-10">يثق بنا مئات المحامين والمكاتب القانونية في المملكة</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { to: 500, suffix: "+", label: "مكتب قانوني", icon: Building2 },
              { to: 10000, suffix: "+", label: "قضية مُدارة", icon: Briefcase },
              { to: 98, suffix: "%", label: "رضا العملاء", icon: Award },
              { to: 40, suffix: "%", label: "توفير في الوقت", icon: Clock },
            ].map(s => (
              <div key={s.label} className="space-y-1">
                <div className="text-4xl font-black" style={{ color: "#C9A84C" }}>
                  <Counter to={s.to} suffix={s.suffix} />
                </div>
                <p className="text-white/50 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }}>
              المميزات
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-4">كل ما يحتاجه مكتبك القانوني</h2>
            <p className="text-white/50 max-w-xl mx-auto">منصة متكاملة تغطي كل جوانب إدارة المكتب القانوني في مكان واحد</p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[
              { icon: Scale,        title: "إدارة القضايا",           desc: "تتبع جميع قضاياك ومواعيدها بنظرة واحدة مع فلترة متقدمة",       color: "#C9A84C" },
              { icon: Bot,          title: "مساعد ذكاء اصطناعي",      desc: "تحليل المستندات وتقييم المخاطر القانونية بالعربية",             color: "#6366F1" },
              { icon: FileText,     title: "إدارة العقود",             desc: "صياغة ومتابعة العقود مع تنبيهات تلقائية قبل انتهاء المدة",     color: "#10B981" },
              { icon: Users,        title: "إدارة العملاء CRM",        desc: "ملف متكامل لكل عميل مع تاريخ كامل وبوابة إلكترونية خاصة",     color: "#F59E0B" },
              { icon: Calendar,     title: "المواعيد والجلسات",        desc: "تقويم ذكي مع إشعارات تلقائية قبل الجلسات ومزامنة التقويم",    color: "#EC4899" },
              { icon: MessageSquare,title: "المراسلات الداخلية",       desc: "نظام رسائل داخلي آمن مع تتبع القراءة وسجل كامل",               color: "#14B8A6" },
              { icon: Receipt,      title: "الفواتير والتحصيل",        desc: "إنشاء فواتير احترافية وتتبع المدفوعات تلقائياً",               color: "#8B5CF6" },
              { icon: Database,     title: "إدارة المستندات",          desc: "مكتبة مستندات بـ OCR وبحث ذكي وربط بالقضايا",                  color: "#06B6D4" },
              { icon: Globe,        title: "بوابة العملاء",            desc: "وصول آمن للموكل لمتابعة قضيته وتحميل المستندات",               color: "#F97316" },
              { icon: Shield,       title: "صلاحيات الفريق",          desc: "نظام RBAC متكامل مع تحكم دقيق في الصلاحيات",                   color: "#EF4444" },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.04}>
                <div
                  className="p-5 rounded-2xl h-full transition-all duration-300 group cursor-default"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${f.color}18`, border: `1px solid ${f.color}30` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="font-bold text-white mb-1.5 text-sm">{f.title}</h3>
                  <p className="text-white/45 text-xs leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI SECTION ────────────────────────────────────────────────── */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, #6366F1, transparent)" }} />
        </div>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }}>
              ✦ الذكاء الاصطناعي
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-5">
              مساعد قانوني ذكي<br />
              <GoldText>يعمل معك على مدار الساعة</GoldText>
            </h2>
            <p className="text-white/55 text-lg mb-8 leading-relaxed">
              اسأله بالعربية عن أي شيء في مكتبك — من مواعيد الجلسات إلى ملخص القضايا وتحليل مخاطر العقود.
            </p>
            <div className="space-y-3">
              {[
                { icon: FileText,   title: "تحليل المستندات",       desc: "استخراج النقاط المهمة من أي عقد أو وثيقة بدقة عالية" },
                { icon: BarChart3,  title: "تقييم المخاطر",         desc: "رصد بنود خطيرة في العقود واقتراح التعديلات" },
                { icon: Zap,        title: "ملخصات القضايا",        desc: "ملخص فوري لأي قضية مع أبرز الأحداث والمواعيد" },
                { icon: TrendingUp, title: "البحث القانوني الذكي",  desc: "بحث دقيق في الأنظمة واللوائح السعودية بالعربية" },
              ].map((item, i) => (
                <FadeIn key={item.title} delay={i * 0.08} y={15}>
                  <div className="flex items-start gap-4 p-4 rounded-xl transition-all" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.2)" }}>
                      <item.icon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{item.title}</p>
                      <p className="text-white/50 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </FadeIn>

          {/* AI Chat Visual */}
          <FadeIn delay={0.2}>
            <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C060)" }}>
                  <Scale className="w-3.5 h-3.5 text-[#0D1626]" />
                </div>
                <span className="text-sm font-bold text-white">المساعد الإداري الذكي</span>
                <span className="mr-auto text-xs px-2 py-0.5 rounded-full text-green-400" style={{ background: "rgba(16,185,129,0.15)" }}>● متاح</span>
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
                  placeholder="اسأل المساعد..."
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

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <section id="how" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}>
              كيف تبدأ
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-4">تشغيل مكتبك في ٤ خطوات</h2>
            <p className="text-white/50">بدء العمل على عدالة AI لا يستغرق أكثر من دقيقتين</p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: "١", title: "أنشئ مكتبك",            desc: "سجّل حساباً وخصّص هوية مكتبك البصرية خلال دقيقتين",         color: "#C9A84C" },
              { n: "٢", title: "أضف العملاء والقضايا",  desc: "استورد بياناتك الحالية أو أضفها يدوياً بسهولة",              color: "#6366F1" },
              { n: "٣", title: "فعّل الذكاء الاصطناعي", desc: "دع المساعد الذكي يحلل مستنداتك ويجيب على استفساراتك",      color: "#10B981" },
              { n: "٤", title: "أدر مكتبك بالكامل",     desc: "كل شيء في لوحة تحكم واحدة — من أي مكان وأي جهاز",          color: "#F59E0B" },
            ].map((s, i) => (
              <FadeIn key={s.n} delay={i * 0.1}>
                <div className="relative p-6 rounded-2xl h-full" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {i < 3 && (
                    <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 text-white/15">
                      <ArrowLeft className="w-5 h-5" />
                    </div>
                  )}
                  <div className="text-4xl font-black mb-4" style={{ color: s.color }}>{s.n}</div>
                  <h3 className="font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY ──────────────────────────────────────────────────── */}
      <section id="security" className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)" }}>
              الأمان والخصوصية
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-4">أمان بمستوى المؤسسات</h2>
            <p className="text-white/50 max-w-xl mx-auto">بياناتك القانونية في أمان تام مع أعلى معايير الحماية</p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Lock,     title: "تشفير AES-256",        desc: "جميع البيانات مشفرة أثناء النقل والتخزين بأعلى معايير التشفير",       color: "#10B981" },
              { icon: Building2,title: "عزل كامل Multi-Tenant",desc: "كل مكتب معزول تماماً — لا تشارك في البيانات بين المكاتب",            color: "#6366F1" },
              { icon: Database, title: "نسخ احتياطية يومية",   desc: "نسخ احتياطية تلقائية يومية مع إمكانية استعادة البيانات في أي وقت", color: "#F59E0B" },
              { icon: Activity, title: "Audit Logs شاملة",     desc: "سجل كامل لكل عملية يتم تنفيذها داخل النظام مع توثيق المستخدم",     color: "#EC4899" },
              { icon: Shield,   title: "صلاحيات متقدمة RBAC",  desc: "تحكم دقيق في صلاحيات كل عضو من أعضاء الفريق",                      color: "#C9A84C" },
              { icon: Globe,    title: "بنية تحتية موثوقة",    desc: "استضافة على خوادم موثوقة بضمان توفر ٩٩.٩٪ وأداء عالٍ",             color: "#06B6D4" },
            ].map((s, i) => (
              <FadeIn key={s.title} delay={i * 0.07}>
                <div className="flex gap-4 p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}>
                    <s.icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm mb-1">{s.title}</h3>
                    <p className="text-white/45 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">ماذا يقول عملاؤنا</h2>
            <p className="text-white/50">آراء حقيقية من محامين ومكاتب قانونية تستخدم عدالة AI</p>
          </FadeIn>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { name: "م. خالد السعيدي", role: "محامٍ — الرياض",      stars: 5, text: "وفرت عليّ المنصة ما لا يقل عن ٦ ساعات أسبوعياً في إدارة الملفات والمراسلات. المساعد الذكي يجيب بدقة مذهلة بالعربية." },
              { name: "مكتب البارقي للمحاماة", role: "جدة",           stars: 5, text: "أفضل منصة عربية لإدارة المكاتب القانونية. الانتقال من الطريقة التقليدية إلى عدالة AI كان تحولاً كاملاً في طريقة عملنا." },
              { name: "أ. نورا الشمري",   role: "مستشارة قانونية — الدمام", stars: 5, text: "بوابة العملاء الإلكترونية رفعت من احترافية المكتب كثيراً. الموكلون سعداء جداً بإمكانية متابعة قضاياهم مباشرة." },
            ].map((t, i) => (
              <FadeIn key={t.name} delay={i * 0.1}>
                <div className="p-6 rounded-2xl h-full flex flex-col" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-[#C9A84C]" style={{ color: "#C9A84C" }} />
                    ))}
                  </div>
                  <p className="text-white/65 text-sm leading-relaxed flex-1 mb-5">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-[#0D1626]" style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)" }}>
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{t.name}</p>
                      <p className="text-white/40 text-xs">{t.role}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(201,168,76,0.12)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}>
              الأسعار
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-3 mb-4">خطط تناسب كل مكتب</h2>
            <p className="text-white/50">ابدأ مجاناً — لا بطاقة ائتمانية مطلوبة</p>
          </FadeIn>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                name: "الأساسية", price: "مجاناً", period: "دائماً",
                features: ["٣ مستخدمين", "٢٠ قضية نشطة", "إدارة العملاء", "تقويم المواعيد", "الفواتير الأساسية"],
                cta: "ابدأ مجاناً", highlight: false,
              },
              {
                name: "الاحترافية", price: "٢٩٩", period: "ريال/شهر",
                features: ["١٥ مستخدماً", "قضايا غير محدودة", "مساعد ذكاء اصطناعي", "بوابة العملاء", "إدارة العقود", "تقارير متقدمة", "دعم أولوي"],
                cta: "ابدأ التجربة", highlight: true,
              },
              {
                name: "المؤسسية", price: "تواصل معنا", period: "",
                features: ["مستخدمون غير محدودون", "White Label كامل", "API مخصص", "مدير حساب مخصص", "SLA مضمون ٩٩.٩٪", "تدريب وتهيئة كاملة"],
                cta: "تواصل معنا", highlight: false,
              },
            ].map((p, i) => (
              <FadeIn key={p.name} delay={i * 0.1}>
                <div
                  className="p-6 rounded-2xl h-full flex flex-col relative overflow-hidden"
                  style={{
                    background: p.highlight ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.03)",
                    border: p.highlight ? "2px solid rgba(201,168,76,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {p.highlight && (
                    <div className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626" }}>
                      الأكثر شيوعاً
                    </div>
                  )}
                  <p className="font-bold text-white/60 text-sm mb-3">{p.name}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-black text-white">{p.price}</span>
                    {p.period && <span className="text-white/40 text-sm mr-1">{p.period}</span>}
                  </div>
                  <ul className="space-y-2.5 flex-1 mb-6">
                    {p.features.map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                        <Check className="w-4 h-4 text-[#C9A84C] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={`${BASE}/sign-up`}>
                    <button
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                      style={p.highlight
                        ? { background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626" }
                        : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }
                      }
                    >
                      {p.cta}
                    </button>
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">الأسئلة الشائعة</h2>
            <p className="text-white/50">كل ما تريد معرفته عن عدالة AI</p>
          </FadeIn>
          <div className="space-y-3">
            {[
              { q: "هل توجد فترة تجريبية مجانية؟",           a: "نعم، الخطة الأساسية مجانية بشكل دائم حتى ٣ مستخدمين و٢٠ قضية. ولديك أيضاً ١٤ يوماً تجريبياً مجانياً على الخطة الاحترافية." },
              { q: "هل تدعم المنصة اللغة العربية بالكامل؟",  a: "نعم، المنصة مبنية من الأساس للعربية وتدعم RTL بشكل كامل. المساعد الذكي أيضاً يتعامل مع العربية بدقة عالية." },
              { q: "هل يمكن استيراد بياناتي الحالية؟",        a: "بالتأكيد. ندعم استيراد البيانات من Excel وCSV والأنظمة الشائعة. فريق الدعم يساعدك في عملية الانتقال مجاناً." },
              { q: "كيف تُحفظ بياناتي؟ هل هي آمنة؟",         a: "بياناتك محمية بتشفير AES-256 وتُخزَّن بشكل معزول تماماً عن بقية المكاتب (Multi-tenant). نسخ احتياطية يومية تلقائية." },
              { q: "هل يمكن استخدام المنصة على الجوال؟",     a: "نعم، المنصة متجاوبة بالكامل مع الجوال والأجهزة اللوحية. تطبيق iOS وAndroid قادم قريباً." },
              { q: "هل تدعمون تخصيص الهوية البصرية للمكتب؟",  a: "نعم، الخطة الاحترافية وما فوقها تتيح تخصيص الشعار والألوان وقوالب الفواتير. الخطة المؤسسية تتيح White Label كاملاً." },
            ].map(item => (
              <FadeIn key={item.q} y={10}>
                <FAQItem q={item.q} a={item.a} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
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
                ابدأ رحلتك نحو مكتب قانوني<br />
                <GoldText>أكثر ذكاءً وكفاءة</GoldText>
              </h2>
              <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
                انضم إلى مئات المكاتب القانونية التي تثق بعدالة AI. ابدأ مجاناً اليوم.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href={`${BASE}/sign-up`}>
                  <button className="flex items-center gap-2 font-bold px-9 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02] shadow-xl"
                    style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626", boxShadow: "0 8px 32px rgba(201,168,76,0.4)" }}>
                    ابدأ مجاناً الآن
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </Link>
                <div className="flex items-center gap-4">
                  {["لا بطاقة مطلوبة", "دعم عربي كامل"].map(t => (
                    <span key={t} className="flex items-center gap-1.5 text-sm text-white/50">
                      <Check className="w-3.5 h-3.5 text-green-400" />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
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
              <p className="text-white/40 text-sm leading-relaxed mb-4">المنصة القانونية الذكية الأولى في المملكة العربية السعودية</p>
              <div className="flex gap-3">
                {[Twitter, Linkedin, Youtube].map((Icon, i) => (
                  <a key={i} href="#" className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <Icon className="w-4 h-4 text-white/50 hover:text-white" />
                  </a>
                ))}
              </div>
            </div>
            {/* Links */}
            {[
              { title: "المنصة",     links: ["المميزات", "الأسعار", "حالة النظام", "خارطة الطريق"] },
              { title: "الشركة",     links: ["عن عدالة AI", "المدونة", "الشراكات", "تواصل معنا"] },
              { title: "الدعم",      links: ["مركز المساعدة", "سياسة الخصوصية", "الشروط والأحكام", "الأمان"] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="font-bold text-white text-sm mb-4">{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(l => (
                    <li key={l}><a href="#" className="text-white/45 text-sm hover:text-white transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/30 text-sm">© ٢٠٢٦ عدالة AI — جميع الحقوق محفوظة</p>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2.5 py-1 rounded-full text-green-400" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                ● جميع الأنظمة تعمل بشكل طبيعي
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp floating button ───────────────────────────────────── */}
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
