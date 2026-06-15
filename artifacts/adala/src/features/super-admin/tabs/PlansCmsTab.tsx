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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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

export function PlansCmsTab({ toast }: { toast: any }) {
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
    growth: "#10B981", advanced: "#F59E0B", enterprise: "#EF4444", elite: "#2563EB",
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

/* ═══════════════════════════════════════════════════
   PROMO CODES TAB — free subscription distribution
═══════════════════════════════════════════════════ */
