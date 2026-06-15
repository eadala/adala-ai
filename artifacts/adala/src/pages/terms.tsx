import { Link } from "wouter";
import { Scale, ArrowRight, Shield, FileText, AlertTriangle, Ban, CreditCard, Globe, BookOpen, Mail } from "lucide-react";

const GOLD = "#1A56DB";
const LAST_UPDATED = "١ يونيو ٢٠٢٦";

const sections = [
  {
    icon: BookOpen,
    title: "١. قبول الشروط",
    content: `باستخدامك منصة عدالة AI أو تسجيل حساب عليها، فأنت توافق صراحةً على الالتزام بهذه الشروط والأحكام وسياسة الخصوصية المرتبطة بها. إذا كنت تُنشئ حساباً نيابةً عن مكتب قانوني أو منظمة، فأنت تُقرّ بأنك مخوّل بقبول هذه الشروط باسمها.

إذا لم توافق على أي من هذه الشروط، يُرجى التوقف عن استخدام المنصة فوراً. يحق لنا تعديل هذه الشروط في أي وقت، وسيُبلَّغ المستخدمون المسجلون بأي تغييرات جوهرية عبر البريد الإلكتروني أو الإشعارات داخل المنصة.`,
  },
  {
    icon: Globe,
    title: "٢. وصف الخدمة",
    content: `عدالة AI هي منصة SaaS (برمجيات كخدمة) متخصصة في إدارة المكاتب القانونية في المملكة العربية السعودية. تشمل الخدمات المقدمة:

• إدارة القضايا والملفات القانونية
• إدارة العملاء والتواصل معهم
• إعداد العقود والمستندات القانونية
• الفواتير والمدفوعات
• المساعد القانوني بالذكاء الاصطناعي
• صفحات المكاتب القانونية العامة
• نظام الحجوزات الاستشارية

تُقدَّم الخدمة "كما هي" وفق الخطة المشترك فيها، وتخضع التحديثات والميزات الجديدة لتقدير الشركة وسياسات خارطة الطريق المُعلنة.`,
  },
  {
    icon: CreditCard,
    title: "٣. الاشتراكات والمدفوعات",
    content: `تُقدَّم المنصة وفق خطط اشتراك شهرية أو سنوية. تُجدَّد الاشتراكات تلقائياً في نهاية كل دورة فاتورية ما لم تُلغَ قبل ٢٤ ساعة من تاريخ التجديد.

• الأسعار بالريال السعودي (SAR) وتشمل ضريبة القيمة المضافة
• المدفوعات تتم عبر بوابات دفع آمنة (Stripe)
• لا تُسترد الرسوم المدفوعة مسبقاً عند الإلغاء، إلا في حالات العطل الجسيم من جانبنا
• في حال عدم السداد، يُعلَّق الوصول تلقائياً بعد ٧ أيام من تاريخ استحقاق الفاتورة
• التخفيض من خطة أعلى إلى أدنى يُطبَّق عند بداية الدورة الفاتورية القادمة`,
  },
  {
    icon: Shield,
    title: "٤. حقوق الملكية الفكرية",
    content: `جميع محتويات المنصة من تصاميم وأكواد وخوارزميات وعلامات تجارية وشعارات هي ملكية حصرية لشركة عدالة AI ولا يجوز نسخها أو توزيعها أو إعادة استخدامها دون إذن كتابي مسبق.

البيانات التي تُدخلها في المنصة (ملفات القضايا، العقود، بيانات العملاء) هي ملكيتك أنت ومكتبك. تحتفظ عدالة AI بحق استخدام البيانات المُجمَّعة والمجهولة الهوية لتحسين جودة الخدمة والذكاء الاصطناعي.

لا يُمنح المستخدمون أي ترخيص لهندسة الكود عكسياً أو تفكيك النظام أو إنشاء أعمال مشتقة منه.`,
  },
  {
    icon: AlertTriangle,
    title: "٥. حدود المسؤولية",
    content: `لا تُعدّ المعلومات المُولَّدة بالذكاء الاصطناعي داخل المنصة استشارةً قانونيةً رسمية. يتحمل المستخدم المسؤولية الكاملة عن مراجعة أي مخرجات قبل الاعتماد عليها في أعماله القانونية.

تُحدَّد مسؤولية عدالة AI تجاه المستخدم بقيمة ما دفعه خلال آخر ثلاثة أشهر من الاشتراك، ولا تتحمل الشركة أي مسؤولية عن:
• الأضرار غير المباشرة أو التبعية
• فقدان البيانات الناجم عن إهمال المستخدم
• انقطاع الخدمة بسبب قوة قاهرة
• قرارات قانونية بُنيت اعتماداً كلياً على مخرجات الذكاء الاصطناعي`,
  },
  {
    icon: Ban,
    title: "٦. الاستخدام المحظور",
    content: `يُحظر استخدام المنصة في:
• أي نشاط مخالف للأنظمة والتشريعات السعودية
• التحرش أو الإساءة أو التهديد لأي طرف
• نشر محتوى مضلل أو مزيف أو انتحال صفة جهة قانونية
• اختراق أنظمة الأمان أو محاولة الوصول غير المصرح به
• إنشاء حسابات متعددة للتحايل على قيود الخطة
• بيع أو مشاركة بيانات الوصول مع أطراف غير مرخصة

مخالفة هذه البنود تُفضي إلى الإيقاق الفوري للحساب دون استرداد الرسوم المدفوعة.`,
  },
  {
    icon: FileText,
    title: "٧. إنهاء الاشتراك",
    content: `يحق لأي طرف إنهاء التعاقد في أي وقت:

• يحق للمستخدم إلغاء اشتراكه من لوحة الإعدادات، ويظل وصوله مفعلاً حتى نهاية الفترة المدفوعة
• تحتفظ عدالة AI بالحق في إيقاف أو إنهاء الحسابات المخالفة للشروط فوراً
• عند الإنهاء، تُتاح بيانات المستخدم للتصدير لمدة ٣٠ يوماً، ثم تُحذف بشكل آمن ونهائي
• الإيقاف بسبب عدم السداد لا يُتيح الوصول للبيانات إلا بعد تسوية المبالغ المتأخرة`,
  },
  {
    icon: CreditCard,
    title: "٩. رسوم خدمات الدفع الإلكتروني",
    content: `إذا قام المستخدم بتفعيل خدمات الدفع الإلكتروني المقدمة من خلال المنصة، فإنه يوافق على ما يلي:

• يتم استقطاع عمولة تشغيل وإدارة بنسبة 10% من قيمة المبالغ المحصلة عبر المنصة.
• قد تطبق رسوم إضافية خاصة بمزودي خدمات الدفع الإلكتروني، وتكون مستقلة عن رسوم المنصة.
• يتم خصم العمولة تلقائياً عند تنفيذ عملية الدفع.
• يحق لمنصة عدالة AI تعديل رسوم خدمات الدفع الإلكتروني مستقبلاً، مع إشعار المستخدم وفقاً للأنظمة المعمول بها.

عند استخدام متجر الخدمات القانونية والدفع الإلكتروني عبر منصة عدالة AI، يتم تحويل صافي المبلغ المستحق للمكتب بعد خصم عمولة المنصة البالغة 10% ورسوم مزود خدمة الدفع إن وجدت.`,
  },
  {
    icon: Scale,
    title: "١٠. القانون المطبق والتحكيم",
    content: `تخضع هذه الشروط للأنظمة والتشريعات المعمول بها في المملكة العربية السعودية. في حال نشوء أي نزاع، يُفضَّل حلّه وديّاً خلال ٣٠ يوماً. في حال تعذّر ذلك، يُلجأ إلى التحكيم وفقاً لأنظمة التحكيم السعودية.

المحاكم المختصة: المحاكم التجارية في مدينة الرياض، المملكة العربية السعودية.

اللغة الرسمية لهذه الشروط هي العربية، وفي حال وجود أي تعارض مع أي نسخة مترجمة، تُقدَّم النسخة العربية.`,
  },
];

