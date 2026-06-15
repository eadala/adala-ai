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
import { StatCard } from "../shared/components";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";

export function SupportTab({ qc, toast }: any) {
  const { data: tickets = [], isLoading } = useAdmin<any[]>("/support");
  const [selected, setSelected] = useState<any>(null);
  const [adminReply, setAdminReply] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: threadMsgs = [], refetch: refetchThread } = useQuery<any[]>({
    queryKey: ["admin", "support-thread", selected?.id],
    queryFn: () => API(`/support/${selected.id}/messages`),
    enabled: !!selected?.id,
    refetchInterval: 25_000,
  });

  const update = useMutation({
    mutationFn: ({ id, ...d }: any) => API(`/support/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/support"] }); toast({ title: "تم التحديث ✓" }); },
  });

  const reply = useMutation({
    mutationFn: ({ id, message }: any) => API(`/support/${id}/reply`, { method: "POST", body: JSON.stringify({ message }) }),
    onSuccess: () => {
      setAdminReply("");
      qc.invalidateQueries({ queryKey: ["admin", "/support"] });
      refetchThread();
      toast({ title: "تم إرسال الرد ✓" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = tickets.filter((t: any) => filterStatus === "all" || t.status === filterStatus);

  const PRIORITY = {
    low:    { label: "منخفض", color: "text-gray-400" },
    medium: { label: "متوسط", color: "text-yellow-400" },
    high:   { label: "عالٍ",  color: "text-orange-400" },
    urgent: { label: "عاجل",  color: "text-red-400" },
  };
  const STATUS = {
    open:        { label: "مفتوح",          color: "bg-blue-500/10 text-blue-400" },
    in_progress: { label: "قيد المعالجة",   color: "bg-yellow-500/10 text-yellow-400" },
    resolved:    { label: "محلول",          color: "bg-emerald-500/10 text-emerald-400" },
    closed:      { label: "مغلق",           color: "bg-muted text-muted-foreground" },
  };

  return (
    <div className="grid md:grid-cols-5 gap-4">
      {/* List — 2 cols */}
      <div className="md:col-span-2 space-y-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-muted-foreground">
            {filtered.length} تذكرة
          </span>
          <div className="flex gap-1 flex-wrap">
            {["all", "open", "in_progress", "resolved", "closed"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn("text-[10px] px-2 py-0.5 rounded-md border transition-colors",
                  filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
                {s === "all" ? "الكل" : (STATUS as any)[s]?.label}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm opacity-60">لا توجد تذاكر</div>
        ) : filtered.map((t: any) => (
          <div key={t.id}
            onClick={() => { setSelected(t); setAdminReply(""); }}
            className={cn("p-3 rounded-xl border cursor-pointer transition-all",
              selected?.id === t.id
                ? "border-primary/40 bg-primary/5 shadow-sm"
                : "border-border/50 hover:bg-muted/20")}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="font-semibold text-sm line-clamp-1">{t.subject}</span>
              <Badge className={cn("text-[9px] shrink-0 px-1.5", (STATUS as any)[t.status]?.color)}>
                {(STATUS as any)[t.status]?.label}
              </Badge>
            </div>
            <div className="text-[10px] text-muted-foreground flex flex-wrap gap-1.5">
              <span className="font-medium">{t.userName}</span>
              <span>·</span>
              <span className={(PRIORITY as any)[t.priority]?.color}>{(PRIORITY as any)[t.priority]?.label}</span>
              <span>·</span>
              <span>{new Date(t.createdAt).toLocaleDateString("ar-SA")}</span>
            </div>
            {t.officeName && <div className="text-[10px] text-muted-foreground mt-0.5 opacity-60">{t.officeName}</div>}
          </div>
        ))}
      </div>

      {/* Detail + Thread — 3 cols */}
      {selected ? (
        <div className="md:col-span-3 space-y-3">
          {/* Ticket info */}
          <div className="p-4 rounded-xl border border-border/50 bg-muted/10">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold text-sm">{selected.subject}</h3>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                  <span>{selected.userName}</span>
                  <span>·</span>
                  <span>{selected.userEmail}</span>
                  {selected.officeName && <><span>·</span><span className="text-primary">{selected.officeName}</span></>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                  onClick={() => update.mutate({ id: selected.id, status: "in_progress" })}>
                  <Clock className="h-3 w-3 ml-1" /> معالجة
                </Button>
                <Button size="sm" className="h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => update.mutate({ id: selected.id, status: "resolved" })}>
                  <CheckCircle2 className="h-3 w-3 ml-1" /> حل
                </Button>
              </div>
            </div>
          </div>

          {/* Message thread */}
          <div className="space-y-2.5 max-h-[320px] overflow-y-auto px-1 py-1">
            {/* Original message */}
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-[9px] font-bold text-blue-400">
                م
              </div>
              <div className="flex-1 max-w-[85%]">
                <div className="rounded-xl p-3 text-sm bg-muted/40 border border-border/30 leading-relaxed">
                  {selected.body}
                </div>
                <div className="text-[9px] text-muted-foreground mt-1 mr-1">
                  {selected.userName} · {new Date(selected.createdAt).toLocaleDateString("ar-SA")}
                </div>
              </div>
            </div>

            {/* Thread messages */}
            {threadMsgs.map((msg: any) => (
              <div key={msg.id} className={cn("flex gap-2.5", msg.senderType === "admin" ? "flex-row-reverse" : "")}>
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold",
                  msg.senderType === "admin" ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-400")}>
                  {msg.senderType === "admin" ? "د" : "م"}
                </div>
                <div className={cn("flex-1 max-w-[85%]", msg.senderType === "admin" ? "items-end" : "")}>
                  <div className={cn("rounded-xl p-3 text-sm leading-relaxed",
                    msg.senderType === "admin"
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted/40 border border-border/30")}>
                    {msg.message}
                  </div>
                  <div className={cn("text-[9px] text-muted-foreground mt-1", msg.senderType === "admin" ? "text-left" : "mr-1")}>
                    {msg.senderName} · {new Date(msg.createdAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Admin reply input */}
          {selected.status !== "closed" && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-semibold">رد فريق الدعم</Label>
              <div className="flex gap-2">
                <Textarea value={adminReply} onChange={e => setAdminReply(e.target.value)}
                  rows={3} className="resize-none text-xs flex-1" placeholder="اكتب ردك على العميل..." />
                <Button size="icon" className="h-full aspect-square bg-primary hover:bg-[#b8973d] text-[#FFFFFF] self-stretch"
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

/* ═══════════════════════════════════════════════════
   SETTINGS TAB
═══════════════════════════════════════════════════ */
