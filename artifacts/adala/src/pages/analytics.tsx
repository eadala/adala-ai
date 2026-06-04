import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";
import { TrendingUp, Scale, FileText, Users, DollarSign, Clock, Award, Target, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = ["#C9A84C", "#6366F1", "#10B981", "#3B82F6", "#EC4899", "#F59E0B"];

const monthlyData = [
  { month: "يناير", قضايا: 8, عقود: 12, عملاء: 5 },
  { month: "فبراير", قضايا: 12, عقود: 8, عملاء: 8 },
  { month: "مارس", قضايا: 15, عقود: 15, عملاء: 10 },
  { month: "أبريل", قضايا: 10, عقود: 20, عملاء: 7 },
  { month: "مايو", قضايا: 18, عقود: 14, عملاء: 12 },
  { month: "يونيو", قضايا: 22, عقود: 18, عملاء: 15 },
];

const revenueData = [
  { month: "يناير", الإيرادات: 45000, المصروفات: 28000 },
  { month: "فبراير", الإيرادات: 52000, المصروفات: 30000 },
  { month: "مارس", الإيرادات: 61000, المصروفات: 32000 },
  { month: "أبريل", الإيرادات: 48000, المصروفات: 29000 },
  { month: "مايو", الإيرادات: 75000, المصروفات: 35000 },
  { month: "يونيو", الإيرادات: 88000, المصروفات: 38000 },
];

const aiUsageData = [
  { name: "تحليل قضايا", value: 35 },
  { name: "توليد عقود", value: 25 },
  { name: "مراجعة مستندات", value: 20 },
  { name: "محاكي الخصم", value: 10 },
  { name: "البحث القانوني", value: 10 },
];

const casesByType = [
  { name: "مدني", value: 30 },
  { name: "تجاري", value: 25 },
  { name: "عمالي", value: 20 },
  { name: "عقاري", value: 15 },
  { name: "أسري", value: 10 },
];

const successRateData = [
  { month: "يناير", نسبة: 72 },
  { month: "فبراير", نسبة: 68 },
  { month: "مارس", نسبة: 78 },
  { month: "أبريل", نسبة: 75 },
  { month: "مايو", نسبة: 82 },
  { month: "يونيو", نسبة: 85 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1A2744] border border-[#2D3D6B] rounded-xl p-3 text-xs shadow-xl">
      <p className="font-bold text-primary mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{typeof p.value === "number" && p.value > 1000 ? p.value.toLocaleString("ar-SA") : p.value}{p.name === "نسبة" ? "%" : ""}</span>
        </div>
      ))}
    </div>
  );
};

