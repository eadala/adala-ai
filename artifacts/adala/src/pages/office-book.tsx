import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Scale, Loader2, ChevronLeft, Phone, Mail, MapPin,
  MessageCircle, Calendar, CheckCircle2, Clock, BadgeCheck,
  Send, User, FileText, ArrowRight, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Lang = "ar" | "en";
function t(ar: string | null | undefined, en: string | null | undefined, lang: Lang) {
  if (lang === "en" && en) return en;
  return ar ?? "";
}
function imgSrc(p: string | null | undefined) {
  if (!p) return undefined;
  if (p.startsWith("http")) return p;
  return `/api/storage/objects${p.startsWith("/") ? p : "/" + p}`;
}

const CONSULTATION_TYPES_AR = [
  "استشارة قانونية عامة",
  "استشارة في القانون التجاري",
  "استشارة في قانون الأسرة",
  "استشارة في العقارات",
  "استشارة في العمالة والتوظيف",
  "مراجعة عقد",
  "تمثيل قانوني",
  "أخرى",
];
const CONSULTATION_TYPES_EN = [
  "General Legal Consultation",
  "Commercial Law Consultation",
  "Family Law Consultation",
  "Real Estate Consultation",
  "Labor & Employment Consultation",
  "Contract Review",
  "Legal Representation",
  "Other",
];

const TIMES = ["٩:٠٠ص", "١٠:٠٠ص", "١١:٠٠ص", "١٢:٠٠م", "١:٠٠م", "٢:٠٠م", "٣:٠٠م", "٤:٠٠م", "٥:٠٠م"];
const TIMES_EN = ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];

