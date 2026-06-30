import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Brain, Globe, Network, Zap, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Clock, RefreshCw, ChevronRight, Activity, Shield,
  BarChart3, Cpu, Lightbulb, Bell, Crown, Target, BrainCircuit,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import type {
  JLWMDashboard, RiskLevel, Priority, AlertSeverity,
} from "@/types/jlwm";

/* ── Helpers ─────────────────────────────────────────────── */
const RISK_COLORS: Record<RiskLevel, string> = {
  green:  "text-emerald-600 bg-emerald-50 border-emerald-200",
  yellow: "text-yellow-600 bg-yellow-50 border-yellow-200",
  orange: "text-orange-600 bg-orange-50 border-orange-200",
  red:    "text-red-600 bg-red-50 border-red-200",
};
const RISK_LABELS: Record<RiskLevel, string> = {
  green: "ممتاز", yellow: "مستقر", orange: "تحتاج انتباه", red: "حرج",
};
const PRIORITY_COLORS: Record<Priority, string> = {
  critical: "bg-red-100 text-red-700 border-red-300",
  high:     "bg-orange-100 text-orange-700 border-orange-300",
  medium:   "bg-yellow-100 text-yellow-700 border-yellow-300",
  low:      "bg-blue-100 text-blue-700 border-blue-300",
};
const PRIORITY_LABELS: Record<Priority, string> = {
  critical:"حرج", high:"عالي", medium:"متوسط", low:"منخفض",
};
const SEV_COLORS: Record<AlertSeverity, string> = {
  critical: "bg-red-500",
  warning:  "bg-orange-400",
  info:     "bg-blue-400",
};

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 44 44)" />
        <text x="44" y="48" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>
          {Math.round(score)}
        </text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

