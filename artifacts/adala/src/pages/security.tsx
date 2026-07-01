import { Link } from "wouter";
import { Scale, ArrowRight, Shield, Lock, Server, Eye, CheckCircle2, Key, RefreshCw, AlertTriangle, Building2 } from "lucide-react";

const GOLD = "#1A56DB";

const pillars = [
  {
    icon: Lock,
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.1)",
    border: "rgba(59,130,246,0.25)",
    title: "التشفير الشامل",
    items: [
      "TLS 1.3 لجميع البيانات المنقولة بين المتصفح والخادم",
      "AES-256 لتشفير البيانات المخزنة في قاعدة البيانات",
      "تشفير المستندات والملفات القانونية عند الرفع",
      "مفاتيح تشفير منفصلة لكل مكتب (per-tenant encryption keys)",
    ],
  },
  {
    icon: Building2,
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.1)",
    border: "rgba(139,92,246,0.25)",
    title: "فصل بيانات المكاتب (Multi-Tenant Isolation)",
    items: [
      "كل مكتب يعمل في بيئة بيانات معزولة تماماً",
      "لا يمكن لأي مكتب الاطلاع على بيانات مكتب آخر في أي ظرف",
      "سياسة Row-Level Security (RLS) مطبّقة على مستوى قاعدة البيانات",
      "اختبارات اختراق دورية للتحقق من صحة الفصل",
    ],
  },
  {
    icon: Key,
    color: "#2563EB",
    bg: "rgba(201,168,76,0.1)",
    border: "rgba(201,168,76,0.25)",
    title: "المصادقة والصلاحيات",
    items: [
      "مصادقة ثنائية العامل (2FA) متاحة وموصى بها لجميع الحسابات",
      "نظام RBAC للتحكم الدقيق في صلاحيات كل مستخدم داخل المكتب",
      "انتهاء صلاحية الجلسة التلقائي بعد فترة الخمول",
      "تسجيل ومراقبة جميع محاولات الدخول الفاشلة",
      "إشعار فوري عند محاولة الدخول من جهاز أو موقع جغرافي جديد",
    ],
  },
  {
    icon: Server,
    color: "#10B981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.25)",
    title: "البنية التحتية والاستضافة",
    items: [
      "خوادم معتمدة بمعايير ISO 27001 و SOC 2 Type II",
      "نسخ احتياطية مشفرة تلقائية كل ٦ ساعات",
      "استرداد البيانات خلال ٤ ساعات في حالات الطوارئ (RTO)",
      "هدف نقطة الاسترداد لا يتجاوز ساعة واحدة (RPO)",
      "مراقبة مستمرة ٢٤/٧ لأداء الخوادم والأمان",
    ],
  },
  {
    icon: Eye,
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
    title: "المراقبة والتدقيق",
    items: [
      "سجل تدقيق كامل لجميع العمليات الحساسة (Audit Log)",
      "تتبع جميع عمليات تحميل أو حذف المستندات",
      "مراجعة أمنية داخلية ربع سنوية",
      "اختبارات اختراق خارجية سنوية من جهات معتمدة",
      "برنامج الإفصاح المسؤول (Bug Bounty) للباحثين الأمنيين",
    ],
  },
  {
    icon: RefreshCw,
    color: "#06B6D4",
    bg: "rgba(6,182,212,0.1)",
    border: "rgba(6,182,212,0.25)",
    title: "الاستمرارية والتعافي",
    items: [
      "معدل توفر الخدمة المستهدف: 99.9% (SLA)",
      "بنية تحتية موزعة لتجنب نقاط الفشل الفردية",
      "خطة استمرارية أعمال موثقة ومختبرة دورياً",
      "نظام تنبيه فوري لفريق العمليات عند أي حادثة",
    ],
  },
];

