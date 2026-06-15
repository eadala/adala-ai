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

export function MobileAppTab({ qc, toast }: any) {
  const { data: settings = [], isLoading, refetch } = useAdmin<any[]>("/settings");
  const mobileEnabledSetting = (settings as any[]).find((s: any) => s.key === "mobile_app_enabled");
  const isEnabled = mobileEnabledSetting?.value !== "false";

  const toggle = useMutation({
    mutationFn: (val: boolean) =>
      API(`/settings/mobile_app_enabled`, { method: "PUT", body: JSON.stringify({ value: val ? "true" : "false" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/settings"] }); refetch(); toast({ title: isEnabled ? "⛔ تم إيقاف تطبيق الجوال" : "✅ تم تشغيل تطبيق الجوال" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const MOBILE_FEATURES = [
    { icon: "📱", label: "لوحة التحكم", desc: "عرض القضايا والإحصاءات" },
    { icon: "⚖️", label: "القضايا",    desc: "إدارة ومتابعة القضايا" },
    { icon: "👥", label: "العملاء",    desc: "قائمة العملاء وبياناتهم" },
    { icon: "📄", label: "العقود",     desc: "عرض العقود والوثائق" },
    { icon: "🔔", label: "التذكيرات", desc: "التنبيهات والمواعيد" },
  ];

  return (
    <div className="space-y-6">
      {/* Main Toggle Card */}
      <div className={`rounded-2xl border p-6 transition-colors ${isEnabled ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${isEnabled ? "bg-green-500/20" : "bg-red-500/20"}`}>
              📱
            </div>
            <div>
              <h3 className="font-bold text-lg">تطبيق الجوال — عدالة AI Mobile</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isEnabled
                  ? "التطبيق يعمل — المستخدمون يمكنهم الوصول إليه"
                  : "التطبيق موقوف — سيرى المستخدمون شاشة صيانة"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-semibold ${isEnabled ? "text-green-400" : "text-red-400"}`}>
              {isEnabled ? "مفعّل" : "موقوف"}
            </span>
            <button
              onClick={() => toggle.mutate(!isEnabled)}
              disabled={toggle.isPending || isLoading}
              className="focus:outline-none"
              title={isEnabled ? "إيقاف التطبيق" : "تشغيل التطبيق"}
            >
              {isEnabled
                ? <ToggleRight className="h-10 w-10 text-green-400 hover:text-green-300 transition-colors cursor-pointer" />
                : <ToggleLeft className="h-10 w-10 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer" />
              }
            </button>
          </div>
        </div>

        {!isEnabled && (
          <div className="mt-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">
            <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
            عند فتح التطبيق سيرى المستخدمون رسالة "التطبيق تحت الصيانة" ولن يتمكنوا من تسجيل الدخول.
          </div>
        )}
      </div>

      {/* Mobile Features Overview */}
      <div>
        <h4 className="text-sm font-bold mb-3 text-muted-foreground">ميزات التطبيق المتاحة</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {MOBILE_FEATURES.map((f) => (
            <div key={f.label} className={`rounded-xl border p-3 flex items-center gap-3 ${isEnabled ? "border-border/50 bg-card" : "border-border/30 bg-muted/10 opacity-60"}`}>
              <span className="text-xl">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-[10px] text-muted-foreground">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Link to mobile app */}
      <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">رابط التطبيق</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono" dir="ltr">
            {window.location.origin}/adala-mobile/
          </p>
        </div>
        <Button
          size="sm" variant="outline" className="gap-1.5"
          onClick={() => window.open(`${window.location.origin}/adala-mobile/`, "_blank")}
        >
          <Smartphone className="h-3.5 w-3.5" />
          فتح التطبيق
        </Button>
      </div>

      {/* Info box */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-primary">كيف يعمل التحكم؟</span>
        </div>
        <ul className="text-xs text-muted-foreground space-y-1 pr-6 list-disc">
          <li>عند الإيقاف: التطبيق يعرض شاشة صيانة ويمنع الوصول للبيانات</li>
          <li>عند التشغيل: المستخدمون يصلون لجميع ميزات التطبيق بشكل طبيعي</li>
          <li>التغيير فوري — لا يحتاج إعادة تشغيل أو نشر جديد</li>
          <li>الإعداد محفوظ في جدول <code className="bg-muted px-1 rounded text-[10px]">platform_settings</code> بالمفتاح <code className="bg-muted px-1 rounded text-[10px]">mobile_app_enabled</code></li>
        </ul>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AI CREDITS TAB
═══════════════════════════════════════════════════ */
const MODEL_COSTS: Record<string, number> = { gemini: 1, claude: 3, openai: 3, fallback: 0 };

