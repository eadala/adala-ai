/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
/**
 * Legal Services Marketplace — إعادة تصميم كاملة
 * Concept: Khamsat × Upwork × Legal SaaS
 * Flow: Browse → Buy Now / Negotiate → Deal Room → Auto Case
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag, Plus, Star, Clock, Search, Scale, FileText,
  Gavel, Briefcase, Building2, Home, Users, Loader2,
  ToggleLeft, ToggleRight, Package, AlertCircle, CheckSquare,
  MessageCircle, CheckCircle2, XCircle, ArrowRight, Send,
  Sparkles, TrendingUp, Award, Phone, Mail, Trash2, Edit2,
  ChevronLeft, ChevronRight, BadgeCheck, Handshake
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type Service = {
  id: string; user_id: string; office_name: string; title: string; description: string;
  category: string; price: number; currency: string; duration_minutes: number;
  is_active: boolean; rating: number; total_reviews: number; total_orders: number;
  tags: string; created_at: string;
};

/* ── Category config ─────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: "all",          label: "الكل",              icon: ShoppingBag, color: "#2563EB" },
  { id: "consultation", label: "استشارات",          icon: Users,       color: "#6366F1" },
  { id: "contract",     label: "صياغة العقود",      icon: FileText,    color: "#0EA5E9" },
  { id: "memo",         label: "مذكرات قانونية",    icon: Scale,       color: "#8B5CF6" },
  { id: "litigation",   label: "خدمات التقاضي",    icon: Gavel,       color: "#EF4444" },
  { id: "corporate",    label: "خدمات شركات",       icon: Building2,   color: "#10B981" },
  { id: "real_estate",  label: "خدمات عقارية",     icon: Home,        color: "#F59E0B" },
  { id: "labor",        label: "قانون العمل",       icon: Briefcase,   color: "#EC4899" },
  { id: "other",        label: "أخرى",             icon: Package,     color: "#64748B" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

function fmtPrice(n: number) {
  return Number(n).toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}

/* ── Office Avatar ────────────────────────────────────────────────────────── */
function OfficeAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = (name ?? "؟").split(" ").slice(0, 2).map(w => w[0]).join("");
  const COLORS = ["#6366F1","#0EA5E9","#8B5CF6","#10B981","#F59E0B","#EF4444","#EC4899","#2563EB"];
  const color  = COLORS[(name?.charCodeAt(0) ?? 0) % COLORS.length];
  const sz     = { sm: "w-7 h-7 text-[11px]", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-base" }[size];
  return (
    <div className={cn("rounded-xl flex items-center justify-center font-black text-white shrink-0", sz)}
      style={{ background: color }}>
      {initials}
    </div>
  );
}

