import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layout, Palette, Layers, Sparkles, FileText, Settings2,
  Eye, Save, Plus, Trash2, Edit3, CheckCircle2, Loader2,
  Globe, ToggleLeft, ToggleRight, ChevronUp, ChevronDown,
  Wand2, RefreshCw, ExternalLink, Image, BarChart2,
  Search, Tag, Monitor, Smartphone, Zap, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Types ───────────────────────────────────────────────────────── */
interface SectionConfig { visible: boolean; order: number; }
interface WebsiteConfig {
  templateId?: string;
  sections?: Record<string, SectionConfig>;
  colors?: { primary?: string; accent?: string; background?: string; };
  fonts?: { heading?: string; body?: string; };
  seo?: { metaTitle?: string; metaDescription?: string; keywords?: string; gaId?: string; ogImage?: string; };
  aiContent?: { heroTitle?: string; heroSubtitle?: string; about?: string; faqItems?: Array<{ q: string; a: string; }>; };
}

/* ── Constants ───────────────────────────────────────────────────── */
const TEMPLATES = [
  {
    id: "default",
    name: "Modern Legal",
    nameAr: "موضة عصرية",
    desc: "تصميم أبيض نظيف ومساحة بيضاء واسعة — أناقة بساطة",
    colors: ["#FAFAFA", "#111827", "#6B7280"],
    preview: "bg-gray-50",
  },
  {
    id: "lux-legal",
    name: "Lux Legal",
    nameAr: "فاخر كلاسيك",
    desc: "خلفية داكنة وتفاصيل ذهبية — مكاتب المحاماة الراقية",
    colors: ["#0A0A0F", "#C9A84C", "#E2D9C8"],
    preview: "bg-gray-900",
  },
  {
    id: "corporate",
    name: "Corporate Legal",
    nameAr: "كوربوريت احترافي",
    desc: "أبيض ونيفي نظيف — مناسب للشركات والمؤسسات الكبرى",
    colors: ["#FFFFFF", "#1B2B5B", "#2563EB"],
    preview: "bg-white",
  },
  {
    id: "ai-legal",
    name: "AI Legal",
    nameAr: "تقني مستقبلي",
    desc: "داكن مع لمسات زرقاء — مكاتب تواكب الذكاء الاصطناعي",
    colors: ["#070B18", "#3B82F6", "#60A5FA"],
    preview: "bg-slate-950",
  },
];

const DEFAULT_SECTIONS: Record<string, { label: string; defaultVisible: boolean }> = {
  hero:         { label: "الهيرو / الغلاف الرئيسي", defaultVisible: true  },
  stats:        { label: "الإحصائيات والأرقام",     defaultVisible: true  },
  services:     { label: "الخدمات القانونية",        defaultVisible: true  },
  team:         { label: "فريق المحامين",            defaultVisible: true  },
  reviews:      { label: "تقييمات العملاء",          defaultVisible: true  },
  articles:     { label: "المقالات والأخبار",        defaultVisible: false },
  faq:          { label: "الأسئلة الشائعة",          defaultVisible: false },
  contact:      { label: "تواصل معنا",               defaultVisible: true  },
};

const LEGAL_PAGE_TYPES = [
  { id: "commercial",    label: "قانون تجاري", icon: "🏢" },
  { id: "labor",         label: "قانون العمل", icon: "👷" },
  { id: "real_estate",   label: "قانون عقاري", icon: "🏗️" },
  { id: "family",        label: "أحوال شخصية", icon: "👨‍👩‍👧" },
  { id: "criminal",      label: "جنائي",        icon: "⚖️" },
  { id: "administrative",label: "إداري",        icon: "🏛️" },
  { id: "intellectual",  label: "ملكية فكرية", icon: "💡" },
  { id: "banking",       label: "قانون مالي",   icon: "🏦" },
];

const ARABIC_FONTS = [
  "Cairo", "Tajawal", "Almarai", "Noto Kufi Arabic",
  "Readex Pro", "IBM Plex Sans Arabic", "Noto Naskh Arabic", "Amiri",
];

/* ── Helpers ─────────────────────────────────────────────────────── */
function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); });
}

