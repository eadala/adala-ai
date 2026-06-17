import { useState } from "react";
import { Link } from "wouter";
import {
  Scale, Mail, Phone, MessageSquare, ChevronDown, ChevronUp,
  CheckCircle2, ArrowLeft, Clock, Shield, Headphones, Send,
  AlertCircle,
} from "lucide-react";

const BASE   = import.meta.env.BASE_URL.replace(/\/$/, "");
const ACCENT = "#2563EB";
const DARK   = "#0B1F3B";
const BODY   = "#374151";
const MUTED  = "#6B7280";
const BORDER = "#E5E7EB";
const BG     = "#F8FAFC";
const BG2    = "#F1F5F9";
const WHITE  = "#FFFFFF";
const SUCCESS = "#16A34A";

const CATEGORIES = [
  { value: "general",   label: "استفسار عام" },
  { value: "technical", label: "مشكلة تقنية" },
  { value: "billing",   label: "الفوترة والاشتراكات" },
  { value: "sales",     label: "طلب عرض أسعار" },
  { value: "other",     label: "أخرى" },
];

const FAQ_ITEMS = [
  { q: "كم يستغرق الرد على طلب الدعم؟", a: "نرد على جميع الطلبات خلال ساعة واحدة في أوقات الدوام الرسمي (9ص–9م). للحالات الحرجة نرد فوراً." },
  { q: "هل الدعم الفني متاح على مدار الساعة؟", a: "نعم، لديك وصول إلى قاعدة المعرفة والمساعد الذكي 24/7. للدعم البشري: الأحد-الخميس 9ص-9م، ومتاح طوارئ في عطل نهاية الأسبوع." },
  { q: "هل يمكنني طلب عرض توضيحي للمنصة؟", a: "بالتأكيد! اختر تصنيف \"طلب عرض أسعار\" وسيتواصل معك فريق المبيعات لجدولة عرض مباشر يناسب وقتك." },
  { q: "هل تدعمون تخصيص المنصة لاحتياجات مكتبي؟", a: "نعم، توفر عدالة AI خطط Enterprise مع تخصيص كامل، تكامل مع أنظمتك الحالية، ومدير حساب مخصص." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-2xl overflow-hidden cursor-pointer"
      style={{ borderColor: open ? `${ACCENT}50` : BORDER, background: open ? "#EFF6FF" : WHITE }}
      onClick={() => setOpen(p => !p)}>
      <div className="flex items-center justify-between px-5 py-4">
        <span className="font-semibold text-sm" style={{ color: open ? ACCENT : DARK }}>{q}</span>
        {open ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
               : <ChevronDown className="w-4 h-4 shrink-0" style={{ color: MUTED }} />}
      </div>
      <div style={{ maxHeight: open ? "300px" : "0", overflow: "hidden", transition: "max-height 0.25s ease" }}>
        <p className="px-5 pb-4 text-sm leading-relaxed" style={{ color: BODY }}>{a}</p>
      </div>
    </div>
  );
}

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", subject: "", body: "", category: "general",
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.body) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${BASE}/api/support/public-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطأ في الإرسال");
      setSent(true);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${BORDER}`,
    background: WHITE, color: DARK, fontSize: 14, outline: "none",
    transition: "border-color 0.15s",
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: BG, color: DARK, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>

      {/* ── Navbar ──────────────────────────────────────────────── */}
      <nav style={{ background: WHITE, borderBottom: `1px solid ${BORDER}`, position: "sticky", top: 0, zIndex: 50 }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: ACCENT }}>
                <Scale className="w-4 h-4 text-white" />
              </div>
              <span className="font-black text-base" style={{ color: DARK }}>
                عدالة <span style={{ color: ACCENT }}>AI</span>
              </span>
            </div>
          </Link>
          <Link href={`${BASE}/sign-in`}>
            <button className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors hover:bg-slate-100"
              style={{ color: DARK }}>
              تسجيل الدخول
            </button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(135deg, ${DARK} 0%, #1e3a8a 100%)`, padding: "52px 24px" }}>
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "rgba(37,99,235,0.3)", border: "1px solid rgba(37,99,235,0.4)" }}>
            <Headphones className="w-7 h-7" style={{ color: "#93c5fd" }} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3" style={{ letterSpacing: "-0.02em" }}>
            تواصل مع فريق الدعم
          </h1>
          <p className="text-base" style={{ color: "rgba(255,255,255,0.60)", lineHeight: "1.75" }}>
            فريقنا جاهز لمساعدتك — سنرد عليك خلال ساعة واحدة في أوقات الدوام
          </p>

          {/* Trust strip */}
          <div className="flex items-center justify-center gap-6 flex-wrap mt-6">
            {[
              { icon: <Clock className="w-4 h-4" />, label: "رد خلال ساعة" },
              { icon: <Shield className="w-4 h-4" />, label: "دعم متخصص" },
              { icon: <MessageSquare className="w-4 h-4" />, label: "دعم عربي كامل" },
            ].map((item, i) => (
              <span key={i} className="flex items-center gap-2 text-sm"
                style={{ color: "rgba(255,255,255,0.55)" }}>
                {item.icon} {item.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid lg:grid-cols-3 gap-10">

          {/* ── Contact Form (2/3) ─────────────────────────────── */}
          <div className="lg:col-span-2">
            <div style={{ background: WHITE, borderRadius: 20, border: `1px solid ${BORDER}`,
                          boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "32px 28px" }}>

              {sent ? (
                /* ── Success State ── */
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                    style={{ background: "#D1FAE5" }}>
                    <CheckCircle2 className="w-8 h-8" style={{ color: SUCCESS }} />
                  </div>
                  <h2 className="text-2xl font-black mb-3" style={{ color: DARK }}>
                    تم إرسال طلبك بنجاح!
                  </h2>
                  <p className="text-sm mb-2" style={{ color: BODY, lineHeight: "1.75" }}>
                    شكراً <strong>{form.name}</strong> — تم استلام طلبك بنجاح.
                  </p>
                  <p className="text-sm mb-8" style={{ color: MUTED }}>
                    سيتواصل معك فريق الدعم على <strong>{form.email}</strong> خلال ساعة واحدة.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button onClick={() => { setSent(false); setForm({ name:"",email:"",phone:"",subject:"",body:"",category:"general" }); }}
                      className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-slate-50"
                      style={{ borderColor: BORDER, color: BODY }}>
                      إرسال طلب آخر
                    </button>
                    <Link href="/">
                      <button className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                        style={{ background: ACCENT }}>
                        العودة للرئيسية
                      </button>
                    </Link>
                  </div>
                </div>
              ) : (
                /* ── Form ── */
                <form onSubmit={submit}>
                  <h2 className="text-xl font-black mb-1" style={{ color: DARK }}>أرسل طلب دعم</h2>
                  <p className="text-sm mb-7" style={{ color: MUTED }}>
                    املأ النموذج وسيصل طلبك مباشرة لفريق عدالة AI
                  </p>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl mb-5 text-sm"
                      style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}>
                      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                    </div>
                  )}

                  {/* Row 1: Name + Email */}
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: DARK }}>
                        الاسم الكامل <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input style={inputStyle} placeholder="محمد العمري" value={form.name} onChange={set("name")} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: DARK }}>
                        البريد الإلكتروني <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input style={inputStyle} type="email" placeholder="name@example.com" value={form.email} onChange={set("email")} required />
                    </div>
                  </div>

                  {/* Row 2: Phone + Category */}
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: DARK }}>رقم الجوال</label>
                      <input style={inputStyle} type="tel" placeholder="+966 5X XXX XXXX" value={form.phone} onChange={set("phone")} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1.5" style={{ color: DARK }}>
                        نوع الطلب <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <select style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
                        value={form.category} onChange={set("category")}>
                        {CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Subject */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold mb-1.5" style={{ color: DARK }}>
                      موضوع الطلب <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input style={inputStyle} placeholder="اكتب موضوع طلبك بإيجاز..." value={form.subject} onChange={set("subject")} required />
                  </div>

                  {/* Message */}
                  <div className="mb-6">
                    <label className="block text-xs font-bold mb-1.5" style={{ color: DARK }}>
                      تفاصيل الطلب <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <textarea
                      style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: "1.7" }}
                      placeholder="اشرح طلبك أو مشكلتك بالتفصيل..."
                      value={form.body}
                      onChange={set("body")}
                      required
                    />
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 font-bold py-3.5 rounded-xl text-sm text-white transition-all hover:opacity-90 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, #1d4ed8)`,
                             boxShadow: "0 4px 16px rgba(37,99,235,0.30)" }}>
                    {loading
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جارٍ الإرسال...</>
                      : <><Send className="w-4 h-4" /> إرسال الطلب</>}
                  </button>

                  <p className="text-xs text-center mt-4" style={{ color: MUTED }}>
                    بالإرسال توافق على{" "}
                    <Link href="/privacy"><span className="underline cursor-pointer hover:opacity-70" style={{ color: ACCENT }}>سياسة الخصوصية</span></Link>
                    {" "}و{" "}
                    <Link href="/terms"><span className="underline cursor-pointer hover:opacity-70" style={{ color: ACCENT }}>شروط الخدمة</span></Link>
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* ── Sidebar (1/3) ───────────────────────────────────── */}
          <div className="space-y-5">

            {/* Contact info */}
            <div style={{ background: WHITE, borderRadius: 16, border: `1px solid ${BORDER}`,
                          boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "22px 20px" }}>
              <h3 className="font-bold text-sm mb-4" style={{ color: DARK }}>قنوات التواصل</h3>
              <div className="space-y-4">
                {[
                  { icon: <Mail className="w-4 h-4" />, label: "البريد الإلكتروني", val: "support@adalah-ai.sa", color: ACCENT },
                  { icon: <Phone className="w-4 h-4" />, label: "الهاتف / واتساب", val: "+966 50 000 0000", color: SUCCESS },
                  { icon: <Clock className="w-4 h-4" />, label: "ساعات العمل", val: "الأحد – الخميس، 9ص – 9م", color: MUTED },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: BG2, color: item.color }}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5" style={{ color: MUTED }}>{item.label}</p>
                      <p className="text-sm font-semibold" style={{ color: DARK }}>{item.val}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response time promise */}
            <div style={{ background: "#EFF6FF", borderRadius: 16, border: "1px solid #BFDBFE", padding: "20px" }}>
              <div className="flex items-center gap-2.5 mb-2">
                <Clock className="w-4 h-4" style={{ color: ACCENT }} />
                <span className="font-bold text-sm" style={{ color: ACCENT }}>وعدنا بالاستجابة</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#1e40af", lineHeight: "1.7" }}>
                نرد على جميع الطلبات خلال <strong>ساعة واحدة</strong> في أوقات الدوام.
                للحالات الطارئة نعطي الأولوية القصوى.
              </p>
            </div>

            {/* Quick actions */}
            <div style={{ background: WHITE, borderRadius: 16, border: `1px solid ${BORDER}`,
                          boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "20px" }}>
              <h3 className="font-bold text-sm mb-4" style={{ color: DARK }}>روابط سريعة</h3>
              <div className="space-y-2">
                <Link href={`${BASE}/sign-up`}>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-slate-50"
                    style={{ border: `1px solid ${BORDER}` }}>
                    <ArrowLeft className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    <span className="text-sm font-medium" style={{ color: BODY }}>ابدأ تجربة مجانية 90 يوم</span>
                  </div>
                </Link>
                <Link href={`${BASE}/demo-login`}>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-slate-50"
                    style={{ border: `1px solid ${BORDER}` }}>
                    <ArrowLeft className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    <span className="text-sm font-medium" style={{ color: BODY }}>جرّب النسخة التجريبية</span>
                  </div>
                </Link>
                <Link href="/pricing">
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-slate-50"
                    style={{ border: `1px solid ${BORDER}` }}>
                    <ArrowLeft className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    <span className="text-sm font-medium" style={{ color: BODY }}>عرض الباقات والأسعار</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <div className="mt-14">
          <h2 className="text-2xl font-black mb-2 text-center" style={{ color: DARK }}>الأسئلة الشائعة</h2>
          <p className="text-sm text-center mb-8" style={{ color: MUTED }}>إجابات على أكثر الأسئلة شيوعاً</p>
          <div className="max-w-2xl mx-auto space-y-3">
            {FAQ_ITEMS.map((item, i) => <FAQItem key={i} q={item.q} a={item.a} />)}
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="text-center py-8" style={{ borderTop: `1px solid ${BORDER}`, color: MUTED }}>
        <p className="text-sm">
          © 2025 عدالة AI — منصة SaaS قانونية متكاملة |{" "}
          <Link href="/privacy"><span className="underline cursor-pointer hover:opacity-70">الخصوصية</span></Link>
          {" · "}
          <Link href="/terms"><span className="underline cursor-pointer hover:opacity-70">الشروط</span></Link>
        </p>
      </div>
    </div>
  );
}
