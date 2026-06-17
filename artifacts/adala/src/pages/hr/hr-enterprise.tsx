/**
 * HR Enterprise Dashboard — لوحة الموارد البشرية المؤسسية
 * ─────────────────────────────────────────────────────────────
 * 6 تبويبات:
 *   1. نظرة عامة (Overview KPIs)
 *   2. الهيكل التنظيمي (Org Chart)
 *   3. الأدوار والصلاحيات (RBAC Matrix)
 *   4. الأعضاء (Members + Role Assignment)
 *   5. طلبات الموافقة (Workflows)
 *   6. سجل التدقيق (Audit Logs)
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users, Shield, GitBranch, ClipboardList, Activity,
  CheckCircle2, XCircle, Clock, AlertTriangle, Plus,
  UserCheck, UserX, Key, Loader2, Crown, Briefcase,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = "/api";

function rows(r: any): any[] { return Array.isArray(r) ? r : []; }
function fmtDate(s: string) { return s ? new Date(s).toLocaleDateString("ar-SA") : "—"; }
function fmtTime(s: string) { return s ? new Date(s).toLocaleString("ar-SA") : "—"; }

/* ── Fetch hooks ─────────────────────────────────────────────────────────── */
function useOverview() {
  return useQuery({ queryKey: ["hr-ent-overview"], queryFn: () => fetch(`${API}/hr-enterprise/overview`).then(r => r.json()), staleTime: 30_000 });
}
function useRoles() {
  return useQuery({ queryKey: ["hr-ent-roles"], queryFn: () => fetch(`${API}/hr-enterprise/roles`).then(r => r.json()), staleTime: 60_000 });
}
function useMembers() {
  return useQuery({ queryKey: ["hr-ent-members"], queryFn: () => fetch(`${API}/hr-enterprise/members`).then(r => r.json()), staleTime: 30_000 });
}
function useWorkflows(status?: string) {
  return useQuery({ queryKey: ["hr-ent-workflows", status], queryFn: () => fetch(`${API}/hr-enterprise/workflows${status ? `?status=${status}` : ""}`).then(r => r.json()), staleTime: 20_000 });
}
function useAudit() {
  return useQuery({ queryKey: ["hr-ent-audit"], queryFn: () => fetch(`${API}/hr-enterprise/audit`).then(r => r.json()), staleTime: 30_000 });
}
function useOrgChart() {
  return useQuery({ queryKey: ["hr-ent-org"], queryFn: () => fetch(`${API}/hr-enterprise/org-chart`).then(r => r.json()), staleTime: 60_000 });
}

/* ── Severity badge ────────────────────────────────────────────────────── */
const sevColor = (s: string) =>
  s === "critical" ? "destructive" : s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";

const priorityIcon = (p: string) => {
  if (p === "critical" || p === "high") return <AlertTriangle className="h-3 w-3 text-red-500" />;
  return <Clock className="h-3 w-3 text-amber-500" />;
};

const hierarchyColors: Record<number, string> = {
  1: "bg-amber-100 border-amber-400 text-amber-800",
  2: "bg-blue-100 border-blue-400 text-blue-800",
  3: "bg-green-100 border-green-400 text-green-800",
  4: "bg-purple-100 border-purple-400 text-purple-800",
  5: "bg-muted/50 border-gray-400 text-foreground/70",
};

