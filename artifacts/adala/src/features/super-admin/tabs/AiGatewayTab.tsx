/**
 * AI Gateway Tab — لوحة تحكم مزودي الذكاء الاصطناعي
 * ────────────────────────────────────────────────────
 * 4 تبويبات:
 *   المزودون   — حالة كل مزود، تفعيل/تعطيل، تكلفة، أولوية
 *   الإحصائيات — مخططات الاستخدام، التكلفة، التوزيع على النماذج
 *   توزيع الخدمة — جدول المكاتب وكيفية استخدام كل منها للذكاء
 *   التوجيه الذكي — قواعد التوجيه حسب نوع المهمة
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu, Zap, Brain, Settings, BarChart3, Globe2, Network,
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Edit2,
  TrendingUp, TrendingDown, ArrowUpRight, Loader2,
  Sparkles, Bot, ChevronRight, Shield, Activity,
  DollarSign, Clock, Server, Layers, Route, Info,
} from "lucide-react";
import { Button }                 from "@/components/ui/button";
import { Badge }                  from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch }                 from "@/components/ui/switch";
import { Input }                  from "@/components/ui/input";
import { Label }                  from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast }               from "@/hooks/use-toast";
import { cn }                     from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { API, useAdmin }          from "../shared/api";

/* ── helpers ─────────────────────────────────────────────────────── */
const fmt = (n: any) => Number(n ?? 0).toLocaleString("ar-SA");
const fmtSar = (n: any) => `${Number(n ?? 0).toFixed(4)} ﷼`;
const fmtMs  = (n: any) => `${Number(n ?? 0).toFixed(0)} ms`;

const PROVIDER_META: Record<string, { color: string; icon: any; desc: string }> = {
  gemini:   { color: "#4285F4", icon: Sparkles, desc: "Gemini 2.5 Flash — سريع ومجاني" },
  claude:   { color: "#D97706", icon: Brain,    desc: "Claude 3.5 Haiku — دقيق وموثوق" },
  openai:   { color: "#10A37F", icon: Bot,      desc: "GPT-4o mini — شامل وقوي" },
  deepseek: { color: "#6366F1", icon: Cpu,      desc: "DeepSeek — اقتصادي وكفء" },
  ollama:   { color: "#6B7280", icon: Server,   desc: "Ollama — نموذج محلي" },
};

const MODEL_COLORS = ["#4285F4","#D97706","#10A37F","#6366F1","#6B7280","#EF4444"];

const TASK_LABELS: Record<string, string> = {
  contract_draft:  "صياغة عقود",
  contract_review: "مراجعة عقود",
  document_draft:  "إعداد وثائق",
  case_analysis:   "تحليل قضايا",
  legal_research:  "بحث قانوني",
  opponent_sim:    "محاكاة الخصم",
  legal_assistant: "مساعد قانوني",
  summary:         "ملخصات",
  custom:          "مخصص",
};

async function aiApi(path: string, opts?: RequestInit) {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const { _getToken } = await import("../shared/api");
  const token = _getToken ? await _getToken() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { headers, ...opts });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