export default function TermsPage() {
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
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}>
            <FileText className="w-6 h-6" style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">الشروط والأحكام</h1>
            <p className="text-sm text-slate-400">آخر تحديث: {LAST_UPDATED}</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 mb-8" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
          <p className="text-sm text-slate-600 leading-relaxed">
            تُنظِّم هذه الوثيقة العلاقة القانونية بين شركة عدالة AI ومستخدمي المنصة. يُرجى قراءتها بعناية قبل استخدام الخدمات أو الاشتراك في أي خطة. باستخدامك للمنصة فأنت توافق على جميع البنود الواردة أدناه.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((sec, i) => (
            <div key={i} className="rounded-2xl p-6" style={{ background: "#ffffff", border: "1px solid #E2E8F0" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}25` }}>
                  <sec.icon className="w-4.5 h-4.5" style={{ color: GOLD }} />
                </div>
                <h2 className="text-base font-bold text-slate-800">{sec.title}</h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{sec.content}</p>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-8 rounded-2xl p-6 text-center" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
          <Mail className="w-6 h-6 mx-auto mb-3" style={{ color: GOLD }} />
          <h3 className="font-bold text-slate-800 mb-1">هل لديك استفسار قانوني؟</h3>
          <p className="text-sm text-slate-500 mb-3">تواصل مع فريق الدعم القانوني لدينا</p>
          <a href="mailto:legal@adala-ai.sa" className="text-sm font-semibold" style={{ color: GOLD }}>legal@adala-ai.sa</a>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 mt-8 pt-6 pb-10 border-t border-slate-200">
          <Link href="/privacy"><span className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">سياسة الخصوصية</span></Link>
          <span className="text-slate-200">•</span>
          <Link href="/security"><span className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">الأمان وحماية البيانات</span></Link>
          <span className="text-slate-200">•</span>
          <Link href="/"><span className="text-sm text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">الرئيسية</span></Link>
        </div>
      </div>
    </div>
  );
}
