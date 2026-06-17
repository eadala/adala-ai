import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import AdoulWidget from "@/components/adoul-widget";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LandingBento }   from "@/pages/landing-bento";
import { LandingStripe }  from "@/pages/landing-stripe";
import { LandingHubspot } from "@/pages/landing-hubspot";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Scale, Shield, Bot, FileText, Users, ArrowLeft, CheckCircle, Star,
  ChevronDown, ChevronUp, Play, Zap, Clock, BarChart3, MessageSquare,
  Calendar, Receipt, Briefcase, Globe, Lock, Database, Activity,
  Building2, CreditCard, Phone, Mail, Twitter, Linkedin, Youtube,
  Menu, X, ArrowRight, Sparkles, TrendingUp, Award, Check,
  Brain, Layers, HardDrive, Palette, DollarSign, Gift,
  ThumbsUp, PenLine, Smartphone, UserCheck, Archive, ClipboardCheck, BellRing,
} from "lucide-react";

const PlatformShowcase = lazy(() => import("@/components/platform-showcase"));
const PaymentShowcase  = lazy(() => import("@/components/payment-showcase"));

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── Design System Tokens (SaaS-Grade) ─────────────────────────── */
const PRIMARY  = "#0B1F3B";   // dark navy — main brand
const ACCENT   = "#2563EB";   // blue accent
const ACCENT_D = "#1D4ED8";   // darker blue for hovers
const ACCENT_L = "#EFF6FF";   // light blue bg
const ACCENT_M = "#DBEAFE";   // medium blue bg
const ACCENT_T = "#93C5FD";   // blue tint border
const WHITE    = "#FFFFFF";
const BG       = "#F8FAFC";
const BG2      = "#F1F5F9";
const DARK     = "#0B1F3B";
const BODY     = "#374151";
const MUTED    = "#6B7280";
const BORDER   = "#E5E7EB";
const BORDER2  = "#D1D5DB";
const SUCCESS  = "#16A34A";
const WARN     = "#F59E0B";

/* ── Fade-in animation hook ─────────────────────────────────────── */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const t = setTimeout(() => { el.style.transitionDelay = `${delay}s`; el.classList.add("lp-visible"); }, 80);
    return () => clearTimeout(t);
  }, [delay]);
  return ref;
}