/* ══════════════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════════════ */
export default function HREnterprise() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [wfFilter, setWfFilter] = useState("pending");
  const [newMemberOpen, setNewMemberOpen] = useState(false);
  const [newWfOpen, setNewWfOpen] = useState(false);
  const [newMember, setNewMember] = useState({ userId: "", roleName: "lawyer" });
  const [newWf, setNewWf] = useState({ type: "leave_request", subjectName: "", notes: "", priority: "normal" });

  const overview = useOverview();
  const roles    = useRoles();
  const members  = useMembers();
  const workflows = useWorkflows(wfFilter);
  const audit    = useAudit();
  const orgChart = useOrgChart();

  /* ── Mutations ── */
  const addMember = useMutation({
    mutationFn: (body: any) => fetch(`${API}/hr-enterprise/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-ent-members"] }); qc.invalidateQueries({ queryKey: ["hr-ent-overview"] }); setNewMemberOpen(false); toast({ title: "تم إضافة العضو" }); },
    onError: () => toast({ title: "خطأ", variant: "destructive" }),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, roleName }: { userId: string; roleName: string }) =>
      fetch(`${API}/hr-enterprise/members/${userId}/role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleName }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-ent-members"] }); toast({ title: "تم تغيير الدور" }); },
  });

  const suspendMember = useMutation({
    mutationFn: (userId: string) => fetch(`${API}/hr-enterprise/members/${userId}/suspend`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-ent-members"] }); toast({ title: "تم تعليق العضو" }); },
  });

  const activateMember = useMutation({
    mutationFn: (userId: string) => fetch(`${API}/hr-enterprise/members/${userId}/activate`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-ent-members"] }); toast({ title: "تم تفعيل العضو" }); },
  });

  const submitWorkflow = useMutation({
    mutationFn: (body: any) => fetch(`${API}/hr-enterprise/workflows`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-ent-workflows"] }); qc.invalidateQueries({ queryKey: ["hr-ent-overview"] }); setNewWfOpen(false); toast({ title: "تم إرسال الطلب" }); },
  });

  const approveWf = useMutation({
    mutationFn: (id: string) => fetch(`${API}/hr-enterprise/workflows/${id}/approve`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-ent-workflows"] }); toast({ title: "تم الموافقة" }); },
  });

  const rejectWf = useMutation({
    mutationFn: (id: string) => fetch(`${API}/hr-enterprise/workflows/${id}/reject`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-ent-workflows"] }); toast({ title: "تم الرفض" }); },
  });

  const ov = overview.data ?? {};

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-blue-600" />
            الموارد البشرية المؤسسية
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Identity · RBAC · Workflows · Audit · SOC Integration
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(ov.workflows?.pending ?? 0) > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <Clock className="h-4 w-4 ml-1" />
              {ov.workflows?.pending} طلب معلق
            </Badge>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "الموظفون النشطون", val: ov.employees?.active ?? 0, icon: Users, color: "text-blue-600" },
          { label: "الأعضاء المُصرَّحون", val: ov.members?.active ?? 0, icon: UserCheck, color: "text-green-600" },
          { label: "طلبات معلقة", val: ov.workflows?.pending ?? 0, icon: Clock, color: (ov.workflows?.pending ?? 0) > 0 ? "text-amber-500" : "text-muted-foreground" },
          { label: "أحداث تدقيق (30 يوم)", val: ov.auditEvents?.last30d ?? 0, icon: Activity, color: "text-purple-600" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <k.icon className={`h-8 w-8 ${k.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                {overview.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="org">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
          <TabsTrigger value="org"     className="text-xs">الهيكل التنظيمي</TabsTrigger>
          <TabsTrigger value="members" className="text-xs">الأعضاء</TabsTrigger>
          <TabsTrigger value="roles"   className="text-xs">الأدوار والصلاحيات</TabsTrigger>
          <TabsTrigger value="workflows" className="text-xs">الطلبات</TabsTrigger>
          <TabsTrigger value="audit"   className="text-xs">سجل التدقيق</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">الإعدادات</TabsTrigger>
        </TabsList>

        {/* ── 1. Org Chart ── */}
        <TabsContent value="org" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><GitBranch className="h-4 w-4" /> الهيكل التنظيمي للمكتب</CardTitle></CardHeader>
            <CardContent>
              {orgChart.isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground mb-4">هيكل الصلاحيات الهرمي — Partner → Intern</p>
                  {rows(orgChart.data).map((node: any) => (
                    <div key={node.role_name}
                      className={`p-3 rounded-lg border-r-4 ${hierarchyColors[node.hierarchy] ?? "bg-muted/30 border-border"}`}
                      style={{ marginRight: `${(node.hierarchy - 1) * 20}px` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {node.hierarchy === 1 ? <Crown className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                          <span className="font-semibold">{node.display_name}</span>
                          <span className="text-xs opacity-60">({node.role_name})</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{node.member_count} عضو</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 2. Members ── */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> أعضاء المكتب</CardTitle>
              <Dialog open={newMemberOpen} onOpenChange={setNewMemberOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 ml-1" /> إضافة عضو</Button>
                </DialogTrigger>
                <DialogContent dir="rtl">
                  <DialogHeader><DialogTitle>إضافة عضو للمكتب</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div><Label>معرف المستخدم (User ID)</Label>
                      <Input value={newMember.userId} onChange={e => setNewMember(p => ({ ...p, userId: e.target.value }))} placeholder="user_2abc..." /></div>
                    <div><Label>الدور</Label>
                      <Select value={newMember.roleName} onValueChange={v => setNewMember(p => ({ ...p, roleName: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["partner","office_manager","lawyer","accountant","assistant","intern"].map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select></div>
                    <Button className="w-full" disabled={addMember.isPending} onClick={() => addMember.mutate(newMember)}>
                      {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Plus className="h-4 w-4 ml-1" />}
                      إضافة
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {members.isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : !rows(members.data).length ? (
                <p className="text-center text-muted-foreground py-8">لا يوجد أعضاء بعد</p>
              ) : (
                <div className="space-y-3">
                  {rows(members.data).map((m: any) => (
                    <div key={m.user_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                      <div>
                        <p className="font-medium text-sm">{m.user_id}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{m.role_display_name ?? m.role_name}</Badge>
                          <Badge variant={m.status === "active" ? "default" : "destructive"} className="text-xs">
                            {m.status === "active" ? "نشط" : "موقوف"}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Select defaultValue={m.role_name} onValueChange={v => changeRole.mutate({ userId: m.user_id, roleName: v })}>
                          <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["partner","office_manager","lawyer","accountant","assistant","intern"].map(r => (
                              <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {m.status === "active" ? (
                          <Button size="sm" variant="destructive" onClick={() => suspendMember.mutate(m.user_id)}>
                            <UserX className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => activateMember.mutate(m.user_id)}>
                            <UserCheck className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Roles & Permissions Matrix ── */}
        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> مصفوفة الأدوار والصلاحيات</CardTitle></CardHeader>
            <CardContent>
              {roles.isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rows(roles.data).map((role: any) => {
                    const perms: string[] = role.permissions ?? [];
                    const isFullAccess = perms.includes("*");
                    return (
                      <div key={role.name} className={`p-4 rounded-lg border-2 ${hierarchyColors[role.hierarchy] ?? "bg-muted/30 border-border"}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-sm">{role.display_name}</h3>
                            <span className="text-xs opacity-60">{role.member_count} عضو</span>
                          </div>
                          {isFullAccess && <Badge className="text-xs bg-amber-500">صلاحيات كاملة</Badge>}
                        </div>
                        {isFullAccess ? (
                          <p className="text-xs text-amber-700 font-medium">✓ الوصول الكامل لجميع الموارد</p>
                        ) : (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {perms.map((p: string) => (
                              <div key={p} className="flex items-center gap-1 text-xs">
                                <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                <span className="font-mono">{p}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <Alert className="mt-4 bg-blue-50 border-blue-200">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs text-blue-700">
                  كل طلب API يمر عبر <strong>Authorization Engine</strong> — يتحقق من الدور والصلاحية قبل تنفيذ أي عملية
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 4. Workflows (Approvals) ── */}
        <TabsContent value="workflows" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> طلبات الموافقة</CardTitle>
              <div className="flex gap-2">
                <Select value={wfFilter} onValueChange={setWfFilter}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["pending","approved","rejected"].map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s === "pending" ? "معلق" : s === "approved" ? "موافق" : "مرفوض"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={newWfOpen} onOpenChange={setNewWfOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 ml-1" /> طلب جديد</Button>
                  </DialogTrigger>
                  <DialogContent dir="rtl">
                    <DialogHeader><DialogTitle>إرسال طلب جديد</DialogTitle></DialogHeader>
                    <div className="space-y-3 mt-2">
                      <div><Label>نوع الطلب</Label>
                        <Select value={newWf.type} onValueChange={v => setNewWf(p => ({ ...p, type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[
                              { v: "leave_request", l: "طلب إجازة" },
                              { v: "role_change", l: "تغيير دور" },
                              { v: "new_hire", l: "تعيين موظف" },
                              { v: "permission_upgrade", l: "رفع صلاحية" },
                              { v: "termination", l: "إنهاء خدمة" },
                            ].map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                          </SelectContent>
                        </Select></div>
                      <div><Label>اسم الموضوع</Label>
                        <Input value={newWf.subjectName} onChange={e => setNewWf(p => ({ ...p, subjectName: e.target.value }))} placeholder="اسم الموظف..." /></div>
                      <div><Label>الأولوية</Label>
                        <Select value={newWf.priority} onValueChange={v => setNewWf(p => ({ ...p, priority: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["low","normal","high","critical"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select></div>
                      <div><Label>ملاحظات</Label>
                        <Input value={newWf.notes} onChange={e => setNewWf(p => ({ ...p, notes: e.target.value }))} placeholder="سبب الطلب..." /></div>
                      <Button className="w-full" disabled={submitWorkflow.isPending}
                        onClick={() => submitWorkflow.mutate({ ...newWf, payload: { type: newWf.type } })}>
                        {submitWorkflow.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
                        إرسال الطلب
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {workflows.isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : !rows(workflows.data).length ? (
                <p className="text-center text-muted-foreground py-8">لا توجد طلبات</p>
              ) : (
                <div className="space-y-3">
                  {rows(workflows.data).map((wf: any) => (
                    <div key={wf.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            {priorityIcon(wf.priority)}
                            <span className="font-semibold text-sm">
                              {wf.type === "leave_request" ? "طلب إجازة" :
                               wf.type === "role_change"   ? "تغيير دور" :
                               wf.type === "new_hire"      ? "تعيين موظف" :
                               wf.type === "permission_upgrade" ? "رفع صلاحية" :
                               wf.type === "termination"   ? "إنهاء خدمة" : wf.type}
                            </span>
                            <Badge variant={sevColor(wf.priority)} className="text-xs">{wf.priority}</Badge>
                          </div>
                          {wf.subject_name && <p className="text-xs text-muted-foreground mt-1">الموضوع: {wf.subject_name}</p>}
                          {wf.notes && <p className="text-xs text-muted-foreground">{wf.notes}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{fmtTime(wf.created_at)}</p>
                        </div>
                        <Badge variant={wf.status === "pending" ? "secondary" : wf.status === "approved" ? "default" : "destructive"} className="text-xs">
                          {wf.status === "pending" ? "معلق" : wf.status === "approved" ? "موافق" : "مرفوض"}
                        </Badge>
                      </div>
                      {wf.status === "pending" && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={approveWf.isPending} onClick={() => approveWf.mutate(wf.id)}>
                            <CheckCircle2 className="h-4 w-4 ml-1" /> موافقة
                          </Button>
                          <Button size="sm" variant="destructive" disabled={rejectWf.isPending}
                            onClick={() => rejectWf.mutate(wf.id)}>
                            <XCircle className="h-4 w-4 ml-1" /> رفض
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 5. Audit Logs ── */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> سجل تدقيق HR</CardTitle></CardHeader>
            <CardContent>
              {audit.isLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : !rows(audit.data).length ? (
                <div className="text-center py-10">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-500" />
                  <p className="text-muted-foreground">لا توجد أحداث تدقيق</p>
                </div>
              ) : (
                <div className="divide-y">
                  {rows(audit.data).map((log: any) => (
                    <div key={log.id} className="py-2 flex justify-between items-start text-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={sevColor(log.severity)} className="text-xs">{log.severity}</Badge>
                          <span className="font-mono text-xs">{log.action}</span>
                        </div>
                        {log.target_name && <p className="text-xs text-muted-foreground mt-0.5">الهدف: {log.target_name}</p>}
                        {log.user_name && <p className="text-xs text-muted-foreground">بواسطة: {log.user_name}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 6. Settings ── */}
        <TabsContent value="settings" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">SOC Integration</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "تغيير الدور", desc: "يُرسَل حدث HR_ROLE_CHANGED للمنظومة الأمنية", active: true },
                  { label: "رفع الصلاحيات", desc: "يُرسَل حدث HR_PERMISSION_ESCALATION للـ SOC", active: true },
                  { label: "تعليق العضو", desc: "يُسجَّل في سجل التدقيق ويُرسَل للـ SOC", active: true },
                  { label: "طلبات عالية الأولوية", desc: "Critical/High priority تُرسَل فوراً للـ SOC", active: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Badge variant="default" className="text-xs bg-green-600">مفعَّل</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">محرك التفويض</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="bg-muted/30 p-3 rounded-lg font-mono text-xs">
                  <p className="text-muted-foreground mb-1">// Authorization Engine</p>
                  <p>authorize(userId, officeId, permission)</p>
                  <p className="text-muted-foreground mt-2">↓ يتحقق من:</p>
                  <p>hr_memberships → status='active'</p>
                  <p>hr_roles → permissions JSONB</p>
                  <p className="text-green-600">→ returns: boolean</p>
                </div>
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs text-amber-700">
                    أي role بدون office_id scope = تسريب بين المكاتب.<br />
                    النظام الحالي يُقيِّد كل دور بـ office_id إلزامياً.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
