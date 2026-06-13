import { useQuery } from "@tanstack/react-query";
import {
  Scale, Users, TrendingUp, AlertCircle, ChevronLeft,
  Clock, Briefcase, Bell, Receipt, Plus,
} from "lucide-react";
import { Link } from "wouter";

const API = "/api";
const fetchJson = (p: string) => fetch(`${API}${p}`).then(r => r.json());

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function StatCard({
  label, value, icon: Icon, colorClass, sub, trend,
}: {
  label: string; value: string | number; icon: any;
  colorClass: string; sub?: string; trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-card rounded-2xl p-4 flex flex-col gap-1.5 border border-border/50 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full" style={{
        background: colorClass.includes("blue") ? "#3b82f6"
          : colorClass.includes("amber") ? "#f59e0b"
          : colorClass.includes("green") ? "#22c55e"
          : colorClass.includes("red") ? "#ef4444"
          : "#c9a84c"
      }} />
      <div className="flex items-center justify-between mr-1">
        <span className="text-muted-foreground text-xs font-medium">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground mr-1">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mr-1">{sub}</div>}
    </div>
  );
}

function QuickAction({ icon: Icon, label, href, color }: {
  icon: any; label: string; href: string; color: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-card rounded-2xl p-3 flex flex-col items-center gap-1.5 border border-border/50 tap-effect">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
        <span className="text-[11px] text-muted-foreground font-medium text-center leading-tight">{label}</span>
      </div>
    </Link>
  );
}

const STATUS_LABEL: Record<string, string> = {
  open: "مفتوحة", in_progress: "قيد التنفيذ", closed: "مغلقة",
};
const STATUS_DOT: Record<string, string> = {
  open: "bg-blue-400", in_progress: "bg-amber-400", closed: "bg-green-400",
};

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => fetchJson("/dashboard/stats"),
  });
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => fetchJson("/dashboard/overview"),
  });
  const { data: reminders = [], isLoading: reminderLoading } = useQuery<any[]>({
    queryKey: ["reminders"],
    queryFn: () => fetchJson("/reminders"),
  });

  const kpis = overview?.kpis ?? stats;
  const recentCases: any[] = (overview?.recentCases ?? []).slice(0, 4);
  const dueReminders: any[] = (Array.isArray(reminders) ? reminders : [])
    .filter(r => {
      const dt = r.dueDate ?? r.due_date ?? r.due_at;
      return !r.isDone && !r.isCompleted && dt && new Date(dt) < new Date(Date.now() + 3 * 86400000);
    })
    .sort((a, b) => {
      const da = a.dueDate ?? a.due_date ?? a.due_at;
      const db = b.dueDate ?? b.due_date ?? b.due_at;
      return new Date(da).getTime() - new Date(db).getTime();
    })
    .slice(0, 3);

  return (
    <div className="p-4 space-y-5" dir="rtl">

      {/* KPI Grid */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">نظرة عامة</h2>
        {statsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="القضايا النشطة"
              value={kpis?.activeCases ?? kpis?.total_cases ?? 0}
              icon={Scale}
              colorClass="bg-blue-500/20 text-blue-400"
              sub="قضية مفتوحة"
            />
            <StatCard
              label="العملاء"
              value={kpis?.totalClients ?? kpis?.total_clients ?? 0}
              icon={Users}
              colorClass="bg-violet-500/20 text-violet-400"
              sub="عميل مسجّل"
            />
            <StatCard
              label="الإيرادات"
              value={`${((kpis?.totalRevenue ?? kpis?.total_revenue ?? 0) / 100).toLocaleString("ar-SA")} ر.س`}
              icon={TrendingUp}
              colorClass="bg-green-500/20 text-green-400"
              sub="إجمالي الشهر"
            />
            <StatCard
              label="الفواتير المعلقة"
              value={kpis?.pendingInvoices ?? kpis?.pending_invoices ?? 0}
              icon={Receipt}
              colorClass="bg-amber-500/20 text-amber-400"
              sub="فاتورة غير مسدودة"
            />
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">وصول سريع</h2>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction icon={Scale}     label="القضايا"    href="/cases"     color="bg-blue-500/20 text-blue-400" />
          <QuickAction icon={Users}     label="العملاء"    href="/clients"   color="bg-violet-500/20 text-violet-400" />
          <QuickAction icon={Receipt}   label="الفواتير"   href="/invoices"  color="bg-green-500/20 text-green-400" />
          <QuickAction icon={Bell}      label="التذكيرات"  href="/reminders" color="bg-rose-500/20 text-rose-400" />
        </div>
      </section>

      {/* Quick Create */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">إنشاء سريع</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/new-case">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-3 tap-effect">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <Plus size={18} className="text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">قضية جديدة</div>
                <div className="text-[11px] text-muted-foreground">أضف قضية</div>
              </div>
            </div>
          </Link>
          <Link href="/new-client">
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 flex items-center gap-3 tap-effect">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                <Plus size={18} className="text-violet-400" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">موكل جديد</div>
                <div className="text-[11px] text-muted-foreground">أضف موكلاً</div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Upcoming Reminders */}
      {!reminderLoading && dueReminders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">تذكيرات قريبة</h2>
            <Link href="/reminders">
              <span className="text-[11px] text-primary flex items-center gap-0.5 tap-effect">
                الكل <ChevronLeft size={12} />
              </span>
            </Link>
          </div>
          <div className="space-y-2">
            {dueReminders.map((r: any) => {
              const isOverdue = new Date(r.due_at) < new Date();
              return (
                <div key={r.id} className={`bg-card rounded-xl px-4 py-3 border flex items-center gap-3 ${
                  isOverdue ? "border-red-500/30 bg-red-500/5" : "border-border/50"
                }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isOverdue ? "bg-red-500/20" : "bg-amber-500/20"
                  }`}>
                    {isOverdue
                      ? <AlertCircle size={15} className="text-red-400" />
                      : <Clock size={15} className="text-amber-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r.title}</div>
                    <div className={`text-[11px] ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                      {new Date(r.dueDate ?? r.due_date ?? r.due_at).toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
                      {isOverdue && " · متأخر"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent Cases */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">آخر القضايا</h2>
          <Link href="/cases">
            <span className="text-[11px] text-primary flex items-center gap-0.5 tap-effect">
              الكل <ChevronLeft size={12} />
            </span>
          </Link>
        </div>
        {overviewLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : recentCases.length === 0 ? (
          <div className="bg-card rounded-2xl p-6 border border-border/50 text-center">
            <Briefcase size={28} className="text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">لا توجد قضايا حتى الآن</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentCases.map((c: any) => (
              <div key={c.id} className="bg-card rounded-xl px-4 py-3 border border-border/50 flex items-center gap-3 tap-effect">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Scale size={14} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{c.title}</div>
                  <div className="text-[11px] text-muted-foreground">{c.clientName ?? c.client_name ?? ""}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status] ?? "bg-muted"}`} />
                  <span className="text-[11px] text-muted-foreground">{STATUS_LABEL[c.status] ?? c.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="h-2" />
    </div>
  );
}