/* ── TemplateCard ────────────────────────────────────────────────── */
function TemplateCard({ t, selected, onSelect }: { t: typeof TEMPLATES[0]; selected: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative cursor-pointer rounded-2xl border-2 overflow-hidden transition-all group",
        selected ? "border-blue-500 shadow-lg shadow-blue-100" : "border-gray-200 hover:border-gray-300"
      )}
    >
      {/* Mini preview */}
      <div className={cn("h-40 relative overflow-hidden", t.preview)}>
        {/* Fake nav */}
        <div className="absolute top-3 inset-x-4 h-4 rounded-md opacity-50"
          style={{ background: t.colors[1] + "40" }} />
        {/* Fake hero text */}
        <div className="absolute top-10 right-4 space-y-1.5">
          <div className="h-2 w-20 rounded-full" style={{ background: t.colors[1] + "80" }} />
          <div className="h-1.5 w-28 rounded-full" style={{ background: t.colors[2] + "60" }} />
        </div>
        {/* Color swatches */}
        <div className="absolute bottom-3 right-4 flex gap-1.5">
          {t.colors.map((c, i) => (
            <div key={i} className="h-4 w-4 rounded-full border border-white/30" style={{ background: c }} />
          ))}
        </div>
        {selected && (
          <div className="absolute top-2 left-2 h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-black text-sm text-gray-900">{t.nameAr}</h3>
          <span className="text-[10px] text-gray-400 font-mono">{t.name}</span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{t.desc}</p>
        <button
          onClick={onSelect}
          className={cn(
            "mt-3 w-full py-2 rounded-xl text-xs font-bold transition-all",
            selected
              ? "bg-blue-500 text-white"
              : "bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600"
          )}
        >
          {selected ? "✓ القالب المفعّل" : "تفعيل هذا القالب"}
        </button>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function WebsiteBuilderPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("templates");
  const [config, setConfig] = useState<WebsiteConfig>({});
  const [configLoaded, setConfigLoaded] = useState(false);
  const [aiForm, setAiForm] = useState({ officeName: "", specializations: [] as string[], city: "", teamSize: "5-10" });
  const [generating, setGenerating] = useState(false);
  const [newPage, setNewPage] = useState<any>(null);
  const [editPage, setEditPage] = useState<any>(null);
  const [generatingPage, setGeneratingPage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* ── Data Fetching ─────────────────────────────────────────────── */
  const { data: rawConfig, isLoading: loadingConfig } = useQuery<any>({
    queryKey: ["website-builder-config"],
    queryFn: () => apiFetch("/website-builder/config"),
    onSuccess: (d: any) => {
      if (!configLoaded) {
        setConfig(d.website_config ?? {});
        setConfigLoaded(true);
      }
    },
  } as any);

  const { data: officeData } = useQuery<any>({
    queryKey: ["office-my"],
    queryFn: () => apiFetch("/office/my"),
  });

  const { data: pages = [], refetch: refetchPages } = useQuery<any[]>({
    queryKey: ["website-builder-pages"],
    queryFn: () => apiFetch("/website-builder/pages"),
  });

  /* ── Mutations ─────────────────────────────────────────────────── */
  const saveMut = useMutation({
    mutationFn: (cfg: WebsiteConfig) => apiFetch("/website-builder/config", { method: "PATCH", body: JSON.stringify(cfg) }),
    onSuccess: () => {
      toast({ title: "✅ تم الحفظ", description: "تم حفظ إعدادات الموقع بنجاح" });
      qc.invalidateQueries({ queryKey: ["website-builder-config"] });
    },
    onError: () => toast({ title: "خطأ", description: "فشل الحفظ", variant: "destructive" }),
  });

  const savePageMut = useMutation({
    mutationFn: (data: any) => apiFetch("/website-builder/pages", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { toast({ title: "✅ تم حفظ الصفحة" }); refetchPages(); setNewPage(null); setEditPage(null); },
    onError: () => toast({ title: "خطأ في الحفظ", variant: "destructive" }),
  });

  const deletePageMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/website-builder/pages/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "تم الحذف" }); refetchPages(); },
  });

  const togglePageMut = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      apiFetch(`/website-builder/pages/${id}`, { method: "PATCH", body: JSON.stringify({ isPublished }) }),
    onSuccess: () => refetchPages(),
  });

  /* ── Helpers ───────────────────────────────────────────────────── */
  const save = useCallback((partial: Partial<WebsiteConfig> = {}) => {
    const merged = { ...config, ...partial };
    setConfig(merged);
    saveMut.mutate(merged);
  }, [config, saveMut]);

  const updateConfig = (partial: Partial<WebsiteConfig>) => setConfig(c => ({ ...c, ...partial }));

  const getSections = (): Record<string, SectionConfig> => {
    const saved = config.sections ?? {};
    const result: Record<string, SectionConfig> = {};
    let order = 1;
    Object.entries(DEFAULT_SECTIONS).forEach(([key, def]) => {
      result[key] = saved[key] ?? { visible: def.defaultVisible, order: order++ };
    });
    return result;
  };

  const reorderSection = (key: string, dir: "up" | "down") => {
    const sections = getSections();
    const sorted = Object.entries(sections).sort((a, b) => a[1].order - b[1].order);
    const idx = sorted.findIndex(([k]) => k === key);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === sorted.length - 1) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    const tempOrder = sorted[idx][1].order;
    sorted[idx][1].order = sorted[swapIdx][1].order;
    sorted[swapIdx][1].order = tempOrder;
    const newSections: Record<string, SectionConfig> = {};
    sorted.forEach(([k, v]) => { newSections[k] = v; });
    updateConfig({ sections: newSections });
  };

  const toggleSection = (key: string) => {
    const sections = getSections();
    sections[key] = { ...sections[key], visible: !sections[key].visible };
    updateConfig({ sections });
  };

  /* ── AI Generate ───────────────────────────────────────────────── */
  const generateAI = async () => {
    setGenerating(true);
    try {
      const r = await apiFetch("/website-builder/ai-generate", {
        method: "POST",
        body: JSON.stringify(aiForm),
      });
      if (r.content) {
        const newConfig = {
          ...config,
          aiContent: { ...r.content, faqItems: r.content.faqItems ?? [] },
          seo: {
            ...config.seo,
            metaTitle: r.content.metaTitle,
            metaDescription: r.content.metaDescription,
            keywords: r.content.keywords,
          },
        };
        setConfig(newConfig);
        toast({ title: "✨ تم توليد المحتوى", description: "راجعه واحفظه عند الجاهزية" });
      }
    } catch {
      toast({ title: "خطأ في التوليد", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  /* ── Generate Legal Page ───────────────────────────────────────── */
  const generateLegalPage = async (pageType: string) => {
    setGeneratingPage(pageType);
    try {
      const r = await apiFetch("/website-builder/ai-legal-page", {
        method: "POST",
        body: JSON.stringify({ officeName: officeData?.office?.name, pageType, city: officeData?.office?.city }),
      });
      if (r.content) {
        setNewPage({ ...r.content, slug: pageType.replace("_", "-"), pageType });
      }
    } catch {
      toast({ title: "خطأ في التوليد", variant: "destructive" });
    } finally {
      setGeneratingPage(null);
    }
  };

  /* ── Office URL ─────────────────────────────────────────────────── */
  const officeSlug = officeData?.office?.slug;
  const officeUrl = officeSlug ? `/firms/${officeSlug}` : null;

  const copyUrl = () => {
    if (officeUrl) {
      navigator.clipboard.writeText(window.location.origin + officeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /* ── Sections sorted ──────────────────────────────────────────── */
  const sections = getSections();
  const sortedSections = Object.entries(sections).sort((a, b) => a[1].order - b[1].order);

  const TABS = [
    { id: "templates",  label: "القوالب",           icon: Layout },
    { id: "customize",  label: "التخصيص",           icon: Palette },
    { id: "sections",   label: "الأقسام",            icon: Layers },
    { id: "ai",         label: "الذكاء الاصطناعي",  icon: Sparkles },
    { id: "pages",      label: "الصفحات القانونية",  icon: FileText },
    { id: "seo",        label: "الإعدادات والـ SEO", icon: Settings2 },
  ];

  const selectedTemplateId = config.templateId ?? "default";

  return (
    <div className="min-h-screen bg-gray-50 pb-16" dir="rtl">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-lg text-gray-900">منشئ المواقع</h1>
              <p className="text-xs text-gray-400">صمّم موقع مكتبك القانوني باحترافية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {officeUrl && (
              <>
                <button onClick={copyUrl} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "تم النسخ" : "نسخ الرابط"}
                </button>
                <a href={officeUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                    <Eye className="h-3.5 w-3.5" /> معاينة الموقع
                  </Button>
                </a>
              </>
            )}
            <Button size="sm" onClick={() => save()} disabled={saveMut.isPending} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs">
              {saveMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              حفظ التغييرات
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1 pb-0 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── TAB 1: TEMPLATES ─────────────────────────────────────── */}
        {activeTab === "templates" && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-black text-gray-900 mb-1">اختر قالب موقعك</h2>
              <p className="text-gray-500 text-sm">كل قالب يمثل شخصية مختلفة لمكتبك — يمكنك التبديل بينها في أي وقت</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {TEMPLATES.map(t => (
                <TemplateCard
                  key={t.id}
                  t={t}
                  selected={selectedTemplateId === t.id}
                  onSelect={() => {
                    updateConfig({ templateId: t.id });
                    toast({ title: `✅ تم اختيار قالب "${t.nameAr}"`, description: "اضغط حفظ لتطبيق التغيير على موقعك" });
                  }}
                />
              ))}
            </div>

            {/* Preview tip */}
            <div className="mt-8 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
              <Eye className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-700">نصيحة: جرّب المعاينة الحية</p>
                <p className="text-xs text-blue-600 mt-1">بعد اختيار القالب وحفظه، اضغط "معاينة الموقع" لترى النتيجة الفعلية كما يراها عملاؤك</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: CUSTOMIZE ─────────────────────────────────────── */}
        {activeTab === "customize" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-6">تخصيص الألوان والخطوط</h2>

              {/* Colors */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
                <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-blue-500" /> الألوان
                </h3>
                <div className="space-y-4">
                  {[
                    { key: "primary", label: "اللون الرئيسي", desc: "يُستخدم للأزرار والروابط والتمييز" },
                    { key: "accent", label: "اللون الثانوي", desc: "لون التكملة والعناصر الثانوية" },
                    { key: "background", label: "لون الخلفية", desc: "خلفية الموقع العامة" },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center gap-4">
                      <input
                        type="color"
                        value={(config.colors as any)?.[key] ?? "#1A56DB"}
                        onChange={e => updateConfig({ colors: { ...config.colors, [key]: e.target.value } })}
                        className="h-10 w-10 rounded-lg cursor-pointer border border-gray-200"
                      />
                      <div className="flex-1">
                        <label className="text-sm font-semibold text-gray-700">{label}</label>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                      <span className="text-xs font-mono text-gray-400">{(config.colors as any)?.[key] ?? "#1A56DB"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fonts */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-bold text-sm text-gray-700 mb-4 flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-purple-500" /> الخطوط العربية
                </h3>
                <div className="space-y-4">
                  {[
                    { key: "heading", label: "خط العناوين" },
                    { key: "body", label: "خط النص العادي" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <Label className="text-xs text-gray-500 mb-2 block">{label}</Label>
                      <div className="flex flex-wrap gap-2">
                        {ARABIC_FONTS.map(f => (
                          <button
                            key={f}
                            onClick={() => updateConfig({ fonts: { ...config.fonts, [key]: f } })}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs border transition-all",
                              (config.fonts as any)?.[key] === f
                                ? "border-blue-500 bg-blue-50 text-blue-700 font-bold"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                            )}
                            style={{ fontFamily: f }}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Live preview card */}
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-4">معاينة سريعة</h3>
              <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                <div className="h-8 flex items-center gap-1.5 px-3" style={{ background: config.colors?.primary ?? "#1A56DB" }}>
                  {[1,2,3].map(i => <div key={i} className="h-2.5 w-2.5 rounded-full bg-white/30" />)}
                  <div className="flex-1 mx-2 h-3 rounded-full bg-white/20" />
                </div>
                <div className="p-6 text-center" style={{
                  background: config.colors?.background ?? "#FFFFFF",
                  fontFamily: config.fonts?.body ?? "Cairo",
                }}>
                  <div className="h-16 w-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-black text-white"
                    style={{ background: config.colors?.primary ?? "#1A56DB" }}>م</div>
                  <h2 className="text-xl font-black mb-2" style={{ color: config.colors?.primary ?? "#1A56DB", fontFamily: config.fonts?.heading ?? "Cairo" }}>
                    {officeData?.office?.name ?? "مكتب المحاماة"}
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">{officeData?.office?.tagline ?? "خدمات قانونية متميزة"}</p>
                  <button className="px-6 py-2 rounded-xl text-sm font-bold text-white"
                    style={{ background: config.colors?.primary ?? "#1A56DB" }}>
                    احجز استشارة
                  </button>
                </div>
              </div>

              {officeUrl && (
                <a href={officeUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 p-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">
                  <ExternalLink className="h-4 w-4" /> فتح الموقع الحقيقي في تبويب جديد
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: SECTIONS ──────────────────────────────────────── */}
        {activeTab === "sections" && (
          <div className="max-w-2xl">
            <h2 className="text-xl font-black text-gray-900 mb-2">إدارة أقسام الموقع</h2>
            <p className="text-gray-500 text-sm mb-6">رتّب الأقسام وأخفِ ما لا تحتاجه — التغييرات تنعكس فوراً على موقعك</p>

            <div className="space-y-2">
              {sortedSections.map(([key, sec], idx) => {
                const def = DEFAULT_SECTIONS[key];
                return (
                  <div key={key} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => reorderSection(key, "up")} disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20">
                        <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                      <button onClick={() => reorderSection(key, "down")} disabled={idx === sortedSections.length - 1}
                        className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20">
                        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    </div>
                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-sm font-black text-blue-400 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{def?.label ?? key}</p>
                      <p className="text-xs text-gray-400">{sec.visible ? "مرئي على الموقع" : "مخفي"}</p>
                    </div>
                    <Switch
                      checked={sec.visible}
                      onCheckedChange={() => toggleSection(key)}
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => save()} disabled={saveMut.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ ترتيب الأقسام
              </Button>
            </div>
          </div>
        )}

        {/* ── TAB 4: AI ─────────────────────────────────────────────── */}
        {activeTab === "ai" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-2">توليد المحتوى بالذكاء الاصطناعي</h2>
              <p className="text-gray-500 text-sm mb-6">أدخل معلومات مكتبك وسيكتب الذكاء الاصطناعي لك محتوى تسويقياً احترافياً</p>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                <div>
                  <Label className="text-xs font-bold text-gray-600 mb-1.5 block">اسم المكتب</Label>
                  <Input value={aiForm.officeName} onChange={e => setAiForm(f => ({ ...f, officeName: e.target.value }))}
                    placeholder={officeData?.office?.name ?? "مثال: مكتب الشمراني للمحاماة"} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-600 mb-1.5 block">التخصصات القانونية</Label>
                  <div className="flex flex-wrap gap-2">
                    {["تجاري", "عمالي", "عقاري", "أحوال شخصية", "جنائي", "إداري", "تحكيم", "ملكية فكرية"].map(s => (
                      <button key={s} onClick={() => setAiForm(f => ({
                        ...f,
                        specializations: f.specializations.includes(s)
                          ? f.specializations.filter(x => x !== s)
                          : [...f.specializations, s],
                      }))}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-bold border transition-all",
                          aiForm.specializations.includes(s)
                            ? "bg-blue-500 text-white border-blue-500"
                            : "border-gray-200 text-gray-600 hover:border-blue-200"
                        )}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mobile-single-col">
                  <div>
                    <Label className="text-xs font-bold text-gray-600 mb-1.5 block">المدينة</Label>
                    <Input value={aiForm.city} onChange={e => setAiForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="مثال: الرياض" className="text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-gray-600 mb-1.5 block">حجم الفريق</Label>
                    <select value={aiForm.teamSize} onChange={e => setAiForm(f => ({ ...f, teamSize: e.target.value }))}
                      className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white">
                      {["1-2", "3-5", "5-10", "10-20", "20+"].map(s => <option key={s} value={s}>{s} محامين</option>)}
                    </select>
                  </div>
                </div>

                <Button onClick={generateAI} disabled={generating} className="w-full bg-gradient-to-l from-purple-600 to-blue-600 text-white gap-2">
                  {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري التوليد...</> : <><Sparkles className="h-4 w-4" /> توليد المحتوى بالذكاء الاصطناعي</>}
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-sm text-gray-700 mb-4">المحتوى المولّد</h3>
              {config.aiContent ? (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <label className="text-xs font-bold text-gray-400 mb-1 block">العنوان الرئيسي</label>
                    <Input value={config.aiContent.heroTitle ?? ""} onChange={e => updateConfig({ aiContent: { ...config.aiContent, heroTitle: e.target.value } })} />
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <label className="text-xs font-bold text-gray-400 mb-1 block">العنوان الفرعي</label>
                    <Input value={config.aiContent.heroSubtitle ?? ""} onChange={e => updateConfig({ aiContent: { ...config.aiContent, heroSubtitle: e.target.value } })} />
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <label className="text-xs font-bold text-gray-400 mb-1 block">نص عن المكتب</label>
                    <Textarea value={config.aiContent.about ?? ""} rows={4}
                      onChange={e => updateConfig({ aiContent: { ...config.aiContent, about: e.target.value } })} className="resize-none text-sm" />
                  </div>
                  {config.aiContent.faqItems && config.aiContent.faqItems.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <label className="text-xs font-bold text-gray-400 mb-3 block">الأسئلة الشائعة المولّدة</label>
                      <div className="space-y-3">
                        {config.aiContent.faqItems.map((item, i) => (
                          <div key={i} className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs font-bold text-gray-700 mb-1">س: {item.q}</p>
                            <p className="text-xs text-gray-500">ج: {item.a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button onClick={() => save()} className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    <Save className="h-4 w-4" /> حفظ المحتوى المولّد
                  </Button>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                  <Wand2 className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">أدخل معلومات مكتبك واضغط "توليد" لتظهر النتائج هنا</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 5: LEGAL PAGES ───────────────────────────────────── */}
        {activeTab === "pages" && (
          <div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-black text-gray-900 mb-1">الصفحات القانونية المتخصصة</h2>
                <p className="text-gray-500 text-sm">أنشئ صفحات SEO مخصصة لكل تخصص قانوني في مكتبك</p>
              </div>
              <Button onClick={() => setNewPage({ titleAr: "", contentAr: "", slug: "", pageType: "custom" })}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4" /> صفحة جديدة
              </Button>
            </div>

            {/* Generate from templates */}
            <div className="mb-8">
              <h3 className="font-bold text-sm text-gray-700 mb-3">توليد صفحة بالذكاء الاصطناعي</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {LEGAL_PAGE_TYPES.map(pt => (
                  <button key={pt.id} onClick={() => generateLegalPage(pt.id)} disabled={generatingPage === pt.id}
                    className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-right group">
                    <span className="text-2xl">{pt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 group-hover:text-blue-600">{pt.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {generatingPage === pt.id ? "جاري التوليد..." : "توليد بالذكاء الاصطناعي"}
                      </p>
                    </div>
                    {generatingPage === pt.id
                      ? <Loader2 className="h-4 w-4 animate-spin text-blue-400 shrink-0" />
                      : <Sparkles className="h-4 w-4 text-gray-300 group-hover:text-blue-400 shrink-0 transition-colors" />
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* Existing pages */}
            {pages.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-gray-700">الصفحات المنشأة ({pages.length})</h3>
                {pages.map((page: any) => (
                  <div key={page.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200">
                    <FileText className="h-5 w-5 text-blue-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-900">{page.title_ar ?? page.slug}</p>
                      <p className="text-xs text-gray-400">/{page.slug}</p>
                    </div>
                    <Badge variant={page.is_published ? "default" : "secondary"} className="shrink-0">
                      {page.is_published ? "منشور" : "مسودة"}
                    </Badge>
                    <Switch
                      checked={!!page.is_published}
                      onCheckedChange={v => togglePageMut.mutate({ id: page.id, isPublished: v })}
                    />
                    <button onClick={() => setEditPage(page)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                      <Edit3 className="h-4 w-4 text-gray-400" />
                    </button>
                    <button onClick={() => deletePageMut.mutate(page.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center">
                <FileText className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">لا توجد صفحات بعد — استخدم التوليد الذكي لإنشاء أولى صفحاتك</p>
              </div>
            )}

            {/* New/Edit page modal */}
            {(newPage || editPage) && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
                  <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-black text-lg">{newPage ? "صفحة قانونية جديدة" : "تعديل الصفحة"}</h3>
                    <button onClick={() => { setNewPage(null); setEditPage(null); }} className="p-2 rounded-lg hover:bg-gray-100">✕</button>
                  </div>
                  <div className="p-6 space-y-4">
                    <PageForm
                      data={newPage ?? editPage}
                      onChange={d => newPage ? setNewPage(d) : setEditPage(d)}
                    />
                    <div className="flex gap-3 pt-2">
                      <Button onClick={() => savePageMut.mutate(newPage ?? editPage)} disabled={savePageMut.isPending}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        {savePageMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        حفظ الصفحة
                      </Button>
                      <Button variant="outline" onClick={() => { setNewPage(null); setEditPage(null); }}>إلغاء</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 6: SEO & SETTINGS ────────────────────────────────── */}
        {activeTab === "seo" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-6">الإعدادات والـ SEO</h2>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 mb-5">
                <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                  <Search className="h-4 w-4 text-green-500" /> تحسين محركات البحث (SEO)
                </h3>
                <div>
                  <Label className="text-xs font-bold text-gray-600 mb-1.5 block">عنوان الصفحة (Meta Title)</Label>
                  <Input value={config.seo?.metaTitle ?? ""} placeholder="مكتب X للمحاماة — خدمات قانونية في الرياض"
                    onChange={e => updateConfig({ seo: { ...config.seo, metaTitle: e.target.value } })} className="text-sm" />
                  <p className="text-xs text-gray-400 mt-1">{(config.seo?.metaTitle ?? "").length}/60 حرف</p>
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-600 mb-1.5 block">وصف الصفحة (Meta Description)</Label>
                  <Textarea value={config.seo?.metaDescription ?? ""} rows={3}
                    placeholder="مكتب محاماة متخصص في القانون التجاري والعمالي، نقدم استشارات قانونية احترافية..."
                    onChange={e => updateConfig({ seo: { ...config.seo, metaDescription: e.target.value } })}
                    className="resize-none text-sm" />
                  <p className="text-xs text-gray-400 mt-1">{(config.seo?.metaDescription ?? "").length}/155 حرف</p>
                </div>
                <div>
                  <Label className="text-xs font-bold text-gray-600 mb-1.5 block">الكلمات المفتاحية</Label>
                  <Input value={config.seo?.keywords ?? ""} placeholder="محاماة، استشارات قانونية، محامي الرياض..."
                    onChange={e => updateConfig({ seo: { ...config.seo, keywords: e.target.value } })} className="text-sm" />
                  <p className="text-xs text-gray-400 mt-1">مفصولة بفاصلة</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 mb-5">
                <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-orange-500" /> تحليلات جوجل
                </h3>
                <div>
                  <Label className="text-xs font-bold text-gray-600 mb-1.5 block">Google Analytics ID</Label>
                  <Input value={config.seo?.gaId ?? ""} placeholder="G-XXXXXXXXXX"
                    onChange={e => updateConfig({ seo: { ...config.seo, gaId: e.target.value } })} className="text-sm font-mono" />
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
                <h3 className="font-bold text-sm text-gray-700 flex items-center gap-2">
                  <Image className="h-4 w-4 text-blue-500" /> الـ Open Graph
                </h3>
                <div>
                  <Label className="text-xs font-bold text-gray-600 mb-1.5 block">صورة المشاركة (OG Image)</Label>
                  <Input value={config.seo?.ogImage ?? ""} placeholder="https://..."
                    onChange={e => updateConfig({ seo: { ...config.seo, ogImage: e.target.value } })} className="text-sm" />
                  <p className="text-xs text-gray-400 mt-1">الصورة التي تظهر عند مشاركة الموقع على منصات التواصل — 1200×630px</p>
                </div>
              </div>
            </div>

            <div>
              {/* SEO Score */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
                <h3 className="font-bold text-sm text-gray-700 mb-4">نقاط SEO</h3>
                {(() => {
                  const score = [
                    !!config.seo?.metaTitle,
                    !!config.seo?.metaDescription,
                    !!config.seo?.keywords,
                    !!officeData?.office?.logo,
                    !!officeData?.office?.description,
                    (officeData?.services ?? []).length > 0,
                    (officeData?.reviews ?? []).length > 0,
                    !!config.seo?.gaId,
                  ].filter(Boolean).length;
                  const pct = Math.round((score / 8) * 100);
                  const color = pct >= 75 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";
                  return (
                    <>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-black border-4 shrink-0"
                          style={{ borderColor: color, color }}>
                          {pct}
                        </div>
                        <div>
                          <p className="font-bold text-sm" style={{ color }}>{pct >= 75 ? "ممتاز" : pct >= 50 ? "جيد" : "يحتاج تحسين"}</p>
                          <p className="text-xs text-gray-400">من أصل 8 نقاط</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { ok: !!config.seo?.metaTitle, label: "عنوان الصفحة (Meta Title)" },
                          { ok: !!config.seo?.metaDescription, label: "وصف الصفحة" },
                          { ok: !!config.seo?.keywords, label: "كلمات مفتاحية" },
                          { ok: !!officeData?.office?.logo, label: "شعار المكتب" },
                          { ok: !!officeData?.office?.description, label: "وصف المكتب" },
                          { ok: (officeData?.services ?? []).length > 0, label: "خدمات مضافة" },
                          { ok: (officeData?.reviews ?? []).length > 0, label: "تقييمات عملاء" },
                          { ok: !!config.seo?.gaId, label: "Google Analytics" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-2.5 text-xs">
                            <div className={cn("h-4 w-4 rounded-full flex items-center justify-center shrink-0",
                              item.ok ? "bg-green-100" : "bg-gray-100")}>
                              {item.ok ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />}
                            </div>
                            <span className={item.ok ? "text-gray-700" : "text-gray-400"}>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Quick links */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="font-bold text-sm text-gray-700 mb-4">إعدادات متقدمة</h3>
                <div className="space-y-2">
                  <a href="/office-management" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900">إدارة النطاق والـ Domain</span>
                    <ExternalLink className="h-3.5 w-3.5 text-gray-300 mr-auto" />
                  </a>
                  <a href="/office-management" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                    <Palette className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900">رفع الشعار والـ Favicon</span>
                    <ExternalLink className="h-3.5 w-3.5 text-gray-300 mr-auto" />
                  </a>
                  <a href="/theme-builder" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                    <Zap className="h-4 w-4 text-amber-400" />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900">منشئ الثيم المتقدم</span>
                    <ExternalLink className="h-3.5 w-3.5 text-gray-300 mr-auto" />
                  </a>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 flex justify-end">
              <Button onClick={() => save()} disabled={saveMut.isPending} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-8">
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ جميع الإعدادات
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PageForm ─────────────────────────────────────────────────────── */
function PageForm({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-bold text-gray-600 mb-1.5 block">عنوان الصفحة (عربي)</Label>
        <Input value={data.titleAr ?? ""} onChange={e => onChange({ ...data, titleAr: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs font-bold text-gray-600 mb-1.5 block">رابط الصفحة (Slug)</Label>
        <Input value={data.slug ?? ""} onChange={e => onChange({ ...data, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
          placeholder="commercial-law" className="font-mono text-sm" dir="ltr" />
      </div>
      <div>
        <Label className="text-xs font-bold text-gray-600 mb-1.5 block">المحتوى (يدعم HTML بسيط)</Label>
        <Textarea value={data.contentAr ?? ""} onChange={e => onChange({ ...data, contentAr: e.target.value })}
          rows={8} className="resize-none text-sm font-mono" />
      </div>
      <div>
        <Label className="text-xs font-bold text-gray-600 mb-1.5 block">عنوان SEO</Label>
        <Input value={data.metaTitle ?? ""} onChange={e => onChange({ ...data, metaTitle: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs font-bold text-gray-600 mb-1.5 block">وصف SEO</Label>
        <Textarea value={data.metaDescription ?? ""} onChange={e => onChange({ ...data, metaDescription: e.target.value })}
          rows={2} className="resize-none text-sm" />
      </div>
      <div>
        <Label className="text-xs font-bold text-gray-600 mb-1.5 block">كلمات مفتاحية</Label>
        <Input value={data.keywords ?? ""} onChange={e => onChange({ ...data, keywords: e.target.value })}
          placeholder="مفصولة بفاصلة" />
      </div>
    </div>
  );
}
