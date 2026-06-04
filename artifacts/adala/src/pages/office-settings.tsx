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
  Save, AlertCircle
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
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="identity"><Building2 className="h-4 w-4 ml-2" />هوية المكتب</TabsTrigger>
          <TabsTrigger value="assets"><Image className="h-4 w-4 ml-2" />الشعار والختم</TabsTrigger>
          <TabsTrigger value="branding"><Palette className="h-4 w-4 ml-2" />الهوية المزدوجة</TabsTrigger>
          <TabsTrigger value="subscription"><Crown className="h-4 w-4 ml-2" />الاشتراك</TabsTrigger>
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
