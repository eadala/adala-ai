import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, Plus, Loader2, Search, MoreHorizontal, Trash2, Edit3,
  Phone, Mail, Briefcase, Building2, DollarSign, Calendar, Filter,
  UserCheck, UserX, ChevronDown, X, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const DEPARTMENTS = ["القانوني", "الإداري", "المالي", "تقنية المعلومات", "الموارد البشرية", "خدمة العملاء"];
const CONTRACT_TYPES: Record<string, string> = { permanent: "دائم", temporary: "مؤقت", parttime: "جزء من الوقت", freelance: "مستقل" };
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "نشط", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  inactive: { label: "غير نشط", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  onleave: { label: "إجازة", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
};

const EMPTY_FORM = {
  employeeNo: "", fullName: "", email: "", phone: "", nationalId: "",
  jobTitle: "", department: "", salary: "", salaryType: "monthly",
  hireDate: "", contractType: "permanent", status: "active", gender: "male",
  nationality: "سعودي", notes: "",
};

function EmployeeCard({ emp, onEdit, onDelete }: any) {
  const s = STATUS_CONFIG[emp.status] ?? STATUS_CONFIG.active;
  const initials = emp.fullName?.split(" ").map((w: string) => w[0]).slice(0, 2).join("") ?? "؟";
  return (
    <Card className="group hover:border-primary/30 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-sm flex-shrink-0">
              {initials}
            </div>
            <div>
              <h3 className="font-bold text-sm">{emp.fullName}</h3>
              <p className="text-xs text-muted-foreground">{emp.jobTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-[10px] px-2 py-0", s.bg, s.color)}>{s.label}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onEdit(emp)}><Edit3 className="h-4 w-4 ml-2" /> تعديل</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(emp.id)} className="text-red-400"><Trash2 className="h-4 w-4 ml-2" /> حذف</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="space-y-1.5">
          {emp.department && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="h-3.5 w-3.5" />{emp.department}</div>}
          {emp.email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5" />{emp.email}</div>}
          {emp.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" />{emp.phone}</div>}
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" />تاريخ التعيين: {emp.hireDate ?? "—"}</div>
        </div>
        <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50">
          <div className="flex items-center gap-1 text-xs">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <span className="font-black text-primary">{parseFloat(emp.salary || "0").toLocaleString("ar-SA")}</span>
            <span className="text-muted-foreground">ريال</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{emp.employeeNo}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmployeeForm({ form, setForm, onSubmit, loading, isEdit, onClose }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>رقم الموظف *</Label><Input value={form.employeeNo} onChange={e => setForm((p: any) => ({ ...p, employeeNo: e.target.value }))} placeholder="EMP-001" /></div>
        <div><Label>الاسم الكامل *</Label><Input value={form.fullName} onChange={e => setForm((p: any) => ({ ...p, fullName: e.target.value }))} /></div>
        <div><Label>البريد الإلكتروني</Label><Input value={form.email} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} type="email" /></div>
        <div><Label>الجوال</Label><Input value={form.phone} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} /></div>
        <div><Label>رقم الهوية</Label><Input value={form.nationalId} onChange={e => setForm((p: any) => ({ ...p, nationalId: e.target.value }))} /></div>
        <div><Label>المسمى الوظيفي *</Label><Input value={form.jobTitle} onChange={e => setForm((p: any) => ({ ...p, jobTitle: e.target.value }))} /></div>
        <div><Label>القسم</Label>
          <Select value={form.department} onValueChange={v => setForm((p: any) => ({ ...p, department: v }))}>
            <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
            <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>الراتب الأساسي (ريال) *</Label><Input value={form.salary} onChange={e => setForm((p: any) => ({ ...p, salary: e.target.value }))} type="number" /></div>
        <div><Label>نوع العقد</Label>
          <Select value={form.contractType} onValueChange={v => setForm((p: any) => ({ ...p, contractType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(CONTRACT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>تاريخ التعيين</Label><Input value={form.hireDate} onChange={e => setForm((p: any) => ({ ...p, hireDate: e.target.value }))} type="date" /></div>
        <div><Label>الجنس</Label>
          <Select value={form.gender} onValueChange={v => setForm((p: any) => ({ ...p, gender: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="male">ذكر</SelectItem><SelectItem value="female">أنثى</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>الجنسية</Label><Input value={form.nationality} onChange={e => setForm((p: any) => ({ ...p, nationality: e.target.value }))} /></div>
      </div>
      {isEdit && (
        <div><Label>الحالة</Label>
          <Select value={form.status} onValueChange={v => setForm((p: any) => ({ ...p, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">نشط</SelectItem>
              <SelectItem value="inactive">غير نشط</SelectItem>
              <SelectItem value="onleave">إجازة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <div><Label>ملاحظات</Label><Textarea value={form.notes} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} className="resize-none min-h-[60px] text-sm" /></div>
    </div>
  );
}

export default function Employees() {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editEmp, setEditEmp] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: employees = [], isLoading } = useQuery<any[]>({
    queryKey: ["employees"],
    queryFn: () => fetch("/api/hr/employees").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["employees-stats"],
    queryFn: () => fetch("/api/hr/employees/stats").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/hr/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["employees-stats"] }); setShowCreate(false); setForm({ ...EMPTY_FORM }); toast({ title: "تم إضافة الموظف" }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => fetch(`${BASE}/api/hr/employees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); setEditEmp(null); toast({ title: "تم التحديث" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/api/hr/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["employees-stats"] }); toast({ title: "تم الحذف" }); },
  });

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    if (q && !e.fullName?.toLowerCase().includes(q) && !e.jobTitle?.toLowerCase().includes(q) && !e.employeeNo?.toLowerCase().includes(q)) return false;
    if (deptFilter !== "all" && e.department !== deptFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    return true;
  });

  const openEdit = (emp: any) => { setEditEmp(emp); setForm({ employeeNo: emp.employeeNo, fullName: emp.fullName, email: emp.email ?? "", phone: emp.phone ?? "", nationalId: emp.nationalId ?? "", jobTitle: emp.jobTitle, department: emp.department ?? "", salary: emp.salary, salaryType: emp.salaryType ?? "monthly", hireDate: emp.hireDate ?? "", contractType: emp.contractType ?? "permanent", status: emp.status, gender: emp.gender ?? "male", nationality: emp.nationality ?? "سعودي", notes: emp.notes ?? "" }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black">الموظفون</h1>
          <p className="text-muted-foreground text-sm">إدارة بيانات الموظفين والعقود</p>
        </div>
        <Button onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreate(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> إضافة موظف
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "إجمالي الموظفين", value: stats.total, color: "#6366F1", icon: Users },
            { label: "الموظفون النشطون", value: stats.active, color: "#10B981", icon: UserCheck },
            { label: "غير نشط", value: stats.inactive, color: "#EF4444", icon: UserX },
            { label: "إجمالي الرواتب", value: `${(stats.totalSalaries / 1000).toFixed(0)}k ر`, color: "#2563EB", icon: DollarSign },
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو المسمى أو الرقم..." className="pr-9" />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="القسم" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأقسام</SelectItem>
            {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="inactive">غير نشط</SelectItem>
            <SelectItem value="onleave">إجازة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>لا يوجد موظفون — أضف أول موظف</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(e => <EmployeeCard key={e.id} emp={e} onEdit={openEdit} onDelete={(id: string) => deleteMutation.mutate(id)} />)}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>إضافة موظف جديد</DialogTitle></DialogHeader>
          <EmployeeForm form={form} setForm={setForm} isEdit={false} onClose={() => setShowCreate(false)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>إلغاء</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={!form.fullName || !form.jobTitle || !form.employeeNo || createMutation.isPending} className="gap-2">
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />} إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editEmp} onOpenChange={v => !v && setEditEmp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>تعديل بيانات الموظف</DialogTitle></DialogHeader>
          <EmployeeForm form={form} setForm={setForm} isEdit={true} onClose={() => setEditEmp(null)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmp(null)}>إلغاء</Button>
            <Button onClick={() => updateMutation.mutate({ id: editEmp.id, data: form })} disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}<Save className="h-4 w-4" /> حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
