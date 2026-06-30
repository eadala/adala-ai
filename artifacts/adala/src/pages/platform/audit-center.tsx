import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API } from "@/lib/api";
import {
  FileText, Search, Download, BarChart2, AlertTriangle,
  User, Shield, RefreshCw, Eye, TrendingUp, CheckCircle,
  XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";

const RESOURCE_LABELS: Record<string, string> = {
  cases: "القضايا", clients: "العملاء", contracts: "العقود",
  documents: "المستندات", experts: "الخبراء", bankruptcy: "الإفلاس",
  finance: "المالية", invoices: "الفواتير", subscriptions: "الاشتراكات",
  payments: "المدفوعات", users: "المستخدمين", permissions: "الصلاحيات",
  roles: "الأدوار", ai_operations: "عمليات AI", settings: "الإعدادات",
  api_keys: "مفاتيح API", integrations: "التكاملات",
};

export default function AuditCenterPage() {
  const [tab, setTab]         = useState("overview");
  const [search, setSearch]   = useState("");
  const [resource, setResource] = useState("all");
  const [riskLevel, setRiskLevel] = useState("all");
  const [page, setPage]       = useState(1);

  const { data: overview, isLoading: loadingOverview, refetch } = useQuery({
    queryKey: ["/audit-center/overview"],
    queryFn: () => API("/audit-center/overview"),
  });
  const { data: logsData, isLoading: loadingLogs } = useQuery({
    queryKey: ["/audit-center/logs", resource, riskLevel, search, page],
    queryFn: () => API(`/audit-center/logs?page=${page}&limit=50${resource !== "all" ? `&resource=${resource}` : ""}${riskLevel !== "all" ? `&riskLevel=${riskLevel}` : ""}${search ? `&search=${encodeURIComponent(search)}` : ""}`),
    enabled: tab === "logs",
  });
  const { data: riskData } = useQuery({
    queryKey: ["/audit-center/risk-analysis"],
    queryFn: () => API("/audit-center/risk-analysis"),
    enabled: tab === "risk",
  });
  const { data: coverage } = useQuery({
    queryKey: ["/audit-center/coverage"],
    queryFn: () => API("/audit-center/coverage"),
    enabled: tab === "coverage",
  });

  const handleExport = async () => {
    try {
      const data = await API("/audit-center/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `audit-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("تم تصدير سجلات التدقيق");
    } catch { toast.error("فشل التصدير"); }
  };

  const riskBadge = (r: string) => {
    const m: Record<string, string> = { critical: "destructive", high: "destructive", medium: "secondary", low: "outline" };
    return r ? <Badge variant={(m[r] as any) ?? "outline"}>{r}</Badge> : null;
  };

  const o = overview ?? {};

  return (
    <Layout>
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="text-blue-500" />مركز التدقيق المؤسسي</h1>
            <p className="text-muted-foreground text-sm mt-1">تغطية شاملة لكل العمليات الحرجة — {o.total?.toLocaleString()} سجل إجمالي</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 ml-2" />تحديث</Button>
            <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 ml-2" />تصدير</Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview"><BarChart2 className="h-4 w-4 ml-1" />نظرة عامة</TabsTrigger>
            <TabsTrigger value="logs"><FileText className="h-4 w-4 ml-1" />السجلات</TabsTrigger>
            <TabsTrigger value="risk"><AlertTriangle className="h-4 w-4 ml-1" />تحليل المخاطر</TabsTrigger>
            <TabsTrigger value="coverage"><CheckCircle className="h-4 w-4 ml-1" />التغطية</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "إجمالي السجلات", value: o.total?.toLocaleString() ?? 0, icon: <FileText className="h-5 w-5 text-blue-500" /> },
                { label: "سجلات اليوم",    value: o.today?.toLocaleString() ?? 0, icon: <Clock className="h-5 w-5 text-green-500" /> },
                { label: "نسبة التغطية",   value: `${o.coverage ?? 0}%`,           icon: <CheckCircle className="h-5 w-5 text-purple-500" /> },
                { label: "موارد مُدقّقة",  value: o.byResource?.length ?? 0,       icon: <Shield className="h-5 w-5 text-orange-500" /> },
              ].map((item, i) => (
                <Card key={i}><CardContent className="pt-4"><div className="flex justify-between items-start">{item.icon}<span className="text-2xl font-bold">{item.value}</span></div><p className="text-xs text-muted-foreground mt-2">{item.label}</p></CardContent></Card>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">السجلات حسب المورد</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(o.byResource ?? []).map((r: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span>{RESOURCE_LABELS[r.resource] ?? r.resource}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded bg-muted overflow-hidden">
                            <div className="h-full bg-blue-500 rounded" style={{ width: `${Math.min(100, (r.count / (o.byResource?.[0]?.count ?? 1)) * 100)}%` }} />
                          </div>
                          <span className="font-medium w-12 text-left">{Number(r.count).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">أكثر المستخدمين نشاطاً (7 أيام)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(o.topUsers ?? []).map((u: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-muted">
                        <div className="flex items-center gap-2"><User className="h-3 w-3" /><span>{u.user_full_name ?? u.user_id?.slice(0, 15)}</span></div>
                        <span className="font-medium">{Number(u.actions).toLocaleString()} عملية</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">تغطية الموارد الحرجة</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(o.coverageDetails ?? []).map((c: any, i: number) => (
                    <div key={i} className={`flex items-center gap-2 p-2 rounded text-xs ${c.covered ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {c.covered ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {RESOURCE_LABELS[c.resource] ?? c.resource}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Logs ── */}
          <TabsContent value="logs" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-48"><Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="بحث في السجلات..." className="pr-9" /></div>
              <Select value={resource} onValueChange={v => { setResource(v); setPage(1); }}>
                <SelectTrigger className="w-44"><SelectValue placeholder="المورد" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الموارد</SelectItem>
                  {Object.entries(RESOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={riskLevel} onValueChange={v => { setRiskLevel(v); setPage(1); }}>
                <SelectTrigger className="w-36"><SelectValue placeholder="مستوى الخطر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المستويات</SelectItem>
                  <SelectItem value="critical">حرج</SelectItem>
                  <SelectItem value="high">عالي</SelectItem>
                  <SelectItem value="medium">متوسط</SelectItem>
                  <SelectItem value="low">منخفض</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {loadingLogs ? (
              <div className="text-center py-8 text-muted-foreground">جارٍ التحميل...</div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>الإجراء</TableHead><TableHead>المورد</TableHead><TableHead>المستخدم</TableHead><TableHead>المكتب</TableHead><TableHead>IP</TableHead><TableHead>الخطر</TableHead><TableHead>التاريخ</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(logsData?.logs ?? []).map((l: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{l.action}</TableCell>
                      <TableCell className="text-xs">{RESOURCE_LABELS[l.resource] ?? l.resource}</TableCell>
                      <TableCell className="text-xs">{l.user_full_name ?? l.user_id?.slice(0, 12)}</TableCell>
                      <TableCell className="text-xs">{l.office_id?.slice(0, 8)}</TableCell>
                      <TableCell className="font-mono text-xs">{l.ip_address}</TableCell>
                      <TableCell>{riskBadge(l.risk_level)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("ar")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="flex items-center gap-2 justify-center">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
              <span className="text-sm">صفحة {page} — الإجمالي: {logsData?.total?.toLocaleString() ?? 0}</span>
              <Button variant="outline" size="sm" disabled={(logsData?.logs?.length ?? 0) < 50} onClick={() => setPage(p => p + 1)}>التالي</Button>
            </div>
          </TabsContent>

          {/* ── Risk Analysis ── */}
          <TabsContent value="risk" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">عمليات SA الأخيرة</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(riskData?.saAccess ?? []).map((r: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs p-2 rounded bg-red-50">
                        <span className="font-mono">{r.action}</span>
                        <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-orange-600">تغييرات الأذونات والأدوار</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(riskData?.permChanges ?? []).map((r: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs p-2 rounded bg-orange-50">
                        <span>{r.action} — {r.resource}</span>
                        <span className="text-muted-foreground">{r.user_full_name?.slice(0, 15)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">عمليات الحذف الجماعي (7 أيام)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(riskData?.deletions ?? []).map((r: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs p-2 rounded bg-muted">
                        <span>{r.user_full_name ?? r.user_id?.slice(0, 12)}</span>
                        <span className="font-medium text-red-600">{r.count} عملية حذف</span>
                      </div>
                    ))}
                    {(riskData?.deletions ?? []).length === 0 && <p className="text-xs text-center text-muted-foreground py-4">لا عمليات حذف مشبوهة ✅</p>}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-purple-600">عمليات AI الأخيرة</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {(riskData?.aiOps ?? []).slice(0, 10).map((r: any, i: number) => (
                      <div key={i} className="flex justify-between text-xs p-2 rounded bg-purple-50">
                        <span>{r.action}</span>
                        <span className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar")}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Coverage ── */}
          <TabsContent value="coverage" className="space-y-4 mt-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600">{coverage?.coveragePercent ?? 0}%</div>
                    <div className="text-xs text-muted-foreground mt-1">نسبة التغطية الكاملة</div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-xs"><span>موارد مُغطّاة</span><span className="font-medium text-green-600">{coverage?.covered?.length ?? 0}</span></div>
                    <div className="flex justify-between text-xs"><span>موارد مفقودة</span><span className="font-medium text-red-600">{coverage?.missing?.length ?? 0}</span></div>
                    <div className="flex justify-between text-xs"><span>إجمالي الإجراءات المسجّلة</span><span className="font-medium">{coverage?.actions?.length ?? 0}</span></div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-3">الموارد الحرجة المطلوبة</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(coverage?.required ?? []).map((r: string, i: number) => {
                      const covered = (coverage?.covered ?? []).includes(r);
                      return (
                        <div key={i} className={`flex items-center gap-2 p-2 rounded text-xs ${covered ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                          {covered ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {RESOURCE_LABELS[r] ?? r}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
