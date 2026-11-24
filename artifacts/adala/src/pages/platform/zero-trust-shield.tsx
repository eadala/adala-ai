/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Unlock,
  Database, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Loader2, Play, Zap, Eye, Server, Activity, FileWarning
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface TableStatus {
  table: string; rlsEnabled: boolean; hasPolicy: boolean; hasOfficeId: boolean;
}
interface ZeroTrustStatus {
  coverage: number;
  rlsEnabled: number; withPolicy: number; totalWithOfficeId: number;
  tables: TableStatus[];
  database: { connections: { state: string; count: number }[] };
  checks: Record<string, boolean>;
}
interface ScanResult {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  leaks: { tbl: string; count: number }[];
  orphanAiTasks: number; orphanAuditLogs: number; suspiciousSessions: number;
  scannedAt: string;
}
interface RedTeamResult {
  score: number; passed: number; failed: number; total: number;
  tests: { name: string; passed: boolean; detail: string }[];
  runAt: string;
}

const RISK_STYLE = {
  LOW:    { cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", label: "منخفضة ✅" },
  MEDIUM: { cls: "text-yellow-400  bg-yellow-500/10  border-yellow-500/30",  label: "متوسطة ⚠️" },
  HIGH:   { cls: "text-red-400     bg-red-500/10     border-red-500/30",     label: "عالية 🔴" },
};

function CoverageRing({ pct }: { pct: number }) {
  const color = pct >= 90 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444";
  const r = 34; const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
      <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        strokeDashoffset={circ * 0.25} style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x="44" y="48" textAnchor="middle" fontSize="16" fontWeight="bold" fill={color}>{pct}%</text>
    </svg>
  );
}

