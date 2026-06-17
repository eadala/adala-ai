import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Rocket, Server, Github, BarChart3, AlertTriangle,
  HardDrive, Cpu, MemoryStick, Wifi, RefreshCw,
  CheckCircle2, Clock, GitBranch, GitCommit,
  Building2, Users, Briefcase, FileText, Banknote,
  Bot, Shield, Database, Activity, Archive,
  ChevronDown, ChevronUp, Plus,
  Circle, Loader2, Play, Zap, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { API } from "@/features/super-admin/shared/api";

/* ── Types ─────────────────────────────────────────── */
interface OverviewData {
  version: string;
  environment: string;
  uptimeProcess: string;
  uptimeSystem: string;
  deployedAt: string;
  server: {
    cpuPercent: number;
    cpuCores: number;
    cpuModel: string;
    ramUsedMB: number;
    ramTotalMB: number;
    ramPercent: number;
    heapUsedMB: number;
    heapTotalMB: number;
    platform: string;
    arch: string;
    nodeVersion: string;
    hostname: string;
  };
  github: {
    repository: string;
    branch: string;
    commit: string;
    workflow: string;
    runNumber: string;
  };
  saas: {
    offices: number;
    users: number;
    cases: number;
    contracts: number;
    mrr: number;
    aiCredits: number;
  };
  lastBackup: { status: string; at: string; file: string } | null;
  recentErrors: Array<{ action: string; resource: string; at: string }>;
}

/* ── Helpers ─────────────────────────────────────── */
function fmtBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}
function fmtNumber(n: number): string {
  return n.toLocaleString("ar-SA");
}
function fmtSAR(n: number): string {
  return `${n.toLocaleString("ar-SA")} ريال`;
}
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}
function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "الآن";
    if (m < 60) return `قبل ${m} دقيقة`;
    const h = Math.floor(m / 60);
    if (h < 24) return `قبل ${h} ساعة`;
    return `قبل ${Math.floor(h / 24)} يوم`;
  } catch { return iso; }
}

function StatusDot({ status }: { status: "online" | "warning" | "error" | "unknown" }) {
  const map = {
    online:  "bg-emerald-500",
    warning: "bg-amber-500",
    error:   "bg-red-500",
    unknown: "bg-zinc-400",
  };
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${map[status]} animate-pulse`} />
  );
}

function UsageBar({ label, used, total, percent, color = "blue" }: {
  label: string; used: string; total: string; percent: number; color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue:   "bg-blue-500",
    violet: "bg-violet-500",
    emerald:"bg-emerald-500",
    amber:  "bg-amber-500",
  };
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-mono">{used} / {total}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorMap[color] ?? colorMap.blue}`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="text-right text-xs text-muted-foreground">{percent}%</div>
    </div>
  );
}

/* ── Agent constants ───────────────────────────── */
const AGENT_LABELS: Record<string, string> = {
  case_review:      "مراجعة القضايا",
  invoice_reminder: "الفواتير المتأخرة",
  daily_snapshot:   "اللقطة اليومية",
  ai_health_check:  "فحص AI",
};
const AGENT_ICONS: Record<string, React.ReactNode> = {
  case_review:      <Briefcase className="h-3.5 w-3.5 text-blue-500" />,
  invoice_reminder: <Banknote className="h-3.5 w-3.5 text-amber-500" />,
  daily_snapshot:   <BarChart3 className="h-3.5 w-3.5 text-violet-500" />,
  ai_health_check:  <Bot className="h-3.5 w-3.5 text-cyan-500" />,
};

