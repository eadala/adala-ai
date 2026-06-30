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

export function HomeCmsTab({ toast }: { toast: any }) {
  const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");

  const [form, setForm] = useState<any>({
    hero: {
      badge: "", titleLine1: "", titleLine2: "", titleHighlight: "", subtitle: "",
    },
    trust: { tagline: "" },
    stats: { offices: "", cases: "", satisfaction: "", timeSaving: "" },
    features: { title: "", subtitle: "" },
    cta_section: { title: "", titleHighlight: "", subtitle: "" },
    announcement: { enabled: false, text: "", link: "", bgColor: "#2563EB", textColor: "#0D1626" },
    seo: { metaTitle: "", metaDescription: "", ogImage: "" },
    contact: { whatsapp: "", email: "", twitter: "", linkedin: "", youtube: "", showWhatsappButton: true },
    footer: {
      tagline: "", copyright: "", showStatus: true, statusText: "",
      showPlatformCol: true, showCompanyCol: true, showSupportCol: true,
      platformLinks: [{ label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }],
      companyLinks:  [{ label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }],
      supportLinks:  [{ label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }, { label: "", href: "" }],
    },
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}/api/home/content`)
      .then(r => r.json())
      .then(data => {
        setForm((prev: any) => {
          const merged: any = {};
          for (const section of Object.keys(prev)) {
            merged[section] = { ...prev[section], ...(data[section] || {}) };
          }
          return merged;
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function setField(section: string, key: string, val: any) {
    setForm((prev: any) => ({
      ...prev,
      [section]: { ...prev[section], [key]: val },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`${BASE_URL}/api/home/content`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "تم الحفظ", description: "تم تحديث محتوى الصفحة الرئيسية." });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleReset() {
    if (!confirm("هل تريد إعادة ضبط المحتوى إلى الإعدادات الافتراضية؟")) return;
    setResetting(true);
    try {
      const r = await fetch(`${BASE_URL}/api/home/content/reset`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      /* re-fetch the updated defaults */
      const fresh = await fetch(`${BASE_URL}/api/home/content`).then(x => x.json());
      setForm((prev: any) => {
        const merged: any = {};
        for (const section of Object.keys(prev)) {
          merged[section] = { ...prev[section], ...(fresh[section] || {}) };
        }
        return merged;
      });
      toast({ title: "تم الإعادة", description: "تمت استعادة المحتوى الافتراضي." });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
    setResetting(false);
  }

  const SECTIONS = [
    { id: "hero",         label: "قسم Hero",           icon: "🏠" },
    { id: "trust",        label: "شريط الثقة",          icon: "⭐" },
    { id: "stats",        label: "الإحصائيات",          icon: "📊" },
    { id: "features",     label: "الميزات",             icon: "✨" },
    { id: "cta_section",  label: "دعوة للعمل (CTA)",    icon: "🎯" },
    { id: "announcement", label: "شريط الإعلانات",       icon: "📢" },
    { id: "contact",      label: "التواصل والروابط",     icon: "📞" },
    { id: "seo",          label: "SEO",                  icon: "🔍" },
    { id: "footer",       label: "التذييل (Footer)",      icon: "🦶" },
  ];

  if (!loaded) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">محتوى الصفحة الرئيسية</h2>
          <p className="text-sm text-muted-foreground">تعديل النصوص والمحتوى المعروض على الصفحة الرئيسية مباشرةً</p>
        </div>
        <div className="flex gap-2">
          <a href={`${BASE_URL}/`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1">
              <Globe className="h-3.5 w-3.5" /> معاينة
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting} className="gap-1 text-orange-400 border-orange-400/30 hover:bg-orange-400/10">
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            إعادة الضبط
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary hover:bg-[#1D4ED8] text-black font-bold gap-1">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            حفظ التغييرات
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-6">
        {/* Sidebar nav */}
        <div className="space-y-1">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full text-right px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${activeSection === s.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* Section editor */}
        <Card className="border-border bg-card/50">
          <CardContent className="pt-6 space-y-4">

            {/* ── HERO ── */}
            {activeSection === "hero" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">محتوى قسم Hero (الجزء العلوي من الصفحة)</h3>
                {[
                  { key: "badge",         label: "نص الشارة (Badge)",        placeholder: "✦ النظام القانوني الأكثر ذكاءً" },
                  { key: "titleLine1",    label: "سطر العنوان الأول",         placeholder: "أدر مكتبك القانوني" },
                  { key: "titleLine2",    label: "سطر العنوان الثاني",        placeholder: "بكفاءة لا مثيل لها" },
                  { key: "titleHighlight",label: "السطر المميز (ذهبي)",       placeholder: "بقوة الذكاء الاصطناعي" },
                  { key: "subtitle",      label: "النص الوصفي",               placeholder: "منصة متكاملة..." },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    {f.key === "subtitle" ? (
                      <textarea rows={3} value={form.hero[f.key] || ""} onChange={e => setField("hero", f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#2563EB] resize-none" />
                    ) : (
                      <Input value={form.hero[f.key] || ""} onChange={e => setField("hero", f.key, e.target.value)} placeholder={f.placeholder} className="text-sm" />
                    )}
                  </div>
                ))}
              </>
            )}

            {/* ── TRUST ── */}
            {activeSection === "trust" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">شريط الثقة (النص أعلى الإحصائيات)</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs">عبارة الثقة (Tagline)</Label>
                  <Input value={form.trust.tagline || ""} onChange={e => setField("trust", "tagline", e.target.value)}
                    placeholder="موثوق من مكاتب المحاماة في المنطقة العربية" className="text-sm" />
                </div>
              </>
            )}

            {/* ── STATS ── */}
            {activeSection === "stats" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">الأرقام والإحصائيات (تُعرض كعدّادات متحركة)</h3>
                {[
                  { key: "offices",       label: "عدد المكاتب",        placeholder: "1000" },
                  { key: "cases",         label: "عدد القضايا",         placeholder: "100000" },
                  { key: "satisfaction",  label: "نسبة الرضا",          placeholder: "99" },
                  { key: "timeSaving",    label: "نسبة توفير الوقت %",  placeholder: "40" },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    <Input type="number" value={form.stats[f.key] || ""} onChange={e => setField("stats", f.key, e.target.value)}
                      placeholder={f.placeholder} className="text-sm" />
                  </div>
                ))}
              </>
            )}

            {/* ── FEATURES ── */}
            {activeSection === "features" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">قسم الميزات — العنوان والوصف</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs">العنوان الرئيسي</Label>
                  <Input value={form.features.title || ""} onChange={e => setField("features", "title", e.target.value)}
                    placeholder="كل ما يحتاجه مكتبك القانوني" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">النص الوصفي</Label>
                  <textarea rows={3} value={form.features.subtitle || ""} onChange={e => setField("features", "subtitle", e.target.value)}
                    placeholder="منصة شاملة تجمع إدارة القضايا والعملاء والمستندات..."
                    className="w-full px-3 py-2 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#2563EB] resize-none" />
                </div>
              </>
            )}

            {/* ── CTA ── */}
            {activeSection === "cta_section" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">قسم دعوة للعمل (CTA) — في أسفل الصفحة</h3>
                {[
                  { key: "title",          label: "السطر الأول من العنوان",   placeholder: "ابدأ رحلتك نحو" },
                  { key: "titleHighlight", label: "الجزء المميز (ذهبي)",      placeholder: "مكتب قانوني رقمي" },
                  { key: "subtitle",       label: "النص الوصفي",               placeholder: "جرّب المنصة مجاناً لمدة 30 يوماً..." },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    {f.key === "subtitle" ? (
                      <textarea rows={3} value={form.cta_section[f.key] || ""} onChange={e => setField("cta_section", f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#2563EB] resize-none" />
                    ) : (
                      <Input value={form.cta_section[f.key] || ""} onChange={e => setField("cta_section", f.key, e.target.value)} placeholder={f.placeholder} className="text-sm" />
                    )}
                  </div>
                ))}
              </>
            )}

            {/* ── ANNOUNCEMENT ── */}
            {activeSection === "announcement" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">شريط الإعلانات — يظهر في أعلى الصفحة</h3>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="ann-enabled" checked={!!form.announcement.enabled}
                      onChange={e => setField("announcement", "enabled", e.target.checked)}
                      className="w-4 h-4 rounded accent-[#2563EB]" />
                    <label htmlFor="ann-enabled" className="text-sm font-medium">تفعيل شريط الإعلانات</label>
                  </div>
                  {form.announcement.enabled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">نشط</span>
                  )}
                </div>
                {form.announcement.enabled && (
                  <div className="p-3 rounded-lg border text-sm text-center font-bold"
                    style={{ background: form.announcement.bgColor || "#2563EB", color: form.announcement.textColor || "#0D1626" }}>
                    {form.announcement.text || "معاينة الشريط..."}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">نص الإعلان</Label>
                  <Input value={form.announcement.text || ""} onChange={e => setField("announcement", "text", e.target.value)}
                    placeholder="🎉 خصم 20% لمدة محدودة — سجّل الآن!" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">رابط (اختياري)</Label>
                  <Input value={form.announcement.link || ""} onChange={e => setField("announcement", "link", e.target.value)}
                    placeholder="https://..." className="text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">لون الخلفية</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.announcement.bgColor || "#2563EB"}
                        onChange={e => setField("announcement", "bgColor", e.target.value)}
                        className="w-10 h-8 rounded border border-border cursor-pointer bg-transparent" />
                      <Input value={form.announcement.bgColor || "#2563EB"} onChange={e => setField("announcement", "bgColor", e.target.value)}
                        className="text-sm font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">لون النص</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.announcement.textColor || "#0D1626"}
                        onChange={e => setField("announcement", "textColor", e.target.value)}
                        className="w-10 h-8 rounded border border-border cursor-pointer bg-transparent" />
                      <Input value={form.announcement.textColor || "#0D1626"} onChange={e => setField("announcement", "textColor", e.target.value)}
                        className="text-sm font-mono" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── CONTACT ── */}
            {activeSection === "contact" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">بيانات التواصل — واتساب، البريد الإلكتروني، وروابط السوشيال ميديا</h3>

                {/* WhatsApp */}
                <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#25D366" }}>
                        <Phone className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold text-sm">واتساب</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">إظهار زر الواتساب</label>
                      <input type="checkbox" checked={!!form.contact.showWhatsappButton}
                        onChange={e => setField("contact", "showWhatsappButton", e.target.checked)}
                        className="w-4 h-4 rounded accent-[#25D366]" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">رقم الواتساب (مع رمز الدولة بدون + أو مسافات)</Label>
                    <div className="relative">
                      <Input
                        value={form.contact.whatsapp || ""}
                        onChange={e => setField("contact", "whatsapp", e.target.value)}
                        placeholder="966512345678"
                        className="text-sm ltr pl-16"
                        dir="ltr"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">+</span>
                    </div>
                  </div>
                  {form.contact.whatsapp && (
                    <a
                      href={`https://wa.me/${(form.contact.whatsapp as string).replace(/[^0-9]/g, "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 underline underline-offset-2">
                      <Phone className="h-3 w-3" />
                      معاينة الرابط: wa.me/{(form.contact.whatsapp as string).replace(/[^0-9]/g, "")}
                    </a>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني للتواصل
                  </Label>
                  <Input value={form.contact.email || ""} onChange={e => setField("contact", "email", e.target.value)}
                    placeholder="info@adalah-ai.com" className="text-sm" dir="ltr" />
                </div>

                {/* Social Links */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground">روابط السوشيال ميديا (في الفوتر)</Label>
                  {[
                    { key: "twitter",  label: "تويتر / X",   placeholder: "https://x.com/adalahAI",          color: "#1DA1F2" },
                    { key: "linkedin", label: "لينكدإن",      placeholder: "https://linkedin.com/company/...", color: "#0077B5" },
                    { key: "youtube",  label: "يوتيوب",        placeholder: "https://youtube.com/@...",         color: "#FF0000" },
                  ].map(s => (
                    <div key={s.key} className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.color }} />
                        {s.label}
                      </Label>
                      <Input value={(form.contact as any)[s.key] || ""} onChange={e => setField("contact", s.key, e.target.value)}
                        placeholder={s.placeholder} className="text-sm" dir="ltr" />
                    </div>
                  ))}
                </div>

                {/* Live preview */}
                <div className="p-3 rounded-lg border border-border bg-[#080F1E] flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">معاينة الأيقونات في الفوتر:</span>
                  <div className="flex gap-2">
                    {[
                      { href: form.contact.twitter,  bg: "#1DA1F2" },
                      { href: form.contact.linkedin, bg: "#0077B5" },
                      { href: form.contact.youtube,  bg: "#FF0000" },
                    ].map((s, i) => (
                      <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${s.href ? "opacity-100" : "opacity-25"}`}
                        style={{ background: s.href ? s.bg : "rgba(255,255,255,0.06)" }}>
                        {i === 0 && <Twitter className="w-3.5 h-3.5 text-white" />}
                        {i === 1 && <Linkedin className="w-3.5 h-3.5 text-white" />}
                        {i === 2 && <Youtube className="w-3.5 h-3.5 text-white" />}
                      </div>
                    ))}
                  </div>
                  {form.contact.whatsapp && form.contact.showWhatsappButton && (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#25D366" }}>
                      <Phone className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── SEO ── */}
            {activeSection === "seo" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">إعدادات SEO — للمحركات البحثية ومشاركة الروابط</h3>
                {[
                  { key: "metaTitle",       label: "عنوان الصفحة (Meta Title)",       placeholder: "عدالة AI — نظام إدارة المكاتب القانونية" },
                  { key: "metaDescription", label: "وصف الصفحة (Meta Description)",   placeholder: "منصة متكاملة لإدارة المكاتب القانونية..." },
                  { key: "ogImage",         label: "صورة المشاركة (OG Image URL)",     placeholder: "https://..." },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label}</Label>
                    {f.key === "metaDescription" ? (
                      <textarea rows={3} value={form.seo[f.key] || ""} onChange={e => setField("seo", f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2 text-sm rounded-md border border-border bg-muted/40 focus:outline-none focus:ring-1 focus:ring-[#2563EB] resize-none" />
                    ) : (
                      <Input value={form.seo[f.key] || ""} onChange={e => setField("seo", f.key, e.target.value)} placeholder={f.placeholder} className="text-sm" />
                    )}
                  </div>
                ))}
                {form.seo.metaTitle && (
                  <div className="p-3 rounded-lg bg-muted/30 border border-border">
                    <p className="text-xs text-muted-foreground mb-2">معاينة نتيجة Google:</p>
                    <p className="text-blue-400 text-sm font-medium truncate">{form.seo.metaTitle}</p>
                    <p className="text-green-600 text-xs">{BASE_URL}/</p>
                    {form.seo.metaDescription && <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{form.seo.metaDescription}</p>}
                  </div>
                )}
              </>
            )}

            {/* ── FOOTER ── */}
            {activeSection === "footer" && (
              <>
                <h3 className="font-semibold text-sm text-muted-foreground mb-4">لوحة التحكم في التذييل (Footer)</h3>

                {/* Basic info */}
                <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <p className="text-xs font-bold text-primary">المعلومات الأساسية</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">شعار الشركة (tagline)</Label>
                    <Input value={form.footer.tagline || ""} onChange={e => setField("footer", "tagline", e.target.value)}
                      placeholder="أول نظام تشغيل قانوني متكامل للمكاتب حول العالم" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">نص حقوق النشر (Copyright)</Label>
                    <Input value={form.footer.copyright || ""} onChange={e => setField("footer", "copyright", e.target.value)}
                      placeholder="© ٢٠٢٦ عدالة AI — جميع الحقوق محفوظة" className="text-sm" />
                  </div>
                </div>

                {/* Status badge */}
                <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-primary">بادج حالة الأنظمة</p>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">إظهار</Label>
                      <Switch checked={form.footer.showStatus !== false}
                        onCheckedChange={v => setField("footer", "showStatus", v)} />
                    </div>
                  </div>
                  {form.footer.showStatus !== false && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">نص البادج</Label>
                        <Input value={form.footer.statusText || ""} onChange={e => setField("footer", "statusText", e.target.value)}
                          placeholder="جميع الأنظمة تعمل" className="text-sm" />
                      </div>
                      <div className="px-3 py-1.5 rounded-full text-green-400 text-xs self-start inline-flex"
                        style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                        ● {form.footer.statusText || "جميع الأنظمة تعمل"}
                      </div>
                    </>
                  )}
                </div>

                {/* Column visibility */}
                <div className="p-3 rounded-lg bg-muted/20 border border-border">
                  <p className="text-xs font-bold text-primary mb-3">إظهار أعمدة الروابط</p>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { key: "showPlatformCol", label: "عمود المنصة" },
                      { key: "showCompanyCol",  label: "عمود الشركة" },
                      { key: "showSupportCol",  label: "عمود الدعم"  },
                    ].map(col => (
                      <div key={col.key} className="flex items-center gap-2">
                        <Switch checked={form.footer[col.key] !== false}
                          onCheckedChange={v => setField("footer", col.key, v)} />
                        <Label className="text-xs">{col.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Links editor */}
                {[
                  { key: "platformLinks", label: "روابط المنصة",  count: 4 },
                  { key: "companyLinks",  label: "روابط الشركة",  count: 3 },
                  { key: "supportLinks",  label: "روابط الدعم",    count: 4 },
                ].map(col => (
                  <div key={col.key} className="space-y-2 p-3 rounded-lg bg-muted/20 border border-border">
                    <p className="text-xs font-bold text-primary mb-1">{col.label}</p>
                    <div className="grid grid-cols-2 gap-1 mb-1">
                      <span className="text-xs text-muted-foreground px-1">النص</span>
                      <span className="text-xs text-muted-foreground px-1">الرابط (href)</span>
                    </div>
                    {Array.from({ length: col.count }).map((_, i) => {
                      const links: any[] = form.footer[col.key] || [];
                      const link = links[i] || { label: "", href: "" };
                      const updateLink = (field: string, val: string) => {
                        const updated = [...(form.footer[col.key] || [])];
                        while (updated.length <= i) updated.push({ label: "", href: "" });
                        updated[i] = { ...updated[i], [field]: val };
                        setField("footer", col.key, updated);
                      };
                      return (
                        <div key={i} className="grid grid-cols-2 gap-2">
                          <Input value={link.label || ""} onChange={e => updateLink("label", e.target.value)}
                            placeholder={`رابط ${i + 1}`} className="text-sm h-8" />
                          <Input value={link.href || ""} onChange={e => updateLink("href", e.target.value)}
                            placeholder="#anchor أو /page" className="text-sm h-8 font-mono text-xs" dir="ltr" />
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Live preview */}
                <div className="p-4 rounded-xl border border-border text-xs" style={{ background: "#080F1E" }}>
                  <p className="text-white/40 text-xs mb-3">معاينة الفوتر:</p>
                  <div className="flex gap-6 flex-wrap">
                    {form.footer.showPlatformCol !== false && (
                      <div>
                        <p className="text-white text-xs font-bold mb-2">المنصة</p>
                        {(form.footer.platformLinks || []).filter((l: any) => l.label).map((l: any, i: number) => (
                          <p key={i} className="text-white/40 text-xs mb-1">{l.label}</p>
                        ))}
                      </div>
                    )}
                    {form.footer.showCompanyCol !== false && (
                      <div>
                        <p className="text-white text-xs font-bold mb-2">الشركة</p>
                        {(form.footer.companyLinks || []).filter((l: any) => l.label).map((l: any, i: number) => (
                          <p key={i} className="text-white/40 text-xs mb-1">{l.label}</p>
                        ))}
                      </div>
                    )}
                    {form.footer.showSupportCol !== false && (
                      <div>
                        <p className="text-white text-xs font-bold mb-2">الدعم</p>
                        {(form.footer.supportLinks || []).filter((l: any) => l.label).map((l: any, i: number) => (
                          <p key={i} className="text-white/40 text-xs mb-1">{l.label}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <p className="text-white/30 text-xs">{form.footer.copyright || "© ٢٠٢٦ عدالة AI"}</p>
                    {form.footer.showStatus !== false && (
                      <span className="text-green-400 text-xs">● {form.footer.statusText || "جميع الأنظمة تعمل"}</span>
                    )}
                  </div>
                </div>
              </>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLANS CMS TAB
═══════════════════════════════════════════════════ */
