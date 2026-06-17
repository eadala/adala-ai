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
  Cpu, Network, SquareCheckBig, FileSearch, Wallet, HeartHandshake,
  ChevronRight, Quote,
} from "lucide-react";

const PlatformShowcase = lazy(() => import("@/components/platform-showcase"));
const PaymentShowcase  = lazy(() => import("@/components/payment-showcase"));

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── Design System Tokens ───────────────────────────────────────── */
const PRIMARY  = "#0B1F3B";
const ACCENT   = "#2563EB";
const ACCENT_D = "#1D4ED8";
const ACCENT_L = "#EFF6FF";
const ACCENT_M = "#DBEAFE";
const ACCENT_T = "#93C5FD";
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
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: BG2, borderBottom: `1px solid ${BORDER}` }}>
        <div className="w-3 h-3 rounded-full" style={{ background: "#FC8181" }} />
        <div className="w-3 h-3 rounded-full" style={{ background: WARN }} />
        <div className="w-3 h-3 rounded-full" style={{ background: SUCCESS }} />
        <div className="flex-1 mx-4 px-3 py-1 rounded-lg text-xs text-center"
          style={{ background: WHITE, color: MUTED, border: `1px solid ${BORDER}` }}>
          app.adalah-ai.sa
        </div>
      </div>
      <div className="flex gap-1 px-4 pt-3 overflow-x-auto" style={{ borderBottom: `1px solid ${BORDER}`, scrollbarWidth: "none" }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActive(i)}
            className="flex-shrink-0 px-3 py-2 text-xs font-semibold rounded-t transition-all"
            style={{ color: active === i ? ACCENT : MUTED, borderBottom: active === i ? `2px solid ${ACCENT}` : "2px solid transparent" }}>
            {tab}
          </button>
        ))}
      </div>
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
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: ACCENT_M }}>
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

