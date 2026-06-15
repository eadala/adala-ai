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

export function PlatformReportsTab() {
  const { data: finance } = useQuery<any>({ queryKey: ["admin", "/finance-stats"], queryFn: () => API("/finance-stats"), staleTime: 60_000 });
  const { data: ext }     = useQuery<any>({ queryKey: ["admin", "/enhanced-stats"], queryFn: () => API("/enhanced-stats"), staleTime: 60_000 });
  const { data: stats }   = useQuery<any>({ queryKey: ["admin", "/stats"], queryFn: () => API("/stats"), staleTime: 60_000 });

  const exportCSV = (rows: any[], name: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(",");
    const body = rows.map(r => Object.values(r).map(v => `"${String(v??"")}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF"+headers+"\n"+body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click();
  };

  const reports = [
    {
      title: "تقرير إيرادات المنصة",
      desc: "ملخص الإيرادات والمصروفات وصافي الربح",
      icon: TrendingUp,
      color: "text-emerald-400 bg-emerald-500/15",
      rows: finance?.monthly ?? [],
      name: "platform-revenue-report",
    },
    {
      title: "تقرير القضايا",
      desc: `${ext?.cases?.total ?? 0} قضية | ${ext?.cases?.open ?? 0} مفتوحة | ${ext?.cases?.closed ?? 0} مغلقة`,
      icon: Gavel,
      color: "text-violet-400 bg-violet-500/15",
      rows: [],
      name: "cases-report",
    },
    {
      title: "تقرير العقود",
      desc: `${ext?.contracts?.total ?? 0} عقد | ${ext?.contracts?.signed ?? 0} موقع`,
      icon: FileSignature,
      color: "text-blue-400 bg-blue-500/15",
      rows: [],
      name: "contracts-report",
    },
    {
      title: "تقرير الاشتراكات",
      desc: `${stats?.activePlans ?? 0} باقة نشطة`,
      icon: Package,
      color: "text-amber-400 bg-amber-500/15",
      rows: [],
      name: "subscriptions-report",
    },
    {
      title: "تقرير الفواتير",
      desc: `${finance?.kpi?.paidInvoices?.count ?? 0} مدفوعة | ${finance?.kpi?.overdueInvoices?.count ?? 0} متأخرة`,
      icon: Banknote,
      color: "text-primary bg-primary/15",
      rows: finance?.recentInvoices ?? [],
      name: "invoices-report",
    },
    {
      title: "تقرير الدعم الفني",
      desc: `${stats?.openTickets ?? 0} تذكرة مفتوحة من ${stats?.totalTickets ?? 0}`,
      icon: HeadphonesIcon,
      color: "text-red-400 bg-red-500/15",
      rows: [],
      name: "support-report",
    },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">مركز التقارير</h3>
          <p className="text-xs text-muted-foreground mt-0.5">توليد وتصدير تقارير المنصة</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
          <Download className="h-3.5 w-3.5" /> تصدير PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <Card key={r.name} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", r.color)}>
                  <r.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1.5 text-xs h-8 bg-primary hover:bg-[#1D4ED8] text-black font-bold" onClick={() => r.rows.length ? exportCSV(r.rows, r.name) : window.print()}>
                  <Download className="h-3 w-3" /> Excel / CSV
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs h-8" onClick={() => window.print()}>
                  <Download className="h-3 w-3" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Summary Table (printable) */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">ملخص الأداء المالي الشهري</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-right text-xs">الشهر</TableHead>
              <TableHead className="text-right text-xs">الإيرادات</TableHead>
              <TableHead className="text-right text-xs">المصروفات</TableHead>
              <TableHead className="text-right text-xs">صافي الربح</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(finance?.monthly ?? []).map((m: any) => (
              <TableRow key={m.month} className="hover:bg-muted/20">
                <TableCell className="text-xs font-medium">{m.month}</TableCell>
                <TableCell className="text-xs text-emerald-400">{(Number(m.revenue||0)/100).toLocaleString("ar-SA")} ر.س</TableCell>
                <TableCell className="text-xs text-red-400">{(Number(m.expenses||0)/100).toLocaleString("ar-SA")} ر.س</TableCell>
                <TableCell className={cn("text-xs font-bold", (m.revenue-m.expenses)>=0?"text-primary":"text-red-400")}>
                  {((Number(m.revenue||0)-Number(m.expenses||0))/100).toLocaleString("ar-SA")} ر.س
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM SECURITY TAB
═══════════════════════════════════════════════════ */
