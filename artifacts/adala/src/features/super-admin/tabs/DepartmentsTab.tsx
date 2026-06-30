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
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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

export function DepartmentsTab({ qc, toast }: any) {
  const { data: depts = [], isLoading } = useAdmin<any[]>("/departments");
  const { data: titles = [] } = useAdmin<any[]>("/job-titles");
  const [dept, setDept] = useState(false);
  const [title, setTitle] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: "", nameEn: "", description: "", color: "#2563EB" });
  const [titleForm, setTitleForm] = useState({ name: "", nameEn: "", departmentId: "", level: "staff" });

  const addDept = useMutation({
    mutationFn: (d: any) => API("/departments", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/departments"] }); setDept(false); toast({ title: "تمت الإضافة ✓" }); },
  });
  const delDept = useMutation({
    mutationFn: (id: string) => API(`/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "/departments"] }),
  });
  const addTitle = useMutation({
    mutationFn: (d: any) => API("/job-titles", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/job-titles"] }); setTitle(false); toast({ title: "تمت الإضافة ✓" }); },
  });
  const delTitle = useMutation({
    mutationFn: (id: string) => API(`/job-titles/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "/job-titles"] }),
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Departments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">الأقسام</h3>
          <Button size="sm" className="gap-1" onClick={() => { setDeptForm({ name: "", nameEn: "", description: "", color: "#2563EB" }); setDept(true); }}><Plus className="h-3.5 w-3.5" /> قسم جديد</Button>
        </div>
        {isLoading ? <Loader2 className="animate-spin mx-auto h-5 w-5" /> : depts.map(d => (
          <div key={d.id} className="flex items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/20">
            <div className="h-3 w-3 rounded-full shrink-0" style={{ background: d.color ?? "#2563EB" }} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{d.name}</div>
              {d.nameEn && <div className="text-[10px] text-muted-foreground" dir="ltr">{d.nameEn}</div>}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => delDept.mutate(d.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>

      {/* Job Titles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">المسميات الوظيفية</h3>
          <Button size="sm" className="gap-1" onClick={() => { setTitleForm({ name: "", nameEn: "", departmentId: "", level: "staff" }); setTitle(true); }}><Plus className="h-3.5 w-3.5" /> مسمى جديد</Button>
        </div>
        {(titles as any[]).map((t: any) => (
          <div key={t.id} className="flex items-center gap-2 p-3 rounded-xl border border-border/50 hover:bg-muted/20">
            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{t.name}</div>
              {t.nameEn && <div className="text-[10px] text-muted-foreground" dir="ltr">{t.nameEn}</div>}
            </div>
            <Badge className="text-[9px] bg-muted text-muted-foreground">{t.level}</Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => delTitle.mutate(t.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>

      {/* Dept */}
      <AdaptiveDialog open={dept} onOpenChange={setDept}>
        <AdaptiveDialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>قسم جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">الاسم (عربي) *</Label><Input value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">Name (English)</Label><Input value={deptForm.nameEn} onChange={e => setDeptForm(f => ({ ...f, nameEn: e.target.value }))} dir="ltr" /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">الوصف</Label><Input value={deptForm.description} onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">اللون</Label><input type="color" value={deptForm.color} onChange={e => setDeptForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-full rounded-md border border-input cursor-pointer" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDept(false)}>إلغاء</Button>
            <Button disabled={!deptForm.name || addDept.isPending} onClick={() => addDept.mutate(deptForm)} className="gap-2">
              {addDept.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إضافة
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* Title */}
      <AdaptiveDialog open={title} onOpenChange={setTitle}>
        <AdaptiveDialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>مسمى وظيفي جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">الاسم (عربي) *</Label><Input value={titleForm.name} onChange={e => setTitleForm(f => ({ ...f, name: e.target.value }))} placeholder="محامٍ أول" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">Name (English)</Label><Input value={titleForm.nameEn} onChange={e => setTitleForm(f => ({ ...f, nameEn: e.target.value }))} dir="ltr" placeholder="Senior Lawyer" /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">القسم</Label>
              <Select value={titleForm.departmentId} onValueChange={v => setTitleForm(f => ({ ...f, departmentId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر قسماً" /></SelectTrigger>
                <SelectContent>{(depts as any[]).map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">المستوى</Label>
              <Select value={titleForm.level} onValueChange={v => setTitleForm(f => ({ ...f, level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">تنفيذي</SelectItem>
                  <SelectItem value="manager">مدير</SelectItem>
                  <SelectItem value="senior">أول</SelectItem>
                  <SelectItem value="staff">موظف</SelectItem>
                  <SelectItem value="intern">متدرب</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTitle(false)}>إلغاء</Button>
            <Button disabled={!titleForm.name || addTitle.isPending} onClick={() => addTitle.mutate(titleForm)} className="gap-2">
              {addTitle.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إضافة
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   LEGAL SYSTEMS TAB
═══════════════════════════════════════════════════ */
