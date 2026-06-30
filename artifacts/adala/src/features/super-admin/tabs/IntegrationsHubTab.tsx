/**
 * Integrations Hub Tab — لوحة مركز التكاملات (Super Admin)
 * ─────────────────────────────────────────────────────────
 * 4 تبويبات:
 *   الكتالوج   — إدارة كل تكامل: تفعيل/تعطيل، مفاتيح، الخطة المطلوبة
 *   المكاتب    — أي مكتب لديه أي تكامل مفعّل
 *   الطلبات   — طلبات التفعيل القادمة من العملاء + الرد عليها
 *   السجل     — آخر 100 تفعيل/إلغاء
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, XCircle, Clock, Loader2, RefreshCw, Edit2,
  Send, MessageSquare, ChevronDown, Eye, Globe2, Plug,
  AlertCircle, Info, Settings, Activity, Building2,
  ToggleLeft, ToggleRight, KeyRound, Check, X, Badge as BadgeIcon,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Badge }    from "@/components/ui/badge";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch }   from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label }    from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn }       from "@/lib/utils";
import { _getToken } from "../shared/api";

/* ── helpers ─────────────────────────────────────────────── */
const PLAN_LABELS: Record<string, string> = {
  free: "مجاني", basic: "مبتدئ", starter: "مبتدئ", pro: "احترافي",
  growth: "نمو", advanced: "متقدم", enterprise: "مؤسسي", elite: "النخبة",
};
const PLAN_OPTIONS = ["free","basic","pro","growth","advanced","enterprise","elite"];
const CATEGORY_LABELS: Record<string, string> = {
  intelligence: "الذكاء الاصطناعي", communication: "التواصل",
  payments: "المدفوعات", storage: "التخزين",
  automation: "الأتمتة", legal: "قانوني", identity: "الهوية", other: "أخرى",
};

