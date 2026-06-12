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
  Shield, CheckCircle, XCircle, Layers, PlugZap, Smartphone,
  Gift, CalendarClock, Ban, PlusCircle, Timer, TrendingDown, Percent
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
  User, Banknote, CheckSquare, AlertCircle as ACircle,
  Globe2, Newspaper, ListOrdered, HelpCircle, PenLine, Info,
  CreditCard, Receipt, AlertTriangle,
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
        <TabsContent value="ai-credits" className="mt-4"><AiCreditsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="usage"     className="mt-4"><UsageTab /></TabsContent>
        <TabsContent value="departments" className="mt-4"><DepartmentsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="legal"     className="mt-4"><LegalSystemsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="support"   className="mt-4"><SupportTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="security"  className="mt-4"><PlatformSecurityTab /></TabsContent>
        <TabsContent value="website"   className="mt-4"><PlatformWebsiteTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="settings"  className="mt-4"><SettingsTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="developer" className="mt-4"><DevCenterTab toast={toast} /></TabsContent>
        <TabsContent value="hosting"    className="mt-4"><HostingCenterTab toast={toast} /></TabsContent>
        <TabsContent value="saas-billing" className="mt-4"><PlatformBillingTab toast={toast} /></TabsContent>
        <TabsContent value="mobile-app"   className="mt-4"><MobileAppTab qc={qc} toast={toast} /></TabsContent>
        <TabsContent value="global-control" className="mt-4"><GlobalControlTab toast={toast} /></TabsContent>
        <TabsContent value="trials"         className="mt-4"><TrialsDashTab toast={toast} /></TabsContent>
        <TabsContent value="home-cms"       className="mt-4"><HomeCmsTab toast={toast} /></TabsContent>
        <TabsContent value="plans-cms"      className="mt-4"><PlansCmsTab toast={toast} /></TabsContent>
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
  { id: "ai-credits",   label: "رصيد AI",             icon: Zap },
  { id: "usage",        label: "الاستهلاك",          icon: Activity },
  { id: "departments",  label: "الأقسام",            icon: FolderTree },
  { id: "legal",        label: "الأنظمة",            icon: BookOpen },
  { id: "support",      label: "الدعم الفني",        icon: HeadphonesIcon },
  { id: "security",     label: "الأمن",              icon: SecurityIcon },
  { id: "website",      label: "الموقع الإلكتروني",  icon: Layout },
  { id: "settings",     label: "الإعدادات",          icon: Settings },
  { id: "developer",    label: "مركز المطور",         icon: Code2 },
  { id: "hosting",      label: "مركز الاستضافة",     icon: Globe },
  { id: "saas-billing", label: "فواتير المنصة",      icon: CreditCard },
  { id: "mobile-app",   label: "تطبيق الجوال",       icon: Smartphone },
  { id: "global-control", label: "الإدارة العالمية",  icon: Globe2 },
  { id: "trials",         label: "التجارب المجانية",   icon: Gift },
  { id: "home-cms",       label: "محتوى الصفحة الرئيسية", icon: Layout },
  { id: "plans-cms",      label: "باقات الأسعار",         icon: Tag },
];

