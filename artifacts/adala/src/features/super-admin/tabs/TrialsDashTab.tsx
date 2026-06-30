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

export function TrialsDashTab({ toast }: { toast: any }) {
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

      {/* Extend */}
      <AdaptiveDialog open={!!extendTarget} onOpenChange={o => !o && setExtendTarget(null)}>
        <AdaptiveDialogContent className="max-w-sm">
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
                    className={extendDays === d ? "bg-primary hover:bg-[#1D4ED8] text-black font-bold" : ""}
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
              className="bg-primary hover:bg-[#1D4ED8] text-black font-bold gap-1">
              {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              تمديد
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   HOME CMS TAB
═══════════════════════════════════════════════════ */
