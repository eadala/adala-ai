import { useState } from "react";
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

const API = (path: string, opts?: RequestInit) =>
  fetch(`/api/admin${path}`, { headers: { "Content-Type": "application/json" }, ...opts }).then(r => r.json());

function useAdmin<T>(path: string) {
  return useQuery<T>({ queryKey: ["admin", path], queryFn: () => API(path) });
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

  const { data: stats } = useAdmin<any>("/stats");

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
            <StatCard icon={<DollarSign className="h-4 w-4" />} label="التكلفة الإجمالية" value={`$${(stats?.totalCost ?? 0).toFixed(2)}`} color="#10B981" />
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
function OfficesTab({ qc, toast }: any) {
  const { data: offices = [], isLoading } = useAdmin<any[]>("/offices");
  const [search, setSearch] = useState("");

  const updateOffice = useMutation({
    mutationFn: ({ id, ...d }: any) => API(`/offices/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/offices"] }); toast({ title: "تم التحديث ✓" }); },
  });

  const filtered = offices.filter(o => !search || o.name?.includes(search) || o.slug?.includes(search) || o.email?.includes(search));

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
                <TableHead className="text-right text-xs">المدينة</TableHead>
                <TableHead className="text-right text-xs">الهاتف</TableHead>
                <TableHead className="text-right text-xs">الحالة</TableHead>
                <TableHead className="text-right text-xs">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(o => (
                <TableRow key={o.id} className="hover:bg-muted/20">
                  <TableCell className="font-semibold text-sm">{o.name ?? "—"}</TableCell>
                  <TableCell>
                    <a href={`/firms/${o.slug}`} target="_blank" rel="noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Globe className="h-3 w-3" /> {o.slug}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.city ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground" dir="ltr">{o.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[9px]", o.isPublished ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground")}>
                      {o.isPublished ? "منشور" : "مسودة"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                      onClick={() => updateOffice.mutate({ id: o.id, isPublished: !o.isPublished })}>
                      {o.isPublished ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      {o.isPublished ? "إخفاء" : "نشر"}
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
function PlansTab({ qc, toast }: any) {
  const { data: plans = [], isLoading } = useAdmin<any[]>("/plans");
  const [dialog, setDialog] = useState<any>(null);
  const [form, setForm] = useState<any>({
    name: "", nameEn: "", description: "", price: 0, billingCycle: "monthly",
    maxUsers: 5, maxCases: 100, maxAiCalls: 500, isActive: true, isHighlighted: false,
    features: "", displayOrder: 0,
  });

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

  const openNew = () => {
    setForm({ name: "", nameEn: "", description: "", price: 0, billingCycle: "monthly", maxUsers: 5, maxCases: 100, maxAiCalls: 500, isActive: true, isHighlighted: false, features: "", displayOrder: plans.length });
    setDialog({});
  };

  const openEdit = (p: any) => {
    setForm({ ...p, features: (p.features ?? []).join("\n") });
    setDialog(p);
  };

  const submit = () => save.mutate({ ...form, features: form.features.split("\n").map((s: string) => s.trim()).filter(Boolean), price: Number(form.price), maxUsers: Number(form.maxUsers), maxCases: Number(form.maxCases), maxAiCalls: Number(form.maxAiCalls), displayOrder: Number(form.displayOrder) });

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-1.5" onClick={openNew}><Plus className="h-4 w-4" /> باقة جديدة</Button>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(p => (
            <Card key={p.id} className={cn("border-border/50 relative overflow-hidden", p.isHighlighted && "ring-2 ring-primary/40")}>
              {p.isHighlighted && <div className="absolute top-0 inset-x-0 h-0.5 bg-primary" />}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-black">{p.name}</CardTitle>
                    {p.nameEn && <p className="text-xs text-muted-foreground">{p.nameEn}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deletePlan.mutate(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-black text-primary">{Number(p.price).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">ر.س / {p.billingCycle === "monthly" ? "شهر" : "سنة"}</span></div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div className="p-1.5 rounded-lg bg-muted/50"><div className="text-xs font-bold">{p.maxUsers}</div><div className="text-[9px] text-muted-foreground">مستخدم</div></div>
                  <div className="p-1.5 rounded-lg bg-muted/50"><div className="text-xs font-bold">{p.maxCases}</div><div className="text-[9px] text-muted-foreground">قضية</div></div>
                  <div className="p-1.5 rounded-lg bg-muted/50"><div className="text-xs font-bold">{p.maxAiCalls}</div><div className="text-[9px] text-muted-foreground">AI</div></div>
                </div>
                {(p.features ?? []).slice(0, 4).map((f: string) => (
                  <div key={f} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Check className="h-3 w-3 text-emerald-400 shrink-0" /> {f}
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <Badge className={cn("text-[9px]", p.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>{p.isActive ? "نشط" : "معطل"}</Badge>
                  {p.isHighlighted && <Badge className="text-[9px] bg-primary/10 text-primary">مميّز</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog?.id ? "تعديل الباقة" : "باقة جديدة"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">الاسم (عربي) *</Label><Input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">Name (English)</Label><Input value={form.nameEn} onChange={e => setForm((f: any) => ({ ...f, nameEn: e.target.value }))} dir="ltr" /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">الوصف</Label><Input value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">السعر (ر.س)</Label><Input type="number" value={form.price} onChange={e => setForm((f: any) => ({ ...f, price: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">دورة الفوترة</Label>
                <Select value={form.billingCycle} onValueChange={v => setForm((f: any) => ({ ...f, billingCycle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="monthly">شهري</SelectItem><SelectItem value="annual">سنوي</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">المستخدمون</Label><Input type="number" value={form.maxUsers} onChange={e => setForm((f: any) => ({ ...f, maxUsers: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">القضايا</Label><Input type="number" value={form.maxCases} onChange={e => setForm((f: any) => ({ ...f, maxCases: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">طلبات AI</Label><Input type="number" value={form.maxAiCalls} onChange={e => setForm((f: any) => ({ ...f, maxAiCalls: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">المميزات (سطر لكل ميزة)</Label>
              <Textarea value={form.features} onChange={e => setForm((f: any) => ({ ...f, features: e.target.value }))} rows={4} className="resize-none text-xs" placeholder="إدارة القضايا غير المحدودة&#10;تقارير متقدمة&#10;دعم على مدار الساعة" /></div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={v => setForm((f: any) => ({ ...f, isActive: v }))} /><Label className="text-xs">نشط</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isHighlighted} onCheckedChange={v => setForm((f: any) => ({ ...f, isHighlighted: v }))} /><Label className="text-xs">مميّز (الأكثر شيوعاً)</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button>
            <Button disabled={!form.name || save.isPending} onClick={submit} className="gap-2">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" /> حفظ
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
