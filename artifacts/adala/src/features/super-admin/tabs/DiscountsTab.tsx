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
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
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

export function DiscountsTab({ qc, toast }: any) {
  const { data: codes = [], isLoading } = useAdmin<any[]>("/discounts");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", type: "percent", value: 10, maxUses: 100, isActive: true });

  const add = useMutation({
    mutationFn: (d: any) => API("/discounts", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/discounts"] }); setShowForm(false); toast({ title: "تم الإنشاء ✓" }); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: any) => API(`/discounts/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "/discounts"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => API(`/discounts/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/discounts"] }); toast({ title: "تم الحذف" }); },
  });

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> كود خصم جديد</Button>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-right text-xs">الكود</TableHead>
                <TableHead className="text-right text-xs">النوع</TableHead>
                <TableHead className="text-right text-xs">القيمة</TableHead>
                <TableHead className="text-right text-xs">الاستخدام</TableHead>
                <TableHead className="text-right text-xs">الحالة</TableHead>
                <TableHead className="text-right text-xs">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map(c => (
                <TableRow key={c.id} className="hover:bg-muted/20">
                  <TableCell><code className="font-mono font-bold text-primary text-sm bg-primary/5 px-2 py-0.5 rounded">{c.code}</code></TableCell>
                  <TableCell className="text-xs">{c.type === "percent" ? "نسبة مئوية" : "مبلغ ثابت"}</TableCell>
                  <TableCell className="font-bold text-sm">{c.type === "percent" ? `${c.value}%` : `${c.value} ر.س`}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.usedCount} / {c.maxUses}</TableCell>
                  <TableCell>
                    <Badge className={cn("text-[9px]", c.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {c.isActive ? "نشط" : "معطل"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle.mutate({ id: c.id, isActive: !c.isActive })}>
                        {c.isActive ? <ToggleRight className="h-3.5 w-3.5 text-emerald-400" /> : <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => del.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AdaptiveDialog open={showForm} onOpenChange={setShowForm}>
        <AdaptiveDialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>كود خصم جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">الكود *</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME20" dir="ltr" className="font-mono" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">النوع</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="percent">نسبة %</SelectItem><SelectItem value="fixed">مبلغ ثابت</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">القيمة</Label>
                <Input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: Number(e.target.value) }))} /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">الحد الأقصى للاستخدامات</Label>
              <Input type="number" value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: Number(e.target.value) }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button disabled={!form.code || add.isPending} onClick={() => add.mutate(form)} className="gap-2">
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إنشاء
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AI API KEYS TAB
═══════════════════════════════════════════════════ */
