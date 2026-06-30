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
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
import { StatCard } from "../shared/components";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";

/* ── Local status/priority maps ───────────────────── */
const S_MAP: Record<string,{label:string;color:string}> = {
  open:             { label:"مفتوح",           color:"bg-blue-500/10 text-blue-500" },
  in_progress:      { label:"قيد المعالجة",    color:"bg-amber-500/10 text-amber-500" },
  waiting_customer: { label:"بانتظار العميل",  color:"bg-violet-500/10 text-violet-500" },
  waiting_internal: { label:"بانتظار الفريق", color:"bg-orange-500/10 text-orange-500" },
  resolved:         { label:"محلول",           color:"bg-emerald-500/10 text-emerald-500" },
  closed:           { label:"مغلق",            color:"bg-muted/50 text-muted-foreground" },
  archived:         { label:"مؤرشف",           color:"bg-muted/30 text-muted-foreground/60" },
};
const P_MAP: Record<string,{label:string;color:string}> = {
  emergency:{ label:"طارئ",   color:"text-red-600 font-black" },
  critical: { label:"حرج",    color:"text-red-500 font-bold" },
  high:     { label:"عالٍ",   color:"text-orange-500" },
  urgent:   { label:"عاجل",   color:"text-amber-500" },
  medium:   { label:"متوسط",  color:"text-yellow-500" },
  low:      { label:"منخفض",  color:"text-gray-400" },
};