function ShowcasePlaceholder() {
  return (
    <div className="py-12 flex items-center justify-center" style={{ background: BG2 }}>
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT}40`, borderTopColor: "transparent" }} />
    </div>
  );
}

/* ── FAQ accordion ──────────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{ borderColor: open ? `${ACCENT}50` : BORDER, background: open ? ACCENT_L : WHITE,
               boxShadow: open ? `0 2px 12px rgba(37,99,235,0.08)` : "0 1px 3px rgba(0,0,0,0.04)" }}
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
    staleTime: 1000 * 60, enabled: !urlVariant,
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

  /* SEO */
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
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".lp-fade,.lp-hero-0,.lp-hero-1,.lp-hero-2,.lp-hero-3,.lp-hero-4,.lp-hero-mock").forEach(el => {
        el.style.opacity = "1"; el.style.transform = "none"; el.classList.add("lp-visible");
      });
    }, 100);
    return () => clearTimeout(t);
  }, []);

  /* i18n */
  const pricingPlans = (t("landing.pricing.plans", { returnObjects: true }) as { name: string; price: string; period: string; cta: string; features: string[] }[]);
  const faqItems     = (t("landing.faq.items",     { returnObjects: true }) as { q: string; a: string }[]);
  const counterLocale = isAr ? "ar-SA" : "en-US";

  /* Footer */
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

  /* ── NAV ─────────────────────────────────────────────────────── */
  const NAV = [
    { label: "المميزات",  href: "#features"      },
    { label: "الخدمات",   href: "#services"      },
    { label: "الذكاء AI", href: "#ai"            },
    { label: "الأسعار",   href: "#pricing"       },
    { label: "الأسئلة",   href: "#faq"           },
  ];

  /* ── 8 Core Services ─────────────────────────────────────────── */
  const SERVICES = [
    { icon: Scale,        color: ACCENT,    bg: ACCENT_M,  title: "⚖️ إدارة القضايا والملفات",    desc: "تنظيم القضايا والجلسات والمستندات القانونية في نظام مركزي واحد مع متابعة حية" },
    { icon: Users,        color: "#4F46E5", bg: "#EDE9FE", title: "👥 إدارة العملاء والعلاقات",   desc: "ملفات شاملة لكل عميل، سجل تواصل كامل، بوابة إلكترونية للعملاء" },
    { icon: FileText,     color: "#0891B2", bg: "#CFFAFE", title: "📄 العقود والمستندات الذكية", desc: "أرشفة تلقائية، بحث فوري، توقيع إلكتروني، وإدارة الوثائق بكفاءة عالية" },
    { icon: Receipt,      color: WARN,      bg: "#FEF3C7", title: "💰 الفوترة والمحاسبة",        desc: "فواتير إلكترونية، تتبع المدفوعات، تقارير مالية، ومحاسبة مزدوجة القيود" },
    { icon: UserCheck,    color: "#7C3AED", bg: "#EDE9FE", title: "👨‍💼 الموارد البشرية",            desc: "إدارة المحامين والموظفين، الرواتب، الحضور، التقييمات، والصلاحيات" },
    { icon: Bot,          color: SUCCESS,   bg: "#D1FAE5", title: "🤖 مساعد AI القانوني",         desc: "صياغة العقود، تحليل القضايا، البحث القانوني، والاستشارة الذكية بالعربية" },
    { icon: Globe,        color: "#0891B2", bg: "#CFFAFE", title: "🌐 الموقع والمتجر القانوني",  desc: "موقع احترافي للمكتب، صفحة خدمات، حجز الاستشارات، وبوابة دفع متكاملة" },
    { icon: BarChart3,    color: "#DC2626", bg: "#FEE2E2", title: "📊 التقارير ولوحات التحكم",   desc: "مؤشرات أداء لحظية، تقارير مالية وقانونية، وتحليلات ذكية لاتخاذ القرار" },
  ];

  /* ── Platform stats ──────────────────────────────────────────── */
  const STATS = [
    { to: 500,   suffix: "+",    label: "مكتب محاماة",       color: ACCENT   },
    { to: 50000, suffix: "+",    label: "قضية مُدارة",       color: "#4F46E5" },
    { to: 99,    suffix: ".9%",  label: "وقت تشغيل مستمر",  color: SUCCESS   },
    { to: 4,     suffix: " دول", label: "دول الخليج",        color: WARN      },
  ];

  /* ── Testimonials ────────────────────────────────────────────── */
  const TESTIMONIALS = [
    {
      name: "م. خالد العمري",
      role: "مكتب العمري للمحاماة — الرياض",
      avatar: "خ",
      color: ACCENT,
      stars: 5,
      text: "عدالة AI غيّرت طريقة عمل مكتبنا بالكامل. كنا نُضيع ساعات في إدارة الملفات يدوياً، الآن كل شيء في مكان واحد والنظام يُذكّرنا بالجلسات تلقائياً.",
    },
    {
      name: "أ. نورة الشمري",
      role: "مستشارة قانونية — مكتب الشمري — جدة",
      avatar: "ن",
      color: "#7C3AED",
      stars: 5,
      text: "أفضل استثمار قمت به لمكتبي. الفوترة والتحصيل أصبحا أوتوماتيكياً، والعملاء يحبون بوابة التتبع الإلكترونية. وفّرت 40% من وقتي الإداري.",
    },
    {
      name: "م. سالم الزهراني",
      role: "مدير شراكات — مجموعة الزهراني القانونية",
      avatar: "س",
      color: SUCCESS,
      stars: 5,
      text: "ندير 3 مكاتب في مدن مختلفة من لوحة تحكم واحدة. المساعد الذكي يوفر علينا ساعات في صياغة العقود. المنصة احترافية وتستحق كل ريال.",
    },
  ];

  /* ── AI Steps ─────────────────────────────────────────────────── */
  const AI_STEPS = [
    {
      step: "١",
      icon: <FileSearch className="w-7 h-7" style={{ color: ACCENT }} />,
      title: "يقرأ ويفهم",
      desc: "يحلل النظام القضايا والمستندات والعقود فوراً ويستخرج المعلومات الأساسية دون أي جهد منك",
      color: ACCENT, bg: ACCENT_M,
    },
    {
      step: "٢",
      icon: <Brain className="w-7 h-7" style={{ color: "#7C3AED" }} />,
      title: "يُفكّر ويقترح",
      desc: "يقدم توصيات قانونية مدعومة بالأدلة، يصيغ المستندات، ويُنبّه لمخاطر القضايا بدقة عالية",
      color: "#7C3AED", bg: "#EDE9FE",
    },
    {
      step: "٣",
      icon: <Zap className="w-7 h-7" style={{ color: SUCCESS }} />,
      title: "يُنجز ويُتابع",
      desc: "يرسل التذكيرات، يولّد الفواتير، يُحدّث ملفات القضايا، ويتابع المواعيد النهائية تلقائياً",
      color: SUCCESS, bg: "#D1FAE5",
    },
  ];

  return (
    <div dir="rtl" style={{ background: WHITE, color: DARK, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>

      {/* ══════════════════════════════════════════════════════════
          STICKY NAVBAR
      ══════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.96)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? `1px solid ${BORDER}` : "none",
          boxShadow: scrolled ? "0 1px 12px rgba(11,31,59,0.06)" : "none",
        }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: ACCENT, boxShadow: `0 4px 12px rgba(37,99,235,0.35)` }}>
                <Scale className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-black text-lg" style={{ color: DARK }}>عدالة <span style={{ color: ACCENT }}>AI</span></span>
                <div className="text-[10px] leading-none" style={{ color: MUTED }}>منصة قانونية ذكية</div>
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV.map(n => (
              <a key={n.href} href={n.href}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-100"
                style={{ color: BODY }}>
                {n.label}
              </a>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href={`${BASE}/sign-in`}>
              <button className="hidden md:block text-sm font-semibold px-4 py-2 rounded-xl transition-colors hover:bg-slate-100"
                style={{ color: DARK }}>
                تسجيل الدخول
              </button>
            </Link>
            <Link href={`${BASE}/demo-login`}>
              <button className="hidden md:flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors hover:bg-slate-50"
                style={{ borderColor: BORDER2, color: DARK }}>
                <Play className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                عرض تجريبي
              </button>
            </Link>
            <Link href={`${BASE}/sign-up`}>
              <button className="text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
                style={{ background: ACCENT, color: WHITE, boxShadow: `0 4px 14px rgba(37,99,235,0.30)` }}>
                ابدأ مجاناً
              </button>
            </Link>
            <button className="md:hidden p-2 rounded-lg" onClick={() => setMenuOpen(p => !p)} style={{ color: DARK }}>
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
            <div className="flex flex-col gap-2 mt-3">
              <Link href={`${BASE}/sign-up`}>
                <button className="w-full py-3 rounded-xl text-sm font-bold"
                  style={{ background: ACCENT, color: WHITE, boxShadow: `0 4px 12px rgba(37,99,235,0.25)` }}
                  onClick={() => setMenuOpen(false)}>
                  ابدأ مجاناً لمدة 90 يوماً
                </button>
              </Link>
              <Link href={`${BASE}/demo-login`}>
                <button className="w-full py-3 rounded-xl text-sm font-semibold"
                  style={{ background: ACCENT_L, color: ACCENT, border: `1px solid ${ACCENT_T}` }}
                  onClick={() => setMenuOpen(false)}>
                  🎯 احجز عرضاً تجريبياً
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════════════
          1. HERO SECTION
      ══════════════════════════════════════════════════════════ */}
      <section id="hero" className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${WHITE} 0%, ${ACCENT_L} 55%, ${WHITE} 100%)` }}>

        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 right-1/3 w-[600px] h-[600px] rounded-full blur-[160px]"
            style={{ background: ACCENT_M, opacity: 0.6 }} />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px]"
            style={{ background: "#E0E7FF", opacity: 0.5 }} />
          <div className="absolute inset-0 opacity-[0.02]"
            style={{ backgroundImage: `linear-gradient(${DARK} 1px, transparent 1px), linear-gradient(90deg, ${DARK} 1px, transparent 1px)`, backgroundSize: "64px 64px" }} />
        </div>

        <div className="relative max-w-7xl mx-auto w-full grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* ── Left: Copy ──────────────────────────────────────── */}
          <div className="text-right">

            {/* Category badge */}
            <div className="lp-hero-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
              style={{ background: ACCENT_M, border: `1px solid ${ACCENT_T}`, color: ACCENT }}>
              <Sparkles className="w-3.5 h-3.5" />
              منصة SaaS قانونية متكاملة للمكاتب القانونية حول العالم
            </div>

            {/* H1 — Big marketing headline */}
            <h1 className="lp-hero-1 font-black leading-[1.15] mb-5"
              style={{ fontSize: "clamp(32px, 5vw, 56px)", color: DARK, letterSpacing: "-0.02em" }}>
              كل ما يحتاجه<br />
              مكتب المحاماة<br />
              <span style={{ color: ACCENT }}>في منصة واحدة</span>
            </h1>

            {/* H2 — Value proposition */}
            <p className="lp-hero-2 text-xl font-semibold mb-4" style={{ color: DARK }}>
              إدارة قانونية أكثر ذكاءً مدعومة بالذكاء الاصطناعي
            </p>

            {/* Description */}
            <p className="lp-hero-2 text-base mb-8 leading-[1.85] max-w-xl" style={{ color: BODY }}>
              عدالة AI منصة متكاملة لإدارة وتشغيل المكاتب القانونية والشركات القانونية من مكان واحد.
              تجمع إدارة القضايا والعملاء والعقود والمستندات والفوترة والمحاسبة والموارد البشرية
              والأتمتة والذكاء الاصطناعي في نظام سحابي آمن وقابل للتوسع عالميًا.
            </p>

            {/* CTA — 3 levels */}
            <div className="lp-hero-3 space-y-3 mb-8">
              {/* Primary */}
              <div className="flex flex-wrap gap-3">
                <Link href={`${BASE}/sign-up`}>
                  <button className="flex items-center gap-2.5 font-bold px-8 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
                    style={{ background: ACCENT, color: WHITE, boxShadow: `0 8px 28px rgba(37,99,235,0.38)`, minHeight: 54 }}>
                    <ArrowLeft className="w-4 h-4" />
                    ابدأ مجاناً لمدة 90 يوماً
                  </button>
                </Link>
                {/* Secondary */}
                <Link href={`${BASE}/demo-login`}>
                  <button className="flex items-center gap-2 font-semibold px-6 py-4 rounded-xl text-base border-2 transition-all hover:bg-slate-50 hover:border-slate-300"
                    style={{ borderColor: BORDER2, color: DARK, background: WHITE, minHeight: 54 }}>
                    <Play className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />
                    احجز عرضاً تجريبياً
                  </button>
                </Link>
              </div>
              {/* Tertiary */}
              <p className="text-sm" style={{ color: MUTED }}>
                لديك حساب؟{" "}
                <Link href={`${BASE}/sign-in`}>
                  <span className="font-semibold underline underline-offset-2 cursor-pointer transition-colors hover:opacity-70"
                    style={{ color: ACCENT }}>
                    تسجيل الدخول
                  </span>
                </Link>
              </p>
            </div>

            {/* Trust signals */}
            <div className="lp-hero-4 flex items-center gap-5 flex-wrap">
              {["بدون بطاقة ائتمان", "إعداد خلال 5 دقائق", "دعم عربي كامل", "SSL آمن 100%"].map(label => (
                <span key={label} className="flex items-center gap-1.5 text-sm" style={{ color: MUTED }}>
                  <Check className="w-3.5 h-3.5 shrink-0" style={{ color: SUCCESS }} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* ── Right: Dashboard preview ─────────────────────── */}
          <div className="lp-hero-mock w-full">
            <div className="relative">
              <div className="absolute -top-3 -right-3 z-10 px-4 py-2.5 rounded-xl shadow-lg text-sm font-bold"
                style={{ background: WHITE, border: `1px solid ${BORDER}`, color: SUCCESS, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
                ✓ بيانات حقيقية مباشرة
              </div>
              <div className="absolute -bottom-3 -left-3 z-10 px-4 py-2.5 rounded-xl shadow-lg text-sm font-bold flex items-center gap-2"
                style={{ background: DARK, color: WHITE, boxShadow: "0 8px 24px rgba(0,0,0,0.20)" }}>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                نشط الآن
              </div>
              <DashboardMock />
            </div>
          </div>
        </div>

        {/* Feature quick strip */}
        <FadeIn delay={0.3} className="relative w-full max-w-7xl mx-auto mt-16 pt-10"
          style={{ borderTop: `1px solid ${BORDER}` }}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: <Scale className="w-5 h-5" />,        label: "إدارة القضايا والملفات القانونية",  color: ACCENT   },
              { icon: <Users className="w-5 h-5" />,        label: "إدارة العملاء والعلاقات",            color: "#4F46E5" },
              { icon: <FileText className="w-5 h-5" />,     label: "العقود والمستندات والأرشفة الذكية", color: "#0891B2" },
              { icon: <Receipt className="w-5 h-5" />,      label: "الفوترة والمحاسبة والتحصيل",        color: WARN      },
              { icon: <UserCheck className="w-5 h-5" />,    label: "الموارد البشرية وإدارة الموظفين",   color: "#7C3AED" },
              { icon: <Bot className="w-5 h-5" />,          label: "مساعد قانوني بالذكاء الاصطناعي",   color: SUCCESS   },
              { icon: <Globe className="w-5 h-5" />,        label: "موقع إلكتروني ومتجر خدمات قانونية",color: "#0891B2" },
              { icon: <BarChart3 className="w-5 h-5" />,    label: "تقارير ولوحات تحكم لحظية",          color: "#DC2626" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <span style={{ color: f.color }}>{f.icon}</span>
                <span className="text-xs font-medium leading-tight" style={{ color: BODY }}>{f.label}</span>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ══════════════════════════════════════════════════════════
          2. STATS / PROOF NUMBERS
      ══════════════════════════════════════════════════════════ */}
      <section style={{ background: PRIMARY, padding: "64px 24px" }}>
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map(s => (
              <div key={s.label}>
                <div className="text-4xl font-black mb-2" style={{ color: s.color }}>
                  <Counter to={s.to} suffix={s.suffix} locale={counterLocale} />
                </div>
                <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          3. PLATFORM SHOWCASE
      ══════════════════════════════════════════════════════════ */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PlatformShowcase />
      </Suspense>

      {/* ══════════════════════════════════════════════════════════
          4. 8 CORE SERVICES
      ══════════════════════════════════════════════════════════ */}
      <section id="services" className="py-24 px-6 overflow-hidden" style={{ background: BG2 }}>
        <div className="max-w-7xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: ACCENT_M, color: ACCENT, border: `1px solid ${ACCENT_T}`, letterSpacing: "0.1em" }}>
              الخدمات الأساسية
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              كل ما تحتاجه في مكان واحد
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: BODY }}>
              منصة متكاملة تغطي كل جوانب إدارة المكتب القانوني — من القضايا إلى المحاسبة إلى الموارد البشرية
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <FadeIn key={i} delay={i * 0.06}>
                  <div className="group p-6 rounded-2xl h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-default"
                    style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: feat.bg }}>
                      <Icon className="w-6 h-6" style={{ color: feat.color }} />
                    </div>
                    <h3 className="font-bold text-sm mb-2 leading-snug" style={{ color: DARK }}>{feat.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: BODY, lineHeight: "1.7" }}>{feat.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          5. HOW AI WORKS
      ══════════════════════════════════════════════════════════ */}
      <section id="ai" className="py-24 px-6 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: "#D1FAE5", color: SUCCESS, border: "1px solid #A7F3D0", letterSpacing: "0.1em" }}>
              الذكاء الاصطناعي
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              كيف يعمل الذكاء الاصطناعي في عدالة AI؟
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: BODY }}>
              مساعد قانوني ذكي مدمج في كل زاوية من المنصة — يفهم، يقترح، وينجز
            </p>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-14 items-center">
            {/* Steps */}
            <div className="space-y-6">
              {AI_STEPS.map((step, i) => (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className="flex gap-5 p-6 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: step.bg }}>
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white"
                          style={{ background: step.color }}>
                          {step.step}
                        </span>
                        <h3 className="font-bold text-base" style={{ color: DARK }}>{step.title}</h3>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: BODY, lineHeight: "1.75" }}>{step.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}

              <FadeIn delay={0.4} className="flex gap-3 flex-wrap">
                <Link href={`${BASE}/sign-up`}>
                  <button className="flex items-center gap-2 font-bold px-6 py-3 rounded-xl text-sm transition-all hover:opacity-90"
                    style={{ background: ACCENT, color: WHITE, boxShadow: `0 4px 16px rgba(37,99,235,0.25)` }}>
                    <ArrowLeft className="w-4 h-4" />
                    جرّب الذكاء الاصطناعي الآن
                  </button>
                </Link>
              </FadeIn>
            </div>

            {/* AI feature list visual */}
            <FadeIn delay={0.15}>
              <div className="rounded-2xl overflow-hidden"
                style={{ background: PRIMARY, border: `1px solid rgba(255,255,255,0.08)`, boxShadow: "0 20px 60px rgba(11,31,59,0.25)" }}>
                <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT }}>
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">المساعد القانوني الذكي</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>مدعوم بـ Gemini + Claude</p>
                    </div>
                    <span className="mr-auto flex items-center gap-1.5 text-xs"
                      style={{ color: "#34D399" }}>
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      متصل
                    </span>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {[
                    { q: "اكتب عقد إيجار تجاري بشروط حماية المستأجر", icon: "📝" },
                    { q: "حلّل مخاطر قضية نزاع عمالي وأعطني توصيات", icon: "⚖️" },
                    { q: "ابحث في قانون الشركات عن أحكام الاندماج", icon: "🔍" },
                    { q: "أنشئ تقريراً مالياً لمكتبي خلال الربع الأخير", icon: "📊" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="text-lg shrink-0">{item.icon}</span>
                      <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>{item.q}</span>
                      <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" style={{ color: ACCENT_T }} />
                    </div>
                  ))}
                  <div className="pt-2 px-1 text-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
                    وأكثر من 50 حالة استخدام قانونية...
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          6. SYSTEM SCREENSHOTS
      ══════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 overflow-hidden" style={{ background: BG2 }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <FadeIn className="text-right">
              <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5 inline-block"
                style={{ background: "#D1FAE5", color: SUCCESS, border: "1px solid #A7F3D0", letterSpacing: "0.1em" }}>
                معاينة حية
              </span>
              <h2 className="text-3xl sm:text-4xl font-black mb-5" style={{ color: DARK, letterSpacing: "-0.02em" }}>
                شاهد المنصة في العمل
              </h2>
              <p className="text-lg mb-8 leading-relaxed" style={{ color: BODY, lineHeight: "1.75" }}>
                واجهة عربية بالكامل، سريعة، سهلة الاستخدام.
                من إنشاء القضية إلى إرسال الفاتورة في ثوانٍ معدودة.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "لوحة تحكم احترافية في الوقت الفعلي",
                  "بحث فوري في القضايا والعملاء والوثائق",
                  "تقارير مالية وقانونية بنقرة واحدة",
                  "تنبيهات ذكية بالجلسات والمواعيد النهائية",
                  "تطبيق جوال يعمل على iOS و Android",
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
                    <ArrowLeft className="w-4 h-4" />
                    ابدأ مجاناً لمدة 90 يوماً
                  </button>
                </Link>
                <Link href={`${BASE}/demo-login`}>
                  <button className="inline-flex items-center gap-2 font-semibold px-5 py-3 rounded-xl text-sm border-2 transition-all hover:bg-slate-50"
                    style={{ borderColor: BORDER2, color: DARK, background: WHITE }}>
                    <Play className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    احجز عرضاً تجريبياً
                  </button>
                </Link>
              </div>
            </FadeIn>
            <FadeIn delay={0.15}>
              <div className="relative">
                <div className="absolute -top-4 -right-4 z-10 px-4 py-2.5 rounded-xl shadow-lg text-sm font-bold"
                  style={{ background: WHITE, border: `1px solid ${BORDER}`, color: SUCCESS, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
                  ✓ بيانات حقيقية
                </div>
                <DashboardMock />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          PAYMENT SHOWCASE
      ══════════════════════════════════════════════════════════ */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PaymentShowcase />
      </Suspense>

      {/* ══════════════════════════════════════════════════════════
          7. PRICING
      ══════════════════════════════════════════════════════════ */}
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
            <p className="text-lg max-w-xl mx-auto mb-4" style={{ color: BODY }}>
              {t("landing.pricing.subtitle")}
            </p>
            {/* 90-day trial badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold"
              style={{ background: "#D1FAE5", color: SUCCESS, border: "1px solid #A7F3D0" }}>
              🎁 جميع الباقات تأتي مع تجربة مجانية لمدة 90 يوماً
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingPlans.slice(0, 3).map((p, i) => {
              const isPopular = i === 1;
              const isEnterprise = i === 2;
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
                          <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: isPopular ? ACCENT_T : ACCENT }} />
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
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          8. TESTIMONIALS (NEW)
      ══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", letterSpacing: "0.1em" }}>
              آراء العملاء
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              ثقة المكاتب القانونية الرائدة
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: BODY }}>
              انضم إلى مئات المكاتب القانونية التي تُدير أعمالها بكفاءة أعلى مع عدالة AI
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="p-7 rounded-2xl h-full flex flex-col relative"
                  style={{ background: BG, border: `1px solid ${BORDER}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.stars }).map((_, si) => (
                      <Star key={si} className="w-4 h-4 fill-yellow-400" style={{ color: WARN }} />
                    ))}
                  </div>
                  {/* Quote icon */}
                  <Quote className="w-8 h-8 mb-3 opacity-20" style={{ color: t.color }} />
                  {/* Text */}
                  <p className="text-sm leading-relaxed flex-1 mb-6" style={{ color: BODY, lineHeight: "1.85" }}>
                    "{t.text}"
                  </p>
                  {/* Author */}
                  <div className="flex items-center gap-3 pt-5" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white"
                      style={{ background: t.color }}>
                      {t.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: DARK }}>{t.name}</p>
                      <p className="text-xs" style={{ color: MUTED }}>{t.role}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Trust logos row */}
          <FadeIn delay={0.3} className="mt-14 text-center">
            <p className="text-sm font-medium mb-6" style={{ color: MUTED }}>موثوق من المكاتب القانونية في</p>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              {["المملكة العربية السعودية 🇸🇦", "الإمارات العربية 🇦🇪", "الكويت 🇰🇼", "قطر 🇶🇦"].map((c, i) => (
                <span key={i} className="text-sm font-semibold px-5 py-2.5 rounded-xl"
                  style={{ background: BG2, color: BODY, border: `1px solid ${BORDER}` }}>
                  {c}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          9. FAQ
      ══════════════════════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-6 overflow-hidden" style={{ background: BG2 }}>
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

      {/* ══════════════════════════════════════════════════════════
          10. FINAL CTA — 90-day trial
      ══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 overflow-hidden" style={{ background: PRIMARY }}>
        <FadeIn>
          <div className="max-w-4xl mx-auto text-center relative">
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[140px]"
                style={{ background: ACCENT, opacity: 0.18 }} />
            </div>
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: ACCENT, boxShadow: `0 8px 24px rgba(37,99,235,0.40)` }}>
                <Scale className="w-8 h-8 text-white" />
              </div>

              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold mb-6"
                style={{ background: "rgba(37,99,235,0.2)", color: ACCENT_T, border: "1px solid rgba(37,99,235,0.3)" }}>
                🎁 عرض حصري — 90 يوماً مجاناً
              </div>

              <h2 className="text-3xl sm:text-5xl font-black mb-4 text-white" style={{ letterSpacing: "-0.02em", lineHeight: "1.15" }}>
                ابدأ رحلتك مع<br />
                <span style={{ color: ACCENT_T }}>عدالة AI اليوم</span>
              </h2>
              <p className="text-lg mb-10 max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.60)", lineHeight: "1.75" }}>
                إدارة القضايا والعملاء والعقود والفواتير والمحاسبة والموارد البشرية والذكاء الاصطناعي
                — كل شيء في منصة واحدة، سحابية، آمنة، وجاهزة للنمو العالمي.
              </p>

              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-wrap justify-center gap-4">
                  <Link href={`${BASE}/sign-up`}>
                    <button className="flex items-center gap-2 font-bold px-10 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02]"
                      style={{ background: ACCENT, color: WHITE, boxShadow: `0 8px 28px rgba(37,99,235,0.40)`, minHeight: 56 }}>
                      <ArrowLeft className="w-5 h-5" />
                      ابدأ مجاناً لمدة 90 يوماً
                    </button>
                  </Link>
                  <Link href={`${BASE}/demo-login`}>
                    <button className="flex items-center gap-2 font-semibold px-8 py-4 rounded-xl text-base transition-all hover:bg-white/10"
                      style={{ color: WHITE, border: "2px solid rgba(255,255,255,0.20)", minHeight: 56 }}>
                      <Play className="w-4 h-4" />
                      احجز عرضاً تجريبياً
                    </button>
                  </Link>
                </div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.40)" }}>
                  لديك حساب؟{" "}
                  <Link href={`${BASE}/sign-in`}>
                    <span className="font-semibold underline underline-offset-2 cursor-pointer transition-opacity hover:opacity-70"
                      style={{ color: "rgba(255,255,255,0.70)" }}>
                      تسجيل الدخول
                    </span>
                  </Link>
                </p>
              </div>

              <div className="mt-10 flex items-center justify-center gap-6 flex-wrap">
                {["بدون بطاقة ائتمان", "إعداد خلال 5 دقائق", "دعم 24/7", "SSL آمن 100%"].map(label => (
                  <span key={label} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <Check className="w-4 h-4" style={{ color: ACCENT_T }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════ */}
      <footer style={{ background: DARK, color: "rgba(255,255,255,0.45)" }}>
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: ACCENT }}>
                  <Scale className="w-4 h-4 text-white" />
                </div>
                <span className="font-black text-lg text-white">عدالة <span style={{ color: ACCENT_T }}>AI</span></span>
              </div>
              <p className="text-sm leading-relaxed mb-2" style={{ color: "rgba(255,255,255,0.35)", maxWidth: "200px" }}>
                {cmsFooter?.tagline || t("landing.footer.tagline")}
              </p>
              <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.25)" }}>
                منصة SaaS قانونية متكاملة للمكاتب القانونية
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
                        برنامج الإحالة 🎁
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

      <AdoulWidget />
    </div>
  );
}