/* ══════════════════════════════════════════════════
   Main Tab
══════════════════════════════════════════════════ */
export function DeploymentCenterTab() {
  const qc = useQueryClient();
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [showAllBackups, setShowAllBackups] = useState(false);

  const { data, isLoading, error, dataUpdatedAt } = useQuery<OverviewData>({
    queryKey: ["deployment-overview"],
    queryFn: () => API("/deployment/overview"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: backups = [], isLoading: backupsLoading } = useQuery<any[]>({
    queryKey: ["deployment-backups"],
    queryFn: () => API("/deployment/backups"),
    staleTime: 30_000,
  });

  const { data: envData } = useQuery<any>({
    queryKey: ["deployment-environments"],
    queryFn: () => API("/deployment/environments"),
    staleTime: 300_000,
  });

  const { data: agentsData } = useQuery<{ logs: any[]; stats: any }>({
    queryKey: ["deployment-agents"],
    queryFn: () => API("/deployment/agents?limit=20"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: ollamaData } = useQuery<any>({
    queryKey: ["deployment-ollama"],
    queryFn: () => API("/deployment/ollama"),
    staleTime: 60_000,
  });

  const backupMutation = useMutation({
    mutationFn: () => API("/deployment/backup", { method: "POST" }),
    onSuccess: () => {
      toast.success("تم إنشاء نسخة احتياطية بنجاح");
      qc.invalidateQueries({ queryKey: ["deployment-backups"] });
      qc.invalidateQueries({ queryKey: ["deployment-overview"] });
    },
    onError: (err: any) => toast.error(err.message ?? "فشل إنشاء النسخة الاحتياطية"),
  });

  const agentRunMutation = useMutation({
    mutationFn: (type: string) => API("/deployment/agents/run", { method: "POST", body: JSON.stringify({ type }) }),
    onSuccess: (_, type) => {
      toast.success(`تم تشغيل الوكيل: ${AGENT_LABELS[type] ?? type}`);
      qc.invalidateQueries({ queryKey: ["deployment-agents"] });
    },
    onError: (err: any) => toast.error(err.message ?? "فشل تشغيل الوكيل"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>جاري تحميل بيانات النظام…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p>تعذّر تحميل بيانات مركز النشر</p>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["deployment-overview"] })}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> إعادة المحاولة
        </Button>
      </div>
    );
  }

  const srv = data.server;
  const ghub = data.github;
  const saas = data.saas;
  const envStatus = data.environment === "production" ? "online" : "warning";
  const visibleErrors = showAllErrors ? data.recentErrors : data.recentErrors.slice(0, 5);
  const visibleBackups = showAllBackups ? backups : backups.slice(0, 5);

  return (
    <div className="space-y-6 pb-10" dir="rtl">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-blue-200 dark:border-blue-800">
            <Rocket className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold">مركز النشر</h2>
            <p className="text-xs text-muted-foreground">
              آخر تحديث: {new Date(dataUpdatedAt).toLocaleTimeString("ar-SA")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
            <StatusDot status="online" />
            متصل
          </Badge>
          <Button
            variant="outline" size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["deployment-overview"] });
              qc.invalidateQueries({ queryKey: ["deployment-backups"] });
            }}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> تحديث
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          ROW 1 — Deployment Status + Server Monitoring
      ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1️⃣ حالة النشر */}
        <Card className="border-blue-100 dark:border-blue-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Rocket className="h-4 w-4 text-blue-500" />
              حالة النشر
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="الإصدار" value={`v${data.version}`} icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />} />
              <Stat label="البيئة"  value={data.environment === "production" ? "إنتاج" : data.environment} icon={<StatusDot status={envStatus} />} />
              <Stat label="وقت تشغيل الخادم" value={data.uptimeSystem} icon={<Clock className="h-3.5 w-3.5 text-blue-500" />} />
              <Stat label="وقت تشغيل التطبيق" value={data.uptimeProcess} icon={<Activity className="h-3.5 w-3.5 text-violet-500" />} />
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Node.js: </span>{srv.nodeVersion}
              <span className="mx-2">•</span>
              <span className="font-medium text-foreground">المنصة: </span>{srv.platform}/{srv.arch}
            </div>
            {data.lastBackup && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <Archive className="h-3.5 w-3.5 text-blue-400" />
                آخر نسخة احتياطية: {timeAgo(data.lastBackup.at)}
                <Badge variant="outline" className="mr-auto text-[10px] py-0">
                  {data.lastBackup.status === "completed" ? "مكتملة" : data.lastBackup.status}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2️⃣ مراقبة الخادم */}
        <Card className="border-violet-100 dark:border-violet-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-violet-500" />
              مراقبة الخادم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar
              label={<span className="flex items-center gap-1.5"><Cpu className="h-3 w-3" />المعالج (CPU)</span> as any}
              used={`${srv.cpuPercent}%`}
              total={`${srv.cpuCores} نوى`}
              percent={srv.cpuPercent}
              color={srv.cpuPercent > 80 ? "amber" : "violet"}
            />
            <UsageBar
              label={<span className="flex items-center gap-1.5"><MemoryStick className="h-3 w-3" />الذاكرة (RAM)</span> as any}
              used={fmtBytes(srv.ramUsedMB)}
              total={fmtBytes(srv.ramTotalMB)}
              percent={srv.ramPercent}
              color={srv.ramPercent > 80 ? "amber" : "blue"}
            />
            <UsageBar
              label={<span className="flex items-center gap-1.5"><Database className="h-3 w-3" />Heap Node.js</span> as any}
              used={fmtBytes(srv.heapUsedMB)}
              total={fmtBytes(srv.heapTotalMB)}
              percent={Math.round((srv.heapUsedMB / srv.heapTotalMB) * 100)}
              color="emerald"
            />
            <div className="text-xs text-muted-foreground pt-1 border-t">
              <span className="font-medium text-foreground">Hostname: </span>
              <span className="font-mono">{srv.hostname}</span>
              <span className="mx-2">•</span>
              <span className="font-medium text-foreground">CPU: </span>
              <span className="font-mono">{srv.cpuModel.slice(0, 30)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════
          ROW 2 — GitHub Center + SaaS Monitoring
      ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 3️⃣ مركز GitHub */}
        <Card className="border-zinc-200 dark:border-zinc-700/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Github className="h-4 w-4" />
              مركز GitHub
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <GithubRow icon={<Database className="h-3.5 w-3.5 text-zinc-500" />}   label="المستودع"   value={ghub.repository} mono />
              <GithubRow icon={<GitBranch className="h-3.5 w-3.5 text-blue-500" />}  label="الفرع"       value={ghub.branch} mono />
              <GithubRow icon={<GitCommit className="h-3.5 w-3.5 text-violet-500" />} label="آخر Commit" value={ghub.commit} mono />
              <GithubRow icon={<Rocket className="h-3.5 w-3.5 text-emerald-500" />}  label="Workflow"    value={ghub.workflow} />
              <GithubRow icon={<Activity className="h-3.5 w-3.5 text-amber-500" />}  label="Run #"       value={ghub.runNumber} mono />
              <Separator />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5 text-emerald-500" />
                <span>المفاتيح الحساسة محمية — تُدار عبر Coolify / GitHub Secrets فقط.</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4️⃣ مراقبة SaaS */}
        <Card className="border-emerald-100 dark:border-emerald-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
              مراقبة SaaS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <SaasKpi icon={<Building2 className="h-4 w-4 text-blue-500" />}   label="المكاتب"     value={fmtNumber(saas.offices)} color="blue" />
              <SaasKpi icon={<Users className="h-4 w-4 text-violet-500" />}     label="المستخدمون"  value={fmtNumber(saas.users)} color="violet" />
              <SaasKpi icon={<Briefcase className="h-4 w-4 text-amber-500" />}  label="القضايا"     value={fmtNumber(saas.cases)} color="amber" />
              <SaasKpi icon={<FileText className="h-4 w-4 text-pink-500" />}    label="العقود"      value={fmtNumber(saas.contracts)} color="pink" />
              <SaasKpi icon={<Banknote className="h-4 w-4 text-emerald-500" />} label="MRR"         value={fmtSAR(saas.mrr)} color="emerald" wide />
              <SaasKpi icon={<Bot className="h-4 w-4 text-cyan-500" />}         label="AI هذا الشهر" value={`${fmtNumber(saas.aiCredits)} نقطة`} color="cyan" wide />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════
          ROW 3 — Error Logs + Backups + Environments
      ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* 5️⃣ سجل الأخطاء */}
        <Card className="border-red-100 dark:border-red-900/30 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              سجل الأخطاء
              {data.recentErrors.length > 0 && (
                <Badge variant="destructive" className="mr-auto text-[10px] py-0 h-4">
                  {data.recentErrors.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentErrors.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <p className="text-xs">لا توجد أخطاء مسجّلة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleErrors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2 border border-red-100 dark:border-red-900/30">
                    <Circle className="h-2 w-2 mt-0.5 fill-red-500 text-red-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-red-700 dark:text-red-400 truncate">{e.action}</p>
                      <p className="text-muted-foreground truncate">{e.resource}</p>
                      <p className="text-muted-foreground/70">{timeAgo(e.at)}</p>
                    </div>
                  </div>
                ))}
                {data.recentErrors.length > 5 && (
                  <Button
                    variant="ghost" size="sm" className="w-full text-xs h-7"
                    onClick={() => setShowAllErrors(v => !v)}
                  >
                    {showAllErrors
                      ? <><ChevronUp className="h-3 w-3 mr-1" />عرض أقل</>
                      : <><ChevronDown className="h-3 w-3 mr-1" />عرض الكل ({data.recentErrors.length})</>}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6️⃣ النسخ الاحتياطية */}
        <Card className="border-amber-100 dark:border-amber-900/30 lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-amber-500" />
                النسخ الاحتياطية
              </CardTitle>
              <Button
                size="sm" variant="outline"
                className="h-7 text-xs gap-1.5 border-amber-200 hover:bg-amber-50"
                onClick={() => backupMutation.mutate()}
                disabled={backupMutation.isPending}
              >
                {backupMutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Plus className="h-3 w-3" />}
                نسخة جديدة
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {backupsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : backups.length === 0 ? (
              <div className="flex flex-col items-center py-6 gap-2 text-muted-foreground">
                <Archive className="h-6 w-6" />
                <p className="text-xs">لا توجد نسخ احتياطية</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleBackups.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2">
                    <Archive className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono truncate text-[11px]">{b.file_name ?? `backup-${b.id}`}</p>
                      <p className="text-muted-foreground">{fmtDate(b.created_at)}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 flex-shrink-0 ${
                        b.status === "completed" ? "text-emerald-600 border-emerald-200" :
                        b.status === "pending"   ? "text-amber-600 border-amber-200" :
                        "text-red-600 border-red-200"
                      }`}
                    >
                      {b.status === "completed" ? "مكتملة" :
                       b.status === "pending"   ? "جارٍ" : b.status}
                    </Badge>
                  </div>
                ))}
                {backups.length > 5 && (
                  <Button
                    variant="ghost" size="sm" className="w-full text-xs h-7"
                    onClick={() => setShowAllBackups(v => !v)}
                  >
                    {showAllBackups
                      ? <><ChevronUp className="h-3 w-3 mr-1" />عرض أقل</>
                      : <><ChevronDown className="h-3 w-3 mr-1" />عرض الكل ({backups.length})</>}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7️⃣ إدارة البيئة */}
        <Card className="border-zinc-200 dark:border-zinc-700/60 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wifi className="h-4 w-4 text-cyan-500" />
              البيئات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {["production", "staging", "development"].map((env) => {
              const isCurrent = envData?.current === env || (env === "production" && !envData?.current);
              const labels: Record<string, string> = {
                production:  "الإنتاج",
                staging:     "التجريبية",
                development: "التطوير",
              };
              const colors: Record<string, string> = {
                production:  "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30",
                staging:     "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30",
                development: "text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/30",
              };
              return (
                <div key={env} className={`flex items-center justify-between rounded-lg px-3 py-2.5 border ${isCurrent ? colors[env] : "border-muted bg-muted/30"}`}>
                  <span className="text-sm font-medium">{labels[env]}</span>
                  <div className="flex items-center gap-2">
                    {isCurrent && <StatusDot status={env === "production" ? "online" : "warning"} />}
                    <Badge variant="outline" className={`text-[10px] py-0 ${isCurrent ? "" : "opacity-40"}`}>
                      {isCurrent ? "نشط" : "غير نشط"}
                    </Badge>
                  </div>
                </div>
              );
            })}

            <Separator />

            {/* Safe env vars */}
            {envData?.safeVars && Object.keys(envData.safeVars).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">متغيرات البيئة المرئية</p>
                {Object.entries(envData.safeVars).slice(0, 6).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 font-mono text-[11px] bg-muted/50 rounded px-2 py-1">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="mr-auto text-foreground/80 truncate max-w-[100px]">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-900/30 mt-2">
              <Shield className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>المتغيرات الحساسة مخفية. تُدار عبر Coolify أو GitHub Secrets فقط.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══════════════════════════════════════════════
          ROW 4 — AI Agents + Ollama Status
      ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 8️⃣ وكلاء AI التلقائيون */}
        <Card className="border-blue-100 dark:border-blue-900/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-500" />
                وكلاء AI التلقائيون
                {agentsData?.stats && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4 mr-auto">
                    {agentsData.stats.last24h} / 24h
                  </Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Kpis */}
            {agentsData?.stats && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/30 rounded-lg px-2 py-2 text-center">
                  <p className="text-lg font-bold text-emerald-600">{agentsData.stats.completed}</p>
                  <p className="text-[10px] text-muted-foreground">مكتملة</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 rounded-lg px-2 py-2 text-center">
                  <p className="text-lg font-bold text-red-600">{agentsData.stats.failed}</p>
                  <p className="text-[10px] text-muted-foreground">فشل</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 rounded-lg px-2 py-2 text-center">
                  <p className="text-lg font-bold text-blue-600">{agentsData.stats.total}</p>
                  <p className="text-[10px] text-muted-foreground">إجمالي</p>
                </div>
              </div>
            )}

            {/* Quick run buttons */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(AGENT_LABELS).map(([type, label]) => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 justify-start"
                  disabled={agentRunMutation.isPending}
                  onClick={() => agentRunMutation.mutate(type)}
                >
                  {agentRunMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 text-blue-500" />
                  )}
                  {label}
                </Button>
              ))}
            </div>

            <Separator />

            {/* Recent logs */}
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              {(agentsData?.logs ?? []).slice(0, 8).map((log: any) => (
                <div key={log.id} className="flex items-start gap-2 text-xs rounded-lg px-2.5 py-2 bg-muted/40">
                  {AGENT_ICONS[log.agent_type] ?? <Bot className="h-3.5 w-3.5" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{AGENT_LABELS[log.agent_type] ?? log.agent_type}</p>
                    <p className="text-muted-foreground truncate text-[11px]">{log.summary}</p>
                    <p className="text-muted-foreground/60 text-[10px]">{timeAgo(log.created_at)}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] py-0 flex-shrink-0 ${
                      log.status === "completed" ? "text-emerald-600 border-emerald-200" :
                      log.status === "running"   ? "text-blue-600 border-blue-200" :
                      "text-red-600 border-red-200"
                    }`}
                  >
                    {log.status === "completed" ? "✓" : log.status === "running" ? "⟳" : "✗"}
                  </Badge>
                </div>
              ))}
              {(!agentsData?.logs || agentsData.logs.length === 0) && (
                <div className="flex flex-col items-center py-4 gap-2 text-muted-foreground">
                  <Bot className="h-6 w-6" />
                  <p className="text-xs">لم يعمل أي وكيل بعد — سيبدأ في الساعة القادمة</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 9️⃣ Ollama — النموذج المحلي */}
        <Card className="border-cyan-100 dark:border-cyan-900/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-500" />
              Ollama — نموذج AI محلي
              {ollamaData?.online && (
                <Badge className="mr-auto text-[10px] py-0 h-4 bg-emerald-500">متصل</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!ollamaData ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : !ollamaData.configured ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 items-center py-4 text-muted-foreground">
                  <XCircle className="h-7 w-7 text-zinc-400" />
                  <p className="text-sm font-medium">Ollama غير مُفعَّل</p>
                  <p className="text-xs text-center">أضف OLLAMA_BASE_URL في متغيرات البيئة لتفعيل النموذج المحلي</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono space-y-1">
                  <p className="text-muted-foreground"># على خادم Hetzner:</p>
                  <p>curl -fsSL https://ollama.ai/install.sh | sh</p>
                  <p>ollama pull gemma3:4b</p>
                  <p className="text-muted-foreground mt-2"># في متغيرات Coolify:</p>
                  <p>OLLAMA_BASE_URL=http://localhost:11434</p>
                  <p>OLLAMA_MODEL=gemma3:4b</p>
                  <p>OLLAMA_FALLBACK_ENABLED=true</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Status card */}
                <div className={`flex items-center gap-3 rounded-xl p-3 border ${
                  ollamaData.online
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40"
                    : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40"
                }`}>
                  <div className={`p-2 rounded-lg ${ollamaData.online ? "bg-emerald-100" : "bg-red-100"}`}>
                    <Zap className={`h-4 w-4 ${ollamaData.online ? "text-emerald-600" : "text-red-600"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{ollamaData.online ? "متصل ويعمل" : "غير متاح"}</p>
                    <p className="text-xs text-muted-foreground">
                      {ollamaData.online ? `زمن الاستجابة: ${ollamaData.latencyMs}ms` : ollamaData.error}
                    </p>
                  </div>
                </div>

                {/* Info rows */}
                <div className="space-y-2">
                  <GithubRow icon={<Database className="h-3.5 w-3.5 text-cyan-500" />} label="الخادم" value={ollamaData.base ?? "—"} mono />
                  <GithubRow icon={<Bot className="h-3.5 w-3.5 text-violet-500" />}    label="النموذج" value={ollamaData.model} mono />
                  <GithubRow
                    icon={<Shield className="h-3.5 w-3.5 text-emerald-500" />}
                    label="كاحتياطي"
                    value={ollamaData.fallbackEnabled ? "مفعّل ✓" : "معطّل"}
                  />
                  {ollamaData.modelReady !== undefined && (
                    <GithubRow
                      icon={<CheckCircle2 className={`h-3.5 w-3.5 ${ollamaData.modelReady ? "text-emerald-500" : "text-amber-500"}`} />}
                      label="النموذج جاهز"
                      value={ollamaData.modelReady ? "نعم" : "يحتاج تحميل: ollama pull " + ollamaData.model}
                    />
                  )}
                </div>

                {/* Available models */}
                {ollamaData.availableModels && ollamaData.availableModels.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">النماذج المحمّلة</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ollamaData.availableModels.map((m: string) => (
                        <Badge key={m} variant="outline" className="text-[10px] py-0 font-mono">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-cyan-50 dark:bg-cyan-950/20 rounded-lg px-3 py-2 border border-cyan-100 dark:border-cyan-900/30">
                  <Shield className="h-3.5 w-3.5 text-cyan-500 flex-shrink-0 mt-0.5" />
                  <span>
                    {ollamaData.fallbackEnabled
                      ? "إذا فشل Gemini/OpenAI، يتولى Ollama المحلي تلقائياً."
                      : "فعّل OLLAMA_FALLBACK_ENABLED=true للتبديل التلقائي عند انقطاع الخدمات السحابية."}
                  </span>
                </div>

                <Button
                  variant="outline" size="sm" className="w-full text-xs gap-1.5"
                  onClick={() => qc.invalidateQueries({ queryKey: ["deployment-ollama"] })}
                >
                  <RefreshCw className="h-3 w-3" /> تحديث حالة Ollama
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

/* ── Sub-components ─────────────────────────────── */
function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-muted/40 rounded-lg px-3 py-2.5 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-semibold">{value}</span>
      </div>
    </div>
  );
}

function GithubRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {icon}
      <span className="text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className={`font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function SaasKpi({ icon, label, value, color, wide }: {
  icon: React.ReactNode; label: string; value: string; color: string; wide?: boolean;
}) {
  const bg: Record<string, string> = {
    blue:    "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40",
    violet:  "bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/40",
    amber:   "bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40",
    pink:    "bg-pink-50 dark:bg-pink-950/30 border-pink-100 dark:border-pink-900/40",
    emerald: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/40",
    cyan:    "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-100 dark:border-cyan-900/40",
  };
  return (
    <div className={`rounded-xl border px-3 py-3 space-y-1 ${bg[color] ?? ""} ${wide ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