export default function ZeroTrustShield() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"overview"|"tables"|"scan"|"redteam">("overview");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [redTeam, setRedTeam] = useState<RedTeamResult | null>(null);
  const [redTeaming, setRedTeaming] = useState(false);

  const { data: status, isLoading, refetch } = useQuery<ZeroTrustStatus>({
    queryKey: ["zt-status"],
    queryFn: () => authFetch(`${BASE}/api/zero-trust/status`).then(r => r.json()),
    staleTime: 60_000,
  });

  const applyRLS = useMutation({
    mutationFn: () => authFetch(`${BASE}/api/zero-trust/apply-rls`, { method: "POST" }).then(r => r.json()),
    onSuccess: (d) => {
      toast({ title: `✅ RLS مُطبَّق: ${d.applied?.length ?? 0} جدول`, description: d.errors?.length ? `${d.errors.length} خطأ` : undefined });
      refetch();
    },
    onError: () => toast({ title: "فشل تطبيق RLS", variant: "destructive" }),
  });

  async function runScan() {
    setScanning(true);
    try {
      const d = await authFetch(`${BASE}/api/zero-trust/scan`).then(r => r.json());
      setScan(d); setTab("scan");
    } catch { toast({ title: "فشل الفحص", variant: "destructive" }); }
    finally { setScanning(false); }
  }

  async function runRedTeam() {
    setRedTeaming(true);
    try {
      const d = await authFetch(`${BASE}/api/zero-trust/red-team`, { method: "POST" }).then(r => r.json());
      setRedTeam(d); setTab("redteam");
    } catch { toast({ title: "فشل الاختبار", variant: "destructive" }); }
    finally { setRedTeaming(false); }
  }

  const tabs = [
    { id: "overview", label: "نظرة عامة",   icon: Shield },
    { id: "tables",   label: "الجداول",       icon: Database },
    { id: "scan",     label: "فحص التسريب",   icon: Eye },
    { id: "redteam",  label: "Red Team",       icon: Zap },
  ] as const;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
          <Shield className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Zero Trust Shield</h1>
          <p className="text-sm text-muted-foreground">عزل متعدد الطبقات — RLS + AI Gateway + Tenant Firewall</p>
        </div>
        <div className="mr-auto flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5 h-8">
            <RefreshCw className="h-3.5 w-3.5" />تحديث
          </Button>
          <Button size="sm" onClick={runScan} disabled={scanning} className="gap-1.5 h-8 bg-orange-600 hover:bg-orange-700">
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            فحص تسريب
          </Button>
          <Button size="sm" onClick={runRedTeam} disabled={redTeaming} className="gap-1.5 h-8 bg-purple-700 hover:bg-purple-800">
            {redTeaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            Red Team
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl mb-5 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all shrink-0",
              tab === t.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* OVERVIEW */}
      {tab === "overview" && status && (
        <div className="space-y-5">
          {/* Coverage + key metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className={cn("sm:col-span-1 border", status.coverage >= 90 ? "border-emerald-500/30 bg-emerald-500/5" : "border-orange-500/30 bg-orange-500/5")}>
              <CardContent className="p-5 flex flex-col items-center gap-2">
                <CoverageRing pct={status.coverage} />
                <p className="text-sm font-semibold">RLS Coverage</p>
                <p className="text-xs text-muted-foreground text-center">
                  {status.rlsEnabled} من {status.totalWithOfficeId} جدول محمي
                </p>
                <Button size="sm" onClick={() => applyRLS.mutate()} disabled={applyRLS.isPending}
                  className="gap-1.5 w-full mt-1 bg-emerald-700 hover:bg-emerald-800">
                  {applyRLS.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  تطبيق RLS على الكل
                </Button>
              </CardContent>
            </Card>

            <Card className="sm:col-span-2 border-border/50">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm">حالة الطبقات الأمنية</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4 grid grid-cols-2 gap-3">
                {[
                  { key: "set_config_sync",   label: "set_config متزامن (awaited)",    icon: Server },
                  { key: "dual_tenant_vars",  label: "متغيران: app.tenant_id + current_tenant", icon: Database },
                  { key: "ai_gateway_active", label: "AI Data Gateway مفعّل",          icon: Shield },
                  { key: "search_sanitized",  label: "البحث مُعقَّم (% _ escaped)",    icon: Activity },
                  { key: "export_limited",    label: "التصدير محدود بـ 500 صف",        icon: FileWarning },
                ].map(c => {
                  const ok = status.checks[c.key];
                  return (
                    <div key={c.key} className="flex items-center gap-2">
                      {ok
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
                      <span className="text-xs text-muted-foreground">{c.label}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Architecture layers */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />طبقات Zero Trust المنفّذة</CardTitle></CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="space-y-2.5">
                {[
                  { layer: "Layer 0 — PostgreSQL RLS", desc: "سياسات على مستوى قاعدة البيانات — لا يمكن تجاوزها حتى بكود مكسور", color: "#EF4444" },
                  { layer: "Layer 1 — set_config (sync)", desc: "app.current_tenant + app.tenant_id مضبوطان قبل أي route handler", color: "#F59E0B" },
                  { layer: "Layer 2 — AsyncLocalStorage", desc: "getTenant() متاحة في كل مكان في الـ call stack", color: "#F97316" },
                  { layer: "Layer 3 — AI Data Gateway", desc: "AI لا يكتب SQL — يستدعي أدوات مُدققة فقط مع tenantId إلزامي", color: "#8B5CF6" },
                  { layer: "Layer 4 — tenantQuery wrapper", desc: "كل استعلام DB يمر عبر wrapper يُدقق tenant_id", color: "#06B6D4" },
                  { layer: "Layer 5 — Search Sanitization", desc: "% و _ و \\ مُعقَّمة قبل ILIKE لمنع pattern injection", color: "#10B981" },
                  { layer: "Layer 6 — Export Hard Limit", desc: "MAX 500 صف لأي تصدير — منع data dump", color: "#6366F1" },
                ].map((l, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                    <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: l.color + "25", color: l.color }}>
                      {i}
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: l.color }}>{l.layer}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{l.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TABLES */}
      {tab === "tables" && status && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "RLS مُفعَّل",    value: status.rlsEnabled,         color: "text-emerald-400" },
              { label: "بدون RLS",       value: status.totalWithOfficeId - status.rlsEnabled, color: "text-red-400" },
              { label: "سياسات ZTA",     value: status.withPolicy,          color: "text-blue-400" },
            ].map(s => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {status.tables.map(t => (
                <div key={t.table}
                  className={cn("flex items-center gap-3 px-3 py-2 rounded-lg border text-sm",
                    t.rlsEnabled && t.hasPolicy ? "border-emerald-500/20 bg-emerald-500/5"
                      : !t.hasOfficeId ? "border-border/30 bg-muted/20"
                      : "border-red-500/20 bg-red-500/5")}>
                  <Database className={cn("h-3.5 w-3.5 shrink-0",
                    t.rlsEnabled ? "text-emerald-400" : t.hasOfficeId ? "text-red-400" : "text-muted-foreground/40")} />
                  <span className="font-mono text-xs flex-1">{t.table}</span>
                  <div className="flex gap-1.5">
                    <Badge variant="outline" className={cn("text-[10px] h-4",
                      t.hasOfficeId ? "border-blue-500/40 text-blue-400" : "border-border/40 text-muted-foreground/50")}>
                      office_id
                    </Badge>
                    <Badge variant="outline" className={cn("text-[10px] h-4",
                      t.rlsEnabled ? "border-emerald-500/40 text-emerald-400" : t.hasOfficeId ? "border-red-500/40 text-red-400" : "border-border/40 opacity-40")}>
                      {t.rlsEnabled ? "RLS ✓" : "RLS ✗"}
                    </Badge>
                    {t.hasPolicy && (
                      <Badge variant="outline" className="text-[10px] h-4 border-purple-500/40 text-purple-400">ZTA</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* SCAN */}
      {tab === "scan" && (
        <div className="space-y-4">
          {!scan && !scanning && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Eye className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">اضغط "فحص تسريب" للبدء</p>
              <Button onClick={runScan} className="gap-2 bg-orange-600 hover:bg-orange-700">
                <Eye className="h-4 w-4" />بدء فحص التسريب
              </Button>
            </div>
          )}
          {scanning && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-orange-400" /><p className="text-sm text-muted-foreground">جارٍ الفحص...</p></div>
            </div>
          )}
          {scan && (
            <>
              <div className={cn("flex items-center gap-3 p-4 rounded-xl border", RISK_STYLE[scan.riskLevel].cls)}>
                {scan.riskLevel === "LOW" ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
                <div>
                  <p className="font-semibold">مستوى المخاطرة: {RISK_STYLE[scan.riskLevel].label}</p>
                  <p className="text-xs opacity-80">آخر فحص: {new Date(scan.scannedAt).toLocaleString("ar-SA")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "تسريبات مكتشفة", value: scan.leaks.length, warn: scan.leaks.length > 0 },
                  { label: "AI Tasks يتيمة",  value: scan.orphanAiTasks, warn: Number(scan.orphanAiTasks) > 0 },
                  { label: "Audit Logs يتيمة", value: scan.orphanAuditLogs, warn: Number(scan.orphanAuditLogs) > 0 },
                  { label: "جلسات مشبوهة",    value: scan.suspiciousSessions, warn: Number(scan.suspiciousSessions) > 0 },
                ].map(m => (
                  <Card key={m.label} className={cn("border", m.warn ? "border-red-500/30 bg-red-500/5" : "border-emerald-500/20 bg-emerald-500/5")}>
                    <CardContent className="p-3 text-center">
                      <p className={cn("text-2xl font-bold", m.warn ? "text-red-400" : "text-emerald-400")}>{m.value}</p>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {scan.leaks.length > 0 && (
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm text-red-400 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />تسريبات مكتشفة</CardTitle></CardHeader>
                  <CardContent className="px-4 pb-4 space-y-1.5">
                    {scan.leaks.map((l: any, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        <span className="font-mono">{l.tbl}</span>
                        <span className="text-muted-foreground">— {l.count} صف بدون office_id</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
              {scan.leaks.length === 0 && (
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="p-4 flex items-center gap-3">
                    <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
                    <p className="text-sm text-emerald-400">لا تسريبات مكتشفة — كل البيانات مُحاطة بـ office_id</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* RED TEAM */}
      {tab === "redteam" && (
        <div className="space-y-4">
          {!redTeam && !redTeaming && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Zap className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">اختبارات الاختراق التلقائية</p>
              <Button onClick={runRedTeam} className="gap-2 bg-purple-700 hover:bg-purple-800">
                <Play className="h-4 w-4" />تشغيل Red Team Suite
              </Button>
            </div>
          )}
          {redTeaming && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-purple-400" /><p className="text-sm text-muted-foreground">جارٍ تشغيل الاختبارات...</p></div>
            </div>
          )}
          {redTeam && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "النتيجة", value: `${redTeam.score}%`, cls: redTeam.score >= 80 ? "text-emerald-400" : "text-red-400" },
                  { label: "نجح",     value: redTeam.passed,      cls: "text-emerald-400" },
                  { label: "فشل",     value: redTeam.failed,      cls: redTeam.failed > 0 ? "text-red-400" : "text-muted-foreground" },
                  { label: "الكل",    value: redTeam.total,       cls: "text-foreground" },
                ].map(m => (
                  <Card key={m.label} className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className={cn("text-2xl font-bold", m.cls)}>{m.value}</p>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="space-y-2">
                {redTeam.tests.map((t, i) => (
                  <div key={i}
                    className={cn("flex items-start gap-3 p-3 rounded-xl border",
                      t.passed ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5")}>
                    {t.passed
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      : <XCircle     className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.detail}</p>
                    </div>
                    <Badge variant="outline" className={cn("mr-auto text-xs shrink-0",
                      t.passed ? "border-emerald-500/40 text-emerald-400" : "border-red-500/40 text-red-400")}>
                      {t.passed ? "PASS" : "FAIL"}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
