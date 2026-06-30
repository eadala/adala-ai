import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API } from "@/lib/api";
import {
  Shield, AlertTriangle, Activity, Globe, Monitor, Key,
  Ban, RefreshCw, Search, Download, LogOut, Eye, CheckCircle,
  XCircle, Clock, Cpu, Wifi, Lock, UserX, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

function severityBadge(s: string) {
  const m: Record<string, string> = { critical: "destructive", high: "destructive", medium: "secondary", low: "outline", info: "outline" };
  const labels: Record<string, string> = { critical: "حرج", high: "عالي", medium: "متوسط", low: "منخفض", info: "معلومات" };
  return <Badge variant={(m[s] as any) ?? "outline"}>{labels[s] ?? s}</Badge>;
}
function statusBadge(s: string) {
  if (s === "active")   return <Badge variant="default" className="bg-green-500">نشط</Badge>;
  if (s === "revoked")  return <Badge variant="destructive">مُلغى</Badge>;
  if (s === "open")     return <Badge variant="destructive">مفتوح</Badge>;
  if (s === "resolved") return <Badge className="bg-green-500">تم الحل</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

export default function SOCPage() {
  const [tab, setTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const { data: dash, isLoading, refetch: refetchDash } = useQuery({
    queryKey: ["/soc/dashboard"],
    queryFn: () => API("/soc/dashboard"),
    refetchInterval: 30000,
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["/soc/sessions", tab],
    queryFn: () => API("/soc/sessions/live"),
    enabled: tab === "sessions",
    refetchInterval: 15000,
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ["/soc/alerts"],
    queryFn: () => API("/soc/alerts"),
    enabled: tab === "alerts",
    refetchInterval: 20000,
  });
  const { data: blockedIps = [], refetch: refetchBlocked } = useQuery({
    queryKey: ["/soc/blocked-ips"],
    queryFn: () => API("/soc/blocked-ips"),
    enabled: tab === "blocked",
  });
  const { data: loginStats } = useQuery({
    queryKey: ["/soc/login-stats"],
    queryFn: () => API("/soc/login-stats"),
    enabled: tab === "logins",
  });
  const { data: loginActivity = [] } = useQuery({
    queryKey: ["/soc/login-activity"],
    queryFn: () => API("/soc/login-activity?hours=24"),
    enabled: tab === "logins",
  });
  const { data: threatScan } = useQuery({
    queryKey: ["/soc/threat-scan"],
    queryFn: () => API("/soc/threat-scan"),
    enabled: tab === "threats",
    staleTime: 60000,
  });

  const revokeSession = useMutation({
    mutationFn: (id: string) => API(`/soc/sessions/${id}/revoke`, { method: "POST" }),
    onSuccess: () => { toast.success("تم إلغاء الجلسة"); qc.invalidateQueries({ queryKey: ["/soc/sessions"] }); },
  });
  const resolveAlert = useMutation({
    mutationFn: (id: string) => API(`/soc/alerts/${id}/resolve`, { method: "POST" }),
    onSuccess: () => { toast.success("تم حل التنبيه"); qc.invalidateQueries({ queryKey: ["/soc/alerts"] }); },
  });
  const unblockIp = useMutation({
    mutationFn: (id: string) => API(`/soc/blocked-ips/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("تم رفع الحظر"); refetchBlocked(); },
  });
  const blockIp = useMutation({
    mutationFn: (ip: string) => API("/soc/blocked-ips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ip_address: ip, reason: "Manual block" }) }),
    onSuccess: () => { toast.success("تم حظر IP"); refetchBlocked(); },
  });

  const s = dash?.summary ?? {};
  const filteredAlerts = alerts.filter((a: any) => !search || a.title?.includes(search) || a.alert_type?.includes(search));

  return (
    <Layout>
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="text-red-500" /> مركز العمليات الأمنية (SOC)</h1>
            <p className="text-muted-foreground text-sm mt-1">مراقبة شاملة في الوقت الفعلي — جميع التهديدات والجلسات والأنشطة المشبوهة</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchDash()}><RefreshCw className="h-4 w-4 ml-2" />تحديث</Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard"><Activity className="h-4 w-4 ml-1" />لوحة التحكم</TabsTrigger>
            <TabsTrigger value="alerts"><AlertTriangle className="h-4 w-4 ml-1" />التنبيهات {s.openAlerts > 0 && <Badge variant="destructive" className="mr-1 text-xs">{s.openAlerts}</Badge>}</TabsTrigger>
            <TabsTrigger value="sessions"><Monitor className="h-4 w-4 ml-1" />الجلسات</TabsTrigger>
            <TabsTrigger value="logins"><Globe className="h-4 w-4 ml-1" />سجل الدخول</TabsTrigger>
            <TabsTrigger value="blocked"><Ban className="h-4 w-4 ml-1" />IPs المحظورة</TabsTrigger>
            <TabsTrigger value="threats"><Zap className="h-4 w-4 ml-1" />كشف التهديدات</TabsTrigger>
          </TabsList>

          {/* ── Dashboard ── */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "جلسات نشطة",          value: s.activeSessions,      icon: <Monitor className="h-5 w-5 text-green-500" />,  color: "text-green-600" },
                { label: "فشل دخول (24س)",      value: s.failedLoginsToday,   icon: <XCircle className="h-5 w-5 text-red-500" />,    color: "text-red-600"   },
                { label: "محاولات SA مرفوضة",   value: s.saAccessDeniedToday, icon: <Lock className="h-5 w-5 text-orange-500" />,  color: "text-orange-600"},
                { label: "IPs محظورة",           value: s.blockedIps,          icon: <Ban className="h-5 w-5 text-red-500" />,       color: "text-red-600"  },
                { label: "تنبيهات مفتوحة",       value: s.openAlerts,          icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />, color: "text-yellow-600" },
                { label: "أحداث Rate Limit (1س)", value: s.rateLimitEventsLastHour, icon: <Zap className="h-5 w-5 text-purple-500" />, color: "text-purple-600" },
                { label: "API Tokens نشطة",      value: s.activeApiTokens,     icon: <Key className="h-5 w-5 text-blue-500" />,      color: "text-blue-600"  },
                { label: "MFA مفعّل",            value: `${s.mfaEnabled}/${s.mfaTotal}`, icon: <Shield className="h-5 w-5 text-green-500" />, color: "text-green-600" },
              ].map((item, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      {item.icon}
                      <span className={`text-2xl font-bold ${item.color}`}>{item.value ?? 0}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{item.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">آخر النشاطات الأمنية</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(dash?.recentAudit ?? []).slice(0, 10).map((a: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-muted">
                        <span className="font-mono">{a.action}</span>
                        <span className="text-muted-foreground">{a.resource}</span>
                        <span className="text-muted-foreground">{a.ip_address}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">تنبيهات مفتوحة</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(dash?.openAlerts ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-4">لا توجد تنبيهات مفتوحة ✅</p>}
                    {(dash?.openAlerts ?? []).map((a: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-muted">
                        {severityBadge(a.severity)}
                        <span className="flex-1 mx-2">{a.title}</span>
                        <span className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString("ar")}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Alerts ── */}
          <TabsContent value="alerts" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1"><Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في التنبيهات..." className="pr-9" /></div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>الخطورة</TableHead><TableHead>الوصف</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredAlerts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد تنبيهات</TableCell></TableRow>}
                {filteredAlerts.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.alert_type}</TableCell>
                    <TableCell>{severityBadge(a.severity)}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">{a.title}</TableCell>
                    <TableCell>{statusBadge(a.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("ar")}</TableCell>
                    <TableCell>
                      {a.status === "open" && (
                        <Button size="sm" variant="outline" onClick={() => resolveAlert.mutate(a.id)}>
                          <CheckCircle className="h-3 w-3 ml-1" />حل
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ── Sessions ── */}
          <TabsContent value="sessions" className="space-y-4 mt-4">
            <Table>
              <TableHeader><TableRow><TableHead>المستخدم</TableHead><TableHead>IP</TableHead><TableHead>الجهاز</TableHead><TableHead>آخر نشاط</TableHead><TableHead>الحالة</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
              <TableBody>
                {sessions.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد جلسات نشطة</TableCell></TableRow>}
                {sessions.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{s.email ?? s.user_id?.slice(0, 12)}</TableCell>
                    <TableCell className="font-mono text-xs">{s.ip_address}</TableCell>
                    <TableCell className="text-xs">{s.device_type} / {s.browser}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.last_seen ?? s.started_at).toLocaleString("ar")}</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell>
                      {s.status === "active" && (
                        <Button size="sm" variant="destructive" onClick={() => revokeSession.mutate(s.id)}>
                          <LogOut className="h-3 w-3 ml-1" />إلغاء
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ── Login Activity ── */}
          <TabsContent value="logins" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {(loginStats?.byStatus ?? []).map((s: any, i: number) => (
                <Card key={i}><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{s.count}</p><p className="text-xs text-muted-foreground mt-1">{s.status}</p></CardContent></Card>
              ))}
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>المستخدم</TableHead><TableHead>IP</TableHead><TableHead>الجهاز</TableHead><TableHead>نظام التشغيل</TableHead><TableHead>الحالة</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
              <TableBody>
                {loginActivity.slice(0, 50).map((l: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{l.email ?? l.user_id?.slice(0, 12)}</TableCell>
                    <TableCell className="font-mono text-xs">{l.ip_address}</TableCell>
                    <TableCell className="text-xs">{l.device_type}</TableCell>
                    <TableCell className="text-xs">{l.os}</TableCell>
                    <TableCell>{statusBadge(l.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ── Blocked IPs ── */}
          <TabsContent value="blocked" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input placeholder="أدخل IP لحظره..." id="ip-input" className="max-w-xs" />
              <Button variant="destructive" onClick={() => { const ip = (document.getElementById("ip-input") as HTMLInputElement)?.value; if (ip) blockIp.mutate(ip); }}>
                <Ban className="h-4 w-4 ml-2" />حظر IP
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>عنوان IP</TableHead><TableHead>السبب</TableHead><TableHead>حُظر بواسطة</TableHead><TableHead>تاريخ الحظر</TableHead><TableHead>ينتهي</TableHead><TableHead>إجراء</TableHead></TableRow></TableHeader>
              <TableBody>
                {blockedIps.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد IPs محظورة</TableCell></TableRow>}
                {blockedIps.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-sm">{b.ip_address}</TableCell>
                    <TableCell className="text-xs">{b.reason}</TableCell>
                    <TableCell className="text-xs">{b.blocked_by}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(b.blocked_at).toLocaleString("ar")}</TableCell>
                    <TableCell className="text-xs">{b.expires_at ? new Date(b.expires_at).toLocaleDateString("ar") : "دائم"}</TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => unblockIp.mutate(b.id)}><CheckCircle className="h-3 w-3 ml-1" />رفع الحظر</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          {/* ── Threat Detection ── */}
          <TabsContent value="threats" className="space-y-4 mt-4">
            {!threatScan && <div className="text-center py-8 text-muted-foreground">جارٍ فحص التهديدات...</div>}
            {threatScan && (
              <>
                <div className="flex items-center gap-3">
                  <Badge variant={threatScan.totalThreats > 0 ? "destructive" : "default"} className={threatScan.totalThreats === 0 ? "bg-green-500" : ""}>
                    {threatScan.totalThreats} تهديد مكتشف
                  </Badge>
                  <span className="text-xs text-muted-foreground">آخر فحص: {new Date(threatScan.scanTime).toLocaleString("ar")}</span>
                </div>
                {threatScan.totalThreats === 0 && (
                  <Card><CardContent className="py-8 text-center"><CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" /><p className="text-green-600 font-medium">لا تهديدات مكتشفة ✅</p></CardContent></Card>
                )}
                <div className="space-y-3">
                  {(threatScan.threats ?? []).map((t: any, i: number) => (
                    <Card key={i} className={`border-r-4 ${t.severity === "critical" ? "border-r-red-500" : t.severity === "high" ? "border-r-orange-500" : "border-r-yellow-500"}`}>
                      <CardContent className="py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">{severityBadge(t.severity)}<span className="font-medium text-sm">{t.detail}</span></div>
                            <p className="text-xs text-muted-foreground mt-1">النوع: {t.type} {t.ip && `• IP: ${t.ip}`} {t.userId && `• مستخدم: ${t.userId?.slice(0, 12)}`} • عدد: {t.count}</p>
                          </div>
                          {t.ip && <Button size="sm" variant="destructive" onClick={() => blockIp.mutate(t.ip)}><Ban className="h-3 w-3 ml-1" />حظر</Button>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
