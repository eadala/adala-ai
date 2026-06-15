import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import AdoulWidget from "@/components/adoul-widget";
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
  Brain, Layers, HardDrive, Palette, DollarSign, Gift,
  ThumbsUp, PenLine, Smartphone, UserCheck, Archive, ClipboardCheck, BellRing,
} from "lucide-react";

const PlatformShowcase = lazy(() => import("@/components/platform-showcase"));
const PaymentShowcase  = lazy(() => import("@/components/payment-showcase"));

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── ألوان الهوية الموحّدة ──────────────────────────────────────── */
const BLUE    = "#1A56DB";
const BLUE_D  = "#1344B5";
const BLUE_L  = "#EFF6FF";
const BLUE_M  = "#DBEAFE";
const BLUE_T  = "#93C5FD";
const WHITE   = "#FFFFFF";
const BG      = "#F8FAFC";
const BG2     = "#F1F5F9";
const DARK    = "#0F172A";
const BODY    = "#334155";
const MUTED   = "#64748B";
const BORDER  = "#E2E8F0";
const BORDER2 = "#CBD5E1";

/* ── fade-in hook ─────────────────────────────────────────────────── */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => { el.style.transitionDelay = `${delay}s`; el.classList.add("lp-visible"); }, 80);
    return () => clearTimeout(t);
  }, [delay]);
  return ref;
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useFadeIn(delay);
  return <div ref={ref} className={`lp-fade ${className}`}>{children}</div>;
}

/* ── Blue accent text ─────────────────────────────────────────────── */
const BlueText = ({ children }: { children: React.ReactNode }) => (
  <span style={{ color: BLUE }}>{children}</span>
);

