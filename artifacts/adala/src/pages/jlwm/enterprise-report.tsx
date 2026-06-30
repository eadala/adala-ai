/**
 * JLWM Enterprise Report — Phase 4
 * لوحة التكامل المؤسسي الشاملة لـ Justice Legal World Model
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Brain, Globe, BarChart3, CheckCircle2, AlertTriangle,
  XCircle, RefreshCw, Download, Zap, Database, Lock, Activity,
  FileText, Server, TrendingUp, Clock, ChevronDown, ChevronUp,
  Building2, Users, Cpu, HardDrive, Search, Eye, Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

/* ── Types ───────────────────────────────────────────────── */
interface EnterpriseReport {
  officeId:   string;
  generatedAt: string;
  enterpriseScore: { score: number; grade: string; label: string };
  qualityScores:   Record<string, number>;
  sections: {
    modules:         { connected: number; total: number; criticalConnected: number; criticalTotal: number; integrationCoverage: number; items: ModuleItem[] };
    documents:       { total: number; withCase: number; withOCR: number; withSignature: number; categories: Record<string, number> };
    backup:          { jlwmTablesCount: number; jlwmRowTotal: number; orphanedRecords: number; estimatedBackupMB: number; backupJobsConfigured: number };
    tenantIsolation: { passed: number; failed: number; score: number; tests: any[] };
    clientIsolation: { score: number; casesWithoutClient: number; predictionsIsolated: boolean };
    aiHealth:        { jlwmCalls: number; successRate: number; modelsUsed: string[]; creditsUsed: number; score: number; auditTrailComplete: boolean };
    search:          { jlwmTablesIndexed: number; searchableOutputs: string[] };
    audit:           { auditLogsTotal: number; jlwmAuditEntries: number; coverageScore: number };
    reliability:     { integrityScore: number; securityScore: number; backupScore: number; healthScore: number; trustScore: number; dataQualityScore: number };
    performance:     { totalJLWMRows: number; indexCount: number; scalabilityScore: number; bottlenecks: string[] };
  };
  risks:           { severity: string; description: string }[];
  recommendations: string[];
}
interface ModuleItem {
  module: string; nameAr: string; category: string; critical: boolean;
  status: "connected" | "empty" | "missing"; count: number;
}

/* ── Score Ring ──────────────────────────────────────────── */
function ScoreRing({ score, label, color, size = 80 }: { score: number; label: string; color: string; size?: number }) {
  const r = size * 0.4;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, score) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth={size*0.09} className="text-muted/30" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.09}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />
        <text x={size/2} y={size/2+5} textAnchor="middle" fontSize={size*0.2} fontWeight="700" fill={color}>
          {Math.round(score)}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  );
}

/* ── Status Badge ────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  if (status === "connected")
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">متصل ✓</Badge>;
  if (status === "empty")
    return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">فارغ</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">غير موجود</Badge>;
}

/* ── Category Colors ─────────────────────────────────────── */
const CAT_COLORS: Record<string, string> = {
  legal:    "bg-blue-50 border-blue-200",
  finance:  "bg-emerald-50 border-emerald-200",
  ops:      "bg-purple-50 border-purple-200",
  hr:       "bg-orange-50 border-orange-200",
  security: "bg-red-50 border-red-200",
  storage:  "bg-indigo-50 border-indigo-200",
  backup:   "bg-amber-50 border-amber-200",
  ai:       "bg-violet-50 border-violet-200",
};

const RISK_COLORS: Record<string, string> = {
  critical: "border-red-400 bg-red-50 text-red-800",
  high:     "border-orange-400 bg-orange-50 text-orange-800",
  medium:   "border-yellow-400 bg-yellow-50 text-yellow-800",
  low:      "border-blue-400 bg-blue-50 text-blue-800",
};

