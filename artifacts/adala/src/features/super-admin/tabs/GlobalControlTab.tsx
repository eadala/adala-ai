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

function fmtSAR(n: number) {
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

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

export function GlobalControlTab({ toast }: { toast: any }) {
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
            <Globe2 className="h-5 w-5 text-primary" />
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
.cover{background:linear-gradient(135deg,#080F1E,#FFFFFF);color:#fff;padding:28px;margin-bottom:20px;border-radius:8px;display:flex;justify-content:space-between;align-items:center}
.cover h1{font-size:20pt;font-weight:900;color:#2563EB;margin-bottom:4px}.cover p{color:rgba(255,255,255,0.55);font-size:9pt}
.section{margin-bottom:18px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:8px;break-inside:avoid}
.section h2{font-size:11pt;font-weight:800;color:#FFFFFF;border-bottom:2.5px solid #2563EB;padding-bottom:6px;margin-bottom:12px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
.kpi{background:#f8fafc;border-radius:6px;padding:10px 8px;text-align:center;border:1px solid #e5e7eb}
.kpi .val{font-size:14pt;font-weight:900;color:#2563EB}.kpi .lbl{font-size:7.5pt;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:8.5pt}
th{background:#FFFFFF;color:#2563EB;padding:7px 8px;text-align:right;font-weight:700}
td{padding:6px 8px;border-bottom:1px solid #f1f5f9}tr:nth-child(even) td{background:#f8fafc}
.risk-h{background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:4px;font-size:8pt;font-weight:700}
.risk-m{background:#fef9c3;color:#d97706;padding:2px 6px;border-radius:4px;font-size:8pt;font-weight:700}
.risk-l{background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:4px;font-size:8pt;font-weight:700}
.footer{text-align:center;color:#94a3b8;font-size:7.5pt;margin-top:18px;border-top:1px solid #e5e7eb;padding-top:10px}
</style></head><body>
<div class="cover">
  <div><h1>تقرير الإدارة العالمية</h1><p>عدالة AI · منصة SaaS قانونية · ${d}</p></div>
  <div style="text-align:center"><div style="font-size:28pt;font-weight:900;color:#2563EB">${growthData?.summary?.totalOffices ?? 0}</div><div style="color:rgba(255,255,255,0.6);font-size:9pt">مكتب مسجّل</div></div>
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
          }} className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10">
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
                ? "bg-primary text-black border-primary"
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
            <StatCard icon={<DollarSign className="h-4 w-4"/>} label="إجمالي الإيرادات" color="#2563EB"
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
            <StatCard icon={<Receipt className="h-4 w-4"/>} label="إجمالي المعاملات" color="#2563EB"
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
              <Building2 className="h-4 w-4 text-primary" />
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
                          <span className="text-primary font-bold shrink-0">{o.usagePct}%</span>
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

      {/* ── Plan Change ── */}
      <AdaptiveDialog open={!!changingPlan} onOpenChange={o => !o && setChangingPlan(null)}>
        <AdaptiveDialogContent className="max-w-sm" dir="rtl">
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
              className="bg-primary hover:bg-[#1D4ED8] text-black font-bold">
              {planChanging && <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />}
              تطبيق
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   TRIALS DASHBOARD TAB
═══════════════════════════════════════════════════ */
