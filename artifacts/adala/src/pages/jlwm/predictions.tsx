/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState }                                    from "react";
import { useQuery, useMutation, useQueryClient }       from "@tanstack/react-query";
import {
  Target, TrendingUp, RefreshCw, Clock, Scale,
  DollarSign, AlertTriangle, Sparkles, BarChart3,
  ChevronRight, CheckCircle2, XCircle, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge }     from "@/components/ui/badge";
import { Button }    from "@/components/ui/button";
import { Progress }  from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast }  from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";

/* ── Types ──────────────────────────────────────────────────── */
interface CasePredictions {
  outcome:   { value: string; confidence: number; reasoning: string };
  duration:  { value: number; confidence: number; range: { min: number; max: number }; reasoning: string };
  settlement:{ probability: number; estimated_amount: number; confidence: number; reasoning: string };
  appeal:    { probability: number; likely_side: string; confidence: number; reasoning: string };
  execution: { success_probability: number; estimated_duration_days: number; confidence: number; reasoning: string };
}

interface RevenueForecast {
  historicalAvg: number;
  trend: string;
  trendAmount: number;
  forecast: { month: string; optimistic: number; realistic: number; pessimistic: number }[];
  confidence: number;
  reasoning: string;
}

/* ── Helpers ─────────────────────────────────────────────────── */
const OUTCOME_META: Record<string, { label: string; color: string; icon: any }> = {
  win:        { label:"فوز",         color:"text-emerald-600", icon:CheckCircle2 },
  loss:       { label:"خسارة",       color:"text-red-600",     icon:XCircle },
  settlement: { label:"تسوية",       color:"text-blue-600",    icon:Scale },
  ongoing:    { label:"مستمرة",      color:"text-yellow-600",  icon:Clock },
};

function ConfBadge({ v }: { v: number }) {
  const pct = Math.round(v * 100);
  const c   = pct >= 70 ? "bg-emerald-100 text-emerald-700" : pct >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c}`}>ثقة {pct}%</span>;
}

function PredCard({ title, icon: Icon, color, children }: { title: string; icon: any; color: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm flex items-center gap-2 ${color}`}>
          <Icon className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ── Case Predictions Panel ─────────────────────────────────── */