function KPICard({ icon: Icon, label, value, sub, color, trend }: any) {
  return (
    <Card className="border-0 bg-card/50 hover:bg-card transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          {trend && (
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30 bg-emerald-400/10">
              ↑ {trend}
            </Badge>
          )}
        </div>
        <div className="text-2xl font-black mb-0.5" style={{ color }}>{value}</div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const { data: cases = [] } = useQuery<any[]>({ queryKey: ["cases"], queryFn: () => fetch("/api/cases").then(r => r.json()) });
  const { data: contracts = [] } = useQuery<any[]>({ queryKey: ["contracts"], queryFn: () => fetch("/api/contracts").then(r => r.json()) });
  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["clients"], queryFn: () => fetch("/api/clients").then(r => r.json()) });
  const { data: arbitration = [] } = useQuery<any[]>({ queryKey: ["arbitration"], queryFn: () => fetch("/api/arbitration/cases").then(r => r.json()) });

  const activeCases = cases.filter((c: any) => c.status === "active").length;
  const closedCases = cases.filter((c: any) => c.status === "closed").length;
  const successRate = cases.length > 0 ? Math.round((closedCases / cases.length) * 100) : 85;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">تحليلات الأداء</h1>
        <p className="text-muted-foreground text-sm">إحصاءات ومؤشرات أداء المكتب القانوني</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard icon={Scale} label="إجمالي القضايا" value={cases.length || 24} sub={`${activeCases || 18} نشطة`} color="#6366F1" trend="12%" />
        <KPICard icon={FileText} label="العقود المُبرمة" value={contracts.length || 15} sub={`${contracts.filter((c: any) => c.status === "signed").length || 8} موقّعة`} color="#C9A84C" trend="8%" />
        <KPICard icon={Users} label="العملاء" value={clients.length || 32} sub={`${clients.filter((c: any) => c.status === "active").length || 28} نشط`} color="#10B981" trend="15%" />
        <KPICard icon={Award} label="نسبة النجاح" value={`${successRate || 85}%`} sub="متوسط الفوز بالقضايا" color="#F59E0B" trend="5%" />
      </div>

      <Tabs defaultValue="activity">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="activity">النشاط الشهري</TabsTrigger>
          <TabsTrigger value="financial">المالية</TabsTrigger>
          <TabsTrigger value="ai">استخدام الذكاء الاصطناعي</TabsTrigger>
          <TabsTrigger value="performance">الأداء</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> النشاط الشهري
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyData} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D3D6B" />
                    <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 10 }} />
                    <YAxis tick={{ fill: "#A0ADB8", fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="قضايا" fill="#6366F1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="عقود" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="عملاء" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">توزيع القضايا حسب النوع</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={casesByType} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {casesByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {casesByType.map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="font-bold">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "متوسط مدة القضية", value: "4.2 شهر", icon: Clock, color: "#3B82F6" },
              { label: "قضايا التحكيم", value: arbitration.length || 3, icon: Scale, color: "#8B5CF6" },
              { label: "أتعاب الشهر", value: "88,000 ر", icon: DollarSign, color: "#C9A84C" },
              { label: "العملاء الجدد", value: "15", icon: Users, color: "#10B981" },
            ].map(k => (
              <Card key={k.label} className="border-0 bg-card/50">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${k.color}15` }}>
                    <k.icon className="h-4 w-4" style={{ color: k.color }} />
                  </div>
                  <div>
                    <div className="text-sm font-black" style={{ color: k.color }}>{k.value}</div>
                    <div className="text-[10px] text-muted-foreground">{k.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="financial" className="mt-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" /> الإيرادات والمصروفات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3D6B" />
                  <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#A0ADB8", fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="الإيرادات" stroke="#C9A84C" fill="url(#revGrad)" strokeWidth={2} dot={{ fill: "#C9A84C", r: 4 }} />
                  <Area type="monotone" dataKey="المصروفات" stroke="#EF4444" fill="url(#expGrad)" strokeWidth={2} dot={{ fill: "#EF4444", r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: "إجمالي الإيرادات", value: "369,000 ر", color: "#C9A84C" },
                  { label: "إجمالي المصروفات", value: "192,000 ر", color: "#EF4444" },
                  { label: "صافي الأرباح", value: "177,000 ر", color: "#10B981" },
                ].map(f => (
                  <div key={f.label} className="text-center p-3 bg-muted/30 rounded-xl">
                    <div className="text-base font-black" style={{ color: f.color }}>{f.value}</div>
                    <div className="text-[10px] text-muted-foreground">{f.label}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">توزيع استخدام الذكاء الاصطناعي</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={aiUsageData} cx="50%" cy="50%" outerRadius={80} dataKey="value" paddingAngle={3}>
                        {aiUsageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2.5">
                    {aiUsageData.map((item, i) => (
                      <div key={item.name}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                            <span>{item.name}</span>
                          </div>
                          <span className="font-bold">{item.value}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${item.value}%`, background: COLORS[i] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">إحصاءات الذكاء الاصطناعي</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "إجمالي الطلبات هذا الشهر", value: "1,247 طلب", icon: BarChart3, color: "#6366F1" },
                  { label: "متوسط وقت الاستجابة", value: "1.8 ثانية", icon: Clock, color: "#10B981" },
                  { label: "دقة التحليل القانوني", value: "92.4%", icon: Target, color: "#C9A84C" },
                  { label: "العقود المُولَّدة تلقائياً", value: "38 عقد", icon: FileText, color: "#3B82F6" },
                  { label: "القضايا المحلّلة", value: "156 قضية", icon: Scale, color: "#8B5CF6" },
                  { label: "التوفير في الوقت", value: "320 ساعة", icon: TrendingUp, color: "#F59E0B" },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-xl">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                      <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                    </div>
                    <span className="text-xs flex-1">{s.label}</span>
                    <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" /> نسبة نجاح القضايا
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={successRateData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D3D6B" />
                    <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 10 }} />
                    <YAxis domain={[50, 100]} tick={{ fill: "#A0ADB8", fontSize: 10 }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="نسبة" stroke="#10B981" strokeWidth={2.5} dot={{ fill: "#10B981", r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">مؤشرات الأداء الرئيسية</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: "رضا العملاء", value: 94, color: "#10B981" },
                  { label: "الالتزام بالمواعيد", value: 88, color: "#6366F1" },
                  { label: "جودة العقود", value: 91, color: "#C9A84C" },
                  { label: "استخدام الذكاء الاصطناعي", value: 76, color: "#3B82F6" },
                  { label: "إنجاز القضايا في الوقت المحدد", value: 82, color: "#F59E0B" },
                ].map(kpi => (
                  <div key={kpi.label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span>{kpi.label}</span>
                      <span className="font-black" style={{ color: kpi.color }}>{kpi.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${kpi.value}%`, background: `linear-gradient(90deg, ${kpi.color}80, ${kpi.color})` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
