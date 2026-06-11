import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowRightLeft, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function fmt(n: number) { return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س"; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A2744] border border-[#2D3D6B] rounded-lg p-3 text-xs shadow-xl" dir="rtl">
      <p className="text-[#C9A84C] font-medium mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="text-white font-medium">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Cashflow() {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["accounting-cashflow"],
    queryFn: () => fetch(`${BASE}/api/accounting/cashflow`).then(r => r.json()),
  });

  const totalIn = data.reduce((s, m) => s + (m.inflow ?? 0), 0);
  const totalOut = data.reduce((s, m) => s + (m.outflow ?? 0), 0);
  const netFlow = totalIn - totalOut;
  const lastBalance = data[data.length - 1]?.balance ?? 0;
  const hasData = data.some(m => m.inflow > 0 || m.outflow > 0);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <ArrowRightLeft className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">التدفقات النقدية</h1>
            <p className="text-xs text-muted-foreground">تتبع حركة السيولة المالية — آخر 12 شهراً</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-sidebar border-sidebar-border"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-green-400"/><p className="text-xs text-muted-foreground">إجمالي الدخل</p></div>
            <p className="text-lg font-bold text-green-400">{fmt(totalIn)}</p>
          </CardContent></Card>
          <Card className="bg-sidebar border-sidebar-border"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-red-400"/><p className="text-xs text-muted-foreground">إجمالي الخروج</p></div>
            <p className="text-lg font-bold text-red-400">{fmt(totalOut)}</p>
          </CardContent></Card>
          <Card className="bg-sidebar border-sidebar-border"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowRightLeft className="h-4 w-4 text-[#C9A84C]"/><p className="text-xs text-muted-foreground">صافي التدفق</p></div>
            <p className={`text-lg font-bold ${netFlow >= 0 ? "text-[#C9A84C]" : "text-red-400"}`}>{fmt(netFlow)}</p>
          </CardContent></Card>
          <Card className="bg-sidebar border-sidebar-border"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-purple-400"/><p className="text-xs text-muted-foreground">الرصيد الحالي</p></div>
            <p className={`text-lg font-bold ${lastBalance >= 0 ? "text-white" : "text-red-400"}`}>{fmt(lastBalance)}</p>
          </CardContent></Card>
        </div>

        {/* Area chart */}
        <Card className="bg-sidebar border-sidebar-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">الرصيد التراكمي</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin ml-2"/>جارٍ التحميل...</div>
            ) : !hasData ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <ArrowRightLeft className="h-10 w-10 mb-2 opacity-20"/>
                <p className="text-sm">لا توجد بيانات بعد</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3D6B" />
                  <XAxis dataKey="month" tick={{ fill: "#9CA3AF", fontSize: 9 }} axisLine={{ stroke: "#2D3D6B" }} tickLine={false} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 9 }} axisLine={{ stroke: "#2D3D6B" }} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? (v / 1000) + "ك" : String(v)} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: "12px", color: "#9CA3AF" }} />
                  <Area type="monotone" dataKey="inflow" name="الدخل" stroke="#10B981" fill="url(#inGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outflow" name="الخروج" stroke="#EF4444" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="balance" name="الرصيد" stroke="#C9A84C" fill="url(#balGrad)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly table */}
        <Card className="bg-sidebar border-sidebar-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white">تفاصيل التدفق الشهري</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-sidebar-border text-muted-foreground text-right">
                  <th className="px-4 py-2 font-medium">الشهر</th>
                  <th className="px-4 py-2 font-medium text-green-400">دخل</th>
                  <th className="px-4 py-2 font-medium text-red-400">خروج</th>
                  <th className="px-4 py-2 font-medium text-[#C9A84C]">صافي</th>
                  <th className="px-4 py-2 font-medium">الرصيد التراكمي</th>
                </tr></thead>
                <tbody>
                  {data.map((m: any) => {
                    const net = m.inflow - m.outflow;
                    return (
                      <tr key={m.month} className="border-b border-sidebar-border/40 hover:bg-sidebar-accent/20">
                        <td className="px-4 py-2.5 text-white">{m.month}</td>
                        <td className="px-4 py-2.5 text-green-400">{fmt(m.inflow)}</td>
                        <td className="px-4 py-2.5 text-red-400">{fmt(m.outflow)}</td>
                        <td className={`px-4 py-2.5 font-bold ${net >= 0 ? "text-[#C9A84C]" : "text-red-400"}`}>{fmt(net)}</td>
                        <td className={`px-4 py-2.5 font-medium ${m.balance >= 0 ? "text-white" : "text-red-400"}`}>{fmt(m.balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
