import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Database, Download, Upload, Cloud, Settings2, History, Shield,
  CheckCircle2, AlertCircle, Loader2, Trash2, RefreshCw,
  FileJson, FileSpreadsheet, Lock, Crown, ArrowDownToLine, UploadCloud,
  HardDrive, Layers, Calendar,
} from "lucide-react";
import { useOfficePlan } from "@/hooks/use-office-plan";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Plan feature matrix ────────────────────────────────── */
type PlanKey = "starter" | "basic" | "professional" | "business" | "premium" | "ultimate";

/* ─────────────────────────────────────────────────────────
   POLICY:
   • Local device export (JSON / CSV / full backup file)
     → FREE for ALL plans — user owns their data
   • Platform backup (server-stored, scheduled, cloud sync,
     restore from server, extended retention)
     → gated by subscription plan
   ───────────────────────────────────────────────────────── */
const PLAN_MATRIX: Record<PlanKey, {
  schedules: string[];
  retention: number[];
  csv: boolean;
  fullExport: boolean;
  cloudStorage: boolean;
  importData: boolean;
  restore: boolean;
  instantBackup: boolean;
  unlimitedRetention: boolean;
}> = {
  // csv + fullExport = true on ALL plans (local export is always free)
  starter:      { schedules: ["daily"],                                 retention: [7, 30],          csv: true, fullExport: true, cloudStorage: false, importData: false, restore: false, instantBackup: false, unlimitedRetention: false },
  basic:        { schedules: ["daily"],                                 retention: [7, 30, 90],       csv: true, fullExport: true, cloudStorage: false, importData: false, restore: false, instantBackup: false, unlimitedRetention: false },
  professional: { schedules: ["daily", "weekly"],                       retention: [7, 30, 90],       csv: true, fullExport: true, cloudStorage: false, importData: false, restore: false, instantBackup: false, unlimitedRetention: false },
  business:     { schedules: ["daily", "weekly"],                       retention: [7, 30, 90, 365],  csv: true, fullExport: true, cloudStorage: true,  importData: true,  restore: false, instantBackup: false, unlimitedRetention: false },
  premium:      { schedules: ["daily", "weekly", "monthly"],            retention: [7, 30, 90, 365],  csv: true, fullExport: true, cloudStorage: true,  importData: true,  restore: true,  instantBackup: false, unlimitedRetention: false },
  ultimate:     { schedules: ["daily", "weekly", "monthly", "instant"], retention: [7, 30, 90, 365, 0], csv: true, fullExport: true, cloudStorage: true, importData: true, restore: true, instantBackup: true, unlimitedRetention: true },
};

function getFeatures(planSlug: string, isSuperAdmin: boolean) {
  if (isSuperAdmin) return PLAN_MATRIX.ultimate;
  const key = (planSlug as PlanKey) in PLAN_MATRIX ? (planSlug as PlanKey) : "starter";
  return PLAN_MATRIX[key];
}

/* ── Types ──────────────────────────────────────────────── */
interface BackupSettings {
  id?: string;
  schedule: string;
  retentionDays: number;
  storageProvider: string;
  cloudConfig: Record<string, string>;
  isEnabled: boolean;
  lastBackupAt: string | null;
}

