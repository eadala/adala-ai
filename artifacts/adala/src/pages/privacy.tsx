import { Link } from "wouter";
import { Scale, ArrowRight, Shield, Eye, Database, Lock, UserCheck, Trash2, Cookie, Mail, Globe } from "lucide-react";

const GOLD = "#1A56DB";
const LAST_UPDATED = "١ يونيو ٢٠٢٦";

const sections = [
  {
    icon: Eye,
    title: "١. البيانات التي نجمعها",
    content: `نجمع البيانات التالية لتشغيل الخدمة وتحسينها:

**بيانات الحساب:**
• الاسم الكامل، البريد الإلكتروني، رقم الهاتف
• معلومات المكتب القانوني (الاسم، رقم الترخيص، العنوان)
• صورة الملف الشخصي واللوغو

**بيانات الاستخدام:**
• ملفات القضايا والعقود والمستندات التي تُرفعها
• سجلات التواصل مع العملاء
• سجلات الفواتير والمدفوعات

**بيانات تقنية:**
• عنوان IP ونوع المتصفح ونظام التشغيل
• سجلات الدخول وأوقات الجلسات
• بيانات الأداء وتشخيص الأخطاء`,
  },
  {
    icon: Database,
    title: "٢. كيف نستخدم بياناتك",
    content: `نستخدم بياناتك للأغراض التالية حصراً:

• تشغيل حسابك وتقديم الخدمات المشترك فيها
• تحسين أداء الذكاء الاصطناعي باستخدام بيانات مجهولة الهوية ومجمّعة
• إرسال إشعارات تشغيلية ضرورية (تجديد الاشتراك، التحديثات الأمنية)
• الامتثال للمتطلبات القانونية والتنظيمية السعودية
• تحليل أنماط الاستخدام لتطوير الميزات

لا نستخدم بياناتك لأغراض إعلانية أو تسويقية لأطراف ثالثة.`,
  },
  {
    icon: Globe,
    title: "٣. مشاركة البيانات مع أطراف ثالثة",
    content: `نتعامل مع عدد محدود من مزودي الخدمة الموثوقين لتشغيل المنصة:

• **Stripe**: معالجة المدفوعات (لا نحتفظ ببيانات البطاقة الائتمانية)
• **Clerk**: إدارة المصادقة وتسجيل الدخول
• **Hetzner + Coolify**: استضافة التطبيق وقاعدة البيانات في بنية تحتية مُدارة
• **Cloudflare R2**: تخزين الملفات والكائنات
• **Anthropic / OpenAI**: تشغيل ميزات الذكاء الاصطناعي (يتم إرسال البيانات بعد تجريد المعرفات الشخصية)

لا نبيع بياناتك لأي طرف ثالث. في حالات استثنائية قانونية (أوامر قضائية سعودية معتمدة)، قد نُلزَم بالإفصاح عن بعض البيانات وسنُبلّغك بذلك ما لم يمنعنا القانون.`,
  },
  {
    icon: Lock,
    title: "٤. أمان البيانات",
    content: `نطبّق معايير أمان صناعية متقدمة لحماية بياناتك:

• تشفير TLS 1.3 لجميع البيانات في النقل
• تشفير AES-256 للبيانات المخزنة
• فصل كامل للبيانات بين المكاتب (Multi-tenant isolation)
• مصادقة ثنائية العامل (2FA) متاحة لجميع الحسابات
• مراجعات أمنية دورية واختبارات الاختراق
• سياسة صلاحيات الوصول الأدنى لموظفينا

لا يمكن لأي مكتب الاطلاع على بيانات مكتب آخر في أي حال من الأحوال.`,
  },
  {
    icon: UserCheck,
    title: "٥. حقوقك كمستخدم",
    content: `بموجب الأنظمة السارية في المملكة العربية السعودية، لك الحقوق التالية:

• **حق الوصول**: الاطلاع على جميع بياناتك الشخصية المخزنة
• **حق التصحيح**: تعديل أي بيانات غير دقيقة
• **حق الحذف**: طلب حذف حسابك وجميع بياناتك (خلال ٣٠ يوماً من الطلب)
• **حق التصدير**: تحميل جميع بياناتك بصيغ قابلة للقراءة (JSON / CSV)
• **حق الاعتراض**: الاعتراض على أي معالجة لبياناتك لا تتعلق بالخدمة الأساسية

لممارسة أي من هذه الحقوق، تواصل معنا عبر: privacy@adala-ai.sa`,
  },
  {
    icon: Trash2,
    title: "٦. الاحتفاظ بالبيانات وحذفها",
    content: `نتبع سياسة واضحة للاحتفاظ بالبيانات:

• بيانات الحساب النشط: محتفظ بها طوال فترة الاشتراك
• بعد إلغاء الاشتراك: تُتاح للتصدير ٣٠ يوماً ثم تُحذف نهائياً
• سجلات المدفوعات: محتفظ بها ٧ سنوات امتثالاً للمتطلبات الضريبية السعودية
• سجلات الأنشطة الأمنية: ٩٠ يوماً
• النسخ الاحتياطية: تُستبدل تلقائياً كل ٩٠ يوماً

يمكن طلب الحذف الفوري في أي وقت عبر إعدادات الحساب أو مراسلة فريق الخصوصية.`,
  },
  {
    icon: Cookie,
    title: "٧. ملفات تعريف الارتباط (Cookies)",
    content: `نستخدم ملفات تعريف الارتباط للأغراض التالية:

**ضرورية (لا يمكن تعطيلها):**
• الحفاظ على جلسة تسجيل الدخول
• تذكّر تفضيلاتك اللغوية والواجهة

**تحليلية (يمكن رفضها):**
• قياس أداء الصفحات وأنماط الاستخدام
• تحسين تجربة المستخدم

لا نستخدم ملفات تعريف الارتباط لأغراض إعلانية. يمكنك إدارة إعدادات ملفات تعريف الارتباط من إعدادات متصفحك.`,
  },
  {
    icon: Shield,
    title: "٨. التحديثات وإشعارات التغيير",
    content: `قد نُحدّث هذه السياسة بشكل دوري لمواكبة التغييرات التقنية أو التنظيمية. في حال إجراء تغييرات جوهرية:

• سيُرسَل إشعار بريدي إلى جميع المستخدمين النشطين قبل ٣٠ يوماً من التطبيق
• سيُعرَض إشعار واضح داخل المنصة
• للتغييرات الجوهرية المتعلقة بمشاركة البيانات، سنطلب موافقتك الصريحة من جديد

استمرارك في استخدام المنصة بعد تاريخ سريان التحديثات يُعدّ موافقةً ضمنية عليها.`,
  },
];

