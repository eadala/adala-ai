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
  Crown, Zap, Bell, Lock, Code2, Terminal, Cpu, HardDrive,
  Server, Copy, Fingerprint, Wifi, Database, ShieldAlert,
  CircleCheck, CircleX, KeySquare, Cloud, Link2,
  Shield, CheckCircle, XCircle, Layers, PlugZap
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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import {
  FileBarChart2, Gavel, FileSignature, ShieldCheck as SecurityIcon,
  Layout, AlertOctagon, Download, ChevronRight, Filter as FilterIcon,
  User, Banknote, TrendingDown, CheckSquare, AlertCircle as ACircle,
  Globe2, Newspaper, ListOrdered, HelpCircle, PenLine, Info,
} from "lucide-react";

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
          <OverviewTab stats={stats} />
        </TabsContent>

        <TabsContent value="offices"   className="mt-4"><OfficesTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="users"     className="mt-4"><UsersTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="cases"     className="mt-4"><PlatformCasesTab /></TabsContent>
        <TabsContent value="contracts" className="mt-4"><PlatformContractsTab /></TabsContent>
        <TabsContent value="finance"   className="mt-4"><PlatformFinanceTab /></TabsContent>
        <TabsContent value="reports"   className="mt-4"><PlatformReportsTab /></TabsContent>
        <TabsContent value="plans"     className="mt-4"><PlansTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="discounts" className="mt-4"><DiscountsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="ai-keys"   className="mt-4"><AiKeysTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="usage"     className="mt-4"><UsageTab /></TabsContent>
        <TabsContent value="departments" className="mt-4"><DepartmentsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="legal"     className="mt-4"><LegalSystemsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="support"   className="mt-4"><SupportTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="security"  className="mt-4"><PlatformSecurityTab /></TabsContent>
        <TabsContent value="website"   className="mt-4"><PlatformWebsiteTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="settings"  className="mt-4"><SettingsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="developer" className="mt-4"><DevCenterTab toast={toast} /></TabsContent>
        <TabsContent value="hosting"   className="mt-4"><HostingCenterTab toast={toast} /></TabsContent>
      </Tabs>
    </div>
  );
}

