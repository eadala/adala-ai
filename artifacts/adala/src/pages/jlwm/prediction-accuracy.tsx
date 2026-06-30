import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Target, TrendingUp, BarChart3, CheckCircle2, AlertTriangle,
  RefreshCw, PlusCircle, History, Gauge,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const TYPE_LABELS: Record<string, string> = {
  outcome:    "نتيجة القضية",
  duration:   "مدة القضية",
  settlement: "التسوية",
  appeal:     "الاستئناف",
  execution:  "التنفيذ",
  churn:      "تراجع العملاء",
  revenue:    "الإيرادات",
};

function AccuracyGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444";
  const r = 40; const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 50 50)"/>
        <text x="50" y="55" textAnchor="middle" fontSize="20" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

export default function PredictionAccuracyPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [recordOpen, setRecordOpen] = useState(false);
  const [form, setForm] = useState({
    caseId: "", predictionType: "outcome",
    actualWon: "true", actualDays: "", actualAmount: "",
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["jlwm", "accuracy", "stats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/jlwm/accuracy/stats`);
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ stats: any[]; overall_accuracy: number; total_records_types: number }>;
    },
    staleTime: 120_000,
  });

  const { data: calibration } = useQuery({
    queryKey: ["jlwm", "accuracy", "calibration"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/jlwm/accuracy/calibration`);
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ calibration: Record<string, any[]> }>;
    },
    staleTime: 120_000,
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["jlwm", "accuracy", "history"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/jlwm/accuracy/history?limit=30`);
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ records: any[]; total: number }>;
    },
    staleTime: 60_000,
  });

  const recordMut = useMutation({
    mutationFn: async () => {
      const predictedValue = form.predictionType === "outcome"
        ? { win_probability: form.actualWon === "true" ? 0.7 : 0.3 }
        : form.predictionType === "duration"
        ? { estimated_days: Number(form.actualDays) }
        : { amount: Number(form.actualAmount) };
      const actualValue = form.predictionType === "outcome"
        ? { won: form.actualWon === "true" }
        : form.predictionType === "duration"
        ? { actual_days: Number(form.actualDays) }
        : { actual_revenue: Number(form.actualAmount) };
      const r = await fetch(`${BASE}/api/jlwm/accuracy/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: form.caseId, predictionType: form.predictionType,
          predictedValue, actualValue,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "✅ تم تسجيل النتيجة الفعلية" });
      qc.invalidateQueries({ queryKey: ["jlwm", "accuracy"] });
      setRecordOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const overall = stats?.overall_accuracy ?? 0;
  const overallPct = Math.round(overall * 100);
  const overallColor = overallPct >= 80 ? "text-emerald-600" : overallPct >= 60 ? "text-yellow-600" : "text-red-500";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            مركز دقة التنبؤ
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تتبع دقة التنبؤات الذكية مقابل النتائج الفعلية</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["jlwm", "accuracy"] })}>
            <RefreshCw className="h-4 w-4 me-1" /> تحديث
          </Button>
          <Button size="sm" onClick={() => setRecordOpen(true)}>
            <PlusCircle className="h-4 w-4 me-1" /> تسجيل نتيجة
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      {!statsLoading && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-8">
              <AccuracyGauge value={overall} label="الدقة الإجمالية" />
              <div className="flex-1 space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-bold ${overallColor}`}>{overallPct}%</span>
                  <span className="text-muted-foreground">دقة التنبؤات</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {overallPct >= 80 ? "دقة ممتازة — النظام يتعلم بشكل جيد"
                  : overallPct >= 60 ? "دقة جيدة — هناك مجال للتحسين"
                  : "دقة منخفضة — يحتاج مزيداً من البيانات"}
                </p>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">أنواع التنبؤ المقيّمة: <b>{stats?.total_records_types ?? 0}</b></span>
                  <span className="text-muted-foreground">الإجمالي: <b>{(history?.total ?? 0)} سجل</b></span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap gap-1 p-1 bg-muted/40">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="calibration">معايرة الثقة</TabsTrigger>
          <TabsTrigger value="history">السجل التاريخي</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {statsLoading ? (
            <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
          ) : !stats?.stats?.length ? (
            <Card>
              <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
                <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>لا توجد سجلات دقة بعد. سجّل نتائج القضايا المغلقة لبدء القياس.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.stats.map((s: any) => {
                const pct = Math.round(Number(s.avg_accuracy ?? 0) * 100);
                const color = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-yellow-600" : "text-red-500";
                const bgColor = pct >= 80 ? "bg-emerald-50 border-emerald-200" : pct >= 60 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";
                return (
                  <Card key={s.prediction_type} className={`border ${bgColor}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{TYPE_LABELS[s.prediction_type] ?? s.prediction_type}</span>
                        <Badge variant="outline" className={color}>{pct}%</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Progress value={pct} className="h-2" />
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>سجلات: <b className="text-foreground">{s.total_records}</b></span>
                        <span>انحراف: <b className="text-foreground">{Math.round(Number(s.avg_deviation ?? 0) * 100)}%</b></span>
                        <span>أدنى: <b className="text-foreground">{Math.round(Number(s.min_accuracy ?? 0) * 100)}%</b></span>
                        <span>أعلى: <b className="text-foreground">{Math.round(Number(s.max_accuracy ?? 0) * 100)}%</b></span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Calibration */}
        <TabsContent value="calibration" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Gauge className="h-4 w-4 text-purple-500" />
                معايرة الثقة — توزيع نطاقات الدقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!calibration?.calibration || !Object.keys(calibration.calibration).length ? (
                <p className="text-center text-muted-foreground py-6">لا بيانات معايرة بعد</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(calibration.calibration).map(([type, bands]) => (
                    <div key={type}>
                      <h4 className="text-sm font-medium mb-2">{TYPE_LABELS[type] ?? type}</h4>
                      <div className="space-y-2">
                        {(bands as any[]).map((b: any) => (
                          <div key={b.band} className="flex items-center gap-3">
                            <span className="text-xs w-28 text-muted-foreground">{b.band}</span>
                            <Progress value={Math.min(Number(b.count ?? 0) * 10, 100)} className="flex-1 h-2" />
                            <span className="text-xs w-16 text-right">{b.count} سجل</span>
                          </div>
                        ))}
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
                <History className="h-4 w-4 text-indigo-500" />
                السجل التاريخي ({history?.total ?? 0} سجل)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {histLoading ? (
                <div className="text-center py-8 text-muted-foreground">جارٍ التحميل...</div>
              ) : !history?.records?.length ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد سجلات بعد</div>
              ) : (
                <div className="space-y-2">
                  {history.records.map((r: any) => {
                    const pct = Math.round(Number(r.accuracy_score ?? 0) * 100);
                    const icon = pct >= 80 ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertTriangle className="h-4 w-4 text-yellow-500" />;
                    return (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors">
                        {icon}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{r.case_title ?? r.case_id}</div>
                          <div className="text-xs text-muted-foreground">{TYPE_LABELS[r.prediction_type] ?? r.prediction_type}</div>
                        </div>
                        <Badge variant="outline" className={pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-yellow-600" : "text-red-500"}>
                          {pct}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.recorded_at).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Dialog */}
      <AdaptiveDialog open={recordOpen} onOpenChange={setRecordOpen}>
        <AdaptiveDialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل نتيجة فعلية</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>معرّف القضية</Label>
              <Input placeholder="أدخل ID القضية" value={form.caseId}
                onChange={e => setForm(f => ({ ...f, caseId: e.target.value }))} />
            </div>
            <div>
              <Label>نوع التنبؤ</Label>
              <Select value={form.predictionType} onValueChange={v => setForm(f => ({ ...f, predictionType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.predictionType === "outcome" && (
              <div>
                <Label>النتيجة الفعلية</Label>
                <Select value={form.actualWon} onValueChange={v => setForm(f => ({ ...f, actualWon: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">فوز</SelectItem>
                    <SelectItem value="false">خسارة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.predictionType === "duration" && (
              <div>
                <Label>عدد الأيام الفعلية</Label>
                <Input type="number" value={form.actualDays}
                  onChange={e => setForm(f => ({ ...f, actualDays: e.target.value }))} />
              </div>
            )}
            {(form.predictionType === "revenue" || form.predictionType === "settlement") && (
              <div>
                <Label>المبلغ الفعلي (ريال)</Label>
                <Input type="number" value={form.actualAmount}
                  onChange={e => setForm(f => ({ ...f, actualAmount: e.target.value }))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)}>إلغاء</Button>
            <Button onClick={() => recordMut.mutate()} disabled={!form.caseId || recordMut.isPending}>
              {recordMut.isPending ? "جارٍ الحفظ..." : "تسجيل"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}
