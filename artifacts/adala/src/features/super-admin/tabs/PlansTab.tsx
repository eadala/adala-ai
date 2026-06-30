import { useState, useEffect, useMemo, useCallback, memo } from "react";
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
  Gift, CalendarClock, Ban, PlusCircle, Timer, TrendingDown, Percent,
  Phone, Mail, Twitter, Linkedin, Youtube,
  Bot, Radar, Command, Network, Gauge, Play, Pause, RotateCcw,
  AlertOctagon as AOctagon, TrendingUp as TUp, Boxes,
  MonitorDot, Cpu as CpuIcon, MemoryStick, ArrowUpRight,
  Workflow, ScanLine, FlaskConical,
  FileBarChart2, Gavel, FileSignature, ShieldCheck as SecurityIcon,
  Layout, AlertOctagon, Download, ChevronRight, Filter as FilterIcon,
  User, Banknote, CheckSquare, AlertCircle as ACircle,
  Globe2, Newspaper, ListOrdered, HelpCircle, PenLine, Info,
  CreditCard, Receipt, AlertTriangle,
  ArrowRight, ClipboardList, ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { API, useAdmin } from "../shared/api";
import { StatCard } from "../shared/components";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";

const PLAN_COLORS = ["#6B7280","#2563EB","#3B82F6","#8B5CF6","#EF4444","#10B981","#F59E0B","#EC4899"];
const EMPTY_PLAN_FORM = {
  name:"", nameEn:"", slug:"", description:"",
  price:0, monthlyPrice:0, yearlyPrice:0, color:"#2563EB",
  maxUsers:5, maxCases:100, maxClients:50, maxAiCalls:500, maxStorageGb:5, maxBranches:0,
  isActive:true, isVisible:true, isHighlighted:false, features:"",
  featureFlags:{} as Record<string,boolean>, displayOrder:0,
};

function PlanCard({ plan: p, onEdit, onDelete, onToggleVisibility }: any) {
  const enabledFlags = Object.entries(p.featureFlags ?? {}).filter(([, v]) => v);
  const monthly = Number(p.monthlyPrice ?? p.price ?? 0);
  const yearly  = Number(p.yearlyPrice ?? 0);
  return (
    <Card className={cn("relative overflow-hidden border-border/50 transition-all hover:shadow-md hover:shadow-black/20",
      !p.isVisible && "opacity-55", p.isHighlighted && "ring-2 ring-primary/40")}>
      <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: p.color ?? "#2563EB" }} />
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
            <div className="text-2xl font-black" style={{ color: p.color ?? "#2563EB" }}>
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
export function PlansTab({ qc, toast }: any) {
  const { data: plans = [], isLoading } = useAdmin<any[]>("/plans");
  const [dialog, set] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...EMPTY_PLAN_FORM });
  const [dlgTab, setDlgTab] = useState("info");

  const save = useMutation({
    mutationFn: (d: any) => dialog?.id
      ? API(`/plans/${dialog.id}`, { method: "PATCH", body: JSON.stringify(d) })
      : API("/plans", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/plans"] }); set(null); toast({ title: "تم الحفظ ✓" }); },
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
    set({});
  };
  const openEdit = (p: any) => {
    setForm({ ...EMPTY_PLAN_FORM, ...p, features: (p.features ?? []).join("\n"), featureFlags: p.featureFlags ?? {},
      monthlyPrice: p.monthlyPrice ?? p.price ?? 0, yearlyPrice: p.yearlyPrice ?? 0 });
    setDlgTab("info");
    set(p);
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

      {/* Create / Edit */}
      <AdaptiveDialog open={!!dialog} onOpenChange={() => set(null)}>
        <AdaptiveDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  <Input type="color" value={form.color ?? "#2563EB"} onChange={e => setForm((f: any) => ({ ...f, color: e.target.value }))}
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
            <Button variant="outline" size="sm" onClick={() => set(null)}>إلغاء</Button>
            <Button size="sm" disabled={!form.name || save.isPending} onClick={submit} className="gap-2 bg-primary hover:bg-primary/90">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الباقة
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DISCOUNTS TAB
═══════════════════════════════════════════════════ */
