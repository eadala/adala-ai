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
import { API, DEV_API, useAdmin } from "../shared/api";
import { StatCard } from "../shared/components";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";




export function DevCenterTab({ toast }: any) {
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

  const { data: officesList = [], isLoading: officesLoad, refetch: refetchOffices } = useQuery<any[]>({
    queryKey: ["dev", "offices"],
    queryFn: () => DEV_API("/offices"),
    retry: false,
  });

  const { data: impStatus, refetch: refetchImpStatus } = useQuery<any>({
    queryKey: ["dev", "impersonate-status"],
    queryFn: () => DEV_API("/impersonate/status"),
    retry: false,
    refetchInterval: 60_000,
  });

  const startImpersonate = useMutation({
    mutationFn: (officeId: string) => DEV_API(`/impersonate/${officeId}`, { method: "POST" }),
    onSuccess: (_, officeId) => {
      refetchImpStatus();
      toast({ title: "✅ تم الدخول كمدير المكتب — انتقل للوحة التحكم" });
      qc.invalidateQueries({ queryKey: ["impersonation-status"] });
    },
    onError: () => toast({ title: "خطأ في الدخول", variant: "destructive" }),
  });

  const stopImpersonate = useMutation({
    mutationFn: () => DEV_API("/impersonate", { method: "DELETE" }),
    onSuccess: () => {
      refetchImpStatus();
      qc.invalidateQueries({ queryKey: ["impersonation-status"] });
      toast({ title: "✅ تم الخروج من وضع الاستعراض" });
    },
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
          <TabsTrigger value="offices"  className="gap-1.5 text-xs data-[state=active]:bg-background rounded-lg px-3 py-1.5 text-violet-400 data-[state=active]:text-violet-400"><Building2 className="h-3.5 w-3.5" /> المكاتب</TabsTrigger>
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

        {/* ── OFFICES (IMPERSONATION) ── */}
        <TabsContent value="offices" className="mt-4">
          <div className="space-y-4">
            {/* Active impersonation banner */}
            {impStatus?.active && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
                <div className="flex items-center gap-2 text-sm">
                  <span>🔮</span>
                  <span className="text-violet-300">تستعرض حالياً مكتب <strong className="text-white">{impStatus.officeName}</strong> كمدير المكتب</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-violet-400/30 text-violet-300 hover:bg-violet-500/10"
                    onClick={() => { window.location.href = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") + "/dashboard"; }}>
                    انتقل للوحة التحكم
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-red-400/30 text-red-300 hover:bg-red-500/10"
                    onClick={() => stopImpersonate.mutate()} disabled={stopImpersonate.isPending}>
                    خروج ✕
                  </Button>
                </div>
              </div>
            )}

            {/* Info card */}
            <Card className="border-dashed border-violet-500/30 bg-violet-500/5">
              <CardContent className="p-4 flex gap-3">
                <ShieldAlert className="h-5 w-5 text-violet-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  عند الدخول كمدير مكتب، ستتمكن من عرض البيانات وإجراء التعديلات كأنك مدير ذلك المكتب. <strong className="text-violet-300">جميع التغييرات حقيقية وتؤثر على البيانات الفعلية.</strong>
                </p>
              </CardContent>
            </Card>

            {/* Offices list */}
            {officesLoad ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : officesList.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">لا توجد مكاتب</div>
            ) : (
              <div className="space-y-2">
                {officesList.map((office: any) => {
                  const isActive = impStatus?.active && impStatus.officeId === office.id;
                  const PLAN_LABELS: Record<string, string> = { free: "مجاني", starter: "مبتدئ", professional: "احترافي", growth: "نمو", premium: "متميز", enterprise: "مؤسسي" };
                  return (
                    <Card key={office.id} className={`border-border/50 transition-colors ${isActive ? "border-violet-500/50 bg-violet-500/5" : ""}`}>
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-4 w-4 text-violet-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{office.office_name || "مكتب بلا اسم"}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground font-mono">{office.id}</span>
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{PLAN_LABELS[office.plan] ?? office.plan ?? "—"}</span>
                              <span className="text-[10px] text-muted-foreground">{office.member_count} عضو</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {isActive ? (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-red-400/30 text-red-300 hover:bg-red-500/10"
                              onClick={() => stopImpersonate.mutate()} disabled={stopImpersonate.isPending}>
                              خروج ✕
                            </Button>
                          ) : (
                            <Button size="sm" className="h-7 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
                              onClick={() => startImpersonate.mutate(office.id)}
                              disabled={startImpersonate.isPending}>
                              <Building2 className="h-3 w-3" />
                              دخول كمدير
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
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

