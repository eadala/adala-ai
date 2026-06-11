import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Check, X, Minus, ChevronDown, Zap, Shield, Building2,
  Crown, Rocket, Star, Sparkles, ArrowLeft, MessageCircle,
  Users, HardDrive, Brain, Globe, ShoppingBag, Calendar,
  Link, GitBranch, Code2, BarChart3, Headphones, Wifi,
  BadgeCheck, Phone, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════ DATA ══════════════════════════════════════ */

const GOLD = "#C9A84C";
const PLANS = [
  {
    id: "starter",
    nameAr: "مبتدئ",
    nameEn: "Starter",
    icon: Rocket,
    color: "#3B82F6",
    monthly: 99,
    yearly: 79,
    desc: "للمحامين المستقلين والمكاتب الصغيرة",
    cta: "ابدأ مجاناً",
    recommended: false,
    enterprise: false,
    features: [
      "٢٠ قضية نشطة",
      "مستخدمان",
      "٥ جيجا تخزين",
      "٢٠ طلب AI شهرياً",
      "فواتير إلكترونية",
      "إدارة المستندات",
      "لوحة تحكم أساسية",
      "دعم عبر البريد",
    ],
  },
  {
    id: "professional",
    nameAr: "احترافي",
    nameEn: "Professional",
    icon: Star,
    color: GOLD,
    monthly: 299,
    yearly: 239,
    desc: "للمكاتب المتوسطة في طور النمو",
    cta: "اشترك الآن",
    recommended: true,
    enterprise: false,
    features: [
      "١٠٠ قضية نشطة",
      "٥ مستخدمين",
      "٢٥ جيجا تخزين",
      "١٠٠ طلب AI شهرياً",
      "صفحة مكتب عامة",
      "متجر قانوني",
      "عقود ذكية",
      "تقارير متقدمة",
      "دعم بريد إلكتروني أولوي",
    ],
  },
  {
    id: "business",
    nameAr: "أعمال",
    nameEn: "Business",
    icon: Building2,
    color: "#8B5CF6",
    monthly: 599,
    yearly: 479,
    desc: "للمكاتب الكبيرة متعددة المستخدمين",
    cta: "اشترك الآن",
    recommended: false,
    enterprise: false,
    features: [
      "قضايا غير محدودة",
      "١٥ مستخدماً",
      "١٠٠ جيجا تخزين",
      "AI غير محدود",
      "كل مزايا احترافي +",
      "بوابة العملاء",
      "نطاق خاص",
      "٣ فروع",
      "وصول API",
      "دعم ٨ ساعات",
    ],
  },
  {
    id: "enterprise",
    nameAr: "مؤسسي",
    nameEn: "Enterprise",
    icon: Crown,
    color: "#10B981",
    monthly: null,
    yearly: null,
    desc: "للشركات الكبرى والمجموعات القانونية",
    cta: "اطلب عرض سعر",
    recommended: false,
    enterprise: true,
    features: [
      "كل شيء غير محدود",
      "مستخدمون غير محدودون",
      "تخزين غير محدود",
      "AI مخصص ومدرَّب",
      "فروع غير محدودة",
      "SLA مضمون",
      "مدير حساب مخصص",
      "تدريب وإعداد",
      "تكاملات مخصصة",
      "دعم ٢٤/٧",
    ],
  },
];

type FeatureVal = string | boolean | null;
interface CompRow { label: string; icon: any; vals: FeatureVal[] }
const COMPARISON: CompRow[] = [
  { label: "القضايا", icon: Shield, vals: ["٢٠", "١٠٠", "غير محدود", "غير محدود"] },
  { label: "المستخدمون", icon: Users, vals: ["٢", "٥", "١٥", "غير محدود"] },
  { label: "التخزين", icon: HardDrive, vals: ["٥ GB", "٢٥ GB", "١٠٠ GB", "غير محدود"] },
  { label: "الذكاء الاصطناعي", icon: Brain, vals: ["٢٠ طلب/شهر", "١٠٠ طلب/شهر", "غير محدود", "مخصص"] },
  { label: "صفحة المكتب العامة", icon: Globe, vals: [false, true, true, true] },
  { label: "المتجر القانوني", icon: ShoppingBag, vals: [false, true, true, true] },
  { label: "بوابة العملاء", icon: Wifi, vals: [false, false, true, true] },
  { label: "التقويم والمواعيد", icon: Calendar, vals: [true, true, true, true] },
  { label: "النطاق الخاص", icon: Link, vals: [false, false, true, true] },
  { label: "الفروع", icon: GitBranch, vals: [false, false, "٣", "غير محدود"] },
  { label: "وصول API", icon: Code2, vals: [false, false, true, true] },
  { label: "تقارير متقدمة", icon: BarChart3, vals: [false, true, true, true] },
  { label: "WhatsApp Business", icon: MessageCircle, vals: [false, false, true, true] },
  { label: "SLA / الدعم", icon: Headphones, vals: ["بريد إلكتروني", "أولوي", "٨ ساعات", "٢٤/٧"] },
];

