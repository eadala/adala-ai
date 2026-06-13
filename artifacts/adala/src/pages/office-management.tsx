import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import {
  Globe, Users, ShoppingBag, Star, Package,
  Plus, Loader2, Eye, EyeOff, Save, Trash2,
  CheckCircle2, Edit2, Phone, Mail,
  Copy, Check, Camera, Image, MapPin,
  FileText, Pencil, BookOpen, Calendar, ExternalLink,
  Link2, Shield, ShieldCheck, Wifi, WifiOff, Lock, Unlock,
  ArrowUpRight, Crown, Zap, AlertCircle, RefreshCw
} from "lucide-react";
import { getPlanFeatures, canUseFeature, generateSubdomain, PLAN_FEATURES } from "@/lib/plan-features";
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
  const [initName, setInitName] = useState("");
  const [initSlug, setInitSlug] = useState("");

  const createOfficeMutation = useMutation({
    mutationFn: (d: any) => fetch("/api/office/my", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-office"] }); toast({ title: "تم إنشاء الصفحة ✓" }); },
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
  const [editSvcDialog, setEditSvcDialog] = useState<any>(null);
  const [editSvcForm, setEditSvcForm] = useState({ name: "", description: "", price: "", isCustomQuote: false, category: "استشارات", deliveryDays: "1" });
  const updateSvc = useMutation({
    mutationFn: ({ id, ...d }: any) => fetch(`/api/office/my/services/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-services", office?.id] }); setEditSvcDialog(null); toast({ title: "تم تحديث الخدمة ✓" }); },
  });

  /* ── Team ── */
  const { data: team = [] } = useQuery<any[]>({
    queryKey: ["my-team", office?.id],
    queryFn: () => fetch(`/api/office/my/${office.id}/team`).then(r => r.json()),
    enabled: !!office?.id,
  });
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", title: "", specialties: "", bio: "", linkedin: "", photoUrl: "" });
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
  const deleteReview = useMutation({
    mutationFn: (id: string) => fetch(`/api/office/my/reviews/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-reviews", office?.id] }),
  });

  /* ── Articles ── */
  const { data: articles = [] } = useQuery<any[]>({
    queryKey: ["my-articles", office?.id],
    queryFn: () => fetch(`/api/office/my/${office.id}/articles`).then(r => r.json()),
    enabled: !!office?.id,
  });
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editArticle, setEditArticle] = useState<any>(null);
  const [articleForm, setArticleForm] = useState({ title: "", slug: "", excerpt: "", content: "", category: "قانوني", isPublished: false });
  const addArticle = useMutation({
    mutationFn: (d: any) => fetch(`/api/office/my/${office.id}/articles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-articles", office.id] }); setShowArticleForm(false); toast({ title: "تمت إضافة المقال ✓" }); },
  });
  const updateArticle = useMutation({
    mutationFn: ({ id, ...d }: any) => fetch(`/api/office/my/articles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-articles", office?.id] }); setEditArticle(null); toast({ title: "تم تحديث المقال ✓" }); },
  });
  const deleteArticle = useMutation({
    mutationFn: (id: string) => fetch(`/api/office/my/articles/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-articles", office?.id] }),
  });
  function slugify(s: string) { return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\u0600-\u06FFa-z0-9-]/g, ""); }

  /* ── Domains ── */
  const { data: domainData, refetch: refetchDomain } = useQuery<any>({
    queryKey: ["my-domains", office?.id],
    queryFn: () => fetch(`/api/office/my/${office.id}/domains`).then(r => r.json()),
    enabled: !!office?.id,
  });
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [copiedSub, setCopiedSub] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const initDomain = useMutation({
    mutationFn: () => fetch(`/api/office/my/${office.id}/domains`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-domains", office?.id] }),
  });
  const connectCustomDomain = useMutation({
    mutationFn: (d: any) => fetch(`/api/office/my/domains/${domainData.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-domains", office?.id] }); setCustomDomainInput(""); toast({ title: "تم إضافة الدومين — أضف DNS CNAME الآن" }); },
  });
  const removeCustomDomain = useMutation({
    mutationFn: () => fetch(`/api/office/my/domains/${domainData.id}/custom`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-domains", office?.id] }); toast({ title: "تم إزالة الدومين الخاص" }); },
  });
  const verifyDomain = useMutation({
    mutationFn: () => fetch(`/api/office/my/domains/${domainData.id}/verify`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-domains", office?.id] }); toast({ title: "تم التحقق من الدومين ✓" }); },
  });
  const planFeatures = getPlanFeatures(office?.plan);
  const canCustomDomain = canUseFeature(office?.plan, "customDomain");
  function copyText(text: string, setter: (v: boolean) => void) { navigator.clipboard.writeText(text).then(() => { setter(true); setTimeout(() => setter(false), 2000); }); }

  const publicUrl = office ? `/firms/${office.slug}` : null;

  const copyLink = () => {
    if (publicUrl) { navigator.clipboard.writeText(window.location.origin + publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  /* ── Photo upload helpers (must be before any conditional return) ── */
  const logoUpload = useUpload({ onSuccess: (r) => updateOfficeMutation.mutate({ id: office?.id, logo: r.objectPath }) });
  const coverUpload = useUpload({ onSuccess: (r) => updateOfficeMutation.mutate({ id: office?.id, coverImage: r.objectPath }) });
  const teamPhotoUpload = useUpload({ onSuccess: (r) => setTeamForm(f => ({ ...f, photoUrl: r.objectPath })) });
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const teamPhotoRef = useRef<HTMLInputElement>(null);

  function imgSrc(path: string | null | undefined): string | undefined {
    if (!path) return undefined;
    if (path.startsWith("http")) return path;
    return `/api/storage/objects${path.startsWith("/") ? path : "/" + path}`;
  }

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
            <Input
              value={initName}
              onChange={e => setInitName(e.target.value)}
              placeholder="مكتب عبدالله للمحاماة"
            /></div>
          <div><Label className="text-xs font-semibold mb-1 block">الرابط المختصر * <span className="text-muted-foreground font-normal">(بالإنجليزية، بدون مسافات)</span></Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">adalah.sa/firms/</span>
              <Input
                value={initSlug}
                onChange={e => setInitSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                placeholder="alharbi-law"
                dir="ltr"
                className="flex-1"
              />
            </div></div>
          <Button
            className="w-full mt-2"
            disabled={!initName.trim() || !initSlug.trim() || createOfficeMutation.isPending}
            onClick={() => createOfficeMutation.mutate({ name: initName.trim(), slug: initSlug.trim() })}
          >
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
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "الطلبات", val: orders.length, color: "#C9A84C" },
          { label: "الخدمات", val: services.length, color: "#3B82F6" },
          { label: "الفريق", val: team.length, color: "#8B5CF6" },
          { label: "التقييمات", val: reviews.length, color: "#10B981" },
          { label: "المقالات", val: articles.length, color: "#F97316" },
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
          <TabsTrigger value="articles" className="gap-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> المقالات</TabsTrigger>
          <TabsTrigger value="domains" className="gap-1.5 text-xs"><Link2 className="h-3.5 w-3.5" /> النطاق</TabsTrigger>
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
                    {s.isActive ? <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">نشط</Badge>
                      : <Badge className="text-[9px] bg-muted text-muted-foreground">مخفي</Badge>}
                  </div>
                  <div className="text-xs text-primary font-semibold">
                    {s.isCustomQuote ? "حسب العرض" : `${Number(s.price).toLocaleString("ar-SA")} ر.س`}
                  </div>
                  {s.description && <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{s.description}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400"
                    onClick={() => { setEditSvcDialog(s); setEditSvcForm({ name: s.name, description: s.description ?? "", price: s.price?.toString() ?? "", isCustomQuote: s.isCustomQuote ?? false, category: s.category ?? "استشارات", deliveryDays: s.deliveryDays?.toString() ?? "1" }); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteSvc.mutate(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
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
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400"
                    onClick={() => deleteReview.mutate(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── ARTICLES ── */}
        <TabsContent value="articles" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{articles.length} مقال • {articles.filter((a: any) => a.isPublished).length} منشور</p>
            <Button size="sm" className="gap-1.5 text-xs"
              onClick={() => { setArticleForm({ title: "", slug: "", excerpt: "", content: "", category: "قانوني", isPublished: false }); setShowArticleForm(true); }}>
              <Plus className="h-3.5 w-3.5" /> مقال جديد
            </Button>
          </div>
          {articles.length === 0 ? <Empty icon={<FileText />} text="لا توجد مقالات بعد — ابدأ بنشر محتوى قانوني لجذب العملاء" /> : (
            <div className="space-y-2">
              {articles.map((a: any) => (
                <Card key={a.id} className="border-border/50">
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold text-sm line-clamp-1">{a.title}</span>
                        {a.category && <Badge variant="outline" className="text-[10px]">{a.category}</Badge>}
                        {a.isPublished
                          ? <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">منشور</Badge>
                          : <Badge className="text-[9px] bg-muted text-muted-foreground">مسودة</Badge>}
                      </div>
                      {a.excerpt && <p className="text-xs text-muted-foreground line-clamp-2">{a.excerpt}</p>}
                      {a.slug && <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">/blog/{a.slug}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        title={a.isPublished ? "تحويل لمسودة" : "نشر"}
                        onClick={() => updateArticle.mutate({ id: a.id, isPublished: !a.isPublished })}>
                        {a.isPublished ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-emerald-400" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-400"
                        onClick={() => { setEditArticle(a); setArticleForm({ title: a.title, slug: a.slug ?? "", excerpt: a.excerpt ?? "", content: a.content ?? "", category: a.category ?? "قانوني", isPublished: a.isPublished ?? false }); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400"
                        onClick={() => deleteArticle.mutate(a.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── DOMAINS ── */}
        <TabsContent value="domains" className="space-y-6 mt-4">
          {/* Plan badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-semibold">
                خطة <span style={{ color: (PLAN_FEATURES as any)[(office?.plan ?? "starter")]?.color }}>
                  {(PLAN_FEATURES as any)[(office?.plan ?? "starter")]?.label ?? "مبتدئ"}
                </span>
              </span>
            </div>
            {!canCustomDomain && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
                onClick={() => window.location.href = "/pricing"}>
                <ArrowUpRight className="h-3.5 w-3.5" /> ترقية الخطة
              </Button>
            )}
          </div>

          {/* Subdomain card */}
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-[#C9A84C]" />
                <h3 className="font-bold text-sm">الدومين الفرعي</h3>
                <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
                  <CheckCircle2 className="h-2.5 w-2.5" /> نشط
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">الدومين الفرعي المخصص لمكتبك — متاح فور التسجيل مجاناً</p>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50 font-mono text-sm">
                <span className="flex-1 text-foreground select-all dir-ltr text-left">
                  {office ? generateSubdomain(office.slug) : "..."}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                  onClick={() => copyText(office ? generateSubdomain(office.slug) : "", setCopiedSub)}>
                  {copiedSub ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                  <a href={office ? `/firms/${office.slug}` : "#"} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 text-[#C9A84C]" />
                  </a>
                </Button>
              </div>

              {/* Init domain record */}
              {!domainData && (
                <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs"
                  onClick={() => initDomain.mutate()} disabled={initDomain.isPending}>
                  {initDomain.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  تفعيل إعدادات النطاق
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Custom domain card */}
          <Card className={`border-border/50 ${!canCustomDomain ? "opacity-60" : "bg-card/50"}`}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-purple-400" />
                <h3 className="font-bold text-sm">الدومين الخاص</h3>
                {!canCustomDomain && (
                  <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/20 gap-1">
                    <Lock className="h-2.5 w-2.5" /> خطة أعمال+
                  </Badge>
                )}
              </div>

              {!canCustomDomain ? (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-center space-y-3">
                  <Crown className="h-8 w-8 text-yellow-400 mx-auto" />
                  <p className="text-sm font-semibold">ميزة الدومين الخاص متاحة في خطة أعمال ومؤسسي</p>
                  <p className="text-xs text-muted-foreground">استخدم دومينك الخاص مثل <span className="font-mono text-foreground">law.yourfirm.com</span> بدلاً من الدومين الفرعي</p>
                  <Button size="sm" className="gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-black"
                    onClick={() => window.location.href = "/pricing"}>
                    <ArrowUpRight className="h-3.5 w-3.5" /> ترقية الآن
                  </Button>
                </div>
              ) : domainData?.customDomain ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <span className="font-mono text-sm flex-1 dir-ltr text-left">{domainData.customDomain}</span>
                    {domainData.isVerified
                      ? <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1"><ShieldCheck className="h-2.5 w-2.5" /> موثق</Badge>
                      : <Badge className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/20 gap-1"><AlertCircle className="h-2.5 w-2.5" /> بانتظار التحقق</Badge>}
                    {domainData.sslEnabled
                      ? <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 gap-1"><Shield className="h-2.5 w-2.5" /> SSL</Badge>
                      : <Badge className="text-[10px] bg-muted text-muted-foreground gap-1"><WifiOff className="h-2.5 w-2.5" /> بدون SSL</Badge>}
                  </div>
                  <div className="flex gap-2">
                    {!domainData.isVerified && (
                      <Button size="sm" className="flex-1 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => verifyDomain.mutate()} disabled={verifyDomain.isPending}>
                        {verifyDomain.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        تحقق من الدومين
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                      onClick={() => removeCustomDomain.mutate()} disabled={removeCustomDomain.isPending}>
                      {removeCustomDomain.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      إزالة الدومين
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">أدخل دومينك الخاص — ستحتاج لإضافة سجل CNAME في إعدادات DNS</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="law.yourfirm.com"
                      value={customDomainInput}
                      onChange={e => setCustomDomainInput(e.target.value)}
                      className="dir-ltr flex-1 font-mono text-sm h-9"
                      disabled={!domainData}
                    />
                    <Button size="sm" className="gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 shrink-0"
                      disabled={!customDomainInput.trim() || !domainData || connectCustomDomain.isPending}
                      onClick={() => connectCustomDomain.mutate({ customDomain: customDomainInput.trim() })}>
                      {connectCustomDomain.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                      ربط
                    </Button>
                  </div>
                  {!domainData && (
                    <p className="text-[11px] text-yellow-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> فعّل إعدادات النطاق أولاً من القسم أعلاه
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* DNS instructions */}
          {domainData?.customDomain && !domainData?.isVerified && (
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-orange-400" />
                  <h3 className="font-bold text-sm">خطوات التحقق من DNS</h3>
                </div>
                <p className="text-xs text-muted-foreground">أضف السجل التالي في لوحة DNS الخاصة بك (GoDaddy / Namecheap / Cloudflare...)</p>
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-right font-semibold">النوع</th>
                        <th className="p-2 text-right font-semibold">الاسم</th>
                        <th className="p-2 text-right font-semibold">القيمة</th>
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border/40">
                        <td className="p-2 font-mono font-bold text-blue-400">CNAME</td>
                        <td className="p-2 font-mono">{domainData.customDomain?.split(".")[0] ?? "@"}</td>
                        <td className="p-2 font-mono text-emerald-400 dir-ltr">cname.adala-ai.sa</td>
                        <td className="p-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => copyText("cname.adala-ai.sa", setCopiedToken)}>
                            {copiedToken ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> قد يستغرق الانتشار من ٥ دقائق إلى ٤٨ ساعة
                </p>
              </CardContent>
            </Card>
          )}

          {/* SSL + status summary */}
          {domainData && (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" /> حالة الاتصال
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <Globe className="h-5 w-5 mx-auto mb-1 text-[#C9A84C]" />
                    <p className="text-[11px] text-muted-foreground">الدومين الفرعي</p>
                    <p className="text-xs font-bold text-emerald-400">نشط</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <Link2 className="h-5 w-5 mx-auto mb-1 text-purple-400" />
                    <p className="text-[11px] text-muted-foreground">الدومين الخاص</p>
                    <p className={`text-xs font-bold ${domainData.customDomain ? (domainData.isVerified ? "text-emerald-400" : "text-orange-400") : "text-muted-foreground"}`}>
                      {domainData.customDomain ? (domainData.isVerified ? "موثق" : "بانتظار DNS") : "غير مفعل"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-center">
                    <Shield className="h-5 w-5 mx-auto mb-1 text-blue-400" />
                    <p className="text-[11px] text-muted-foreground">شهادة SSL</p>
                    <p className={`text-xs font-bold ${domainData.sslEnabled ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {domainData.sslEnabled ? "مفعل" : "غير نشط"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Edit Office Dialog ── */}
      <Dialog open={!!pageForm} onOpenChange={() => setPageForm(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تعديل بيانات الصفحة</DialogTitle></DialogHeader>
          {pageForm && (
            <div className="space-y-4">

              {/* Photos */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold mb-2 block">شعار المكتب</Label>
                  <div className="flex items-center gap-2">
                    {pageForm.logo && (
                      <img src={imgSrc(pageForm.logo)} alt="" className="h-12 w-12 rounded-lg object-cover border border-border/50" />
                    )}
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs"
                      onClick={() => logoRef.current?.click()} disabled={logoUpload.isUploading}>
                      {logoUpload.isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      {pageForm.logo ? "تغيير" : "رفع شعار"}
                    </Button>
                    <input ref={logoRef} type="file" accept="image/*" className="hidden"
                      onChange={async e => { const f = e.target.files?.[0]; if (f) { const r = await logoUpload.uploadFile(f); if (r) setPageForm((pf: any) => ({ ...pf, logo: r.objectPath })); } }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold mb-2 block">صورة الخلفية (هيرو)</Label>
                  <div className="flex items-center gap-2">
                    {pageForm.coverImage && (
                      <img src={imgSrc(pageForm.coverImage)} alt="" className="h-12 w-20 rounded-lg object-cover border border-border/50" />
                    )}
                    <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs"
                      onClick={() => coverRef.current?.click()} disabled={coverUpload.isUploading}>
                      {coverUpload.isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
                      {pageForm.coverImage ? "تغيير" : "رفع صورة"}
                    </Button>
                    <input ref={coverRef} type="file" accept="image/*" className="hidden"
                      onChange={async e => { const f = e.target.files?.[0]; if (f) { const r = await coverUpload.uploadFile(f); if (r) setPageForm((pf: any) => ({ ...pf, coverImage: r.objectPath })); } }} />
                  </div>
                </div>
              </div>

              {/* Arabic fields */}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">اسم المكتب (عربي)</Label>
                  <Input value={pageForm.name} onChange={e => setPageForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
                <div><Label className="text-xs font-semibold mb-1 block">اسم المكتب (English)</Label>
                  <Input value={pageForm.nameEn ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, nameEn: e.target.value }))} dir="ltr" placeholder="Al-Harbi Law Firm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">الشعار النصي (عربي)</Label>
                  <Input value={pageForm.tagline ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, tagline: e.target.value }))} placeholder="متخصصون في القانون التجاري" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">Tagline (English)</Label>
                  <Input value={pageForm.taglineEn ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, taglineEn: e.target.value }))} dir="ltr" placeholder="Specialists in Commercial Law" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">من نحن (عربي)</Label>
                  <Textarea value={pageForm.about ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, about: e.target.value }))} rows={3} className="resize-none" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">About Us (English)</Label>
                  <Textarea value={pageForm.aboutEn ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, aboutEn: e.target.value }))} rows={3} className="resize-none" dir="ltr" /></div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">رقم الترخيص</Label>
                  <Input value={pageForm.licenseNumber ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, licenseNumber: e.target.value }))} /></div>
                <div><Label className="text-xs font-semibold mb-1 block">سنوات الخبرة</Label>
                  <Input type="number" value={pageForm.experienceYears ?? 0} onChange={e => setPageForm((f: any) => ({ ...f, experienceYears: parseInt(e.target.value) || 0 }))} /></div>
                <div><Label className="text-xs font-semibold mb-1 block">المدينة</Label>
                  <Input value={pageForm.city ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, city: e.target.value }))} placeholder="الرياض" /></div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">الهاتف</Label>
                  <Input value={pageForm.phone ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, phone: e.target.value }))} dir="ltr" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">واتساب <span className="text-muted-foreground font-normal">(966xxxxxxxxx)</span></Label>
                  <Input value={pageForm.whatsapp ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, whatsapp: e.target.value }))} dir="ltr" placeholder="9665xxxxxxxx" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">البريد الإلكتروني</Label>
                  <Input value={pageForm.email ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, email: e.target.value }))} dir="ltr" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">العنوان</Label>
                  <Input value={pageForm.address ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, address: e.target.value }))} /></div>
              </div>

              {/* Maps */}
              <div>
                <Label className="text-xs font-semibold mb-1 block flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> رابط تضمين خريطة جوجل
                </Label>
                <Input value={pageForm.mapsEmbedUrl ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, mapsEmbedUrl: e.target.value }))} dir="ltr"
                  placeholder="https://www.google.com/maps/embed?pb=..." />
                <p className="text-[10px] text-muted-foreground mt-1">من Google Maps: مشاركة → تضمين خريطة → انسخ رابط src من iframe</p>
              </div>

              {/* Social */}
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">تويتر X</Label>
                  <Input value={pageForm.twitter ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, twitter: e.target.value }))} dir="ltr" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">لينكدإن</Label>
                  <Input value={pageForm.linkedin ?? ""} onChange={e => setPageForm((f: any) => ({ ...f, linkedin: e.target.value }))} dir="ltr" /></div>
              </div>

              {/* Stats */}
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

      {/* ── Edit Service Dialog ── */}
      <Dialog open={!!editSvcDialog} onOpenChange={v => { if (!v) setEditSvcDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>تعديل الخدمة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">اسم الخدمة *</Label>
              <Input value={editSvcForm.name} onChange={e => setEditSvcForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">الوصف</Label>
              <Textarea value={editSvcForm.description} onChange={e => setEditSvcForm(f => ({ ...f, description: e.target.value }))} rows={2} className="resize-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">التصنيف</Label>
                <Select value={editSvcForm.category} onValueChange={v => setEditSvcForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["استشارات", "عقود", "دعاوى", "توثيق", "تحكيم", "أحوال شخصية", "تجاري", "عقاري"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select></div>
              <div><Label className="text-xs font-semibold mb-1 block">مدة التسليم (أيام)</Label>
                <Input type="number" value={editSvcForm.deliveryDays} onChange={e => setEditSvcForm(f => ({ ...f, deliveryDays: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch checked={editSvcForm.isCustomQuote} onCheckedChange={v => setEditSvcForm(f => ({ ...f, isCustomQuote: v }))} />
              <Label className="text-xs">السعر حسب العرض</Label>
            </div>
            {!editSvcForm.isCustomQuote && (
              <div><Label className="text-xs font-semibold mb-1 block">السعر (ر.س) *</Label>
                <Input type="number" value={editSvcForm.price} onChange={e => setEditSvcForm(f => ({ ...f, price: e.target.value }))} /></div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSvcDialog(null)}>إلغاء</Button>
            <Button disabled={!editSvcForm.name || updateSvc.isPending} onClick={() => updateSvc.mutate({ id: editSvcDialog.id, ...editSvcForm })} className="gap-2">
              {updateSvc.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Article Dialog ── */}
      <Dialog open={showArticleForm || !!editArticle} onOpenChange={v => { if (!v) { setShowArticleForm(false); setEditArticle(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editArticle ? "تعديل المقال" : "إضافة مقال جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">عنوان المقال *</Label>
              <Input
                value={articleForm.title}
                onChange={e => setArticleForm(f => ({ ...f, title: e.target.value, slug: editArticle ? f.slug : slugify(e.target.value) }))}
                placeholder="أهمية توثيق العقود التجارية"
              /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">الرابط المختصر (slug)</Label>
                <Input value={articleForm.slug} onChange={e => setArticleForm(f => ({ ...f, slug: slugify(e.target.value) }))} dir="ltr" placeholder="legal-contracts-importance" className="font-mono text-xs" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">التصنيف</Label>
                <Select value={articleForm.category} onValueChange={v => setArticleForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["قانوني", "تجاري", "أسري", "عقاري", "عمالي", "تحكيم", "نصائح", "أخبار"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">مقتطف (يظهر في القائمة)</Label>
              <Textarea value={articleForm.excerpt} onChange={e => setArticleForm(f => ({ ...f, excerpt: e.target.value }))} rows={2} className="resize-none"
                placeholder="ملخص مختصر عن موضوع المقال..." /></div>
            <div><Label className="text-xs font-semibold mb-1 block">محتوى المقال</Label>
              <Textarea value={articleForm.content} onChange={e => setArticleForm(f => ({ ...f, content: e.target.value }))} rows={8} className="resize-none text-sm"
                placeholder="اكتب محتوى المقال هنا..." /></div>
            <div className="flex items-center gap-2 pt-1 border-t border-border/50">
              <Switch checked={articleForm.isPublished} onCheckedChange={v => setArticleForm(f => ({ ...f, isPublished: v }))} />
              <Label className="text-xs">{articleForm.isPublished ? "نشر المقال فوراً" : "حفظ كمسودة"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowArticleForm(false); setEditArticle(null); }}>إلغاء</Button>
            <Button
              disabled={!articleForm.title || (editArticle ? updateArticle.isPending : addArticle.isPending)}
              onClick={() => editArticle
                ? updateArticle.mutate({ id: editArticle.id, ...articleForm })
                : addArticle.mutate(articleForm)}
              className="gap-2">
              {(editArticle ? updateArticle.isPending : addArticle.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {editArticle ? <><Save className="h-4 w-4" /> حفظ التغييرات</> : <><Plus className="h-4 w-4" /> نشر المقال</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Team Dialog ── */}
      <Dialog open={showTeamForm} onOpenChange={v => { setShowTeamForm(v); if (!v) setTeamForm({ name: "", title: "", specialties: "", bio: "", linkedin: "", photoUrl: "" }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>إضافة عضو للفريق</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Photo upload */}
            <div className="flex items-center gap-3">
              {teamForm.photoUrl ? (
                <img src={imgSrc(teamForm.photoUrl)} alt="" className="h-14 w-14 rounded-full object-cover border border-border/50" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Camera className="h-5 w-5" />
                </div>
              )}
              <div>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs"
                  onClick={() => teamPhotoRef.current?.click()} disabled={teamPhotoUpload.isUploading}>
                  {teamPhotoUpload.isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                  {teamForm.photoUrl ? "تغيير الصورة" : "رفع صورة"}
                </Button>
                <input ref={teamPhotoRef} type="file" accept="image/*" className="hidden"
                  onChange={async e => { const f = e.target.files?.[0]; if (f) await teamPhotoUpload.uploadFile(f); }} />
                <p className="text-[10px] text-muted-foreground mt-1">صورة المحامي / العضو</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">الاسم (عربي) *</Label>
                <Input value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} placeholder="أ. محمد عبدالله" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">Name (English)</Label>
                <Input value={(teamForm as any).nameEn ?? ""} onChange={e => setTeamForm(f => ({ ...f, nameEn: e.target.value } as any))} dir="ltr" placeholder="Mohammed Abdullah" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">المسمى الوظيفي (عربي) *</Label>
                <Input value={teamForm.title} onChange={e => setTeamForm(f => ({ ...f, title: e.target.value }))} placeholder="محامٍ أول" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">Title (English)</Label>
                <Input value={(teamForm as any).titleEn ?? ""} onChange={e => setTeamForm(f => ({ ...f, titleEn: e.target.value } as any))} dir="ltr" placeholder="Senior Lawyer" /></div>
            </div>
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
