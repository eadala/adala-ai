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

export function AiKeysTab({ qc, toast }: any) {
  const { data: keys = [], isLoading } = useAdmin<any[]>("/ai-keys");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ provider: "openai", keyLabel: "", keyValue: "" });
  const [showKey, setShowKey] = useState(false);

  const add = useMutation({
    mutationFn: (d: any) => API("/ai-keys", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/ai-keys"] }); setShowForm(false); setForm({ provider: "openai", keyLabel: "", keyValue: "" }); toast({ title: "تم إضافة المفتاح ✓" }); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: any) => API(`/ai-keys/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "/ai-keys"] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => API(`/ai-keys/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/ai-keys"] }); toast({ title: "تم الحذف" }); },
  });

  const PROVIDERS = [
    { value: "openai", label: "OpenAI", color: "#10A37F" },
    { value: "anthropic", label: "Anthropic", color: "#D97706" },
    { value: "gemini", label: "Google Gemini", color: "#4285F4" },
    { value: "groq", label: "Groq", color: "#F97316" },
  ];

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}><Plus className="h-4 w-4" /> إضافة مفتاح AI</Button>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <div className="space-y-2">
          {keys.map(k => {
            const prov = PROVIDERS.find(p => p.value === k.provider);
            return (
              <Card key={k.id} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-black" style={{ background: `${prov?.color}20`, color: prov?.color }}>{k.provider.slice(0, 2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-sm">{k.keyLabel}</span>
                        <Badge className="text-[9px] bg-muted text-muted-foreground">{prov?.label ?? k.provider}</Badge>
                        {k.isActive && <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">نشط</Badge>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <code dir="ltr">{k.keyMasked}</code>
                        <span>•</span>
                        <span>{k.usageCount.toLocaleString()} استخدام</span>
                        <span>•</span>
                        <span>${k.totalCost.toFixed(4)} تكلفة</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle.mutate({ id: k.id, isActive: !k.isActive })}>
                        {k.isActive ? <ToggleRight className="h-4 w-4 text-emerald-400" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => del.mutate(k.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {keys.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">لا توجد مفاتيح — أضف مفتاح API أول</p>}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>إضافة مفتاح AI</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs font-semibold mb-1 block">المزود</Label>
              <Select value={form.provider} onValueChange={v => setForm(f => ({ ...f, provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">تسمية المفتاح</Label>
              <Input value={form.keyLabel} onChange={e => setForm(f => ({ ...f, keyLabel: e.target.value }))} placeholder="مفتاح الإنتاج — OpenAI" /></div>
            <div><Label className="text-xs font-semibold mb-1 block">المفتاح السري *</Label>
              <div className="relative">
                <Input value={form.keyValue} onChange={e => setForm(f => ({ ...f, keyValue: e.target.value }))} dir="ltr" type={showKey ? "text" : "password"} className="font-mono text-xs pl-10" placeholder="sk-..." />
                <button onClick={() => setShowKey(v => !v)} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">يُخزَّن مشفراً — لن يظهر مجدداً كاملاً</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>إلغاء</Button>
            <Button disabled={!form.keyValue || !form.keyLabel || add.isPending} onClick={() => add.mutate(form)} className="gap-2">
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   USAGE TAB
═══════════════════════════════════════════════════ */