/* ══════════════════════════════════════════════════════════════ */
export default function OfficeBook() {
  const { slug } = useParams<{ slug: string }>();
  const [lang, setLang] = useState<Lang>("ar");
  const [step, setStep] = useState<"form" | "success">("form");

  const [form, setForm] = useState({
    clientName: "", clientPhone: "", clientEmail: "",
    serviceType: "", preferredDate: "", preferredTime: "", notes: "",
  });

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["office-public", slug],
    queryFn: () => fetch(`/api/office/public/${slug}`).then(r => r.json()),
  });

  const bookMutation = useMutation({
    mutationFn: () => fetch(`/api/office/public/${slug}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: form.clientName,
        clientPhone: form.clientPhone,
        clientEmail: form.clientEmail,
        isQuoteRequest: true,
        notes: [
          form.serviceType && `نوع الاستشارة: ${form.serviceType}`,
          form.preferredDate && `التاريخ المفضل: ${form.preferredDate}`,
          form.preferredTime && `الوقت المفضل: ${form.preferredTime}`,
          form.notes && `ملاحظات: ${form.notes}`,
        ].filter(Boolean).join("\n"),
      }),
    }).then(r => r.json()),
    onSuccess: () => setStep("success"),
  });

  const isValid = form.clientName.trim() && form.clientPhone.trim() && form.serviceType;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#080d1a" }}>
      <Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" />
    </div>
  );

  if (isError || !data?.office) return (
    <div className="min-h-screen flex items-center justify-center text-white" style={{ background: "#080d1a" }}>
      <div className="text-center"><Scale className="h-16 w-16 mx-auto mb-4 text-[#C9A84C] opacity-20" />
        <p className="text-xl font-bold">{lang === "ar" ? "المكتب غير موجود" : "Office not found"}</p>
      </div>
    </div>
  );

  const { office, services = [] } = data;
  const gold = office.primaryColor ?? "#C9A84C";
  const officeName = t(office.name, office.nameEn, lang);
  const consultTypes = lang === "ar" ? CONSULTATION_TYPES_AR : CONSULTATION_TYPES_EN;
  const times = lang === "ar" ? TIMES : TIMES_EN;
  const whatsappNum = (office.whatsapp ?? office.phone ?? "").replace(/\D/g, "");
  const paidServices = services.filter((s: any) => s.isActive && !s.isCustomQuote && s.price);

  return (
    <div
      className={cn("min-h-screen text-white", lang === "ar" ? "font-['Cairo',sans-serif]" : "font-sans")}
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ background: "linear-gradient(160deg, #080d1a 0%, #0d1528 100%)" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5" style={{ background: "rgba(8,13,26,0.95)", backdropFilter: "blur(12px)" }}>
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href={`/firms/${slug}`} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
            <ChevronLeft className={cn("h-4 w-4", lang === "en" && "rotate-180")} />
            {lang === "ar" ? "رجوع للصفحة" : "Back to Page"}
          </a>
          <div className="flex items-center gap-3">
            {office.logo ? (
              <img src={imgSrc(office.logo)} alt={officeName} className="h-7 w-7 rounded-lg object-cover" />
            ) : (
              <div className="h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: `${gold}20`, color: gold }}>
                {(officeName || "م")[0]}
              </div>
            )}
            <span className="font-bold text-sm">{officeName}</span>
          </div>
          <button
            onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
            className="text-xs px-2.5 py-1 rounded-lg font-bold border border-white/20"
            style={{ color: gold }}
          >
            {lang === "ar" ? "EN" : "ع"}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Page title */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-4"
            style={{ background: `${gold}15`, color: gold, border: `1px solid ${gold}30` }}>
            <Calendar className="h-3.5 w-3.5" />
            {lang === "ar" ? "حجز استشارة قانونية" : "Book a Legal Consultation"}
          </div>
          <h1 className="text-3xl font-black mb-2">
            {lang === "ar" ? "احجز استشارتك الآن" : "Book Your Consultation"}
          </h1>
          <p className="text-white/50 text-sm">
            {lang === "ar"
              ? "أكمل النموذج أدناه وسيتواصل معك فريق المكتب لتأكيد الموعد"
              : "Complete the form below and the office team will contact you to confirm the appointment"}
          </p>
        </div>

        {step === "success" ? (
          /* ── SUCCESS ── */
          <div className="max-w-md mx-auto text-center py-10">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.3)" }}>
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3">
              {lang === "ar" ? "تم إرسال طلبك!" : "Request Sent!"}
            </h2>
            <p className="text-white/60 mb-8 leading-relaxed">
              {lang === "ar"
                ? `شكراً ${form.clientName}، تم استلام طلب الحجز بنجاح. سيتواصل معك فريق ${officeName} قريباً لتأكيد موعدك.`
                : `Thank you ${form.clientName}, your booking request has been received. The ${officeName} team will contact you soon to confirm your appointment.`}
            </p>
            <div className="space-y-3">
              {whatsappNum && (
                <a
                  href={`https://wa.me/${whatsappNum}?text=${encodeURIComponent(lang === "ar" ? `مرحباً، أرسلت طلب حجز استشارة. اسمي ${form.clientName}.` : `Hello, I just submitted a consultation booking request. My name is ${form.clientName}.`)}`}
                  target="_blank" rel="noreferrer"
                >
                  <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3">
                    <MessageCircle className="h-4 w-4" />
                    {lang === "ar" ? "تواصل عبر واتساب" : "Contact via WhatsApp"}
                  </Button>
                </a>
              )}
              <a href={`/firms/${slug}`}>
                <Button variant="outline" className="w-full border-white/20 hover:bg-white/5">
                  {lang === "ar" ? "العودة لصفحة المكتب" : "Back to Office Page"}
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">

            {/* ── FORM (2 cols) ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Personal info */}
              <div className="p-6 rounded-2xl space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h2 className="font-bold flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" style={{ color: gold }} />
                  {lang === "ar" ? "بياناتك الشخصية" : "Your Personal Details"}
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block text-white/70">
                      {lang === "ar" ? "الاسم الكامل *" : "Full Name *"}
                    </Label>
                    <Input
                      value={form.clientName}
                      onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                      placeholder={lang === "ar" ? "محمد عبدالله" : "John Smith"}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block text-white/70">
                      {lang === "ar" ? "رقم الجوال *" : "Phone Number *"}
                    </Label>
                    <Input
                      value={form.clientPhone}
                      onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))}
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1.5 block text-white/70">
                    {lang === "ar" ? "البريد الإلكتروني" : "Email Address"}
                    <span className="text-white/30 font-normal mr-1">{lang === "ar" ? "(اختياري)" : "(optional)"}</span>
                  </Label>
                  <Input
                    value={form.clientEmail}
                    onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
                    placeholder="email@example.com"
                    dir="ltr"
                    type="email"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
              </div>

              {/* Consultation details */}
              <div className="p-6 rounded-2xl space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <h2 className="font-bold flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4" style={{ color: gold }} />
                  {lang === "ar" ? "تفاصيل الاستشارة" : "Consultation Details"}
                </h2>

                <div>
                  <Label className="text-xs font-semibold mb-1.5 block text-white/70">
                    {lang === "ar" ? "نوع الاستشارة *" : "Consultation Type *"}
                  </Label>
                  <Select value={form.serviceType} onValueChange={v => setForm(f => ({ ...f, serviceType: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder={lang === "ar" ? "اختر نوع الاستشارة" : "Select consultation type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {paidServices.length > 0 && (
                        <>
                          {paidServices.map((s: any) => (
                            <SelectItem key={s.id} value={t(s.name, s.nameEn, lang)}>
                              {t(s.name, s.nameEn, lang)}
                            </SelectItem>
                          ))}
                          <div className="border-t border-border/50 my-1" />
                        </>
                      )}
                      {consultTypes.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block text-white/70">
                      {lang === "ar" ? "التاريخ المفضل" : "Preferred Date"}
                    </Label>
                    <Input
                      type="date"
                      value={form.preferredDate}
                      onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))}
                      min={new Date().toISOString().split("T")[0]}
                      className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1.5 block text-white/70">
                      {lang === "ar" ? "الوقت المفضل" : "Preferred Time"}
                    </Label>
                    <Select value={form.preferredTime} onValueChange={v => setForm(f => ({ ...f, preferredTime: v }))}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder={lang === "ar" ? "اختر الوقت" : "Select time"} />
                      </SelectTrigger>
                      <SelectContent>
                        {times.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-1.5 block text-white/70">
                    {lang === "ar" ? "وصف موجز لطلبك" : "Brief Description of Your Request"}
                  </Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    placeholder={lang === "ar" ? "اذكر باختصار موضوع الاستشارة لتمكين المحامي من التحضير المسبق..." : "Briefly describe the consultation topic to help the lawyer prepare in advance..."}
                    className="resize-none bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  />
                </div>
              </div>

              <Button
                className="w-full py-6 text-base font-bold gap-2 transition-all hover:opacity-90 hover:scale-[1.01]"
                style={{ background: `linear-gradient(135deg, ${gold}, #f0d060)`, color: "#000" }}
                disabled={!isValid || bookMutation.isPending}
                onClick={() => bookMutation.mutate()}
              >
                {bookMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    {lang === "ar" ? "إرسال طلب الحجز" : "Send Booking Request"}
                  </>
                )}
              </Button>
            </div>

            {/* ── SIDEBAR (1 col) ── */}
            <div className="space-y-4">

              {/* Office info card */}
              <div className="p-5 rounded-2xl" style={{ background: `${gold}08`, border: `1px solid ${gold}20` }}>
                {office.logo ? (
                  <img src={imgSrc(office.logo)} alt={officeName} className="h-14 w-14 rounded-xl object-cover mb-3" />
                ) : (
                  <div className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl font-black mb-3"
                    style={{ background: `${gold}20`, color: gold }}>
                    {(officeName || "م")[0]}
                  </div>
                )}
                <h3 className="font-black text-base mb-0.5">{officeName}</h3>
                {office.licenseNumber && (
                  <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: gold }}>
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {lang === "ar" ? `مرخّص رقم ${office.licenseNumber}` : `Licensed No. ${office.licenseNumber}`}
                  </div>
                )}
                <div className="space-y-2">
                  {office.phone && (
                    <a href={`tel:${office.phone}`} className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors">
                      <Phone className="h-3.5 w-3.5 shrink-0" style={{ color: gold }} />
                      {office.phone}
                    </a>
                  )}
                  {office.email && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: gold }} />
                      {office.email}
                    </div>
                  )}
                  {office.city && (
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: gold }} />
                      {office.city}
                    </div>
                  )}
                </div>
              </div>

              {/* Steps */}
              <div className="p-5 rounded-2xl space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h4 className="font-bold text-sm text-white/80">
                  {lang === "ar" ? "كيف يعمل الحجز؟" : "How It Works"}
                </h4>
                {[
                  { n: "١", text: lang === "ar" ? "أكمل النموذج وأرسل الطلب" : "Fill the form & submit" },
                  { n: "٢", text: lang === "ar" ? "يصلك تأكيد من المكتب" : "Receive confirmation from office" },
                  { n: "٣", text: lang === "ar" ? "احضر موعدك في الوقت المحدد" : "Attend your appointment" },
                ].map(s => (
                  <div key={s.n} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                      style={{ background: `${gold}20`, color: gold }}>
                      {s.n}
                    </div>
                    <p className="text-xs text-white/55 leading-relaxed">{s.text}</p>
                  </div>
                ))}
              </div>

              {/* WhatsApp alternative */}
              {whatsappNum && (
                <div className="p-4 rounded-2xl text-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                  <MessageSquare className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-white/55 mb-3">
                    {lang === "ar" ? "أو تواصل مباشرة عبر واتساب" : "Or contact directly via WhatsApp"}
                  </p>
                  <a href={`https://wa.me/${whatsappNum}`} target="_blank" rel="noreferrer">
                    <Button size="sm" className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating WhatsApp */}
      {whatsappNum && (
        <a href={`https://wa.me/${whatsappNum}`} target="_blank" rel="noreferrer"
          className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 bg-emerald-500 hover:bg-emerald-600 transition-colors">
          <MessageCircle className="h-7 w-7 text-white" />
        </a>
      )}
    </div>
  );
}
