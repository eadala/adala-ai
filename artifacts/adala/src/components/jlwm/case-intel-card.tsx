/* eslint-disable @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
/**
 * JLWM — Case Intelligence Sidebar Card
 * Compact widget for case-detail.tsx sidebar.
 * Shows: outcome prediction + litigation score + link to full analysis.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link }                                   from "wouter";
import { Brain, Sparkles, ChevronRight, Target, Sword } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle }     from "@/components/ui/card";
import { Badge }     from "@/components/ui/badge";
import { Button }    from "@/components/ui/button";
import { Progress }  from "@/components/ui/progress";
import { useToast }  from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";

const OUTCOME_LABELS: Record<string, string> = {
  win:"فوز", loss:"خسارة", settlement:"تسوية", ongoing:"مستمرة",
};
const OUTCOME_COLORS: Record<string, string> = {
  win:"text-emerald-600", loss:"text-red-600", settlement:"text-blue-600", ongoing:"text-yellow-600",
};

export default function JLWMCaseIntelCard({ caseId }: { caseId: string }) {
  const qc      = useQueryClient();
  const { toast } = useToast();

  /* Fetch latest predictions */
  const { data: predData } = useQuery({
    queryKey: ["jlwm","predictions","case", caseId],
    queryFn: async () => {
      const r = await authFetch(`/api/jlwm/predictions/case/${caseId}`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 300_000,
  });

  /* Fetch litigation intel */
  const { data: litigData } = useQuery({
    queryKey: ["jlwm","litigation", caseId],
    queryFn: async () => {
      const r = await authFetch(`/api/jlwm/litigation/${caseId}`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 300_000,
  });

  /* Quick analyze mutation */
  const analyzeMut = useMutation({
    mutationFn: async () => {
      const [p, l] = await Promise.all([
        authFetch(`/api/jlwm/predictions/case/${caseId}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" }),
        authFetch(`/api/jlwm/litigation/${caseId}/analyze`, { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" }),
      ]);
      if (!p.ok && !l.ok) throw new Error("فشل التحليل");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jlwm","predictions","case", caseId] });
      qc.invalidateQueries({ queryKey: ["jlwm","litigation", caseId] });
      toast({ title: "اكتمل تحليل مركز القيادة القانونية" });
    },
    onError: () => toast({ title: "فشل تحليل مركز القيادة القانونية", variant: "destructive" }),
  });

  const hasPred   = predData?.exists;
  const hasLitig  = litigData?.exists;
  const pred      = predData?.predictions;
  const outcome   = pred?.outcome;
  const litigScore = Number(litigData?.overall_score ?? 0);
  const winProb   = hasPred && pred?.outcome?.value === "win" ? pred?.outcome?.confidence : null;
  const settlProb = Number(pred?.settlement?.probability ?? 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-primary">
          <Brain className="h-4 w-4" /> ذكاء مركز القيادة القانونية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasPred && !hasLitig ? (
          <div className="text-center py-2 space-y-2">
            <p className="text-xs text-muted-foreground">لم يُجرَ تحليل بعد</p>
            <Button size="sm" className="w-full" onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending}>
              <Sparkles className="h-3.5 w-3.5 me-1" />
              {analyzeMut.isPending ? "جارٍ التحليل…" : "تحليل بالذكاء الاصطناعي"}
            </Button>
          </div>
        ) : (
          <>
            {/* Outcome prediction */}
            {hasPred && outcome && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" /> النتيجة المتوقعة
                </span>
                <span className={`font-bold ${OUTCOME_COLORS[outcome.value] ?? "text-foreground"}`}>
                  {OUTCOME_LABELS[outcome.value] ?? outcome.value}
                </span>
              </div>
            )}

            {/* Win confidence */}
            {hasPred && outcome && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">مستوى الثقة</span>
                  <span className="font-medium">{Math.round((outcome.confidence ?? 0) * 100)}%</span>
                </div>
                <Progress value={(outcome.confidence ?? 0) * 100} className="h-1" />
              </div>
            )}

            {/* Settlement probability */}
            {hasPred && settlProb > 0.1 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">احتمال التسوية</span>
                  <span className="font-medium">{Math.round(settlProb * 100)}%</span>
                </div>
                <Progress value={settlProb * 100} className="h-1" />
              </div>
            )}

            {/* Litigation score */}
            {hasLitig && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sword className="h-3 w-3" /> قوة الموقف
                </span>
                <span className={`font-bold ${litigScore >= 0.7 ? "text-emerald-600" : litigScore >= 0.45 ? "text-yellow-600" : "text-red-600"}`}>
                  {Math.round(litigScore * 100)}/100
                </span>
              </div>
            )}

            {/* Refresh */}
            <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending}>
              <Sparkles className="h-3 w-3 me-1" />
              {analyzeMut.isPending ? "جارٍ…" : "تحديث التحليل"}
            </Button>
          </>
        )}

        {/* Links */}
        <div className="border-t pt-2 space-y-1">
          <Link href={`/jlwm/predictions`}>
            <button className="w-full text-right text-xs flex items-center justify-between text-muted-foreground hover:text-primary py-0.5">
              <span>التنبؤات التفصيلية</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </Link>
          <Link href={`/jlwm/litigation-intelligence`}>
            <button className="w-full text-right text-xs flex items-center justify-between text-muted-foreground hover:text-primary py-0.5">
              <span>ذكاء المرافعة</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </Link>
          <Link href={`/jlwm/simulation`}>
            <button className="w-full text-right text-xs flex items-center justify-between text-muted-foreground hover:text-primary py-0.5">
              <span>محاكاة السيناريوهات</span>
              <ChevronRight className="h-3 w-3" />
            </button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
