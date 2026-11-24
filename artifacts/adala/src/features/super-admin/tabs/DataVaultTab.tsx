/**
 * Data Vault — لوحة العزل المؤسسي
 * ─────────────────────────────────────────────────────────────────
 * Super Admin only.
 * 4 tabs:
 *   1. درجة العزل    — Isolation Score (0-100 gauge)
 *   2. حالة RLS      — Per-table RLS status + enable button
 *   3. Red Team      — Automated cross-tenant isolation tests
 *   4. أحداث الأمن  — Security events log
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, Shield, ShieldCheck, ShieldX, ShieldAlert,
  Database, Play, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Lock, Unlock, Zap, Eye, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/features/super-admin/shared/api";

/* ── Isolation Score Gauge ───────────────────────────────────────── */
function ScoreGauge({ score, grade, label }: { score: number; grade: string; label: string }) {
  const color =
    score >= 85 ? "text-emerald-400" :
    score >= 70 ? "text-blue-400" :
    score >= 55 ? "text-amber-400" : "text-red-400";
  const bg =
    score >= 85 ? "bg-emerald-500/10 border-emerald-500/30" :
    score >= 70 ? "bg-blue-500/10 border-blue-500/30" :
    score >= 55 ? "bg-amber-500/10 border-amber-500/30" : "bg-red-500/10 border-red-500/30";
  const barColor =
    score >= 85 ? "[&>div]:bg-emerald-500" :
    score >= 70 ? "[&>div]:bg-blue-500" :
    score >= 55 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500";

  return (
    <div className={cn("rounded-2xl border p-6 text-center", bg)}>
      <div className={cn("text-6xl font-black mb-2", color)}>{score}</div>
      <div className="text-xs text-muted-foreground mb-1">/ 100</div>
      <div className={cn("text-2xl font-black", color)}>{grade}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
      <Progress value={score} className={cn("h-3 mt-4", barColor)} />
    </div>
  );
}

