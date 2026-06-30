import { useQuery } from "@tanstack/react-query";
import {
  Crown, BrainCircuit, Target, BarChart3, AlertTriangle,
  CheckCircle2, TrendingUp, Activity, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function StatCard({ label, value, icon: Icon, color = "text-blue-600" }: any) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p>
          </div>
          <Icon className={`h-5 w-5 ${color} opacity-60`} />
        </div>
      </CardContent>
    </Card>
  );
}

export function JLWMIntelligenceTab() {
  const { data: cooStats, isLoading: cooLoading } = useQuery({
    queryKey: ["sa", "jlwm", "coo-platform"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/jlwm/coo/platform-stats`);
      if (!r.ok) throw new Error("غير مصرح");
      return r.json();
    },
    staleTime: 120_000,
  });

  const { data: accStats, isLoading: accLoading } = useQuery({
    queryKey: ["sa", "jlwm", "accuracy-stats"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/jlwm/accuracy/stats`);
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 300_000,
  });

  const overallAcc = accStats?.overall_accuracy ?? 0;
  const overallPct = Math.round(overallAcc * 100);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            ذكاء مركز القيادة القانونية — المؤسسي
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            مركز دقة التنبؤ + الذكاء التنفيذي + المدير التشغيلي الذكي
          </p>
        </div>
      </div>

      {/* COO Platform Stats */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">إحصاءات COO على مستوى المنصة</h3>
        {cooLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">جارٍ التحميل...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="مكاتب تستخدم COO" value={cooStats?.total_offices ?? 0} icon={Activity} color="text-violet-600" />
            <StatCard label="إجراءات بانتظار الموافقة" value={cooStats?.pending ?? 0} icon={AlertTriangle} color="text-amber-600" />
            <StatCard label="إجراءات منفّذة" value={cooStats?.executed ?? 0} icon={CheckCircle2} color="text-emerald-600" />
            <StatCard label="تنبيهات حرجة" value={cooStats?.critical ?? 0} icon={AlertTriangle} color="text-red-600" />
          </div>
        )}
      </div>

      {/* Accuracy Stats */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">مركز دقة التنبؤ</h3>
        {accLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">جارٍ التحميل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className={overallPct >= 80 ? "border-emerald-200 bg-emerald-50" : overallPct >= 60 ? "border-yellow-200 bg-yellow-50" : "border-red-200 bg-red-50"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  الدقة الإجمالية للتنبؤات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <span className={`text-4xl font-bold ${overallPct >= 80 ? "text-emerald-600" : overallPct >= 60 ? "text-yellow-600" : "text-red-500"}`}>
                    {overallPct}%
                  </span>
                  <div className="flex-1">
                    <Progress value={overallPct} className="h-2 mb-1" />
                    <p className="text-xs text-muted-foreground">
                      {overallPct >= 80 ? "ممتاز" : overallPct >= 60 ? "جيد" : "يحتاج تحسين"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {accStats?.stats?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    الدقة حسب النوع
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {accStats.stats.slice(0, 5).map((s: any) => {
                    const pct = Math.round(Number(s.avg_accuracy ?? 0) * 100);
                    return (
                      <div key={s.prediction_type} className="flex items-center gap-2">
                        <span className="text-xs w-24 text-muted-foreground truncate">{s.prediction_type}</span>
                        <Progress value={pct} className="flex-1 h-1.5" />
                        <span className="text-xs font-medium w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">روابط سريعة لـ Phase 3</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { href: "/jlwm/prediction-accuracy", icon: Target, label: "مركز دقة التنبؤ", desc: "تسجيل النتائج الفعلية وقياس الدقة", color: "text-blue-600 bg-blue-50 border-blue-200" },
            { href: "/jlwm/executive-intelligence", icon: Crown, label: "الذكاء التنفيذي", desc: "تقارير تنفيذية أسبوعية وشهرية", color: "text-amber-600 bg-amber-50 border-amber-200" },
            { href: "/jlwm/legal-coo", icon: BrainCircuit, label: "المدير التشغيلي الذكي", desc: "مراقبة + خطط عمل + موافقة", color: "text-violet-600 bg-violet-50 border-violet-200" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <Card className={`cursor-pointer hover:shadow-md transition-shadow border ${item.color}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <item.icon className={`h-5 w-5 mt-0.5 ${item.color.split(" ")[0]}`} />
                    <div>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