const ADDONS = [
  { icon: Users, label: "مستخدم إضافي", price: 25, per: "مستخدم/شهر", color: "#3B82F6" },
  { icon: HardDrive, label: "50 GB إضافية", price: 50, per: "شهرياً", color: "#8B5CF6" },
  { icon: GitBranch, label: "فرع إضافي", price: 199, per: "فرع/شهر", color: "#F97316" },
  { icon: MessageCircle, label: "WhatsApp Business", price: 299, per: "شهرياً", color: "#10B981" },
  { icon: Brain, label: "AI Plus — طلبات إضافية", price: 149, per: "شهرياً", color: GOLD },
  { icon: Link, label: "نطاق خاص", price: 99, per: "شهرياً", color: "#EC4899" },
];

const FAQS = [
  { q: "هل توجد فترة تجريبية مجانية؟", a: "نعم، جميع الباقات تأتي مع تجربة مجانية لمدة ١٤ يوماً بدون أي قيود. لا حاجة لبطاقة ائتمانية." },
  { q: "هل أحتاج بطاقة ائتمانية للتسجيل؟", a: "لا. يمكنك البدء مجاناً فوراً بدون أي بيانات دفع. تُطلب معلومات الدفع فقط عند الترقية لباقة مدفوعة." },
  { q: "هل يمكنني تغيير باقتي في أي وقت؟", a: "نعم، يمكنك الترقية أو التخفيض في أي وقت. عند الترقية يتم احتساب الفرق بشكل تناسبي فوراً، وعند التخفيض يسري التغيير من بداية الدورة القادمة." },
  { q: "هل بياناتي آمنة ومحمية؟", a: "بالكامل. نستخدم تشفير AES-256 للبيانات في حالة السكون وTLS 1.3 في النقل. خوادمنا معتمدة وفق ISO 27001 ومتوافقة مع نظام حماية البيانات الشخصية السعودي." },
  { q: "هل يوجد عقد طويل الأمد؟", a: "لا. الاشتراك شهري افتراضياً ويمكن الإلغاء في أي وقت. الباقة السنوية توفر ٢٠٪ لكنها اختيارية تماماً." },
  { q: "كيف يتم الدفع؟", a: "نقبل جميع البطاقات الائتمانية (فيزا، ماستركارد، مدى)، إضافة إلى التحويل البنكي والفواتير الشهرية للباقة المؤسسية." },
];

/* ═══════════════════════════════════════ HELPERS ══════════════════════════════════ */

function FeatureVal({ val }: { val: FeatureVal }) {
  if (val === true) return <Check className="h-4 w-4 text-emerald-400 mx-auto" />;
  if (val === false) return <X className="h-4 w-4 text-white/20 mx-auto" />;
  if (val === null) return <Minus className="h-4 w-4 text-white/20 mx-auto" />;
  return <span className="text-xs text-white/70 font-medium">{val}</span>;
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  if (inView && v === 0 && to > 0) {
    let start = 0;
    const step = Math.ceil(to / 40);
    const iv = setInterval(() => {
      start += step;
      if (start >= to) { setV(to); clearInterval(iv); } else setV(start);
    }, 20);
  }
  return <span ref={ref}>{inView ? v : 0}{suffix}</span>;
}

/* ═══════════════════════════════════════ PAGE ═══════════════════════════════════════ */

