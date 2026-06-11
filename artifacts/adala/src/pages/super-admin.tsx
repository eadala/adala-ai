import { useState } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Building2, Users, Package, Tag, KeyRound, Activity,
  Settings, FolderTree, BookOpen, HeadphonesIcon, Plus, Loader2,
  Trash2, Edit2, Check, X, TrendingUp, DollarSign, BarChart3,
  AlertCircle, CheckCircle2, Clock, ChevronDown, Eye, EyeOff,
  Save, RefreshCw, Globe, Star, MessageSquare, Upload, FileText,
  ToggleLeft, ToggleRight, Search, Badge as BadgeIcon, Briefcase,
  Crown, Zap, Bell, Lock
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* Token injected by <SuperAdmin> on every render */
let _getToken: (() => Promise<string | null>) | null = null;

async function API(path: string, opts?: RequestInit) {
  const token = _getToken ? await _getToken() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/admin${path}`, { headers, ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function useAdmin<T>(path: string) {
  return useQuery<T>({ queryKey: ["admin", path], queryFn: () => API(path), retry: false });
}

function StatCard({ icon, label, value, sub, color }: { icon: any; label: string; value: any; sub?: string; color?: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-2xl font-black", color ?? "text-foreground")}>{value ?? "—"}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center opacity-80", color ? "" : "bg-primary/10 text-primary")} style={color ? { background: `${color}15`, color } : {}}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════ */
export default function SuperAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const { getToken } = useAuth();

  /* Inject token getter so module-level API() can use it */
  _getToken = getToken;

  const { data: stats, error: statsError } = useAdmin<any>("/stats");

  if (statsError?.message?.includes("403") || statsError?.message?.includes("غير مصرح")) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <Lock className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-lg font-black text-red-400">غير مصرح بالدخول</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          هذه اللوحة مخصصة لمالك المنصة فقط. تحقق من إعداد <code className="bg-muted px-1 rounded text-xs">PLATFORM_OWNER_EMAIL</code> في متغيرات البيئة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
          <Crown className="h-5 w-5 text-yellow-500" />
        </div>
        <div>
          <h1 className="text-xl font-black">لوحة التحكم العليا</h1>
          <p className="text-xs text-muted-foreground">Super Admin — أعلى صلاحية في النظام</p>
        </div>
        <Badge className="mr-auto bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs font-bold gap-1">
          <Crown className="h-3 w-3" /> Super Admin
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/50 p-1 rounded-xl">
          {TABS.map(t => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 py-1.5">
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard icon={<Building2 className="h-4 w-4" />} label="إجمالي المكاتب" value={stats?.totalOffices} color="#C9A84C" />
            <StatCard icon={<Users className="h-4 w-4" />} label="إجمالي المستخدمين" value={stats?.totalUsers} color="#3B82F6" />
            <StatCard icon={<Activity className="h-4 w-4" />} label="استهلاك الذكاء الاصطناعي" value={stats?.totalAiUsage?.toLocaleString()} sub="وحدة" color="#8B5CF6" />
            <StatCard icon={<DollarSign className="h-4 w-4" />} label="التكلفة الإجمالية" value={`$${Number(stats?.totalCost ?? 0).toFixed(2)}`} color="#10B981" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard icon={<Package className="h-4 w-4" />} label="الباقات النشطة" value={stats?.activePlans} color="#F59E0B" />
            <StatCard icon={<HeadphonesIcon className="h-4 w-4" />} label="تذاكر الدعم المفتوحة" value={stats?.openTickets} sub={`من ${stats?.totalTickets} إجمالي`} color="#EF4444" />
            <StatCard icon={<TrendingUp className="h-4 w-4" />} label="حالة النظام" value="مستقر" color="#10B981" />
          </div>
        </TabsContent>

        <TabsContent value="offices" className="mt-4"><OfficesTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="plans" className="mt-4"><PlansTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="discounts" className="mt-4"><DiscountsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="ai-keys" className="mt-4"><AiKeysTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="usage" className="mt-4"><UsageTab /></TabsContent>
        <TabsContent value="departments" className="mt-4"><DepartmentsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="legal" className="mt-4"><LegalSystemsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="support" className="mt-4"><SupportTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="settings" className="mt-4"><SettingsTab qc={qc} toast={toast} /></TabsContent>
      </Tabs>
    </div>
  );
}

const TABS = [
  { id: "overview",     label: "نظرة عامة",       icon: BarChart3 },
  { id: "offices",      label: "المكاتب",           icon: Building2 },
  { id: "users",        label: "المستخدمون",        icon: Users },
  { id: "plans",        label: "الباقات",           icon: Package },
  { id: "discounts",    label: "الخصومات",          icon: Tag },
  { id: "ai-keys",      label: "مفاتيح AI",         icon: KeyRound },
  { id: "usage",        label: "الاستهلاك",         icon: Activity },
  { id: "departments",  label: "الأقسام",           icon: FolderTree },
  { id: "legal",        label: "الأنظمة والأحكام",  icon: BookOpen },
  { id: "support",      label: "الدعم الفني",       icon: HeadphonesIcon },
  { id: "settings",     label: "الإعدادات",         icon: Settings },
];

/* ═══════════════════════════════════════════════════
   OFFICES TAB
═══════════════════════════════════════════════════ */
const PLAN_SLUG_COLORS: Record<string, string> = {
  free:         "#6B7280",
  starter:      "#3B82F6",
  professional: "#C9A84C",
  enterprise:   "#8B5CF6",
};
const PLAN_SLUG_LABELS: Record<string, string> = {
  free:         "مجاني",
  starter:      "مبتدئ",
  professional: "احترافي",
  enterprise:   "مؤسسي",
};

function OfficesTab({ qc, toast }: any) {
  const { data: offices = [], isLoading } = useAdmin<any[]>("/offices");
  const { data: plans = [] } = useAdmin<any[]>("/plans");
  const [search, setSearch] = useState("");
  const [planDialog, setPlanDialog] = useState<any>(null); // { id, currentPlan }

  const updateOffice = useMutation({
    mutationFn: ({ id, ...d }: any) => API(`/offices/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "/offices"] });
      toast({ title: "تم التحديث ✓" });
      setPlanDialog(null);
    },
  });

  const filtered = offices.filter((o: any) => !search || o.name?.includes(search) || o.slug?.includes(search) || o.email?.includes(search));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرابط..." className="max-w-sm" />
        <span className="text-xs text-muted-foreground">{filtered.length} مكتب</span>
      </div>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right text-xs">المكتب</TableHead>
                <TableHead className="text-right text-xs">الرابط</TableHead>
                <TableHead className="text-right text-xs">الباقة</TableHead>
                <TableHead className="text-right text-xs">المدينة</TableHead>
                <TableHead className="text-right text-xs">الحالة</TableHead>
                <TableHead className="text-right text-xs">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o: any) => {
                const planSlug = o.plan ?? "starter";
                const planColor = PLAN_SLUG_COLORS[planSlug] ?? "#C9A84C";
                const planLabel = PLAN_SLUG_LABELS[planSlug] ?? planSlug;
                return (
                  <TableRow key={o.id} className="hover:bg-muted/20">
                    <TableCell className="font-semibold text-sm">{o.name ?? "—"}</TableCell>
                    <TableCell>
                      <a href={`/firms/${o.slug}`} target="_blank" rel="noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {o.slug}
                      </a>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => setPlanDialog({ id: o.id, plan: planSlug })}
                        className="group flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: planColor }} />
                        <span className="text-xs font-medium">{planLabel}</span>
                        <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{o.city ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px]", o.isPublished ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground")}>
                        {o.isPublished ? "منشور" : "مسودة"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                          onClick={() => updateOffice.mutate({ id: o.id, isPublished: !o.isPublished })}>
                          {o.isPublished ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {o.isPublished ? "إخفاء" : "نشر"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Plan assignment dialog */}
      <Dialog open={!!planDialog} onOpenChange={() => setPlanDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> تغيير باقة المكتب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {[
              { slug: "free",         label: "مجاني",    color: "#6B7280", price: "مجاناً" },
              ...(plans as any[]).map((p: any) => ({
                slug:  p.slug ?? p.id,
                label: p.name,
                color: p.color ?? "#C9A84C",
                price: p.monthlyPrice > 0 ? `${p.monthlyPrice} ر.س/شهر` : "مجاناً",
              })),
            ].filter((item, idx, arr) => arr.findIndex(x => x.slug === item.slug) === idx)
              .map(item => (
              <button key={item.slug}
                onClick={() => {
                  if (planDialog) {
                    setPlanDialog((d: any) => ({ ...d, plan: item.slug }));
                  }
                }}
                className={cn(
                  "w-full flex items-center justify-between p-2.5 rounded-lg border text-right transition-all",
                  planDialog?.plan === item.slug
                    ? "border-primary bg-primary/10"
                    : "border-border/30 bg-muted/20 hover:bg-muted/40"
                )}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-semibold">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{item.price}</span>
                  {planDialog?.plan === item.slug && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPlanDialog(null)}>إلغاء</Button>
            <Button size="sm" disabled={updateOffice.isPending} className="gap-1.5 bg-primary hover:bg-primary/90"
              onClick={() => planDialog && updateOffice.mutate({ id: planDialog.id, plan: planDialog.plan })}>
              {updateOffice.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              حفظ التغيير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   USERS TAB
═══════════════════════════════════════════════════ */
function UsersTab({ qc, toast }: any) {
  const { data: users = [], isLoading } = useAdmin<any[]>("/users");
  const [search, setSearch] = useState("");

  const updateUser = useMutation({
    mutationFn: ({ id, ...d }: any) => API(`/users/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/users"] }); toast({ title: "تم التحديث ✓" }); },
  });

  const filtered = users.filter(u => !search || u.fullName?.includes(search) || u.email?.includes(search));

  const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    admin:       { label: "مدير", color: "text-yellow-400" },
    lawyer:      { label: "محامٍ", color: "text-blue-400" },
    paralegal:   { label: "مساعد قانوني", color: "text-purple-400" },
    viewer:      { label: "مشاهد", color: "text-gray-400" },
    super_admin: { label: "Super Admin", color: "text-yellow-500" },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو البريد..." className="max-w-sm" />
        <span className="text-xs text-muted-foreground">{filtered.length} مستخدم</span>
      </div>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right text-xs">المستخدم</TableHead>
                <TableHead className="text-right text-xs">البريد</TableHead>
                <TableHead className="text-right text-xs">الدور</TableHead>
                <TableHead className="text-right text-xs">الحالة</TableHead>
                <TableHead className="text-right text-xs">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => (
                <TableRow key={u.id} className="hover:bg-muted/20">
                  <TableCell className="font-semibold text-sm">{u.fullName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground" dir="ltr">{u.email}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={role => updateUser.mutate({ id: u.id, role })}>
                      <SelectTrigger className="h-7 text-xs w-[130px]">
                        <span className={ROLE_LABELS[u.role]?.color}>{ROLE_LABELS[u.role]?.label ?? u.role}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([v, { label }]) => (
                          <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[9px]", u.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
                      {u.status === "active" ? "نشط" : "موقوف"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={() => updateUser.mutate({ id: u.id, status: u.status === "active" ? "inactive" : "active" })}>
                      {u.status === "active" ? <Lock className="h-3 w-3 text-red-400" /> : <Check className="h-3 w-3 text-emerald-400" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLANS TAB
═══════════════════════════════════════════════════ */
/* ── Plan Feature Flags catalogue ── */
const PLAN_FEATURE_FLAGS = [
  /* ── Core ── */
  { key: "website",         label: "الموقع الإلكتروني",        icon: "🌐", desc: "صفحة تعريفية عامة للمكتب" },
  { key: "serviceStore",    label: "متجر الخدمات",             icon: "🛒", desc: "بيع الخدمات والاستشارات أونلاين" },
  { key: "payments",        label: "الدفع الإلكتروني",         icon: "💳", desc: "استقبال المدفوعات من العملاء" },
  { key: "booking",         label: "الحجوزات",                  icon: "📆", desc: "نظام حجز المواعيد الاستشارية" },
  { key: "calendar",        label: "التقويم القانوني",         icon: "📅", desc: "جدولة المواعيد والجلسات" },
  /* ── Marketing ── */
  { key: "blog",            label: "المدونة القانونية",         icon: "📝", desc: "نشر مقالات ومحتوى قانوني" },
  { key: "seo",             label: "تحسين SEO",                 icon: "🔍", desc: "تحسين الظهور في محركات البحث" },
  { key: "customDomain",    label: "دومين خاص",                icon: "🔗", desc: "نطاق إنترنت مخصص للمكتب" },
  /* ── Intelligence ── */
  { key: "ai",              label: "الذكاء الاصطناعي",         icon: "🤖", desc: "تحليل قانوني وتوليد وثائق" },
  { key: "ocr",             label: "OCR المستندات",             icon: "📄", desc: "استخراج نصوص من المستندات الممسوحة" },
  { key: "assistant",       label: "المساعد الإداري",          icon: "🧠", desc: "مساعد ذكي للمهام الإدارية اليومية" },
  /* ── Portal ── */
  { key: "clientPortal",    label: "بوابة العملاء",             icon: "👥", desc: "منصة متابعة مخصصة للعملاء" },
  { key: "advancedReports", label: "تقارير متقدمة",            icon: "📊", desc: "تحليلات وتقارير تفصيلية" },
  /* ── Enterprise ── */
  { key: "api",             label: "API Access",                icon: "⚡", desc: "ربط التطبيقات والأنظمة الخارجية" },
  { key: "whatsapp",        label: "واتساب أعمال",             icon: "💬", desc: "تواصل تلقائي عبر واتساب" },
  { key: "branches",        label: "فروع متعددة",              icon: "🏢", desc: "إدارة عدة فروع للمكتب" },
  { key: "workflow",        label: "Workflow آلي",              icon: "⚙️", desc: "مسارات عمل تلقائية متقدمة" },
  { key: "sla",             label: "SLA مميّز",                 icon: "🛡️", desc: "ضمان مستوى خدمة مميّز" },
  { key: "whiteLabel",      label: "White Label",               icon: "🏷️", desc: "إزالة علامة عدالة AI من الواجهة" },
];
const PLAN_COLORS = ["#6B7280","#C9A84C","#3B82F6","#8B5CF6","#EF4444","#10B981","#F59E0B","#EC4899"];
const EMPTY_PLAN_FORM = {
  name:"", nameEn:"", slug:"", description:"",
  price:0, monthlyPrice:0, yearlyPrice:0, color:"#C9A84C",
  maxUsers:5, maxCases:100, maxClients:50, maxAiCalls:500, maxStorageGb:5, maxBranches:0,
  isActive:true, isVisible:true, isHighlighted:false, features:"",
  featureFlags:{} as Record<string,boolean>, displayOrder:0,
};

/* ── Plan Card ── */
function PlanCard({ plan: p, onEdit, onDelete, onToggleVisibility }: any) {
  const enabledFlags = Object.entries(p.featureFlags ?? {}).filter(([, v]) => v);
  const monthly = Number(p.monthlyPrice ?? p.price ?? 0);
  const yearly  = Number(p.yearlyPrice ?? 0);
  return (
    <Card className={cn("relative overflow-hidden border-border/50 transition-all hover:shadow-md hover:shadow-black/20",
      !p.isVisible && "opacity-55", p.isHighlighted && "ring-2 ring-primary/40")}>
      <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: p.color ?? "#C9A84C" }} />
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <CardTitle className="text-base font-black truncate">{p.name}</CardTitle>
              {p.isHighlighted && <span className="text-sm">⭐</span>}
            </div>
            {p.nameEn && <p className="text-[10px] text-muted-foreground" dir="ltr">{p.nameEn}</p>}
            {p.description && <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">{p.description}</p>}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" title={p.isVisible ? "إخفاء من الصفحة" : "إظهار في الصفحة"} onClick={onToggleVisibility}>
              {p.isVisible ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {/* Prices */}
        {monthly > 0 ? (
          <div>
            <div className="text-2xl font-black" style={{ color: p.color ?? "#C9A84C" }}>
              {monthly.toLocaleString("ar-SA")}
              <span className="text-xs font-normal text-muted-foreground mr-1">ر.س / شهر</span>
            </div>
            {yearly > 0 && (
              <div className="text-xs text-muted-foreground">
                {yearly.toLocaleString("ar-SA")} ر.س / سنة
                {monthly > 0 && (
                  <span className="text-emerald-400 mr-1.5 text-[10px]">
                    (وفّر {Math.max(0, Math.round((1 - yearly / (12 * monthly)) * 100))}%)
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-2xl font-black text-emerald-400">مجاني</div>
        )}
        {/* Limits grid */}
        <div className="grid grid-cols-3 gap-1">
          {[{v:p.maxUsers,l:"مستخدم"},{v:p.maxCases,l:"قضية"},{v:p.maxClients,l:"عميل"},
            {v:p.maxAiCalls,l:"AI/شهر"},{v:p.maxStorageGb,l:"GB"},{v:p.maxBranches,l:"فرع"}].map(({v,l}) => (
            <div key={l} className="text-center p-1.5 rounded-lg bg-muted/50">
              <div className="text-xs font-bold">{v === 0 ? "∞" : (v ?? "—")}</div>
              <div className="text-[9px] text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
        {/* Feature chips */}
        {enabledFlags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {enabledFlags.slice(0,6).map(([key]) => {
              const f = PLAN_FEATURE_FLAGS.find(x => x.key === key);
              return f ? (
                <span key={key} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {f.icon} {f.label}
                </span>
              ) : null;
            })}
            {enabledFlags.length > 6 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/30">
                +{enabledFlags.length - 6}
              </span>
            )}
          </div>
        )}
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <Badge className={cn("text-[9px]", p.isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground")}>
            {p.isActive ? "نشط" : "معطل"}
          </Badge>
          {!p.isVisible && <Badge className="text-[9px] bg-muted text-muted-foreground">مخفي</Badge>}
          {p.slug && <Badge variant="outline" className="text-[9px] font-mono" dir="ltr">{p.slug}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════
   PLANS TAB
═══════════════════════════════════════════════════ */
function PlansTab({ qc, toast }: any) {
  const { data: plans = [], isLoading } = useAdmin<any[]>("/plans");
  const [dialog, setDialog] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_PLAN_FORM });
  const [dlgTab, setDlgTab] = useState("info");

  const save = useMutation({
    mutationFn: (d: any) => dialog?.id
      ? API(`/plans/${dialog.id}`, { method: "PATCH", body: JSON.stringify(d) })
      : API("/plans", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/plans"] }); setDialog(null); toast({ title: "تم الحفظ ✓" }); },
  });

  const deletePlan = useMutation({
    mutationFn: (id: string) => API(`/plans/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/plans"] }); toast({ title: "تم الحذف" }); },
  });

  const toggleVisibility = useMutation({
    mutationFn: ({ id, isVisible }: any) => API(`/plans/${id}`, { method: "PATCH", body: JSON.stringify({ isVisible }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "/plans"] }),
  });

  const openNew = () => {
    setForm({ ...EMPTY_PLAN_FORM, displayOrder: plans.length });
    setDlgTab("info");
    setDialog({});
  };
  const openEdit = (p: any) => {
    setForm({ ...EMPTY_PLAN_FORM, ...p, features: (p.features ?? []).join("\n"), featureFlags: p.featureFlags ?? {},
      monthlyPrice: p.monthlyPrice ?? p.price ?? 0, yearlyPrice: p.yearlyPrice ?? 0 });
    setDlgTab("info");
    setDialog(p);
  };
  const setFlag = (key: string, v: boolean) =>
    setForm((f: any) => ({ ...f, featureFlags: { ...f.featureFlags, [key]: v } }));

  const submit = () => save.mutate({
    ...form,
    features: String(form.features).split("\n").map((s: string) => s.trim()).filter(Boolean),
    price: Number(form.monthlyPrice || form.price),
    monthlyPrice: Number(form.monthlyPrice),
    yearlyPrice:  Number(form.yearlyPrice),
    maxUsers:     Number(form.maxUsers),
    maxCases:     Number(form.maxCases),
    maxClients:   Number(form.maxClients),
    maxAiCalls:   Number(form.maxAiCalls),
    maxStorageGb: Number(form.maxStorageGb),
    maxBranches:  Number(form.maxBranches),
    displayOrder: Number(form.displayOrder),
  });

  const activePlans  = plans.filter((p: any) => p.isActive);
  const visiblePlans = plans.filter((p: any) => p.isVisible !== false);

  return (
    <div className="space-y-4">
      {/* Header stats + CTA */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          <div className="text-center px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30">
            <div className="text-sm font-black">{plans.length}</div>
            <div className="text-[10px] text-muted-foreground">إجمالي</div>
          </div>
          <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-sm font-black text-emerald-400">{activePlans.length}</div>
            <div className="text-[10px] text-emerald-400/70">نشطة</div>
          </div>
          <div className="text-center px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <div className="text-sm font-black text-primary">{visiblePlans.length}</div>
            <div className="text-[10px] text-primary/70">ظاهرة</div>
          </div>
        </div>
        <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90" onClick={openNew}>
          <Plus className="h-4 w-4" /> باقة جديدة
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-6 w-6 text-muted-foreground" /></div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">لا توجد باقات</p>
          <p className="text-xs opacity-60 mt-1">ابدأ بإضافة أول باقة اشتراك</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...plans].sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)).map((p: any) => (
            <PlanCard
              key={p.id} plan={p}
              onEdit={() => openEdit(p)}
              onDelete={() => { if (confirm(`حذف باقة "${p.name}"؟`)) deletePlan.mutate(p.id); }}
              onToggleVisibility={() => toggleVisibility.mutate({ id: p.id, isVisible: p.isVisible === false })}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {dialog?.id ? "تعديل الباقة" : "إنشاء باقة جديدة"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={dlgTab} onValueChange={setDlgTab} className="mt-1">
            <TabsList className="grid grid-cols-3 w-full text-xs">
              <TabsTrigger value="info">معلومات</TabsTrigger>
              <TabsTrigger value="features" className="gap-1">
                الميزات
                {Object.values(form.featureFlags ?? {}).filter(Boolean).length > 0 && (
                  <Badge className="h-4 text-[9px] px-1 bg-primary/20 text-primary border-primary/30">
                    {Object.values(form.featureFlags ?? {}).filter(Boolean).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="limits">الحدود</TabsTrigger>
            </TabsList>

            {/* ─ Tab: Info ─ */}
            <TabsContent value="info" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">الاسم (عربي) *</Label>
                  <Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="مبتدئ" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">Name (English)</Label>
                  <Input value={form.nameEn ?? ""} onChange={e => setForm((f: any) => ({ ...f, nameEn: e.target.value }))} dir="ltr" placeholder="Starter" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">المعرّف (slug)</Label>
                  <Input value={form.slug ?? ""} onChange={e => setForm((f: any) => ({ ...f, slug: e.target.value }))} dir="ltr" placeholder="starter" /></div>
                <div><Label className="text-xs font-semibold mb-1 block">الترتيب</Label>
                  <Input type="number" value={form.displayOrder} onChange={e => setForm((f: any) => ({ ...f, displayOrder: e.target.value }))} /></div>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">الوصف</Label>
                <Input value={form.description ?? ""} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="مثالي للمكاتب الناشئة" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs font-semibold mb-1 block">السعر الشهري (ر.س)</Label>
                  <Input type="number" value={form.monthlyPrice ?? 0} onChange={e => setForm((f: any) => ({ ...f, monthlyPrice: e.target.value, price: e.target.value }))} /></div>
                <div><Label className="text-xs font-semibold mb-1 block">السعر السنوي (ر.س)</Label>
                  <Input type="number" value={form.yearlyPrice ?? 0} onChange={e => setForm((f: any) => ({ ...f, yearlyPrice: e.target.value }))} /></div>
              </div>
              {/* Color picker */}
              <div>
                <Label className="text-xs font-semibold mb-2 block">لون الباقة</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PLAN_COLORS.map(c => (
                    <button key={c} onClick={() => setForm((f: any) => ({ ...f, color: c }))}
                      className={cn("h-6 w-6 rounded-full border-2 transition-all hover:scale-110",
                        form.color === c ? "border-white scale-110 shadow-lg" : "border-transparent")}
                      style={{ backgroundColor: c }} />
                  ))}
                  <Input type="color" value={form.color ?? "#C9A84C"} onChange={e => setForm((f: any) => ({ ...f, color: e.target.value }))}
                    className="h-6 w-10 p-0.5 border-border/50 cursor-pointer bg-transparent rounded" />
                </div>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">ملاحظات إضافية (سطر لكل عنصر)</Label>
                <Textarea value={form.features ?? ""} onChange={e => setForm((f: any) => ({ ...f, features: e.target.value }))}
                  rows={3} className="resize-none text-xs" placeholder="دعم على مدار الساعة&#10;تحديثات مجانية" /></div>
              <div className="flex items-center gap-5 pt-1 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch checked={form.isActive} onCheckedChange={v => setForm((f: any) => ({ ...f, isActive: v }))} />
                  <Label className="text-xs cursor-pointer">نشط</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.isVisible ?? true} onCheckedChange={v => setForm((f: any) => ({ ...f, isVisible: v }))} />
                  <Label className="text-xs cursor-pointer">ظاهر في صفحة الأسعار</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.isHighlighted} onCheckedChange={v => setForm((f: any) => ({ ...f, isHighlighted: v }))} />
                  <Label className="text-xs cursor-pointer">⭐ الأكثر شيوعاً</Label>
                </div>
              </div>
            </TabsContent>

            {/* ─ Tab: Features ─ */}
            <TabsContent value="features" className="mt-3">
              <p className="text-xs text-muted-foreground mb-3">فعّل الميزات المتاحة لهذه الباقة — كل ميزة يمكن تشغيلها أو إيقافها</p>
              <div className="space-y-1.5">
                {PLAN_FEATURE_FLAGS.map(f => (
                  <div key={f.key} className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg border transition-all",
                    form.featureFlags?.[f.key] ? "border-primary/30 bg-primary/5" : "border-border/30 bg-muted/20"
                  )}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-base leading-none">{f.icon}</span>
                      <div>
                        <div className="text-xs font-semibold">{f.label}</div>
                        <div className="text-[10px] text-muted-foreground">{f.desc}</div>
                      </div>
                    </div>
                    <Switch checked={form.featureFlags?.[f.key] ?? false} onCheckedChange={v => setFlag(f.key, v)} />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ─ Tab: Limits ─ */}
            <TabsContent value="limits" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">اضبط الحدود القصوى للباقة</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key:"maxUsers",     label:"المستخدمون",              icon:"👤", unit:"مستخدم" },
                  { key:"maxCases",     label:"القضايا",                 icon:"⚖️", unit:"قضية" },
                  { key:"maxClients",   label:"العملاء",                 icon:"👥", unit:"عميل" },
                  { key:"maxAiCalls",   label:"طلبات الذكاء الاصطناعي", icon:"🤖", unit:"طلب/شهر" },
                  { key:"maxStorageGb", label:"التخزين",                 icon:"💾", unit:"GB" },
                  { key:"maxBranches",  label:"الفروع",                  icon:"🏢", unit:"فرع" },
                ].map(({ key, label, icon, unit }) => (
                  <div key={key} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                    <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                      <span>{icon}</span> {label}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} value={form[key] ?? 0}
                        onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                        className="h-8 text-sm" />
                      <span className="text-[10px] text-muted-foreground shrink-0">{unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
                💡 القيمة <strong>0</strong> = غير محدود
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setDialog(null)}>إلغاء</Button>
            <Button size="sm" disabled={!form.name || save.isPending} onClick={submit} className="gap-2 bg-primary hover:bg-primary/90">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الباقة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DISCOUNTS TAB
═══════════════════════════════════════════════════ */
function DiscountsTab({ qc, toast }: any) {
  const { data: codes = [], isLoading } = useAdmin<any[]>("/discounts");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", type: "percent", value: 10, maxUses: 100, isActive: true });

  const add = useMutation({
    mutationFn: (d: any) => API("/discounts", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/discounts"] }); setShowForm(false); toast({ title: "تم الإنشاء ✓" }); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: any) => API(`/discounts/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "/discounts"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => API(`/discounts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/discounts"] }); toast({ title: "تم الحذف" }); },
  });

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> كود خصم جديد</Button>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right text-xs">الكود</TableHead>
                <TableHead className="text-right text-xs">النوع</TableHead>
                <TableHead className="text-right text-xs">القيمة</TableHead>
                <TableHead className="text-right text-xs">الاستخدام</TableHead>
                <TableHead className="text-right text-xs">الحالة</TableHead>
                <TableHead className="text-right text-xs">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map(c => (
                <TableRow key={c.id} className="hover:bg-muted/20">
                  <TableCell><code className="font-mono font-bold text-primary text-sm bg-primary/5 px-2 py-0.5 rounded">{c.code}</code></TableCell>
                  <TableCell className="text-xs">{c.type === "percent" ? "نسبة مئوية" : "مبلغ ثابت"}</TableCell>
                  <TableCell className="font-bold text-sm">{c.type === "percent" ? `${c.value}%` : `${c.value} ر.س`}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.usedCount} / {c.maxUses}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[9px]", c.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {c.isActive ? "نشط" : "معطل"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle.mutate({ id: c.id, isActive: !c.isActive })}>
                        {c.isActive ? <ToggleRight className="h-3.5 w-3.5 text-emerald-400" /> : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => del.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>كود خصم جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">الكود *</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME20" dir="ltr" className="font-mono" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">النوع</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="percent">نسبة %</SelectItem><SelectItem value="fixed">مبلغ ثابت</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">القيمة</Label>
                <Input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">الحد الأقصى للاستخدامات</Label>
              <Input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button disabled={!form.code || add.isPending} onClick={() => add.mutate(form)} className="gap-2">
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إنشاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AI API KEYS TAB
═══════════════════════════════════════════════════ */
function AiKeysTab({ qc, toast }: any) {
  const { data: keys = [], isLoading } = useAdmin<any[]>("/ai-keys");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: "openai", keyLabel: "", keyValue: "" });
  const [showKey, setShowKey] = useState(false);

  const add = useMutation({
    mutationFn: (d: any) => API("/ai-keys", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/ai-keys"] }); setShowForm(false); setForm({ provider: "openai", keyLabel: "", keyValue: "" }); toast({ title: "تم إضافة المفتاح ✓" }); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: any) => API(`/ai-keys/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "/ai-keys"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => API(`/ai-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/ai-keys"] }); toast({ title: "تم الحذف" }); },
  });

  const PROVIDERS = [
    { value: "openai", label: "OpenAI", color: "#10A37F" },
    { value: "anthropic", label: "Anthropic", color: "#D97706" },
    { value: "gemini", label: "Google Gemini", color: "#4285F4" },
    { value: "groq", label: "Groq", color: "#F97316" },
  ];

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> إضافة مفتاح AI</Button>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <div className="space-y-2">
          {keys.map(k => {
            const prov = PROVIDERS.find(p => p.value === k.provider);
            return (
              <Card key={k.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: `${prov?.color}20`, color: prov?.color }}>{k.provider.slice(0, 2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-sm">{k.keyLabel}</span>
                        <Badge className="text-[9px] bg-muted text-muted-foreground">{prov?.label ?? k.provider}</Badge>
                        {k.isActive && <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">نشط</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <code dir="ltr">{k.keyMasked}</code>
                        <span>•</span>
                        <span>{k.usageCount.toLocaleString()} استخدام</span>
                        <span>•</span>
                        <span>${k.totalCost.toFixed(4)} تكلفة</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle.mutate({ id: k.id, isActive: !k.isActive })}>
                        {k.isActive ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => del.mutate(k.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {keys.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">لا توجد مفاتيح — أضف مفتاح API أول</p>}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>إضافة مفتاح AI</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">المزود</Label>
              <Select value={form.provider} onValueChange={v => setForm(f => ({ ...f, provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">تسمية المفتاح</Label>
              <Input value={form.keyLabel} onChange={e => setForm(f => ({ ...f, keyLabel: e.target.value }))} placeholder="مفتاح الإنتاج — OpenAI" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">المفتاح السري *</Label>
              <div className="relative">
                <Input value={form.keyValue} onChange={e => setForm(f => ({ ...f, keyValue: e.target.value }))} dir="ltr" type={showKey ? "text" : "password"} className="font-mono text-xs pl-10" placeholder="sk-..." />
                <button onClick={() => setShowKey(v => !v)} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">يُخزَّن مشفراً — لن يظهر مجدداً كاملاً</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button disabled={!form.keyValue || !form.keyLabel || add.isPending} onClick={() => add.mutate(form)} className="gap-2">
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   USAGE TAB
═══════════════════════════════════════════════════ */
function UsageTab() {
  const { data, isLoading } = useAdmin<any>("/usage");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold">ملخص الاستهلاك حسب الميزة</h3>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.summary ?? []).map((s: any) => (
              <Card key={s.feature} className="border-border/50">
                <CardContent className="p-4">
                  <div className="font-bold text-sm mb-1">{s.feature}</div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span><strong className="text-foreground">{Number(s.totalUnits ?? 0).toLocaleString()}</strong> وحدة</span>
                    <span><strong className="text-foreground">${Number(s.totalCost ?? 0).toFixed(3)}</strong></span>
                    <span>{s.count} طلب</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <h3 className="text-sm font-bold pt-2">آخر السجلات</h3>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right text-xs">الميزة</TableHead>
                  <TableHead className="text-right text-xs">الوحدات</TableHead>
                  <TableHead className="text-right text-xs">التكلفة</TableHead>
                  <TableHead className="text-right text-xs">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.logs ?? []).slice(0, 50).map((l: any) => (
                  <TableRow key={l.id} className="hover:bg-muted/20">
                    <TableCell className="text-xs font-medium">{l.feature}</TableCell>
                    <TableCell className="text-xs">{l.units}</TableCell>
                    <TableCell className="text-xs">${l.cost.toFixed(4)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString("ar-SA")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DEPARTMENTS TAB
═══════════════════════════════════════════════════ */
function DepartmentsTab({ qc, toast }: any) {
  const { data: depts = [], isLoading } = useAdmin<any[]>("/departments");
  const { data: titles = [] } = useAdmin<any[]>("/job-titles");
  const [deptDialog, setDeptDialog] = useState(false);
  const [titleDialog, setTitleDialog] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", nameEn: "", description: "", color: "#C9A84C" });
  const [titleForm, setTitleForm] = useState({ name: "", nameEn: "", departmentId: "", level: "staff" });

  const addDept = useMutation({
    mutationFn: (d: any) => API("/departments", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/departments"] }); setDeptDialog(false); toast({ title: "تمت الإضافة ✓" }); },
  });
  const delDept = useMutation({
    mutationFn: (id: string) => API(`/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "/departments"] }),
  });
  const addTitle = useMutation({
    mutationFn: (d: any) => API("/job-titles", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/job-titles"] }); setTitleDialog(false); toast({ title: "تمت الإضافة ✓" }); },
  });
  const delTitle = useMutation({
    mutationFn: (id: string) => API(`/job-titles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "/job-titles"] }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Departments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">الأقسام</h3>
          <Button size="sm" className="gap-1" onClick={() => { setDeptForm({ name: "", nameEn: "", description: "", color: "#C9A84C" }); setDeptDialog(true); }}><Plus className="h-3.5 w-3.5" /> قسم جديد</Button>
        </div>
        {isLoading ? <Loader2 className="animate-spin mx-auto h-5 w-5" /> : depts.map(d => (
          <div key={d.id} className="flex items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/20">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ background: d.color ?? "#C9A84C" }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{d.name}</div>
              {d.nameEn && <div className="text-[10px] text-muted-foreground" dir="ltr">{d.nameEn}</div>}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => delDept.mutate(d.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>

      {/* Job Titles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">المسميات الوظيفية</h3>
          <Button size="sm" className="gap-1" onClick={() => { setTitleForm({ name: "", nameEn: "", departmentId: "", level: "staff" }); setTitleDialog(true); }}><Plus className="h-3.5 w-3.5" /> مسمى جديد</Button>
        </div>
        {(titles as any[]).map((t: any) => (
          <div key={t.id} className="flex items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/20">
            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{t.name}</div>
              {t.nameEn && <div className="text-[10px] text-muted-foreground" dir="ltr">{t.nameEn}</div>}
            </div>
            <Badge className="text-[9px] bg-muted text-muted-foreground">{t.level}</Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => delTitle.mutate(t.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>

      {/* Dept Dialog */}
      <Dialog open={deptDialog} onOpenChange={setDeptDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>قسم جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">الاسم (عربي) *</Label><Input value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">Name (English)</Label><Input value={deptForm.nameEn} onChange={e => setDeptForm(f => ({ ...f, nameEn: e.target.value }))} dir="ltr" /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">الوصف</Label><Input value={deptForm.description} onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">اللون</Label><input type="color" value={deptForm.color} onChange={e => setDeptForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-full rounded-md border border-input cursor-pointer" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptDialog(false)}>إلغاء</Button>
            <Button disabled={!deptForm.name || addDept.isPending} onClick={() => addDept.mutate(deptForm)} className="gap-2">
              {addDept.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Title Dialog */}
      <Dialog open={titleDialog} onOpenChange={setTitleDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>مسمى وظيفي جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">الاسم (عربي) *</Label><Input value={titleForm.name} onChange={e => setTitleForm(f => ({ ...f, name: e.target.value }))} placeholder="محامٍ أول" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">Name (English)</Label><Input value={titleForm.nameEn} onChange={e => setTitleForm(f => ({ ...f, nameEn: e.target.value }))} dir="ltr" placeholder="Senior Lawyer" /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">القسم</Label>
              <Select value={titleForm.departmentId} onValueChange={v => setTitleForm(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر قسماً" /></SelectTrigger>
                <SelectContent>{(depts as any[]).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">المستوى</Label>
              <Select value={titleForm.level} onValueChange={v => setTitleForm(f => ({ ...f, level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">تنفيذي</SelectItem>
                  <SelectItem value="manager">مدير</SelectItem>
                  <SelectItem value="senior">أول</SelectItem>
                  <SelectItem value="staff">موظف</SelectItem>
                  <SelectItem value="intern">متدرب</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTitleDialog(false)}>إلغاء</Button>
            <Button disabled={!titleForm.name || addTitle.isPending} onClick={() => addTitle.mutate(titleForm)} className="gap-2">
              {addTitle.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LEGAL SYSTEMS TAB
═══════════════════════════════════════════════════ */
function LegalSystemsTab({ qc, toast }: any) {
  const { data: items = [], isLoading } = useAdmin<any[]>("/legal-systems");
  const [dialog, setDialog] = useState<any>(null);
  const [form, setForm] = useState({ title: "", titleEn: "", category: "نظام", content: "", source: "", effectiveDate: "", version: "", isActive: true });

  const save = useMutation({
    mutationFn: (d: any) => dialog?.id
      ? API(`/legal-systems/${dialog.id}`, { method: "PATCH", body: JSON.stringify(d) })
      : API("/legal-systems", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/legal-systems"] }); setDialog(null); toast({ title: "تم الحفظ ✓" }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => API(`/legal-systems/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/legal-systems"] }); toast({ title: "تم الحذف" }); },
  });

  const CATS = ["نظام", "لائحة", "حكم قضائي", "قرار وزاري", "تعميم", "اتفاقية", "تحديث"];

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-1.5" onClick={() => { setForm({ title: "", titleEn: "", category: "نظام", content: "", source: "", effectiveDate: "", version: "", isActive: true }); setDialog({}); }}>
        <Plus className="h-4 w-4" /> إضافة نظام/حكم
      </Button>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <div className="space-y-2">
          {items.map(item => (
            <Card key={item.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-bold text-sm">{item.title}</span>
                      <Badge className="text-[9px] bg-muted text-muted-foreground">{item.category}</Badge>
                      {!item.isActive && <Badge className="text-[9px] bg-red-500/10 text-red-400">معطل</Badge>}
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      {item.source && <span>المصدر: {item.source}</span>}
                      {item.effectiveDate && <span>النفاذ: {item.effectiveDate}</span>}
                      {item.version && <span>الإصدار: {item.version}</span>}
                      <span>{item.viewCount} مشاهدة</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm({ ...item }); setDialog(item); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => del.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">لا توجد أنظمة — أضف أول نظام أو حكم</p>}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog?.id ? "تعديل" : "إضافة نظام / حكم"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">العنوان (عربي) *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">Title (English)</Label><Input value={form.titleEn} onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))} dir="ltr" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">التصنيف</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">الإصدار</Label><Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">تاريخ النفاذ</Label><Input value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} placeholder="1446/01/01" /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">المصدر</Label><Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="وزارة العدل، مجلس الوزراء..." /></div>
            <div><Label className="text-xs font-semibold mb-1 block">المحتوى / ملخص النظام</Label>
              <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} className="resize-none text-xs" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} /><Label className="text-xs">نشط وظاهر للمستخدمين</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button>
            <Button disabled={!form.title || save.isPending} onClick={() => save.mutate(form)} className="gap-2">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SUPPORT TICKETS TAB
═══════════════════════════════════════════════════ */
function SupportTab({ qc, toast }: any) {
  const { data: tickets = [], isLoading } = useAdmin<any[]>("/support");
  const [selected, setSelected] = useState<any>(null);
  const [response, setResponse] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const update = useMutation({
    mutationFn: ({ id, ...d }: any) => API(`/support/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/support"] }); toast({ title: "تم التحديث ✓" }); },
  });

  const filtered = tickets.filter((t: any) => filterStatus === "all" || t.status === filterStatus);

  const PRIORITY = { low: { label: "منخفض", color: "text-gray-400" }, medium: { label: "متوسط", color: "text-yellow-400" }, high: { label: "عالٍ", color: "text-orange-400" }, urgent: { label: "عاجل", color: "text-red-400" } };
  const STATUS = { open: { label: "مفتوح", color: "bg-blue-500/10 text-blue-400" }, in_progress: { label: "قيد المعالجة", color: "bg-yellow-500/10 text-yellow-400" }, resolved: { label: "محلول", color: "bg-emerald-500/10 text-emerald-400" }, closed: { label: "مغلق", color: "bg-muted text-muted-foreground" } };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* List */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {["all", "open", "in_progress", "resolved"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={cn("text-xs px-2.5 py-1 rounded-lg border transition-colors", filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
              {s === "all" ? "الكل" : (STATUS as any)[s]?.label}
            </button>
          ))}
        </div>
        {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : filtered.map((t: any) => (
          <div key={t.id} onClick={() => { setSelected(t); setResponse(t.response ?? ""); }}
            className={cn("p-3 rounded-xl border cursor-pointer transition-colors", selected?.id === t.id ? "border-primary/40 bg-primary/5" : "border-border/50 hover:bg-muted/20")}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-semibold text-sm line-clamp-1">{t.subject}</span>
              <Badge className={cn("text-[9px] shrink-0", (STATUS as any)[t.status]?.color)}>{(STATUS as any)[t.status]?.label}</Badge>
            </div>
            <div className="text-[10px] text-muted-foreground flex gap-2">
              <span>{t.userName}</span><span>·</span>
              <span className={(PRIORITY as any)[t.priority]?.color}>{(PRIORITY as any)[t.priority]?.label}</span><span>·</span>
              <span>{new Date(t.createdAt).toLocaleDateString("ar-SA")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail */}
      {selected ? (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-border/50">
            <h3 className="font-bold mb-1">{selected.subject}</h3>
            <div className="text-xs text-muted-foreground mb-3">{selected.userName} — {selected.userEmail}</div>
            <p className="text-sm text-muted-foreground leading-relaxed">{selected.body}</p>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1 block">الرد على التذكرة</Label>
            <Textarea value={response} onChange={e => setResponse(e.target.value)} rows={4} className="resize-none text-xs" placeholder="اكتب ردك هنا..." />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" className="gap-1.5 flex-1" onClick={() => update.mutate({ id: selected.id, response, status: "resolved" })}>
              {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <CheckCircle2 className="h-3.5 w-3.5" /> حل وإغلاق
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => update.mutate({ id: selected.id, response, status: "in_progress" })}>
              <Clock className="h-3.5 w-3.5" /> قيد المعالجة
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          <div className="text-center"><HeadphonesIcon className="h-8 w-8 mx-auto mb-2 opacity-20" /><p>اختر تذكرة لعرض التفاصيل</p></div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SETTINGS TAB
═══════════════════════════════════════════════════ */
function SettingsTab({ qc, toast }: any) {
  const { data: settings = [], isLoading, refetch } = useAdmin<any[]>("/settings");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [newForm, setNewForm] = useState({ key: "", label: "", value: "", description: "", group: "general" });
  const [showNew, setShowNew] = useState(false);

  const save = useMutation({
    mutationFn: ({ key, value }: any) => API(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: () => { refetch(); setEditKey(null); toast({ title: "تم الحفظ ✓" }); },
  });

  const addNew = useMutation({
    mutationFn: (d: any) => API("/settings", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { refetch(); setShowNew(false); toast({ title: "تمت الإضافة ✓" }); },
  });

  const GROUPS: Record<string, string> = { general: "عام", payment: "الدفع", ai: "الذكاء الاصطناعي", email: "البريد الإلكتروني", security: "الأمان" };
  const grouped = (settings as any[]).reduce((acc: any, s: any) => { (acc[s.group] = acc[s.group] ?? []).push(s); return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">إعدادات المنصة</h3>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5" /> إعداد جديد</Button>
      </div>

      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : Object.entries(grouped).map(([group, groupSettings]: any) => (
        <div key={group}>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{GROUPS[group] ?? group}</h4>
          <div className="space-y-1">
            {groupSettings.map((s: any) => (
              <div key={s.key} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/10 group">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{s.label}</div>
                  {s.description && <div className="text-[10px] text-muted-foreground">{s.description}</div>}
                </div>
                {editKey === s.key ? (
                  <div className="flex items-center gap-2">
                    <Input value={editVal} onChange={e => setEditVal(e.target.value)} className="h-7 text-xs w-48" dir="ltr" />
                    <Button size="icon" className="h-7 w-7" onClick={() => save.mutate({ key: s.key, value: editVal })}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditKey(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground max-w-[180px] truncate" dir="ltr">{s.value || "—"}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditKey(s.key); setEditVal(s.value); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Default settings prompt */}
      {(settings as any[]).length === 0 && !isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          <Settings className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">لا توجد إعدادات بعد — أضف إعداداً للبدء</p>
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>إعداد جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">المفتاح (key) *</Label><Input value={newForm.key} onChange={e => setNewForm(f => ({ ...f, key: e.target.value }))} dir="ltr" placeholder="site_name" className="font-mono text-xs" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">التسمية *</Label><Input value={newForm.label} onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))} placeholder="اسم المنصة" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">القيمة</Label><Input value={newForm.value} onChange={e => setNewForm(f => ({ ...f, value: e.target.value }))} dir="ltr" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">الوصف</Label><Input value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">المجموعة</Label>
              <Select value={newForm.group} onValueChange={v => setNewForm(f => ({ ...f, group: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(GROUPS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>إلغاء</Button>
            <Button disabled={!newForm.key || !newForm.label || addNew.isPending} onClick={() => addNew.mutate(newForm)} className="gap-2">
              {addNew.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
