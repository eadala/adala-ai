/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Cpu, Send, RefreshCw, CheckCircle2, XCircle,
  Clock, Zap, Globe, Network, Activity,
  MessageSquare, ChevronDown, ChevronUp, Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { JLWMStatus, CommandSession, CommandAction, JLWMConfig } from "@/types/jlwm";
import { authFetch } from "@/lib/authFetch";

const ACTIONS = [
  { id: "compute_state",           label: "حساب حالة العالم القانوني",    icon: Globe,    desc: "يُعيد حساب state_vector ومستوى الخطر" },
  { id: "generate_recommendations",label: "توليد توصيات ذكية",            icon: Zap,      desc: "يُولّد توصيات بناءً على بيانات المكتب" },
  { id: "generate_alerts",         label: "توليد تنبيهات الرادار",        icon: Activity, desc: "يفحص الموعد والمخاطر ويُطلق تنبيهات" },
  { id: "sync_twins",              label: "مزامنة النسخ الرقمية",         icon: RefreshCw,desc: "يُحدّث توأمات القضايا والعملاء والمكتب" },
  { id: "rebuild_graph",           label: "إعادة بناء مخطط الذاكرة",     icon: Network,  desc: "يُعيد بناء مخطط المعرفة من بيانات المكتب" },
];

