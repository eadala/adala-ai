/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps -- pre-existing lint debt; authFetch migration */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Save, RotateCcw, Trash2, Edit3, Eye, Check, X,
  Loader2, Star, Crown, Zap, Bot, Globe, Shield, Lock,
  HardDrive, Users, Cpu, GitBranch, Smartphone, MessageSquare,
  Workflow, BarChart3, FileText, ScanLine, Database, Layers,
  Code2, Settings, ChevronRight, Info, AlertTriangle, PlusCircle,
  Package, DollarSign, Tag, Palette, ToggleLeft, ToggleRight,
  CheckCircle2, XCircle, Building2, Copy, Sparkles, TrendingUp,
  Server, CloudUpload, Bell, Calendar, Receipt, FileCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";

/* ── Feature flag groups ──────────────────────────────── */
const FEATURE_GROUPS = [
  {
    id: "core",
    label: "الأساسيات",
    icon: Shield,
    color: "#3B82F6",
    features: [
      { key: "cases",         label: "إدارة القضايا",          icon: FileCheck },
      { key: "invoices",      label: "الفواتير الإلكترونية",   icon: Receipt },
      { key: "reminders",     label: "التذكيرات الذكية",       icon: Bell },
      { key: "calendar",      label: "التقويم القانوني",       icon: Calendar },
      { key: "exportPdf",     label: "تصدير PDF احترافي",      icon: FileText },
      { key: "reportsBasic",  label: "التقارير الأساسية",      icon: BarChart3 },
    ],
  },
  {
    id: "ai",
    label: "الذكاء الاصطناعي",
    icon: Bot,
    color: "#8B5CF6",
    features: [
      { key: "aiBasic",            label: "AI أساسي",                  icon: Bot },
      { key: "ai",                 label: "AI متقدم (GPT/Claude)",     icon: Sparkles },
      { key: "aiAnalytics",        label: "تحليلات AI",                icon: TrendingUp },
      { key: "aiCfo",              label: "مساعد مالي AI (CFO)",       icon: DollarSign },
      { key: "customAiTraining",   label: "تدريب AI مخصص",             icon: Cpu },
    ],
  },
  {
    id: "docs",
    label: "الوثائق والعقود",
    icon: FileText,
    color: "#10B981",
    features: [
      { key: "documentTemplates", label: "قوالب المستندات",      icon: Layers },
      { key: "contractsAi",       label: "عقود ذكية بالـ AI",   icon: FileText },
      { key: "ocr",               label: "OCR - استخراج النصوص", icon: ScanLine },
      { key: "backup",            label: "نسخ احتياطي تلقائي",  icon: Database },
      { key: "reportsAdvanced",   label: "تقارير متقدمة + KPIs", icon: BarChart3 },
    ],
  },
  {
    id: "commerce",
    label: "الموقع والتجارة",
    icon: Globe,
    color: "#F59E0B",
    features: [
      { key: "website",       label: "موقع المكتب",         icon: Globe },
      { key: "serviceStore",  label: "متجر الخدمات",        icon: Package },
      { key: "payments",      label: "بوابة الدفع",         icon: Receipt },
      { key: "mobileApp",     label: "تطبيق الجوال",        icon: Smartphone },
    ],
  },
  {
    id: "comms",
    label: "التواصل والتشغيل",
    icon: MessageSquare,
    color: "#EC4899",
    features: [
      { key: "whatsapp",      label: "واتساب بيزنس",        icon: MessageSquare },
      { key: "workflow",      label: "سير عمل آلي",         icon: Workflow },
      { key: "clientPortal",  label: "بوابة الموكّلين",     icon: Users },
    ],
  },
  {
    id: "enterprise",
    label: "المتقدمة والمؤسسية",
    icon: Crown,
    color: "#EF4444",
    features: [
      { key: "customDomain",          label: "نطاق خاص مخصص",          icon: Globe },
      { key: "apiAccess",             label: "وصول API كامل",           icon: Code2 },
      { key: "whiteLabel",            label: "وايت لابل (علامتك)",      icon: Palette },
      { key: "sla",                   label: "SLA مضمون 24/7",          icon: Shield },
      { key: "dedicatedManager",      label: "مدير حساب مخصص",         icon: Users },
      { key: "priorityInfrastructure",label: "بنية تحتية مخصصة",        icon: Server },
    ],
  },
];