export function SupportTab({ qc, toast }: any) {
  const [tab, setTab] = useState("tickets");

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex gap-2 border-b border-border/40 pb-2">
        {[
          { key:"tickets",  icon:HeadphonesIcon, label:"التذاكر" },
          { key:"analytics",icon:BarChart3,      label:"تحليلات" },
          { key:"sla",      icon:AlertTriangle,  label:"SLA" },
          { key:"kb",       icon:BookOpen,       label:"قاعدة المعرفة" },
          { key:"visitors", icon:Globe2,         label:"الزوار" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40")}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "tickets"   && <TicketsPanel  qc={qc} toast={toast} />}
      {tab === "analytics" && <AnalyticsPanel />}
      {tab === "sla"       && <SLAPanel      qc={qc} toast={toast} />}
      {tab === "kb"        && <KnowledgeBasePanel qc={qc} toast={toast} />}
      {tab === "visitors"  && <VisitorsPanel />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TICKETS PANEL
══════════════════════════════════════════════════════ */
function TicketsPanel({ qc, toast }: any) {
  const { data: tickets = [], isLoading } = useAdmin<any[]>("/support");
  const [selected, setSelected]   = useState<any>(null);
  const [adminReply, setAdminReply] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch]       = useState("");
  const [assignName, setAssignName] = useState("");
  const [noteText, setNoteText]   = useState("");

  const { data: threadMsgs = [], refetch: refetchThread } = useQuery<any[]>({
    queryKey: ["admin","support-thread", selected?.id],
    queryFn:  () => API(`/support/${selected.id}/messages`),
    enabled:  !!selected?.id,
    refetchInterval: 25_000,
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }: any) => API(`/support/${id}`, { method:"PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:["admin","/support"] }); toast({ title:"تم التحديث ✓" }); },
  });

  const workflowChange = useMutation({
    mutationFn: ({ id, status, internalNote }: any) =>
      API(`/support/${id}/workflow`, { method:"PATCH", body: JSON.stringify({ status, internalNote }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["admin","/support"] });
      toast({ title:"تم تغيير الحالة ✓" });
    },
    onError: (e:any) => toast({ title:"خطأ", description: e.message, variant:"destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ id, assignedToName }: any) =>
      API(`/support/${id}/assign`, { method:"PATCH", body: JSON.stringify({ assignedToName }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:["admin","/support"] });
      toast({ title:"تم الإسناد ✓" });
      setAssignName("");
    },
  });

  const addNote = useMutation({
    mutationFn: ({ id, note }: any) =>
      API(`/support/${id}/internal-note`, { method:"POST", body: JSON.stringify({ note }) }),
    onSuccess: () => { toast({ title:"تمت إضافة الملاحظة ✓" }); setNoteText(""); },
  });

  const reply = useMutation({
    mutationFn: ({ id, message }: any) =>
      API(`/support/${id}/reply`, { method:"POST", body: JSON.stringify({ message }) }),
    onSuccess: () => {
      setAdminReply("");
      qc.invalidateQueries({ queryKey:["admin","/support"] });
      refetchThread();
      toast({ title:"تم إرسال الرد ✓" });
    },
    onError: (e:any) => toast({ title:"خطأ", description: e.message, variant:"destructive" }),
  });

  const filtered = (tickets as any[]).filter((t:any) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search && !t.subject?.toLowerCase().includes(search.toLowerCase()) &&
        !t.userName?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const STATUS_ACTIONS = [
    { key:"in_progress",      label:"قيد المعالجة",   cls:"hover:bg-amber-500/10" },
    { key:"waiting_customer", label:"بانتظار العميل", cls:"hover:bg-violet-500/10" },
    { key:"resolved",         label:"محلول",          cls:"hover:bg-emerald-500/10" },
    { key:"closed",           label:"مغلق",           cls:"hover:bg-muted/40" },
  ];

  return (
    <div className="grid md:grid-cols-5 gap-4">
      {/* ─ List col ─ */}
      <div className="md:col-span-2 space-y-2">
        {/* Search + filter */}
        <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)}
          className="h-7 text-xs mb-2" />
        <div className="flex gap-1 flex-wrap mb-2">
          {["all","open","in_progress","waiting_customer","resolved","closed"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("text-[10px] px-2 py-0.5 rounded-md border transition-colors",
                filterStatus === s ? "bg-primary text-primary-foreground border-primary"
                                   : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
              {s === "all" ? "الكل" : S_MAP[s]?.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mb-1">{filtered.length} تذكرة</p>

        {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm opacity-60">لا توجد تذاكر</div>
        ) : filtered.map((t:any) => {
          const isSlaBreach = t.sla_resolution_deadline && new Date(t.sla_resolution_deadline) < new Date()
                              && !["closed","resolved"].includes(t.status);
          return (
            <div key={t.id} onClick={() => { setSelected(t); setAdminReply(""); }}
              className={cn("p-3 rounded-xl border cursor-pointer transition-all relative",
                selected?.id === t.id ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border/50 hover:bg-muted/20")}>
              {isSlaBreach && (
                <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" title="تجاوز SLA" />
              )}
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-semibold text-sm line-clamp-1">{t.subject}</span>
                <Badge className={cn("text-[9px] shrink-0 px-1.5", S_MAP[t.status]?.color ?? "bg-muted")}>
                  {S_MAP[t.status]?.label ?? t.status}
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1">
                <span className="font-medium">{t.user_name ?? t.userName}</span>
                <span>·</span>
                <span className={P_MAP[t.priority]?.color}>{P_MAP[t.priority]?.label}</span>
                <span>·</span>
                <span>{new Date(t.created_at ?? t.createdAt).toLocaleDateString("ar-SA")}</span>
              </div>
              {t.assigned_to_name && (
                <div className="text-[10px] text-primary/70 mt-0.5">
                  📌 {t.assigned_to_name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ─ Detail col ─ */}
      {selected ? (
        <div className="md:col-span-3 space-y-3 overflow-y-auto max-h-[calc(100vh-240px)]">
          {/* Header */}
          <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm">{selected.subject}</h3>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                  <span>{selected.user_name ?? selected.userName}</span>
                  <span>·</span>
                  <span>{selected.user_email ?? selected.userEmail}</span>
                  {(selected.office_name ?? selected.officeName) && (
                    <><span>·</span><span className="text-primary">{selected.office_name ?? selected.officeName}</span></>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge className={cn("text-[9px] px-1.5", S_MAP[selected.status]?.color)}>
                    {S_MAP[selected.status]?.label ?? selected.status}
                  </Badge>
                  <Badge className={cn("text-[9px] px-1.5", P_MAP[selected.priority]?.color ?? "")}>
                    {P_MAP[selected.priority]?.label}
                  </Badge>
                  {selected.sla_resolution_deadline && (
                    <span className={cn("text-[9px] flex items-center gap-0.5",
                      new Date(selected.sla_resolution_deadline) < new Date()
                        ? "text-red-500 font-bold" : "text-muted-foreground")}>
                      <Clock className="h-3 w-3" />
                      {new Date(selected.sla_resolution_deadline).toLocaleString("ar-SA")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Workflow actions */}
            <div className="flex gap-1 flex-wrap">
              {STATUS_ACTIONS.map(a => (
                <Button key={a.key} size="sm" variant="outline"
                  className={cn("h-6 text-[10px] px-2", a.cls)}
                  onClick={() => workflowChange.mutate({ id: selected.id, status: a.key })}>
                  {a.label}
                </Button>
              ))}
            </div>

            {/* Assign */}
            <div className="flex gap-2 items-center">
              <Input placeholder="أسند إلى..." value={assignName}
                onChange={e => setAssignName(e.target.value)}
                className="h-6 text-[10px] flex-1" />
              <Button size="sm" className="h-6 text-[10px] px-2"
                onClick={() => assignMutation.mutate({ id: selected.id, assignedToName: assignName })}
                disabled={!assignName.trim() || assignMutation.isPending}>
                إسناد
              </Button>
            </div>

            {/* Internal note */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-amber-600">ملاحظة داخلية (لا يراها العميل)</Label>
              <div className="flex gap-2">
                <Input placeholder="ملاحظة..." value={noteText}
                  onChange={e => setNoteText(e.target.value)} className="h-6 text-[10px] flex-1" />
                <Button size="sm" className="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-700"
                  onClick={() => addNote.mutate({ id: selected.id, note: noteText })}
                  disabled={!noteText.trim() || addNote.isPending}>
                  حفظ
                </Button>
              </div>
              {selected.internal_notes && (
                <p className="text-[10px] text-amber-600/80 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                  {selected.internal_notes}
                </p>
              )}
            </div>
          </div>

          {/* Message thread */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto px-1 py-1">
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-[9px] font-bold text-blue-400">م</div>
              <div className="flex-1 max-w-[85%]">
                <div className="rounded-xl p-3 text-sm bg-muted/40 border border-border/30 leading-relaxed">
                  {selected.body}
                </div>
                <div className="text-[9px] text-muted-foreground mt-1 mr-1">
                  {selected.user_name ?? selected.userName} · {new Date(selected.created_at ?? selected.createdAt).toLocaleDateString("ar-SA")}
                </div>
              </div>
            </div>

            {threadMsgs.map((msg:any) => (
              <div key={msg.id} className={cn("flex gap-2.5", msg.senderType === "admin" || msg.sender_type === "admin" ? "flex-row-reverse" : "")}>
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold",
                  (msg.senderType ?? msg.sender_type) === "admin" ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-400")}>
                  {(msg.senderType ?? msg.sender_type) === "admin" ? "د" : "م"}
                </div>
                <div className={cn("flex-1 max-w-[85%]", (msg.senderType ?? msg.sender_type) === "admin" ? "items-end" : "")}>
                  <div className={cn("rounded-xl p-3 text-sm leading-relaxed",
                    (msg.senderType ?? msg.sender_type) === "admin"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted/40 border border-border/30")}>
                    {msg.message}
                  </div>
                  <div className={cn("text-[9px] text-muted-foreground mt-1",
                    (msg.senderType ?? msg.sender_type) === "admin" ? "text-left" : "mr-1")}>
                    {msg.senderName ?? msg.sender_name} · {new Date(msg.createdAt ?? msg.created_at).toLocaleTimeString("ar-SA",{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Admin reply */}
          {!["closed","archived"].includes(selected.status) && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold">رد فريق الدعم</Label>
              <div className="flex gap-2">
                <Textarea value={adminReply} onChange={e => setAdminReply(e.target.value)}
                  rows={3} className="resize-none text-xs flex-1" placeholder="اكتب ردك على العميل..." />
                <Button size="icon" className="h-full aspect-square bg-primary hover:bg-primary/90 text-white self-stretch"
                  onClick={() => { if (adminReply.trim()) reply.mutate({ id: selected.id, message: adminReply }); }}
                  disabled={!adminReply.trim() || reply.isPending}>
                  {reply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="md:col-span-3 flex items-center justify-center h-52 text-muted-foreground">
          <div className="text-center">
            <HeadphonesIcon className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">اختر تذكرة لعرض المحادثة والرد عليها</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ANALYTICS PANEL
══════════════════════════════════════════════════════ */
const CHART_COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#06B6D4","#F97316","#EC4899"];

function AnalyticsPanel() {
  const { data: ana, isLoading } = useQuery<any>({
    queryKey: ["admin","support-analytics"],
    queryFn:  () => API("/support/analytics"),
    staleTime: 120_000,
  });

  if (isLoading) return <div className="py-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!ana) return <div className="py-12 text-center text-muted-foreground text-sm">لا توجد بيانات</div>;

  const ov = ana.overview ?? {};

  return (
    <div className="space-y-6" dir="rtl">
      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label:"إجمالي التذاكر",   val: ov.total,       icon:HeadphonesIcon, color:"text-blue-500" },
          { label:"مفتوحة",           val: ov.open,        icon:AlertCircle,    color:"text-amber-500" },
          { label:"محلولة",           val: ov.resolved,    icon:CheckCircle2,   color:"text-emerald-500" },
          { label:"تجاوز SLA",        val: ov.sla_breached,icon:AlertTriangle,  color:"text-red-500" },
        ].map(c => (
          <div key={c.label} className="p-4 rounded-xl border border-border/40 bg-card">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={cn("h-4 w-4", c.color)} />
              <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
            </div>
            <div className="text-2xl font-black">{c.val ?? 0}</div>
          </div>
        ))}
      </div>

      {/* CSAT + avg times */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-border/40 bg-card space-y-1">
          <p className="text-xs text-muted-foreground font-semibold">متوسط تقييم العملاء (CSAT)</p>
          <div className="text-3xl font-black text-amber-500">
            {ana.csat?.avg_csat ? `${ana.csat.avg_csat} / 5` : "—"}
          </div>
          <p className="text-[10px] text-muted-foreground">{ana.csat?.rated_count ?? 0} تقييم</p>
        </div>
        <div className="p-4 rounded-xl border border-border/40 bg-card space-y-1">
          <p className="text-xs text-muted-foreground font-semibold">متوسط أول رد</p>
          <div className="text-3xl font-black text-blue-500">
            {ana.avgTimes?.avg_first_response_hours ? `${ana.avgTimes.avg_first_response_hours}س` : "—"}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-border/40 bg-card space-y-1">
          <p className="text-xs text-muted-foreground font-semibold">متوسط وقت الحل</p>
          <div className="text-3xl font-black text-emerald-500">
            {ana.avgTimes?.avg_resolution_hours ? `${ana.avgTimes.avg_resolution_hours}س` : "—"}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* By category */}
        <div className="p-4 rounded-xl border border-border/40 bg-card">
          <p className="text-xs font-bold mb-3">التذاكر حسب الفئة</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ana.byCategory ?? []}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="n" fill="#3B82F6" radius={[4,4,0,0]} name="عدد" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily volume */}
        <div className="p-4 rounded-xl border border-border/40 bg-card">
          <p className="text-xs font-bold mb-3">حجم التذاكر اليومي (30 يوم)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={(ana.dailyVolume ?? []).slice().reverse()}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey="day" tick={{ fontSize:9 }} tickFormatter={(v:string) => v?.slice(5)} />
              <YAxis tick={{ fontSize:10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="n" stroke="#10B981" fill="#10B981" fillOpacity={0.15} name="تذاكر" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* By status */}
        <div className="p-4 rounded-xl border border-border/40 bg-card">
          <p className="text-xs font-bold mb-3">توزيع الحالات</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={ana.byStatus ?? []} dataKey="n" nameKey="status" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${S_MAP[name]?.label ?? name} ${(percent*100).toFixed(0)}%`}>
                {(ana.byStatus ?? []).map((_:any, i:number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(_v:any,name:string) => [undefined, S_MAP[name]?.label ?? name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top assigned */}
        <div className="p-4 rounded-xl border border-border/40 bg-card">
          <p className="text-xs font-bold mb-3">أكثر الموظفين إسناداً</p>
          {(ana.topAssigned ?? []).length === 0
            ? <p className="text-center text-muted-foreground text-xs py-8">لا يوجد إسناد بعد</p>
            : <div className="space-y-2">
                {(ana.topAssigned ?? []).map((a:any,i:number) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 text-xs font-medium">{a.assigned_to_name}</div>
                    <div className="text-xs text-muted-foreground">{a.n} تذكرة</div>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, (a.n / ((ana.topAssigned[0]?.n || 1))) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SLA VIOLATIONS PANEL
══════════════════════════════════════════════════════ */
function SLAPanel({ qc, toast }: any) {
  const { data: violations = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin","support-sla"],
    queryFn:  () => API("/support/sla-violations"),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">تذاكر تجاوزت SLA</h3>
          <p className="text-xs text-muted-foreground">التذاكر التي تجاوزت موعد الحل المتفق عليه</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 ml-1" /> تحديث
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (violations as any[]).length === 0 ? (
        <div className="py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">ممتاز! لا توجد تذاكر تجاوزت SLA</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(violations as any[]).map((v:any) => (
            <div key={v.id} className="p-3 rounded-xl border border-red-300/40 bg-red-50/30 dark:bg-red-950/20 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-sm">{v.subject}</span>
                <Badge className="bg-red-500/10 text-red-500 text-[9px] shrink-0">
                  متأخر {Math.round(v.hours_overdue ?? 0)}س
                </Badge>
              </div>
              <div className="text-[10px] text-muted-foreground flex gap-2 flex-wrap">
                <span>{v.user_name ?? v.userName}</span>
                <span>·</span>
                <span className={P_MAP[v.priority]?.color}>{P_MAP[v.priority]?.label}</span>
                <span>·</span>
                <span>{S_MAP[v.status]?.label}</span>
                {v.assigned_to_name && <><span>·</span><span className="text-primary">📌 {v.assigned_to_name}</span></>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   KNOWLEDGE BASE PANEL
══════════════════════════════════════════════════════ */
function KnowledgeBasePanel({ qc, toast }: any) {
  const { data: items = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["admin","support-kb"],
    queryFn:  () => API("/support/knowledge-base"),
  });
  const [form, setForm] = useState({ category:"", issue:"", fix:"" });
  const [showForm, setShowForm] = useState(false);

  const create = useMutation({
    mutationFn: (d:any) => API("/support/knowledge-base", { method:"POST", body: JSON.stringify(d) }),
    onSuccess: () => { refetch(); toast({ title:"تمت الإضافة ✓" }); setForm({ category:"", issue:"", fix:"" }); setShowForm(false); },
  });
  const del = useMutation({
    mutationFn: (id:string) => API(`/support/knowledge-base/${id}`, { method:"DELETE" }),
    onSuccess: () => { refetch(); toast({ title:"تم الحذف" }); },
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">قاعدة المعرفة ({(items as any[]).length})</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> إضافة
        </Button>
      </div>

      {showForm && (
        <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
          <Input placeholder="الفئة (مثال: تقني / فوترة)" value={form.category}
            onChange={e => setForm(f => ({...f, category: e.target.value}))} className="text-xs" />
          <Input placeholder="المشكلة / السؤال الشائع" value={form.issue}
            onChange={e => setForm(f => ({...f, issue: e.target.value}))} className="text-xs" />
          <Textarea placeholder="الحل / الإجابة" value={form.fix} rows={3}
            onChange={e => setForm(f => ({...f, fix: e.target.value}))} className="text-xs resize-none" />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1"
              disabled={!form.category||!form.issue||!form.fix||create.isPending}
              onClick={() => create.mutate(form)}>
              {create.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} حفظ
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      ) : (items as any[]).length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm opacity-60">لا توجد مقالات بعد</div>
      ) : (
        <div className="space-y-2">
          {(items as any[]).map((item:any) => (
            <div key={item.id} className="p-3 rounded-xl border border-border/50 hover:bg-muted/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[9px]">{item.category}</Badge>
                    <span className="text-[10px] text-muted-foreground">{item.hits ?? 0} مرات</span>
                  </div>
                  <p className="text-xs font-semibold">{item.issue}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{item.fix}</p>
                </div>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                  onClick={() => del.mutate(item.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   VISITORS PANEL
══════════════════════════════════════════════════════ */
function VisitorsPanel() {
  const { data: visitors = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin","support-visitors"],
    queryFn:  () => API("/support/visitors"),
  });

  return (
    <div className="space-y-4" dir="rtl">
      <h3 className="font-bold text-sm">ملفات الزوار ({(visitors as any[]).length})</h3>
      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      ) : (visitors as any[]).length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm opacity-60">لا توجد بيانات زوار</div>
      ) : (
        <div className="space-y-2">
          {(visitors as any[]).map((v:any) => (
            <div key={v.id} className="p-3 rounded-xl border border-border/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {v.name?.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold">{v.name}</p>
                  <p className="text-[10px] text-muted-foreground">{v.email ?? v.phone ?? "—"}</p>
                </div>
              </div>
              <div className="text-left text-[10px] text-muted-foreground">
                <p>{v.ticket_count} تذكرة</p>
                <p>{new Date(v.last_visit).toLocaleDateString("ar-SA")}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SETTINGS TAB
═══════════════════════════════════════════════════ */
