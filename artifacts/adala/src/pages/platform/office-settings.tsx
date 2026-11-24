/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { authFetch } from "@/lib/authFetch";
import {
  Building2, Upload, Palette, FileText, Crown, CheckCircle2,
  Image, Stamp, PenLine, Phone, Mail, Globe, Hash, Eye, EyeOff,
  Save, AlertCircle, MessageCircle, Link, Copy, CheckCheck,
  Zap, ShieldCheck, RefreshCw, ExternalLink, Loader2, Monitor,
  Layers, Star, Globe2
} from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

type Branding = {
  id?: string;
  tenantId?: string;
  officeName?: string;
  officeNameEn?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  licenseNo?: string;
  logoUrl?: string;
  stampUrl?: string;
  signatureUrl?: string;
  faviconUrl?: string;
  loginBackgroundUrl?: string;
  watermarkUrl?: string;
  invoiceTemplate?: string;
  primaryColor?: string;
  secondaryColor?: string;
  subscriptionTier?: string;
  showAdalalahLogo?: boolean;
  showAdalalahFooter?: boolean;
  adalalahLogoSize?: string;
};

const TIERS = [
  {
    id: "basic",
    label: "الأساسية",
    color: "bg-muted/50 text-foreground/70",
    features: ["شعار المكتب ✓", "شعار عدالة AI كامل ✓", "تذييل عدالة AI ✓"],
    adalalahSize: "normal",
    canHide: false,
  },
  {
    id: "pro",
    label: "الاحترافية",
    color: "bg-blue-100 text-blue-700",
    features: ["شعار المكتب ✓", "شعار عدالة AI صغير ✓", "تذييل عدالة AI ✓"],
    adalalahSize: "small",
    canHide: false,
  },
  {
    id: "enterprise",
    label: "المؤسسية",
    color: "bg-purple-100 text-purple-700",
    features: ["شعار المكتب ✓", "إخفاء شعار عدالة AI ✓", "White Label جزئي ✓"],
    adalalahSize: "hidden",
    canHide: true,
  },
  {
    id: "government",
    label: "الحكومية / Enterprise",
    color: "bg-yellow-100 text-yellow-800",
    features: ["شعار المكتب ✓", "إزالة عدالة AI بالكامل ✓", "White Label كامل ✓"],
    adalalahSize: "hidden",
    canHide: true,
  },
];

const INVOICE_TEMPLATES = [
  {
    id: "classic_legal",
    label: "الكلاسيكي القانوني",
    desc: "تصميم رسمي بخط ذهبي، مثالي للمحاكم",
    color: "#1e3a5f",
    accent: "#2563EB",
    preview: "classic",
  },
  {
    id: "modern_blue",
    label: "الحديث الأزرق",
    desc: "تصميم عصري بألوان متدرجة، احترافي وجذاب",
    color: "#1d4ed8",
    accent: "#60a5fa",
    preview: "modern",
  },
  {
    id: "minimal",
    label: "المبسّط الأنيق",
    desc: "تصميم نظيف ومينيمالي، يبرز المحتوى",
    color: "#18181b",
    accent: "#71717a",
    preview: "minimal",
  },
];

