import { useState, useCallback, useEffect } from "react";
import { useGetCase, getGetCaseQueryKey, useUpdateCase } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight, FileText, MessageSquare, Bot, User, Clock, Scale,
  Receipt, Handshake, CalendarDays, Sparkles, AlertTriangle,
  ChevronLeft, TrendingUp, Upload, Plus, ExternalLink, Loader2,
  Shield, Lightbulb, Swords, BookOpen, Send, Globe, GitCommitHorizontal, ShoppingBag
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open:        { label: "مفتوحة",       color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  in_progress: { label: "قيد التنفيذ",  color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  closed:      { label: "مغلقة",        color: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const TYPE_MAP: Record<string, string> = {
  criminal:    "جنائية",
  civil:       "مدنية",
  commercial:  "تجارية",
  labor:       "عمالية",
  real_estate: "عقارية",
};

const EVENT_TYPES: Record<string, string> = {
  hearing:     "جلسة محكمة",
  meeting:     "اجتماع",
  deadline:    "موعد نهائي",
  consultation:"استشارة",
};

const INV_STATUS: Record<string, { label: string; color: string }> = {
  draft:   { label: "مسودة",    color: "bg-slate-500/15 text-slate-400" },
  sent:    { label: "مُرسلة",   color: "bg-blue-500/15 text-blue-400" },
  paid:    { label: "مدفوعة",   color: "bg-emerald-500/15 text-emerald-400" },
  overdue: { label: "متأخرة",   color: "bg-red-500/15 text-red-400" },
};

const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: "مسودة",    color: "bg-slate-500/15 text-slate-400" },
  active:    { label: "نشط",      color: "bg-emerald-500/15 text-emerald-400" },
  expired:   { label: "منتهي",    color: "bg-red-500/15 text-red-400" },
  cancelled: { label: "ملغى",     color: "bg-orange-500/15 text-orange-400" },
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function useHubData(id: string) {
  return useQuery<{
    case: any;
    invoices: any[];
    contracts: any[];
    events: any[];
    documents: any[];
  }>({
    queryKey: ["case-hub", id],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/cases/${id}/hub`);
      if (!r.ok) throw new Error("failed");
      return r.json();
    },
    enabled: !!id,
  });
}

export default function CaseDetail({ id }: { id: string }) {
  const { data: caseData, isLoading: caseLoading } = useGetCase(id, {
    query: { enabled: !!id, queryKey: getGetCaseQueryKey(id) },
  });
  const { data: hub, isLoading: hubLoading } = useHubData(id);

  const { data: portalTokens = [] } = useQuery<any[]>({
    queryKey: ["portal-tokens", id],
    queryFn: () => fetch(`${BASE}/api/portal/tokens/${id}`).then(r => r.json()),
    enabled: !!id,
  });
  const { data: portalTimeline = [], refetch: refetchTimeline } = useQuery<any[]>({
    queryKey: ["portal-timeline", id],
    queryFn: () => fetch(`${BASE}/api/portal/timeline/${id}`).then(r => r.json()),
    enabled: !!id,
  });
  const { data: portalUploads = [] } = useQuery<any[]>({
    queryKey: ["portal-uploads", id],
    queryFn: () => fetch(`${BASE}/api/portal/uploads/${id}`).then(r => r.json()),
    enabled: !!id,
  });

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<"ai" | "rule_engine" | null>(null);
  const [activeAiType, setActiveAiType] = useState<string | null>(null);
  const [autoBrief, setAutoBrief] = useState<string | null>(null);
  const [autoBriefLoading, setAutoBriefLoading] = useState(false);
  const [autoBriefLoaded, setAutoBriefLoaded] = useState(false);
  const [activeStatus, setActiveStatus] = useState("");
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [waPhone, setWaPhone] = useState("");
  const [waSending, setWaSending] = useState(false);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [portalTitle, setPortalTitle] = useState("");
  const [portalDesc, setPortalDesc] = useState("");
  const [portalType, setPortalType] = useState("note");
  const [portalShared, setPortalShared] = useState(true);
  const [portalSending, setPortalSending] = useState(false);

  /* ── Case Messages ── */
  const [msgComposeOpen, setMsgComposeOpen] = useState(false);
  const [msgSubject, setMsgSubject]         = useState("");
  const [msgBody, setMsgBody]               = useState("");
  const [selectedMsg, setSelectedMsg]       = useState<any>(null);

  const { data: caseMsgs = [], refetch: refetchMsgs } = useQuery<any[]>({
    queryKey: ["case-messages", id],
    queryFn: () => fetch(`${BASE}/api/internal-messages/case/${id}`).then(r => r.json()),
    enabled: !!id,
    staleTime: 30_000,
  });

  const sendMsg = useMutation({
    mutationFn: (d: { subject: string; body: string }) =>
      fetch(`${BASE}/api/internal-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...d, caseId: id, folder: "sent" }),
      }).then(r => r.json()),
    onSuccess: () => {
      refetchMsgs();
      setMsgComposeOpen(false);
      setMsgSubject("");
      setMsgBody("");
      toast({ title: "تم الإرسال", description: "تم إرسال الرسالة بنجاح" });
    },
  });

  const updateCase = useUpdateCase();
  const qc = useQueryClient();
  const { toast } = useToast();

  const loadAutoBrief = useCallback(async () => {
    if (autoBriefLoaded) return;
    setAutoBriefLoading(true);
    try {
      const r = await fetch(`${BASE}/api/ai/case-brief/${id}`);
      if (r.ok) {
        const d = await r.json();
        setAutoBrief(d.brief);
        setAiSource(d.source);
      }
    } catch {}
    setAutoBriefLoading(false);
    setAutoBriefLoaded(true);
  }, [id, autoBriefLoaded]);

  const isLoading = caseLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <div className="grid grid-cols-4 gap-6">
          <Skeleton className="h-64 col-span-1" />
          <Skeleton className="h-64 col-span-3" />
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Scale className="h-12 w-12 mb-4 opacity-20" />
        <p>القضية غير موجودة أو تم حذفها.</p>
        <Link href="/cases"><Button variant="outline" className="mt-4">عودة للقضايا</Button></Link>
      </div>
    );
  }

  const statusCfg = STATUS_MAP[caseData.status] ?? STATUS_MAP.open;

  const invoices = hub?.invoices ?? [];
  const contracts = hub?.contracts ?? [];
  const events = hub?.events ?? [];
  const documents = hub?.documents ?? [];

  const totalInvoices = invoices.reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
  const paidInvoices = invoices.filter((i: any) => i.status === "paid")
    .reduce((s: number, i: any) => s + Number(i.total ?? 0), 0);
  const upcomingEvents = events.filter((e: any) => new Date(e.start_at) >= new Date());

  const handleStatusUpdate = () => {
    if (!activeStatus || activeStatus === caseData.status) return;
    updateCase.mutate(
      { id, data: { status: activeStatus as any } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCaseQueryKey(id) });
          toast({ title: "تم تحديث الحالة" });
          setActiveStatus("");
        },
      }
    );
  };

  const handlePortalShare = async () => {
    if (!portalTitle.trim()) return;
    setPortalSending(true);
    try {
      const r = await fetch(`${BASE}/api/portal/timeline/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: portalTitle, description: portalDesc, entryType: portalType, isShared: portalShared }),
      });
      const d = await r.json();
      if (d?.error) { toast({ title: "فشل الإرسال", description: d.error, variant: "destructive" }); }
      else { toast({ title: portalShared ? "✅ تم نشر التحديث في بوابة العميل" : "✅ تم حفظ الحدث" }); setPortalDialogOpen(false); setPortalTitle(""); setPortalDesc(""); }
    } catch { toast({ title: "خطأ في الاتصال", variant: "destructive" }); }
    setPortalSending(false);
  };

  const handleSendWhatsApp = async () => {
    if (!waPhone.trim()) return;
    setWaSending(true);
    const message = `السلام عليكم،\nبخصوص قضيتكم "${caseData.title}" — حالتها الحالية: ${STATUS_MAP[caseData.status]?.label ?? caseData.status}.\nللاستفسار يرجى التواصل مع مكتبنا.`;
    try {
      const r = await fetch(`${BASE}/api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: waPhone, message, template: "case_update" }),
      });
      const d = await r.json();
      if (d.ok) {
        toast({ title: "تم الإرسال عبر واتساب ✅" });
        setWaDialogOpen(false);
        setWaPhone("");
      } else {
        toast({ title: "فشل الإرسال", description: d.error || "تحقق من إعدادات واتساب", variant: "destructive" });
      }
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    }
    setWaSending(false);
  };

  const handleAiAnalysis = async (type: string) => {
    setAiLoading(true);
    setAiResult(null);
    setActiveAiType(type);
    try {
      const r = await fetch(`${BASE}/api/ai/analyze-case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseData: {
            ...caseData,
            documentsCount: documents.length,
            contractsCount: contracts.length,
            invoicesCount:  invoices.length,
            eventsCount:    events.length,
          },
          type,
        }),
      });
      if (r.ok) {
        const d = await r.json();
        setAiResult(d.result);
        setAiSource(d.source);
      } else {
        setAiResult("تعذّر إجراء التحليل حالياً، يرجى المحاولة لاحقاً.");
      }
    } catch {
      setAiResult("تعذّر الاتصال بمحرك الذكاء الاصطناعي.");
    }
    setAiLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/cases">
            <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 text-muted-foreground hover:text-foreground">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold leading-tight">{caseData.title}</h1>
              <Badge className={`border text-xs px-2 ${statusCfg.color}`}>{statusCfg.label}</Badge>
              {caseData.caseType && (
                <Badge variant="outline" className="text-xs">{TYPE_MAP[caseData.caseType] || caseData.caseType}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">رقم المرجع: {caseData.id?.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => setPortalDialogOpen(true)} className="h-8 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10">
            <Globe className="h-3.5 w-3.5" />بوابة العميل
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWaDialogOpen(true)} className="h-8 text-xs gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
            <MessageSquare className="h-3.5 w-3.5" />واتساب
          </Button>
          <Select value={activeStatus} onValueChange={setActiveStatus}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="تغيير الحالة" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_MAP).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!activeStatus || updateCase.isPending} onClick={handleStatusUpdate} className="h-8 text-xs">
            {updateCase.isPending && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
            حفظ
          </Button>
        </div>
      </div>

      {/* WhatsApp Dialog */}
      <Dialog open={waDialogOpen} onOpenChange={setWaDialogOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-400">
              <MessageSquare className="h-4 w-4" />إرسال إشعار واتساب
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">أرسل إشعاراً للعميل بخصوص القضية: <span className="font-medium text-foreground">{caseData?.title}</span></p>
            <div className="space-y-1.5">
              <Label className="text-xs">رقم الهاتف (مع رمز الدولة)</Label>
              <Input
                dir="ltr"
                placeholder="+966501234567"
                value={waPhone}
                onChange={e => setWaPhone(e.target.value)}
                className="text-left"
              />
            </div>
            <Button onClick={handleSendWhatsApp} disabled={waSending || !waPhone.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
              {waSending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Send className="h-4 w-4 ml-2" />}
              إرسال
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Portal Share Dialog ── */}
      <Dialog open={portalDialogOpen} onOpenChange={setPortalDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Globe className="h-4 w-4" />نشر تحديث في بوابة العميل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              أضف حدثاً أو تحديثاً للخط الزمني للقضية: <span className="font-medium text-foreground">{caseData?.title}</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">نوع الحدث</Label>
              <Select value={portalType} onValueChange={setPortalType}>
                <SelectTrigger dir="rtl" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {[
                    { v: "note", l: "ملاحظة" }, { v: "hearing", l: "جلسة محكمة" },
                    { v: "meeting", l: "اجتماع" }, { v: "document", l: "وثيقة مضافة" },
                    { v: "status_change", l: "تغيير الحالة" }, { v: "payment", l: "دفعة مالية" },
                  ].map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">عنوان التحديث *</Label>
              <Input placeholder="مثال: تمت جلسة المحكمة بنجاح" value={portalTitle} onChange={e => setPortalTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تفاصيل إضافية (اختياري)</Label>
              <Textarea placeholder="أضف تفاصيل..." rows={2} value={portalDesc} onChange={e => setPortalDesc(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-3">
              <div>
                <p className="text-xs font-medium">مرئي للعميل</p>
                <p className="text-[10px] text-muted-foreground">يظهر في بوابة العميل ويُرسل إشعار بالبريد</p>
              </div>
              <Switch checked={portalShared} onCheckedChange={setPortalShared} />
            </div>
            <Button onClick={handlePortalShare} disabled={portalSending || !portalTitle.trim()} className="w-full gap-2">
              {portalSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCommitHorizontal className="h-4 w-4" />}
              {portalShared ? "نشر التحديث للعميل" : "حفظ الحدث (داخلي)"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "المستندات", value: hubLoading ? "—" : documents.length, icon: FileText, color: "text-blue-400" },
          { label: "العقود", value: hubLoading ? "—" : contracts.length, icon: Handshake, color: "text-violet-400" },
          { label: "إجمالي الفواتير", value: hubLoading ? "—" : `${totalInvoices.toLocaleString()} ر.س`, icon: Receipt, color: "text-amber-400" },
          { label: "جلسات قادمة", value: hubLoading ? "—" : upcomingEvents.length, icon: CalendarDays, color: "text-emerald-400" },
        ].map(kpi => (
          <Card key={kpi.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                <p className="text-xl font-bold">{kpi.value}</p>
              </div>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
          </Card>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">معلومات القضية</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <InfoRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="العميل" value={caseData.clientName || "غير محدد"} />
              <Separator />
              <InfoRow icon={<Scale className="h-4 w-4 text-muted-foreground" />} label="نوع القضية" value={TYPE_MAP[caseData.caseType] || caseData.caseType} />
              <Separator />
              <InfoRow icon={<Clock className="h-4 w-4 text-muted-foreground" />} label="تاريخ الإنشاء" value={new Date(caseData.createdAt).toLocaleDateString("ar-EG")} />
              {caseData.assignedTo && (
                <>
                  <Separator />
                  <InfoRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="المحامي المسؤول" value={caseData.assignedTo} />
                </>
              )}
              {(caseData as any).source === "store" && (
                <>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">مصدر القضية</p>
                      <p className="text-sm font-medium text-amber-600">طلب مدفوع من المتجر</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {caseData.description && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">وصف القضية</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{caseData.description}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Tabs */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="documents" dir="rtl">
            <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-auto gap-0.5">
              <TabsTrigger value="documents" className="text-xs py-2">
                <FileText className="h-3.5 w-3.5 ml-1" />المستندات
                {!hubLoading && documents.length > 0 && <span className="mr-1 text-[10px] bg-blue-500/20 text-blue-400 rounded px-1">{documents.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="contracts" className="text-xs py-2">
                <Handshake className="h-3.5 w-3.5 ml-1" />العقود
                {!hubLoading && contracts.length > 0 && <span className="mr-1 text-[10px] bg-violet-500/20 text-violet-400 rounded px-1">{contracts.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs py-2">
                <Receipt className="h-3.5 w-3.5 ml-1" />الفواتير
                {!hubLoading && invoices.length > 0 && <span className="mr-1 text-[10px] bg-amber-500/20 text-amber-400 rounded px-1">{invoices.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="sessions" className="text-xs py-2">
                <CalendarDays className="h-3.5 w-3.5 ml-1" />الجلسات
                {!hubLoading && events.length > 0 && <span className="mr-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1">{events.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="portal" className="text-xs py-2">
                <Globe className="h-3.5 w-3.5 ml-1 text-emerald-400" />
                <span className="text-emerald-400">البوابة</span>
                {portalUploads.length > 0 && <span className="mr-1 text-[10px] bg-emerald-500/20 text-emerald-400 rounded px-1">{portalUploads.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="messages" className="text-xs py-2">
                <MessageSquare className="h-3.5 w-3.5 ml-1" />المراسلات
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs py-2">
                <Bot className="h-3.5 w-3.5 ml-1 text-[#C9A84C]" />
                <span className="text-[#C9A84C]">AI</span>
              </TabsTrigger>
            </TabsList>

            {/* DOCUMENTS TAB */}
            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm">المستندات المرفقة</CardTitle>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                    <Upload className="h-3 w-3" />رفع مستند
                  </Button>
                </CardHeader>
                <CardContent>
                  {hubLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" /> :
                    documents.length === 0 ? (
                      <EmptyState icon={<FileText className="h-10 w-10" />} label="لا توجد مستندات مرفقة" action="رفع مستند" />
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <BookOpen className="h-4 w-4 text-blue-400" />
                              <div>
                                <p className="text-sm font-medium">{doc.name}</p>
                                <p className="text-xs text-muted-foreground">{doc.file_type} • {doc.file_size ? `${Math.round(Number(doc.file_size) / 1024)} KB` : ""}</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("ar-EG")}</p>
                          </div>
                        ))}
                      </div>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* CONTRACTS TAB */}
            <TabsContent value="contracts" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm">العقود المرتبطة</CardTitle>
                  <Link href="/contracts">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" />إضافة عقد
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {hubLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" /> :
                    contracts.length === 0 ? (
                      <EmptyState icon={<Handshake className="h-10 w-10" />} label="لا توجد عقود مرتبطة بهذه القضية" action="إضافة عقد" href="/contracts" />
                    ) : (
                      <div className="space-y-2">
                        {contracts.map((c: any) => {
                          const st = CONTRACT_STATUS[c.status] ?? CONTRACT_STATUS.draft;
                          return (
                            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                              <div className="flex items-center gap-3">
                                <Handshake className="h-4 w-4 text-violet-400" />
                                <div>
                                  <p className="text-sm font-medium">{c.title}</p>
                                  <p className="text-xs text-muted-foreground">{c.type}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge className={`text-[10px] px-2 ${st.color}`}>{st.label}</Badge>
                                {c.expires_at && <p className="text-xs text-muted-foreground">{new Date(c.expires_at).toLocaleDateString("ar-EG")}</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* INVOICES TAB */}
            <TabsContent value="invoices" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm">الفواتير</CardTitle>
                    {invoices.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        المدفوع: <span className="text-emerald-400 font-medium">{paidInvoices.toLocaleString()} ر.س</span>
                        {" · "}المستحق: <span className="text-amber-400 font-medium">{(totalInvoices - paidInvoices).toLocaleString()} ر.س</span>
                      </p>
                    )}
                  </div>
                  <Link href="/invoices">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" />فاتورة جديدة
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {hubLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" /> :
                    invoices.length === 0 ? (
                      <EmptyState icon={<Receipt className="h-10 w-10" />} label="لا توجد فواتير مرتبطة بهذه القضية" action="إنشاء فاتورة" href="/invoices" />
                    ) : (
                      <div className="space-y-2">
                        {invoices.map((inv: any) => {
                          const st = INV_STATUS[inv.status] ?? INV_STATUS.draft;
                          return (
                            <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                              <div className="flex items-center gap-3">
                                <Receipt className="h-4 w-4 text-amber-400" />
                                <div>
                                  <p className="text-sm font-medium">{inv.title}</p>
                                  <p className="text-xs text-muted-foreground">{inv.invoice_number}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge className={`text-[10px] px-2 ${st.color}`}>{st.label}</Badge>
                                <span className="text-sm font-bold">{Number(inv.total).toLocaleString()} ر.س</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* SESSIONS TAB */}
            <TabsContent value="sessions" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm">الجلسات والمواعيد</CardTitle>
                  <Link href="/calendar">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Plus className="h-3 w-3" />إضافة جلسة
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {hubLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto my-4" /> :
                    events.length === 0 ? (
                      <EmptyState icon={<CalendarDays className="h-10 w-10" />} label="لا توجد جلسات مجدولة لهذه القضية" action="جدولة جلسة" href="/calendar" />
                    ) : (
                      <div className="space-y-2">
                        {events.map((ev: any) => {
                          const isPast = new Date(ev.start_at) < new Date();
                          return (
                            <div key={ev.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPast ? "bg-slate-500/15" : "bg-emerald-500/15"}`}>
                                  <CalendarDays className={`h-4 w-4 ${isPast ? "text-slate-400" : "text-emerald-400"}`} />
                                </div>
                                <div>
                                  <p className="text-sm font-medium">{ev.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {EVENT_TYPES[ev.event_type] || ev.event_type}
                                    {ev.location ? ` • ${ev.location}` : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-medium">{new Date(ev.start_at).toLocaleDateString("ar-EG")}</p>
                                <p className="text-[10px] text-muted-foreground">{isPast ? "منتهية" : "قادمة"}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* MESSAGES TAB */}
            <TabsContent value="messages" className="mt-4 space-y-3">
              {/* Header + Compose button */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">مراسلات القضية</span>
                  {caseMsgs.length > 0 && (
                    <span className="text-[10px] bg-blue-500/20 text-blue-400 rounded px-1.5 py-0.5">{caseMsgs.length}</span>
                  )}
                </div>
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setMsgComposeOpen(true)}>
                  <Plus className="h-3 w-3" />رسالة جديدة
                </Button>
              </div>

              {/* Message detail view */}
              {selectedMsg ? (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm truncate">{selectedMsg.subject}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        من: <strong className="text-foreground">{selectedMsg.sender_name}</strong>
                        {" · "}{new Date(selectedMsg.created_at).toLocaleString("ar-EG")}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs shrink-0" onClick={() => setSelectedMsg(null)}>
                      ← رجوع
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap border border-border/40">
                      {selectedMsg.body}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                /* Message list */
                <Card>
                  <CardContent className="p-0">
                    {caseMsgs.length === 0 ? (
                      <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 opacity-20" />
                        <p className="text-sm">لا توجد مراسلات لهذه القضية بعد</p>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-1" onClick={() => setMsgComposeOpen(true)}>
                          <Plus className="h-3 w-3" />ابدأ مراسلة
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {caseMsgs.map((msg: any) => (
                          <button key={msg.id} onClick={() => setSelectedMsg(msg)}
                            className="w-full flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors text-right">
                            <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                              <span className="text-xs text-blue-400 font-bold">
                                {(msg.sender_name ?? "؟").charAt(0)}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium truncate">{msg.subject}</span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {new Date(msg.created_at).toLocaleDateString("ar-EG")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{msg.sender_name}</p>
                              <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{msg.body?.slice(0, 60)}...</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Compose Dialog */}
              <Dialog open={msgComposeOpen} onOpenChange={setMsgComposeOpen}>
                <DialogContent className="max-w-lg" dir="rtl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-4 w-4" />رسالة جديدة
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">الموضوع</Label>
                      <Input value={msgSubject} onChange={e => setMsgSubject(e.target.value)}
                        placeholder="موضوع الرسالة..." className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">نص الرسالة</Label>
                      <textarea
                        value={msgBody}
                        onChange={e => setMsgBody(e.target.value)}
                        placeholder="اكتب رسالتك هنا..."
                        rows={5}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      سيتم ربط الرسالة تلقائياً بهذه القضية
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setMsgComposeOpen(false)}>إلغاء</Button>
                    <Button size="sm" className="gap-1.5"
                      disabled={!msgSubject.trim() || !msgBody.trim() || sendMsg.isPending}
                      onClick={() => sendMsg.mutate({ subject: msgSubject, body: msgBody })}>
                      <Send className="h-3.5 w-3.5" />
                      {sendMsg.isPending ? "جارٍ الإرسال..." : "إرسال"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* PORTAL TAB */}
            <TabsContent value="portal" className="mt-4">
              <div className="space-y-4">
                {/* Portal Links */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4 text-emerald-400" />روابط بوابة العميل
                    </CardTitle>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => setPortalDialogOpen(true)}>
                      <Plus className="h-3 w-3" />نشر تحديث
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {portalTokens.length === 0 ? (
                      <EmptyState icon={<Globe className="h-10 w-10" />} label="لا توجد روابط بوابة لهذه القضية بعد" action="إنشاء رابط" href="/client-portal" />
                    ) : (
                      <div className="space-y-2">
                        {(portalTokens as any[]).map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                            <div>
                              <p className="text-sm font-medium">{t.client_name || "عميل"}</p>
                              <p className="text-xs text-muted-foreground">
                                {t.client_email || "لا يوجد بريد"} •{" "}
                                آخر دخول: {t.last_accessed ? new Date(t.last_accessed).toLocaleDateString("ar-EG") : "لم يُفتح بعد"}
                              </p>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
                              onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${BASE}/portal/${t.token}`); toast({ title: "تم نسخ الرابط" }); }}>
                              <Send className="h-3 w-3" />نسخ الرابط
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <GitCommitHorizontal className="h-4 w-4 text-blue-400" />خط الأحداث
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 rounded px-1.5">{portalTimeline.length}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {portalTimeline.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">لا توجد أحداث مسجلة بعد</p>
                    ) : (
                      <div className="space-y-3">
                        {(portalTimeline as any[]).map((entry: any) => (
                          <div key={entry.id} className="flex gap-3 items-start">
                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${entry.is_shared ? "bg-emerald-400" : "bg-slate-500"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">{entry.title}</p>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${entry.is_shared ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                                  {entry.is_shared ? "مشارك" : "داخلي"}
                                </span>
                              </div>
                              {entry.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{entry.description}</p>}
                              <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(entry.happened_at).toLocaleDateString("ar-EG")}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Client Uploads */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Upload className="h-4 w-4 text-purple-400" />ملفات العميل
                      {portalUploads.length > 0 && <span className="text-[10px] bg-purple-500/20 text-purple-400 rounded px-1.5">{portalUploads.length}</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {portalUploads.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">لم يرفع العميل أي ملفات بعد</p>
                    ) : (
                      <div className="space-y-2">
                        {(portalUploads as any[]).map((file: any) => (
                          <div key={file.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                            <div className="flex items-center gap-3 min-w-0">
                              <FileText className="h-4 w-4 text-purple-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{file.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {file.client_name || "عميل"} • {file.file_size ? `${Math.round(Number(file.file_size) / 1024)} KB` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p className="text-xs text-muted-foreground">{new Date(file.uploaded_at).toLocaleDateString("ar-EG")}</p>
                              {file.file_data && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                  onClick={() => { const a = document.createElement("a"); a.href = file.file_data; a.download = file.file_name; a.click(); }}>
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* AI TAB */}
            <TabsContent value="ai" className="mt-4">
              <div className="mb-3 flex items-center gap-3 p-3 rounded-xl bg-[#C9A84C]/5 border border-[#C9A84C]/20">
                <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-[#C9A84C]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#C9A84C]">محرك توليد الوثائق القانونية</p>
                  <p className="text-xs text-white/40">أنشئ عقوداً، مذكرات، لوائح، وكالات — بالذكاء الاصطناعي</p>
                </div>
                <Link href="/legal-ai">
                  <Button size="sm" variant="outline"
                    className="h-7 text-xs border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 flex-shrink-0 gap-1.5">
                    <ExternalLink className="w-3 h-3" />فتح
                  </Button>
                </Link>
              </div>
              <AiTab
                onMount={loadAutoBrief}
                autoBrief={autoBrief}
                autoBriefLoading={autoBriefLoading}
                autoBriefLoaded={autoBriefLoaded}
                aiLoading={aiLoading}
                aiResult={aiResult}
                aiSource={aiSource}
                activeAiType={activeAiType}
                onAnalyze={handleAiAnalysis}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium leading-snug truncate">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, label, action, href }: { icon: React.ReactNode; label: string; action: string; href?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
      <div className="opacity-20">{icon}</div>
      <p className="text-sm text-center">{label}</p>
      {href ? (
        <Link href={href}><Button variant="outline" size="sm" className="text-xs">{action}</Button></Link>
      ) : (
        <Button variant="outline" size="sm" className="text-xs">{action}</Button>
      )}
    </div>
  );
}

const AI_BUTTONS = [
  { key: "summarize",       label: "تلخيص القضية",       icon: <BookOpen className="h-4 w-4" />,                       color: "border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5",    activeRing: "ring-blue-500/40" },
  { key: "risks",           label: "تحليل المخاطر",       icon: <AlertTriangle className="h-4 w-4 text-amber-400" />,   color: "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5",  activeRing: "ring-amber-500/40" },
  { key: "defenses",        label: "اقتراح الدفوع",       icon: <Shield className="h-4 w-4 text-emerald-400" />,        color: "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5", activeRing: "ring-emerald-500/40" },
  { key: "judge_questions", label: "توقع أسئلة القاضي",   icon: <Swords className="h-4 w-4 text-violet-400" />,         color: "border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/5", activeRing: "ring-violet-500/40" },
];

function AiTab({
  onMount, autoBrief, autoBriefLoading, autoBriefLoaded,
  aiLoading, aiResult, aiSource, activeAiType, onAnalyze,
}: {
  onMount: () => void;
  autoBrief: string | null;
  autoBriefLoading: boolean;
  autoBriefLoaded: boolean;
  aiLoading: boolean;
  aiResult: string | null;
  aiSource: "ai" | "rule_engine" | null;
  activeAiType: string | null;
  onAnalyze: (type: string) => void;
}) {
  useEffect(() => { onMount(); }, []);

  return (
    <div className="space-y-4">
      {/* Auto-brief banner */}
      {(autoBriefLoading || autoBrief) && (
        <Card className="border-[#C9A84C]/25 bg-[#C9A84C]/5">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs flex items-center gap-2 text-[#C9A84C]">
              <Sparkles className="h-3.5 w-3.5" />
              الإفادة الذكية التلقائية
              {autoBrief && aiSource && (
                <span className={`mr-auto text-[10px] px-2 py-0.5 rounded-full ${aiSource === "ai" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}`}>
                  {aiSource === "ai" ? "✦ AI" : "⚙ محرك القواعد"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {autoBriefLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                يجهّز المحرك الذكي الإفادة...
              </div>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">{autoBrief}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Analysis buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {AI_BUTTONS.map(btn => (
          <Button
            key={btn.key}
            variant="outline"
            className={`h-auto py-3 px-3 flex flex-col items-center gap-2 transition-all ${btn.color} ${activeAiType === btn.key ? `ring-1 ${btn.activeRing}` : ""}`}
            disabled={aiLoading}
            onClick={() => onAnalyze(btn.key)}
          >
            {aiLoading && activeAiType === btn.key
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : btn.icon}
            <span className="text-xs">{btn.label}</span>
          </Button>
        ))}
      </div>

      {/* Analysis result */}
      {aiLoading && !aiResult && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-3">
            <Sparkles className="h-7 w-7 text-[#C9A84C] animate-pulse" />
            <p className="text-sm text-muted-foreground">يحلل المحرك الذكي القضية...</p>
          </CardContent>
        </Card>
      )}

      {aiResult && !aiLoading && (
        <Card className="border-[#C9A84C]/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#C9A84C]" />
              {AI_BUTTONS.find(b => b.key === activeAiType)?.label ?? "نتيجة التحليل"}
              {aiSource && (
                <span className={`mr-auto text-[10px] px-2 py-0.5 rounded-full ${aiSource === "ai" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400"}`}>
                  {aiSource === "ai" ? "✦ AI" : "⚙ محرك القواعد"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-sm leading-relaxed whitespace-pre-line text-foreground/80">{aiResult}</div>
          </CardContent>
        </Card>
      )}

      {!aiLoading && !aiResult && !autoBriefLoading && !autoBrief && (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-muted-foreground">
            <Bot className="h-10 w-10 opacity-20" />
            <p className="text-sm">اختر أحد أزرار التحليل أعلاه</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
