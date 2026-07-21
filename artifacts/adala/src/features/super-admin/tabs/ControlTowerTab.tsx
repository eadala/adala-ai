/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
/**
 * 🏛️ Live Production Control Tower
 * ──────────────────────────────────
 * Real-time health scoring + anomaly detection + AOL auto-actions.
 * Consumes existing /control-tower/* API routes.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { authFetch } from "@/lib/authFetch";
import {
  ShieldCheck, AlertTriangle, XCircle, RefreshCw, Zap,
  Activity, Users, Lock, Unlock, Bot, Cpu, Gauge,
  TrendingUp, CheckCircle2,
} from "lucide-react";

/* ── helpers ──────────────────────────────────────────────────────── */

const SA_BASE = "";

let _getToken: (() => Promise<string | null>) | null = null;
export function setCtTokenGetter(fn: () => Promise<string | null>) { _getToken = fn; }

async function ctFetch(path: string, method = "GET", body?: any) {
  const token = _getToken ? await _getToken() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await authFetch(`${SA_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function ScoreRing({ score, level }: { score: number; level: string }) {
  const color =
    level === "healthy"  ? "#10B981" :
    level === "stable"   ? "#3B82F6" :
    level === "warning"  ? "#F59E0B" : "#EF4444";
  const r = 52, c = 2 * Math.PI * r;
  const progress = c - (score / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="130" height="130" viewBox="0 0 130 130" className="rotate-[-90deg]">
        <circle cx="65" cy="65" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={c} strokeDashoffset={progress} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute text-center">
        <p className="text-3xl font-bold" style={{ color }}>{score}</p>
        <p className="text-xs text-muted-foreground">/ 100</p>
      </div>
    </div>
  );
}

function levelAr(l: string) {
  const m: Record<string, string> = { healthy: "ممتاز", stable: "مستقر", warning: "تحذير", critical: "حرج" };
  return m[l] ?? l;
}
function severityColor(s: string) {
  if (s === "CRITICAL") return "bg-red-100 text-red-800";
  if (s === "HIGH")     return "bg-orange-100 text-orange-800";
  if (s === "MEDIUM")   return "bg-amber-100 text-amber-800";
  return "bg-muted text-muted-foreground";
}

/* ── Main Component ───────────────────────────────────────────────── */

export function ControlTowerTab({ toast, getToken }: { toast: any; getToken?: () => Promise<string | null> }) {
  if (getToken) setCtTokenGetter(getToken);
  const qc = useQueryClient();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: hs, isLoading: hsLoading } = useQuery({
    queryKey: ["ct", "health-score"],
    queryFn: () => ctFetch("/control-tower/health-score"),
    refetchInterval: 15_000,
  });

  const { data: metrics } = useQuery({
    queryKey: ["ct", "metrics"],
    queryFn: () => ctFetch("/control-tower/metrics"),
    refetchInterval: 15_000,
  });

  const { data: anomalies } = useQuery({
    queryKey: ["ct", "anomalies"],
    queryFn: () => ctFetch("/control-tower/anomalies"),
    refetchInterval: 20_000,
  });

  const { data: secFeed = [] } = useQuery({
    queryKey: ["ct", "security-feed"],
    queryFn: () => ctFetch("/control-tower/security-feed"),
    refetchInterval: 20_000,
  });

  const score  = hs?.score  ?? 100;
  const level  = hs?.level  ?? "healthy";
  const alerts: any[] = hs?.alerts ?? [];
  const frozenTenants: string[] = metrics?.frozenTenants ?? [];

  async function runAction(key: string, path: string, method = "POST", body?: any) {
    setActionLoading(key);
    try {
      const r = await ctFetch(path, method, body);
      qc.invalidateQueries({ queryKey: ["ct"] });
      toast({ title: "تم تنفيذ الإجراء", description: r.message ?? "نجح الإجراء" });
    } catch {
      toast({ title: "خطأ", variant: "destructive" });
    }
    setActionLoading(null);
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">غرفة التحكم المباشر</h2>
          <Badge variant="outline" className="text-xs">Live</Badge>
        </div>
        <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["ct"] })}>
          <RefreshCw className="h-3 w-3 ml-1" /> تحديث
        </Button>
      </div>

      {/* ── Health Score + Quick Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex flex-col items-center justify-center p-6">
          {hsLoading
            ? <div className="text-sm text-muted-foreground">جاري التحميل…</div>
            : <>
              <ScoreRing score={score} level={level} />
              <p className="mt-2 font-semibold">{levelAr(level)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">صحة النظام</p>
            </>}
        </Card>

        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          {[
            { label: "فشل هوية (1h)",   value: hs?.breakdown?.tenantFailures ?? 0, icon: <XCircle className="h-4 w-4" />,       color: "text-red-600"    },
            { label: "أحداث أمنية (1h)", value: hs?.breakdown?.securityEvents  ?? 0, icon: <ShieldCheck className="h-4 w-4" />,   color: "text-orange-600" },
            { label: "قضايا مفتوحة",    value: hs?.activeCases ?? 0,              icon: <Activity className="h-4 w-4" />,        color: "text-blue-600"   },
            { label: "تسجيل دخول (24h)", value: hs?.loginsToday ?? 0,             icon: <Users className="h-4 w-4" />,           color: "text-emerald-600" },
            { label: "مكاتب مجمّدة",    value: frozenTenants.length,              icon: <Lock className="h-4 w-4" />,            color: "text-amber-600"  },
            { label: "AI Lock",           value: hs?.aiLocked ? "مفعّل" : "إيقاف", icon: <Bot className="h-4 w-4" />,            color: hs?.aiLocked ? "text-red-600" : "text-emerald-600" },
          ].map(c => (
            <Card key={c.label} className="p-3">
              <div className={`flex items-center gap-1 ${c.color} mb-1`}>{c.icon}<span className="text-xs">{c.label}</span></div>
              <p className="text-xl font-bold text-foreground">{c.value}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* ── Alerts row ── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${a.level === "critical" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
              <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${a.level === "critical" ? "text-red-600" : "text-amber-600"}`} />
              <p className="text-sm">{a.message}</p>
              <Badge className="mr-auto" variant={a.level === "critical" ? "destructive" : "secondary"}>{a.type}</Badge>
            </div>
          ))}
        </div>
      )}
      {!hsLoading && alerts.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-sm font-medium">لا تنبيهات — النظام يعمل بشكل طبيعي</p>
        </div>
      )}

      <Tabs defaultValue="aol">
        <TabsList>
          <TabsTrigger value="aol">إجراءات تلقائية</TabsTrigger>
          <TabsTrigger value="anomalies">الحوادث</TabsTrigger>
          <TabsTrigger value="tenants">المكاتب</TabsTrigger>
          <TabsTrigger value="security">الأمن</TabsTrigger>
        </TabsList>

        {/* ── AOL Auto-Actions ── */}
        <TabsContent value="aol">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
            {[
              {
                key: "clear-caches",
                icon: <RefreshCw className="h-5 w-5 text-blue-600" />,
                title: "مسح جميع الكاشات",
                desc: "يُعيد تعيين كاش هوية جميع المستخدمين النشطين — يحل مشاكل 403 الفورية",
                action: () => runAction("clear-caches", "/control-tower/aol/clear-caches"),
                btnLabel: "تنفيذ",
                btnClass: "bg-blue-600 hover:bg-blue-700 text-white",
              },
              {
                key: "auto-heal",
                icon: <Zap className="h-5 w-5 text-emerald-600" />,
                title: "إصلاح تلقائي للهويات",
                desc: "يُعالج تلقائياً كل المستخدمين الذين فشل تحديد مكتبهم خلال آخر ساعة",
                action: () => runAction("auto-heal", "/control-tower/aol/auto-heal"),
                btnLabel: "إصلاح الكل",
                btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
              },
              {
                key: "strict-on",
                icon: <Lock className="h-5 w-5 text-orange-600" />,
                title: "تفعيل Strict Mode",
                desc: "يُشدّد التحقق من هوية المستأجر — يمنع أي طلب بدون مكتب محدد",
                action: () => runAction("strict-on", "/control-tower/aol/strict-mode", "POST", { enable: true }),
                btnLabel: "تفعيل",
                btnClass: "bg-orange-600 hover:bg-orange-700 text-white",
              },
              {
                key: "strict-off",
                icon: <Unlock className="h-5 w-5 text-muted-foreground" />,
                title: "إلغاء Strict Mode",
                desc: "يعود للوضع الطبيعي — يسمح بـ fallback محدود عند الحاجة",
                action: () => runAction("strict-off", "/control-tower/aol/strict-mode", "POST", { enable: false }),
                btnLabel: "إلغاء",
                btnClass: "",
              },
              {
                key: "model-flash",
                icon: <Bot className="h-5 w-5 text-purple-600" />,
                title: "تحويل AI → Flash (أرخص)",
                desc: "يُحوّل نموذج AI إلى gemini-2.0-flash لتخفيض التكلفة عند الضغط العالي",
                action: () => runAction("model-flash", "/control-tower/aol/switch-ai-model", "POST", { model: "gemini-2.0-flash" }),
                btnLabel: "تطبيق",
                btnClass: "bg-purple-600 hover:bg-purple-700 text-white",
              },
              {
                key: "model-pro",
                icon: <Cpu className="h-5 w-5 text-indigo-600" />,
                title: "تحويل AI → Pro (الافتراضي)",
                desc: "يُعيد النموذج الكامل gemini-1.5-pro عند استقرار الأداء",
                action: () => runAction("model-pro", "/control-tower/aol/switch-ai-model", "POST", { model: "gemini-1.5-pro" }),
                btnLabel: "تطبيق",
                btnClass: "bg-indigo-600 hover:bg-indigo-700 text-white",
              },
            ].map(item => (
              <Card key={item.key} className="p-4">
                <div className="flex items-start gap-3">
                  {item.icon}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className={`w-full mt-3 ${item.btnClass}`}
                  variant={item.btnClass ? "default" : "outline"}
                  disabled={actionLoading === item.key}
                  onClick={item.action}
                >
                  {actionLoading === item.key
                    ? <RefreshCw className="h-3 w-3 animate-spin ml-1" />
                    : null}
                  {item.btnLabel}
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Anomalies ── */}
        <TabsContent value="anomalies">
          <div className="space-y-4 pt-3">
            {anomalies?.tenantFails?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    فشل تحديد هوية المستأجر ({anomalies.tenantFails.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المستخدم</TableHead>
                          <TableHead className="text-right">الخطوات</TableHead>
                          <TableHead className="text-right">الوقت</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {anomalies.tenantFails.map((f: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{f.user_id}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-wrap gap-1">
                                {(f.steps as string[])?.slice(-2).map((s: string, j: number) => (
                                  <span key={j} className="bg-red-100 text-red-800 px-1 rounded text-[10px]">{s}</span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{new Date(f.created_at).toLocaleTimeString("ar-SA")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {anomalies?.securityEvents?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    الأحداث الأمنية ({anomalies.securityEvents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-48">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">النوع</TableHead>
                          <TableHead className="text-right">الخطورة</TableHead>
                          <TableHead className="text-right">الرسالة</TableHead>
                          <TableHead className="text-right">الوقت</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {anomalies.securityEvents.map((e: any) => (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs font-mono">{e.event_type}</TableCell>
                            <TableCell>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${severityColor(e.severity)}`}>{e.severity}</span>
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{e.message}</TableCell>
                            <TableCell className="text-xs">{new Date(e.created_at).toLocaleTimeString("ar-SA")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {(!anomalies || (!anomalies.tenantFails?.length && !anomalies.securityEvents?.length)) && (
              <div className="flex flex-col items-center py-12">
                <ShieldCheck className="h-12 w-12 text-emerald-500 mb-3" />
                <p className="font-semibold text-emerald-700">لا حوادث مكتشفة</p>
                <p className="text-sm text-muted-foreground mt-1">كل شيء يعمل بشكل طبيعي خلال آخر 6 ساعات</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Tenants ── */}
        <TabsContent value="tenants">
          <div className="pt-3 space-y-3">
            {frozenTenants.length > 0 && (
              <Card className="p-4">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-orange-500" /> مكاتب مجمّدة ({frozenTenants.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {frozenTenants.map(tid => (
                    <div key={tid} className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded px-3 py-1">
                      <span className="text-xs font-mono">{tid}</span>
                      <Button size="sm" variant="ghost" className="h-5 px-1 text-xs text-emerald-600"
                        onClick={() => runAction(`unfreeze-${tid}`, `/control-tower/freeze/${tid}`, "DELETE")}>
                        إلغاء التجميد
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {metrics?.tenantMatrix && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">مصفوفة المكاتب</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المكتب</TableHead>
                          <TableHead className="text-right">الأعضاء</TableHead>
                          <TableHead className="text-right">القضايا</TableHead>
                          <TableHead className="text-right">الحالة</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(metrics.tenantMatrix as any[]).slice(0, 20).map((t: any) => (
                          <TableRow key={t.office_id}>
                            <TableCell className="text-xs font-mono max-w-[100px] truncate">{t.office_id}</TableCell>
                            <TableCell className="text-xs">{t.member_count ?? 0}</TableCell>
                            <TableCell className="text-xs">{t.case_count ?? 0}</TableCell>
                            <TableCell>
                              <Badge variant={frozenTenants.includes(t.office_id) ? "destructive" : "secondary"} className="text-[10px]">
                                {frozenTenants.includes(t.office_id) ? "مجمّد" : "نشط"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {frozenTenants.includes(t.office_id)
                                ? <Button size="sm" variant="ghost" className="h-6 text-xs text-emerald-600"
                                    onClick={() => runAction(`unfreeze-${t.office_id}`, `/control-tower/freeze/${t.office_id}`, "DELETE")}>
                                    تفعيل
                                  </Button>
                                : <Button size="sm" variant="ghost" className="h-6 text-xs text-orange-600"
                                    onClick={() => runAction(`freeze-${t.office_id}`, `/control-tower/freeze/${t.office_id}`, "POST")}>
                                    تجميد
                                  </Button>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Security Feed ── */}
        <TabsContent value="security">
          <div className="pt-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">سجل الأحداث الأمنية</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline"
                  onClick={() => runAction("ai-lock-on", "/control-tower/ai-lock", "POST", { lock: true })}>
                  <Lock className="h-3 w-3 ml-1" /> قفل AI
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => runAction("ai-lock-off", "/control-tower/ai-lock", "POST", { lock: false })}>
                  <Unlock className="h-3 w-3 ml-1" /> فتح AI
                </Button>
              </div>
            </div>
            <div className="rounded-md border overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الخطورة</TableHead>
                    <TableHead className="text-right">المكتب</TableHead>
                    <TableHead className="text-right">الرسالة</TableHead>
                    <TableHead className="text-right">الوقت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(secFeed as any[]).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-mono">{e.event_type}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${severityColor(e.severity)}`}>{e.severity}</span>
                      </TableCell>
                      <TableCell className="text-xs max-w-[80px] truncate font-mono">{e.office_id ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{e.message}</TableCell>
                      <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("ar-SA")}</TableCell>
                    </TableRow>
                  ))}
                  {!(secFeed as any[]).length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                        لا توجد أحداث أمنية مسجّلة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