interface BackupJob {
  id: string;
  type: string;
  scheduleType: string | null;
  status: string;
  sizeBytes: number | null;
  fileName: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

/* ── Helpers ────────────────────────────────────────────── */
function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

/* ── Locked Feature Banner ──────────────────────────────── */
function LockedBanner({ requiredPlan }: { requiredPlan: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
      <Lock className="h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-medium">هذه الميزة تتطلب باقة {requiredPlan} أو أعلى</p>
        <p className="text-xs opacity-70 mt-0.5">قم بترقية باقتك للاستفادة من هذه الميزة</p>
      </div>
      <Button variant="outline" size="sm" className="mr-auto border-amber-500/50 text-amber-300 hover:bg-amber-500/20"
        onClick={() => window.location.href = `${BASE}/billing`}>
        ترقية الباقة
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function BackupCenter() {
  const { t } = useTranslation();
  const { user } = useUser();
  const { planSlug, planName, planColor } = useOfficePlan();
  const qc = useQueryClient();

  const isSuperAdmin =
    user?.publicMetadata?.role === "super_admin" ||
    (import.meta.env.VITE_SUPER_ADMIN_EMAILS ?? "")
      .split(",").map((e: string) => e.trim())
      .includes(user?.primaryEmailAddress?.emailAddress ?? "");

  const features = getFeatures(planSlug, isSuperAdmin);

  /* ── Settings state ── */
  const [settings, setSettings] = useState<BackupSettings>({
    schedule: "daily",
    retentionDays: 30,
    storageProvider: "local",
    cloudConfig: {},
    isEnabled: true,
    lastBackupAt: null,
  });
  const [cloudCfg, setCloudCfg] = useState({ accessKey: "", secretKey: "", bucket: "", region: "", endpoint: "" });
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  /* ── Queries ── */
  const settingsQ = useQuery<BackupSettings>({
    queryKey: ["backup-settings"],
    queryFn: () => fetch(`${BASE}/api/backup/settings`).then(r => r.json()),
  });

  useEffect(() => {
    if (settingsQ.data) {
      setSettings(settingsQ.data);
      if (settingsQ.data.cloudConfig) {
        setCloudCfg(c => ({ ...c, ...settingsQ.data!.cloudConfig }));
      }
    }
  }, [settingsQ.data]);

  const jobsQ = useQuery<BackupJob[]>({
    queryKey: ["backup-jobs"],
    queryFn: () => fetch(`${BASE}/api/backup/jobs`).then(r => r.json()),
  });

  /* ── Mutations ── */
  const saveSettingsMut = useMutation({
    mutationFn: (data: Partial<BackupSettings>) =>
      fetch(`${BASE}/api/backup/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      toast.success("تم حفظ إعدادات النسخ الاحتياطي");
      qc.invalidateQueries({ queryKey: ["backup-settings"] });
    },
    onError: () => toast.error("خطأ في حفظ الإعدادات"),
  });

  const deleteJobMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/api/backup/jobs/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => {
      toast.success("تم حذف النسخة الاحتياطية");
      qc.invalidateQueries({ queryKey: ["backup-jobs"] });
    },
    onError: () => toast.error("خطأ في الحذف"),
  });

  /* ── Manual backup ── */
  async function createBackup() {
    setIsCreatingBackup(true);
    try {
      const r = await fetch(`${BASE}/api/backup/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual" }),
      });
      const data = await r.json();
      if (data.ok) {
        toast.success(`✓ تم إنشاء النسخة الاحتياطية (${formatBytes(data.sizeBytes)})`);
        qc.invalidateQueries({ queryKey: ["backup-jobs", "backup-settings"] });
      } else {
        toast.error(data.error ?? "خطأ في الإنشاء");
      }
    } catch {
      toast.error("خطأ في الاتصال بالخادم");
    } finally {
      setIsCreatingBackup(false);
    }
  }

  /* ── Download backup (from server history) ── */
  function downloadBackup(job: BackupJob) {
    const url = `${BASE}/api/backup/jobs/${job.id}/download`;
    const a = document.createElement("a");
    a.href = url;
    a.download = job.fileName ?? "backup.json";
    a.click();
  }

  /* ── Local device backup — free for all plans ── */
  const [isLocalDownloading, setIsLocalDownloading] = useState(false);
  async function localDeviceBackup() {
    setIsLocalDownloading(true);
    try {
      const res = await fetch(`${BASE}/api/backup/local-download`);
      if (!res.ok) throw new Error("فشل التحميل");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split("T")[0];
      const a = document.createElement("a");
      a.href = url;
      a.download = `adala-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("✅ تم تحميل النسخة الاحتياطية على جهازك");
    } catch {
      toast.error("خطأ في تحميل النسخة الاحتياطية");
    } finally {
      setIsLocalDownloading(false);
    }
  }

  /* ── Export section ── */
  async function exportSection(section: string, format: "csv" | "json") {
    const a = document.createElement("a");
    a.href = `${BASE}/api/export/${section}?format=${format}`;
    a.download = `${section}-export.${format}`;
    a.click();
  }

  async function exportAll() {
    const a = document.createElement("a");
    a.href = `${BASE}/api/export/all`;
    a.download = `office-export.json`;
    a.click();
  }

  /* ── Import ── */
  async function handleImport() {
    if (!importFile) { toast.warning("الرجاء اختيار ملف أولاً"); return; }
    try {
      const text = await importFile.text();
      const parsed = JSON.parse(text);
      const r = await fetch(`${BASE}/api/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await r.json();
      if (data.ok) {
        toast.success(`تم استيراد ${data.imported} سجل بنجاح`);
        setImportFile(null);
      } else {
        toast.error(data.error ?? "خطأ في الاستيراد");
      }
    } catch {
      toast.error("الملف غير صالح أو تعذّر قراءته");
    }
  }

  /* ── Save settings with cloud config ── */
  function saveSettings() {
    saveSettingsMut.mutate({
      ...settings,
      cloudConfig: features.cloudStorage ? cloudCfg : {},
    });
  }

  const jobs = jobsQ.data ?? [];
  const lastJob = jobs[0];

  /* ── SCHEDULE OPTIONS ── */
  const allSchedules = [
    { value: "daily",   label: "يومي",    icon: "📅" },
    { value: "weekly",  label: "أسبوعي",  icon: "📆" },
    { value: "monthly", label: "شهري",    icon: "🗓️" },
    { value: "instant", label: "فوري",    icon: "⚡" },
    { value: "none",    label: "معطّل",   icon: "🔕" },
  ];

  const retentionOptions = [
    { value: 7,   label: "7 أيام" },
    { value: 30,  label: "30 يومًا" },
    { value: 90,  label: "90 يومًا" },
    { value: 365, label: "سنة كاملة" },
    { value: 0,   label: "غير محدود" },
  ];

  const cloudProviders = [
    { value: "local",  label: "التخزين المحلي",     icon: <HardDrive className="h-4 w-4" /> },
    { value: "r2",     label: "Cloudflare R2 ⭐",    icon: <Cloud className="h-4 w-4" /> },
    { value: "s3",     label: "Amazon S3",           icon: <Cloud className="h-4 w-4" /> },
    { value: "b2",     label: "Backblaze B2",        icon: <Cloud className="h-4 w-4" /> },
    { value: "gcs",    label: "Google Cloud Storage",icon: <Cloud className="h-4 w-4" /> },
    { value: "azure",  label: "Azure Blob",          icon: <Cloud className="h-4 w-4" /> },
  ];

  /* ── Summary stats ── */
  const totalBackups = jobs.length;
  const successJobs = jobs.filter(j => j.status === "completed").length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center">
                <Database className="h-5 w-5 text-[#C9A84C]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">مركز البيانات</h1>
                <p className="text-sm text-muted-foreground">النسخ الاحتياطي والتصدير وإدارة البيانات</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 gap-1">
                <Crown className="h-3 w-3" /> مالك المنصة
              </Badge>
            )}
            <Badge style={{ backgroundColor: `${planColor}22`, color: planColor, borderColor: `${planColor}44` }}>
              {planName}
            </Badge>
          </div>
        </div>

