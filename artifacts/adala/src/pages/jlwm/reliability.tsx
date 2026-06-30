/**
 * JLWM Reliability & Trust Layer — Executive Dashboard
 * 9 components unified in one page:
 *  1. Trust Score Engine          — composite JLWM Trust Score
 *  2. Confidence Validation       — per-prediction confidence metadata
 *  3. Explainable AI              — structured reasoning
 *  4. Recommendation Validation   — track recommendation outcomes
 *  5. Data Quality Engine         — office data quality score
 *  6. AI Audit Trail              — immutable log of every AI decision
 *  7. Continuous Learning Loop    — update weights on real outcomes
 *  8. Executive Reliability Dash  — aggregate view
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Target, BarChart3, Database, BookOpen,
  RefreshCw, Brain, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Clock, Zap, Activity, Award, ChevronRight,
  Info, Lightbulb, ListChecks, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/* ── API helpers ────────────────────────────────────────────── */
const api = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...opts });

const scoreColor = (s: number) =>
  s >= 85 ? "text-emerald-600" : s >= 70 ? "text-blue-600" : s >= 55 ? "text-amber-600" : "text-red-600";
const scoreBg = (s: number) =>
  s >= 85 ? "bg-emerald-50 border-emerald-200" : s >= 70 ? "bg-blue-50 border-blue-200"
    : s >= 55 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";
const severityBadge = (sev: string) =>
  sev === "high" ? "destructive" : sev === "medium" ? "secondary" : "outline";

