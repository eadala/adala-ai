import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock, Shield, Star, ArrowRight, CheckCircle2,
  CreditCard, Phone, Mail, User, AlertCircle, Loader2
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Lang = "ar" | "en";
const t = (ar: string, en: string, lang: Lang) => lang === "ar" ? ar : en;

const CATEGORY_ICONS: Record<string, string> = {
  "استشارة": "⚖️", "عقود": "📄", "تمثيل": "🏛️",
  "توثيق": "📜", "دراسة": "🔍", "أخرى": "📋",
};

export default function OfficeServiceDetail() {
  const params = useParams<{ slug: string; serviceId: string }>();
  const [, navigate] = useLocation();
  const [lang, setLang] = useState<Lang>("ar");
  const [form, setForm] = useState({ clientName: "", clientPhone: "", clientEmail: "", notes: "" });
  const [formError, setFormError] = useState("");
  const [ordering, setOrdering] = useState(false);
  const [ordered, setOrdered] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["office-public", params.slug],
    queryFn: () => fetch(`${BASE}/api/office/public/${params.slug}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 5 * 60 * 1000,
  });
  /* API returns { office: {...}, services: [...], team: [...], ... } */
  const office = data?.office;
  const services: any[] = data?.services ?? [];

  if (isLoading) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-[#C9A84C]/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <AlertCircle className="h-8 w-8 text-[#C9A84C]" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A84C] mx-auto" />
      </div>
    </div>
  );

  if (isError || !data?.services) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white text-center px-6">
      <div>
        <div className="h-24 w-24 rounded-3xl bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-12 w-12 text-[#C9A84C] opacity-50" />
        </div>
        <h1 className="text-3xl font-black mb-3">{lang === "ar" ? "المكتب غير موجود" : "Office Not Found"}</h1>
        <p className="text-white/50 text-sm mb-6">{lang === "ar" ? "تحقق من الرابط أو تواصل مع المكتب" : "Check the URL or contact the office"}</p>
        <button onClick={() => navigate("/")} className="px-6 py-2.5 rounded-xl bg-[#C9A84C] text-black font-bold text-sm hover:bg-[#b8943d] transition-colors">
          {lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
        </button>
      </div>
    </div>
  );

  const gold = office?.primaryColor ?? "#C9A84C";
  const svc = services.find((s: any) => s.id === params.serviceId);

  if (!svc) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white text-center px-6">
      <div>
        <div className="h-24 w-24 rounded-3xl bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-12 w-12 text-[#C9A84C] opacity-50" />
        </div>
        <h1 className="text-3xl font-black mb-3">{lang === "ar" ? "الخدمة غير موجودة" : "Service Not Found"}</h1>
        <p className="text-white/50 text-sm mb-6">{lang === "ar" ? "هذه الخدمة غير متاحة أو ربما تم حذفها" : "This service is unavailable or may have been removed"}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(`/firms/${params.slug}`)} className="px-6 py-2.5 rounded-xl border border-white/20 text-white text-sm font-semibold hover:bg-white/10 transition-colors">
            {lang === "ar" ? "العودة للمكتب" : "Back to Office"}
          </button>
          <button onClick={() => navigate(`/firms/${params.slug}/store`)} className="px-6 py-2.5 rounded-xl bg-[#C9A84C] text-black font-bold text-sm hover:bg-[#b8943d] transition-colors">
            {lang === "ar" ? "عرض الخدمات" : "View Services"}
          </button>
        </div>
      </div>
    </div>
  );

  const name = t(svc.name, svc.nameEn ?? svc.name, lang);
  const desc = t(svc.description ?? "", svc.descriptionEn ?? svc.description ?? "", lang);
  const icon = CATEGORY_ICONS[svc.category] ?? "⚖️";

  async function handleOrder() {
    if (!form.clientName.trim()) { setFormError(lang === "ar" ? "الاسم مطلوب" : "Name is required"); return; }
    if (!form.clientPhone.trim()) { setFormError(lang === "ar" ? "رقم الهاتف مطلوب" : "Phone is required"); return; }
    setFormError("");
    setOrdering(true);
    try {
      if (!svc.isCustomQuote) {
        const r = await fetch(`${BASE}/api/office/public/${params.slug}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId: svc.id, ...form }),
        }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
        if (r.url) { window.location.href = r.url; return; }
        setFormError(r.error ?? (lang === "ar" ? "حدث خطأ" : "An error occurred"));
      } else {
        await fetch(`${BASE}/api/office/public/${params.slug}/order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId: svc.id, ...form }),
        });
        setOrdered(true);
      }
    } catch {
      setFormError(lang === "ar" ? "حدث خطأ في الاتصال" : "Connection error");
    } finally {
      setOrdering(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <button onClick={() => navigate(`/firms/${params.slug}`)}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
          <ArrowRight className="h-4 w-4" />
          {lang === "ar" ? "العودة للمكتب" : "Back to office"}
        </button>
        <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
          className="text-xs text-white/40 hover:text-white/70 transition-colors border border-white/10 px-3 py-1 rounded-full">
          {lang === "ar" ? "EN" : "عربي"}
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-2 gap-10">
        {/* Left — Service Details */}
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
              style={{ background: `${gold}15` }}>
              {icon}
            </div>
            <div>
              <h1 className="text-2xl font-black leading-tight">{name}</h1>
              {svc.category && (
                <Badge className="mt-1.5 text-xs" style={{ background: `${gold}20`, color: gold, border: `1px solid ${gold}30` }}>
                  {svc.category}
                </Badge>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="rounded-2xl border border-white/10 p-5" style={{ background: `${gold}08` }}>
            {svc.isCustomQuote ? (
              <div>
                <p className="text-xs text-white/50 mb-1">{lang === "ar" ? "السعر" : "Price"}</p>
                <p className="text-2xl font-black" style={{ color: gold }}>
                  {lang === "ar" ? "حسب العرض" : "Custom Quote"}
                </p>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black" style={{ color: gold }}>
                  {Number(svc.price).toLocaleString()}
                </span>
                <span className="text-white/50 mb-1">{lang === "ar" ? "ر.س" : "SAR"}</span>
              </div>
            )}
            {svc.deliveryDays > 0 && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-white/40">
                <Clock className="h-3.5 w-3.5" />
                {lang === "ar" ? `مدة التسليم: ${svc.deliveryDays} يوم` : `Delivery: ${svc.deliveryDays} days`}
              </div>
            )}
          </div>

          {/* Description */}
          {desc && (
            <div>
              <h2 className="text-sm font-bold text-white/70 mb-2">{lang === "ar" ? "وصف الخدمة" : "Service Description"}</h2>
              <p className="text-sm text-white/55 leading-relaxed">{desc}</p>
            </div>
          )}

          {/* Trust badges */}
          <div className="space-y-2">
            {[
              { icon: Shield, text: lang === "ar" ? "الدفع آمن 100%" : "100% Secure Payment" },
              { icon: Star, text: lang === "ar" ? "مكتب موثوق ومرخص" : "Verified & Licensed Office" },
              { icon: CheckCircle2, text: lang === "ar" ? "ضمان جودة الخدمة" : "Service Quality Guarantee" },
            ].map(({ icon: I, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-xs text-white/40">
                <I className="h-4 w-4 shrink-0" style={{ color: `${gold}90` }} />
                {text}
              </div>
            ))}
          </div>

          {/* Office info */}
          <div className="rounded-xl border border-white/8 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-lg font-black shrink-0"
              style={{ background: `${gold}20`, color: gold }}>
              {(office?.name ?? "م")[0]}
            </div>
            <div>
              <p className="text-sm font-bold">{office?.name ?? ""}</p>
              <p className="text-xs text-white/40">{office?.tagline ?? (lang === "ar" ? "مكتب قانوني" : "Law Office")}</p>
            </div>
          </div>
        </div>

        {/* Right — Order Form */}
        <div className="rounded-2xl border border-white/10 p-6 bg-white/3 h-fit">
          {ordered ? (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="h-14 w-14 mx-auto" style={{ color: gold }} />
              <h2 className="text-xl font-black">{lang === "ar" ? "تم استلام طلبك!" : "Request Received!"}</h2>
              <p className="text-sm text-white/55">
                {lang === "ar"
                  ? "سيتواصل معك فريق المكتب قريباً لتأكيد الطلب وإرسال العرض."
                  : "The office team will contact you shortly to confirm and send a quote."}
              </p>
              <Button onClick={() => navigate(`/firms/${params.slug}`)} variant="outline" className="mt-2">
                {lang === "ar" ? "العودة للمكتب" : "Back to Office"}
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-black mb-0.5">
                  {svc.isCustomQuote
                    ? (lang === "ar" ? "طلب عرض سعر" : "Request a Quote")
                    : (lang === "ar" ? "اطلب الخدمة الآن" : "Order Now")}
                </h2>
                <p className="text-xs text-white/40">
                  {lang === "ar" ? "أدخل بياناتك وسنتواصل معك فوراً" : "Enter your info and we'll reach out immediately"}
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {lang === "ar" ? "الاسم الكامل *" : "Full Name *"}
                  </Label>
                  <Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                    placeholder={lang === "ar" ? "أدخل اسمك" : "Enter your name"}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    {lang === "ar" ? "رقم الهاتف *" : "Phone Number *"}
                  </Label>
                  <Input value={form.clientPhone} onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))}
                    placeholder={lang === "ar" ? "05xxxxxxxx" : "05xxxxxxxx"}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm" dir="ltr" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {lang === "ar" ? "البريد الإلكتروني" : "Email (optional)"}
                  </Label>
                  <Input value={form.clientEmail} onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
                    placeholder={lang === "ar" ? "example@email.com" : "example@email.com"}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm" dir="ltr" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-white/60">{lang === "ar" ? "ملاحظات إضافية" : "Additional Notes"}</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder={lang === "ar" ? "أي تفاصيل إضافية..." : "Any additional details..."}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm resize-none" rows={3} />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {formError}
                </div>
              )}

              <Button className="w-full font-bold py-5 text-sm" style={{ background: gold, color: "#000" }}
                onClick={handleOrder} disabled={ordering}>
                {ordering ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    {!svc.isCustomQuote && <CreditCard className="h-4 w-4 ml-1.5" />}
                    {svc.isCustomQuote
                      ? (lang === "ar" ? "أرسل طلب العرض" : "Send Quote Request")
                      : (lang === "ar" ? "ادفع الآن" : "Pay Now")}
                  </>
                )}
              </Button>

              {!svc.isCustomQuote && (
                <p className="text-center text-[10px] text-white/25 flex items-center justify-center gap-1">
                  <Shield className="h-3 w-3" />
                  {lang === "ar" ? "مدفوعات مؤمّنة بـ Stripe" : "Secured by Stripe"}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