function FadeIn({ children, delay = 0, className = "", style }: { children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useFadeIn(delay);
  return <div ref={ref} className={`lp-fade ${className}`} style={style}>{children}</div>;
}

/* ── Animated counter ───────────────────────────────────────────── */
function Counter({ to, suffix = "", duration = 2, locale = "ar-SA" }: { to: number; suffix?: string; duration?: number; locale?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let start = 0; const step = to / (duration * 60);
        const timer = setInterval(() => {
          start += step;
          if (start >= to) { setCount(to); clearInterval(timer); }
          else setCount(Math.floor(start));
        }, 1000 / 60);
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{count.toLocaleString(locale)}{suffix}</span>;
}

/* ── Dashboard mock preview ─────────────────────────────────────── */
function DashboardMock() {
  const { t } = useTranslation();
  const TABS = [
    t("landing.dashboard.tab0"), t("landing.dashboard.tab1"),
    t("landing.dashboard.tab2"), t("landing.dashboard.tab3"),
    t("landing.dashboard.tab4"),
  ];
  const [active, setActive] = useState(0);
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${BORDER}`, background: WHITE, boxShadow: "0 20px 60px rgba(11,31,59,0.12), 0 4px 12px rgba(0,0,0,0.06)" }}>
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: BG2, borderBottom: `1px solid ${BORDER}` }}>
        <div className="w-3 h-3 rounded-full" style={{ background: "#FC8181" }} />
        <div className="w-3 h-3 rounded-full" style={{ background: WARN }} />
        <div className="w-3 h-3 rounded-full" style={{ background: SUCCESS }} />
        <div className="flex-1 mx-4 px-3 py-1 rounded-lg text-xs text-center"
          style={{ background: WHITE, color: MUTED, border: `1px solid ${BORDER}` }}>
          app.adalah-ai.sa
        </div>
      </div>
      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 overflow-x-auto" style={{ borderBottom: `1px solid ${BORDER}`, scrollbarWidth: "none" }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActive(i)}
            className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-t transition-all"
            style={{
              color: active === i ? ACCENT : MUTED,
              borderBottom: active === i ? `2px solid ${ACCENT}` : "2px solid transparent",
            }}>
            {tab}
          </button>
        ))}
      </div>
      {/* Content */}
      <div className="p-4 h-64 md:h-72" style={{ background: BG }}>
        {active === 0 && (
          <div className="grid grid-cols-2 gap-3 h-full">
            {[
              [t("landing.dashboard.openCases"),       "٤٧",  "#4F46E5"],
              [t("landing.dashboard.upcomingSessions"), "١٢",  ACCENT],
              [t("landing.dashboard.activeClients"),    "١٨٣", SUCCESS],
              [t("landing.dashboard.pendingInvoices"),  "٨",   WARN],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-xl p-3 flex flex-col justify-between"
                style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <p className="text-xs" style={{ color: MUTED }}>{l as string}</p>
                <p className="text-2xl font-black" style={{ color: c as string }}>{v as string}</p>
              </div>
            ))}
          </div>
        )}
        {active === 1 && (
          <div className="space-y-2">
            {[
              ["قضية العقار - شركة الأمل",  "مفتوحة",     SUCCESS],
              ["نزاع تجاري - حمدان المطيري", "قيد التنفيذ", WARN],
              ["قضية عمالية - مصنع الخليج", "جلسة قريبة", "#4F46E5"],
              ["عقد استشارة - شركة تقنية",  "مغلقة",      "#EF4444"],
            ].map(([n, s, c]) => (
              <div key={n as string} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
                <span className="text-xs" style={{ color: BODY }}>{n as string}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${c as string}15`, color: c as string }}>{s as string}</span>
              </div>
            ))}
          </div>
        )}
        {(active === 2 || active === 3 || active === 4) && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: ACCENT_M }}>
                <BarChart3 className="w-6 h-6" style={{ color: ACCENT }} />
              </div>
              <p className="text-sm font-medium" style={{ color: DARK }}>{TABS[active]}</p>
              <p className="text-xs mt-1" style={{ color: MUTED }}>بيانات حية ومحدّثة</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Showcase placeholder ───────────────────────────────────────── */
