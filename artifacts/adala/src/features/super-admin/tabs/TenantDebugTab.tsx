/**
 * Tenant Identity Intelligence Panel
 * ────────────────────────────────────
 * Layer 2 — Enterprise Tenant Identity Platform (v2)
 *
 * Shows:
 *  • Resolution stats (success rate, sources breakdown)
 *  • Last 100 audit log entries with step-by-step trace
 *  • Users with unresolved tenant (problem detection)
 *  • Manual heal / cache invalidation tools
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2, XCircle, RefreshCw, ShieldCheck, Users,
  AlertTriangle, Activity, Fingerprint, Search,
} from "lucide-react";
import { DEV_API } from "@/features/super-admin/shared/api";

/* ── helpers ──────────────────────────────────────────────────────── */

function sourceColor(source: string) {
  if (source === "office_members") return "bg-emerald-100 text-emerald-800";
  if (source === "office_registry")  return "bg-blue-100 text-blue-800";
  if (source === "trial_offices")    return "bg-amber-100 text-amber-800";
  if (source === "header")           return "bg-purple-100 text-purple-800";
  return "bg-red-100 text-red-800";
}
function sourceAr(s: string) {
  const m: Record<string, string> = {
    office_members:  "أعضاء المكتب",
    office_registry: "سجل المكاتب",
    trial_offices:   "مكاتب التجريبي",
    header:          "مفتاح API",
    none:            "فشل",
  };
  return m[s] ?? s;
}

/* ── sub-components ───────────────────────────────────────────────── */

function StatsRow({ stats }: { stats: any }) {
  if (!stats) return null;
  const cards = [
    { label: "إجمالي التحقق",    value: stats.total,    icon: <Activity className="h-4 w-4" />,   color: "text-blue-600"    },
    { label: "ناجح",             value: stats.resolved,  icon: <CheckCircle2 className="h-4 w-4" />, color: "text-emerald-600" },
    { label: "فاشل (403)",       value: stats.failed,    icon: <XCircle className="h-4 w-4" />,    color: "text-red-600"     },
    { label: "نسبة النجاح",     value: `${stats.successRate}%`, icon: <ShieldCheck className="h-4 w-4" />, color: "text-purple-600" },
    { label: "آخر 24 ساعة",     value: stats.last24h,   icon: <RefreshCw className="h-4 w-4" />, color: "text-amber-600"   },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {cards.map(c => (
        <Card key={c.label} className="p-3">
          <div className={`flex items-center gap-2 ${c.color} mb-1`}>{c.icon}<span className="text-xs font-medium">{c.label}</span></div>
          <p className="text-2xl font-bold text-foreground">{c.value}</p>
        </Card>
      ))}
    </div>
  );
}

