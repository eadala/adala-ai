import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import {
  Phone, Mail, MapPin, MessageCircle, Star, Twitter, Linkedin,
  Clock, BadgeCheck, Award, Users, Briefcase, ShoppingBag,
  Send, CheckCircle2, Loader2, Scale, Menu, X, FileText,
  Shield, Trophy, ArrowLeft, Quote, Gavel, Home, Building,
  Car, Heart, DollarSign, ChevronDown, ChevronRight,
  Instagram, Facebook, Globe, Calendar, Sparkles, Zap,
  ArrowRight, Play, ChevronLeft, LogIn, UserCheck, Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════════════ */
type Lang = "ar" | "en";
const t = (ar: string | null | undefined, en: string | null | undefined, lang: Lang) =>
  lang === "en" && en ? en : ar ?? "";
const imgSrc = (path: string | null | undefined) => {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `/api/storage/objects${path.startsWith("/") ? path : "/" + path}`;
};
const toWaNum = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00966")) return d.slice(2);
  if (d.startsWith("966")) return d;
  if (d.startsWith("0")) return "966" + d.slice(1);
  return d.length <= 9 ? "966" + d : d;
};

const CAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  استشارات: Scale, عقود: FileText, دعاوى: Gavel, توثيق: BadgeCheck,
  تحكيم: Shield, "أحوال شخصية": Heart, تجاري: Briefcase,
  عقاري: Home, جنائي: Trophy, مرور: Car, عمالي: Users, إداري: Building,
};

/* ── Theme: derive from primaryColor ──────────────────────────── */
function useTheme(primaryColor: string | null | undefined) {
  const c = primaryColor ?? "#1A56DB";
  return { c, cLight: `${c}15`, cBorder: `${c}30`, cGlow: `${c}40` };
}

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════════ */

/* Animated number counter */
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        observer.disconnect();
        let start = 0;
        const step = () => {
          start += Math.ceil(target / 40);
          if (start >= target) { setVal(target); return; }
          setVal(start);
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{val.toLocaleString("ar-SA")}{suffix}</span>;
}

/* Star display */
function Stars({ n, size = "h-4 w-4", color = "#FBBF24" }: { n: number; size?: string; color?: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn(size, i < n ? "fill-current" : "opacity-20")}
          style={{ color }} />
      ))}
    </div>
  );
}