const QUERIES = [
  "ما حالة قضاياي النشطة الآن؟",
  "أي عملائي لديهم فواتير متأخرة؟",
  "ما التوصيات الأهم هذا الأسبوع؟",
  "ما توقع نتائج القضايا الجارية؟",
  "كيف أداء المكتب مقارنة بالشهر الماضي؟",
];

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { active: "bg-emerald-500", pending: "bg-yellow-500", error: "bg-red-500" };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] ?? "bg-slate-400"}`} />;
}

export default function CommandCenterPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [query, setQuery]       = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const textareaRef = useRef<HTMLInputElement>(null);

  const { data: status } = useQuery<JLWMStatus>({
    queryKey: ["jlwm", "status"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/command/status");
      if (!r.ok) throw new Error();
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const { data: sessions = [] } = useQuery<CommandSession[]>({
    queryKey: ["jlwm", "sessions"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/command/sessions?limit=10");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 30_000,
  });

  const { data: actions = [] } = useQuery<CommandAction[]>({
    queryKey: ["jlwm", "actions"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/command/actions");
      if (!r.ok) return [];
      return r.json();
    },
    refetchInterval: 10_000,
  });

  const { data: config } = useQuery<JLWMConfig>({
    queryKey: ["jlwm", "config"],
    queryFn: async () => {
      const r = await authFetch("/api/jlwm/config");
      if (!r.ok) throw new Error();
      return r.json();
    },
  });

  const sendQuery = async () => {
    if (!query.trim() || querying) return;
    setQuerying(true);
    setResponse(null);
    try {
      const r = await authFetch("/api/jlwm/command/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const d = await r.json();
      setResponse(d.response ?? d.error ?? "لا توجد استجابة");
      qc.invalidateQueries({ queryKey: ["jlwm", "sessions"] });
    } catch {
      setResponse("حدث خطأ أثناء الاستعلام");
    } finally {
      setQuerying(false);
    }
  };

  const triggerAction = useMutation({
    mutationFn: async (actionType: string) => {
      const r = await authFetch("/api/jlwm/command/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionType }),
      });
      if (!r.ok) throw new Error("فشل");
      return r.json();
    },
    onSuccess: (_, actionType) => {
      qc.invalidateQueries({ queryKey: ["jlwm", "actions"] });
      toast({ title: `جارٍ تنفيذ: ${ACTIONS.find(a => a.id === actionType)?.label}` });
    },
    onError: () => toast({ title: "فشل تنفيذ الإجراء", variant: "destructive" }),
  });

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="h-6 w-6 text-indigo-500" /> مركز القيادة الذكي
          </h1>
          <p className="text-muted-foreground text-sm">
            استعلم عن عالمك القانوني بلغة طبيعية ، أو شغّل إجراءات مركز القيادة مباشرة
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1.5">
          <StatusDot status="active" /> مركز القيادة نشط
        </Badge>
      </div>

      <Tabs defaultValue="query" dir="rtl">
        <TabsList>
          <TabsTrigger value="query"><MessageSquare className="h-4 w-4 me-1" />الاستعلام الذكي</TabsTrigger>
          <TabsTrigger value="actions"><Zap className="h-4 w-4 me-1" />الإجراءات</TabsTrigger>
          <TabsTrigger value="status"><Activity className="h-4 w-4 me-1" />حالة النظام</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-4 w-4 me-1" />السجل</TabsTrigger>
        </TabsList>

        {/* ── Query ─────────────────────────────────── */}
        <TabsContent value="query" className="mt-4 space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-3">
              <div className="flex gap-2">
                <Input
                  ref={textareaRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendQuery(); }}
                  placeholder="اكتب سؤالك عن المكتب القانوني…"
                  className="flex-1"
                  disabled={querying}
                />
                <Button onClick={sendQuery} disabled={querying || !query.trim()}>
                  <Send className="h-4 w-4 me-1" /> {querying ? "جارٍ…" : "إرسال"}
                </Button>
              </div>

              {/* Quick queries */}
              <div className="flex flex-wrap gap-2">
                {QUERIES.map(q => (
                  <button key={q} onClick={() => { setQuery(q); textareaRef.current?.focus(); }}
                    className="text-xs px-2.5 py-1 rounded-full border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    {q}
                  </button>
                ))}
              </div>

              {/* Response */}
              {response !== null && (
                <div className="mt-3 p-4 rounded-xl border bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">مركز القيادة</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{response}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent sessions */}
          {sessions.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">آخر الاستعلامات</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {sessions.slice(0, 4).map(s => (
                  <div key={s.id}
                    className="cursor-pointer p-3 rounded-lg border hover:bg-muted/40 transition-colors"
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate flex-1 me-3">{s.query}</p>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                        {s.duration_ms && <span>{s.duration_ms}ms</span>}
                        {expanded === s.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </div>
                    </div>
                    {expanded === s.id && s.response && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t line-clamp-4">{s.response}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Actions ───────────────────────────────── */}
        <TabsContent value="actions" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ACTIONS.map(action => (
              <Card key={action.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg border bg-muted/40">
                      <action.icon className="h-5 w-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{action.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline"
                    onClick={() => triggerAction.mutate(action.id)}
                    disabled={triggerAction.isPending}>
                    <Zap className="h-3 w-3 me-1" /> تشغيل
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Status ────────────────────────────────── */}
        <TabsContent value="status" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {status && Object.entries(status.modules).map(([key, mod]: [string, any]) => (
              <Card key={key}>
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm capitalize">{key.replace(/_/g, " ")}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusDot status={mod.status} />
                      <span className="text-xs text-muted-foreground">{mod.status}</span>
                    </div>
                  </div>
                  <div className="text-left text-sm font-bold text-primary">
                    {mod.nodes !== undefined && <span>{mod.nodes} عقدة</span>}
                    {mod.count !== undefined && <span>{mod.count}</span>}
                    {mod.activeAlerts !== undefined && <span>{mod.activeAlerts} تنبيه</span>}
                    {mod.firmHealth !== undefined && <span>{Math.round(mod.firmHealth)}%</span>}
                    {mod.riskLevel !== undefined && <span>{mod.riskLevel}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {config && (
            <Card className="mt-4">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> إعدادات مركز القيادة</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">الحالة</span><p className="font-medium">{config.enabled ? "مفعّل" : "معطّل"}</p></div>
                <div><span className="text-muted-foreground">نموذج AI</span><p className="font-medium">{config.ai_model}</p></div>
                <div><span className="text-muted-foreground">تكرار المزامنة</span><p className="font-medium">{config.sync_frequency}</p></div>
                <div><span className="text-muted-foreground">الوحدات المفعّلة</span><p className="font-medium">{config.enabled_modules?.length ?? 0}</p></div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── History ───────────────────────────────── */}
        <TabsContent value="history" className="mt-4">
          <div className="space-y-2">
            {actions.length === 0
              ? <Card><CardContent className="py-8 text-center text-muted-foreground">لا توجد إجراءات سابقة</CardContent></Card>
              : actions.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    {a.status === "done"    && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {a.status === "error"   && <XCircle      className="h-4 w-4 text-red-500" />}
                    {a.status === "running" && <RefreshCw    className="h-4 w-4 text-blue-500 animate-spin" />}
                    {a.status === "pending" && <Clock        className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">{ACTIONS.find(x => x.id === a.action_type)?.label ?? a.action_type}</p>
                      {a.error_msg && <p className="text-xs text-red-500">{a.error_msg}</p>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.started_at).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
