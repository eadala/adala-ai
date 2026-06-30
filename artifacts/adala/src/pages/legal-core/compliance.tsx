import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Clock, Plus,
  RefreshCw, Loader2, FileText, Calendar, ChevronDown, ChevronUp,
  Lock, Globe, CreditCard, Users, Building2, Scale, Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const FRAMEWORKS = [
  {
    key: "pdpl",
    name: "نظام حماية البيانات الشخصية (PDPL)",
    icon: Lock,
    color: "#6366F1",
    ref: "م/19 لعام 1443هـ",
    items: [
      { id: "p1", text: "تعيين مسؤول حماية البيانات (DPO)", status: "done", priority: "high", notes: "تم التعيين في يناير 2024" },
      { id: "p2", text: "إعداد سياسة الخصوصية ونشرها", status: "done", priority: "high", notes: "محدّثة آخر مرة فبراير 2024" },
      { id: "p3", text: "الحصول على موافقة صريحة لجمع البيانات", status: "done", priority: "high", notes: "" },
      { id: "p4", text: "تأمين قاعدة بيانات العملاء بالتشفير", status: "partial", priority: "high", notes: "تشفير قواعد البيانات مكتمل — الملفات جارية" },
      { id: "p5", text: "إجراء تقييم أثر حماية البيانات (DPIA)", status: "pending", priority: "medium", notes: "" },
      { id: "p6", text: "إجراءات الإبلاغ عن اختراق البيانات خلال 72 ساعة", status: "partial", priority: "high", notes: "الإجراء مكتوب — لم يُختبر بعد" },
      { id: "p7", text: "تدريب الموظفين على حماية البيانات", status: "pending", priority: "medium", notes: "" },
    ],
  },
  {
    key: "aml",
    name: "مكافحة غسل الأموال (AML/KYC)",
    icon: Shield,
    color: "#10B981",
    ref: "م/20 لعام 1439هـ",
    items: [
      { id: "a1", text: "تطبيق إجراءات اعرف عميلك (KYC)", status: "done", priority: "high", notes: "مطبّق لجميع العملاء الجدد" },
      { id: "a2", text: "برنامج المراقبة المستمرة للمعاملات", status: "partial", priority: "high", notes: "يدوي حالياً — يجب أتمتته" },
      { id: "a3", text: "الإبلاغ عن المعاملات المشبوهة (STR)", status: "done", priority: "high", notes: "" },
      { id: "a4", text: "مراجعة قوائم العقوبات والحظر", status: "partial", priority: "high", notes: "اشتراك في قاعدة بيانات منتهي الصلاحية" },
      { id: "a5", text: "تدريب سنوي لمكافحة غسل الأموال", status: "pending", priority: "medium", notes: "مقرر في الربع الثالث" },
    ],
  },
  {
    key: "nafis",
    name: "الامتثال لنظام العمل والسعودة",
    icon: Users,
    color: "#F59E0B",
    ref: "وزارة الموارد البشرية",
    items: [
      { id: "n1", text: "الالتزام بنسب السعودة (نطاقات)", status: "done", priority: "high", notes: "النطاق الأخضر محقق" },
      { id: "n2", text: "تسجيل العمال في التأمينات الاجتماعية", status: "done", priority: "high", notes: "" },
      { id: "n3", text: "الالتزام بنظام حماية الأجور (WPS)", status: "done", priority: "high", notes: "دفع إلكتروني منتظم" },
      { id: "n4", text: "تحديث عقود العمل وفق التعديلات الأخيرة", status: "partial", priority: "medium", notes: "3 عقود تحتاج تحديث" },
      { id: "n5", text: "التأشيرات والإقامات لغير السعوديين", status: "pending", priority: "low", notes: "" },
    ],
  },
  {
    key: "license",
    name: "تراخيص ممارسة المهنة القانونية",
    icon: Scale,
    color: "#2563EB",
    ref: "وزارة العدل / هيئة المحامين",
    items: [
      { id: "l1", text: "ترخيص ممارسة المهنة للمحامين", status: "done", priority: "high", notes: "ساري حتى 2025" },
      { id: "l2", text: "الاشتراك في هيئة المحامين السعوديين", status: "done", priority: "high", notes: "" },
      { id: "l3", text: "التطوير المهني المستمر (CPD) — 20 ساعة/سنة", status: "partial", priority: "medium", notes: "12 ساعة مكتملة — 8 متبقية" },
      { id: "l4", text: "سجل التوكيلات والتمثيل القانوني", status: "done", priority: "medium", notes: "" },
      { id: "l5", text: "تجديد الرخصة قبل 30 يوماً من انتهائها", status: "pending", priority: "high", notes: "موعد التجديد: مارس 2025" },
    ],
  },
];