/* ═══════════════════════════════════════════════════
   OFFICES TAB
═══════════════════════════════════════════════════ */
const PLAN_SLUG_COLORS: Record<string, string> = {
  free:         "#64748B",
  basic:        "#3B82F6",
  pro:          "#C9A84C",
  growth:       "#8B5CF6",
  advanced:     "#EC4899",
  enterprise:   "#10B981",
  elite:        "#F59E0B",
  /* legacy */
  starter:      "#3B82F6",
  professional: "#C9A84C",
  business:     "#8B5CF6",
};
const PLAN_SLUG_LABELS: Record<string, string> = {
  free:         "مجاني",
  basic:        "مبتدئ",
  pro:          "احترافي",
  growth:       "نمو",
  advanced:     "متقدم",
  enterprise:   "مؤسسي",
  elite:        "النخبة",
  /* legacy */
  starter:      "مبتدئ (قديم)",
  professional: "احترافي (قديم)",
  business:     "أعمال (قديم)",
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
  const [adminReply, setAdminReply] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: threadMsgs = [], refetch: refetchThread } = useQuery<any[]>({
    queryKey: ["admin", "support-thread", selected?.id],
    queryFn: () => API(`/support/${selected.id}/messages`),
    enabled: !!selected?.id,
    refetchInterval: 8_000,
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }: any) => API(`/support/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/support"] }); toast({ title: "تم التحديث ✓" }); },
  });

  const reply = useMutation({
    mutationFn: ({ id, message }: any) => API(`/support/${id}/reply`, { method: "POST", body: JSON.stringify({ message }) }),
    onSuccess: () => {
      setAdminReply("");
      qc.invalidateQueries({ queryKey: ["admin", "/support"] });
      refetchThread();
      toast({ title: "تم إرسال الرد ✓" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = tickets.filter((t: any) => filterStatus === "all" || t.status === filterStatus);

  const PRIORITY = {
    low:    { label: "منخفض", color: "text-gray-400" },
    medium: { label: "متوسط", color: "text-yellow-400" },
    high:   { label: "عالٍ",  color: "text-orange-400" },
    urgent: { label: "عاجل",  color: "text-red-400" },
  };
  const STATUS = {
    open:        { label: "مفتوح",          color: "bg-blue-500/10 text-blue-400" },
    in_progress: { label: "قيد المعالجة",   color: "bg-yellow-500/10 text-yellow-400" },
    resolved:    { label: "محلول",          color: "bg-emerald-500/10 text-emerald-400" },
    closed:      { label: "مغلق",           color: "bg-muted text-muted-foreground" },
  };

  return (
    <div className="grid md:grid-cols-5 gap-4">
      {/* List — 2 cols */}
      <div className="md:col-span-2 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-muted-foreground">
            {filtered.length} تذكرة
          </span>
          <div className="flex gap-1 flex-wrap">
            {["all", "open", "in_progress", "resolved", "closed"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn("text-[10px] px-2 py-0.5 rounded-md border transition-colors",
                  filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
                {s === "all" ? "الكل" : (STATUS as any)[s]?.label}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm opacity-60">لا توجد تذاكر</div>
        ) : filtered.map((t: any) => (
          <div key={t.id}
            onClick={() => { setSelected(t); setAdminReply(""); }}
            className={cn("p-3 rounded-xl border cursor-pointer transition-all",
              selected?.id === t.id
                ? "border-[#C9A84C]/40 bg-[#C9A84C]/5 shadow-sm"
                : "border-border/50 hover:bg-muted/20")}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="font-semibold text-sm line-clamp-1">{t.subject}</span>
              <Badge className={cn("text-[9px] shrink-0 px-1.5", (STATUS as any)[t.status]?.color)}>
                {(STATUS as any)[t.status]?.label}
              </Badge>
            </div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1.5">
              <span className="font-medium">{t.userName}</span>
              <span>·</span>
              <span className={(PRIORITY as any)[t.priority]?.color}>{(PRIORITY as any)[t.priority]?.label}</span>
              <span>·</span>
              <span>{new Date(t.createdAt).toLocaleDateString("ar-SA")}</span>
            </div>
            {t.officeName && <div className="text-[10px] text-muted-foreground mt-0.5 opacity-60">{t.officeName}</div>}
          </div>
        ))}
      </div>

      {/* Detail + Thread — 3 cols */}
      {selected ? (
        <div className="md:col-span-3 space-y-3">
          {/* Ticket info */}
          <div className="p-4 rounded-xl border border-border/50 bg-muted/10">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold text-sm">{selected.subject}</h3>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                  <span>{selected.userName}</span>
                  <span>·</span>
                  <span>{selected.userEmail}</span>
                  {selected.officeName && <><span>·</span><span className="text-[#C9A84C]">{selected.officeName}</span></>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                  onClick={() => update.mutate({ id: selected.id, status: "in_progress" })}>
                  <Clock className="h-3 w-3 ml-1" /> معالجة
                </Button>
                <Button size="sm" className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => update.mutate({ id: selected.id, status: "resolved" })}>
                  <CheckCircle2 className="h-3 w-3 ml-1" /> حل
                </Button>
              </div>
            </div>
          </div>

          {/* Message thread */}
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto px-1 py-1">
            {/* Original message */}
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-[9px] font-bold text-blue-400">
                م
              </div>
              <div className="flex-1 max-w-[85%]">
                <div className="rounded-xl p-3 text-sm bg-muted/40 border border-border/30 leading-relaxed">
                  {selected.body}
                </div>
                <div className="text-[9px] text-muted-foreground mt-1 mr-1">
                  {selected.userName} · {new Date(selected.createdAt).toLocaleDateString("ar-SA")}
                </div>
              </div>
            </div>

            {/* Thread messages */}
            {threadMsgs.map((msg: any) => (
              <div key={msg.id} className={cn("flex gap-2.5", msg.senderType === "admin" ? "flex-row-reverse" : "")}>
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold",
                  msg.senderType === "admin" ? "bg-[#C9A84C]/20 text-[#C9A84C]" : "bg-blue-500/20 text-blue-400")}>
                  {msg.senderType === "admin" ? "د" : "م"}
                </div>
                <div className={cn("flex-1 max-w-[85%]", msg.senderType === "admin" ? "items-end" : "")}>
                  <div className={cn("rounded-xl p-3 text-sm leading-relaxed",
                    msg.senderType === "admin"
                      ? "bg-[#C9A84C]/10 border border-[#C9A84C]/20"
                      : "bg-muted/40 border border-border/30")}>
                    {msg.message}
                  </div>
                  <div className={cn("text-[9px] text-muted-foreground mt-1", msg.senderType === "admin" ? "text-left" : "mr-1")}>
                    {msg.senderName} · {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Admin reply input */}
          {selected.status !== "closed" && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold">رد فريق الدعم</Label>
              <div className="flex gap-2">
                <Textarea value={adminReply} onChange={e => setAdminReply(e.target.value)}
                  rows={3} className="resize-none text-xs flex-1" placeholder="اكتب ردك على العميل..." />
                <Button size="icon" className="h-full aspect-square bg-[#C9A84C] hover:bg-[#b8973d] text-[#1A2744] self-stretch"
                  onClick={() => { if (adminReply.trim()) reply.mutate({ id: selected.id, message: adminReply }); }}
                  disabled={!adminReply.trim() || reply.isPending}>
                  {reply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="md:col-span-3 flex items-center justify-center h-52 text-muted-foreground">
          <div className="text-center">
            <HeadphonesIcon className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">اختر تذكرة لعرض المحادثة والرد عليها</p>
          </div>
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

/* ═══════════════════════════════════════════════════
   PLATFORM SAAS BILLING TAB
═══════════════════════════════════════════════════ */
const PLAN_COLORS_SA: Record<string, string> = {
  advisor:    "#38BDF8",
  solo:       "#C9A84C",
  office:     "#34D399",
  advanced:   "#A78BFA",
  corporate:  "#FB923C",
  enterprise: "#94A3B8",
};

function PlatformBillingTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useAdmin<any>("/billing/overview");

  const payMut = useMutation({
    mutationFn: async (id: string) => {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const r = await fetch(`${BASE}/api/admin/billing/pay/${id}`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => { toast({ title: "✅ تم تسجيل الدفع بنجاح" }); refetch(); },
    onError:   () => toast({ title: "خطأ", variant: "destructive" }),
  });

  const fmtSAR = (v: number) => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "م ر.س";
    if (v >= 1_000)     return (v / 1_000).toFixed(0)     + "ك ر.س";
    return v.toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س";
  };

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    paid:    { label: "مدفوعة",       cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    unpaid:  { label: "قيد الانتظار", cls: "bg-amber-500/10  text-amber-400  border-amber-500/30"  },
    overdue: { label: "متأخرة",       cls: "bg-red-500/10    text-red-400    border-red-500/30"    },
  };

  const kpis = [
    { label: "إجمالي الإيرادات",  value: fmtSAR(data?.total_revenue   ?? 0), icon: Banknote,       color: "text-emerald-400 bg-emerald-500/15" },
    { label: "إيرادات معلّقة",    value: fmtSAR(data?.pending_revenue ?? 0), icon: Clock,          color: "text-amber-400  bg-amber-500/15"   },
    { label: "إيرادات متأخرة",    value: fmtSAR(data?.overdue_revenue ?? 0), icon: AlertTriangle,   color: "text-red-400    bg-red-500/15"     },
    { label: "فواتير مدفوعة",    value: String(data?.paid_count    ?? 0),    icon: CheckCircle2,   color: "text-green-400  bg-green-500/15"   },
    { label: "قيد الانتظار",     value: String(data?.unpaid_count  ?? 0),    icon: Receipt,        color: "text-blue-400   bg-blue-500/15"    },
    { label: "متأخرة",           value: String(data?.overdue_count ?? 0),    icon: XCircle,        color: "text-red-400    bg-red-500/15"     },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#C9A84C]" /> فواتير اشتراكات المنصة
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            إيرادات SaaS المحصّلة من مكاتب المحاماة — نظرة عامة شاملة
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-sidebar border-sidebar-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              {isLoading
                ? <div className="h-5 w-24 bg-muted/40 rounded animate-pulse" />
                : <p className="text-xl font-bold">{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue by plan */}
      {(data?.by_plan ?? []).length > 0 && (
        <Card className="bg-sidebar border-sidebar-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">الإيرادات حسب الباقة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.by_plan as any[]).map((p: any) => {
              const total = Math.max(data.total_revenue, 1);
              const pct   = Math.min(100, (parseFloat(p.revenue) / total) * 100);
              const col   = PLAN_COLORS_SA[p.plan_id] ?? "#94A3B8";
              return (
                <div key={p.plan_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">{p.plan_name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{p.invoice_count} فاتورة</span>
                      <span className="font-bold" style={{ color: col }}>
                        {parseFloat(p.revenue).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent invoices */}
      <Card className="bg-sidebar border-sidebar-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">أحدث الفواتير</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted/20 rounded animate-pulse" />
              ))}
            </div>
          ) : (data?.recent ?? []).length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
              لا توجد فواتير بعد
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {(data.recent as any[]).map((inv: any) => {
                const st = STATUS_MAP[inv.status] ?? STATUS_MAP.unpaid;
                return (
                  <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.plan_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("ar-SA") : "—"}
                      </p>
                    </div>
                    <span className="font-bold text-sm text-[#C9A84C]">
                      {parseFloat(inv.amount).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} {inv.currency}
                    </span>
                    <Badge variant="outline" className={cn("text-[10px] border shrink-0", st.cls)}>
                      {st.label}
                    </Badge>
                    {inv.status !== "paid" && (
                      <Button size="sm" variant="outline"
                        className="text-[10px] h-6 px-2 gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                        onClick={() => payMut.mutate(inv.id)} disabled={payMut.isPending}>
                        <CheckCircle className="h-3 w-3" /> تسديد
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty-state */}
      {!isLoading && (data?.total_invoices ?? 0) === 0 && (
        <div className="p-5 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 text-center space-y-2">
          <CreditCard className="h-10 w-10 mx-auto text-[#C9A84C]/50" />
          <p className="text-sm font-semibold text-[#C9A84C]">لا توجد فواتير بعد</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            عندما تشترك المكاتب في باقات عدالة AI ستظهر فواتيرها هنا مع تتبع الدفع والإيرادات.
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MOBILE APP TAB
═══════════════════════════════════════════════════ */
function MobileAppTab({ qc, toast }: any) {
  const { data: settings = [], isLoading, refetch } = useAdmin<any[]>("/settings");
  const mobileEnabledSetting = (settings as any[]).find((s: any) => s.key === "mobile_app_enabled");
  const isEnabled = mobileEnabledSetting?.value !== "false";

  const toggle = useMutation({
    mutationFn: (val: boolean) =>
      API(`/settings/mobile_app_enabled`, { method: "PUT", body: JSON.stringify({ value: val ? "true" : "false" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/settings"] }); refetch(); toast({ title: isEnabled ? "⛔ تم إيقاف تطبيق الجوال" : "✅ تم تشغيل تطبيق الجوال" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const MOBILE_FEATURES = [
    { icon: "📱", label: "لوحة التحكم", desc: "عرض القضايا والإحصاءات" },
    { icon: "⚖️", label: "القضايا",    desc: "إدارة ومتابعة القضايا" },
    { icon: "👥", label: "العملاء",    desc: "قائمة العملاء وبياناتهم" },
    { icon: "📄", label: "العقود",     desc: "عرض العقود والوثائق" },
    { icon: "🔔", label: "التذكيرات", desc: "التنبيهات والمواعيد" },
  ];

  return (
    <div className="space-y-6">
      {/* Main Toggle Card */}
      <div className={`rounded-2xl border p-6 transition-colors ${isEnabled ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${isEnabled ? "bg-green-500/20" : "bg-red-500/20"}`}>
              📱
            </div>
            <div>
              <h3 className="font-bold text-lg">تطبيق الجوال — عدالة AI Mobile</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isEnabled
                  ? "التطبيق يعمل — المستخدمون يمكنهم الوصول إليه"
                  : "التطبيق موقوف — سيرى المستخدمون شاشة صيانة"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${isEnabled ? "text-green-400" : "text-red-400"}`}>
              {isEnabled ? "مفعّل" : "موقوف"}
            </span>
            <button
              onClick={() => toggle.mutate(!isEnabled)}
              disabled={toggle.isPending || isLoading}
              className="focus:outline-none"
              title={isEnabled ? "إيقاف التطبيق" : "تشغيل التطبيق"}
            >
              {isEnabled
                ? <ToggleRight className="h-10 w-10 text-green-400 hover:text-green-300 transition-colors cursor-pointer" />
                : <ToggleLeft className="h-10 w-10 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer" />
              }
            </button>
          </div>
        </div>

        {!isEnabled && (
          <div className="mt-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">
            <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
            عند فتح التطبيق سيرى المستخدمون رسالة "التطبيق تحت الصيانة" ولن يتمكنوا من تسجيل الدخول.
          </div>
        )}
      </div>

      {/* Mobile Features Overview */}
      <div>
        <h4 className="text-sm font-bold mb-3 text-muted-foreground">ميزات التطبيق المتاحة</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MOBILE_FEATURES.map((f) => (
            <div key={f.label} className={`rounded-xl border p-3 flex items-center gap-3 ${isEnabled ? "border-border/50 bg-card" : "border-border/30 bg-muted/10 opacity-60"}`}>
              <span className="text-xl">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-[10px] text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Link to mobile app */}
      <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">رابط التطبيق</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono" dir="ltr">
            {window.location.origin}/adala-mobile/
          </p>
        </div>
        <Button
          size="sm" variant="outline" className="gap-1.5"
          onClick={() => window.open(`${window.location.origin}/adala-mobile/`, "_blank")}
        >
          <Smartphone className="h-3.5 w-3.5" />
          فتح التطبيق
        </Button>
      </div>

      {/* Info box */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-primary">كيف يعمل التحكم؟</span>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1 pr-6 list-disc">
          <li>عند الإيقاف: التطبيق يعرض شاشة صيانة ويمنع الوصول للبيانات</li>
          <li>عند التشغيل: المستخدمون يصلون لجميع ميزات التطبيق بشكل طبيعي</li>
          <li>التغيير فوري — لا يحتاج إعادة تشغيل أو نشر جديد</li>
          <li>الإعداد محفوظ في جدول <code className="bg-muted px-1 rounded text-[10px]">platform_settings</code> بالمفتاح <code className="bg-muted px-1 rounded text-[10px]">mobile_app_enabled</code></li>
        </ul>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AI CREDITS TAB
═══════════════════════════════════════════════════ */
const MODEL_COSTS: Record<string, number> = { gemini: 1, claude: 3, openai: 3, fallback: 0 };

function AiCreditsTab({ qc, toast }: any) {
  const { data: offices = [], isLoading, refetch } = useAdmin<any[]>("/admin/ai-credits");
  const [topupDialog, setTopupDialog] = useState<any>(null);
  const [settingsDialog, setSettingsDialog] = useState<any>(null);
  const [txDialog, setTxDialog] = useState<any>(null);
  const [topupForm, setTopupForm] = useState({ amount: "", description: "شحن يدوي" });
  const [settingsForm, setSettingsForm] = useState({ monthlyAllowance: 100, autoRenew: true, renewDay: 1 });
  const [addOfficeOpen, setAddOfficeOpen] = useState(false);
  const [newOffice, setNewOffice] = useState({ officeId: "", officeName: "", monthlyAllowance: 100 });
  const { data: txRows = [] } = useQuery<any[]>({
    queryKey: ["admin", `/admin/ai-credits/${txDialog?.office_id}/transactions`],
    queryFn: () => API(`/admin/ai-credits/${txDialog?.office_id}/transactions`).then(r => r.json()).catch(() => []),
    enabled: !!txDialog,
  });

  const topupMut = useMutation({
    mutationFn: (d: any) => API("/admin/ai-credits/topup", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: (r) => r.json().then((d: any) => {
      if (d.error) { toast({ title: "خطأ", description: d.error, variant: "destructive" }); return; }
      toast({ title: `تم الشحن ✓ — الرصيد: ${d.balance} نقطة` });
      qc.invalidateQueries({ queryKey: ["admin", "/admin/ai-credits"] });
      setTopupDialog(null);
    }),
  });

  const settingsMut = useMutation({
    mutationFn: (d: any) => API("/admin/ai-credits/settings", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      toast({ title: "تم حفظ الإعدادات ✓" });
      qc.invalidateQueries({ queryKey: ["admin", "/admin/ai-credits"] });
      setSettingsDialog(null);
    },
  });

  const renewMut = useMutation({
    mutationFn: (officeId?: string) => API("/admin/ai-credits/renew", { method: "POST", body: JSON.stringify({ officeId }) }),
    onSuccess: (r) => r.json().then((d: any) => {
      toast({ title: `تم التجديد ✓ — ${d.renewed} مكتب` });
      qc.invalidateQueries({ queryKey: ["admin", "/admin/ai-credits"] });
    }),
  });

  const addOfficeMut = useMutation({
    mutationFn: (d: any) => API("/admin/ai-credits/add-office", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      toast({ title: "تم إضافة المكتب ✓" });
      qc.invalidateQueries({ queryKey: ["admin", "/admin/ai-credits"] });
      setAddOfficeOpen(false);
      setNewOffice({ officeId: "", officeName: "", monthlyAllowance: 100 });
    },
  });

  function openTopup(o: any) {
    setTopupDialog(o);
    setTopupForm({ amount: "", description: "شحن يدوي" });
  }
  function openSettings(o: any) {
    setSettingsDialog(o);
    setSettingsForm({ monthlyAllowance: o.monthly_allowance ?? 100, autoRenew: o.auto_renew ?? true, renewDay: o.renew_day ?? 1 });
  }

  const totalBalance = offices.reduce((s: number, o: any) => s + (o.balance ?? 0), 0);
  const totalUsed = offices.reduce((s: number, o: any) => s + (o.used_this_month ?? 0), 0);

  const txTypeColor: Record<string, string> = {
    topup:    "text-green-400",
    renewal:  "text-blue-400",
    usage:    "text-amber-400",
    adjustment: "text-purple-400",
  };
  const txTypeLabel: Record<string, string> = {
    topup: "شحن", renewal: "تجديد", usage: "استخدام", adjustment: "تعديل",
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">رصيد AI لكل مكتب</h2>
          <p className="text-xs text-muted-foreground mt-0.5">إدارة نقاط الاستخدام، الشحن اليدوي، والتجديد الشهري التلقائي</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setAddOfficeOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> إضافة مكتب
          </Button>
          <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => renewMut.mutate(undefined)} disabled={renewMut.isPending}>
            {renewMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            تجديد الكل الآن
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الرصيد", value: totalBalance.toLocaleString("ar-SA"), icon: Zap, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "استُهلك هذا الشهر", value: totalUsed.toLocaleString("ar-SA"), icon: Activity, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "عدد المكاتب", value: offices.length, icon: Building2, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "تجديد تلقائي", value: offices.filter((o: any) => o.auto_renew).length, icon: RefreshCw, color: "text-green-400", bg: "bg-green-500/10" },
        ].map(s => (
          <Card key={s.label} className="bg-sidebar border-sidebar-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cost guide */}
      <div className="flex gap-2 flex-wrap text-[11px] text-muted-foreground items-center">
        <span className="font-semibold text-foreground">تكلفة النقاط:</span>
        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">Gemini Flash = 1 نقطة</span>
        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Claude Haiku = 3 نقاط</span>
        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">GPT-4o mini = 3 نقاط</span>
      </div>

      {/* Offices table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin ml-2" /> جارٍ التحميل...
        </div>
      ) : (
        <Card className="bg-sidebar border-sidebar-border">
          <Table>
            <TableHeader>
              <TableRow className="border-sidebar-border hover:bg-transparent">
                <TableHead className="text-right text-xs">المكتب</TableHead>
                <TableHead className="text-right text-xs">الرصيد الحالي</TableHead>
                <TableHead className="text-right text-xs">المنح الشهرية</TableHead>
                <TableHead className="text-right text-xs">استُهلك / الشهر</TableHead>
                <TableHead className="text-right text-xs">تجديد تلقائي</TableHead>
                <TableHead className="text-right text-xs">آخر تجديد</TableHead>
                <TableHead className="text-right text-xs">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offices.map((o: any) => {
                const pct = o.monthly_allowance > 0 ? Math.min(100, Math.round((o.used_this_month / o.monthly_allowance) * 100)) : 0;
                const isLow = o.balance <= 10;
                return (
                  <TableRow key={o.office_id} className="border-sidebar-border hover:bg-muted/10">
                    <TableCell className="font-medium text-sm">{o.office_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn("font-bold text-sm", isLow ? "text-red-400" : "text-foreground")}>{(o.balance ?? 0).toLocaleString("ar-SA")}</span>
                        {isLow && <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-400 px-1">منخفض</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{(o.monthly_allowance ?? 0).toLocaleString("ar-SA")}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">{o.used_this_month ?? 0}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", o.auto_renew ? "border-green-500/30 text-green-400" : "border-muted text-muted-foreground")}>
                        {o.auto_renew ? `كل يوم ${o.renew_day}` : "معطَّل"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.last_renewed_at ? new Date(o.last_renewed_at).toLocaleDateString("ar-SA") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-amber-400 hover:text-amber-300" onClick={() => openTopup(o)}>
                          <Zap className="h-3 w-3" /> شحن
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openSettings(o)}>
                          <Settings className="h-3 w-3" /> إعدادات
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setTxDialog(o)}>
                          <Activity className="h-3 w-3" /> سجل
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-blue-400 hover:text-blue-300" onClick={() => renewMut.mutate(o.office_id)} disabled={renewMut.isPending}>
                          <RefreshCw className="h-3 w-3" /> تجديد
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Topup Dialog */}
      <Dialog open={!!topupDialog} onOpenChange={v => !v && setTopupDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" /> شحن رصيد AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-muted/30 rounded-xl p-3 text-sm">
              <span className="text-muted-foreground">المكتب: </span>
              <span className="font-semibold">{topupDialog?.office_name}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span className="text-muted-foreground">الرصيد الحالي: </span>
              <span className="font-bold text-amber-400">{topupDialog?.balance} نقطة</span>
            </div>
            <div>
              <Label>عدد النقاط المُضافة</Label>
              <Input type="number" min="1" value={topupForm.amount} onChange={e => setTopupForm(f => ({ ...f, amount: e.target.value }))} placeholder="مثال: 100" className="mt-1" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[50, 100, 200, 500].map(n => (
                <button key={n} onClick={() => setTopupForm(f => ({ ...f, amount: String(n) }))}
                  className={cn("px-3 py-1 text-xs rounded-lg border transition-all", topupForm.amount === String(n) ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "border-border text-muted-foreground hover:border-border/80")}>
                  +{n}
                </button>
              ))}
            </div>
            <div>
              <Label>ملاحظة</Label>
              <Input value={topupForm.description} onChange={e => setTopupForm(f => ({ ...f, description: e.target.value }))} placeholder="سبب الشحن..." className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopupDialog(null)}>إلغاء</Button>
            <Button onClick={() => topupMut.mutate({ officeId: topupDialog?.office_id, amount: parseInt(topupForm.amount), description: topupForm.description })}
              disabled={!topupForm.amount || isNaN(parseInt(topupForm.amount)) || topupMut.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-1.5">
              {topupMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              شحن {topupForm.amount ? `(+${topupForm.amount} نقطة)` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={!!settingsDialog} onOpenChange={v => !v && setSettingsDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> إعدادات رصيد AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm font-semibold text-muted-foreground">{settingsDialog?.office_name}</p>
            <div>
              <Label>المنحة الشهرية (نقاط)</Label>
              <Input type="number" min="0" value={settingsForm.monthlyAllowance}
                onChange={e => setSettingsForm(f => ({ ...f, monthlyAllowance: parseInt(e.target.value) || 0 }))}
                className="mt-1" />
              <p className="text-[11px] text-muted-foreground mt-1">عدد النقاط التي تُمنح للمكتب تلقائياً كل شهر</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>التجديد التلقائي</Label>
                <p className="text-[11px] text-muted-foreground">تجديد الرصيد شهرياً تلقائياً</p>
              </div>
              <Switch checked={settingsForm.autoRenew} onCheckedChange={v => setSettingsForm(f => ({ ...f, autoRenew: v }))} />
            </div>
            {settingsForm.autoRenew && (
              <div>
                <Label>يوم التجديد (1-28)</Label>
                <Input type="number" min="1" max="28" value={settingsForm.renewDay}
                  onChange={e => setSettingsForm(f => ({ ...f, renewDay: parseInt(e.target.value) || 1 }))}
                  className="mt-1" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsDialog(null)}>إلغاء</Button>
            <Button onClick={() => settingsMut.mutate({ officeId: settingsDialog?.office_id, ...settingsForm })}
              disabled={settingsMut.isPending}
              className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold">
              {settingsMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions Dialog */}
      <Dialog open={!!txDialog} onOpenChange={v => !v && setTxDialog(null)}>
        <DialogContent className="bg-card border-border max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> سجل المعاملات — {txDialog?.office_name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {txRows.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">لا توجد معاملات بعد</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-right text-xs">النوع</TableHead>
                    <TableHead className="text-right text-xs">المبلغ</TableHead>
                    <TableHead className="text-right text-xs">التفاصيل</TableHead>
                    <TableHead className="text-right text-xs">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txRows.map((t: any) => (
                    <TableRow key={t.id} className="border-border/50 hover:bg-muted/10">
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5", txTypeColor[t.type] ?? "text-muted-foreground")}>
                          {txTypeLabel[t.type] ?? t.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("font-bold text-sm", t.amount > 0 ? "text-green-400" : "text-red-400")}>
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.description ?? "—"}
                        {t.model && <span className="mr-1 text-[10px] px-1 bg-muted rounded">{t.model}</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString("ar-SA")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxDialog(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Office Dialog */}
      <Dialog open={addOfficeOpen} onOpenChange={setAddOfficeOpen}>
        <DialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مكتب جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>معرف المكتب (office_id)</Label>
              <Input value={newOffice.officeId} onChange={e => setNewOffice(f => ({ ...f, officeId: e.target.value }))} placeholder="office_123" className="mt-1" dir="ltr" />
            </div>
            <div>
              <Label>اسم المكتب</Label>
              <Input value={newOffice.officeName} onChange={e => setNewOffice(f => ({ ...f, officeName: e.target.value }))} placeholder="مكتب الأحمدي للمحاماة" className="mt-1" />
            </div>
            <div>
              <Label>المنحة الشهرية الابتدائية</Label>
              <Input type="number" min="0" value={newOffice.monthlyAllowance} onChange={e => setNewOffice(f => ({ ...f, monthlyAllowance: parseInt(e.target.value) || 0 }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOfficeOpen(false)}>إلغاء</Button>
            <Button onClick={() => addOfficeMut.mutate(newOffice)} disabled={!newOffice.officeId || !newOffice.officeName || addOfficeMut.isPending}
              className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold">
              {addOfficeMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL CONTROL CENTER TAB
   لوحة الإدارة العالمية — Multi-Tenant Control Center
═══════════════════════════════════════════════════════════════════ */

const RISK_COLOR: Record<string, string> = {
  HIGH:   "text-red-400 bg-red-400/10 border-red-400/20",
  MEDIUM: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  LOW:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};
const RISK_LABEL: Record<string, string> = {
  HIGH: "خطر مرتفع", MEDIUM: "خطر متوسط", LOW: "آمن",
};
const GOLD = "#C9A84C";
const PLAN_COLORS_GC: Record<string, string> = {
  free:"#64748B", basic:"#3B82F6", pro:"#C9A84C",
  growth:"#8B5CF6", advanced:"#EC4899", enterprise:"#10B981", elite:"#F59E0B",
};

function fmtSAR(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

function GlobalControlTab({ toast }: { toast: any }) {
  const [activeSection, setActiveSection] = useState<"overview"|"tenants"|"ai"|"risk"|"growth">("overview");
  const [changingPlan, setChangingPlan] = useState<{ id: string; name: string } | null>(null);
  const [newPlan, setNewPlan] = useState("pro");
  const [planChanging, setPlanChanging] = useState(false);
  const { getToken } = useAuth();

  async function authFetch(path: string, opts?: RequestInit) {
    const token = await getToken();
    const BASE2 = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
    const r = await fetch(`${BASE2}/api/admin${path}`, {
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...opts,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  const { data: rev,    isLoading: lRev  } = useQuery({ queryKey: ["gc","revenue"],      queryFn: () => authFetch("/tenants/revenue"), retry: false });
  const { data: tenants,isLoading: lTen  } = useQuery({ queryKey: ["gc","tenants"],      queryFn: () => authFetch("/tenants"),         retry: false });
  const { data: risk,   isLoading: lRisk } = useQuery({ queryKey: ["gc","risk"],         queryFn: () => authFetch("/risk"),            retry: false });
  const { data: growth, isLoading: lGrow } = useQuery({ queryKey: ["gc","growth"],       queryFn: () => authFetch("/growth"),          retry: false });
  const { data: ai,     isLoading: lAI   } = useQuery({ queryKey: ["gc","ai-analytics"], queryFn: () => authFetch("/ai-analytics"),    retry: false });
  const qc = useQueryClient();

  async function doChangePlan() {
    if (!changingPlan) return;
    setPlanChanging(true);
    try {
      await authFetch(`/tenants/${changingPlan.id}/plan`, {
        method: "POST", body: JSON.stringify({ plan: newPlan }),
      });
      toast({ title: "تم تغيير الباقة", description: `${changingPlan.name} → ${newPlan}` });
      qc.invalidateQueries({ queryKey: ["gc"] });
      setChangingPlan(null);
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setPlanChanging(false); }
  }

  const PLAN_OPTIONS = ["free","basic","pro","growth","advanced","enterprise","elite"];
  const SECTIONS = [
    { id: "overview", label: "نظرة عامة",    icon: <BarChart3 className="h-3.5 w-3.5"/> },
    { id: "tenants",  label: "المكاتب",       icon: <Building2 className="h-3.5 w-3.5"/> },
    { id: "ai",       label: "AI Analytics", icon: <Zap className="h-3.5 w-3.5"/> },
    { id: "risk",     label: "محرك المخاطر", icon: <ShieldAlert className="h-3.5 w-3.5"/> },
    { id: "growth",   label: "النمو",         icon: <TrendingUp className="h-3.5 w-3.5"/> },
  ] as const;

  const isLoading = lRev || lTen || lRisk || lGrow || lAI;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-[#C9A84C]" />
            لوحة الإدارة العالمية
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">مركز التحكم الكامل بكل المكاتب والإيرادات والمخاطر</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const d = new Date().toLocaleDateString("ar-SA");
            const revData = rev as any;
            const growthData = growth as any;
            const riskData = risk as any;
            const aiData2 = ai as any;
            const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>تقرير الإدارة العالمية — عدالة AI</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}@page{size:A4;margin:15mm 18mm}
body{font-family:'Cairo',Arial,sans-serif;color:#1a1a2e;background:#fff;font-size:10.5pt}
.cover{background:linear-gradient(135deg,#080F1E,#1A2744);color:#fff;padding:28px;margin-bottom:20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
.cover h1{font-size:20pt;font-weight:900;color:#C9A84C;margin-bottom:4px}.cover p{color:rgba(255,255,255,0.55);font-size:9pt}
.section{margin-bottom:18px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:8px;break-inside:avoid}
.section h2{font-size:11pt;font-weight:800;color:#1A2744;border-bottom:2.5px solid #C9A84C;padding-bottom:6px;margin-bottom:12px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.kpi{background:#f8fafc;border-radius:6px;padding:10px 8px;text-align:center;border:1px solid #e5e7eb}
.kpi .val{font-size:14pt;font-weight:900;color:#C9A84C}.kpi .lbl{font-size:7.5pt;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:8.5pt}
th{background:#1A2744;color:#C9A84C;padding:7px 8px;text-align:right;font-weight:700}
td{padding:6px 8px;border-bottom:1px solid #f1f5f9}tr:nth-child(even) td{background:#f8fafc}
.risk-h{background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:4px;font-size:8pt;font-weight:700}
.risk-m{background:#fef9c3;color:#d97706;padding:2px 6px;border-radius:4px;font-size:8pt;font-weight:700}
.risk-l{background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:4px;font-size:8pt;font-weight:700}
.footer{text-align:center;color:#94a3b8;font-size:7.5pt;margin-top:18px;border-top:1px solid #e5e7eb;padding-top:10px}
</style></head><body>
<div class="cover">
  <div><h1>تقرير الإدارة العالمية</h1><p>عدالة AI · منصة SaaS قانونية · ${d}</p></div>
  <div style="text-align:center"><div style="font-size:28pt;font-weight:900;color:#C9A84C">${growthData?.summary?.totalOffices ?? 0}</div><div style="color:rgba(255,255,255,0.6);font-size:9pt">مكتب مسجّل</div></div>
</div>
<div class="section">
  <h2>📊 مؤشرات الإيرادات الرئيسية</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="val">${(revData?.totals?.gross ?? 0).toLocaleString("ar-SA")} ر.س</div><div class="lbl">إجمالي الإيرادات</div></div>
    <div class="kpi"><div class="val">${(revData?.totals?.net ?? 0).toLocaleString("ar-SA")} ر.س</div><div class="lbl">صافي المنصة</div></div>
    <div class="kpi"><div class="val">${growthData?.summary?.paidOffices ?? 0}</div><div class="lbl">مكاتب مدفوعة</div></div>
    <div class="kpi"><div class="val">${growthData?.summary?.conversionRatePct ?? "0%"}</div><div class="lbl">معدل التحويل</div></div>
  </div>
</div>
<div class="section">
  <h2>🏢 أعلى المكاتب إيراداً</h2>
  <table><thead><tr><th>#</th><th>اسم المكتب</th><th>الباقة</th><th>الإيرادات (ر.س)</th><th>الصافي (ر.س)</th></tr></thead>
  <tbody>${(revData?.topTenants ?? []).slice(0,10).map((t: any, i: number) => `<tr><td>${i+1}</td><td>${t.name ?? t.officeId}</td><td>${t.plan ?? ""}</td><td><strong>${(t.gross ?? 0).toLocaleString("ar-SA")}</strong></td><td>${(t.net ?? 0).toLocaleString("ar-SA")}</td></tr>`).join("")}</tbody>
  </table>
</div>
<div class="section">
  <h2>⚠️ تقرير المخاطر</h2>
  <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi"><div class="val" style="color:#dc2626">${riskData?.summary?.high ?? 0}</div><div class="lbl">خطر مرتفع</div></div>
    <div class="kpi"><div class="val" style="color:#d97706">${riskData?.summary?.medium ?? 0}</div><div class="lbl">خطر متوسط</div></div>
    <div class="kpi"><div class="val" style="color:#16a34a">${riskData?.summary?.low ?? 0}</div><div class="lbl">آمن</div></div>
  </div>
  <table><thead><tr><th>المكتب</th><th>الباقة</th><th>الإيرادات</th><th>AI استخدام</th><th>مستوى الخطر</th><th>الأسباب</th></tr></thead>
  <tbody>${(riskData?.tenants ?? []).filter((t: any) => t.riskLevel !== "LOW").slice(0,15).map((t: any) => `<tr><td>${t.name}</td><td>${t.plan}</td><td>${(t.revenue ?? 0).toLocaleString("ar-SA")} ر.س</td><td>${t.aiUsed}</td><td><span class="${t.riskLevel === "HIGH" ? "risk-h" : t.riskLevel === "MEDIUM" ? "risk-m" : "risk-l"}">${t.riskLevel === "HIGH" ? "مرتفع" : t.riskLevel === "MEDIUM" ? "متوسط" : "منخفض"} (${t.riskScore})</span></td><td style="font-size:8pt;color:#64748b">${(t.reasons ?? []).join(" · ")}</td></tr>`).join("")}</tbody>
  </table>
</div>
<div class="section">
  <h2>🤖 تحليلات الذكاء الاصطناعي (30 يوماً)</h2>
  <div class="kpi-grid">
    <div class="kpi"><div class="val">${(aiData2?.summary?.totalCalls ?? 0).toLocaleString()}</div><div class="lbl">إجمالي الطلبات</div></div>
    <div class="kpi"><div class="val">${(aiData2?.summary?.totalUnits ?? 0).toLocaleString()}</div><div class="lbl">الوحدات المستهلكة</div></div>
    <div class="kpi"><div class="val">$${(aiData2?.summary?.totalCostUSD ?? 0).toFixed(2)}</div><div class="lbl">التكلفة التقديرية</div></div>
    <div class="kpi"><div class="val">${growthData?.summary?.paidOffices ?? 0}</div><div class="lbl">مكاتب نشطة</div></div>
  </div>
</div>
<div class="footer">عدالة AI · تقرير مُولَّد تلقائياً · ${new Date().toLocaleString("ar-SA")} · سري وخاص بالإدارة العليا</div>
<script>setTimeout(()=>window.print(),600)</script>
</body></html>`;
            const win = window.open("", "_blank", "width=950,height=1200");
            if (win) { win.document.write(html); win.document.close(); }
          }} className="gap-1.5 text-xs border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10">
            <Receipt className="h-3.5 w-3.5" /> تصدير PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["gc"] })} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
        </div>
      </div>

      {/* Section Pills */}
      <div className="flex gap-2 flex-wrap">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id as any)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
              activeSection === s.id
                ? "bg-[#C9A84C] text-black border-[#C9A84C]"
                : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-border")}>
            {s.icon}{s.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل البيانات...
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {activeSection === "overview" && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<DollarSign className="h-4 w-4"/>} label="إجمالي الإيرادات" color="#C9A84C"
              value={rev ? fmtSAR(rev.totals?.gross ?? 0) : "—"} sub="إجمالي كل المدفوعات" />
            <StatCard icon={<TrendingUp className="h-4 w-4"/>} label="صافي المنصة" color="#10B981"
              value={rev ? fmtSAR(rev.totals?.net ?? 0) : "—"} sub={`بعد رسوم Stripe وعمولة المنصة`} />
            <StatCard icon={<Building2 className="h-4 w-4"/>} label="مكاتب مدفوعة" color="#8B5CF6"
              value={growth ? growth.summary?.paidOffices ?? 0 : "—"} sub={`من ${growth?.summary?.totalOffices ?? "?"} مكتب إجمالاً`} />
            <StatCard icon={<Activity className="h-4 w-4"/>} label="معدل التحويل" color="#3B82F6"
              value={growth ? `${growth.summary?.conversionRate ?? 0}%` : "—"} sub="من مجاني إلى مدفوع" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Zap className="h-4 w-4"/>} label="استدعاءات AI (30 يوم)" color="#F59E0B"
              value={ai ? (ai.summary?.totalCalls ?? 0).toLocaleString() : "—"} sub="مجموع كل المكاتب" />
            <StatCard icon={<ShieldAlert className="h-4 w-4"/>} label="مكاتب خطر مرتفع" color="#EF4444"
              value={risk ? risk.summary?.high ?? 0 : "—"} sub="تحتاج مراجعة فورية" />
            <StatCard icon={<Receipt className="h-4 w-4"/>} label="إجمالي المعاملات" color="#C9A84C"
              value={rev ? rev.totals?.transactions ?? 0 : "—"} sub="دفعات ناجحة" />
            <StatCard icon={<CreditCard className="h-4 w-4"/>} label="رسوم Stripe" color="#64748B"
              value={rev ? fmtSAR(rev.totals?.stripeFee ?? 0) : "—"} sub="2.9% + 1 ر.س / معاملة" />
          </div>

          {/* Revenue Chart */}
          {rev?.monthly?.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">الإيرادات الشهرية (12 شهراً)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={rev.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => `${v}`} />
                    <Tooltip formatter={(v: any, n: string) => [`${Number(v).toLocaleString()} ر.س`, n === "gross" ? "الإجمالي" : n === "net" ? "الصافي" : "رسوم Stripe"]}
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="gross"    stroke={GOLD}      fill={`${GOLD}20`}      strokeWidth={2} name="gross" />
                    <Area type="monotone" dataKey="net"      stroke="#10B981"   fill="#10B98120"         strokeWidth={2} name="net" />
                    <Area type="monotone" dataKey="stripeFee" stroke="#64748B"  fill="#64748B20"         strokeWidth={1} name="stripeFee" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Tenants + Plan Dist side by side */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Top Tenants */}
            {rev?.topTenants?.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">أعلى المكاتب إيراداً</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {rev.topTenants.slice(0,6).map((t: any, i: number) => (
                    <div key={t.officeId} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">{t.plan}</p>
                      </div>
                      <span className="text-xs font-bold" style={{ color: GOLD }}>{fmtSAR(t.gross)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {/* Plan Distribution */}
            {growth?.planDistribution?.length > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">توزيع الباقات</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={growth.planDistribution} dataKey="count" nameKey="plan"
                        cx="50%" cy="50%" outerRadius={60} label={({ plan, pct }) => `${plan} ${pct}%`} labelLine={false}
                        fontSize={9}>
                        {growth.planDistribution.map((p: any) => (
                          <Cell key={p.plan} fill={PLAN_COLORS_GC[p.plan] ?? "#64748B"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, n: string) => [v, n]} contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── TENANTS ── */}
      {activeSection === "tenants" && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#C9A84C]" />
              جميع المكاتب ({tenants?.total ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  <TableHead className="text-xs">المكتب</TableHead>
                  <TableHead className="text-xs">الباقة</TableHead>
                  <TableHead className="text-xs">الإيرادات</TableHead>
                  <TableHead className="text-xs">الصافي</TableHead>
                  <TableHead className="text-xs">المعاملات</TableHead>
                  <TableHead className="text-xs">المخاطرة</TableHead>
                  <TableHead className="text-xs">تغيير الباقة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(tenants?.tenants ?? []).map((t: any) => {
                  const riskRow = (risk?.tenants ?? []).find((r: any) => r.officeId === t.id);
                  return (
                    <TableRow key={t.id} className="border-border/20 hover:bg-muted/20">
                      <TableCell className="py-2">
                        <div className="text-xs font-semibold truncate max-w-[140px]">{t.name ?? t.id}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{t.email}</div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge className="text-[10px] px-1.5 py-0.5 border-0"
                          style={{ background: `${PLAN_COLORS_GC[t.plan] ?? "#64748B"}20`, color: PLAN_COLORS_GC[t.plan] ?? "#64748B" }}>
                          {t.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs font-bold" style={{ color: GOLD }}>{fmtSAR(t.revenue?.gross ?? 0)}</TableCell>
                      <TableCell className="py-2 text-xs text-emerald-400">{fmtSAR(t.revenue?.net ?? 0)}</TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">{t.revenue?.transactions ?? 0}</TableCell>
                      <TableCell className="py-2">
                        {riskRow && (
                          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", RISK_COLOR[riskRow.riskLevel])}>
                            {RISK_LABEL[riskRow.riskLevel]} {riskRow.riskScore}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                          onClick={() => { setChangingPlan({ id: t.id, name: t.name ?? t.id }); setNewPlan(t.plan ?? "pro"); }}>
                          تغيير
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── AI ANALYTICS ── */}
      {activeSection === "ai" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard icon={<Zap className="h-4 w-4"/>} label="إجمالي الاستدعاءات (30 يوم)" color="#F59E0B"
              value={ai?.summary?.totalCalls?.toLocaleString() ?? "—"} />
            <StatCard icon={<Database className="h-4 w-4"/>} label="إجمالي الوحدات" color="#8B5CF6"
              value={ai?.summary?.totalUnits?.toLocaleString() ?? "—"} />
            <StatCard icon={<DollarSign className="h-4 w-4"/>} label="التكلفة التقديرية" color="#EF4444"
              value={ai?.summary?.totalCostUSD ? `$${ai.summary.totalCostUSD.toFixed(2)}` : "—"} />
          </div>

          {/* Daily Trend */}
          {(ai?.dailyTrend?.length ?? 0) > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">الاستخدام اليومي (14 يوماً)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={ai.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="calls" fill={GOLD} radius={[3,3,0,0]} name="استدعاءات" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* By Feature */}
            {(ai?.byFeature?.length ?? 0) > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">الاستخدام حسب الميزة</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {ai.byFeature.map((f: any) => (
                    <div key={f.feature} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="truncate font-medium">{f.feature}</span>
                          <span className="text-muted-foreground shrink-0">{f.calls.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ background: GOLD, width: `${Math.min((f.calls / (ai.byFeature[0]?.calls || 1)) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {/* Top AI Spenders */}
            {(ai?.officeCredits?.length ?? 0) > 0 && (
              <Card className="border-border/50">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">أعلى المكاتب استهلاكاً</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {ai.officeCredits.slice(0,8).map((o: any) => (
                    <div key={o.officeId} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="truncate">{o.officeName}</span>
                          <span className="text-[#C9A84C] font-bold shrink-0">{o.usagePct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ background: o.usagePct >= 90 ? "#EF4444" : o.usagePct >= 70 ? "#F59E0B" : "#10B981", width: `${Math.min(o.usagePct, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── RISK ENGINE ── */}
      {activeSection === "risk" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<ShieldAlert className="h-4 w-4"/>} label="خطر مرتفع" color="#EF4444" value={risk?.summary?.high ?? 0} />
            <StatCard icon={<AlertTriangle className="h-4 w-4"/>} label="خطر متوسط" color="#F59E0B" value={risk?.summary?.medium ?? 0} />
            <StatCard icon={<CheckCircle className="h-4 w-4"/>} label="آمن" color="#10B981" value={risk?.summary?.low ?? 0} />
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                تقرير المخاطر لجميع المكاتب
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/30 hover:bg-transparent">
                    <TableHead className="text-xs">المكتب</TableHead>
                    <TableHead className="text-xs">الباقة</TableHead>
                    <TableHead className="text-xs">الإيرادات</TableHead>
                    <TableHead className="text-xs">AI استخدام</TableHead>
                    <TableHead className="text-xs">فشل الدفع</TableHead>
                    <TableHead className="text-xs">درجة المخاطرة</TableHead>
                    <TableHead className="text-xs">الأسباب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(risk?.tenants ?? []).map((t: any) => (
                    <TableRow key={t.officeId} className="border-border/20 hover:bg-muted/20">
                      <TableCell className="py-2">
                        <div className="text-xs font-semibold truncate max-w-[120px]">{t.name}</div>
                        <div className="text-[10px] text-muted-foreground">{t.email}</div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge className="text-[10px] px-1 border-0" style={{ background: `${PLAN_COLORS_GC[t.plan]??"#64748B"}20`, color: PLAN_COLORS_GC[t.plan]??"#64748B" }}>
                          {t.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-xs">{fmtSAR(t.revenue)}</TableCell>
                      <TableCell className="py-2 text-xs">{t.aiUsed}</TableCell>
                      <TableCell className="py-2 text-xs text-center">
                        {t.paymentFailures > 0 ? <span className="text-red-400 font-bold">{t.paymentFailures}</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full" style={{ background: t.riskLevel === "HIGH" ? "#EF4444" : t.riskLevel === "MEDIUM" ? "#F59E0B" : "#10B981", width: `${t.riskScore}%` }} />
                          </div>
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", RISK_COLOR[t.riskLevel])}>
                            {t.riskScore}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {t.reasons.map((r: string, i: number) => (
                            <span key={i} className="text-[9px] bg-red-400/10 text-red-300 px-1.5 py-0.5 rounded">{r}</span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── GROWTH ── */}
      {activeSection === "growth" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={<Building2 className="h-4 w-4"/>} label="إجمالي المكاتب" color="#3B82F6"
              value={growth?.summary?.totalOffices ?? "—"} />
            <StatCard icon={<Crown className="h-4 w-4"/>} label="اشتراكات مدفوعة" color={GOLD}
              value={growth?.summary?.paidOffices ?? "—"} />
            <StatCard icon={<Users className="h-4 w-4"/>} label="مكاتب مجانية" color="#64748B"
              value={growth?.summary?.freeOffices ?? "—"} />
            <StatCard icon={<TrendingUp className="h-4 w-4"/>} label="معدل التحويل" color="#10B981"
              value={growth?.summary?.conversionRatePct ?? "—"} />
          </div>

          {/* MRR Trend */}
          {(growth?.mrrTrend?.length ?? 0) > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">نمو الإيرادات الشهرية (MRR)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={growth.mrrTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} ر.س`]}
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                    <Line type="monotone" dataKey="mrr" stroke={GOLD}     strokeWidth={2} dot={{ r: 3, fill: GOLD }} name="الإجمالي" />
                    <Line type="monotone" dataKey="net" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981" }} name="الصافي" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* New Offices monthly */}
          {(growth?.monthlyNewOffices?.length ?? 0) > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">مكاتب جديدة شهرياً</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={growth.monthlyNewOffices}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey="new_offices" fill="#8B5CF6" radius={[3,3,0,0]} name="مكاتب جديدة" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Plan Change Dialog ── */}
      <Dialog open={!!changingPlan} onOpenChange={o => !o && setChangingPlan(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">تغيير باقة: {changingPlan?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs mb-1 block">الباقة الجديدة</Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setChangingPlan(null)}>إلغاء</Button>
            <Button size="sm" onClick={doChangePlan} disabled={planChanging}
              className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold">
              {planChanging && <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />}
              تطبيق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TRIALS DASHBOARD TAB
═══════════════════════════════════════════════════ */
function TrialsDashTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const [extendTarget, setExtendTarget] = useState<any>(null);
  const [extendDays, setExtendDays] = useState(14);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["admin-trials"],
    queryFn: () => API("/trials").then(r => r.json()),
    staleTime: 30_000,
  });

  const trials: any[]  = data?.trials  ?? [];
  const stats:  any    = data?.stats   ?? {};
  const configured     = data?.configured !== false;

  const fmtDate = (ts: number | null) => ts
    ? new Date(ts * 1000).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })
    : "—";

  const PLAN_BADGE: Record<string, string> = {
    free: "bg-slate-500/15 text-slate-300", basic: "bg-blue-500/15 text-blue-300",
    pro: "bg-yellow-500/15 text-yellow-300", growth: "bg-purple-500/15 text-purple-300",
    advanced: "bg-pink-500/15 text-pink-300", enterprise: "bg-emerald-500/15 text-emerald-300",
    elite: "bg-amber-500/15 text-amber-300",
  };

  async function doExtend() {
    if (!extendTarget) return;
    setActionLoading(extendTarget.subId);
    try {
      const r = await API(`/trials/${extendTarget.subId}/extend`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: extendDays }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "خطأ");
      toast({ title: "✅ تم التمديد", description: `تمت إضافة ${extendDays} يوماً لـ ${extendTarget.officeName}` });
      setExtendTarget(null);
      refetch();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  async function doCancel(trial: any) {
    if (!confirm(`إنهاء التجربة المجانية لـ "${trial.officeName}" الآن؟`)) return;
    setActionLoading(trial.subId);
    try {
      const r = await API(`/trials/${trial.subId}/cancel`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "خطأ");
      toast({ title: "✅ تم الإنهاء", description: `انتهت التجربة لـ ${trial.officeName}` });
      refetch();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally { setActionLoading(null); }
  }

  if (!configured) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
      <Gift className="h-10 w-10 opacity-30" />
      <p className="text-sm">Stripe غير مُهيأ — أضف <code className="bg-muted px-1 rounded text-xs">STRIPE_SECRET_KEY</code> لعرض التجارب</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Gift className="h-4.5 w-4.5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-black">لوحة التجارب المجانية</h2>
            <p className="text-xs text-muted-foreground">إدارة فترات التجربة المجانية ٣٠ يوماً عبر Stripe</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />تحديث
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "تجارب نشطة",        value: stats.active      ?? 0, icon: Timer,       color: "text-blue-400",   bg: "bg-blue-500/10"   },
          { label: "تنتهي خلال ٧ أيام", value: stats.urgent      ?? 0, icon: CalendarClock,color: "text-amber-400",  bg: "bg-amber-500/10"  },
          { label: "تحولوا لمدفوع",     value: stats.converted   ?? 0, icon: CheckCircle,  color: "text-emerald-400",bg: "bg-emerald-500/10"},
          { label: "معدل التحويل",       value: `${stats.conversionRate ?? 0}٪`, icon: Percent, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <div>
                <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trials Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Gift className="h-4 w-4 text-blue-400" />
            قائمة التجارب
            <Badge className="text-xs font-bold bg-muted/60 text-muted-foreground border-border/50 mr-auto">
              {trials.length} اشتراك
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : trials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Gift className="h-8 w-8 opacity-25" />
              <p className="text-sm">لا توجد تجارب نشطة حالياً</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-right text-xs">المكتب</TableHead>
                  <TableHead className="text-right text-xs">الباقة</TableHead>
                  <TableHead className="text-right text-xs">الحالة</TableHead>
                  <TableHead className="text-right text-xs">تاريخ البدء</TableHead>
                  <TableHead className="text-right text-xs">تاريخ الانتهاء</TableHead>
                  <TableHead className="text-right text-xs">الأيام المتبقية</TableHead>
                  <TableHead className="text-right text-xs">القيمة</TableHead>
                  <TableHead className="text-right text-xs">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trials.map((t: any) => {
                  const isUrgent    = t.status === "trialing" && t.daysLeft !== null && t.daysLeft <= 7;
                  const isConverted = t.status === "converted";
                  const isLoading   = actionLoading === t.subId;
                  return (
                    <TableRow key={t.subId} className={isUrgent ? "bg-amber-500/5" : ""}>
                      <TableCell className="text-sm font-medium">{t.officeName}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] font-bold border-0 ${PLAN_BADGE[t.officePlan] ?? "bg-muted/50 text-muted-foreground"}`}>
                          {t.officePlan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isConverted ? (
                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-0 gap-1">
                            <CheckCircle className="h-2.5 w-2.5" /> تحول لمدفوع
                          </Badge>
                        ) : isUrgent ? (
                          <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-0 gap-1">
                            <CalendarClock className="h-2.5 w-2.5" /> ينتهي قريباً
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-blue-500/10 text-blue-400 border-0 gap-1">
                            <Gift className="h-2.5 w-2.5" /> نشط
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(t.trialStart)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(t.trialEnd)}</TableCell>
                      <TableCell>
                        {t.daysLeft !== null ? (
                          <span className={`text-sm font-bold ${isUrgent ? "text-amber-400" : isConverted ? "text-emerald-400" : "text-blue-400"}`}>
                            {isConverted ? "—" : `${t.daysLeft} يوم`}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.amount > 0 ? `${t.amount.toLocaleString("ar-SA")} ${t.currency.toUpperCase()}` : "—"}
                      </TableCell>
                      <TableCell>
                        {!isConverted && (
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              disabled={isLoading}
                              onClick={() => { setExtendTarget(t); setExtendDays(14); }}>
                              <PlusCircle className="h-3 w-3" />تمديد
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                              disabled={isLoading}
                              onClick={() => doCancel(t)}>
                              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}إنهاء
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Extend Dialog */}
      <Dialog open={!!extendTarget} onOpenChange={o => !o && setExtendTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-blue-400" />
              تمديد فترة التجربة
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-4">
            <p className="text-sm text-muted-foreground">
              تمديد التجربة لـ <span className="font-bold text-foreground">{extendTarget?.officeName}</span>
            </p>
            <div className="space-y-2">
              <Label className="text-xs">عدد الأيام الإضافية</Label>
              <div className="flex gap-2">
                {[7, 14, 30].map(d => (
                  <Button key={d} size="sm" variant={extendDays === d ? "default" : "outline"}
                    className={extendDays === d ? "bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold" : ""}
                    onClick={() => setExtendDays(d)}>
                    {d} يوم
                  </Button>
                ))}
              </div>
              <input type="number" min={1} max={180} value={extendDays}
                onChange={e => setExtendDays(Number(e.target.value))}
                className="w-full mt-1 px-3 py-1.5 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setExtendTarget(null)}>إلغاء</Button>
            <Button size="sm" onClick={doExtend} disabled={!!actionLoading}
              className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold gap-1">
              {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              تمديد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   HOME CMS TAB
═══════════════════════════════════════════════════ */
function HomeCmsTab({ toast }: { toast: any }) {
  const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

  const [form, setForm] = useState<any>({
    hero: {
      badge: "", titleLine1: "", titleLine2: "", titleHighlight: "", subtitle: "",
    },
    trust: { tagline: "" },
    stats: { offices: "", cases: "", satisfaction: "", timeSaving: "" },
    features: { title: "", subtitle: "" },
    cta_section: { title: "", titleHighlight: "", subtitle: "" },
    announcement: { enabled: false, text: "", link: "", bgColor: "#C9A84C", textColor: "#0D1626" },
    seo: { metaTitle: "", metaDescription: "", ogImage: "" },
    contact: { whatsapp: "", email: "", twitter: "", linkedin: "", youtube: "", showWhatsappButton: true },
    footer: {
      tagline: "", copyright: "", showStatus: true, statusText: "",
      showPlatformCol: true, showCompanyCol: true, showSupportCol: true,
      platformLinks: [{ label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }],
      companyLinks:  [{ label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }],
      supportLinks:  [{ label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }],
    },
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/api/home/content`)
      .then(r => r.json())
      .then(data => {
        setForm((prev: any) => {
          const merged: any = {};
          for (const section of Object.keys(prev)) {
            merged[section] = { ...prev[section], ...(data[section] || {}) };
          }
          return merged;
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function setField(section: string, key: string, val: any) {
    setForm((prev: any) => ({
      ...prev,
      [section]: { ...prev[section], [key]: val },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`${BASE_URL}/api/home/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "تم الحفظ", description: "تم تحديث محتوى الصفحة الرئيسية." });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleReset() {
    if (!confirm("هل تريد إعادة ضبط المحتوى إلى الإعدادات الافتراضية؟")) return;
    setResetting(true);
    try {
      const r = await fetch(`${BASE_URL}/api/home/content/reset`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      /* re-fetch the updated defaults */
      const fresh = await fetch(`${BASE_URL}/api/home/content`).then(x => x.json());
      setForm((prev: any) => {
        const merged: any = {};
        for (const section of Object.keys(prev)) {
          merged[section] = { ...prev[section], ...(fresh[section] || {}) };
        }
        return merged;
      });
      toast({ title: "تم الإعادة", description: "تمت استعادة المحتوى الافتراضي." });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setResetting(false);
  }

  const SECTIONS = [
    { id: "hero",         label: "قسم Hero",           icon: "🏠" },
    { id: "trust",        label: "شريط الثقة",          icon: "⭐" },
    { id: "stats",        label: "الإحصائيات",          icon: "📊" },
    { id: "features",     label: "الميزات",             icon: "✨" },
    { id: "cta_section",  label: "دعوة للعمل (CTA)",    icon: "🎯" },
    { id: "announcement", label: "شريط الإعلانات",       icon: "📢" },
    { id: "contact",      label: "التواصل والروابط",     icon: "📞" },
    { id: "seo",          label: "SEO",                  icon: "🔍" },
    { id: "footer",       label: "التذييل (Footer)",      icon: "🦶" },
  ];

  if (!loaded) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="h-6 w-6 animate-spin text-[#C9A84C]" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">محتوى الصفحة الرئيسية</h2>
          <p className="text-sm text-muted-foreground">تعديل النصوص والمحتوى المعروض على الصفحة الرئيسية مباشرةً</p>
        </div>
        <div className="flex gap-2">
          <a href={`${BASE_URL}/`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1">
              <Globe className="h-3.5 w-3.5" /> معاينة
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting} className="gap-1 text-orange-400 border-orange-400/30 hover:bg-orange-400/10">
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            إعادة الضبط
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold gap-1">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            حفظ التغييرات
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-6">
        {/* Sidebar nav */}
        <div className="space-y-1">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full text-right px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeSection === s.id ? "bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Section editor */}
        <Card className="border-border bg-card/50">
          <CardContent className="pt-6 space-y-4">

            {/* ── HERO ── */}
            {activeSection === "hero" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">محتوى قسم Hero (الجزء العلوي من الصفحة)</h3>
                {[
                  { key: "badge",         label: "نص الشارة (Badge)",        placeholder: "✦ النظام القانوني الأكثر ذكاءً" },
                  { key: "titleLine1",    label: "سطر العنوان الأول",         placeholder: "أدر مكتبك القانوني" },
                  { key: "titleLine2",    label: "سطر العنوان الثاني",        placeholder: "بكفاءة لا مثيل لها" },
                  { key: "titleHighlight",label: "السطر المميز (ذهبي)",       placeholder: "بقوة الذكاء الاصطناعي" },
                  { key: "subtitle",      label: "النص الوصفي",               placeholder: "منصة متكاملة..." },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    {f.key === "subtitle" ? (
                      <textarea rows={3} value={form.hero[f.key] || ""} onChange={e => setField("hero", f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#C9A84C] resize-none" />
                    ) : (
                      <Input value={form.hero[f.key] || ""} onChange={e => setField("hero", f.key, e.target.value)} placeholder={f.placeholder} className="text-sm" />
                    )}
                  </div>
                ))}
              </>
            )}

            {/* ── TRUST ── */}
            {activeSection === "trust" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">شريط الثقة (النص أعلى الإحصائيات)</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs">عبارة الثقة (Tagline)</Label>
                  <Input value={form.trust.tagline || ""} onChange={e => setField("trust", "tagline", e.target.value)}
                    placeholder="موثوق من مكاتب المحاماة في المنطقة العربية" className="text-sm" />
                </div>
              </>
            )}

            {/* ── STATS ── */}
            {activeSection === "stats" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">الأرقام والإحصائيات (تُعرض كعدّادات متحركة)</h3>
                {[
                  { key: "offices",       label: "عدد المكاتب",        placeholder: "1000" },
                  { key: "cases",         label: "عدد القضايا",         placeholder: "100000" },
                  { key: "satisfaction",  label: "نسبة الرضا",          placeholder: "99" },
                  { key: "timeSaving",    label: "نسبة توفير الوقت %",  placeholder: "40" },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    <Input type="number" value={form.stats[f.key] || ""} onChange={e => setField("stats", f.key, e.target.value)}
                      placeholder={f.placeholder} className="text-sm" />
                  </div>
                ))}
              </>
            )}

            {/* ── FEATURES ── */}
            {activeSection === "features" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">قسم الميزات — العنوان والوصف</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs">العنوان الرئيسي</Label>
                  <Input value={form.features.title || ""} onChange={e => setField("features", "title", e.target.value)}
                    placeholder="كل ما يحتاجه مكتبك القانوني" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">النص الوصفي</Label>
                  <textarea rows={3} value={form.features.subtitle || ""} onChange={e => setField("features", "subtitle", e.target.value)}
                    placeholder="منصة شاملة تجمع إدارة القضايا والعملاء والمستندات..."
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#C9A84C] resize-none" />
                </div>
              </>
            )}

            {/* ── CTA ── */}
            {activeSection === "cta_section" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">قسم دعوة للعمل (CTA) — في أسفل الصفحة</h3>
                {[
                  { key: "title",          label: "السطر الأول من العنوان",   placeholder: "ابدأ رحلتك نحو" },
                  { key: "titleHighlight", label: "الجزء المميز (ذهبي)",      placeholder: "مكتب قانوني رقمي" },
                  { key: "subtitle",       label: "النص الوصفي",               placeholder: "جرّب المنصة مجاناً لمدة 30 يوماً..." },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    {f.key === "subtitle" ? (
                      <textarea rows={3} value={form.cta_section[f.key] || ""} onChange={e => setField("cta_section", f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#C9A84C] resize-none" />
                    ) : (
                      <Input value={form.cta_section[f.key] || ""} onChange={e => setField("cta_section", f.key, e.target.value)} placeholder={f.placeholder} className="text-sm" />
                    )}
                  </div>
                ))}
              </>
            )}

            {/* ── ANNOUNCEMENT ── */}
            {activeSection === "announcement" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">شريط الإعلانات — يظهر في أعلى الصفحة</h3>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="ann-enabled" checked={!!form.announcement.enabled}
                      onChange={e => setField("announcement", "enabled", e.target.checked)}
                      className="w-4 h-4 rounded accent-[#C9A84C]" />
                    <label htmlFor="ann-enabled" className="text-sm font-medium">تفعيل شريط الإعلانات</label>
                  </div>
                  {form.announcement.enabled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">نشط</span>
                  )}
                </div>
                {form.announcement.enabled && (
                  <div className="p-3 rounded-lg border text-sm text-center font-bold"
                    style={{ background: form.announcement.bgColor || "#C9A84C", color: form.announcement.textColor || "#0D1626" }}>
                    {form.announcement.text || "معاينة الشريط..."}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">نص الإعلان</Label>
                  <Input value={form.announcement.text || ""} onChange={e => setField("announcement", "text", e.target.value)}
                    placeholder="🎉 خصم 20% لمدة محدودة — سجّل الآن!" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">رابط (اختياري)</Label>
                  <Input value={form.announcement.link || ""} onChange={e => setField("announcement", "link", e.target.value)}
                    placeholder="https://..." className="text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">لون الخلفية</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.announcement.bgColor || "#C9A84C"}
                        onChange={e => setField("announcement", "bgColor", e.target.value)}
                        className="w-10 h-8 rounded border border-border cursor-pointer bg-transparent" />
                      <Input value={form.announcement.bgColor || "#C9A84C"} onChange={e => setField("announcement", "bgColor", e.target.value)}
                        className="text-sm font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">لون النص</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.announcement.textColor || "#0D1626"}
                        onChange={e => setField("announcement", "textColor", e.target.value)}
                        className="w-10 h-8 rounded border border-border cursor-pointer bg-transparent" />
                      <Input value={form.announcement.textColor || "#0D1626"} onChange={e => setField("announcement", "textColor", e.target.value)}
                        className="text-sm font-mono" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── CONTACT ── */}
            {activeSection === "contact" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">بيانات التواصل — واتساب، البريد الإلكتروني، وروابط السوشيال ميديا</h3>

                {/* WhatsApp */}
                <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#25D366" }}>
                        <Phone className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold text-sm">واتساب</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">إظهار زر الواتساب</label>
                      <input type="checkbox" checked={!!form.contact.showWhatsappButton}
                        onChange={e => setField("contact", "showWhatsappButton", e.target.checked)}
                        className="w-4 h-4 rounded accent-[#25D366]" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">رقم الواتساب (مع رمز الدولة بدون + أو مسافات)</Label>
                    <div className="relative">
                      <Input
                        value={form.contact.whatsapp || ""}
                        onChange={e => setField("contact", "whatsapp", e.target.value)}
                        placeholder="966512345678"
                        className="text-sm ltr pl-16"
                        dir="ltr"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">+</span>
                    </div>
                  </div>
                  {form.contact.whatsapp && (
                    <a
                      href={`https://wa.me/${(form.contact.whatsapp as string).replace(/[^0-9]/g, "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 underline underline-offset-2">
                      <Phone className="h-3 w-3" />
                      معاينة الرابط: wa.me/{(form.contact.whatsapp as string).replace(/[^0-9]/g, "")}
                    </a>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني للتواصل
                  </Label>
                  <Input value={form.contact.email || ""} onChange={e => setField("contact", "email", e.target.value)}
                    placeholder="info@adalah-ai.com" className="text-sm" dir="ltr" />
                </div>

                {/* Social Links */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">روابط السوشيال ميديا (في الفوتر)</Label>
                  {[
                    { key: "twitter",  label: "تويتر / X",   placeholder: "https://x.com/adalahAI",          color: "#1DA1F2" },
                    { key: "linkedin", label: "لينكدإن",      placeholder: "https://linkedin.com/company/...", color: "#0077B5" },
                    { key: "youtube",  label: "يوتيوب",        placeholder: "https://youtube.com/@...",         color: "#FF0000" },
                  ].map(s => (
                    <div key={s.key} className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.color }} />
                        {s.label}
                      </Label>
                      <Input value={(form.contact as any)[s.key] || ""} onChange={e => setField("contact", s.key, e.target.value)}
                        placeholder={s.placeholder} className="text-sm" dir="ltr" />
                    </div>
                  ))}
                </div>

                {/* Live preview */}
                <div className="p-3 rounded-lg border border-border bg-[#080F1E] flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">معاينة الأيقونات في الفوتر:</span>
                  <div className="flex gap-2">
                    {[
                      { href: form.contact.twitter,  bg: "#1DA1F2" },
                      { href: form.contact.linkedin, bg: "#0077B5" },
                      { href: form.contact.youtube,  bg: "#FF0000" },
                    ].map((s, i) => (
                      <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${s.href ? "opacity-100" : "opacity-25"}`}
                        style={{ background: s.href ? s.bg : "rgba(255,255,255,0.06)" }}>
                        {i === 0 && <Twitter className="w-3.5 h-3.5 text-white" />}
                        {i === 1 && <Linkedin className="w-3.5 h-3.5 text-white" />}
                        {i === 2 && <Youtube className="w-3.5 h-3.5 text-white" />}
                      </div>
                    ))}
                  </div>
                  {form.contact.whatsapp && form.contact.showWhatsappButton && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#25D366" }}>
                      <Phone className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── SEO ── */}
            {activeSection === "seo" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">إعدادات SEO — للمحركات البحثية ومشاركة الروابط</h3>
                {[
                  { key: "metaTitle",       label: "عنوان الصفحة (Meta Title)",       placeholder: "عدالة AI — نظام إدارة المكاتب القانونية" },
                  { key: "metaDescription", label: "وصف الصفحة (Meta Description)",   placeholder: "منصة متكاملة لإدارة المكاتب القانونية..." },
                  { key: "ogImage",         label: "صورة المشاركة (OG Image URL)",     placeholder: "https://..." },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    {f.key === "metaDescription" ? (
                      <textarea rows={3} value={form.seo[f.key] || ""} onChange={e => setField("seo", f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#C9A84C] resize-none" />
                    ) : (
                      <Input value={form.seo[f.key] || ""} onChange={e => setField("seo", f.key, e.target.value)} placeholder={f.placeholder} className="text-sm" />
                    )}
                  </div>
                ))}
                {form.seo.metaTitle && (
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-2">معاينة نتيجة Google:</p>
                    <p className="text-blue-400 text-sm font-medium truncate">{form.seo.metaTitle}</p>
                    <p className="text-green-600 text-xs">{BASE_URL}/</p>
                    {form.seo.metaDescription && <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{form.seo.metaDescription}</p>}
                  </div>
                )}
              </>
            )}

            {/* ── FOOTER ── */}
            {activeSection === "footer" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">لوحة التحكم في التذييل (Footer)</h3>

                {/* Basic info */}
                <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <p className="text-xs font-bold text-[#C9A84C]">المعلومات الأساسية</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">شعار الشركة (tagline)</Label>
                    <Input value={form.footer.tagline || ""} onChange={e => setField("footer", "tagline", e.target.value)}
                      placeholder="أول نظام تشغيل قانوني متكامل للمكاتب حول العالم" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">نص حقوق النشر (Copyright)</Label>
                    <Input value={form.footer.copyright || ""} onChange={e => setField("footer", "copyright", e.target.value)}
                      placeholder="© ٢٠٢٦ عدالة AI — جميع الحقوق محفوظة" className="text-sm" />
                  </div>
                </div>

                {/* Status badge */}
                <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[#C9A84C]">بادج حالة الأنظمة</p>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">إظهار</Label>
                      <Switch checked={form.footer.showStatus !== false}
                        onCheckedChange={v => setField("footer", "showStatus", v)} />
                    </div>
                  </div>
                  {form.footer.showStatus !== false && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">نص البادج</Label>
                        <Input value={form.footer.statusText || ""} onChange={e => setField("footer", "statusText", e.target.value)}
                          placeholder="جميع الأنظمة تعمل" className="text-sm" />
                      </div>
                      <div className="px-3 py-1.5 rounded-full text-green-400 text-xs self-start inline-flex"
                        style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                        ● {form.footer.statusText || "جميع الأنظمة تعمل"}
                      </div>
                    </>
                  )}
                </div>

                {/* Column visibility */}
                <div className="p-3 rounded-lg bg-muted/20 border border-border">
                  <p className="text-xs font-bold text-[#C9A84C] mb-3">إظهار أعمدة الروابط</p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: "showPlatformCol", label: "عمود المنصة" },
                      { key: "showCompanyCol",  label: "عمود الشركة" },
                      { key: "showSupportCol",  label: "عمود الدعم"  },
                    ].map(col => (
                      <div key={col.key} className="flex items-center gap-2">
                        <Switch checked={form.footer[col.key] !== false}
                          onCheckedChange={v => setField("footer", col.key, v)} />
                        <Label className="text-xs">{col.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Links editor */}
                {[
                  { key: "platformLinks", label: "روابط المنصة",  count: 4 },
                  { key: "companyLinks",  label: "روابط الشركة",  count: 3 },
                  { key: "supportLinks",  label: "روابط الدعم",    count: 4 },
                ].map(col => (
                  <div key={col.key} className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border">
                    <p className="text-xs font-bold text-[#C9A84C] mb-1">{col.label}</p>
                    <div className="grid grid-cols-2 gap-1 mb-1">
                      <span className="text-xs text-muted-foreground px-1">النص</span>
                      <span className="text-xs text-muted-foreground px-1">الرابط (href)</span>
                    </div>
                    {Array.from({ length: col.count }).map((_, i) => {
                      const links: any[] = form.footer[col.key] || [];
                      const link = links[i] || { label: "", href: "" };
                      const updateLink = (field: string, val: string) => {
                        const updated = [...(form.footer[col.key] || [])];
                        while (updated.length <= i) updated.push({ label: "", href: "" });
                        updated[i] = { ...updated[i], [field]: val };
                        setField("footer", col.key, updated);
                      };
                      return (
                        <div key={i} className="grid grid-cols-2 gap-2">
                          <Input value={link.label || ""} onChange={e => updateLink("label", e.target.value)}
                            placeholder={`رابط ${i + 1}`} className="text-sm h-8" />
                          <Input value={link.href || ""} onChange={e => updateLink("href", e.target.value)}
                            placeholder="#anchor أو /page" className="text-sm h-8 font-mono text-xs" dir="ltr" />
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Live preview */}
                <div className="p-4 rounded-xl border border-white/10 text-xs" style={{ background: "#080F1E" }}>
                  <p className="text-white/40 text-xs mb-3">معاينة الفوتر:</p>
                  <div className="flex gap-6 flex-wrap">
                    {form.footer.showPlatformCol !== false && (
                      <div>
                        <p className="text-white text-xs font-bold mb-2">المنصة</p>
                        {(form.footer.platformLinks || []).filter((l: any) => l.label).map((l: any, i: number) => (
                          <p key={i} className="text-white/40 text-xs mb-1">{l.label}</p>
                        ))}
                      </div>
                    )}
                    {form.footer.showCompanyCol !== false && (
                      <div>
                        <p className="text-white text-xs font-bold mb-2">الشركة</p>
                        {(form.footer.companyLinks || []).filter((l: any) => l.label).map((l: any, i: number) => (
                          <p key={i} className="text-white/40 text-xs mb-1">{l.label}</p>
                        ))}
                      </div>
                    )}
                    {form.footer.showSupportCol !== false && (
                      <div>
                        <p className="text-white text-xs font-bold mb-2">الدعم</p>
                        {(form.footer.supportLinks || []).filter((l: any) => l.label).map((l: any, i: number) => (
                          <p key={i} className="text-white/40 text-xs mb-1">{l.label}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                    <p className="text-white/30 text-xs">{form.footer.copyright || "© ٢٠٢٦ عدالة AI"}</p>
                    {form.footer.showStatus !== false && (
                      <span className="text-green-400 text-xs">● {form.footer.statusText || "جميع الأنظمة تعمل"}</span>
                    )}
                  </div>
                </div>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLANS CMS TAB
═══════════════════════════════════════════════════ */
function PlansCmsTab({ toast }: { toast: any }) {
  const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const [plans, setPlans]       = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm]         = useState<any>(null);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [newFeature, setNewFeature] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE_URL}/api/billing/plans`)
      .then(r => r.json())
      .then(data => {
        setPlans(data);
        if (data.length > 0) {
          setSelected(data[0].id);
          setForm(JSON.parse(JSON.stringify(data[0])));
        }
      })
      .catch(() => toast({ title: "خطأ في تحميل الباقات", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  function selectPlan(id: string) {
    const p = plans.find(x => x.id === id);
    if (!p) return;
    setSelected(id);
    setForm(JSON.parse(JSON.stringify(p)));
    setNewFeature("");
  }

  function updateField(key: string, val: any) {
    setForm((f: any) => ({ ...f, [key]: val }));
  }

  function addFeature() {
    if (!newFeature.trim()) return;
    setForm((f: any) => ({ ...f, features: [...(f.features ?? []), newFeature.trim()] }));
    setNewFeature("");
  }

  function removeFeature(idx: number) {
    setForm((f: any) => ({ ...f, features: f.features.filter((_: any, i: number) => i !== idx) }));
  }

  function editFeature(idx: number, val: string) {
    setForm((f: any) => {
      const features = [...(f.features ?? [])];
      features[idx] = val;
      return { ...f, features };
    });
  }

  async function save() {
    if (!form || !selected) return;
    setSaving(true);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/plans/${selected}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("فشل الحفظ");
      const updated = await r.json();
      setPlans(ps => ps.map(p => p.id === selected ? updated : p));
      setForm(JSON.parse(JSON.stringify(updated)));
      toast({ title: "✅ تم حفظ الباقة بنجاح" });
    } catch {
      toast({ title: "فشل الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function resetAll() {
    if (!confirm("هل أنت متأكد من إعادة تعيين جميع الباقات للقيم الافتراضية؟")) return;
    setSaving(true);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/plans/reset`, { method: "POST" });
      if (!r.ok) throw new Error("فشل");
      const data = await r.json();
      setPlans(data);
      const first = data[0];
      if (first) { setSelected(first.id); setForm(JSON.parse(JSON.stringify(first))); }
      toast({ title: "✅ تمت إعادة التعيين" });
    } catch {
      toast({ title: "فشل إعادة التعيين", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground text-sm">جارٍ تحميل الباقات...</div>;

  const PLAN_COLORS: Record<string, string> = {
    free: "#64748B", basic: "#3B82F6", pro: "#8B5CF6",
    growth: "#10B981", advanced: "#F59E0B", enterprise: "#EF4444", elite: "#C9A84C",
  };

  return (
    <div className="flex gap-5 h-[calc(100vh-200px)] min-h-[600px]">
      {/* ── Sidebar: plan list ── */}
      <div className="w-52 shrink-0 flex flex-col gap-2">
        <div className="text-xs font-bold text-muted-foreground mb-1 px-1">الباقات ({plans.length})</div>
        {plans.map(p => (
          <button
            key={p.id}
            onClick={() => selectPlan(p.id)}
            className={`w-full text-right px-3 py-2.5 rounded-lg text-sm font-semibold transition-all border ${
              selected === p.id
                ? "bg-primary/10 border-primary text-primary"
                : "border-border hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: p.color ?? PLAN_COLORS[p.id] ?? "#888" }}
              />
              <span>{p.nameAr ?? p.id}</span>
              {p.recommended && <span className="mr-auto text-[9px] bg-amber-500/15 text-amber-600 px-1.5 py-0.5 rounded-full">الأشهر</span>}
            </div>
            <div className="text-[10px] mt-0.5 text-muted-foreground pr-4">{p.monthlyPrice === 0 ? "مجاناً" : p.isContactOnly ? "تواصل" : `${p.monthlyPrice} ر.س/شهر`}</div>
          </button>
        ))}
        <button
          onClick={resetAll}
          disabled={saving}
          className="mt-auto text-xs text-destructive hover:underline disabled:opacity-50 text-right px-1"
        >
          إعادة تعيين كل الباقات
        </button>
      </div>

      {/* ── Editor panel ── */}
      {form && (
        <div className="flex-1 overflow-y-auto space-y-5 pl-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">{form.nameAr}</h3>
              <p className="text-xs text-muted-foreground">ID: {form.id}</p>
            </div>
            <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
              {saving ? "جارٍ الحفظ..." : "💾 حفظ"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">الاسم (عربي)</Label>
              <Input value={form.nameAr ?? ""} onChange={e => updateField("nameAr", e.target.value)} className="text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الاسم (إنجليزي)</Label>
              <Input value={form.nameEn ?? ""} onChange={e => updateField("nameEn", e.target.value)} className="text-sm" dir="ltr" />
            </div>

            {/* Prices */}
            <div className="space-y-1.5">
              <Label className="text-xs">السعر الشهري (ر.س)</Label>
              <Input
                type="number" min={0}
                value={form.monthlyPrice ?? 0}
                onChange={e => updateField("monthlyPrice", Number(e.target.value))}
                className="text-sm" dir="ltr"
                disabled={!!form.isContactOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">السعر السنوي (ر.س)</Label>
              <Input
                type="number" min={0}
                value={form.yearlyPrice ?? 0}
                onChange={e => updateField("yearlyPrice", Number(e.target.value))}
                className="text-sm" dir="ltr"
                disabled={!!form.isContactOnly}
              />
            </div>

            {/* Description */}
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">الوصف</Label>
              <Input value={form.description ?? ""} onChange={e => updateField("description", e.target.value)} className="text-sm" />
            </div>

            {/* Badge */}
            <div className="space-y-1.5">
              <Label className="text-xs">شارة (badge) — اختياري</Label>
              <Input value={form.badge ?? ""} onChange={e => updateField("badge", e.target.value)} placeholder="الأكثر مبيعاً" className="text-sm" />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label className="text-xs">اللون</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color ?? PLAN_COLORS[form.id] ?? "#888888"}
                  onChange={e => updateField("color", e.target.value)}
                  className="w-10 h-9 rounded cursor-pointer border border-border"
                />
                <Input
                  value={form.color ?? ""}
                  onChange={e => updateField("color", e.target.value)}
                  placeholder="#888888" className="text-sm font-mono" dir="ltr"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="col-span-2 flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={!!form.recommended}
                  onChange={e => updateField("recommended", e.target.checked)}
                  className="w-4 h-4 accent-amber-500"
                />
                <span>مميز (الأشهر)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={!!form.isContactOnly}
                  onChange={e => updateField("isContactOnly", e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <span>باقة "تواصل معنا"</span>
              </label>
            </div>
          </div>

          {/* Features list */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">المميزات ({(form.features ?? []).length})</Label>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {(form.features ?? []).map((feat: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-green-500 text-xs shrink-0">✓</span>
                  <Input
                    value={feat}
                    onChange={e => editFeature(idx, e.target.value)}
                    className="text-sm flex-1 h-7 py-0"
                  />
                  <button
                    onClick={() => removeFeature(idx)}
                    className="text-destructive hover:text-destructive/70 transition-colors text-xs shrink-0"
                  >✕</button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={newFeature}
                onChange={e => setNewFeature(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addFeature()}
                placeholder="أضف ميزة جديدة..."
                className="text-sm flex-1"
              />
              <Button size="sm" variant="outline" onClick={addFeature} disabled={!newFeature.trim()}>
                + إضافة
              </Button>
            </div>
          </div>

          {/* Live preview card */}
          <div className="border border-dashed border-border rounded-xl p-4 space-y-1.5 bg-muted/20">
            <div className="text-xs text-muted-foreground font-semibold mb-2">معاينة البطاقة</div>
            <div
              className="rounded-xl p-4 border"
              style={{ borderColor: `${form.color ?? "#888"}30`, background: `${form.color ?? "#888"}08` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-sm" style={{ color: form.color }}>{form.nameAr || "—"}</span>
                {form.badge && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold" style={{ background: `${form.color}25`, color: form.color }}>
                    {form.badge}
                  </span>
                )}
              </div>
              <div className="text-xl font-black">
                {form.isContactOnly ? "تواصل معنا" : form.monthlyPrice === 0 ? "مجاناً" : `${form.monthlyPrice} ر.س`}
                {!form.isContactOnly && form.monthlyPrice > 0 && <span className="text-xs font-normal text-muted-foreground">/شهر</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{form.description || ""}</p>
              <ul className="mt-2 space-y-0.5">
                {(form.features ?? []).slice(0, 4).map((f: string, i: number) => (
                  <li key={i} className="text-xs flex items-center gap-1.5">
                    <span style={{ color: form.color }}>✓</span> {f}
                  </li>
                ))}
                {(form.features ?? []).length > 4 && (
                  <li className="text-xs text-muted-foreground">+{(form.features).length - 4} ميزة أخرى</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
