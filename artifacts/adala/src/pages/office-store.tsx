import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  ShoppingBag, Loader2, Scale, MessageCircle, ChevronLeft,
  Clock, Star, BadgeCheck, ArrowLeft, Search, X, CheckCircle2,
  Gavel, FileText, Shield, Heart, Briefcase, Home, Building,
  Car, Users, Filter, Zap, Phone, Calendar, ChevronRight,
  DollarSign,
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

const CATEGORIES_AR = ["الكل", "استشارات", "عقود", "دعاوى", "توثيق", "تحكيم", "أحوال شخصية", "تجاري", "عقاري", "جنائي", "عمالي", "إداري"];
const CATEGORIES_EN = ["All", "Consultations", "Contracts", "Litigation", "Notarization", "Arbitration", "Personal Status", "Commercial", "Real Estate", "Criminal", "Labor", "Administrative"];

const CATEGORY_ICONS: Record<string, any> = {
  استشارات: Scale, Consultations: Scale,
  عقود: FileText, Contracts: FileText,
  دعاوى: Gavel, Litigation: Gavel,
  توثيق: BadgeCheck, Notarization: BadgeCheck,
  تحكيم: Shield, Arbitration: Shield,
  "أحوال شخصية": Heart, "Personal Status": Heart,
  تجاري: Briefcase, Commercial: Briefcase,
  عقاري: Home, "Real Estate": Home,
  جنائي: Scale, Criminal: Scale,
  عمالي: Users, Labor: Users,
  إداري: Building, Administrative: Building,
};

const SORT_OPTIONS_AR = ["الأحدث", "السعر: من الأقل", "السعر: من الأعلى", "حسب التسليم"];
const SORT_OPTIONS_EN = ["Newest", "Price: Low to High", "Price: High to Low", "By Delivery"];

