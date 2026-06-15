import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, AlertTriangle, CheckCircle2, Zap, RefreshCw,
  TrendingUp, ClipboardList, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface AutopilotReport {
  healthScore:       number;
  grade:             "A" | "B" | "C" | "D" | "F";
  risks:             string[];
  missingData:       string[];
  nextSteps:         string[];
  tasksCreated:      number;
  outcomePrediction: { successProbability: number; label: string; confidence: string };
  aiSummary:         string;
  runAt:             string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  B: "text-blue-400 border-blue-400/40 bg-blue-400/10",
  C: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  D: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  F: "text-red-400 border-red-400/40 bg-red-400/10",
};

const SCORE_BAR: Record<string, string> = {
  A: "bg-emerald-500",
  B: "bg-blue-500",
  C: "bg-amber-500",
  D: "bg-orange-500",
  F: "bg-red-500",
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const radius   = 32;
  const circ     = 2 * Math.PI * radius;
  const strokeDash = (score / 100) * circ;
  const colorMap: Record<string, string> = { A: "#10b981", B: "#3b82f6", C: "#f59e0b", D: "#f97316", F: "#ef4444" };
  const color = colorMap[grade] ?? "#6b7280";

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
        <circle
          cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${strokeDash} ${circ}`} strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none">{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export function CaseAutopilotCard({ caseId }: { caseId: string }) {
  const { toast }  = useToast();
  const qc         = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: report, isLoading } = useQuery<AutopilotReport>({
    queryKey:  ["case-health", caseId],
    queryFn:   () => fetch(`${BASE}/api/cases/${caseId}/health`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    enabled:   !!caseId,
    staleTime: 5 * 60_000,
  });

  const runAutopilot = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/cases/${caseId}/autopilot`, { method: "POST" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (data) => {
      qc.setQueryData(["case-health", caseId], data);
      toast({
        title:       "✅ الطيار الآلي اكتمل",
        description: `درجة الصحة: ${data.healthScore}/100 — أُنشئت ${data.tasksCreated} مهمة`,
      });
    },
    onError: () => toast({ title: "خطأ", description: "فشل تشغيل الطيار الآلي", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report || (report as any).error) {
    return (
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
        <CardContent className="py-6 flex flex-col items-center gap-3 text-center">
          <Brain className="h-8 w-8 text-violet-400" />
          <p className="text-sm text-muted-foreground">لم يُحلَّل ملف القضية بعد</p>
          <Button
            size="sm" variant="outline"
            className="border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
            onClick={() => runAutopilot.mutate()}
            disabled={runAutopilot.isPending}
          >
            {runAutopilot.isPending
              ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> جارٍ التحليل...</>
              : <><Zap className="h-3.5 w-3.5 mr-1.5" /> تشغيل الطيار الآلي</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const g = report.grade;

  return (
    <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-400" />
            عدول — التحليل الذكي للقضية
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm" variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-violet-400"
              onClick={() => runAutopilot.mutate()}
              disabled={runAutopilot.isPending}
            >
              {runAutopilot.isPending
                ? <RefreshCw className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />}
            </Button>
            <Button
              size="sm" variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score Row */}
        <div className="flex items-center gap-4">
          <ScoreRing score={report.healthScore} grade={g} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-sm font-bold px-3 ${GRADE_COLORS[g]}`}>
                {g}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {g === "A" ? "ملف ممتاز" : g === "B" ? "جيد جداً" : g === "C" ? "مقبول" : g === "D" ? "يحتاج تحسين" : "خطر — ناقص"}
              </span>
            </div>
            {/* Score bar */}
            <div className="w-full bg-muted/30 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all duration-700 ${SCORE_BAR[g]}`}
                style={{ width: `${report.healthScore}%` }}
              />
            </div>
            {/* Prediction */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span>{report.outcomePrediction.label}</span>
              <span className="font-semibold text-foreground">
                {report.outcomePrediction.successProbability}%
              </span>
            </div>
          </div>
        </div>

        {/* AI Summary */}
        {report.aiSummary && (
          <div className="rounded-lg bg-muted/20 border border-border/50 p-3 text-xs text-muted-foreground leading-relaxed flex gap-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
            <span>{report.aiSummary}</span>
          </div>
        )}

        {/* Expanded Detail */}
        {expanded && (
          <div className="space-y-3 pt-1 border-t border-border/40">
            {/* Risks */}
            {report.risks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-400 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> مخاطر مكتشفة
                </p>
                <ul className="space-y-1">
                  {report.risks.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-red-400 mt-0.5">•</span> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Data */}
            {report.missingData.length > 0 && (
              <div>
                <p className="text-xs font-medium text-amber-400 mb-1.5 flex items-center gap-1">
                  <ClipboardList className="h-3.5 w-3.5" /> بيانات ناقصة
                </p>
                <ul className="space-y-1">
                  {report.missingData.map((m, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="text-amber-400 mt-0.5">◦</span> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tasks created */}
            {report.tasksCreated > 0 && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                أُنشئت {report.tasksCreated} مهام تلقائياً في قائمة المهام
              </div>
            )}

            {/* Run At */}
            <p className="text-[10px] text-muted-foreground/50">
              آخر تحليل: {new Date(report.runAt).toLocaleString("ar-EG")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
