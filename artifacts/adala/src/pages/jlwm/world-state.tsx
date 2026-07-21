/* eslint-disable @typescript-eslint/no-explicit-any -- pre-existing lint debt; authFetch migration */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe, RefreshCw, ChevronDown, ChevronUp, Sparkles,
  AlertTriangle, TrendingUp, TrendingDown, CheckCircle2,
  Lightbulb, Clock, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { WorldState, LegalPattern, RiskLevel } from "@/types/jlwm";
import { authFetch } from "@/lib/authFetch";

const RISK_META: Record<RiskLevel, { label: string; color: string; bg: string; barColor: string }> = {
  green:  { label: "ممتاز",           color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-300",  barColor: "#10B981" },
  yellow: { label: "مستقر",           color: "text-yellow-700",  bg: "bg-yellow-50 border-yellow-300",   barColor: "#F59E0B" },
  orange: { label: "يحتاج انتباهاً",  color: "text-orange-700",  bg: "bg-orange-50 border-orange-300",   barColor: "#F97316" },
  red:    { label: "حرج",             color: "text-red-700",     bg: "bg-red-50 border-red-300",         barColor: "#EF4444" },
};

const RISK_SCORE: Record<RiskLevel, number> = { green: 10, yellow: 35, orange: 65, red: 90 };

function RiskGauge({ level }: { level: RiskLevel }) {
  const meta  = RISK_META[level];
  const score = RISK_SCORE[level];
  const W = 240, H = 130, R = 90, cx = W / 2, cy = H - 10;
  const toXY = (deg: number) => ({
    x: cx + R * Math.cos((deg * Math.PI) / 180),
    y: cy + R * Math.sin((deg * Math.PI) / 180),
  });
  const START = -180, END = 0;
  const angle = START + (score / 100) * (END - START);
  const needle = toXY(angle);

  const segments = [
    { color: "#10B981", from: -180, to: -135 },
    { color: "#F59E0B", from: -135, to:  -90 },
    { color: "#F97316", from:  -90, to:  -45 },
    { color: "#EF4444", from:  -45, to:    0 },
  ];

  function arcPath(from: number, to: number) {
    const s = toXY(from), e = toXY(to);
    return `M ${cx} ${cy} L ${s.x} ${s.y} A ${R} ${R} 0 0 1 ${e.x} ${e.y} Z`;
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {segments.map(seg => (
          <path key={seg.from} d={arcPath(seg.from, seg.to)} fill={seg.color} opacity={0.85} />
        ))}
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="6" fill="#1e293b" />
      </svg>
      <div className={`text-lg font-bold mt-1 ${meta.color}`}>{meta.label}</div>
    </div>
  );
}

function VectorCard({ label, value, icon: Icon, unit = "" }: { label: string; value: number | string; icon: any; unit?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
      <div className="p-2 rounded-lg bg-background border">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <div className="text-lg font-bold">{typeof value === "number" ? value.toLocaleString("ar-SA") : value}{unit}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function WorldStatePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: current, isLoading } = useQuery<WorldState>({
    queryKey: ["jlwm", "world-state"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/world-state");
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: history = [] } = useQuery<WorldState[]>({
    queryKey: ["jlwm", "world-state-history"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/world-state/history?limit=10");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 120_000,
  });

  const { data: patterns = [] } = useQuery<LegalPattern[]>({
    queryKey: ["jlwm", "patterns"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/world-state/patterns");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const computeMut = useMutation({
    mutationFn: async (withNarrative: boolean) => {
      const r = await authFetch("/api/jlwm/world-state/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withNarrative }),
      });
      if (!r.ok) throw new Error("فشل الحساب");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jlwm", "world-state"] });
      qc.invalidateQueries({ queryKey: ["jlwm", "world-state-history"] });
      toast({ title: "تم تحديث حالة العالم القانوني" });
    },
    onError: () => toast({ title: "فشل التحديث", variant: "destructive" }),
  });

  const discoverMut = useMutation({
    mutationFn: async () => {
      const r = await authFetch("/api/jlwm/world-state/discover-patterns", { method: "POST" });
      if (!r.ok) throw new Error("فشل");
      return r.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["jlwm", "patterns"] });
      toast({ title: `اكتشف ${d.discovered} نمط جديد` });
    },
    onError: () => toast({ title: "فشل اكتشاف الأنماط", variant: "destructive" }),
  });

  const risk   = (current?.risk_level ?? "green") as RiskLevel;
  const meta   = RISK_META[risk];
  const sv     = current?.state_vector;
  const threats = current?.active_threats?.items ?? [];
  const opps    = current?.opportunities?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-60">
        <Globe className="h-10 w-10 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" /> محرك حالة العالم القانوني
          </h1>
          <p className="text-muted-foreground text-sm">
            آخر تحديث: {current?.computed_at ? new Date(current.computed_at).toLocaleString("ar-SA") : "—"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => computeMut.mutate(false)} disabled={computeMut.isPending}>
            <RefreshCw className="h-4 w-4 me-1" /> حساب
          </Button>
          <Button size="sm" onClick={() => computeMut.mutate(true)} disabled={computeMut.isPending}>
            <Sparkles className="h-4 w-4 me-1" /> {computeMut.isPending ? "جارٍ…" : "تحديث مع AI"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="current" dir="rtl">
        <TabsList>
          <TabsTrigger value="current">الحالة الحالية</TabsTrigger>
          <TabsTrigger value="patterns">الأنماط القانونية</TabsTrigger>
          <TabsTrigger value="history">السجل التاريخي</TabsTrigger>
        </TabsList>

        {/* ── Current State ─────────────────────────── */}
        <TabsContent value="current" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className={`border-2 ${meta.bg}`}>
              <CardContent className="pt-5 flex flex-col items-center">
                <RiskGauge level={risk} />
                {current?.state_summary && (
                  <p className={`text-sm mt-3 text-center ${meta.color}`}>{current.state_summary}</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">متجه الحالة</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {sv && <>
                  <VectorCard label="قضايا نشطة"     value={sv.active_cases}      icon={BarChart3} />
                  <VectorCard label="قضايا حرجة"     value={sv.critical_cases}    icon={AlertTriangle} />
                  <VectorCard label="مهام متأخرة"    value={sv.overdue_tasks}     icon={Clock} />
                  <VectorCard label="جلسات قادمة"    value={sv.upcoming_hearings} icon={Clock} />
                  <VectorCard label="زخم الإيرادات"  value={`${(sv.revenue_momentum * 100).toFixed(1)}%`} icon={sv.revenue_momentum >= 0 ? TrendingUp : TrendingDown} />
                  <VectorCard label="معدل الفوز"     value={`${(sv.win_rate * 100).toFixed(1)}%`} icon={CheckCircle2} />
                </>}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" /> التهديدات النشطة ({threats.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {threats.length === 0
                  ? <p className="text-sm text-muted-foreground">لا توجد تهديدات نشطة</p>
                  : threats.map((t: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <p className="text-sm text-red-700">{t.detail}</p>
                    </div>
                  ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-emerald-600">
                  <Lightbulb className="h-4 w-4" /> الفرص المتاحة ({opps.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {opps.length === 0
                  ? <p className="text-sm text-muted-foreground">لا توجد فرص محددة</p>
                  : opps.map((o: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      <p className="text-sm text-emerald-700">{o.detail}</p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Patterns ──────────────────────────────── */}
        <TabsContent value="patterns" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => discoverMut.mutate()} disabled={discoverMut.isPending}>
              <Sparkles className="h-4 w-4 me-1" /> {discoverMut.isPending ? "جارٍ الاكتشاف…" : "اكتشف أنماطاً بالذكاء الاصطناعي"}
            </Button>
          </div>
          {patterns.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              لم يُكتشف أي نمط بعد — اضغط "اكتشف أنماطاً" لتحليل البيانات
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {patterns.map(p => (
                <Card key={p.id} className="cursor-pointer" onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">{p.pattern_type}</Badge>
                        <span className="font-medium text-sm">{p.pattern_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-primary">
                          {(p.confidence_score * 100).toFixed(0)}%
                        </div>
                        {expanded === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                    {expanded === p.id && p.description && (
                      <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">{p.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── History ───────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          <div className="space-y-2">
            {history.map(h => {
              const m = RISK_META[h.risk_level as RiskLevel];
              return (
                <div key={h.id} className={`flex items-center justify-between p-3 rounded-lg border ${m.bg}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full`} style={{ background: m.barColor }} />
                    <span className={`text-sm font-medium ${m.color}`}>{m.label}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{h.state_vector?.active_cases ?? 0} قضية نشطة</span>
                    <span>{new Date(h.computed_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}</span>
                    <Badge variant="outline" className="text-xs">{h.triggered_by}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