/* ── Score Tab ───────────────────────────────────────────────────── */
function ScoreTab() {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["vault", "score"],
    queryFn: () => API("/data-vault/isolation-score"),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const b = data?.breakdown ?? {};
  const items = [
    { label: "تغطية RLS",        score: b.rls?.score ?? 0,             max: 40, detail: `${b.rls?.secured ?? 0}/${b.rls?.total ?? 0} جداول محمية` },
    { label: "Tenant Middleware", score: b.middleware?.score ?? 0,       max: 30, detail: b.middleware?.note ?? "" },
    { label: "فهارس office_id",  score: b.indexes?.score ?? 0,          max: 15, detail: `${b.indexes?.count ?? 0} index` },
    { label: "أحداث أمنية",     score: b.securityEvents?.score ?? 0,   max: 15, detail: `${b.securityEvents?.recent_incidents ?? 0} حادثة حديثة` },
  ];

  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-1">
          <ScoreGauge score={data?.score ?? 0} grade={data?.grade ?? "—"} label={data?.label ?? "—"} />
        </div>
        <div className="md:col-span-2 space-y-3">
          {items.map(item => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">{item.score}/{item.max} نقطة — {item.detail}</span>
              </div>
              <Progress value={Math.round((item.score / item.max) * 100)} className="h-2" />
            </div>
          ))}
          <Button size="sm" variant="outline" className="gap-2 h-7 text-xs w-full" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> تحديث التقييم
          </Button>
        </div>
      </div>

      {/* Guidance */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">خريطة الطريق للوصول إلى Enterprise Ready</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { done: (data?.score ?? 0) >= 30, label: "تفعيل requireAuthWithTenant على جميع المسارات" },
              { done: (b.rls?.secured ?? 0) >= 20, label: "تفعيل RLS على الجداول الحساسة (20+ جدول)" },
              { done: (b.indexes?.count ?? 0) >= 15, label: "إنشاء فهارس office_id على جميع الجداول" },
              { done: (b.rls?.secured ?? 0) >= 40, label: "تغطية RLS شاملة (40+ جدول)" },
              { done: (data?.score ?? 0) >= 85, label: "درجة Enterprise Ready (85+)" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {step.done
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                <span className={step.done ? "line-through text-muted-foreground" : ""}>{step.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── RLS Status Tab ──────────────────────────────────────────────── */
function RLSTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "needs_rls" | "secured">("all");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["vault", "rls-status"],
    queryFn: () => API("/data-vault/rls-status"),
    staleTime: 30_000,
  });

  const enableMut = useMutation({
    mutationFn: (tables?: string[]) => API("/data-vault/enable-rls", {
      method: "POST",
      body: JSON.stringify(tables ? { tables } : {}),
    }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["vault"] });
      toast({ title: `✅ تم تفعيل RLS على ${d.count} جدول` });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const tables: any[] = data?.tables ?? [];
  const summary = data?.summary ?? {};
  const filtered = tables.filter((t: any) => {
    if (filter === "needs_rls") return t.has_office_id && !t.rls_enabled;
    if (filter === "secured")   return t.rls_enabled;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "إجمالي الجداول", val: summary.total ?? 0, color: "text-primary" },
          { label: "لها office_id",  val: summary.withOid ?? 0, color: "text-blue-400" },
          { label: "محمية بـ RLS",   val: summary.secured ?? 0, color: "text-emerald-400" },
          { label: "تحتاج حماية",   val: summary.needRLS ?? 0,  color: "text-red-400" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={cn("text-2xl font-black", s.color)}>{s.val}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all","needs_rls","secured"] as const).map(f => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"}
            className="h-7 text-xs" onClick={() => setFilter(f)}>
            {f === "all" ? "الكل" : f === "needs_rls" ? "تحتاج حماية" : "محمية"}
          </Button>
        ))}
        <div className="mr-auto flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> تحديث
          </Button>
          {summary.needRLS > 0 && (
            <Button size="sm" className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90 text-white"
              onClick={() => enableMut.mutate(undefined)} disabled={enableMut.isPending}>
              {enableMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              تفعيل RLS على الكل ({summary.needRLS} جدول)
            </Button>
          )}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
          {filtered.map((t: any) => {
            const isProtected = t.rls_enabled;
            const needsRLS    = t.has_office_id && !t.rls_enabled;
            const isShared    = !t.has_office_id;

            return (
              <div key={t.table_name}
                className={cn("flex items-center justify-between px-3 py-2 rounded-lg border text-xs",
                  isProtected ? "border-emerald-500/20 bg-emerald-500/5" :
                  needsRLS    ? "border-red-500/20 bg-red-500/5" :
                  "border-border/30 bg-muted/10")}>
                <div className="flex items-center gap-2">
                  {isProtected
                    ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    : needsRLS
                    ? <ShieldX className="h-3.5 w-3.5 text-red-400" />
                    : <Shield className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  <span className={cn("font-mono", needsRLS ? "text-red-400" : "")}>
                    {t.table_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {t.has_office_id && <Badge variant="outline" className="text-[9px]">office_id ✓</Badge>}
                  {t.rls_enabled   && <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-0">{t.policy_count} policies</Badge>}
                  {needsRLS && (
                    <Button size="sm" variant="outline" className="h-5 text-[10px] px-1.5"
                      onClick={() => enableMut.mutate([t.table_name])} disabled={enableMut.isPending}>
                      تفعيل
                    </Button>
                  )}
                  {isShared && <span className="text-[9px] text-muted-foreground/40">مشترك</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Red Team Tab ────────────────────────────────────────────────── */
function RedTeamTab({ toast }: { toast: any }) {
  const [results, setResults] = useState<any>(null);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    try {
      const data = await API("/data-vault/red-team", { method: "POST" });
      setResults(data);
      const { passed, failed } = data.summary;
      toast({
        title: failed === 0 ? `✅ جميع الاختبارات نجحت (${passed})` : `⚠️ ${failed} اختبار فشل من ${passed + failed}`,
        variant: failed > 0 ? "destructive" : "default",
      });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">اختبارات Red Team — محاكاة التسريب بين المكاتب</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                تحاول هذه الاختبارات الوصول لبيانات مكتب من سياق مكتب آخر.
                أي فشل يعني تسريب محتمل يجب إصلاحه.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full gap-2 bg-primary hover:bg-primary/90 text-white font-bold"
        onClick={runTests} disabled={running}>
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? "الاختبارات تعمل..." : "تشغيل اختبارات Red Team"}
      </Button>

      {results && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "درجة الأمان",  val: `${results.summary.score}%`, color: results.summary.score >= 80 ? "text-emerald-400" : "text-red-400" },
              { label: "نجحت",        val: results.summary.passed,     color: "text-emerald-400" },
              { label: "فشلت",        val: results.summary.failed,     color: "text-red-400" },
              { label: "تخطت",        val: results.summary.skipped,    color: "text-muted-foreground" },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-3 text-center">
                  <div className={cn("text-xl font-black", s.color)}>{s.val}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Test results */}
          <div className="space-y-2">
            {results.tests.map((t: any, i: number) => (
              <div key={i} className={cn("flex items-start gap-3 p-3 rounded-xl border text-sm",
                t.status === "PASS" ? "border-emerald-500/20 bg-emerald-500/5" :
                t.status === "FAIL" ? "border-red-500/20 bg-red-500/5" :
                "border-border/30 bg-muted/10")}>
                {t.status === "PASS"
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  : t.status === "FAIL"
                  ? <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  : <div className="h-4 w-4 rounded-full bg-muted-foreground/20 shrink-0 mt-0.5" />}
                <div>
                  <p className="font-medium">{t.test}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.detail}</p>
                </div>
                <Badge className={cn("mr-auto text-[10px]",
                  t.status === "PASS" ? "bg-emerald-500/10 text-emerald-400 border-0" :
                  t.status === "FAIL" ? "bg-red-500/10 text-red-400 border-0" :
                  "bg-muted/40 text-muted-foreground border-0")}>
                  {t.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Security Events Tab ─────────────────────────────────────────── */
function SecurityEventsTab() {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["vault", "security-events"],
    queryFn: () => API("/data-vault/security-events"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const events: any[] = data?.events ?? [];
  const stats = data?.stats ?? {};

  const SEV_META: Record<string, { color: string; bg: string }> = {
    critical: { color: "text-red-500",    bg: "bg-red-500/10" },
    high:     { color: "text-orange-400", bg: "bg-orange-500/10" },
    medium:   { color: "text-amber-400",  bg: "bg-amber-500/10" },
    low:      { color: "text-blue-400",   bg: "bg-blue-500/10" },
    info:     { color: "text-muted-foreground", bg: "bg-muted/20" },
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "إجمالي",       val: stats.total ?? 0,    color: "text-primary" },
          { label: "حرجة",        val: stats.critical ?? 0,  color: "text-red-500" },
          { label: "عالية",       val: stats.high ?? 0,      color: "text-orange-400" },
          { label: "آخر 24 ساعة", val: stats.last_24h ?? 0,  color: "text-amber-400" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={cn("text-2xl font-black", s.color)}>{s.val}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
        events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <ShieldCheck className="h-12 w-12 opacity-20" />
            <p className="text-sm">لا توجد أحداث أمنية مسجّلة</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[440px] overflow-y-auto">
            {events.map((e: any) => {
              const sev = SEV_META[e.severity] ?? SEV_META.info;
              return (
                <div key={e.id} className={cn("p-3 rounded-xl border text-xs", sev.bg)}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-[9px]", sev.color, sev.bg)}>{e.severity}</Badge>
                      <span className="font-mono font-bold">{e.event_type}</span>
                    </div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(e.created_at).toLocaleString("ar-SA")}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{e.description}</p>
                  {e.office_id && <p className="text-[10px] text-muted-foreground/60 mt-0.5">Office: {e.office_id}</p>}
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN TAB
══════════════════════════════════════════════════════════════════ */
export function DataVaultTab({ toast }: { toast: any }) {
  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h2 className="font-black text-lg flex items-center gap-2">
            مخزن البيانات الآمن
            <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              Zero Trust
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground">
            عزل البيانات بين المكاتب — RLS + JWT + Tenant Context
          </p>
        </div>
      </div>

      <Tabs defaultValue="score">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="score"   className="text-xs"><Zap className="h-3.5 w-3.5 ml-1" /> درجة العزل</TabsTrigger>
          <TabsTrigger value="rls"     className="text-xs"><Lock className="h-3.5 w-3.5 ml-1" /> حالة RLS</TabsTrigger>
          <TabsTrigger value="redteam" className="text-xs"><Play className="h-3.5 w-3.5 ml-1" /> Red Team</TabsTrigger>
          <TabsTrigger value="events"  className="text-xs"><Eye className="h-3.5 w-3.5 ml-1" /> أحداث الأمن</TabsTrigger>
        </TabsList>

        <TabsContent value="score"   className="mt-4"><ScoreTab /></TabsContent>
        <TabsContent value="rls"     className="mt-4"><RLSTab toast={toast} /></TabsContent>
        <TabsContent value="redteam" className="mt-4"><RedTeamTab toast={toast} /></TabsContent>
        <TabsContent value="events"  className="mt-4"><SecurityEventsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