function ShowcasePlaceholder() {
  return (
    <div className="py-12 flex items-center justify-center" style={{ background: BG2 }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT}40`, borderTopColor: "transparent" }} />
    </div>
  );
}

/* ── FAQ accordion item ─────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        borderColor: open ? `${ACCENT}50` : BORDER,
        background: open ? ACCENT_L : WHITE,
        boxShadow: open ? `0 2px 12px rgba(37,99,235,0.08)` : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onClick={() => setOpen(p => !p)}>
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold text-sm md:text-base" style={{ color: open ? ACCENT : DARK }}>{q}</span>
        {open ? <ChevronUp className="w-5 h-5 shrink-0" style={{ color: ACCENT }} />
               : <ChevronDown className="w-5 h-5 shrink-0" style={{ color: MUTED }} />}
      </div>
      <div style={{ maxHeight: open ? "400px" : "0", overflow: "hidden", transition: "max-height 0.28s ease" }}>
        <p className="px-6 pb-5 text-sm leading-relaxed" style={{ color: BODY, lineHeight: "1.75" }}>{a}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN LANDING COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function Landing() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);

  /* Variant selector */
  const urlVariant = new URLSearchParams(window.location.search).get("preview");
  const { data: variantData } = useQuery<{ variant: string }>({
    queryKey: ["landing-variant-public"],
    queryFn: () => fetch(`${BASE}/api/landing-variant`).then(r => r.json()).catch(() => ({ variant: "original" })),
    staleTime: 1000 * 60,
    enabled: !urlVariant,
  });
  const activeVariant = urlVariant ?? variantData?.variant ?? "original";
  if (activeVariant === "bento")   return <LandingBento />;
  if (activeVariant === "stripe")  return <LandingStripe />;
  if (activeVariant === "hubspot") return <LandingHubspot />;

  /* CMS */
  const { data: cms } = useQuery({
    queryKey: ["home-cms"],
    queryFn: () => fetch(`${BASE}/api/home/content`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    staleTime: 5 * 60 * 1000, retry: false,
  });
  function c(section: string, key: string, fallback: string): string {
    return (cms?.[section]?.[key] as string | undefined) || fallback;
  }

  /* SEO from CMS */
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

  /* Scroll state for sticky nav shadow */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  /* Trigger fade-in on all elements once mounted */
  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".lp-fade,.lp-hero-0,.lp-hero-1,.lp-hero-2,.lp-hero-3,.lp-hero-4,.lp-hero-mock").forEach(el => {
        el.style.opacity = "1"; el.style.transform = "none"; el.classList.add("lp-visible");
      });
    }, 100);
    return () => clearTimeout(t);
  }, []);

  /* i18n data */
  const featureItems = (t("landing.features.items", { returnObjects: true }) as { title: string; desc: string }[]);
  const pricingPlans = (t("landing.pricing.plans",  { returnObjects: true }) as { name: string; price: string; period: string; cta: string; features: string[] }[]);
  const faqItems     = (t("landing.faq.items",      { returnObjects: true }) as { q: string; a: string }[]);
  const counterLocale = isAr ? "ar-SA" : "en-US";

  /* Footer links */
  const cmsFooter = (cms as any)?.footer as any;
  const _plI18n = (t("landing.footer.platformLinks", { returnObjects: true }) as string[]);
  const _coI18n = (t("landing.footer.companyLinks",  { returnObjects: true }) as string[]);
  const _suI18n = (t("landing.footer.supportLinks",  { returnObjects: true }) as string[]);
  const _suHref = ["#", "/privacy", "/terms", "/security"];
  type FooterLink = { label: string; href: string };
  const platformLinks: FooterLink[] = (cmsFooter?.platformLinks?.some((l: any) => l.label))
    ? (cmsFooter.platformLinks as any[]).filter((l: any) => l.label).map((l: any) => ({ label: l.label, href: l.href || "#" }))
    : _plI18n.map(label => ({ label, href: "#" }));
  const companyLinks: FooterLink[] = (cmsFooter?.companyLinks?.some((l: any) => l.label))
    ? (cmsFooter.companyLinks as any[]).filter((l: any) => l.label).map((l: any) => ({ label: l.label, href: l.href || "#" }))
    : _coI18n.map(label => ({ label, href: "#" }));
  const supportLinks: FooterLink[] = (cmsFooter?.supportLinks?.some((l: any) => l.label))
    ? (cmsFooter.supportLinks as any[]).filter((l: any) => l.label).map((l: any) => ({ label: l.label, href: l.href || "#" }))
    : _suI18n.map((label, i) => ({ label, href: _suHref[i] || "#" }));

  /* ── 6 core features ─────────────────────────────────────────── */
  const SIX_FEATURES = [
    { icon: Scale,      color: ACCENT,    bg: ACCENT_M,    title: isAr ? "إدارة القضايا"       : "Case Management",    desc: isAr ? "تنظيم القضايا والجلسات والمستندات في مكان واحد" : "Organize cases, hearings, and documents in one place" },
    { icon: Users,      color: "#4F46E5", bg: "#EDE9FE",   title: isAr ? "إدارة العملاء"       : "Client Management",  desc: isAr ? "ملفات شاملة لكل عميل مع سجل تواصل كامل" : "Complete client profiles with full communication history" },
    { icon: Bot,        color: "#059669", bg: "#D1FAE5",   title: isAr ? "الذكاء الاصطناعي"   : "AI Assistant",       desc: isAr ? "مساعد قانوني ذكي يحلل ويستشير باللغة العربية" : "Smart legal AI that analyzes and consults in Arabic" },
    { icon: Receipt,    color: WARN,      bg: "#FEF3C7",   title: isAr ? "النظام المالي"       : "Financial System",   desc: isAr ? "فواتير وعقود ومتابعة المدفوعات بدقة محاسبية" : "Invoices, contracts, and payment tracking with precision" },
    { icon: Archive,    color: "#0891B2", bg: "#CFFAFE",   title: isAr ? "الأرشفة الذكية"     : "Smart Archiving",    desc: isAr ? "تصنيف تلقائي للمستندات والعقود مع بحث فوري" : "Auto-classify documents and contracts with instant search" },
    { icon: Building2,  color: "#7C3AED", bg: "#EDE9FE",   title: isAr ? "تعدد المكاتب SaaS"  : "Multi-Office SaaS",  desc: isAr ? "إدارة عدة مكاتب وفروع من لوحة تحكم واحدة" : "Manage multiple offices and branches from one dashboard" },
  ];

  /* ── Proof numbers ───────────────────────────────────────────── */
  const PROOF = [
    { to: 500,    suffix: "+",  label: isAr ? "مكتب محاماة"    : "Law firms",       color: ACCENT   },
    { to: 50000,  suffix: "+",  label: isAr ? "قضية مُدارة"    : "Cases managed",   color: "#4F46E5" },
    { to: 999,    suffix: ".9%",label: isAr ? "وقت تشغيل"      : "Uptime",          color: SUCCESS   },
    { to: 4,      suffix: " دول",label: isAr ? "دول الخليج"    : "Gulf countries",  color: WARN      },
  ];

  /* ── Nav links ───────────────────────────────────────────────── */
  const NAV = [
    { label: isAr ? "المميزات"  : "Features",  href: "#features" },
    { label: isAr ? "معاينة"    : "Preview",   href: "#preview"  },
    { label: isAr ? "الأسعار"   : "Pricing",   href: "#pricing"  },
    { label: isAr ? "الأسئلة"   : "FAQ",       href: "#faq"      },
  ];

  return (
    <div dir={isAr ? "rtl" : "ltr"} style={{ background: WHITE, color: DARK, fontFamily: isAr ? "'IBM Plex Sans Arabic', sans-serif" : "sans-serif" }}>

      {/* ══ STICKY NAVBAR ══════════════════════════════════════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? `1px solid ${BORDER}` : "none",
          boxShadow: scrolled ? "0 1px 12px rgba(11,31,59,0.06)" : "none",
        }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: ACCENT, boxShadow: `0 4px 12px rgba(37,99,235,0.35)` }}>
                <Scale className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-lg" style={{ color: DARK }}>عدالة <span style={{ color: ACCENT }}>AI</span></span>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV.map(n => (
              <a key={n.href} href={n.href}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-100"
                style={{ color: BODY }}>
                {n.label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href={`${BASE}/sign-in`}>
              <button className="hidden md:block text-sm font-semibold px-4 py-2 rounded-xl transition-colors hover:bg-slate-100"
                style={{ color: DARK }}>
                {isAr ? "دخول" : "Sign In"}
              </button>
            </Link>
            <Link href={`${BASE}/sign-up`}>
              <button className="text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
                style={{ background: ACCENT, color: WHITE, boxShadow: `0 4px 14px rgba(37,99,235,0.30)` }}>
                {isAr ? "ابدأ مجاناً" : "Start Free"}
              </button>
            </Link>
            {/* Mobile menu toggle */}
            <button className="md:hidden p-2 rounded-lg" onClick={() => setMenuOpen(p => !p)}
              style={{ color: DARK }}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden px-6 pb-4 pt-2 space-y-1 border-t" style={{ background: WHITE, borderColor: BORDER }}>
            {NAV.map(n => (
              <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-slate-50"
                style={{ color: BODY }}>
                {n.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-2">
              <Link href={`${BASE}/sign-in`}>
                <button className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                  style={{ background: ACCENT, color: WHITE, boxShadow: `0 4px 12px rgba(37,99,235,0.25)` }}
                  onClick={() => setMenuOpen(false)}>
                  {isAr ? "تسجيل الدخول" : "Sign In"}
                </button>
              </Link>
              <Link href={`${BASE}/demo-login`}>
                <button className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: ACCENT_L, color: ACCENT, border: `1px solid ${ACCENT_T}` }}
                  onClick={() => setMenuOpen(false)}>
                  {isAr ? "🎯 جرّب بيئة المحاكاة" : "🎯 Try Simulation"}
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══ HERO (Screen 1) ════════════════════════════════════════ */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${WHITE} 0%, ${ACCENT_L} 50%, ${WHITE} 100%)` }}>

        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 right-1/3 w-[500px] h-[500px] rounded-full blur-[140px]"
            style={{ background: ACCENT_M, opacity: 0.55 }} />
          <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full blur-[120px]"
            style={{ background: "#E0E7FF", opacity: 0.6 }} />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: `linear-gradient(${DARK} 1px, transparent 1px), linear-gradient(90deg, ${DARK} 1px, transparent 1px)`, backgroundSize: "64px 64px" }} />
        </div>

        <div className="relative max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: copy */}
          <div className={isAr ? "text-right" : "text-left"}>
            {/* Badge */}
            <div className="lp-hero-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
              style={{ background: ACCENT_M, border: `1px solid ${ACCENT_T}`, color: ACCENT }}>
              <Sparkles className="w-3.5 h-3.5" />
              {c("hero", "badge", t("landing.hero.badge"))}
            </div>

            {/* H1 */}
            <h1 className="lp-hero-1 text-4xl sm:text-5xl lg:text-[56px] font-black leading-[1.2] mb-6"
              style={{ color: DARK, letterSpacing: "-0.02em" }}>
              {c("hero", "titleLine1", t("landing.hero.titleLine1"))}<br />
              {c("hero", "titleLine2", t("landing.hero.titleLine2"))}<br />
              <span style={{ color: ACCENT }}>{c("hero", "titleHighlight", t("landing.hero.titleHighlight"))}</span>
            </h1>

            {/* Subtitle */}
            <p className="lp-hero-2 text-lg mb-8 leading-[1.75] max-w-lg" style={{ color: BODY }}>
              {c("hero", "subtitle", t("landing.hero.subtitle"))}
            </p>

            {/* CTA buttons — 3-path hierarchy */}
            <div className="lp-hero-3 space-y-3 mb-8">
              {/* Primary: ابدأ مكتبك الآن */}
              <div className="flex flex-wrap gap-3">
                <Link href={`${BASE}/sign-up`}>
                  <button className="flex items-center gap-2.5 font-bold px-8 py-3.5 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
                    style={{ background: ACCENT, color: WHITE, boxShadow: `0 8px 28px rgba(37,99,235,0.35)`, height: "52px" }}>
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    {isAr ? "ابدأ مكتبك الآن" : "Start Your Office Now"}
                  </button>
                </Link>
                {/* Secondary: بيئة المحاكاة */}
                <Link href={`${BASE}/demo-login`}>
                  <button className="flex items-center gap-2 font-semibold px-6 py-3.5 rounded-xl text-base border-2 transition-all hover:bg-slate-50 hover:border-slate-300"
                    style={{ borderColor: BORDER2, color: DARK, background: WHITE, height: "52px" }}>
                    <Play className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />
                    {isAr ? "جرّب بيئة المحاكاة" : "Try Simulation"}
                  </button>
                </Link>
              </div>
              {/* Tertiary: sign-in link — for existing users */}
              <p className="text-sm" style={{ color: MUTED }}>
                {isAr ? "لديك حساب؟ " : "Already have an account? "}
                <Link href={`${BASE}/sign-in`}>
                  <span className="font-semibold underline underline-offset-2 cursor-pointer transition-colors hover:opacity-70"
                    style={{ color: ACCENT }}>
                    {isAr ? "سجّل دخولك" : "Sign in"}
                  </span>
                </Link>
              </p>
            </div>

            {/* Trust signals */}
            <div className="lp-hero-4 flex items-center gap-4 flex-wrap">
              {[
                t("landing.hero.noCard"),
                t("landing.hero.quickSetup"),
                t("landing.hero.arabicSupport"),
              ].map(label => (
                <span key={label} className="flex items-center gap-1.5 text-sm" style={{ color: MUTED }}>
                  <Check className="w-3.5 h-3.5" style={{ color: SUCCESS }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Dashboard preview */}
          <div className="lp-hero-mock w-full">
            <DashboardMock />
          </div>
        </div>

        {/* Proof numbers strip */}
        <FadeIn delay={0.4} className="relative w-full max-w-5xl mx-auto mt-16 pt-10"
          style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {PROOF.map(s => (
              <div key={s.label}>
                <div className="text-3xl font-black mb-1" style={{ color: s.color }}>
                  <Counter to={s.to} suffix={s.suffix} locale={counterLocale} />
                </div>
                <p className="text-sm font-medium" style={{ color: MUTED }}>{s.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ══ PLATFORM SHOWCASE (lazy, Screen 2) ════════════════════ */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PlatformShowcase />
      </Suspense>

      {/* ══ 6 FEATURES GRID (Screen 2-3) ══════════════════════════ */}
      <section id="features" className="py-24 px-6 overflow-hidden" style={{ background: BG2 }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: ACCENT_M, color: ACCENT, border: `1px solid ${ACCENT_T}`, letterSpacing: "0.1em" }}>
              {t("landing.features.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              {t("landing.features.title")}
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: BODY }}>
              {t("landing.features.subtitle")}
            </p>
          </FadeIn>

          {/* Exactly 6 features — 3 columns desktop, 2 tablet, 1 mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SIX_FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <FadeIn key={i} delay={i * 0.07}>
                  <div className="group p-6 rounded-2xl h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-default"
                    style={{
                      background: WHITE,
                      border: `1px solid ${BORDER}`,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: feat.bg }}>
                      <Icon className="w-6 h-6" style={{ color: feat.color }} />
                    </div>
                    <h3 className="font-bold text-base mb-2" style={{ color: DARK }}>{feat.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: BODY, lineHeight: "1.7" }}>{feat.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ UI PREVIEW — sells the system (Screen 3) ══════════════ */}
      <section id="preview" className="py-24 px-6 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn className={isAr ? "text-right" : "text-left"}>
              <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5 inline-block"
                style={{ background: "#D1FAE5", color: SUCCESS, border: "1px solid #A7F3D0", letterSpacing: "0.1em" }}>
                {isAr ? "معاينة حية" : "Live Preview"}
              </span>
              <h2 className="text-3xl sm:text-4xl font-black mb-5" style={{ color: DARK, letterSpacing: "-0.02em" }}>
                {isAr ? "شاهد المنصة في العمل" : "See the Platform in Action"}
              </h2>
              <p className="text-lg mb-8 leading-relaxed" style={{ color: BODY, lineHeight: "1.75" }}>
                {isAr
                  ? "واجهة عربية بالكامل، سريعة، سهلة الاستخدام. من إنشاء القضية إلى إرسال الفاتورة في ثوانٍ."
                  : "Fully Arabic interface, fast and intuitive. From case creation to invoice in seconds."}
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  isAr ? "لوحة تحكم احترافية في الوقت الفعلي" : "Professional real-time dashboard",
                  isAr ? "بحث فوري في القضايا والعملاء"        : "Instant search across cases and clients",
                  isAr ? "تقارير مالية بنقرة واحدة"             : "Financial reports in one click",
                  isAr ? "تنبيهات ذكية بالجلسات والمواعيد"      : "Smart alerts for hearings and deadlines",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-medium" style={{ color: BODY }}>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: ACCENT_M }}>
                      <Check className="w-3 h-3" style={{ color: ACCENT }} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`${BASE}/sign-up`}>
                  <button className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-xl text-sm transition-all hover:opacity-90 hover:scale-[1.02]"
                    style={{ background: ACCENT, color: WHITE, boxShadow: `0 4px 16px rgba(37,99,235,0.25)` }}>
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    {isAr ? "ابدأ مكتبك الآن" : "Start Your Office"}
                  </button>
                </Link>
                <Link href={`${BASE}/demo-login`}>
                  <button className="inline-flex items-center gap-2 font-semibold px-5 py-3 rounded-xl text-sm border-2 transition-all hover:bg-slate-50"
                    style={{ borderColor: BORDER2, color: DARK, background: WHITE }}>
                    <Play className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    {isAr ? "جرّب المحاكاة" : "Try Demo"}
                  </button>
                </Link>
              </div>
            </FadeIn>

            <FadeIn delay={0.15}>
              <div className="relative">
                {/* Floating accent card */}
                <div className="absolute -top-4 -right-4 z-10 px-4 py-2.5 rounded-xl shadow-lg text-sm font-bold"
                  style={{ background: WHITE, border: `1px solid ${BORDER}`, color: SUCCESS, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
                  ✓ {isAr ? "بيانات حقيقية" : "Real Data"}
                </div>
                <DashboardMock />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══ PAYMENT SHOWCASE (lazy) ════════════════════════════════ */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PaymentShowcase />
      </Suspense>

      {/* ══ PRICING (Screen 4) ═════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6 overflow-hidden" style={{ background: BG2 }}>
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5 inline-block"
              style={{ background: ACCENT_M, color: ACCENT, border: `1px solid ${ACCENT_T}`, letterSpacing: "0.1em" }}>
              {t("landing.pricing.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              {t("landing.pricing.title")}
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: BODY }}>
              {t("landing.pricing.subtitle")}
            </p>
          </FadeIn>

          {/* 3 plans grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingPlans.slice(0, 3).map((p, i) => {
              const isPopular = i === 1;
              const isEnterprise = i === pricingPlans.length - 1 || i === 2;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className="p-7 rounded-2xl h-full flex flex-col relative overflow-hidden transition-transform hover:-translate-y-1"
                    style={{
                      background: isPopular ? PRIMARY : WHITE,
                      border: isPopular ? `2px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                      boxShadow: isPopular ? `0 8px 40px rgba(11,31,59,0.18)` : "0 2px 8px rgba(0,0,0,0.05)",
                    }}>

                    {isPopular && (
                      <div className="absolute top-5 left-5 text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: ACCENT, color: WHITE }}>
                        {t("landing.pricing.mostPopular")}
                      </div>
                    )}

                    <p className={`font-bold text-xs tracking-widest uppercase mb-4 ${isPopular ? "mt-6" : ""}`}
                      style={{ color: isPopular ? "rgba(255,255,255,0.5)" : MUTED }}>
                      {p.name}
                    </p>

                    <div className="mb-6">
                      <span className="text-4xl font-black" style={{ color: isPopular ? WHITE : DARK }}>{p.price}</span>
                      {p.period && <span className="text-sm mr-1" style={{ color: isPopular ? "rgba(255,255,255,0.5)" : MUTED }}>{p.period}</span>}
                    </div>

                    <ul className="space-y-2.5 flex-1 mb-7">
                      {p.features.map((f, fi) => (
                        <li key={fi} className="flex items-start gap-2.5 text-sm"
                          style={{ color: isPopular ? "rgba(255,255,255,0.85)" : BODY }}>
                          <Check className="w-4 h-4 shrink-0 mt-0.5"
                            style={{ color: isPopular ? ACCENT_T : ACCENT }} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link href={isEnterprise && !isPopular ? "#contact" : `${BASE}/sign-up`}>
                      <button className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                        style={isPopular
                          ? { background: ACCENT, color: WHITE, boxShadow: `0 4px 16px rgba(37,99,235,0.35)` }
                          : { background: BG2, color: BODY, border: `1px solid ${BORDER}` }
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
              <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:bg-blue-50"
                style={{ background: ACCENT_L, color: ACCENT, border: `1px solid ${ACCENT_T}` }}>
                {t("landing.pricing.viewAll")}
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ══ FAQ (Screen 5) ═════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-6 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              {t("landing.faq.title")}
            </h2>
            <p style={{ color: MUTED }}>{t("landing.faq.subtitle")}</p>
          </FadeIn>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <FadeIn key={i}><FAQItem q={item.q} a={item.a} /></FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA (Screen 5-6) ═════════════════════════════════ */}
      <section className="py-24 px-6 overflow-hidden" style={{ background: PRIMARY }}>
        <FadeIn>
          <div className="max-w-4xl mx-auto text-center relative">
            {/* Decorative glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-[120px]"
                style={{ background: ACCENT, opacity: 0.2 }} />
            </div>
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: ACCENT, boxShadow: `0 8px 24px rgba(37,99,235,0.40)` }}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mb-5 text-white" style={{ letterSpacing: "-0.02em" }}>
                {c("cta_section", "title", t("landing.cta.title"))}<br />
                <span style={{ color: ACCENT_T }}>{c("cta_section", "titleHighlight", t("landing.cta.titleHighlight"))}</span>
              </h2>
              <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.65)", lineHeight: "1.75" }}>
                {c("cta_section", "subtitle", t("landing.cta.subtitle"))}
              </p>
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-wrap justify-center gap-4">
                  <Link href={`${BASE}/sign-up`}>
                    <button className="flex items-center gap-2 font-bold px-8 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02]"
                      style={{ background: ACCENT, color: WHITE, boxShadow: `0 8px 28px rgba(37,99,235,0.40)`, height: "56px" }}>
                      {isAr ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                      {isAr ? "ابدأ مكتبك الآن" : "Start Your Office Now"}
                    </button>
                  </Link>
                  <Link href={`${BASE}/demo-login`}>
                    <button className="flex items-center gap-2 font-semibold px-8 py-4 rounded-xl text-base transition-all hover:bg-white/10"
                      style={{ color: WHITE, border: "2px solid rgba(255,255,255,0.20)", height: "56px" }}>
                      <Play className="w-4 h-4" />
                      {isAr ? "جرّب بيئة المحاكاة" : "Try Simulation"}
                    </button>
                  </Link>
                </div>
                {/* Sign-in tertiary link */}
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {isAr ? "لديك حساب؟ " : "Already have an account? "}
                  <Link href={`${BASE}/sign-in`}>
                    <span className="font-semibold underline underline-offset-2 cursor-pointer transition-opacity hover:opacity-70"
                      style={{ color: "rgba(255,255,255,0.75)" }}>
                      {isAr ? "سجّل دخولك" : "Sign in"}
                    </span>
                  </Link>
                </p>
              </div>
              {/* Trust strip */}
              <div className="mt-10 flex items-center justify-center gap-6 flex-wrap">
                {[
                  t("landing.hero.noCard"),
                  t("landing.hero.quickSetup"),
                  isAr ? "دعم 24/7" : "24/7 Support",
                ].map(label => (
                  <span key={label} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.50)" }}>
                    <Check className="w-4 h-4" style={{ color: ACCENT_T }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ══ FOOTER ═════════════════════════════════════════════════ */}
      <footer style={{ background: DARK, color: "rgba(255,255,255,0.45)" }}>
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand col */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: ACCENT }}>
                  <Scale className="w-4 h-4 text-white" />
                </div>
                <span className="font-black text-lg text-white">عدالة <span style={{ color: ACCENT_T }}>AI</span></span>
              </div>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.35)", maxWidth: "200px" }}>
                {cmsFooter?.tagline || t("landing.footer.tagline")}
              </p>
              <div className="flex gap-3">
                {[Twitter, Linkedin, Youtube].map((Icon, i) => (
                  <a key={i} href="#"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}>
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Links cols */}
            {(!cmsFooter || cmsFooter.showPlatformCol !== false) && (
              <div>
                <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.platform")}</h4>
                <ul className="space-y-2.5">
                  {platformLinks.map((l, i) => (
                    <li key={i}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.40)" }}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
            {(!cmsFooter || cmsFooter.showCompanyCol !== false) && (
              <div>
                <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.company")}</h4>
                <ul className="space-y-2.5">
                  {companyLinks.map((l, i) => (
                    <li key={i}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.40)" }}>{l.label}</a></li>
                  ))}
                  <li>
                    <Link href={`${BASE}/referral`}>
                      <span className="flex items-center gap-1.5 text-sm cursor-pointer transition-colors hover:text-white" style={{ color: ACCENT_T }}>
                        <Gift className="w-3.5 h-3.5" />
                        {isAr ? "برنامج الإحالة 🎁" : "Referral Program 🎁"}
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            )}
            {(!cmsFooter || cmsFooter.showSupportCol !== false) && (
              <div>
                <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.support")}</h4>
                <ul className="space-y-2.5">
                  {supportLinks.map((l, i) => (
                    <li key={i}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.40)" }}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
              {cmsFooter?.copyright || t("landing.footer.copyright")}
            </p>
            {(!cmsFooter || cmsFooter.showStatus !== false) && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}>
                {cmsFooter?.statusText || t("landing.footer.allSystemsNormal")}
              </span>
            )}
          </div>
        </div>
      </footer>

      {/* ══ WhatsApp floating button ════════════════════════════════ */}
      <AdoulWidget />
    </div>
  );
}
