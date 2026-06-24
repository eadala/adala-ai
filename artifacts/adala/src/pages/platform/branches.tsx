import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Plus, MapPin, Users, Scale, Receipt, Loader2,
  MoreVertical, Pencil, Trash2, ArrowRightLeft, TrendingUp,
  AlertTriangle, Crown, CheckCircle2, XCircle, BarChart3,
  Phone, Mail, GitBranch, RefreshCw, ChevronRight,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Branch {
  id: string;
  office_id: string;
  name: string;
  code?: string;
  location?: string;
  description?: string;
  phone?: string;
  email?: string;
  manager_name?: string;
  status: "active" | "inactive";
  created_at: string;
  cases_count?: number;
  clients_count?: number;
  tasks_count?: number;
}

const PLAN_LABELS: Record<string, string> = {
  free: "مجاني",
  starter: "مبتدئ",
  basic: "أساسي",
  professional: "احترافي",
  growth: "نمو",
  enterprise: "مؤسسات",
  ultimate: "الأقصى",
  white_label: "وايت لابل",
};

const NEXT_PLAN: Record<string, string> = {
  free: "starter", starter: "basic", basic: "professional",
  professional: "growth", growth: "enterprise",
};

function StatCard({ icon: Icon, label, value, color = "text-primary" }: { icon: any; label: string; value: string | number; color?: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LimitBar({ current, limit }: { current: number; limit: number | "unlimited" }) {
  if (limit === "unlimited") return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>فروع غير محدودة</span>
    </div>
  );
  const pct = Math.min((current / (limit as number)) * 100, 100);
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{current} من {limit} فرع</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function BranchCard({
  branch,
  onEdit,
  onDelete,
  onTransfer,
}: {
  branch: Branch;
  onEdit: (b: Branch) => void;
  onDelete: (b: Branch) => void;
  onTransfer: (b: Branch) => void;
}) {
  return (
    <Card className="border-border/50 hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{branch.name}</h3>
              {branch.code && <p className="text-xs text-muted-foreground font-mono">{branch.code}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={branch.status === "active" ? "default" : "secondary"} className="text-[10px]">
              {branch.status === "active" ? "نشط" : "غير نشط"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(branch)}>
                  <Pencil className="h-4 w-4 ms-2" /> تعديل
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTransfer(branch)}>
                  <ArrowRightLeft className="h-4 w-4 ms-2" /> تحويل قضية لهذا الفرع
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(branch)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 ms-2" /> تعطيل الفرع
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {branch.location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <MapPin className="h-3.5 w-3.5" />
            <span>{branch.location}</span>
          </div>
        )}
        {branch.manager_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Users className="h-3.5 w-3.5" />
            <span>المدير: {branch.manager_name}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50">
          <div className="text-center">
            <Scale className="h-4 w-4 mx-auto text-blue-500 mb-0.5" />
            <p className="text-sm font-bold">{branch.cases_count ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">قضية</p>
          </div>
          <div className="text-center">
            <Users className="h-4 w-4 mx-auto text-emerald-500 mb-0.5" />
            <p className="text-sm font-bold">{branch.clients_count ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">موكّل</p>
          </div>
          <div className="text-center">
            <CheckCircle2 className="h-4 w-4 mx-auto text-violet-500 mb-0.5" />
            <p className="text-sm font-bold">{branch.tasks_count ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">مهمة</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const EMPTY_FORM = {
  name: "", code: "", location: "", description: "", phone: "", email: "", manager_name: "",
};

export default function BranchesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);
  const [transferTarget, setTransferTarget] = useState<Branch | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [transferCaseId, setTransferCaseId] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/branches`);
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ branches: Branch[]; plan: string; branchLimit: number | "unlimited" }>;
    },
  });

  const { data: dashboard } = useQuery({
    queryKey: ["branches-dashboard"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/branches/dashboard`);
      if (!r.ok) return null;
      return r.json();
    },
  });

  const { data: cases } = useQuery({
    queryKey: ["cases-list"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/cases`);
      if (!r.ok) return { cases: [] };
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (body: typeof EMPTY_FORM) => {
      const r = await fetch(`${BASE}/api/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "خطأ في الإنشاء");
      return d;
    },
    onSuccess: () => {
      toast({ title: "تم إنشاء الفرع بنجاح ✅" });
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches-dashboard"] });
      setShowCreate(false);
      setForm({ ...EMPTY_FORM });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<typeof EMPTY_FORM> }) => {
      const r = await fetch(`${BASE}/api/branches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "خطأ في التعديل");
      return d;
    },
    onSuccess: () => {
      toast({ title: "تم تحديث الفرع ✅" });
      qc.invalidateQueries({ queryKey: ["branches"] });
      setEditing(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/api/branches/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "خطأ في الحذف");
      return d;
    },
    onSuccess: () => {
      toast({ title: "تم تعطيل الفرع" });
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches-dashboard"] });
      setDeleting(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const transferMut = useMutation({
    mutationFn: async ({ case_id, target_branch_id }: { case_id: string; target_branch_id: string }) => {
      const r = await fetch(`${BASE}/api/branches/transfer-case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id, target_branch_id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "خطأ في التحويل");
      return d;
    },
    onSuccess: () => {
      toast({ title: "تم تحويل القضية بنجاح ✅" });
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches-dashboard"] });
      setTransferTarget(null);
      setTransferCaseId("");
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const branches = data?.branches ?? [];
  const limit = data?.branchLimit ?? 0;
  const plan = data?.plan ?? "free";
  const atLimit = limit !== "unlimited" && branches.length >= (limit as number);

  function openEdit(b: Branch) {
    setForm({
      name: b.name, code: b.code ?? "", location: b.location ?? "",
      description: b.description ?? "", phone: b.phone ?? "",
      email: b.email ?? "", manager_name: b.manager_name ?? "",
    });
    setEditing(b);
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <GitBranch className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">إدارة الفروع</h1>
              <p className="text-sm text-muted-foreground">أنشئ فروع مستقلة لمكتبك وأدر بياناتها بشكل منفصل</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 ms-1.5" /> تحديث
            </Button>
            {atLimit ? (
              <Button size="sm" variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50" asChild>
                <a href="/billing">
                  <Crown className="h-4 w-4 ms-1.5 text-amber-500" /> ترقية الباقة
                </a>
              </Button>
            ) : (
              <Button size="sm" onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreate(true); }}>
                <Plus className="h-4 w-4 ms-1.5" /> فرع جديد
              </Button>
            )}
          </div>
        </div>

        {/* Plan limit banner */}
        {atLimit && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800">
                  وصلت للحد الأقصى من الفروع في باقة {PLAN_LABELS[plan] ?? plan}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  لإضافة فروع إضافية، يرجى الترقية إلى باقة{" "}
                  <strong>{PLAN_LABELS[NEXT_PLAN[plan] ?? "enterprise"] ?? "أعلى"}</strong>
                </p>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0" asChild>
                <a href="/billing"><Crown className="h-4 w-4 ms-1.5" /> ترقية الآن</a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Building2} label="الفروع النشطة" value={dashboard?.summary?.active_branches ?? branches.filter(b => b.status === "active").length} color="text-primary" />
          <StatCard icon={Scale} label="إجمالي القضايا" value={dashboard?.summary?.total_cases ?? branches.reduce((s, b) => s + (b.cases_count ?? 0), 0)} color="text-blue-500" />
          <StatCard icon={Users} label="إجمالي الموكّلين" value={dashboard?.summary?.total_clients ?? branches.reduce((s, b) => s + (b.clients_count ?? 0), 0)} color="text-emerald-500" />
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                <p className="text-xs text-muted-foreground">حد الباقة</p>
              </div>
              <LimitBar current={branches.length} limit={limit} />
            </CardContent>
          </Card>
        </div>

        {/* Top performing */}
        {(dashboard?.topByRevenue ?? []).length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> أعلى الفروع أداءً (حسب الإيرادات)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {(dashboard.topByRevenue as any[]).map((b: any, i: number) => (
                  <div key={b.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{b.name}</span>
                      {b.location && <span className="text-xs text-muted-foreground">— {b.location}</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground">{b.cases_count ?? 0} قضية</span>
                      <span className="font-semibold text-emerald-600">{Number(b.revenue ?? 0).toLocaleString("ar-SA")} ر.س</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Branches grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : branches.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="p-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-medium text-muted-foreground mb-1">لا توجد فروع بعد</p>
              <p className="text-sm text-muted-foreground/70 mb-5">
                {limit === 0
                  ? "باقتك الحالية لا تتيح إنشاء فروع. يرجى الترقية."
                  : "أنشئ فرعك الأول لتبدأ في توزيع القضايا والموكّلين"}
              </p>
              {limit === 0 ? (
                <Button asChild><a href="/billing"><Crown className="h-4 w-4 ms-1.5" /> ترقية الباقة</a></Button>
              ) : (
                <Button onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreate(true); }}>
                  <Plus className="h-4 w-4 ms-1.5" /> إنشاء أول فرع
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b) => (
              <BranchCard key={b.id} branch={b} onEdit={openEdit} onDelete={setDeleting} onTransfer={setTransferTarget} />
            ))}
            {!atLimit && (
              <Card
                className="border-dashed border-2 border-border/50 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreate(true); }}
              >
                <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[180px] text-muted-foreground/60">
                  <Plus className="h-8 w-8 mb-2" />
                  <p className="text-sm font-medium">إضافة فرع جديد</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Create / Edit Dialog ── */}
        {(showCreate || !!editing) && (
          <Dialog open onOpenChange={() => { setShowCreate(false); setEditing(null); }}>
            <DialogContent className="max-w-lg" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {editing ? "تعديل بيانات الفرع" : "إنشاء فرع جديد"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <Label>اسم الفرع <span className="text-destructive">*</span></Label>
                    <Input placeholder="مثال: فرع الرياض" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>كود الفرع</Label>
                    <Input placeholder="RYD" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الموقع / المدينة</Label>
                    <Input placeholder="الرياض" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label><Phone className="inline h-3.5 w-3.5 ms-1" />رقم الهاتف</Label>
                    <Input placeholder="0512345678" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label><Mail className="inline h-3.5 w-3.5 ms-1" />البريد الإلكتروني</Label>
                    <Input placeholder="branch@firm.com" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label><Users className="inline h-3.5 w-3.5 ms-1" />اسم مدير الفرع</Label>
                    <Input placeholder="اسم المدير" value={form.manager_name} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label>وصف الفرع</Label>
                    <Textarea placeholder="وصف مختصر للفرع ونطاق عمله..." rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setShowCreate(false); setEditing(null); }}>إلغاء</Button>
                <Button
                  disabled={!form.name.trim() || createMut.isPending || editMut.isPending}
                  onClick={() => {
                    if (editing) editMut.mutate({ id: editing.id, body: form });
                    else createMut.mutate(form);
                  }}
                >
                  {(createMut.isPending || editMut.isPending) && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                  {editing ? "حفظ التعديلات" : "إنشاء الفرع"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* ── Delete Confirm ── */}
        {deleting && (
          <Dialog open onOpenChange={() => setDeleting(null)}>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" /> تعطيل الفرع
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground py-2">
                هل أنت متأكد من تعطيل فرع <strong>"{deleting.name}"</strong>؟
                لن تُحذف البيانات المرتبطة به ويمكن إعادة تفعيله لاحقاً.
              </p>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleting(null)}>إلغاء</Button>
                <Button variant="destructive" disabled={deleteMut.isPending} onClick={() => deleteMut.mutate(deleting.id)}>
                  {deleteMut.isPending && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                  تعطيل الفرع
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* ── Transfer Case Dialog ── */}
        {transferTarget && (
          <Dialog open onOpenChange={() => { setTransferTarget(null); setTransferCaseId(""); }}>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" /> تحويل قضية إلى {transferTarget.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>اختر القضية</Label>
                  <Select value={transferCaseId} onValueChange={setTransferCaseId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر قضية للتحويل..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(cases?.cases ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.title ?? c.case_number ?? c.id} — {c.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-800 text-xs">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  سيتم نقل القضية إلى فرع <strong>{transferTarget.name}</strong> — يمكن التحويل مرة أخرى لاحقاً
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setTransferTarget(null); setTransferCaseId(""); }}>إلغاء</Button>
                <Button
                  disabled={!transferCaseId || transferMut.isPending}
                  onClick={() => transferMut.mutate({ case_id: transferCaseId, target_branch_id: transferTarget.id })}
                >
                  {transferMut.isPending && <Loader2 className="h-4 w-4 ms-2 animate-spin" />}
                  تحويل القضية
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
}
