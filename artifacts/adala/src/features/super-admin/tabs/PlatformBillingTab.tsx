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

const PLAN_COLORS_SA: Record<string, string> = {
  advisor:    "#38BDF8",
  solo:       "#2563EB",
  office:     "#34D399",
  advanced:   "#A78BFA",
  corporate:  "#FB923C",
  enterprise: "#94A3B8",
};

export function PlatformBillingTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useAdmin<any>("/billing/overview");

  const payMut = useMutation({
    mutationFn: async (id: string) => {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const r = await fetch(`${BASE}/api/admin/billing/pay/${id}`, { method: "POST" });
      return r.json();
    },
    onSuccess: () => { toast({ title: "✅ تم تسجيل الدفع بنجاح" }); refetch(); },
    onError:   () => toast({ title: "خطأ", variant: "destructive" }),
  });

  const fmtSAR = (v: number) => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "م ر.س";
    if (v >= 1_000)     return (v / 1_000).toFixed(0)     + "ك ر.س";
    return v.toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س";
  };

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    paid:    { label: "مدفوعة",       cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
    unpaid:  { label: "قيد الانتظار", cls: "bg-amber-500/10  text-amber-400  border-amber-500/30"  },
    overdue: { label: "متأخرة",       cls: "bg-red-500/10    text-red-400    border-red-500/30"    },
  };

  const kpis = [
    { label: "إجمالي الإيرادات",  value: fmtSAR(data?.total_revenue   ?? 0), icon: Banknote,       color: "text-emerald-400 bg-emerald-500/15" },
    { label: "إيرادات معلّقة",    value: fmtSAR(data?.pending_revenue ?? 0), icon: Clock,          color: "text-amber-400  bg-amber-500/15"   },
    { label: "إيرادات متأخرة",    value: fmtSAR(data?.overdue_revenue ?? 0), icon: AlertTriangle,   color: "text-red-400    bg-red-500/15"     },
    { label: "فواتير مدفوعة",    value: String(data?.paid_count    ?? 0),    icon: CheckCircle2,   color: "text-green-400  bg-green-500/15"   },
    { label: "قيد الانتظار",     value: String(data?.unpaid_count  ?? 0),    icon: Receipt,        color: "text-blue-400   bg-blue-500/15"    },
    { label: "متأخرة",           value: String(data?.overdue_count ?? 0),    icon: XCircle,        color: "text-red-400    bg-red-500/15"     },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> فواتير اشتراكات المنصة
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            إيرادات SaaS المحصّلة من مكاتب المحاماة — نظرة عامة شاملة
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", color)}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              {isLoading
                ? <div className="h-5 w-24 bg-muted/40 rounded animate-pulse" />
                : <p className="text-xl font-bold">{value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue by plan */}
      {(data?.by_plan ?? []).length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">الإيرادات حسب الباقة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.by_plan as any[]).map((p: any) => {
              const total = Math.max(data.total_revenue, 1);
              const pct   = Math.min(100, (parseFloat(p.revenue) / total) * 100);
              const col   = PLAN_COLORS_SA[p.plan_id] ?? "#94A3B8";
              return (
                <div key={p.plan_id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">{p.plan_name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{p.invoice_count} فاتورة</span>
                      <span className="font-bold" style={{ color: col }}>
                        {parseFloat(p.revenue).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ر.س
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent invoices */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">أحدث الفواتير</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-muted/20 rounded animate-pulse" />
              ))}
            </div>
          ) : (data?.recent ?? []).length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
              لا توجد فواتير بعد
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {(data.recent as any[]).map((inv: any) => {
                const st = STATUS_MAP[inv.status] ?? STATUS_MAP.unpaid;
                return (
                  <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.plan_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("ar-SA") : "—"}
                      </p>
                    </div>
                    <span className="font-bold text-sm text-primary">
                      {parseFloat(inv.amount).toLocaleString("ar-SA", { maximumFractionDigits: 0 })} {inv.currency}
                    </span>
                    <Badge variant="outline" className={cn("text-[10px] border shrink-0", st.cls)}>
                      {st.label}
                    </Badge>
                    {inv.status !== "paid" && (
                      <Button size="sm" variant="outline"
                        className="text-[10px] h-6 px-2 gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                        onClick={() => payMut.mutate(inv.id)} disabled={payMut.isPending}>
                        <CheckCircle className="h-3 w-3" /> تسديد
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty-state */}
      {!isLoading && (data?.total_invoices ?? 0) === 0 && (
        <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 text-center space-y-2">
          <CreditCard className="h-10 w-10 mx-auto text-primary/50" />
          <p className="text-sm font-semibold text-primary">لا توجد فواتير بعد</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            عندما تشترك المكاتب في باقات عدالة AI ستظهر فواتيرها هنا مع تتبع الدفع والإيرادات.
          </p>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MOBILE APP TAB
═══════════════════════════════════════════════════ */
