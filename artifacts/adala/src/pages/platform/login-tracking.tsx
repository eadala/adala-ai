/**
 * Login Tracking Dashboard — مركز تتبع الدخول
 * Professional Security Analytics with real-time DB data.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Monitor, Smartphone, Tablet, Globe,
  AlertTriangle, CheckCircle2, XCircle, Clock,
  RefreshCw, Users, TrendingUp, Activity,
  Chrome, Laptop, Eye, Trash2, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ── helpers ──────────────────────────────────────────── */
function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const min  = Math.floor(diff / 60000);
  const hr   = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  if (min < 1)  return "الآن";
  if (min < 60) return `منذ ${min} دقيقة`;
  if (hr  < 24) return `منذ ${hr} ساعة`;
  return `منذ ${day} يوم`;
}

function DeviceIcon({ type }: { type: string }) {
  if (type === "mobile")  return <Smartphone className="h-3.5 w-3.5 text-blue-400" />;
  if (type === "tablet")  return <Tablet className="h-3.5 w-3.5 text-purple-400" />;
  return <Monitor className="h-3.5 w-3.5 text-emerald-400" />;
}

function statusBadge(status: string) {
  if (status === "success")    return <Badge className="text-[10px] border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1"><CheckCircle2 className="h-2.5 w-2.5" />نجاح</Badge>;
  if (status === "failed")     return <Badge className="text-[10px] border bg-red-500/10 text-red-400 border-red-500/30 gap-1"><XCircle className="h-2.5 w-2.5" />فشل</Badge>;
  if (status === "suspicious") return <Badge className="text-[10px] border bg-yellow-500/10 text-yellow-400 border-yellow-500/30 gap-1"><AlertTriangle className="h-2.5 w-2.5" />مشبوه</Badge>;
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

/* ── Stat Card ────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, color, sub }: any) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-3xl font-black">{value?.toLocaleString("ar-SA") ?? "—"}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginTrackingPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  /* ── Queries ────────────────────────────────────────── */
  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["login-stats"],
    queryFn: () => fetch(`${BASE}/api/security/login-stats`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    refetchInterval: 60_000,
  });

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery<any>({
    queryKey: ["login-logs", statusFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({
        limit:  String(LIMIT),
        offset: String(page * LIMIT),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });
      return fetch(`${BASE}/api/security/logins?${params}`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); });
    },
  });

  const logs  = logsData?.logs  ?? [];
  const total = logsData?.total ?? 0;

  /* ── Delete log entry ───────────────────────────────── */
  async function deleteLog(id: string) {
    await fetch(`${BASE}/api/security/logins/${id}`, { method: "DELETE" });
    toast({ title: "تم حذف السجل" });
    refetchLogs();
  }

  /* ── Refresh ────────────────────────────────────────── */
  function refresh() {
    qc.invalidateQueries({ queryKey: ["login-stats"] });
    qc.invalidateQueries({ queryKey: ["login-logs"] });
  }

  /* ── Browser chart data ─────────────────────────────── */
  const browsers: any[] = stats?.browsers ?? [];
  const maxBrowserCnt   = Math.max(...browsers.map((b: any) => b.cnt), 1);

  const devices: any[]  = stats?.devices ?? [];
  const deviceTotal     = devices.reduce((s: number, d: any) => s + d.cnt, 0) || 1;

  /* ── Render ─────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-400" />
            مركز تتبع الدخول
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            سجل شامل بكل عمليات الدخول — الأجهزة، المتصفحات، والأنشطة المشبوهة
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {/* ─── Stats row ─────────────────────────────────── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Activity}      label="إجمالي الدخول"    value={stats?.total}       color="#2563EB" sub={`اليوم: ${stats?.today ?? 0}`} />
          <StatCard icon={CheckCircle2}  label="دخول ناجح"        value={stats?.success}     color="#10B981" />
          <StatCard icon={XCircle}       label="محاولات فاشلة"    value={stats?.failed}      color="#EF4444" />
          <StatCard icon={AlertTriangle} label="أنشطة مشبوهة"     value={stats?.suspicious}  color="#F59E0B" />
        </div>
      )}

      {/* ─── Secondary stats ───────────────────────────── */}
      {!statsLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard icon={Users}      label="مستخدمون فريدون"     value={stats?.uniqueUsers} color="#8B5CF6" />
          <StatCard icon={Globe}      label="عناوين IP مختلفة"    value={stats?.uniqueIps}   color="#06B6D4" />
          <StatCard icon={TrendingUp} label="دخول اليوم"          value={stats?.today}       color="#3B82F6" />
        </div>
      )}

      {/* ─── Charts row ────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Browsers */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Chrome className="h-4 w-4 text-blue-400" /> المتصفحات الأكثر استخداماً
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statsLoading ? <Skeleton className="h-32 w-full" /> :
             browsers.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات بعد</p> :
             browsers.map((b: any) => (
              <div key={b.browser}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{b.browser}</span>
                  <span className="text-muted-foreground">{b.cnt}</span>
                </div>
                <div className="w-full bg-muted/40 rounded-full h-2">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(b.cnt / maxBrowserCnt) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Devices */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Laptop className="h-4 w-4 text-emerald-400" /> أنواع الأجهزة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-32 w-full" /> :
             devices.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات بعد</p> : (
              <div className="space-y-4">
                {devices.map((d: any) => {
                  const pct = Math.round((d.cnt / deviceTotal) * 100);
                  const color = d.device_type === "mobile" ? "#3B82F6" : d.device_type === "tablet" ? "#8B5CF6" : "#10B981";
                  return (
                    <div key={d.device_type}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <div className="flex items-center gap-2">
                          <DeviceIcon type={d.device_type} />
                          <span className="font-medium">
                            {d.device_type === "mobile" ? "جوال" : d.device_type === "tablet" ? "لوحي" : "حاسوب"}
                          </span>
                        </div>
                        <span className="text-muted-foreground">{pct}% ({d.cnt})</span>
                      </div>
                      <div className="w-full bg-muted/40 rounded-full h-2.5">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Top users ─────────────────────────────────── */}
      {(stats?.topUsers ?? []).length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> أكثر المستخدمين نشاطاً
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">البريد الإلكتروني</TableHead>
                  <TableHead className="text-right">عدد الدخول</TableHead>
                  <TableHead className="text-right">آخر دخول</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats?.topUsers ?? []).map((u: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-bold">{u.login_count}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(u.last_login)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─── Recent suspicious ─────────────────────────── */}
      {(stats?.recentSuspicious ?? []).length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-400">
              <AlertTriangle className="h-4 w-4" /> أنشطة مشبوهة مؤخراً
            </CardTitle>
            <CardDescription>دخول تم تصنيفه كمشبوه — يستوجب المراجعة</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المستخدم</TableHead>
                  <TableHead className="text-right">IP</TableHead>
                  <TableHead className="text-right">المتصفح / النظام</TableHead>
                  <TableHead className="text-right">الوقت</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stats?.recentSuspicious ?? []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.email ?? s.full_name ?? "مجهول"}</TableCell>
                    <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.ip_address}</code></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.browser} / {s.os}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(s.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─── Full log table ─────────────────────────────── */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" /> سجل الدخول الكامل
              </CardTitle>
              <CardDescription>الإجمالي: {total.toLocaleString("ar-SA")} سجل</CardDescription>
            </div>
            {/* Status filter */}
            <div className="flex gap-1">
              {[
                { key: "all",        label: "الكل" },
                { key: "success",    label: "ناجح" },
                { key: "failed",     label: "فاشل" },
                { key: "suspicious", label: "مشبوه" },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => { setStatusFilter(f.key); setPage(0); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    statusFilter === f.key
                      ? "bg-primary text-black"
                      : "text-muted-foreground hover:text-foreground border border-border/40"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">الجهاز</TableHead>
                <TableHead className="text-right">IP</TableHead>
                <TableHead className="text-right">المتصفح</TableHead>
                <TableHead className="text-right">النظام</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">الوقت</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading ? (
                <TableRow><TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    لا توجد سجلات بعد — ستظهر هنا بعد أول دخول
                  </TableCell>
                </TableRow>
              ) : logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{log.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{log.email ?? log.user_id ?? "—"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <DeviceIcon type={log.device_type} />
                      <span className="text-xs capitalize">{log.device_type === "mobile" ? "جوال" : log.device_type === "tablet" ? "لوحي" : "حاسوب"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{log.ip_address ?? "—"}</code>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.browser ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.os ?? "—"}</TableCell>
                  <TableCell>{statusBadge(log.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo(log.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      onClick={() => deleteLog(log.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between p-4 border-t border-border/40">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                السابق
              </Button>
              <span className="text-xs text-muted-foreground">
                {page * LIMIT + 1} — {Math.min((page + 1) * LIMIT, total)} من {total}
              </span>
              <Button variant="outline" size="sm" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)}>
                التالي
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
