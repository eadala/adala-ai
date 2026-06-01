import { Link } from "wouter";
import { Scale, Shield, Bot, FileText, Users, ArrowLeft, CheckCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div dir="rtl" className="min-h-screen" style={{ background: "linear-gradient(135deg, #0F1B35 0%, #1A2744 60%, #0F1B35 100%)" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C06A)" }}>
            <Scale className="w-5 h-5 text-[#1A2744]" />
          </div>
          <div>
            <span className="text-xl font-bold text-white">عدالة AI</span>
            <p className="text-xs text-white/50 leading-none">المعمارية التقنية للنظام</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10">
              تسجيل الدخول
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button className="font-bold" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C06A)", color: "#1A2744" }}>
              ابدأ مجاناً
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-sm font-medium" style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C" }}>
          <Star className="w-4 h-4" />
          منصة إدارة القضايا الأول في المملكة
        </div>

        <h1 className="text-5xl font-black text-white mb-6 leading-tight">
          مستقبل الممارسة القانونية
          <br />
          <span style={{ background: "linear-gradient(135deg, #C9A84C, #E0C06A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            مدعوم بالذكاء الاصطناعي
          </span>
        </h1>

        <p className="text-xl text-white/60 mb-10 leading-relaxed max-w-2xl mx-auto">
          منصة SaaS متكاملة لإدارة القضايا القانونية، تحليل المستندات بالذكاء الاصطناعي، وتواصل احترافي مع الموكلين — كل ذلك في مكان واحد.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/sign-up">
            <Button size="lg" className="text-lg px-8 py-6 font-bold rounded-xl" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C06A)", color: "#1A2744" }}>
              ابدأ تجربتك المجانية
              <ArrowLeft className="w-5 h-5 mr-2" />
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-xl border-white/20 text-white hover:bg-white/10">
              شاهد كيف تعمل
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 py-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-white text-center mb-12">كل ما تحتاجه في منصة واحدة</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Scale,
              title: "إدارة القضايا",
              desc: "تتبع جميع قضاياك، مواعيدها، وحالتها بنظرة واحدة. فلترة متقدمة وإشعارات فورية.",
              color: "#C9A84C",
            },
            {
              icon: Bot,
              title: "ذكاء اصطناعي قانوني",
              desc: "تحليل المستندات، استخراج المعلومات، وتقييم المخاطر القانونية تلقائياً بالعربية.",
              color: "#6366F1",
            },
            {
              icon: FileText,
              title: "إدارة المستندات",
              desc: "مكتبة مستندات منظمة مع OCR، بحث ذكي، وربط المستندات بالقضايا.",
              color: "#10B981",
            },
            {
              icon: Users,
              title: "فريق العمل",
              desc: "إدارة صلاحيات الفريق، تكليف المهام، وتتبع الأداء بنظام RBAC متكامل.",
              color: "#F59E0B",
            },
            {
              icon: Shield,
              title: "أمان على مستوى المؤسسات",
              desc: "تشفير البيانات، عزل المستأجرين (Multi-tenant)، وسجلات تدقيق شاملة.",
              color: "#EF4444",
            },
            {
              icon: FileText,
              title: "الفوترة والاشتراكات",
              desc: "إدارة الاشتراكات، الفواتير، ومتابعة الاستخدام بشكل تلقائي وسلس.",
              color: "#8B5CF6",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl border transition-all hover:scale-[1.02]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${f.color}20`, border: `1px solid ${f.color}40` }}
              >
                <f.icon className="w-6 h-6" style={{ color: f.color }} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 p-8 rounded-2xl text-center"
          style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}
        >
          {[
            { value: "٥٠٠+", label: "مكتب قانوني" },
            { value: "١٠,٠٠٠+", label: "قضية مُدارة" },
            { value: "٩٨%", label: "رضا العملاء" },
            { value: "٤٠%", label: "توفير في الوقت" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-black mb-1" style={{ color: "#C9A84C" }}>{s.value}</div>
              <div className="text-white/60 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <div
          className="max-w-2xl mx-auto p-10 rounded-3xl"
          style={{ background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)" }}
        >
          <h2 className="text-3xl font-black text-white mb-4">جاهز للبدء؟</h2>
          <p className="text-white/60 mb-8">انضم إلى مئات المكاتب القانونية التي تثق بعدالة AI</p>
          <div className="flex items-center justify-center gap-3 mb-6">
            {["لا يُشترط بطاقة ائتمانية", "إعداد خلال دقيقتين", "دعم كامل بالعربية"].map(t => (
              <span key={t} className="flex items-center gap-1 text-sm text-white/70">
                <CheckCircle className="w-4 h-4 text-green-400" />
                {t}
              </span>
            ))}
          </div>
          <Link href="/sign-up">
            <Button size="lg" className="text-lg px-10 py-6 font-bold rounded-xl" style={{ background: "linear-gradient(135deg, #C9A84C, #E0C06A)", color: "#1A2744" }}>
              ابدأ مجاناً الآن
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-white/30 text-sm">
        © ٢٠٢٦ عدالة AI — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