        {/* ─── Summary Cards ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-sidebar border-sidebar-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <History className="h-4 w-4 text-[#C9A84C]" />
                <span className="text-xs text-muted-foreground">آخر نسخة</span>
              </div>
              <p className="text-sm font-medium text-white truncate">
                {settingsQ.data?.lastBackupAt ? formatDate(settingsQ.data.lastBackupAt) : "لا توجد نسخ بعد"}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-sidebar border-sidebar-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-muted-foreground">إجمالي النسخ</span>
              </div>
              <p className="text-2xl font-bold text-white">{totalBackups}</p>
            </CardContent>
          </Card>

          <Card className="bg-sidebar border-sidebar-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-xs text-muted-foreground">ناجحة</span>
              </div>
              <p className="text-2xl font-bold text-green-400">{successJobs}</p>
            </CardContent>
          </Card>

          <Card className="bg-sidebar border-sidebar-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-muted-foreground">الجدولة</span>
              </div>
              <p className="text-sm font-medium text-white capitalize">
                {allSchedules.find(s => s.value === (settingsQ.data?.schedule ?? "daily"))?.label ?? "يومي"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ─── Main Tabs ─── */}
        <Tabs defaultValue="local" dir="rtl">
          <TabsList className="bg-sidebar border border-sidebar-border flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="local" className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <HardDrive className="h-3.5 w-3.5" /> النسخ المحلي
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 rounded px-1 py-0 mr-0.5">مجاني</span>
            </TabsTrigger>
            <TabsTrigger value="settings"  className="gap-1.5 data-[state=active]:bg-[#C9A84C] data-[state=active]:text-black">
              <Settings2 className="h-3.5 w-3.5" /> نسخ المنصة
            </TabsTrigger>
            <TabsTrigger value="export"    className="gap-1.5 data-[state=active]:bg-[#C9A84C] data-[state=active]:text-black">
              <ArrowDownToLine className="h-3.5 w-3.5" /> تصدير الأقسام
            </TabsTrigger>
            <TabsTrigger value="history"   className="gap-1.5 data-[state=active]:bg-[#C9A84C] data-[state=active]:text-black">
              <History className="h-3.5 w-3.5" /> السجل
            </TabsTrigger>
            <TabsTrigger value="cloud"     className="gap-1.5 data-[state=active]:bg-[#C9A84C] data-[state=active]:text-black">
              <UploadCloud className="h-3.5 w-3.5" /> التخزين السحابي
            </TabsTrigger>
            <TabsTrigger value="import"    className="gap-1.5 data-[state=active]:bg-[#C9A84C] data-[state=active]:text-black">
              <Upload className="h-3.5 w-3.5" /> الاستيراد
            </TabsTrigger>
          </TabsList>

