/**
 * مركز الدعم الفني الذكي — AI Support Agent
 * ─────────────────────────────────────────────────────────────────
 * - قائمة التذاكر + تفاصيل المحادثة
 * - لوحة تحليل AI (نوع / سبب جذري / اقتراحات / ثقة)
 * - مقاييس أداء AI
 * - قاعدة المعرفة
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  HeadphonesIcon, Plus, Loader2, Send, Clock, CheckCircle2,
  AlertCircle, XCircle, ChevronRight, MessageSquare, LifeBuoy,
  Bot, Brain, Shield, Bug, CreditCard, Zap, Star, RefreshCw,
  BookOpen, BarChart3, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const PRIORITY: Record<string, { label: string; color: string; dot: string }> = {
  low:     { label: "منخفض",  color: "bg-gray-500/10 text-gray-400",    dot: "bg-gray-400" },
  medium:  { label: "متوسط",  color: "bg-yellow-500/10 text-yellow-400", dot: "bg-yellow-400" },
  high:    { label: "عالٍ",   color: "bg-orange-500/10 text-orange-400", dot: "bg-orange-400" },
  urgent:  { label: "عاجل",   color: "bg-red-500/10 text-red-400",       dot: "bg-red-500" },
  critical:{ label: "حرج",    color: "bg-red-700/20 text-red-500",       dot: "bg-red-600" },
};

const STATUS: Record<string, { label: string; color: string; icon: any }> = {
  open:        { label: "مفتوح",         color: "bg-blue-500/10 text-blue-400",       icon: AlertCircle },
  in_progress: { label: "قيد المعالجة", color: "bg-amber-500/10 text-amber-400",     icon: Clock },
  resolved:    { label: "محلول",         color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle2 },
  closed:      { label: "مغلق",          color: "bg-muted text-muted-foreground",     icon: XCircle },
};

const AI_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  security:    { label: "أمني",       icon: Shield,        color: "text-red-500" },
  bug:         { label: "خلل تقني",  icon: Bug,           color: "text-orange-500" },
  billing:     { label: "مالي",       icon: CreditCard,    color: "text-blue-500" },
  performance: { label: "أداء",       icon: Zap,           color: "text-yellow-500" },
  feature:     { label: "طلب ميزة",  icon: Star,          color: "text-purple-500" },
  general:     { label: "عام",        icon: MessageSquare, color: "text-gray-400" },
};

const CATEGORIES = [
  { value: "technical", label: "دعم تقني" },
  { value: "billing",   label: "فواتير ومدفوعات" },
  { value: "account",   label: "إدارة الحساب" },
  { value: "feature",   label: "طلب ميزة" },
  { value: "bug",       label: "الإبلاغ عن خلل" },
  { value: "other",     label: "أخرى" },
];

async function apiCall(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json();
}

/* ─── AI Analysis Panel ───────────────────────────────────────────────────── */
function AIAnalysisPanel({ ticketId }: { ticketId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: analysis, isLoading } = useQuery<any>({
    queryKey: ["ticket-ai", ticketId],
    queryFn: () => apiCall(`/support/tickets/${ticketId}/ai-analysis`),
    refetchInterval: (query) => (!query.state.data ? 5000 : false),
    staleTime: 30_000,
  });

  const reAnalyze = useMutation({
    mutationFn: () => apiCall(`/support/tickets/${ticketId}/ai-analyze`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "🤖 AI يعيد التحليل..." });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["ticket-ai", ticketId] }), 5000);
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>وكيل الدعم الذكي يحلل التذكرة...</span>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-3 rounded-xl border border-dashed bg-muted/20">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Bot className="h-3.5 w-3.5" /> لم يتم التحليل بعد
          </span>
          <Button size="sm" variant="outline" className="h-6 text-xs"
            onClick={() => reAnalyze.mutate()} disabled={reAnalyze.isPending}>
            {reAnalyze.isPending ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Brain className="h-3 w-3 ml-1" />}
            تحليل AI
          </Button>
        </div>
      </div>
    );
  }

  const typeInfo = AI_TYPES[analysis.ai_type] ?? AI_TYPES.general;
  const TypeIcon = typeInfo.icon;
  const confidence = Math.round((analysis.ai_confidence ?? 0) * 100);
  const suggestions: string[] = analysis.ai_suggestions ?? [];

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-blue-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-primary">تحليل وكيل الدعم الذكي</span>
        </div>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
          onClick={() => reAnalyze.mutate()} disabled={reAnalyze.isPending}>
          <RefreshCw className={cn("h-3.5 w-3.5", reAnalyze.isPending && "animate-spin")} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge className={cn("text-xs gap-1", typeInfo.color, "bg-current/10 border-current/20")}>
          <TypeIcon className="h-3 w-3" />
          {typeInfo.label}
        </Badge>
        <Badge className={cn("text-xs", (PRIORITY[analysis.ai_priority] ?? PRIORITY.low).color)}>
          أولوية: {(PRIORITY[analysis.ai_priority] ?? PRIORITY.low).label}
        </Badge>
        {analysis.soc_alerted && (
          <Badge variant="destructive" className="text-xs gap-1">
            <Shield className="h-3 w-3" /> SOC Alert
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">مستوى الثقة</span>
          <span className={cn("font-bold",
            confidence >= 80 ? "text-green-500" : confidence >= 60 ? "text-amber-500" : "text-red-400")}>
            {confidence}%
          </span>
        </div>
        <Progress value={confidence} className="h-1.5" />
      </div>

      {analysis.ai_root_cause && (
        <div className="bg-background/60 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">السبب الجذري المحتمل</p>
          <p className="text-sm leading-relaxed">{analysis.ai_root_cause}</p>
        </div>
      )}

      {analysis.ai_summary && (
        <p className="text-xs text-muted-foreground leading-relaxed border-r-2 border-primary/30 pr-2">
          {analysis.ai_summary}
        </p>
      )}

      {suggestions.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-2">الإجراءات المقترحة</p>
          <div className="space-y-1.5">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground/50 text-left ltr">
        Model: {analysis.model_used ?? "—"} · {new Date(analysis.created_at).toLocaleString("ar-SA")}
      </p>
    </div>
  );
}

/* ─── AI Stats Tab ────────────────────────────────────────────────────────── */
function AIStatsTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["support-ai-stats"],
    queryFn: () => apiCall("/support/ai-stats"),
    staleTime: 60_000,
  });
  const { data: kb = [], isLoading: kbLoading } = useQuery<any[]>({
    queryKey: ["support-kb"],
    queryFn: () => apiCall("/support/knowledge-base"),
    staleTime: 120_000,
  });

  const ai = data?.ai ?? {};
  const tickets = data?.tickets ?? {};

  const typeStats = [
    { key: "security_tickets",    label: "أمنية",    icon: Shield,        color: "text-red-500" },
    { key: "bug_tickets",         label: "أخطاء",    icon: Bug,           color: "text-orange-500" },
    { key: "billing_tickets",     label: "مالية",    icon: CreditCard,    color: "text-blue-500" },
    { key: "performance_tickets", label: "أداء",     icon: Zap,           color: "text-yellow-500" },
    { key: "feature_tickets",     label: "ميزات",    icon: Star,          color: "text-purple-500" },
    { key: "general_tickets",     label: "عامة",     icon: MessageSquare, color: "text-gray-400" },
  ];

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-5" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي التذاكر",  val: tickets.total ?? 0,                  sub: `${tickets.active ?? 0} نشطة`,          color: "text-primary" },
          { label: "حُللت بـ AI",     val: ai.total_analyzed ?? 0,              sub: `${ai.ai_resolution_rate ?? 0}% حُلّ تلقائياً`, color: "text-blue-500" },
          { label: "متوسط الثقة",    val: `${ai.avg_confidence_pct ?? 0}%`,    sub: `${ai.escalated ?? 0} مُصعَّدة`,        color: "text-green-500" },
          { label: "تنبيهات SOC",    val: ai.soc_alerts ?? 0,                  sub: `${ai.security_tickets ?? 0} تذكرة أمنية`, color: "text-red-500" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <div className={cn("text-2xl font-black", k.color)}>{k.val}</div>
              <div className="text-xs font-medium mt-0.5">{k.label}</div>
              <div className="text-[10px] text-muted-foreground">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> مقاييس أداء AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "معدل الحل التلقائي", value: Number(ai.ai_resolution_rate ?? 0), color: "bg-green-500" },
            { label: "معدل التصعيد",       value: Number(ai.escalation_rate ?? 0),   color: "bg-orange-500" },
            { label: "متوسط الثقة",        value: Number(ai.avg_confidence_pct ?? 0),color: "bg-blue-500" },
          ].map(m => (
            <div key={m.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-bold">{m.value}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", m.color)}
                  style={{ width: `${Math.min(m.value, 100)}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> توزيع أنواع التذاكر
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {typeStats.map(t => {
              const Icon = t.icon;
              return (
                <div key={t.key} className="text-center p-3 bg-muted/20 rounded-lg">
                  <Icon className={cn("h-5 w-5 mx-auto mb-1", t.color)} />
                  <div className="text-lg font-bold">{(ai as any)[t.key] ?? 0}</div>
                  <div className="text-[10px] text-muted-foreground">{t.label}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> قاعدة المعرفة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {kbLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {(kb as any[]).map((entry: any) => (
                <div key={entry.id} className="p-3 border rounded-lg text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-[10px]">{entry.category}</Badge>
                    <span className="text-muted-foreground">{entry.hits} استخدام</span>
                  </div>
                  <p className="font-medium">{entry.issue}</p>
                  <p className="text-muted-foreground mt-0.5">{entry.fix}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════ */
export default function SupportPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({ subject: "", body: "", priority: "medium", category: "technical" });

  const { data: tickets = [], isLoading } = useQuery<any[]>({
    queryKey: ["support-tickets"],
    queryFn: () => apiCall("/support/tickets"),
    staleTime: 30_000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["support-ticket", selectedId],
    queryFn: () => apiCall(`/support/tickets/${selectedId}`),
    enabled: !!selectedId,
    refetchInterval: 12_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiCall("/support/tickets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      setShowCreate(false);
      setSelectedId(t.id);
      setForm({ subject: "", body: "", priority: "medium", category: "technical" });
      toast({ title: "✅ تم الإرسال — AI يحلل التذكرة..." });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const replyMutation = useMutation({
    mutationFn: (data: any) => apiCall(`/support/tickets/${selectedId}/messages`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["support-ticket", selectedId] }); setReply(""); },
    onError: (e: any) => toast({ title: "خطأ في الإرسال", description: e.message, variant: "destructive" }),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiCall(`/support/tickets/${selectedId}/close`, { method: "PATCH" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-ticket", selectedId] });
      toast({ title: "تم إغلاق التذكرة" });
    },
  });

  const ticket = detail?.ticket;
  const messages: any[] = detail?.messages ?? [];
  const openCount = (tickets as any[]).filter((t: any) => t.status === "open" || t.status === "in_progress").length;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HeadphonesIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black flex items-center gap-2">
              مركز الدعم الفني
              <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/20 gap-1">
                <Bot className="h-3 w-3" /> AI Agent
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              {openCount > 0 ? `${openCount} تذكرة نشطة` : "لا توجد تذاكر نشطة"}
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-white font-bold"
          onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> تذكرة جديدة
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tickets">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="tickets" className="text-xs">
            <MessageSquare className="h-3.5 w-3.5 ml-1" /> التذاكر
          </TabsTrigger>
          <TabsTrigger value="ai-stats" className="text-xs">
            <Brain className="h-3.5 w-3.5 ml-1" /> إحصاءات AI
          </TabsTrigger>
        </TabsList>

        {/* ── Tickets Tab ── */}
        <TabsContent value="tickets" className="mt-3">
          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "الكل",        value: (tickets as any[]).length, color: "text-primary" },
              { label: "مفتوحة",      value: (tickets as any[]).filter((t:any) => t.status === "open").length, color: "text-blue-400" },
              { label: "قيد المعالجة",value: (tickets as any[]).filter((t:any) => t.status === "in_progress").length, color: "text-amber-400" },
              { label: "محلولة",      value: (tickets as any[]).filter((t:any) => t.status === "resolved").length, color: "text-emerald-400" },
            ].map(s => (
              <Card key={s.label} className="border-0 bg-card/60">
                <CardContent className="p-3">
                  <div className={cn("text-2xl font-black", s.color)}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Two-column */}
          <div className="grid md:grid-cols-5 gap-4">
            {/* List */}
            <div className="md:col-span-2 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">التذاكر</p>
              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (tickets as any[]).length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <LifeBuoy className="h-12 w-12 opacity-20" />
                  <p className="text-sm text-center">لا توجد تذاكر بعد<br />
                    <span className="text-xs">أنشئ تذكرة — سيحللها AI فوراً</span>
                  </p>
                </div>
              ) : (
                (tickets as any[]).map((t: any) => {
                  const sm = STATUS[t.status] ?? STATUS.open;
                  const pm = PRIORITY[t.priority] ?? PRIORITY.medium;
                  return (
                    <div key={t.id} onClick={() => setSelectedId(t.id)}
                      className={cn("p-3.5 rounded-xl border cursor-pointer transition-all", selectedId === t.id
                        ? "border-primary/50 bg-primary/5 shadow-sm"
                        : "border-border/50 hover:bg-muted/20 hover:border-border")}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-semibold text-sm line-clamp-1 flex-1">{t.subject}</span>
                        <Badge className={cn("text-[9px] shrink-0 px-1.5 font-medium", sm.color)}>
                          {sm.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", pm.dot)} />
                        <span>{pm.label}</span>
                        <span>·</span>
                        <span>{new Date(t.createdAt).toLocaleDateString("ar-SA")}</span>
                        <ChevronRight className="h-3 w-3 mr-auto opacity-40" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Detail */}
            <div className="md:col-span-3 space-y-3">
              {!selectedId ? (
                <Card className="h-[400px] flex items-center justify-center border-dashed border-2">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">اختر تذكرة لعرض المحادثة</p>
                  </div>
                </Card>
              ) : detailLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                </div>
              ) : ticket ? (
                <>
                  <AIAnalysisPanel ticketId={ticket.id} />
                  <Card>
                    <CardHeader className="pb-3 border-b border-border/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h2 className="font-bold text-base line-clamp-1">{ticket.subject}</h2>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge className={cn("text-[9px]", STATUS[ticket.status]?.color)}>
                              {STATUS[ticket.status]?.label}
                            </Badge>
                            <Badge className={cn("text-[9px]", PRIORITY[ticket.priority]?.color)}>
                              {PRIORITY[ticket.priority]?.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {CATEGORIES.find(c => c.value === ticket.category)?.label ?? ticket.category}
                            </span>
                            <span className="text-[10px] text-muted-foreground mr-auto">
                              {new Date(ticket.createdAt).toLocaleDateString("ar-SA", { day: "numeric", month: "long" })}
                            </span>
                          </div>
                        </div>
                        {ticket.status !== "closed" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0 gap-1"
                            onClick={() => closeMutation.mutate()}>
                            {closeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                            إغلاق
                          </Button>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 max-h-[320px] overflow-y-auto">
                      {messages.length === 0 ? (
                        <div className="text-center text-muted-foreground py-6 text-sm">لا توجد رسائل</div>
                      ) : messages.map((msg: any) => {
                        const isAI = msg.senderName?.includes("🤖");
                        const isAdmin = msg.senderType === "admin";
                        return (
                          <div key={msg.id} className={cn("flex gap-3", isAdmin ? "flex-row-reverse" : "")}>
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                              isAI ? "bg-primary/20 text-primary" : isAdmin ? "bg-blue-500/20 text-blue-400" : "bg-muted text-muted-foreground"
                            )}>
                              {isAI ? <Bot className="h-3.5 w-3.5" /> : isAdmin ? "دعم" : "أنا"}
                            </div>
                            <div className={cn("flex-1 max-w-[82%]", isAdmin ? "items-end" : "")}>
                              <div className={cn(
                                "rounded-xl p-3 text-sm leading-relaxed whitespace-pre-line",
                                isAI ? "bg-primary/10 border border-primary/20"
                                : isAdmin ? "bg-blue-500/10 border border-blue-500/20"
                                : "bg-muted/40 border border-border/30"
                              )}>
                                {msg.message}
                              </div>
                              <div className={cn("flex items-center gap-1 mt-1", isAdmin ? "justify-end" : "")}>
                                <span className="text-[10px] text-muted-foreground">{msg.senderName}</span>
                                <span className="text-[10px] text-muted-foreground">·</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>

                    {ticket.status !== "closed" && (
                      <div className="px-4 pb-4 pt-2 border-t border-border/40">
                        <div className="flex gap-2">
                          <Textarea value={reply} onChange={e => setReply(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && e.ctrlKey)
                                replyMutation.mutate({ message: reply, senderName: user?.fullName ?? "المستخدم" });
                            }}
                            placeholder="اكتب ردك... (Ctrl+Enter للإرسال)"
                            rows={2} className="resize-none text-sm flex-1" />
                          <Button size="icon" className="h-full aspect-square bg-primary hover:bg-primary/90 text-white"
                            onClick={() => replyMutation.mutate({ message: reply, senderName: user?.fullName ?? "المستخدم" })}
                            disabled={!reply.trim() || replyMutation.isPending}>
                            {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                </>
              ) : null}
            </div>
          </div>
        </TabsContent>

        {/* ── AI Stats Tab ── */}
        <TabsContent value="ai-stats" className="mt-3">
          <AIStatsTab />
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeadphonesIcon className="h-5 w-5 text-primary" />
              تذكرة دعم فني جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Alert className="bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
              <Brain className="h-4 w-4 text-blue-500" />
              <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
                بعد الإرسال، يقوم وكيل الدعم الذكي بتحليل التذكرة وإرسال رد تشخيصي فوري.
              </AlertDescription>
            </Alert>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">الموضوع *</Label>
              <Input placeholder="وصف مختصر للمشكلة" value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">الأولوية</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["low","medium","high","urgent"].map(v => (
                      <SelectItem key={v} value={v}>{(PRIORITY[v] ?? PRIORITY.medium).label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">التصنيف</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">التفاصيل *</Label>
              <Textarea placeholder="اشرح المشكلة بالتفصيل — AI سيستخدم هذا للتشخيص..."
                value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                rows={5} className="resize-none text-sm" />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={() => createMutation.mutate({
                ...form,
                userEmail: user?.primaryEmailAddress?.emailAddress ?? "",
                userName: user?.fullName ?? user?.firstName ?? "مستخدم",
              })}
              disabled={createMutation.isPending}
              className="gap-2 bg-primary hover:bg-primary/90 text-white font-bold">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              إرسال + تحليل AI
            </Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
