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
import { API, DEV_API, useAdmin } from "../shared/api";
import { StatCard } from "../shared/components";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function OfficesTab({ qc, toast }: any) {
  const { data: offices = [], isLoading } = useAdmin<any[]>("/offices");
  const { data: plans = [] } = useAdmin<any[]>("/plans");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [slug, setSlug] = useState<any>(null);
  const [slugInput, setSlugInput] = useState("");
  const [enteringId, setEnteringId] = useState<string | null>(null);

  const enterOffice = useMutation({
    mutationFn: async (officeId: string) => {
      setEnteringId(officeId);
      return DEV_API(`/impersonate/${officeId}`, { method: "POST" });
    },
    onSuccess: (_data, officeId) => {
      const office = (offices as any[]).find((o: any) => o.id === officeId);
      toast({ title: `🔮 دخول المكتب: ${office?.name ?? officeId}` });
      setTimeout(() => { window.location.href = `${BASE}/dashboard`; }, 400);
    },
    onError: () => {
      setEnteringId(null);
      toast({ title: "فشل الدخول للمكتب", variant: "destructive" });
    },
  });

  const updateOffice = useMutation({
    mutationFn: ({ id, ...d }: any) => API(`/offices/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "/offices"] });
      toast({ title: "تم التحديث ✓" });
      setPlan(null);
      setSlug(null);
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
                const planColor = PLAN_SLUG_COLORS[planSlug] ?? "#2563EB";
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
                        onClick={() => setPlan({ id: o.id, plan: planSlug })}
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
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white shadow-sm"
                          disabled={enteringId === o.id}
                          onClick={() => enterOffice.mutate(o.id)}
                          title="دخول المكتب بصلاحيات كاملة (Ghost Access)"
                        >
                          {enteringId === o.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Fingerprint className="h-3 w-3" />}
                          دخول
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                          onClick={() => updateOffice.mutate({ id: o.id, isPublished: !o.isPublished })}>
                          {o.isPublished ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {o.isPublished ? "إخفاء" : "نشر"}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-violet-400 hover:text-violet-300"
                          title="تعديل رابط المكتب"
                          onClick={() => { setSlug({ id: o.id, name: o.name, slug: o.slug }); setSlugInput(o.slug ?? ""); }}>
                          <Link2 className="h-3 w-3" /> رابط
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

      {/* Slug management dialog — platform admin only */}
      <AdaptiveDialog open={!!slug} onOpenChange={v => { if (!v) setSlug(null); }}>
        <AdaptiveDialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <Link2 className="h-4 w-4 text-violet-400" /> تعديل رابط المكتب
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {slug?.name} — الرابط الحالي: <span className="font-mono text-primary" dir="ltr">/firms/{slug?.slug}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الرابط الجديد</Label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-mono shrink-0 bg-muted/50 px-2 py-1.5 rounded-lg border border-border/50">adalah.sa/firms/</span>
                <Input
                  value={slugInput}
                  onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                  className="flex-1 font-mono text-sm h-9 dir-ltr"
                  placeholder="law-firm-name"
                  dir="ltr"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">أحرف إنجليزية صغيرة وأرقام وشرطات فقط</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">اقتراح تلقائي من اسم المكتب</Label>
              <div className="flex flex-wrap gap-1.5">
                {slug?.name && (() => {
                  const auto = arabicToSlug(slug.name);
                  const suggestions = [
                    auto,
                    auto.split('-').slice(0, 2).join('-'),
                    `${auto.split('-')[0]}-law`,
                    `${auto.split('-')[0]}-legal`,
                  ].filter((s, i, a) => s && a.indexOf(s) === i).slice(0, 4);
                  return suggestions.map(s => (
                    <button key={s} onClick={() => setSlugInput(s)}
                      className={`text-[11px] font-mono px-2 py-1 rounded-lg border transition-all ${slugInput === s ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-border/40 bg-muted/30 hover:bg-muted/60 text-muted-foreground'}`}
                      dir="ltr">
                      {s}
                    </button>
                  ));
                })()}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setSlug(null)}>إلغاء</Button>
              <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700"
                disabled={!slugInput.trim() || slugInput === slug?.slug || updateOffice.isPending}
                onClick={() => slug && updateOffice.mutate({ id: slug.id, slug: slugInput.trim() })}>
                {updateOffice.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                حفظ الرابط
              </Button>
            </div>
          </div>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* Plan assignment dialog */}
      <AdaptiveDialog open={!!plan} onOpenChange={() => setPlan(null)}>
        <AdaptiveDialogContent className="max-w-sm">
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
                color: p.color ?? "#2563EB",
                price: p.monthlyPrice > 0 ? `${p.monthlyPrice} ر.س/شهر` : "مجاناً",
              })),
            ].filter((item, idx, arr) => arr.findIndex(x => x.slug === item.slug) === idx)
              .map(item => (
              <button key={item.slug}
                onClick={() => {
                  if (plan) {
                    setPlan((d: any) => ({ ...d, plan: item.slug }));
                  }
                }}
                className={cn(
                  "w-full flex items-center justify-between p-2.5 rounded-lg border text-right transition-all",
                  plan?.plan === item.slug
                    ? "border-primary bg-primary/10"
                    : "border-border/30 bg-muted/20 hover:bg-muted/40"
                )}>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-semibold">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{item.price}</span>
                  {plan?.plan === item.slug && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPlan(null)}>إلغاء</Button>
            <Button size="sm" disabled={updateOffice.isPending} className="gap-1.5 bg-primary hover:bg-primary/90"
              onClick={() => plan && updateOffice.mutate({ id: plan.id, plan: plan.plan })}>
              {updateOffice.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              حفظ التغيير
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   USERS TAB
═══════════════════════════════════════════════════ */
