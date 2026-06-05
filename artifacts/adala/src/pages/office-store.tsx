import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  ShoppingBag, Loader2, Scale, MessageCircle, ChevronLeft,
  Clock, Filter, Star, BadgeCheck, ArrowRight
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

const CATEGORIES_AR = ["الكل", "استشارات", "عقود", "دعاوى", "توثيق", "تحكيم", "أحوال شخصية", "تجاري", "عقاري"];
const CATEGORIES_EN = ["All", "Consultations", "Contracts", "Litigation", "Notarization", "Arbitration", "Personal Status", "Commercial", "Real Estate"];

export default function OfficeStore() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [lang, setLang] = useState<Lang>("ar");
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState("");
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
      <Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" />
    </div>
  );

  if (isError || !data?.office) return (
    <div className="min-h-screen bg-[#080d1a] flex items-center justify-center text-white text-center">
      <div><Scale className="h-16 w-16 mx-auto mb-4 text-[#C9A84C] opacity-30" />
        <h1 className="text-2xl font-bold">المكتب غير موجود</h1></div>
    </div>
  );

  const { office, services = [] } = data;
  const gold = office.primaryColor ?? "#C9A84C";
  const officeName = t(office.name, office.nameEn, lang);
  const cats = lang === "ar" ? CATEGORIES_AR : CATEGORIES_EN;

  const filtered = services.filter((svc: any) => {
    const name = t(svc.name, svc.nameEn, lang).toLowerCase();
    const desc = t(svc.description, svc.descriptionEn, lang).toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
    const matchCat = activeCategory === 0 || svc.category === CATEGORIES_AR[activeCategory];
    return matchSearch && matchCat;
  });

  const whatsappBase = (office.whatsapp ?? office.phone ?? "").replace(/\D/g, "");

  return (
    <div className={cn("min-h-screen bg-[#080d1a] text-white", lang === "ar" ? "font-['Cairo',sans-serif]" : "font-sans")} dir={lang === "ar" ? "rtl" : "ltr"}>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#080d1a]/95 backdrop-blur border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href={`/firms/${slug}`} className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-xs">
              <ChevronLeft className={cn("h-4 w-4", lang === "en" && "rotate-180")} />
              {lang === "ar" ? "الصفحة الرئيسية" : "Home Page"}
            </a>
            <span className="text-white/20">|</span>
            {office.logo ? (
              <img src={imgSrc(office.logo)} alt={officeName} className="h-6 w-6 rounded object-cover" />
            ) : (
              <div className="h-6 w-6 rounded flex items-center justify-center text-xs font-black" style={{ background: `${gold}20`, color: gold }}>{(officeName || "م")[0]}</div>
            )}
            <span className="font-bold text-sm">{officeName}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" style={{ color: gold }} />
            <span className="text-xs font-bold">{lang === "ar" ? "المتجر القانوني" : "Legal Store"}</span>
            <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
              className="text-xs px-2 py-1 rounded border border-white/20 font-bold mr-2" style={{ color: gold }}>
              {lang === "ar" ? "EN" : "ع"}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative py-12 text-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 50% -20%, ${gold}12 0%, transparent 60%)` }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full mb-3" style={{ background: `${gold}15`, color: gold }}>
            <ShoppingBag className="h-3.5 w-3.5" /> {lang === "ar" ? "المتجر القانوني" : "Legal Store"}
          </div>
          <h1 className="text-3xl font-black mb-2">{lang === "ar" ? "الخدمات القانونية" : "Legal Services"}</h1>
          <p className="text-white/50 text-sm">{officeName}</p>
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-white/35">
            <BadgeCheck className="h-3.5 w-3.5" />
            {lang === "ar" ? `${services.length} خدمة متاحة` : `${services.length} services available`}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-20">

        {/* Success banner */}
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">✓</div>
            <div>
              <p className="font-bold text-emerald-300 text-sm">{lang === "ar" ? "تم إرسال طلبك بنجاح!" : "Your request was sent!"}</p>
              <p className="text-emerald-400/70 text-xs">{lang === "ar" ? "سيتواصل معك المكتب قريباً" : "The office will contact you soon"}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === "ar" ? "ابحث عن خدمة..." : "Search services..."}
            className="sm:max-w-xs bg-white/5 border-white/10"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cats.map((cat, i) => (
              <button key={cat} onClick={() => setActiveCategory(i)}
                className={cn("shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all font-medium",
                  activeCategory === i
                    ? "text-black border-transparent"
                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                )}
                style={activeCategory === i ? { background: gold, borderColor: gold } : {}}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Services grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>{lang === "ar" ? "لا توجد خدمات مطابقة" : "No services found"}</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((svc: any) => {
              const name = t(svc.name, svc.nameEn, lang);
              const desc = t(svc.description, svc.descriptionEn, lang);
              return (
                <div key={svc.id} className="p-5 rounded-2xl bg-white/4 border border-white/8 hover:bg-white/6 hover:border-white/15 transition-all flex flex-col group">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-sm leading-snug">{name}</h3>
                    <Badge className="text-[9px] shrink-0 bg-white/5 text-white/40 border-white/10 mr-2">{svc.category}</Badge>
                  </div>
                  {desc && <p className="text-xs text-white/50 mb-3 flex-1">{desc}</p>}
                  {svc.deliveryDays > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-white/35 mb-3">
                      <Clock className="h-3 w-3" />
                      {lang === "ar" ? `التسليم خلال ${svc.deliveryDays} يوم` : `Delivery in ${svc.deliveryDays} day(s)`}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-white/8 mt-auto">
                    <span className="font-black text-xl" style={{ color: gold }}>
                      {svc.isCustomQuote
                        ? <span className="text-sm font-bold">{lang === "ar" ? "حسب العرض" : "Custom Quote"}</span>
                        : `${Number(svc.price).toLocaleString()} ${lang === "ar" ? "ر.س" : "SAR"}`
                      }
                    </span>
                    <div className="flex gap-2">
                      {whatsappBase && (
                        <a href={`https://wa.me/${whatsappBase}?text=${encodeURIComponent(lang === "ar" ? `أريد الاستفسار عن: ${name}` : `I'd like to inquire about: ${name}`)}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button size="sm" className="text-xs font-bold gap-1" style={{ background: gold, color: "#000" }}
                        onClick={() => { setOrderDialog(svc); setOrderForm({ clientName: "", clientPhone: "", clientEmail: "", notes: "" }); }}>
                        {svc.isCustomQuote ? (lang === "ar" ? "اطلب عرض" : "Get Quote") : (lang === "ar" ? "اطلب الآن" : "Order")}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* WhatsApp CTA */}
        {whatsappBase && (
          <div className="mt-12 p-6 rounded-3xl text-center" style={{ background: `${gold}08`, border: `1px solid ${gold}20` }}>
            <MessageCircle className="h-8 w-8 mx-auto mb-3 text-emerald-400" />
            <h3 className="font-black text-lg mb-1">{lang === "ar" ? "تحتاج مساعدة؟" : "Need Help?"}</h3>
            <p className="text-white/50 text-sm mb-4">{lang === "ar" ? "تواصل مع المكتب مباشرة عبر واتساب للحصول على استشارة فورية" : "Contact the office directly via WhatsApp for instant consultation"}</p>
            <a href={`https://wa.me/${whatsappBase}`} target="_blank" rel="noreferrer">
              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6">
                <MessageCircle className="h-4 w-4" />
                {lang === "ar" ? "تواصل الآن" : "Contact Now"}
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* Order dialog */}
      <Dialog open={!!orderDialog} onOpenChange={() => setOrderDialog(null)}>
        <DialogContent className="max-w-md" dir={lang === "ar" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{orderDialog?.isCustomQuote ? (lang === "ar" ? "طلب عرض سعر" : "Request Quote") : t(orderDialog?.name, orderDialog?.nameEn, lang)}</DialogTitle>
          </DialogHeader>
          {orderDialog && (
            <div className="space-y-3">
              {!orderDialog.isCustomQuote && orderDialog.price && (
                <div className="p-3 rounded-xl text-center" style={{ background: `${gold}10`, border: `1px solid ${gold}25` }}>
                  <span className="text-2xl font-black" style={{ color: gold }}>{Number(orderDialog.price).toLocaleString()} {lang === "ar" ? "ر.س" : "SAR"}</span>
                </div>
              )}
              <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "الاسم *" : "Name *"}</Label>
                <Input value={orderForm.clientName} onChange={e => setOrderForm(f => ({ ...f, clientName: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "الجوال *" : "Phone *"}</Label>
                <Input value={orderForm.clientPhone} onChange={e => setOrderForm(f => ({ ...f, clientPhone: e.target.value }))} dir="ltr" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
                <Input value={orderForm.clientEmail} onChange={e => setOrderForm(f => ({ ...f, clientEmail: e.target.value }))} dir="ltr" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">{lang === "ar" ? "تفاصيل" : "Details"}</Label>
                <Textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="resize-none" /></div>
              <Button className="w-full gap-2 font-bold" style={{ background: gold, color: "#000" }}
                disabled={!orderForm.clientName || !orderForm.clientPhone || orderMutation.isPending}
                onClick={() => orderMutation.mutate()}>
                {orderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {lang === "ar" ? "تأكيد الطلب" : "Confirm Order"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating WhatsApp */}
      {whatsappBase && (
        <a href={`https://wa.me/${whatsappBase}`} target="_blank" rel="noreferrer"
          className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center shadow-xl shadow-emerald-500/30">
          <MessageCircle className="h-7 w-7 text-white" />
        </a>
      )}
    </div>
  );
}