const certifications = [
  { label: "PDPL", desc: "نظام حماية البيانات الشخصية السعودي", color: "#2563EB" },
  { label: "ISO 27001", desc: "إدارة أمن المعلومات", color: "#3B82F6" },
  { label: "SOC 2", desc: "ضوابط الأمان والتوفر", color: "#8B5CF6" },
  { label: "TLS 1.3", desc: "أحدث معايير التشفير", color: "#10B981" },
  { label: "PCI DSS", desc: "أمان بيانات الدفع (عبر Stripe)", color: "#F59E0B" },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC", fontFamily: "'Cairo', sans-serif", direction: "rtl" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-slate-200" style={{ background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: GOLD }}>
                <Scale className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-slate-800 text-base">عدالة AI</span>
            </div>
          </Link>
          <Link href="/">
            <button className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
              <ArrowRight className="w-3.5 h-3.5" />
              العودة للرئيسية
            </button>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 pt-16 pb-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl mb-5" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.3)" }}>
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-3">الأمان وحماية البيانات</h1>
          <p className="text-slate-500 text-base max-w-xl mx-auto leading-relaxed">
            ملفاتك القانونية وبيانات عملائك هي أكثر ما تحرص عليه. هذه الصفحة تشرح بالتفصيل كيف نحمي هذه الأمانة.
          </p>
        </div>

        {/* Isolation callout */}
        <div className="rounded-2xl p-6 mb-10 text-center" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
          <CheckCircle2 className="w-7 h-7 mx-auto mb-3" style={{ color: GOLD }} />
          <h2 className="text-lg font-black text-slate-900 mb-2">خصوصيتك وسرية ملفاتك أولوية لدينا</h2>
          <p className="text-slate-600 text-sm leading-relaxed max-w-lg mx-auto">
            لا يمكن لأي مكتب الاطلاع على ملفات مكتب آخر، ولا يتم الوصول إلى بياناتك إلا من خلال المستخدمين المخولين داخل مكتبك. هذا الفصل مُطبَّق على مستوى قاعدة البيانات نفسها، وليس فقط على مستوى الواجهة.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid md:grid-cols-2 gap-5 mb-10">
          {pillars.map((p, i) => (
            <div key={i} className="rounded-2xl p-5" style={{ background: "#ffffff", border: "1px solid #E2E8F0" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: p.bg, border: `1px solid ${p.border}` }}>
                  <p.icon className="w-4.5 h-4.5" style={{ color: p.color }} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">{p.title}</h3>
              </div>
              <ul className="space-y-2">
                {p.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: p.color, opacity: 0.8 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Certifications */}
        <div className="rounded-2xl p-6 mb-8" style={{ background: "#ffffff", border: "1px solid #E2E8F0" }}>
          <h2 className="font-bold text-slate-800 text-base mb-5 text-center">الامتثال والاعتمادات</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {certifications.map((c, i) => (
              <div key={i} className="rounded-xl p-3 text-center" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <div className="text-base font-black mb-1" style={{ color: c.color }}>{c.label}</div>
                <div className="text-[11px] text-slate-400 leading-tight">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Incident response */}
        <div className="rounded-2xl p-6 mb-8" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.15)" }}>
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <h3 className="font-bold text-slate-800 text-sm">الاستجابة للحوادث الأمنية</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            في حال اكتشاف أي ثغرة أمنية أو خرق للبيانات، نلتزم بإشعار المستخدمين المتأثرين خلال <strong className="text-slate-800">٧٢ ساعة</strong> كحد أقصى، وفق متطلبات نظام حماية البيانات الشخصية (PDPL) السعودي. نحتفظ بفريق متخصص للاستجابة الفورية للحوادث ومعالجتها.
          </p>
        </div>

        {/* Report vulnerability */}
        <div className="rounded-2xl p-6 text-center mb-8" style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <Shield className="w-6 h-6 mx-auto mb-3 text-blue-500" />
          <h3 className="font-bold text-slate-800 mb-1">اكتشفت ثغرة أمنية؟</h3>
          <p className="text-sm text-slate-500 mb-3">نقدّر الإفصاح المسؤول ونكافئ الباحثين الأمنيين</p>
          <a href="mailto:security@adala-ai.sa" className="text-sm font-semibold text-blue-600">security@adala-ai.sa</a>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 pt-6 pb-10 border-t border-slate-200">
          <Link href="/terms"><span className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">الشروط والأحكام</span></Link>
          <span className="text-slate-200">•</span>
          <Link href="/privacy"><span className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">سياسة الخصوصية</span></Link>
          <span className="text-slate-200">•</span>
          <Link href="/"><span className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">الرئيسية</span></Link>
        </div>
      </div>
    </div>
  );
}
