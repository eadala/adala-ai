import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Scale, Shield, Bot, FileText, Users, ArrowLeft, CheckCircle, Star,
  ChevronDown, ChevronUp, Play, Zap, Clock, BarChart3, MessageSquare,
  Calendar, Receipt, Briefcase, Globe, Lock, Database, Activity,
  Building2, CreditCard, Phone, Mail, Twitter, Linkedin, Youtube,
  Menu, X, ArrowRight, Sparkles, TrendingUp, Award, Check,
  Brain, Layers, HardDrive, Palette, DollarSign,
} from "lucide-react";

// ── Lazy load heavy below-fold components ─────────────────────────────────────
const PlatformShowcase = lazy(() => import("@/components/platform-showcase"));
const PaymentShowcase  = lazy(() => import("@/components/payment-showcase"));

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── CSS-based fade-in hook (replaces framer-motion) ───────────────────────────
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}s`;
          el.classList.add("lp-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "-60px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);
  return ref;
}

// ── FadeIn wrapper (no framer-motion) ─────────────────────────────────────────
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useFadeIn(delay);
  return (
    <div ref={ref} className={`lp-fade ${className}`}>
      {children}
    </div>
  );
}

// ── Gradient text ──────────────────────────────────────────────────────────────
const GoldText = ({ children }: { children: React.ReactNode }) => (
  <span style={{ background: "linear-gradient(135deg, #C9A84C, #F0D060)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
    {children}
  </span>
);

// ── Animated counter ───────────────────────────────────────────────────────────
function Counter({ to, suffix = "", duration = 2, locale = "ar-SA" }: { to: number; suffix?: string; duration?: number; locale?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          let start = 0;
          const step = to / (duration * 60);
          const timer = setInterval(() => {
            start += step;
            if (start >= to) { setCount(to); clearInterval(timer); }
            else setCount(Math.floor(start));
          }, 1000 / 60);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{count.toLocaleString(locale)}{suffix}</span>;
}

// ── FAQ Item (CSS accordion, no framer-motion) ────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border rounded-xl overflow-hidden cursor-pointer"
      style={{ borderColor: open ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.08)", background: open ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.02)", transition: "border-color 0.2s, background 0.2s" }}
      onClick={() => setOpen(p => !p)}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold text-white text-sm md:text-base">{q}</span>
        {open ? <ChevronUp className="w-5 h-5 text-[#C9A84C] shrink-0" /> : <ChevronDown className="w-5 h-5 text-white/40 shrink-0" />}
      </div>
      <div
        style={{
          maxHeight: open ? "400px" : "0",
          overflow: "hidden",
          transition: "max-height 0.28s ease",
        }}
      >
        <p className="px-6 pb-4 text-white/60 text-sm leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

// ── Dashboard mock ─────────────────────────────────────────────────────────────
function DashboardMock() {
  const { t } = useTranslation();
  const TABS = [
    t("landing.dashboard.tab0"), t("landing.dashboard.tab1"),
    t("landing.dashboard.tab2"), t("landing.dashboard.tab3"),
    t("landing.dashboard.tab4"),
  ];
  const [active, setActive] = useState(0);
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.12)", background: "#0D1626" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#070E1C", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-3 h-3 rounded-full bg-red-500/70" />
        <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
        <div className="w-3 h-3 rounded-full bg-green-400/70" />
        <div className="flex-1 mx-4 px-3 py-1 rounded text-xs text-white/30 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>app.adalah-ai.sa</div>
      </div>
      <div className="flex gap-1 px-4 pt-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActive(i)} className="px-3 py-2 text-xs font-medium rounded-t transition-all"
            style={{ color: active === i ? "#C9A84C" : "rgba(255,255,255,0.4)", borderBottom: active === i ? "2px solid #C9A84C" : "2px solid transparent" }}>
            {tab}
          </button>
        ))}
      </div>
      <div className="p-4 h-64 md:h-72">
        {active === 0 && (
          <div className="grid grid-cols-2 gap-3 h-full">
            {[
              [t("landing.dashboard.openCases"),       "٤٧",  "#6366F1"],
              [t("landing.dashboard.upcomingSessions"), "١٢",  "#C9A84C"],
              [t("landing.dashboard.activeClients"),    "١٨٣", "#10B981"],
              [t("landing.dashboard.pendingInvoices"),  "٨",   "#F59E0B"],
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
              ["قضية العقار - شركة الأمل",   "مفتوحة",     "#10B981"],
              ["نزاع تجاري - حمدان المطيري",  "قيد التنفيذ", "#F59E0B"],
              ["قضية عمالية - مصنع الخليج",  "جلسة قريبة", "#6366F1"],
              ["عقد استشارة - شركة تقنية",   "مغلقة",      "#EF4444"],
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
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-bold" style={{ background: ["#6366F1","#C9A84C","#10B981","#F59E0B"][i] }}>{n[0]}</div>
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

// ── Showcase placeholder ───────────────────────────────────────────────────────
function ShowcasePlaceholder() {
  return <div className="py-24 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-[#C9A84C]/40 border-t-[#C9A84C] animate-spin" /></div>;
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Landing() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { data: cms } = useQuery({
    queryKey: ["home-cms"],
    queryFn: () => fetch(`${BASE}/api/home/content`).then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  function c(section: string, key: string, fallback: string): string {
    return (cms?.[section]?.[key] as string | undefined) || fallback;
  }

  useEffect(() => {
    if (!cms?.seo) return;
    const { metaTitle, metaDescription, ogImage } = cms.seo as any;
    if (metaTitle) document.title = metaTitle;
    let desc = document.querySelector("meta[name='description']");
    if (!desc) { desc = document.createElement("meta"); (desc as HTMLMetaElement).name = "description"; document.head.appendChild(desc); }
    if (metaDescription) (desc as HTMLMetaElement).content = metaDescription;
    let og = document.querySelector("meta[property='og:image']");
    if (!og) { og = document.createElement("meta"); (og as HTMLMetaElement).setAttribute("property", "og:image"); document.head.appendChild(og); }
    if (ogImage) (og as HTMLMetaElement).content = ogImage;
  }, [cms]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const NAV = [
    { label: t("landing.nav.showcase"),   href: "#showcase" },
    { label: t("landing.nav.features"), href: "#features" },
    { label: t("landing.nav.how"),      href: "#how" },
    { label: t("landing.nav.security"), href: "#security" },
    { label: t("landing.nav.pricing"),  href: "/pricing" },
    { label: t("landing.nav.faq"),      href: "#faq" },
  ];

  const FEATURE_ICONS  = [Scale, Bot, FileText, Users, Calendar, Receipt, Database, Globe, Shield, Activity, BarChart3, Briefcase, Clock, Building2, Mail, CreditCard, Sparkles, Brain, DollarSign, Award, Layers, HardDrive, Palette, MessageSquare];
  const FEATURE_COLORS = ["#C9A84C","#6366F1","#10B981","#F59E0B","#EC4899","#8B5CF6","#06B6D4","#F97316","#EF4444","#3B82F6","#22C55E","#14B8A6","#A855F7","#F43F5E","#60A5FA","#D946EF","#A78BFA","#8B5CF6","#34D399","#FBBF24","#6366F1","#3B82F6","#F472B6","#10B981"];
  const AI_ICONS       = [FileText, BarChart3, Zap, TrendingUp];
  const STEP_COLORS    = ["#C9A84C","#6366F1","#10B981","#F59E0B"];
  const SEC_ICONS      = [Lock, Building2, Database, Activity, Shield, Globe];
  const SEC_COLORS     = ["#10B981","#6366F1","#F59E0B","#EC4899","#C9A84C","#06B6D4"];

  const featureItems   = (t("landing.features.items",   { returnObjects: true }) as { title: string; desc: string }[]);
  const aiItems        = (t("landing.ai.items",          { returnObjects: true }) as { title: string; desc: string }[]);
  const steps          = (t("landing.how.steps",         { returnObjects: true }) as { n: string; title: string; desc: string }[]);
  const secItems       = (t("landing.security.items",    { returnObjects: true }) as { title: string; desc: string }[]);
  const testimonials   = (t("landing.testimonials.items",{ returnObjects: true }) as { name: string; role: string; text: string }[]);
  const pricingPlans   = (t("landing.pricing.plans",     { returnObjects: true }) as { name: string; price: string; period: string; cta: string; features: string[] }[]);
  const faqItems       = (t("landing.faq.items",         { returnObjects: true }) as { q: string; a: string }[]);
  const privacyItems   = (t("landing.privacy.items",     { returnObjects: true }) as { icon: string; label: string; desc: string }[]);

  const cmsFooter = (cms as any)?.footer as any;
  const _plI18n = (t("landing.footer.platformLinks", { returnObjects: true }) as string[]);
  const _coI18n = (t("landing.footer.companyLinks",  { returnObjects: true }) as string[]);
  const _suI18n = (t("landing.footer.supportLinks",  { returnObjects: true }) as string[]);
  const _suHref = ["#", "/privacy", "/terms", "/security"];
  type FooterLink = { label: string; href: string };
  const platformLinks: FooterLink[] = (cmsFooter?.platformLinks?.some((l: any) => l.label))
    ? (cmsFooter.platformLinks as any[]).filter((l: any) => l.label).map((l: any) => ({ label: l.label, href: l.href || "#" }))
    : _plI18n.map((label) => ({ label, href: "#" }));
  const companyLinks: FooterLink[] = (cmsFooter?.companyLinks?.some((l: any) => l.label))
    ? (cmsFooter.companyLinks as any[]).filter((l: any) => l.label).map((l: any) => ({ label: l.label, href: l.href || "#" }))
    : _coI18n.map((label) => ({ label, href: "#" }));
  const supportLinks: FooterLink[] = (cmsFooter?.supportLinks?.some((l: any) => l.label))
    ? (cmsFooter.supportLinks as any[]).filter((l: any) => l.label).map((l: any) => ({ label: l.label, href: l.href || "#" }))
    : _suI18n.map((label, i) => ({ label, href: _suHref[i] || "#" }));

  const counterLocale = isAr ? "ar-SA" : "en-US";
  const textAlign = isAr ? "text-right" : "text-left";

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen overflow-x-hidden lp-root" style={{ background: "var(--lp-bg, #080F1E)", fontFamily: "Cairo, sans-serif" }}>

      {/* CSS for animations — injected once */}
      <style>{`
        .lp-fade { opacity: 0; transform: translateY(24px); transition: opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1); }
        .lp-visible { opacity: 1 !important; transform: translateY(0) !important; }
        @keyframes lp-hero-in { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:none; } }
        .lp-hero-0 { animation: lp-hero-in 0.55s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
        .lp-hero-1 { animation: lp-hero-in 0.6s  cubic-bezier(0.22,1,0.36,1) 0.15s both; }
        .lp-hero-2 { animation: lp-hero-in 0.6s  cubic-bezier(0.22,1,0.36,1) 0.25s both; }
        .lp-hero-3 { animation: lp-hero-in 0.6s  cubic-bezier(0.22,1,0.36,1) 0.35s both; }
        .lp-hero-4 { animation: lp-hero-in 0.6s  cubic-bezier(0.22,1,0.36,1) 0.45s both; }
        .lp-hero-mock { animation: lp-hero-in 0.75s cubic-bezier(0.22,1,0.36,1) 0.3s both; }
        .lp-mobile-menu { overflow:hidden; transition: max-height 0.3s ease, opacity 0.3s ease; }
      `}</style>

      {/* ── Announcement Bar ─────────────────────────────────────────────── */}
      {cms?.announcement?.enabled && cms.announcement.text && (
        <div className="w-full py-2 px-4 text-center text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: cms.announcement.bgColor || "#C9A84C", color: cms.announcement.textColor || "#0D1626" }}>
          <span>{cms.announcement.text}</span>
          {cms.announcement.link && <a href={cms.announcement.link} className="underline underline-offset-2 opacity-80 hover:opacity-100">←</a>}
        </div>
      )}

      {/* ── Sticky Navbar ────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 right-0 left-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "var(--lp-navbar-bg, rgba(8,15,30,0.95))" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? `1px solid var(--lp-navbar-border, rgba(255,255,255,0.07))` : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, var(--lp-accent, #C9A84C), var(--lp-accent-end, #E0C060))" }}>
              <Scale className="w-4 h-4" style={{ color: "var(--lp-accent-text, #0D1626)" }} />
            </div>
            <span className="text-lg font-black text-white lp-t">{isAr ? "عدالة AI" : "ADALAH AI"}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            {NAV.map(n => (
              <a key={n.href} href={n.href} className="text-sm text-white/60 hover:text-white transition-colors lp-nav-link">{n.label}</a>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Link href={`${BASE}/sign-in`}>
              <button className="text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5 lp-tm">{t("landing.signIn")}</button>
            </Link>
            <Link href={`${BASE}/sign-up`}>
              <button className="text-sm font-bold px-4 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95" style={{ background: "linear-gradient(135deg, var(--lp-accent, #C9A84C), var(--lp-accent-end, #E0C060))", color: "var(--lp-accent-text, #0D1626)" }}>
                {t("landing.startFree")}
              </button>
            </Link>
          </div>
          <div className="md:hidden flex items-center gap-2">
            <LanguageSwitcher />
            <button className="text-white/70 hover:text-white p-2" onClick={() => setNavOpen(p => !p)}>
              {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {/* Mobile menu — CSS transition, no framer-motion */}
        <div
          className="md:hidden lp-mobile-menu"
          style={{
            maxHeight: navOpen ? "400px" : "0",
            opacity: navOpen ? 1 : 0,
            background: "rgba(8,15,30,0.98)",
            borderTop: navOpen ? "1px solid rgba(255,255,255,0.07)" : "none",
          }}
        >
          <div className="px-4 py-4 space-y-3">
            {NAV.map(n => (
              <a key={n.href} href={n.href} className="block text-white/70 hover:text-white py-2" onClick={() => setNavOpen(false)}>{n.label}</a>
            ))}
            <div className="flex flex-col gap-2 mt-2">
              <Link href={`${BASE}/sign-in`} onClick={() => setNavOpen(false)}>
                <button className="w-full text-sm font-semibold py-3 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition-colors">
                  {t("landing.signIn")}
                </button>
              </Link>
              <Link href={`${BASE}/sign-up`} onClick={() => setNavOpen(false)}>
                <button className="w-full font-bold py-3 rounded-xl" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C060)", color: "#0D1626" }}>
                  {t("landing.startFree")}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20" style={{ background: "var(--lp-accent, #C9A84C)" }} />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full blur-[100px] opacity-15" style={{ background: "#6366F1" }} />
        </div>

        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-12 items-center">
          <div className={textAlign}>
            <div className="lp-hero-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6"
              style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", color: "var(--lp-accent, #C9A84C)" }}>
              <Sparkles className="w-3.5 h-3.5" />
              {c("hero", "badge", t("landing.hero.badge"))}
            </div>

            <h1 className="lp-hero-1 text-4xl sm:text-5xl lg:text-6xl font-black text-white lp-t leading-tight mb-6">
              {c("hero", "titleLine1", t("landing.hero.titleLine1"))}<br />
              {c("hero", "titleLine2", t("landing.hero.titleLine2"))}<br />
              <GoldText>{c("hero", "titleHighlight", t("landing.hero.titleHighlight"))}</GoldText>
            </h1>

            <p className="lp-hero-2 text-lg text-white/60 lp-tm mb-8 leading-relaxed max-w-lg">
              {c("hero", "subtitle", t("landing.hero.subtitle"))}
            </p>

            <div className="lp-hero-3 flex flex-wrap gap-3 mb-8">
              <Link href={`${BASE}/sign-up`}>
                <button className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 shadow-lg"
                  style={{ background: "linear-gradient(135deg, var(--lp-accent, #C9A84C), var(--lp-accent-end, #E0C060))", color: "var(--lp-accent-text, #0D1626)", boxShadow: "0 8px 32px rgba(201,168,76,0.35)" }}>
                  {t("landing.startFree")}
                  {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </Link>
              <Link href={`${BASE}/demo`}>
                <button className="flex items-center gap-2 font-semibold px-7 py-3.5 rounded-xl text-base border transition-all hover:bg-white/5 hover:scale-[1.02]"
                  style={{ borderColor: "rgba(201,168,76,0.4)", color: "var(--lp-accent, #E0C060)", background: "rgba(201,168,76,0.06)" }}>
                  <Sparkles className="w-4 h-4" />
                  {t("landing.hero.explore")}
                </button>
              </Link>
            </div>

            <div className="lp-hero-4 flex items-center gap-4 flex-wrap">
              {[t("landing.hero.noCard"), t("landing.hero.quickSetup"), t("landing.hero.arabicSupport"), t("landing.hero.interactive")].map(label => (
                <span key={label} className="flex items-center gap-1.5 text-sm text-white/50">
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="lp-hero-mock">
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ──────────────────────────────────────────────────── */}
      <section className="py-14 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <FadeIn className="max-w-5xl mx-auto">
          <p className="text-center text-white/30 lp-ts text-sm mb-10">{c("trust", "tagline", t("landing.trust.tagline"))}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { to: Number(c("stats","offices","1000").replace(/[^0-9]/g,"")||"1000"),   suffix: "+",   labelKey: "landing.trust.offices",      icon: Building2 },
              { to: Number(c("stats","cases","100000").replace(/[^0-9]/g,"")||"100000"), suffix: "+",   labelKey: "landing.trust.cases",        icon: Briefcase },
              { to: Number(c("stats","satisfaction","99").replace(/[^0-9.]/g,"")||"99"), suffix: ".9%", labelKey: "landing.trust.satisfaction", icon: Award },
              { to: Number(c("stats","timeSaving","40").replace(/[^0-9]/g,"")||"40"),    suffix: "%",   labelKey: "landing.trust.timeSaving",   icon: Clock },
            ].map(s => (
              <div key={s.labelKey} className="space-y-1">
                <div className="text-4xl font-black" style={{ color: "var(--lp-accent, #C9A84C)" }}>
                  <Counter to={s.to} suffix={s.suffix} locale={counterLocale} />
                </div>
                <p className="text-white/50 lp-stat-label text-sm">{t(s.labelKey)}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── PLATFORM SHOWCASE (lazy) ──────────────────────────────────────── */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PlatformShowcase />
      </Suspense>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block" style={{ background: "rgba(99,102,241,0.15)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.3)" }}>
              {t("landing.features.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white lp-t mt-3 mb-4">{c("features","title",t("landing.features.title"))}</h2>
            <p className="text-white/50 lp-tm max-w-xl mx-auto">{c("features","subtitle",t("landing.features.subtitle"))}</p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {featureItems.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              const color = FEATURE_COLORS[i];
              return (
                <FadeIn key={i} delay={Math.min(i * 0.04, 0.4)}>
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

      {/* ── AI SECTION ───────────────────────────────────────────────────── */}
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
            <p className="text-white/55 text-lg mb-8 leading-relaxed">{t("landing.ai.subtitle")}</p>
            <div className="space-y-3">
              {aiItems.map((item, i) => {
                const Icon = AI_ICONS[i];
                return (
                  <FadeIn key={i} delay={i * 0.08}>
                    <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)" }}>
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

          <FadeIn delay={0.15}>
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
                  <div className="max-w-[82%] px-4 py-3 rounded-xl text-xs leading-relaxed whitespace-pre-line"
                    style={{
                      background: m.role === "user" ? "rgba(255,255,255,0.06)" : "rgba(201,168,76,0.12)",
                      color: m.role === "user" ? "rgba(255,255,255,0.75)" : "#F0D060",
                      border: m.role === "user" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(201,168,76,0.25)",
                    }}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input type="text" placeholder={t("landing.ai.askPlaceholder")} readOnly
                  className="flex-1 text-xs px-3 py-2.5 rounded-xl outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }} />
                <button className="px-3 py-2.5 rounded-xl" style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)" }}>
                  <ArrowRight className="w-4 h-4 text-[#0D1626]" />
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── PAYMENT SHOWCASE (lazy) ───────────────────────────────────────── */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PaymentShowcase />
      </Suspense>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
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

      {/* ── SECURITY ─────────────────────────────────────────────────────── */}
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

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
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

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
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
                  <div className="p-6 rounded-2xl h-full flex flex-col relative overflow-hidden"
                    style={{
                      background: isOpen ? "linear-gradient(135deg, rgba(201,168,76,0.12), rgba(99,102,241,0.08))" : highlight ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.03)",
                      border: isOpen ? "2px solid rgba(201,168,76,0.6)" : highlight ? "2px solid rgba(201,168,76,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    }}>
                    {highlight && !isOpen && (
                      <div className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626" }}>
                        {t("landing.pricing.mostPopular")}
                      </div>
                    )}
                    {isOpen && (
                      <div className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full" style={{ background: "linear-gradient(135deg,#C9A84C,#6366F1)", color: "#fff" }}>
                        {t("landing.pricing.allServices")}
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
                      <button className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                        style={isOpen
                          ? { background: "linear-gradient(135deg,#C9A84C,#6366F1)", color: "#fff" }
                          : highlight
                          ? { background: "linear-gradient(135deg,#C9A84C,#E0C060)", color: "#0D1626" }
                          : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.12)" }
                        }>
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

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4">
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">{t("landing.faq.title")}</h2>
            <p className="text-white/50">{t("landing.faq.subtitle")}</p>
          </FadeIn>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <FadeIn key={i}>
                <FAQItem q={item.q} a={item.a} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <FadeIn>
          <div className="max-w-4xl mx-auto rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.12), rgba(99,102,241,0.12))", border: "1px solid rgba(201,168,76,0.25)" }}>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-25" style={{ background: "#C9A84C" }} />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-[60px] opacity-20" style={{ background: "#6366F1" }} />
            </div>
            <div className="relative">
              <Sparkles className="w-10 h-10 mx-auto mb-5" style={{ color: "#C9A84C" }} />
              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                {c("cta_section","title",t("landing.cta.title"))}<br />
                <GoldText>{c("cta_section","titleHighlight",t("landing.cta.titleHighlight"))}</GoldText>
              </h2>
              <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
                {c("cta_section","subtitle",t("landing.cta.subtitle"))}
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

      {/* ── PRIVACY TRUST ────────────────────────────────────────────────── */}
      <section className="py-16 px-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-5"
            style={{ background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}>
            {t("landing.privacy.badge")}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-4">{t("landing.privacy.title")}</h2>
          <p className="text-white/50 text-base leading-relaxed mb-8 max-w-2xl mx-auto">{t("landing.privacy.subtitle")}</p>
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

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="max-w-7xl mx-auto px-4 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#C9A84C,#E0C060)" }}>
                  <Scale className="w-4 h-4 text-[#0D1626]" />
                </div>
                <span className="text-lg font-black text-white">{isAr ? "عدالة AI" : "ADALAH AI"}</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed mb-4">{cmsFooter?.tagline || t("landing.footer.tagline")}</p>
              <div className="flex gap-3">
                {([
                  { Icon: Twitter,  href: cms?.contact?.twitter  as string },
                  { Icon: Linkedin, href: cms?.contact?.linkedin as string },
                  { Icon: Youtube,  href: cms?.contact?.youtube  as string },
                ] as { Icon: (p: { className?: string }) => JSX.Element; href: string }[]).map(({ Icon, href }, i) => (
                  <a key={i} href={href || "#"} target={href ? "_blank" : undefined} rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
                    style={{ background: "rgba(255,255,255,0.06)" }}>
                    <Icon className="w-4 h-4 text-white/50 hover:text-white" />
                  </a>
                ))}
              </div>
            </div>
            {(!cmsFooter || cmsFooter.showPlatformCol !== false) && (
              <div>
                <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.platform")}</h4>
                <ul className="space-y-2.5">
                  {platformLinks.map((l, i) => (
                    <li key={i}><a href={l.href} className="text-white/45 text-sm hover:text-white transition-colors">{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
            {(!cmsFooter || cmsFooter.showCompanyCol !== false) && (
              <div>
                <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.company")}</h4>
                <ul className="space-y-2.5">
                  {companyLinks.map((l, i) => (
                    <li key={i}><a href={l.href} className="text-white/45 text-sm hover:text-white transition-colors">{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
            {(!cmsFooter || cmsFooter.showSupportCol !== false) && (
              <div>
                <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.support")}</h4>
                <ul className="space-y-2.5">
                  {supportLinks.map((l, i) => (
                    <li key={i}><a href={l.href} className="text-white/45 text-sm hover:text-white transition-colors">{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 gap-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-white/30 text-sm">{cmsFooter?.copyright || t("landing.footer.copyright")}</p>
            {(!cmsFooter || cmsFooter.showStatus !== false) && (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full text-green-400" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  {cmsFooter?.statusText || t("landing.footer.allSystemsNormal")}
                </span>
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* ── WhatsApp floating ────────────────────────────────────────────── */}
      {cms?.contact?.showWhatsappButton !== false && cms?.contact?.whatsapp && (
        <a href={`https://wa.me/${(cms.contact.whatsapp as string).replace(/[^0-9]/g, "")}`}
          target="_blank" rel="noopener noreferrer"
          className="fixed bottom-6 left-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 z-40"
          style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.4)" }}
          title="تواصل عبر واتساب">
          <Phone className="w-6 h-6 text-white" />
        </a>
      )}
    </div>
  );
}
