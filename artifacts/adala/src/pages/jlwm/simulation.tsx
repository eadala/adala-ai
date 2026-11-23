/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-non-null-assertion -- pre-existing lint debt; authFetch migration */
import { useState }                              from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical, Play, History, RefreshCw, CheckCircle2,
  XCircle, TrendingUp, Clock, DollarSign, ThumbsUp, ThumbsDown, Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge }    from "@/components/ui/badge";
import { Button }   from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";

/* ── Types ──────────────────────────────────────────────────── */
interface SimOutcome {
  name:             string;
  probability:      number;
  financial_impact: number;
  timeline_days:    number;
  confidence:       number;
  pros:             string[];
  cons:             string[];
  next_steps?:      string[];
}

interface SimResult {
  id:                 string;
  scenarioType:       string;
  scenarioName:       string;
  scenarioDesc:       string;
  outcomes:           SimOutcome[];
  recommendedOutcome: string;
  overallAssessment:  string;
  modelUsed:          string;
  createdAt:          string;
}

const SCENARIOS = [
  { id:"appeal",                  nameAr:"سيناريو الاستئناف",            icon:"⚖️", color:"text-blue-600",   bg:"bg-blue-50" },
  { id:"settlement",              nameAr:"سيناريو التسوية",              icon:"🤝", color:"text-green-600",  bg:"bg-green-50" },
  { id:"expert_witness",          nameAr:"سيناريو خبير الشهادة",         icon:"🔬", color:"text-purple-600", bg:"bg-purple-50" },
  { id:"aggressive_litigation",   nameAr:"المرافعة الهجومية",           icon:"⚔️", color:"text-red-600",    bg:"bg-red-50" },
  { id:"conservative_litigation", nameAr:"المرافعة المحافِظة",          icon:"🛡️", color:"text-yellow-600", bg:"bg-yellow-50" },
];

/* ── Probability bar ─────────────────────────────────────────── */
function ProbBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width:`${Math.round(value*100)}%`, background:color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right">{Math.round(value*100)}%</span>
    </div>
  );
}

