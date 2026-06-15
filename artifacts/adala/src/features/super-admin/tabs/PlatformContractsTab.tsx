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

const CONTRACT_STATUS: Record<string, {label: string; color: string}> = {
  draft:     { label: "مسودة",  color: "bg-muted text-muted-foreground" },
  review:    { label: "مراجعة", color: "bg-amber-500/15 text-amber-400" },
  signed:    { label: "موقع",   color: "bg-green-500/15 text-green-400" },
  expired:   { label: "منتهي",  color: "bg-red-500/15 text-red-400" },
  cancelled: { label: "ملغي",   color: "bg-gray-500/15 text-gray-400" },
};

export function PlatformContractsTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: contracts = [], isLoading } = useQuery<any[]>({
    queryKey: ["admin", "/contracts", statusFilter],
    queryFn: () => API(`/contracts?status=${statusFilter}`),
    staleTime: 30_000,
  });

  const filtered = (contracts as any[]).filter(c =>
    !search || c.title?.includes(search)
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في العقود..." className="w-full h-9 pr-9 pl-3 rounded-lg bg-muted/40 text-sm border border-border/40 focus:outline-none focus:ring-1 focus:ring-[#2563EB]" />
        </div>
        {["all","draft","review","signed","expired"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", statusFilter===s ? "bg-primary text-black border-primary font-bold" : "border-border/50 text-muted-foreground hover:bg-muted/30")}>
            {s==="all"?"الكل":CONTRACT_STATUS[s]?.label??s}
          </button>
        ))}
        <Badge variant="outline" className="text-xs mr-auto">{filtered.length} عقد</Badge>
      </div>

      <Card className="bg-card border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-right text-xs">العنوان</TableHead>
              <TableHead className="text-right text-xs">النوع</TableHead>
              <TableHead className="text-right text-xs">الحالة</TableHead>
              <TableHead className="text-right text-xs">مولَّد بـ AI</TableHead>
              <TableHead className="text-right text-xs">مستوى الخطورة</TableHead>
              <TableHead className="text-right text-xs">تاريخ الإنشاء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">لا توجد عقود</TableCell></TableRow>
            ) : filtered.map((c: any) => {
              const st = CONTRACT_STATUS[c.status] ?? { label: c.status, color: "bg-muted text-muted-foreground" };
              const risk = { low: { label: "منخفض", color: "text-green-400" }, medium: { label: "متوسط", color: "text-amber-400" }, high: { label: "عالٍ", color: "text-red-400" } } as any;
              return (
                <TableRow key={c.id} className="hover:bg-muted/20">
                  <TableCell className="text-sm font-medium max-w-52 truncate">{c.title}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.type}</TableCell>
                  <TableCell><Badge className={cn("text-[10px]", st.color)}>{st.label}</Badge></TableCell>
                  <TableCell className="text-center">{c.ai_generated ? <CheckSquare className="h-4 w-4 text-primary mx-auto" /> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                  <TableCell className={cn("text-xs font-medium", risk[c.risk_score]?.color ?? "text-muted-foreground")}>{risk[c.risk_score]?.label ?? (c.risk_score ?? "—")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ar-SA")}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   PLATFORM FINANCE TAB
═══════════════════════════════════════════════════ */