/* ── Star Rating ─────────────────────────────────────────────────────────── */
function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={cn("h-3 w-3", s <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20")} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   BUY NOW DIALOG
══════════════════════════════════════════════════════════════════════════════ */
function BuyNowDialog({ service, onClose }: { service: Service; onClose: () => void }) {
  const { toast } = useToast();
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const order = useMutation({
    mutationFn: () =>
      authFetch(`${BASE}/api/marketplace/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id, buyerName: name,
          buyerEmail: email || undefined, buyerPhone: phone || undefined, notes: notes || undefined,
        }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      if (d?.error) { toast({ title: "خطأ", description: d.error, variant: "destructive" }); return; }
      toast({ title: "✅ تم إرسال طلبك بنجاح!", description: "سيتواصل معك فريق المكتب قريباً" });
      onClose();
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  return (
    <AdaptiveDialog open onOpenChange={onClose}>
      <AdaptiveDialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShoppingBag className="h-4 w-4 text-primary" />اطلب الخدمة مباشرة
          </DialogTitle>
        </DialogHeader>

        {/* Service summary */}
        <div className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-1">
          <div className="flex items-center gap-2">
            <OfficeAvatar name={service.office_name ?? "م"} size="sm" />
            <div>
              <p className="text-xs font-bold">{service.title}</p>
              <p className="text-[10px] text-muted-foreground">{service.office_name}</p>
            </div>
            <div className="mr-auto text-right">
              <p className="text-base font-black text-primary">{fmtPrice(service.price)}</p>
              <p className="text-[10px] text-muted-foreground">ر.س</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label className="text-xs">الاسم الكامل *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="أحمد محمد" className="h-9 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3 mobile-single-col">
            <div className="space-y-1">
              <Label className="text-xs">الجوال</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx" className="h-9 text-sm" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm" dir="ltr" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ملاحظات (اختياري)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="اشرح طلبك بإيجاز..." rows={2} className="text-sm resize-none" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>إلغاء</Button>
          <Button size="sm" className="gap-1.5"
            disabled={!name.trim() || order.isPending}
            onClick={() => order.mutate()}>
            {order.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingBag className="h-3.5 w-3.5" />}
            تأكيد الطلب
          </Button>
        </DialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DEAL ROOM DIALOG
══════════════════════════════════════════════════════════════════════════════ */
function DealRoomDialog({ service, onClose }: { service: Service; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep]   = useState<"form" | "room">("form");
  const [dealId, setDealId] = useState<string | null>(null);
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [phone, setPhone]   = useState("");
  const [myPrice, setMyPrice] = useState(String(Math.floor(Number(service.price) * 0.8)));
  const [message, setMessage] = useState("");

  const { data: deal } = useQuery<any>({
    queryKey: ["deal", dealId],
    queryFn: () => authFetch(`${BASE}/api/marketplace/deals/${dealId}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: !!dealId,
    refetchInterval: 5000,
  });

  const openDeal = useMutation({
    mutationFn: () =>
      authFetch(`${BASE}/api/marketplace/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id, buyerName: name,
          buyerEmail: email || undefined, buyerPhone: phone || undefined,
          initialPrice: parseFloat(myPrice), notes: message || undefined,
        }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      if (d?.error) { toast({ title: "خطأ", description: d.error, variant: "destructive" }); return; }
      setDealId(d.id);
      setStep("room");
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const DEAL_STATUS_CFG: Record<string, { label: string; color: string }> = {
    open:     { label: "جارٍ التفاوض",  color: "text-amber-400" },
    accepted: { label: "تم الاتفاق ✅", color: "text-emerald-400" },
    rejected: { label: "مرفوضة",        color: "text-red-400" },
  };

  return (
    <AdaptiveDialog open onOpenChange={onClose}>
      <AdaptiveDialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Handshake className="h-4 w-4 text-primary" />غرفة التفاوض
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            {/* Service info */}
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">{service.title}</p>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">السعر الأصلي</p>
                  <p className="text-base font-black text-primary">{fmtPrice(service.price)} ر.س</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                يمكنك تقديم عرض أقل من السعر الأصلي — سيتفاوض معك المكتب على أفضل سعر
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div className="space-y-1">
                <Label className="text-xs">الاسم الكامل *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="أحمد محمد" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الجوال</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="05xxxxxxxx" className="h-9 text-sm" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="h-9 text-sm" dir="ltr" />
            </div>

            {/* Price input */}
            <div className="space-y-1">
              <Label className="text-xs">عرضك (ر.س) *</Label>
              <div className="relative">
                <Input type="number" value={myPrice} onChange={e => setMyPrice(e.target.value)}
                  className="h-10 text-lg font-black text-primary ps-14" dir="ltr" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ر.س</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {Number(myPrice) < Number(service.price)
                  ? `خصم ${Math.round((1 - Number(myPrice)/Number(service.price))*100)}% من السعر الأصلي`
                  : "عرض بالسعر الكامل"}
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">رسالة للمكتب (اختياري)</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder="اشرح طلبك أو سبب عرضك..." rows={2} className="text-sm resize-none" />
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>إلغاء</Button>
              <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-black"
                disabled={!name.trim() || !myPrice || openDeal.isPending}
                onClick={() => openDeal.mutate()}>
                {openDeal.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Handshake className="h-3.5 w-3.5" />}
                إرسال العرض
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* Deal Room */
          <div className="space-y-3">
            {/* Status */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/40">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className={cn("text-xs font-semibold", DEAL_STATUS_CFG[deal?.status ?? "open"]?.color)}>
                  {DEAL_STATUS_CFG[deal?.status ?? "open"]?.label}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">يتم تحديث الحالة تلقائياً</p>
            </div>

            {/* Offer Timeline */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(deal?.offers ?? []).map((offer: any, i: number) => (
                <div key={offer.id} className={cn(
                  "flex gap-2",
                  offer.from_role === "buyer" ? "justify-end" : "justify-start"
                )}>
                  {offer.from_role === "seller" && (
                    <OfficeAvatar name={service.office_name ?? "م"} size="sm" />
                  )}
                  <div className={cn(
                    "max-w-[75%] rounded-xl p-3 space-y-1",
                    offer.from_role === "buyer"
                      ? "bg-primary/15 border border-primary/30"
                      : "bg-muted/50 border border-border/40"
                  )}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[10px] text-muted-foreground">
                        {offer.from_role === "buyer" ? "عرضك" : "رد المكتب"}
                      </span>
                      <span className="text-base font-black text-primary">{fmtPrice(offer.price)} ر.س</span>
                    </div>
                    {offer.message && <p className="text-xs text-muted-foreground">{offer.message}</p>}
                    <p className="text-[9px] text-muted-foreground/50">
                      {new Date(offer.created_at).toLocaleTimeString("ar-SA")}
                    </p>
                  </div>
                  {offer.from_role === "buyer" && (
                    <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-[11px] font-black text-blue-400 shrink-0">أ</div>
                  )}
                </div>
              ))}
              {(!deal?.offers || deal.offers.length === 0) && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-30" />
                  <p>في انتظار رد المكتب...</p>
                </div>
              )}
            </div>

            {deal?.status === "accepted" && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
                <p className="text-sm font-bold text-emerald-400">تم الاتفاق!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  السعر النهائي: <strong className="text-primary">{fmtPrice(deal.final_price)} ر.س</strong>
                  {" · "}سيتواصل معك الفريق قريباً
                </p>
              </div>
            )}

            <DialogFooter>
              <Button size="sm" variant="outline" onClick={onClose}>إغلاق</Button>
            </DialogFooter>
          </div>
        )}
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ADD SERVICE DIALOG
══════════════════════════════════════════════════════════════════════════════ */
function AddServiceDialog({ onCreated }: { onCreated: () => void }) {
  const { user }  = useUser();
  const { toast } = useToast();
  const [open, setOpen]   = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc]   = useState("");
  const [cat, setCat]     = useState("consultation");
  const [price, setPrice] = useState("");
  const [dur, setDur]     = useState("");
  const [tags, setTags]   = useState("");
  const [agreed, setAgreed] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      authFetch(`${BASE}/api/marketplace/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id, officeName: user?.fullName ?? "مكتب",
          title, description: desc || undefined, category: cat,
          price: Math.round(parseFloat(price || "0")),
          durationMinutes: dur ? parseInt(dur) : undefined,
          tags: tags || undefined,
        }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      if (d?.error) { toast({ title: "خطأ", description: d.error, variant: "destructive" }); return; }
      toast({ title: "✅ تم نشر الخدمة" });
      setOpen(false);
      setTitle(""); setDesc(""); setPrice(""); setDur(""); setTags(""); setAgreed(false);
      onCreated();
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />نشر خدمة
      </Button>
      <AdaptiveDialog open={open} onOpenChange={setOpen}>
        <AdaptiveDialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />نشر خدمة قانونية جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">عنوان الخدمة *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="استشارة في قانون العمل" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div className="space-y-1">
                <Label className="text-xs">الفئة *</Label>
                <Select value={cat} onValueChange={setCat}>
                  <SelectTrigger className="h-9 text-sm" dir="rtl"><SelectValue /></SelectTrigger>
                  <SelectContent dir="rtl">
                    {CATEGORIES.filter(c => c.id !== "all").map(c => (
                      <SelectItem key={c.id} value={String(c.id)} className="text-sm">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">السعر (ر.س) *</Label>
                <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="500" className="h-9 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">وصف الخدمة</Label>
              <Textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="وصف تفصيلي..." rows={2} className="text-sm resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3 mobile-single-col">
              <div className="space-y-1">
                <Label className="text-xs">المدة (دقيقة)</Label>
                <Input type="number" value={dur} onChange={e => setDur(e.target.value)} placeholder="60" className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الكلمات المفتاحية</Label>
                <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="عمالي, عقود" className="h-9 text-sm" />
              </div>
            </div>
            <div className="p-3 rounded-xl border border-primary/25 bg-primary/5 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <p className="text-[11px] text-muted-foreground">
                  عمولة المنصة <strong className="text-foreground">10%</strong> عند الدفع الإلكتروني
                </p>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5 h-3.5 w-3.5" />
                <label htmlFor="agree" className="text-[11px] text-muted-foreground cursor-pointer">
                  أوافق على سياسة العمولة
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button size="sm" className="gap-1.5"
              disabled={!title || !price || !agreed || create.isPending}
              onClick={() => create.mutate()}>
              {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              نشر الخدمة
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   SERVICE CARD
══════════════════════════════════════════════════════════════════════════════ */
function ServiceCard({
  service, canEdit, onDelete, onBuyNow, onNegotiate
}: {
  service: Service; canEdit?: boolean;
  onDelete?: () => void; onBuyNow?: () => void; onNegotiate?: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const cat = CAT_MAP[service.category];
  const Icon = cat?.icon ?? Package;

  const toggle = useMutation({
    mutationFn: () =>
      authFetch(`${BASE}/api/marketplace/services/${service.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !service.is_active }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketplace"] }); toast({ title: "تم تحديث حالة الخدمة ✓" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  return (
    <Card className={cn(
      "group relative overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5",
      !service.is_active && "opacity-60"
    )}>
      {/* Category color strip */}
      <div className="absolute top-0 right-0 left-0 h-0.5 rounded-t-lg"
        style={{ background: cat?.color ?? "#2563EB" }} />

      <CardContent className="p-4 space-y-3">
        {/* Office + Category */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <OfficeAvatar name={service.office_name ?? "م"} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{service.office_name || "مكتب قانوني"}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: cat?.color }} />
                <span className="text-[10px] text-muted-foreground truncate">{cat?.label}</span>
              </div>
            </div>
          </div>
          {canEdit && (
            <button onClick={() => toggle.mutate()} className="shrink-0 text-muted-foreground hover:text-foreground">
              {service.is_active
                ? <ToggleRight className="h-5 w-5 text-emerald-400" />
                : <ToggleLeft className="h-5 w-5" />}
            </button>
          )}
        </div>

        {/* Title + Description */}
        <div>
          <h3 className="font-bold text-sm leading-tight line-clamp-2">{service.title}</h3>
          {service.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{service.description}</p>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          {service.rating > 0 && (
            <div className="flex items-center gap-1">
              <Stars rating={service.rating} />
              <span className="text-[10px] text-muted-foreground">({service.total_reviews})</span>
            </div>
          )}
          {service.duration_minutes > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />{service.duration_minutes} د
            </span>
          )}
          {service.total_orders > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Award className="h-2.5 w-2.5" />{service.total_orders} طلب
            </span>
          )}
        </div>

        {/* Tags */}
        {service.tags && (
          <div className="flex gap-1 flex-wrap">
            {service.tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 3).map(tag => (
              <span key={tag} className="text-[9px] bg-muted/60 px-1.5 py-0.5 rounded-full border border-border/40 text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Price + CTAs */}
        <div className="flex items-end justify-between pt-2 border-t border-border/30 gap-2">
          <div>
            <p className="text-xl font-black text-primary font-mono leading-none">{fmtPrice(service.price)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">ر.س</p>
          </div>
          <div className="flex gap-1.5">
            {canEdit ? (
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400 hover:text-red-300" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={onNegotiate}>
                  <Handshake className="h-3 w-3" />تفاوض
                </Button>
                <Button size="sm" className="h-8 px-3 text-xs gap-1" onClick={onBuyNow}>
                  <ShoppingBag className="h-3 w-3" />اطلب الآن
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   DEALS DASHBOARD (for office owners)
══════════════════════════════════════════════════════════════════════════════ */
function DealsDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [counterPrice, setCounterPrice] = useState<Record<string, string>>({});
  const [counterMsg, setCounterMsg]     = useState<Record<string, string>>({});
  const [openDeal, setOpenDeal]         = useState<string | null>(null);

  const { data: deals = [], isLoading: dealsLoading } = useQuery<any[]>({
    queryKey: ["my-deals"],
    queryFn: () => authFetch(`${BASE}/api/marketplace/deals/my`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    refetchInterval: 15000,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<any[]>({
    queryKey: ["my-orders"],
    queryFn: () => authFetch(`${BASE}/api/marketplace/orders/my`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: dealDetail } = useQuery<any>({
    queryKey: ["deal-detail", openDeal],
    queryFn: () => authFetch(`${BASE}/api/marketplace/deals/${openDeal}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: !!openDeal,
    refetchInterval: 5000,
  });

  const sendCounter = useMutation({
    mutationFn: (dealId: string) =>
      authFetch(`${BASE}/api/marketplace/deals/${dealId}/offer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: parseFloat(counterPrice[dealId] ?? "0"), message: counterMsg[dealId] || undefined }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deal-detail", openDeal] }); qc.invalidateQueries({ queryKey: ["my-deals"] }); toast({ title: "تم إرسال الرد" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const acceptDeal = useMutation({
    mutationFn: (dealId: string) =>
      authFetch(`${BASE}/api/marketplace/deals/${dealId}/accept`, { method: "POST" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["my-deals"] });
      qc.invalidateQueries({ queryKey: ["deal-detail", openDeal] });
      toast({ title: "✅ تم قبول الصفقة", description: d.caseId ? "تم إنشاء القضية تلقائياً" : undefined });
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const rejectDeal = useMutation({
    mutationFn: (dealId: string) =>
      authFetch(`${BASE}/api/marketplace/deals/${dealId}/reject`, { method: "POST" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-deals"] }); toast({ title: "تم رفض الصفقة" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      authFetch(`${BASE}/api/marketplace/orders/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-orders"] }); toast({ title: "تم التحديث" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    open:     { label: "جارٍ",    color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30" },
    accepted: { label: "مقبول",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
    rejected: { label: "مرفوض",   color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
    pending:  { label: "انتظار",  color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/30" },
    completed:{ label: "مكتمل",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
    cancelled:{ label: "ملغي",    color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "صفقات مفتوحة",   value: deals.filter((d: any) => d.status === "open").length,     color: "#F59E0B" },
          { label: "صفقات مكتملة",   value: deals.filter((d: any) => d.status === "accepted").length,  color: "#10B981" },
          { label: "طلبات معلقة",    value: orders.filter((o: any) => o.status === "pending").length,  color: "#6366F1" },
          { label: "طلبات مكتملة",   value: orders.filter((o: any) => o.status === "completed").length, color: "#2563EB" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Deals */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Handshake className="h-4 w-4 text-amber-400" />الصفقات ({deals.length})
          </h3>
          {dealsLoading ? <Skeleton className="h-40" /> : deals.length === 0 ? (
            <div className="py-8 text-center border border-dashed rounded-xl">
              <Handshake className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">لا توجد صفقات بعد</p>
            </div>
          ) : deals.map((deal: any) => {
            const cfg = STATUS_CFG[deal.status] ?? STATUS_CFG.open;
            return (
              <Card key={deal.id} className="border-border/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{deal.buyer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{deal.service_title}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[9px] border shrink-0", cfg.bg, cfg.color)}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">عرض المشتري: <strong className="text-primary">{fmtPrice(deal.initial_price)} ر.س</strong></span>
                    {deal.final_price && <span className="text-emerald-400">نهائي: {fmtPrice(deal.final_price)} ر.س</span>}
                  </div>
                  {deal.status === "open" && (
                    <div className="flex gap-1.5 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 h-7 text-xs"
                        onClick={() => setOpenDeal(openDeal === deal.id ? null : deal.id)}>
                        <MessageCircle className="h-3 w-3 ms-1" />{openDeal === deal.id ? "إخفاء" : "فتح"}
                      </Button>
                      <Button size="sm" className="flex-1 h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => acceptDeal.mutate(deal.id)}>
                        <CheckCircle2 className="h-3 w-3 ms-1" />قبول
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:text-red-300"
                        onClick={() => rejectDeal.mutate(deal.id)}>
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {deal.case_id && (
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />تم إنشاء القضية تلقائياً
                    </p>
                  )}

                  {/* Expanded deal room */}
                  {openDeal === deal.id && dealDetail && (
                    <div className="border-t border-border/30 pt-3 space-y-2">
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {(dealDetail.offers ?? []).map((o: any) => (
                          <div key={o.id} className={cn("p-2 rounded-lg text-xs",
                            o.from_role === "buyer" ? "bg-muted/30 text-right" : "bg-primary/10 text-left")}>
                            <span className="font-bold text-primary">{fmtPrice(o.price)} ر.س</span>
                            {o.message && <p className="text-muted-foreground mt-0.5">{o.message}</p>}
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                              {o.from_role === "buyer" ? "المشتري" : "ردك"} · {new Date(o.created_at).toLocaleTimeString("ar-SA")}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input type="number" placeholder="عرض مضاد (ر.س)" className="h-8 text-sm flex-1"
                          value={counterPrice[deal.id] ?? ""}
                          onChange={e => setCounterPrice(p => ({ ...p, [deal.id]: e.target.value }))} />
                        <Button size="sm" className="h-8 px-3 text-xs"
                          disabled={!counterPrice[deal.id] || sendCounter.isPending}
                          onClick={() => sendCounter.mutate(deal.id)}>
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Orders */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-blue-400" />الطلبات المباشرة ({orders.length})
          </h3>
          {ordersLoading ? <Skeleton className="h-40" /> : orders.length === 0 ? (
            <div className="py-8 text-center border border-dashed rounded-xl">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">لا توجد طلبات بعد</p>
            </div>
          ) : orders.map((order: any) => {
            const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.pending;
            return (
              <Card key={order.id} className="border-border/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{order.buyer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{order.service_title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {order.buyer_phone && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{order.buyer_phone}</span>}
                        {order.buyer_email && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Mail className="h-2.5 w-2.5" />{order.buyer_email}</span>}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="text-sm font-black text-primary">{fmtPrice(order.amount)} ر.س</p>
                      <Select value={order.status} onValueChange={v => updateOrder.mutate({ id: order.id, status: v })}>
                        <SelectTrigger className="h-6 text-[10px] mt-1 w-24 border-none p-0 pe-1">
                          <span className={cn("font-medium", cfg.color)}>{cfg.label}</span>
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="pending" className="text-xs">انتظار</SelectItem>
                          <SelectItem value="in_review" className="text-xs">قيد المراجعة</SelectItem>
                          <SelectItem value="completed" className="text-xs">مكتمل</SelectItem>
                          <SelectItem value="cancelled" className="text-xs">ملغي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {order.notes && <p className="text-xs text-muted-foreground line-clamp-1 border-t border-border/30 pt-1">{order.notes}</p>}
                  {order.case_id && (
                    <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />تم إنشاء القضية تلقائياً
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
export default function Marketplace() {
  const { user }  = useUser();
  const qc        = useQueryClient();
  const { toast } = useToast();

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch]                 = useState("");
  const [activeTab, setActiveTab]           = useState("browse");
  const [buyNowService, setBuyNowService]   = useState<Service | null>(null);
  const [dealService, setDealService]       = useState<Service | null>(null);

  /* ── Queries ── */
  const { data: stats } = useQuery<any>({
    queryKey: ["marketplace-stats"],
    queryFn: () => authFetch(`${BASE}/api/marketplace/stats`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["marketplace", activeCategory, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (activeCategory !== "all") p.set("category", activeCategory);
      if (search) p.set("search", search);
      return authFetch(`${BASE}/api/marketplace/services?${p}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
    },
  });

  const { data: myServices = [] } = useQuery<Service[]>({
    queryKey: ["marketplace-my"],
    queryFn: () => authFetch(`${BASE}/api/marketplace/services/my`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled: !!user?.id,
  });

  const deleteService = useMutation({
    mutationFn: (id: string) =>
      authFetch(`${BASE}/api/marketplace/services/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      toast({ title: "تم حذف الخدمة" });
      qc.invalidateQueries({ queryKey: ["marketplace"] });
      qc.invalidateQueries({ queryKey: ["marketplace-my"] });
    },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["marketplace"] });
    qc.invalidateQueries({ queryKey: ["marketplace-my"] });
  };

  return (
    <div className="space-y-0 -mt-2" dir="rtl">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-2xl mb-6 p-6 sm:p-8"
        style={{ background: "linear-gradient(135deg, #0d1b2a 0%, #1a2744 40%, #0d1b2a 100%)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #2563EB 0%, transparent 50%), radial-gradient(circle at 80% 20%, #6366F1 0%, transparent 50%)" }} />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Scale className="h-5 w-5 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">عدالة AI · Marketplace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">السوق القانوني</h1>
            <p className="text-sm text-white/60 max-w-md">
              خدمات قانونية من أفضل المكاتب · شراء فوري أو تفاوض مباشر · عقد وقضية تلقائياً
            </p>

            {/* Stats */}
            <div className="flex items-center gap-5 mt-4">
              {[
                { label: "خدمة متاحة",  value: stats?.totalServices ?? "—" },
                { label: "مكتب معتمد",  value: stats?.totalOffices  ?? "—" },
                { label: "طلب مكتمل",   value: stats?.completedOrders ?? "—" },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-xl font-black text-primary">{s.value}+</p>
                  <p className="text-[10px] text-white/40">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 items-start md:items-end">
            <AddServiceDialog onCreated={refresh} />
            <button onClick={() => setActiveTab("deals")}
              className="text-xs text-white/50 hover:text-primary transition-colors flex items-center gap-1">
              <Handshake className="h-3.5 w-3.5" />إدارة صفقاتي وطلباتي
            </button>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9 mb-5">
          <TabsTrigger value="browse" className="text-xs gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5" />تصفح الخدمات
            {services.length > 0 && <span className="bg-primary/20 text-primary text-[9px] px-1 rounded-full">{services.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="my" className="text-xs gap-1.5">
            <Package className="h-3.5 w-3.5" />خدماتي ({myServices.length})
          </TabsTrigger>
          <TabsTrigger value="deals" className="text-xs gap-1.5">
            <Handshake className="h-3.5 w-3.5" />الصفقات والطلبات
          </TabsTrigger>
        </TabsList>

        {/* ── Browse ── */}
        <TabsContent value="browse" className="space-y-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pe-10 h-10" placeholder="ابحث عن خدمة قانونية..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const active = activeCategory === cat.id;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-all shrink-0",
                    active
                      ? "border-primary/50 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                  style={active ? { background: `${cat.color}15` } : {}}>
                  <Icon className="h-3.5 w-3.5" style={active ? { color: cat.color } : {}} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
            </div>
          ) : services.length === 0 ? (
            <Card className="border-dashed border-border/40">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <Scale className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-muted-foreground font-medium">لا توجد خدمات في هذه الفئة</p>
                <p className="text-xs text-muted-foreground">كن أول من ينشر خدمته القانونية</p>
                <AddServiceDialog onCreated={refresh} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(s => (
                <ServiceCard key={s.id} service={s}
                  onBuyNow={() => setBuyNowService(s)}
                  onNegotiate={() => setDealService(s)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── My Services ── */}
        <TabsContent value="my" className="space-y-4">
          {myServices.length === 0 ? (
            <Card className="border-dashed border-border/40">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <Package className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-muted-foreground font-medium">لم تنشر أي خدمات بعد</p>
                <AddServiceDialog onCreated={refresh} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myServices.map(s => (
                <ServiceCard key={s.id} service={s} canEdit
                  onDelete={() => {
                    if (confirm("حذف هذه الخدمة نهائياً؟")) deleteService.mutate(s.id);
                  }} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Deals Dashboard ── */}
        <TabsContent value="deals">
          <DealsDashboard />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {buyNowService && <BuyNowDialog service={buyNowService} onClose={() => setBuyNowService(null)} />}
      {dealService   && <DealRoomDialog service={dealService} onClose={() => setDealService(null)} />}
    </div>
  );
}