function CasePredictionsPanel({ caseId, caseTitle }: { caseId: string; caseTitle: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["jlwm", "predictions", "case", caseId],
    queryFn: async () => {
      const r = await authFetch(`/api/jlwm/predictions/case/${caseId}`);
      if (!r.ok) throw new Error();
      return r.json() as Promise<{ exists: boolean; predictions: CasePredictions; createdAt: string }>;
    },
    enabled: !!caseId,
    staleTime: 300_000,
  });

  const genMut = useMutation({
    mutationFn: async (force: boolean) => {
      const r = await authFetch(`/api/jlwm/predictions/case/${caseId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }),
      });
      if (!r.ok) throw new Error("فشل التحليل");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jlwm", "predictions", "case", caseId] }); toast({ title: "تم توليد التنبؤات" }); },
    onError: () => toast({ title: "فشل التحليل", variant: "destructive" }),
  });

  if (isLoading) return <div className="py-6 text-center text-muted-foreground text-sm">جارٍ التحميل…</div>;

  if (!data?.exists) {
    return (
      <div className="py-8 text-center space-y-3">
        <Target className="h-12 w-12 mx-auto text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">لا توجد تنبؤات لهذه القضية بعد</p>
        <Button onClick={() => genMut.mutate(false)} disabled={genMut.isPending}>
          <Sparkles className="h-4 w-4 me-1" />
          {genMut.isPending ? "جارٍ التحليل…" : "تحليل القضية بالذكاء الاصطناعي"}
        </Button>
      </div>
    );
  }

  const p = data.predictions;
  const outMeta = OUTCOME_META[p?.outcome?.value] ?? OUTCOME_META["ongoing"];
  const OutIcon = outMeta.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          آخر تحليل: {data.createdAt ? new Date(data.createdAt).toLocaleString("ar-SA") : "—"}
        </p>
        <Button variant="outline" size="sm" onClick={() => genMut.mutate(true)} disabled={genMut.isPending}>
          <RefreshCw className="h-3 w-3 me-1" /> إعادة التحليل
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Outcome */}
        <PredCard title="نتيجة القضية المتوقعة" icon={Scale} color={outMeta.color}>
          <div className="flex items-center gap-3">
            <OutIcon className={`h-8 w-8 ${outMeta.color}`} />
            <div>
              <p className={`text-xl font-bold ${outMeta.color}`}>{outMeta.label}</p>
              <ConfBadge v={p?.outcome?.confidence ?? 0} />
            </div>
          </div>
          {p?.outcome?.reasoning && (
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">{p.outcome.reasoning}</p>
          )}
        </PredCard>

        {/* Duration */}
        <PredCard title="المدة المتوقعة للقضية" icon={Clock} color="text-blue-600">
          <div className="text-2xl font-bold text-blue-600">{p?.duration?.value ?? "—"} <span className="text-sm font-normal">يوم</span></div>
          <p className="text-xs text-muted-foreground">النطاق: {p?.duration?.range?.min ?? 0}–{p?.duration?.range?.max ?? 0} يوم</p>
          <ConfBadge v={p?.duration?.confidence ?? 0} />
          {p?.duration?.reasoning && <p className="text-xs text-muted-foreground mt-2">{p.duration.reasoning}</p>}
        </PredCard>

        {/* Settlement */}
        <PredCard title="احتمالية التسوية" icon={DollarSign} color="text-purple-600">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-purple-600">{Math.round((p?.settlement?.probability ?? 0) * 100)}%</span>
              <ConfBadge v={p?.settlement?.confidence ?? 0} />
            </div>
            <Progress value={(p?.settlement?.probability ?? 0) * 100} className="h-2" />
            {(p?.settlement?.estimated_amount ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                مبلغ التسوية المقدّر: {(p.settlement.estimated_amount).toLocaleString("ar-SA")} ريال
              </p>
            )}
            {p?.settlement?.reasoning && <p className="text-xs text-muted-foreground mt-1">{p.settlement.reasoning}</p>}
          </div>
        </PredCard>

        {/* Appeal */}
        <PredCard title="احتمالية الاستئناف" icon={AlertTriangle} color="text-orange-600">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-orange-600">{Math.round((p?.appeal?.probability ?? 0) * 100)}%</span>
              <ConfBadge v={p?.appeal?.confidence ?? 0} />
            </div>
            <Progress value={(p?.appeal?.probability ?? 0) * 100} className="h-2" />
            {p?.appeal?.likely_side && p?.appeal?.likely_side !== "none" && (
              <p className="text-xs text-muted-foreground">الجهة المرجّح استئنافها: {p.appeal.likely_side === "client" ? "العميل" : "الخصم"}</p>
            )}
          </div>
        </PredCard>

        {/* Execution */}
        <PredCard title="احتمالية نجاح التنفيذ" icon={CheckCircle2} color="text-emerald-600">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-emerald-600">{Math.round((p?.execution?.success_probability ?? 0) * 100)}%</span>
              <ConfBadge v={p?.execution?.confidence ?? 0} />
            </div>
            <Progress value={(p?.execution?.success_probability ?? 0) * 100} className="h-2" />
            {(p?.execution?.estimated_duration_days ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground">مدة التنفيذ المقدّرة: {p.execution.estimated_duration_days} يوم</p>
            )}
          </div>
        </PredCard>
      </div>
    </div>
  );
}

/* ── Revenue Forecast Panel ─────────────────────────────────── */
function RevenueForecastPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch } = useQuery<RevenueForecast>({
    queryKey: ["jlwm", "predictions", "revenue"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/predictions/revenue", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 300_000,
  });

  if (isLoading) return <div className="py-6 text-center text-muted-foreground text-sm">جارٍ التحميل…</div>;

  const trendIcon = data?.trend === "positive" ? "↑" : data?.trend === "negative" ? "↓" : "→";
  const trendColor = data?.trend === "positive" ? "text-emerald-600" : data?.trend === "negative" ? "text-red-600" : "text-yellow-600";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3 me-1" /> تحديث التوقعات
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">متوسط الإيرادات الشهري</p>
            <p className="text-2xl font-bold">{(data?.historicalAvg ?? 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">ريال</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">الاتجاه</p>
            <p className={`text-2xl font-bold ${trendColor}`}>{trendIcon} {Math.abs(data?.trendAmount ?? 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">ريال / شهر</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">دقة التنبؤ</p>
            <p className="text-2xl font-bold">{Math.round((data?.confidence ?? 0) * 100)}%</p>
            <p className="text-xs text-muted-foreground">مستوى الثقة</p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">توقعات الإيرادات — 3 أشهر</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-2 font-medium text-muted-foreground">الفترة</th>
                  <th className="text-right py-2 font-medium text-emerald-600">متفائل</th>
                  <th className="text-right py-2 font-medium text-blue-600">واقعي</th>
                  <th className="text-right py-2 font-medium text-red-600">متشائم</th>
                </tr>
              </thead>
              <tbody>
                {(data?.forecast ?? []).map(f => (
                  <tr key={f.month} className="border-b last:border-0">
                    <td className="py-2 font-medium">{f.month}</td>
                    <td className="py-2 text-emerald-600">{f.optimistic.toLocaleString("ar-SA")}</td>
                    <td className="py-2 text-blue-600">{f.realistic.toLocaleString("ar-SA")}</td>
                    <td className="py-2 text-red-600">{f.pessimistic.toLocaleString("ar-SA")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.reasoning && <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">{data.reasoning}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function PredictionsPage() {
  const [selectedCase, setSelectedCase] = useState<{ id: string; title: string } | null>(null);

  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ["cases-list-pred"],
    queryFn: async () => {
      const r = await authFetch("/api/cases?limit=50&status=active");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.cases ?? d.data ?? []);
    },
    staleTime: 120_000,
  });

  const { data: summary } = useQuery({
    queryKey: ["jlwm", "predictions", "summary"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/predictions/summary");
      if (!r.ok) return null;
      return r.json();
    },
  });

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" /> محرك التنبؤ الذكي
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          7 أنواع من التنبؤات: نتائج القضايا، المدة، التسوية، الاستئناف، التنفيذ، تراجع العملاء، الإيرادات
        </p>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label:"تنبؤات بالفوز",      value: summary.predicted_wins,         color:"text-emerald-600" },
            { label:"تنبؤات بالخسارة",    value: summary.predicted_losses,       color:"text-red-600" },
            { label:"تنبؤات بالتسوية",    value: summary.predicted_settlements,  color:"text-blue-600" },
            { label:"عملاء بخطر التراجع", value: summary.high_churn_clients,     color:"text-orange-600" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-4 pb-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="cases" dir="rtl">
        <TabsList>
          <TabsTrigger value="cases"><Scale className="h-4 w-4 me-1" />تنبؤات القضايا</TabsTrigger>
          <TabsTrigger value="revenue"><TrendingUp className="h-4 w-4 me-1" />توقعات الإيرادات</TabsTrigger>
        </TabsList>

        {/* Case Predictions */}
        <TabsContent value="cases" className="mt-4 space-y-4">
          {/* Case selector */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium mb-3">اختر قضية للتحليل</p>
              <div className="flex flex-wrap gap-2">
                {(cases as any[]).slice(0, 20).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCase({ id: c.id, title: c.title })}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      selectedCase?.id === c.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 hover:bg-muted border-border"
                    }`}
                  >
                    {c.title}
                  </button>
                ))}
                {cases.length === 0 && <p className="text-xs text-muted-foreground">لا توجد قضايا نشطة</p>}
              </div>
            </CardContent>
          </Card>

          {selectedCase
            ? <CasePredictionsPanel caseId={selectedCase.id} caseTitle={selectedCase.title} />
            : (
              <div className="py-12 text-center text-muted-foreground">
                <Scale className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>اختر قضية من القائمة أعلاه لعرض التنبؤات</p>
              </div>
            )
          }
        </TabsContent>

        {/* Revenue Forecast */}
        <TabsContent value="revenue" className="mt-4">
          <RevenueForecastPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
