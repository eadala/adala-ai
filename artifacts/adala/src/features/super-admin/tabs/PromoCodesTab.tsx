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
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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

export function PromoCodesTab({ qc, toast }: any) {
  const BASE = (import.meta as any).env.BASE_URL.replace(/\/$/, "");

  const [showCreate, setShowCreate] = useState(false);
  const [showCreateGift, setShowCreateGift] = useState(false);
  const [renewTarget, setRenewTarget] = useState<any>(null);
  const [renewDays, setRenewDays] = useState(30);
  const [loading, setLoading] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: "", plan_slug: "pro", duration_days: 30,
    max_uses: 1, notes: "", expires_at: "",
  });
  const [giftForm, setGiftForm] = useState({
    plan_slug: "pro", duration_days: 30, notes: "",
  });

  const { data: codes = [], isLoading: codesLoading, refetch: refetchCodes } = useQuery<any[]>({
    queryKey: ["admin-promo-codes"],
    queryFn: () => API("/admin/promo-codes").then(r => r.json()),
    staleTime: 15_000,
  });
  const { data: gifts = [], isLoading: giftsLoading, refetch: refetchGifts } = useQuery<any[]>({
    queryKey: ["admin-gift-subscriptions"],
    queryFn: () => API("/admin/gift-subscriptions").then(r => r.json()),
    staleTime: 15_000,
  });

  const activeGifts = (gifts as any[]).filter(g => g.status === "active" && new Date(g.end_date) > new Date());
  const expiredGifts = (gifts as any[]).filter(g => g.status !== "active" || new Date(g.end_date) <= new Date());

  const PLAN_OPTS = ["free","basic","pro","growth","advanced","enterprise","elite"];
  const PLAN_BADGE: Record<string, string> = {
    free: "bg-slate-500/15 text-slate-300", basic: "bg-blue-500/15 text-blue-300",
    pro: "bg-yellow-500/15 text-yellow-300", growth: "bg-purple-500/15 text-purple-300",
    advanced: "bg-pink-500/15 text-pink-300", enterprise: "bg-emerald-500/15 text-emerald-300",
    elite: "bg-amber-500/15 text-amber-300",
  };

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
  }
  function daysLeft(d: string) {
    return Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86400000));
  }

  async function createCode() {
    if (!form.code || !form.plan_slug) return;
    setLoading("create-code");
    try {
      const r = await API("/admin/promo-codes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "خطأ");
      toast({ title: "✅ تم إنشاء الكود", description: `الكود: ${j.code}` });
      setShowCreate(false);
      setForm({ code: "", plan_slug: "pro", duration_days: 30, max_uses: 1, notes: "", expires_at: "" });
      refetchCodes();
    } catch (e: any) { toast({ title: "خطأ", description: e.message, variant: "destructive" }); }
    finally { setLoading(null); }
  }

  async function toggleCode(id: string, active: boolean) {
    setLoading(id);
    try {
      await API(`/admin/promo-codes/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
      refetchCodes();
    } catch { } finally { setLoading(null); }
  }

  async function deleteCode(id: string, code: string) {
    if (!confirm(`حذف الكود "${code}" نهائياً؟`)) return;
    setLoading(id + "-del");
    try {
      await API(`/admin/promo-codes/${id}`, { method: "DELETE" });
      refetchCodes();
      toast({ title: "✅ تم الحذف" });
    } catch { } finally { setLoading(null); }
  }

  async function createGift() {
    setLoading("create-gift");
    try {
      const r = await API("/admin/gift-subscriptions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(giftForm),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "خطأ");
      toast({ title: "✅ تم تفعيل الاشتراك المجاني", description: `باقة ${j.plan_slug} حتى ${fmtDate(j.end_date)}` });
      setShowCreateGift(false);
      refetchGifts();
    } catch (e: any) { toast({ title: "خطأ", description: e.message, variant: "destructive" }); }
    finally { setLoading(null); }
  }

  async function renewGift() {
    if (!renewTarget || renewDays < 1) return;
    setLoading("renew-" + renewTarget.id);
    try {
      const r = await API(`/admin/gift-subscriptions/${renewTarget.id}/renew`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: renewDays }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "خطأ");
      toast({ title: "✅ تم التمديد", description: `الاشتراك ممتد حتى ${fmtDate(j.end_date)}` });
      setRenewTarget(null);
      refetchGifts();
    } catch (e: any) { toast({ title: "خطأ", description: e.message, variant: "destructive" }); }
    finally { setLoading(null); }
  }

  async function cancelGift(id: string) {
    if (!confirm("إنهاء هذا الاشتراك المجاني؟")) return;
    setLoading("cancel-" + id);
    try {
      await API(`/admin/gift-subscriptions/${id}/cancel`, { method: "PATCH" });
      refetchGifts();
      toast({ title: "✅ تم الإنهاء" });
    } catch { } finally { setLoading(null); }
  }

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `ADALA-${seg()}-${seg()}`;
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "أكواد نشطة",         value: (codes as any[]).filter(c => c.is_active).length,  color: "#2563EB" },
          { label: "إجمالي الأكواد",      value: (codes as any[]).length,                           color: "#64748B" },
          { label: "اشتراكات مجانية",     value: activeGifts.length,                               color: "#10B981" },
          { label: "مستردات الأكواد",     value: (codes as any[]).reduce((s, c) => s + (c.used_count ?? 0), 0), color: "#8B5CF6" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              </div>
              <Gift className="h-7 w-7 opacity-20" style={{ color: s.color }} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── PROMO CODES section ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" /> أكواد الاشتراك المجاني
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">أنشئ كوداً وشاركه مع المكتب — يدخله في صفحة الفوترة لتفعيل الباقة</CardDescription>
            </div>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5" /> إنشاء كود جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {codesLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (codes as any[]).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">لا توجد أكواد بعد — أنشئ أول كود</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">الباقة</TableHead>
                  <TableHead className="text-right">المدة</TableHead>
                  <TableHead className="text-right">الاستخدام</TableHead>
                  <TableHead className="text-right">الانتهاء</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(codes as any[]).map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-bold">{c.code}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${PLAN_BADGE[c.plan_slug] ?? "bg-slate-500/15 text-slate-300"}`}>{c.plan_slug}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{c.duration_days} يوم</TableCell>
                    <TableCell className="text-xs">{c.used_count} / {c.max_uses}</TableCell>
                    <TableCell className="text-xs">{c.expires_at ? fmtDate(c.expires_at) : "—"}</TableCell>
                    <TableCell>
                      {c.is_active
                        ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">نشط</Badge>
                        : <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/30 text-[10px]">معطّل</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => toggleCode(c.id, !c.is_active)}
                          disabled={loading === c.id}>
                          {c.is_active
                            ? <ToggleRight className="h-4 w-4 text-emerald-400" />
                            : <ToggleLeft className="h-4 w-4 text-slate-400" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteCode(c.id, c.code)}
                          disabled={loading === c.id + "-del"}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── GIFT SUBSCRIPTIONS section ── */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4 text-emerald-400" /> الاشتراكات المجانية المفعّلة
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">اشتراكات مجانية نشطة أو منتهية — يمكنك تمديدها أو إنهاؤها</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowCreateGift(true)}>
              <Plus className="h-3.5 w-3.5" /> منح اشتراك مجاني مباشر
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {giftsLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (gifts as any[]).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">لا توجد اشتراكات مجانية بعد</div>
          ) : (
            <div className="space-y-4">
              {activeGifts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-400 mb-2">نشطة ({activeGifts.length})</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الباقة</TableHead>
                        <TableHead className="text-right">تاريخ الانتهاء</TableHead>
                        <TableHead className="text-right">المتبقي</TableHead>
                        <TableHead className="text-right">الكود المستخدم</TableHead>
                        <TableHead className="text-right">تجديدات</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeGifts.map((g: any) => (
                        <TableRow key={g.id}>
                          <TableCell>
                            <Badge className={`text-[10px] ${PLAN_BADGE[g.plan_slug] ?? "bg-slate-500/15 text-slate-300"}`}>{g.plan_slug}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{fmtDate(g.end_date)}</TableCell>
                          <TableCell className="text-xs font-bold text-emerald-400">{daysLeft(g.end_date)} يوم</TableCell>
                          <TableCell className="text-xs font-mono">{g.promo_code_text ?? "—"}</TableCell>
                          <TableCell className="text-xs">{g.renewed_count} مرة</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                onClick={() => { setRenewTarget(g); setRenewDays(30); }}>
                                <RefreshCw className="h-3 w-3" /> تمديد
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => cancelGift(g.id)}
                                disabled={loading === "cancel-" + g.id}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {expiredGifts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">منتهية / ملغاة ({expiredGifts.length})</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الباقة</TableHead>
                        <TableHead className="text-right">انتهت في</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expiredGifts.map((g: any) => (
                        <TableRow key={g.id} className="opacity-60">
                          <TableCell>
                            <Badge className={`text-[10px] ${PLAN_BADGE[g.plan_slug] ?? "bg-slate-500/15 text-slate-300"}`}>{g.plan_slug}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{fmtDate(g.end_date)}</TableCell>
                          <TableCell>
                            <Badge className="bg-slate-500/15 text-slate-400 text-[10px]">{g.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => { setRenewTarget(g); setRenewDays(30); }}>
                              <RefreshCw className="h-3 w-3" /> تجديد
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CREATE CODE DIALOG ── */}
      <AdaptiveDialog open={showCreate} onOpenChange={setShowCreate}>
        <AdaptiveDialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> إنشاء كود اشتراك مجاني</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">الكود</label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="ADALA-XXXX-XXXX" className="font-mono" />
              </div>
              <div className="pt-5">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setForm(f => ({ ...f, code: generateCode() }))}>
                  توليد
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">الباقة</label>
                <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                  value={form.plan_slug} onChange={e => setForm(f => ({ ...f, plan_slug: e.target.value }))}>
                  {PLAN_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">المدة (أيام)</label>
                <Input type="number" min={1} value={form.duration_days}
                  onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">عدد الاستخدامات</label>
                <Input type="number" min={1} value={form.max_uses}
                  onChange={e => setForm(f => ({ ...f, max_uses: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">انتهاء الكود (اختياري)</label>
                <Input type="date" value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ملاحظات</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="سبب المنح..." />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>إلغاء</Button>
              <Button size="sm" onClick={createCode} disabled={!form.code || loading === "create-code"}
                className="bg-primary hover:bg-[#b8943d] text-black font-bold gap-1.5">
                {loading === "create-code" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                إنشاء
              </Button>
            </div>
          </div>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ── CREATE GIFT DIRECTLY DIALOG ── */}
      <AdaptiveDialog open={showCreateGift} onOpenChange={setShowCreateGift}>
        <AdaptiveDialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gift className="h-4 w-4" /> منح اشتراك مجاني مباشر</DialogTitle>
            <DialogDescription>يُفعَّل الاشتراك فوراً دون حاجة لكود</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">الباقة</label>
                <select className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                  value={giftForm.plan_slug} onChange={e => setGiftForm(f => ({ ...f, plan_slug: e.target.value }))}>
                  {PLAN_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">المدة (أيام)</label>
                <Input type="number" min={1} value={giftForm.duration_days}
                  onChange={e => setGiftForm(f => ({ ...f, duration_days: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ملاحظات</label>
              <Input value={giftForm.notes} onChange={e => setGiftForm(f => ({ ...f, notes: e.target.value }))} placeholder="سبب المنح..." />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateGift(false)}>إلغاء</Button>
              <Button size="sm" onClick={createGift} disabled={loading === "create-gift"}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5">
                {loading === "create-gift" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
                تفعيل فوراً
              </Button>
            </div>
          </div>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ── RENEW DIALOG ── */}
      <AdaptiveDialog open={!!renewTarget} onOpenChange={open => !open && setRenewTarget(null)}>
        <AdaptiveDialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> تمديد الاشتراك المجاني</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {renewTarget && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الباقة</span>
                  <Badge className={`text-[10px] ${PLAN_BADGE[renewTarget.plan_slug] ?? ""}`}>{renewTarget.plan_slug}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ينتهي حالياً</span>
                  <span className="text-xs font-bold">{fmtDate(renewTarget.end_date)}</span>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">إضافة (أيام)</label>
              <Input type="number" min={1} value={renewDays} onChange={e => setRenewDays(Number(e.target.value))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setRenewTarget(null)}>إلغاء</Button>
              <Button size="sm" onClick={renewGift}
                disabled={!renewDays || loading === "renew-" + renewTarget?.id}
                className="bg-primary hover:bg-[#b8943d] text-black font-bold gap-1.5">
                {loading?.startsWith("renew-") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                تمديد
              </Button>
            </div>
          </div>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   GHOST CENTER TAB — وصول خفي لأي مكتب بدون أثر
═══════════════════════════════════════════════════════════════════ */
const GHOST_QUICK_LINKS = [
  { label: "لوحة التحكم",    path: "/dashboard",  Icon: Layout,       color: "#2563EB" },
  { label: "القضايا",        path: "/cases",       Icon: Gavel,        color: "#8B5CF6" },
  { label: "العملاء",        path: "/clients",     Icon: Users,        color: "#06B6D4" },
  { label: "الفواتير",       path: "/invoices",    Icon: Receipt,      color: "#10B981" },
  { label: "العقود",         path: "/contracts",   Icon: FileText,     color: "#F59E0B" },
  { label: "التحليلات",      path: "/analytics",   Icon: BarChart3,    color: "#EF4444" },
  { label: "الموارد البشرية",path: "/hr",          Icon: Briefcase,    color: "#84CC16" },
  { label: "الرسائل",        path: "/messages",    Icon: Bell,         color: "#EC4899" },
  { label: "الإعدادات",      path: "/settings",    Icon: Settings,     color: "#64748B" },
  { label: "المحاسبة",       path: "/accounting",  Icon: DollarSign,   color: "#0EA5E9" },
  { label: "التقويم",        path: "/calendar",    Icon: CalendarClock,color: "#D946EF" },
  { label: "الأمان",         path: "/my-sessions", Icon: Shield,       color: "#F97316" },
];

const GHOST_CASE_STATUS: Record<string, string> = {
  open:"مفتوحة", closed:"مغلقة", pending:"معلقة", active:"نشطة", new:"جديدة",
};
const GHOST_INV_COLOR: Record<string, string> = {
  paid:"text-emerald-400", pending:"text-amber-400", overdue:"text-red-400", draft:"text-muted-foreground",
};
const GHOST_INV_LABEL: Record<string, string> = {
  paid:"مدفوعة", pending:"معلقة", overdue:"متأخرة", draft:"مسودة",
};