const TABS = [
  { id: "overview",     label: "نظرة عامة",        icon: BarChart3 },
  { id: "offices",      label: "المكاتب",            icon: Building2 },
  { id: "users",        label: "المستخدمون",         icon: Users },
  { id: "cases",        label: "القضايا",            icon: Gavel },
  { id: "contracts",    label: "العقود",             icon: FileSignature },
  { id: "finance",      label: "المالية",            icon: Banknote },
  { id: "reports",      label: "التقارير",           icon: FileBarChart2 },
  { id: "plans",        label: "الباقات",            icon: Package },
  { id: "discounts",    label: "الخصومات",           icon: Tag },
  { id: "ai-keys",      label: "مفاتيح AI",          icon: KeyRound },
  { id: "usage",        label: "الاستهلاك",          icon: Activity },
  { id: "departments",  label: "الأقسام",            icon: FolderTree },
  { id: "legal",        label: "الأنظمة",            icon: BookOpen },
  { id: "support",      label: "الدعم الفني",        icon: HeadphonesIcon },
  { id: "security",     label: "الأمن",              icon: SecurityIcon },
  { id: "website",      label: "الموقع الإلكتروني",  icon: Layout },
  { id: "settings",     label: "الإعدادات",          icon: Settings },
  { id: "developer",    label: "مركز المطور",         icon: Code2 },
  { id: "hosting",      label: "مركز الاستضافة",     icon: Globe },
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

/* ═══════════════════════════════════════════════════
   DEVELOPER CENTER TAB
═══════════════════════════════════════════════════ */
async function DEV_API(path: string, opts?: RequestInit) {
  const token = _getToken ? await _getToken() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/developer${path}`, { headers, ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

const PERM_LABELS: Record<string, { label: string; color: string }> = {
  read:  { label: "قراءة فقط", color: "#3B82F6" },
  write: { label: "قراءة + كتابة", color: "#F59E0B" },
  full:  { label: "صلاحية كاملة", color: "#EF4444" },
};

function DevCenterTab({ toast }: any) {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState("system");
  const [showCreate, setShowCreate] = useState(false);
  const [newToken, setNewToken] = useState<any>(null);
  const [createForm, setCreateForm] = useState({ name: "", permissions: "read", description: "", expiresInDays: "" });
  const [copied, setCopied] = useState(false);

  const { data: sysInfo, isLoading: sysLoad, refetch: refetchSys } = useQuery<any>({
    queryKey: ["dev", "system-info"],
    queryFn: () => DEV_API("/system-info"),
    retry: false,
  });

  const { data: dbStats, isLoading: dbLoad } = useQuery<any>({
    queryKey: ["dev", "db-stats"],
    queryFn: () => DEV_API("/db-stats"),
    retry: false,
  });

  const { data: tokens = [], isLoading: tokLoad, refetch: refetchTok } = useQuery<any[]>({
    queryKey: ["dev", "tokens"],
    queryFn: () => DEV_API("/tokens"),
    retry: false,
  });

  const { data: envInfo = {}, isLoading: envLoad } = useQuery<Record<string, string>>({
    queryKey: ["dev", "env-info"],
    queryFn: () => DEV_API("/env-info"),
    retry: false,
  });

  const createTok = useMutation({
    mutationFn: (body: any) => DEV_API("/tokens", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      setNewToken(data);
      setCreateForm({ name: "", permissions: "read", description: "", expiresInDays: "" });
      qc.invalidateQueries({ queryKey: ["dev", "tokens"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const revokeTok = useMutation({
    mutationFn: (id: string) => DEV_API(`/tokens/${id}/revoke`, { method: "PATCH" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dev", "tokens"] }); toast({ title: "تم إلغاء التوكن" }); },
  });

  const deleteTok = useMutation({
    mutationFn: (id: string) => DEV_API(`/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dev", "tokens"] }); toast({ title: "تم حذف التوكن" }); },
  });

  function copyToken(t: string) {
    navigator.clipboard.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const MEM = sysInfo?.memory;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Code2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-base font-black">مركز المطور</h2>
            <p className="text-xs text-muted-foreground">إدارة الوصول الخارجي ومراقبة النظام</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={() => refetchSys()}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="system"   className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><Server className="h-3.5 w-3.5" /> النظام</TabsTrigger>
          <TabsTrigger value="database" className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><Database className="h-3.5 w-3.5" /> قاعدة البيانات</TabsTrigger>
          <TabsTrigger value="tokens"   className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><KeySquare className="h-3.5 w-3.5" /> توكنات المطورين</TabsTrigger>
          <TabsTrigger value="env"      className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5"><Terminal className="h-3.5 w-3.5" /> متغيرات البيئة</TabsTrigger>
        </TabsList>

        {/* ── SYSTEM ── */}
        <TabsContent value="system" className="mt-4">
          {sysLoad ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {/* Main health cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border-border/50"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">وقت التشغيل</p>
                  <p className="text-xl font-black text-emerald-400">{sysInfo?.uptime ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">منذ آخر إعادة تشغيل</p>
                </CardContent></Card>

                <Card className="border-border/50"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">إصدار Node.js</p>
                  <p className="text-xl font-black text-blue-400 font-mono">{sysInfo?.nodeVersion ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sysInfo?.platform} / {sysInfo?.arch}</p>
                </CardContent></Card>

                <Card className="border-border/50"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">قاعدة البيانات</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {sysInfo?.dbStatus === "متصل"
                      ? <CircleCheck className="h-5 w-5 text-emerald-400" />
                      : <CircleX className="h-5 w-5 text-red-400" />}
                    <p className={`text-xl font-black ${sysInfo?.dbStatus === "متصل" ? "text-emerald-400" : "text-red-400"}`}>{sysInfo?.dbStatus ?? "—"}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">PostgreSQL</p>
                </CardContent></Card>

                <Card className="border-border/50"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">البيئة</p>
                  <p className="text-xl font-black text-yellow-400">{sysInfo?.env ?? "—"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sysInfo?.cpuCores} نوى CPU</p>
                </CardContent></Card>
              </div>

              {/* Memory details */}
              <Card className="border-border/50"><CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">استخدام الذاكرة</span>
                </div>
                {MEM && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">ذاكرة النظام</span>
                        <span className="font-mono">{MEM.systemUsed} / {MEM.systemTotal}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${MEM.usedPercent}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{MEM.usedPercent}% مستخدم</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      {[
                        { label: "Heap Used",  val: MEM.heapUsed,  color: "text-blue-400" },
                        { label: "Heap Total", val: MEM.heapTotal, color: "text-purple-400" },
                        { label: "RSS",        val: MEM.rss,       color: "text-orange-400" },
                      ].map(({ label, val, color }) => (
                        <div key={label} className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className={`text-sm font-bold font-mono ${color}`}>{val}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent></Card>

              {/* Server info */}
              <Card className="border-border/50"><CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HardDrive className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">معلومات الخادم</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                  {[
                    { k: "المضيف", v: sysInfo?.hostname },
                    { k: "النظام", v: sysInfo?.platform },
                    { k: "المعالج", v: sysInfo?.cpuModel?.slice(0, 30) },
                    { k: "الأنوية", v: `${sysInfo?.cpuCores} نواة` },
                    { k: "الهندسة", v: sysInfo?.arch },
                    { k: "الإصدار", v: sysInfo?.nodeVersion },
                  ].map(({ k, v }) => (
                    <div key={k} className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono text-[11px] text-foreground truncate max-w-[140px]">{v ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            </div>
          )}
        </TabsContent>

        {/* ── DATABASE ── */}
        <TabsContent value="database" className="mt-4">
          {dbLoad ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Card className="border-border/50 flex-1"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">حجم قاعدة البيانات</p>
                  <p className="text-2xl font-black text-primary">{dbStats?.dbSize ?? "—"}</p>
                </CardContent></Card>
                <Card className="border-border/50 flex-1"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">عدد الجداول</p>
                  <p className="text-2xl font-black text-blue-400">{(dbStats?.tables ?? []).length}</p>
                </CardContent></Card>
              </div>

              <Card className="border-border/50"><CardContent className="p-0">
                <div className="p-4 border-b border-border/50 flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">إحصائيات الجداول</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-right text-xs">الجدول</TableHead>
                      <TableHead className="text-center text-xs">السجلات</TableHead>
                      <TableHead className="text-center text-xs">الحجم</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {(dbStats?.tables ?? []).map((t: any) => {
                        const sizeInfo = dbStats?.tableSizes?.find((s: any) => s.name === t.table);
                        return (
                          <TableRow key={t.table}>
                            <TableCell className="font-mono text-xs text-right py-2">{t.table}</TableCell>
                            <TableCell className="text-center">
                              {t.count === null
                                ? <span className="text-xs text-muted-foreground">—</span>
                                : <Badge variant="outline" className="text-xs font-mono">{t.count?.toLocaleString()}</Badge>
                              }
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground font-mono">
                              {sizeInfo?.size ?? "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent></Card>
            </div>
          )}
        </TabsContent>

        {/* ── TOKENS ── */}
        <TabsContent value="tokens" className="mt-4">
          <div className="space-y-4">
            {/* Intro card */}
            <Card className="border-dashed border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4 flex gap-3">
                <Fingerprint className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  توكنات المطورين تسمح للمهندسين الخارجيين بالوصول الآمن لواجهات برمجة النظام.
                  أنشئ توكناً لكل مطور باستقلالية، وقم بإلغائه في أي وقت. التوكن يُعرض مرة واحدة فقط عند الإنشاء.
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <KeySquare className="h-4 w-4 text-primary" /> التوكنات الحالية
                <Badge variant="secondary" className="text-xs">{(tokens as any[]).length}</Badge>
              </h3>
              <Button size="sm" className="gap-2 text-xs h-8" onClick={() => { setNewToken(null); setShowCreate(true); }}>
                <Plus className="h-3.5 w-3.5" /> توكن جديد
              </Button>
            </div>

            {tokLoad ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (tokens as any[]).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <KeySquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">لا توجد توكنات — أنشئ توكناً أولاً</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(tokens as any[]).map((tok: any) => {
                  const perm = PERM_LABELS[tok.permissions] ?? PERM_LABELS.read;
                  const isExpired = tok.expires_at && new Date(tok.expires_at) < new Date();
                  return (
                    <Card key={tok.id} className={`border-border/50 ${!tok.is_active || isExpired ? "opacity-60" : ""}`}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary/10 flex-shrink-0">
                          <Fingerprint className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold">{tok.name}</span>
                            <Badge style={{ background: perm.color + "20", color: perm.color, border: `1px solid ${perm.color}40` }} className="text-[10px] py-0">
                              {perm.label}
                            </Badge>
                            {!tok.is_active && <Badge variant="secondary" className="text-[10px] py-0">ملغى</Badge>}
                            {isExpired && <Badge variant="destructive" className="text-[10px] py-0">منتهي الصلاحية</Badge>}
                          </div>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{tok.tokenPreview}</p>
                          {tok.description && <p className="text-[11px] text-muted-foreground mt-0.5">{tok.description}</p>}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            تم الإنشاء: {new Date(tok.created_at).toLocaleDateString("ar-SA")}
                            {tok.expires_at && ` · ينتهي: ${new Date(tok.expires_at).toLocaleDateString("ar-SA")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {tok.is_active && !isExpired && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-yellow-500 hover:text-yellow-600"
                              onClick={() => revokeTok.mutate(tok.id)} title="إلغاء">
                              <ShieldAlert className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600"
                            onClick={() => deleteTok.mutate(tok.id)} title="حذف">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create Token Dialog */}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Fingerprint className="h-5 w-5 text-primary" /> إنشاء توكن مطور
                </DialogTitle>
              </DialogHeader>

              {newToken ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CircleCheck className="h-4 w-4 text-emerald-400" />
                      <p className="text-sm font-bold text-emerald-400">تم إنشاء التوكن بنجاح!</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      انسخ هذا التوكن الآن — لن يُعرض مرة أخرى بعد إغلاق هذه النافذة.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[11px] font-mono bg-muted rounded-lg p-2 break-all text-foreground" dir="ltr">
                        {newToken.token}
                      </code>
                      <Button size="icon" variant="outline" className="h-9 w-9 flex-shrink-0" onClick={() => copyToken(newToken.token)}>
                        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    <p className="font-bold mb-1">كيفية الاستخدام:</p>
                    <code dir="ltr" className="block text-[10px]">Authorization: Bearer {"{token}"}</code>
                    <code dir="ltr" className="block text-[10px] mt-1">GET /api/developer/system-info</code>
                  </div>
                  <DialogFooter>
                    <Button className="w-full" onClick={() => { setShowCreate(false); setNewToken(null); }}>تم — أغلق</Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">اسم التوكن *</Label>
                    <Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="مثال: مهندس التطوير - أحمد" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">الصلاحيات</Label>
                    <Select value={createForm.permissions} onValueChange={v => setCreateForm(f => ({ ...f, permissions: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="read">قراءة فقط (موصى به)</SelectItem>
                        <SelectItem value="write">قراءة + كتابة</SelectItem>
                        <SelectItem value="full">صلاحية كاملة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">وصف (اختياري)</Label>
                    <Input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="مثال: للوصول إلى لوحة المراقبة" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">انتهاء الصلاحية (أيام، اختياري)</Label>
                    <Input type="number" value={createForm.expiresInDays} onChange={e => setCreateForm(f => ({ ...f, expiresInDays: e.target.value }))}
                      placeholder="مثال: 30 (اتركه فارغاً للتوكن الدائم)" dir="ltr" />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
                    <Button disabled={!createForm.name || createTok.isPending}
                      onClick={() => createTok.mutate({ ...createForm, expiresInDays: createForm.expiresInDays ? parseInt(createForm.expiresInDays) : undefined })}
                      className="gap-2">
                      {createTok.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Fingerprint className="h-4 w-4" /> إنشاء التوكن
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── ENVIRONMENT ── */}
        <TabsContent value="env" className="mt-4">
          {envLoad ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              <Card className="border-dashed border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-4 flex gap-3">
                  <ShieldAlert className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    هذه القيم للقراءة فقط ومُعالجة لإخفاء البيانات الحساسة. لا تُعرض مفاتيح API أو كلمات السر.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50"><CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {Object.entries(envInfo as Record<string, string>).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <code className="text-xs font-mono text-primary">{key}</code>
                      <code className="text-xs font-mono text-muted-foreground max-w-[240px] truncate text-left" dir="ltr">{val}</code>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HOSTING CENTER TAB
═══════════════════════════════════════════════════════════════════ */
const HOST_BASE = (() => {
  const b = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (path: string, opts?: RequestInit) =>
    fetch(`${b}/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
})();

function HostingCenterTab({ toast }: { toast: any }) {
  const [sub, setSub] = useState("infrastructure");

  /* ── Server status ── */
  const [status, setStatus] = useState<any>(null);
  const [statusLoad, setStatusLoad] = useState(false);

  /* ── Domains ── */
  const [domains, setDomains] = useState<any[]>([]);
  const [domainsLoad, setDomainsLoad] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain: "", domainType: "custom", provider: "cloudflare", officeName: "" });
  const [addingDomain, setAddingDomain] = useState(false);
  const [showDomainForm, setShowDomainForm] = useState(false);

  /* ── Providers ── */
  const [providers, setProviders] = useState<any[]>([]);
  const [providersLoad, setProvidersLoad] = useState(false);
  const [newProvider, setNewProvider] = useState({ providerName: "", providerType: "dns", apiKey: "", zoneId: "", endpoint: "" });
  const [addingProvider, setAddingProvider] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);

  /* ── Offices/subdomains ── */
  const [offices, setOffices] = useState<any[]>([]);
  const [officesLoad, setOfficesLoad] = useState(false);

  /* ── DNS Guide ── */
  const [dnsGuide, setDnsGuide] = useState<any>(null);

  const loadStatus = async () => {
    setStatusLoad(true);
    try { const d = await (await HOST_BASE("/hosting/status")).json(); setStatus(d); }
    catch { toast({ title: "خطأ في تحميل حالة الخادم", variant: "destructive" }); }
    finally { setStatusLoad(false); }
  };

  const loadDomains = async () => {
    setDomainsLoad(true);
    try { const d = await (await HOST_BASE("/hosting/domains")).json(); setDomains(Array.isArray(d) ? d : []); }
    finally { setDomainsLoad(false); }
  };

  const loadProviders = async () => {
    setProvidersLoad(true);
    try { const d = await (await HOST_BASE("/hosting/providers")).json(); setProviders(Array.isArray(d) ? d : []); }
    finally { setProvidersLoad(false); }
  };

  const loadOffices = async () => {
    setOfficesLoad(true);
    try { const d = await (await HOST_BASE("/hosting/offices-subdomains")).json(); setOffices(Array.isArray(d) ? d : []); }
    finally { setOfficesLoad(false); }
  };

  const loadDnsGuide = async () => {
    try { const d = await (await HOST_BASE("/hosting/dns-guide")).json(); setDnsGuide(d); }
    catch {}
  };

  useEffect(() => {
    if (sub === "infrastructure") loadStatus();
    if (sub === "domains") { loadDomains(); loadDnsGuide(); }
    if (sub === "providers") loadProviders();
    if (sub === "subdomains") loadOffices();
  }, [sub]);

  const addDomain = async () => {
    if (!newDomain.domain.trim()) return;
    setAddingDomain(true);
    try {
      const res = await HOST_BASE("/hosting/domains", { method: "POST", body: JSON.stringify(newDomain) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "تم إضافة النطاق" });
      setNewDomain({ domain: "", domainType: "custom", provider: "cloudflare", officeName: "" });
      setShowDomainForm(false);
      loadDomains();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setAddingDomain(false); }
  };

  const toggleVerify = async (id: string) => {
    await HOST_BASE(`/hosting/domains/${id}/verify`, { method: "PATCH" });
    loadDomains();
  };

  const toggleSsl = async (id: string) => {
    await HOST_BASE(`/hosting/domains/${id}/ssl`, { method: "PATCH" });
    loadDomains();
  };

  const deleteDomain = async (id: string) => {
    if (!confirm("حذف هذا النطاق؟")) return;
    await HOST_BASE(`/hosting/domains/${id}`, { method: "DELETE" });
    loadDomains();
  };

  const addProvider = async () => {
    if (!newProvider.providerName.trim()) return;
    setAddingProvider(true);
    try {
      const res = await HOST_BASE("/hosting/providers", { method: "POST", body: JSON.stringify(newProvider) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "تم إضافة المزود" });
      setNewProvider({ providerName: "", providerType: "dns", apiKey: "", zoneId: "", endpoint: "" });
      setShowProviderForm(false);
      loadProviders();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setAddingProvider(false); }
  };

  const toggleProvider = async (id: string) => {
    await HOST_BASE(`/hosting/providers/${id}/toggle`, { method: "PATCH" });
    loadProviders();
  };

  const deleteProvider = async (id: string) => {
    if (!confirm("حذف هذا المزود؟")) return;
    await HOST_BASE(`/hosting/providers/${id}`, { method: "DELETE" });
    loadProviders();
  };

  const HOST_SUB_TABS = [
    { id: "infrastructure", label: "البنية التحتية",   icon: Server },
    { id: "domains",        label: "النطاقات",          icon: Globe },
    { id: "subdomains",     label: "مواقع المكاتب",    icon: Layers },
    { id: "providers",      label: "مزودو الخدمة",     icon: Cloud },
    { id: "devaccess",      label: "وصول المطورين",    icon: PlugZap },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-500/20">
          <Globe className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">مركز الاستضافة والبنية التحتية</h2>
          <p className="text-xs text-muted-foreground">إدارة النطاقات · SSL · مزودو الخدمة · الخوادم</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {HOST_SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sub === t.id
                ? "bg-blue-600 text-white shadow"
                : "bg-muted hover:bg-muted/70 text-muted-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── INFRASTRUCTURE ─── */}
      {sub === "infrastructure" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={loadStatus} disabled={statusLoad}>
              <RefreshCw className={`h-4 w-4 ml-1.5 ${statusLoad ? "animate-spin" : ""}`} />
              تحديث
            </Button>
          </div>

          {statusLoad ? (
            <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-blue-400" /></div>
          ) : status ? (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "وقت التشغيل", value: status.uptime, icon: Clock, color: "text-emerald-400" },
                  { label: "معالجات CPU", value: `${status.cpuCores} أنوية`, icon: Cpu, color: "text-blue-400" },
                  { label: "Node.js", value: status.nodeVersion, icon: Terminal, color: "text-yellow-400" },
                  { label: "قاعدة البيانات", value: status.dbStatus, icon: Database, color: status.dbStatus === "متصل" ? "text-emerald-400" : "text-red-400" },
                ].map(k => (
                  <Card key={k.label} className="border-border/50 bg-card/60">
                    <CardContent className="p-4 flex items-center gap-3">
                      <k.icon className={`h-6 w-6 ${k.color} flex-shrink-0`} />
                      <div>
                        <p className="text-xs text-muted-foreground">{k.label}</p>
                        <p className="text-sm font-bold">{k.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Memory */}
              <Card className="border-border/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <HardDrive className="h-4 w-4 text-violet-400" />
                    <span className="text-sm font-semibold">الذاكرة والموارد</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {[
                      ["Heap مُستخدم", status.memory?.heapUsed],
                      ["Heap الكلي", status.memory?.heapTotal],
                      ["RSS", status.memory?.rss],
                      ["نظام", `${status.memory?.systemUsed} / ${status.memory?.systemTotal}`],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="bg-muted/40 rounded-lg p-2.5">
                        <p className="text-muted-foreground">{lbl}</p>
                        <p className="font-mono font-semibold mt-0.5" dir="ltr">{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>استهلاك الذاكرة</span>
                      <span>{status.memory?.usedPercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted/60">
                      <div
                        className={`h-full rounded-full ${status.memory?.usedPercent > 85 ? "bg-red-500" : status.memory?.usedPercent > 60 ? "bg-yellow-500" : "bg-emerald-500"}`}
                        style={{ width: `${status.memory?.usedPercent}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Server details */}
              <Card className="border-border/50"><CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {[
                    ["المنصة", status.platform],
                    ["المعالج", status.cpuModel],
                    ["البيئة", status.env],
                    ["Hostname", status.hostname],
                    ["نطاق Replit", status.replitDomain ?? "—"],
                    ["عدد المكاتب", String(status.totalOffices)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
                      <span className="text-xs text-muted-foreground">{k}</span>
                      <span className="text-xs font-mono font-medium" dir="ltr">{v}</span>
                    </div>
                  ))}
                </div>
              </CardContent></Card>
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">اضغط "تحديث" لتحميل حالة الخادم</p>
            </div>
          )}
        </div>
      )}

      {/* ─── DOMAINS ─── */}
      {sub === "domains" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{domains.length} نطاق مسجّل</p>
            <Button size="sm" onClick={() => setShowDomainForm(v => !v)}>
              <Plus className="h-4 w-4 ml-1.5" />
              إضافة نطاق
            </Button>
          </div>

          {showDomainForm && (
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-300">نطاق جديد</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="النطاق (مثال: office1.com)" value={newDomain.domain}
                    onChange={e => setNewDomain(p => ({ ...p, domain: e.target.value }))} className="text-sm h-9" />
                  <Input placeholder="اسم المكتب (اختياري)" value={newDomain.officeName}
                    onChange={e => setNewDomain(p => ({ ...p, officeName: e.target.value }))} className="text-sm h-9" />
                  <select value={newDomain.domainType}
                    onChange={e => setNewDomain(p => ({ ...p, domainType: e.target.value }))}
                    className="bg-background border border-input rounded-md px-3 py-2 text-sm h-9">
                    <option value="custom">نطاق خاص</option>
                    <option value="subdomain">نطاق فرعي</option>
                  </select>
                  <select value={newDomain.provider}
                    onChange={e => setNewDomain(p => ({ ...p, provider: e.target.value }))}
                    className="bg-background border border-input rounded-md px-3 py-2 text-sm h-9">
                    <option value="cloudflare">Cloudflare</option>
                    <option value="godaddy">GoDaddy</option>
                    <option value="namecheap">Namecheap</option>
                    <option value="other">آخر</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowDomainForm(false)}>إلغاء</Button>
                  <Button size="sm" onClick={addDomain} disabled={addingDomain}>
                    {addingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DNS setup guide */}
          {dnsGuide && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-4 w-4 text-yellow-400" />
                  <p className="text-sm font-semibold text-yellow-300">دليل إعداد DNS</p>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">CNAME يشير إلى:</span>
                  <code className="text-xs font-mono bg-muted/50 px-2 py-0.5 rounded text-yellow-200" dir="ltr">
                    {dnsGuide.cname}
                  </code>
                </div>
                <div className="space-y-1.5">
                  {dnsGuide.instructions?.map((s: any) => (
                    <div key={s.step} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="w-5 h-5 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">{s.step}</span>
                      <span>{s.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {domainsLoad ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
          ) : domains.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد نطاقات مسجلة بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {domains.map((d: any) => (
                <Card key={d.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-mono font-semibold" dir="ltr">{d.domain}</code>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          d.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-yellow-500/15 text-yellow-400"}`}>
                          {d.status === "active" ? "نشط" : "معلق"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{d.provider}</span>
                        {d.office_name && <span className="text-[10px] text-muted-foreground">| {d.office_name}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleVerify(d.id)}
                        title={d.dns_verified ? "إلغاء التحقق" : "تعيين كمحقق"}
                        className={`p-1.5 rounded-md transition-colors ${d.dns_verified ? "text-emerald-400 bg-emerald-500/10" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleSsl(d.id)}
                        title={d.ssl_enabled ? "SSL مفعّل" : "تفعيل SSL"}
                        className={`p-1.5 rounded-md transition-colors ${d.ssl_enabled ? "text-blue-400 bg-blue-500/10" : "text-muted-foreground hover:bg-muted"}`}
                      >
                        <Shield className="h-4 w-4" />
                      </button>
                      <button onClick={() => deleteDomain(d.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── OFFICES SUBDOMAINS ─── */}
      {sub === "subdomains" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{offices.length} مكتب مسجّل</p>
            <Button size="sm" variant="outline" onClick={loadOffices} disabled={officesLoad}>
              <RefreshCw className={`h-4 w-4 ml-1.5 ${officesLoad ? "animate-spin" : ""}`} />
              تحديث
            </Button>
          </div>

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-3 flex gap-2.5">
              <Layers className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                كل مكتب يحصل تلقائياً على مسار خاص به <code className="bg-muted/60 px-1 rounded" dir="ltr">/firms/slug</code>.
                يمكن ربط نطاق خاص عبر تبويب "النطاقات".
              </p>
            </CardContent>
          </Card>

          {officesLoad ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
          ) : offices.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا توجد مكاتب مسجلة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {offices.map((o: any) => (
                <Card key={o.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-border/50 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{o.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${o.is_published ? "bg-emerald-500/15 text-emerald-400" : "bg-muted/60 text-muted-foreground"}`}>
                          {o.is_published ? "منشور" : "غير منشور"}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400">{o.plan}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <code className="text-[11px] text-muted-foreground font-mono" dir="ltr">/firms/{o.slug}</code>
                      </div>
                    </div>
                    <a
                      href={o.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                    >
                      <Link2 className="h-4 w-4" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── HOSTING PROVIDERS ─── */}
      {sub === "providers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{providers.length} مزود مُعدّ</p>
            <Button size="sm" onClick={() => setShowProviderForm(v => !v)}>
              <Plus className="h-4 w-4 ml-1.5" />
              إضافة مزود
            </Button>
          </div>

          {showProviderForm && (
            <Card className="border-violet-500/30 bg-violet-500/5">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-violet-300">مزود خدمة جديد</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input placeholder="اسم المزود (Cloudflare, AWS…)" value={newProvider.providerName}
                    onChange={e => setNewProvider(p => ({ ...p, providerName: e.target.value }))} className="text-sm h-9" />
                  <select value={newProvider.providerType}
                    onChange={e => setNewProvider(p => ({ ...p, providerType: e.target.value }))}
                    className="bg-background border border-input rounded-md px-3 py-2 text-sm h-9">
                    <option value="dns">DNS</option>
                    <option value="cdn">CDN</option>
                    <option value="ssl">SSL</option>
                    <option value="hosting">Hosting</option>
                  </select>
                  <Input placeholder="API Key (اختياري)" value={newProvider.apiKey}
                    onChange={e => setNewProvider(p => ({ ...p, apiKey: e.target.value }))}
                    type="password" className="text-sm h-9" />
                  <Input placeholder="Zone ID (اختياري)" value={newProvider.zoneId}
                    onChange={e => setNewProvider(p => ({ ...p, zoneId: e.target.value }))} className="text-sm h-9" dir="ltr" />
                  <Input placeholder="Endpoint URL (اختياري)" value={newProvider.endpoint}
                    onChange={e => setNewProvider(p => ({ ...p, endpoint: e.target.value }))} className="text-sm h-9 col-span-2" dir="ltr" />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowProviderForm(false)}>إلغاء</Button>
                  <Button size="sm" onClick={addProvider} disabled={addingProvider}>
                    {addingProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {providersLoad ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
          ) : providers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Cloud className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لا يوجد مزودو خدمة مُعدّون</p>
              <p className="text-xs mt-1">أضف Cloudflare أو غيره لإدارة DNS و SSL</p>
            </div>
          ) : (
            <div className="space-y-2">
              {providers.map((p: any) => (
                <Card key={p.id} className="border-border/50">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{p.provider_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground uppercase">{p.provider_type}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                          {p.is_active ? "نشط" : "معطّل"}
                        </span>
                      </div>
                      {p.api_key && (
                        <code className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                          API: {p.api_key}
                        </code>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleProvider(p.id)}
                        className={`p-1.5 rounded-md transition-colors ${p.is_active ? "text-emerald-400 hover:bg-red-500/10 hover:text-red-400" : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-400"}`}>
                        {p.is_active ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
                      </button>
                      <button onClick={() => deleteProvider(p.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── DEV ACCESS ─── */}
      {sub === "devaccess" && (
        <div className="space-y-4">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex gap-3">
              <PlugZap className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-300 mb-1">وصول المطور / المهندس</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يمكن للمطورين الوصول إلى البنية التحتية عبر Developer Tokens المُدارة من تبويب <strong>"مركز المطور"</strong>.
                  كل token يمنح صلاحيات API محددة مع تتبع الاستخدام.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                icon: Terminal,
                title: "API المطور",
                color: "emerald",
                items: [
                  "GET /api/developer/system-info — معلومات الخادم",
                  "GET /api/developer/db-stats — إحصائيات قاعدة البيانات",
                  "GET /api/hosting/status — حالة البنية التحتية",
                  "GET /api/hosting/domains — قائمة النطاقات",
                ],
              },
              {
                icon: Shield,
                title: "الأمان والصلاحيات",
                color: "blue",
                items: [
                  "جميع نقاط النهاية محمية بـ isSuperAdmin()",
                  "Developer Tokens للوصول الخارجي المحدود",
                  "مفاتيح API للمزودين مُخفاة جزئياً في الواجهة",
                  "جميع العمليات مُسجّلة في server logs",
                ],
              },
              {
                icon: Database,
                title: "قاعدة البيانات",
                color: "violet",
                items: [
                  "hosting_domains — سجل النطاقات",
                  "hosting_providers — إعدادات المزودين",
                  "office_page — بيانات المكاتب + slugs",
                  "developer_tokens — رموز وصول المطورين",
                ],
              },
              {
                icon: Wifi,
                title: "متطلبات الربط",
                color: "yellow",
                items: [
                  "CLOUDFLARE_TOKEN — لإدارة DNS تلقائياً",
                  "REPLIT_DEV_DOMAIN — نطاق التطوير",
                  "DATABASE_URL — PostgreSQL connection",
                  "CLERK_SECRET_KEY — مصادقة المستخدمين",
                ],
              },
            ].map(card => (
              <Card key={card.title} className={`border-${card.color}-500/20 bg-${card.color}-500/5`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <card.icon className={`h-4 w-4 text-${card.color}-400`} />
                    <span className="text-sm font-semibold">{card.title}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {card.items.map(item => (
                      <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <span className={`text-${card.color}-400 mt-0.5 flex-shrink-0`}>•</span>
                        <code className="font-mono text-[10px] leading-relaxed" dir="ltr">{item}</code>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-dashed border-border/60">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">إنشاء Developer Token جديد ← انتقل لتبويب مركز المطور</p>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => {
                  const el = document.querySelector('[data-value="developer"]') as HTMLElement | null;
                  el?.click();
                }}
              >
                <Code2 className="h-4 w-4 ml-1.5" />
                الانتقال لمركز المطور
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   OVERVIEW TAB (enhanced — with recharts + extended stats)
═══════════════════════════════════════════════════ */
const CHART_COLORS = ["#C9A84C","#3B82F6","#10B981","#8B5CF6","#EF4444","#F59E0B","#06B6D4","#F97316"];

function OverviewTab({ stats }: { stats: any }) {
  const { data: ext } = useQuery<any>({
    queryKey: ["admin", "/enhanced-stats"],
    queryFn: () => API("/enhanced-stats"),
    staleTime: 60_000,
  });

  const fmtSAR = (n: number) => {
    const r = n / 100;
    if (r >= 1_000_000) return (r/1_000_000).toFixed(1) + "م ر.س";
    if (r >= 1_000) return (r/1_000).toFixed(0) + "ك ر.س";
    return r.toLocaleString("ar-SA", {maximumFractionDigits:0}) + " ر.س";
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="إجمالي المكاتب" value={stats?.totalOffices ?? "—"} color="#C9A84C" />
        <StatCard icon={<Users className="h-4 w-4" />} label="إجمالي المستخدمين" value={stats?.totalUsers ?? "—"} color="#3B82F6" />
        <StatCard icon={<Gavel className="h-4 w-4" />} label="إجمالي القضايا" value={ext?.cases?.total ?? "—"} sub={`${ext?.cases?.open ?? 0} مفتوحة`} color="#8B5CF6" />
        <StatCard icon={<FileSignature className="h-4 w-4" />} label="إجمالي العقود" value={ext?.contracts?.total ?? "—"} sub={`${ext?.contracts?.signed ?? 0} موقعة`} color="#10B981" />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Package className="h-4 w-4" />} label="الباقات النشطة" value={stats?.activePlans ?? "—"} color="#F59E0B" />
        <StatCard icon={<HeadphonesIcon className="h-4 w-4" />} label="تذاكر الدعم" value={stats?.openTickets ?? "—"} sub={`من ${stats?.totalTickets ?? 0} إجمالي`} color="#EF4444" />
        <StatCard icon={<Activity className="h-4 w-4" />} label="استهلاك AI" value={stats?.totalAiUsage?.toLocaleString() ?? "—"} sub="وحدة" color="#06B6D4" />
        <StatCard icon={<AlertOctagon className="h-4 w-4" />} label="فواتير متأخرة" value={ext?.overdueInvoices ?? "—"} color="#EF4444" />
      </div>

      {/* Revenue chart + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Revenue Chart */}
        <Card className="lg:col-span-2 bg-sidebar border-sidebar-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#C9A84C]" /> الإيرادات الشهرية
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!ext ? (
              <div className="h-52 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={ext.monthlyChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+"ك" : String(v)} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", direction: "rtl" }} formatter={(v: number) => [`${(v/100).toLocaleString("ar-SA")} ر.س`, "الإيرادات"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#C9A84C" strokeWidth={2} fill="url(#revGrad)" dot={{ fill: "#C9A84C", r: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-sidebar border-sidebar-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">النشاط الأخير</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!ext?.recentActivity ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : ext.recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">لا يوجد نشاط حديث</div>
            ) : (
              <div className="divide-y divide-border/30 max-h-52 overflow-y-auto">
                {ext.recentActivity.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 p-3">
                    <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${item.type === "case" ? "bg-violet-500/15" : "bg-blue-500/15"}`}>
                      {item.type === "case" ? <Gavel className="h-3.5 w-3.5 text-violet-400" /> : <FileSignature className="h-3.5 w-3.5 text-blue-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{item.label}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className="text-[9px] px-1.5 py-0 bg-muted/50 text-muted-foreground border-0">{item.type === "case" ? "قضية" : "عقد"}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("ar-SA")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM CASES TAB
═══════════════════════════════════════════════════ */
const CASE_STATUS: Record<string, {label: string; color: string}> = {
  open:     { label: "مفتوحة",  color: "bg-blue-500/15 text-blue-400" },
  closed:   { label: "مغلقة",   color: "bg-muted text-muted-foreground" },
  pending:  { label: "معلقة",   color: "bg-amber-500/15 text-amber-400" },
  archived: { label: "مؤرشفة",  color: "bg-gray-500/15 text-gray-400" },
};

function PlatformCasesTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: cases = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin", "/cases", statusFilter, search],
    queryFn: () => API(`/cases?status=${statusFilter}&search=${encodeURIComponent(search)}`),
    staleTime: 30_000,
  });

  const filtered = (cases as any[]).filter(c =>
    !search || c.title?.includes(search) || c.client_name?.includes(search)
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في القضايا..." className="w-full h-9 pr-9 pl-3 rounded-lg bg-muted/40 text-sm border border-border/40 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]" />
        </div>
        {["all","open","closed","pending"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", statusFilter===s ? "bg-[#C9A84C] text-black border-[#C9A84C] font-bold" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
            {s==="all"?"الكل":CASE_STATUS[s]?.label??s}
          </button>
        ))}
        <Badge variant="outline" className="text-xs mr-auto">{filtered.length} قضية</Badge>
      </div>

      <Card className="bg-sidebar border-sidebar-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-right text-xs">العنوان</TableHead>
              <TableHead className="text-right text-xs">النوع</TableHead>
              <TableHead className="text-right text-xs">العميل</TableHead>
              <TableHead className="text-right text-xs">المسؤول</TableHead>
              <TableHead className="text-right text-xs">الحالة</TableHead>
              <TableHead className="text-right text-xs">تاريخ الإنشاء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">لا توجد قضايا</TableCell></TableRow>
            ) : filtered.map((c: any) => {
              const st = CASE_STATUS[c.status] ?? { label: c.status, color: "bg-muted text-muted-foreground" };
              return (
                <TableRow key={c.id} className="hover:bg-muted/20">
                  <TableCell className="text-sm font-medium max-w-52 truncate">{c.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.case_type}</TableCell>
                  <TableCell className="text-xs">{c.client_name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.assigned_to ?? "—"}</TableCell>
                  <TableCell><Badge className={cn("text-[10px]", st.color)}>{st.label}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ar-SA")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM CONTRACTS TAB
═══════════════════════════════════════════════════ */
const CONTRACT_STATUS: Record<string, {label: string; color: string}> = {
  draft:     { label: "مسودة",  color: "bg-muted text-muted-foreground" },
  review:    { label: "مراجعة", color: "bg-amber-500/15 text-amber-400" },
  signed:    { label: "موقع",   color: "bg-green-500/15 text-green-400" },
  expired:   { label: "منتهي",  color: "bg-red-500/15 text-red-400" },
  cancelled: { label: "ملغي",   color: "bg-gray-500/15 text-gray-400" },
};

function PlatformContractsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: contracts = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin", "/contracts", statusFilter],
    queryFn: () => API(`/contracts?status=${statusFilter}`),
    staleTime: 30_000,
  });

  const filtered = (contracts as any[]).filter(c =>
    !search || c.title?.includes(search)
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في العقود..." className="w-full h-9 pr-9 pl-3 rounded-lg bg-muted/40 text-sm border border-border/40 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]" />
        </div>
        {["all","draft","review","signed","expired"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", statusFilter===s ? "bg-[#C9A84C] text-black border-[#C9A84C] font-bold" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
            {s==="all"?"الكل":CONTRACT_STATUS[s]?.label??s}
          </button>
        ))}
        <Badge variant="outline" className="text-xs mr-auto">{filtered.length} عقد</Badge>
      </div>

      <Card className="bg-sidebar border-sidebar-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-right text-xs">العنوان</TableHead>
              <TableHead className="text-right text-xs">النوع</TableHead>
              <TableHead className="text-right text-xs">الحالة</TableHead>
              <TableHead className="text-right text-xs">مولَّد بـ AI</TableHead>
              <TableHead className="text-right text-xs">مستوى الخطورة</TableHead>
              <TableHead className="text-right text-xs">تاريخ الإنشاء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">لا توجد عقود</TableCell></TableRow>
            ) : filtered.map((c: any) => {
              const st = CONTRACT_STATUS[c.status] ?? { label: c.status, color: "bg-muted text-muted-foreground" };
              const risk = { low: { label: "منخفض", color: "text-green-400" }, medium: { label: "متوسط", color: "text-amber-400" }, high: { label: "عالٍ", color: "text-red-400" } } as any;
              return (
                <TableRow key={c.id} className="hover:bg-muted/20">
                  <TableCell className="text-sm font-medium max-w-52 truncate">{c.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.type}</TableCell>
                  <TableCell><Badge className={cn("text-[10px]", st.color)}>{st.label}</Badge></TableCell>
                  <TableCell className="text-center">{c.ai_generated ? <CheckSquare className="h-4 w-4 text-[#C9A84C] mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell className={cn("text-xs font-medium", risk[c.risk_score]?.color ?? "text-muted-foreground")}>{risk[c.risk_score]?.label ?? (c.risk_score ?? "—")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ar-SA")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM FINANCE TAB
═══════════════════════════════════════════════════ */
function PlatformFinanceTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["admin", "/finance-stats"],
    queryFn: () => API("/finance-stats"),
    staleTime: 60_000,
  });

  const kpi = data?.kpi ?? {};
  const n = (v: any) => parseFloat(String(v ?? 0)) || 0;
  const fmtSAR = (v: number) => {
    const r = v / 100;
    if (r >= 1_000_000) return (r/1_000_000).toFixed(1) + "م ر.س";
    if (r >= 1_000) return (r/1_000).toFixed(0) + "ك ر.س";
    return r.toLocaleString("ar-SA", {maximumFractionDigits:0}) + " ر.س";
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: "إجمالي الإيرادات", value: fmtSAR(n(kpi.totalRevenue)), icon: TrendingUp, color: "text-emerald-400 bg-emerald-500/15" },
          { label: "إجمالي المصروفات", value: fmtSAR(n(kpi.totalExpenses)), icon: TrendingDown, color: "text-red-400 bg-red-500/15" },
          { label: "صافي الربح",        value: fmtSAR(n(kpi.netProfit)),    icon: DollarSign, color: "text-[#C9A84C] bg-[#C9A84C]/15" },
          { label: "فواتير مدفوعة",     value: `${kpi.paidInvoices?.count ?? 0} فاتورة`,   icon: CheckCircle2, color: "text-green-400 bg-green-500/15" },
          { label: "فواتير متأخرة",     value: `${kpi.overdueInvoices?.count ?? 0} فاتورة`, icon: AlertOctagon, color: "text-red-400 bg-red-500/15" },
          { label: "فواتير قيد التحصيل",value: `${kpi.pendingInvoices?.count ?? 0} فاتورة`, icon: Clock,        color: "text-amber-400 bg-amber-500/15" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-sidebar border-sidebar-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              {isLoading ? <div className="h-5 w-24 bg-muted/40 rounded animate-pulse" /> : <p className="text-xl font-bold">{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly revenue/expenses bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-sidebar border-sidebar-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">الأداء المالي — آخر 6 أشهر</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-52 bg-muted/20 rounded-lg animate-pulse" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.monthly ?? []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+"ك" : String(v)} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(v: number, name: string) => [`${(v/100).toLocaleString("ar-SA")} ر.س`, name==="revenue"?"الإيرادات":"المصروفات"]} />
                  <Legend formatter={v => v==="revenue"?"الإيرادات":"المصروفات"} />
                  <Bar dataKey="revenue"  fill="#10B981" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="expenses" fill="#EF4444" radius={[4,4,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expense Categories */}
        <Card className="bg-sidebar border-sidebar-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">تصنيف المصروفات</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-52 bg-muted/20 rounded-lg animate-pulse" /> : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={data?.expenseCategories ?? []} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                      {(data?.expenseCategories ?? []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${(v/100).toLocaleString("ar-SA")} ر.س`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-1">
                  {(data?.expenseCategories ?? []).slice(0,5).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-muted-foreground">{c.name}</span></div>
                      <span className="font-medium">{(c.value/100).toLocaleString("ar-SA",{maximumFractionDigits:0})}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card className="bg-sidebar border-sidebar-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">أحدث الفواتير</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
              <TableHead className="text-right text-xs">المبلغ</TableHead>
              <TableHead className="text-right text-xs">الحالة</TableHead>
              <TableHead className="text-right text-xs">تاريخ الاستحقاق</TableHead>
              <TableHead className="text-right text-xs">تاريخ الإنشاء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>
            ) : (data?.recentInvoices ?? []).map((inv: any) => {
              const stMap: any = { paid: {l:"مدفوعة",c:"bg-green-500/15 text-green-400"}, sent: {l:"مُرسَلة",c:"bg-blue-500/15 text-blue-400"}, overdue: {l:"متأخرة",c:"bg-red-500/15 text-red-400"}, draft: {l:"مسودة",c:"bg-muted text-muted-foreground"} };
              const st = stMap[inv.status] ?? stMap.draft;
              return (
                <TableRow key={inv.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs font-mono">{inv.invoice_number ?? inv.id.slice(0,8)}</TableCell>
                  <TableCell className="text-xs font-medium">{(Number(inv.total||0)/100).toLocaleString("ar-SA")} ر.س</TableCell>
                  <TableCell><Badge className={cn("text-[10px]", st.c)}>{st.l}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString("ar-SA") : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("ar-SA")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM REPORTS TAB
═══════════════════════════════════════════════════ */
function PlatformReportsTab() {
  const { data: finance } = useQuery<any>({ queryKey: ["admin", "/finance-stats"], queryFn: () => API("/finance-stats"), staleTime: 60_000 });
  const { data: ext }     = useQuery<any>({ queryKey: ["admin", "/enhanced-stats"], queryFn: () => API("/enhanced-stats"), staleTime: 60_000 });
  const { data: stats }   = useQuery<any>({ queryKey: ["admin", "/stats"], queryFn: () => API("/stats"), staleTime: 60_000 });

  const exportCSV = (rows: any[], name: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(",");
    const body = rows.map(r => Object.values(r).map(v => `"${String(v??"")}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+headers+"\n"+body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click();
  };

  const reports = [
    {
      title: "تقرير إيرادات المنصة",
      desc: "ملخص الإيرادات والمصروفات وصافي الربح",
      icon: TrendingUp,
      color: "text-emerald-400 bg-emerald-500/15",
      rows: finance?.monthly ?? [],
      name: "platform-revenue-report",
    },
    {
      title: "تقرير القضايا",
      desc: `${ext?.cases?.total ?? 0} قضية | ${ext?.cases?.open ?? 0} مفتوحة | ${ext?.cases?.closed ?? 0} مغلقة`,
      icon: Gavel,
      color: "text-violet-400 bg-violet-500/15",
      rows: [],
      name: "cases-report",
    },
    {
      title: "تقرير العقود",
      desc: `${ext?.contracts?.total ?? 0} عقد | ${ext?.contracts?.signed ?? 0} موقع`,
      icon: FileSignature,
      color: "text-blue-400 bg-blue-500/15",
      rows: [],
      name: "contracts-report",
    },
    {
      title: "تقرير الاشتراكات",
      desc: `${stats?.activePlans ?? 0} باقة نشطة`,
      icon: Package,
      color: "text-amber-400 bg-amber-500/15",
      rows: [],
      name: "subscriptions-report",
    },
    {
      title: "تقرير الفواتير",
      desc: `${finance?.kpi?.paidInvoices?.count ?? 0} مدفوعة | ${finance?.kpi?.overdueInvoices?.count ?? 0} متأخرة`,
      icon: Banknote,
      color: "text-[#C9A84C] bg-[#C9A84C]/15",
      rows: finance?.recentInvoices ?? [],
      name: "invoices-report",
    },
    {
      title: "تقرير الدعم الفني",
      desc: `${stats?.openTickets ?? 0} تذكرة مفتوحة من ${stats?.totalTickets ?? 0}`,
      icon: HeadphonesIcon,
      color: "text-red-400 bg-red-500/15",
      rows: [],
      name: "support-report",
    },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">مركز التقارير</h3>
          <p className="text-xs text-muted-foreground mt-0.5">توليد وتصدير تقارير المنصة</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
          <Download className="h-3.5 w-3.5" /> تصدير PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Card key={r.name} className="bg-sidebar border-sidebar-border hover:border-[#C9A84C]/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", r.color)}>
                  <r.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1.5 text-xs h-8 bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold" onClick={() => r.rows.length ? exportCSV(r.rows, r.name) : window.print()}>
                  <Download className="h-3 w-3" /> Excel / CSV
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs h-8" onClick={() => window.print()}>
                  <Download className="h-3 w-3" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Summary Table (printable) */}
      <Card className="bg-sidebar border-sidebar-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">ملخص الأداء المالي الشهري</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-right text-xs">الشهر</TableHead>
              <TableHead className="text-right text-xs">الإيرادات</TableHead>
              <TableHead className="text-right text-xs">المصروفات</TableHead>
              <TableHead className="text-right text-xs">صافي الربح</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(finance?.monthly ?? []).map((m: any) => (
              <TableRow key={m.month} className="hover:bg-muted/20">
                <TableCell className="text-xs font-medium">{m.month}</TableCell>
                <TableCell className="text-xs text-emerald-400">{(Number(m.revenue||0)/100).toLocaleString("ar-SA")} ر.س</TableCell>
                <TableCell className="text-xs text-red-400">{(Number(m.expenses||0)/100).toLocaleString("ar-SA")} ر.س</TableCell>
                <TableCell className={cn("text-xs font-bold", (m.revenue-m.expenses)>=0?"text-[#C9A84C]":"text-red-400")}>
                  {((Number(m.revenue||0)-Number(m.expenses||0))/100).toLocaleString("ar-SA")} ر.س
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM SECURITY TAB
═══════════════════════════════════════════════════ */
function PlatformSecurityTab() {
  const [secTab, setSecTab] = useState<"audit"|"logins">("logins");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["admin", "/audit-logs"],
    queryFn: () => API("/audit-logs"),
    staleTime: 30_000,
  });

  const loginLogs: any[] = data?.loginLogs ?? [];
  const auditLogs: any[] = data?.auditLogs ?? [];
  const loginStats: any[] = data?.loginStats ?? [];

  const successCount = loginStats.find((s: any) => s.status === "success")?.cnt ?? 0;
  const failedCount  = loginStats.find((s: any) => s.status === "failed")?.cnt ?? 0;

  const filteredLogins = loginLogs.filter(l => !search || l.email?.includes(search) || l.full_name?.includes(search) || l.ip_address?.includes(search));
  const filteredAudit  = auditLogs.filter(l => !search || l.user_full_name?.includes(search) || l.action?.includes(search) || l.resource?.includes(search));

  return (
    <div className="space-y-4" dir="rtl">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "إجمالي تسجيلات الدخول", value: loginLogs.length, icon: User, color: "text-blue-400 bg-blue-500/15" },
          { label: "دخول ناجح", value: successCount, icon: CheckCircle2, color: "text-green-400 bg-green-500/15" },
          { label: "دخول فاشل", value: failedCount, icon: XCircle, color: "text-red-400 bg-red-500/15" },
          { label: "سجلات التدقيق", value: auditLogs.length, icon: Shield, color: "text-amber-400 bg-amber-500/15" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-sidebar border-sidebar-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2">
        <button onClick={() => setSecTab("logins")} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", secTab==="logins" ? "bg-[#C9A84C] text-black font-bold border-[#C9A84C]" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
          سجل الدخول ({loginLogs.length})
        </button>
        <button onClick={() => setSecTab("audit")} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", secTab==="audit" ? "bg-[#C9A84C] text-black font-bold border-[#C9A84C]" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
          سجل التدقيق ({auditLogs.length})
        </button>
        <div className="mr-auto relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="h-8 w-48 pr-8 pl-3 rounded-lg bg-muted/40 text-xs border border-border/40 focus:outline-none" />
        </div>
      </div>

      {/* Login Logs Table */}
      {secTab === "logins" && (
        <Card className="bg-sidebar border-sidebar-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-right text-xs">المستخدم</TableHead>
                <TableHead className="text-right text-xs">البريد</TableHead>
                <TableHead className="text-right text-xs">IP</TableHead>
                <TableHead className="text-right text-xs">المتصفح</TableHead>
                <TableHead className="text-right text-xs">الجهاز</TableHead>
                <TableHead className="text-right text-xs">الحالة</TableHead>
                <TableHead className="text-right text-xs">التوقيت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredLogins.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">لا توجد سجلات</TableCell></TableRow>
              ) : filteredLogins.slice(0, 50).map((l: any) => (
                <TableRow key={l.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs font-medium">{l.full_name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground" dir="ltr">{l.email ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground" dir="ltr">{l.ip_address ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.browser ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.device_type ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px]", l.status === "success" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                      {l.status === "success" ? "نجح" : "فشل"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-SA")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Audit Logs Table */}
      {secTab === "audit" && (
        <Card className="bg-sidebar border-sidebar-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-right text-xs">المستخدم</TableHead>
                <TableHead className="text-right text-xs">الإجراء</TableHead>
                <TableHead className="text-right text-xs">المورد</TableHead>
                <TableHead className="text-right text-xs">التفاصيل</TableHead>
                <TableHead className="text-right text-xs">التوقيت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredAudit.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">لا توجد سجلات تدقيق</TableCell></TableRow>
              ) : filteredAudit.slice(0, 50).map((l: any) => (
                <TableRow key={l.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs font-medium">{l.user_full_name ?? "نظام"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{l.action}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.resource}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-48 truncate">{l.details ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-SA")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM WEBSITE TAB (CMS)
═══════════════════════════════════════════════════ */
const WEBSITE_SECTIONS = [
  { key: "hero",     label: "القسم الرئيسي (Hero)",    icon: Globe2,      fields: ["hero_title", "hero_subtitle", "hero_cta"] },
  { key: "features", label: "المميزات",                  icon: Layers,      fields: ["features_title", "features_subtitle"] },
  { key: "pricing",  label: "الأسعار",                   icon: Banknote,    fields: ["pricing_title", "pricing_subtitle"] },
  { key: "faq",      label: "الأسئلة الشائعة",           icon: HelpCircle,  fields: ["faq_title"] },
  { key: "footer",   label: "التذييل (Footer)",          icon: Newspaper,   fields: ["footer_company_name", "footer_tagline", "footer_email", "footer_phone"] },
  { key: "legal",    label: "الصفحات القانونية",          icon: Shield,      fields: ["terms_title", "privacy_title"] },
];

const FIELD_LABELS: Record<string, string> = {
  hero_title: "العنوان الرئيسي", hero_subtitle: "العنوان الفرعي", hero_cta: "زر الدعوة للعمل",
  features_title: "عنوان المميزات", features_subtitle: "وصف المميزات",
  pricing_title: "عنوان الأسعار", pricing_subtitle: "وصف الأسعار",
  faq_title: "عنوان الأسئلة الشائعة",
  footer_company_name: "اسم الشركة", footer_tagline: "الشعار", footer_email: "البريد الإلكتروني", footer_phone: "رقم الهاتف",
  terms_title: "عنوان شروط الاستخدام", privacy_title: "عنوان سياسة الخصوصية",
};

function PlatformWebsiteTab({ qc, toast }: any) {
  const [activeSection, setActiveSection] = useState("hero");
  const [localData, setLocalData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: websiteData, isLoading } = useQuery<any>({
    queryKey: ["admin", "/website"],
    queryFn: () => API("/website"),
    staleTime: 60_000,
    onSuccess: (d: any) => setLocalData(d ?? {}),
  });

  const section = WEBSITE_SECTIONS.find(s => s.key === activeSection)!;

  const save = async () => {
    setSaving(true);
    try {
      await API("/website", { method: "PUT", body: JSON.stringify(localData) });
      qc.invalidateQueries({ queryKey: ["admin", "/website"] });
      toast({ title: "✅ تم حفظ إعدادات الموقع" });
    } catch { toast({ title: "خطأ في الحفظ", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">إدارة محتوى الموقع</h3>
          <p className="text-xs text-muted-foreground mt-0.5">تخصيص محتوى الصفحة الرئيسية للمنصة</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => window.open("/", "_blank")}>
            <Globe className="h-3.5 w-3.5" /> معاينة
          </Button>
          <Button size="sm" className="gap-1.5 text-xs bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} حفظ
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Section selector */}
        <div className="space-y-1.5">
          {WEBSITE_SECTIONS.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-right",
                activeSection===s.key ? "bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30 font-semibold" : "hover:bg-muted/30 text-muted-foreground")}>
              <s.icon className="h-4 w-4 shrink-0" />
              <span>{s.label}</span>
              <ChevronRight className="h-3.5 w-3.5 mr-auto" />
            </button>
          ))}
        </div>

        {/* Fields editor */}
        <Card className="lg:col-span-3 bg-sidebar border-sidebar-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <section.icon className="h-4 w-4 text-[#C9A84C]" />
              {section.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />)}</div>
            ) : section.fields.map(field => {
              const wKey = `website_${field}`;
              return (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">{FIELD_LABELS[field] ?? field}</Label>
                  <Textarea
                    value={localData[wKey] ?? websiteData?.[wKey] ?? ""}
                    onChange={e => setLocalData(prev => ({ ...prev, [wKey]: e.target.value }))}
                    rows={2}
                    className="resize-none text-sm bg-muted/20 border-border/40"
                    placeholder={`أدخل ${FIELD_LABELS[field] ?? field}...`}
                  />
                </div>
              );
            })}

            <div className="pt-2 flex justify-end">
              <Button size="sm" className="gap-1.5 bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التغييرات
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
