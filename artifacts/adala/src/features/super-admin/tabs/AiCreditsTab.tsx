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

export function AiCreditsTab({ qc, toast }: any) {
  const { data: offices = [], isLoading, refetch } = useAdmin<any[]>("/admin/ai-credits");
  const [topup, setTopup] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [tx, setTx] = useState<any>(null);
  const [topupForm, setTopupForm] = useState({ amount: "", description: "شحن يدوي" });
  const [settingsForm, setSettingsForm] = useState({ monthlyAllowance: 100, autoRenew: true, renewDay: 1 });
  const [addOfficeOpen, setAddOfficeOpen] = useState(false);
  const [newOffice, setNewOffice] = useState({ officeId: "", officeName: "", monthlyAllowance: 100 });
  const { data: txRows = [] } = useQuery<any[]>({
    queryKey: ["admin", `/admin/ai-credits/${tx?.office_id}/transactions`],
    queryFn: () => API(`/admin/ai-credits/${tx?.office_id}/transactions`).then(r => r.json()).catch(() => []),
    enabled: !!tx,
  });

  const topupMut = useMutation({
    mutationFn: (d: any) => API("/admin/ai-credits/topup", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: (r) => r.json().then((d: any) => {
      if (d.error) { toast({ title: "خطأ", description: d.error, variant: "destructive" }); return; }
      toast({ title: `تم الشحن ✓ — الرصيد: ${d.balance} نقطة` });
      qc.invalidateQueries({ queryKey: ["admin", "/admin/ai-credits"] });
      setTopup(null);
    }),
  });

  const settingsMut = useMutation({
    mutationFn: (d: any) => API("/admin/ai-credits/settings", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      toast({ title: "تم حفظ الإعدادات ✓" });
      qc.invalidateQueries({ queryKey: ["admin", "/admin/ai-credits"] });
      setSettings(null);
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
    setTopup(o);
    setTopupForm({ amount: "", description: "شحن يدوي" });
  }
  function openSettings(o: any) {
    setSettings(o);
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
          <Card key={s.label} className="bg-card border-border">
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
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
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
                  <TableRow key={o.office_id} className="border-border hover:bg-muted/10">
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
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setTx(o)}>
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

      {/* Topup */}
      <AdaptiveDialog open={!!topup} onOpenChange={v => !v && setTopup(null)}>
        <AdaptiveDialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" /> شحن رصيد AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-muted/30 rounded-xl p-3 text-sm">
              <span className="text-muted-foreground">المكتب: </span>
              <span className="font-semibold">{topup?.office_name}</span>
              <span className="mx-2 text-muted-foreground">|</span>
              <span className="text-muted-foreground">الرصيد الحالي: </span>
              <span className="font-bold text-amber-400">{topup?.balance} نقطة</span>
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
            <Button variant="outline" onClick={() => setTopup(null)}>إلغاء</Button>
            <Button onClick={() => topupMut.mutate({ officeId: topup?.office_id, amount: parseInt(topupForm.amount), description: topupForm.description })}
              disabled={!topupForm.amount || isNaN(parseInt(topupForm.amount)) || topupMut.isPending}
              className="bg-amber-500 hover:bg-amber-600 text-black font-bold gap-1.5">
              {topupMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              شحن {topupForm.amount ? `(+${topupForm.amount} نقطة)` : ""}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* Settings */}
      <AdaptiveDialog open={!!settings} onOpenChange={v => !v && setSettings(null)}>
        <AdaptiveDialogContent className="bg-card border-border max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> إعدادات رصيد AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm font-semibold text-muted-foreground">{settings?.office_name}</p>
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
            <Button variant="outline" onClick={() => setSettings(null)}>إلغاء</Button>
            <Button onClick={() => settingsMut.mutate({ officeId: settings?.office_id, ...settingsForm })}
              disabled={settingsMut.isPending}
              className="bg-primary hover:bg-[#1D4ED8] text-black font-bold">
              {settingsMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* Transactions */}
      <AdaptiveDialog open={!!tx} onOpenChange={v => !v && setTx(null)}>
        <AdaptiveDialogContent className="bg-card border-border max-w-xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" /> سجل المعاملات — {tx?.office_name}
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
            <Button variant="outline" onClick={() => setTx(null)}>إغلاق</Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* Add Office */}
      <AdaptiveDialog open={addOfficeOpen} onOpenChange={setAddOfficeOpen}>
        <AdaptiveDialogContent className="bg-card border-border max-w-sm" dir="rtl">
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
              className="bg-primary hover:bg-[#1D4ED8] text-black font-bold">
              {addOfficeMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              إضافة
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
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
const GOLD = "#2563EB";
const PLAN_COLORS_GC: Record<string, string> = {
  free:"#64748B", basic:"#3B82F6", pro:"#2563EB",
  growth:"#8B5CF6", advanced:"#EC4899", enterprise:"#10B981", elite:"#F59E0B",
};

