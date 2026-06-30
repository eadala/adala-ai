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

export function SettingsTab({ qc, toast }: any) {
  const { data: settings = [], isLoading, refetch } = useAdmin<any[]>("/settings");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [newForm, setNewForm] = useState({ key: "", label: "", value: "", description: "", group: "general" });
  const [showNew, setShowNew] = useState(false);

  const save = useMutation({
    mutationFn: ({ key, value }: any) => API(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
    onSuccess: () => { refetch(); setEditKey(null); toast({ title: "تم الحفظ ✓" }); },
  });

  const addNew = useMutation({
    mutationFn: (d: any) => API("/settings", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { refetch(); setShowNew(false); toast({ title: "تمت الإضافة ✓" }); },
  });

  const GROUPS: Record<string, string> = { general: "عام", payment: "الدفع", ai: "الذكاء الاصطناعي", email: "البريد الإلكتروني", security: "الأمان" };
  const grouped = (settings as any[]).reduce((acc: any, s: any) => { (acc[s.group] = acc[s.group] ?? []).push(s); return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">إعدادات المنصة</h3>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowNew(true)}><Plus className="h-3.5 w-3.5" /> إعداد جديد</Button>
      </div>

      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : Object.entries(grouped).map(([group, groupSettings]: any) => (
        <div key={group}>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{GROUPS[group] ?? group}</h4>
          <div className="space-y-1">
            {groupSettings.map((s: any) => (
              <div key={s.key} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/10 group">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{s.label}</div>
                  {s.description && <div className="text-[10px] text-muted-foreground">{s.description}</div>}
                </div>
                {editKey === s.key ? (
                  <div className="flex items-center gap-2">
                    <Input value={editVal} onChange={e => setEditVal(e.target.value)} className="h-7 text-xs w-48" dir="ltr" />
                    <Button size="icon" className="h-7 w-7" onClick={() => save.mutate({ key: s.key, value: editVal })}><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditKey(null)}><X className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground max-w-[180px] truncate" dir="ltr">{s.value || "—"}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { setEditKey(s.key); setEditVal(s.value); }}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Default settings prompt */}
      {(settings as any[]).length === 0 && !isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          <Settings className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">لا توجد إعدادات بعد — أضف إعداداً للبدء</p>
        </div>
      )}

      <AdaptiveDialog open={showNew} onOpenChange={setShowNew}>
        <AdaptiveDialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>إعداد جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">المفتاح (key) *</Label><Input value={newForm.key} onChange={e => setNewForm(f => ({ ...f, key: e.target.value }))} dir="ltr" placeholder="site_name" className="font-mono text-xs" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">التسمية *</Label><Input value={newForm.label} onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))} placeholder="اسم المنصة" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">القيمة</Label><Input value={newForm.value} onChange={e => setNewForm(f => ({ ...f, value: e.target.value }))} dir="ltr" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">الوصف</Label><Input value={newForm.description} onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label className="text-xs font-semibold mb-1 block">المجموعة</Label>
              <Select value={newForm.group} onValueChange={v => setNewForm(f => ({ ...f, group: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(GROUPS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>إلغاء</Button>
            <Button disabled={!newForm.key || !newForm.label || addNew.isPending} onClick={() => addNew.mutate(newForm)} className="gap-2">
              {addNew.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إضافة
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DEVELOPER CENTER TAB
═══════════════════════════════════════════════════ */
