import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BrainCircuit, Clock, AlertTriangle, DollarSign, Users,
  CheckCircle2, XCircle, Play, RefreshCw, ChevronDown,
  ChevronRight, Shield, Zap, FileWarning} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const ACTION_TYPE_ICONS: Record<string, any> = {
  deadline_alert:    Clock,
  litigation_risk:   FileWarning,
  financial_anomaly: DollarSign,
  assignment:        Users,
  follow_up:         CheckCircle2};
const ACTION_TYPE_LABELS: Record<string, string> = {
  deadline_alert:    "تنبيه موعد",
  litigation_risk:   "خطر مرافعة",
  financial_anomaly: "شذوذ مالي",
  assignment:        "تكليف",
  follow_up:         "متابعة"};
const PRIORITY_CONFIG: Record<string, { label: string; cls: string }> = {
  critical: { label: "حرج",    cls: "bg-red-100 text-red-700 border-red-300" },
  high:     { label: "عالي",   cls: "bg-orange-100 text-orange-700 border-orange-300" },
  medium:   { label: "متوسط",  cls: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  low:      { label: "منخفض",  cls: "bg-blue-100 text-blue-700 border-blue-300" }};
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending_approval: { label: "بانتظار الموافقة", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  approved:         { label: "موافق عليه",       cls: "bg-green-100 text-green-700 border-green-300" },
  rejected:         { label: "مرفوض",             cls: "bg-red-100 text-red-700 border-red-300" },
  executed:         { label: "منفّذ",              cls: "bg-indigo-100 text-indigo-700 border-indigo-300" },
  dismissed:        { label: "مُغلق",              cls: "bg-gray-100 text-gray-600 border-gray-300" }};

function MonitoringCard({ label, value, icon: Icon, color, alert }: any) {
  return (
    <Card className={alert && value > 0 ? "border-red-200 bg-red-50" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-3xl font-bold ${alert && value > 0 ? "text-red-600" : color}`}>{value}</p>
          </div>
          <Icon className={`h-5 w-5 ${alert && value > 0 ? "text-red-500" : color} opacity-70`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function LegalCOOPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("dashboard");
  const [statusFilter, setStatusFilter] = useState("pending_approval");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ action: "approve" | "reject" | "execute"; id: string; title: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["jlwm", "coo", "dashboard"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/jlwm/coo/dashboard`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    staleTime: 60_000,
    refetchInterval: 120_000});

  const { data: actions, isLoading: actionsLoading } = useQuery({
    queryKey: ["jlwm", "coo", "actions", statusFilter],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/jlwm/coo/actions?status=${statusFilter}&limit=30`);
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ actions: any[] }>;
    },
    staleTime: 30_000});

  const scanMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/api/jlwm/coo/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }});
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: `✅ تم المسح — تم إنشاء ${d.generated ?? 0} إجراء جديد` });
      qc.invalidateQueries({ queryKey: ["jlwm", "coo"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" })});

  async function doAction(action: "approve" | "reject" | "execute", id: string) {
    const endpoint = `${BASE}/api/jlwm/coo/actions/${id}/${action}`;
    const body = action === "reject" ? { reason: rejectReason } : {};
    const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  const actionMut = useMutation({
    mutationFn: async ({ action, id }: { action: "approve" | "reject" | "execute"; id: string }) =>
      doAction(action, id),
    onSuccess: (_, v) => {
      const labels: Record<string, string> = { approve: "تمت الموافقة ✅", reject: "تم الرفض", execute: "تم التنفيذ ✅" };
      toast({ title: labels[v.action] ?? "تم" });
      qc.invalidateQueries({ queryKey: ["jlwm", "coo"] });
      setConfirmDialog(null);
      setRejectReason("");
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" })});

  const mon = dashboard?.monitoring ?? {};
  const stats = dashboard?.action_stats ?? {};

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-violet-600" />
            المدير التشغيلي الذكي (Legal COO)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">مراقبة استباقية + خطط عمل تتطلب موافقتك قبل التنفيذ</p>
        </div>
        <Button onClick={() => scanMut.mutate()} disabled={scanMut.isPending}>
          <RefreshCw className={`h-4 w-4 me-1 ${scanMut.isPending ? "animate-spin" : ""}`} />
          {scanMut.isPending ? "جارٍ المسح الذكي..." : "تشغيل مسح ذكي"}
        </Button>
      </div>

      {/* Monitoring Cards */}
      {!dashLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MonitoringCard label="مواعيد خلال 72 ساعة" value={mon.deadlines_72h ?? 0} icon={Clock} color="text-orange-600" alert />
          <MonitoringCard label="قضايا في خطر" value={mon.litigation_risks ?? 0} icon={FileWarning} color="text-red-600" alert />
          <MonitoringCard label="تنبيهات مالية" value={mon.financial_alerts ?? 0} icon={DollarSign} color="text-amber-600" alert />
          <MonitoringCard label="أعضاء فريق متأخرون" value={mon.team_overloaded ?? 0} icon={Users} color="text-blue-600" alert />
        </div>
      )}

      {/* Action Stats */}
      {!dashLoading && (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {[
            { label: "بانتظار الموافقة", val: stats.pending ?? 0, cls: "text-amber-600" },
            { label: "موافق عليه", val: stats.approved ?? 0, cls: "text-green-600" },
            { label: "منفّذ", val: stats.executed ?? 0, cls: "text-indigo-600" },
            { label: "مرفوض", val: stats.rejected ?? 0, cls: "text-red-500" },
            { label: "حرجة", val: stats.critical ?? 0, cls: "text-red-700 font-bold" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="pt-3 pb-3 text-center">
                <div className={`text-2xl font-bold ${s.cls}`}>{s.val}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap gap-1 p-1 bg-muted/40">
          <TabsTrigger value="dashboard">المراقبة الحية</TabsTrigger>
          <TabsTrigger value="actions">
            خطط العمل
            {(stats.pending ?? 0) > 0 && (
              <Badge variant="destructive" className="ms-1 h-4 text-[10px] px-1">{stats.pending}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Live Monitoring */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          {dashLoading ? (
            <div className="text-center py-12 text-muted-foreground">جارٍ تحميل لوحة المراقبة...</div>
          ) : (
            <>
              {(dashboard?.deadlines ?? []).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-600 flex items-center gap-2">
                      <Clock className="h-4 w-4" /> المواعيد الحرجة — خلال 72 ساعة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(dashboard.deadlines as any[]).map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-md border bg-orange-50/50 border-orange-100">
                        <Clock className="h-4 w-4 text-orange-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{d.case_title ?? d.task_title ?? "مهمة"}</div>
                          <div className="text-xs text-muted-foreground">{d.client_name}</div>
                        </div>
                        <Badge variant="outline" className={Number(d.hours_remaining ?? 24) < 24 ? "text-red-600 border-red-300" : "text-orange-600 border-orange-300"}>
                          {Math.max(0, Math.round(Number(d.hours_remaining ?? 0)))} ساعة
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {(dashboard?.risks ?? []).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-600 flex items-center gap-2">
                      <FileWarning className="h-4 w-4" /> قضايا في خطر — تتطلب متابعة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(dashboard.risks as any[]).map((r: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-2 rounded-md border bg-red-50/40 border-red-100">
                        <FileWarning className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{r.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {Math.round(Number(r.days_since_update ?? 0))} يوم بدون تحديث •{" "}
                            {r.overdue_tasks ?? 0} مهام متأخرة
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {(dashboard?.anomalies ?? []).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-amber-700 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> تحذيرات مالية
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(dashboard.anomalies as any[]).map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-md border bg-amber-50/50 border-amber-100">
                        <DollarSign className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">{a.client_name}</div>
                          <div className="text-xs text-muted-foreground">{a.invoice_count} فاتورة غير مسددة</div>
                        </div>
                        <span className="font-bold text-amber-700 text-sm">
                          {Number(a.unpaid_amount ?? 0).toLocaleString("ar")} ريال
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {!dashLoading && !(dashboard?.deadlines?.length) && !(dashboard?.risks?.length) && !(dashboard?.anomalies?.length) && (
                <Card>
                  <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
                    <Shield className="h-10 w-10 mx-auto mb-3 text-emerald-500 opacity-60" />
                    <p className="font-medium text-emerald-700">كل شيء طبيعي — لا توجد مخاطر فورية</p>
                    <p className="text-sm mt-1">يمكنك تشغيل مسح ذكي للحصول على خطط عمل استباقية</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Action Plans */}
        <TabsContent value="actions" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending_approval">بانتظار الموافقة</SelectItem>
                <SelectItem value="approved">موافق عليه</SelectItem>
                <SelectItem value="executed">منفّذ</SelectItem>
                <SelectItem value="rejected">مرفوض</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{actions?.actions?.length ?? 0} إجراء</span>
          </div>

          {actionsLoading ? (
            <div className="text-center py-12 text-muted-foreground">جارٍ التحميل...</div>
          ) : !actions?.actions?.length ? (
            <Card>
              <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
                <Zap className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>لا توجد إجراءات بهذا الفلتر. شغّل مسحاً ذكياً لإنشاء خطط عمل.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {actions.actions.map((a: any) => {
                const Icon = ACTION_TYPE_ICONS[a.action_type] ?? AlertTriangle;
                const prCfg = PRIORITY_CONFIG[a.priority] ?? PRIORITY_CONFIG.medium;
                const stCfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending_approval;
                const isExpanded = expandedId === a.id;
                return (
                  <Card key={a.id} className={`transition-shadow hover:shadow-sm ${a.priority === "critical" ? "border-red-300" : ""}`}>
                    <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : a.id)}>
                      <div className="flex items-start gap-3">
                        <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{a.title}</span>
                            <Badge variant="outline" className={prCfg.cls}>{prCfg.label}</Badge>
                            <Badge variant="outline" className={stCfg.cls}>{stCfg.label}</Badge>
                            <Badge variant="outline" className="text-xs">
                              {ACTION_TYPE_LABELS[a.action_type] ?? a.action_type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.description}</p>
                        </div>
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="pt-0 space-y-3">
                        <p className="text-sm">{a.description}</p>

                        {a.suggested_action && (
                          <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">الإجراء المقترح</p>
                            <p className="text-sm"><b>ما يجب فعله:</b> {a.suggested_action.action}</p>
                            {a.suggested_action.assignee_suggestion && (
                              <p className="text-sm"><b>المسؤول:</b> {a.suggested_action.assignee_suggestion}</p>
                            )}
                            {a.suggested_action.deadline && (
                              <p className="text-sm"><b>الموعد:</b> {a.suggested_action.deadline}</p>
                            )}
                            {a.suggested_action.steps?.length > 0 && (
                              <ul className="text-xs space-y-1 mt-1">
                                {a.suggested_action.steps.map((s: string, i: number) => (
                                  <li key={i} className="flex items-start gap-1"><span className="text-blue-500 mt-0.5">•</span> {s}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {a.ai_reasoning && (
                          <div className="border-s-2 border-violet-400 ps-3">
                            <p className="text-xs text-muted-foreground"><b>تحليل الذكاء الاصطناعي:</b> {a.ai_reasoning}</p>
                          </div>
                        )}

                        {/* Action Buttons */}
                        {a.status === "pending_approval" && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => setConfirmDialog({ action: "approve", id: a.id, title: a.title })}>
                              <CheckCircle2 className="h-3.5 w-3.5 me-1" /> موافقة
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setConfirmDialog({ action: "reject", id: a.id, title: a.title })}>
                              <XCircle className="h-3.5 w-3.5 me-1" /> رفض
                            </Button>
                          </div>
                        )}
                        {a.status === "approved" && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700"
                              onClick={() => setConfirmDialog({ action: "execute", id: a.id, title: a.title })}>
                              <Play className="h-3.5 w-3.5 me-1" /> تأكيد التنفيذ
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Confirm Dialog */}
      <AdaptiveDialog open={!!confirmDialog} onOpenChange={() => { setConfirmDialog(null); setRejectReason(""); }}>
        <AdaptiveDialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === "approve" ? "موافقة على الإجراء"
              : confirmDialog?.action === "reject" ? "رفض الإجراء"
              : "تأكيد التنفيذ"}
            </DialogTitle>
            <DialogDescription>{confirmDialog?.title}</DialogDescription>
          </DialogHeader>
          {confirmDialog?.action === "reject" && (
            <Textarea
              placeholder="سبب الرفض (اختياري)..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
            />
          )}
          {confirmDialog?.action === "execute" && (
            <p className="text-sm text-muted-foreground">
              هذا الإجراء قد تمت الموافقة عليه. تأكيد التنفيذ يسجّله كمنجَز في النظام.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialog(null); setRejectReason(""); }}>إلغاء</Button>
            <Button
              onClick={() => confirmDialog && actionMut.mutate({ action: confirmDialog.action, id: confirmDialog.id })}
              disabled={actionMut.isPending}
              className={
                confirmDialog?.action === "reject" ? "bg-red-600 hover:bg-red-700"
                : confirmDialog?.action === "execute" ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-emerald-600 hover:bg-emerald-700"
              }
            >
              {actionMut.isPending ? "جارٍ..." :
                confirmDialog?.action === "approve" ? "موافقة" :
                confirmDialog?.action === "reject" ? "رفض" : "تأكيد التنفيذ"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}
