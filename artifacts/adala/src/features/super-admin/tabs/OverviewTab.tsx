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

export function OverviewTab({ stats }: { stats: any }) {
  const { data: ext } = useQuery<any>({
    queryKey: ["admin", "/enhanced-stats"],
    queryFn: () => API("/enhanced-stats"),
    staleTime: 60_000,
  });

  const fmtSAR = (n: number) => {
    const r = n / 100;
    if (r >= 1_000_000) return (r/1_000_000).toFixed(1) + "م ر.س";
    if (r >= 1_000) return (r/1_000).toFixed(0) + "ك ر.س";
    return r.toLocaleString("ar-SA", {maximumFractionDigits:0}) + " ر.س";
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Building2 className="h-4 w-4" />} label="إجمالي المكاتب" value={stats?.totalOffices ?? "—"} color="#2563EB" />
        <StatCard icon={<Users className="h-4 w-4" />} label="إجمالي المستخدمين" value={stats?.totalUsers ?? "—"} color="#3B82F6" />
        <StatCard icon={<Gavel className="h-4 w-4" />} label="إجمالي القضايا" value={ext?.cases?.total ?? "—"} sub={`${ext?.cases?.open ?? 0} مفتوحة`} color="#8B5CF6" />
        <StatCard icon={<FileSignature className="h-4 w-4" />} label="إجمالي العقود" value={ext?.contracts?.total ?? "—"} sub={`${ext?.contracts?.signed ?? 0} موقعة`} color="#10B981" />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Package className="h-4 w-4" />} label="الباقات النشطة" value={stats?.activePlans ?? "—"} color="#F59E0B" />
        <StatCard icon={<HeadphonesIcon className="h-4 w-4" />} label="تذاكر الدعم" value={stats?.openTickets ?? "—"} sub={`من ${stats?.totalTickets ?? 0} إجمالي`} color="#EF4444" />
        <StatCard icon={<Activity className="h-4 w-4" />} label="استهلاك AI" value={stats?.totalAiUsage?.toLocaleString() ?? "—"} sub="وحدة" color="#06B6D4" />
        <StatCard icon={<AlertOctagon className="h-4 w-4" />} label="فواتير متأخرة" value={ext?.overdueInvoices ?? "—"} color="#EF4444" />
      </div>

      {/* Revenue chart + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly Revenue Chart */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> الإيرادات الشهرية
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!ext ? (
              <div className="h-52 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={ext.monthlyChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+"ك" : String(v)} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px", direction: "rtl" }} formatter={(v: number) => [`${(v/100).toLocaleString("ar-SA")} ر.س`, "الإيرادات"]} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#revGrad)" dot={{ fill: "#2563EB", r: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">النشاط الأخير</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!ext?.recentActivity ? (
              <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : ext.recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">لا يوجد نشاط حديث</div>
            ) : (
              <div className="divide-y divide-border/30 max-h-52 overflow-y-auto">
                {ext.recentActivity.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 p-3">
                    <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${item.type === "case" ? "bg-violet-500/15" : "bg-blue-500/15"}`}>
                      {item.type === "case" ? <Gavel className="h-3.5 w-3.5 text-violet-400" /> : <FileSignature className="h-3.5 w-3.5 text-blue-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{item.label}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge className="text-[9px] px-1.5 py-0 bg-muted/50 text-muted-foreground border-0">{item.type === "case" ? "قضية" : "عقد"}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("ar-SA")}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM CASES TAB
═══════════════════════════════════════════════════ */
const CASE_STATUS: Record<string, {label: string; color: string}> = {
  open:     { label: "مفتوحة",  color: "bg-blue-500/15 text-blue-400" },
  closed:   { label: "مغلقة",   color: "bg-muted text-muted-foreground" },
  pending:  { label: "معلقة",   color: "bg-amber-500/15 text-amber-400" },
  archived: { label: "مؤرشفة",  color: "bg-gray-500/15 text-gray-400" },
};

