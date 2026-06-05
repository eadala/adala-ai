import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Phone, Mail, MapPin, MessageCircle, Star, ExternalLink,
  ShoppingCart, Send, CheckCircle2, Loader2, Scale, Users,
  Briefcase, Award, BookOpen, ChevronLeft, Globe, Twitter,
  Linkedin, Facebook, Clock, FileText, BadgeCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* ── helpers ─────────────────────────────────── */
function stars(n: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn("h-3.5 w-3.5", i < n ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
  ));
}

/* ═══════════════════════════════════════════════════════════ */
export default function OfficePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ["office-public", slug],
    queryFn: () => fetch(`/api/office/public/${slug}`).then(r => r.json()),
  });

  const [orderDialog, setOrderDialog] = useState<any>(null);
  const [reviewDialog, setReviewDialog] = useState(false);
  const [orderForm, setOrderForm] = useState({ clientName: "", clientPhone: "", clientEmail: "", notes: "" });
  const [reviewForm, setReviewForm] = useState({ clientName: "", rating: "5", comment: "" });
  const [success, setSuccess] = useState("");

  const orderMutation = useMutation({
    mutationFn: async () => {
      if (orderDialog?.price && !orderDialog.isCustomQuote) {
        // Stripe checkout
        const r = await fetch(`/api/office/public/${slug}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId: orderDialog.id, ...orderForm }),
        });
        const d = await r.json();
        if (d.url) { window.location.href = d.url; return; }
      }
      // quote request or free order
      await fetch(`/api/office/public/${slug}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: orderDialog?.id, ...orderForm, isQuoteRequest: orderDialog?.isCustomQuote }),
      });
      setSuccess("تم إرسال طلبك بنجاح! سيتواصل معك المكتب قريباً.");
      setOrderDialog(null);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => fetch(`/api/office/public/${slug}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...reviewForm, rating: parseInt(reviewForm.rating) }),
    }).then(r => r.json()),
    onSuccess: () => { setSuccess("شكراً لتقييمك! سيظهر بعد مراجعة المكتب."); setReviewDialog(false); },
  });

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" />
    </div>
  );

  if (isError || !data?.office) return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center text-white text-center">
      <div>
        <Scale className="h-16 w-16 mx-auto mb-4 text-[#C9A84C] opacity-40" />
        <h1 className="text-2xl font-bold mb-2">المكتب غير موجود</h1>
        <p className="text-white/50">تحقق من الرابط أو تواصل معنا</p>
      </div>
    </div>
  );

  const { office, services = [], team = [], reviews = [], articles = [] } = data;
  const gold = office.primaryColor ?? "#C9A84C";
  const avgRating = reviews.length ? (reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-['Cairo',sans-serif]" dir="rtl">

      {/* ── HERO ───────────────────────────────────── */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1e] via-[#0d1528] to-[#0a0f1e]" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 60% 0%, ${gold}15 0%, transparent 70%)` }} />

        <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
          {/* logo */}
          {office.logo ? (
            <img src={office.logo} alt={office.name} className="h-20 w-20 rounded-2xl object-cover mx-auto mb-5 shadow-xl" />
          ) : (
            <div className="h-20 w-20 rounded-2xl mx-auto mb-5 flex items-center justify-center text-3xl font-black shadow-xl" style={{ background: `${gold}20`, border: `2px solid ${gold}40`, color: gold }}>
              {office.name[0]}
            </div>
          )}

          <h1 className="text-3xl md:text-4xl font-black mb-2">{office.name}</h1>
          {office.tagline && <p className="text-white/60 text-lg mb-6">{office.tagline}</p>}

          {/* contact buttons */}
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            {office.whatsapp && (
              <a href={`https://wa.me/${office.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                  <MessageCircle className="h-4 w-4" /> واتساب
                </Button>
              </a>
            )}
            {office.phone && (
              <a href={`tel:${office.phone}`}>
                <Button variant="outline" className="gap-2 border-white/20 hover:bg-white/10">
                  <Phone className="h-4 w-4" /> {office.phone}
                </Button>
              </a>
            )}
            <Button className="gap-2 font-bold" style={{ background: gold, color: "#000" }}
              onClick={() => setOrderDialog({ name: "استشارة قانونية", isCustomQuote: true })}>
              <Send className="h-4 w-4" /> طلب استشارة
            </Button>
          </div>

          {/* social */}
          <div className="flex gap-3 justify-center">
            {office.twitter && <a href={office.twitter} target="_blank" rel="noreferrer" className="text-white/40 hover:text-white transition-colors"><Twitter className="h-5 w-5" /></a>}
            {office.linkedin && <a href={office.linkedin} target="_blank" rel="noreferrer" className="text-white/40 hover:text-white transition-colors"><Linkedin className="h-5 w-5" /></a>}
            {office.facebook && <a href={office.facebook} target="_blank" rel="noreferrer" className="text-white/40 hover:text-white transition-colors"><Facebook className="h-5 w-5" /></a>}
            {office.website && <a href={office.website} target="_blank" rel="noreferrer" className="text-white/40 hover:text-white transition-colors"><Globe className="h-5 w-5" /></a>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-20 space-y-16">

        {/* success banner */}
        {success && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="text-emerald-300 text-sm font-semibold">{success}</p>
          </div>
        )}

        {/* ── ABOUT ─────────────────────────────────── */}
        {(office.about || office.licenseNumber || office.experienceYears) && (
          <section>
            <SectionTitle icon={<Scale />} title="من نحن" gold={gold} />
            <div className="grid md:grid-cols-3 gap-4 mt-6">
              {office.about && (
                <div className="md:col-span-2 p-6 rounded-2xl bg-white/5 border border-white/10 leading-relaxed text-white/80 text-sm">
                  {office.about}
                </div>
              )}
              <div className="space-y-3">
                {office.experienceYears > 0 && <InfoCard icon={<Award />} label="سنوات الخبرة" value={`${office.experienceYears} سنة`} gold={gold} />}
                {office.licenseNumber && <InfoCard icon={<BadgeCheck />} label="رقم الترخيص" value={office.licenseNumber} gold={gold} />}
                {office.city && <InfoCard icon={<MapPin />} label="المدينة" value={office.city} gold={gold} />}
                {office.regions && <InfoCard icon={<Globe />} label="مناطق العمل" value={office.regions} gold={gold} />}
              </div>
            </div>
          </section>
        )}

        {/* ── STATS ─────────────────────────────────── */}
        {office.showStats && (office.casesCount > 0 || office.clientsCount > 0 || office.successRate > 0) && (
          <section className="grid grid-cols-3 gap-4">
            {office.casesCount > 0 && <StatCard value={office.casesCount.toLocaleString("ar-SA")} label="قضية" icon={<Briefcase />} gold={gold} />}
            {office.clientsCount > 0 && <StatCard value={office.clientsCount.toLocaleString("ar-SA")} label="عميل" icon={<Users />} gold={gold} />}
            {office.successRate > 0 && <StatCard value={`${office.successRate}%`} label="نسبة النجاح" icon={<Award />} gold={gold} />}
          </section>
        )}

        {/* ── SERVICES ──────────────────────────────── */}
        {services.length > 0 && (
          <section>
            <SectionTitle icon={<ShoppingCart />} title="الخدمات القانونية" gold={gold} />
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              {services.map((svc: any) => (
                <div key={svc.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-sm">{svc.name}</h3>
                    <Badge className="text-[10px] bg-white/5 text-white/50 border-white/10">{svc.category}</Badge>
                  </div>
                  {svc.description && <p className="text-xs text-white/50 mb-3 flex-1">{svc.description}</p>}
                  {svc.deliveryDays > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-white/40 mb-3">
                      <Clock className="h-3 w-3" /> مدة التسليم: {svc.deliveryDays} يوم
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/10">
                    <span className="font-black text-lg" style={{ color: gold }}>
                      {svc.isCustomQuote ? "حسب العرض" : `${Number(svc.price).toLocaleString("ar-SA")} ر.س`}
                    </span>
                    <Button size="sm" className="text-xs font-bold"
                      style={{ background: gold, color: "#000" }}
                      onClick={() => { setOrderDialog(svc); setOrderForm({ clientName: "", clientPhone: "", clientEmail: "", notes: "" }); }}>
                      {svc.isCustomQuote ? "اطلب عرض سعر" : "اطلب الخدمة"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── TEAM ──────────────────────────────────── */}
        {team.length > 0 && (
          <section>
            <SectionTitle icon={<Users />} title="فريق العمل" gold={gold} />
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              {team.map((m: any) => (
                <div key={m.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.name} className="h-16 w-16 rounded-full object-cover mx-auto mb-3" />
                  ) : (
                    <div className="h-16 w-16 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-black" style={{ background: `${gold}20`, color: gold }}>
                      {m.name[0]}
                    </div>
                  )}
                  <h3 className="font-bold text-sm">{m.name}</h3>
                  <p className="text-xs text-white/50 mt-0.5">{m.title}</p>
                  {m.specialties && (
                    <div className="flex flex-wrap gap-1 justify-center mt-2">
                      {m.specialties.split("،").map((s: string) => (
                        <Badge key={s} className="text-[9px] bg-white/5 text-white/40 border-white/10">{s.trim()}</Badge>
                      ))}
                    </div>
                  )}
                  {m.linkedin && (
                    <a href={m.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[10px] text-white/40 hover:text-white transition-colors">
                      <Linkedin className="h-3 w-3" /> LinkedIn
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── REVIEWS ───────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <SectionTitle icon={<Star />} title="تقييمات العملاء" gold={gold} noMb />
            <div className="flex items-center gap-3">
              {avgRating && <span className="font-black text-lg" style={{ color: gold }}>{avgRating} ⭐</span>}
              <Button size="sm" variant="outline" className="text-xs border-white/20 hover:bg-white/10"
                onClick={() => setReviewDialog(true)}>
                أضف تقييمك
              </Button>
            </div>
          </div>
          {reviews.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">لا توجد تقييمات بعد — كن أول من يقيّم!</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {reviews.slice(0, 6).map((r: any) => (
                <div key={r.id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-black" style={{ background: `${gold}20`, color: gold }}>
                      {r.clientName[0]}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{r.clientName}</div>
                      <div className="flex gap-0.5">{stars(r.rating)}</div>
                    </div>
                  </div>
                  {r.comment && <p className="text-xs text-white/60 leading-relaxed">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── ARTICLES ──────────────────────────────── */}
        {articles.length > 0 && (
          <section>
            <SectionTitle icon={<BookOpen />} title="مركز المعرفة القانونية" gold={gold} />
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
              {articles.map((a: any) => (
                <div key={a.id} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer">
                  <Badge className="text-[9px] mb-2 bg-white/5 text-white/40 border-white/10">{a.category}</Badge>
                  <h3 className="font-bold text-sm mb-1 line-clamp-2">{a.title}</h3>
                  {a.excerpt && <p className="text-xs text-white/50 line-clamp-2">{a.excerpt}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── CONTACT ───────────────────────────────── */}
        <section className="p-8 rounded-3xl border" style={{ background: `${gold}08`, borderColor: `${gold}20` }}>
          <SectionTitle icon={<Mail />} title="تواصل معنا" gold={gold} />
          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            {office.phone && (
              <a href={`tel:${office.phone}`} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Phone className="h-5 w-5" style={{ color: gold }} />
                <div><div className="text-xs text-white/40">هاتف</div><div className="font-semibold text-sm">{office.phone}</div></div>
              </a>
            )}
            {office.email && (
              <a href={`mailto:${office.email}`} className="flex items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Mail className="h-5 w-5" style={{ color: gold }} />
                <div><div className="text-xs text-white/40">بريد</div><div className="font-semibold text-sm">{office.email}</div></div>
              </a>
            )}
            {office.address && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5">
                <MapPin className="h-5 w-5 shrink-0" style={{ color: gold }} />
                <div><div className="text-xs text-white/40">العنوان</div><div className="font-semibold text-sm">{office.address}</div></div>
              </div>
            )}
          </div>
        </section>

        {/* footer */}
        <div className="text-center text-white/20 text-xs pb-4">
          مدعوم بـ <span className="font-bold" style={{ color: gold }}>عدالة AI</span> — منصة المكاتب القانونية الذكية
        </div>
      </main>

      {/* ── Order Dialog ──────────────────────────── */}
      <Dialog open={!!orderDialog} onOpenChange={() => setOrderDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{orderDialog?.isCustomQuote ? "طلب عرض سعر" : `طلب: ${orderDialog?.name}`}</DialogTitle>
          </DialogHeader>
          {orderDialog && (
            <div className="space-y-3">
              {!orderDialog.isCustomQuote && orderDialog.price && (
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <span className="text-2xl font-black" style={{ color: gold }}>{Number(orderDialog.price).toLocaleString("ar-SA")} ر.س</span>
                </div>
              )}
              <div><Label className="text-xs font-semibold mb-1 block">الاسم الكامل *</Label>
                <Input value={orderForm.clientName} onChange={e => setOrderForm(f => ({ ...f, clientName: e.target.value }))} placeholder="محمد عبدالله" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">رقم الجوال *</Label>
                <Input value={orderForm.clientPhone} onChange={e => setOrderForm(f => ({ ...f, clientPhone: e.target.value }))} placeholder="05xxxxxxxx" dir="ltr" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">البريد الإلكتروني</Label>
                <Input value={orderForm.clientEmail} onChange={e => setOrderForm(f => ({ ...f, clientEmail: e.target.value }))} placeholder="email@example.com" dir="ltr" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">تفاصيل الطلب</Label>
                <Textarea value={orderForm.notes} onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))} placeholder="اشرح طلبك بالتفصيل..." rows={3} className="resize-none" /></div>
              <Button className="w-full gap-2 font-bold" style={{ background: gold, color: "#000" }}
                disabled={!orderForm.clientName || !orderForm.clientPhone || orderMutation.isPending}
                onClick={() => orderMutation.mutate()}>
                {orderMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {orderDialog.isCustomQuote ? "إرسال طلب العرض" : orderDialog.price ? "الدفع والطلب" : "إرسال الطلب"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Review Dialog ─────────────────────────── */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>أضف تقييمك</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">اسمك *</Label>
              <Input value={reviewForm.clientName} onChange={e => setReviewForm(f => ({ ...f, clientName: e.target.value }))} placeholder="اسمك" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">التقييم</Label>
              <Select value={reviewForm.rating} onValueChange={v => setReviewForm(f => ({ ...f, rating: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">⭐⭐⭐⭐⭐ ممتاز</SelectItem>
                  <SelectItem value="4">⭐⭐⭐⭐ جيد جداً</SelectItem>
                  <SelectItem value="3">⭐⭐⭐ جيد</SelectItem>
                  <SelectItem value="2">⭐⭐ مقبول</SelectItem>
                  <SelectItem value="1">⭐ ضعيف</SelectItem>
                </SelectContent>
              </Select></div>
            <div><Label className="text-xs font-semibold mb-1 block">تعليقك</Label>
              <Textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} placeholder="شاركنا تجربتك..." rows={3} className="resize-none" /></div>
            <Button className="w-full" disabled={!reviewForm.clientName || reviewMutation.isPending}
              onClick={() => reviewMutation.mutate()}>
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              إرسال التقييم
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Sub-components ─────────────────────────── */
function SectionTitle({ icon, title, gold, noMb }: { icon: any; title: string; gold: string; noMb?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", !noMb && "mb-2")}>
      <div className="p-2 rounded-lg" style={{ background: `${gold}20`, color: gold }}>{icon}</div>
      <h2 className="text-xl font-black">{title}</h2>
    </div>
  );
}

function InfoCard({ icon, label, value, gold }: { icon: any; label: string; value: string; gold: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
      <div style={{ color: gold }}>{icon}</div>
      <div><div className="text-[10px] text-white/40">{label}</div><div className="text-sm font-semibold">{value}</div></div>
    </div>
  );
}

function StatCard({ value, label, icon, gold }: { value: string; label: string; icon: any; gold: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
      <div className="flex justify-center mb-2" style={{ color: gold }}>{icon}</div>
      <div className="text-3xl font-black mb-1" style={{ color: gold }}>{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}
