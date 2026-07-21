/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; authFetch migration */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ShieldAlert, Search, Plus, Loader2,
  CheckCircle2, XCircle, Clock, FileWarning, Scale,
  ChevronDown, MoreVertical, Trash2, Edit2, Users,
  CalendarDays, UserCheck, Gavel, FileText, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── config ──────────────────────────────────────────── */

const WARNING_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  verbal:  { label: "إنذار شفهي",  color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/30" },
  written: { label: "إنذار كتابي", color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30" },
  final:   { label: "إنذار نهائي", color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30" },
};

const WARNING_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  active:   { label: "سارٍ",    color: "text-red-400",     icon: AlertTriangle },
  resolved: { label: "محسوم",   color: "text-emerald-400", icon: CheckCircle2 },
  appealed: { label: "مطعون به", color: "text-blue-400",   icon: Scale },
};

const INV_STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  open:        { label: "مفتوح",      color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30",  icon: FileWarning },
  in_progress: { label: "جارٍ",       color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30",     icon: Clock },
  closed:      { label: "مغلق",       color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/30",icon: CheckCircle2 },
};

const INV_OUTCOMES: Record<string, { label: string; color: string }> = {
  cleared:     { label: "براءة",          color: "text-emerald-400" },
  warning:     { label: "إنذار",          color: "text-orange-400" },
  demotion:    { label: "تخفيض رتبة",    color: "text-yellow-400" },
  termination: { label: "إنهاء خدمة",    color: "text-red-400" },
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

/* ═══════════════════════════════════════════════════════ */
export default function Warnings() {
  const { toast } = useToast();
  const qc = useQueryClient();

  /* ── shared ── */
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["employees"],
    queryFn: () => authFetch(`${BASE}/api/hr/employees`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  /* ═══════════ WARNINGS ═══════════ */
  const [wSearch, setWSearch]       = useState("");
  const [wFilter, setWFilter]       = useState("all");
  const [showWarnForm, setShowWarnForm]   = useState(false);
  const [showWarnDetail, setShowWarnDetail] = useState<any>(null);
  const [wForm, setWForm] = useState({ employeeId: "", type: "written", reason: "", description: "", issuedBy: "" });

  const { data: warnings = [], isLoading: wLoading } = useQuery<any[]>({
    queryKey: ["warnings"],
    queryFn: () => authFetch(`${BASE}/api/hr/warnings`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const addWarning = useMutation({
    mutationFn: (d: any) => authFetch(`${BASE}/api/hr/warnings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warnings"] }); setShowWarnForm(false); setWForm({ employeeId: "", type: "written", reason: "", description: "", issuedBy: "" }); toast({ title: "تم إصدار الإنذار ✓" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const updateWarning = useMutation({
    mutationFn: ({ id, ...d }: any) => authFetch(`${BASE}/api/hr/warnings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warnings"] }); toast({ title: "تم التحديث ✓" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const deleteWarning = useMutation({
    mutationFn: (id: string) => authFetch(`${BASE}/api/hr/warnings/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warnings"] }); toast({ title: "تم الحذف" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const filteredW = warnings.filter(w => {
    if (wFilter !== "all" && w.status !== wFilter) return false;
    if (wSearch && !w.employeeName?.includes(wSearch) && !w.reason?.includes(wSearch)) return false;
    return true;
  });

  /* ═══════════ INVESTIGATIONS ═══════════ */
  const [iSearch, setISearch]       = useState("");
  const [iFilter, setIFilter]       = useState("all");
  const [showInvForm, setShowInvForm]   = useState(false);
  const [showInvDetail, setShowInvDetail] = useState<any>(null);
  const [iForm, setIForm] = useState({
    employeeId: "", subject: "", description: "", openedBy: "", committee: "", sessionDate: "",
  });

  const { data: investigations = [], isLoading: iLoading } = useQuery<any[]>({
    queryKey: ["investigations"],
    queryFn: () => authFetch(`${BASE}/api/hr/investigations`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const addInvestigation = useMutation({
    mutationFn: (d: any) => authFetch(`${BASE}/api/hr/investigations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investigations"] }); setShowInvForm(false); setIForm({ employeeId: "", subject: "", description: "", openedBy: "", committee: "", sessionDate: "" }); toast({ title: "تم فتح التحقيق ✓" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const updateInvestigation = useMutation({
    mutationFn: ({ id, ...d }: any) => authFetch(`${BASE}/api/hr/investigations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investigations"] }); setShowInvDetail(null); toast({ title: "تم التحديث ✓" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const deleteInvestigation = useMutation({
    mutationFn: (id: string) => authFetch(`${BASE}/api/hr/investigations/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investigations"] }); toast({ title: "تم الحذف" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const filteredI = investigations.filter(i => {
    if (iFilter !== "all" && i.status !== iFilter) return false;
    if (iSearch && !i.employeeName?.includes(iSearch) && !i.subject?.includes(iSearch)) return false;
    return true;
  });

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-orange-400" />
            الإنذارات والتحقيقات
          </h1>
          <p className="text-muted-foreground text-sm">إدارة المخالفات التأديبية وتوجيه التحقيقات</p>
        </div>
        {/* stats */}
        <div className="flex gap-3 text-center">
          {[
            { label: "إنذار سارٍ", val: warnings.filter(w => w.status === "active").length, color: "#EF4444" },
            { label: "تحقيق جارٍ", val: investigations.filter(i => i.status === "in_progress" || i.status === "open").length, color: "#F59E0B" },
          ].map(s => (
            <div key={s.label} className="px-4 py-2 rounded-xl bg-card/50 border border-border/50 min-w-[90px]">
              <div className="text-xl font-black" style={{ color: s.color }}>{s.val}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="warnings">
        <TabsList className="mb-4">
          <TabsTrigger value="warnings" className="gap-2">
            <AlertTriangle className="h-4 w-4" /> الإنذارات
            {warnings.filter(w => w.status === "active").length > 0 && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[9px]">
                {warnings.filter(w => w.status === "active").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="investigations" className="gap-2">
            <Gavel className="h-4 w-4" /> التحقيقات
            {investigations.filter(i => i.status !== "closed").length > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[9px]">
                {investigations.filter(i => i.status !== "closed").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ════════ WARNINGS TAB ════════ */}
        <TabsContent value="warnings" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={wSearch} onChange={e => setWSearch(e.target.value)} placeholder="بحث بالاسم أو السبب..." className="pe-9" />
            </div>
            <Select value={wFilter} onValueChange={setWFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">سارٍ</SelectItem>
                <SelectItem value="resolved">محسوم</SelectItem>
                <SelectItem value="appealed">مطعون به</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowWarnForm(true)} className="gap-2">
              <Plus className="h-4 w-4" /> إصدار إنذار
            </Button>
          </div>

          {wLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredW.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا توجد إنذارات مطابقة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredW.map((w: any) => {
                const wType = WARNING_TYPES[w.type] ?? WARNING_TYPES.written;
                const wSt = WARNING_STATUS[w.status] ?? WARNING_STATUS.active;
                const WIcon = wSt.icon;
                return (
                  <Card key={w.id} className="border-border/50 hover:border-border transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", wType.bg)}>
                          <AlertTriangle className={cn("h-4 w-4", wType.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{w.employeeName}</span>
                            <span className="text-[10px] text-muted-foreground">{w.jobTitle}</span>
                            <Badge className={cn("text-[9px] border", wType.bg, wType.color)}>{wType.label}</Badge>
                            <div className={cn("flex items-center gap-1 text-[10px]", wSt.color)}>
                              <WIcon className="h-3 w-3" />{wSt.label}
                            </div>
                          </div>
                          <p className="text-sm mt-1 font-medium">{w.reason}</p>
                          {w.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{w.description}</p>}
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            {w.issuedBy && <span>صادر من: {w.issuedBy}</span>}
                            <span>{fmt(w.createdAt)}</span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowWarnDetail(w)}>
                              <Eye className="h-3.5 w-3.5 ms-2" /> التفاصيل والإجراء
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {w.status === "active" && (
                              <DropdownMenuItem onClick={() => updateWarning.mutate({ id: w.id, status: "resolved" })}>
                                <CheckCircle2 className="h-3.5 w-3.5 ms-2 text-emerald-400" /> تسجيل كمحسوم
                              </DropdownMenuItem>
                            )}
                            {w.status === "active" && (
                              <DropdownMenuItem onClick={() => updateWarning.mutate({ id: w.id, status: "appealed" })}>
                                <Scale className="h-3.5 w-3.5 ms-2 text-blue-400" /> تسجيل طعن
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-400" onClick={() => { if (window.confirm("هل تريد حذف هذا الإنذار نهائياً؟")) deleteWarning.mutate(w.id); }}>
                              <Trash2 className="h-3.5 w-3.5 ms-2" /> حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ════════ INVESTIGATIONS TAB ════════ */}
        <TabsContent value="investigations" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={iSearch} onChange={e => setISearch(e.target.value)} placeholder="بحث بالاسم أو الموضوع..." className="pe-9" />
            </div>
            <Select value={iFilter} onValueChange={setIFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="open">مفتوح</SelectItem>
                <SelectItem value="in_progress">جارٍ</SelectItem>
                <SelectItem value="closed">مغلق</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setShowInvForm(true)} className="gap-2 bg-amber-600 hover:bg-amber-700">
              <Gavel className="h-4 w-4" /> فتح تحقيق
            </Button>
          </div>

          {iLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredI.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Gavel className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا توجد تحقيقات مطابقة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredI.map((inv: any) => {
                const iSt = INV_STATUS[inv.status] ?? INV_STATUS.open;
                const IIcon = iSt.icon;
                const outcome = inv.outcome ? INV_OUTCOMES[inv.outcome] : null;
                return (
                  <Card key={inv.id} className="border-border/50 hover:border-border transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", iSt.bg)}>
                          <IIcon className={cn("h-4 w-4", iSt.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{inv.employeeName}</span>
                            <span className="text-[10px] text-muted-foreground">{inv.jobTitle}</span>
                            <Badge className={cn("text-[9px] border", iSt.bg, iSt.color)}>{iSt.label}</Badge>
                            {outcome && (
                              <span className={cn("text-[10px] font-semibold", outcome.color)}>● {outcome.label}</span>
                            )}
                          </div>
                          <p className="text-sm mt-1 font-medium">{inv.subject}</p>
                          {inv.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{inv.description}</p>}
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                            {inv.openedBy && <span>فتحه: {inv.openedBy}</span>}
                            {inv.committee && <span>اللجنة: {inv.committee}</span>}
                            {inv.sessionDate && <span>جلسة: {fmt(inv.sessionDate)}</span>}
                            <span>{fmt(inv.createdAt)}</span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowInvDetail(inv)}>
                              <Eye className="h-3.5 w-3.5 ms-2" /> التفاصيل والإغلاق
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {inv.status === "open" && (
                              <DropdownMenuItem onClick={() => updateInvestigation.mutate({ id: inv.id, status: "in_progress" })}>
                                <Clock className="h-3.5 w-3.5 ms-2 text-blue-400" /> بدء التحقيق
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-400" onClick={() => { if (window.confirm("هل تريد حذف هذا التحقيق نهائياً؟")) deleteInvestigation.mutate(inv.id); }}>
                              <Trash2 className="h-3.5 w-3.5 ms-2" /> حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ════════ Warning Form Dialog ════════ */}
      <AdaptiveDialog open={showWarnForm} onOpenChange={setShowWarnForm}>
        <AdaptiveDialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" /> إصدار إنذار جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">الموظف *</Label>
              <Select value={wForm.employeeId} onValueChange={v => setWForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName} — {e.jobTitle}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">نوع الإنذار *</Label>
              <Select value={wForm.type} onValueChange={v => setWForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="verbal">إنذار شفهي</SelectItem>
                  <SelectItem value="written">إنذار كتابي</SelectItem>
                  <SelectItem value="final">إنذار نهائي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">سبب الإنذار *</Label>
              <Input value={wForm.reason} onChange={e => setWForm(f => ({ ...f, reason: e.target.value }))} placeholder="التأخر المتكرر عن الدوام" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">تفاصيل إضافية</Label>
              <Textarea value={wForm.description} onChange={e => setWForm(f => ({ ...f, description: e.target.value }))} placeholder="وصف تفصيلي للمخالفة..." rows={3} className="resize-none" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">صادر من</Label>
              <Input value={wForm.issuedBy} onChange={e => setWForm(f => ({ ...f, issuedBy: e.target.value }))} placeholder="مدير الموارد البشرية" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarnForm(false)}>إلغاء</Button>
            <Button
              disabled={!wForm.employeeId || !wForm.reason || addWarning.isPending}
              onClick={() => addWarning.mutate(wForm)}
              className="gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {addWarning.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              إصدار الإنذار
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ════════ Warning Detail Dialog ════════ */}
      <AdaptiveDialog open={!!showWarnDetail} onOpenChange={() => setShowWarnDetail(null)}>
        <AdaptiveDialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" /> تفاصيل الإنذار
            </DialogTitle>
          </DialogHeader>
          {showWarnDetail && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground text-xs">الموظف</span><div className="font-semibold">{showWarnDetail.employeeName}</div></div>
                <div><span className="text-muted-foreground text-xs">النوع</span><div className="font-semibold">{WARNING_TYPES[showWarnDetail.type]?.label}</div></div>
                <div className="col-span-2"><span className="text-muted-foreground text-xs">السبب</span><div className="font-semibold">{showWarnDetail.reason}</div></div>
                {showWarnDetail.description && <div className="col-span-2"><span className="text-muted-foreground text-xs">التفاصيل</span><div className="text-sm">{showWarnDetail.description}</div></div>}
                <div><span className="text-muted-foreground text-xs">صادر من</span><div>{showWarnDetail.issuedBy || "—"}</div></div>
                <div><span className="text-muted-foreground text-xs">التاريخ</span><div>{fmt(showWarnDetail.createdAt)}</div></div>
              </div>
              <div className="pt-2 border-t border-border/50">
                <Label className="text-xs font-semibold mb-1 block">ملاحظات الطعن / الحسم</Label>
                <Textarea
                  defaultValue={showWarnDetail.appealNotes ?? ""}
                  id="appeal-notes"
                  placeholder="أضف ملاحظات حول الطعن أو قرار الحسم..."
                  rows={2} className="resize-none text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1 text-emerald-400 border-emerald-500/30"
                  onClick={() => { updateWarning.mutate({ id: showWarnDetail.id, status: "resolved", appealNotes: (document.getElementById("appeal-notes") as HTMLTextAreaElement)?.value }); setShowWarnDetail(null); }}>
                  <CheckCircle2 className="h-3.5 w-3.5 ms-1" /> محسوم
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-blue-400 border-blue-500/30"
                  onClick={() => { updateWarning.mutate({ id: showWarnDetail.id, status: "appealed", appealNotes: (document.getElementById("appeal-notes") as HTMLTextAreaElement)?.value }); setShowWarnDetail(null); }}>
                  <Scale className="h-3.5 w-3.5 ms-1" /> مطعون به
                </Button>
              </div>
            </div>
          )}
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ════════ Investigation Form Dialog ════════ */}
      <AdaptiveDialog open={showInvForm} onOpenChange={setShowInvForm}>
        <AdaptiveDialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-amber-400" /> فتح تحقيق جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">الموظف المُحقَّق معه *</Label>
              <Select value={iForm.employeeId} onValueChange={v => setIForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName} — {e.jobTitle}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">موضوع التحقيق *</Label>
              <Input value={iForm.subject} onChange={e => setIForm(f => ({ ...f, subject: e.target.value }))} placeholder="الاشتباه في الاختلاس / الإهمال الوظيفي..." />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">وقائع وتفاصيل القضية</Label>
              <Textarea value={iForm.description} onChange={e => setIForm(f => ({ ...f, description: e.target.value }))} placeholder="اسرد الوقائع المؤدية لفتح التحقيق..." rows={3} className="resize-none" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold mb-1 block">من فتح التحقيق</Label>
                <Input value={iForm.openedBy} onChange={e => setIForm(f => ({ ...f, openedBy: e.target.value }))} placeholder="المدير المباشر" />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1 block">لجنة التحقيق</Label>
                <Input value={iForm.committee} onChange={e => setIForm(f => ({ ...f, committee: e.target.value }))} placeholder="اسم اللجنة" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">تاريخ جلسة الاستماع</Label>
              <Input type="date" value={iForm.sessionDate} onChange={e => setIForm(f => ({ ...f, sessionDate: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvForm(false)}>إلغاء</Button>
            <Button
              disabled={!iForm.employeeId || !iForm.subject || addInvestigation.isPending}
              onClick={() => addInvestigation.mutate(iForm)}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {addInvestigation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              فتح التحقيق
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* ════════ Investigation Detail/Close Dialog ════════ */}
      {showInvDetail && (
        <InvDetailDialog
          inv={showInvDetail}
          onClose={() => setShowInvDetail(null)}
          onSave={(payload) => updateInvestigation.mutate(payload)}
          isPending={updateInvestigation.isPending}
        />
      )}
    </div>
  );
}

/* ── Extracted component to satisfy React hooks rules ── */
function InvDetailDialog({ inv, onClose, onSave, isPending }: {
  inv: any;
  onClose: () => void;
  onSave: (payload: any) => void;
  isPending: boolean;
}) {
  const [outcome, setOutcome] = useState(inv.outcome ?? "");
  const [notes, setNotes] = useState(inv.notes ?? "");

  return (
    <AdaptiveDialog open onOpenChange={onClose}>
      <AdaptiveDialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-amber-400" /> إغلاق التحقيق وتسجيل النتيجة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground text-xs">الموظف</span><div className="font-semibold">{inv.employeeName}</div></div>
            <div><span className="text-muted-foreground text-xs">الحالة</span><div className="font-semibold">{INV_STATUS[inv.status]?.label}</div></div>
            <div className="col-span-2"><span className="text-muted-foreground text-xs">الموضوع</span><div className="font-semibold">{inv.subject}</div></div>
            {inv.committee && <div className="col-span-2"><span className="text-muted-foreground text-xs">اللجنة</span><div>{inv.committee}</div></div>}
            {inv.description && <div className="col-span-2"><span className="text-muted-foreground text-xs">الوقائع</span><div className="text-xs text-muted-foreground">{inv.description}</div></div>}
          </div>
          <div className="pt-2 border-t border-border/50 space-y-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">نتيجة التحقيق *</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue placeholder="اختر النتيجة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cleared">براءة — لا إجراء</SelectItem>
                  <SelectItem value="warning">توجيه إنذار</SelectItem>
                  <SelectItem value="demotion">تخفيض رتبة</SelectItem>
                  <SelectItem value="termination">إنهاء الخدمة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1 block">ملاحظات القرار</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="أضف ملاحظات القرار التفصيلية..."
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>
          <Button
            className="w-full gap-2"
            disabled={!outcome || isPending}
            onClick={() => onSave({ id: inv.id, status: "closed", outcome, notes, closedAt: new Date().toISOString() })}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Gavel className="h-4 w-4" /> إغلاق التحقيق وحفظ القرار
          </Button>
        </div>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}
