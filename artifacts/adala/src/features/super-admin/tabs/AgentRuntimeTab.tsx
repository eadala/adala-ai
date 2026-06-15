import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Building2, Users, Package, Tag, KeyRound, Activity,
  Settings, FolderTree, BookOpen, HeadphonesIcon, Plus, Loader2,
  Trash2, Edit2, Check, X, TrendingUp, DollarSign, BarChart3,
  AlertCircle, CheckCircle2, Clock, ChevronDown, Eye, EyeOff,
  Save, RefreshCw, Globe, Star, MessageSquare, Upload, FileText,
  ToggleLeft, ToggleRight, Search, Badge as BadgeIcon, Briefcase,
  Crown, Zap, Bell, Lock, Code2, Terminal, Cpu, HardDrive,
  Server, Copy, Fingerprint, Wifi, Database, ShieldAlert,
  CircleCheck, CircleX, KeySquare, Cloud, Link2,
  Shield, CheckCircle, XCircle, Layers, PlugZap, Smartphone,
  Gift, CalendarClock, Ban, PlusCircle, Timer, TrendingDown, Percent,
  Phone, Mail, Twitter, Linkedin, Youtube,
  Bot, Radar, Command, Network, Gauge, Play, Pause, RotateCcw,
  AlertOctagon as AOctagon, TrendingUp as TUp, Boxes,
  MonitorDot, Cpu as CpuIcon, MemoryStick, ArrowUpRight,
  Workflow, ScanLine, FlaskConical,
  FileBarChart2, Gavel, FileSignature, ShieldCheck as SecurityIcon,
  Layout, AlertOctagon, Download, ChevronRight, Filter as FilterIcon,
  User, Banknote, CheckSquare, AlertCircle as ACircle,
  Globe2, Newspaper, ListOrdered, HelpCircle, PenLine, Info,
  CreditCard, Receipt, AlertTriangle,
  ArrowRight, ClipboardList, ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { API, useAdmin } from "../shared/api";
import { StatCard, HealthPill } from "../shared/components";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";


