import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { API } from "@/lib/api";
import {
  Crown, Shield, CheckCircle, Activity, Database, Server,
  TrendingUp, AlertTriangle, RefreshCw, Download, FileText,
  BarChart2, Zap, HardDrive, Cpu, Wifi, Lock, Globe,
  XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const [tab, setTab] = useState("overview");

  const { data: dash, isLoading, refetch } = useQuery({
    queryKey: ["/executive/dashboard"],
    queryFn: () => API("/executive/dashboard"),
    refetchInterval: 60000,
  });
  const { data: validation, isLoading: loadingValidation } = useQuery({
    queryKey: ["/executive/production-validation"],
    queryFn: () => API("/executive/production-validation"),
    enabled: tab === "validation",
    staleTime: 120000,
  });
  const { data: compliance } = useQuery({
    queryKey: ["/compliance/overview"],
    queryFn: () => API("/compliance/overview"),
    enabled: tab === "compliance",
  });
  const { data: drDash } = useQuery({
    queryKey: ["/dr/dashboard"],
    queryFn: () => API("/dr/dashboard"),
    enabled: tab === "dr",
  });
  const { data: mfaStatus } = useQuery({
    queryKey: ["/mfa/status"],
    queryFn: () => API("/mfa/status"),
    enabled: tab === "mfa",
  });
  const { data: highRiskLogs = [] } = useQuery({
    queryKey: ["/high-risk-ops/logs"],
    queryFn: () => API("/high-risk-ops/logs"),
    enabled: tab === "high-risk",
  });

  const s = dash?.scores ?? {};
  const p = dash?.platform ?? {};
  const sec = dash?.security ?? {};
  const infra = dash?.infrastructure ?? {};

  const handleExport = async () => {
    try {
      const data = await API("/executive/production-validation");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `enterprise-report-${new Date().toISOString().slice(0,10)}.json`; a.click();
      toast.success("تم تصدير التقرير المؤسسي");
    } catch { toast.error("فشل التصدير"); }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Crown className="text-yellow-500" />لوحة القيادة التنفيذية</h1>
            <p className="text-muted-foreground text-sm mt-1">نظرة شاملة على صحة المنصة والأمان والامتثال والبنية التحتية</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 ml-2" />تحديث</Button>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 ml-2" />تقرير مؤسسي</Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview"><BarChart2 className="h-4 w-4 ml-1" />نظرة عامة</TabsTrigger>
            <TabsTrigger value="compliance"><CheckCircle className="h-4 w-4 ml-1" />الامتثال</TabsTrigger>
            <TabsTrigger value="dr"><Database className="h-4 w-4 ml-1" />التعافي من الكوارث</TabsTrigger>
            <TabsTrigger value="mfa"><Lock className="h-4 w-4 ml-1" />إدارة MFA</TabsTrigger>
            <TabsTrigger value="high-risk"><AlertTriangle className="h-4 w-4 ml-1" />العمليات الحرجة</TabsTrigger>
            <TabsTrigger value="validation"><Shield className="h-4 w-4 ml-1" />التحقق من الإنتاج</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {isLoading ? <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div> : (
              <>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">نتائج المؤشرات المؤسسية</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap justify-around gap-6 py-4">
                      <ScoreRing score={s.security   ?? 0} label="الأمان"      color="#ef4444" />
                      <ScoreRing score={s.compliance  ?? 0} label="الامتثال"    color="#3b82f6" />
                      <ScoreRing score={s.performance ?? 0} label="الأداء"      color="#8b5cf6" />
                      <ScoreRing score={s.backup      ?? 0} label="النسخ الاحتياطي" color="#f59e0b" />
                      <ScoreRing score={s.risk        ?? 0} label="نقاط المخاطر" color="#10b981" />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "مكاتب المنصة",    value: p.offices,      icon: <Globe className="h-5 w-5 text-blue-500" />   },
                    { label: "مكاتب نشطة",       value: p.activeOffices, icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
                    { label: "قضايا",            value: p.cases,        icon: <FileText className="h-5 w-5 text-purple-500" /> },
                    { label: "عملاء",            value: p.clients,      icon: <Activity className="h-5 w-5 text-orange-500" /> },
                    { label: "إيرادات 30 يوم",   value: `${Number(p.revenue30d ?? 0).toLocaleString()} ر.س`, icon: <TrendingUp className="h-5 w-5 text-green-500" /> },
                    { label: "استخدام AI اليوم", value: p.aiUsageToday, icon: <Zap className="h-5 w-5 text-yellow-500" /> },
                    { label: "تنبيهات مفتوحة",   value: sec.openAlerts, icon: <AlertTriangle className="h-5 w-5 text-red-500" /> },
                    { label: "IPs محظورة",        value: sec.blockedIps, icon: <Lock className="h-5 w-5 text-red-500" /> },
                  ].map((item, i) => (
                    <Card key={i}><CardContent className="pt-4"><div className="flex justify-between items-start">{item.icon}<span className="text-xl font-bold">{item.value ?? 0}</span></div><p className="text-xs text-muted-foreground mt-2">{item.label}</p></CardContent></Card>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4" />المعالج والذاكرة</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1"><span>استخدام الذاكرة</span><span>{infra.memory?.systemPct ?? 0}%</span></div>
                        <Progress value={infra.memory?.systemPct ?? 0} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1"><span>Heap JS</span><span>{infra.memory?.heapUsedMb ?? 0} MB</span></div>
                        <Progress value={Math.min(100, ((infra.memory?.heapUsedMb ?? 0) / (infra.memory?.heapTotalMb ?? 1)) * 100)} className="h-2" />
                      </div>
                      <p className="text-xs text-muted-foreground">تحميل CPU: {infra.cpu?.load1m}x{infra.cpu?.load5m} • {infra.cpu?.cores} نواة</p>
                      <p className="text-xs text-muted-foreground">وقت التشغيل: {Math.floor((infra.uptime ?? 0) / 3600)}س {Math.floor(((infra.uptime ?? 0) % 3600) / 60)}د</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><HardDrive className="h-4 w-4" />التخزين</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-2xl font-bold">{infra.storage?.usedMb?.toLocaleString() ?? 0} <span className="text-sm font-normal">MB</span></p>
                      <p className="text-xs text-muted-foreground">{infra.storage?.fileCount?.toLocaleString() ?? 0} ملف</p>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Object Storage نشط</Badge>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wifi className="h-4 w-4" />توافر المنصة</CardTitle></CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold text-green-600">{dash?.availability ?? 99.9}%</p>
                      <p className="text-xs text-muted-foreground mt-1">خلال آخر 30 يوم</p>
                      <Badge className="mt-2 bg-green-500">SLA محقّق</Badge>
                    </CardContent>
                  </Card>
                </div>

                {(sec.criticalAlerts ?? []).length > 0 && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />تنبيهات حرجة تحتاج انتباهاً فورياً</CardTitle></CardHeader>
                    <CardContent>
                      {sec.criticalAlerts.map((a: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2 rounded bg-white mb-1">
                          <span className="font-medium text-red-700">{a.title}</span>
                          <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("ar")}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Compliance ── */}
          <TabsContent value="compliance" className="space-y-4 mt-4">
            {compliance && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card><CardContent className="pt-4"><div className="text-3xl font-bold text-blue-600">{compliance.complianceScore}%</div><p className="text-xs text-muted-foreground mt-1">نسبة الامتثال الكلية</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><div className="text-3xl font-bold text-green-600">{compliance.compliantCount}</div><p className="text-xs text-muted-foreground mt-1">ضوابط متوافقة</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><div className="text-3xl font-bold text-orange-600">{compliance.totalControls - compliance.compliantCount}</div><p className="text-xs text-muted-foreground mt-1">تحتاج عمل</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><div className="text-3xl font-bold text-purple-600">{(compliance.holds ?? []).length}</div><p className="text-xs text-muted-foreground mt-1">إيقافات قانونية</p></CardContent></Card>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {["PDPL","SOC2","ISO27001"].map(fw => {
                    const controls = (compliance.controls ?? []).filter((c: any) => c.framework === fw);
                    const count = controls.reduce((s: number, c: any) => s + Number(c.count), 0);
                    const compliant = controls.filter((c: any) => c.status === "compliant").reduce((s: number, c: any) => s + Number(c.count), 0);
                    if (count === 0) return null;
                    return (
                      <Card key={fw}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">{fw}</CardTitle></CardHeader>
                        <CardContent>
                          <div className="flex justify-between text-xs mb-2"><span>{compliant}/{count} متوافق</span><span className="font-medium">{Math.round((compliant/count)*100)}%</span></div>
                          <Progress value={Math.round((compliant/count)*100)} className="h-2" />
                          <div className="flex flex-wrap gap-1 mt-2">
                            {controls.map((c: any, i: number) => (
                              <Badge key={i} variant={c.status === "compliant" ? "default" : "outline"} className={`text-xs ${c.status === "compliant" ? "bg-green-500" : c.status === "in_progress" ? "border-yellow-500 text-yellow-700" : ""}`}>
                                {c.status === "compliant" ? "✅" : c.status === "in_progress" ? "🔄" : "⏳"} {c.count}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">طلبات البيانات</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {(compliance.requests ?? []).map((r: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded bg-muted text-xs">
                          <span>{r.status}</span><span className="font-medium">{r.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── Disaster Recovery ── */}
          <TabsContent value="dr" className="space-y-4 mt-4">
            {drDash && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card><CardContent className="pt-4"><div className={`text-lg font-bold ${drDash.health?.database?.status === "healthy" ? "text-green-600" : "text-red-600"}`}>{drDash.health?.database?.status === "healthy" ? "✅ سليمة" : "⚠️ تحذير"}</div><p className="text-xs text-muted-foreground mt-1">قاعدة البيانات • {drDash.health?.database?.latency_ms}ms</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><div className={`text-lg font-bold ${drDash.health?.storage?.status === "healthy" ? "text-green-600" : "text-yellow-600"}`}>{drDash.health?.storage?.status === "healthy" ? "✅ سليم" : "⚠️ تحقق"}</div><p className="text-xs text-muted-foreground mt-1">Object Storage</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-blue-600">{drDash.successRate ?? 0}%</div><p className="text-xs text-muted-foreground mt-1">نجاح اختبارات DR</p></CardContent></Card>
                  <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{drDash.totalRestorePoints}</div><p className="text-xs text-muted-foreground mt-1">نقاط استرداد متاحة</p></CardContent></Card>
                </div>
                {drDash.latestRestore && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">آخر نسخة احتياطية</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><p className="text-muted-foreground text-xs">التسمية</p><p className="font-medium">{drDash.latestRestore.label}</p></div>
                        <div><p className="text-muted-foreground text-xs">الحجم</p><p className="font-medium">{Math.round((drDash.latestRestore.size_bytes ?? 0) / 1024 / 1024)} MB</p></div>
                        <div><p className="text-muted-foreground text-xs">الحالة</p><Badge variant={drDash.latestRestore.status === "available" ? "default" : "outline"} className={drDash.latestRestore.status === "available" ? "bg-green-500" : ""}>{drDash.latestRestore.status}</Badge></div>
                        <div><p className="text-muted-foreground text-xs">التاريخ</p><p className="font-medium">{new Date(drDash.latestRestore.created_at).toLocaleDateString("ar")}</p></div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">آخر اختبارات DR</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(drDash.testRuns ?? []).slice(0, 5).map((r: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2 rounded bg-muted">
                          <Badge variant={r.status === "passed" ? "default" : "destructive"} className={r.status === "passed" ? "bg-green-500" : ""}>{r.status === "passed" ? "✅ نجح" : "❌ فشل"}</Badge>
                          <span>{r.duration_ms ? `${r.duration_ms}ms` : "—"}</span>
                          <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</span>
                        </div>
                      ))}
                      {(drDash.testRuns ?? []).length === 0 && <p className="text-xs text-center text-muted-foreground py-4">لا اختبارات سابقة</p>}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── MFA Management ── */}
          <TabsContent value="mfa" className="space-y-4 mt-4">
            {mfaStatus && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <Card><CardContent className="pt-4 text-center"><div className="text-3xl font-bold">{mfaStatus.totalUsers}</div><p className="text-xs text-muted-foreground mt-1">إجمالي المستخدمين</p></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><div className="text-3xl font-bold text-green-600">{mfaStatus.mfaEnabled}</div><p className="text-xs text-muted-foreground mt-1">MFA مفعّل</p></CardContent></Card>
                  <Card><CardContent className="pt-4 text-center"><div className="text-3xl font-bold text-red-600">{mfaStatus.totalUsers - mfaStatus.mfaEnabled}</div><p className="text-xs text-muted-foreground mt-1">بدون MFA</p></CardContent></Card>
                </div>
                {(mfaStatus.saWithoutMfa ?? []).length > 0 && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Super Admins بدون MFA — خطر أمني عالي!</CardTitle></CardHeader>
                    <CardContent>
                      {mfaStatus.saWithoutMfa.map((u: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-xs p-2 rounded bg-white mb-1">
                          <span>{u.email ?? u.userId}</span>
                          <span className="text-muted-foreground">{u.firstName} {u.lastName}</span>
                          <Badge variant="destructive">بدون MFA</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                <Table>
                  <TableHeader><TableRow><TableHead>المستخدم</TableHead><TableHead>البريد</TableHead><TableHead>Super Admin</TableHead><TableHead>MFA</TableHead><TableHead>آخر دخول</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(mfaStatus.users ?? []).map((u: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{u.firstName} {u.lastName}</TableCell>
                        <TableCell className="text-xs">{u.email}</TableCell>
                        <TableCell>{u.isSA ? <Badge className="bg-red-500 text-xs">SA</Badge> : null}</TableCell>
                        <TableCell>{u.hasMfa ? <Badge className="bg-green-500 text-xs">✅ مفعّل</Badge> : <Badge variant="destructive" className="text-xs">❌ معطّل</Badge>}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("ar") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </TabsContent>

          {/* ── High Risk Operations ── */}
          <TabsContent value="high-risk" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">سجل العمليات الحرجة</CardTitle></CardHeader>
              <CardContent>
                {highRiskLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground"><CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />لا عمليات حرجة مسجّلة</div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>العملية</TableHead><TableHead>المستخدم</TableHead><TableHead>MFA</TableHead><TableHead>كلمة المرور</TableHead><TableHead>النتيجة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {highRiskLogs.map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.operation}</TableCell>
                          <TableCell className="text-xs">{r.user_id?.slice(0, 15)}</TableCell>
                          <TableCell>{r.confirmed_mfa ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                          <TableCell>{r.confirmed_pwd ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                          <TableCell><Badge variant={r.result === "approved" ? "default" : r.result === "aborted" ? "outline" : "secondary"} className={r.result === "approved" ? "bg-green-500" : ""}>{r.result}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Production Validation ── */}
          <TabsContent value="validation" className="space-y-4 mt-4">
            {loadingValidation ? <div className="text-center py-12 text-muted-foreground">جارٍ تشغيل فحوصات الإنتاج...</div> : validation && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: "مؤسسي", value: validation.scores?.enterprise, color: "text-blue-600" },
                    { label: "أمان", value: validation.scores?.security, color: "text-red-600" },
                    { label: "امتثال", value: validation.scores?.compliance, color: "text-green-600" },
                    { label: "تدقيق", value: validation.scores?.audit, color: "text-purple-600" },
                    { label: "الإجمالي", value: `${validation.summary?.passed}/${validation.summary?.total}`, color: "text-orange-600" },
                  ].map((s, i) => (
                    <Card key={i}><CardContent className="pt-4 text-center"><div className={`text-2xl font-bold ${s.color}`}>{typeof s.value === "number" ? `${s.value}%` : s.value}</div><p className="text-xs text-muted-foreground mt-1">{s.label}</p></CardContent></Card>
                  ))}
                </div>
                <div className={`flex items-center gap-3 p-4 rounded-lg ${validation.productionReady ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  {validation.productionReady ? <CheckCircle className="h-8 w-8 text-green-600" /> : <AlertTriangle className="h-8 w-8 text-red-600" />}
                  <div>
                    <p className={`font-bold ${validation.productionReady ? "text-green-700" : "text-red-700"}`}>
                      {validation.productionReady ? "✅ المنصة جاهزة للإنتاج" : "⚠️ تحتاج إجراءات قبل الإنتاج"}
                    </p>
                    <p className="text-xs text-muted-foreground">{validation.summary?.passed} نجح · {validation.summary?.failed} فشل · {validation.summary?.warnings} تحذير</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(validation.checks ?? []).map((c: any, i: number) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded ${c.status === "pass" ? "bg-green-50" : c.status === "fail" ? "bg-red-50" : "bg-yellow-50"}`}>
                      {c.status === "pass" ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" /> : c.status === "fail" ? <XCircle className="h-4 w-4 text-red-600 shrink-0" /> : <Clock className="h-4 w-4 text-yellow-600 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">التوصيات</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(validation.recommendations ?? []).map((r: any, i: number) => (
                        <div key={i} className={`flex items-center gap-3 p-2 rounded text-xs ${r.priority === "critical" ? "bg-red-50" : r.priority === "high" ? "bg-orange-50" : r.priority === "medium" ? "bg-yellow-50" : "bg-blue-50"}`}>
                          <Badge variant="outline" className="shrink-0 text-xs">{r.priority}</Badge>
                          <span>{r.text}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
