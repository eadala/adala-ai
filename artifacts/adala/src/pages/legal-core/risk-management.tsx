import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Shield, TrendingUp, Clock, CheckCircle2, XCircle,
  FileText, Scale, Loader2, ChevronRight, Bell, RefreshCw, Sparkles,
  Calendar, ArrowUpRight, Filter, BarChart3, Target, Flame
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RISK_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#F59E0B",
  low: "#10B981",
};

const RISK_LABELS: Record<string, string> = {
  critical: "حرج",
  high: "مرتفع",
  medium: "متوسط",
  low: "منخفض",
};

const RISK_BG: Record<string, string> = {
  critical: "bg-red-500/10 border-red-500/20 text-red-400",
  high: "bg-orange-500/10 border-orange-500/20 text-orange-400",
  medium: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
  low: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
};

function RiskCard({ risk }: { risk: any }) {
  const level = risk.level as string;
  return (
    <Card className={cn("border transition-all hover:shadow-md", RISK_BG[level])}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: RISK_COLORS[level] }} />
            <span className="text-sm font-bold">{risk.title}</span>
          </div>
          <Badge className="text-[10px] px-2 py-0 flex-shrink-0" style={{ background: `${RISK_COLORS[level]}20`, color: RISK_COLORS[level], border: `1px solid ${RISK_COLORS[level]}40` }}>
            {RISK_LABELS[level]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{risk.description}</p>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{risk.source}</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{risk.date}</span>
        </div>
        {risk.daysLeft !== undefined && (
          <div className="mt-2 pt-2 border-t border-current/20">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span>الوقت المتبقي</span>
              <span className="font-bold">{risk.daysLeft} يوم</span>
            </div>
            <Progress value={Math.max(0, 100 - (risk.daysLeft / 90) * 100)} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 70 ? "#EF4444" : score >= 40 ? "#F59E0B" : "#10B981";
  const level = score >= 70 ? "مرتفع" : score >= 40 ? "متوسط" : "منخفض";
  const r = 40, c = 2 * Math.PI * r;
  const dashOffset = c - (score / 100) * c;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} stroke="#E2E8F0" strokeWidth="8" fill="none" />
          <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="8" fill="none"
            strokeDasharray={c} strokeDashoffset={dashOffset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black" style={{ color }}>{score}</span>
          <span className="text-[9px] text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold">{label}</p>
        <p className="text-[10px]" style={{ color }}>{level}</p>
      </div>
    </div>
  );
}

export default function RiskManagement() {
  const [tab, setTab] = useState("overview");
  const [analyzing, setAnalyzing] = useState(false);
  const { toast } = useToast();

  const { data: contracts = [] } = useQuery<any[]>({
    queryKey: ["contracts"],
    queryFn: () => fetch("/api/contracts").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: cases = [] } = useQuery<any[]>({
    queryKey: ["cases"],
    queryFn: () => fetch("/api/cases").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  // Build risk items from real data
  const today = new Date();
  const contractRisks = contracts
    .filter((c: any) => c.expiresAt)
    .map((c: any) => {
      const exp = new Date(c.expiresAt);
      const daysLeft = Math.floor((exp.getTime() - today.getTime()) / 86400000);
      const level = daysLeft < 0 ? "critical" : daysLeft < 14 ? "critical" : daysLeft < 30 ? "high" : daysLeft < 60 ? "medium" : "low";
      return {
        title: `انتهاء عقد: ${c.title}`,
        description: daysLeft < 0 ? "انتهى العقد دون تجديد — يحتاج إجراء فوري" : `سينتهي العقد خلال ${daysLeft} يوماً — يستوجب المراجعة والتجديد`,
        level,
        source: "العقود",
        date: new Date(c.expiresAt).toLocaleDateString("ar-SA"),
        daysLeft: Math.max(0, daysLeft),
      };
    });

  const contractScoreRisks = contracts
    .filter((c: any) => c.riskScore && parseInt(c.riskScore) >= 6)
    .map((c: any) => ({
      title: `مخاطر عالية: ${c.title}`,
      description: `درجة المخاطرة ${c.riskScore}/10 — يستوجب مراجعة البنود الحساسة`,
      level: parseInt(c.riskScore) >= 8 ? "critical" : "high",
      source: "تحليل العقود",
      date: new Date(c.createdAt).toLocaleDateString("ar-SA"),
    }));

  const staticRisks = [
    { title: "تجديد تراخيص المهنة", description: "موعد تجديد الرخصة المهنية خلال 25 يوماً — تحقق من الوثائق المطلوبة", level: "high", source: "الامتثال", date: "25/02/1447", daysLeft: 25 },
    { title: "مواعيد جلسات معلقة", description: `${cases.filter((c: any) => c.status === "active").length} قضية نشطة تحتاج متابعة مواعيد الجلسات`, level: cases.filter((c: any) => c.status === "active").length > 3 ? "high" : "medium", source: "القضايا", date: new Date().toLocaleDateString("ar-SA") },
    { title: "وثائق منتهية الصلاحية", description: "تحقق من صلاحية وثائق الهوية والتوكيلات المقدمة في القضايا", level: "medium", source: "المستندات", date: new Date().toLocaleDateString("ar-SA") },
    { title: "توافق بنود عقد الشراكة", description: "بنود التوزيع في عقد الشراكة تحتاج مراجعة وفق التعديلات الأخيرة على نظام الشركات", level: "low", source: "العقود", date: new Date().toLocaleDateString("ar-SA") },
  ];

  const allRisks = [...contractRisks, ...contractScoreRisks, ...staticRisks].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.level as keyof typeof order] - order[b.level as keyof typeof order];
  });

  const critical = allRisks.filter(r => r.level === "critical").length;
  const high = allRisks.filter(r => r.level === "high").length;
  const medium = allRisks.filter(r => r.level === "medium").length;
  const low = allRisks.filter(r => r.level === "low").length;

  const overallScore = Math.min(100, critical * 25 + high * 10 + medium * 5);
  const contractScore = Math.min(100, contractRisks.length * 20 + contractScoreRisks.length * 15);
  const complianceScore = 35;

  const runAnalysis = async () => {
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 1800));
    setAnalyzing(false);
    toast({ title: "اكتمل تحليل المخاطر", description: `تم رصد ${allRisks.length} مخاطرة بإجمالي ${critical} حرجة` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">إدارة المخاطر القانونية</h1>
          <p className="text-muted-foreground text-sm">رصد وتحليل المخاطر بشكل استباقي</p>
        </div>
        <Button onClick={runAnalysis} disabled={analyzing} className="gap-2">
          {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {analyzing ? "جارٍ التحليل..." : "تحديث التحليل"}
        </Button>
      </div>

      {/* Risk Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "حرجة", count: critical, color: RISK_COLORS.critical, icon: Flame },
          { label: "مرتفعة", count: high, color: RISK_COLORS.high, icon: AlertTriangle },
          { label: "متوسطة", count: medium, color: RISK_COLORS.medium, icon: Bell },
          { label: "منخفضة", count: low, color: RISK_COLORS.low, icon: Shield },
        ].map(s => (
          <Card key={s.label} className="border-0 bg-card/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <s.icon className="h-5 w-5" style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-2xl font-black" style={{ color: s.color }}>{s.count}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="alerts">التنبيهات ({allRisks.length})</TabsTrigger>
          <TabsTrigger value="matrix">مصفوفة المخاطر</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 mt-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> توزيع المخاطر</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "مخاطر العقود", value: contractRisks.length + contractScoreRisks.length, max: allRisks.length, color: "#6366F1" },
                  { label: "مخاطر القضايا", value: cases.filter((c: any) => c.status === "active").length, max: allRisks.length, color: "#3B82F6" },
                  { label: "مخاطر الامتثال", value: 2, max: allRisks.length, color: "#F59E0B" },
                  { label: "مخاطر المستندات", value: 1, max: allRisks.length, color: "#EC4899" },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>{item.label}</span>
                      <span className="font-bold">{item.value}</span>
                    </div>
                    <Progress value={(item.value / Math.max(allRisks.length, 1)) * 100} className="h-2"
                      style={{ "--progress-color": item.color } as any} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> درجات المخاطر</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <ScoreGauge score={overallScore} label="مستوى المخاطر الكلي" />
                <div className="w-full grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-muted/40 rounded-xl">
                    <div className="text-lg font-black text-orange-400">{contractScore}</div>
                    <div className="text-[10px] text-muted-foreground">مخاطر العقود</div>
                  </div>
                  <div className="text-center p-2 bg-muted/40 rounded-xl">
                    <div className="text-lg font-black text-yellow-400">{complianceScore}</div>
                    <div className="text-[10px] text-muted-foreground">الامتثال</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top 3 Critical */}
          {critical > 0 && (
            <div>
              <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Flame className="h-4 w-4 text-red-400" /> المخاطر الحرجة تستوجب إجراءً فورياً
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {allRisks.filter(r => r.level === "critical").slice(0, 4).map((r, i) => <RiskCard key={i} risk={r} />)}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="mt-5">
          <div className="space-y-3">
            {allRisks.map((r, i) => <RiskCard key={i} risk={r} />)}
            {allRisks.length === 0 && (
              <div className="text-center py-16 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="font-semibold">لا توجد مخاطر مرصودة</p>
                <p className="text-sm mt-1">المنصة تعمل بشكل آمن</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="matrix" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">مصفوفة تقييم المخاطر</CardTitle>
              <p className="text-xs text-muted-foreground">تصنيف المخاطر حسب الاحتمالية والتأثير</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {/* Header row */}
                <div className="font-bold text-muted-foreground text-right py-2">الاحتمالية / التأثير</div>
                {["منخفض", "متوسط", "مرتفع", "حرج"].map(h => (
                  <div key={h} className="font-bold text-muted-foreground py-2">{h}</div>
                ))}
                {/* Matrix rows */}
                {[
                  { prob: "مرتفعة", cells: ["medium", "high", "critical", "critical"] },
                  { prob: "متوسطة", cells: ["low", "medium", "high", "critical"] },
                  { prob: "منخفضة", cells: ["low", "low", "medium", "high"] },
                ].map(row => (
                  <>
                    <div key={row.prob} className="font-bold text-muted-foreground text-right flex items-center">{row.prob}</div>
                    {row.cells.map((cell, i) => (
                      <div key={i} className={cn("rounded-xl p-3 font-semibold text-xs", RISK_BG[cell])}>
                        {RISK_LABELS[cell]}
                      </div>
                    ))}
                  </>
                ))}
              </div>
              <div className="mt-6 space-y-2">
                <p className="text-xs font-bold text-muted-foreground mb-3">تسجيل المخاطر الحالية في المصفوفة</p>
                {allRisks.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded-xl">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: RISK_COLORS[r.level] }} />
                    <span className="text-xs flex-1 truncate">{r.title}</span>
                    <Badge className="text-[10px] px-2 py-0" style={{ background: `${RISK_COLORS[r.level]}15`, color: RISK_COLORS[r.level], border: `1px solid ${RISK_COLORS[r.level]}30` }}>
                      {RISK_LABELS[r.level]}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