const SA_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function saFetch(path: string, token: string) {
  return fetch(path, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

const SEV_COLOR: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high:     "text-amber-400 bg-amber-500/10 border-amber-500/20",
  medium:   "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  info:     "text-blue-400 bg-blue-500/10 border-blue-500/20",
  low:      "text-slate-400 bg-slate-500/10 border-slate-500/20",
};
const SEV_AR: Record<string, string> = {
  critical: "حرج", high: "مهم", medium: "متوسط", info: "معلومة", low: "منخفض",
};

/* ═══════════════════════════════════════════════════
   AGENT RUNTIME TAB
═══════════════════════════════════════════════════ */
const AGENT_ICON: Record<string, any> = {
  legal:   Gavel,
  finance: Banknote,
  risk:    ShieldAlert,
  system:  Server,
  hr:      Users,
};
const AGENT_COLOR: Record<string, string> = {
  legal:   "text-violet-400 bg-violet-500/10 border-violet-500/20",
  finance: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  risk:    "text-red-400 bg-red-500/10 border-red-500/20",
  system:  "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  hr:      "text-amber-400 bg-amber-500/10 border-amber-500/20",
};
const DEC_AR: Record<string, string> = {
  AUTO_EXECUTE:      "تنفيذ تلقائي",
  RECOMMEND:         "توصية",
  REQUIRE_APPROVAL:  "يتطلب موافقة",
};
const DEC_COLOR: Record<string, string> = {
  AUTO_EXECUTE:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  RECOMMEND:        "bg-blue-500/10 text-blue-400 border-blue-500/20",
  REQUIRE_APPROVAL: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export function AgentRuntimeTab({ toast }: { toast: any }) {
  const { getToken } = useAuth();
  const [running, setRunning] = useState<string | null>(null);
  const [agFilter, setAgFilter] = useState("all");

  const { data, refetch, isFetching } = useQuery<any>({
    queryKey: ["agents", "status"],
    queryFn: async () => saFetch(`${SA_BASE}/api/agents/status`, await getToken() ?? ""),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  async function runAgent(id: string) {
    setRunning(id);
    try {
      const token = await getToken();
      const url = id === "all" ? `${SA_BASE}/api/agents/run` : `${SA_BASE}/api/agents/${id}/run`;
      const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` } });
      const j = await r.json();
      toast({ title: "✅ اكتمل الفحص", description: `اكتُشف ${j.found ?? 0} حدث في ${j.elapsed ?? 0}ms` });
      refetch();
    } catch {
      toast({ title: "خطأ", description: "فشل تشغيل الوكيل", variant: "destructive" });
    } finally { setRunning(null); }
  }

  async function resolveAction(id: number) {
    try {
      const token = await getToken();
      await fetch(`${SA_BASE}/api/agents/actions/${id}/resolve`, { method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` } });
      refetch();
    } catch {}
  }

  const agents = data?.agents ?? [];
  const actions = (data?.recentActions ?? []).filter((a: any) =>
    agFilter === "all" || a.agent_id === agFilter
  );
  const stats = data?.stats ?? {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Bot className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-black">نظام الوكلاء الذكيين</h2>
          <p className="text-xs text-muted-foreground font-mono">Multi-Agent Runtime Engine</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <Button
            onClick={() => runAgent("all")}
            disabled={!!running}
            className="gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white h-8"
            size="sm"
          >
            {running === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            فحص شامل
          </Button>
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching} className="gap-1 text-xs h-8">
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <HealthPill icon={AlertCircle} label="معلق"     value={Number(stats.pending ?? 0)}  color="border-amber-500/20" />
          <HealthPill icon={CheckCircle} label="محلول"    value={Number(stats.resolved ?? 0)} color="border-emerald-500/20" />
          <HealthPill icon={AlertTriangle} label="حرج"    value={Number(stats.critical ?? 0)} color="border-red-500/20" />
          <HealthPill icon={ShieldAlert} label="مهم"      value={Number(stats.high_sev ?? 0)} color="border-orange-500/20" />
        </div>
      )}

      {/* Agent Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {(agents.length ? agents : [
          { id: "legal", name_ar: "الوكيل القانوني", type: "legal", status: "active", run_count: 0, pendingActions: 0 },
          { id: "finance", name_ar: "الوكيل المالي", type: "finance", status: "active", run_count: 0, pendingActions: 0 },
          { id: "risk", name_ar: "وكيل المخاطر", type: "risk", status: "active", run_count: 0, pendingActions: 0 },
          { id: "system", name_ar: "وكيل النظام", type: "system", status: "active", run_count: 0, pendingActions: 0 },
          { id: "hr", name_ar: "وكيل الموارد البشرية", type: "hr", status: "active", run_count: 0, pendingActions: 0 },
        ]).map((ag: any) => {
          const Icon = AGENT_ICON[ag.type] ?? Bot;
          const colorCls = AGENT_COLOR[ag.type] ?? "text-slate-400 bg-slate-500/10 border-slate-500/20";
          const isRunning = running === ag.id;
          return (
            <Card key={ag.id} className={cn("border cursor-pointer hover:bg-accent/40 transition-colors", colorCls.includes("border") ? colorCls.split(" ").find(c => c.startsWith("border-")) ?? "border-border/50" : "border-border/50")}>
              <CardContent className="pt-4 pb-3 px-3 space-y-2">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", colorCls.split(" ").filter(c => c.startsWith("bg-")).join(" "))}>
                  <Icon className={cn("h-4 w-4", colorCls.split(" ").find(c => c.startsWith("text-")))} />
                </div>
                <div>
                  <p className="text-xs font-bold leading-tight">{ag.name_ar}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ag.run_count ?? 0} فحص · {ag.pendingActions ?? 0} معلق</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full h-7 text-xs gap-1"
                  onClick={() => runAgent(ag.id)}
                  disabled={!!running}
                >
                  {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  تشغيل
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions Feed */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-400" /> آخر الإجراءات
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={agFilter}
              onChange={e => setAgFilter(e.target.value)}
              className="bg-muted/30 border border-border rounded-lg text-xs px-2 py-1 text-white"
            >
              <option value="all">كل الوكلاء</option>
              <option value="legal">القانوني</option>
              <option value="finance">المالي</option>
              <option value="risk">المخاطر</option>
              <option value="system">النظام</option>
            </select>
          </div>
        </div>
        <div className="space-y-2 max-h-[480px] overflow-y-auto">
          {isFetching && !actions.length ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)
          ) : actions.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Bot className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">لا توجد إجراءات — شغّل الوكلاء لبدء الفحص</p>
            </div>
          ) : actions.map((a: any) => {
            const Icon = AGENT_ICON[a.agent_id] ?? Bot;
            return (
              <div key={a.id} className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                a.status === "resolved" ? "bg-muted border-border opacity-50" : "bg-muted border-border hover:bg-accent"
              )}>
                <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", AGENT_COLOR[a.agent_id]?.split(" ").find((c: string) => c.startsWith("text-")) ?? "text-slate-400")} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{a.title}</span>
                    <Badge className={cn("text-xs border", SEV_COLOR[a.severity] ?? "")}>{SEV_AR[a.severity] ?? a.severity}</Badge>
                    <Badge className={cn("text-xs border", DEC_COLOR[a.decision] ?? "")}>{DEC_AR[a.decision] ?? a.decision}</Badge>
                  </div>
                  {a.body && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.body}</p>}
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {a.agent_name_ar ?? a.agent_id} · {new Date(a.created_at).toLocaleString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {a.status === "pending" && (
                  <Button
                    size="sm" variant="ghost"
                    className="shrink-0 h-7 text-xs gap-1 text-emerald-400 hover:text-emerald-300"
                    onClick={() => resolveAction(a.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> حل
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ENGINEERING HERO TAB
═══════════════════════════════════════════════════ */