/* ── Trust Score Ring ───────────────────────────────────────── */
function TrustRing({ score, label }: { score: number; label: string }) {
  const r = 52, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 85 ? "#10b981" : score >= 70 ? "#3b82f6" : score >= 55 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="128" height="128" className="-rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute text-center">
        <div className={`text-2xl font-bold ${scoreColor(score)}`}>{score}</div>
        <div className="text-[10px] text-muted-foreground">/100</div>
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function Reliability() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confidenceCaseId, setConfidenceCaseId] = useState("");

  /* Dashboard */
  const { data: dash, isLoading: dashLoading, refetch: refetchDash } = useQuery({
    queryKey: ["jlwm-reliability-dashboard"],
    queryFn: () => api("/jlwm/reliability/dashboard").then(r => r.json()),
    staleTime: 2 * 60_000,
  });

  /* Data Quality */
  const { data: dq, isLoading: dqLoading, refetch: refetchDQ } = useQuery({
    queryKey: ["jlwm-data-quality"],
    queryFn: () => api("/jlwm/reliability/data-quality").then(r => r.json()),
    staleTime: 10 * 60_000,
  });

  /* Audit Trail */
  const { data: audit, isLoading: auditLoading } = useQuery({
    queryKey: ["jlwm-audit-trail"],
    queryFn: () => api("/jlwm/reliability/audit").then(r => r.json()),
    staleTime: 60_000,
  });

  /* Recommendations */
  const { data: recs, isLoading: recsLoading } = useQuery({
    queryKey: ["jlwm-recommendations"],
    queryFn: () => api("/jlwm/reliability/recommendations").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  /* Learning Events */
  const { data: learning, isLoading: learningLoading } = useQuery({
    queryKey: ["jlwm-learning-events"],
    queryFn: () => api("/jlwm/reliability/learning-events").then(r => r.json()),
    staleTime: 5 * 60_000,
  });

  /* Trust Score */
  const { data: trustData } = useQuery({
    queryKey: ["jlwm-trust-score"],
    queryFn: () => api("/jlwm/reliability/trust-score").then(r => r.json()),
    staleTime: 2 * 60_000,
  });

  /* Confidence for case */
  const { data: confData, refetch: refetchConf, isFetching: confFetching } = useQuery({
    queryKey: ["jlwm-confidence", confidenceCaseId],
    queryFn: () => api(`/jlwm/reliability/confidence/${confidenceCaseId}`).then(r => r.json()),
    enabled: false,
    staleTime: 0,
  });

  /* Mutations */
  const refreshDQ = useMutation({
    mutationFn: () => api("/jlwm/reliability/data-quality?refresh=1").then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(["jlwm-data-quality"], data);
      toast({ title: "تم تحديث تقييم جودة البيانات" });
    },
  });

  const refreshTrust = useMutation({
    mutationFn: () => api("/jlwm/reliability/trust-score?refresh=1").then(r => r.json()),
    onSuccess: (data) => {
      qc.setQueryData(["jlwm-trust-score"], data);
      qc.invalidateQueries({ queryKey: ["jlwm-reliability-dashboard"] });
      toast({ title: "تم إعادة حساب Trust Score" });
    },
  });

  const triggerLearning = useMutation({
    mutationFn: () => api("/jlwm/reliability/learn", { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["jlwm-learning-events"] });
      toast({
        title: `حلقة التعلم اكتملت`,
        description: `تم تحديث ${data.updated ?? 0} نمط تعلمي`,
      });
    },
  });

  const ts   = dash?.trust_score ?? trustData ?? {};
  const score = Number(ts.trust_score ?? ts.score ?? 0);
  const label = ts.label ?? "—";

  return (
    <div className="space-y-6 p-1" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            الموثوقية والتحقق
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            طبقة الموثوقية الكاملة — قياس جودة القرارات والتعلم من النتائج الفعلية
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchDash(); }}
            disabled={dashLoading}>
            <RefreshCw className="h-4 w-4 me-1.5" /> تحديث
          </Button>
          <Button size="sm" onClick={() => triggerLearning.mutate()}
            disabled={triggerLearning.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white">
            <Brain className="h-4 w-4 me-1.5" />
            {triggerLearning.isPending ? "جارٍ التعلم…" : "تفعيل التعلم المستمر"}
          </Button>
        </div>
      </div>

      {/* ── Component 1 & 8: Trust Score + Summary ──────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Trust Score Card */}
        <Card className={`md:col-span-1 border-2 ${scoreBg(score)}`}>
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-sm">JLWM Trust Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 pb-4">
            <TrustRing score={score} label={label} />
            <Badge variant={score >= 70 ? "default" : "secondary"} className="text-sm px-3 py-1">
              {label}
            </Badge>
            <Button variant="outline" size="sm" className="w-full"
              onClick={() => refreshTrust.mutate()} disabled={refreshTrust.isPending}>
              <RefreshCw className="h-3.5 w-3.5 me-1" />
              {refreshTrust.isPending ? "جارٍ الحساب…" : "إعادة الحساب"}
            </Button>
          </CardContent>
        </Card>

        {/* Breakdown */}
        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              مكوّنات Trust Score
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "prediction_accuracy",    label: "دقة التنبؤات",         weight: "35%", icon: Target,       color: "text-blue-600" },
              { key: "data_quality",            label: "جودة البيانات",        weight: "25%", icon: Database,     color: "text-green-600" },
              { key: "recommendation_success",  label: "نجاح التوصيات",        weight: "20%", icon: ListChecks,   color: "text-amber-600" },
              { key: "stability_score",         label: "استقرار النتائج",      weight: "10%", icon: Activity,     color: "text-purple-600" },
              { key: "audit_completeness",      label: "اكتمال سجل التدقيق",   weight: "10%", icon: BookOpen,     color: "text-rose-600" },
            ].map(item => {
              const val = Number(ts[item.key] ?? 0);
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className={`font-semibold ${scoreColor(val)}`}>{val}%</span>
                    </div>
                    <Progress value={val} className="h-2" />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-center">{item.weight}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <Tabs defaultValue="accuracy" dir="rtl">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="accuracy">دقة التنبؤات</TabsTrigger>
          <TabsTrigger value="confidence">التحقق من الثقة</TabsTrigger>
          <TabsTrigger value="data-quality">جودة البيانات</TabsTrigger>
          <TabsTrigger value="recommendations">التوصيات</TabsTrigger>
          <TabsTrigger value="audit">سجل التدقيق AI</TabsTrigger>
          <TabsTrigger value="learning">التعلم المستمر</TabsTrigger>
        </TabsList>

        {/* ── Component 1: Prediction Accuracy ─────────────── */}
        <TabsContent value="accuracy" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                دقة التنبؤات حسب النوع
              </CardTitle>
              <CardDescription>مبني على {dash?.accuracy?.by_type?.length > 0 ? "سجلات حقيقية" : "لا توجد سجلات بعد"}</CardDescription>
            </CardHeader>
            <CardContent>
              {!dash?.accuracy?.by_type?.length ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Target className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>لا توجد سجلات دقة بعد</p>
                  <p className="text-xs mt-1">تُبنى تلقائياً عند إغلاق القضايا ومقارنة التوقعات بالنتائج</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dash.accuracy.by_type.map((row: any) => {
                    const val = Math.round(Number(row.avg_accuracy ?? 0) * 100);
                    return (
                      <div key={row.prediction_type} className="border rounded-lg p-4">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-medium">{row.prediction_type}</span>
                          <span className={`text-sm font-bold ${scoreColor(val)}`}>{val}%</span>
                        </div>
                        <Progress value={val} className="h-2 mb-1" />
                        <div className="text-xs text-muted-foreground">{row.count} سجل</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prediction types overview */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { type: "outcome",    label: "نتيجة القضية",    desc: "فوز / خسارة / تسوية" },
              { type: "duration",   label: "مدة القضية",      desc: "الزمن المتوقع لإغلاقها" },
              { type: "settlement", label: "فرصة التسوية",    desc: "احتمال التسوية الودية" },
              { type: "appeal",     label: "خطر الاستئناف",   desc: "احتمال الطعن بالنتيجة" },
              { type: "execution",  label: "التنفيذ",         desc: "إمكانية تنفيذ الحكم" },
              { type: "revenue",    label: "توقع الإيرادات",  desc: "دقة التوقع المالي" },
            ].map(item => (
              <div key={item.type}
                className="border rounded-lg p-3 hover:bg-muted/30 transition-colors">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Component 2 & 3: Confidence + Explainability ─── */}
        <TabsContent value="confidence" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-indigo-500" />
                التحقق من الثقة والتفسير
              </CardTitle>
              <CardDescription>أدخل رقم القضية لعرض تفاصيل الثقة والعوامل المؤثرة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="معرّف القضية (case id)…"
                  value={confidenceCaseId}
                  onChange={e => setConfidenceCaseId(e.target.value)}
                  className="flex-1"
                  dir="ltr"
                />
                <Button onClick={() => refetchConf()} disabled={!confidenceCaseId || confFetching}>
                  <Search className="h-4 w-4 me-1" />
                  {confFetching ? "جارٍ البحث…" : "تحليل"}
                </Button>
              </div>

              {confData && (
                <div className="space-y-4">
                  {/* Confidence header */}
                  <div className={`rounded-lg p-4 border ${scoreBg(Number(confData.confidence_pct ?? 0))}`}>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className={`text-2xl font-bold ${scoreColor(Number(confData.confidence_pct))}`}>
                          {confData.confidence_pct}%
                        </div>
                        <div className="text-xs text-muted-foreground">مستوى الثقة</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{confData.evidence_count}</div>
                        <div className="text-xs text-muted-foreground">عدد الأدلة</div>
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${scoreColor(Number(confData.data_quality_pct))}`}>
                          {confData.data_quality_pct}%
                        </div>
                        <div className="text-xs text-muted-foreground">جودة البيانات</div>
                      </div>
                    </div>
                    <div className="mt-3 text-center">
                      <Badge variant="outline" className="text-sm px-3">
                        مستوى الثقة: {confData.confidence_level}
                      </Badge>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "المستندات",    value: confData.breakdown?.documents },
                      { label: "المهام الكلية", value: confData.breakdown?.tasks_total },
                      { label: "المهام المكتملة",value: confData.breakdown?.tasks_done },
                      { label: "الجلسات",      value: confData.breakdown?.hearings },
                    ].map(b => (
                      <div key={b.label} className="border rounded-lg p-3 text-center">
                        <div className="text-xl font-bold">{b.value ?? 0}</div>
                        <div className="text-xs text-muted-foreground">{b.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Prediction values */}
                  {confData.predictions && Object.keys(confData.predictions).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">التوقعات المرتبطة:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(confData.predictions).map(([k, v]: [string, any]) => (
                          <div key={k} className="border rounded p-2 text-xs">
                            <span className="text-muted-foreground">{k}: </span>
                            <span className="font-medium">
                              {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Explainability guide */}
              <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">كيف يعمل Explainable AI؟</p>
                    <p className="text-xs text-amber-700 mt-1">
                      كل توقع يتضمن عوامل إيجابية تدعمه وعوامل سلبية تقلل ثقته.
                      النظام يحلل المستندات، المهام، الجلسات، وكمال بيانات القضية لبناء تفسير شفاف قابل للمراجعة.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Component 5: Data Quality Engine ────────────── */}
        <TabsContent value="data-quality" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Data Quality Score</h3>
            <Button variant="outline" size="sm" onClick={() => refreshDQ.mutate()}
              disabled={refreshDQ.isPending || dqLoading}>
              <RefreshCw className="h-3.5 w-3.5 me-1" />
              {refreshDQ.isPending ? "جارٍ الفحص…" : "فحص الآن"}
            </Button>
          </div>

          {dqLoading ? (
            <div className="text-center py-10 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-40" />
              جارٍ تحليل جودة البيانات…
            </div>
          ) : dq ? (
            <>
              {/* Overall gauge */}
              <Card className={`border-2 ${scoreBg(Number(dq.overall_score ?? 0))}`}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-6">
                    <TrustRing score={Math.round(Number(dq.overall_score ?? 0))} label="" />
                    <div className="flex-1 space-y-2">
                      <p className="font-semibold">
                        {Number(dq.overall_score) >= 85 ? "جودة ممتازة" :
                         Number(dq.overall_score) >= 70 ? "جودة جيدة" :
                         Number(dq.overall_score) >= 55 ? "جودة مقبولة — تحتاج تحسين" : "جودة ضعيفة — يحتاج مراجعة"}
                      </p>
                      {[
                        { label: "القضايا",    value: dq.cases_score,     color: "text-blue-600" },
                        { label: "العملاء",    value: dq.clients_score,   color: "text-green-600" },
                        { label: "المستندات",  value: dq.documents_score, color: "text-amber-600" },
                        { label: "المهام",     value: dq.tasks_score,     color: "text-purple-600" },
                        { label: "الجلسات",   value: dq.sessions_score,  color: "text-rose-600" },
                      ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 text-xs">
                          <span className="w-16 text-muted-foreground">{item.label}</span>
                          <Progress value={Number(item.value ?? 0)} className="h-1.5 flex-1" />
                          <span className={`w-8 text-right font-medium ${item.color}`}>
                            {Math.round(Number(item.value ?? 0))}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Issues */}
              {Array.isArray(dq.issues) && dq.issues.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      المشكلات المكتشفة ({dq.issues.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dq.issues.map((issue: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                          <span className="text-sm">{issue.message}</span>
                          <Badge variant={severityBadge(issue.severity) as any}>
                            {issue.severity === "high" ? "عالية" : issue.severity === "medium" ? "متوسطة" : "منخفضة"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <Database className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <Button onClick={() => refreshDQ.mutate()}>ابدأ تحليل جودة البيانات</Button>
            </div>
          )}
        </TabsContent>

        {/* ── Component 4: Recommendation Validation ──────── */}
        <TabsContent value="recommendations" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-green-500" />
                متابعة التوصيات
              </CardTitle>
              <CardDescription>تتبع ما إذا كانت التوصيات تُحسّن النتائج فعلياً</CardDescription>
            </CardHeader>
            <CardContent>
              {recsLoading ? (
                <div className="text-center py-8 text-muted-foreground">جارٍ التحميل…</div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "إجمالي التوصيات", value: recs?.stats?.total ?? 0,    icon: ListChecks },
                      { label: "طُبِّقت",          value: recs?.stats?.applied ?? 0,  icon: CheckCircle2 },
                      { label: "حسّنت النتيجة",    value: recs?.stats?.improved ?? 0, icon: TrendingUp },
                      { label: "نجاح متوسط",        value: `${Math.round((recs?.stats?.avg_success ?? 0) * 100)}%`, icon: Award },
                    ].map(item => (
                      <div key={item.label} className="border rounded-lg p-3 text-center">
                        <item.icon className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                        <div className="text-xl font-bold">{item.value}</div>
                        <div className="text-xs text-muted-foreground">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Records */}
                  {!recs?.records?.length ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ListChecks className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p>لا توجد سجلات توصيات بعد</p>
                      <p className="text-xs mt-1">تُبنى تلقائياً عند متابعة نتائج التوصيات من صفحة التوصيات الذكية</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recs.records.map((r: any) => (
                        <div key={r.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                          <div>
                            <p className="text-sm font-medium">{r.title}</p>
                            <p className="text-xs text-muted-foreground">{r.category}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={r.outcome_improved ? "default" : r.was_applied ? "secondary" : "outline"}>
                              {r.outcome_improved ? "ناجحة" : r.was_applied ? "طُبِّقت" : "لم تُطبَّق"}
                            </Badge>
                            <span className={`text-sm font-bold ${scoreColor(Math.round((r.success_score ?? 0) * 100))}`}>
                              {Math.round((r.success_score ?? 0) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Component 7: AI Audit Trail ─────────────────── */}
        <TabsContent value="audit" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-rose-500" />
                سجل تدقيق AI — كل قرار ذكاء اصطناعي
              </CardTitle>
              <CardDescription>سجل ثابت وغير قابل للتعديل لكل قرار أو توصية أو توقع صدر من الذكاء الاصطناعي</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Audit stats */}
              {audit?.stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "إجمالي القرارات",  value: audit.stats.total ?? 0 },
                    { label: "النماذج المستخدمة", value: audit.stats.models ?? 0 },
                    { label: "متوسط الثقة",       value: `${Math.round((audit.stats.avg_confidence ?? 0) * 100)}%` },
                    { label: "متوسط الوقت",       value: `${audit.stats.avg_duration_ms ?? 0}ms` },
                  ].map(item => (
                    <div key={item.label} className="border rounded-lg p-3 text-center">
                      <div className="text-lg font-bold">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {auditLoading ? (
                <div className="text-center py-8"><RefreshCw className="h-6 w-6 mx-auto animate-spin opacity-40" /></div>
              ) : !audit?.audit?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>لا توجد سجلات تدقيق بعد</p>
                  <p className="text-xs mt-1">تُسجَّل تلقائياً عند كل استخدام للذكاء الاصطناعي في المنصة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {audit.audit.map((entry: any) => (
                    <div key={entry.id} className="border rounded-lg p-3 hover:bg-muted/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{entry.query_type}</Badge>
                            <span className="text-xs text-muted-foreground">{entry.model_used}</span>
                            {entry.tier && <Badge variant="secondary" className="text-[10px]">{entry.tier}</Badge>}
                          </div>
                          {entry.input_summary && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">{entry.input_summary}</p>
                          )}
                          {entry.output_summary && (
                            <p className="text-xs mt-1 line-clamp-2">{entry.output_summary}</p>
                          )}
                        </div>
                        <div className="text-left shrink-0">
                          {entry.confidence != null && (
                            <div className={`text-sm font-bold ${scoreColor(Math.round(entry.confidence * 100))}`}>
                              {Math.round(entry.confidence * 100)}%
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(entry.created_at).toLocaleDateString("ar-SA")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Component 9: Continuous Learning Loop ───────── */}
        <TabsContent value="learning" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-violet-500" />
                التعلم المستمر من النتائج الفعلية
              </CardTitle>
              <CardDescription>
                النظام يحلل القضايا المغلقة ويحدّث الأوزان والأنماط تلقائياً
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-violet-50 border-violet-200">
                <div>
                  <p className="text-sm font-medium text-violet-800">تفعيل حلقة التعلم</p>
                  <p className="text-xs text-violet-600 mt-0.5">
                    يحلل القضايا المغلقة الأخيرة ويحدث أوزان النماذج بناءً على دقة التوقعات
                  </p>
                </div>
                <Button className="bg-violet-600 hover:bg-violet-700 text-white"
                  onClick={() => triggerLearning.mutate()}
                  disabled={triggerLearning.isPending}>
                  <Zap className="h-4 w-4 me-1.5" />
                  {triggerLearning.isPending ? "جارٍ التعلم…" : "تشغيل الآن"}
                </Button>
              </div>

              {/* Learning stats */}
              {dash?.learning && (
                <div className="grid grid-cols-2 gap-3 mobile-single-col">
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-violet-600">{dash.learning.events ?? 0}</div>
                    <div className="text-xs text-muted-foreground">أحداث تعلم (30 يوم)</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {Math.round((dash.learning.avg_delta ?? 0) * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">متوسط التغيير في الأوزان</div>
                  </div>
                </div>
              )}

              {/* Learning events */}
              {learningLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 mx-auto animate-spin opacity-40" />
                </div>
              ) : !learning?.events?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p>لا توجد أحداث تعلم بعد</p>
                  <p className="text-xs mt-1">اضغط "تشغيل الآن" لتحليل القضايا المغلقة وتحديث الأوزان</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {learning.events.map((ev: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border rounded-lg p-3">
                      <div>
                        <p className="text-sm font-mono text-xs">{ev.pattern_key}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {Math.round((ev.old_weight ?? 0) * 100)}%
                          </span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">
                            {Math.round((ev.new_weight ?? 0) * 100)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {Number(ev.delta) >= 0
                          ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                          : <TrendingDown className="h-4 w-4 text-red-500" />
                        }
                        <span className={`text-sm font-bold ${Number(ev.delta) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {Number(ev.delta) >= 0 ? "+" : ""}{Math.round(Number(ev.delta) * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Model Usage (Component 8 footer) ────────────────── */}
      {dash?.model_usage?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-500" />
              استخدام النماذج
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {dash.model_usage.map((m: any) => (
                <div key={m.model_used} className="border rounded-lg p-3 text-center">
                  <div className="text-sm font-bold">{m.calls}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.model_used}</div>
                  <div className="text-xs text-muted-foreground">{m.avg_ms}ms</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