function SourcesChart({ sources }: { sources: Array<{ source: string; n: number }> }) {
  if (!sources?.length) return null;
  const max = Math.max(...sources.map(s => s.n), 1);
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2"><CardTitle className="text-sm">مصادر الهوية المستخدمة</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {sources.map(s => (
          <div key={s.source} className="flex items-center gap-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${sourceColor(s.source)}`}>{sourceAr(s.source)}</span>
            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(s.n / max) * 100}%` }} />
            </div>
            <span className="text-xs font-medium w-8 text-right">{s.n}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ── Main component ───────────────────────────────────────────────── */

export function TenantDebugTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const [debugUserId, setDebugUserId] = useState("");
  const [debugResult, setDebugResult] = useState<any>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [healUserId, setHealUserId] = useState("");
  const [healResult, setHealResult] = useState<any>(null);
  const [failedOnly, setFailedOnly] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["tenant-stats"],
    queryFn: () => DEV_API("/tenant/stats"),
    refetchInterval: 30_000,
  });

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["tenant-audit", failedOnly],
    queryFn: () => DEV_API(`/tenant/audit?limit=100&failed=${failedOnly ? 1 : 0}`),
    refetchInterval: 15_000,
  });

  const { data: unresolvedData } = useQuery({
    queryKey: ["tenant-unresolved"],
    queryFn: () => DEV_API("/tenant/unresolved"),
    refetchInterval: 60_000,
  });

  /* Debug a specific user */
  async function handleDebug() {
    if (!debugUserId.trim()) return;
    setDebugLoading(true);
    try {
      const r = await DEV_API(`/tenant/debug/${debugUserId.trim()}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setDebugResult(r);
    } catch {
      toast({ title: "خطأ", description: "فشل جلب بيانات المستخدم", variant: "destructive" });
    }
    setDebugLoading(false);
  }

  /* Heal (manual auto-link) */
  async function handleHeal(uid: string) {
    setHealUserId(uid);
    try {
      const r = await DEV_API(`/tenant/heal/${uid}`, { method: "POST" });
      setHealResult(r);
      qc.invalidateQueries({ queryKey: ["tenant-audit"] });
      qc.invalidateQueries({ queryKey: ["tenant-stats"] });
      qc.invalidateQueries({ queryKey: ["tenant-unresolved"] });
      toast({ title: r.success ? "تم الإصلاح" : "فشل الإصلاح", description: r.success ? `تم ربط المستخدم بالمكتب` : r.error });
    } catch {
      toast({ title: "خطأ", variant: "destructive" });
    }
    setHealUserId("");
  }

  /* Invalidate cache */
  async function handleInvalidate(uid: string) {
    await DEV_API(`/tenant/invalidate/${uid}`, { method: "POST" });
    toast({ title: "تم مسح الكاش", description: `تم إعادة تعيين كاش المستخدم` });
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2 mb-4">
        <Fingerprint className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">محرك هوية المستأجر (TIRE v2)</h2>
        <Badge variant="outline" className="text-xs">Enterprise</Badge>
      </div>

      {/* Stats row */}
      {statsLoading
        ? <div className="text-sm text-muted-foreground">جاري تحميل الإحصائيات…</div>
        : <StatsRow stats={stats} />
      }

      {stats?.bySource && <SourcesChart sources={stats.bySource} />}

      <Tabs defaultValue="logs">
        <TabsList className="mb-4">
          <TabsTrigger value="logs">سجل التحقق</TabsTrigger>
          <TabsTrigger value="debug">فحص مستخدم</TabsTrigger>
          <TabsTrigger value="unresolved">مشاكل الربط</TabsTrigger>
        </TabsList>

        {/* ── Audit Logs ── */}
        <TabsContent value="logs">
          <div className="flex items-center gap-3 mb-3">
            <Button
              size="sm"
              variant={failedOnly ? "default" : "outline"}
              onClick={() => setFailedOnly(v => !v)}
            >
              {failedOnly ? "الكل" : "الفاشل فقط"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["tenant-audit"] })}>
              <RefreshCw className="h-3 w-3 ml-1" /> تحديث
            </Button>
          </div>
          {logsLoading
            ? <div className="text-sm text-muted-foreground py-8 text-center">جاري التحميل…</div>
            : (
              <div className="rounded-md border overflow-auto max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">المكتب</TableHead>
                      <TableHead className="text-right">المصدر</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">خطوات التحقق</TableHead>
                      <TableHead className="text-right">الوقت</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(auditLogs as any[]).map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs max-w-[120px] truncate">{log.user_id}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[100px] truncate">{log.tenant_id ?? "—"}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${sourceColor(log.source)}`}>
                            {sourceAr(log.source)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {log.resolved
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            : <XCircle className="h-4 w-4 text-red-500" />}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                          <div className="flex flex-wrap gap-1">
                            {(log.steps as string[]).map((s, i) => (
                              <span key={i} className="bg-muted px-1 rounded text-[10px]">{s}</span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString("ar-SA")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                              onClick={() => handleInvalidate(log.user_id)}>مسح كاش</Button>
                            {!log.resolved && (
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-emerald-600"
                                onClick={() => handleHeal(log.user_id)}
                                disabled={healUserId === log.user_id}>
                                إصلاح
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(auditLogs as any[]).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                          لا توجد سجلات بعد — ستظهر عند أول عملية تحقق
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
        </TabsContent>

        {/* ── Debug a specific user ── */}
        <TabsContent value="debug">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-3">
              أدخل Clerk User ID لمعرفة مسار التحقق الكامل (trace) لهذا المستخدم.
            </p>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="user_2xxxxxxxxxxxxx"
                value={debugUserId}
                onChange={e => setDebugUserId(e.target.value)}
                className="font-mono text-sm"
                onKeyDown={e => e.key === "Enter" && handleDebug()}
              />
              <Button onClick={handleDebug} disabled={debugLoading}>
                {debugLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                فحص
              </Button>
            </div>
            {debugResult && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {debugResult.status === "resolved"
                    ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    : <XCircle className="h-5 w-5 text-red-500" />}
                  <span className="font-semibold">
                    {debugResult.status === "resolved" ? "تم التحقق بنجاح" : "فشل التحقق"}
                  </span>
                </div>
                {debugResult.tenantId && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">المكتب:</span> <code className="bg-muted px-1 rounded">{debugResult.tenantId}</code></div>
                    <div><span className="text-muted-foreground">الدور:</span> <Badge variant="outline">{debugResult.role}</Badge></div>
                    <div><span className="text-muted-foreground">المصدر:</span>
                      <span className={`mr-1 text-xs px-2 py-0.5 rounded-full ${sourceColor(debugResult.source)}`}>
                        {sourceAr(debugResult.source)}
                      </span>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">مسار التحقق:</p>
                  <div className="flex flex-wrap gap-1">
                    {(debugResult.steps ?? []).map((s: string, i: number) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded ${s.includes("FOUND") ? "bg-emerald-100 text-emerald-800" : s.includes("MISS") || s.includes("FAILED") ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}`}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 pt-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handleHeal(debugResult.userId ?? debugUserId)}>
                    إصلاح ربط المكتب
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleInvalidate(debugResult.userId ?? debugUserId)}>
                    مسح الكاش
                  </Button>
                  <Button size="sm" variant="outline" className="text-amber-600 border-amber-300"
                    onClick={async () => {
                      try {
                        const r = await DEV_API(`/tenant/recover/${debugResult.userId ?? debugUserId}`, { method: "POST" });
                        setDebugResult((prev: any) => ({ ...prev, recovered: r }));
                        toast({ title: r.success ? "تمت الاستعادة" : "فشلت الاستعادة", description: r.success ? `المكتب: ${r.tenantId} (الإصدار ${r.version})` : r.error });
                      } catch { toast({ title: "خطأ", variant: "destructive" }); }
                    }}>
                    استعادة الهوية
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ── Unresolved users ── */}
        <TabsContent value="unresolved">
          <div className="space-y-4">
            {unresolvedData?.unresolvedFromLogs?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    مستخدمون بدون مكتب محدد ({unresolvedData.unresolvedFromLogs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded border overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المستخدم</TableHead>
                          <TableHead className="text-right">آخر محاولة</TableHead>
                          <TableHead className="text-right">عدد المحاولات</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unresolvedData.unresolvedFromLogs.map((u: any) => (
                          <TableRow key={u.user_id}>
                            <TableCell className="font-mono text-xs">{u.user_id}</TableCell>
                            <TableCell className="text-xs">{new Date(u.last_attempt).toLocaleString("ar-SA")}</TableCell>
                            <TableCell><Badge variant="destructive">{u.attempts}</Badge></TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" className="h-6 text-xs"
                                onClick={() => handleHeal(u.user_id)}>إصلاح</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {unresolvedData?.unresolvedFromOnboarding?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    مستخدمون أكملوا الإعداد بدون ربط ({unresolvedData.unresolvedFromOnboarding.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded border overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المستخدم</TableHead>
                          <TableHead className="text-right">معرف المكتب</TableHead>
                          <TableHead className="text-right">تاريخ الانضمام</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unresolvedData.unresolvedFromOnboarding.map((u: any) => (
                          <TableRow key={u.user_id}>
                            <TableCell className="font-mono text-xs">{u.user_id}</TableCell>
                            <TableCell className="font-mono text-xs">{u.office_id ?? "—"}</TableCell>
                            <TableCell className="text-xs">{new Date(u.joined_at).toLocaleString("ar-SA")}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" className="h-6 text-xs"
                                onClick={() => handleHeal(u.user_id)}>إصلاح</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {(!unresolvedData || (unresolvedData?.unresolvedFromLogs?.length === 0 && unresolvedData?.unresolvedFromOnboarding?.length === 0)) && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                <p className="font-semibold text-emerald-700">لا توجد مشاكل في الربط</p>
                <p className="text-sm text-muted-foreground mt-1">جميع المستخدمين مرتبطون بمكاتبهم بشكل صحيح</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
