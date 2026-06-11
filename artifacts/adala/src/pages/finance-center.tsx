import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, DollarSign, Receipt, AlertTriangle, Clock,
  ChevronLeft, BarChart2, Wallet, Landmark, ArrowRightLeft, BrainCircuit,
  ArrowUpRight, ArrowDownRight, Printer,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const COLORS = ["#C9A84C","#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#F97316"];

function fmtSAR(n: number) {
  const riyals = n / 100;
  if (riyals >= 1_000_000) return (riyals / 1_000_000).toFixed(1) + "م ر.س";
  if (riyals >= 1_000) return (riyals / 1_000).toFixed(0) + "ك ر.س";
  return riyals.toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س";
}

function fmtRaw(n: number) {
  const riyals = n / 100;
  return riyals.toLocaleString("ar-SA", { maximumFractionDigits: 2 });
}

function KpiCard({ title, value, sub, icon: Icon, colorClass, trend, link }: {
  title: string; value: string; sub?: string; icon: any;
  colorClass: string; trend?: number; link?: string;
}) {
  const content = (
    <Card className={`bg-sidebar border-sidebar-border hover:border-[#C9A84C]/30 transition-all duration-200 ${link ? "cursor-pointer" : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          {trend !== undefined && (
            <Badge variant="outline" className={trend >= 0 ? "border-green-500/30 text-green-400 bg-green-500/5" : "border-red-500/30 text-red-400 bg-red-500/5"}>
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3 ml-0.5" /> : <ArrowDownRight className="h-3 w-3 ml-0.5" />}
              {Math.abs(trend).toFixed(1)}%
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs mb-1">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
  return link ? <Link href={link}>{content}</Link> : content;
}

const QUICK_LINKS = [
  { href: "/invoices",           label: "الفواتير",          icon: Receipt,        color: "bg-blue-500/15 text-blue-400" },
  { href: "/collections",        label: "التحصيل",           icon: DollarSign,     color: "bg-green-500/15 text-green-400" },
  { href: "/expenses",           label: "المصروفات",         icon: TrendingDown,   color: "bg-red-500/15 text-red-400" },
  { href: "/revenues",           label: "الإيرادات",         icon: TrendingUp,     color: "bg-emerald-500/15 text-emerald-400" },
  { href: "/advances",           label: "طلبات الصرف",       icon: Wallet,         color: "bg-violet-500/15 text-violet-400" },
  { href: "/cashflow",           label: "التدفق النقدي",     icon: ArrowRightLeft,  color: "bg-cyan-500/15 text-cyan-400" },
  { href: "/bank-accounts",      label: "الحسابات البنكية",  icon: Landmark,       color: "bg-amber-500/15 text-amber-400" },
  { href: "/financial-reports",  label: "التقارير المالية",  icon: BarChart2,      color: "bg-orange-500/15 text-orange-400" },
  { href: "/financial-intelligence", label: "الذكاء المالي", icon: BrainCircuit,   color: "bg-pink-500/15 text-pink-400" },
];

export default function FinanceCenter() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["finance-dashboard"],
    queryFn: () => fetch(`${BASE}/api/finance/dashboard`).then(r => r.json()),
    staleTime: 2 * 60 * 1000,
  });

  const kpi = data?.kpi ?? {};
  const monthly: any[] = data?.monthly ?? [];
  const expCats: any[] = data?.expenseCategories ?? [];
  const revCats: any[] = data?.revenueCategories ?? [];

  const profit = (kpi.totalRevenue ?? 0) - (kpi.totalExpenses ?? 0);
  const margin = kpi.profitMargin ?? 0;

  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-[#C9A84C]" />
            مركز المالية
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">نظرة شاملة على الوضع المالي للمكتب</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 print:hidden">
          <Printer className="h-4 w-4" /> تصدير PDF
        </Button>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="إجمالي الإيرادات"
            value={fmtSAR(kpi.totalRevenue ?? 0)}
            icon={TrendingUp}
            colorClass="bg-emerald-500/20 text-emerald-400"
            trend={margin}
          />
          <KpiCard
            title="إجمالي المصروفات"
            value={fmtSAR(kpi.totalExpenses ?? 0)}
            icon={TrendingDown}
            colorClass="bg-red-500/20 text-red-400"
          />
          <KpiCard
            title="صافي الربح"
            value={fmtSAR(profit)}
            sub={`هامش الربح: ${margin}%`}
            icon={DollarSign}
            colorClass={profit >= 0 ? "bg-[#C9A84C]/20 text-[#C9A84C]" : "bg-red-500/20 text-red-400"}
          />
          <KpiCard
            title="الفواتير المدفوعة"
            value={fmtSAR(kpi.paidInvoices?.amount ?? 0)}
            sub={`${kpi.paidInvoices?.count ?? 0} فاتورة مدفوعة`}
            icon={Receipt}
            colorClass="bg-green-500/20 text-green-400"
            link="/invoices"
          />
          <KpiCard
            title="الفواتير المتأخرة"
            value={fmtSAR(kpi.overdueInvoices?.amount ?? 0)}
            sub={`${kpi.overdueInvoices?.count ?? 0} فاتورة متأخرة`}
            icon={AlertTriangle}
            colorClass="bg-red-500/20 text-red-400"
            link="/collections"
          />
          <KpiCard
            title="فواتير قيد التحصيل"
            value={fmtSAR(kpi.pendingInvoices?.amount ?? 0)}
            sub={`${kpi.pendingInvoices?.count ?? 0} فاتورة معلقة`}
            icon={Clock}
            colorClass="bg-amber-500/20 text-amber-400"
            link="/collections"
          />
          <KpiCard
            title="طلبات صرف معلقة"
            value={String(kpi.pendingAdvances ?? 0)}
            sub="طلب بانتظار موافقة"
            icon={Wallet}
            colorClass="bg-violet-500/20 text-violet-400"
            link="/advances"
          />
          <KpiCard
            title="سلف مستحقة"
            value={fmtSAR(kpi.outstandingAdvances ?? 0)}
            sub="إجمالي السلف القائمة"
            icon={Landmark}
            colorClass="bg-orange-500/20 text-orange-400"
            link="/advances"
          />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly Chart — spans 2 cols */}
        <Card className="lg:col-span-2 bg-sidebar border-sidebar-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">الأداء المالي الشهري</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.4)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? (v/1000).toFixed(0)+"ك" : String(v)} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", direction: "rtl" }}
                    formatter={(v: number, name: string) => [`${fmtRaw(v)} ر.س`, name === "revenue" ? "الإيرادات" : name === "expenses" ? "المصروفات" : "الربح"]}
                  />
                  <Legend formatter={v => v === "revenue" ? "الإيرادات" : v === "expenses" ? "المصروفات" : "صافي الربح"} />
                  <Bar dataKey="revenue"  fill="#10B981" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="expenses" fill="#EF4444" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="profit"   fill="#C9A84C" radius={[4,4,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Expense Categories Pie */}
        <Card className="bg-sidebar border-sidebar-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">تصنيف المصروفات</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : expCats.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={expCats} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                      {expCats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${fmtRaw(v)} ر.س`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {expCats.slice(0, 5).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{c.name}</span>
                      </div>
                      <span className="font-medium">{fmtSAR(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Grid */}
      <Card className="bg-sidebar border-sidebar-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">الوصول السريع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
            {QUICK_LINKS.map(({ href, label, icon: Icon, color }) => (
              <Link key={href} href={href}>
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/40 hover:border-[#C9A84C]/30 hover:bg-muted/30 transition-all cursor-pointer group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] text-muted-foreground group-hover:text-foreground text-center leading-tight transition-colors">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
