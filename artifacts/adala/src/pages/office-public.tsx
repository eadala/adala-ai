import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Phone, Mail, MapPin, MessageCircle, Star, Globe, Twitter,
  Linkedin, Facebook, Clock, BadgeCheck, Award, Users, Briefcase,
  ShoppingBag, ChevronLeft, ChevronDown, Send, CheckCircle2,
  Loader2, Scale, Menu, X, ExternalLink, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Lang = "ar" | "en";
function t(ar: string | null | undefined, en: string | null | undefined, lang: Lang): string {
  if (lang === "en" && en) return en;
  return ar ?? "";
}
function stars(n: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn("h-3.5 w-3.5", i < n ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
  ));
}
function imgSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `/api/storage/objects${path.startsWith("/") ? path : "/" + path}`;
}

/* ═══════════════════════════════════════════════════════════ */
export default function OfficePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [, navigate] = useLocation();
  const [lang, setLang] = useState<Lang>("ar");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [orderDialog, setOrderDialog] = useState<any>(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [orderForm, setOrderForm] = useState({ clientName: "", clientPhone: "", clientEmail: "", notes: "" });
  const [reviewForm, setReviewForm] = useState({ clientName: "", rating: "5", comment: "" });
  const [success, setSuccess] = useState("");
  const contactRef = useRef<HTMLElement>(null);
  const servicesRef = useRef<HTMLElement>(null);
  const teamRef = useRef<HTMLElement>(null);

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["office-public", slug],
    queryFn: () => fetch(`/api/office/public/${slug}`).then(r => r.json()),
  });

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (orderDialog?.price && !orderDialog.isCustomQuote) {
        const r = await fetch(`/api/office/public/${slug}/checkout`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId: orderDialog.id, ...orderForm }),
        });
        const d = await r.json();
        if (d.url) { window.location.href = d.url; return; }
      }
      await fetch(`/api/office/public/${slug}/order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: orderDialog?.id, ...orderForm, isQuoteRequest: orderDialog?.isCustomQuote }),
      });
      setSuccess(lang === "ar" ? "تم إرسال طلبك بنجاح! سيتواصل معك المكتب قريباً." : "Your request was sent! The office will contact you soon.");
      setOrderDialog(null);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => fetch(`/api/office/public/${slug}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reviewForm, rating: parseInt(reviewForm.rating) }),
    }).then(r => r.json()),
    onSuccess: () => {
      setSuccess(lang === "ar" ? "شكراً لتقييمك!" : "Thank you for your review!");
      setReviewDialog(false);
    },
  });

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
    setMobileMenu(false);
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" />
    </div>
  );

  if (isError || !data?.office) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white text-center">
      <div><Scale className="h-16 w-16 mx-auto mb-4 text-[#C9A84C] opacity-30" />
        <h1 className="text-2xl font-bold mb-2">{lang === "ar" ? "المكتب غير موجود" : "Office not found"}</h1>
        <p className="text-white/40 text-sm">{lang === "ar" ? "تحقق من الرابط" : "Check the URL"}</p>
      </div>
    </div>
  );

  const { office, services = [], team = [], reviews = [], articles = [] } = data;
  const gold = office.primaryColor ?? "#C9A84C";
  const avgRating = reviews.length ? (reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length).toFixed(1) : null;
  const officeName = t(office.name, office.nameEn, lang);
  const tagline = t(office.tagline, office.taglineEn, lang);
  const about = t(office.about, office.aboutEn, lang);

  const whatsappUrl = (msg?: string) => {
    const num = (office.whatsapp ?? office.phone ?? "").replace(/\D/g, "");
    const text = encodeURIComponent(msg ?? (lang === "ar" ? `مرحباً، أود الاستفسار عن خدمات ${officeName}` : `Hello, I'd like to inquire about ${officeName} services`));
    return `https://wa.me/${num}?text=${text}`;
  };

  const navLinks = [
    { label: lang === "ar" ? "من نحن" : "About", ref: null, href: "#about" },
    { label: lang === "ar" ? "الخدمات" : "Services", ref: servicesRef, href: "#services" },
    { label: lang === "ar" ? "الفريق" : "Team", ref: teamRef, href: "#team" },
    { label: lang === "ar" ? "تواصل" : "Contact", ref: contactRef, href: "#contact" },
  ];

  return (
    <div className={cn("min-h-screen bg-[#080d1a] text-white", lang === "ar" ? "font-['Cairo',sans-serif]" : "font-sans")} dir={lang === "ar" ? "rtl" : "ltr"}>

      {/* ── NAVBAR ─────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#080d1a]/90 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {office.logo ? (
              <img src={imgSrc(office.logo)} alt={officeName} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: `${gold}20`, color: gold }}>{(officeName || "م")[0]}</div>
            )}
            <span className="font-black text-sm tracking-tight">{officeName}</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(l => (
              <button key={l.href} onClick={() => l.ref ? scrollTo(l.ref) : null}
                className="text-xs text-white/60 hover:text-white transition-colors font-medium">
                {l.label}
              </button>
            ))}
            <a href={`/firms/${slug}/store`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs border-white/20 hover:bg-white/10">
                <ShoppingBag className="h-3 w-3" /> {lang === "ar" ? "المتجر" : "Store"}
              </Button>
            </a>
            {/* Language Toggle */}
            <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
              className="text-xs px-2.5 py-1 rounded-lg font-bold border border-white/20 hover:border-white/40 transition-colors" style={{ color: gold }}>
              {lang === "ar" ? "EN" : "ع"}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
              className="text-xs px-2 py-1 rounded border border-white/20 font-bold" style={{ color: gold }}>
              {lang === "ar" ? "EN" : "ع"}
            </button>
            <button onClick={() => setMobileMenu(v => !v)} className="text-white/60 hover:text-white">
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden bg-[#0d1528] border-t border-white/5 py-4 px-6 space-y-2">
            {navLinks.map(l => (
              <button key={l.href} onClick={() => l.ref ? scrollTo(l.ref) : setMobileMenu(false)}
                className="block w-full text-right text-sm py-2 text-white/70 hover:text-white">
                {l.label}
              </button>
            ))}
            <a href={`/firms/${slug}/store`} className="block text-sm py-2" style={{ color: gold }}>
              {lang === "ar" ? "المتجر القانوني" : "Legal Store"}
            </a>
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────── */}
      <header className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          {office.coverImage ? (
            <img src={imgSrc(office.coverImage)} alt="" className="w-full h-full object-cover opacity-20" />
          ) : (
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 60% 30%, ${gold}18 0%, transparent 65%), radial-gradient(ellipse at 10% 80%, #1e3a5f40 0%, transparent 60%)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#080d1a]/60 via-transparent to-[#080d1a]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-16 text-center w-full">
          {office.logo ? (
            <img src={imgSrc(office.logo)} alt={officeName} className="h-24 w-24 rounded-2xl object-cover mx-auto mb-6 shadow-2xl ring-2 ring-white/10" />
          ) : (
            <div className="h-24 w-24 rounded-2xl mx-auto mb-6 flex items-center justify-center text-4xl font-black shadow-2xl ring-2 ring-white/10" style={{ background: `${gold}20`, color: gold }}>
              {(officeName || "م")[0]}
            </div>
          )}

          {office.licenseNumber && (
            <div className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full mb-4 font-medium" style={{ background: `${gold}15`, color: gold, border: `1px solid ${gold}30` }}>
              <BadgeCheck className="h-3.5 w-3.5" />
              {lang === "ar" ? `مرخّص · رقم ${office.licenseNumber}` : `Licensed · No. ${office.licenseNumber}`}
            </div>
          )}

          <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight">{officeName}</h1>
          {tagline && <p className="text-lg md:text-xl text-white/60 mb-10 max-w-2xl mx-auto">{tagline}</p>}

          <div className="flex flex-wrap gap-3 justify-center">
            {(office.whatsapp || office.phone) && (
              <a href={whatsappUrl()} target="_blank" rel="noreferrer">
                <Button size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6">
                  <MessageCircle className="h-5 w-5" />
                  {lang === "ar" ? "واتساب" : "WhatsApp"}
                </Button>
              </a>
            )}
            <Button size="lg" className="gap-2 px-6 font-bold" style={{ background: gold, color: "#000" }}
              onClick={() => scrollTo(contactRef)}>
              <Send className="h-5 w-5" />
              {lang === "ar" ? "تواصل معنا" : "Contact Us"}
            </Button>
            <a href={`/firms/${slug}/store`}>
              <Button size="lg" variant="outline" className="gap-2 px-6 border-white/20 hover:bg-white/10">
                <ShoppingBag className="h-5 w-5" />
                {lang === "ar" ? "المتجر القانوني" : "Legal Store"}
              </Button>
            </a>
          </div>

          {/* Scroll indicator */}
          <div className="mt-16 flex justify-center animate-bounce">
            <ChevronDown className="h-6 w-6 text-white/30" />
          </div>
        </div>
      </header>

      {/* ── STATS STRIP ────────────────────────────── */}
      {office.showStats && (office.casesCount > 0 || office.clientsCount > 0 || office.successRate > 0 || office.experienceYears > 0) && (
        <div className="border-y border-white/5 bg-white/2">
          <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            {office.experienceYears > 0 && <Stat val={`${office.experienceYears}+`} label={lang === "ar" ? "سنة خبرة" : "Years Experience"} gold={gold} icon={<Award />} />}
            {office.casesCount > 0 && <Stat val={office.casesCount.toLocaleString()} label={lang === "ar" ? "قضية منجزة" : "Cases Handled"} gold={gold} icon={<Briefcase />} />}
            {office.clientsCount > 0 && <Stat val={office.clientsCount.toLocaleString()} label={lang === "ar" ? "عميل موثوق" : "Trusted Clients"} gold={gold} icon={<Users />} />}
            {office.successRate > 0 && <Stat val={`${office.successRate}%`} label={lang === "ar" ? "نسبة النجاح" : "Success Rate"} gold={gold} icon={<Star />} />}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 pb-20 space-y-24 pt-16">

        {/* success banner */}
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-emerald-300 text-sm font-semibold">{success}</p>
          </div>
        )}

        {/* ── ABOUT ─────────────────────────────────── */}
        <section id="about">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Photo */}
            <div className="order-2 md:order-1">
              {(office.logo || office.coverImage) ? (
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl translate-x-3 translate-y-3" style={{ background: `${gold}15`, border: `1px solid ${gold}20` }} />
                  <img
                    src={imgSrc(office.coverImage || office.logo)}
                    alt={officeName}
                    className="relative w-full h-80 object-cover rounded-3xl ring-1 ring-white/10"
                  />
                </div>
              ) : (
                <div className="w-full h-80 rounded-3xl flex items-center justify-center" style={{ background: `${gold}08`, border: `1px solid ${gold}15` }}>
                  <Scale className="h-24 w-24 opacity-20" style={{ color: gold }} />
                </div>
              )}
            </div>
            {/* Text */}
            <div className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 text-xs font-bold mb-4 px-3 py-1 rounded-full" style={{ background: `${gold}15`, color: gold }}>
                <Scale className="h-3.5 w-3.5" /> {lang === "ar" ? "من نحن" : "About Us"}
              </div>
              <h2 className="text-3xl font-black mb-4">{officeName}</h2>
              {about && <p className="text-white/60 leading-relaxed mb-6">{about}</p>}
              <div className="space-y-3">
                {office.city && (
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <MapPin className="h-4 w-4" style={{ color: gold }} /> {office.city}
                    {office.regions && ` — ${office.regions}`}
                  </div>
                )}
                {office.licenseNumber && (
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <BadgeCheck className="h-4 w-4" style={{ color: gold }} />
                    {lang === "ar" ? `رقم الترخيص: ${office.licenseNumber}` : `License No: ${office.licenseNumber}`}
                  </div>
                )}
                {office.email && (
                  <div className="flex items-center gap-2 text-sm text-white/50">
                    <Mail className="h-4 w-4" style={{ color: gold }} /> {office.email}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── SERVICES ──────────────────────────────── */}
        {services.length > 0 && (
          <section ref={servicesRef} id="services">
            <SecHeader icon={<ShoppingBag />} title={lang === "ar" ? "خدماتنا القانونية" : "Our Legal Services"} subtitle={lang === "ar" ? "نقدم خدمات قانونية شاملة بأعلى معايير الجودة" : "Comprehensive legal services with the highest quality standards"} gold={gold} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
              {services.slice(0, 6).map((svc: any) => (
                <ServiceCard key={svc.id} svc={svc} lang={lang} gold={gold}
                  onOrder={() => { setOrderDialog(svc); setOrderForm({ clientName: "", clientPhone: "", clientEmail: "", notes: "" }); }} />
              ))}
            </div>
            {services.length > 6 && (
              <div className="text-center mt-8">
                <a href={`/firms/${slug}/store`}>
                  <Button variant="outline" className="gap-2 border-white/20 hover:bg-white/10">
                    <ShoppingBag className="h-4 w-4" />
                    {lang === "ar" ? `عرض جميع الخدمات (${services.length})` : `View All Services (${services.length})`}
                  </Button>
                </a>
              </div>
            )}
          </section>
        )}

        {/* ── TEAM ──────────────────────────────────── */}
        {team.length > 0 && (
          <section ref={teamRef} id="team">
            <SecHeader icon={<Users />} title={lang === "ar" ? "فريق العمل" : "Our Team"} subtitle={lang === "ar" ? "نخبة من المحامين والمستشارين القانونيين المتخصصين" : "A team of specialized lawyers and legal consultants"} gold={gold} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              {team.map((m: any) => (
                <TeamCard key={m.id} m={m} lang={lang} gold={gold} />
              ))}
            </div>
          </section>
        )}

        {/* ── REVIEWS ───────────────────────────────── */}
        {(reviews.length > 0 || true) && (
          <section>
            <div className="flex items-start justify-between flex-wrap gap-3 mb-8">
              <SecHeader icon={<Star />} title={lang === "ar" ? "آراء عملائنا" : "Client Reviews"} gold={gold} noSub />
              <div className="flex items-center gap-3">
                {avgRating && <div className="flex items-center gap-1.5"><span className="text-2xl font-black" style={{ color: gold }}>{avgRating}</span><Star className="h-5 w-5 fill-yellow-400 text-yellow-400" /></div>}
                <Button size="sm" variant="outline" className="text-xs border-white/20 hover:bg-white/10"
                  onClick={() => setReviewDialog(true)}>
                  {lang === "ar" ? "+ أضف تقييمك" : "+ Add Review"}
                </Button>
              </div>
            </div>
            {reviews.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">{lang === "ar" ? "لا توجد تقييمات بعد — كن أول من يقيّم!" : "No reviews yet — be the first!"}</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {reviews.slice(0, 6).map((r: any) => (
                  <div key={r.id} className="p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/6 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-black shrink-0" style={{ background: `${gold}20`, color: gold }}>{r.clientName[0]}</div>
                      <div>
                        <div className="text-sm font-semibold">{r.clientName}</div>
                        <div className="flex gap-0.5 mt-0.5">{stars(r.rating)}</div>
                      </div>
                    </div>
                    {r.comment && <p className="text-xs text-white/55 leading-relaxed">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── LOCATION + CONTACT ─────────────────────── */}
        <section ref={contactRef} id="contact">
          <SecHeader icon={<MapPin />} title={lang === "ar" ? "تواصل معنا" : "Get In Touch"} subtitle={lang === "ar" ? "نحن هنا لمساعدتك — تواصل معنا الآن" : "We're here to help — reach out now"} gold={gold} />

          <div className="grid md:grid-cols-2 gap-8 mt-8">
            {/* Left: Map + info */}
            <div className="space-y-4">
              {office.mapsEmbedUrl && (
                <div className="rounded-2xl overflow-hidden border border-white/10 h-56">
                  <iframe src={office.mapsEmbedUrl} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade" title="office location" />
                </div>
              )}
              <div className="grid grid-cols-1 gap-3">
                {(office.whatsapp || office.phone) && (
                  <a href={whatsappUrl()} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors group">
                    <MessageCircle className="h-6 w-6 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs text-white/40 mb-0.5">{lang === "ar" ? "واتساب — تواصل فوري" : "WhatsApp — Instant contact"}</div>
                      <div className="font-bold text-sm text-emerald-300">{office.whatsapp || office.phone}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-emerald-400/50 mr-auto group-hover:text-emerald-400 transition-colors" />
                  </a>
                )}
                {office.phone && (
                  <a href={`tel:${office.phone}`}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-colors">
                    <Phone className="h-5 w-5 shrink-0" style={{ color: gold }} />
                    <div>
                      <div className="text-xs text-white/40 mb-0.5">{lang === "ar" ? "هاتف" : "Phone"}</div>
                      <div className="font-semibold text-sm">{office.phone}</div>
                    </div>
                  </a>
                )}
                {office.email && (
                  <a href={`mailto:${office.email}`}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-colors">
                    <Mail className="h-5 w-5 shrink-0" style={{ color: gold }} />
                    <div>
                      <div className="text-xs text-white/40 mb-0.5">{lang === "ar" ? "بريد إلكتروني" : "Email"}</div>
                      <div className="font-semibold text-sm">{office.email}</div>
                    </div>
                  </a>
                )}
                {office.address && (
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/4 border border-white/8">
                    <MapPin className="h-5 w-5 shrink-0" style={{ color: gold }} />
                    <div>
                      <div className="text-xs text-white/40 mb-0.5">{lang === "ar" ? "العنوان" : "Address"}</div>
                      <div className="font-semibold text-sm">{office.address}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Contact form → WhatsApp */}
            <div className="p-6 rounded-2xl border" style={{ background: `${gold}06`, borderColor: `${gold}20` }}>
              <h3 className="font-bold mb-4">{lang === "ar" ? "أرسل رسالة عبر واتساب" : "Send a WhatsApp Message"}</h3>
              <ContactForm lang={lang} gold={gold} whatsappUrl={whatsappUrl} officeName={officeName} onOrder={() => { setOrderDialog({ name: lang === "ar" ? "استشارة قانونية" : "Legal Consultation", isCustomQuote: true }); }} />
            </div>
          </div>

          {/* Social links */}
          {(office.twitter || office.linkedin || office.facebook || office.website) && (
            <div className="flex gap-4 justify-center mt-8">
              {office.twitter && <SocialLink href={office.twitter} icon={<Twitter className="h-5 w-5" />} label="Twitter" />}
              {office.linkedin && <SocialLink href={office.linkedin} icon={<Linkedin className="h-5 w-5" />} label="LinkedIn" />}
              {office.facebook && <SocialLink href={office.facebook} icon={<Facebook className="h-5 w-5" />} label="Facebook" />}
              {office.website && <SocialLink href={office.website} icon={<Globe className="h-5 w-5" />} label="Website" />}
            </div>
          )}
        </section>

        {/* ── ARTICLES ──────────────────────────────── */}
        {articles.length > 0 && (
          <section>
            <SecHeader icon={<FileText />} title={lang === "ar" ? "مركز المعرفة القانونية" : "Legal Knowledge Center"} gold={gold} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
              {articles.map((a: any) => (
                <div key={a.id} className="p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/6 transition-colors cursor-pointer">
                  <Badge className="text-[9px] mb-2 bg-white/5 text-white/40 border-white/10">{a.category}</Badge>
                  <h3 className="font-bold text-sm mb-1 line-clamp-2">{a.title}</h3>
                  {a.excerpt && <p className="text-xs text-white/50 line-clamp-2">{a.excerpt}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── FOOTER ────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 text-center">
        <div className="text-white/25 text-xs">
          {officeName} · {new Date().getFullYear()}
          <span className="mx-2">·</span>
          {lang === "ar" ? "مدعوم بـ" : "Powered by"}
          <span className="font-bold mx-1" style={{ color: gold }}>عدالة AI</span>
        </div>
      </footer>

      {/* ── WhatsApp floating button ───────────────── */}
      {(office.whatsapp || office.phone) && (
        <a href={whatsappUrl()} target="_blank" rel="noreferrer"
          className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center shadow-xl shadow-emerald-500/30">
          <MessageCircle className="h-7 w-7 text-white" />
        </a>
      )}

      {/* ── Order Dialog ──────────────────────────── */}
      <Dialog open={!!orderDialog} onOpenChange={() => setOrderDialog(null)}>
        <DialogContent className="max-w-md" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{orderDialog?.isCustomQuote ? (lang === "ar" ? "طلب عرض سعر" : "Request a Quote") : (lang === "ar" ? `طلب: ${t(orderDialog?.name, orderDialog?.nameEn, lang)}` : `Order: ${t(orderDialog?.name, orderDialog?.nameEn, lang)}`)}</DialogTitle>
          </DialogHeader>
          {orderDialog && (
            <div className="space-y-3">
              {!orderDialog.isCustomQuote && orderDialog.price && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <span className="text-2xl font-black" style={{ color: gold }}>{Number(orderDialog.price).toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                </div>
              )}
              <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "الاسم الكامل *" : "Full Name *"}</Label>
                <Input value={orderForm.clientName} onChange={e => setOrderForm(f => ({ ...f, clientName: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "رقم الجوال *" : "Phone Number *"}</Label>
                <Input value={orderForm.clientPhone} onChange={e => setOrderForm(f => ({ ...f, clientPhone: e.target.value }))} dir="ltr" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
                <Input value={orderForm.clientEmail} onChange={e => setOrderForm(f => ({ ...f, clientEmail: e.target.value }))} dir="ltr" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "تفاصيل الطلب" : "Request Details"}</Label>
                <Textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="resize-none" /></div>
              <Button className="w-full gap-2 font-bold" style={{ background: gold, color: "#000" }}
                disabled={!orderForm.clientName || !orderForm.clientPhone || orderMutation.isPending}
                onClick={() => orderMutation.mutate()}>
                {orderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {orderDialog.isCustomQuote ? (lang === "ar" ? "إرسال الطلب" : "Send Request") : orderDialog.price ? (lang === "ar" ? "الدفع والطلب" : "Pay & Order") : (lang === "ar" ? "إرسال الطلب" : "Send Request")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Review Dialog ─────────────────────────── */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-sm" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader><DialogTitle>{lang === "ar" ? "أضف تقييمك" : "Add Your Review"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "اسمك *" : "Your Name *"}</Label>
              <Input value={reviewForm.clientName} onChange={e => setReviewForm(f => ({ ...f, clientName: e.target.value }))} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "التقييم" : "Rating"}</Label>
              <Select value={reviewForm.rating} onValueChange={v => setReviewForm(f => ({ ...f, rating: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ {lang === "ar" ? "ممتاز" : "Excellent"}</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ {lang === "ar" ? "جيد جداً" : "Very Good"}</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ {lang === "ar" ? "جيد" : "Good"}</SelectItem>
                  <SelectItem value="2">⭐⭐ {lang === "ar" ? "مقبول" : "Fair"}</SelectItem>
                  <SelectItem value="1">⭐ {lang === "ar" ? "ضعيف" : "Poor"}</SelectItem>
                </SelectContent>
              </Select></div>
            <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "تعليقك" : "Comment"}</Label>
              <Textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} rows={3} className="resize-none" /></div>
            <Button className="w-full" disabled={!reviewForm.clientName || reviewMutation.isPending} onClick={() => reviewMutation.mutate()}>
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {lang === "ar" ? "إرسال التقييم" : "Submit Review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Sub-components ───────────────────────────── */
function SecHeader({ icon, title, subtitle, gold, noSub }: { icon: any; title: string; subtitle?: string; gold: string; noSub?: boolean }) {
  return (
    <div className="text-center mb-2">
      <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full mb-3" style={{ background: `${gold}15`, color: gold }}>
        {icon} {title}
      </div>
      {subtitle && !noSub && <p className="text-white/50 text-sm">{subtitle}</p>}
      {noSub && <h2 className="text-3xl font-black">{title}</h2>}
    </div>
  );
}

function Stat({ val, label, gold, icon }: { val: string; label: string; gold: string; icon: any }) {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-1 opacity-50" style={{ color: gold }}>{icon}</div>
      <div className="text-3xl font-black mb-0.5" style={{ color: gold }}>{val}</div>
      <div className="text-xs text-white/40">{label}</div>
    </div>
  );
}

function ServiceCard({ svc, lang, gold, onOrder }: { svc: any; lang: Lang; gold: string; onOrder: () => void }) {
  const name = t(svc.name, svc.nameEn, lang);
  const desc = t(svc.description, svc.descriptionEn, lang);
  return (
    <div className="p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/6 hover:border-white/15 transition-all flex flex-col group">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-sm leading-snug">{name}</h3>
        <Badge className="text-[9px] shrink-0 bg-white/5 text-white/40 border-white/10 mr-2">{svc.category}</Badge>
      </div>
      {desc && <p className="text-xs text-white/50 mb-3 flex-1 line-clamp-2">{desc}</p>}
      {svc.deliveryDays > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-white/35 mb-3">
          <Clock className="h-3 w-3" /> {lang === "ar" ? `${svc.deliveryDays} يوم` : `${svc.deliveryDays} day(s)`}
        </div>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-white/8 mt-auto">
        <span className="font-black text-base" style={{ color: gold }}>
          {svc.isCustomQuote ? (lang === "ar" ? "عرض سعر" : "Get Quote") : `${Number(svc.price).toLocaleString()} ${lang === "ar" ? "ر.س" : "SAR"}`}
        </span>
        <Button size="sm" className="text-xs font-bold gap-1" style={{ background: gold, color: "#000" }} onClick={onOrder}>
          {lang === "ar" ? "اطلب الآن" : "Order Now"}
        </Button>
      </div>
    </div>
  );
}

function TeamCard({ m, lang, gold }: { m: any; lang: Lang; gold: string }) {
  const name = t(m.name, m.nameEn, lang);
  const title = t(m.title, m.titleEn, lang);
  const specs = t(m.specialties, m.specialtiesEn, lang);
  return (
    <div className="p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/6 transition-all text-center">
      {m.photoUrl ? (
        <img src={imgSrc(m.photoUrl)} alt={name} className="h-20 w-20 rounded-full object-cover mx-auto mb-3 ring-2 ring-white/10" />
      ) : (
        <div className="h-20 w-20 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-black ring-2 ring-white/10" style={{ background: `${gold}20`, color: gold }}>
          {(name || "م")[0]}
        </div>
      )}
      <h3 className="font-bold text-sm">{name}</h3>
      <p className="text-xs text-white/50 mt-0.5 mb-2">{title}</p>
      {specs && (
        <div className="flex flex-wrap gap-1 justify-center">
          {specs.split("،").slice(0, 3).map((s: string) => (
            <Badge key={s} className="text-[9px] bg-white/5 text-white/40 border-white/10">{s.trim()}</Badge>
          ))}
        </div>
      )}
      {m.linkedin && (
        <a href={m.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-3 text-[10px] text-white/35 hover:text-white transition-colors">
          <Linkedin className="h-3 w-3" /> LinkedIn
        </a>
      )}
    </div>
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: any; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="h-10 w-10 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-center text-white/40 hover:text-white"
      aria-label={label}>{icon}</a>
  );
}

function ContactForm({ lang, gold, whatsappUrl, officeName, onOrder }: { lang: Lang; gold: string; whatsappUrl: (msg?: string) => string; officeName: string; onOrder: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const send = () => {
    if (!form.name || !form.phone) return;
    const msg = lang === "ar"
      ? `مرحباً، أنا ${form.name} (${form.phone}).\n${form.message || `أود الاستفسار عن خدمات ${officeName}`}`
      : `Hello, I'm ${form.name} (${form.phone}).\n${form.message || `I'd like to inquire about ${officeName} services`}`;
    window.open(whatsappUrl(msg), "_blank");
  };
  return (
    <div className="space-y-3">
      <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "الاسم *" : "Name *"}</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "رقم الجوال *" : "Phone *"}</Label>
        <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
      <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "الرسالة" : "Message"}</Label>
        <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} className="resize-none" /></div>
      <Button className="w-full gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white" onClick={send} disabled={!form.name || !form.phone}>
        <MessageCircle className="h-4 w-4" />
        {lang === "ar" ? "إرسال عبر واتساب" : "Send via WhatsApp"}
      </Button>
      <div className="text-center">
        <button onClick={onOrder} className="text-xs underline underline-offset-2" style={{ color: gold }}>
          {lang === "ar" ? "أو اطلب استشارة قانونية" : "Or request a legal consultation"}
        </button>
      </div>
    </div>
  );
}