export default function OfficeStore() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [lang, setLang] = useState<Lang>("ar");
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState("");
  const [sortIdx, setSortIdx] = useState(0);
  const [orderDialog, setOrderDialog] = useState<any>(null);
  const [orderForm, setOrderForm] = useState({ clientName: "", clientPhone: "", clientEmail: "", notes: "" });
  const [success, setSuccess] = useState(false);

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
      setSuccess(true);
      setOrderDialog(null);
    },
  });

  if (isLoading) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
      <div className="text-center">
        <div className="h-16 w-16 rounded-2xl bg-[#C9A84C]/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <ShoppingBag className="h-8 w-8 text-[#C9A84C]" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-[#C9A84C] mx-auto" />
      </div>
    </div>
  );

  if (isError || !data?.office) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white text-center px-6">
      <div>
        <div className="h-24 w-24 rounded-3xl bg-[#C9A84C]/10 flex items-center justify-center mx-auto mb-6">
          <Scale className="h-12 w-12 text-[#C9A84C] opacity-50" />
        </div>
        <h1 className="text-3xl font-black mb-3">
          {lang === "ar" ? "المكتب غير موجود" : "Office Not Found"}
        </h1>
        <p className="text-white/50 text-sm mb-6">{lang === "ar" ? "تحقق من الرابط أو تواصل مع المكتب مباشرةً" : "Check the URL or contact the office directly"}</p>
        <button onClick={() => window.location.href = "/"} className="px-6 py-2.5 rounded-xl bg-[#C9A84C] text-black font-bold text-sm hover:bg-[#b8943d] transition-colors">
          {lang === "ar" ? "العودة للرئيسية" : "Back to Home"}
        </button>
      </div>
    </div>
  );

  const { office, services = [] } = data;
  const gold = office.primaryColor ?? "#C9A84C";
  const officeName = t(office.name, office.nameEn, lang);
  const cats = lang === "ar" ? CATEGORIES_AR : CATEGORIES_EN;
  const whatsappBase = (office.whatsapp ?? office.phone ?? "").replace(/\D/g, "");

  let filtered = services.filter((svc: any) => {
    const name = t(svc.name, svc.nameEn, lang).toLowerCase();
    const desc = t(svc.description, svc.descriptionEn, lang).toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
    const matchCat = activeCategory === 0 || svc.category === CATEGORIES_AR[activeCategory];
    return matchSearch && matchCat;
  });

  if (sortIdx === 1) filtered = [...filtered].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  if (sortIdx === 2) filtered = [...filtered].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  if (sortIdx === 3) filtered = [...filtered].sort((a, b) => (a.deliveryDays || 99) - (b.deliveryDays || 99));

  const featured = services.filter((s: any) => s.isFeatured);
  const categoryCounts: Record<string, number> = {};
  services.forEach((s: any) => {
    if (s.category) categoryCounts[s.category] = (categoryCounts[s.category] ?? 0) + 1;
  });
  const minPrice = services.filter((s: any) => s.price && !s.isCustomQuote).map((s: any) => Number(s.price));
  const lowestPrice = minPrice.length ? Math.min(...minPrice) : null;

  return (
    <div
      className={cn("min-h-screen bg-[#080d1a] text-white", lang === "ar" ? "font-['Cairo',sans-serif]" : "font-sans")}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-[#080d1a]/97 backdrop-blur border-b border-white/6 shadow-lg shadow-black/20">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href={`/firms/${slug}`} className="flex items-center gap-1.5 text-white/45 hover:text-white transition-colors text-xs font-medium">
              <ChevronLeft className={cn("h-4 w-4", lang === "en" && "rotate-180")} />
              {lang === "ar" ? "الصفحة الرئيسية" : "Home"}
            </a>
            <span className="text-white/15">|</span>
            {office.logo ? (
              <img src={imgSrc(office.logo)} alt={officeName} className="h-6 w-6 rounded object-cover" />
            ) : (
              <div className="h-6 w-6 rounded flex items-center justify-center text-xs font-black" style={{ background: `${gold}20`, color: gold }}>{(officeName || "م")[0]}</div>
            )}
            <span className="font-bold text-sm">{officeName}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold" style={{ color: gold }}>
              <ShoppingBag className="h-3.5 w-3.5" />
              {lang === "ar" ? "المتجر القانوني" : "Legal Store"}
            </div>
            <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
              className="text-xs px-2 py-1 rounded-lg border border-white/20 font-bold hover:border-white/40 transition-colors" style={{ color: gold }}>
              {lang === "ar" ? "EN" : "ع"}
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO BANNER ── */}
      <div className="relative py-14 text-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% -10%, ${gold}14 0%, transparent 65%)` }} />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle, ${gold}05 1px, transparent 1px)`,
          backgroundSize: "35px 35px"
        }} />
        <div className="relative max-w-2xl mx-auto px-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
            style={{ background: `${gold}15`, color: gold, border: `1px solid ${gold}25` }}>
            <ShoppingBag className="h-3.5 w-3.5" />
            {lang === "ar" ? "المتجر القانوني" : "Legal Store"}
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-3">
            {lang === "ar" ? "الخدمات القانونية" : "Legal Services"}
          </h1>
          <p className="text-white/50 text-sm mb-5">{officeName}</p>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <BadgeCheck className="h-3.5 w-3.5" style={{ color: gold }} />
              {lang === "ar" ? `${services.length} خدمة متاحة` : `${services.length} services`}
            </span>
            {lowestPrice && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" style={{ color: gold }} />
                {lang === "ar" ? `تبدأ من ${lowestPrice.toLocaleString()} ر.س` : `From ${lowestPrice.toLocaleString()} SAR`}
              </span>
            )}
            {office.licenseNumber && (
              <span className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" style={{ color: gold }} />
                {lang === "ar" ? "مكتب مرخّص" : "Licensed Office"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-24">

        {/* ── SUCCESS BANNER ── */}
        {success && (
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-8">
            <div className="h-9 w-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-emerald-300 text-sm">{lang === "ar" ? "تم إرسال طلبك بنجاح!" : "Your request was sent!"}</p>
              <p className="text-emerald-400/60 text-xs">{lang === "ar" ? "سيتواصل معك المكتب قريباً" : "The office will contact you soon"}</p>
            </div>
            <button onClick={() => setSuccess(false)} className="text-emerald-400/50 hover:text-emerald-400"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ── FEATURED SERVICES ── */}
        {featured.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4" style={{ color: gold }} />
              <span className="text-sm font-bold">{lang === "ar" ? "الخدمات المميزة" : "Featured Services"}</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((svc: any) => (
                <FeaturedServiceCard key={svc.id} svc={svc} lang={lang} gold={gold} slug={slug}
                  whatsappBase={whatsappBase}
                  onOrder={() => { setOrderDialog(svc); setOrderForm({ clientName: "", clientPhone: "", clientEmail: "", notes: "" }); }} />
              ))}
            </div>
          </div>
        )}

        {/* ── SEARCH + SORT ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "ابحث عن خدمة..." : "Search services..."}
              className="bg-white/5 border-white/10 pr-9"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-white/30 shrink-0" />
            <div className="flex gap-1">
              {(lang === "ar" ? SORT_OPTIONS_AR : SORT_OPTIONS_EN).map((opt, i) => (
                <button key={opt} onClick={() => setSortIdx(i)}
                  className={cn("text-[10px] px-2.5 py-1.5 rounded-lg border transition-all font-medium whitespace-nowrap",
                    sortIdx === i ? "text-black border-transparent" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10")}
                  style={sortIdx === i ? { background: gold } : {}}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CATEGORY TABS ── */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
          {cats.map((cat, i) => {
            const CatIcon = i > 0 ? (CATEGORY_ICONS[cat] ?? Scale) : ShoppingBag;
            const arCat = CATEGORIES_AR[i];
            const count = i === 0 ? services.length : (categoryCounts[arCat] ?? 0);
            return (
              <button key={cat} onClick={() => setActiveCategory(i)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-xl border transition-all font-medium",
                  activeCategory === i
                    ? "text-black border-transparent shadow-lg"
                    : "bg-white/5 border-white/10 text-white/55 hover:bg-white/10 hover:border-white/20"
                )}
                style={activeCategory === i ? { background: gold, borderColor: gold } : {}}>
                <CatIcon className="h-3.5 w-3.5" />
                {cat}
                {count > 0 && (
                  <span className={cn("text-[9px] font-black rounded-full px-1.5 py-0.5", activeCategory === i ? "bg-black/20" : "bg-white/10")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── RESULTS COUNT ── */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs text-white/35">
            {search || activeCategory !== 0
              ? (lang === "ar" ? `${filtered.length} نتيجة` : `${filtered.length} results`)
              : (lang === "ar" ? `جميع الخدمات — ${filtered.length}` : `All Services — ${filtered.length}`)
            }
          </p>
          {(search || activeCategory !== 0) && (
            <button onClick={() => { setSearch(""); setActiveCategory(0); }}
              className="text-xs text-white/40 hover:text-white flex items-center gap-1 transition-colors">
              <X className="h-3 w-3" /> {lang === "ar" ? "مسح الفلاتر" : "Clear filters"}
            </button>
          )}
        </div>

        {/* ── SERVICES GRID ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-20 w-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-5">
              <ShoppingBag className="h-10 w-10 text-white/15" />
            </div>
            <h3 className="font-bold text-white/50 mb-2">
              {lang === "ar" ? "لا توجد خدمات مطابقة" : "No matching services"}
            </h3>
            <p className="text-xs text-white/30 mb-5">
              {lang === "ar" ? "جرب تغيير الفلاتر أو البحث بكلمة مختلفة" : "Try changing filters or search with a different term"}
            </p>
            <Button variant="outline" size="sm" className="gap-1.5 border-white/20 hover:bg-white/10"
              onClick={() => { setSearch(""); setActiveCategory(0); }}>
              <X className="h-3.5 w-3.5" /> {lang === "ar" ? "مسح الفلاتر" : "Clear Filters"}
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((svc: any) => (
              <ServiceCard key={svc.id} svc={svc} lang={lang} gold={gold} slug={slug} whatsappBase={whatsappBase}
                onOrder={() => { setOrderDialog(svc); setOrderForm({ clientName: "", clientPhone: "", clientEmail: "", notes: "" }); }} />
            ))}
          </div>
        )}

        {/* ── TRUST BADGES ── */}
        <div className="mt-16 grid sm:grid-cols-3 gap-4">
          {[
            { icon: <Shield className="h-5 w-5" />, title: lang === "ar" ? "مكتب موثوق" : "Trusted Office", desc: lang === "ar" ? "مرخّص ومعتمد رسمياً" : "Officially licensed and certified" },
            { icon: <Zap className="h-5 w-5" />, title: lang === "ar" ? "استجابة سريعة" : "Fast Response", desc: lang === "ar" ? "نرد على استفساراتك خلال ساعات" : "We respond to your inquiries within hours" },
            { icon: <BadgeCheck className="h-5 w-5" />, title: lang === "ar" ? "جودة مضمونة" : "Guaranteed Quality", desc: lang === "ar" ? "خدمات قانونية بأعلى معايير الجودة" : "Legal services to the highest quality standards" },
          ].map((b, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white/3 border border-white/8">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${gold}15`, color: gold }}>{b.icon}</div>
              <div>
                <div className="font-bold text-sm mb-0.5">{b.title}</div>
                <div className="text-xs text-white/45">{b.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── WHATSAPP CTA ── */}
        {whatsappBase && (
          <div className="mt-10 p-7 rounded-3xl text-center relative overflow-hidden"
            style={{ background: `${gold}06`, border: `1px solid ${gold}18` }}>
            <div className="absolute inset-0 opacity-30" style={{ background: `radial-gradient(ellipse at 50% -20%, ${gold}20, transparent 65%)` }} />
            <div className="relative">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-7 w-7 text-emerald-400" />
              </div>
              <h3 className="font-black text-xl mb-2">{lang === "ar" ? "تحتاج مساعدة في الاختيار؟" : "Need Help Choosing?"}</h3>
              <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">
                {lang === "ar" ? "تواصل مع المكتب مباشرةً عبر واتساب وسيساعدك فريقنا في اختيار الخدمة المناسبة لقضيتك" : "Contact the office directly via WhatsApp and our team will help you choose the right service for your case"}
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <a href={`https://wa.me/${whatsappBase}`} target="_blank" rel="noreferrer">
                  <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-7 h-11 font-bold shadow-xl shadow-emerald-900/30">
                    <MessageCircle className="h-4 w-4" />
                    {lang === "ar" ? "تواصل عبر واتساب" : "Chat on WhatsApp"}
                  </Button>
                </a>
                <a href={`/firms/${slug}/book`}>
                  <Button variant="outline" className="gap-2 border-white/20 hover:bg-white/10 h-11 px-6" style={{ borderColor: `${gold}35`, color: gold }}>
                    <Calendar className="h-4 w-4" />
                    {lang === "ar" ? "احجز استشارة" : "Book Consultation"}
                  </Button>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/6 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white/30 text-xs">
            {office.logo && <img src={imgSrc(office.logo)} alt="" className="h-5 w-5 rounded object-cover opacity-50" />}
            <span>{officeName}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-white/25">
            <a href={`/firms/${slug}`} className="hover:text-white/50 transition-colors">{lang === "ar" ? "الصفحة الرئيسية" : "Home"}</a>
            <a href={`/firms/${slug}/book`} className="hover:text-white/50 transition-colors">{lang === "ar" ? "احجز" : "Book"}</a>
          </div>
          <div className="text-[11px] text-white/20">
            {lang === "ar" ? "مدعوم بـ" : "Powered by"}
            <span className="font-bold mx-1" style={{ color: gold }}>عدالة AI</span>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp Float ── */}
      {whatsappBase && (
        <a href={`https://wa.me/${whatsappBase}`} target="_blank" rel="noreferrer"
          className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-all flex items-center justify-center shadow-xl shadow-emerald-500/30 hover:scale-110">
          <MessageCircle className="h-7 w-7 text-white" />
        </a>
      )}

      {/* ── Order Dialog ── */}
      <Dialog open={!!orderDialog} onOpenChange={() => setOrderDialog(null)}>
        <DialogContent className="max-w-md" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {(() => {
                const Icon = CATEGORY_ICONS[orderDialog?.category] ?? Scale;
                return <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${gold}20`, color: gold }}><Icon className="h-4 w-4" /></div>;
              })()}
              <span className="line-clamp-1">
                {orderDialog?.isCustomQuote ? (lang === "ar" ? "طلب عرض سعر" : "Request Quote") : t(orderDialog?.name, orderDialog?.nameEn, lang)}
              </span>
            </DialogTitle>
          </DialogHeader>
          {orderDialog && (
            <div className="space-y-3">
              {!orderDialog.isCustomQuote && orderDialog.price && (
                <div className="p-4 rounded-xl text-center" style={{ background: `${gold}08`, border: `1px solid ${gold}20` }}>
                  <div className="text-[10px] text-white/40 mb-1">{lang === "ar" ? "سعر الخدمة" : "Service Price"}</div>
                  <span className="text-3xl font-black" style={{ color: gold }}>{Number(orderDialog.price).toLocaleString()}</span>
                  <span className="text-sm text-white/50 mr-1">{lang === "ar" ? " ر.س" : " SAR"}</span>
                  {orderDialog.deliveryDays > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-1 text-[10px] text-white/35">
                      <Clock className="h-3 w-3" />
                      {lang === "ar" ? `التسليم خلال ${orderDialog.deliveryDays} يوم` : `${orderDialog.deliveryDays}-day delivery`}
                    </div>
                  )}
                </div>
              )}

              {orderDialog.description && (
                <p className="text-xs text-white/50 leading-relaxed p-3 rounded-xl bg-white/4 border border-white/8">
                  {t(orderDialog.description, orderDialog.descriptionEn, lang)}
                </p>
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
                <Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "تفاصيل الطلب" : "Details"}</Label>
                <Textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="resize-none"
                  placeholder={lang === "ar" ? "اشرح طلبك باختصار..." : "Briefly describe your request..."} />
              </div>
              <Button className="w-full gap-2 font-bold h-11 text-sm" style={{ background: gold, color: "#000" }}
                disabled={!orderForm.clientName || !orderForm.clientPhone || orderMutation.isPending}
                onClick={() => orderMutation.mutate()}>
                {orderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {orderDialog.isCustomQuote
                  ? (lang === "ar" ? "إرسال طلب العرض" : "Request Quote")
                  : (lang === "ar" ? "تأكيد الطلب" : "Confirm Order")}
              </Button>
              {whatsappBase && (
                <a href={`https://wa.me/${whatsappBase}?text=${encodeURIComponent(lang === "ar" ? `أريد الاستفسار عن: ${t(orderDialog.name, orderDialog.nameEn, lang)}` : `I'd like to inquire about: ${t(orderDialog.name, orderDialog.nameEn, lang)}`)}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full gap-2 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {lang === "ar" ? "استفسر عبر واتساب" : "Ask on WhatsApp"}
                  </Button>
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function FeaturedServiceCard({ svc, lang, gold, slug, whatsappBase, onOrder }: { svc: any; lang: Lang; gold: string; slug: string; whatsappBase: string; onOrder: () => void }) {
  const name = t(svc.name, svc.nameEn, lang);
  const desc = t(svc.description, svc.descriptionEn, lang);
  const Icon = CATEGORY_ICONS[svc.category] ?? Scale;
  return (
    <div className="relative p-5 rounded-2xl border overflow-hidden group hover:scale-[1.01] transition-all"
      style={{ background: `linear-gradient(135deg, ${gold}10, ${gold}05)`, borderColor: `${gold}30` }}>
      <div className="absolute top-2 left-2 right-0">
        <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: gold, color: "#000" }}>
          {lang === "ar" ? "⭐ مميّز" : "⭐ Featured"}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-4 mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${gold}20`, color: gold }}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-sm">{name}</h3>
          {svc.category && <span className="text-[10px] text-white/40">{svc.category}</span>}
        </div>
      </div>
      {desc && <p className="text-xs text-white/55 mb-4 line-clamp-2 leading-relaxed">{desc}</p>}
      <div className="flex items-center justify-between">
        <span className="font-black text-lg" style={{ color: gold }}>
          {svc.isCustomQuote
            ? <span className="text-sm">{lang === "ar" ? "حسب العرض" : "Custom"}</span>
            : `${Number(svc.price).toLocaleString()} ${lang === "ar" ? "ر.س" : "SAR"}`}
        </span>
        <div className="flex gap-2">
          <a href={`/firms/${slug}/service/${svc.id}`}
            className="flex items-center justify-center rounded-md border text-xs font-bold px-3 h-8 transition-colors"
            style={{ borderColor: `${gold}40`, color: gold, background: `${gold}08` }}>
            {lang === "ar" ? "تفاصيل" : "Details"}
          </a>
          <Button size="sm" className="text-xs font-bold gap-1 h-8" style={{ background: gold, color: "#000" }} onClick={onOrder}>
            {svc.isCustomQuote ? (lang === "ar" ? "اطلب عرضاً" : "Quote") : (lang === "ar" ? "اطلب الآن" : "Order")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ svc, lang, gold, slug, whatsappBase, onOrder }: { svc: any; lang: Lang; gold: string; slug: string; whatsappBase: string; onOrder: () => void }) {
  const name = t(svc.name, svc.nameEn, lang);
  const desc = t(svc.description, svc.descriptionEn, lang);
  const Icon = CATEGORY_ICONS[svc.category] ?? Scale;
  return (
    <div className="group p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/6 hover:border-white/15 transition-all flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${gold}60, transparent)` }} />

      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors group-hover:ring-1"
          style={{ background: `${gold}12`, color: gold }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm leading-snug mb-1 line-clamp-2">{name}</h3>
          {svc.category && (
            <Badge className="text-[9px] bg-white/5 text-white/40 border-white/10">{svc.category}</Badge>
          )}
        </div>
      </div>

      {desc && <p className="text-xs text-white/50 mb-4 flex-1 leading-relaxed line-clamp-3">{desc}</p>}

      {svc.deliveryDays > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-white/35 mb-4">
          <Clock className="h-3 w-3" />
          {lang === "ar" ? `التسليم خلال ${svc.deliveryDays} يوم` : `${svc.deliveryDays}-day delivery`}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-white/8 mt-auto gap-2">
        <div className="min-w-0">
          {svc.isCustomQuote ? (
            <span className="text-xs text-white/50 font-medium">{lang === "ar" ? "حسب العرض" : "Custom Quote"}</span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black" style={{ color: gold }}>{Number(svc.price).toLocaleString()}</span>
              <span className="text-[10px] text-white/40">{lang === "ar" ? "ر.س" : "SAR"}</span>
            </div>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <a href={`/firms/${slug}/service/${svc.id}`}
            className="flex items-center justify-center rounded-md border text-xs font-bold px-3 h-8 transition-colors"
            style={{ borderColor: `${gold}40`, color: gold, background: `${gold}08` }}>
            {lang === "ar" ? "تفاصيل" : "Details"}
          </a>
          {whatsappBase && (
            <a href={`https://wa.me/${whatsappBase}?text=${encodeURIComponent(lang === "ar" ? `أود الاستفسار عن: ${name}` : `I'd like to inquire about: ${name}`)}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-emerald-500/25 hover:bg-emerald-500/12 text-emerald-400">
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
            </a>
          )}
          <Button size="sm" className="text-xs font-bold px-4 h-8" style={{ background: gold, color: "#000" }} onClick={onOrder}>
            {svc.isCustomQuote ? (lang === "ar" ? "اطلب عرضاً" : "Quote") : (lang === "ar" ? "اطلب" : "Order")}
          </Button>
        </div>
      </div>
    </div>
  );
}
