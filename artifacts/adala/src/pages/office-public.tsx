import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Phone, Mail, MapPin, MessageCircle, Star, Globe, Twitter,
  Linkedin, Facebook, Clock, BadgeCheck, Award, Users, Briefcase,
  ShoppingBag, ChevronLeft, ChevronDown, Send, CheckCircle2,
  Loader2, Scale, Menu, X, ExternalLink, FileText, Calendar,
  Shield, Zap, Trophy, ArrowLeft, ArrowRight, Quote, TrendingUp,
  BookOpen, Gavel, Home, Building, Car, Heart, DollarSign,
  ChevronRight, Play, Instagram, Youtube,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Lang = "ar" | "en";
function t(ar: string | null | undefined, en: string | null | undefined, lang: Lang): string {
  if (lang === "en" && en) return en;
  return ar ?? "";
}
function imgSrc(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `/api/storage/objects${path.startsWith("/") ? path : "/" + path}`;
}
function stars(n: number, size = "h-3.5 w-3.5") {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn(size, i < n ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
  ));
}

const CATEGORY_ICONS: Record<string, any> = {
  استشارات: Scale, عقود: FileText, دعاوى: Gavel,
  توثيق: BadgeCheck, تحكيم: Shield, "أحوال شخصية": Heart,
  تجاري: Briefcase, عقاري: Home, جنائي: Trophy,
  مرور: Car, عمالي: Users, إداري: Building,
};

/* ═══════════════════════════════════════════════════════════ */
/* Sub-components                                             */
/* ═══════════════════════════════════════════════════════════ */

function AnimatedStat({ val, label, gold, icon }: { val: string; label: string; gold: string; icon: React.ReactNode }) {
  return (
    <div className="text-center group">
      <div className="h-12 w-12 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ background: `${gold}15`, color: gold }}>
        {icon}
      </div>
      <div className="text-3xl font-black mb-1" style={{ color: gold }}>{val}</div>
      <div className="text-xs text-white/50 font-medium">{label}</div>
    </div>
  );
}