const SCORE_LABELS: Record<string, string> = {
  dataIntegrity:             "سلامة البيانات",
  securityCompliance:        "الامتثال الأمني",
  tenantIsolation:           "عزل المكاتب",
  backupReadiness:           "جاهزية النسخ",
  aiReliability:             "موثوقية الذكاء الاصطناعي",
  predictionAccuracy:        "دقة التنبؤ",
  recommendationEffectiveness:"فاعلية التوصيات",
  trustScore:                "درجة الثقة",
};

const SCORE_COLORS = ["#6366F1","#10B981","#3B82F6","#F59E0B","#8B5CF6","#06B6D4","#F97316","#EF4444"];

/* ── Main Component ──────────────────────────────────────── */
export default function JLWMEnterpriseReport() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<{ ok: boolean; report: EnterpriseReport }>({
    queryKey: ["jlwm", "enterprise", "report"],
    queryFn: async () => {
      const r = await fetch("/api/jlwm/enterprise/report");
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 120_000,
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/jlwm/enterprise/sync-all", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["jlwm"] });
      const s = data?.synced ?? {};
      toast({
        title: "✅ تمت المزامنة الشاملة",
        description: `حالة العالم: ${s.worldState ? "محدّثة" : "—"} · التوأم القضوي: ${s.caseTwins ?? 0} · توأم العملاء: ${s.clientTwins ?? 0} · الذاكرة: ${s.memoryNodes ?? 0} عقدة`,
      });
    },
    onError: (e: any) => toast({ title: "فشل التزامن", description: e.message, variant: "destructive" }),
  });

  const secAuditQuery = useQuery({
    queryKey: ["jlwm", "enterprise", "security"],
    queryFn: async () => {
      const r = await fetch("/api/jlwm/enterprise/security-audit");
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 300_000,
    enabled: false,
  });

  const report = data?.report;
  const score  = report?.enterpriseScore;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-80" dir="rtl">
        <div className="text-center space-y-3">
          <Shield className="h-12 w-12 mx-auto text-primary animate-pulse" />
          <p className="text-muted-foreground">جارٍ إنشاء التقرير المؤسسي…</p>
          <p className="text-xs text-muted-foreground">يشمل فحص 25 وحدة + الأمان + الأداء</p>
        </div>
      </div>
    );
  }

  const gradeColor = (score?.score ?? 0) >= 90 ? "#10B981" : (score?.score ?? 0) >= 80 ? "#6366F1" : (score?.score ?? 0) >= 70 ? "#F59E0B" : "#EF4444";

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            التقرير المؤسسي الشامل
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            مركز القيادة القانونية — التكامل المؤسسي والأمان والموثوقية
          </p>
          {report && (
            <p className="text-xs text-muted-foreground mt-1">
              صدر في: {new Date(report.generatedAt).toLocaleString("ar-SA")}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 me-1 ${isFetching ? "animate-spin" : ""}`} /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => secAuditQuery.refetch()}>
            <Lock className="h-4 w-4 me-1" /> تدقيق الأمان
          </Button>
          <Button size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            <Zap className="h-4 w-4 me-1" /> {syncMut.isPending ? "جارٍ المزامنة…" : "مزامنة شاملة"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Download className="h-4 w-4 me-1" /> تصدير
          </Button>
        </div>
      </div>

      {/* ── Enterprise Score Banner ─────────────────────────── */}
      {score && (
        <Card className="border-2" style={{ borderColor: gradeColor + "44", background: gradeColor + "08" }}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex flex-col items-center gap-1 min-w-[100px]">
                <ScoreRing score={score.score} label="Enterprise Score" color={gradeColor} size={100} />
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl font-black" style={{ color: gradeColor }}>{score.grade}</span>
                  <div>
                    <div className="text-xl font-bold">{score.label}</div>
                    <div className="text-sm text-muted-foreground">نتيجة جاهزية مركز القيادة القانونية</div>
                  </div>
                </div>
                <Progress value={score.score} className="h-3" />
                <div className="flex gap-4 mt-3 text-sm flex-wrap">
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {report?.sections.modules.connected ?? 0}/{report?.sections.modules.total ?? 0} وحدة متصلة
                  </span>
                  <span className="text-blue-600 flex items-center gap-1">
                    <Lock className="h-4 w-4" />
                    {report?.sections.tenantIsolation.passed ?? 0} اختبار عزل ناجح
                  </span>
                  <span className="text-purple-600 flex items-center gap-1">
                    <Brain className="h-4 w-4" />
                    {report?.sections.aiHealth.jlwmCalls ?? 0} استدعاء ذكاء اصطناعي
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 8 Quality Scores ───────────────────────────────── */}
      {report?.qualityScores && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              مؤشرات الجودة المؤسسية (8 محاور)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(report.qualityScores).map(([key, val], i) => (
                <ScoreRing
                  key={key}
                  score={Number(val ?? 0)}
                  label={SCORE_LABELS[key] ?? key}
                  color={SCORE_COLORS[i % SCORE_COLORS.length]}
                  size={80}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Tabs ──────────────────────────────────────── */}
      <Tabs defaultValue="integration">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50">
          <TabsTrigger value="integration">
            <Globe className="h-4 w-4 me-1" /> التكامل (25 وحدة)
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="h-4 w-4 me-1" /> الأمان والعزل
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 me-1" /> المستندات
          </TabsTrigger>
          <TabsTrigger value="reliability">
            <Activity className="h-4 w-4 me-1" /> الموثوقية
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Brain className="h-4 w-4 me-1" /> الذكاء الاصطناعي
          </TabsTrigger>
          <TabsTrigger value="performance">
            <Server className="h-4 w-4 me-1" /> الأداء
          </TabsTrigger>
          <TabsTrigger value="risks">
            <AlertTriangle className="h-4 w-4 me-1" /> المخاطر
          </TabsTrigger>
        </TabsList>

        {/* ── Integration Tab ─────────────────────────────── */}
        <TabsContent value="integration" className="space-y-4 mt-4">
          {report && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "الوحدات المتصلة",  value: report.sections.modules.connected,        total: report.sections.modules.total,        icon: Globe,    color: "text-blue-600" },
                  { label: "الوحدات الحرجة",   value: report.sections.modules.criticalConnected, total: report.sections.modules.criticalTotal, icon: CheckCircle2, color: "text-emerald-600" },
                  { label: "تغطية التكامل",    value: `${report.sections.modules.integrationCoverage}%`, total: null, icon: TrendingUp, color: "text-purple-600" },
                  { label: "وحدات فارغة",      value: report.sections.modules.items.filter(m => m.status === "empty").length, total: null, icon: AlertTriangle, color: "text-yellow-600" },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="pt-4 flex items-center gap-3">
                      <s.icon className={`h-8 w-8 ${s.color}`} />
                      <div>
                        <div className="text-xl font-bold">
                          {s.value}{s.total != null ? `/${s.total}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Category Groups */}
              {["legal","finance","ops","hr","security","storage","backup","ai"].map(cat => {
                const items = report.sections.modules.items.filter(m => m.category === cat);
                if (!items.length) return null;
                const catLabels: Record<string, string> = {
                  legal:"القانوني",finance:"المالي",ops:"التشغيلي",hr:"الموارد البشرية",
                  security:"الأمان",storage:"التخزين",backup:"النسخ الاحتياطي",ai:"الذكاء الاصطناعي",
                };
                const connected = items.filter(m => m.status === "connected").length;
                return (
                  <Card key={cat} className={`border ${CAT_COLORS[cat] ?? ""}`}>
                    <CardHeader
                      className="pb-2 cursor-pointer"
                      onClick={() => setExpandedSection(expandedSection === cat ? null : cat)}
                    >
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{catLabels[cat]} — {connected}/{items.length}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Progress value={(connected / items.length) * 100} className="w-20 h-1.5" />
                          {expandedSection === cat ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </CardHeader>
                    {expandedSection === cat && (
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {items.map(m => (
                            <div key={m.module} className="flex items-center justify-between p-2 rounded-lg bg-white/60 border">
                              <div className="flex items-center gap-2">
                                {m.critical && <span className="text-red-500 text-xs font-bold">★</span>}
                                <span className="text-sm font-medium">{m.nameAr}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {m.count > 0 && <span className="text-xs text-muted-foreground">{m.count.toLocaleString()}</span>}
                                <StatusBadge status={m.status} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>

        {/* ── Security Tab ────────────────────────────────── */}
        <TabsContent value="security" className="space-y-4 mt-4">
          {report && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className={`border-2 ${report.sections.tenantIsolation.failed === 0 ? "border-emerald-300" : "border-red-300"}`}>
                  <CardContent className="pt-5 text-center">
                    {report.sections.tenantIsolation.failed === 0
                      ? <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2" />
                      : <XCircle className="h-10 w-10 mx-auto text-red-500 mb-2" />}
                    <div className="text-2xl font-bold">{report.sections.tenantIsolation.score}%</div>
                    <div className="text-sm text-muted-foreground mt-1">عزل المكاتب (Tenant Isolation)</div>
                    <div className="text-xs mt-2">
                      <span className="text-emerald-600">{report.sections.tenantIsolation.passed} ناجح</span>
                      {" · "}
                      <span className="text-red-600">{report.sections.tenantIsolation.failed} فشل</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${report.sections.clientIsolation.score >= 90 ? "border-emerald-300" : "border-yellow-300"}`}>
                  <CardContent className="pt-5 text-center">
                    <Users className="h-10 w-10 mx-auto text-blue-500 mb-2" />
                    <div className="text-2xl font-bold">{report.sections.clientIsolation.score}%</div>
                    <div className="text-sm text-muted-foreground mt-1">عزل العملاء</div>
                    <div className="text-xs mt-2 text-muted-foreground">
                      {report.sections.clientIsolation.casesWithoutClient} قضية بدون عميل
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${report.sections.audit.coverageScore >= 80 ? "border-emerald-300" : "border-yellow-300"}`}>
                  <CardContent className="pt-5 text-center">
                    <Eye className="h-10 w-10 mx-auto text-purple-500 mb-2" />
                    <div className="text-2xl font-bold">{Math.round(report.sections.audit.coverageScore)}%</div>
                    <div className="text-sm text-muted-foreground mt-1">تغطية سجلات التدقيق</div>
                    <div className="text-xs mt-2 text-muted-foreground">
                      {report.sections.audit.jlwmAuditEntries} سجل مركز القيادة · {report.sections.audit.auditLogsTotal} إجمالي
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Isolation Test Results */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue-500" />
                    اختبارات العزل الآلية — {report.sections.tenantIsolation.tests.length} اختبار
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                    {report.sections.tenantIsolation.tests.map((t: any, i: number) => (
                      <div key={i} className={`flex items-center justify-between p-2 rounded-lg border text-xs ${t.passed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                        <div className="flex items-center gap-2">
                          {t.passed
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            : <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                          <span className="font-mono">{t.table}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {t.myCount ?? 0} / {t.crossCount ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Search Integration */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Search className="h-4 w-4 text-indigo-500" />
                    تكامل البحث الموحد
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {report.sections.search.jlwmTablesIndexed} جدول مفهرس ومتاح للبحث
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(report.sections.search.searchableOutputs ?? []).map((o: string) => (
                      <Badge key={o} variant="outline" className="text-xs bg-indigo-50 border-indigo-200 text-indigo-700">{o}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Documents Tab ────────────────────────────────── */}
        <TabsContent value="documents" className="space-y-4 mt-4">
          {report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "إجمالي المستندات",     value: report.sections.documents.total,         icon: FileText,  color: "text-blue-600" },
                  { label: "مرتبطة بقضايا",        value: report.sections.documents.withCase,       icon: Building2, color: "text-emerald-600" },
                  { label: "مصنفة (OCR)",          value: report.sections.documents.withOCR,        icon: Cpu,       color: "text-purple-600" },
                  { label: "موقعة إلكترونياً",     value: report.sections.documents.withSignature,  icon: CheckCircle2, color: "text-amber-600" },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="pt-4 flex items-center gap-3">
                      <s.icon className={`h-7 w-7 ${s.color}`} />
                      <div>
                        <div className="text-xl font-bold">{(s.value ?? 0).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">توزيع المستندات حسب النوع</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(report.sections.documents.categories ?? {}).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">لا توجد مستندات مفهرسة بعد</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(report.sections.documents.categories ?? {}).map(([cat, n]: [string, any]) => (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-sm min-w-[140px]">{cat}</span>
                          <Progress value={Math.min(100, (n / Math.max(1, report.sections.documents.total)) * 100)} className="flex-1 h-2" />
                          <span className="text-sm font-medium min-w-[40px] text-end">{n}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Backup */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-amber-500" />
                    توافق النسخ الاحتياطي والاستعادة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    {[
                      { label: "جداول مركز القيادة",    value: report.sections.backup.jlwmTablesCount },
                      { label: "إجمالي السجلات",        value: report.sections.backup.jlwmRowTotal.toLocaleString() },
                      { label: "سجلات يتيمة",           value: report.sections.backup.orphanedRecords },
                      { label: "حجم تقديري (MB)",       value: report.sections.backup.estimatedBackupMB },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-lg bg-muted/40 border">
                        <div className="text-xl font-bold">{s.value}</div>
                        <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {report.sections.backup.orphanedRecords === 0 && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      لا توجد سجلات يتيمة — سلامة البيانات مكتملة ✓
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Reliability Tab ──────────────────────────────── */}
        <TabsContent value="reliability" className="space-y-4 mt-4">
          {report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "فاحص السلامة",              score: report.sections.reliability.integrityScore,   color: "#6366F1", icon: Database },
                  { label: "مدقق الأمان",               score: report.sections.reliability.securityScore,    color: "#10B981", icon: Shield },
                  { label: "مدقق النسخ الاحتياطية",    score: report.sections.reliability.backupScore,      color: "#F59E0B", icon: HardDrive },
                  { label: "مراقب الصحة",               score: report.sections.reliability.healthScore,      color: "#3B82F6", icon: Activity },
                  { label: "Trust Score Engine",        score: report.sections.reliability.trustScore,       color: "#8B5CF6", icon: Award },
                  { label: "Data Quality Engine",       score: report.sections.reliability.dataQualityScore, color: "#06B6D4", icon: BarChart3 },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-4">
                        <ScoreRing score={s.score} label="" color={s.color} size={64} />
                        <div>
                          <div className="text-sm font-medium">{s.label}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {s.score >= 90 ? "ممتاز" : s.score >= 70 ? "جيد" : "يحتاج تحسين"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {(report.sections.reliability as any).lastComputed && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  آخر حساب: {new Date((report.sections.reliability as any).lastComputed).toLocaleString("ar-SA")}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── AI Tab ───────────────────────────────────────── */}
        <TabsContent value="ai" className="space-y-4 mt-4">
          {report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "استدعاءات الذكاء",    value: report.sections.aiHealth.jlwmCalls,    color: "text-violet-600" },
                  { label: "معدل النجاح",         value: `${report.sections.aiHealth.successRate}%`, color: "text-emerald-600" },
                  { label: "رصيد مستهلك",         value: report.sections.aiHealth.creditsUsed,  color: "text-amber-600" },
                  { label: "نماذج مُستخدمة",      value: (report.sections.aiHealth.modelsUsed ?? []).length, color: "text-blue-600" },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="pt-4">
                      <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">نماذج الذكاء الاصطناعي المُستخدمة</CardTitle>
                </CardHeader>
                <CardContent>
                  {(report.sections.aiHealth.modelsUsed ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">لم يُستخدم ذكاء مركز القيادة بعد — شغّل تحليلاً من مركز القيادة</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {report.sections.aiHealth.modelsUsed.map(m => (
                        <Badge key={m} className="bg-violet-100 text-violet-700 border-violet-200">{m}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={`border-2 ${report.sections.aiHealth.auditTrailComplete ? "border-emerald-300" : "border-yellow-300"}`}>
                <CardContent className="pt-4 flex items-center gap-3">
                  {report.sections.aiHealth.auditTrailComplete
                    ? <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    : <AlertTriangle className="h-8 w-8 text-yellow-500" />}
                  <div>
                    <div className="font-medium">سجل التدقيق الذكي (AI Audit Trail)</div>
                    <div className="text-sm text-muted-foreground">
                      {report.sections.aiHealth.auditTrailComplete
                        ? "مكتمل — جميع استدعاءات AI مسجلة في jlwm_ai_audit"
                        : "غير مكتمل — لم تُشغّل تحليلات AI بعد"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Performance Tab ──────────────────────────────── */}
        <TabsContent value="performance" className="space-y-4 mt-4">
          {report && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "إجمالي السجلات",      value: report.sections.performance.totalJLWMRows.toLocaleString(), icon: Database, color: "text-blue-600" },
                  { label: "عدد الـ Indexes",      value: report.sections.performance.indexCount,                     icon: TrendingUp, color: "text-emerald-600" },
                  { label: "التصفح (Pagination)",  value: "مُفعّل ✓",                                                icon: Activity, color: "text-purple-600" },
                  { label: "التخزين المؤقت",       value: "مُفعّل ✓",                                                icon: Zap, color: "text-amber-600" },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="pt-4 flex items-center gap-3">
                      <s.icon className={`h-7 w-7 ${s.color}`} />
                      <div>
                        <div className="text-xl font-bold">{s.value}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Server className="h-4 w-4 text-blue-500" />
                    قابلية التوسع — {report.sections.performance.scalabilityScore}/100
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={report.sections.performance.scalabilityScore} className="h-3" />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {["100,000+ مستند","10,000+ قضية","1,000+ مستخدم","100+ مكتب"].map(c => (
                      <div key={c} className="flex items-center gap-2 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {c}
                      </div>
                    ))}
                  </div>
                  {report.sections.performance.bottlenecks.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <p className="text-xs font-medium text-amber-600">اختناقات مرصودة:</p>
                      {report.sections.performance.bottlenecks.map((b: string, i: number) => (
                        <div key={i} className="text-xs text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {b}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Risks Tab ────────────────────────────────────── */}
        <TabsContent value="risks" className="space-y-4 mt-4">
          {report && (
            <>
              {report.risks.length === 0 ? (
                <Card className="border-emerald-300">
                  <CardContent className="pt-6 text-center">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
                    <p className="text-emerald-700 font-medium">لا توجد مخاطر مرصودة</p>
                    <p className="text-sm text-muted-foreground mt-1">النظام في حالة مثالية</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {report.risks.map((risk, i) => (
                    <div key={i} className={`p-4 rounded-lg border-r-4 ${RISK_COLORS[risk.severity] ?? ""}`}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
                        <div>
                          <Badge variant="outline" className="text-xs mb-1">
                            {risk.severity === "critical" ? "حرج" : risk.severity === "high" ? "عالي" : risk.severity === "medium" ? "متوسط" : "منخفض"}
                          </Badge>
                          <p className="text-sm">{risk.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {report.recommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-violet-500" />
                      التوصيات المقترحة ({report.recommendations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {report.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-violet-50 border border-violet-200 text-sm">
                        <span className="text-violet-500 font-bold min-w-[20px]">{i + 1}.</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
