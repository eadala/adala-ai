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

const CHART_COLORS = ["#2563EB","#3B82F6","#10B981","#8B5CF6","#EF4444","#F59E0B","#06B6D4","#F97316"];

export function PlatformFinanceTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["admin", "/finance-stats"],
    queryFn: () => API("/finance-stats"),
    staleTime: 60_000,
  });

  const kpi = data?.kpi ?? {};
  const n = (v: any) => parseFloat(String(v ?? 0)) || 0;
  const fmtSAR = (v: number) => {
    const r = v / 100;
    if (r >= 1_000_000) return (r/1_000_000).toFixed(1) + "م ر.س";
    if (r >= 1_000) return (r/1_000).toFixed(0) + "ك ر.س";
    return r.toLocaleString("ar-SA", {maximumFractionDigits:0}) + " ر.س";
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: "إجمالي الإيرادات", value: fmtSAR(n(kpi.totalRevenue)), icon: TrendingUp, color: "text-emerald-400 bg-emerald-500/15" },
          { label: "إجمالي المصروفات", value: fmtSAR(n(kpi.totalExpenses)), icon: TrendingDown, color: "text-red-400 bg-red-500/15" },
          { label: "صافي الربح",        value: fmtSAR(n(kpi.netProfit)),    icon: DollarSign, color: "text-primary bg-primary/15" },
          { label: "فواتير مدفوعة",     value: `${kpi.paidInvoices?.count ?? 0} فاتورة`,   icon: CheckCircle2, color: "text-green-400 bg-green-500/15" },
          { label: "فواتير متأخرة",     value: `${kpi.overdueInvoices?.count ?? 0} فاتورة`, icon: AlertOctagon, color: "text-red-400 bg-red-500/15" },
          { label: "فواتير قيد التحصيل",value: `${kpi.pendingInvoices?.count ?? 0} فاتورة`, icon: Clock,        color: "text-amber-400 bg-amber-500/15" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              {isLoading ? <div className="h-5 w-24 bg-muted/40 rounded animate-pulse" /> : <p className="text-xl font-bold">{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly revenue/expenses bar chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">الأداء المالي — آخر 6 أشهر</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-52 bg-muted/20 rounded-lg animate-pulse" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data?.monthly ?? []} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+"ك" : String(v)} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(v: number, name: string) => [`${(v/100).toLocaleString("ar-SA")} ر.س`, name==="revenue"?"الإيرادات":"المصروفات"]} />
                  <Legend formatter={v => v==="revenue"?"الإيرادات":"المصروفات"} />
                  <Bar dataKey="revenue"  fill="#10B981" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="expenses" fill="#EF4444" radius={[4,4,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expense Categories */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">تصنيف المصروفات</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-52 bg-muted/20 rounded-lg animate-pulse" /> : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={data?.expenseCategories ?? []} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3}>
                      {(data?.expenseCategories ?? []).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${(v/100).toLocaleString("ar-SA")} ر.س`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-1">
                  {(data?.expenseCategories ?? []).slice(0,5).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-muted-foreground">{c.name}</span></div>
                      <span className="font-medium">{(c.value/100).toLocaleString("ar-SA",{maximumFractionDigits:0})}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">أحدث الفواتير</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-right text-xs">رقم الفاتورة</TableHead>
              <TableHead className="text-right text-xs">المبلغ</TableHead>
              <TableHead className="text-right text-xs">الحالة</TableHead>
              <TableHead className="text-right text-xs">تاريخ الاستحقاق</TableHead>
              <TableHead className="text-right text-xs">تاريخ الإنشاء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></TableCell></TableRow>
            ) : (data?.recentInvoices ?? []).map((inv: any) => {
              const stMap: any = { paid: {l:"مدفوعة",c:"bg-green-500/15 text-green-400"}, sent: {l:"مُرسَلة",c:"bg-blue-500/15 text-blue-400"}, overdue: {l:"متأخرة",c:"bg-red-500/15 text-red-400"}, draft: {l:"مسودة",c:"bg-muted text-muted-foreground"} };
              const st = stMap[inv.status] ?? stMap.draft;
              return (
                <TableRow key={inv.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs font-mono">{inv.invoice_number ?? inv.id.slice(0,8)}</TableCell>
                  <TableCell className="text-xs font-medium">{(Number(inv.total||0)/100).toLocaleString("ar-SA")} ر.س</TableCell>
                  <TableCell><Badge className={cn("text-[10px]", st.c)}>{st.l}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString("ar-SA") : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("ar-SA")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM REPORTS TAB
═══════════════════════════════════════════════════ */