async function uploadFile(file: File): Promise<string> {
  const urlRes = await authFetch(`${BASE_URL}api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  const { uploadURL, objectPath } = await urlRes.json();
  await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  return `${BASE_URL}api/storage${objectPath}`;
}

function UploadZone({ label, icon: Icon, value, onUpload, accept = "image/*", description }: {
  label: string; icon: any; value?: string; onUpload: (url: string) => void; accept?: string; description?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      onUpload(url);
      toast.success(`تم رفع ${label} بنجاح`);
    } catch {
      toast.error("فشل الرفع، حاول مجدداً");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground -mt-1">{description}</p>}
      <div
        className="border-2 border-dashed border-border/60 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all min-h-[120px] relative"
        onClick={() => ref.current?.click()}
      >
        {value ? (
          <img src={value} alt={label} className="max-h-20 max-w-full object-contain rounded" />
        ) : (
          <>
            <Icon className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground text-center">اضغط للرفع</p>
            <p className="text-xs text-muted-foreground/60">PNG أو SVG أو JPG</p>
          </>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-xl">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={handle} />
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onUpload("")}
          className="text-xs text-destructive hover:underline text-right"
        >
          حذف الصورة
        </button>
      )}
    </div>
  );
}

function InvoiceTemplateCard({ template, selected, onSelect, primaryColor, secondaryColor, officeName }: {
  template: typeof INVOICE_TEMPLATES[0];
  selected: boolean;
  onSelect: () => void;
  primaryColor?: string;
  secondaryColor?: string;
  officeName?: string;
}) {
  const pc = primaryColor || template.color;
  const sc = secondaryColor || template.accent;
  const name = officeName || "مكتب الزهراني للمحاماة";

  return (
    <div
      onClick={onSelect}
      className={`border-2 rounded-xl overflow-hidden cursor-pointer transition-all ${
        selected ? "border-primary shadow-md scale-[1.01]" : "border-border/60 hover:border-primary/40"
      }`}
    >
      {/* Mini preview */}
      <div className="p-3 bg-card  border-b border-border/40" style={{ direction: "rtl" }}>
        {template.preview === "classic" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: sc }}>
              <div>
                <div className="h-2 rounded font-bold text-[9px] flex items-center" style={{ color: pc }}>{name}</div>
                <div className="h-1.5 w-16 rounded mt-0.5 opacity-40" style={{ backgroundColor: pc }} />
              </div>
              <div className="w-6 h-6 rounded flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: pc }}>ع</div>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded opacity-20" style={{ backgroundColor: pc }} />
              <div className="h-1.5 w-3/4 rounded opacity-20" style={{ backgroundColor: pc }} />
            </div>
            <div className="border-t pt-1 text-center" style={{ borderColor: sc }}>
              <div className="h-1 w-24 rounded mx-auto opacity-20" style={{ backgroundColor: pc }} />
            </div>
          </div>
        )}
        {template.preview === "modern" && (
          <div className="space-y-1.5">
            <div className="rounded p-1.5 text-white" style={{ background: `linear-gradient(135deg, ${pc}, ${sc})` }}>
              <div className="text-[9px] font-bold">{name}</div>
              <div className="text-[7px] opacity-80">فاتورة قانونية</div>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded opacity-30" style={{ backgroundColor: pc }} />
              <div className="h-1.5 w-2/3 rounded opacity-30" style={{ backgroundColor: pc }} />
            </div>
          </div>
        )}
        {template.preview === "minimal" && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/40">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: pc }} />
              <div className="text-[9px] font-bold" style={{ color: pc }}>{name}</div>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded opacity-20 bg-current" />
              <div className="h-1.5 w-1/2 rounded opacity-20 bg-current" />
            </div>
          </div>
        )}
      </div>
      {/* Label */}
      <div className={`px-3 py-2 flex items-center justify-between ${selected ? "bg-primary/5" : "bg-muted/20"}`}>
        <div>
          <p className="text-sm font-semibold">{template.label}</p>
          <p className="text-xs text-muted-foreground">{template.desc}</p>
        </div>
        {selected && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
      </div>
    </div>
  );
}

// ─── WhatsApp Business API Settings Component ───
function WhatsAppSettings() {
  const BASE = import.meta.env.BASE_URL ?? "/";
  const [phoneId,    setPhoneId]    = useState("");
  const [token,      setToken]      = useState("");
  const [verifyTok,  setVerifyTok]  = useState("adala_whatsapp_verify");
  const [showToken,  setShowToken]  = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<{ ok?: boolean; phone?: string; error?: string } | null>(null);

  const { data: status } = useQuery({
    queryKey: ["wa-settings"],
    queryFn:  () => authFetch(`${BASE}/api/webhook/whatsapp/settings`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const webhookUrl = status?.webhookUrl || `${window.location.origin}${BASE}api/webhook/whatsapp`;

  const copyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testConn = async () => {
    if (!phoneId || !token) { toast.error("أدخل Phone Number ID و Access Token أولاً"); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await authFetch(`${BASE}/api/webhook/whatsapp/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId: phoneId, accessToken: token }),
      });
      const d = await r.json();
      setTestResult(d);
      if (d.ok) toast.success(`✅ متصل — ${d.phone || "رقم مُفعَّل"}`);
      else      toast.error(`❌ ${d.error}`);
    } catch { toast.error("تعذّر الاتصال"); }
    setTesting(false);
  };

  const STEPS = [
    { n: "1", title: "أنشئ تطبيق Meta", desc: "اذهب إلى developers.facebook.com → My Apps → Create App → Business" },
    { n: "2", title: "أضف منتج WhatsApp",   desc: "من لوحة التحكم: Add Product → WhatsApp → انقر Setup" },
    { n: "3", title: "احصل على Phone Number ID", desc: "WhatsApp → Getting Started → انسخ Phone Number ID" },
    { n: "4", title: "أنشئ Access Token",    desc: "System User → Generate Token → اختر الصلاحيات: whatsapp_business_messaging" },
    { n: "5", title: "هيّئ Webhook",         desc: "WhatsApp → Configuration → انسخ Webhook URL أعلاه وأدخل Verify Token" },
  ];

  return (
    <div className="space-y-6">
      <Card className={`border-2 ${status?.connected ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"}`}>
        <CardContent className="flex items-center gap-4 pt-5">
          <div className={`p-3 rounded-xl ${status?.connected ? "bg-green-500/10" : "bg-amber-500/10"}`}>
            <MessageCircle className={`h-7 w-7 ${status?.connected ? "text-green-500" : "text-amber-500"}`} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-base">
              {status?.connected ? "WhatsApp Business مُفعَّل ومتصل ✅" : "WhatsApp Business API غير مُفعَّل"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {status?.connected
                ? `رقم: ${status.phoneNumberId} • مزوّد: ${status.provider}`
                : "أدخل بيانات Meta Business API لتفعيل الاستقبال التلقائي"}
            </p>
          </div>
          <Badge variant={status?.connected ? "default" : "secondary"} className="text-sm px-3 py-1">
            {status?.connected ? "مُفعَّل" : "غير مُفعَّل"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />بيانات الربط — Meta Business API</CardTitle>
          <CardDescription>يُحفظ في متغيرات البيئة على الخادم</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Phone Number ID</Label>
            <Input dir="ltr" placeholder="1234567890123456" value={phoneId} onChange={e => setPhoneId(e.target.value)} className="font-mono" />
            <p className="text-xs text-muted-foreground">من: Meta Business Suite → WhatsApp → Getting Started</p>
          </div>
          <div className="space-y-2">
            <Label>Access Token</Label>
            <div className="flex gap-2">
              <Input dir="ltr" type={showToken ? "text" : "password"} placeholder="EAAxxxx..." value={token} onChange={e => setToken(e.target.value)} className="font-mono flex-1" />
              <Button variant="ghost" size="icon" onClick={() => setShowToken(p => !p)}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Verify Token (للـ Webhook)</Label>
            <Input dir="ltr" value={verifyTok} onChange={e => setVerifyTok(e.target.value)} className="font-mono" />
          </div>
          <div className="flex gap-3">
            <Button onClick={testConn} disabled={testing} variant="outline" className="gap-2">
              {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              اختبر الاتصال
            </Button>
            <Button className="gap-2">
              <Save className="h-4 w-4" />
              حفظ البيانات
            </Button>
          </div>
          {testResult && (
            <div className={`p-3 rounded-lg text-sm border ${testResult.ok ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400" : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-800 dark:text-red-400"}`}>
              {testResult.ok ? `✅ الاتصال ناجح — ${testResult.phone}` : `❌ ${testResult.error}`}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link className="h-5 w-5 text-primary" />رابط Webhook</CardTitle>
          <CardDescription>انسخ هذا الرابط وأضفه في إعدادات Meta Business</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input dir="ltr" readOnly value={webhookUrl} className="font-mono text-sm flex-1 bg-muted/50" />
            <Button variant="outline" size="icon" onClick={copyUrl}>
              {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" asChild>
              <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">خطوات الربط</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {STEPS.map(s => (
              <li key={s.n} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{s.n}</span>
                <div>
                  <p className="font-medium text-sm">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───
export default function OfficeSettingsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Branding>({});
  const [loaded, setLoaded] = useState(false);

  useQuery({
    queryKey: ["branding"],
    queryFn: async () => {
      const r = await authFetch(`${BASE_URL}api/branding`);
      return r.json();
    },
    onSuccess: (data: any) => {
      if (data && !loaded) {
        setForm(data);
        setLoaded(true);
      } else if (!data && !loaded) {
        setForm({
          primaryColor: "#1e3a5f",
          secondaryColor: "#2563EB",
          subscriptionTier: "basic",
          showAdalalahLogo: true,
          showAdalalahFooter: true,
          adalalahLogoSize: "normal",
          invoiceTemplate: "classic_legal",
        });
        setLoaded(true);
      }
    },
  } as any);

  const save = useMutation({
    mutationFn: async (data: Branding) => {
      const r = await authFetch(`${BASE_URL}api/branding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: (saved) => {
      qc.setQueryData(["branding"], saved);
      qc.invalidateQueries({ queryKey: ["branding"] });
      setForm(saved);
      toast.success("تم حفظ إعدادات المكتب بنجاح ✓");
    },
    onError: () => toast.error("فشل الحفظ، حاول مجدداً"),
  });

  const set = (key: keyof Branding, value: any) => setForm(p => ({ ...p, [key]: value }));
  const currentTier = TIERS.find(t => t.id === (form.subscriptionTier || "basic")) || TIERS[0];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">إعدادات المكتب</h1>
        <p className="text-muted-foreground mt-1">هوية مكتبك، الشعارات، القوالب، والتصدير الاحترافي</p>
      </div>

      <Tabs defaultValue="identity" dir="rtl">
        <div className="overflow-x-auto">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full min-w-[420px]">
          <TabsTrigger value="identity"><Building2 className="h-4 w-4 ms-1.5" />هوية المكتب</TabsTrigger>
          <TabsTrigger value="assets"><Image className="h-4 w-4 ms-1.5" />الشعار والختم</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="h-4 w-4 ms-1.5" />الهوية البصرية</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="h-4 w-4 ms-1.5" />قوالب الفواتير</TabsTrigger>
          <TabsTrigger value="subscription"><Crown className="h-4 w-4 ms-1.5" />الاشتراك</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageCircle className="h-4 w-4 ms-1.5" />واتساب API</TabsTrigger>
        </TabsList>
        </div>

        {/* TAB 1: Identity */}
        <TabsContent value="identity" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>بيانات المكتب</CardTitle>
              <CardDescription>تظهر في رأس كل مستند مُصدَّر</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم المكتب (عربي) *</Label>
                <Input value={form.officeName || ""} onChange={e => set("officeName", e.target.value)} placeholder="مكتب الزهراني للمحاماة" />
              </div>
              <div className="space-y-2">
                <Label>اسم المكتب (إنجليزي)</Label>
                <Input value={form.officeNameEn || ""} onChange={e => set("officeNameEn", e.target.value)} placeholder="Al-Zahrani Law Office" />
              </div>
              <div className="space-y-2">
                <Label>الشعار التعريفي (Tagline)</Label>
                <Input value={form.tagline || ""} onChange={e => set("tagline", e.target.value)} placeholder="خبرة قانونية متميزة منذ ٢٠١٠" />
              </div>
              <div className="space-y-2">
                <Label><Hash className="inline h-4 w-4 ms-1" />رقم الترخيص</Label>
                <Input value={form.licenseNo || ""} onChange={e => set("licenseNo", e.target.value)} placeholder="LS-2024-XXXX" />
              </div>
              <div className="space-y-2">
                <Label><Phone className="inline h-4 w-4 ms-1" />الهاتف</Label>
                <Input type="tel" value={form.phone || ""} onChange={e => set("phone", e.target.value)} placeholder="+966 5X XXX XXXX" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label><Mail className="inline h-4 w-4 ms-1" />البريد الإلكتروني</Label>
                <Input type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} placeholder="info@lawoffice.sa" dir="ltr" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label><Globe className="inline h-4 w-4 ms-1" />الموقع الإلكتروني</Label>
                <Input value={form.website || ""} onChange={e => set("website", e.target.value)} placeholder="https://lawoffice.sa" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>العنوان</Label>
                <Input value={form.address || ""} onChange={e => set("address", e.target.value)} placeholder="الرياض، حي العليا، شارع العروبة، برج X" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Assets */}
        <TabsContent value="assets" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>الشعار والختم والتوقيع</CardTitle>
              <CardDescription>تُرفع مرة واحدة وتُطبَّق تلقائياً على كل المستندات المُصدَّرة</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <UploadZone
                label="شعار المكتب"
                icon={Image}
                value={form.logoUrl}
                onUpload={url => set("logoUrl", url)}
                description="يظهر في رأس الصفحة والـ navbar"
              />
              <UploadZone
                label="ختم المكتب"
                icon={Stamp}
                value={form.stampUrl}
                onUpload={url => set("stampUrl", url)}
                description="يُطبع في أسفل الوثائق الرسمية"
              />
              <UploadZone
                label="توقيع المدير"
                icon={PenLine}
                value={form.signatureUrl}
                onUpload={url => set("signatureUrl", url)}
                description="توقيع المحامي أو مدير المكتب"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                ترويسة الورق الرسمي (الكليسة)
              </CardTitle>
              <CardDescription>صورة تصميم الورق الرسمي للمكتب — تُستخدم كخلفية كاملة لصفحة الخطابات والمستندات</CardDescription>
            </CardHeader>
            <CardContent>
              <UploadZone
                label="ترويسة الورق الرسمي (A4)"
                icon={FileText}
                value={(form as any).letterheadUrl}
                onUpload={url => set("letterheadUrl" as any, url)}
                description="صورة A4 للكليسة الرسمية — تُطبع كاملة خلف المحتوى في الخطابات"
                accept="image/png,image/jpeg,image/jpg,image/webp"
              />
              <div className="mt-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-700 dark:text-amber-400">
                <p className="font-semibold mb-1">⚠️ تعليمات الترويسة:</p>
                <ul className="list-disc list-inside space-y-1 text-xs opacity-80">
                  <li>ارفع صورة بحجم A4 (210 × 297 مم) أو نسبة 1:1.41</li>
                  <li>صيغة PNG شفافة إذا أردت تداخل المحتوى معها</li>
                  <li>الترويسة تظهر تلقائياً في الخطابات والمستندات المُصدَّرة</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5 text-primary" />
                أصول الهوية الرقمية
              </CardTitle>
              <CardDescription>تُحسّن تجربة المستخدم وتميّز مكتبك بشكل كامل</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <UploadZone
                label="Favicon (أيقونة التبويب)"
                icon={Star}
                value={form.faviconUrl}
                onUpload={url => set("faviconUrl", url)}
                accept="image/png,image/ico,image/svg+xml,image/x-icon"
                description="تظهر في تبويب المتصفح — PNG أو ICO بحجم 32×32"
              />
              <UploadZone
                label="خلفية صفحة تسجيل الدخول"
                icon={Globe2}
                value={form.loginBackgroundUrl}
                onUpload={url => set("loginBackgroundUrl", url)}
                description="خلفية صفحة Sign In الخاصة بمكتبك"
              />
              <UploadZone
                label="العلامة المائية (Watermark)"
                icon={Layers}
                value={form.watermarkUrl}
                onUpload={url => set("watermarkUrl", url)}
                description="تُطبع بشفافية على المستندات المُصدَّرة"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Branding (Colors + Dual branding) */}
        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>الهوية البصرية</CardTitle>
              <CardDescription>ألوان المكتب تُطبَّق تلقائياً على كل صفحات النظام والمستندات</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Colors */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Palette className="h-4 w-4" />ألوان الهوية</h3>
                <div className="grid grid-cols-2 gap-4 mobile-single-col">
                  <div className="space-y-2">
                    <Label>اللون الأساسي</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.primaryColor || "#1e3a5f"} onChange={e => set("primaryColor", e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-border" />
                      <Input value={form.primaryColor || "#1e3a5f"} onChange={e => set("primaryColor", e.target.value)} className="font-mono" placeholder="#1e3a5f" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>اللون الثانوي (الذهبي)</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.secondaryColor || "#2563EB"} onChange={e => set("secondaryColor", e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-border" />
                      <Input value={form.secondaryColor || "#2563EB"} onChange={e => set("secondaryColor", e.target.value)} className="font-mono" placeholder="#2563EB" />
                    </div>
                  </div>
                </div>

                {/* Live color swatches */}
                <div className="mt-4 flex gap-2 flex-wrap">
                  {[
                    { label: "الأساسي العميق", primary: "#1e3a5f", secondary: "#2563EB" },
                    { label: "الملكي الذهبي", primary: "#2d1b69", secondary: "#f59e0b" },
                    { label: "الأخضر القانوني", primary: "#14532d", secondary: "#86efac" },
                    { label: "الأسود الفاخر", primary: "#0f0f0f", secondary: "#2563EB" },
                    { label: "الأزرق الدولي", primary: "#1d4ed8", secondary: "#60a5fa" },
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => { set("primaryColor", preset.primary); set("secondaryColor", preset.secondary); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 text-xs hover:border-primary/50 transition-colors"
                      title={preset.label}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-border" style={{ backgroundColor: preset.primary }} />
                      <span className="w-3.5 h-3.5 rounded-full border border-border" style={{ backgroundColor: preset.secondary }} />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Adalah visibility */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4" />ظهور شعار عدالة AI
                  <Badge className={currentTier.color}>{currentTier.label}</Badge>
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                    <div>
                      <p className="font-medium">شعار عدالة AI في الرأس</p>
                      <p className="text-sm text-muted-foreground">يظهر بجانب شعار مكتبك في أعلى المستند</p>
                    </div>
                    <Switch
                      checked={form.showAdalalahLogo ?? true}
                      onCheckedChange={v => set("showAdalalahLogo", v)}
                      disabled={!currentTier.canHide}
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/20">
                    <div>
                      <p className="font-medium">تذييل عدالة AI في التذييل</p>
                      <p className="text-sm text-muted-foreground">"تم إنشاء هذا المستند بواسطة منصة عدالة AI"</p>
                    </div>
                    <Switch
                      checked={form.showAdalalahFooter ?? true}
                      onCheckedChange={v => set("showAdalalahFooter", v)}
                      disabled={!currentTier.canHide}
                    />
                  </div>
                  {!currentTier.canHide && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-sm border border-amber-200 dark:border-amber-800">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      إخفاء شعار عدالة AI متاح للباقة المؤسسية وما فوق. <span className="underline cursor-pointer">ترقية الباقة</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Preview */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" />معاينة رأس المستند (مباشر)</h3>
                <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="p-6 bg-card " style={{ direction: "rtl" }}>
                    <div className="flex items-start justify-between border-b pb-4 mb-4" style={{ borderColor: form.secondaryColor || "#2563EB" }}>
                      <div className="flex items-center gap-3">
                        {form.logoUrl ? (
                          <img src={form.logoUrl} alt="شعار" className="h-14 w-14 object-contain" />
                        ) : (
                          <div className="h-14 w-14 rounded-lg flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: form.primaryColor || "#1e3a5f" }}>
                            {(form.officeName || "م")[0]}
                          </div>
                        )}
                        <div>
                          <h2 className="text-xl font-bold" style={{ color: form.primaryColor || "#1e3a5f" }}>
                            {form.officeName || "اسم المكتب القانوني"}
                          </h2>
                          {form.tagline && <p className="text-sm text-muted-foreground">{form.tagline}</p>}
                          {form.phone && <p className="text-xs text-muted-foreground">📞 {form.phone}</p>}
                        </div>
                      </div>
                      {(form.showAdalalahLogo !== false) && (
                        <div className="flex flex-col items-center gap-1 opacity-80">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: form.primaryColor || "#1e3a5f" }}>ع</div>
                          <span className="text-xs font-semibold" style={{ color: form.primaryColor || "#1e3a5f" }}>عدالة AI</span>
                        </div>
                      )}
                    </div>
                    <p className="text-center text-sm text-muted-foreground italic">... محتوى المستند ...</p>
                    {(form.showAdalalahFooter !== false) && (
                      <div className="mt-4 pt-3 border-t text-center text-xs text-muted-foreground" style={{ borderColor: form.secondaryColor || "#2563EB" }}>
                        تم إنشاء هذا المستند بواسطة منصة <span className="font-semibold">عدالة AI</span> — Powered by Adalah AI
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Invoice Templates */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                قالب الفاتورة القانونية
              </CardTitle>
              <CardDescription>
                اختر التصميم الذي يناسب هوية مكتبك — يُطبَّق على كل الفواتير والمستندات المُصدَّرة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {INVOICE_TEMPLATES.map(tpl => (
                  <InvoiceTemplateCard
                    key={tpl.id}
                    template={tpl}
                    selected={(form.invoiceTemplate || "classic_legal") === tpl.id}
                    onSelect={() => set("invoiceTemplate", tpl.id)}
                    primaryColor={form.primaryColor}
                    secondaryColor={form.secondaryColor}
                    officeName={form.officeName}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-sm border border-blue-200 dark:border-blue-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  القالب المختار: <strong>{INVOICE_TEMPLATES.find(t => t.id === (form.invoiceTemplate || "classic_legal"))?.label}</strong> — يُطبَّق على الفواتير والعقود والتقارير.
                </span>
              </div>

              <Separator />

              {/* Full invoice preview */}
              <div>
                <h3 className="font-semibold mb-3">معاينة الفاتورة الكاملة</h3>
                <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-card  p-6" style={{ direction: "rtl" }}>
                    {/* Header */}
                    {(form.invoiceTemplate === "modern_blue") ? (
                      <div className="rounded-lg p-4 mb-4 text-white" style={{ background: `linear-gradient(135deg, ${form.primaryColor || "#1d4ed8"}, ${form.secondaryColor || "#60a5fa"})` }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h2 className="text-xl font-bold">{form.officeName || "مكتب الزهراني للمحاماة"}</h2>
                            {form.tagline && <p className="text-sm opacity-80">{form.tagline}</p>}
                          </div>
                          <div className="text-left opacity-90">
                            <p className="text-2xl font-bold">فاتورة</p>
                            <p className="text-sm">#INV-2024-001</p>
                          </div>
                        </div>
                      </div>
                    ) : (form.invoiceTemplate === "minimal") ? (
                      <div className="flex items-start justify-between mb-4 pb-3 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded" style={{ backgroundColor: form.primaryColor || "#18181b" }} />
                          <div>
                            <h2 className="font-bold text-base" style={{ color: form.primaryColor || "#18181b" }}>{form.officeName || "مكتب الزهراني"}</h2>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-sm">فاتورة #INV-2024-001</p>
                          <p className="text-xs text-muted-foreground">١١ يونيو ٢٠٢٦</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between border-b pb-4 mb-4" style={{ borderColor: form.secondaryColor || "#2563EB" }}>
                        <div className="flex items-center gap-3">
                          {form.logoUrl ? (
                            <img src={form.logoUrl} alt="شعار" className="h-12 w-12 object-contain" />
                          ) : (
                            <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: form.primaryColor || "#1e3a5f" }}>
                              {(form.officeName || "م")[0]}
                            </div>
                          )}
                          <div>
                            <h2 className="text-lg font-bold" style={{ color: form.primaryColor || "#1e3a5f" }}>{form.officeName || "مكتب الزهراني للمحاماة"}</h2>
                            {form.tagline && <p className="text-xs text-muted-foreground">{form.tagline}</p>}
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-2xl font-bold" style={{ color: form.secondaryColor || "#2563EB" }}>فاتورة</p>
                          <p className="text-sm text-muted-foreground">#INV-2024-001</p>
                        </div>
                      </div>
                    )}

                    {/* Body */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="p-3 rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-1">فاتورة إلى</p>
                        <p className="font-semibold">شركة الأمل التجارية</p>
                        <p className="text-sm text-muted-foreground">الرياض، المملكة العربية السعودية</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 text-left">
                        <p className="text-xs text-muted-foreground mb-1">تاريخ الإصدار</p>
                        <p className="font-semibold">١١ يونيو ٢٠٢٦</p>
                        <p className="text-sm text-muted-foreground">تاريخ الاستحقاق: ٢٥ يونيو ٢٠٢٦</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto"><table className="w-full text-sm mb-4 min-w-[340px]">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border/40">
                          <th className="py-2 text-right">الوصف</th>
                          <th className="py-2 text-center">الساعات</th>
                          <th className="py-2 text-left">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border/20">
                          <td className="py-2">خدمات التمثيل القانوني — قضية عقد تجاري</td>
                          <td className="py-2 text-center">٨</td>
                          <td className="py-2 text-left">٤٠٠٠ ريال</td>
                        </tr>
                        <tr>
                          <td className="py-2">مراجعة وصياغة عقد الشراكة</td>
                          <td className="py-2 text-center">٣</td>
                          <td className="py-2 text-left">١٥٠٠ ريال</td>
                        </tr>
                      </tbody>
                    </table></div>

                    <div className="flex justify-end">
                      <div className="w-48 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الإجمالي:</span>
                          <span className="font-bold">٥٥٠٠ ريال</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: Subscription */}
        <TabsContent value="subscription" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>مستويات الاشتراك</CardTitle>
              <CardDescription>كل باقة تتحكم في مستوى White Label وظهور علامة عدالة AI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TIERS.map(tier => (
                  <div
                    key={tier.id}
                    onClick={() => set("subscriptionTier", tier.id)}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
                      form.subscriptionTier === tier.id
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={tier.color}>{tier.label}</Badge>
                      {form.subscriptionTier === tier.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <ul className="space-y-1">
                      {tier.features.map(f => (
                        <li key={f} className="text-sm flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: WhatsApp */}
        <TabsContent value="whatsapp" className="space-y-4 mt-4">
          <WhatsAppSettings />
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <Button
          size="lg"
          onClick={() => save.mutate(form)}
          disabled={save.isPending}
          className="gap-2 px-8"
        >
          {save.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          حفظ إعدادات المكتب
        </Button>
      </div>
    </div>
  );
}
