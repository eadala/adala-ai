import { useQuery } from "@tanstack/react-query";
import { Scale, Users, TrendingUp, AlertCircle, ChevronLeft, Clock, Briefcase } from "lucide-react";

const API = "/api";

function fetchJson(path: string) {
  return fetch(`${API}${path}`).then(r => r.json());
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: any;
  color: string; sub?: string;
}) {
  return (
    <div className="bg-card rounded-2xl p-4 flex flex-col gap-2 border border-border/50">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export default function Home() {
  const today = new Date();
  const dateStr = today.toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchJson("/dashboard/stats"),
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => fetchJson("/dashboard/overview"),
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: () => fetchJson("/dashboard/recent-activity"),
  });

  const kpis = overview?.kpis ?? stats;
  const recentCases = overview?.recentCases ?? [];
  const activityItems = (Array.isArray(activity) ? activity : []).slice(0, 5);

  const STATUS_LABEL: Record<string, string> = {
    open: "مفتوحة", in_progress: "قيد التنفيذ", closed: "مغلقة",
  };

  const activityIcon: Record<string, string> = {
    case: "⚖️", client: "👤", document: "📄", invoice: "🧾", reminder: "🔔",
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-12 pb-5 safe-top">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold text-foreground">عدالة AI</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center">
            <span className="text-primary font-bold text-lg">⚖</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 flex flex-col gap-5">
        {/* Stats Grid */}
        {statsLoading || overviewLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="القضايا النشطة"
              value={kpis?.activeCases ?? kpis?.openCases ?? 0}
              icon={Scale}
              color="bg-blue-500/15 text-blue-300"
              sub={`من ${kpis?.totalCases ?? 0} إجمالي`}
            />
            <StatCard
              label="العملاء"
              value={kpis?.totalClients ?? kpis?.activeUsers ?? 0}
              icon={Users}
              color="bg-green-500/15 text-green-300"
              sub={kpis?.clientsThisMonth ? `+${kpis.clientsThisMonth} هذا الشهر` : undefined}
            />
            <StatCard
              label="الإيرادات"
              value={`${((kpis?.paidRevenue ?? kpis?.monthlyRevenue ?? 0) / 1000).toFixed(1)}ك`}
              icon={TrendingUp}
              color="bg-primary/15 text-primary"
              sub="ريال سعودي"
            />
            <StatCard
              label="المستحقة"
              value={`${((kpis?.outstanding ?? 0) / 1000).toFixed(1)}ك`}
              icon={AlertCircle}
              color="bg-orange-500/15 text-orange-300"
              sub="ريال سعودي"
            />
          </div>
        )}

        {/* Recent Cases */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-foreground">أحدث القضايا</h2>
            <a href="/adala-mobile/cases" className="flex items-center gap-1 text-primary text-xs font-semibold">
              عرض الكل <ChevronLeft size={14} />
            </a>
          </div>

          {overviewLoading ? (
            <div className="flex flex-col gap-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-2xl" />
              ))}
            </div>
          ) : recentCases.length === 0 ? (
            <div className="bg-card rounded-2xl p-6 text-center border border-border/50">
              <Briefcase size={32} className="text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">لا توجد قضايا بعد</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentCases.slice(0, 4).map((c: any) => (
                <div key={c.id} className="bg-card rounded-2xl p-4 border border-border/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Scale size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.clientName ?? "—"}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium status-${c.status}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        {!activityLoading && activityItems.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-foreground mb-3">النشاط الأخير</h2>
            <div className="flex flex-col gap-2">
              {activityItems.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-base">
                    {activityIcon[a.type] ?? "📋"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{a.description}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(a.createdAt).toLocaleDateString("ar-SA")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
