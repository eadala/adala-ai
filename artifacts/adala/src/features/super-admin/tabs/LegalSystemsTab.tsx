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

export function LegalSystemsTab({ qc, toast }: any) {
  const { data: items = [], isLoading } = useAdmin<any[]>("/legal-systems");
  const [dialog, setDialog] = useState<any>(null);
  const [form, setForm] = useState({ title: "", titleEn: "", category: "نظام", content: "", source: "", effectiveDate: "", version: "", isActive: true });

  const save = useMutation({
    mutationFn: (d: any) => dialog?.id
      ? API(`/legal-systems/${dialog.id}`, { method: "PATCH", body: JSON.stringify(d) })
      : API("/legal-systems", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/legal-systems"] }); setDialog(null); toast({ title: "تم الحفظ ✓" }); },
  });

  const del = useMutation({
    mutationFn: (id: string) => API(`/legal-systems/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "/legal-systems"] }); toast({ title: "تم الحذف" }); },
  });

  const CATS = ["نظام", "لائحة", "حكم قضائي", "قرار وزاري", "تعميم", "اتفاقية", "تحديث"];

  return (
    <div className="space-y-3">
      <Button size="sm" className="gap-1.5" onClick={() => { setForm({ title: "", titleEn: "", category: "نظام", content: "", source: "", effectiveDate: "", version: "", isActive: true }); setDialog({}); }}>
        <Plus className="h-4 w-4" /> إضافة نظام/حكم
      </Button>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <div className="space-y-2">
          {items.map(item => (
            <Card key={item.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-bold text-sm">{item.title}</span>
                      <Badge className="text-[9px] bg-muted text-muted-foreground">{item.category}</Badge>
                      {!item.isActive && <Badge className="text-[9px] bg-red-500/10 text-red-400">معطل</Badge>}
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      {item.source && <span>المصدر: {item.source}</span>}
                      {item.effectiveDate && <span>النفاذ: {item.effectiveDate}</span>}
                      {item.version && <span>الإصدار: {item.version}</span>}
                      <span>{item.viewCount} مشاهدة</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm({ ...item }); setDialog(item); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => del.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">لا توجد أنظمة — أضف أول نظام أو حكم</p>}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={() => setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog?.id ? "تعديل" : "إضافة نظام / حكم"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">العنوان (عربي) *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label className="text-xs font-semibold mb-1 block">Title (English)</Label><Input value={form.titleEn} onChange={e => setForm(f => ({ ...f, titleEn: e.target.value }))} dir="ltr" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs font-semibold mb-1 block">التصنيف</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs font-semibold mb-1 block">الإصدار</Label><Input value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.0" /></div>
              <div><Label className="text-xs font-semibold mb-1 block">تاريخ النفاذ</Label><Input value={form.effectiveDate} onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} placeholder="1446/01/01" /></div>
            </div>
            <div><Label className="text-xs font-semibold mb-1 block">المصدر</Label><Input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="وزارة العدل، مجلس الوزراء..." /></div>
            <div><Label className="text-xs font-semibold mb-1 block">المحتوى / ملخص النظام</Label>
              <Textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} className="resize-none text-xs" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} /><Label className="text-xs">نشط وظاهر للمستخدمين</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>إلغاء</Button>
            <Button disabled={!form.title || save.isPending} onClick={() => save.mutate(form)} className="gap-2">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SUPPORT TICKETS TAB
═══════════════════════════════════════════════════ */