/* ── Outcome card ────────────────────────────────────────────── */
function OutcomeCard({ outcome, isRecommended }: { outcome: SimOutcome; isRecommended: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const probColor = outcome.probability >= 0.4 ? "#10B981" : outcome.probability >= 0.2 ? "#3B82F6" : "#EF4444";

  return (
    <Card className={`transition-all ${isRecommended ? "border-2 border-primary bg-primary/5" : ""}`}>
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{outcome.name}</p>
            {isRecommended && <Badge className="text-xs">مُوصى به</Badge>}
          </div>
          <span className="text-xs text-muted-foreground">ثقة {Math.round(outcome.confidence*100)}%</span>
        </div>

        <ProbBar value={outcome.probability} color={probColor} />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={`flex items-center gap-1 ${outcome.financial_impact >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            <DollarSign className="h-3 w-3" />
            {outcome.financial_impact >= 0 ? "+" : ""}{outcome.financial_impact.toLocaleString("ar-SA")} ريال
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" /> {outcome.timeline_days} يوم
          </div>
        </div>

        <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:underline">
          {expanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
        </button>

        {expanded && (
          <div className="pt-2 border-t space-y-2">
            {outcome.pros.length > 0 && (
              <div>
                <p className="text-xs font-medium text-emerald-700 mb-1">المزايا</p>
                {outcome.pros.map((p, i) => <p key={i} className="text-xs flex gap-1.5"><ThumbsUp className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />{p}</p>)}
              </div>
            )}
            {outcome.cons.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-700 mb-1">العيوب</p>
                {outcome.cons.map((c, i) => <p key={i} className="text-xs flex gap-1.5"><ThumbsDown className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />{c}</p>)}
              </div>
            )}
            {(outcome.next_steps?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-blue-700 mb-1">الخطوات التالية</p>
                {outcome.next_steps!.map((s, i) => <p key={i} className="text-xs flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />{s}</p>)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── History item ────────────────────────────────────────────── */
function HistoryItem({ sim, onReview }: { sim: any; onReview: (s: any) => void }) {
  const scenario = SCENARIOS.find(s => s.id === sim.scenario_type);
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 cursor-pointer"
         onClick={() => onReview(sim)}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{scenario?.icon ?? "⚖️"}</span>
        <div>
          <p className="text-sm font-medium">{scenario?.nameAr ?? sim.scenario_type}</p>
          <p className="text-xs text-muted-foreground">
            {(sim.outcomes as SimOutcome[] ?? []).length} نتيجة محتملة
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {new Date(sim.created_at).toLocaleString("ar-SA", { dateStyle:"short", timeStyle:"short" })}
      </p>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function SimulationPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedCase, setSelectedCase]       = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [result, setResult]                   = useState<SimResult | null>(null);
  const [reviewSim, setReviewSim]             = useState<any | null>(null);

  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ["cases-list-sim"],
    queryFn: async () => {
      const r = await authFetch("/api/cases?limit=50");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.cases ?? d.data ?? []);
    },
    staleTime: 120_000,
  });

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ["jlwm","simulations", selectedCase],
    queryFn: async () => {
      if (!selectedCase) return [];
      const r = await authFetch(`/api/jlwm/simulate/case/${selectedCase}`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!selectedCase,
    staleTime: 30_000,
  });

  const simMut = useMutation({
    mutationFn: async () => {
      if (!selectedCase || !selectedScenario) throw new Error("اختر قضية وسيناريو");
      const r = await authFetch(`/api/jlwm/simulate/case/${selectedCase}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioType: selectedScenario }),
      });
      if (!r.ok) throw new Error("فشلت المحاكاة");
      return r.json() as Promise<SimResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ["jlwm","simulations", selectedCase] });
      toast({ title: "اكتملت المحاكاة" });
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  const activeResult = result ?? (reviewSim ? {
    ...reviewSim,
    scenarioName: SCENARIOS.find(s => s.id === reviewSim.scenario_type)?.nameAr ?? reviewSim.scenario_type,
    outcomes: reviewSim.outcomes ?? [],
    recommendedOutcome: reviewSim.recommended_outcome,
  } : null);

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" /> محرك المحاكاة القانونية
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          نمّذج 5 سيناريوهات قانونية مع احتمالية متعددة النتائج
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Config panel ── */}
        <div className="space-y-4">
          {/* Case selector */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">اختر قضية</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(cases as any[]).slice(0, 15).map(c => (
                <button key={c.id} onClick={() => { setSelectedCase(c.id); setResult(null); setReviewSim(null); }}
                  className={`w-full text-right text-xs px-3 py-2 rounded-lg border transition-colors ${
                    selectedCase === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 hover:bg-muted border-border"
                  }`}>
                  {c.title}
                </button>
              ))}
              {cases.length === 0 && <p className="text-xs text-muted-foreground">لا توجد قضايا</p>}
            </CardContent>
          </Card>

          {/* Scenario selector */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">اختر السيناريو</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {SCENARIOS.map(s => (
                <button key={s.id} onClick={() => setSelectedScenario(s.id)}
                  className={`w-full text-right text-xs px-3 py-2.5 rounded-lg border transition-colors flex items-center gap-2 ${
                    selectedScenario === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 hover:bg-muted border-border"
                  }`}>
                  <span>{s.icon}</span><span>{s.nameAr}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Button
            className="w-full"
            onClick={() => simMut.mutate()}
            disabled={!selectedCase || !selectedScenario || simMut.isPending}
          >
            <Play className="h-4 w-4 me-1" />
            {simMut.isPending ? "جارٍ المحاكاة…" : "تشغيل المحاكاة"}
          </Button>
        </div>

        {/* ── Results panel ── */}
        <div className="lg:col-span-2">
          {activeResult ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-lg">{activeResult.scenarioName}</h2>
                  {activeResult.overallAssessment && (
                    <p className="text-sm text-muted-foreground mt-0.5">{activeResult.overallAssessment}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">{activeResult.modelUsed}</Badge>
              </div>

              {(activeResult.outcomes as SimOutcome[] ?? []).map((o, i) => (
                <OutcomeCard
                  key={i}
                  outcome={o}
                  isRecommended={o.name === activeResult.recommendedOutcome}
                />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="instructions" dir="rtl">
              <TabsList>
                <TabsTrigger value="instructions">كيف تعمل؟</TabsTrigger>
                {selectedCase && <TabsTrigger value="history"><History className="h-4 w-4 me-1" />السجل</TabsTrigger>}
              </TabsList>
              <TabsContent value="instructions" className="mt-4">
                <Card>
                  <CardContent className="pt-6 pb-6 text-center space-y-3 text-muted-foreground">
                    <FlaskConical className="h-14 w-14 mx-auto opacity-20" />
                    <p className="font-medium">اختر قضية وسيناريو ثم اضغط "تشغيل المحاكاة"</p>
                    <div className="text-sm space-y-1 text-right max-w-sm mx-auto">
                      <p>1. اختر القضية من القائمة</p>
                      <p>2. حدد السيناريو الذي تريد استكشافه</p>
                      <p>3. اضغط تشغيل واستعرض النتائج المتعددة</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              {selectedCase && (
                <TabsContent value="history" className="mt-4 space-y-2">
                  {(history as any[]).length === 0
                    ? <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">لا يوجد سجل محاكاة</CardContent></Card>
                    : (history as any[]).map(s => (
                        <HistoryItem key={s.id} sim={s} onReview={setReviewSim} />
                      ))
                  }
                </TabsContent>
              )}
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