/* Service card — premium bento style */
function ServiceCard({ svc, lang, theme, slug, onOrder, onNegotiate }: {
  svc: any; lang: Lang; theme: ReturnType<typeof useTheme>;
  slug: string; onOrder: () => void; onNegotiate?: () => void;
}) {
  const { c, cLight, cBorder } = theme;
  const Icon = CAT_ICONS[svc.category] ?? Scale;
  const name = t(svc.name, svc.nameEn, lang);
  const desc = t(svc.description, svc.descriptionEn, lang);
  return (
    <div className="group relative flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all duration-300">
      {/* top accent line */}
      <div className="h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-t-full" style={{ background: c }} />
      <div className="p-6 flex flex-col flex-1">
        {/* icon + category */}
        <div className="flex items-start justify-between mb-4">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: cLight, color: c }}>
            <Icon className="h-5 w-5" />
          </div>
          {svc.category && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: cLight, color: c }}>
              {svc.category}
            </span>
          )}
        </div>

        <h3 className="font-bold text-slate-900 mb-2 leading-snug">{name}</h3>
        {desc && <p className="text-sm text-slate-500 mb-4 flex-1 leading-relaxed line-clamp-2">{desc}</p>}

        {svc.deliveryDays > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
            <Clock className="h-3 w-3" />
            {lang === "ar" ? `تسليم خلال ${svc.deliveryDays} يوم` : `${svc.deliveryDays}-day delivery`}
          </div>
        )}

        {/* price + actions */}
        <div className="pt-4 border-t border-slate-100 mt-auto">
          <div className="flex items-center justify-between mb-3">
            {svc.isCustomQuote ? (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-500">
                  {lang === "ar" ? "سعر حسب الطلب" : "Custom Quote"}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-2xl font-black" style={{ color: c }}>
                  {Number(svc.price).toLocaleString("ar-SA")}
                </span>
                <span className="text-xs text-slate-400 mr-1">{lang === "ar" ? " ر.س" : " SAR"}</span>
              </div>
            )}
            <a href={`/firms/${slug}/service/${svc.id}`}
              className="text-xs font-semibold hover:underline" style={{ color: c }}>
              {lang === "ar" ? "التفاصيل" : "Details"}
            </a>
          </div>

          <div className="flex gap-2">
            {onNegotiate && !svc.isCustomQuote && (
              <button onClick={onNegotiate}
                className="flex-1 py-2 rounded-lg text-xs font-bold border transition-all hover:opacity-80"
                style={{ borderColor: cBorder, color: c, background: cLight }}>
                {lang === "ar" ? "تفاوض" : "Negotiate"}
              </button>
            )}
            <button onClick={onOrder}
              className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 shadow-sm"
              style={{ background: c }}>
              {svc.isCustomQuote
                ? (lang === "ar" ? "اطلب عرضاً" : "Get Quote")
                : (lang === "ar" ? "اطلب الآن" : "Order Now")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Team member card */
function TeamCard({ m, lang, theme }: { m: any; lang: Lang; theme: ReturnType<typeof useTheme> }) {
  const { c, cLight } = theme;
  const name = t(m.name, m.nameEn, lang);
  const role = t(m.title ?? m.role, m.titleEn ?? m.roleEn, lang);
  const bio = t(m.bio, m.bioEn, lang);
  const photo = imgSrc(m.photoUrl ?? m.photo);
  return (
    <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-slate-300 transition-all duration-300">
      {/* Photo area */}
      <div className="relative h-48 overflow-hidden" style={{ background: cLight }}>
        {photo ? (
          <img src={photo} alt={name} className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="h-20 w-20 rounded-full flex items-center justify-center text-3xl font-black"
              style={{ background: `${c}25`, color: c }}>{(name || "م")[0]}</div>
          </div>
        )}
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>
      <div className="p-5">
        <h3 className="font-bold text-slate-900 mb-0.5">{name}</h3>
        {role && <p className="text-xs font-semibold mb-2" style={{ color: c }}>{role}</p>}
        {m.specialties && (
          <p className="text-xs text-slate-400 mb-3 leading-relaxed">{m.specialties}</p>
        )}
        {bio && <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{bio}</p>}
        {(m.linkedin || m.twitter) && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
            {m.linkedin && (
              <a href={m.linkedin} target="_blank" rel="noreferrer"
                className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-blue-50 transition-colors">
                <Linkedin className="h-3.5 w-3.5 text-blue-500" />
              </a>
            )}
            {m.twitter && (
              <a href={m.twitter} target="_blank" rel="noreferrer"
                className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-sky-50 transition-colors">
                <Twitter className="h-3.5 w-3.5 text-sky-500" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Review card */
function ReviewCard({ r, theme }: { r: any; theme: ReturnType<typeof useTheme> }) {
  const { c, cLight } = theme;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-all">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
          style={{ background: cLight, color: c }}>
          {(r.clientName || "م")[0]}
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-slate-900">{r.clientName || "عميل"}</p>
          <Stars n={r.rating} size="h-3.5 w-3.5" color={c} />
        </div>
        <Quote className="h-6 w-6 text-slate-200 shrink-0" />
      </div>
      {r.comment && <p className="text-sm text-slate-600 leading-relaxed">{r.comment}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DIALOGS
═══════════════════════════════════════════════════════════════════ */
function OrderDialog({
  svc, slug, lang, theme, onClose,
}: { svc: any; slug: string; lang: Lang; theme: ReturnType<typeof useTheme>; onClose: () => void }) {
  const { c, cLight } = theme;
  const [form, setForm] = useState({ clientName: "", clientPhone: "", clientEmail: "", notes: "" });
  const [done, setDone] = useState(false);
  const name = t(svc.name, svc.nameEn, lang);

  const mut = useMutation({
    mutationFn: async () => {
      if (svc.price && !svc.isCustomQuote) {
        const r = await fetch(`/api/office/public/${slug}/checkout`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId: svc.id, ...form }),
        });
        const d = await r.json();
        if (d.url) { window.location.href = d.url; return; }
      }
      await fetch(`/api/office/public/${slug}/order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: svc.id, ...form, isQuoteRequest: svc.isCustomQuote }),
      });
      setDone(true);
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="font-black text-lg">
            {svc.isCustomQuote ? (lang === "ar" ? "طلب عرض سعر" : "Request Quote") : (lang === "ar" ? "طلب الخدمة" : "Order Service")}
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="text-center py-8">
            <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: cLight }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: c }} />
            </div>
            <h3 className="font-black text-lg mb-2">{lang === "ar" ? "تم الإرسال بنجاح!" : "Request Sent!"}</h3>
            <p className="text-sm text-slate-500">{lang === "ar" ? "سيتواصل معك المكتب قريباً" : "The office will contact you shortly"}</p>
            <Button className="mt-6 w-full font-bold" onClick={onClose} style={{ background: c }}>
              {lang === "ar" ? "حسناً" : "OK"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl flex items-center gap-3" style={{ background: cLight }}>
              {svc.isCustomQuote ? (
                <DollarSign className="h-5 w-5" style={{ color: c }} />
              ) : (
                <ShoppingBag className="h-5 w-5" style={{ color: c }} />
              )}
              <div>
                <p className="font-bold text-sm">{name}</p>
                {!svc.isCustomQuote && svc.price && (
                  <p className="text-xs text-slate-500">{Number(svc.price).toLocaleString("ar-SA")} {lang === "ar" ? "ر.س" : "SAR"}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">{lang === "ar" ? "الاسم *" : "Name *"}</Label>
                <Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                  placeholder={lang === "ar" ? "اسمك الكامل" : "Full name"} />
              </div>
              <div>
                <Label className="text-xs mb-1 block">{lang === "ar" ? "الجوال *" : "Phone *"}</Label>
                <Input value={form.clientPhone} onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))}
                  dir="ltr" placeholder="05XXXXXXXX" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">{lang === "ar" ? "البريد (اختياري)" : "Email (optional)"}</Label>
              <Input value={form.clientEmail} onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
                dir="ltr" type="email" placeholder="email@domain.com" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">{lang === "ar" ? "ملاحظاتك" : "Notes"}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder={lang === "ar" ? "تفاصيل إضافية..." : "Additional details..."} className="resize-none" />
            </div>
            <Button className="w-full font-bold gap-2 text-white" onClick={() => mut.mutate()}
              disabled={mut.isPending || !form.clientName || !form.clientPhone}
              style={{ background: c }}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {svc.isCustomQuote ? (lang === "ar" ? "أرسل طلب العرض" : "Send Quote Request") : (lang === "ar" ? "أرسل الطلب" : "Submit Order")}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ slug, lang, theme, onClose }: {
  slug: string; lang: Lang; theme: ReturnType<typeof useTheme>; onClose: () => void;
}) {
  const { c, cLight } = theme;
  const [form, setForm] = useState({ clientName: "", rating: 5, comment: "" });
  const [done, setDone] = useState(false);
  const mut = useMutation({
    mutationFn: () => fetch(`/api/office/public/${slug}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => setDone(true),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir={lang === "ar" ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{lang === "ar" ? "أضف تقييمك" : "Add Your Review"}</DialogTitle>
        </DialogHeader>
        {done ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3" style={{ color: c }} />
            <p className="font-bold">{lang === "ar" ? "شكراً لتقييمك!" : "Thank you for your review!"}</p>
            <p className="text-xs text-slate-400 mt-1">{lang === "ar" ? "سيُراجع التقييم قبل النشر" : "Your review will be moderated before publishing"}</p>
            <Button className="mt-4 w-full" onClick={onClose} style={{ background: c }}>
              {lang === "ar" ? "حسناً" : "Done"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs mb-1 block">{lang === "ar" ? "اسمك" : "Your Name"}</Label>
              <Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs mb-2 block">{lang === "ar" ? "تقييمك" : "Rating"}</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => setForm(f => ({ ...f, rating: n }))}
                    className="transition-transform hover:scale-110">
                    <Star className={cn("h-7 w-7", n <= form.rating ? "fill-current" : "opacity-20")}
                      style={{ color: c }} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">{lang === "ar" ? "تعليقك" : "Comment"}</Label>
              <Textarea value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
                rows={3} className="resize-none" />
            </div>
            <Button className="w-full font-bold text-white" onClick={() => mut.mutate()}
              disabled={mut.isPending || !form.clientName} style={{ background: c }}>
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : lang === "ar" ? "أرسل التقييم" : "Submit Review"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function OfficePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [, navigate] = useLocation();
  const search = useSearch();
  const sp = new URLSearchParams(search);
  const paidSession = sp.get("session") ?? "";
  const isPaid = sp.get("paid") === "1";

  const [lang, setLang] = useState<Lang>("ar");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [orderDialog, setOrderDialog] = useState<any>(null);
  const [dealDialog, setDealDialog] = useState<any>(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [filterCat, setFilterCat] = useState("الكل");
  const [showAllSvc, setShowAllSvc] = useState(false);
  const [reviewPage, setReviewPage] = useState(0);
  const [loginMenu, setLoginMenu] = useState(false);
  const loginMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loginMenu) return;
    const handler = (e: MouseEvent) => {
      if (loginMenuRef.current && !loginMenuRef.current.contains(e.target as Node)) setLoginMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [loginMenu]);

  const heroRef    = useRef<HTMLElement>(null);
  const aboutRef   = useRef<HTMLElement>(null);
  const servicesRef= useRef<HTMLElement>(null);
  const teamRef    = useRef<HTMLElement>(null);
  const reviewsRef = useRef<HTMLElement>(null);
  const contactRef = useRef<HTMLElement>(null);

  /* scroll spy */
  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 70);
      const refs = [
        { id: "hero", ref: heroRef }, { id: "about", ref: aboutRef },
        { id: "services", ref: servicesRef }, { id: "team", ref: teamRef },
        { id: "reviews", ref: reviewsRef }, { id: "contact", ref: contactRef },
      ];
      for (const { id, ref } of [...refs].reverse()) {
        if (ref.current && window.scrollY >= ref.current.offsetTop - 140) {
          setActiveSection(id); break;
        }
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollTo = useCallback((ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenu(false);
  }, []);

  /* Queries */
  const { data: orderSuccess } = useQuery<any>({
    queryKey: ["order-success", paidSession],
    queryFn: () => fetch(`/api/office/public/${slug}/order-success?sessionId=${paidSession}`).then(r => r.json()),
    enabled: isPaid && !!paidSession,
    refetchInterval: (d) => (!d?.state?.data || d.state.data.status === "pending" ? 3000 : false),
    staleTime: Infinity, retry: 5,
  });

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["office-public", slug],
    queryFn: () => fetch(`/api/office/public/${slug}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
  });

  /* ── Payment success screen ── */
  if (isPaid && paidSession) {
    const ready = orderSuccess && orderSuccess.status !== "pending";
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4" dir="rtl">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center">
          {!ready ? (
            <>
              <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-black mb-2">جاري معالجة طلبك...</h1>
              <p className="text-slate-500 text-sm">تم استلام الدفع — نُعِدّ ملفك الإلكتروني</p>
            </>
          ) : (
            <>
              <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-black mb-2">
                {orderSuccess.clientName ? `مرحباً ${orderSuccess.clientName}!` : "تم الدفع بنجاح! ✅"}
              </h1>
              <p className="text-slate-600 text-sm mb-6">سيتواصل فريق المكتب معك في أقرب وقت</p>
              {orderSuccess.portalUrl && (
                <a href={orderSuccess.portalUrl} target="_blank" rel="noreferrer"
                  className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl mb-3 transition-colors">
                  🔗 بوابتك الإلكترونية الخاصة
                </a>
              )}
              <button onClick={() => navigate(`/firms/${slug}`)} className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
                العودة لصفحة المكتب
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="h-20 w-20 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Scale className="h-10 w-10 text-blue-400" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-blue-600 mx-auto" />
      </div>
    </div>
  );

  /* ── Not found ── */
  if (isError || !data?.office) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-center px-6" dir="rtl">
      <div>
        <Scale className="h-16 w-16 mx-auto mb-6 text-slate-200" />
        <h1 className="text-3xl font-black mb-3 text-slate-800">المكتب غير موجود</h1>
        <p className="text-slate-500 text-sm mb-6">تحقق من الرابط أو تواصل مع المكتب مباشرةً</p>
        <Button variant="outline" onClick={() => navigate("/")}>العودة للرئيسية</Button>
      </div>
    </div>
  );

  const { office, services = [], team = [], reviews = [], articles = [] } = data;
  const theme = useTheme(office.primaryColor);
  const { c, cLight, cBorder, cGlow } = theme;
  const avgRating = reviews.length
    ? +(reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length).toFixed(1)
    : 0;
  const officeName = t(office.name, office.nameEn, lang);
  const tagline    = t(office.tagline, office.taglineEn, lang);
  const about      = t(office.about, office.aboutEn, lang);
  const dir        = lang === "ar" ? "rtl" : "ltr";

  const whatsappUrl = (msg?: string) => {
    const num = toWaNum(office.whatsapp ?? office.phone ?? "");
    const text = encodeURIComponent(msg ?? `مرحباً، أود الاستفسار عن خدمات ${officeName}`);
    return `https://wa.me/${num}?text=${text}`;
  };

  const navItems = [
    { id: "about",    label: lang === "ar" ? "من نحن"  : "About",    ref: aboutRef },
    { id: "services", label: lang === "ar" ? "الخدمات" : "Services", ref: servicesRef },
    ...(team.length    ? [{ id: "team",    label: lang === "ar" ? "الفريق"  : "Team",    ref: teamRef    }] : []),
    ...(reviews.length ? [{ id: "reviews", label: lang === "ar" ? "التقييمات" : "Reviews", ref: reviewsRef }] : []),
    { id: "contact",  label: lang === "ar" ? "تواصل"   : "Contact",  ref: contactRef },
  ];

  const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const cats = ["الكل", ...Array.from(new Set(services.map((s: any) => s.category).filter(Boolean)))];
  const filtered = filterCat === "الكل" ? services : services.filter((s: any) => s.category === filterCat);
  const visibleSvc = showAllSvc ? filtered : filtered.slice(0, 6);
  const REVIEWS_PER = 6;
  const reviewPages = Math.ceil(reviews.length / REVIEWS_PER);
  const visibleReviews = reviews.slice(reviewPage * REVIEWS_PER, (reviewPage + 1) * REVIEWS_PER);

  const hasStats = office.showStats && (
    office.experienceYears > 0 || office.casesCount > 0 || office.clientsCount > 0 || office.successRate > 0
  );

  return (
    <div className="min-h-screen bg-[#F7F8FC]" dir={dir}
      style={{ fontFamily: lang === "ar" ? "'Cairo', 'Tajawal', sans-serif" : "system-ui, sans-serif" }}>

      {/* ── DRAFT BANNER ── */}
      {!office.isPublished && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-amber-400 text-black text-center py-2.5 text-sm font-bold">
          ⚠️ {lang === "ar" ? "وضع المعاينة — غير مرئي للعملاء حتى النشر" : "Preview mode — not visible to clients until published"}
        </div>
      )}

      {/* ══════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════ */}
      <nav className={cn(
        "fixed inset-x-0 z-50 transition-all duration-300",
        !office.isPublished && "top-10",
        scrolled
          ? "top-0 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200"
          : "top-0 bg-white/80 backdrop-blur"
      )}>
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          {/* Logo + name */}
          <div className="flex items-center gap-3 shrink-0">
            {office.logo ? (
              <img src={imgSrc(office.logo)} alt={officeName}
                className="h-9 w-9 rounded-xl object-cover ring-1 ring-slate-200" />
            ) : (
              <div className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-black"
                style={{ background: cLight, color: c }}>
                {(officeName || "م")[0]}
              </div>
            )}
            <span className="font-black text-slate-900 text-sm tracking-tight hidden sm:block">
              {officeName}
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.ref)}
                className={cn(
                  "text-xs font-semibold px-3 py-2 rounded-lg transition-all",
                  activeSection === item.id
                    ? "font-bold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                )}
                style={activeSection === item.id ? { color: c, background: cLight } : {}}>
                {item.label}
              </button>
            ))}
          </div>

          {/* CTA + lang */}
          <div className="hidden md:flex items-center gap-2">
            {(office.whatsapp || office.phone) && (
              <a href={whatsappUrl()} target="_blank" rel="noreferrer">
                <button className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors border border-emerald-200">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {lang === "ar" ? "واتساب" : "WhatsApp"}
                </button>
              </a>
            )}
            {/* Store link */}
            <a href={`/firms/${slug}/store`}>
              <button className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-bold border transition-colors hover:opacity-80"
                style={{ background: `${c}12`, color: c, borderColor: `${c}30` }}>
                <Store className="h-3.5 w-3.5" />
                {lang === "ar" ? "المتجر" : "Store"}
              </button>
            </a>
            {/* Login dropdown */}
            <div className="relative" ref={loginMenuRef}>
              <button
                onClick={() => setLoginMenu(v => !v)}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
              >
                <LogIn className="h-3.5 w-3.5" />
                {lang === "ar" ? "دخول" : "Login"}
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${loginMenu ? "rotate-180" : ""}`} />
              </button>
              {loginMenu && (
                <div className="absolute top-10 left-0 z-50 bg-white rounded-xl shadow-xl border border-slate-100 p-1 min-w-[180px] animate-in slide-in-from-top-1 fade-in-0 duration-150">
                  <a
                    href={`${BASE_URL}/sign-in`}
                    onClick={() => setLoginMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c}15` }}>
                      <UserCheck className="h-4 w-4" style={{ color: c }} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{lang === "ar" ? "دخول الموظفين" : "Staff Login"}</div>
                      <div className="text-[10px] text-slate-400">{lang === "ar" ? "للمحامين والإداريين" : "For lawyers & staff"}</div>
                    </div>
                  </a>
                  <a
                    href={`${BASE_URL}/portal/login?office=${slug}`}
                    onClick={() => setLoginMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-50">
                      <Users className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{lang === "ar" ? "بوابة العملاء" : "Client Portal"}</div>
                      <div className="text-[10px] text-slate-400">{lang === "ar" ? "متابعة القضايا والفواتير" : "Track cases & invoices"}</div>
                    </div>
                  </a>
                </div>
              )}
            </div>
            <a href={`/firms/${slug}/book`}>
              <button className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: c }}>
                <Calendar className="h-3.5 w-3.5" />
                {lang === "ar" ? "احجز استشارة" : "Book Now"}
              </button>
            </a>
            <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
              className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 font-bold text-slate-500 hover:border-slate-300 transition-colors">
              {lang === "ar" ? "EN" : "ع"}
            </button>
          </div>

          {/* Mobile */}
          <div className="flex items-center gap-2 md:hidden">
            <button onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
              className="text-xs px-2 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-500">
              {lang === "ar" ? "EN" : "ع"}
            </button>
            <button onClick={() => setMobileMenu(v => !v)} className="p-1.5 text-slate-600 hover:text-slate-900">
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-slate-100 px-5 py-4 space-y-1">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollTo(item.ref)}
                className="flex items-center gap-2 w-full text-sm py-2.5 px-3 rounded-xl text-slate-600 hover:bg-slate-50">
                <ChevronLeft className={cn("h-3.5 w-3.5", lang === "en" && "rotate-180")} style={{ color: c }} />
                {item.label}
              </button>
            ))}
            <div className="flex gap-2 pt-2">
              {(office.whatsapp || office.phone) && (
                <a href={whatsappUrl()} target="_blank" rel="noreferrer" className="flex-1">
                  <button className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {lang === "ar" ? "واتساب" : "WhatsApp"}
                  </button>
                </a>
              )}
              <a href={`/firms/${slug}/book`} className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl font-bold text-white"
                  style={{ background: c }}>
                  <Calendar className="h-3.5 w-3.5" />
                  {lang === "ar" ? "احجز" : "Book"}
                </button>
              </a>
            </div>
            {/* Mobile: Store + Login */}
            <div className="flex gap-2 pt-1">
              <a href={`/firms/${slug}/store`} className="flex-1">
                <button className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl font-bold border"
                  style={{ background: `${c}10`, color: c, borderColor: `${c}25` }}>
                  <Store className="h-3.5 w-3.5" />
                  {lang === "ar" ? "المتجر" : "Store"}
                </button>
              </a>
              <div className="flex-1 space-y-1">
                <a href={`${BASE_URL}/sign-in`} className="block">
                  <button className="w-full flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg font-bold border border-slate-200 bg-white text-slate-700">
                    <UserCheck className="h-3 w-3" />
                    {lang === "ar" ? "دخول الموظفين" : "Staff"}
                  </button>
                </a>
                <a href={`${BASE_URL}/portal/login?office=${slug}`} className="block">
                  <button className="w-full flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Users className="h-3 w-3" />
                    {lang === "ar" ? "بوابة العملاء" : "Clients"}
                  </button>
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════
          HERO — full screen
      ══════════════════════════════════════════ */}
      <section ref={heroRef} id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          {office.coverImage ? (
            <>
              <img src={imgSrc(office.coverImage)} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
            </>
          ) : (
            <>
              <div className="absolute inset-0 bg-slate-950" />
              {/* geometric pattern */}
              <div className="absolute inset-0 opacity-[0.04]"
                style={{ backgroundImage: `repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)`, backgroundSize: "24px 24px" }} />
              {/* glow blobs */}
              <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20"
                style={{ background: c }} />
              <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[80px] opacity-10"
                style={{ background: c }} />
            </>
          )}
        </div>

        {/* Content */}
        <div className="relative max-w-5xl mx-auto px-6 pt-28 pb-24 text-center text-white">
          {/* Logo */}
          <div className="mb-8">
            {office.logo ? (
              <div className="relative inline-block">
                <div className="absolute inset-0 blur-2xl opacity-40 rounded-3xl" style={{ background: c }} />
                <img src={imgSrc(office.logo)} alt={officeName}
                  className="relative h-28 w-28 rounded-3xl object-cover mx-auto shadow-2xl ring-2 ring-white/20" />
              </div>
            ) : (
              <div className="h-28 w-28 rounded-3xl mx-auto flex items-center justify-center text-5xl font-black shadow-2xl ring-2 ring-white/10"
                style={{ background: `${c}40`, backdropFilter: "blur(8px)" }}>
                {(officeName || "م")[0]}
              </div>
            )}
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {office.licenseNumber && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold bg-white/10 backdrop-blur border border-white/20">
                <BadgeCheck className="h-3.5 w-3.5" style={{ color: c }} />
                {lang === "ar" ? `مرخّص · ${office.licenseNumber}` : `Licensed · ${office.licenseNumber}`}
              </span>
            )}
            {office.city && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold bg-white/10 backdrop-blur border border-white/20">
                <MapPin className="h-3 w-3" /> {office.city}
              </span>
            )}
            {avgRating > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-bold bg-white/10 backdrop-blur border border-white/20">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                {avgRating} ({reviews.length})
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-black mb-5 leading-tight tracking-tight drop-shadow-xl">
            {officeName}
          </h1>
          {tagline && (
            <p className="text-lg md:text-xl text-white/75 mb-10 max-w-2xl mx-auto leading-relaxed">
              {tagline}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 justify-center mb-12">
            <a href={`/firms/${slug}/book`}>
              <button className="flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-base shadow-2xl hover:opacity-90 transition-all hover:scale-105"
                style={{ background: c, color: "#fff" }}>
                <Calendar className="h-5 w-5" />
                {lang === "ar" ? "احجز استشارتك" : "Book a Consultation"}
              </button>
            </a>
            {(office.whatsapp || office.phone) && (
              <a href={whatsappUrl()} target="_blank" rel="noreferrer">
                <button className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-base bg-emerald-600 hover:bg-emerald-700 transition-all hover:scale-105 shadow-xl">
                  <MessageCircle className="h-5 w-5" />
                  {lang === "ar" ? "تواصل عبر واتساب" : "WhatsApp Us"}
                </button>
              </a>
            )}
            {services.length > 0 && (
              <button onClick={() => scrollTo(servicesRef)}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-base bg-white/10 backdrop-blur hover:bg-white/20 transition-all border border-white/20">
                <ShoppingBag className="h-5 w-5" />
                {lang === "ar" ? "الخدمات القانونية" : "Our Services"}
              </button>
            )}
          </div>

          {/* scroll indicator */}
          <div className="flex flex-col items-center gap-2 opacity-40 animate-bounce">
            <span className="text-xs">{lang === "ar" ? "اكتشف المزيد" : "Explore"}</span>
            <ChevronDown className="h-5 w-5" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS BAR
      ══════════════════════════════════════════ */}
      {hasStats && (
        <div className="bg-white border-y border-slate-200 py-10">
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {office.experienceYears > 0 && (
              <div>
                <div className="h-12 w-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: cLight, color: c }}>
                  <Award className="h-5 w-5" />
                </div>
                <div className="text-3xl font-black" style={{ color: c }}>
                  <Counter target={office.experienceYears} suffix="+" />
                </div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">{lang === "ar" ? "سنة خبرة" : "Years Exp."}</div>
              </div>
            )}
            {office.casesCount > 0 && (
              <div>
                <div className="h-12 w-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: cLight, color: c }}>
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="text-3xl font-black" style={{ color: c }}>
                  <Counter target={office.casesCount} />
                </div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">{lang === "ar" ? "قضية منجزة" : "Cases Handled"}</div>
              </div>
            )}
            {office.clientsCount > 0 && (
              <div>
                <div className="h-12 w-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: cLight, color: c }}>
                  <Users className="h-5 w-5" />
                </div>
                <div className="text-3xl font-black" style={{ color: c }}>
                  <Counter target={office.clientsCount} />
                </div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">{lang === "ar" ? "عميل موثوق" : "Clients"}</div>
              </div>
            )}
            {office.successRate > 0 && (
              <div>
                <div className="h-12 w-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: cLight, color: c }}>
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="text-3xl font-black" style={{ color: c }}>
                  <Counter target={office.successRate} suffix="%" />
                </div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">{lang === "ar" ? "نسبة النجاح" : "Success Rate"}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════ */}
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-20 space-y-28">

        {/* ── ABOUT ── */}
        <section ref={aboutRef} id="about">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image side */}
            <div className={cn("relative", lang === "en" && "order-2")}>
              {(office.coverImage || office.logo) ? (
                <div className="relative">
                  <div className="absolute -inset-4 rounded-3xl blur-2xl opacity-15" style={{ background: c }} />
                  <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl border"
                    style={{ borderColor: cBorder, background: cLight }} />
                  <img src={imgSrc(office.coverImage ?? office.logo)} alt={officeName}
                    className="relative w-full h-[380px] object-cover rounded-3xl shadow-xl ring-1 ring-slate-200" />
                  {/* floating badge */}
                  <div className="absolute bottom-5 left-5 bg-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: cLight, color: c }}>
                      <Scale className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{lang === "ar" ? "مكتب محاماة معتمد" : "Certified Law Firm"}</p>
                      <p className="text-[10px] text-slate-400">{lang === "ar" ? "وزارة العدل" : "Ministry of Justice"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-[380px] rounded-3xl flex items-center justify-center border-2 border-dashed"
                  style={{ borderColor: cBorder, background: cLight }}>
                  <div className="text-center">
                    <Scale className="h-20 w-20 mx-auto mb-4 opacity-20" style={{ color: c }} />
                    <p className="text-xs text-slate-400">{lang === "ar" ? "مكتب محاماة" : "Law Office"}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Text side */}
            <div className={cn(lang === "en" && "order-1")}>
              {/* label */}
              <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                style={{ background: cLight, color: c, border: `1px solid ${cBorder}` }}>
                <Scale className="h-3.5 w-3.5" />
                {lang === "ar" ? "من نحن" : "About Us"}
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 leading-tight">
                {officeName}
              </h2>

              {about ? (
                <p className="text-slate-600 leading-loose mb-8 text-base">{about}</p>
              ) : (
                <p className="text-slate-400 leading-loose mb-8 italic text-sm">
                  {lang === "ar"
                    ? "مكتب محاماة متخصص يقدم خدمات قانونية متكاملة بأعلى معايير الكفاءة والمهنية."
                    : "A specialized law firm offering comprehensive legal services to the highest standards."}
                </p>
              )}

              {/* info pills */}
              <div className="space-y-3">
                {office.city && (
                  <div className="flex items-center gap-3 text-sm text-slate-600 p-3.5 rounded-xl bg-white border border-slate-200">
                    <MapPin className="h-4 w-4 shrink-0" style={{ color: c }} />
                    {office.city}{office.regions ? ` — ${office.regions}` : ""}
                  </div>
                )}
                {office.licenseNumber && (
                  <div className="flex items-center gap-3 text-sm text-slate-600 p-3.5 rounded-xl bg-white border border-slate-200">
                    <BadgeCheck className="h-4 w-4 shrink-0" style={{ color: c }} />
                    {lang === "ar" ? `رقم الترخيص: ${office.licenseNumber}` : `License No: ${office.licenseNumber}`}
                  </div>
                )}
                {office.email && (
                  <a href={`mailto:${office.email}`}
                    className="flex items-center gap-3 text-sm text-slate-600 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                    <Mail className="h-4 w-4 shrink-0" style={{ color: c }} />
                    {office.email}
                  </a>
                )}
                {office.phone && (
                  <a href={`tel:${office.phone}`}
                    className="flex items-center gap-3 text-sm text-slate-600 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                    <Phone className="h-4 w-4 shrink-0" style={{ color: c }} />
                    <span dir="ltr">{office.phone}</span>
                  </a>
                )}
              </div>

              {/* social */}
              {(office.twitter || office.linkedin || office.facebook || office.instagram) && (
                <div className="flex gap-2 mt-6">
                  {office.twitter    && <a href={office.twitter}    target="_blank" rel="noreferrer" className="h-10 w-10 rounded-xl flex items-center justify-center bg-white border border-slate-200 hover:border-sky-200 hover:bg-sky-50 transition-all"><Twitter   className="h-4 w-4 text-sky-500"  /></a>}
                  {office.linkedin   && <a href={office.linkedin}   target="_blank" rel="noreferrer" className="h-10 w-10 rounded-xl flex items-center justify-center bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all"><Linkedin   className="h-4 w-4 text-blue-600" /></a>}
                  {office.facebook   && <a href={office.facebook}   target="_blank" rel="noreferrer" className="h-10 w-10 rounded-xl flex items-center justify-center bg-white border border-slate-200 hover:border-blue-100 hover:bg-blue-50 transition-all"><Facebook   className="h-4 w-4 text-blue-700" /></a>}
                  {office.instagram  && <a href={office.instagram}  target="_blank" rel="noreferrer" className="h-10 w-10 rounded-xl flex items-center justify-center bg-white border border-slate-200 hover:border-pink-100 hover:bg-pink-50 transition-all"><Instagram  className="h-4 w-4 text-pink-500" /></a>}
                  {office.website    && <a href={office.website}    target="_blank" rel="noreferrer" className="h-10 w-10 rounded-xl flex items-center justify-center bg-white border border-slate-200 hover:border-slate-300 transition-all"><Globe      className="h-4 w-4 text-slate-500" /></a>}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── LEGAL STORE / SERVICES ── */}
        {services.length > 0 && (
          <section ref={servicesRef} id="services">
            {/* Section header */}
            <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
                  style={{ background: cLight, color: c, border: `1px solid ${cBorder}` }}>
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {lang === "ar" ? "المتجر القانوني" : "Legal Store"}
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900">
                  {lang === "ar" ? "خدماتنا القانونية" : "Our Legal Services"}
                </h2>
                <p className="text-slate-500 mt-3 text-base">
                  {lang === "ar"
                    ? "اطلب الخدمة مباشرة أو تفاوض على السعر — نستجيب خلال 24 ساعة"
                    : "Order directly or negotiate the price — we respond within 24 hours"}
                </p>
              </div>
              <span className="text-sm font-bold px-4 py-2 rounded-full"
                style={{ background: cLight, color: c }}>
                {services.length} {lang === "ar" ? "خدمة" : "services"}
              </span>
            </div>

            {/* Category pills */}
            {cats.length > 2 && (
              <div className="flex gap-2 overflow-x-auto pb-3 mb-8 scrollbar-hide">
                {cats.map((cat: string) => (
                  <button key={cat} onClick={() => { setFilterCat(cat); setShowAllSvc(false); }}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 border transition-all",
                      filterCat === cat
                        ? "text-white border-transparent shadow-sm"
                        : "border-slate-200 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    )}
                    style={filterCat === cat ? { background: c, borderColor: c } : {}}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleSvc.map((svc: any) => (
                <ServiceCard key={svc.id} svc={svc} lang={lang} theme={theme} slug={slug}
                  onOrder={() => setOrderDialog(svc)}
                  onNegotiate={() => setDealDialog(svc)}
                />
              ))}
            </div>

            {filtered.length > 6 && (
              <div className="mt-10 text-center">
                <button onClick={() => setShowAllSvc(v => !v)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold border transition-all hover:bg-white"
                  style={{ borderColor: cBorder, color: c }}>
                  {showAllSvc
                    ? <><ArrowLeft className="h-4 w-4" /> {lang === "ar" ? "عرض أقل" : "Show Less"}</>
                    : <><ShoppingBag className="h-4 w-4" /> {lang === "ar" ? `جميع الخدمات (${filtered.length})` : `All Services (${filtered.length})`} <ChevronDown className="h-4 w-4" /></>}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── TEAM ── */}
        {team.length > 0 && (
          <section ref={teamRef} id="team">
            <div className="mb-10">
              <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
                style={{ background: cLight, color: c, border: `1px solid ${cBorder}` }}>
                <Users className="h-3.5 w-3.5" />
                {lang === "ar" ? "فريق العمل" : "Our Team"}
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900">
                {lang === "ar" ? "كوادرنا القانونية" : "Legal Professionals"}
              </h2>
              <p className="text-slate-500 mt-3 text-base">
                {lang === "ar" ? "فريق من المحامين والمستشارين القانونيين المتخصصين" : "A team of specialized lawyers and legal consultants"}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {team.map((m: any) => (
                <TeamCard key={m.id} m={m} lang={lang} theme={theme} />
              ))}
            </div>
          </section>
        )}

        {/* ── REVIEWS ── */}
        {reviews.length > 0 && (
          <section ref={reviewsRef} id="reviews">
            {/* Header */}
            <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
                  style={{ background: cLight, color: c, border: `1px solid ${cBorder}` }}>
                  <Star className="h-3.5 w-3.5" />
                  {lang === "ar" ? "آراء العملاء" : "Client Reviews"}
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900">
                  {lang === "ar" ? "ماذا يقولون عنا؟" : "What They Say"}
                </h2>
              </div>
              {/* Rating badge */}
              <div className="flex flex-col items-center gap-1 p-5 rounded-2xl bg-white border border-slate-200 shadow-sm min-w-[100px]">
                <span className="text-4xl font-black" style={{ color: c }}>{avgRating}</span>
                <Stars n={Math.round(avgRating)} size="h-4 w-4" color={c} />
                <span className="text-xs text-slate-400">{reviews.length} {lang === "ar" ? "تقييم" : "reviews"}</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleReviews.map((r: any) => (
                <ReviewCard key={r.id} r={r} theme={theme} />
              ))}
            </div>

            {/* Pagination + add review */}
            <div className="flex items-center justify-between mt-8">
              <button onClick={() => setReviewDialog(true)}
                className="flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl border transition-all hover:bg-white"
                style={{ borderColor: cBorder, color: c }}>
                <Star className="h-4 w-4" />
                {lang === "ar" ? "أضف تقييمك" : "Add Review"}
              </button>
              {reviewPages > 1 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setReviewPage(v => Math.max(0, v - 1))} disabled={reviewPage === 0}
                    className="h-9 w-9 rounded-xl border flex items-center justify-center disabled:opacity-40 transition-all hover:bg-white border-slate-200">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-slate-500">{reviewPage + 1}/{reviewPages}</span>
                  <button onClick={() => setReviewPage(v => Math.min(reviewPages - 1, v + 1))} disabled={reviewPage === reviewPages - 1}
                    className="h-9 w-9 rounded-xl border flex items-center justify-center disabled:opacity-40 transition-all hover:bg-white border-slate-200">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── CONTACT ── */}
        <section ref={contactRef} id="contact">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full mb-4"
              style={{ background: cLight, color: c, border: `1px solid ${cBorder}` }}>
              <Send className="h-3.5 w-3.5" />
              {lang === "ar" ? "تواصل معنا" : "Get in Touch"}
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900">
              {lang === "ar" ? "ابدأ استشارتك اليوم" : "Start Your Consultation"}
            </h2>
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Contact options — 2 cols */}
            <div className="lg:col-span-2 space-y-4">
              {/* WhatsApp */}
              {(office.whatsapp || office.phone) && (
                <a href={whatsappUrl()} target="_blank" rel="noreferrer"
                  className="flex items-center gap-4 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-emerald-800">{lang === "ar" ? "واتساب مباشر" : "Direct WhatsApp"}</p>
                    <p className="text-xs text-emerald-600">{lang === "ar" ? "ردٌّ فوري خلال دقائق" : "Instant reply in minutes"}</p>
                  </div>
                  <ChevronLeft className={cn("h-5 w-5 text-emerald-400 mr-auto", lang === "en" && "rotate-180")} />
                </a>
              )}

              {/* Book */}
              <a href={`/firms/${slug}/book`}
                className="flex items-center gap-4 p-5 rounded-2xl border transition-all group hover:border-slate-300 bg-white"
                style={{ borderColor: cBorder }}>
                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"
                  style={{ background: c }}>
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{lang === "ar" ? "احجز موعداً" : "Book Appointment"}</p>
                  <p className="text-xs text-slate-400">{lang === "ar" ? "استشارة مرئية أو هاتفية" : "Video or phone consultation"}</p>
                </div>
                <ChevronLeft className={cn("h-5 w-5 text-slate-300 mr-auto", lang === "en" && "rotate-180")} />
              </a>

              {/* Phone */}
              {office.phone && (
                <a href={`tel:${office.phone}`}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Phone className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{lang === "ar" ? "اتصل بنا" : "Call Us"}</p>
                    <p className="text-xs text-slate-500 font-mono" dir="ltr">{office.phone}</p>
                  </div>
                </a>
              )}

              {/* Email */}
              {office.email && (
                <a href={`mailto:${office.email}`}
                  className="flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all group">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Mail className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{lang === "ar" ? "راسلنا بالبريد" : "Email Us"}</p>
                    <p className="text-xs text-slate-500" dir="ltr">{office.email}</p>
                  </div>
                </a>
              )}

              {/* Address */}
              {office.address && (
                <div className="flex items-center gap-4 p-5 rounded-2xl border border-slate-200 bg-white">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{lang === "ar" ? "العنوان" : "Address"}</p>
                    <p className="text-xs text-slate-500">{office.address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Contact form — 3 cols */}
            <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-8">
              <h3 className="font-black text-xl text-slate-900 mb-6">
                {lang === "ar" ? "أرسل رسالتك" : "Send a Message"}
              </h3>
              <ContactForm lang={lang} theme={theme} whatsappUrl={whatsappUrl} slug={slug} />
            </div>
          </div>

          {/* Map embed */}
          {office.mapsEmbedUrl && (
            <div className="mt-8 h-64 rounded-3xl overflow-hidden border border-slate-200">
              <iframe src={office.mapsEmbedUrl} className="w-full h-full border-0" loading="lazy" title="location" />
            </div>
          )}
        </section>

      </div>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="bg-slate-950 text-white mt-8">
        <div className="max-w-6xl mx-auto px-8 py-14">
          <div className="flex flex-col md:flex-row items-start justify-between gap-10">
            {/* Brand */}
            <div className="max-w-xs">
              <div className="flex items-center gap-3 mb-4">
                {office.logo ? (
                  <img src={imgSrc(office.logo)} alt={officeName} className="h-10 w-10 rounded-xl object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center font-black"
                    style={{ background: cLight, color: c }}>
                    {(officeName || "م")[0]}
                  </div>
                )}
                <span className="font-black text-lg">{officeName}</span>
              </div>
              {tagline && <p className="text-sm text-slate-400 leading-relaxed mb-4">{tagline}</p>}
              {/* social links */}
              <div className="flex gap-2">
                {office.twitter   && <a href={office.twitter}   target="_blank" rel="noreferrer" className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"><Twitter   className="h-3.5 w-3.5 text-slate-300" /></a>}
                {office.linkedin  && <a href={office.linkedin}  target="_blank" rel="noreferrer" className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"><Linkedin   className="h-3.5 w-3.5 text-slate-300" /></a>}
                {office.facebook  && <a href={office.facebook}  target="_blank" rel="noreferrer" className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"><Facebook   className="h-3.5 w-3.5 text-slate-300" /></a>}
                {office.instagram && <a href={office.instagram} target="_blank" rel="noreferrer" className="h-9 w-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"><Instagram  className="h-3.5 w-3.5 text-slate-300" /></a>}
              </div>
            </div>

            {/* Links */}
            <div className="grid grid-cols-2 gap-12">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                  {lang === "ar" ? "صفحات" : "Pages"}
                </h4>
                <ul className="space-y-2.5">
                  {navItems.map(item => (
                    <li key={item.id}>
                      <button onClick={() => scrollTo(item.ref)}
                        className="text-sm text-slate-400 hover:text-white transition-colors">
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                  {lang === "ar" ? "تواصل" : "Contact"}
                </h4>
                <ul className="space-y-2.5">
                  {(office.whatsapp || office.phone) && (
                    <li><a href={whatsappUrl()} target="_blank" rel="noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a></li>
                  )}
                  {office.phone && <li><a href={`tel:${office.phone}`} className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"><Phone className="h-3.5 w-3.5" /><span dir="ltr">{office.phone}</span></a></li>}
                  {office.email && <li><a href={`mailto:${office.email}`} className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2 truncate max-w-[160px]"><Mail className="h-3.5 w-3.5 shrink-0" />{office.email}</a></li>}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} {officeName} — {lang === "ar" ? "جميع الحقوق محفوظة" : "All rights reserved"}
            </p>
            <a href="/" className="text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              {lang === "ar" ? "مدعوم بـ عدالة AI" : "Powered by Adala AI"}
            </a>
          </div>
        </div>
      </footer>

      {/* ── WhatsApp FAB ── */}
      {(office.whatsapp || office.phone) && (
        <a href={whatsappUrl()} target="_blank" rel="noreferrer"
          className="fixed bottom-6 left-6 z-40 h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40 transition-all hover:scale-110">
          <MessageCircle className="h-7 w-7 text-white" />
        </a>
      )}

      {/* ── Book FAB (if no WhatsApp) ── */}
      {!office.whatsapp && !office.phone && (
        <a href={`/firms/${slug}/book`}
          className="fixed bottom-6 left-6 z-40 h-14 px-5 rounded-full flex items-center gap-2 font-bold text-sm text-white shadow-2xl transition-all hover:scale-105"
          style={{ background: c }}>
          <Calendar className="h-5 w-5" />
          {lang === "ar" ? "احجز" : "Book"}
        </a>
      )}

      {/* ── DIALOGS ── */}
      {orderDialog && (
        <OrderDialog svc={orderDialog} slug={slug} lang={lang} theme={theme} onClose={() => setOrderDialog(null)} />
      )}
      {dealDialog && (
        <OrderDialog svc={dealDialog} slug={slug} lang={lang} theme={theme} onClose={() => setDealDialog(null)} />
      )}
      {reviewDialog && (
        <ReviewDialog slug={slug} lang={lang} theme={theme} onClose={() => setReviewDialog(false)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONTACT FORM (standalone to avoid stale closures)
═══════════════════════════════════════════════════════════════════ */
function ContactForm({ lang, theme, whatsappUrl, slug }: {
  lang: Lang; theme: ReturnType<typeof useTheme>; whatsappUrl: (msg?: string) => string; slug: string;
}) {
  const { c, cLight, cBorder } = theme;
  const subjects = lang === "ar"
    ? ["استشارة قانونية", "إعداد عقد", "قضية في المحكمة", "توثيق", "استفسار عام"]
    : ["Legal Consultation", "Contract Drafting", "Court Case", "Notarization", "General Inquiry"];
  const [form, setForm] = useState({ name: "", phone: "", subject: subjects[0], message: "" });
  const [sent, setSent] = useState(false);
  const url = whatsappUrl(
    form.message
      ? `${lang === "ar" ? "مرحباً،\nالاسم:" : "Hello,\nName:"} ${form.name}\n${lang === "ar" ? "الموضوع:" : "Subject:"} ${form.subject}\n${lang === "ar" ? "الرسالة:" : "Message:"} ${form.message}`
      : undefined
  );
  return (
    <div className="space-y-4">
      {sent && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-emerald-700">{lang === "ar" ? "تم إرسال رسالتك بنجاح!" : "Message sent successfully!"}</p>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-xs font-semibold mb-1.5 block text-slate-600">{lang === "ar" ? "الاسم الكامل" : "Full Name"}</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={lang === "ar" ? "أدخل اسمك" : "Enter your name"} className="rounded-xl" />
        </div>
        <div>
          <Label className="text-xs font-semibold mb-1.5 block text-slate-600">{lang === "ar" ? "رقم الجوال" : "Phone Number"}</Label>
          <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            dir="ltr" placeholder="05XXXXXXXX" className="rounded-xl" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold mb-2 block text-slate-600">{lang === "ar" ? "موضوع الاستفسار" : "Subject"}</Label>
        <div className="flex flex-wrap gap-2">
          {subjects.map(s => (
            <button key={s} onClick={() => setForm(f => ({ ...f, subject: s }))}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-all font-medium",
                form.subject === s ? "text-white border-transparent" : "border-slate-200 text-slate-500 hover:border-slate-300"
              )}
              style={form.subject === s ? { background: c, borderColor: c } : {}}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold mb-1.5 block text-slate-600">{lang === "ar" ? "تفاصيل الاستفسار" : "Message"}</Label>
        <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          rows={4} className="rounded-xl resize-none"
          placeholder={lang === "ar" ? "اشرح استفسارك بالتفصيل..." : "Describe your inquiry in detail..."} />
      </div>
      <div className="flex gap-3 pt-2">
        <a href={url} target="_blank" rel="noreferrer" className="flex-1">
          <button className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
            <MessageCircle className="h-4 w-4" />
            {lang === "ar" ? "أرسل عبر واتساب" : "Send via WhatsApp"}
          </button>
        </a>
        <a href={`/firms/${slug}/book`}>
          <button className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm border transition-all hover:bg-white"
            style={{ borderColor: cBorder, color: c }}>
            <Calendar className="h-4 w-4" />
            {lang === "ar" ? "احجز" : "Book"}
          </button>
        </a>
      </div>
    </div>
  );
}
