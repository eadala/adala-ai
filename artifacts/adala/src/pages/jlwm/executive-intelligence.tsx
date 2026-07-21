/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Crown, TrendingUp, TrendingDown, AlertTriangle, Users,
  DollarSign, BarChart3, RefreshCw, FileText, ChevronDown,
  ChevronRight, Target, Award, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const REPORT_TYPES = [
  { value: "weekly", label: "أسبوعي" },
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
];

function KPICard({ label, value, suffix = "", color = "text-blue-600", icon: Icon }: any) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}<span className="text-sm font-normal ms-1">{suffix}</span></p>
          </div>
          <Icon className={`h-5 w-5 ${color} opacity-70`} />
        </div>
      </CardContent>
    </Card>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    high: "bg-red-100 text-red-700 border-red-300",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-300",
    low: "bg-emerald-100 text-emerald-700 border-emerald-300",
  };
  const labels: Record<string, string> = { high: "عالي", medium: "متوسط", low: "منخفض" };
  return <Badge variant="outline" className={map[level] ?? map.low}>{labels[level] ?? level}</Badge>;
}

export default function ExecutiveIntelligencePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("summary");
  const [reportType, setReportType] = useState("weekly");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => setExpandedSections(s => ({ ...s, [key]: !s[key] }));

  const { data: report, isLoading } = useQuery({
    queryKey: ["jlwm", "executive", "latest", reportType],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/jlwm/executive/latest?type=${reportType}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 300_000,
  });

  const { data: reportsList } = useQuery({
    queryKey: ["jlwm", "executive", "list"],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/jlwm/executive/reports?limit=10`);
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ reports: any[] }>;
    },
    staleTime: 60_000,
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`${BASE}/api/jlwm/executive/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: reportType }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم إنشاء التقرير التنفيذي" });
      qc.invalidateQueries({ queryKey: ["jlwm", "executive"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const kpis = report?.kpis ?? {};
  const rfcast = report?.revenue_forecast ?? {};
  const rconc = report?.risk_concentration ?? {};
  const lawyers = (report?.lawyer_performance ?? []) as any[];
  const clients = (report?.client_risk ?? []) as any[];
  const opps = (report?.opportunities ?? []) as string[];
  const alerts = (report?.alerts ?? []) as any[];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-500" />
            الذكاء التنفيذي
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تقارير تنفيذية شاملة وتحليل استراتيجي للمكتب</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
            <RefreshCw className={`h-4 w-4 me-1 ${generateMut.isPending ? "animate-spin" : ""}`} />
            {generateMut.isPending ? "جارٍ الإنشاء..." : "إنشاء تقرير"}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a: any, i: number) => (
            <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border text-sm
              ${a.severity === "high" ? "bg-red-50 border-red-200" : a.severity === "medium" ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"}`}>
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <span className="font-medium">{a.message}</span>
                {a.action && <span className="text-muted-foreground ms-2">← {a.action}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">جارٍ تحليل بيانات المكتب بالذكاء الاصطناعي...</div>
      ) : !report ? (
        <Card>
          <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
            <Crown className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="mb-4">لا يوجد تقرير تنفيذي. أنشئ تقريرك الأول الآن.</p>
            <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
              {generateMut.isPending ? "جارٍ الإنشاء..." : "إنشاء تقرير تنفيذي"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Executive Summary */}
          {report.executive_summary && (
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-700">الملخص التنفيذي</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed">{report.executive_summary}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  تقرير {REPORT_TYPES.find(t => t.value === reportType)?.label} •{" "}
                  {report.generated_at ? new Date(report.generated_at).toLocaleDateString("ar-SA") : ""}
                </p>
              </CardContent>
            </Card>
          )}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto flex-wrap gap-1 p-1 bg-muted/40">
              <TabsTrigger value="summary">مؤشرات الأداء</TabsTrigger>
              <TabsTrigger value="revenue">توقعات الإيرادات</TabsTrigger>
              <TabsTrigger value="risks">تركّز المخاطر</TabsTrigger>
              <TabsTrigger value="lawyers">أداء المحامين</TabsTrigger>
              <TabsTrigger value="clients">مخاطر العملاء</TabsTrigger>
              <TabsTrigger value="history">سجل التقارير</TabsTrigger>
            </TabsList>

            {/* KPIs */}
            <TabsContent value="summary" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <KPICard label="معدل الفوز" value={kpis.win_rate ?? 0} suffix="%" color="text-emerald-600" icon={Target} />
                <KPICard label="القضايا المغلقة" value={kpis.case_velocity ?? 0} suffix="" color="text-blue-600" icon={BarChart3} />
                <KPICard label="نمو الإيرادات" value={kpis.revenue_growth ?? 0} suffix="%" color="text-purple-600" icon={TrendingUp} />
                <KPICard label="كفاءة الفريق" value={kpis.team_efficiency ?? 0} suffix="%" color="text-orange-600" icon={Users} />
                <KPICard label="رضا العملاء" value={kpis.client_satisfaction_index ?? 0} suffix="%" color="text-indigo-600" icon={Award} />
              </div>

              {opps.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" /> الفرص المتاحة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {opps.map((o: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-yellow-500 mt-0.5">●</span> {o}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Revenue Forecast */}
            <TabsContent value="revenue" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-500" /> توقعات الإيرادات
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-emerald-600">
                        {Number(rfcast.next_period_estimate ?? 0).toLocaleString("ar")}
                      </span>
                      <span className="text-muted-foreground text-sm">ريال — الفترة القادمة</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">مستوى الثقة:</span>
                      <Progress value={Number(rfcast.confidence ?? 60)} className="flex-1 h-2" />
                      <span className="text-xs font-medium">{rfcast.confidence ?? 60}%</span>
                    </div>
                    {rfcast.monthly_breakdown?.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {(rfcast.monthly_breakdown as any[]).map((m: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{m.month}</span>
                            <span className="font-medium">{Number(m.amount ?? 0).toLocaleString("ar")} ريال</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="space-y-3">
                  {rfcast.growth_drivers?.length > 0 && (
                    <Card className="border-emerald-200 bg-emerald-50">
                      <CardHeader className="pb-1"><CardTitle className="text-xs text-emerald-700">محركات النمو</CardTitle></CardHeader>
                      <CardContent>
                        {(rfcast.growth_drivers as string[]).map((d: string, i: number) => (
                          <div key={i} className="flex items-center gap-1 text-xs mt-1">
                            <TrendingUp className="h-3 w-3 text-emerald-500" /> {d}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  {rfcast.risks?.length > 0 && (
                    <Card className="border-red-200 bg-red-50">
                      <CardHeader className="pb-1"><CardTitle className="text-xs text-red-700">مخاطر الإيرادات</CardTitle></CardHeader>
                      <CardContent>
                        {(rfcast.risks as string[]).map((r: string, i: number) => (
                          <div key={i} className="flex items-center gap-1 text-xs mt-1">
                            <TrendingDown className="h-3 w-3 text-red-500" /> {r}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Risk Concentration */}
            <TabsContent value="risks" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">مؤشر تركّز المخاطر</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`text-3xl font-bold ${Number(rconc.overall_risk_score ?? 30) > 60 ? "text-red-600" : Number(rconc.overall_risk_score ?? 30) > 40 ? "text-yellow-600" : "text-emerald-600"}`}>
                        {rconc.overall_risk_score ?? 0}
                      </span>
                      <span className="text-sm text-muted-foreground">/ 100</span>
                    </div>
                    <Progress value={rconc.overall_risk_score ?? 30} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      {Number(rconc.overall_risk_score ?? 30) > 60 ? "تركّز مخاطر مرتفع — يوصى بالتنويع"
                      : Number(rconc.overall_risk_score ?? 30) > 40 ? "تركّز مخاطر متوسط — مراقبة مستمرة"
                      : "تركّز مخاطر منخفض — توزيع جيد"}
                    </p>
                  </CardContent>
                </Card>
                {rconc.high_risk_clients?.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-600">عملاء عالي المخاطر</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(rconc.high_risk_clients as any[]).map((c: any, i: number) => (
                        <div key={i} className="flex justify-between items-start text-sm border-b pb-2 last:border-0">
                          <div>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">{c.risk}</div>
                          </div>
                          <span className="text-red-600 font-medium text-xs">
                            {Number(c.unpaid_amount ?? 0).toLocaleString("ar")} ريال
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Lawyer Performance */}
            <TabsContent value="lawyers" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" /> أداء المحامين
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!lawyers.length ? (
                    <p className="text-center text-muted-foreground py-4">لا بيانات فريق متاحة</p>
                  ) : (
                    <div className="space-y-3">
                      {lawyers.map((l: any, i: number) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                            {l.name?.[0] ?? "؟"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{l.name}</span>
                              {l.trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                              {l.trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span>قضايا: <b className="text-foreground">{l.cases}</b></span>
                              <span>كفاءة: <b className="text-foreground">{l.efficiency}%</b></span>
                            </div>
                            {l.insights && <p className="text-xs text-muted-foreground mt-0.5">{l.insights}</p>}
                          </div>
                          <div className="text-center">
                            <div className={`text-xl font-bold ${Number(l.score ?? 70) >= 80 ? "text-emerald-600" : Number(l.score ?? 70) >= 60 ? "text-yellow-600" : "text-red-500"}`}>
                              {l.score ?? 70}
                            </div>
                            <div className="text-xs text-muted-foreground">نقاط</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Client Risk */}
            <TabsContent value="clients" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" /> تحليل مخاطر العملاء
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!clients.length ? (
                    <p className="text-center text-muted-foreground py-4">لا توجد مخاطر عملاء تستحق الإبلاغ</p>
                  ) : (
                    <div className="space-y-3">
                      {clients.map((c: any, i: number) => (
                        <div key={i} className="flex items-start justify-between p-3 rounded-lg border bg-card gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{c.name}</span>
                              <RiskBadge level={c.risk_level} />
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <div>مبلغ غير مسدد: <b className="text-foreground">{Number(c.unpaid ?? 0).toLocaleString("ar")} ريال</b></div>
                              {c.recommendation && <div>توصية: {c.recommendation}</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History */}
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-indigo-500" /> سجل التقارير التنفيذية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!reportsList?.reports?.length ? (
                    <p className="text-center text-muted-foreground py-4">لا توجد تقارير سابقة</p>
                  ) : (
                    <div className="space-y-2">
                      {reportsList.reports.map((r: any) => (
                        <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors">
                          <div>
                            <div className="font-medium text-sm">
                              تقرير {REPORT_TYPES.find(t => t.value === r.report_type)?.label ?? r.report_type}
                            </div>
                            <div className="text-xs text-muted-foreground">{r.executive_summary?.slice(0, 80)}...</div>
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0 ms-3">
                            {new Date(r.generated_at).toLocaleDateString("ar-SA")}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
