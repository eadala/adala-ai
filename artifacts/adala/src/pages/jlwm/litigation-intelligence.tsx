/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState }                              from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sword, ShieldAlert, Search, AlertTriangle, ListChecks,
  RefreshCw, Sparkles, ChevronDown, ChevronUp,
  Star, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge }    from "@/components/ui/badge";
import { Button }   from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";

/* ── Types ──────────────────────────────────────────────────── */
interface IntelItem  { text: string; impact: "high"|"medium"|"low"; detail?: string }
interface ActionItem { priority: "critical"|"high"|"medium"|"low"; action: string; deadline?: string; owner?: string }
interface IntelReport {
  exists?:             boolean;
  strengths:           IntelItem[];
  weaknesses:          IntelItem[];
  missing_evidence:    IntelItem[];
  procedural_risks:    IntelItem[];
  recommended_actions: ActionItem[];
  overall_score:       number;
  confidence:          number;
  modelUsed?:          string;
  createdAt?:          string;
  cached?:             boolean;
}

/* ── Helpers ─────────────────────────────────────────────────── */
const IMPACT_CFG = {
  high:   { color:"text-red-600",    bg:"bg-red-50 border-red-200",    dot:"bg-red-500",    label:"عالي" },
  medium: { color:"text-orange-600", bg:"bg-orange-50 border-orange-200", dot:"bg-orange-500", label:"متوسط" },
  low:    { color:"text-blue-600",   bg:"bg-blue-50 border-blue-200",  dot:"bg-blue-500",   label:"منخفض" },
};
const PRIORITY_CFG = {
  critical:{ color:"text-red-700",    bg:"bg-red-100 border-red-300",     label:"حرج" },
  high:    { color:"text-orange-700", bg:"bg-orange-100 border-orange-300", label:"عالي" },
  medium:  { color:"text-yellow-700", bg:"bg-yellow-100 border-yellow-300", label:"متوسط" },
  low:     { color:"text-blue-700",   bg:"bg-blue-100 border-blue-300",   label:"منخفض" },
};

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const pct   = Math.round(score * 100);
  const color = pct >= 70 ? "#10B981" : pct >= 45 ? "#F59E0B" : "#EF4444";
  const R = 36, circ = 2 * Math.PI * R, dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={R} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle cx="44" cy="44" r={R} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 44 44)" />
        <text x="44" y="48" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{pct}</text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function IntelSection({ title, icon: Icon, color, items, emptyMsg }: {
  title: string; icon: any; color: string; items: IntelItem[]; emptyMsg: string;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm flex items-center gap-2 ${color}`}>
          <Icon className="h-4 w-4" /> {title}
          <Badge variant="secondary" className="text-xs ms-1">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0
          ? <p className="text-xs text-muted-foreground">{emptyMsg}</p>
          : items.map((item, i) => {
              const cfg = IMPACT_CFG[item.impact] ?? IMPACT_CFG.medium;
              const isOpen = expandedIdx === i;
              return (
                <div key={i}
                  className={`rounded-lg border p-2.5 cursor-pointer transition-colors ${cfg.bg}`}
                  onClick={() => setExpandedIdx(isOpen ? null : i)}>
                  <div className="flex items-start gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-medium ${cfg.color}`}>{item.text}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                          {item.detail && (isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                        </div>
                      </div>
                      {isOpen && item.detail && (
                        <p className={`text-xs mt-1.5 ${cfg.color} opacity-80`}>{item.detail}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
        }
      </CardContent>
    </Card>
  );
}

function ActionsSection({ actions }: { actions: ActionItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-primary">
          <ListChecks className="h-4 w-4" /> الإجراءات الموصى بها
          <Badge variant="secondary" className="text-xs ms-1">{actions.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.length === 0
          ? <p className="text-xs text-muted-foreground">لا توجد إجراءات موصى بها</p>
          : actions.map((a, i) => {
              const cfg = PRIORITY_CFG[a.priority] ?? PRIORITY_CFG.medium;
              return (
                <div key={i} className={`rounded-lg border p-3 ${cfg.bg}`}>
                  <div className="flex items-start gap-2">
                    <Badge variant="outline" className={`text-xs shrink-0 ${cfg.color} border-current`}>
                      {cfg.label}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${cfg.color}`}>{a.action}</p>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        {a.deadline && <span>⏰ {a.deadline}</span>}
                        {a.owner    && <span>👤 {a.owner}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
        }
      </CardContent>
    </Card>
  );
}

/* ── Report panel ────────────────────────────────────────────── */
function ReportPanel({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<IntelReport>({
    queryKey: ["jlwm","litigation", caseId],
    queryFn: async () => {
      const r = await authFetch(`/api/jlwm/litigation/${caseId}`);
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 300_000,
  });

  const analyzeMut = useMutation({
    mutationFn: async (force: boolean) => {
      const r = await authFetch(`/api/jlwm/litigation/${caseId}/analyze`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force }),
      });
      if (!r.ok) throw new Error("فشل التحليل");
      return r.json() as Promise<IntelReport>;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jlwm","litigation", caseId] }); toast({ title: "اكتمل تحليل الذكاء القانوني" }); },
    onError: () => toast({ title: "فشل التحليل", variant: "destructive" }),
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground text-sm">جارٍ التحليل…</div>;

  if (!data?.exists && !analyzeMut.data) {
    return (
      <div className="py-10 text-center space-y-3">
        <Sword className="h-12 w-12 mx-auto text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">لا يوجد تقرير ذكاء قانوني لهذه القضية</p>
        <Button onClick={() => analyzeMut.mutate(false)} disabled={analyzeMut.isPending}>
          <Sparkles className="h-4 w-4 me-1" />
          {analyzeMut.isPending ? "جارٍ التحليل بالذكاء الاصطناعي…" : "تحليل القضية بالذكاء الاصطناعي"}
        </Button>
      </div>
    );
  }

  const report = (analyzeMut.data ?? data) as IntelReport;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6">
          <ScoreGauge score={report.overall_score ?? 0} label="قوة الموقف" />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">مستوى الثقة</p>
            <div className="flex items-center gap-2 w-40">
              <Progress value={(report.confidence ?? 0) * 100} className="h-1.5 flex-1" />
              <span className="text-xs font-bold">{Math.round((report.confidence ?? 0) * 100)}%</span>
            </div>
            {report.modelUsed && <Badge variant="outline" className="text-xs">{report.modelUsed}</Badge>}
            {report.createdAt && <p className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleString("ar-SA")}</p>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => analyzeMut.mutate(true)} disabled={analyzeMut.isPending}>
          <RefreshCw className="h-3 w-3 me-1" /> {analyzeMut.isPending ? "جارٍ…" : "إعادة التحليل"}
        </Button>
      </div>

      {/* 5 sections grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <IntelSection title="نقاط القوة"    icon={TrendingUp}   color="text-emerald-600" items={report.strengths ?? []}         emptyMsg="لم يُكتشف أي نقاط قوة" />
        <IntelSection title="نقاط الضعف"    icon={ShieldAlert}  color="text-red-600"     items={report.weaknesses ?? []}       emptyMsg="لم تُكتشف نقاط ضعف" />
        <IntelSection title="الأدلة الناقصة" icon={Search}       color="text-orange-600" items={report.missing_evidence ?? []}  emptyMsg="الملف الدليلي مكتمل" />
        <IntelSection title="المخاطر الإجرائية" icon={AlertTriangle} color="text-yellow-600" items={report.procedural_risks ?? []} emptyMsg="لا توجد مخاطر إجرائية" />
      </div>
      <ActionsSection actions={report.recommended_actions ?? []} />
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────── */
export default function LitigationIntelligencePage() {
  const [selectedCase, setSelectedCase] = useState<{ id: string; title: string } | null>(null);

  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ["cases-list-li"],
    queryFn: async () => {
      const r = await authFetch("/api/cases?limit=50");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.cases ?? d.data ?? []);
    },
    staleTime: 120_000,
  });

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sword className="h-6 w-6 text-primary" /> ذكاء المرافعة القانونية
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          تحليل شامل بالذكاء الاصطناعي: نقاط القوة والضعف، الأدلة الناقصة، المخاطر الإجرائية، الإجراءات الموصى بها
        </p>
      </div>

      {/* Case selector */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-sm font-medium mb-3">اختر قضية لتحليلها</p>
          <div className="flex flex-wrap gap-2">
            {(cases as any[]).slice(0, 20).map(c => (
              <button key={c.id}
                onClick={() => setSelectedCase({ id: c.id, title: c.title })}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  selectedCase?.id === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 hover:bg-muted border-border"
                }`}>
                {c.title}
              </button>
            ))}
            {cases.length === 0 && <p className="text-xs text-muted-foreground">لا توجد قضايا</p>}
          </div>
        </CardContent>
      </Card>

      {selectedCase
        ? (
          <div>
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Sword className="h-4 w-4 text-primary" />
              تحليل: {selectedCase.title}
            </h2>
            <ReportPanel caseId={selectedCase.id} />
          </div>
        )
        : (
          <div className="py-12 text-center text-muted-foreground">
            <Sword className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>اختر قضية من القائمة أعلاه لبدء التحليل</p>
          </div>
        )
      }
    </div>
  );
}
