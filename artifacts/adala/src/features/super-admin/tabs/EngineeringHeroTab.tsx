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

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export function EngineeringHeroTab() {
  const engUrl = `${BASE}/engineering-center`;
  const layers = [
    { name: "Role Permission",  status: "active",   color: "text-emerald-400", icon: "✓" },
    { name: "Clerk Auth (JWT)", status: "active",   color: "text-emerald-400", icon: "✓" },
    { name: "IP Allowlist",     status: "disabled", color: "text-amber-400",   icon: "○" },
    { name: "Approval Key",     status: "planned",  color: "text-violet-400",  icon: "◎" },
    { name: "Audit Logs",       status: "active",   color: "text-emerald-400", icon: "✓" },
  ];
  const features = [
    { icon: Code2,          label: "تحليل الكود بـ AI",       desc: "مراجعة كود + فحص أمني + تحسين أداء" },
    { icon: ShieldCheck,    label: "مركز الأمان",             desc: "فحص أمني شامل + IP Whitelist" },
    { icon: Activity,       label: "مراقبة الأداء",          desc: "Memory · CPU · DB · Uptime" },
    { icon: Database,       label: "تحليل قاعدة البيانات",   desc: "60+ جدول · أحجام · فهارس" },
    { icon: ClipboardList,  label: "المهام الهندسية",         desc: "إنشاء وتتبع المهام الداخلية" },
    { icon: ScrollText,     label: "سجل العمليات",            desc: "كل عملية محفوظة ومرقّمة" },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-900/30 via-indigo-900/20 to-transparent p-8">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(ellipse_at_top_right,#7c3aed,transparent_60%)]" />
        <div className="relative flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-14 w-14 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Terminal className="h-7 w-7 text-violet-300" />
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">مركز الهندسة</h2>
                <p className="text-sm font-mono text-violet-300/70">Adala Engineering Center</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mb-6">
              وحدة الهندسة الداخلية الحصرية لمالك المنصة. تحليل ذكي بـ AI، فحص أمني حقيقي، مراقبة الأداء اللحظي، تحليل قاعدة البيانات، إدارة المهام الهندسية، وسجل كامل لكل عملية.
            </p>
            <a href={engUrl}>
              <Button className="gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold">
                <Terminal className="h-4 w-4" />
                فتح مركز الهندسة
                <ArrowRight className="h-4 w-4 mr-1" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Security Layers */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            طبقات الحماية الأمنية (5 طبقات)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {layers.map((l, i) => (
              <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                l.status === "active"   ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" :
                l.status === "planned"  ? "bg-violet-500/10 border-violet-500/20 text-violet-300" :
                                         "bg-amber-500/10 border-amber-500/20 text-amber-300"
              }`}>
                <span className={l.color}>{l.icon}</span>
                <span>{l.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {features.map((f, i) => (
          <Card key={i} className="border-border/50 bg-muted/10 hover:bg-accent transition-colors cursor-pointer" onClick={() => { (window as any).open(engUrl, "_self"); }}>
            <CardContent className="pt-4 pb-3">
              <f.icon className="h-5 w-5 text-violet-400 mb-2" />
              <p className="text-sm font-bold mb-0.5">{f.label}</p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