function ServiceCard({ svc, lang, gold, onOrder }: { svc: any; lang: Lang; gold: string; onOrder: () => void }) {
  const name = t(svc.name, svc.nameEn, lang);
  const desc = t(svc.description, svc.descriptionEn, lang);
  const Icon = CATEGORY_ICONS[svc.category] ?? Scale;
  return (
    <div className="group relative p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/7 hover:border-white/15 transition-all flex flex-col overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }} />
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
          style={{ background: `${gold}15`, color: gold }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm leading-snug mb-0.5">{name}</h3>
          {svc.category && <Badge className="text-[9px] bg-white/5 text-white/40 border-white/10">{svc.category}</Badge>}
        </div>
      </div>
      {desc && <p className="text-xs text-white/55 mb-4 flex-1 leading-relaxed line-clamp-3">{desc}</p>}
      {svc.deliveryDays > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-white/35 mb-4">
          <Clock className="h-3 w-3" />
          {lang === "ar" ? `التسليم خلال ${svc.deliveryDays} يوم` : `${svc.deliveryDays}-day delivery`}
        </div>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-white/8 mt-auto">
        <div>
          {svc.isCustomQuote ? (
            <span className="text-xs font-bold text-white/60">{lang === "ar" ? "حسب العرض" : "Custom Quote"}</span>
          ) : (
            <>
              <span className="text-xl font-black" style={{ color: gold }}>{Number(svc.price).toLocaleString()}</span>
              <span className="text-xs text-white/40 mr-1">{lang === "ar" ? "ر.س" : "SAR"}</span>
            </>
          )}
        </div>
        <Button size="sm" className="gap-1.5 text-xs font-bold px-4" style={{ background: gold, color: "#000" }}
          onClick={onOrder}>
          {svc.isCustomQuote ? (lang === "ar" ? "اطلب عرضاً" : "Get Quote") : (lang === "ar" ? "اطلب الآن" : "Order")}
        </Button>
      </div>
    </div>
  );
}

function TeamCard({ m, lang, gold }: { m: any; lang: Lang; gold: string }) {
  const [expanded, setExpanded] = useState(false);
  const name = t(m.name, m.nameEn, lang);
  const role = t(m.role, m.roleEn, lang);
  const bio = t(m.bio, m.bioEn, lang);
  return (
    <div className="group p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/7 hover:border-white/15 transition-all">
      <div className="flex items-center gap-4 mb-3">
        {m.photo ? (
          <img src={imgSrc(m.photo)} alt={name} className="h-14 w-14 rounded-xl object-cover ring-2 ring-white/10 group-hover:ring-white/20 transition-all" />
        ) : (
          <div className="h-14 w-14 rounded-xl flex items-center justify-center text-xl font-black ring-2 ring-white/10"
            style={{ background: `${gold}20`, color: gold }}>{(name || "م")[0]}</div>
        )}
        <div>
          <div className="font-bold text-sm">{name}</div>
          {role && <div className="text-xs text-white/50 mt-0.5">{role}</div>}
          {m.yearsExp > 0 && (
            <div className="text-[10px] mt-1 font-medium" style={{ color: gold }}>
              {lang === "ar" ? `${m.yearsExp} سنة خبرة` : `${m.yearsExp} yrs exp`}
            </div>
          )}
        </div>
      </div>
      {bio && (
        <>
          <p className={cn("text-xs text-white/50 leading-relaxed", !expanded && "line-clamp-2")}>{bio}</p>
          {bio.length > 80 && (
            <button onClick={() => setExpanded(v => !v)} className="text-[10px] mt-1 font-semibold" style={{ color: gold }}>
              {expanded ? (lang === "ar" ? "أقل" : "Less") : (lang === "ar" ? "المزيد" : "More")}
            </button>
          )}
        </>
      )}
      {(m.linkedin || m.twitter) && (
        <div className="flex gap-2 mt-3">
          {m.linkedin && <a href={m.linkedin} target="_blank" rel="noreferrer" className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/6 hover:bg-blue-500/20 transition-colors"><Linkedin className="h-3.5 w-3.5 text-blue-400" /></a>}
          {m.twitter && <a href={m.twitter} target="_blank" rel="noreferrer" className="h-7 w-7 rounded-lg flex items-center justify-center bg-white/6 hover:bg-sky-500/20 transition-colors"><Twitter className="h-3.5 w-3.5 text-sky-400" /></a>}
        </div>
      )}
    </div>
  );
}

function SocialLink({ href, icon, label, hoverColor }: { href: string; icon: React.ReactNode; label: string; hoverColor: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={label}
      className={cn("h-10 w-10 rounded-xl flex items-center justify-center bg-white/6 border border-white/10 transition-all hover:scale-110", hoverColor)}>
      {icon}
    </a>
  );
}

function SecHeader({ icon, title, subtitle, gold, noSub }: { icon: React.ReactNode; title: string; subtitle?: string; gold: string; noSub?: boolean }) {
  return (
    <div className="mb-1">
      <div className="inline-flex items-center gap-2 text-xs font-bold mb-3 px-3 py-1.5 rounded-full"
        style={{ background: `${gold}12`, color: gold, border: `1px solid ${gold}25` }}>
        <span className="h-3.5 w-3.5">{icon}</span> {title}
      </div>
      {!noSub && subtitle && <p className="text-sm text-white/45 mt-1">{subtitle}</p>}
    </div>
  );
}

function ContactForm({ lang, gold, whatsappUrl, officeName, onOrder }: any) {
  const [form, setForm] = useState({ name: "", phone: "", subject: "", message: "" });
  const subjects = lang === "ar"
    ? ["استشارة قانونية", "إعداد عقد", "قضية في المحكمة", "توثيق", "استفسار عام"]
    : ["Legal Consultation", "Contract Drafting", "Court Case", "Notarization", "General Inquiry"];
  const url = whatsappUrl(
    form.message
      ? `${lang === "ar" ? "مرحباً،\nالاسم: " : "Hello,\nName: "}${form.name}\n${lang === "ar" ? "الموضوع: " : "Subject: "}${form.subject}\n${lang === "ar" ? "الرسالة: " : "Message: "}${form.message}`
      : undefined
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-white/60 mb-1 block">{lang === "ar" ? "الاسم" : "Name"}</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-white/5 border-white/10 text-sm" />
        </div>
        <div>
          <Label className="text-xs text-white/60 mb-1 block">{lang === "ar" ? "الجوال" : "Phone"}</Label>
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" className="bg-white/5 border-white/10 text-sm" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-white/60 mb-1 block">{lang === "ar" ? "الموضوع" : "Subject"}</Label>
        <div className="flex flex-wrap gap-1.5">
          {subjects.map(s => (
            <button key={s} onClick={() => setForm(f => ({ ...f, subject: s }))}
              className={cn("text-[10px] px-2.5 py-1 rounded-full border transition-all font-medium", form.subject === s ? "text-black border-transparent" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10")}
              style={form.subject === s ? { background: gold, borderColor: gold } : {}}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs text-white/60 mb-1 block">{lang === "ar" ? "رسالتك" : "Message"}</Label>
        <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} className="bg-white/5 border-white/10 text-sm resize-none" placeholder={lang === "ar" ? "اكتب استفسارك هنا..." : "Write your inquiry here..."} />
      </div>
      <div className="flex gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="flex-1">
          <Button className="w-full gap-2 font-bold bg-emerald-600 hover:bg-emerald-700">
            <MessageCircle className="h-4 w-4" />
            {lang === "ar" ? "أرسل عبر واتساب" : "Send via WhatsApp"}
          </Button>
        </a>
        <Button variant="outline" className="border-white/20 hover:bg-white/10 gap-1.5"
          onClick={onOrder} style={{ color: gold, borderColor: `${gold}40` }}>
          <Calendar className="h-4 w-4" />
          {lang === "ar" ? "احجز" : "Book"}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* Main Component                                             */
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
  const [reviewPage, setReviewPage] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const contactRef = useRef<HTMLElement>(null);
  const servicesRef = useRef<HTMLElement>(null);
  const teamRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

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
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-[#C9A84C]/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Scale className="h-8 w-8 text-[#C9A84C]" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A84C] mx-auto" />
      </div>
    </div>
  );

  if (isError || !data?.office) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white text-center px-6">
      <div>
        <div className="h-24 w-24 rounded-3xl bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-6">
          <Scale className="h-12 w-12 text-[#C9A84C] opacity-30" />
        </div>
        <h1 className="text-3xl font-black mb-3">{lang === "ar" ? "المكتب غير موجود" : "Office Not Found"}</h1>
        <p className="text-white/40 text-sm mb-6">{lang === "ar" ? "تحقق من الرابط أو تواصل مع المكتب مباشرةً" : "Check the URL or contact the office directly"}</p>
        <Button variant="outline" className="border-white/20 hover:bg-white/10" onClick={() => navigate("/")}>
          {lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
        </Button>
      </div>
    </div>
  );

  const { office, services = [], team = [], reviews = [], articles = [] } = data;
  const gold = office.primaryColor ?? "#C9A84C";
  const avgRating = reviews.length ? (reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length) : 0;
  const officeName = t(office.name, office.nameEn, lang);
  const tagline = t(office.tagline, office.taglineEn, lang);
  const about = t(office.about, office.aboutEn, lang);
  const REVIEWS_PER_PAGE = 6;
  const reviewPages = Math.ceil(reviews.length / REVIEWS_PER_PAGE);
  const visibleReviews = reviews.slice(reviewPage * REVIEWS_PER_PAGE, (reviewPage + 1) * REVIEWS_PER_PAGE);

  const toWaNumber = (raw: string) => {
    const d = raw.replace(/\D/g, "");
    if (!d) return "";
    if (d.startsWith("00966")) return d.slice(2);
    if (d.startsWith("966"))   return d;
    if (d.startsWith("0"))     return "966" + d.slice(1);
    if (d.length <= 9)         return "966" + d;
    return d;
  };

  const whatsappUrl = (msg?: string) => {
    const num = toWaNumber(office.whatsapp ?? office.phone ?? "");
    const text = encodeURIComponent(msg ?? (lang === "ar" ? `مرحباً، أود الاستفسار عن خدمات ${officeName}` : `Hello, I'd like to inquire about ${officeName} services`));
    return `https://wa.me/${num}?text=${text}`;
  };

  const navLinks = [
    { label: lang === "ar" ? "من نحن" : "About", ref: aboutRef },
    { label: lang === "ar" ? "الخدمات" : "Services", ref: servicesRef },
    ...(team.length > 0 ? [{ label: lang === "ar" ? "الفريق" : "Team", ref: teamRef }] : []),
    { label: lang === "ar" ? "تواصل" : "Contact", ref: contactRef },
  ];

  return (
    <div
      className={cn("min-h-screen bg-[#080d1a] text-white", lang === "ar" ? "font-['Cairo',sans-serif]" : "font-sans")}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* ── NAVBAR ─────────────────────────────────── */}
      <nav className={cn("fixed top-0 inset-x-0 z-50 transition-all duration-300", scrolled ? "bg-[#080d1a]/97 backdrop-blur shadow-xl shadow-black/30 border-b border-white/8" : "bg-transparent")}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {office.logo ? (
              <img src={imgSrc(office.logo)} alt={officeName} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: `${gold}20`, color: gold }}>{(officeName || "م")[0]}</div>
            )}
            <span className="font-black text-sm tracking-tight">{officeName}</span>
          </div>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(l => (
              <button key={l.label} onClick={() => scrollTo(l.ref)}
                className="text-xs text-white/60 hover:text-white transition-colors font-medium px-3 py-2 rounded-lg hover:bg-white/6">
                {l.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <a href={`/firms/${slug}/store`}>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs border-white/20 hover:bg-white/10">
                <ShoppingBag className="h-3 w-3" /> {lang === "ar" ? "المتجر" : "Store"}
              </Button>
            </a>
            <a href={`/firms/${slug}/book`}>
              <Button size="sm" className="gap-1.5 text-xs font-bold shadow-lg" style={{ background: gold, color: "#000" }}>
                <Calendar className="h-3 w-3" /> {lang === "ar" ? "احجز استشارة" : "Book Now"}
              </Button>
            </a>
            <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
              className="text-[11px] px-2.5 py-1.5 rounded-lg font-bold border border-white/20 hover:border-white/40 transition-colors" style={{ color: gold }}>
              {lang === "ar" ? "EN" : "ع"}
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
              className="text-xs px-2 py-1 rounded border border-white/20 font-bold" style={{ color: gold }}>
              {lang === "ar" ? "EN" : "ع"}
            </button>
            <button onClick={() => setMobileMenu(v => !v)} className="text-white/60 hover:text-white p-1">
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="md:hidden bg-[#0b1120]/98 border-t border-white/8 py-4 px-6 space-y-1">
            {navLinks.map(l => (
              <button key={l.label} onClick={() => scrollTo(l.ref)}
                className="flex items-center gap-2 w-full text-sm py-2.5 px-3 rounded-xl text-white/70 hover:text-white hover:bg-white/6">
                <ChevronLeft className={cn("h-3.5 w-3.5", lang === "en" && "rotate-180")} style={{ color: gold }} />
                {l.label}
              </button>
            ))}
            <div className="pt-2 flex gap-2">
              <a href={`/firms/${slug}/store`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full gap-1 text-xs border-white/20 hover:bg-white/10">
                  <ShoppingBag className="h-3 w-3" /> {lang === "ar" ? "المتجر" : "Store"}
                </Button>
              </a>
              <a href={`/firms/${slug}/book`} className="flex-1">
                <Button size="sm" className="w-full gap-1 text-xs font-bold" style={{ background: gold, color: "#000" }}>
                  <Calendar className="h-3 w-3" /> {lang === "ar" ? "احجز" : "Book"}
                </Button>
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────── */}
      <header className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          {office.coverImage ? (
            <>
              <img src={imgSrc(office.coverImage)} alt="" className="w-full h-full object-cover opacity-25" />
              <div className="absolute inset-0 bg-gradient-to-b from-[#080d1a]/70 via-[#080d1a]/40 to-[#080d1a]" />
            </>
          ) : (
            <>
              <div className="absolute inset-0" style={{
                background: `radial-gradient(ellipse at 65% 25%, ${gold}18 0%, transparent 60%),
                             radial-gradient(ellipse at 15% 75%, #1a2f6040 0%, transparent 55%),
                             radial-gradient(ellipse at 85% 85%, ${gold}08 0%, transparent 45%)`
              }} />
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle, ${gold}06 1px, transparent 1px)`,
                backgroundSize: "40px 40px"
              }} />
            </>
          )}
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-20 text-center w-full">
          {office.logo ? (
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-30" style={{ background: gold }} />
              <img src={imgSrc(office.logo)} alt={officeName} className="relative h-24 w-24 rounded-2xl object-cover mx-auto shadow-2xl ring-2 ring-white/15" />
            </div>
          ) : (
            <div className="relative inline-block mb-6">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-20" style={{ background: gold }} />
              <div className="relative h-24 w-24 rounded-2xl mx-auto flex items-center justify-center text-4xl font-black shadow-2xl ring-2 ring-white/15" style={{ background: `linear-gradient(135deg, ${gold}30, ${gold}10)`, color: gold }}>
                {(officeName || "م")[0]}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 justify-center mb-5">
            {office.licenseNumber && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium" style={{ background: `${gold}15`, color: gold, border: `1px solid ${gold}30` }}>
                <BadgeCheck className="h-3.5 w-3.5" />
                {lang === "ar" ? `مرخّص · رقم ${office.licenseNumber}` : `Licensed · No. ${office.licenseNumber}`}
              </span>
            )}
            {office.city && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium bg-white/8 text-white/60" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                <MapPin className="h-3 w-3" /> {office.city}
              </span>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-5 leading-tight tracking-tight">
            {officeName}
          </h1>
          {tagline && <p className="text-lg md:text-xl text-white/55 mb-10 max-w-2xl mx-auto leading-relaxed">{tagline}</p>}

          <div className="flex flex-wrap gap-3 justify-center mb-12">
            <a href={`/firms/${slug}/book`}>
              <Button size="lg" className="gap-2 px-8 font-bold text-base shadow-2xl hover:opacity-90 transition-opacity"
                style={{ background: `linear-gradient(135deg, ${gold}, #f0d060)`, color: "#000" }}>
                <Calendar className="h-5 w-5" />
                {lang === "ar" ? "احجز استشارتك الآن" : "Book a Consultation"}
              </Button>
            </a>
            {(office.whatsapp || office.phone) && (
              <a href={whatsappUrl()} target="_blank" rel="noreferrer">
                <Button size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 shadow-xl shadow-emerald-900/30">
                  <MessageCircle className="h-5 w-5" />
                  {lang === "ar" ? "واتساب" : "WhatsApp"}
                </Button>
              </a>
            )}
            <Button size="lg" variant="outline" className="gap-2 px-6 border-white/20 hover:bg-white/10"
              onClick={() => scrollTo(servicesRef)}>
              <ShoppingBag className="h-5 w-5" />
              {lang === "ar" ? "الخدمات القانونية" : "Our Services"}
            </Button>
          </div>

          {avgRating > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/6 border border-white/10">
              <div className="flex gap-0.5">{stars(Math.round(avgRating), "h-4 w-4")}</div>
              <span className="font-black text-sm" style={{ color: gold }}>{avgRating.toFixed(1)}</span>
              <span className="text-white/40 text-xs">{lang === "ar" ? `من ${reviews.length} تقييم` : `from ${reviews.length} reviews`}</span>
            </div>
          )}

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
            <ChevronDown className="h-6 w-6" />
          </div>
        </div>
      </header>

      {/* ── STATS STRIP ────────────────────────────── */}
      {office.showStats && (office.casesCount > 0 || office.clientsCount > 0 || office.successRate > 0 || office.experienceYears > 0) && (
        <div className="border-y border-white/6" style={{ background: `${gold}06` }}>
          <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
            {office.experienceYears > 0 && <AnimatedStat val={`${office.experienceYears}+`} label={lang === "ar" ? "سنة خبرة" : "Years Exp."} gold={gold} icon={<Award className="h-5 w-5" />} />}
            {office.casesCount > 0 && <AnimatedStat val={office.casesCount.toLocaleString()} label={lang === "ar" ? "قضية منجزة" : "Cases Handled"} gold={gold} icon={<Briefcase className="h-5 w-5" />} />}
            {office.clientsCount > 0 && <AnimatedStat val={office.clientsCount.toLocaleString()} label={lang === "ar" ? "عميل موثوق" : "Clients Served"} gold={gold} icon={<Users className="h-5 w-5" />} />}
            {office.successRate > 0 && <AnimatedStat val={`${office.successRate}%`} label={lang === "ar" ? "نسبة النجاح" : "Success Rate"} gold={gold} icon={<Trophy className="h-5 w-5" />} />}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-6 pb-24 pt-16 space-y-28">

        {success && (
          <div className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-bold text-emerald-300 text-sm">{success}</p>
            </div>
            <button onClick={() => setSuccess("")} className="mr-auto text-white/30 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ── ABOUT ─────────────────────────────────── */}
        <section ref={aboutRef} id="about">
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <div className="order-2 md:order-1">
              {(office.logo || office.coverImage) ? (
                <div className="relative">
                  <div className="absolute -inset-3 rounded-3xl opacity-20 blur-2xl" style={{ background: gold }} />
                  <div className="absolute inset-0 rounded-3xl translate-x-4 translate-y-4" style={{ background: `${gold}12`, border: `1px solid ${gold}20` }} />
                  <img src={imgSrc(office.coverImage || office.logo)} alt={officeName} className="relative w-full h-80 object-cover rounded-3xl ring-1 ring-white/10" />
                </div>
              ) : (
                <div className="w-full h-80 rounded-3xl flex items-center justify-center" style={{ background: `${gold}06`, border: `1px dashed ${gold}30` }}>
                  <div className="text-center">
                    <Scale className="h-20 w-20 mx-auto mb-3 opacity-15" style={{ color: gold }} />
                    <p className="text-xs text-white/25">{lang === "ar" ? "مكتب محاماة" : "Law Office"}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="order-1 md:order-2">
              <SecHeader icon={<Scale />} title={lang === "ar" ? "من نحن" : "About Us"} gold={gold} noSub />
              <h2 className="text-3xl md:text-4xl font-black mb-5 mt-3 leading-tight">{officeName}</h2>
              {about ? (
                <p className="text-white/60 leading-relaxed text-sm mb-6">{about}</p>
              ) : (
                <p className="text-white/40 text-sm mb-6 italic">{lang === "ar" ? "مكتب محاماة متخصص في تقديم الخدمات القانونية بأعلى المعايير." : "A specialized law firm providing legal services to the highest standards."}</p>
              )}

              <div className="space-y-2.5">
                {office.city && (
                  <div className="flex items-center gap-3 text-sm text-white/50 p-3 rounded-xl bg-white/4">
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: gold }} />
                    <span>{office.city}{office.regions ? ` — ${office.regions}` : ""}</span>
                  </div>
                )}
                {office.licenseNumber && (
                  <div className="flex items-center gap-3 text-sm text-white/50 p-3 rounded-xl bg-white/4">
                    <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: gold }} />
                    <span>{lang === "ar" ? `رقم الترخيص: ${office.licenseNumber}` : `License No: ${office.licenseNumber}`}</span>
                  </div>
                )}
                {office.email && (
                  <a href={`mailto:${office.email}`} className="flex items-center gap-3 text-sm text-white/50 p-3 rounded-xl bg-white/4 hover:bg-white/8 transition-colors">
                    <Mail className="h-4 w-4 shrink-0" style={{ color: gold }} />
                    <span>{office.email}</span>
                  </a>
                )}
                {office.phone && (
                  <a href={`tel:${office.phone}`} className="flex items-center gap-3 text-sm text-white/50 p-3 rounded-xl bg-white/4 hover:bg-white/8 transition-colors">
                    <Phone className="h-4 w-4 shrink-0" style={{ color: gold }} />
                    <span dir="ltr">{office.phone}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── SERVICES ──────────────────────────────── */}
        {services.length > 0 && (
          <section ref={servicesRef} id="services">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-8">
              <div>
                <SecHeader icon={<ShoppingBag />} title={lang === "ar" ? "خدماتنا القانونية" : "Legal Services"} gold={gold} noSub />
                <p className="text-sm text-white/45 mt-2">{lang === "ar" ? "نقدم خدمات قانونية شاملة بأعلى معايير الجودة والمهنية" : "Comprehensive legal services with the highest standards of quality"}</p>
              </div>
              {services.length > 6 && (
                <a href={`/firms/${slug}/store`}>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs border-white/20 hover:bg-white/10">
                    {lang === "ar" ? `عرض الكل (${services.length})` : `View All (${services.length})`}
                    <ChevronRight className={cn("h-3.5 w-3.5", lang === "ar" && "rotate-180")} />
                  </Button>
                </a>
              )}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.slice(0, 6).map((svc: any) => (
                <ServiceCard key={svc.id} svc={svc} lang={lang} gold={gold}
                  onOrder={() => { setOrderDialog(svc); setOrderForm({ clientName: "", clientPhone: "", clientEmail: "", notes: "" }); }} />
              ))}
            </div>
            {services.length > 6 && (
              <div className="mt-8 text-center">
                <a href={`/firms/${slug}/store`}>
                  <Button variant="outline" className="gap-2 border-white/20 hover:bg-white/10 px-8">
                    <ShoppingBag className="h-4 w-4" />
                    {lang === "ar" ? `تصفح المتجر القانوني — ${services.length} خدمة` : `Browse Legal Store — ${services.length} services`}
                    <ArrowLeft className={cn("h-4 w-4", lang === "en" && "rotate-180")} style={{ color: gold }} />
                  </Button>
                </a>
              </div>
            )}
          </section>
        )}

        {/* ── TEAM ──────────────────────────────────── */}
        {team.length > 0 && (
          <section ref={teamRef} id="team">
            <SecHeader icon={<Users />} title={lang === "ar" ? "فريق العمل" : "Our Team"} subtitle={lang === "ar" ? "نخبة من المحامين والمستشارين المتخصصين" : "Elite lawyers and specialized legal consultants"} gold={gold} />
            <p className="text-sm text-white/45 mt-2 mb-8">{lang === "ar" ? "نخبة من المحامين والمستشارين القانونيين المتخصصين" : "A team of specialized lawyers and legal consultants"}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {team.map((m: any) => <TeamCard key={m.id} m={m} lang={lang} gold={gold} />)}
            </div>
          </section>
        )}

        {/* ── REVIEWS ───────────────────────────────── */}
        <section>
          <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
            <div>
              <SecHeader icon={<Star />} title={lang === "ar" ? "آراء العملاء" : "Client Reviews"} gold={gold} noSub />
              {avgRating > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-4xl font-black" style={{ color: gold }}>{avgRating.toFixed(1)}</span>
                  <div>
                    <div className="flex gap-0.5">{stars(Math.round(avgRating), "h-4 w-4")}</div>
                    <div className="text-xs text-white/40 mt-0.5">{lang === "ar" ? `${reviews.length} تقييم` : `${reviews.length} reviews`}</div>
                  </div>
                </div>
              )}
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs border-white/20 hover:bg-white/10"
              onClick={() => setReviewDialog(true)}>
              <Star className="h-3.5 w-3.5" style={{ color: gold }} />
              {lang === "ar" ? "أضف تقييمك" : "Leave a Review"}
            </Button>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-white/3 border border-white/8">
              <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-white/20" />
              </div>
              <p className="text-white/40 font-medium">{lang === "ar" ? "لا توجد تقييمات بعد" : "No reviews yet"}</p>
              <p className="text-white/25 text-sm mt-1">{lang === "ar" ? "كن أول من يقيّم هذا المكتب!" : "Be the first to review this office!"}</p>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleReviews.map((r: any) => (
                  <div key={r.id} className="p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/6 transition-colors relative overflow-hidden">
                    <Quote className="absolute top-3 left-3 h-10 w-10 opacity-5" style={{ color: gold }} />
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ring-2 ring-white/8"
                        style={{ background: `${gold}20`, color: gold }}>{r.clientName[0]}</div>
                      <div>
                        <div className="text-sm font-semibold">{r.clientName}</div>
                        <div className="flex gap-0.5 mt-0.5">{stars(r.rating)}</div>
                      </div>
                    </div>
                    {r.comment && <p className="text-xs text-white/55 leading-relaxed line-clamp-4">{r.comment}</p>}
                  </div>
                ))}
              </div>
              {reviewPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button onClick={() => setReviewPage(p => Math.max(0, p - 1))} disabled={reviewPage === 0}
                    className="h-8 w-8 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center disabled:opacity-30 hover:bg-white/12 transition-colors">
                    <ChevronRight className={cn("h-4 w-4", lang === "ar" && "rotate-0")} />
                  </button>
                  {Array.from({ length: reviewPages }, (_, i) => (
                    <button key={i} onClick={() => setReviewPage(i)}
                      className={cn("h-8 w-8 rounded-lg text-xs font-bold transition-all", reviewPage === i ? "text-black" : "bg-white/6 border border-white/10 hover:bg-white/12")}
                      style={reviewPage === i ? { background: gold } : {}}>
                      {i + 1}
                    </button>
                  ))}
                  <button onClick={() => setReviewPage(p => Math.min(reviewPages - 1, p + 1))} disabled={reviewPage === reviewPages - 1}
                    className="h-8 w-8 rounded-lg bg-white/6 border border-white/10 flex items-center justify-center disabled:opacity-30 hover:bg-white/12 transition-colors">
                    <ChevronLeft className={cn("h-4 w-4", lang === "ar" && "rotate-0")} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── ARTICLES ──────────────────────────────── */}
        {articles.length > 0 && (
          <section>
            <SecHeader icon={<BookOpen />} title={lang === "ar" ? "مركز المعرفة القانونية" : "Legal Knowledge Center"} subtitle={lang === "ar" ? "مقالات ونصائح قانونية من فريق المكتب" : "Legal articles and tips from our team"} gold={gold} />
            <p className="text-sm text-white/45 mt-2 mb-8">{lang === "ar" ? "نشارككم أحدث المقالات والمستجدات القانونية" : "We share the latest legal articles and updates"}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map((a: any) => (
                <div key={a.id} className="group p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/7 hover:border-white/15 transition-all cursor-pointer overflow-hidden">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${gold}15`, color: gold }}>
                      <FileText className="h-4 w-4" />
                    </div>
                    <Badge className="text-[9px] bg-white/5 text-white/40 border-white/10 self-start">{a.category}</Badge>
                  </div>
                  <h3 className="font-bold text-sm mb-2 line-clamp-2 group-hover:text-white/90 transition-colors">{a.title}</h3>
                  {a.excerpt && <p className="text-xs text-white/45 line-clamp-3 leading-relaxed">{a.excerpt}</p>}
                  <div className="flex items-center gap-1 mt-3 text-[10px] font-medium" style={{ color: gold }}>
                    {lang === "ar" ? "اقرأ المقال" : "Read Article"}
                    <ArrowLeft className={cn("h-3 w-3 group-hover:translate-x-1 transition-transform", lang === "en" && "rotate-180")} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── CONTACT ─────────────────────────────────── */}
        <section ref={contactRef} id="contact">
          <SecHeader icon={<Send />} title={lang === "ar" ? "تواصل معنا" : "Get In Touch"} subtitle={lang === "ar" ? "نحن هنا لمساعدتك — تواصل معنا الآن" : "We're here to help — reach out now"} gold={gold} />
          <p className="text-sm text-white/45 mt-2 mb-8">{lang === "ar" ? "نرد على استفساراتك في أسرع وقت ممكن" : "We respond to your inquiries as quickly as possible"}</p>

          <div className="grid md:grid-cols-5 gap-8">
            <div className="md:col-span-2 space-y-3">
              {(office.whatsapp || office.phone) && (
                <a href={whatsappUrl()} target="_blank" rel="noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/20 hover:bg-emerald-500/15 transition-all group">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-white/40 mb-0.5">{lang === "ar" ? "واتساب" : "WhatsApp"}</div>
                    <div className="font-bold text-sm text-emerald-300">{office.whatsapp || office.phone}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-emerald-500/40 group-hover:text-emerald-400 transition-colors" />
                </a>
              )}
              {office.phone && (
                <a href={`tel:${office.phone}`} className="flex items-center gap-4 p-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-colors group">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${gold}15` }}>
                    <Phone className="h-5 w-5" style={{ color: gold }} />
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 mb-0.5">{lang === "ar" ? "هاتف مباشر" : "Phone"}</div>
                    <div className="font-semibold text-sm" dir="ltr">{office.phone}</div>
                  </div>
                </a>
              )}
              {office.email && (
                <a href={`mailto:${office.email}`} className="flex items-center gap-4 p-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-colors">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${gold}15` }}>
                    <Mail className="h-5 w-5" style={{ color: gold }} />
                  </div>
                  <div>
                    <div className="text-[10px] text-white/40 mb-0.5">{lang === "ar" ? "بريد إلكتروني" : "Email"}</div>
                    <div className="font-semibold text-sm">{office.email}</div>
                  </div>
                </a>
              )}
              {office.address && (
                <a
                  href={office.googleMapsUrl ?? (office.address ? `https://maps.google.com/?q=${encodeURIComponent(office.address)}` : undefined)}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-4 p-4 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/8 transition-colors group"
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${gold}15` }}>
                    <MapPin className="h-5 w-5" style={{ color: gold }} />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] text-white/40 mb-0.5">{lang === "ar" ? "العنوان" : "Address"}</div>
                    <div className="font-semibold text-sm">{office.address}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-white/20 group-hover:text-white/50 transition-colors shrink-0" />
                </a>
              )}
            </div>

            <div className="md:col-span-3 p-6 rounded-2xl border" style={{ background: `${gold}05`, borderColor: `${gold}18` }}>
              <h3 className="font-bold mb-1">{lang === "ar" ? "أرسل لنا رسالة" : "Send Us a Message"}</h3>
              <p className="text-xs text-white/40 mb-5">{lang === "ar" ? "اختر الموضوع وأرسل رسالتك مباشرةً عبر واتساب" : "Choose a subject and send your message directly via WhatsApp"}</p>
              <ContactForm lang={lang} gold={gold} whatsappUrl={whatsappUrl} officeName={officeName}
                onOrder={() => { setOrderDialog({ name: lang === "ar" ? "استشارة قانونية" : "Legal Consultation", isCustomQuote: true }); }} />
            </div>
          </div>

          {/* ── Google Maps Section ── */}
          {(office.mapsEmbedUrl || office.googleMapsUrl || office.address) && (
            <div className="mt-8 rounded-2xl overflow-hidden border border-white/10 relative group">
              {office.mapsEmbedUrl ? (
                <>
                  <iframe
                    src={office.mapsEmbedUrl}
                    width="100%"
                    height="340"
                    style={{ border: 0, display: "block" }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={lang === "ar" ? "موقع المكتب" : "Office Location"}
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(office.googleMapsUrl || office.address) && (
                      <a
                        href={office.googleMapsUrl ?? `https://maps.google.com/?q=${encodeURIComponent(office.address)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Button size="sm" className="gap-2 text-xs font-bold shadow-2xl shadow-black/60 bg-white text-black hover:bg-white/90">
                          <MapPin className="h-3.5 w-3.5" style={{ color: "#EA4335" }} />
                          {lang === "ar" ? "فتح في خرائط جوجل" : "Open in Google Maps"}
                          <ExternalLink className="h-3 w-3 text-black/40" />
                        </Button>
                      </a>
                    )}
                  </div>
                </>
              ) : (office.googleMapsUrl || office.address) && (
                <a
                  href={office.googleMapsUrl ?? `https://maps.google.com/?q=${encodeURIComponent(office.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-4 p-5 bg-white/4 hover:bg-white/7 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${gold}15`, color: gold }}>
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold mb-0.5">{lang === "ar" ? "موقع المكتب" : "Office Location"}</div>
                      {office.address && <div className="text-xs text-white/50">{office.address}</div>}
                    </div>
                  </div>
                  <Button size="sm" className="gap-1.5 text-xs font-bold shrink-0" style={{ background: gold, color: "#000" }}>
                    <MapPin className="h-3.5 w-3.5" />
                    {lang === "ar" ? "فتح في الخريطة" : "Open Map"}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>
          )}

          {(office.twitter || office.linkedin || office.facebook || office.website || office.instagram) && (
            <div className="mt-8 p-5 rounded-2xl bg-white/3 border border-white/8 flex flex-wrap gap-3 items-center justify-center">
              <span className="text-xs text-white/35 font-medium">{lang === "ar" ? "تابعنا على" : "Follow Us"}</span>
              <div className="flex gap-2">
                {office.twitter && <SocialLink href={office.twitter} icon={<Twitter className="h-4 w-4 text-sky-400" />} label="Twitter" hoverColor="hover:bg-sky-500/20 hover:border-sky-500/30" />}
                {office.linkedin && <SocialLink href={office.linkedin} icon={<Linkedin className="h-4 w-4 text-blue-400" />} label="LinkedIn" hoverColor="hover:bg-blue-500/20 hover:border-blue-500/30" />}
                {office.facebook && <SocialLink href={office.facebook} icon={<Facebook className="h-4 w-4 text-blue-500" />} label="Facebook" hoverColor="hover:bg-blue-600/20 hover:border-blue-600/30" />}
                {office.instagram && <SocialLink href={office.instagram} icon={<Instagram className="h-4 w-4 text-pink-400" />} label="Instagram" hoverColor="hover:bg-pink-500/20 hover:border-pink-500/30" />}
                {office.website && <SocialLink href={office.website} icon={<Globe className="h-4 w-4 text-white/60" />} label="Website" hoverColor="hover:bg-white/10 hover:border-white/20" />}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* ── FOOTER ────────────────────────────────── */}
      <footer className="border-t border-white/6 py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {office.logo ? (
                <img src={imgSrc(office.logo)} alt={officeName} className="h-8 w-8 rounded-lg object-cover opacity-70" />
              ) : (
                <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-black opacity-70" style={{ background: `${gold}20`, color: gold }}>{(officeName || "م")[0]}</div>
              )}
              <span className="text-sm font-bold text-white/50">{officeName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-white/30">
              <button onClick={() => scrollTo(aboutRef)} className="hover:text-white/60 transition-colors">{lang === "ar" ? "من نحن" : "About"}</button>
              <button onClick={() => scrollTo(servicesRef)} className="hover:text-white/60 transition-colors">{lang === "ar" ? "الخدمات" : "Services"}</button>
              <button onClick={() => scrollTo(contactRef)} className="hover:text-white/60 transition-colors">{lang === "ar" ? "تواصل" : "Contact"}</button>
              <a href={`/firms/${slug}/store`} className="hover:text-white/60 transition-colors">{lang === "ar" ? "المتجر" : "Store"}</a>
              <a href={`/firms/${slug}/book`} className="hover:text-white/60 transition-colors">{lang === "ar" ? "الحجز" : "Book"}</a>
            </div>
            <div className="text-[11px] text-white/20">
              © {new Date().getFullYear()} · {lang === "ar" ? "مدعوم بـ" : "Powered by"}
              <span className="font-bold mx-1" style={{ color: gold }}>عدالة AI</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp floating button ───────────────── */}
      {(office.whatsapp || office.phone) && (
        <a href={whatsappUrl()} target="_blank" rel="noreferrer"
          className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:scale-110">
          <MessageCircle className="h-7 w-7 text-white" />
        </a>
      )}

      {/* ── Sticky Book CTA (mobile) ───────────────── */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 pb-safe" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="mx-4 mb-3">
          <a href={`/firms/${slug}/book`}>
            <Button className="w-full gap-2 font-bold h-12 shadow-2xl text-base"
              style={{ background: `linear-gradient(135deg, ${gold}, #f0d060)`, color: "#000" }}>
              <Calendar className="h-5 w-5" />
              {lang === "ar" ? "احجز استشارة مجانية" : "Book Free Consultation"}
            </Button>
          </a>
        </div>
      </div>

      {/* ── Order Dialog ──────────────────────────── */}
      <Dialog open={!!orderDialog} onOpenChange={() => setOrderDialog(null)}>
        <DialogContent className="max-w-md" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: `${gold}20`, color: gold }}>
                <Scale className="h-4 w-4" />
              </div>
              {orderDialog?.isCustomQuote ? (lang === "ar" ? "طلب عرض سعر" : "Request Quote") : t(orderDialog?.name, orderDialog?.nameEn, lang)}
            </DialogTitle>
          </DialogHeader>
          {orderDialog && (
            <div className="space-y-3">
              {!orderDialog.isCustomQuote && orderDialog.price && (
                <div className="p-3 rounded-xl text-center" style={{ background: `${gold}10`, border: `1px solid ${gold}20` }}>
                  <div className="text-[10px] text-white/40 mb-1">{lang === "ar" ? "سعر الخدمة" : "Service Price"}</div>
                  <span className="text-2xl font-black" style={{ color: gold }}>{Number(orderDialog.price).toLocaleString()} <span className="text-sm">{lang === "ar" ? "ر.س" : "SAR"}</span></span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "الاسم الكامل *" : "Full Name *"}</Label>
                  <Input value={orderForm.clientName} onChange={e => setOrderForm(f => ({ ...f, clientName: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "رقم الجوال *" : "Phone *"}</Label>
                  <Input value={orderForm.clientPhone} onChange={e => setOrderForm(f => ({ ...f, clientPhone: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
                <Input value={orderForm.clientEmail} onChange={e => setOrderForm(f => ({ ...f, clientEmail: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "تفاصيل الطلب" : "Request Details"}</Label>
                <Textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="resize-none" placeholder={lang === "ar" ? "أي تفاصيل إضافية..." : "Any additional details..."} />
              </div>
              <Button className="w-full gap-2 font-bold h-11" style={{ background: gold, color: "#000" }}
                disabled={!orderForm.clientName || !orderForm.clientPhone || orderMutation.isPending}
                onClick={() => orderMutation.mutate()}>
                {orderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {orderDialog.isCustomQuote ? (lang === "ar" ? "إرسال طلب العرض" : "Request Quote") : (lang === "ar" ? "تأكيد الطلب" : "Confirm Order")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Review Dialog ─────────────────────────── */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-sm" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" style={{ color: gold }} />
              {lang === "ar" ? "أضف تقييمك" : "Leave a Review"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold mb-2 block">{lang === "ar" ? "التقييم" : "Rating"}</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setReviewForm(f => ({ ...f, rating: String(n) }))}
                    className="transition-transform hover:scale-110">
                    <Star className={cn("h-7 w-7", n <= parseInt(reviewForm.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "اسمك *" : "Your Name *"}</Label>
              <Input value={reviewForm.clientName} onChange={e => setReviewForm(f => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "تعليقك" : "Comment"}</Label>
              <Textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} rows={3} className="resize-none" />
            </div>
            <Button className="w-full gap-2 font-bold" style={{ background: gold, color: "#000" }}
              disabled={!reviewForm.clientName || reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}>
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {lang === "ar" ? "إرسال التقييم" : "Submit Review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