export default function PricingPage() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  return (
    <div
      className="min-h-screen font-['Cairo',sans-serif] text-white"
      dir="rtl"
      style={{ background: "linear-gradient(160deg, #060b18 0%, #0a1224 60%, #06101e 100%)" }}
    >
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 border-b border-white/5" style={{ background: "rgba(6,11,24,0.95)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            الرئيسية
          </a>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}20` }}>
              <BadgeCheck className="h-4 w-4" style={{ color: GOLD }} />
            </div>
            <span className="font-black text-sm">عدالة AI</span>
          </div>
          <a href="/sign-up">
            <Button size="sm" style={{ background: GOLD, color: "#000" }} className="font-bold gap-1.5 text-xs">
              ابدأ مجاناً
            </Button>
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="text-center pt-20 pb-12 px-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-6"
            style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}30` }}>
            <Sparkles className="h-3.5 w-3.5" />
            شفافية كاملة في التسعير · بدون رسوم خفية
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-5 leading-tight">
            خطط تناسب
            <span className="block" style={{ color: GOLD }}>جميع المكاتب القانونية</span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto leading-relaxed">
            ابدأ مجاناً لمدة ١٤ يوماً وقم بالترقية عندما ينمو مكتبك.
            لا بطاقة ائتمانية · لا عقود طويلة · إلغاء في أي وقت.
          </p>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-8 mt-10 text-center"
        >
          {[
            { n: 850, suf: "+", label: "مكتب يثق بنا" },
            { n: 14, suf: " يوم", label: "تجربة مجانية" },
            { n: 99, suf: "٪", label: "رضا العملاء" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl font-black" style={{ color: GOLD }}>
                <Counter to={s.n} suffix={s.suf} />
              </div>
              <div className="text-xs text-white/40 mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── BILLING TOGGLE ── */}
      <div className="flex justify-center mb-10 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
          className="p-1.5 rounded-2xl flex gap-1"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {(["monthly", "yearly"] as const).map(c => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                "relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2",
                cycle === c ? "text-black shadow-lg" : "text-white/50 hover:text-white/80"
              )}
              style={cycle === c ? { background: GOLD } : {}}
            >
              {c === "monthly" ? "شهري" : "سنوي"}
              {c === "yearly" && (
                <span className={cn(
                  "text-[10px] font-black px-1.5 py-0.5 rounded-md",
                  cycle === "yearly" ? "bg-black/20 text-black" : "bg-emerald-500/20 text-emerald-400"
                )}>
                  وفّر ٢٠٪
                </span>
              )}
            </button>
          ))}
        </motion.div>
      </div>

      {/* ── PRICING CARDS ── */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
          {PLANS.map((plan, i) => {
            const price = cycle === "monthly" ? plan.monthly : plan.yearly;
            const Icon = plan.icon;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i + 0.2 }}
                whileHover={{ y: -6 }}
                className={cn("relative rounded-3xl flex flex-col overflow-hidden", plan.recommended && "ring-2")}
                style={{
                  background: plan.recommended
                    ? `linear-gradient(160deg, ${plan.color}18, ${plan.color}08)`
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${plan.color}${plan.recommended ? "50" : "25"}`,
                  boxShadow: plan.recommended ? `0 0 60px ${plan.color}20` : "none",
                  ...(plan.recommended ? { ringColor: plan.color } : {}),
                }}
              >
                {plan.recommended && (
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
                )}
                {plan.recommended && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <div className="text-[10px] font-black px-4 py-1 rounded-b-lg" style={{ background: GOLD, color: "#000" }}>
                      ⭐ الأكثر شعبية
                    </div>
                  </div>
                )}

                <div className="p-6 flex-1 flex flex-col">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4 mt-2">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${plan.color}20`, border: `1px solid ${plan.color}30` }}>
                      <Icon className="h-5 w-5" style={{ color: plan.color }} />
                    </div>
                    <div>
                      <div className="font-black text-base">{plan.nameAr}</div>
                      <div className="text-[10px] text-white/40">{plan.nameEn}</div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-2">
                    {plan.enterprise ? (
                      <div className="text-3xl font-black" style={{ color: plan.color }}>حسب العرض</div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={`${plan.id}-${cycle}`}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="text-4xl font-black"
                            style={{ color: plan.color }}
                          >
                            {price?.toLocaleString("ar-SA")}
                          </motion.span>
                        </AnimatePresence>
                        <span className="text-white/40 text-sm">ر.س / شهر</span>
                      </div>
                    )}
                    {!plan.enterprise && cycle === "yearly" && (
                      <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
                        توفر {((plan.monthly! - plan.yearly!) * 12).toLocaleString("ar-SA")} ر.س سنوياً
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-white/40 mb-5 leading-relaxed">{plan.desc}</p>

                  {/* Features */}
                  <div className="space-y-2.5 flex-1 mb-6">
                    {plan.features.map((f, fi) => (
                      <div key={fi} className="flex items-start gap-2.5">
                        <div className="h-4 w-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                          style={{ background: `${plan.color}20` }}>
                          <Check className="h-2.5 w-2.5" style={{ color: plan.color }} />
                        </div>
                        <span className="text-xs text-white/70 leading-relaxed">{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <a href={plan.enterprise ? "mailto:sales@adalah-ai.sa" : "/sign-up"}>
                    <Button
                      className="w-full py-5 font-black text-sm gap-2 transition-all hover:opacity-90"
                      style={plan.recommended
                        ? { background: `linear-gradient(135deg, ${GOLD}, #f0d060)`, color: "#000" }
                        : { background: `${plan.color}20`, color: plan.color, border: `1px solid ${plan.color}30` }}
                    >
                      {plan.cta}
                      {!plan.enterprise && <ArrowLeft className="h-4 w-4 rotate-180" />}
                    </Button>
                  </a>

                  {!plan.enterprise && (
                    <p className="text-center text-[10px] text-white/30 mt-2">
                      ١٤ يوم تجربة مجانية · بدون بطاقة ائتمانية
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-4"
            style={{ background: `${GOLD}12`, color: GOLD, border: `1px solid ${GOLD}25` }}>
            مقارنة شاملة
          </div>
          <h2 className="text-3xl font-black">قارن جميع المزايا</h2>
          <p className="text-white/40 text-sm mt-2">اختر الباقة التي تناسب حجم مكتبك</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}
        >
          {/* Table header */}
          <div className="grid grid-cols-5 border-b border-white/7">
            <div className="p-4 text-sm font-bold text-white/50">الميزة</div>
            {PLANS.map((p, i) => (
              <div
                key={p.id}
                className="p-4 text-center cursor-pointer transition-all"
                style={hoveredCol === i ? { background: `${p.color}10` } : {}}
                onMouseEnter={() => setHoveredCol(i)}
                onMouseLeave={() => setHoveredCol(null)}
              >
                <div className="font-black text-sm" style={{ color: p.color }}>{p.nameAr}</div>
                {!p.enterprise && (
                  <div className="text-[10px] text-white/30 mt-0.5">
                    {cycle === "monthly" ? p.monthly : p.yearly} ر.س/شهر
                  </div>
                )}
                {p.recommended && (
                  <div className="text-[9px] font-bold mt-1 px-2 py-0.5 rounded-full inline-block" style={{ background: `${GOLD}20`, color: GOLD }}>
                    الأشهر
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Rows */}
          {COMPARISON.map((row, ri) => {
            const Icon = row.icon;
            return (
              <div
                key={ri}
                className={cn("grid grid-cols-5 transition-colors", ri % 2 === 0 ? "" : "bg-white/[0.015]")}
              >
                <div className="p-3.5 flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${GOLD}10` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  </div>
                  <span className="text-xs text-white/70 font-semibold">{row.label}</span>
                </div>
                {row.vals.map((v, vi) => (
                  <div
                    key={vi}
                    className="p-3.5 flex items-center justify-center transition-all"
                    style={hoveredCol === vi ? { background: `${PLANS[vi].color}08` } : {}}
                    onMouseEnter={() => setHoveredCol(vi)}
                    onMouseLeave={() => setHoveredCol(null)}
                  >
                    <FeatureVal val={v} />
                  </div>
                ))}
              </div>
            );
          })}

          {/* Footer CTAs */}
          <div className="grid grid-cols-5 border-t border-white/7 p-4">
            <div />
            {PLANS.map((plan, i) => (
              <div key={i} className="px-2">
                <a href={plan.enterprise ? "mailto:sales@adalah-ai.sa" : "/sign-up"}>
                  <Button
                    size="sm"
                    className="w-full text-xs font-bold py-4"
                    style={plan.recommended
                      ? { background: `linear-gradient(135deg, ${GOLD}, #f0d060)`, color: "#000" }
                      : { background: `${plan.color}15`, color: plan.color, border: `1px solid ${plan.color}25` }}
                  >
                    {plan.cta}
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ── ADD-ONS ── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-4"
            style={{ background: "#3B82F620", color: "#3B82F6", border: "1px solid #3B82F625" }}>
            <Plus className="h-3.5 w-3.5" />
            إضافات اختيارية
          </div>
          <h2 className="text-3xl font-black">خصّص باقتك</h2>
          <p className="text-white/40 text-sm mt-2">أضف ما تحتاجه فقط — ادفع مقابل ما تستخدمه</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ADDONS.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -4 }}
                className="p-5 rounded-2xl flex items-center gap-4"
                style={{ background: `${a.color}08`, border: `1px solid ${a.color}20` }}
              >
                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${a.color}15` }}>
                  <Icon className="h-6 w-6" style={{ color: a.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{a.label}</div>
                  <div className="text-xs text-white/40">{a.per}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-black" style={{ color: a.color }}>
                    {a.price}
                  </div>
                  <div className="text-[10px] text-white/30">ر.س</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-4"
            style={{ background: "#8B5CF620", color: "#8B5CF6", border: "1px solid #8B5CF625" }}>
            الأسئلة الشائعة
          </div>
          <h2 className="text-3xl font-black">هل لديك أسئلة؟</h2>
        </motion.div>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
            >
              <button
                className="w-full p-5 flex items-center justify-between text-right gap-4 hover:bg-white/5 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-bold text-sm">{faq.q}</span>
                <motion.div
                  animate={{ rotate: openFaq === i ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0"
                >
                  <ChevronDown className="h-4 w-4 text-white/40" />
                </motion.div>
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 text-sm text-white/50 leading-relaxed border-t border-white/7 pt-4">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden text-center py-20 px-8"
          style={{ background: `linear-gradient(135deg, ${GOLD}18, ${GOLD}08 40%, rgba(6,11,24,0) 100%)`, border: `1px solid ${GOLD}30` }}
        >
          {/* BG glow */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${GOLD}12, transparent 70%)` }} />

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative z-10"
          >
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
              style={{ background: `${GOLD}20`, border: `1px solid ${GOLD}40` }}>
              <Sparkles className="h-8 w-8" style={{ color: GOLD }} />
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-4">
              ابدأ رحلتك نحو
              <span className="block" style={{ color: GOLD }}>مكتب قانوني أكثر ذكاءً</span>
            </h2>
            <p className="text-white/50 text-base mb-8 max-w-lg mx-auto leading-relaxed">
              انضم لأكثر من ٨٥٠ مكتباً قانونياً يستخدمون عدالة AI لتحسين كفاءتهم وتنمية أعمالهم.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a href="/sign-up">
                <Button
                  size="lg"
                  className="gap-2 px-8 py-6 text-base font-black shadow-2xl hover:opacity-90 transition-opacity"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d060)`, color: "#000" }}
                >
                  <Zap className="h-5 w-5" />
                  ابدأ مجاناً لمدة ١٤ يوماً
                </Button>
              </a>
              <a href="mailto:sales@adalah-ai.sa">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 px-8 py-6 text-base border-white/20 hover:bg-white/10"
                >
                  <Phone className="h-5 w-5" />
                  تحدث مع فريق المبيعات
                </Button>
              </a>
            </div>
            <div className="flex flex-wrap gap-6 justify-center mt-8 text-xs text-white/30">
              {["✓ لا بطاقة ائتمانية", "✓ لا عقود طويلة", "✓ إلغاء في أي وقت", "✓ دعم كامل بالعربية"].map(t => (
                <span key={t} className="font-medium">{t}</span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-white/20">
        <p>© ٢٠٢٦ عدالة AI · جميع الحقوق محفوظة</p>
      </footer>

      {/* WhatsApp float */}
      <a href="https://wa.me/966500000000" target="_blank" rel="noreferrer"
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 bg-emerald-500 hover:bg-emerald-600 transition-colors">
        <MessageCircle className="h-7 w-7 text-white" />
      </a>
    </div>
  );
}
