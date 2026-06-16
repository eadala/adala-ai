import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Plus, Loader2, CheckCircle2, XCircle, Clock,
  Filter, Users, ChevronDown, FileText, Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LEAVE_TYPES: Record<string, { label: string; color: string }> = {
  annual: { label: "سنوية", color: "#6366F1" },
  sick: { label: "مرضية", color: "#EF4444" },
  emergency: { label: "طارئة", color: "#F97316" },
  maternity: { label: "أمومة", color: "#EC4899" },
  unpaid: { label: "بدون راتب", color: "#6B7280" },
  official: { label: "رسمية", color: "#10B981" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending: { label: "قيد المراجعة", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: Clock },
  approved: { label: "موافق عليها", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
  rejected: { label: "مرفوضة", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: XCircle },
};

const EMPTY_FORM = { employeeId: "", type: "annual", startDate: "", endDate: "", reason: "" };

export default function Leaves() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: leaves = [], isLoading } = useQuery<any[]>({
    queryKey: ["leaves"],
    queryFn: () => fetch("/api/hr/leaves").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["leaves-stats"],
    queryFn: () => fetch("/api/hr/leaves/stats").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["employees"],
    queryFn: () => fetch("/api/hr/employees").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/hr/leaves", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leaves"] }); qc.invalidateQueries({ queryKey: ["leaves-stats"] }); setShowCreate(false); setForm({ ...EMPTY_FORM }); toast({ title: "تم تقديم طلب الإجازة" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/hr/leaves/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, approvedBy: "مدير الموارد البشرية" }) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: (_, { status }) => { qc.invalidateQueries({ queryKey: ["leaves"] }); qc.invalidateQueries({ queryKey: ["leaves-stats"] }); toast({ title: status === "approved" ? "تمت الموافقة" : "تم الرفض" }); },
  });

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    return Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  };

  const filtered = leaves.filter(l => statusFilter === "all" || l.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">الإجازات</h1>
          <p className="text-muted-foreground text-sm">إدارة طلبات الإجازات والموافقة عليها</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> طلب إجازة
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الطلبات", value: stats.total, color: "#6366F1", icon: CalendarDays },
            { label: "قيد المراجعة", value: stats.pending, color: "#F59E0B", icon: Clock },
            { label: "موافق عليها", value: stats.approved, color: "#10B981", icon: CheckCircle2 },
            { label: "مرفوضة", value: stats.rejected, color: "#EF4444", icon: XCircle },
          ].map(s => (
            <Card key={s.label} className="border-0 bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${s.color}15` }}>
                  <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
                </div>
                <div>
                  <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ v: "all", l: "الكل" }, { v: "pending", l: "قيد المراجعة" }, { v: "approved", l: "موافق" }, { v: "rejected", l: "مرفوض" }].map(f => (
          <button key={f.v} onClick={() => setStatusFilter(f.v)}
            className={cn("text-xs px-4 py-1.5 rounded-xl border font-medium transition-all",
              statusFilter === f.v ? "bg-primary/10 border-primary text-primary" : "border-muted text-muted-foreground hover:border-primary/30")}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Leave Cards */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>لا توجد طلبات إجازة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((l: any) => {
            const s = STATUS_CONFIG[l.status] ?? STATUS_CONFIG.pending;
            const t = LEAVE_TYPES[l.type] ?? LEAVE_TYPES.annual;
            const StatusIcon = s.icon;
            return (
              <Card key={l.id} className="hover:border-primary/20 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: `${t.color}15` }}>
                        <CalendarDays className="h-5 w-5" style={{ color: t.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-sm">{l.employeeName}</span>
                          <Badge className="text-[9px] px-2 py-0" style={{ background: `${t.color}15`, color: t.color, border: `1px solid ${t.color}30` }}>{t.label}</Badge>
                          <div className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border", s.bg, s.color)}>
                            <StatusIcon className="h-3 w-3" />{s.label}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {l.jobTitle} · من {l.startDate} إلى {l.endDate} · <span className="font-bold text-foreground">{l.days} يوم</span>
                        </div>
                        {l.reason && <p className="text-xs text-muted-foreground">{l.reason}</p>}
                        {l.approvedBy && <p className="text-[10px] text-muted-foreground mt-1">تمت المراجعة بواسطة: {l.approvedBy}</p>}
                      </div>
                    </div>

                    {l.status === "pending" && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" className="h-8 gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => updateMutation.mutate({ id: l.id, status: "approved" })} disabled={updateMutation.isPending}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> موافقة
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                          onClick={() => updateMutation.mutate({ id: l.id, status: "rejected" })} disabled={updateMutation.isPending}>
                          <XCircle className="h-3.5 w-3.5" /> رفض
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>طلب إجازة جديد</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>الموظف *</Label>
              <Select value={form.employeeId} onValueChange={v => setForm(p => ({ ...p, employeeId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>نوع الإجازة</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LEAVE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>تاريخ البداية *</Label><Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} /></div>
              <div><Label>تاريخ النهاية *</Label><Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} /></div>
            </div>
            {form.startDate && form.endDate && (
              <p className="text-xs text-primary font-semibold">عدد الأيام: {calcDays(form.startDate, form.endDate)} يوم</p>
            )}
            <div><Label>السبب</Label><Textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} className="resize-none min-h-[70px] text-sm" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.employeeId || !form.startDate || !form.endDate || createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} تقديم الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