const STATUS_CONFIG = {
  done: { label: "مكتمل", icon: CheckCircle2, color: "#10B981", bg: "bg-emerald-500/10 border-emerald-500/20" },
  partial: { label: "جزئي", icon: Clock, color: "#F59E0B", bg: "bg-yellow-500/10 border-yellow-500/20" },
  pending: { label: "معلّق", icon: XCircle, color: "#EF4444", bg: "bg-red-500/10 border-red-500/20" },
};

const PRIORITY_CONFIG = {
  high: { label: "أولوية عالية", color: "#EF4444" },
  medium: { label: "أولوية متوسطة", color: "#F59E0B" },
  low: { label: "أولوية منخفضة", color: "#10B981" },
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function FrameworkCard({ fw, savedStatuses, onStatusChange }: {
  fw: typeof FRAMEWORKS[0];
  savedStatuses: Record<string, string>;
  onStatusChange: (frameworkKey: string, itemId: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();

  const getStatus = (item: typeof fw.items[0]) =>
    savedStatuses[`${fw.key}:${item.id}`] ?? item.status;

  const done = fw.items.filter(i => getStatus(i) === "done").length;
  const total = fw.items.length;
  const pct = Math.round((done / total) * 100);

  const updateItem = async (itemId: string, newStatus: string) => {
    onStatusChange(fw.key, itemId, newStatus);
    try {
      await fetch(`${BASE}/api/compliance/items/${fw.key}/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      toast({ title: "✅ تم تحديث الحالة وحفظها" });
    } catch {
      toast({ title: "⚠️ تعذّر الحفظ — تم التحديث محلياً", variant: "destructive" });
    }
  };

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full text-right">
        <CardHeader className="pb-3 hover:bg-muted/20 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${fw.color}18` }}>
                <fw.icon className="h-4.5 w-4.5" style={{ color: fw.color }} />
              </div>
              <div>
                <CardTitle className="text-sm font-bold leading-tight">{fw.name}</CardTitle>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fw.ref}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-left">
                <div className="text-sm font-black" style={{ color: fw.color }}>{pct}%</div>
                <div className="text-[10px] text-muted-foreground">{done}/{total} مكتمل</div>
              </div>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
          <Progress value={pct} className="h-1.5 mt-2" />
        </CardHeader>
      </button>

      {expanded && (
        <CardContent className="pt-0 pb-4">
          <div className="space-y-2">
            {fw.items.map(item => {
              const currentStatus = getStatus(item);
              const s = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
              const p = PRIORITY_CONFIG[item.priority as keyof typeof PRIORITY_CONFIG];
              const StatusIcon = s.icon;
              return (
                <div key={item.id} className={cn("flex items-start gap-3 p-3 rounded-xl border transition-all", s.bg)}>
                  <StatusIcon className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: s.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs font-medium flex-1">{item.text}</span>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Badge className="text-[9px] px-1.5 py-0" style={{ background: `${p.color}15`, color: p.color, border: `1px solid ${p.color}30` }}>{p.label}</Badge>
                        <Badge className="text-[9px] px-1.5 py-0" style={{ background: `${s.color}15`, color: s.color, border: `1px solid ${s.color}30` }}>{s.label}</Badge>
                      </div>
                    </div>
                    {item.notes && <p className="text-[10px] text-muted-foreground mt-1">{item.notes}</p>}
                  </div>
                  <Select value={currentStatus} onValueChange={v => updateItem(item.id, v)}>
                    <SelectTrigger className="h-6 w-[80px] text-[10px] flex-shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="done">مكتمل</SelectItem>
                      <SelectItem value="partial">جزئي</SelectItem>
                      <SelectItem value="pending">معلّق</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function Compliance() {
  const [filterStatus, setFilterStatus] = useState("all");
  // saved: { "framework_key:item_id" → status }
  const [savedStatuses, setSavedStatuses] = useState<Record<string, string>>({});

  // Load saved statuses from DB on mount
  const { data: dbItems = [] } = useQuery<{ framework_key: string; item_id: string; status: string }[]>({
    queryKey: ["compliance-items"],
    queryFn: () => fetch(`${BASE}/api/compliance/items`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
  });

  // Merge DB statuses into savedStatuses map whenever dbItems changes
  useEffect(() => {
    if (dbItems.length === 0) return;
    const map: Record<string, string> = {};
    for (const row of dbItems) map[`${row.framework_key}:${row.item_id}`] = row.status;
    setSavedStatuses(map);
  }, [dbItems.length]);

  // Optimistic update handler
  const handleStatusChange = (frameworkKey: string, itemId: string, status: string) => {
    setSavedStatuses(prev => ({ ...prev, [`${frameworkKey}:${itemId}`]: status }));
  };

  const getEffectiveStatus = (fw: typeof FRAMEWORKS[0], item: typeof fw.items[0]) =>
    savedStatuses[`${fw.key}:${item.id}`] ?? item.status;

  const allItems = FRAMEWORKS.flatMap(fw => fw.items.map(i => ({
    ...i, framework: fw.name, color: fw.color,
    effectiveStatus: getEffectiveStatus(fw, i),
  })));
  const totalDone    = allItems.filter(i => i.effectiveStatus === "done").length;
  const totalPartial = allItems.filter(i => i.effectiveStatus === "partial").length;
  const totalPending = allItems.filter(i => i.effectiveStatus === "pending").length;
  const overallPct   = Math.round((totalDone / allItems.length) * 100);

  const filteredFrameworks = filterStatus === "all" ? FRAMEWORKS : FRAMEWORKS.map(fw => ({
    ...fw,
    items: fw.items.filter(i => getEffectiveStatus(fw, i) === filterStatus),
  })).filter(fw => fw.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">الامتثال القانوني</h1>
          <p className="text-muted-foreground text-sm">متابعة متطلبات الامتثال التنظيمي والمهني</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold">
          <Shield className="h-4 w-4 text-primary" />
          <span>الامتثال الكلي:</span>
          <span className="text-primary">{overallPct}%</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-black text-primary mb-1">{overallPct}%</div>
            <div className="text-xs text-muted-foreground">الامتثال الكلي</div>
            <Progress value={overallPct} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            <div><div className="text-2xl font-black text-emerald-400">{totalDone}</div><div className="text-xs text-muted-foreground">مكتمل</div></div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-400" />
            <div><div className="text-2xl font-black text-yellow-400">{totalPartial}</div><div className="text-xs text-muted-foreground">جزئي</div></div>
          </CardContent>
        </Card>
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-400" />
            <div><div className="text-2xl font-black text-red-400">{totalPending}</div><div className="text-xs text-muted-foreground">معلّق</div></div>
          </CardContent>
        </Card>
      </div>

      {/* Framework scores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {FRAMEWORKS.map(fw => {
          const done = fw.items.filter(i => getEffectiveStatus(fw, i) === "done").length;
          const pct = Math.round((done / fw.items.length) * 100);
          return (
            <div key={fw.key} className="p-3 bg-card/50 rounded-xl border border-border/50 text-center">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: `${fw.color}18` }}>
                <fw.icon className="h-4 w-4" style={{ color: fw.color }} />
              </div>
              <div className="text-lg font-black" style={{ color: fw.color }}>{pct}%</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{fw.name.split("(")[0].trim()}</div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: "all", l: "الكل" },
          { v: "done", l: "مكتمل" },
          { v: "partial", l: "جزئي" },
          { v: "pending", l: "معلّق" },
        ].map(f => (
          <button key={f.v} onClick={() => setFilterStatus(f.v)}
            className={cn("text-xs px-4 py-1.5 rounded-xl border font-medium transition-all",
              filterStatus === f.v ? "bg-primary/10 border-primary text-primary" : "border-muted text-muted-foreground hover:border-primary/30")}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Frameworks */}
      <div className="space-y-4">
        {filteredFrameworks.map(fw => (
          <FrameworkCard key={fw.key} fw={fw} savedStatuses={savedStatuses} onStatusChange={handleStatusChange} />
        ))}
      </div>

      {/* Pending highlights */}
      {filterStatus === "all" && totalPending > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" /> متطلبات تحتاج إجراءً عاجلاً
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allItems.filter(i => i.status === "pending" && i.priority === "high").map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs p-2 bg-red-500/5 rounded-xl border border-red-500/15">
                <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                <span className="flex-1">{item.text}</span>
                <span className="text-[10px] text-muted-foreground">{item.framework.split("(")[0].trim()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
