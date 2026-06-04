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
import {
  Building2, Upload, Palette, FileText, Crown, CheckCircle2,
  Image, Stamp, PenLine, Phone, Mail, Globe, Hash, Eye, EyeOff,
  Save, AlertCircle, MessageCircle, Link, Copy, CheckCheck,
  Zap, ShieldCheck, RefreshCw, ExternalLink, Loader2
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
    color: "bg-slate-100 text-slate-700",
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

async function uploadFile(file: File): Promise<string> {
  const urlRes = await fetch(`${BASE_URL}api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  const { uploadURL, objectPath } = await urlRes.json();
  await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  return `${BASE_URL}api/storage${objectPath}`;
}

function UploadZone({ label, icon: Icon, value, onUpload, accept = "image/*" }: {
  label: string; icon: any; value?: string; onUpload: (url: string) => void; accept?: string;
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
    queryFn:  () => fetch(`${BASE}api/webhook/whatsapp/settings`).then(r => r.json()),
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
      const r = await fetch(`${BASE}api/webhook/whatsapp/test`, {
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
      {/* Status Banner */}
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

      {/* Credentials Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />بيانات الربط — Meta Business API</CardTitle>
          <CardDescription>يُحفظ في متغيرات البيئة على الخادم</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Phone Number ID</Label>
            <Input
              dir="ltr"
              placeholder="1234567890123456"
              value={phoneId}
              onChange={e => setPhoneId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">من: Meta Business Suite → WhatsApp → Getting Started</p>
          </div>
          <div className="space-y-2">
            <Label>Access Token (Permanent)</Label>
            <div className="relative">
              <Input
                dir="ltr"
                type={showToken ? "text" : "password"}
                placeholder="EAAxxxxxxx..."
                value={token}
                onChange={e => setToken(e.target.value)}
                className="font-mono pl-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">System User → Generate Token مع صلاحية whatsapp_business_messaging</p>
          </div>
          <div className="space-y-2">
            <Label>Webhook Verify Token (تخصيص)</Label>
            <Input
              dir="ltr"
              value={verifyTok}
              onChange={e => setVerifyTok(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">ادخله في حقل Verify Token بلوحة Meta</p>
          </div>

          {/* Test Connection */}
          <div className="flex gap-3 pt-2">
            <Button onClick={testConn} disabled={testing} variant="outline" className="flex items-center gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              اختبر الاتصال
            </Button>
            {testResult?.ok && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCheck className="h-4 w-4" />
                متصل — {testResult.phone || "رقم مُفعَّل"}
              </div>
            )}
            {testResult?.error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {testResult.error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link className="h-5 w-5 text-primary" />Webhook URL (انسخه في Meta)</CardTitle>
          <CardDescription>أدخل هذا الرابط في إعدادات Webhook بلوحة تحكم Meta Developers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-sm break-all" dir="ltr">
              {webhookUrl}
            </div>
            <Button variant="outline" size="sm" onClick={copyUrl} className="shrink-0 gap-2">
              {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "تم النسخ" : "نسخ"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Verify Token</p>
              <p className="font-mono text-sm">{verifyTok}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Subscribed Fields</p>
              <p className="font-mono text-sm">messages, message_deliveries</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ExternalLink className="h-5 w-5 text-primary" />خطوات الربط بـ Meta Business API</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {STEPS.map(step => (
              <li key={step.n} className="flex gap-4 items-start">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0 mt-0.5">
                  {step.n}
                </div>
                <div>
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <Separator className="my-4" />

          <div className="flex gap-3 flex-wrap">
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Meta Developers Portal
            </a>
            <a
              href="https://business.facebook.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Meta Business Suite
            </a>
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              توثيق WhatsApp Cloud API
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Inbound Events Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" />ما يحدث عند ورود رسالة واتساب</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: "📥", title: "الاستقبال التلقائي", desc: "كل رسالة واردة تُحفظ فوراً في قاعدة البيانات" },
              { icon: "🏷️", title: "التصنيف الذكي",  desc: "يُصنَّف تلقائياً: استشارة، موعد، مستند، مالي، شكوى" },
              { icon: "💬", title: "تكامل مع تواصل", desc: "تظهر في صفحة تواصل تحت قناة WhatsApp" },
            ].map(item => (
              <div key={item.title} className="bg-muted/50 rounded-xl p-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OfficeSettings() {
  const qc = useQueryClient();
  const [form, setForm] = useState<Branding>({});
  const [loaded, setLoaded] = useState(false);

  const { data: branding } = useQuery<Branding | null>({
    queryKey: ["branding"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}api/branding`);
      return r.json();
    },
    onSuccess: (data) => {
      if (data && !loaded) {
        setForm(data);
        setLoaded(true);
      } else if (!data && !loaded) {
        setForm({
          primaryColor: "#1e3a5f",
          secondaryColor: "#c9a84c",
          subscriptionTier: "basic",
          showAdalalahLogo: true,
          showAdalalahFooter: true,
          adalalahLogoSize: "normal",
        });
        setLoaded(true);
      }
    },
  } as any);

  const save = useMutation({
    mutationFn: async (data: Branding) => {
      const r = await fetch(`${BASE_URL}api/branding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return r.json();
    },
    onSuccess: (saved) => {
      qc.setQueryData(["branding"], saved);
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
        <p className="text-muted-foreground mt-1">هوية مكتبك، الشعارات، والتصدير الاحترافي</p>
      </div>

      <Tabs defaultValue="identity" dir="rtl">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="identity"><Building2 className="h-4 w-4 ml-2" />هوية المكتب</TabsTrigger>
          <TabsTrigger value="assets"><Image className="h-4 w-4 ml-2" />الشعار والختم</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="h-4 w-4 ml-2" />الهوية المزدوجة</TabsTrigger>
          <TabsTrigger value="subscription"><Crown className="h-4 w-4 ml-2" />الاشتراك</TabsTrigger>
          <TabsTrigger value="whatsapp"><MessageCircle className="h-4 w-4 ml-2" />واتساب API</TabsTrigger>
        </TabsList>

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
                <Label><Hash className="inline h-4 w-4 ml-1" />رقم الترخيص</Label>
                <Input value={form.licenseNo || ""} onChange={e => set("licenseNo", e.target.value)} placeholder="LS-2024-XXXX" />
              </div>
              <div className="space-y-2">
                <Label><Phone className="inline h-4 w-4 ml-1" />الهاتف</Label>
                <Input value={form.phone || ""} onChange={e => set("phone", e.target.value)} placeholder="+966 5X XXX XXXX" />
              </div>
              <div className="space-y-2">
                <Label><Mail className="inline h-4 w-4 ml-1" />البريد الإلكتروني</Label>
                <Input value={form.email || ""} onChange={e => set("email", e.target.value)} placeholder="info@lawoffice.sa" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label><Globe className="inline h-4 w-4 ml-1" />الموقع الإلكتروني</Label>
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
              />
              <UploadZone
                label="ختم المكتب"
                icon={Stamp}
                value={form.stampUrl}
                onUpload={url => set("stampUrl", url)}
              />
              <UploadZone
                label="توقيع المدير"
                icon={PenLine}
                value={form.signatureUrl}
                onUpload={url => set("signatureUrl", url)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Dual Branding */}
        <TabsContent value="branding" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>الهوية المزدوجة</CardTitle>
              <CardDescription>تحكم في ظهور شعار عدالة AI حسب باقتك</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Colors */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Palette className="h-4 w-4" />ألوان الهوية</h3>
                <div className="grid grid-cols-2 gap-4">
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
                      <input type="color" value={form.secondaryColor || "#c9a84c"} onChange={e => set("secondaryColor", e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-border" />
                      <Input value={form.secondaryColor || "#c9a84c"} onChange={e => set("secondaryColor", e.target.value)} className="font-mono" placeholder="#c9a84c" />
                    </div>
                  </div>
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
                <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" />معاينة رأس المستند</h3>
                <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="p-6 bg-white dark:bg-slate-900" style={{ direction: "rtl" }}>
                    {/* Header */}
                    <div className="flex items-start justify-between border-b pb-4 mb-4" style={{ borderColor: form.secondaryColor || "#c9a84c" }}>
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
                          {form.tagline && <p className="text-sm text-gray-500">{form.tagline}</p>}
                          {form.phone && <p className="text-xs text-gray-400">📞 {form.phone}</p>}
                        </div>
                      </div>
                      {(form.showAdalalahLogo !== false) && (
                        <div className="flex flex-col items-center gap-1 opacity-80">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: form.primaryColor || "#1e3a5f" }}>ع</div>
                          <span className="text-xs font-semibold" style={{ color: form.primaryColor || "#1e3a5f" }}>عدالة AI</span>
                        </div>
                      )}
                    </div>
                    <p className="text-center text-sm text-gray-400 italic">... محتوى المستند ...</p>
                    {/* Footer */}
                    {(form.showAdalalahFooter !== false) && (
                      <div className="mt-4 pt-3 border-t text-center text-xs text-gray-400" style={{ borderColor: form.secondaryColor || "#c9a84c" }}>
                        تم إنشاء هذا المستند بواسطة منصة <span className="font-semibold">عدالة AI</span> — Powered by Adalah AI
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Subscription */}
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

        {/* TAB 5: WhatsApp Business API */}
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
