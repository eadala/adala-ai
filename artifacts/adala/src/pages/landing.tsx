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
  ChevronRight, Quote, XCircle,
} from "lucide-react";

const PlatformShowcase = lazy(() => import("@/components/platform-showcase"));
const PaymentShowcase  = lazy(() => import("@/components/payment-showcase"));

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── Design tokens ───────────────────────────────────── */
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

/* ── FadeIn ──────────────────────────────────────────── */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setTimeout(() => { el.classList.add("lp-visible"); }, delay * 1000);
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return ref;
}
function FadeIn({ children, delay = 0, className = "", style }: { children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useFadeIn(delay);
  return <div ref={ref} className={`lp-fade ${className}`} style={style}>{children}</div>;
}

/* ── Animated counter ────────────────────────────────── */
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

/* ── Dashboard mock ──────────────────────────────────── */
function DashboardMock() {
  const { t } = useTranslation();
  const TABS = [
    t("landing.dashboard.tab0"), t("landing.dashboard.tab1"),
    t("landing.dashboard.tab2"), t("landing.dashboard.tab3"),
    t("landing.dashboard.tab4"),
  ];
  const [active, setActive] = useState(0);
  const NAV_DOTS = [
    { color: ACCENT }, { color: "#4F46E5" }, { color: SUCCESS },
    { color: WARN }, { color: "#7C3AED" }, { color: MUTED },
  ];
  return (
    <div className="rounded-2xl overflow-hidden flex"
      style={{ border: `1px solid ${BORDER}`, background: WHITE, boxShadow: "0 32px 96px rgba(11,31,59,0.18), 0 4px 16px rgba(0,0,0,0.06)" }}>
      <div className="hidden sm:flex flex-col items-center gap-3 py-4 px-2.5 shrink-0"
        style={{ background: PRIMARY, width: 48, borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: ACCENT }}>
          <Scale className="w-3.5 h-3.5 text-white" />
        </div>
        {NAV_DOTS.map((d, i) => (
          <div key={i} className="w-6 h-6 rounded-lg opacity-60" style={{ background: d.color + "30", border: `1px solid ${d.color}40` }} />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: BG2, borderBottom: `1px solid ${BORDER}` }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FC8181" }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: WARN }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: SUCCESS }} />
          <div className="flex-1 mx-3 px-2 py-0.5 rounded-md text-[10px] text-center truncate"
            style={{ background: WHITE, color: MUTED, border: `1px solid ${BORDER}` }}>
            app.adalah-ai.sa
          </div>
        </div>
        <div className="flex gap-0.5 px-3 pt-2 overflow-x-auto" style={{ borderBottom: `1px solid ${BORDER}`, scrollbarWidth: "none" }}>
          {TABS.map((tab, i) => (
            <button key={i} onClick={() => setActive(i)}
              className="flex-shrink-0 px-2.5 py-1.5 text-[11px] font-semibold rounded-t transition-all"
              style={{ color: active === i ? ACCENT : MUTED, borderBottom: active === i ? `2px solid ${ACCENT}` : "2px solid transparent" }}>
              {tab}
            </button>
          ))}
        </div>
        <div className="p-3" style={{ background: BG, minHeight: 220 }}>
          {active === 0 && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                {[
                  [t("landing.dashboard.openCases"),       "٤٧",  "#4F46E5"],
                  [t("landing.dashboard.upcomingSessions"), "١٢",  ACCENT],
                  [t("landing.dashboard.activeClients"),    "١٨٣", SUCCESS],
                  [t("landing.dashboard.pendingInvoices"),  "٨",   WARN],
                ].map(([l, v, c]) => (
                  <div key={l as string} className="rounded-xl p-2.5 flex flex-col justify-between"
                    style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
                    <p className="text-[10px]" style={{ color: MUTED }}>{l as string}</p>
                    <p className="text-xl font-black mt-1" style={{ color: c as string }}>{v as string}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-3 flex items-start gap-2.5"
                style={{ background: `${ACCENT}08`, border: `1px solid ${ACCENT}20` }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: ACCENT_M }}>
                  <Sparkles className="w-3 h-3" style={{ color: ACCENT }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold mb-0.5" style={{ color: ACCENT }}>توصية AI</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: BODY }}>
                    قضية "العمري vs شركة النور" — الجلسة القادمة بعد ٣ أيام. يُوصى بتحضير مستند الدفوع.
                  </p>
                </div>
              </div>
            </div>
          )}
          {active === 1 && (
            <div className="space-y-1.5">
              {[
                ["قضية العقار - شركة الأمل",  "مفتوحة",     SUCCESS],
                ["نزاع تجاري - حمدان المطيري", "قيد التنفيذ", WARN],
                ["قضية عمالية - مصنع الخليج", "جلسة قريبة", "#4F46E5"],
                ["عقد استشارة - شركة تقنية",  "مغلقة",      "#EF4444"],
              ].map(([n, s, c]) => (
                <div key={n as string} className="flex items-center justify-between p-2.5 rounded-xl"
                  style={{ background: WHITE, border: `1px solid ${BORDER}` }}>
                  <span className="text-[11px] truncate ms-2" style={{ color: BODY }}>{n as string}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${c as string}15`, color: c as string }}>{s as string}</span>
                </div>
              ))}
            </div>
          )}
          {(active === 2 || active === 3 || active === 4) && (
            <div className="h-full flex items-center justify-center py-10">
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: ACCENT_M }}>
                  <BarChart3 className="w-5 h-5" style={{ color: ACCENT }} />
                </div>
                <p className="text-xs font-medium" style={{ color: DARK }}>{TABS[active]}</p>
                <p className="text-[10px] mt-1" style={{ color: MUTED }}>بيانات حية ومحدّثة</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── AI Chat Mock ─────────────────────────────────────── */
function AIChatMock() {
  const [phase, setPhase] = useState(0);
  const DELAYS = [700, 800, 1600, 1000, 800, 1700, 800, 3200];
  useEffect(() => {
    const d = DELAYS[Math.min(phase, DELAYS.length - 1)];
    const t = setTimeout(() => setPhase(p => (p >= 8 ? 0 : p + 1)), d);
    return () => clearTimeout(t);
  }, [phase]);
  const Bubble = ({ children, fromUser, isAction }: { children: React.ReactNode; fromUser?: boolean; isAction?: boolean }) => {
    if (isAction) return (
      <div className="flex justify-center">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
          style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.2)" }}>
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />{children}
        </div>
      </div>
    );
    return (
      <div className={`flex ${fromUser ? "justify-start" : "justify-end"}`}>
        <div className="max-w-[88%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed text-right"
          style={fromUser
            ? { background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)", borderRadius: "16px 16px 16px 4px" }
            : { background: ACCENT, color: WHITE, borderRadius: "16px 16px 4px 16px" }}>
          {children}
        </div>
      </div>
    );
  };
  const TypingDots = () => (
    <div className="flex justify-end">
      <div className="px-4 py-3 rounded-2xl flex items-center gap-1.5" style={{ background: ACCENT, borderRadius: "16px 16px 4px 16px" }}>
        {[0, 1, 2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full bg-white animate-bounce"
            style={{ animationDelay: `${i * 0.18}s`, animationDuration: "0.9s" }} />
        ))}
      </div>
    </div>
  );
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: PRIMARY, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 80px rgba(11,31,59,0.35)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ACCENT, boxShadow: `0 4px 12px rgba(37,99,235,0.4)` }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">المساعد القانوني — عدالة AI</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>مدعوم بـ Gemini + Claude</p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#34D399" }}>
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />متصل
        </span>
      </div>
      <div className="flex-1 px-4 py-4 space-y-3" style={{ minHeight: 260 }}>
        {phase >= 1 && <Bubble fromUser>اكتب لي عقد إيجار تجاري لمحل في الرياض لمدة سنتين</Bubble>}
        {phase === 2 && <TypingDots />}
        {phase >= 3 && (
          <Bubble>
            <p className="font-semibold mb-1">تم إنشاء عقد الإيجار التجاري ✅</p>
            <p className="text-xs opacity-75">١٤ بنداً • متوافق مع نظام الإيجار السعودي ١٤٤٣هـ</p>
          </Bubble>
        )}
        {phase >= 4 && <Bubble fromUser>أضف شرط غرامة تأخير 5% شهرياً</Bubble>}
        {phase === 5 && <TypingDots />}
        {phase >= 6 && <Bubble>تم إضافة البند ١٥: غرامة التأخير ✓ — العقد محدَّث وجاهز</Bubble>}
        {phase >= 7 && <Bubble isAction>العقد جاهز للتوقيع الإلكتروني • تم الحفظ في ملف العميل</Bubble>}
      </div>
      <div className="px-4 pb-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="flex-1 text-sm text-right" style={{ color: "rgba(255,255,255,0.25)" }}>اسأل المساعد القانوني...</span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: ACCENT }}>
            <ArrowLeft className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── FAQ accordion ────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{ borderColor: open ? `${ACCENT}50` : BORDER, background: open ? ACCENT_L : WHITE,
               boxShadow: open ? `0 4px 20px rgba(37,99,235,0.10)` : "0 1px 3px rgba(0,0,0,0.04)" }}
      onClick={() => setOpen(p => !p)}>
      <div className="flex items-center justify-between px-6 py-4 gap-4">
        <span className="font-semibold text-sm md:text-base" style={{ color: open ? ACCENT : DARK }}>{q}</span>
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all"
          style={{ background: open ? ACCENT : BG2 }}>
          {open ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4" style={{ color: MUTED }} />}
        </div>
      </div>
      <div style={{ maxHeight: open ? "400px" : "0", overflow: "hidden", transition: "max-height 0.3s ease" }}>
        <p className="px-6 pb-5 text-sm leading-relaxed" style={{ color: BODY, lineHeight: "1.8" }}>{a}</p>
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

/* ══════════════════════════════════════════════════════════════════
   MAIN LANDING COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function Landing() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [pricingAnnual, setPricingAnnual] = useState(false);

  const urlVariant = new URLSearchParams(window.location.search).get("preview");
  const { data: variantData } = useQuery<{ variant: string }>({
    queryKey: ["landing-variant-public"],
    queryFn: () => fetch(`${BASE}/api/landing-variant`).then(r => r.json()).catch(() => ({ variant: "original" })),
    staleTime: 1000 * 60, enabled: !urlVariant,
  });
  const { data: cms } = useQuery({
    queryKey: ["home-cms"],
    queryFn: () => fetch(`${BASE}/api/home/content`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    staleTime: 5 * 60 * 1000, retry: false,
  });

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

  const activeVariant = urlVariant ?? variantData?.variant ?? "original";
  if (activeVariant === "bento")   return <LandingBento />;
  if (activeVariant === "stripe")  return <LandingStripe />;
  if (activeVariant === "hubspot") return <LandingHubspot />;

  function c(section: string, key: string, fallback: string): string {
    return (cms?.[section]?.[key] as string | undefined) || fallback;
  }

  /* Live billing plans */
  const { data: livePlansRaw = [] } = useQuery<any[]>({
    queryKey: ["billing-plans"],
    queryFn: () => fetch(`${BASE}/api/billing/plans`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).catch(() => []),
    staleTime: 10 * 60 * 1000, retry: false,
  });

  const pricingPlans = (() => {
    if (livePlansRaw.length > 0) {
      const freePlan = livePlansRaw.find(p => p.isFree && !p.isContactOnly) ?? livePlansRaw[0];
      const popPlan  = livePlansRaw.find(p => p.recommended) ?? livePlansRaw[2];
      const entPlan  = livePlansRaw.find(p => p.isContactOnly) ?? livePlansRaw[livePlansRaw.length - 1];
      return [freePlan, popPlan, entPlan].map(p => ({
        name:        p.nameAr ?? p.name ?? "",
        monthly:     p.monthlyPrice ?? 0,
        yearly:      p.yearlyPrice  ?? Math.round((p.monthlyPrice ?? 0) * 0.8),
        isContact:   p.isContactOnly ?? false,
        isFree:      p.isFree ?? false,
        features:    Array.isArray(p.features) ? p.features : [],
      }));
    }
    return [
      { name: "استكشف",  monthly: 0,   yearly: 0,   isContact: false, isFree: true,  features: ["٥ قضايا", "مستخدم واحد", "١ جيجا تخزين", "٥٬٠٠٠ AI credit", "تذكيرات ذكية", "تقويم قانوني", "تصدير PDF"] },
      { name: "أتقن",    monthly: 899, yearly: 719,  isContact: false, isFree: false, features: ["٥ مستخدمين", "٥٠ جيجا تخزين", "١٠٠٬٠٠٠ AI credit/شهر", "🤖 AI متقدم", "📊 تحليلات AI", "🔍 OCR", "💾 نسخ احتياطي يومي", "تقارير + KPIs"] },
      { name: "الأسطورة", monthly: 0,  yearly: 0,   isContact: true,  isFree: false, features: ["كل شيء غير محدود", "AI مدرَّب على بياناتك", "بنية تحتية خاصة", "SLA 99.99%", "مدير نجاح مخصص", "هجرة مجانية"] },
    ];
  })();

  const faqItems = (t("landing.faq.items", { returnObjects: true }) as { q: string; a: string }[]);
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

  const NAV = [
    { label: "المميزات",  href: "#features" },
    { label: "الذكاء AI", href: "#ai"       },
    { label: "الأسعار",   href: "#pricing"  },
    { label: "الأسئلة",   href: "#faq"      },
  ];

  /* ── Data ─────────────────────────────────────────────── */
  const FEATURES = [
    { icon: Scale,     color: ACCENT,    bg: ACCENT_M,  title: "إدارة القضايا",        desc: "تتبع كامل للقضايا والجلسات والمستندات في نظام مركزي واحد مع مؤشرات حية" },
    { icon: Bot,       color: "#7C3AED", bg: "#EDE9FE", title: "مساعد AI القانوني",     desc: "يصيغ العقود، يحلل القضايا، ويوصي بالاستراتيجيات القانونية بالعربية" },
    { icon: Users,     color: "#0891B2", bg: "#CFFAFE", title: "إدارة العملاء CRM",     desc: "ملف شامل لكل موكل مع بوابة إلكترونية وسجل تواصل كامل" },
    { icon: Receipt,   color: WARN,      bg: "#FEF3C7", title: "الفوترة والمحاسبة",     desc: "فواتير إلكترونية، تتبع مدفوعات، وتقارير مالية بمحاسبة مزدوجة القيود" },
    { icon: FileText,  color: "#0891B2", bg: "#CFFAFE", title: "العقود والمستندات",      desc: "أرشفة تلقائية، بحث فوري بـ OCR، وتوقيع إلكتروني معتمد" },
    { icon: BarChart3, color: "#DC2626", bg: "#FEE2E2", title: "التقارير والتحليلات",    desc: "مؤشرات أداء لحظية وتحليلات AI لاتخاذ قرارات أذكى" },
  ];

  const STATS = [
    { to: 850,   suffix: "+",    label: "مكتب قانوني",       icon: Building2, color: ACCENT    },
    { to: 50000, suffix: "+",    label: "قضية مُدارة",       icon: Scale,     color: "#7C3AED" },
    { to: 99,    suffix: ".9%",  label: "وقت تشغيل مستمر",  icon: Shield,    color: SUCCESS   },
    { to: 40,    suffix: "%",    label: "توفير في الوقت",    icon: Zap,       color: WARN      },
  ];

  const TESTIMONIALS = [
    { name: "م. خالد العمري",  role: "مكتب العمري للمحاماة — الرياض",             avatar: "خ", color: ACCENT,    stars: 5, text: "عدالة AI غيّرت طريقة عمل مكتبنا بالكامل. كنا نُضيع ساعات في إدارة الملفات يدوياً، الآن كل شيء في مكان واحد والنظام يُذكّرنا بالجلسات تلقائياً." },
    { name: "أ. نورة الشمري", role: "مستشارة قانونية — مكتب الشمري — جدة",       avatar: "ن", color: "#7C3AED", stars: 5, text: "أفضل استثمار قمت به لمكتبي. الفوترة والتحصيل أصبحا أوتوماتيكياً، والعملاء يحبون بوابة التتبع الإلكترونية. وفّرت 40% من وقتي الإداري." },
    { name: "م. سالم الزهراني", role: "مدير شراكات — مجموعة الزهراني القانونية", avatar: "س", color: SUCCESS,   stars: 5, text: "ندير 3 مكاتب في مدن مختلفة من لوحة تحكم واحدة. المساعد الذكي يوفر علينا ساعات في صياغة العقود. المنصة احترافية وتستحق كل ريال." },
  ];

  const COMPARISON_ROWS = [
    { feature: "تتبع القضايا والمواعيد",        traditional: "ورقي / جداول بيانات",  adalah: "لوحة تحكم ذكية مع تنبيهات فورية" },
    { feature: "إدارة المستندات",               traditional: "مجلدات وملفات يدوية",   adalah: "OCR + بحث فوري + أرشفة تلقائية" },
    { feature: "التواصل مع العملاء",            traditional: "هاتف وبريد إلكتروني",  adalah: "بوابة إلكترونية + WhatsApp + Telegram" },
    { feature: "التقارير المالية",              traditional: "Excel يدوي",             adalah: "تقارير لحظية + محاسبة مزدوجة" },
    { feature: "الذكاء الاصطناعي",             traditional: "❌ غير متوفر",           adalah: "صياغة عقود + تحليل قضايا + توصيات" },
    { feature: "بوابة الموكّلين الإلكترونية",  traditional: "❌ غير متوفر",           adalah: "متابعة القضايا وتحميل الوثائق 24/7" },
  ];

  const AI_STEPS = [
    { step: "١", icon: <FileSearch className="w-6 h-6" style={{ color: ACCENT }} />,    title: "يقرأ ويفهم",    desc: "يحلل القضايا والمستندات فوراً ويستخرج المعلومات الأساسية",   color: ACCENT,    bg: ACCENT_M  },
    { step: "٢", icon: <Brain className="w-6 h-6" style={{ color: "#7C3AED" }} />,       title: "يُفكّر ويقترح", desc: "يقدم توصيات قانونية مدعومة بالأدلة ويصيغ المستندات بدقة",  color: "#7C3AED", bg: "#EDE9FE" },
    { step: "٣", icon: <Zap className="w-6 h-6" style={{ color: SUCCESS }} />,           title: "يُنجز ويُتابع", desc: "يرسل التذكيرات، يولّد الفواتير، ويتابع المواعيد تلقائياً", color: SUCCESS,   bg: "#D1FAE5" },
  ];

  /* ══ RENDER ══════════════════════════════════════════════════════ */
  return (
    <div dir="rtl" style={{ background: WHITE, color: DARK, fontFamily: "'Tajawal', sans-serif" }}>

      {/* ══ NAVBAR ═══════════════════════════════════════════════ */}
      <nav className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.97)" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${scrolled ? BORDER : "rgba(229,231,235,0.5)"}`,
          boxShadow: scrolled ? "0 1px 16px rgba(11,31,59,0.07)" : "none",
        }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, boxShadow: `0 4px 12px rgba(37,99,235,0.30)` }}>
                <Scale className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <span className="font-black text-base sm:text-lg" style={{ color: DARK }}>عدالة <span style={{ color: ACCENT }}>AI</span></span>
                <div className="hidden sm:block text-[10px] leading-none" style={{ color: MUTED }}>منصة قانونية ذكية</div>
              </div>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {NAV.map(n => (
              <a key={n.href} href={n.href}
                className="px-3.5 py-2 rounded-lg text-sm font-medium transition-all hover:bg-slate-100 hover:text-blue-600"
                style={{ color: BODY }}>
                {n.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href={`${BASE}/sign-in`}>
              <button className="hidden md:block text-sm font-semibold px-4 py-2 rounded-xl transition-colors hover:bg-slate-100"
                style={{ color: DARK }}>
                تسجيل الدخول
              </button>
            </Link>
            <Link href={`${BASE}/demo-login`}>
              <button className="hidden md:flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border transition-all hover:bg-slate-50 hover:border-blue-300"
                style={{ borderColor: BORDER2, color: DARK }}>
                <Play className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                عرض تجريبي
              </button>
            </Link>
            <Link href={`${BASE}/sign-up`}>
              <button className="text-sm font-bold px-5 py-2.5 rounded-xl transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: WHITE, boxShadow: `0 4px 14px rgba(37,99,235,0.28)` }}>
                ابدأ مجاناً
              </button>
            </Link>
            <button className="md:hidden p-2 rounded-lg" onClick={() => setMenuOpen(p => !p)} style={{ color: DARK }}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden px-5 pb-4 pt-2 space-y-1 border-t" style={{ background: WHITE, borderColor: BORDER }}>
            {NAV.map(n => (
              <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 rounded-xl text-sm font-medium hover:bg-slate-50"
                style={{ color: BODY }}>
                {n.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t" style={{ borderColor: BORDER }}>
              <Link href={`${BASE}/sign-up`}>
                <button className="w-full py-3 rounded-xl text-sm font-bold" onClick={() => setMenuOpen(false)}
                  style={{ background: ACCENT, color: WHITE }}>
                  ابدأ مجاناً لمدة 90 يوماً
                </button>
              </Link>
              <Link href={`${BASE}/demo-login`}>
                <button className="w-full py-3 rounded-xl text-sm font-semibold" onClick={() => setMenuOpen(false)}
                  style={{ background: ACCENT_L, color: ACCENT, border: `1px solid ${ACCENT_T}` }}>
                  🎯 احجز عرضاً تجريبياً
                </button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══ 1. HERO ═══════════════════════════════════════════════ */}
      <section id="hero" className="relative flex flex-col items-center px-6 pt-24 sm:pt-28 pb-0 overflow-hidden"
        style={{ background: `linear-gradient(160deg, #F0F6FF 0%, ${BG} 45%, #EEF2FF 100%)` }}>

        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-1/3 w-[600px] h-[600px] rounded-full blur-[180px] opacity-50"
            style={{ background: ACCENT_M }} />
          <div className="absolute top-20 left-1/4 w-[400px] h-[400px] rounded-full blur-[140px] opacity-35"
            style={{ background: "#E0E7FF" }} />
          <div className="absolute inset-0 opacity-[0.022]"
            style={{ backgroundImage: `radial-gradient(circle, ${DARK} 1.2px, transparent 1.2px)`, backgroundSize: "28px 28px" }} />
        </div>

        <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center text-center">

          {/* Badge */}
          <div className="lp-hero-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6"
            style={{ background: ACCENT_M, border: `1px solid ${ACCENT_T}`, color: ACCENT_D }}>
            <Sparkles className="w-3.5 h-3.5" />
            منصة #١ لإدارة المكاتب القانونية في السعودية والخليج
          </div>

          {/* H1 */}
          <h1 className="lp-hero-1 font-black leading-[1.1] mb-5 text-right sm:text-center"
            style={{ fontSize: "clamp(36px, 5.5vw, 68px)", color: DARK, letterSpacing: "-0.03em" }}>
            أدِر قضاياك وعملاءك<br />
            <span style={{ color: ACCENT }}>بذكاء اصطناعي</span> لا مثيل له
          </h1>

          {/* Sub */}
          <p className="lp-hero-2 text-lg sm:text-xl mb-8 leading-[1.8] max-w-2xl" style={{ color: BODY, opacity: 0.85 }}>
            منصة SaaS متكاملة تجمع القضايا، العقود، الموكّلين، الفواتير، والموارد البشرية — مع مساعد AI يعمل بالعربية على مدار الساعة.
          </p>

          {/* CTAs */}
          <div className="lp-hero-3 flex flex-col sm:flex-row items-center gap-3 mb-6">
            <Link href={`${BASE}/sign-up`}>
              <button className="flex items-center gap-2.5 font-bold px-8 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 w-full sm:w-auto justify-center"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: WHITE, boxShadow: `0 8px 28px rgba(37,99,235,0.35)`, minHeight: 54 }}>
                <ArrowLeft className="w-4 h-4" />
                ابدأ مجاناً — 90 يوماً
              </button>
            </Link>
            <Link href={`${BASE}/demo-login`}>
              <button className="flex items-center gap-2 font-semibold px-6 py-4 rounded-xl text-base border-2 transition-all hover:bg-white hover:shadow-md w-full sm:w-auto justify-center"
                style={{ borderColor: BORDER2, color: DARK, background: WHITE, minHeight: 54 }}>
                <Play className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />
                شاهد العرض التجريبي
              </button>
            </Link>
          </div>

          {/* Trust chips */}
          <div className="lp-hero-4 flex items-center justify-center gap-4 flex-wrap mb-10">
            {["بدون بطاقة ائتمان", "إعداد في ٥ دقائق", "دعم عربي 24/7", "بيانات آمنة 100%"].map(label => (
              <span key={label} className="flex items-center gap-1.5 text-sm" style={{ color: MUTED }}>
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: SUCCESS }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Product mock ──────────────────────────────── */}
        <div className="lp-hero-mock relative w-full max-w-6xl mx-auto">

          {/* Floating stat cards */}
          <div className="absolute -top-5 right-6 sm:right-12 z-10">
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-xl"
              style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#D1FAE5" }}>
                <CheckCircle className="w-3.5 h-3.5" style={{ color: SUCCESS }} />
              </div>
              <div>
                <div className="text-[10px] font-medium" style={{ color: MUTED }}>قضية جديدة</div>
                <div style={{ color: SUCCESS }}>تم الفوز — العمري vs الأمل</div>
              </div>
            </div>
          </div>

          <div className="absolute -top-5 left-6 sm:left-12 z-10">
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-xl"
              style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#EDE9FE" }}>
                <Calendar className="w-3.5 h-3.5" style={{ color: "#7C3AED" }} />
              </div>
              <div>
                <div className="text-[10px] font-medium" style={{ color: MUTED }}>جلسة اليوم</div>
                <div style={{ color: "#7C3AED" }}>محكمة التجارية — ١٢:٠٠</div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-5 left-6 sm:left-12 z-10">
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-xl"
              style={{ background: PRIMARY, color: WHITE, boxShadow: "0 8px 24px rgba(11,31,59,0.25)" }}>
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              <span>٨٥٠+ مكتب نشط الآن</span>
            </div>
          </div>

          <div className="absolute -bottom-5 right-6 sm:right-12 z-10">
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-xl"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: WHITE, boxShadow: `0 8px 24px rgba(37,99,235,0.30)` }}>
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>AI أنجز ١٢ مهمة اليوم</span>
            </div>
          </div>

          {/* Gradient fade into next section */}
          <div className="absolute bottom-0 inset-x-0 h-20 z-10 pointer-events-none"
            style={{ background: `linear-gradient(to bottom, transparent, ${PRIMARY})` }} />

          <DashboardMock />
        </div>
      </section>

      {/* ══ 2. STATS ══════════════════════════════════════════════ */}
      <section style={{ background: PRIMARY, padding: "80px 24px", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "50%", right: "15%", width: 360, height: 360, borderRadius: "50%", background: `${ACCENT}15`, filter: "blur(100px)", transform: "translateY(-50%)" }} />
          <div style={{ position: "absolute", top: "50%", left: "15%",  width: 280, height: 280, borderRadius: "50%", background: "#7C3AED15", filter: "blur(90px)",  transform: "translateY(-50%)" }} />
        </div>
        <div className="max-w-5xl mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {STATS.map((s, i) => {
              const Icon = s.icon;
              return (
                <FadeIn key={s.label} delay={i * 0.07}>
                  <div className="text-center py-8 px-4 rounded-2xl transition-transform hover:-translate-y-1"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                      style={{ background: `${s.color}20`, border: `1px solid ${s.color}30` }}>
                      <Icon className="w-5 h-5" style={{ color: s.color }} />
                    </div>
                    <div className="text-3xl sm:text-4xl font-black mb-1" style={{ color: s.color }}>
                      <Counter to={s.to} suffix={s.suffix} locale={counterLocale} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ 3. PLATFORM SHOWCASE ══════════════════════════════════ */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PlatformShowcase />
      </Suspense>

      {/* ══ 4. FEATURES BENTO GRID ════════════════════════════════ */}
      <section id="features" className="py-24 px-6 overflow-hidden" style={{ background: BG }}>
        <div className="max-w-7xl mx-auto">

          <FadeIn className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: ACCENT_M, color: ACCENT, border: `1px solid ${ACCENT_T}` }}>
              المميزات الرئيسية
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              كل ما يحتاجه مكتبك في منصة واحدة
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: BODY }}>
              أكثر من ٣٠ وحدة متكاملة مصممة خصيصاً للمكاتب القانونية العربية
            </p>
          </FadeIn>

          {/* Bento grid: row 1 = 2 large + row 2 = 4 small */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {FEATURES.slice(0, 2).map((f, i) => {
              const Icon = f.icon;
              return (
                <FadeIn key={i} delay={i * 0.08}>
                  <div className="group p-8 rounded-2xl h-full flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-default relative overflow-hidden"
                    style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                    {/* Gradient accent top-right corner */}
                    <div className="absolute top-0 left-0 w-32 h-32 rounded-br-[80px] opacity-[0.06]"
                      style={{ background: f.color }} />
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: f.bg, boxShadow: `0 4px 12px ${f.color}20` }}>
                      <Icon className="w-7 h-7" style={{ color: f.color }} />
                    </div>
                    <div>
                      <h3 className="font-black text-xl mb-2" style={{ color: DARK }}>{f.title}</h3>
                      <p className="text-base leading-relaxed" style={{ color: BODY }}>{f.desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold mt-auto pt-2"
                      style={{ color: f.color }}>
                      اكتشف المزيد
                      <ChevronLeft className="w-4 h-4 group-hover:translate-x-[-4px] transition-transform" />
                    </div>
                  </div>
                </FadeIn>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.slice(2).map((f, i) => {
              const Icon = f.icon;
              return (
                <FadeIn key={i} delay={i * 0.06 + 0.12}>
                  <div className="group p-6 rounded-2xl h-full flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-default"
                    style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: f.bg }}>
                      <Icon className="w-5.5 h-5.5" style={{ color: f.color }} />
                    </div>
                    <h3 className="font-bold text-sm mb-2" style={{ color: DARK }}>{f.title}</h3>
                    <p className="text-sm leading-relaxed flex-1" style={{ color: BODY, lineHeight: "1.7" }}>{f.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ 5. AI SECTION ════════════════════════════════════════ */}
      <section id="ai" className="py-24 px-6 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-16">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: "#D1FAE5", color: SUCCESS, border: "1px solid #A7F3D0" }}>
              الذكاء الاصطناعي
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              مساعد AI في كل خطوة من عملك
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: BODY }}>
              يفهم، يقترح، ويُنجز — باللغة العربية — طوال اليوم
            </p>
          </FadeIn>

          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div className="space-y-4">
              {AI_STEPS.map((step, i) => (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className="flex gap-4 p-6 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ background: BG, border: `1px solid ${BORDER}` }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: step.bg, border: `1px solid ${step.color}20` }}>
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white"
                          style={{ background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)` }}>
                          {step.step}
                        </span>
                        <h3 className="font-bold text-base" style={{ color: DARK }}>{step.title}</h3>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: BODY }}>{step.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
              <FadeIn delay={0.35}>
                <Link href={`${BASE}/sign-up`}>
                  <button className="flex items-center gap-2 font-bold px-7 py-3.5 rounded-xl text-sm transition-all hover:opacity-90 hover:scale-[1.01]"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: WHITE, boxShadow: `0 4px 16px rgba(37,99,235,0.25)` }}>
                    <ArrowLeft className="w-4 h-4" />
                    جرّب الذكاء الاصطناعي الآن مجاناً
                  </button>
                </Link>
              </FadeIn>
            </div>
            <FadeIn delay={0.15}><AIChatMock /></FadeIn>
          </div>
        </div>
      </section>

      {/* ══ 6. PAYMENT SHOWCASE ══════════════════════════════════ */}
      <Suspense fallback={<ShowcasePlaceholder />}>
        <PaymentShowcase />
      </Suspense>

      {/* ══ 7. WHY ADALAH — Comparison ════════════════════════════ */}
      <section className="py-24 px-6 overflow-hidden" style={{ background: BG }}>
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
              لماذا عدالة AI؟
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              عدالة AI مقابل الطريقة التقليدية
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: BODY }}>
              المكاتب التي تعمل بعدالة AI تُنجز ضعف العمل في نصف الوقت
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, boxShadow: "0 4px 32px rgba(0,0,0,0.07)" }}>
              {/* Table header */}
              <div className="grid grid-cols-3 text-center" style={{ background: PRIMARY }}>
                <div className="px-6 py-5 text-sm font-bold text-right" style={{ color: "rgba(255,255,255,0.5)" }}>المقارنة</div>
                <div className="px-6 py-5 text-sm font-bold border-x border-white/10" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <div className="flex items-center justify-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    المكتب التقليدي
                  </div>
                </div>
                <div className="px-6 py-5" style={{}}>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: WHITE }}>
                    <Scale className="w-3.5 h-3.5" />
                    عدالة AI
                  </div>
                </div>
              </div>

              {/* Rows */}
              {COMPARISON_ROWS.map((row, i) => (
                <div key={i} className="grid grid-cols-3 border-t transition-colors hover:bg-blue-50/40"
                  style={{ borderColor: BORDER, background: i % 2 === 0 ? WHITE : BG }}>
                  <div className="px-5 py-4 text-sm font-semibold text-right" style={{ color: DARK }}>{row.feature}</div>
                  <div className="px-5 py-4 text-sm text-center border-x" style={{ borderColor: BORDER, color: "#EF4444" }}>
                    <span className="flex items-center justify-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      {row.traditional}
                    </span>
                  </div>
                  <div className="px-5 py-4 text-sm text-center" style={{ color: SUCCESS }}>
                    <span className="flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      {row.adalah}
                    </span>
                  </div>
                </div>
              ))}

              {/* CTA row */}
              <div className="grid grid-cols-3 border-t" style={{ borderColor: BORDER, background: ACCENT_L }}>
                <div className="px-5 py-5 text-sm font-bold" style={{ color: DARK }}>ابدأ رحلة التحول</div>
                <div className="px-5 py-5 text-center border-x" style={{ borderColor: BORDER, color: MUTED, fontSize: "12px" }}>لا يتوفر</div>
                <div className="px-5 py-5 text-center">
                  <Link href={`${BASE}/sign-up`}>
                    <button className="text-sm font-bold px-5 py-2 rounded-xl transition-all hover:opacity-90"
                      style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: WHITE, boxShadow: `0 4px 12px rgba(37,99,235,0.25)` }}>
                      ابدأ مجاناً →
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ 8. SPECIALIZED SOLUTIONS — عدالة إفلاس ═══════════════ */}
      <section className="py-24 px-6 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA" }}>
              حلول متخصصة
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              عدالة إفلاس
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: BODY }}>
              منصة متخصصة لإدارة الإفلاس وإعادة التنظيم المالي والتصفية والتسوية الوقائية —
              مع بوابة دائنين ومساعد ذكاء اصطناعي وإدارة متكاملة
            </p>
          </FadeIn>

          {/* Feature tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {[
              { icon: <Scale className="w-6 h-6" style={{ color: "#EA580C" }} />, bg: "#FFF7ED",
                title: "إدارة ملفات الإفلاس", desc: "تتبع كامل لمسار الإفلاس من الإيداع حتى إقفال الملف — مراحل آلية وتنبيهات ذكية" },
              { icon: <Users className="w-6 h-6" style={{ color: "#7C3AED" }} />, bg: "#F5F3FF",
                title: "بوابة الدائنين العامة", desc: "بوابة علنية متكاملة تُتيح تقديم المطالبات ومتابعتها إلكترونياً مع تتبع لحظي للحالة" },
              { icon: <Brain className="w-6 h-6" style={{ color: "#0369A1" }} />, bg: "#F0F9FF",
                title: "مساعد AI للإفلاس", desc: "ذكاء اصطناعي متخصص في قانون الإفلاس يُحلّل الملفات ويُقترح الإجراءات ويُعدّ التقارير" },
              { icon: <DollarSign className="w-6 h-6" style={{ color: "#16A34A" }} />, bg: "#F0FDF4",
                title: "إدارة التوزيعات", desc: "حساب حصص الدائنين وتوزيع عائدات الأصول وفق أولويات الضمانات القانونية تلقائياً" },
              { icon: <FileText className="w-6 h-6" style={{ color: "#D97706" }} />, bg: "#FFFBEB",
                title: "إدارة الأصول والتقييم", desc: "جرد وتقييم وبيع الأصول — لوحة تحكم كاملة مع ربط بمكاتب التقييم المعتمدة" },
              { icon: <Shield className="w-6 h-6" style={{ color: "#DC2626" }} />, bg: "#FFF1F2",
                title: "لوحة الأمين التنفيذية", desc: "تقارير اللجان والمحكمة، ملفات الامتثال، وسجلات الإجراءات كاملاً في مكان واحد" },
            ].map((f, i) => (
              <FadeIn key={i} delay={i * 0.07}>
                <div className="p-6 rounded-2xl flex gap-4 h-full transition-all hover:-translate-y-1 hover:shadow-lg"
                  style={{ background: f.bg, border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="font-black text-sm mb-1.5" style={{ color: DARK }}>{f.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: BODY }}>{f.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Bankruptcy Pricing Preview */}
          <FadeIn delay={0.2}>
            <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(160deg, #1C0533 0%, #0F172A 100%)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="px-8 py-10 text-center text-white">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold mb-4"
                  style={{ background: "rgba(234,88,12,0.25)", color: "#FCA672", border: "1px solid rgba(234,88,12,0.3)" }}>
                  <Scale className="w-3.5 h-3.5" />
                  عدالة إفلاس — باقات متخصصة
                </div>
                <h3 className="text-2xl font-black mb-2">ابدأ بالباقة التي تناسبك</h3>
                <p className="text-sm text-white/60 mb-8">ثلاث باقات مصممة لكل حجم من حجوم مكاتب الإفلاس والإعادة الهيكلة</p>

                <div className="grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  {[
                    { name: "بداية",    price: "١٬٩٩٩", tag: null,         color: "#EA580C", badge: "للمكاتب الصغيرة",      features: ["٥ ملفات نشطة", "٣ مستخدمين", "بوابة الدائنين", "إدارة المطالبات"] },
                    { name: "احتراف",   price: "٤٬٩٩٩", tag: "الأكثر طلباً", color: "#7C3AED", badge: "لأمناء الإفلاس",      features: ["٢٥ ملف نشط", "مساعد AI", "التوزيعات", "تحليلات متقدمة"] },
                    { name: "مؤسسات",   price: "٩٬٩٩٩", tag: null,         color: "#94A3B8", badge: "للمجموعات الكبرى",    features: ["ملفات غير محدودة", "API كامل", "وايت لابل", "دعم ٢٤/٧"] },
                  ].map((p, i) => (
                    <div key={i} className="relative p-5 rounded-2xl text-center flex flex-col"
                      style={{
                        background: i === 1 ? `linear-gradient(160deg, ${p.color}30, ${p.color}15)` : "rgba(255,255,255,0.05)",
                        border: `1px solid ${i === 1 ? p.color + "50" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {p.tag && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-black px-3 py-1 rounded-full whitespace-nowrap"
                          style={{ background: p.color, color: "#fff" }}>
                          {p.tag}
                        </div>
                      )}
                      <div className="text-xs font-bold text-white/50 mb-1">{p.badge}</div>
                      <div className="font-black text-2xl text-white mb-0.5">{p.name}</div>
                      <div className="text-sm text-white/60 mb-4">
                        <span className="text-xl font-black text-white">{p.price}</span> ريال/شهر
                      </div>
                      <ul className="space-y-1.5 mb-5 flex-1">
                        {p.features.map((f: string, fi: number) => (
                          <li key={fi} className="flex items-center gap-1.5 text-xs text-left rtl:text-right">
                            <CheckCircle className="w-3 h-3 shrink-0" style={{ color: p.color }} />
                            <span className="text-white/70">{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Link href="/pricing?product=bankruptcy">
                        <button className="w-full py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                          style={i === 1
                            ? { background: p.color, color: "#fff" }
                            : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          اشترك الآن
                        </button>
                      </Link>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <Link href="/pricing?product=bankruptcy">
                    <button className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
                      style={{ background: "#EA580C", color: "#fff", boxShadow: "0 4px 16px rgba(234,88,12,0.3)" }}>
                      <Scale className="w-4 h-4" />
                      عرض باقات عدالة إفلاس كاملاً
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ 9. PRICING ═══════════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6 overflow-hidden" style={{ background: WHITE }}>
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-12">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-5 inline-block"
              style={{ background: ACCENT_M, color: ACCENT, border: `1px solid ${ACCENT_T}` }}>
              {t("landing.pricing.label")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-3" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              {t("landing.pricing.title")}
            </h2>
            <p className="text-lg max-w-xl mx-auto mb-6" style={{ color: BODY }}>
              {t("landing.pricing.subtitle")}
            </p>

            {/* Annual/Monthly toggle */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl" style={{ background: BG2, border: `1px solid ${BORDER}` }}>
              <button
                onClick={() => setPricingAnnual(false)}
                className="px-5 py-2 rounded-lg text-sm font-bold transition-all"
                style={!pricingAnnual
                  ? { background: WHITE, color: ACCENT, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }
                  : { color: MUTED }}>
                شهري
              </button>
              <button
                onClick={() => setPricingAnnual(true)}
                className="px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                style={pricingAnnual
                  ? { background: WHITE, color: ACCENT, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }
                  : { color: MUTED }}>
                سنوي
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "#D1FAE5", color: SUCCESS }}>
                  وفّر 20%
                </span>
              </button>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingPlans.slice(0, 3).map((p, i) => {
              const isPopular = i === 1;
              const isContact = p.isContact;
              const displayPrice = pricingAnnual ? p.yearly : p.monthly;
              return (
                <FadeIn key={i} delay={i * 0.1}>
                  <div className="p-7 rounded-2xl h-full flex flex-col relative overflow-hidden transition-all duration-300 hover:-translate-y-1"
                    style={{
                      background: isPopular ? `linear-gradient(160deg, ${PRIMARY} 0%, #0F2D5C 100%)` : WHITE,
                      border: isPopular ? `2px solid ${ACCENT}50` : `1px solid ${BORDER}`,
                      boxShadow: isPopular ? `0 12px 48px rgba(11,31,59,0.20), 0 0 0 1px ${ACCENT}20` : "0 2px 12px rgba(0,0,0,0.05)",
                    }}>

                    {/* Popular glow */}
                    {isPopular && (
                      <div className="absolute top-0 left-0 w-full h-24 opacity-20 pointer-events-none"
                        style={{ background: `radial-gradient(ellipse at 50% 0%, ${ACCENT} 0%, transparent 70%)` }} />
                    )}

                    {isPopular && (
                      <div className="absolute top-5 left-5 z-10 text-xs font-black px-3 py-1.5 rounded-full"
                        style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: WHITE, boxShadow: `0 4px 12px rgba(37,99,235,0.35)` }}>
                        {t("landing.pricing.mostPopular")}
                      </div>
                    )}

                    <div className={isPopular ? "mt-7" : ""}>
                      <p className="font-bold text-xs tracking-widest uppercase mb-4"
                        style={{ color: isPopular ? "rgba(255,255,255,0.45)" : MUTED }}>
                        {p.name}
                      </p>
                      <div className="mb-6 flex items-end gap-1">
                        {isContact ? (
                          <span className="text-2xl font-black" style={{ color: isPopular ? WHITE : DARK }}>تواصل معنا</span>
                        ) : (
                          <>
                            <span className="text-4xl font-black leading-none" style={{ color: isPopular ? WHITE : DARK }}>
                              {p.isFree ? "مجاناً" : displayPrice.toLocaleString("ar-SA")}
                            </span>
                            {!p.isFree && (
                              <span className="text-sm mb-1 me-1" style={{ color: isPopular ? "rgba(255,255,255,0.45)" : MUTED }}>
                                ريال/{pricingAnnual ? "شهر" : "شهر"}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {pricingAnnual && !p.isFree && !p.isContact && p.yearly > 0 && (
                        <div className="mb-4 text-xs font-semibold px-3 py-1 rounded-full inline-block"
                          style={{ background: isPopular ? "rgba(255,255,255,0.10)" : "#D1FAE5", color: isPopular ? "#86EFAC" : SUCCESS }}>
                          💰 تدفع سنوياً — وفّر {((p.monthly - p.yearly) * 12).toLocaleString("ar-SA")} ريال
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2.5 flex-1 mb-7">
                      {p.features.map((f: string, fi: number) => (
                        <li key={fi} className="flex items-start gap-2.5 text-sm"
                          style={{ color: isPopular ? "rgba(255,255,255,0.80)" : BODY }}>
                          <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: isPopular ? ACCENT_T : ACCENT }} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link href={isContact ? "#" : `${BASE}/sign-up`}>
                      <button className="w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                        style={isPopular
                          ? { background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: WHITE, boxShadow: `0 4px 16px rgba(37,99,235,0.35)` }
                          : { background: BG2, color: BODY, border: `1px solid ${BORDER}` }}>
                        {isContact ? "احجز مكالمة مع فريقنا" : p.isFree ? "ابدأ مجاناً الآن" : "ابدأ الآن"}
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

      {/* ══ 9. TESTIMONIALS ══════════════════════════════════════ */}
      <section className="py-24 px-6 overflow-hidden" style={{ background: BG2 }}>
        <div className="max-w-6xl mx-auto">
          <FadeIn className="text-center mb-14">
            <span className="text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-4 inline-block"
              style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
              آراء العملاء
            </span>
            <h2 className="text-3xl sm:text-4xl font-black mb-4" style={{ color: DARK, letterSpacing: "-0.02em" }}>
              ثقة المكاتب القانونية الرائدة
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: BODY }}>
              انضم إلى مئات المكاتب التي تُدير أعمالها بكفاءة أعلى مع عدالة AI
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((tm, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="p-7 rounded-2xl h-full flex flex-col relative overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
                  style={{ background: WHITE, border: `1px solid ${BORDER}`, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  {/* Subtle color accent top */}
                  <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-[60px] opacity-[0.06]"
                    style={{ background: tm.color }} />
                  {/* Stars */}
                  <div className="flex gap-1 mb-4 relative">
                    {Array.from({ length: tm.stars }).map((_, si) => (
                      <Star key={si} className="w-4 h-4 fill-yellow-400" style={{ color: WARN }} />
                    ))}
                  </div>
                  <Quote className="w-7 h-7 mb-3 opacity-15 relative" style={{ color: tm.color }} />
                  <p className="text-sm leading-relaxed flex-1 mb-6 relative" style={{ color: BODY, lineHeight: "1.9" }}>
                    "{tm.text}"
                  </p>
                  <div className="flex items-center gap-3 pt-5 relative" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                      style={{ background: `linear-gradient(135deg, ${tm.color}, ${tm.color}cc)` }}>
                      {tm.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: DARK }}>{tm.name}</p>
                      <p className="text-xs" style={{ color: MUTED }}>{tm.role}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Country trust bar */}
          <FadeIn delay={0.3} className="mt-14 text-center">
            <p className="text-sm font-medium mb-5" style={{ color: MUTED }}>موثوق من المكاتب القانونية في</p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {["المملكة العربية السعودية 🇸🇦", "الإمارات العربية 🇦🇪", "الكويت 🇰🇼", "قطر 🇶🇦"].map((country, i) => (
                <span key={i} className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:shadow-md hover:-translate-y-0.5"
                  style={{ background: WHITE, color: BODY, border: `1px solid ${BORDER}` }}>
                  {country}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══ 10. FAQ ════════════════════════════════════════════════ */}
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
              <FadeIn key={i} delay={i * 0.04}><FAQItem q={item.q} a={item.a} /></FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 11. FINAL CTA ══════════════════════════════════════════ */}
      <section className="py-24 px-6 relative overflow-hidden" style={{ background: PRIMARY }}>
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[180px]"
            style={{ background: `${ACCENT}18` }} />
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-[100px]"
            style={{ background: "#7C3AED10" }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
        </div>

        <FadeIn>
          <div className="max-w-4xl mx-auto text-center relative">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, boxShadow: `0 8px 28px rgba(37,99,235,0.40)` }}>
              <Scale className="w-8 h-8 text-white" />
            </div>

            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold mb-6"
              style={{ background: "rgba(37,99,235,0.18)", color: ACCENT_T, border: "1px solid rgba(37,99,235,0.3)" }}>
              🎁 عرض حصري — 90 يوماً مجاناً بدون قيود
            </div>

            <h2 className="text-3xl sm:text-5xl font-black mb-5 text-white" style={{ letterSpacing: "-0.025em", lineHeight: "1.12" }}>
              هل أنت مستعد لتحويل<br />
              <span style={{ color: ACCENT_T }}>مكتبك القانوني؟</span>
            </h2>
            <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.55)", lineHeight: "1.8" }}>
              لا عقود طويلة · لا بطاقة ائتمان · إعداد كامل في 5 دقائق فقط
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
              <Link href={`${BASE}/sign-up`}>
                <button className="flex items-center gap-2.5 font-bold px-10 py-4 rounded-xl text-base transition-all hover:opacity-90 hover:scale-[1.02]"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})`, color: WHITE, boxShadow: `0 8px 28px rgba(37,99,235,0.40)`, minHeight: 56 }}>
                  <ArrowLeft className="w-5 h-5" />
                  ابدأ مجاناً لمدة 90 يوماً
                </button>
              </Link>
              <Link href={`${BASE}/demo-login`}>
                <button className="flex items-center gap-2 font-semibold px-8 py-4 rounded-xl text-base transition-all hover:bg-white/10"
                  style={{ color: WHITE, border: "2px solid rgba(255,255,255,0.18)", minHeight: 56 }}>
                  <Play className="w-4 h-4" />
                  احجز عرضاً تجريبياً
                </button>
              </Link>
            </div>

            <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.38)" }}>
              لديك حساب؟{" "}
              <Link href={`${BASE}/sign-in`}>
                <span className="font-semibold underline cursor-pointer hover:opacity-70"
                  style={{ color: "rgba(255,255,255,0.65)" }}>
                  تسجيل الدخول
                </span>
              </Link>
            </p>

            <div className="flex items-center justify-center gap-6 flex-wrap">
              {["بدون بطاقة ائتمان", "إعداد خلال 5 دقائق", "دعم 24/7 بالعربية", "SSL آمن 100%"].map(label => (
                <span key={label} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.40)" }}>
                  <Check className="w-4 h-4" style={{ color: ACCENT_T }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════ */}
      <footer style={{ background: DARK, color: "rgba(255,255,255,0.45)" }}>
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_D})` }}>
                  <Scale className="w-4 h-4 text-white" />
                </div>
                <span className="font-black text-lg text-white">عدالة <span style={{ color: ACCENT_T }}>AI</span></span>
              </div>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.30)", maxWidth: "200px" }}>
                {cmsFooter?.tagline || t("landing.footer.tagline")}
              </p>
              <div className="flex gap-3">
                {[Twitter, Linkedin, Youtube].map((Icon, i) => (
                  <a key={i} href="#"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/15 hover:-translate-y-0.5"
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
                    <li key={i}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.38)" }}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
            {(!cmsFooter || cmsFooter.showCompanyCol !== false) && (
              <div>
                <h4 className="font-bold text-white text-sm mb-4">{t("landing.footer.company")}</h4>
                <ul className="space-y-2.5">
                  {companyLinks.map((l, i) => (
                    <li key={i}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.38)" }}>{l.label}</a></li>
                  ))}
                  <li>
                    <Link href={`${BASE}/referral`}>
                      <span className="flex items-center gap-1.5 text-sm cursor-pointer hover:text-white transition-colors" style={{ color: ACCENT_T }}>
                        <Gift className="w-3.5 h-3.5" />برنامج الإحالة 🎁
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
                    <li key={i}><a href={l.href} className="text-sm transition-colors hover:text-white" style={{ color: "rgba(255,255,255,0.38)" }}>{l.label}</a></li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.22)" }}>
              {cmsFooter?.copyright || t("landing.footer.copyright")}
            </p>
            {(!cmsFooter || cmsFooter.showStatus !== false) && (
              <span className="text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-2"
                style={{ background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.18)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
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

/* helper used in Bento cards */
function ChevronLeft({ className, ...props }: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