async function rawApi(path: string, opts?: RequestInit) {
  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  const token = _getToken ? await _getToken() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { headers, ...opts });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${res.status}`); }
  return res.json();
}

/* ══════════════════════════════════════════════════════════
   TAB 1 — الكتالوج
══════════════════════════════════════════════════════════ */
function CatalogTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<any>(null);
  const [form, setForm]             = useState<any>({});
  const [showConfig, setShowConfig] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "/integrations"],
    queryFn:  () => rawApi("/admin/integrations"),
    retry: false,
  });

  const updateMut = useMutation({
    mutationFn: ({ key, body }: any) => rawApi(`/admin/integrations/${key}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "تم الحفظ" }); refetch(); setEdit(null); },
    onError:   (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const integrations: any[] = data?.integrations ?? [];

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold">كتالوج التكاملات</h3>
          <p className="text-xs text-muted-foreground">إدارة كل تكامل — مفاتيح API مخزّنة هنا فقط، لا تُعرض للعملاء أبداً</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5 ml-1" /> تحديث
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {integrations.map((itg: any) => (
          <Card key={itg.key} className={cn("border transition-all", !itg.global_enabled && "opacity-60 border-border/40")}>
            <CardContent className="p-4">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: `${itg.color}15`, border: `1px solid ${itg.color}25` }}>
                  {itg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-bold truncate">{itg.name_ar}</p>
                    <Switch
                      checked={!!itg.global_enabled}
                      onCheckedChange={v => updateMut.mutate({ key: itg.key, body: { global_enabled: v } })}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{itg.name_en} · {CATEGORY_LABELS[itg.category] ?? itg.category}</p>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-1.5 bg-muted/40 rounded-lg">
                  <p className="text-[9px] text-muted-foreground">مفعّل لـ</p>
                  <p className="text-sm font-black text-emerald-400">{itg.active_offices ?? 0}</p>
                  <p className="text-[9px] text-muted-foreground">مكتب</p>
                </div>
                <div className="text-center p-1.5 bg-muted/40 rounded-lg">
                  <p className="text-[9px] text-muted-foreground">طلبات</p>
                  <p className={cn("text-sm font-black", (itg.pending_requests ?? 0) > 0 ? "text-amber-400" : "text-muted-foreground")}>{itg.pending_requests ?? 0}</p>
                  <p className="text-[9px] text-muted-foreground">معلقة</p>
                </div>
                <div className="text-center p-1.5 bg-muted/40 rounded-lg">
                  <p className="text-[9px] text-muted-foreground">الخطة</p>
                  <p className="text-[10px] font-bold text-primary">{PLAN_LABELS[itg.plan_required] ?? itg.plan_required}</p>
                </div>
              </div>

              {/* Config indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px]">
                  <KeyRound className="h-3 w-3 text-muted-foreground" />
                  <span className={cn(Object.keys(itg.config ?? {}).length > 0 ? "text-emerald-400" : "text-muted-foreground/50")}>
                    {Object.keys(itg.config ?? {}).length > 0 ? "مفاتيح مضبوطة" : "لا مفاتيح بعد"}
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] gap-1" onClick={() => {
                  setEdit(itg);
                  setForm({ plan_required: itg.plan_required, notes: itg.notes ?? "", config: JSON.stringify(itg.config ?? {}, null, 2) });
                  setShowConfig(false);
                }}>
                  <Edit2 className="h-3 w-3" /> تعديل
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit */}
      <AdaptiveDialog open={!!edit} onOpenChange={v => !v && setEdit(null)}>
        <AdaptiveDialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{edit?.icon}</span> تعديل: {edit?.name_ar}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">الخطة المطلوبة</Label>
              <Select value={form.plan_required ?? "free"} onValueChange={v => setForm((f: any) => ({ ...f, plan_required: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p}>{PLAN_LABELS[p] ?? p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">إعدادات المفاتيح (JSON)</Label>
                <button onClick={() => setShowConfig(v => !v)} className="text-[10px] text-primary hover:underline">
                  {showConfig ? "إخفاء" : "عرض / تعديل"}
                </button>
              </div>
              {showConfig ? (
                <Textarea
                  value={form.config ?? "{}"}
                  onChange={e => setForm((f: any) => ({ ...f, config: e.target.value }))}
                  className="font-mono text-xs resize-none"
                  rows={8}
                  dir="ltr"
                  placeholder='{ "bot_token": "...", "chat_id": "..." }'
                />
              ) : (
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 shrink-0" />
                  المفاتيح محمية — اضغط "عرض / تعديل" للوصول إليها
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">ملاحظات داخلية</Label>
              <Input value={form.notes ?? ""} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} placeholder="ملاحظة للفريق التقني..." className="mt-1 text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>إلغاء</Button>
            <Button
              disabled={updateMut.isPending}
              onClick={() => {
                let config: any = {};
                try { config = JSON.parse(form.config ?? "{}"); } catch { toast({ title: "JSON غير صحيح", variant: "destructive" }); return; }
                updateMut.mutate({ key: edit.key, body: { ...form, config } });
              }}
            >
              {updateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} حفظ
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB 2 — الطلبات
══════════════════════════════════════════════════════════ */
function RequestsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [respond, setRespond] = useState<any>(null);
  const [responseForm, setResponseForm]   = useState({ admin_notes: "", activate_office: false, new_status: "resolved" });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "/integration-requests", statusFilter],
    queryFn:  () => rawApi(`/admin/integration-requests?status=${statusFilter}`),
    retry: false,
  });

  const respondMut = useMutation({
    mutationFn: ({ id, body }: any) => rawApi(`/admin/integration-requests/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "تم الرد" }); refetch(); setRespond(null); },
    onError:   (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const counts = data?.counts ?? {};
  const requests: any[] = data?.requests ?? [];

  const REQUEST_TYPE_LABELS: Record<string, string> = {
    activate: "طلب تفعيل", deactivate: "طلب إلغاء", modify: "طلب تعديل", help: "استفسار",
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { v: "pending",     l: "معلقة",       c: counts.pending,     color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
          { v: "in_progress", l: "قيد التنفيذ", c: counts.in_progress, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
          { v: "resolved",    l: "مُنجزة",       c: counts.resolved,    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
          { v: "all",         l: "الكل",         c: counts.total,       color: "text-muted-foreground bg-muted/40 border-border/50" },
        ].map(s => (
          <button
            key={s.v}
            onClick={() => setStatusFilter(s.v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
              statusFilter === s.v ? s.color : "text-muted-foreground bg-transparent border-border/30 hover:bg-muted/30"
            )}
          >
            {s.l}
            {(s.c ?? 0) > 0 && <span className="min-w-[18px] text-center text-[10px] font-black">{s.c}</span>}
          </button>
        ))}
        <div className="mr-auto">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 opacity-20" />
          <p className="text-sm">لا توجد طلبات {statusFilter === "pending" ? "معلقة" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => (
            <Card key={r.id} className={cn("border", r.status === "pending" && "border-amber-500/20 bg-amber-500/3")}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">{r.icon ?? "🔌"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-bold">{r.name_ar ?? r.integration_key}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {REQUEST_TYPE_LABELS[r.request_type] ?? r.request_type} ·
                          <span className="font-mono mr-1">{String(r.office_name ?? r.office_id).slice(0, 20)}</span>
                          · {new Date(r.created_at).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0",
                        r.status === "resolved" ? "text-emerald-400 border-emerald-500/20" :
                        r.status === "in_progress" ? "text-blue-400 border-blue-500/20" :
                        "text-amber-400 border-amber-500/20"
                      )}>
                        {r.status === "resolved" ? "مُنجز" : r.status === "in_progress" ? "قيد التنفيذ" : "معلق"}
                      </Badge>
                    </div>
                    {r.message && (
                      <p className="text-xs text-muted-foreground mt-1.5 bg-muted/30 rounded-lg px-3 py-2">"{r.message}"</p>
                    )}
                    {r.admin_notes && (
                      <p className="text-xs text-blue-400 mt-1.5 flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3" /> {r.admin_notes}
                      </p>
                    )}
                  </div>
                  {r.status !== "resolved" && (
                    <Button size="sm" className="shrink-0 h-8 text-xs gap-1.5" onClick={() => {
                      setRespond(r);
                      setResponseForm({ admin_notes: "", activate_office: r.request_type === "activate", new_status: "resolved" });
                    }}>
                      <Send className="h-3.5 w-3.5" /> رد
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Respond */}
      <AdaptiveDialog open={!!respond} onOpenChange={v => !v && setRespond(null)}>
        {respond && (
          <AdaptiveDialogContent>
            <DialogHeader>
              <DialogTitle>الرد على طلب: {respond.name_ar} — {respond.office_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs">الحالة الجديدة</Label>
                <Select value={responseForm.new_status} onValueChange={v => setResponseForm(f => ({ ...f, new_status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                    <SelectItem value="resolved">مُنجز</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {respond.request_type === "activate" && (
                <div className="flex items-center justify-between p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
                  <div>
                    <Label className="text-xs font-bold">تفعيل تلقائي للمكتب</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">تفعيل التكامل للمكتب فوراً عند الإنجاز</p>
                  </div>
                  <Switch checked={responseForm.activate_office} onCheckedChange={v => setResponseForm(f => ({ ...f, activate_office: v }))} />
                </div>
              )}
              <div>
                <Label className="text-xs">رد للعميل (اختياري)</Label>
                <Textarea
                  value={responseForm.admin_notes}
                  onChange={e => setResponseForm(f => ({ ...f, admin_notes: e.target.value }))}
                  placeholder="تم تفعيل التكامل بنجاح. يمكنك البدء باستخدامه الآن..."
                  rows={3}
                  className="text-xs mt-1 resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRespond(null)}>إلغاء</Button>
              <Button
                disabled={respondMut.isPending}
                onClick={() => respondMut.mutate({ id: respond.id, body: { status: responseForm.new_status, admin_notes: responseForm.admin_notes || null, activate_office: responseForm.activate_office } })}
              >
                {respondMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} إرسال الرد
              </Button>
            </DialogFooter>
          </AdaptiveDialogContent>
        )}
      </AdaptiveDialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB 3 — المكاتب
══════════════════════════════════════════════════════════ */
function OfficesTab({ toast }: any) {
  const qc = useQueryClient();
  const [activate, setActivate] = useState<any>(null);
  const [activateForm, setActivateForm]     = useState({ is_active: true, notes: "" });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin", "/integrations/office-matrix"],
    queryFn:  () => rawApi("/admin/integrations/office-matrix"),
    retry: false,
  });

  const updateMut = useMutation({
    mutationFn: ({ key, officeId, body }: any) =>
      rawApi(`/admin/integrations/${key}/offices/${officeId}`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { toast({ title: "تم التحديث" }); refetch(); setActivate(null); },
    onError:   (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const matrix = data?.matrix ?? {};
  const offices = Object.entries(matrix) as [string, any[]][];

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (offices.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
      <Building2 className="h-8 w-8 opacity-20" />
      <p className="text-sm">لا توجد بيانات تفعيل بعد — فعّل تكاملات للمكاتب من تبويب الكتالوج</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">التكاملات المفعّلة حسب المكتب</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" /></Button>
      </div>
      {offices.map(([officeId, items]) => (
        <Card key={officeId}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground">{officeId}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {items.map((item: any) => (
                <div
                  key={item.integration_key}
                  className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium cursor-pointer transition-all",
                    item.is_active ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-muted/30 border-border/50 text-muted-foreground"
                  )}
                  onClick={() => { setActivate({ ...item, officeId }); setActivateForm({ is_active: !item.is_active, notes: "" }); }}
                >
                  <span>{item.icon ?? "🔌"}</span>
                  {item.name_ar}
                  {item.is_active
                    ? <CheckCircle2 className="h-3 w-3" />
                    : <XCircle className="h-3 w-3" />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <AdaptiveDialog open={!!activate} onOpenChange={v => !v && setActivate(null)}>
        {activate && (
          <AdaptiveDialogContent>
            <DialogHeader>
              <DialogTitle>
                {activateForm.is_active ? "تفعيل" : "إلغاء تفعيل"}: {activate.name_ar}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">المكتب: <span className="font-mono">{activate.officeId}</span></p>
              <div>
                <Label className="text-xs">ملاحظة (اختياري)</Label>
                <Input className="mt-1 text-xs" value={activateForm.notes} onChange={e => setActivateForm(f => ({ ...f, notes: e.target.value }))} placeholder="سبب التفعيل أو الملاحظة..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActivate(null)}>إلغاء</Button>
              <Button
                disabled={updateMut.isPending}
                className={activateForm.is_active ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
                onClick={() => updateMut.mutate({ key: activate.integration_key, officeId: activate.officeId, body: activateForm })}
              >
                {updateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : activateForm.is_active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {activateForm.is_active ? "تفعيل" : "إلغاء تفعيل"}
              </Button>
            </DialogFooter>
          </AdaptiveDialogContent>
        )}
      </AdaptiveDialog>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════ */
export function IntegrationsHubTab({ qc, toast }: any) {
  const [subTab, setSubTab] = useState("catalog");

  /* Pending requests count for badge */
  const { data: counts } = useQuery({
    queryKey: ["admin", "/integration-requests/counts"],
    queryFn:  () => rawApi("/admin/integration-requests/counts"),
    refetchInterval: 30_000,
    retry: false,
  });
  const pendingCount = counts?.pending ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Plug className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-black">مركز التكاملات المُدار</h2>
          <p className="text-xs text-muted-foreground">المفاتيح هنا فقط — العملاء يطلبون، أنت تُفعّل</p>
        </div>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="catalog"  className="text-xs gap-1.5"><Settings className="h-3.5 w-3.5" />الكتالوج</TabsTrigger>
          <TabsTrigger value="requests" className="text-xs gap-1.5 relative">
            <MessageSquare className="h-3.5 w-3.5" />الطلبات
            {pendingCount > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center px-0.5">{pendingCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="offices"  className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" />المكاتب</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog"  className="mt-4"><CatalogTab /></TabsContent>
        <TabsContent value="requests" className="mt-4"><RequestsTab /></TabsContent>
        <TabsContent value="offices"  className="mt-4"><OfficesTab toast={toast} /></TabsContent>
      </Tabs>
    </div>
  );
}
