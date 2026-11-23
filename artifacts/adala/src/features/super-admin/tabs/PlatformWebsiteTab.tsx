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

export function PlatformWebsiteTab({ qc, toast }: any) {
  const [activeSection, setActiveSection] = useState("hero");
  const [localData, setLocalData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: websiteData, isLoading } = useQuery<any>({
    queryKey: ["admin", "/website"],
    queryFn: () => API("/website"),
    staleTime: 60_000,
  });
  useEffect(() => { if (websiteData) setLocalData(websiteData); }, [websiteData]);

  const section = WEBSITE_SECTIONS.find(s => s.key === activeSection)!;

  const save = async () => {
    setSaving(true);
    try {
      await API("/website", { method: "PUT", body: JSON.stringify(localData) });
      qc.invalidateQueries({ queryKey: ["admin", "/website"] });
      toast({ title: "✅ تم حفظ إعدادات الموقع" });
    } catch { toast({ title: "خطأ في الحفظ", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">إدارة محتوى الموقع</h3>
          <p className="text-xs text-muted-foreground mt-0.5">تخصيص محتوى الصفحة الرئيسية للمنصة</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => window.open("/", "_blank")}>
            <Globe className="h-3.5 w-3.5" /> معاينة
          </Button>
          <Button size="sm" className="gap-1.5 text-xs bg-primary hover:bg-[#1D4ED8] text-black font-bold" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} حفظ
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Section selector */}
        <div className="space-y-1.5">
          {WEBSITE_SECTIONS.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-right",
                activeSection===s.key ? "bg-primary/15 text-primary border border-primary/30 font-semibold" : "hover:bg-muted/30 text-muted-foreground")}>
              <s.icon className="h-4 w-4 shrink-0" />
              <span>{s.label}</span>
              <ChevronRight className="h-3.5 w-3.5 mr-auto" />
            </button>
          ))}
        </div>

        {/* Fields editor */}
        <Card className="lg:col-span-3 bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <section.icon className="h-4 w-4 text-primary" />
              {section.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted/30 rounded-lg animate-pulse" />)}</div>
            ) : section.fields.map(field => {
              const wKey = `website_${field}`;
              return (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">{FIELD_LABELS[field] ?? field}</Label>
                  <Textarea
                    value={(localData as Record<string, string>)[wKey] ?? websiteData?.[wKey] ?? ""}
                    onChange={e => setLocalData(prev => ({ ...prev, [wKey]: e.target.value }))}
                    rows={2}
                    className="resize-none text-sm bg-muted/20 border-border/40"
                    placeholder={`أدخل ${FIELD_LABELS[field] ?? field}...`}
                  />
                </div>
              );
            })}

            <div className="pt-2 flex justify-end">
              <Button size="sm" className="gap-1.5 bg-primary hover:bg-[#1D4ED8] text-black font-bold" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ التغييرات
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM SAAS BILLING TAB
═══════════════════════════════════════════════════ */
const PLAN_COLORS_SA: Record<string, string> = {
  advisor:    "#38BDF8",
  solo:       "#2563EB",
  office:     "#34D399",
  advanced:   "#A78BFA",
  corporate:  "#FB923C",
  enterprise: "#94A3B8",
};