/* ══════════════════════════════════════════════════════════════════
   SUB-TAB 1 — المزودون
══════════════════════════════════════════════════════════════════ */
function ProvidersTab({ qc }: any) {
  const { toast } = useToast();
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm] = useState<any>({});

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-gateway", "providers"],
    queryFn:  () => aiApi("/ai/gateway/providers"),
    retry: false,
  });

  const updateMut = useMutation({
    mutationFn: ({ provider, body }: any) =>
      aiApi(`/ai/gateway/providers/${provider}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "تم الحفظ" }); refetch(); setEdit(null); },
    onError:   (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const providers: any[] = data?.providers ?? [];

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">مزودو الذكاء الاصطناعي</h3>
          <p className="text-xs text-muted-foreground mt-0.5">إدارة المزودين المتاحين وإعدادات التكلفة والأولوية</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 ml-1" /> تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {providers.map((p: any) => {
          const meta = PROVIDER_META[p.provider] ?? { color: "#6B7280", icon: Cpu, desc: "" };
          const Icon = meta.icon;
          return (
            <Card key={p.provider} className={cn("border transition-all", p.enabled ? "border-border" : "border-border/40 opacity-60")}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}15` }}>
                      <Icon className="h-4.5 w-4.5" style={{ color: meta.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{p.label_ar || p.provider}</p>
                      <p className="text-[11px] text-muted-foreground">{p.model_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!p.enabled}
                      onCheckedChange={v => updateMut.mutate({ provider: p.provider, body: { enabled: v } })}
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEdit(p); setForm({ priority: p.priority, cost_per_token: p.cost_per_token, monthly_limit: p.monthly_limit ?? "", notes: p.notes ?? "" }); }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground mb-3">{meta.desc}</p>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/40 rounded-lg p-1.5">
                    <p className="text-[10px] text-muted-foreground">الأولوية</p>
                    <p className="text-sm font-bold">#{p.priority}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-1.5">
                    <p className="text-[10px] text-muted-foreground">تكلفة/رمز</p>
                    <p className="text-xs font-mono font-bold">{Number(p.cost_per_token).toFixed(5)}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-1.5">
                    <p className="text-[10px] text-muted-foreground">الحالة</p>
                    {p.enabled
                      ? <Badge className="text-[9px] px-1 py-0 bg-emerald-500/10 text-emerald-400 border-0">مفعّل</Badge>
                      : <Badge className="text-[9px] px-1 py-0 bg-red-500/10 text-red-400 border-0">معطّل</Badge>
                    }
                  </div>
                </div>

                {p.monthly_limit && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>الاستخدام الشهري</span>
                      <span>{fmt(p.current_usage)} / {fmt(p.monthly_limit)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (p.current_usage / p.monthly_limit) * 100)}%`, background: meta.color }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit */}
      <AdaptiveDialog open={!!edit} onOpenChange={v => !v && setEdit(null)}>
        <AdaptiveDialogContent>
          <DialogHeader>
            <DialogTitle>تعديل مزود: {edit?.label_ar}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">الأولوية (1 = الأعلى)</Label>
                <Input type="number" min="1" max="10" value={form.priority ?? ""} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">تكلفة الرمز (بالريال)</Label>
                <Input type="number" step="0.000001" value={form.cost_per_token ?? ""} onChange={e => setForm((f: any) => ({ ...f, cost_per_token: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">الحد الشهري (اتركه فارغاً للا محدود)</Label>
              <Input type="number" value={form.monthly_limit ?? ""} onChange={e => setForm((f: any) => ({ ...f, monthly_limit: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">ملاحظات</Label>
              <Input value={form.notes ?? ""} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>إلغاء</Button>
            <Button onClick={() => updateMut.mutate({ provider: edit.provider, body: form })} disabled={updateMut.isPending}>
              {updateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SUB-TAB 2 — الإحصائيات
══════════════════════════════════════════════════════════════════ */
function AnalyticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-gateway", "cost-analytics"],
    queryFn:  () => aiApi("/ai/gateway/cost-analytics"),
    retry: false,
  });

  const daily:   any[] = data?.daily   ?? [];
  const totals:  any   = data?.totals  ?? {};
  const byModel: any[] = data?.byModel ?? [];

  const modelPieData = byModel.map((m: any, i: number) => ({
    name: m.model_used,
    value: Number(m.cnt),
    color: MODEL_COLORS[i % MODEL_COLORS.length],
  }));

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "إجمالي الطلبات", value: fmt(totals.total_requests), icon: Activity, color: "#4285F4" },
          { label: "التكلفة (نقاط)", value: fmt(totals.total_points),   icon: Zap,      color: "#D97706" },
          { label: "متوسط الاستجابة", value: fmtMs(totals.avg_latency), icon: Clock,    color: "#10A37F" },
          { label: "نسبة الكاش",    value: `${totals.total_requests > 0 ? Math.round(totals.cache_hits / totals.total_requests * 100) : 0}%`, icon: Shield, color: "#6366F1" },
          { label: "المكاتب النشطة", value: fmt(totals.active_offices), icon: Globe2,   color: "#EC4899" },
          { label: "التكلفة SAR",    value: fmtSar(totals.total_sar),   icon: DollarSign, color: "#10B981" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <k.icon className="h-3.5 w-3.5" style={{ color: k.color }} />
                <span className="text-[10px] text-muted-foreground">{k.label}</span>
              </div>
              <p className="text-lg font-black" style={{ color: k.color }}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Requests Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">الطلبات اليومية (30 يوم)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={daily.map(d => ({ ...d, day: String(d.day).slice(5), requests: Number(d.requests), cost: Number(d.points) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="requests" stroke="#4285F4" fill="#4285F420" name="طلبات" />
                <Area type="monotone" dataKey="cost" stroke="#D97706" fill="#D9770620" name="نقاط" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Model Distribution Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">توزيع النماذج</CardTitle>
          </CardHeader>
          <CardContent>
            {modelPieData.length === 0
              ? <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">لا توجد بيانات</div>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={modelPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {modelPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              )
            }
            <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
              {modelPieData.map(m => (
                <span key={m.name} className="text-[10px] flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: m.color }} />
                  {m.name}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model breakdown table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">تفاصيل الاستخدام حسب النموذج</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">النموذج</TableHead>
                <TableHead className="text-xs text-center">الطلبات</TableHead>
                <TableHead className="text-xs text-center">النقاط</TableHead>
                <TableHead className="text-xs text-center">النسبة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byModel.map((m: any) => {
                const total = byModel.reduce((s: number, x: any) => s + Number(x.cnt), 0);
                const pct   = total > 0 ? Math.round(Number(m.cnt) / total * 100) : 0;
                const meta  = PROVIDER_META[m.model_used];
                return (
                  <TableRow key={m.model_used}>
                    <TableCell className="text-xs font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: meta?.color ?? "#6B7280" }} />
                        {m.model_used}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-center">{fmt(m.cnt)}</TableCell>
                    <TableCell className="text-xs text-center">{fmt(m.pts)}</TableCell>
                    <TableCell className="text-xs text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta?.color ?? "#6B7280" }} />
                        </div>
                        <span>{pct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SUB-TAB 3 — توزيع الخدمة
══════════════════════════════════════════════════════════════════ */
function ServiceDistributionTab() {
  const [editOffice, setEditOffice] = useState<any>(null);
  const [form, setForm]             = useState<any>({});
  const { toast }                   = useToast();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-gateway", "distribution"],
    queryFn:  () => aiApi("/ai/gateway/service-distribution"),
    retry: false,
  });

  const updateMut = useMutation({
    mutationFn: ({ officeId, body }: any) =>
      aiApi(`/ai/gateway/office-settings/${officeId}`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "تم تحديث إعدادات المكتب" }); refetch(); setEditOffice(null); },
    onError:   (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const dist: any[] = data?.distribution ?? [];

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">توزيع خدمة الذكاء الاصطناعي على المكاتب</h3>
          <p className="text-xs text-muted-foreground">الطلبات الـ 30 يوم الماضية — قابل للإدارة لكل مكتب</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 ml-1" /> تحديث
        </Button>
      </div>

      {dist.length === 0
        ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Activity className="h-8 w-8 opacity-30" />
            <p className="text-sm">لا توجد بيانات استخدام بعد</p>
          </div>
        )
        : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">المكتب</TableHead>
                    <TableHead className="text-xs text-center">الطلبات</TableHead>
                    <TableHead className="text-xs text-center hidden md:table-cell">Gemini</TableHead>
                    <TableHead className="text-xs text-center hidden md:table-cell">Claude</TableHead>
                    <TableHead className="text-xs text-center hidden md:table-cell">OpenAI</TableHead>
                    <TableHead className="text-xs text-center hidden lg:table-cell">الكاش %</TableHead>
                    <TableHead className="text-xs text-center hidden lg:table-cell">متوسط ms</TableHead>
                    <TableHead className="text-xs text-center">المزود المفضل</TableHead>
                    <TableHead className="text-xs text-center">الرصيد</TableHead>
                    <TableHead className="text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dist.map((d: any) => {
                    const total    = Number(d.total_requests);
                    const cacheHit = total > 0 ? Math.round(Number(d.cache_hits) / total * 100) : 0;
                    return (
                      <TableRow key={d.office_id}>
                        <TableCell className="text-xs font-mono max-w-[120px] truncate">{d.office_id}</TableCell>
                        <TableCell className="text-xs text-center font-bold">{fmt(total)}</TableCell>
                        <TableCell className="text-xs text-center hidden md:table-cell text-blue-400">{fmt(d.gemini_count)}</TableCell>
                        <TableCell className="text-xs text-center hidden md:table-cell text-amber-400">{fmt(d.claude_count)}</TableCell>
                        <TableCell className="text-xs text-center hidden md:table-cell text-emerald-400">{fmt(d.openai_count)}</TableCell>
                        <TableCell className="text-xs text-center hidden lg:table-cell">{cacheHit}%</TableCell>
                        <TableCell className="text-xs text-center hidden lg:table-cell">{fmtMs(d.avg_latency)}</TableCell>
                        <TableCell className="text-xs text-center">
                          <Badge variant="outline" className="text-[10px] px-1.5">{d.preferred_provider ?? "auto"}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <span className={cn("font-bold", Number(d.credit_balance) > 20 ? "text-emerald-400" : "text-red-400")}>
                            {d.credit_balance ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]"
                            onClick={() => { setEditOffice(d); setForm({ preferred_provider: d.preferred_provider ?? "auto", mode: d.mode ?? "balanced", smart_routing: d.smart_routing !== false }); }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      }

      {/* Edit Office */}
      <AdaptiveDialog open={!!editOffice} onOpenChange={v => !v && setEditOffice(null)}>
        <AdaptiveDialogContent>
          <DialogHeader>
            <DialogTitle>إعدادات مكتب: <span className="font-mono text-sm">{editOffice?.office_id}</span></DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">المزود المفضل</Label>
              <Select value={form.preferred_provider} onValueChange={v => setForm((f: any) => ({ ...f, preferred_provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">تلقائي (موصى به)</SelectItem>
                  <SelectItem value="gemini">Gemini Flash</SelectItem>
                  <SelectItem value="claude">Claude Haiku</SelectItem>
                  <SelectItem value="openai">GPT-4o mini</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">وضع الأداء</Label>
              <Select value={form.mode} onValueChange={v => setForm((f: any) => ({ ...f, mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fast">⚡ سريع — أولوية السرعة والتكلفة</SelectItem>
                  <SelectItem value="balanced">⚖️ متوازن — جودة مع كفاءة (افتراضي)</SelectItem>
                  <SelectItem value="accurate">🧠 دقيق — أعلى جودة بأي تكلفة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">التوجيه الذكي</Label>
                <p className="text-[11px] text-muted-foreground">يوجّه كل مهمة قانونية للنموذج الأنسب لها</p>
              </div>
              <Switch checked={!!form.smart_routing} onCheckedChange={v => setForm((f: any) => ({ ...f, smart_routing: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOffice(null)}>إلغاء</Button>
            <Button onClick={() => updateMut.mutate({ officeId: editOffice.office_id, body: form })} disabled={updateMut.isPending}>
              {updateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SUB-TAB 4 — التوجيه الذكي
══════════════════════════════════════════════════════════════════ */
function SmartRoutingTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-gateway", "routing-rules"],
    queryFn:  () => aiApi("/ai/gateway/routing-rules"),
    retry: false,
  });

  const rules:        Record<string, string[]>  = data?.rules        ?? {};
  const modeProviders: Record<string, string[]> = data?.modeProviders ?? {};

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl">
        <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-blue-400">محرك التوجيه الذكي</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            يُحلل المنصة نوع كل مهمة قانونية ويوجّهها تلقائياً للنموذج الأنسب لها — مع مراعاة إعدادات المكتب وتوفر المفاتيح.
            القواعد مرتبة حسب الأولوية: النموذج الأول هو المفضل وما يليه احتياطي.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Task Routing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Route className="h-4 w-4 text-violet-400" /> التوجيه حسب نوع المهمة
            </CardTitle>
            <CardDescription className="text-xs">أولوية النماذج لكل نوع مهمة قانونية</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {Object.entries(rules).map(([task, providers]) => (
                <div key={task} className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
                  <div className="text-xs font-medium w-28 text-muted-foreground">{TASK_LABELS[task] ?? task}</div>
                  <div className="flex items-center gap-1 flex-1">
                    {(providers as string[]).map((p, i) => {
                      const meta = PROVIDER_META[p];
                      return (
                        <span key={p} className="flex items-center gap-0.5">
                          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0.5 border font-semibold"
                            style={{ color: meta?.color, borderColor: `${meta?.color}40` }}
                          >
                            {p}
                          </Badge>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Mode Routing */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-amber-400" /> التوجيه حسب وضع الأداء
            </CardTitle>
            <CardDescription className="text-xs">أولوية النماذج لكل وضع تشغيل</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(modeProviders).map(([mode, providers]) => {
                const modeLabels: Record<string, { label: string; color: string; icon: string }> = {
                  fast:      { label: "⚡ سريع",    color: "#10B981", icon: "⚡" },
                  balanced:  { label: "⚖️ متوازن", color: "#4285F4", icon: "⚖️" },
                  accurate:  { label: "🧠 دقيق",    color: "#8B5CF6", icon: "🧠" },
                };
                const ml = modeLabels[mode] ?? { label: mode, color: "#6B7280" };
                return (
                  <div key={mode} className="p-3 rounded-xl border border-border/60">
                    <p className="text-xs font-bold mb-2" style={{ color: ml.color }}>{ml.label}</p>
                    <div className="flex flex-wrap items-center gap-1">
                      {(providers as string[]).map((p, i) => {
                        const meta = PROVIDER_META[p];
                        return (
                          <span key={p} className="flex items-center gap-0.5">
                            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-semibold" style={{ color: meta?.color, borderColor: `${meta?.color}40` }}>
                              {p}
                            </Badge>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 p-3 bg-muted/30 rounded-xl">
              <p className="text-[11px] font-semibold mb-2 text-muted-foreground">منطق الاختيار التلقائي</p>
              {[
                { step: "١", text: "التحقق من المزود المفضل للمكتب (إن كان محدداً)" },
                { step: "٢", text: "التوجيه الذكي حسب نوع المهمة القانونية" },
                { step: "٣", text: "التوجيه حسب وضع الأداء (fast / balanced / accurate)" },
                { step: "٤", text: "الرجوع لأي مزود متاح عند الضرورة" },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-2 mb-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground w-4">{s.step}</span>
                  <span className="text-[11px] text-muted-foreground">{s.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════════ */
export function AiGatewayTab({ qc, toast }: any) {
  const [subTab, setSubTab] = useState("providers");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Network className="h-4.5 w-4.5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-black">بوابة الذكاء الاصطناعي</h2>
          <p className="text-xs text-muted-foreground">إدارة مزودي AI — السياسات الذكية — توزيع الخدمة على المكاتب</p>
        </div>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="providers"     className="text-xs gap-1.5"><Server   className="h-3.5 w-3.5" />المزودون</TabsTrigger>
          <TabsTrigger value="analytics"    className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" />الإحصائيات</TabsTrigger>
          <TabsTrigger value="distribution" className="text-xs gap-1.5"><Globe2    className="h-3.5 w-3.5" />توزيع الخدمة</TabsTrigger>
          <TabsTrigger value="routing"      className="text-xs gap-1.5"><Route     className="h-3.5 w-3.5" />التوجيه الذكي</TabsTrigger>
        </TabsList>

        <TabsContent value="providers"     className="mt-4"><ProvidersTab qc={qc} /></TabsContent>
        <TabsContent value="analytics"    className="mt-4"><AnalyticsTab /></TabsContent>
        <TabsContent value="distribution" className="mt-4"><ServiceDistributionTab /></TabsContent>
        <TabsContent value="routing"      className="mt-4"><SmartRoutingTab /></TabsContent>
      </Tabs>
    </div>
  );
}