export default function PrivacyPage() {
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

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 pt-16 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <Shield className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">سياسة الخصوصية</h1>
            <p className="text-sm text-slate-400">آخر تحديث: {LAST_UPDATED}</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 mb-8" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <p className="text-sm text-slate-600 leading-relaxed">
            خصوصيتك وسرية ملفاتك القانونية تُشكّل الأساس الذي بُنيت عليه منصة عدالة AI. هذه السياسة تشرح بوضوح ماذا نجمع من بيانات، وكيف نستخدمها، وكيف نحميها، وما هي حقوقك الكاملة عليها.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((sec, i) => (
            <div key={i} className="rounded-2xl p-6" style={{ background: "#ffffff", border: "1px solid #E2E8F0" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <sec.icon className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <h2 className="text-base font-bold text-slate-800">{sec.title}</h2>
              </div>
              <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-line space-y-1">
                {sec.content.split('\n').map((line, j) => (
                  <p key={j} className={line.startsWith('•') || line.startsWith('**') ? "me-2" : ""}>
                    {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-8 rounded-2xl p-6 text-center" style={{ background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <Mail className="w-6 h-6 mx-auto mb-3 text-emerald-600" />
          <h3 className="font-bold text-slate-800 mb-1">مسؤول حماية البيانات</h3>
          <p className="text-sm text-slate-500 mb-3">للاستفسارات المتعلقة بخصوصيتك أو ممارسة حقوقك</p>
          <a href="mailto:privacy@adala-ai.sa" className="text-sm font-semibold text-emerald-600">privacy@adala-ai.sa</a>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 mt-8 pt-6 pb-10 border-t border-slate-200">
          <Link href="/terms"><span className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">الشروط والأحكام</span></Link>
          <span className="text-slate-200">•</span>
          <Link href="/security"><span className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">الأمان وحماية البيانات</span></Link>
          <span className="text-slate-200">•</span>
          <Link href="/"><span className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">الرئيسية</span></Link>
        </div>
      </div>
    </div>
  );
}