/* ── Limit fields ──────────────────────────────────────── */
const LIMIT_FIELDS = [
  { key: "users",      label: "عدد المستخدمين",       icon: Users,     unit: "مستخدم",   numeric: true },
  { key: "storage",    label: "مساحة التخزين",        icon: HardDrive, unit: "",         numeric: false },
  { key: "aiRequests", label: "طلبات AI اليومية",     icon: Bot,       unit: "طلب/يوم",  numeric: true },
  { key: "branches",   label: "عدد الفروع",           icon: GitBranch, unit: "فرع",      numeric: true },
];

const BUILTIN_IDS = ["free", "basic", "pro", "growth", "advanced", "enterprise", "elite"];

/* ═══════════════════════════════════════════════════════ */
export function PlansCmsTab({ toast }: { toast: any }) {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const qc = useQueryClient();

  const [selected, setSelected]   = useState<string | null>(null);
  const [form, setForm]           = useState<any>(null);
  const [dirty, setDirty]         = useState(false);
  const [activeTab, setActiveTab] = useState("basics");
  const [showNew, setShowNew]     = useState(false);
  const [showDel, setShowDel]     = useState(false);
  const [newPlan, setNewPlan]     = useState({ id: "", nameAr: "", nameEn: "", monthlyPrice: 0, yearlyPrice: 0, color: "#3B82F6" });
  const [newFeatureTxt, setNewFeatureTxt] = useState("");
  const [saving, setSaving]       = useState(false);

  /* ── Fetch plans ── */
  const { data: plans = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin-plans-cms"],
    queryFn: () => authFetch(`${BASE}/api/admin/plans`).then(r => { if (!r.ok) throw new Error("خطأ"); return r.json(); }),
    staleTime: 0,
  });

  useEffect(() => {
    if (plans.length && !selected) {
      setSelected(plans[0].id);
      setForm(JSON.parse(JSON.stringify(plans[0])));
    }
  }, [plans]);

  /* ── Select plan ── */
  function selectPlan(id: string) {
    if (dirty && !confirm("يوجد تغييرات غير محفوظة، هل تريد الخروج؟")) return;
    const p = plans.find((x: any) => x.id === id);
    if (!p) return;
    setSelected(id);
    setForm(JSON.parse(JSON.stringify(p)));
    setDirty(false);
    setActiveTab("basics");
  }

  function upd(key: string, val: any) {
    setForm((f: any) => ({ ...f, [key]: val }));
    setDirty(true);
  }
  function updFlag(key: string, val: boolean) {
    setForm((f: any) => ({ ...f, featureFlags: { ...(f.featureFlags ?? {}), [key]: val } }));
    setDirty(true);
  }
  function updLimit(key: string, val: any) {
    setForm((f: any) => ({ ...f, limits: { ...(f.limits ?? {}), [key]: val } }));
    setDirty(true);
  }
  function toggleUnlimited(key: string, isUnlimited: boolean) {
    updLimit(key, isUnlimited ? "unlimited" : 1);
  }

  /* ── Save ── */
  async function save() {
    if (!form || !selected) return;
    setSaving(true);
    try {
      const r = await authFetch(`${BASE}/api/admin/plans/${selected}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "فشل الحفظ"); }
      const updated = await r.json();
      qc.setQueryData(["admin-plans-cms"], (old: any[]) => old?.map(p => p.id === selected ? updated : p) ?? [updated]);
      qc.invalidateQueries({ queryKey: ["billing-plans"] });
      setForm(JSON.parse(JSON.stringify(updated)));
      setDirty(false);
      toast({ title: "✅ تم حفظ الباقة بنجاح", description: `${form.nameAr} تم تحديثها وستنعكس على صفحة الأسعار فوراً` });
    } catch (e: any) {
      toast({ title: "خطأ في الحفظ", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  /* ── Create plan ── */
  async function createPlan() {
    if (!newPlan.id || !newPlan.nameAr) { toast({ title: "المعرّف والاسم مطلوبان", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await authFetch(`${BASE}/api/admin/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlan),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "فشل الإنشاء"); }
      const created = await r.json();
      await refetch();
      setSelected(created.id);
      setForm(JSON.parse(JSON.stringify(created)));
      setDirty(false);
      setShowNew(false);
      setNewPlan({ id: "", nameAr: "", nameEn: "", monthlyPrice: 0, yearlyPrice: 0, color: "#3B82F6" });
      toast({ title: "✅ تم إنشاء الباقة", description: created.nameAr });
    } catch (e: any) {
      toast({ title: "خطأ في الإنشاء", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  /* ── Delete plan ── */
  async function deletePlan() {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await authFetch(`${BASE}/api/admin/plans/${selected}`, { method: "DELETE" });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "فشل الحذف"); }
      await refetch();
      setSelected(null);
      setForm(null);
      setShowDel(false);
      toast({ title: "✅ تم حذف الباقة" });
    } catch (e: any) {
      toast({ title: "خطأ في الحذف", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  /* ── Reset all ── */
  async function resetAll() {
    if (!confirm("سيتم استعادة جميع الباقات للإعدادات الافتراضية. هل أنت متأكد؟")) return;
    setSaving(true);
    try {
      const r = await authFetch(`${BASE}/api/admin/plans/reset`, { method: "POST" });
      if (!r.ok) throw new Error("فشل");
      const data = await r.json();
      qc.setQueryData(["admin-plans-cms"], data);
      qc.invalidateQueries({ queryKey: ["billing-plans"] });
      if (data[0]) { setSelected(data[0].id); setForm(JSON.parse(JSON.stringify(data[0]))); setDirty(false); }
      toast({ title: "✅ تمت إعادة تعيين جميع الباقات" });
    } catch {
      toast({ title: "فشل إعادة التعيين", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  /* ── Feature toggles count ── */
  function flagCount(flags: any) {
    if (!flags) return 0;
    return Object.values(flags).filter(Boolean).length;
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>جارٍ تحميل الباقات...</span>
    </div>
  );

  const enabledFlags = flagCount(form?.featureFlags);
  const totalFlags   = FEATURE_GROUPS.reduce((s, g) => s + g.features.length, 0);

  return (
    <TooltipProvider>
      <div className="flex gap-0 h-[calc(100vh-160px)] min-h-[640px] overflow-hidden rounded-xl border border-border bg-background">

        {/* ══ LEFT SIDEBAR — Plan List ══ */}
        <div className="w-56 shrink-0 border-l border-border bg-muted/30 flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground">الباقات ({plans.length})</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => setShowNew(true)}>
                    <PlusCircle className="w-3.5 h-3.5 text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>إنشاء باقة جديدة</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Plan list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {plans.map((p: any) => (
              <button
                key={p.id}
                onClick={() => selectPlan(p.id)}
                className={cn(
                  "w-full text-right px-3 py-2.5 rounded-lg transition-all border text-sm group",
                  selected === p.id
                    ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
                    : "border-transparent hover:bg-muted hover:border-border text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30 shadow-sm"
                    style={{ background: p.color ?? "#888" }} />
                  <span className="font-semibold flex-1 truncate">{p.nameAr}</span>
                  {p.recommended && (
                    <Star className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500" />
                  )}
                </div>
                <div className="flex items-center justify-between mt-0.5 pr-4">
                  <span className="text-[10px] text-muted-foreground">
                    {p.isContactOnly ? "تواصل معنا" : p.monthlyPrice === 0 ? "مجاناً" : `${p.monthlyPrice} ر.س/شهر`}
                  </span>
                  <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100">
                    {flagCount(p.featureFlags)}/{totalFlags}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border space-y-1">
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground justify-start gap-1.5 h-7" onClick={resetAll} disabled={saving}>
              <RotateCcw className="w-3 h-3" />
              إعادة تعيين الكل
            </Button>
          </div>
        </div>

        {/* ══ CENTER — Editor ══ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!form ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              اختر باقة من القائمة
            </div>
          ) : (
            <>
              {/* Editor Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background shrink-0">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/20 shadow" style={{ background: form.color }} />
                  <div>
                    <h3 className="font-bold text-sm">{form.nameAr}</h3>
                    <p className="text-[10px] text-muted-foreground">ID: {form.id} · {enabledFlags}/{totalFlags} خدمة مفعّلة</p>
                  </div>
                  {dirty && (
                    <Badge variant="outline" className="text-[10px] h-4 border-amber-400/50 text-amber-600 bg-amber-50">
                      غير محفوظ
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!BUILTIN_IDS.includes(form.id) && (
                    <Button size="sm" variant="outline" onClick={() => setShowDel(true)} disabled={saving}
                      className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5 gap-1">
                      <Trash2 className="w-3 h-3" /> حذف
                    </Button>
                  )}
                  <Button size="sm" onClick={save} disabled={saving || !dirty} className="h-7 text-xs gap-1.5">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex-1 overflow-y-auto">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                  <div className="px-5 pt-3 border-b border-border bg-background/50 shrink-0">
                    <TabsList className="h-8">
                      <TabsTrigger value="basics" className="text-xs h-6">⚙️ الأساسيات</TabsTrigger>
                      <TabsTrigger value="features" className="text-xs h-6 gap-1">
                        🔧 الخدمات
                        <span className="text-[9px] bg-primary/15 text-primary px-1 rounded-full">{enabledFlags}</span>
                      </TabsTrigger>
                      <TabsTrigger value="limits" className="text-xs h-6">📊 الحدود</TabsTrigger>
                      <TabsTrigger value="bullets" className="text-xs h-6">📝 المزايا</TabsTrigger>
                    </TabsList>
                  </div>

                  {/* ── Tab: Basics ── */}
                  <TabsContent value="basics" className="p-5 space-y-4 mt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">الاسم (عربي) *</Label>
                        <Input value={form.nameAr ?? ""} onChange={e => upd("nameAr", e.target.value)} className="text-sm h-8" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">الاسم (إنجليزي)</Label>
                        <Input value={form.nameEn ?? ""} onChange={e => upd("nameEn", e.target.value)} className="text-sm h-8" dir="ltr" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">السعر الشهري (ر.س)</Label>
                        <Input type="number" min={0} value={form.monthlyPrice ?? 0} onChange={e => upd("monthlyPrice", Number(e.target.value))}
                          className="text-sm h-8" dir="ltr" disabled={!!form.isContactOnly} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">السعر السنوي (ر.س)</Label>
                        <Input type="number" min={0} value={form.yearlyPrice ?? 0} onChange={e => upd("yearlyPrice", Number(e.target.value))}
                          className="text-sm h-8" dir="ltr" disabled={!!form.isContactOnly} />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs font-medium">الوصف</Label>
                        <Textarea value={form.description ?? ""} onChange={e => upd("description", e.target.value)}
                          className="text-sm resize-none h-16" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">شارة (badge)</Label>
                        <Input value={form.badge ?? ""} onChange={e => upd("badge", e.target.value)}
                          placeholder="⭐ الأكثر شعبية" className="text-sm h-8" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">اللون</Label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={form.color ?? "#888888"} onChange={e => upd("color", e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border border-border p-0.5 bg-transparent" />
                          <Input value={form.color ?? ""} onChange={e => upd("color", e.target.value)}
                            placeholder="#888888" className="text-sm h-8 font-mono flex-1" dir="ltr" />
                        </div>
                      </div>
                    </div>

                    {/* Switches */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Star className="w-3.5 h-3.5 text-amber-500" />
                          <div>
                            <p className="text-xs font-medium">الأكثر شيوعاً</p>
                            <p className="text-[10px] text-muted-foreground">يظهر شارة "مميز"</p>
                          </div>
                        </div>
                        <Switch checked={!!form.recommended} onCheckedChange={v => upd("recommended", v)} />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          <div>
                            <p className="text-xs font-medium">باقة "تواصل معنا"</p>
                            <p className="text-[10px] text-muted-foreground">بدون سعر محدد</p>
                          </div>
                        </div>
                        <Switch checked={!!form.isContactOnly} onCheckedChange={v => upd("isContactOnly", v)} />
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Tab: Feature Toggles ── */}
                  <TabsContent value="features" className="p-4 mt-0 space-y-3">
                    {/* Quick actions */}
                    <div className="flex items-center gap-2 pb-1">
                      <button onClick={() => { const all: any = {}; FEATURE_GROUPS.forEach(g => g.features.forEach(f => { all[f.key] = true; })); setForm((fm: any) => ({ ...fm, featureFlags: all })); setDirty(true); }}
                        className="text-[10px] px-2 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> تفعيل الكل
                      </button>
                      <button onClick={() => { const none: any = {}; FEATURE_GROUPS.forEach(g => g.features.forEach(f => { none[f.key] = false; })); setForm((fm: any) => ({ ...fm, featureFlags: none })); setDirty(true); }}
                        className="text-[10px] px-2 py-1 rounded border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center gap-1">
                        <XCircle className="w-2.5 h-2.5" /> إيقاف الكل
                      </button>
                      <span className="mr-auto text-[10px] text-muted-foreground">{enabledFlags} من {totalFlags} خدمة مفعّلة</span>
                    </div>

                    {FEATURE_GROUPS.map(group => {
                      const GroupIcon = group.icon;
                      const groupActive = group.features.filter(f => !!(form.featureFlags ?? {})[f.key]).length;
                      return (
                        <div key={group.id} className="rounded-xl border border-border overflow-hidden">
                          {/* Group header */}
                          <div className="flex items-center justify-between px-3 py-2 border-b border-border"
                            style={{ background: `${group.color}0d` }}>
                            <div className="flex items-center gap-2">
                              <GroupIcon className="w-3.5 h-3.5" style={{ color: group.color }} />
                              <span className="text-xs font-bold" style={{ color: group.color }}>{group.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground">{groupActive}/{group.features.length}</span>
                              {/* Toggle whole group */}
                              <button
                                onClick={() => {
                                  const allOn = group.features.every(f => !!(form.featureFlags ?? {})[f.key]);
                                  const updated: any = { ...(form.featureFlags ?? {}) };
                                  group.features.forEach(f => { updated[f.key] = !allOn; });
                                  setForm((fm: any) => ({ ...fm, featureFlags: updated }));
                                  setDirty(true);
                                }}
                                className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                              >
                                {group.features.every(f => !!(form.featureFlags ?? {})[f.key]) ? "إيقاف المجموعة" : "تفعيل المجموعة"}
                              </button>
                            </div>
                          </div>
                          {/* Features grid */}
                          <div className="grid grid-cols-2 gap-0">
                            {group.features.map((feat, idx) => {
                              const FeatIcon = feat.icon;
                              const isOn = !!(form.featureFlags ?? {})[feat.key];
                              return (
                                <div
                                  key={feat.key}
                                  className={cn(
                                    "flex items-center justify-between px-3 py-2 cursor-pointer transition-colors",
                                    idx % 2 === 0 && idx < group.features.length - 1 ? "border-l border-border" : "",
                                    idx < group.features.length - 2 ? "border-b border-border" : "",
                                    isOn ? "bg-background" : "bg-muted/20 opacity-60",
                                  )}
                                  onClick={() => updFlag(feat.key, !isOn)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FeatIcon className={cn("w-3.5 h-3.5 shrink-0", isOn ? "text-primary" : "text-muted-foreground")} />
                                    <span className={cn("text-xs truncate", isOn ? "font-medium" : "text-muted-foreground")}>{feat.label}</span>
                                  </div>
                                  <div className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0 mr-2 transition-all",
                                    isOn ? "bg-primary text-primary-foreground" : "bg-muted border border-border"
                                  )}>
                                    {isOn ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5 text-muted-foreground" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>

                  {/* ── Tab: Limits ── */}
                  <TabsContent value="limits" className="p-5 mt-0 space-y-4">
                    <p className="text-xs text-muted-foreground">حدد الأرقام والمساحات لهذه الباقة. الأرقام تُستخدم في فحص الصلاحيات تلقائياً.</p>
                    <div className="space-y-3">
                      {LIMIT_FIELDS.map(field => {
                        const LIcon = field.icon;
                        const currentVal = (form.limits ?? {})[field.key] ?? (field.numeric ? 1 : "١ GB");
                        const isUnlimited = currentVal === "unlimited";
                        return (
                          <div key={field.key} className="rounded-xl border border-border p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <LIcon className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">{field.label}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    الحالي: {isUnlimited ? "∞ غير محدود" : `${currentVal}${field.unit ? " " + field.unit : ""}`}
                                  </p>
                                </div>
                              </div>
                              {field.numeric && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">غير محدود</span>
                                  <Switch
                                    checked={isUnlimited}
                                    onCheckedChange={v => toggleUnlimited(field.key, v)}
                                  />
                                </div>
                              )}
                            </div>
                            {!isUnlimited && (
                              <div className="flex items-center gap-2">
                                {field.numeric ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    value={currentVal === "unlimited" ? 0 : currentVal}
                                    onChange={e => updLimit(field.key, Number(e.target.value))}
                                    className="h-8 text-sm font-mono w-32" dir="ltr"
                                  />
                                ) : (
                                  <Input
                                    value={currentVal}
                                    onChange={e => updLimit(field.key, e.target.value)}
                                    placeholder="مثال: ٢٥ GB"
                                    className="h-8 text-sm w-40"
                                  />
                                )}
                                {field.unit && <span className="text-xs text-muted-foreground">{field.unit}</span>}
                              </div>
                            )}
                            {isUnlimited && (
                              <div className="flex items-center gap-1.5 text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">غير محدود — لا قيود</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  {/* ── Tab: Bullet Features ── */}
                  <TabsContent value="bullets" className="p-5 mt-0 space-y-3">
                    <p className="text-xs text-muted-foreground">نصوص المزايا التي تظهر على بطاقة الباقة في صفحة الأسعار.</p>
                    <div className="space-y-1.5 max-h-[340px] overflow-y-auto pl-1">
                      {(form.features ?? []).map((feat: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 group">
                          <span className="text-green-500 text-xs shrink-0 font-bold">✓</span>
                          <Input
                            value={feat}
                            onChange={e => {
                              const arr = [...(form.features ?? [])];
                              arr[idx] = e.target.value;
                              upd("features", arr);
                            }}
                            className="text-sm flex-1 h-7 py-0"
                          />
                          <button
                            onClick={() => { const arr = (form.features ?? []).filter((_: any, i: number) => i !== idx); upd("features", arr); }}
                            className="text-destructive hover:text-destructive/70 transition-colors text-xs shrink-0 opacity-0 group-hover:opacity-100"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500 text-xs font-bold shrink-0">+</span>
                      <Input
                        value={newFeatureTxt}
                        onChange={e => setNewFeatureTxt(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && newFeatureTxt.trim()) {
                            upd("features", [...(form.features ?? []), newFeatureTxt.trim()]);
                            setNewFeatureTxt("");
                          }
                        }}
                        placeholder="أضف ميزة جديدة واضغط Enter..."
                        className="text-sm flex-1 h-8"
                      />
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!newFeatureTxt.trim()}
                        onClick={() => { if (newFeatureTxt.trim()) { upd("features", [...(form.features ?? []), newFeatureTxt.trim()]); setNewFeatureTxt(""); } }}>
                        إضافة
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>

        {/* ══ RIGHT — Live Preview ══ */}
        {form && (
          <div className="w-64 shrink-0 border-r border-border bg-muted/20 flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border shrink-0">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">معاينة فورية</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">كما ستظهر في صفحة الأسعار</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {/* Plan card preview */}
              <div className="rounded-2xl border overflow-hidden shadow-sm"
                style={{ borderColor: `${form.color}40`, background: `${form.color}08` }}>
                {/* Card header */}
                <div className="p-3 text-center border-b" style={{ borderColor: `${form.color}20`, background: `${form.color}12` }}>
                  {form.badge && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full mb-1.5 inline-block"
                      style={{ background: `${form.color}25`, color: form.color }}>
                      {form.badge}
                    </span>
                  )}
                  <div className="font-black text-sm" style={{ color: form.color }}>{form.nameAr || "—"}</div>
                  <div className="font-black text-xl mt-1">
                    {form.isContactOnly
                      ? <span className="text-base">تواصل معنا</span>
                      : form.monthlyPrice === 0
                        ? "مجاناً"
                        : <>{form.monthlyPrice}<span className="text-xs font-normal text-muted-foreground"> ر.س/شهر</span></>
                    }
                  </div>
                  {!form.isContactOnly && form.yearlyPrice > 0 && (
                    <div className="text-[10px] text-muted-foreground">{form.yearlyPrice} ر.س/سنوياً</div>
                  )}
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 gap-0 border-b" style={{ borderColor: `${form.color}20` }}>
                  {LIMIT_FIELDS.map((lf, i) => {
                    const LIcon = lf.icon;
                    const val = (form.limits ?? {})[lf.key];
                    return (
                      <div key={lf.key} className={cn(
                        "flex flex-col items-center py-2 px-1 text-center",
                        i % 2 === 0 ? "border-l" : "",
                        i < 2 ? "border-b" : ""
                      )} style={{ borderColor: `${form.color}20` }}>
                        <LIcon className="w-3 h-3 mb-0.5" style={{ color: form.color }} />
                        <span className="text-[11px] font-bold">
                          {val === "unlimited" ? "∞" : val ?? "—"}
                        </span>
                        <span className="text-[8px] text-muted-foreground">{lf.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Feature bullets */}
                <div className="p-2.5 space-y-1">
                  {(form.features ?? []).slice(0, 6).map((f: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Check className="w-2.5 h-2.5 mt-0.5 shrink-0" style={{ color: form.color }} />
                      <span className="text-[10px] leading-tight text-foreground/80">{f}</span>
                    </div>
                  ))}
                  {(form.features ?? []).length > 6 && (
                    <div className="text-[9px] text-muted-foreground text-center pt-0.5">
                      +{(form.features).length - 6} ميزة أخرى
                    </div>
                  )}
                </div>

                {/* Active features */}
                <div className="px-2.5 pb-2.5">
                  <div className="rounded-lg p-2 border" style={{ borderColor: `${form.color}20`, background: `${form.color}06` }}>
                    <p className="text-[9px] font-bold text-muted-foreground mb-1.5">الخدمات المفعّلة ({enabledFlags})</p>
                    <div className="flex flex-wrap gap-1">
                      {FEATURE_GROUPS.flatMap(g => g.features).filter(f => !!(form.featureFlags ?? {})[f.key]).slice(0, 10).map(f => {
                        const FIcon = f.icon;
                        return (
                          <Tooltip key={f.key}>
                            <TooltipTrigger asChild>
                              <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${form.color}15` }}>
                                <FIcon className="w-2.5 h-2.5" style={{ color: form.color }} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>{f.label}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                      {enabledFlags > 10 && (
                        <div className="w-5 h-5 rounded flex items-center justify-center bg-muted text-[8px] text-muted-foreground font-bold">
                          +{enabledFlags - 10}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sync indicator */}
              <div className="mt-3 rounded-lg border border-dashed border-border p-2.5 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  يتزامن تلقائياً مع صفحة الأسعار
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══: New Plan ══ */}
      <AdaptiveDialog open={showNew} onOpenChange={setShowNew}>
        <AdaptiveDialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-primary" />
              إنشاء باقة جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">الاسم (عربي) *</Label>
                <Input value={newPlan.nameAr} onChange={e => setNewPlan(p => ({ ...p, nameAr: e.target.value }))} placeholder="مثال: مخصص" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الاسم (إنجليزي)</Label>
                <Input value={newPlan.nameEn} onChange={e => setNewPlan(p => ({ ...p, nameEn: e.target.value }))} placeholder="Custom" className="h-8 text-sm" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">المعرّف الفريد (slug) *</Label>
              <Input value={newPlan.id} onChange={e => setNewPlan(p => ({ ...p, id: e.target.value.toLowerCase().replace(/\s/g, "-") }))} placeholder="custom-plan" className="h-8 text-sm font-mono" dir="ltr" />
              <p className="text-[10px] text-muted-foreground">حروف إنجليزية صغيرة وشرطات فقط</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">السعر الشهري (ر.س)</Label>
                <Input type="number" min={0} value={newPlan.monthlyPrice} onChange={e => setNewPlan(p => ({ ...p, monthlyPrice: Number(e.target.value) }))} className="h-8 text-sm" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">اللون</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newPlan.color} onChange={e => setNewPlan(p => ({ ...p, color: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border border-border p-0.5" />
                  <Input value={newPlan.color} onChange={e => setNewPlan(p => ({ ...p, color: e.target.value }))} className="h-8 text-sm font-mono flex-1" dir="ltr" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowNew(false)}>إلغاء</Button>
            <Button size="sm" onClick={createPlan} disabled={saving || !newPlan.id || !newPlan.nameAr} className="gap-1.5">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlusCircle className="w-3 h-3" />}
              إنشاء الباقة
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ══: Delete Plan ══ */}
      <AdaptiveDialog open={showDel} onOpenChange={setShowDel}>
        <AdaptiveDialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              حذف الباقة
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">هل أنت متأكد من حذف باقة <strong>{form?.nameAr}</strong>؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowDel(false)}>إلغاء</Button>
            <Button variant="destructive" size="sm" onClick={deletePlan} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              حذف نهائياً
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </TooltipProvider>
  );
}

/* ═══════════════════════════════════════════════════
   PROMO CODES TAB — free subscription distribution
═══════════════════════════════════════════════════ */