/* ── Main Dashboard ──────────────────────────────────────── */
export default function JLWMDashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: dash, isLoading, refetch } = useQuery<JLWMDashboard>({
    queryKey: ["jlwm", "dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/jlwm/dashboard");
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 60_000,
  });

  const syncMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/jlwm/twins/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "all" }) });
      if (!r.ok) throw new Error("فشل التزامن");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jlwm"] }); toast({ title: "تم التزامن بنجاح" }); },
    onError: () => toast({ title: "فشل التزامن", variant: "destructive" }),
  });

  const computeMut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/jlwm/world-state/compute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withNarrative: false }) });
      if (!r.ok) throw new Error("فشل");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["jlwm"] }); toast({ title: "تم تحديث حالة العالم القانوني" }); },
  });

  const ws    = dash?.worldState as any ?? {};
  const risk  = (ws.risk_level ?? "green") as RiskLevel;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center space-y-3">
          <Brain className="h-12 w-12 mx-auto text-primary animate-pulse" />
          <p className="text-muted-foreground">جارٍ تحميل مركز القيادة القانونية…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            مركز القيادة القانونية
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            نظام الذكاء القانوني المؤسسي — رؤية شاملة ودقيقة لعالم مكتبك القانوني
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 me-1" /> تحديث
          </Button>
          <Button variant="outline" size="sm" onClick={() => computeMut.mutate()} disabled={computeMut.isPending}>
            <Globe className="h-4 w-4 me-1" /> حساب الحالة
          </Button>
          <Button size="sm" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            <Zap className="h-4 w-4 me-1" /> {syncMut.isPending ? "جارٍ التزامن…" : "مزامنة الآن"}
          </Button>
        </div>
      </div>

      {/* ── Scores Row ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-5 flex flex-col items-center gap-3">
            <ScoreRing score={dash?.firmHealthScore ?? 0} label="صحة المكتب" color="#6366F1" />
            <div className={`text-xs px-2 py-0.5 rounded-full border font-medium ${RISK_COLORS[risk]}`}>
              {RISK_LABELS[risk]}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm text-muted-foreground">الأداء</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dash?.winRate?.toFixed(0) ?? 0}%</div>
            <p className="text-xs text-muted-foreground">معدل الفوز</p>
            <Progress value={dash?.winRate ?? 0} className="mt-2 h-1.5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm text-muted-foreground">القضايا</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dash?.activeCases ?? 0}</div>
            <p className="text-xs text-muted-foreground">قضية نشطة</p>
            {(dash?.activeThreats ?? 0) > 0 && (
              <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" /> {dash?.activeThreats} تهديد نشط
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm text-muted-foreground">الإيرادات</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dash?.monthlyRevenue ?? 0).toLocaleString("ar-SA", { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">ريال / الشهر</p>
            <div className={`flex items-center gap-1 mt-1 text-xs ${(dash?.revenueTrend ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {(dash?.revenueTrend ?? 0) >= 0
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />}
              {Math.abs(dash?.revenueTrend ?? 0).toFixed(1)}% مقارنة بالشهر الماضي
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── World State Summary ─────────────────────────── */}
      {ws.state_summary && (
        <Card className={`border ${RISK_COLORS[risk]}`}>
          <CardContent className="pt-4 flex items-start gap-3">
            <Globe className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">حالة العالم القانوني</p>
              <p className="text-sm mt-0.5">{ws.state_summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Recommendations */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" /> التوصيات الذكية
              </CardTitle>
              <Link href="/jlwm/predictions">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  عرض الكل <ChevronRight className="h-3 w-3 ms-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {(dash?.recommendations ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد توصيات نشطة الآن</p>
            ) : (dash?.recommendations ?? []).map((rec: any) => (
              <div key={rec.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Badge variant="outline" className={`text-xs shrink-0 ${PRIORITY_COLORS[rec.priority as Priority]}`}>
                  {PRIORITY_LABELS[rec.priority as Priority]}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{rec.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rec.body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Radar Alerts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-500" /> تنبيهات الرادار
              </CardTitle>
              <Link href="/jlwm/command">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  الكل <ChevronRight className="h-3 w-3 ms-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {(dash?.radarAlerts ?? []).length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد تنبيهات</p>
              </div>
            ) : (dash?.radarAlerts ?? []).map((alert: any) => (
              <div key={alert.id} className="flex items-start gap-2 p-2 rounded-lg border bg-muted/30">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEV_COLORS[alert.severity as AlertSeverity]}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{alert.body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Quick Links ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/jlwm/world-state",    icon: Globe,    label: "حالة العالم القانوني", color: "text-blue-600",    bg: "bg-blue-50 hover:bg-blue-100" },
          { href: "/jlwm/memory-graph",   icon: Network,  label: "مخطط الذاكرة",         color: "text-purple-600",  bg: "bg-purple-50 hover:bg-purple-100" },
          { href: "/jlwm/command",        icon: Cpu,      label: "مركز القيادة AI",      color: "text-indigo-600",  bg: "bg-indigo-50 hover:bg-indigo-100" },
          { href: "/jlwm/simulation",      icon: Activity, label: "النسخ الرقمية",        color: "text-emerald-600", bg: "bg-emerald-50 hover:bg-emerald-100" },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <Card className={`cursor-pointer transition-colors ${item.bg} border-transparent hover:shadow-sm`}>
              <CardContent className="pt-4 pb-4 flex flex-col items-center gap-2">
                <item.icon className={`h-7 w-7 ${item.color}`} />
                <span className={`text-sm font-medium ${item.color}`}>{item.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Memory Graph Mini Stats ─────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Network className="h-4 w-4 text-purple-500" />
            مخطط الذاكرة القانونية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{dash?.memoryGraph?.nodes ?? 0}</div>
              <div className="text-xs text-muted-foreground">عقدة</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{dash?.memoryGraph?.edges ?? 0}</div>
              <div className="text-xs text-muted-foreground">علاقة</div>
            </div>
            <Link href="/jlwm/memory-graph" className="ms-auto">
              <Button variant="outline" size="sm">
                <Network className="h-4 w-4 me-1" /> عرض المخطط
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ── Phase 3 Quick Access ─────────────────────────── */}
      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-violet-700">
            <BrainCircuit className="h-4 w-4" />
            Phase 3 — الذكاء التنفيذي والمؤسسي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { href: "/jlwm/prediction-accuracy", icon: Target, label: "مركز دقة التنبؤ", desc: "تتبع النتائج الفعلية مقابل التنبؤات", color: "text-blue-600" },
              { href: "/jlwm/executive-intelligence", icon: Crown, label: "الذكاء التنفيذي", desc: "تقارير تنفيذية + توقعات إيرادات", color: "text-amber-600" },
              { href: "/jlwm/legal-coo", icon: BrainCircuit, label: "المدير التشغيلي الذكي", desc: "مراقبة + خطط عمل + موافقة", color: "text-violet-600" },
            ].map(item => (
              <Link key={item.href} href={item.href}>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/70 border border-white/50 hover:bg-white/90 transition-colors cursor-pointer">
                  <item.icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${item.color}`}>{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 ms-auto" />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