          {/* ══ TAB: LOCAL DEVICE BACKUP (FREE FOR ALL) ══ */}
          <TabsContent value="local" className="mt-4 space-y-4">

            {/* Free badge banner */}
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-emerald-300">النسخ الاحتياطي المحلي — مجاني لجميع الباقات</p>
                <p className="text-xs text-emerald-300/60 mt-0.5">
                  بياناتك ملكك. حمّل نسخة كاملة على جهازك في أي وقت بدون قيود.
                </p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shrink-0">🆓 مجاني</Badge>
            </div>

            {/* One-click full backup */}
            <Card className="bg-sidebar border-sidebar-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Download className="h-4 w-4 text-emerald-400" /> نسخة احتياطية كاملة للجهاز
                </CardTitle>
                <CardDescription>ملف JSON شامل لجميع بيانات المكتب — يُحفظ على جهازك مباشرةً</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-sidebar-border bg-background/30 p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">محتويات النسخة الاحتياطية</p>
                      <p className="text-xs text-muted-foreground">ملف JSON — يمكن استيراده لاحقاً</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["القضايا", "العملاء", "الفواتير", "العقود", "المستندات", "المستخدمون"].map(item => (
                      <span key={item} className="text-xs bg-emerald-500/10 text-emerald-300/70 rounded-full px-2 py-0.5">
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                </div>

                <Button onClick={localDeviceBackup} disabled={isLocalDownloading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base h-11 gap-2">
                  {isLocalDownloading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> جارٍ إعداد الملف...</>
                    : <><Download className="h-5 w-5" /> تحميل نسخة احتياطية كاملة على جهازي</>
                  }
                </Button>

                <div className="grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
                  <div className="rounded-lg border border-sidebar-border p-2">
                    <p className="font-medium text-white">لا قيود</p>
                    <p>عدد مرات التحميل</p>
                  </div>
                  <div className="rounded-lg border border-sidebar-border p-2">
                    <p className="font-medium text-white">فوري</p>
                    <p>بدون جدولة</p>
                  </div>
                  <div className="rounded-lg border border-sidebar-border p-2">
                    <p className="font-medium text-white">آمن</p>
                    <p>لا يُخزَّن على السيرفر</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section-by-section exports */}
            <Card className="bg-sidebar border-sidebar-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-[#C9A84C]" /> تصدير أقسام محددة
                </CardTitle>
                <CardDescription>تحميل بيانات قسم معين بصيغة JSON أو CSV</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: "clients",   label: "العملاء (CRM)",  icon: "👤" },
                  { key: "cases",     label: "القضايا",         icon: "⚖️" },
                  { key: "invoices",  label: "الفواتير",        icon: "📄" },
                  { key: "contracts", label: "العقود",          icon: "📝" },
                ].map(section => (
                  <div key={section.key}
                    className="flex items-center justify-between rounded-lg border border-sidebar-border p-3 hover:border-emerald-500/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{section.icon}</span>
                      <span className="text-sm text-white font-medium">{section.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline"
                        className="text-xs border-sidebar-border hover:border-emerald-500/50 hover:text-emerald-400"
                        onClick={() => exportSection(section.key, "json")}>
                        <FileJson className="h-3.5 w-3.5 ml-1" /> JSON
                      </Button>
                      <Button size="sm" variant="outline"
                        className="text-xs border-sidebar-border hover:border-emerald-500/50 hover:text-emerald-400"
                        onClick={() => exportSection(section.key, "csv")}>
                        <FileSpreadsheet className="h-3.5 w-3.5 ml-1" /> CSV
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ TAB: PLATFORM BACKUP (plan-gated) ══ */}
          <TabsContent value="settings" className="mt-4 space-y-4">

            {/* Plan-gated notice */}
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
              <Crown className="h-5 w-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-300">نسخ المنصة — الجدولة والسحابي حسب الباقة</p>
                <p className="text-xs text-amber-300/60 mt-0.5">
                  النسخ اليدوي (حفظ على السيرفر) متاح للكل · الجدولة التلقائية وتخزين السحابة تتطلب ترقية الباقة
                </p>
              </div>
              <Badge style={{ backgroundColor: `${planColor}22`, color: planColor, borderColor: `${planColor}44` }}>{planName}</Badge>
            </div>

            <Card className="bg-sidebar border-sidebar-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-[#C9A84C]" /> النسخ التلقائي المجدوَل
                </CardTitle>
                <CardDescription>تحديد جدول النسخ الاحتياطي التلقائي على سيرفر المنصة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Enable toggle */}
                <div className="flex items-center justify-between rounded-lg border border-sidebar-border p-3">
                  <div>
                    <p className="text-sm font-medium text-white">تفعيل النسخ التلقائي</p>
                    <p className="text-xs text-muted-foreground mt-0.5">نسخ احتياطية تلقائية حسب الجدول المحدد</p>
                  </div>
                  <Switch checked={settings.isEnabled}
                    onCheckedChange={v => setSettings(s => ({ ...s, isEnabled: v }))} />
                </div>

                {/* Schedule */}
                <div className="space-y-2">
                  <Label className="text-white text-sm">تكرار النسخ الاحتياطي</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {allSchedules.map(s => {
                      const allowed = features.schedules.includes(s.value) || s.value === "none";
                      const isSelected = settings.schedule === s.value;
                      return (
                        <button key={s.value}
                          onClick={() => allowed && setSettings(p => ({ ...p, schedule: s.value }))}
                          className={`relative flex items-center gap-2 rounded-lg border p-3 text-sm transition-all text-right
                            ${isSelected
                              ? "border-[#C9A84C] bg-[#C9A84C]/10 text-white"
                              : allowed
                                ? "border-sidebar-border text-muted-foreground hover:border-[#C9A84C]/40 hover:text-white"
                                : "border-sidebar-border/30 text-muted-foreground/30 cursor-not-allowed"
                            }`}>
                          <span>{s.icon}</span>
                          <span className="font-medium">{s.label}</span>
                          {!allowed && <Lock className="h-3 w-3 absolute top-1.5 left-1.5 text-amber-500/50" />}
                        </button>
                      );
                    })}
                  </div>
                  {!features.schedules.includes("weekly") && (
                    <p className="text-xs text-amber-400/70">⚡ النسخ الأسبوعي والشهري متاح من باقة Professional</p>
                  )}
                </div>

                {/* Retention */}
                <div className="space-y-2">
                  <Label className="text-white text-sm">الاحتفاظ بالنسخ لمدة</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {retentionOptions.map(r => {
                      const allowed = features.retention.includes(r.value) || (r.value === 0 && features.unlimitedRetention);
                      const isSelected = settings.retentionDays === r.value;
                      return (
                        <button key={r.value}
                          onClick={() => allowed && setSettings(p => ({ ...p, retentionDays: r.value }))}
                          className={`relative flex items-center gap-2 rounded-lg border p-3 text-sm transition-all text-right
                            ${isSelected
                              ? "border-[#C9A84C] bg-[#C9A84C]/10 text-white"
                              : allowed
                                ? "border-sidebar-border text-muted-foreground hover:border-[#C9A84C]/40 hover:text-white"
                                : "border-sidebar-border/30 text-muted-foreground/30 cursor-not-allowed"
                            }`}>
                          <span className="font-medium">{r.label}</span>
                          {!allowed && <Lock className="h-3 w-3 absolute top-1.5 left-1.5 text-amber-500/50" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button onClick={saveSettings} disabled={saveSettingsMut.isPending}
                  className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold w-full">
                  {saveSettingsMut.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                  حفظ الإعدادات
                </Button>
              </CardContent>
            </Card>

            {/* Manual Backup */}
            <Card className="bg-sidebar border-sidebar-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <Database className="h-4 w-4 text-[#C9A84C]" /> نسخ احتياطي يدوي
                </CardTitle>
                <CardDescription>إنشاء نسخة احتياطية فورية لجميع بيانات المكتب</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-sidebar-border bg-background/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">محتويات النسخة الاحتياطية</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {["القضايا", "العملاء", "الفواتير", "العقود", "المستندات", "المستخدمون"].map(item => (
                          <span key={item} className="text-xs bg-sidebar-accent rounded-full px-2 py-0.5 text-muted-foreground">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                <Button onClick={createBackup} disabled={isCreatingBackup}
                  className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/80 border border-[#C9A84C]/40 text-[#C9A84C] font-bold">
                  {isCreatingBackup
                    ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" /> جارٍ إنشاء النسخة...</>
                    : <><Database className="h-4 w-4 ml-2" /> إنشاء نسخة احتياطية الآن</>
                  }
                </Button>
                {lastJob && (
                  <p className="text-xs text-center text-muted-foreground">
                    آخر نسخة: {formatDate(lastJob.createdAt)} · {formatBytes(lastJob.sizeBytes)}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ TAB: SECTION EXPORTS (all free) ══ */}
          <TabsContent value="export" className="mt-4 space-y-4">

            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 p-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">
                تصدير الأقسام مجاني لجميع الباقات — JSON و CSV متاحان دون قيود
              </p>
            </div>

            <Card className="bg-sidebar border-sidebar-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-white flex items-center gap-2">
                  <ArrowDownToLine className="h-4 w-4 text-[#C9A84C]" /> تصدير أقسام محددة
                </CardTitle>
                <CardDescription>تنزيل بيانات قسم معين بصيغة JSON أو CSV — مجاني لجميع الباقات</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { key: "clients",   label: "العملاء (CRM)",  icon: "👤" },
                  { key: "cases",     label: "القضايا",         icon: "⚖️" },
                  { key: "invoices",  label: "الفواتير",        icon: "📄" },
                  { key: "contracts", label: "العقود",          icon: "📝" },
                ].map(section => (
                  <div key={section.key}
                    className="flex items-center justify-between rounded-lg border border-sidebar-border p-3 hover:border-[#C9A84C]/30 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{section.icon}</span>
                      <span className="text-sm text-white font-medium">{section.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline"
                        className="text-xs border-sidebar-border hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
                        onClick={() => exportSection(section.key, "json")}>
                        <FileJson className="h-3.5 w-3.5 ml-1" /> JSON
                      </Button>
                      <Button size="sm" variant="outline"
                        className="text-xs border-sidebar-border hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
                        onClick={() => exportSection(section.key, "csv")}>
                        <FileSpreadsheet className="h-3.5 w-3.5 ml-1" /> CSV
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator className="bg-sidebar-border" />

                {/* Full office export — now free for all */}
                <div className="rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#C9A84C]">تصدير كامل المكتب</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ملف JSON شامل يحتوي على كل بيانات المكتب
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {["clients.json", "cases.json", "invoices.json", "contracts.json"].map(f => (
                          <span key={f} className="text-[10px] bg-[#C9A84C]/10 text-[#C9A84C]/70 rounded px-1.5 py-0.5">{f}</span>
                        ))}
                      </div>
                    </div>
                    <Button onClick={exportAll}
                      className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold shrink-0">
                      <Download className="h-4 w-4 ml-1.5" />
                      تصدير الكل
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ TAB: HISTORY ══ */}
          <TabsContent value="history" className="mt-4">
            <Card className="bg-sidebar border-sidebar-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <History className="h-4 w-4 text-[#C9A84C]" /> سجل النسخ الاحتياطي
                  </CardTitle>
                  <Button variant="outline" size="sm" className="text-xs border-sidebar-border hover:border-[#C9A84C]/50"
                    onClick={() => qc.invalidateQueries({ queryKey: ["backup-jobs"] })}>
                    <RefreshCw className="h-3 w-3 ml-1" /> تحديث
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {jobsQ.isLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin ml-2" /> جارٍ التحميل...
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Database className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm">لا توجد نسخ احتياطية بعد</p>
                    <p className="text-xs mt-1">أنشئ نسخة احتياطية يدوية من تبويب الإعدادات</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobs.map(job => (
                      <div key={job.id}
                        className="flex items-center justify-between rounded-lg border border-sidebar-border p-3 hover:border-[#C9A84C]/30 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0
                            ${job.status === "completed" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                            {job.status === "completed"
                              ? <CheckCircle2 className="h-4 w-4 text-green-400" />
                              : <AlertCircle className="h-4 w-4 text-red-400" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{job.fileName ?? "نسخة احتياطية"}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-muted-foreground">{formatDate(job.createdAt)}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">{formatBytes(job.sizeBytes)}</span>
                              <Badge variant="outline"
                                className={`text-[10px] py-0 px-1.5 ${job.type === "manual" ? "border-blue-500/30 text-blue-400" : "border-green-500/30 text-green-400"}`}>
                                {job.type === "manual" ? "يدوي" : "تلقائي"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 hover:text-[#C9A84C] hover:bg-[#C9A84C]/10"
                            onClick={() => downloadBackup(job)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 hover:text-red-400 hover:bg-red-400/10"
                            onClick={() => deleteJobMut.mutate(job.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ TAB: CLOUD STORAGE ══ */}
          <TabsContent value="cloud" className="mt-4">
            {!features.cloudStorage ? (
              <LockedBanner requiredPlan="Business" />
            ) : (
              <Card className="bg-sidebar border-sidebar-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-white flex items-center gap-2">
                    <UploadCloud className="h-4 w-4 text-[#C9A84C]" /> مزود التخزين السحابي
                  </CardTitle>
                  <CardDescription>ربط مزود التخزين لحفظ النسخ الاحتياطية تلقائياً</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Provider selection */}
                  <div className="space-y-2">
                    <Label className="text-white text-sm">اختر المزود</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {cloudProviders.map(p => (
                        <button key={p.value}
                          onClick={() => setSettings(s => ({ ...s, storageProvider: p.value }))}
                          className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-all text-right
                            ${settings.storageProvider === p.value
                              ? "border-[#C9A84C] bg-[#C9A84C]/10 text-white"
                              : "border-sidebar-border text-muted-foreground hover:border-[#C9A84C]/40 hover:text-white"
                            }`}>
                          {p.icon}
                          <span className="text-xs font-medium">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {settings.storageProvider !== "local" && (
                    <>
                      <Separator className="bg-sidebar-border" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { key: "accessKey",  label: "Access Key",  type: "password" },
                          { key: "secretKey",  label: "Secret Key",  type: "password" },
                          { key: "bucket",     label: "Bucket Name", type: "text" },
                          { key: "region",     label: "Region",      type: "text" },
                          { key: "endpoint",   label: "Endpoint URL (اختياري)", type: "text" },
                        ].map(field => (
                          <div key={field.key} className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{field.label}</Label>
                            <Input
                              type={field.type}
                              placeholder={field.label}
                              value={(cloudCfg as any)[field.key] ?? ""}
                              onChange={e => setCloudCfg(c => ({ ...c, [field.key]: e.target.value }))}
                              className="bg-background/50 border-sidebar-border text-white text-sm h-8"
                              dir="ltr"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm"
                          className="border-sidebar-border text-muted-foreground hover:border-[#C9A84C]/50 hover:text-white"
                          onClick={() => toast.info("اختبار الاتصال قيد التطوير")}>
                          <Shield className="h-3.5 w-3.5 ml-1.5" /> اختبار الاتصال
                        </Button>
                      </div>
                    </>
                  )}

                  <Button onClick={saveSettings} disabled={saveSettingsMut.isPending}
                    className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold w-full">
                    {saveSettingsMut.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                    حفظ إعدادات التخزين
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ══ TAB: IMPORT ══ */}
          <TabsContent value="import" className="mt-4 space-y-4">
            {!features.importData ? (
              <LockedBanner requiredPlan="Business" />
            ) : (
              <>
                <Card className="bg-sidebar border-sidebar-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      <Upload className="h-4 w-4 text-[#C9A84C]" /> استيراد البيانات
                    </CardTitle>
                    <CardDescription>استيراد البيانات من ملف JSON (من نسخة احتياطية سابقة)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div
                      className="rounded-xl border-2 border-dashed border-sidebar-border hover:border-[#C9A84C]/40 p-8 text-center cursor-pointer transition-colors"
                      onClick={() => importRef.current?.click()}>
                      <input ref={importRef} type="file" accept=".json" className="hidden"
                        onChange={e => setImportFile(e.target.files?.[0] ?? null)} />
                      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        {importFile ? importFile.name : "انقر لاختيار ملف JSON أو ZIP"}
                      </p>
                      <p className="text-xs text-muted-foreground/50 mt-1">الحد الأقصى: 50 MB</p>
                    </div>

                    {importFile && (
                      <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{importFile.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(importFile.size)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-400"
                          onClick={() => setImportFile(null)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/70 space-y-1">
                      <p className="font-medium text-amber-300">⚠️ تنبيه مهم قبل الاستيراد</p>
                      <p>• سيتم إضافة البيانات المستوردة إلى البيانات الموجودة (لن تُحذف البيانات الحالية)</p>
                      <p>• يدعم النظام استيراد: العملاء والقضايا من ملفات JSON</p>
                    </div>

                    <Button onClick={handleImport} disabled={!importFile}
                      className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold w-full">
                      <Upload className="h-4 w-4 ml-2" /> بدء الاستيراد
                    </Button>
                  </CardContent>
                </Card>

                {/* Restore section */}
                {features.restore && (
                  <Card className="bg-sidebar border-sidebar-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-white flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-[#C9A84C]" /> الاستعادة من نسخة سابقة
                      </CardTitle>
                      <CardDescription>استعادة بيانات محددة من سجل النسخ الاحتياطي</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {jobs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">لا توجد نسخ احتياطية للاستعادة منها</p>
                      ) : (
                        <div className="space-y-2">
                          {jobs.slice(0, 5).map(job => (
                            <div key={job.id} className="flex items-center justify-between rounded-lg border border-sidebar-border p-3">
                              <div>
                                <p className="text-sm text-white">{job.fileName}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(job.createdAt)} · {formatBytes(job.sizeBytes)}</p>
                              </div>
                              <Button variant="outline" size="sm"
                                className="text-xs border-sidebar-border hover:border-[#C9A84C]/50 hover:text-[#C9A84C]"
                                onClick={() => downloadBackup(job)}>
                                <Download className="h-3 w-3 ml-1" /> تحميل
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
  );
}
