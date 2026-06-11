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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ShoppingBag, Plus, Star, Clock, DollarSign, Trash2, Edit2, Search,
  Scale, FileText, Gavel, Briefcase, Building2, Home, Users, Loader2,
  ToggleLeft, ToggleRight, Package
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

type Service = {
  id: string; user_id: string; office_name: string; title: string; description: string;
  category: string; price: number; currency: string; duration_minutes: number;
  is_active: boolean; rating: number; total_reviews: number; total_orders: number;
  tags: string; created_at: string;
};

const CATEGORIES = [
  { id: "all",          label: "الكل",              icon: ShoppingBag },
  { id: "consultation", label: "استشارات",          icon: Users },
  { id: "contract",     label: "صياغة العقود",      icon: FileText },
  { id: "memo",         label: "مذكرات قانونية",    icon: Scale },
  { id: "litigation",   label: "خدمات التقاضي",    icon: Gavel },
  { id: "corporate",    label: "خدمات شركات",       icon: Building2 },
  { id: "real_estate",  label: "خدمات عقارية",     icon: Home },
  { id: "labor",        label: "قانون العمل",       icon: Briefcase },
  { id: "other",        label: "أخرى",             icon: Package },
];

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

function fmt(n: number) { return (n / 100).toLocaleString("ar-SA", { minimumFractionDigits: 0 }); }

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`h-3 w-3 ${s <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

// ─── Service Card ────────────────────────────────────────────────────────────
function ServiceCard({ service, onDelete, canEdit }: { service: Service; onDelete?: () => void; canEdit?: boolean }) {
  const qc = useQueryClient();
  const toggleActive = useMutation({
    mutationFn: () => fetch(`${BASE}api/marketplace/services/${service.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !service.is_active }),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketplace"] }); },
  });

  return (
    <Card className={`hover:border-primary/30 transition-all ${!service.is_active ? "opacity-60" : ""}`}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                {CAT_MAP[service.category] ?? service.category}
              </Badge>
              {!service.is_active && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-gray-500/30 text-gray-400">معطّل</Badge>
              )}
            </div>
            <h3 className="font-semibold text-sm leading-tight">{service.title}</h3>
            {service.office_name && (
              <p className="text-xs text-muted-foreground mt-0.5">{service.office_name}</p>
            )}
          </div>
          {canEdit && (
            <button onClick={() => toggleActive.mutate()}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              {service.is_active ? <ToggleRight className="h-5 w-5 text-green-400" /> : <ToggleLeft className="h-5 w-5" />}
            </button>
          )}
        </div>

        {service.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{service.description}</p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {service.rating > 0 && (
            <div className="flex items-center gap-1">
              <StarRating rating={Math.round(service.rating)} />
              <span className="text-[10px] text-muted-foreground">({service.total_reviews})</span>
            </div>
          )}
          {service.duration_minutes && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="h-3 w-3" />{service.duration_minutes} دقيقة
            </span>
          )}
          {service.total_orders > 0 && (
            <span className="text-[10px] text-muted-foreground">{service.total_orders} طلب</span>
          )}
        </div>

        {service.tags && (
          <div className="flex gap-1 flex-wrap">
            {service.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
              <span key={tag} className="text-[9px] bg-muted/50 px-1.5 py-0.5 rounded-full text-muted-foreground">{tag}</span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <div>
            <p className="text-lg font-black text-primary font-mono">{fmt(service.price)}</p>
            <p className="text-[10px] text-muted-foreground">ر.س</p>
          </div>
          <div className="flex gap-2">
            {canEdit && onDelete && (
              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" className="text-xs h-8 px-3">طلب الخدمة</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── New Service Dialog ───────────────────────────────────────────────────────
function NewServiceDialog({ onCreated }: { onCreated: () => void }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("consultation");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [tags, setTags] = useState("");
  const [officeName, setOfficeName] = useState("");

  const create = useMutation({
    mutationFn: () =>
      fetch(`${BASE}api/marketplace/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id ?? "default",
          officeName: officeName || undefined,
          title, description, category,
          price: Math.round(parseFloat(price || "0") * 100),
          durationMinutes: duration ? parseInt(duration) : undefined,
          tags: tags || undefined,
        }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      toast.success("تم نشر الخدمة ✅");
      setOpen(false);
      setTitle(""); setDescription(""); setPrice(""); setDuration(""); setTags("");
      onCreated();
    },
    onError: () => toast.error("فشل نشر الخدمة"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" />نشر خدمة</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />نشر خدمة قانونية
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>عنوان الخدمة *</Label>
            <Input placeholder="استشارة قانونية في قانون العمل" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الفئة *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter(c => c.id !== "all").map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>السعر (ر.س) *</Label>
              <Input type="number" min="0" placeholder="500" value={price} onChange={e => setPrice(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>اسم المكتب</Label>
              <Input placeholder="مكتب العدالة" value={officeName} onChange={e => setOfficeName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>المدة (دقيقة)</Label>
              <Input type="number" placeholder="60" value={duration} onChange={e => setDuration(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>وصف الخدمة</Label>
            <Textarea placeholder="وصف تفصيلي للخدمة القانونية..." rows={3} value={description}
              onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>الكلمات المفتاحية (مفصولة بفاصلة)</Label>
            <Input placeholder="عمالي, عقود, شركات" value={tags} onChange={e => setTags(e.target.value)} />
          </div>
          <Button className="w-full" onClick={() => create.mutate()} disabled={!title || !price || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <ShoppingBag className="h-4 w-4 ml-2" />}
            نشر الخدمة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Marketplace() {
  const { user } = useUser();
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("browse");

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ["marketplace", activeCategory, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeCategory !== "all") params.set("category", activeCategory);
      if (search) params.set("search", search);
      return fetch(`${BASE}api/marketplace/services?${params}`).then(r => r.json());
    },
  });

  const { data: myServices = [] } = useQuery<Service[]>({
    queryKey: ["marketplace-my", user?.id],
    queryFn: () => fetch(`${BASE}api/marketplace/services/my?userId=${user?.id}`).then(r => r.json()),
    enabled: !!user?.id,
  });

  const deleteService = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}api/marketplace/services/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { toast.success("تم حذف الخدمة"); qc.invalidateQueries({ queryKey: ["marketplace"] }); qc.invalidateQueries({ queryKey: ["marketplace-my"] }); },
  });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["marketplace"] }); qc.invalidateQueries({ queryKey: ["marketplace-my"] }); };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-primary" />السوق القانوني
          </h1>
          <p className="text-muted-foreground mt-1">تصفح الخدمات القانونية أو انشر خدماتك وصل للعملاء</p>
        </div>
        <NewServiceDialog onCreated={refresh} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">تصفح الخدمات</TabsTrigger>
          <TabsTrigger value="my">خدماتي ({myServices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-5 mt-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pr-9" placeholder="ابحث عن خدمة قانونية..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-all ${
                    activeCategory === cat.id
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "border-border/50 text-muted-foreground hover:border-primary/30"
                  }`}>
                  <Icon className="h-3.5 w-3.5" />{cat.label}
                </button>
              );
            })}
          </div>

          {/* Services Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => <div key={i} className="h-48 rounded-xl bg-muted/30 animate-pulse" />)}
            </div>
          ) : services.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">لا توجد خدمات في هذه الفئة</p>
                <p className="text-xs text-muted-foreground">كن أول من ينشر خدمته القانونية</p>
                <NewServiceDialog onCreated={refresh} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(s => <ServiceCard key={s.id} service={s} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my" className="space-y-4 mt-5">
          {myServices.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <Package className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-muted-foreground">لم تنشر أي خدمات بعد</p>
                <NewServiceDialog onCreated={refresh} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myServices.map(s => (
                <ServiceCard key={s.id} service={s} canEdit onDelete={() => deleteService.mutate(s.id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
