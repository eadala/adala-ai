import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe, Settings, Users, ShoppingBag, Star, BookOpen, Package,
  Plus, Loader2, ExternalLink, Eye, EyeOff, Save, Trash2,
  CheckCircle2, XCircle, Edit2, MoreVertical, Phone, Mail,
  Copy, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

/* ── helpers ─────────────────────────────────── */
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "انتظار",   color: "text-yellow-400" },
  in_review:  { label: "قيد المراجعة", color: "text-blue-400" },
  completed:  { label: "مكتمل",   color: "text-emerald-400" },
  cancelled:  { label: "ملغي",    color: "text-red-400" },
};

/* ═══════════════════════════════════════════════════════════ */
export default function OfficeManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  /* ── Office data ── */
  const { data: office, isLoading } = useQuery<any>({
    queryKey: ["my-office"],
    queryFn: () => fetch("/api/office/my").then(r => r.json()),
  });

  const [pageForm, setPageForm] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const initForm = {
    slug: "", name: "", tagline: "", about: "", licenseNumber: "",
    experienceYears: 0, phone: "", whatsapp: "", email: "", address: "", city: "",
    regions: "", casesCount: 0, clientsCount: 0, successRate: 0,
    showStats: true, isPublished: false,
  };

  const createOfficeMutation = useMutation({
    mutationFn: (d: any) => fetch("/api/office/my", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-office"] }); setCreating(false); toast({ title: "تم إنشاء الصفحة ✓" }); },
  });

  const updateOfficeMutation = useMutation({
    mutationFn: ({ id, ...d }: any) => fetch(`/api/office/my/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-office"] }); setPageForm(null); toast({ title: "تم الحفظ ✓" }); },
  });

  /* ── Services ── */
  const { data: services = [] } = useQuery<any[]>({
    queryKey: ["my-services", office?.id],
    queryFn: () => fetch(`/api/office/my/${office.id}/services`).then(r => r.json()),
    enabled: !!office?.id,
  });
  const [showSvcForm, setShowSvcForm] = useState(false);
  const [svcForm, setSvcForm] = useState({ name: "", description: "", price: "", isCustomQuote: false, category: "استشارات", deliveryDays: "1" });
  const addSvc = useMutation({
    mutationFn: (d: any) => fetch(`/api/office/my/${office.id}/services`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-services", office.id] }); setShowSvcForm(false); toast({ title: "تمت إضافة الخدمة ✓" }); },
  });
  const deleteSvc = useMutation({
    mutationFn: (id: string) => fetch(`/api/office/my/services/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-services", office.id] }),
  });

  /* ── Team ── */
  const { data: team = [] } = useQuery<any[]>({
    queryKey: ["my-team", office?.id],
    queryFn: () => fetch(`/api/office/my/${office.id}/team`).then(r => r.json()),
    enabled: !!office?.id,
  });
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", title: "", specialties: "", bio: "", linkedin: "" });
  const addTeam = useMutation({
    mutationFn: (d: any) => fetch(`/api/office/my/${office.id}/team`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-team", office.id] }); setShowTeamForm(false); toast({ title: "تمت إضافة العضو ✓" }); },
  });
  const deleteTeam = useMutation({
    mutationFn: (id: string) => fetch(`/api/office/my/team/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-team", office.id] }),
  });

  /* ── Orders ── */
  const { data: orders = [] } = useQuery<any[]>({
    queryKey: ["my-orders", office?.id],
    queryFn: () => fetch(`/api/office/my/${office.id}/orders`).then(r => r.json()),
    enabled: !!office?.id,
  });
  const updateOrder = useMutation({
    mutationFn: ({ id, ...d }: any) => fetch(`/api/office/my/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-orders", office.id] }),
  });

  /* ── Reviews ── */
  const { data: reviews = [] } = useQuery<any[]>({
    queryKey: ["my-reviews", office?.id],
    queryFn: () => fetch(`/api/office/my/${office.id}/reviews`).then(r => r.json()),
    enabled: !!office?.id,
  });
  const updateReview = useMutation({
    mutationFn: ({ id, ...d }: any) => fetch(`/api/office/my/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-reviews", office.id] }),
  });

  const publicUrl = office ? `/firms/${office.slug}` : null;

  const copyLink = () => {
    if (publicUrl) { navigator.clipboard.writeText(window.location.origin + publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  /* ── Create office form ── */
  if (!office) return (
    <div className="max-w-lg mx-auto py-16">
      <div className="text-center mb-8">
        <Globe className="h-12 w-12 mx-auto mb-3 text-primary opacity-60" />
        <h1 className="text-2xl font-black">أنشئ صفحتك الإلكترونية</h1>
        <p className="text-muted-foreground text-sm mt-1">احصل على موقع احترافي لمكتبك في دقائق</p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div><Label className="text-xs font-semibold mb-1 block">اسم المكتب *</Label>
            <Input value={initForm.name} onChange={e => {}} placeholder="مكتب عبدالله للمحاماة" id="init-name" /></div>
          <div><Label className="text-xs font-semibold mb-1 block">الرابط المختصر * <span className="text-muted-foreground font-normal">(بالإنجليزية، بدون مسافات)</span></Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">adalah.sa/firms/</span>
              <Input id="init-slug" placeholder="alharbi-law" dir="ltr" className="flex-1" />
            </div></div>
          <Button className="w-full mt-2" onClick={() => {
            const name = (document.getElementById("init-name") as HTMLInputElement)?.value;
            const slug = (document.getElementById("init-slug") as HTMLInputElement)?.value;
            if (name && slug) createOfficeMutation.mutate({ name, slug });
          }} disabled={createOfficeMutation.isPending}>
            {createOfficeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            إنشاء الصفحة
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  /* ── Main management UI ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {office.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">/firms/{office.slug}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyLink}>
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={office.isPublished ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"}>
            {office.isPublished ? "منشور" : "مسودة"}
          </Badge>
          {publicUrl && (
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Eye className="h-3.5 w-3.5" /> معاينة
              </Button>
            </a>
          )}
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setPageForm({ ...office })}>
            <Edit2 className="h-3.5 w-3.5" /> تعديل الصفحة
          </Button>
          <Button size="sm" variant={office.isPublished ? "destructive" : "default"}
            onClick={() => updateOfficeMutation.mutate({ id: office.id, isPublished: !office.isPublished })}>
            {office.isPublished ? <><EyeOff className="h-3.5 w-3.5 ml-1" /> إخفاء</> : <><Globe className="h-3.5 w-3.5 ml-1" /> نشر</>}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "الطلبات", val: orders.length, color: "#C9A84C" },
          { label: "الخدمات", val: services.length, color: "#3B82F6" },
          { label: "الفريق", val: team.length, color: "#8B5CF6" },
          { label: "التقييمات", val: reviews.length, color: "#10B981" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-black" style={{ color: s.color }}>{s.val}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="orders" className="gap-1.5 text-xs"><Package className="h-3.5 w-3.5" /> الطلبات</TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5 text-xs"><ShoppingBag className="h-3.5 w-3.5" /> الخدمات</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> الفريق</TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1.5 text-xs"><Star className="h-3.5 w-3.5" /> التقييمات</TabsTrigger>
        </TabsList>

        {/* ── ORDERS ── */}
        <TabsContent value="orders" className="space-y-2 mt-4">
          {orders.length === 0 ? <Empty icon={<Package />} text="لا توجد طلبات بعد" /> : orders.map((o: any) => (
            <Card key={o.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-sm">{o.clientName}</span>
                      <Badge className={`text-[9px] ${STATUS_LABELS[o.status]?.color ?? "text-gray-400"} bg-white/5 border-white/10`}>
                        {STATUS_LABELS[o.status]?.label ?? o.status}
                      </Badge>
                      {o.isQuoteRequest && <Badge className="text-[9px] bg-purple-500/10 text-purple-400 border-purple-500/20">طلب عرض سعر</Badge>}
                      {o.amount && <span className="text-xs text-primary font-semibold">{Number(o.amount).toLocaleString("ar-SA")} ر.س</span>}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {o.clientPhone && <span><Phone className="h-3 w-3 inline ml-1" />{o.clientPhone}</span>}
                      {o.clientEmail && <span><Mail className="h-3 w-3 inline ml-1" />{o.clientEmail}</span>}
                    </div>
                    {o.notes && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{o.notes}</p>}
                  </div>
                  <Select value={o.status} onValueChange={v => updateOrder.mutate({ id: o.id, status: v })}>
                    <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">انتظار</SelectItem>
                      <SelectItem value="in_review">قيد المراجعة</SelectItem>
                      <SelectItem value="completed">مكتمل</SelectItem>
                      <SelectItem value="cancelled">ملغي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── SERVICES ── */}
        <TabsContent value="services" className="space-y-2 mt-4">
          <Button size="sm" className="gap-1.5" onClick={() => setShowSvcForm(true)}><Plus className="h-4 w-4" /> إضافة خدمة</Button>
          {services.length === 0 ? <Empty icon={<ShoppingBag />} text="لا توجد خدمات — أضف خدماتك القانونية" /> : services.map((s: any) => (
            <Card key={s.id} className="border-border/50">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-sm">{s.name}</span>
                    <Badge className="text-[9px] bg-muted text-muted-foreground">{s.category}</Badge>
                  </div>
                  <div className="text-xs text-primary font-semibold">
                    {s.isCustomQuote ? "حسب العرض" : `${Number(s.price).toLocaleString("ar-SA")} ر.س`}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteSvc.mutate(s.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── TEAM ── */}
        <TabsContent value="team" className="space-y-2 mt-4">
          <Button size="sm" className="gap-1.5" onClick={() => setShowTeamForm(true)}><Plus className="h-4 w-4" /> إضافة عضو</Button>
          {team.length === 0 ? <Empty icon={<Users />} text="لا يوجد أعضاء فريق — أضف محاميك ومستشاريك" /> : team.map((m: any) => (
            <Card key={m.id} className="border-border/50">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-black text-primary shrink-0">
                    {m.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.title}</div>
                    {m.specialties && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{m.specialties}</div>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteTeam.mutate(m.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── REVIEWS ── */}
        <TabsContent value="reviews" className="space-y-2 mt-4">
          {reviews.length === 0 ? <Empty icon={<Star />} text="لا توجد تقييمات بعد" /> : reviews.map((r: any) => (
            <Card key={r.id} className="border-border/50">
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{r.clientName}</span>
                    <span className="text-xs">{"⭐".repeat(r.rating)}</span>
                    {r.isApproved ? <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">معتمد</Badge>
                      : <Badge className="text-[9px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20">في انتظار الموافقة</Badge>}
                  </div>
                  {r.comment && <p className="text-xs text-muted-foreground line-clamp-2">{r.comment}</p>}
                </div>
                <div className="flex gap-1">
                  {!r.isApproved && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400"
                      onClick={() => updateReview.mutate({ id: r.id, isApproved: true })}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* ── Edit Office Dialog ── */}
      <Dialog open={!!pageForm} onOpenChange={() => setPageForm(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تعديل بيانات الصفحة</DialogTitle></DialogHeader>
          {pageForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">اسم المكتب</Label>
                  <Input value={pageForm.name} onChange={e => setPageForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
                <div><Label className="text-xs font-semibold mb-1 block">الشعار (رابط صورة)</Label>
                  <Input value={pageForm.logo ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, logo: e.target.value }))} placeholder="https://..." dir="ltr" /></div>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">الشعار النصي (tagline)</Label>
                <Input value={pageForm.tagline ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, tagline: e.target.value }))} placeholder="متخصصون في القانون التجاري والعقاري" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">من نحن</Label>
                <Textarea value={pageForm.about ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, about: e.target.value }))} rows={4} className="resize-none" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">رقم الترخيص</Label>
                  <Input value={pageForm.licenseNumber ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, licenseNumber: e.target.value }))} /></div>
                <div><Label className="text-xs font-semibold mb-1 block">سنوات الخبرة</Label>
                  <Input type="number" value={pageForm.experienceYears ?? 0} onChange={e => setPageForm((f: any) => ({ ...f, experienceYears: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label className="text-xs font-semibold mb-1 block">المدينة</Label>
                  <Input value={pageForm.city ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, city: e.target.value }))} placeholder="الرياض" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">الهاتف</Label>
                  <Input value={pageForm.phone ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">واتساب</Label>
                  <Input value={pageForm.whatsapp ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, whatsapp: e.target.value }))} dir="ltr" placeholder="966xxxxxxxxx" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">البريد الإلكتروني</Label>
                  <Input value={pageForm.email ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, email: e.target.value }))} dir="ltr" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">العنوان</Label>
                  <Input value={pageForm.address ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">تويتر X</Label>
                  <Input value={pageForm.twitter ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, twitter: e.target.value }))} dir="ltr" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">لينكدإن</Label>
                  <Input value={pageForm.linkedin ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, linkedin: e.target.value }))} dir="ltr" /></div>
              </div>
              <div className="border-t border-border/50 pt-4 space-y-3">
                <h3 className="text-sm font-bold">الإحصائيات</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label className="text-xs font-semibold mb-1 block">عدد القضايا</Label>
                    <Input type="number" value={pageForm.casesCount ?? 0} onChange={e => setPageForm((f: any) => ({ ...f, casesCount: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs font-semibold mb-1 block">عدد العملاء</Label>
                    <Input type="number" value={pageForm.clientsCount ?? 0} onChange={e => setPageForm((f: any) => ({ ...f, clientsCount: parseInt(e.target.value) || 0 }))} /></div>
                  <div><Label className="text-xs font-semibold mb-1 block">نسبة النجاح %</Label>
                    <Input type="number" value={pageForm.successRate ?? 0} onChange={e => setPageForm((f: any) => ({ ...f, successRate: parseInt(e.target.value) || 0 }))} /></div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={pageForm.showStats} onCheckedChange={v => setPageForm((f: any) => ({ ...f, showStats: v }))} />
                  <Label className="text-xs">إظهار الإحصائيات في الصفحة</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPageForm(null)}>إلغاء</Button>
            <Button disabled={updateOfficeMutation.isPending} onClick={() => updateOfficeMutation.mutate(pageForm)} className="gap-2">
              {updateOfficeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" /> حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Service Dialog ── */}
      <Dialog open={showSvcForm} onOpenChange={setShowSvcForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة خدمة قانونية</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">اسم الخدمة *</Label>
              <Input value={svcForm.name} onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))} placeholder="استشارة قانونية" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">الوصف</Label>
              <Textarea value={svcForm.description} onChange={e => setSvcForm(f => ({ ...f, description: e.target.value }))} rows={2} className="resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">التصنيف</Label>
                <Select value={svcForm.category} onValueChange={v => setSvcForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["استشارات", "عقود", "دعاوى", "توثيق", "تحكيم", "أحوال شخصية", "تجاري", "عقاري"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select></div>
              <div><Label className="text-xs font-semibold mb-1 block">مدة التسليم (أيام)</Label>
                <Input type="number" value={svcForm.deliveryDays} onChange={e => setSvcForm(f => ({ ...f, deliveryDays: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch checked={svcForm.isCustomQuote} onCheckedChange={v => setSvcForm(f => ({ ...f, isCustomQuote: v }))} />
              <Label className="text-xs">السعر حسب العرض (بدون سعر ثابت)</Label>
            </div>
            {!svcForm.isCustomQuote && (
              <div><Label className="text-xs font-semibold mb-1 block">السعر (ر.س) *</Label>
                <Input type="number" value={svcForm.price} onChange={e => setSvcForm(f => ({ ...f, price: e.target.value }))} placeholder="500" /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSvcForm(false)}>إلغاء</Button>
            <Button disabled={!svcForm.name || addSvc.isPending} onClick={() => addSvc.mutate(svcForm)} className="gap-2">
              {addSvc.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Plus className="h-4 w-4" /> إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Team Dialog ── */}
      <Dialog open={showTeamForm} onOpenChange={setShowTeamForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة عضو للفريق</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">الاسم *</Label>
              <Input value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} placeholder="أ. محمد عبدالله" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">اللقب / المسمى الوظيفي *</Label>
              <Input value={teamForm.title} onChange={e => setTeamForm(f => ({ ...f, title: e.target.value }))} placeholder="محامٍ أول" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">التخصصات (مفصولة بـ ،)</Label>
              <Input value={teamForm.specialties} onChange={e => setTeamForm(f => ({ ...f, specialties: e.target.value }))} placeholder="قانون تجاري، عقود، تحكيم" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">لينكدإن</Label>
              <Input value={teamForm.linkedin} onChange={e => setTeamForm(f => ({ ...f, linkedin: e.target.value }))} dir="ltr" placeholder="https://linkedin.com/in/..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTeamForm(false)}>إلغاء</Button>
            <Button disabled={!teamForm.name || !teamForm.title || addTeam.isPending} onClick={() => addTeam.mutate(teamForm)} className="gap-2">
              {addTeam.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Plus className="h-4 w-4" /> إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Empty({ icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="h-10 w-10 mx-auto mb-3 opacity-20">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}
