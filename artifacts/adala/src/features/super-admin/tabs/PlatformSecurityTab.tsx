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

export function PlatformSecurityTab() {
  const [secTab, setSecTab] = useState<"audit"|"logins">("logins");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["admin", "/audit-logs"],
    queryFn: () => API("/audit-logs"),
    staleTime: 30_000,
  });

  const loginLogs: any[] = data?.loginLogs ?? [];
  const auditLogs: any[] = data?.auditLogs ?? [];
  const loginStats: any[] = data?.loginStats ?? [];

  const successCount = loginStats.find((s: any) => s.status === "success")?.cnt ?? 0;
  const failedCount  = loginStats.find((s: any) => s.status === "failed")?.cnt ?? 0;

  const filteredLogins = loginLogs.filter(l => !search || l.email?.includes(search) || l.full_name?.includes(search) || l.ip_address?.includes(search));
  const filteredAudit  = auditLogs.filter(l => !search || l.user_full_name?.includes(search) || l.action?.includes(search) || l.resource?.includes(search));

  return (
    <div className="space-y-4" dir="rtl">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "إجمالي تسجيلات الدخول", value: loginLogs.length, icon: User, color: "text-blue-400 bg-blue-500/15" },
          { label: "دخول ناجح", value: successCount, icon: CheckCircle2, color: "text-green-400 bg-green-500/15" },
          { label: "دخول فاشل", value: failedCount, icon: XCircle, color: "text-red-400 bg-red-500/15" },
          { label: "سجلات التدقيق", value: auditLogs.length, icon: Shield, color: "text-amber-400 bg-amber-500/15" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2">
        <button onClick={() => setSecTab("logins")} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", secTab==="logins" ? "bg-primary text-black font-bold border-primary" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
          سجل الدخول ({loginLogs.length})
        </button>
        <button onClick={() => setSecTab("audit")} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", secTab==="audit" ? "bg-primary text-black font-bold border-primary" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
          سجل التدقيق ({auditLogs.length})
        </button>
        <div className="mr-auto relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="h-8 w-48 pr-8 pl-3 rounded-lg bg-muted/40 text-xs border border-border/40 focus:outline-none" />
        </div>
      </div>

      {/* Login Logs Table */}
      {secTab === "logins" && (
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-right text-xs">المستخدم</TableHead>
                <TableHead className="text-right text-xs">البريد</TableHead>
                <TableHead className="text-right text-xs">IP</TableHead>
                <TableHead className="text-right text-xs">المتصفح</TableHead>
                <TableHead className="text-right text-xs">الجهاز</TableHead>
                <TableHead className="text-right text-xs">الحالة</TableHead>
                <TableHead className="text-right text-xs">التوقيت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredLogins.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground text-sm">لا توجد سجلات</TableCell></TableRow>
              ) : filteredLogins.slice(0, 50).map((l: any) => (
                <TableRow key={l.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs font-medium">{l.full_name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground" dir="ltr">{l.email ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground" dir="ltr">{l.ip_address ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.browser ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.device_type ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px]", l.status === "success" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                      {l.status === "success" ? "نجح" : "فشل"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-SA")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Audit Logs Table */}
      {secTab === "audit" && (
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-right text-xs">المستخدم</TableHead>
                <TableHead className="text-right text-xs">الإجراء</TableHead>
                <TableHead className="text-right text-xs">المورد</TableHead>
                <TableHead className="text-right text-xs">التفاصيل</TableHead>
                <TableHead className="text-right text-xs">التوقيت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredAudit.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">لا توجد سجلات تدقيق</TableCell></TableRow>
              ) : filteredAudit.slice(0, 50).map((l: any) => (
                <TableRow key={l.id} className="hover:bg-muted/20">
                  <TableCell className="text-xs font-medium">{l.user_full_name ?? "نظام"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{l.action}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.resource}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-48 truncate">{l.details ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar-SA")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM WEBSITE TAB (CMS)
═══════════════════════════════════════════════════ */
const WEBSITE_SECTIONS = [
  { key: "hero",     label: "القسم الرئيسي (Hero)",    icon: Globe2,      fields: ["hero_title", "hero_subtitle", "hero_cta"] },
  { key: "features", label: "المميزات",                  icon: Layers,      fields: ["features_title", "features_subtitle"] },
  { key: "pricing",  label: "الأسعار",                   icon: Banknote,    fields: ["pricing_title", "pricing_subtitle"] },
  { key: "faq",      label: "الأسئلة الشائعة",           icon: HelpCircle,  fields: ["faq_title"] },
  { key: "footer",   label: "التذييل (Footer)",          icon: Newspaper,   fields: ["footer_company_name", "footer_tagline", "footer_email", "footer_phone"] },
  { key: "legal",    label: "الصفحات القانونية",          icon: Shield,      fields: ["terms_title", "privacy_title"] },
];

const FIELD_LABELS: Record<string, string> = {
  hero_title: "العنوان الرئيسي", hero_subtitle: "العنوان الفرعي", hero_cta: "زر الدعوة للعمل",
  features_title: "عنوان المميزات", features_subtitle: "وصف المميزات",
  pricing_title: "عنوان الأسعار", pricing_subtitle: "وصف الأسعار",
  faq_title: "عنوان الأسئلة الشائعة",
  footer_company_name: "اسم الشركة", footer_tagline: "الشعار", footer_email: "البريد الإلكتروني", footer_phone: "رقم الهاتف",
  terms_title: "عنوان شروط الاستخدام", privacy_title: "عنوان سياسة الخصوصية",
};