/* ── Animated counter ─────────────────────────────────────────────── */
function Counter({ to, suffix = "", duration = 2, locale = "ar-SA" }: { to: number; suffix?: string; duration?: number; locale?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
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
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{count.toLocaleString(locale)}{suffix}</span>;
}

/* ── FAQ Item ─────────────────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{
        borderColor: open ? `${BLUE}50` : BORDER,
        background: open ? BLUE_L : WHITE,
        boxShadow: open ? `0 2px 12px rgba(26,86,219,0.08)` : "0 1px 3px rgba(0,0,0,0.04)",
      }}
      onClick={() => setOpen(p => !p)}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-semibold text-sm md:text-base" style={{ color: open ? BLUE : DARK }}>{q}</span>
        {open
          ? <ChevronUp className="w-5 h-5 shrink-0" style={{ color: BLUE }} />
          : <ChevronDown className="w-5 h-5 shrink-0" style={{ color: MUTED }} />
        }
      </div>
      <div style={{ maxHeight: open ? "400px" : "0", overflow: "hidden", transition: "max-height 0.28s ease" }}>
        <p className="px-6 pb-5 text-sm leading-relaxed" style={{ color: BODY, lineHeight: "1.75" }}>{a}</p>
      </div>
    </div>
  );
}

/* ── Dashboard mock (light theme) ────────────────────────────────── */
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
      style={{ border: `1px solid ${BORDER}`, background: WHITE, boxShadow: "0 8px 40px rgba(26,86,219,0.10), 0 2px 8px rgba(0,0,0,0.05)" }}>
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: BG2, borderBottom: `1px solid ${BORDER}` }}>
        <div className="w-3 h-3 rounded-full bg-red-400/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
        <div className="w-3 h-3 rounded-full bg-green-400/80" />
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
              color: active === i ? BLUE : MUTED,
              borderBottom: active === i ? `2px solid ${BLUE}` : "2px solid transparent",
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
              [t("landing.dashboard.upcomingSessions"), "١٢",  BLUE],
              [t("landing.dashboard.activeClients"),    "١٨٣", "#059669"],
              [t("landing.dashboard.pendingInvoices"),  "٨",   "#D97706"],
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
              ["قضية العقار - شركة الأمل",  "مفتوحة",     "#059669"],
              ["نزاع تجاري - حمدان المطيري", "قيد التنفيذ", "#D97706"],
              ["قضية عمالية - مصنع الخليج", "جلسة قريبة", "#4F46E5"],
              ["عقد استشارة - شركة تقنية",  "مغلقة",      "#EF4444"],
            ].map(([n, s, c]) => (
              <div key={n as string} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
                <span className="text-xs" style={{ color: BODY }}>{n as string}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${c}15`, color: c as string }}>{s as string}</span>
              </div>
            ))}
          </div>
        )}
        {active === 2 && (
          <div className="space-y-2">
            {["شركة الأمل التجارية", "حمدان المطيري", "مصنع الخليج للصناعة", "مجموعة النور العقارية"].map((n, i) => (
              <div key={n} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white font-bold"
                  style={{ background: [BLUE,"#4F46E5","#059669","#D97706"][i] }}>{n[0]}</div>
                <span className="text-xs" style={{ color: BODY }}>{n}</span>
                <span className="mr-auto text-[10px]" style={{ color: MUTED }}>{t("landing.dashboard.activeClient")}</span>
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
              <div key={id as string} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
                <div>
                  <p className="text-xs" style={{ color: MUTED }}>{id as string}</p>
                  <p className="text-sm font-bold" style={{ color: DARK }}>{amt as string}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: st === t("landing.dashboard.paid") ? "#DCFCE7" : "#FEF3C7",
                    color: st === t("landing.dashboard.paid") ? "#059669" : "#D97706",
                  }}>{st as string}</span>
              </div>
            ))}
          </div>
        )}
        {active === 4 && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl max-w-[80%]" style={{ background: BLUE_M, border: `1px solid ${BLUE_T}` }}>
              <p className="text-xs" style={{ color: BLUE_D }}>ما هي القضايا التي موعد جلستها هذا الأسبوع؟</p>
            </div>
            <div className="p-3 rounded-xl mr-8" style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <p className="text-xs font-bold mb-1" style={{ color: BLUE }}>المساعد الذكي ✦</p>
              <p className="text-xs leading-relaxed" style={{ color: BODY }}>لديك ٣ جلسات هذا الأسبوع: الأحد قضية العقار ١٠ص، الثلاثاء نزاع تجاري ٢م، الأربعاء استشارة قانونية ١١ص.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ShowcasePlaceholder() {
  return (
    <div className="py-24 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin" />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function Landing() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { data: cms } = useQuery({
    queryKey: ["home-cms"],
    queryFn: () => fetch(`${BASE}/api/home/content`).then(r => r.json()),
    staleTime: 5 * 60 * 1000, retry: false,
  });

  function c(section: string, key: string, fallback: string): string {
    return (cms?.[section]?.[key] as string | undefined) || fallback;
  }

  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".lp-fade,.lp-hero-0,.lp-hero-1,.lp-hero-2,.lp-hero-3,.lp-hero-4,.lp-hero-mock").forEach(el => {
        el.style.opacity = "1"; el.style.transform = "none"; el.classList.add("lp-visible");
      });
    }, 600);
    return () => clearTimeout(t);
  }, []);

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
    { label: t("landing.nav.showcase"),  href: "#showcase" },
    { label: t("landing.nav.features"),  href: "#features" },
    { label: t("landing.nav.how"),       href: "#how" },
    { label: t("landing.nav.security"),  href: "#security" },
    { label: t("landing.nav.pricing"),   href: "/pricing" },
    { label: t("landing.nav.faq"),       href: "#faq" },
  ];

  const FEATURE_ICONS  = [Scale, Bot, FileText, Users, Calendar, Receipt, Database, Globe, Shield, Activity, BarChart3, Briefcase, Clock, Building2, Mail, CreditCard, Sparkles, Brain, DollarSign, Award, Layers, HardDrive, Palette, MessageSquare, PenLine, Smartphone, UserCheck, Archive, ClipboardCheck, BellRing];
  const FEATURE_COLORS = [BLUE,"#4F46E5","#059669","#D97706","#EC4899","#7C3AED","#0891B2","#EA580C","#DC2626","#2563EB","#16A34A","#0D9488","#9333EA","#E11D48","#3B82F6","#C026D3","#6D28D9","#7C3AED","#047857","#B45309","#4F46E5","#1D4ED8","#BE185D","#059669","#6D28D9","#0284C7","#065F46","#92400E","#475569","#15803D"];
  const AI_ICONS       = [FileText, BarChart3, Zap, TrendingUp];
  const STEP_COLORS    = [BLUE,"#4F46E5","#059669","#D97706"];
  const SEC_ICONS      = [Lock, Building2, Database, Activity, Shield, Globe];
  const SEC_COLORS     = ["#059669","#4F46E5","#D97706","#EC4899",BLUE,"#0891B2"];

  const featureItems  = (t("landing.features.items",    { returnObjects: true }) as { title: string; desc: string }[]);
  const aiItems       = (t("landing.ai.items",           { returnObjects: true }) as { title: string; desc: string }[]);
  const steps         = (t("landing.how.steps",          { returnObjects: true }) as { n: string; title: string; desc: string }[]);
  const secItems      = (t("landing.security.items",     { returnObjects: true }) as { title: string; desc: string }[]);
  const testimonials  = (t("landing.testimonials.items", { returnObjects: true }) as { name: string; role: string; text: string }[]);
  const pricingPlans  = (t("landing.pricing.plans",      { returnObjects: true }) as { name: string; price: string; period: string; cta: string; features: string[] }[]);
  const faqItems      = (t("landing.faq.items",          { returnObjects: true }) as { q: string; a: string }[]);

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

  const counterLocale = isAr ? "ar-SA" : "en-US";
  const textAlign = isAr ? "text-right" : "text-left";

  const [howTab, setHowTab] = useState(0);
  const [activeSection, setActiveSection] = useState("hero");

  useEffect(() => {
    const ids = ["hero","features","ai","how","pricing","faq"];
    const obs = ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActiveSection(id); }, { threshold: 0.25 });
      o.observe(el); return o;
    });
    return () => obs.forEach(o => o?.disconnect());
  }, []);

  const SIDE_DOTS = [
    { id: "hero",     label: isAr ? "الرئيسية" : "Home" },
    { id: "features", label: isAr ? "المميزات" : "Features" },
    { id: "ai",       label: isAr ? "الذكاء الاصطناعي" : "AI" },
    { id: "how",      label: isAr ? "كيف يعمل" : "How it works" },
    { id: "pricing",  label: isAr ? "الأسعار" : "Pricing" },
    { id: "faq",      label: isAr ? "الأسئلة" : "FAQ" },
  ];

  const BENTO_SPANS   = ["lg:col-span-2 md:col-span-2","lg:col-span-1","lg:col-span-1","lg:col-span-1","lg:col-span-1","lg:col-span-1","lg:col-span-2 md:col-span-2","lg:col-span-1","lg:col-span-1","lg:col-span-1"];
  const BENTO_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11];
  const bentoFeatures = BENTO_INDICES.map(i => featureItems[i]).filter(Boolean);

  const STATS = [
    { to: Number(c("stats","offices","1000").replace(/[^0-9]/g,"")||"1000"),   suffix: "+",   labelKey: "landing.trust.offices",      color: BLUE },
    { to: Number(c("stats","cases","100000").replace(/[^0-9]/g,"")||"100000"), suffix: "+",   labelKey: "landing.trust.cases",        color: "#4F46E5" },
    { to: Number(c("stats","satisfaction","99").replace(/[^0-9.]/g,"")||"99"), suffix: ".9%", labelKey: "landing.trust.satisfaction", color: "#059669" },
    { to: Number(c("stats","timeSaving","40").replace(/[^0-9]/g,"")||"40"),    suffix: "%",   labelKey: "landing.trust.timeSaving",   color: "#D97706" },
  ];

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="min-h-screen overflow-x-hidden"
      style={{ background: BG, fontFamily: "Cairo, sans-serif", color: DARK, width: "100%", maxWidth: "100vw" }}>

      <style>{`
        .lp-fade { opacity:0; transform:translateY(20px); transition:opacity 0.5s ease-out, transform 0.5s ease-out; }
        .lp-visible { opacity:1 !important; transform:translateY(0) !important; }
        @keyframes lp-hero-in { from{opacity:0.4;transform:translateY(12px);} to{opacity:1;transform:none;} }
        .lp-hero-0 { animation:lp-hero-in 0.45s ease-out 0s    forwards; }
        .lp-hero-1 { animation:lp-hero-in 0.45s ease-out 0.08s forwards; }
        .lp-hero-2 { animation:lp-hero-in 0.45s ease-out 0.16s forwards; }
        .lp-hero-3 { animation:lp-hero-in 0.45s ease-out 0.24s forwards; }
        .lp-hero-4 { animation:lp-hero-in 0.45s ease-out 0.32s forwards; }
        .lp-hero-mock { animation:lp-hero-in 0.5s ease-out 0.1s forwards; }
        .lp-mobile-menu { overflow:hidden; transition:max-height 0.3s ease, opacity 0.3s ease; }
        .lp-nav-link:hover { color:${BLUE} !important; }
      `}</style>

      {/* ── Announcement Bar ──────────────────────────────────────────── */}
      {cms?.announcement?.enabled && cms.announcement.text && (
        <div className="w-full py-2 px-4 text-center text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: cms.announcement.bgColor || BLUE, color: cms.announcement.textColor || WHITE }}>
          <span>{cms.announcement.text}</span>
          {cms.announcement.link && <a href={cms.announcement.link} className="underline opacity-80 hover:opacity-100">←</a>}
        </div>
      )}

      {/* ── Sticky Navbar ─────────────────────────────────────────────── */}
      <header className="fixed top-0 right-0 left-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.95)" : WHITE,
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: `1px solid ${scrolled ? BORDER2 : BORDER}`,
          boxShadow: scrolled ? "0 2px 16px rgba(15,23,42,0.08)" : "0 1px 0 rgba(226,232,240,1)",
        }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: BLUE, boxShadow: `0 4px 12px rgba(26,86,219,0.25)` }}>
              <Scale className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black" style={{ color: DARK }}>{isAr ? "عدالة AI" : "ADALAH AI"}</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            {NAV.map(n => (
              <a key={n.href} href={n.href}
                className="lp-nav-link text-sm transition-colors font-medium"
                style={{ color: MUTED }}>{n.label}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Link href={`${BASE}/sign-in`}>
              <button className="text-sm font-semibold px-3 py-1.5 transition-colors rounded-lg hover:bg-blue-50"
                style={{ color: BODY }}>{t("landing.signIn")}</button>
            </Link>
            <Link href={`${BASE}/sign-up`}>
              <button className="text-sm font-bold px-5 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95"
                style={{ background: BLUE, color: WHITE, boxShadow: `0 3px 10px rgba(26,86,219,0.25)` }}>
                {t("landing.startFree")}
              </button>
            </Link>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <LanguageSwitcher />
            <button className="p-2 rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: BODY }} onClick={() => setNavOpen(p => !p)}>
              {navOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className="md:hidden lp-mobile-menu"
          style={{ maxHeight: navOpen ? "400px" : "0", opacity: navOpen ? 1 : 0, background: WHITE, borderTop: navOpen ? `1px solid ${BORDER}` : "none" }}>
          <div className="px-4 py-4 space-y-2">
            {NAV.map(n => (
              <a key={n.href} href={n.href}
                className="block py-2.5 px-3 rounded-xl font-medium transition-colors hover:bg-blue-50"
                style={{ color: BODY }}
                onClick={() => setNavOpen(false)}>{n.label}</a>
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <Link href={`${BASE}/sign-in`} onClick={() => setNavOpen(false)}>
                <button className="w-full text-sm font-semibold py-3 rounded-xl border transition-colors"
                  style={{ borderColor: BORDER, color: BODY }}>
                  {t("landing.signIn")}
                </button>
              </Link>
              <Link href={`${BASE}/sign-up`} onClick={() => setNavOpen(false)}>
                <button className="w-full font-bold py-3 rounded-xl text-sm"
                  style={{ background: BLUE, color: WHITE }}>
                  {t("landing.startFree")}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Side-nav dots ─────────────────────────────────────────────── */}
      <nav className="fixed right-5 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col gap-4">
        {SIDE_DOTS.map(({ id, label }) => (
          <button key={id} title={label}
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="relative group flex items-center justify-end">
            <span className="block rounded-full transition-all duration-300"
              style={{
                width:  activeSection === id ? "10px" : "7px",
                height: activeSection === id ? "10px" : "7px",
                background: activeSection === id ? BLUE : BORDER2,
                boxShadow: activeSection === id ? `0 0 8px rgba(26,86,219,0.5)` : "none",
              }} />
            <span className="absolute left-full ml-3 whitespace-nowrap text-xs px-2.5 py-1 rounded-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: DARK, color: WHITE, border: `1px solid ${BORDER}` }}>
              {label}
            </span>
          </button>
        ))}
      </nav>

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
        {/* Soft blue orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full blur-[140px]"
            style={{ background: BLUE_M, opacity: 0.7 }} />
          <div className="absolute bottom-1/4 left-1/4 w-64 h-64 rounded-full blur-[100px]"
            style={{ background: "#E0E7FF", opacity: 0.6 }} />
        </div>

        <div className="max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className={textAlign}>
            {/* Badge */}
            <div className="lp-hero-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
              style={{ background: BLUE_M, border: `1px solid ${BLUE_T}`, color: BLUE }}>
              <Sparkles className="w-3.5 h-3.5" />
              {c("hero", "badge", t("landing.hero.badge"))}
            </div>

            <h1 className="lp-hero-1 text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6"
              style={{ color: DARK }}>
              {c("hero", "titleLine1", t("landing.hero.titleLine1"))}<br />
              {c("hero", "titleLine2", t("landing.hero.titleLine2"))}<br />
              <BlueText>{c("hero", "titleHighlight", t("landing.hero.titleHighlight"))}</BlueText>
            </h1>

            <p className="lp-hero-2 text-lg mb-8 leading-relaxed max-w-lg"
              style={{ color: BODY, lineHeight: "1.75" }}>
              {c("hero", "subtitle", t("landing.hero.subtitle"))}
            </p>

            <div className="lp-hero-3 flex flex-wrap gap-3 mb-8">
              <Link href={`${BASE}/sign-up`}>
                <button className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
                  style={{ background: BLUE, color: WHITE, boxShadow: `0 8px 28px rgba(26,86,219,0.30)` }}>
                  {t("landing.startFree")}
                  {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </Link>
              <Link href={`${BASE}/demo`}>
                <button className="flex items-center gap-2 font-semibold px-7 py-3.5 rounded-xl text-base border transition-all hover:bg-blue-50"
                  style={{ borderColor: BLUE_T, color: BLUE, background: BLUE_L }}>
                  <Sparkles className="w-4 h-4" />
                  {t("landing.hero.explore")}
                </button>
              </Link>
            </div>

            <div className="lp-hero-4 flex items-center gap-4 flex-wrap">
              {[t("landing.hero.noCard"), t("landing.hero.quickSetup"), t("landing.hero.arabicSupport"), t("landing.hero.interactive")].map(label => (
                <span key={label} className="flex items-center gap-1.5 text-sm" style={{ color: MUTED }}>
                  <Check className="w-3.5 h-3.5 text-green-500" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="lp-hero-mock w-full overflow-hidden"><DashboardMock /></div>
        </div>

        {/* Stats strip */}
        <FadeIn delay={0.55} className="w-full max-w-5xl mx-auto mt-16 pt-8"
          style={{ borderTop: `1px solid ${BORDER}` } as any}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map(s => (
              <div key={s.labelKey} className="space-y-1">
                <div className="text-3xl font-black" style={{ color: s.color }}>
                  <Counter to={s.to} suffix={s.suffix} locale={counterLocale} />
                </div>
                <p className="text-sm" style={{ color: MUTED }}>{t(s.labelKey)}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── PLATFORM SHOWCASE (lazy) ───────────────────────────────────── */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PlatformShowcase />
      </Suspense>

      {/* ── FEATURES BENTO ────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 overflow-hidden" style={{ background: BG2 }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: BLUE_M, color: BLUE, border: `1px solid ${BLUE_T}` }}>
              {t("landing.features.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 mb-4" style={{ color: DARK }}>
              {c("features","title",t("landing.features.title"))}
            </h2>
            <p className="max-w-xl mx-auto" style={{ color: MUTED }}>{c("features","subtitle",t("landing.features.subtitle"))}</p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
            {bentoFeatures.map((f, i) => {
              const origIdx = BENTO_INDICES[i];
              const Icon    = FEATURE_ICONS[origIdx];
              const color   = FEATURE_COLORS[origIdx];
              const isWide  = i === 0 || i === 6;
              return (
                <FadeIn key={i} delay={Math.min(i * 0.06, 0.35)} className={BENTO_SPANS[i]}>
                  <div
                    className="group relative h-full rounded-2xl overflow-hidden cursor-default transition-all duration-300 hover:shadow-md"
                    style={{
                      background: isWide ? `linear-gradient(135deg, ${color}08, ${WHITE})` : WHITE,
                      border: `1px solid ${isWide ? color+"40" : BORDER}`,
                      minHeight: isWide ? "160px" : "140px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}60`; e.currentTarget.style.background = isWide ? `linear-gradient(135deg, ${color}12, ${WHITE})` : `${color}06`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isWide ? `${color}40` : BORDER; e.currentTarget.style.background = isWide ? `linear-gradient(135deg, ${color}08, ${WHITE})` : WHITE; }}
                  >
                    <div className="relative p-6 h-full flex flex-col">
                      <div className="flex items-start gap-4 mb-3">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110"
                          style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                          <Icon className="w-5 h-5" style={{ color }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-sm mb-1" style={{ color: DARK }}>{f.title}</h3>
                          <p className="text-xs leading-relaxed" style={{ color: MUTED, lineHeight: "1.65" }}>{f.desc}</p>
                        </div>
                      </div>
                      {isWide && (
                        <div className="mt-auto flex items-center gap-2">
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ background: `${color}12`, color }}>
                            {i === 0 ? (isAr ? "إدارة متكاملة" : "Full management") : (isAr ? "OCR + بحث ذكي" : "Smart OCR search")}
                          </span>
                          <span className="text-xs" style={{ color: MUTED }}>
                            {i === 0 ? (isAr ? "٤٧+ قضية نشطة" : "47+ active cases") : (isAr ? "٢٠٠+ وثيقة مؤرشفة" : "200+ archived docs")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── AI SECTION ────────────────────────────────────────────────── */}
      <section className="py-24 px-4 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: "#E0E7FF", color: "#4F46E5", border: "1px solid #A5B4FC" }}>
              {t("landing.ai.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 mb-5" style={{ color: DARK }}>
              {t("landing.ai.title")}<br />
              <BlueText>{t("landing.ai.titleHighlight")}</BlueText>
            </h2>
            <p className="text-lg mb-8" style={{ color: BODY, lineHeight: "1.75" }}>{t("landing.ai.subtitle")}</p>
            <div className="space-y-3">
              {aiItems.map((item, i) => {
                const Icon = AI_ICONS[i];
                return (
                  <FadeIn key={i} delay={i * 0.08}>
                    <div className="flex items-start gap-4 p-4 rounded-xl"
                      style={{ background: BG, border: `1px solid ${BORDER}` }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: BLUE_M, border: `1px solid ${BLUE_T}` }}>
                        <Icon className="w-4 h-4" style={{ color: BLUE }} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm mb-0.5" style={{ color: DARK }}>{item.title}</p>
                        <p className="text-xs" style={{ color: MUTED, lineHeight: "1.65" }}>{item.desc}</p>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: BG2, border: `1px solid ${BORDER}`, boxShadow: "0 4px 24px rgba(26,86,219,0.08)" }}>
              <div className="flex items-center gap-2 pb-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: BLUE }}>
                  <Scale className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold" style={{ color: DARK }}>{t("landing.ai.assistantName")}</span>
                <span className="mr-auto text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: "#DCFCE7", color: "#059669" }}>{t("landing.ai.available")}</span>
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
                      background: m.role === "user" ? BLUE_M : WHITE,
                      color: m.role === "user" ? BLUE_D : BODY,
                      border: m.role === "user" ? `1px solid ${BLUE_T}` : `1px solid ${BORDER}`,
                      lineHeight: "1.7",
                    }}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <input type="text" placeholder={t("landing.ai.askPlaceholder")} readOnly
                  className="flex-1 text-xs px-3 py-2.5 rounded-xl outline-none"
                  style={{ background: WHITE, border: `1px solid ${BORDER}`, color: MUTED, fontFamily: "Cairo, sans-serif" }} />
                <button className="px-3 py-2.5 rounded-xl" style={{ background: BLUE }}>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── PAYMENT SHOWCASE (lazy) ────────────────────────────────────── */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PaymentShowcase />
      </Suspense>

      {/* ── HOW IT WORKS + SECURITY ───────────────────────────────────── */}
      <section id="how" className="py-24 px-4 overflow-hidden" style={{ background: BG2 }}>
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK }}>
              {howTab === 0 ? t("landing.how.title") : t("landing.security.title")}
            </h2>
            <p style={{ color: MUTED }}>{howTab === 0 ? t("landing.how.subtitle") : t("landing.security.subtitle")}</p>
          </FadeIn>

          <FadeIn delay={0.1} className="flex justify-center mb-12">
            <div className="inline-flex rounded-xl p-1 gap-1"
              style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              {[
                { label: isAr ? "كيف يعمل" : "How it works",         color: BLUE },
                { label: isAr ? "الأمان والخصوصية" : "Security & Privacy", color: "#059669" },
              ].map((tab, i) => (
                <button key={i} onClick={() => setHowTab(i)}
                  className="px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200"
                  style={{
                    background: howTab === i ? `${tab.color}12` : "transparent",
                    color: howTab === i ? tab.color : MUTED,
                    border: howTab === i ? `1px solid ${tab.color}35` : "1px solid transparent",
                  }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </FadeIn>

          {howTab === 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {steps.map((s, i) => (
                <FadeIn key={i} delay={i * 0.08}>
                  <div className="relative p-6 rounded-2xl h-full"
                    style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    {i < steps.length - 1 && (
                      <div className="hidden lg:block absolute left-0 top-8 -translate-x-3" style={{ color: BORDER2 }}>
                        {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      </div>
                    )}
                    <div className="text-3xl font-black mb-3" style={{ color: STEP_COLORS[i] }}>{s.n}</div>
                    <h3 className="font-bold mb-1.5 text-sm" style={{ color: DARK }}>{s.title}</h3>
                    <p className="text-xs" style={{ color: MUTED, lineHeight: "1.65" }}>{s.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {secItems.map((s, i) => {
                const Icon  = SEC_ICONS[i];
                const color = SEC_COLORS[i];
                return (
                  <FadeIn key={i} delay={i * 0.06}>
                    <div className="flex gap-4 p-5 rounded-2xl"
                      style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm mb-1" style={{ color: DARK }}>{s.title}</h3>
                        <p className="text-xs" style={{ color: MUTED, lineHeight: "1.65" }}>{s.desc}</p>
                      </div>
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────── */}
      <section className="py-24 px-4 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: BLUE_M, color: BLUE, border: `1px solid ${BLUE_T}` }}>
              {isAr ? "آراء المحامين" : "Lawyer reviews"}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 mb-4" style={{ color: DARK }}>{t("landing.testimonials.title")}</h2>
            <p style={{ color: MUTED }}>{t("landing.testimonials.subtitle")}</p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.slice(0, 3).map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="p-6 rounded-2xl h-full flex flex-col relative overflow-hidden"
                  style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div className="absolute top-4 left-4 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#DCFCE7", color: "#059669", border: "1px solid #A7F3D0" }}>
                    {isAr ? "عميل موثّق" : "Verified client"}
                  </div>
                  <div className="flex gap-1 mb-4 mt-6">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm flex-1 mb-5" style={{ color: BODY, lineHeight: "1.75" }}>"{item.text}"</p>
                  <div className="flex items-center gap-3 pt-4" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                      style={{ background: BLUE }}>
                      {item.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: DARK }}>{item.name}</p>
                      <p className="text-xs" style={{ color: MUTED }}>{item.role}</p>
                    </div>
                    <div className="mr-auto flex items-center gap-1 text-xs" style={{ color: MUTED }}>
                      <ThumbsUp className="w-3 h-3" />
                      <span>{[24,18,31,15,27,22][i % 6]}</span>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4 overflow-hidden" style={{ background: BG2 }}>
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-sm font-semibold px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: BLUE_M, color: BLUE, border: `1px solid ${BLUE_T}` }}>
              {t("landing.pricing.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 mb-4" style={{ color: DARK }}>{t("landing.pricing.title")}</h2>
            <p style={{ color: MUTED }}>{t("landing.pricing.subtitle")}</p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {pricingPlans.map((p, i) => {
              const highlight = i === 1;
              const isOpen    = i === pricingPlans.length - 1;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className="p-6 rounded-2xl h-full flex flex-col relative overflow-hidden"
                    style={{
                      background: highlight || isOpen ? WHITE : WHITE,
                      border: isOpen ? `2px solid ${BLUE}` : highlight ? `2px solid ${BLUE_T}` : `1px solid ${BORDER}`,
                      boxShadow: highlight || isOpen ? `0 4px 24px rgba(26,86,219,0.12)` : "0 1px 4px rgba(0,0,0,0.04)",
                    }}>
                    {highlight && !isOpen && (
                      <div className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: BLUE, color: WHITE }}>
                        {t("landing.pricing.mostPopular")}
                      </div>
                    )}
                    {isOpen && (
                      <div className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: BLUE, color: WHITE }}>
                        {t("landing.pricing.allServices")}
                      </div>
                    )}
                    <p className={`font-bold text-sm mb-3 ${isOpen || highlight ? "mt-6" : ""}`}
                      style={{ color: MUTED }}>{p.name}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-black" style={{ color: DARK }}>{p.price}</span>
                      {p.period && <span className="text-sm mr-1" style={{ color: MUTED }}>{p.period}</span>}
                    </div>
                    <ul className="space-y-2 flex-1 mb-6">
                      {p.features.map((f, fi) => (
                        <li key={fi} className="flex items-start gap-2 text-sm" style={{ color: BODY }}>
                          <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: BLUE }} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href={isOpen ? "#contact" : `${BASE}/sign-up`}>
                      <button className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                        style={highlight || isOpen
                          ? { background: BLUE, color: WHITE, boxShadow: `0 3px 12px rgba(26,86,219,0.25)` }
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
                style={{ background: BLUE_L, color: BLUE, border: `1px solid ${BLUE_T}` }}>
                {t("landing.pricing.viewAll")}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 7L7 13M13 7H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-3xl mx-auto">
          <FadeIn className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK }}>{t("landing.faq.title")}</h2>
            <p style={{ color: MUTED }}>{t("landing.faq.subtitle")}</p>
          </FadeIn>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <FadeIn key={i}><FAQItem q={item.q} a={item.a} /></FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
      <section className="py-24 px-4 overflow-hidden" style={{ background: BG2 }}>
        <FadeIn>
          <div className="max-w-4xl mx-auto rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${BLUE_L}, #E0E7FF)`, border: `1px solid ${BLUE_T}`, boxShadow: `0 8px 40px rgba(26,86,219,0.12)` }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px]"
                style={{ background: BLUE_M, opacity: 0.8 }} />
              <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-[60px]"
                style={{ background: "#C7D2FE", opacity: 0.6 }} />
            </div>
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: BLUE, boxShadow: `0 8px 24px rgba(26,86,219,0.30)` }}>
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK }}>
                {c("cta_section","title",t("landing.cta.title"))}<br />
                <BlueText>{c("cta_section","titleHighlight",t("landing.cta.titleHighlight"))}</BlueText>
              </h2>
              <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: BODY, lineHeight: "1.75" }}>
                {c("cta_section","subtitle",t("landing.cta.subtitle"))}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href={`${BASE}/sign-up`}>
                  <button className="flex items-center gap-2 font-bold px-9 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02]"
                    style={{ background: BLUE, color: WHITE, boxShadow: `0 8px 28px rgba(26,86,219,0.30)` }}>
                    {t("landing.startFreeNow")}
                    {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </Link>
                <div className="flex items-center gap-4">
                  {[t("landing.cta.noCard"), t("landing.cta.arabicSupport")].map(label => (
                    <span key={label} className="flex items-center gap-1.5 text-sm" style={{ color: BODY }}>
                      <Check className="w-3.5 h-3.5 text-green-500" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer style={{ background: DARK, borderTop: `1px solid rgba(255,255,255,0.06)` }}>
        <div className="max-w-7xl mx-auto px-4 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: BLUE }}>
                  <Scale className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-black text-white">{isAr ? "عدالة AI" : "ADALAH AI"}</span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.45)", lineHeight: "1.7" }}>
                {cmsFooter?.tagline || t("landing.footer.tagline")}
              </p>
              <div className="flex gap-3">
                {([
                  { Icon: Twitter,  href: cms?.contact?.twitter  as string },
                  { Icon: Linkedin, href: cms?.contact?.linkedin as string },
                  { Icon: Youtube,  href: cms?.contact?.youtube  as string },
                ] as { Icon: (p: { className?: string }) => React.ReactElement; href: string }[]).map(({ Icon, href }, i) => (
                  <a key={i} href={href || "#"} target={href ? "_blank" : undefined} rel="noopener noreferrer"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.08)" }}>
                    <Icon className="w-4 h-4 text-white/50" />
                  </a>
                ))}
              </div>
            </div>

            {(!cmsFooter || cmsFooter.showPlatformCol !== false) && (
              <div>
                <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.platform")}</h4>
                <ul className="space-y-2.5">
                  {platformLinks.map((l, i) => (
                    <li key={i}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.45)" }}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
            {(!cmsFooter || cmsFooter.showCompanyCol !== false) && (
              <div>
                <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.company")}</h4>
                <ul className="space-y-2.5">
                  {companyLinks.map((l, i) => (
                    <li key={i}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.45)" }}>{l.label}</a></li>
                  ))}
                  <li>
                    <Link href={`${BASE}/referral`}>
                      <span className="flex items-center gap-1.5 text-sm transition-colors cursor-pointer" style={{ color: BLUE_T }}>
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
                    <li key={i}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.45)" }}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.30)" }}>
              {cmsFooter?.copyright || t("landing.footer.copyright")}
            </p>
            {(!cmsFooter || cmsFooter.showStatus !== false) && (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}>
                  {cmsFooter?.statusText || t("landing.footer.allSystemsNormal")}
                </span>
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* ── WhatsApp floating ─────────────────────────────────────────── */}
      {cms?.contact?.showWhatsappButton !== false && cms?.contact?.whatsapp && (
        <a href={`https://wa.me/${(cms.contact.whatsapp as string).replace(/[^0-9]/g, "")}`}
          target="_blank" rel="noopener noreferrer"
          className="fixed bottom-6 left-6 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 z-40"
          style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.4)" }}
          title="تواصل عبر واتساب">
          <Phone className="w-6 h-6 text-white" />
        </a>
      )}

      <AdoulWidget />
    </div>
  );
}
