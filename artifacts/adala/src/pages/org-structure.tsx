import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Plus, Edit3, Trash2, MoreHorizontal, ChevronDown, ChevronRight,
  Users, Scale, FileText, DollarSign, BarChart3, GitBranch, Layers,
  UserCheck, Power, PowerOff, ArrowRightLeft, Circle, Search,
  Crown, Briefcase, Shield, CheckCircle2, XCircle, AlertCircle, Network,
  TrendingUp, Receipt, Handshake,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ══════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════ */
interface OrgUnit {
  id: number;
  name: string;
  type: string;
  parent_id: number | null;
  manager_id: string | null;
  manager_name: string | null;
  status: string;
  description: string | null;
  created_at: string;
}

/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const UNIT_TYPES: { value: string; label: string; icon: React.ComponentType<any>; color: string }[] = [
  { value: "BRANCH",               label: "فرع",              icon: Building2,    color: "#3B82F6" },
  { value: "DEPARTMENT",           label: "قسم",              icon: Layers,       color: "#8B5CF6" },
  { value: "SECTION",              label: "شعبة",             icon: GitBranch,    color: "#10B981" },
  { value: "TEAM",                 label: "فريق",             icon: Users,        color: "#F59E0B" },
  { value: "LEGAL_DEPARTMENT",     label: "إدارة قانونية",    icon: Scale,        color: "#2563EB" },
  { value: "CONTRACTS_DEPARTMENT", label: "إدارة العقود",     icon: FileText,     color: "#6366F1" },
  { value: "COMPLIANCE_DEPARTMENT",label: "إدارة الامتثال",   icon: Shield,       color: "#EF4444" },
  { value: "GOVERNANCE_DEPARTMENT",label: "إدارة الحوكمة",    icon: Crown,        color: "#EC4899" },
];

const VISIBILITY_SCOPES = [
  { value: "ALL",           label: "كل البيانات",        desc: "مالك المكتب / مدير المكتب" },
  { value: "ORGANIZATION",  label: "كامل المنظمة",       desc: "مديرو الإدارات العليا" },
  { value: "UNIT",          label: "وحدته التنظيمية",    desc: "مدير الوحدة" },
  { value: "TEAM",          label: "فريقه فقط",          desc: "قائد الفريق" },
  { value: "ASSIGNED_ONLY", label: "المُسنَد إليه",      desc: "المحامون والموظفون" },
  { value: "OWN_ONLY",      label: "ملفاته الشخصية",     desc: "العملاء والمتعاونون" },
];

const NEW_ROLES = [
  { value: "legal_manager",        label: "مدير قانوني",           color: "#2563EB" },
  { value: "contracts_manager",    label: "مدير العقود",           color: "#6366F1" },
  { value: "compliance_officer",   label: "مسؤول الامتثال",        color: "#EF4444" },
  { value: "governance_officer",   label: "مسؤول الحوكمة",         color: "#EC4899" },
];

function getTypeConfig(type: string) {
  return UNIT_TYPES.find(t => t.value === type) ?? UNIT_TYPES[1];
}

function getTypeLabel(type: string) {
  return getTypeConfig(type).label;
}

/* ══════════════════════════════════════════════
   HOOKS
══════════════════════════════════════════════ */
function useUnits() {
  return useQuery<OrgUnit[]>({
    queryKey: ["org-units"],
    queryFn: () => fetch(`${BASE}/api/org-units`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });
}

function useDashboard() {
  return useQuery<any>({
    queryKey: ["org-units-dashboard"],
    queryFn: () => fetch(`${BASE}/api/org-units-dashboard`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });
}

function useUsers() {
  return useQuery<any[]>({
    queryKey: ["org-units-users"],
    queryFn: () => fetch(`${BASE}/api/org-units-users`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    staleTime: 60_000,
  });
}

/* ══════════════════════════════════════════════
   TREE BUILDER
══════════════════════════════════════════════ */
interface TreeNode extends OrgUnit { children: TreeNode[] }

function buildTree(units: OrgUnit[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  units.forEach(u => map.set(u.id, { ...u, children: [] }));
  const roots: TreeNode[] = [];
  units.forEach(u => {
    const node = map.get(u.id)!;
    if (u.parent_id && map.has(u.parent_id)) {
      map.get(u.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/* ══════════════════════════════════════════════
   UNIT DIALOG
══════════════════════════════════════════════ */
function UnitDialog({
  open, onClose, unit, units, users,
}: {
  open: boolean; onClose: () => void; unit?: OrgUnit; units: OrgUnit[]; users: any[];
}) {
  const isEdit = !!unit;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name:        unit?.name        ?? "",
    type:        unit?.type        ?? "DEPARTMENT",
    parentId:    unit?.parent_id   ? String(unit.parent_id) : "__none__",
    managerId:   unit?.manager_id  ?? "__none__",
    managerName: unit?.manager_name ?? "",
    description: unit?.description ?? "",
  });

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const parentId = form.parentId === "__none__" ? null : parseInt(form.parentId);
      const managerId = form.managerId === "__none__" ? null : form.managerId;
      const managerName = (users.find(u => u.id === managerId)?.full_name ?? form.managerName) || null;
      const body = { name: form.name, type: form.type, parentId, managerId, managerName, description: form.description || null };

      const url = isEdit ? `${BASE}/api/org-units/${unit!.id}` : `${BASE}/api/org-units`;
      const r = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: isEdit ? "✅ تم تحديث الوحدة" : "✅ تم إنشاء الوحدة" });
      qc.invalidateQueries({ queryKey: ["org-units"] });
      qc.invalidateQueries({ queryKey: ["org-units-dashboard"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const tc = getTypeConfig(form.type);
  const TypeIcon = tc.icon;

  const availableParents = units.filter(u => u.id !== unit?.id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            {isEdit ? `تعديل: ${unit!.name}` : "إضافة وحدة تنظيمية جديدة"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الاسم *</Label>
              <Input placeholder="مثال: إدارة ريادة الأعمال" value={form.name} onChange={e => upd("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">النوع</Label>
              <Select value={form.type} onValueChange={v => upd("type", v)}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-3.5 w-3.5" style={{ color: tc.color }} />
                      {tc.label}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map(t => {
                    const Icon = t.icon;
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" style={{ color: t.color }} />
                          {t.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">الوحدة الأعلى (اختياري)</Label>
              <Select value={form.parentId} onValueChange={v => upd("parentId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون (جذر) —</SelectItem>
                  {availableParents.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name} ({getTypeLabel(u.type)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">المدير المسؤول</Label>
              <Select value={form.managerId} onValueChange={v => upd("managerId", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— غير محدد —</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">وصف الوحدة</Label>
            <Textarea placeholder="وصف مختصر لمهام ومسؤوليات الوحدة..." value={form.description} onChange={e => upd("description", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || mutation.isPending} className="gap-2">
            {mutation.isPending ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "إنشاء الوحدة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════
   MOVE UNIT DIALOG
══════════════════════════════════════════════ */
function MoveDialog({ open, onClose, unit, units }: { open: boolean; onClose: () => void; unit?: OrgUnit; units: OrgUnit[] }) {
  const [parentId, setParentId] = useState<string>("__none__");
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const pid = parentId === "__none__" ? null : parseInt(parentId);
      const r = await fetch(`${BASE}/api/org-units/${unit!.id}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: pid }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast({ title: "✅ تم نقل الوحدة" });
      qc.invalidateQueries({ queryKey: ["org-units"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const available = units.filter(u => u.id !== unit?.id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            نقل وحدة: {unit?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="py-3 space-y-2">
          <Label className="text-xs font-semibold">الوحدة الجديدة الأعلى</Label>
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— بدون (جعلها جذراً) —</SelectItem>
              {available.map(u => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name} ({getTypeLabel(u.type)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "جارٍ النقل..." : "نقل الوحدة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════
   TREE NODE
══════════════════════════════════════════════ */
function TreeNode({
  node, level, onEdit, onDelete, onMove, onToggleStatus, allUnits,
}: {
  node: TreeNode; level: number; onEdit: (u: OrgUnit) => void;
  onDelete: (id: number) => void; onMove: (u: OrgUnit) => void;
  onToggleStatus: (u: OrgUnit) => void; allUnits: OrgUnit[];
}) {
  const [expanded, setExpanded] = useState(true);
  const tc = getTypeConfig(node.type);
  const TypeIcon = tc.icon;
  const hasChildren = node.children.length > 0;
  const isActive = node.status === "active";

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all group hover:border-primary/30 hover:bg-primary/5 ${
          isActive ? "border-border/50 bg-card" : "border-border/30 bg-muted/20 opacity-60"
        }`}
        style={{ marginRight: `${level * 24}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors ${hasChildren ? "text-muted-foreground hover:text-foreground" : "invisible"}`}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Type icon */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tc.color}18` }}>
          <TypeIcon className="h-4 w-4" style={{ color: tc.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{node.name}</span>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4" style={{ borderColor: `${tc.color}40`, color: tc.color }}>
              {tc.label}
            </Badge>
            {!isActive && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-muted-foreground">متوقف</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {node.manager_name && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <UserCheck className="h-3 w-3" />{node.manager_name}
              </span>
            )}
            {hasChildren && (
              <span className="text-[10px] text-muted-foreground">{node.children.length} وحدة فرعية</span>
            )}
            {node.description && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{node.description}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(node)}>
              <Edit3 className="h-4 w-4 ml-2" />تعديل
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(node)}>
              <ArrowRightLeft className="h-4 w-4 ml-2" />نقل الوحدة
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onToggleStatus(node)}>
              {isActive
                ? <><PowerOff className="h-4 w-4 ml-2 text-orange-400" />إيقاف الوحدة</>
                : <><Power className="h-4 w-4 ml-2 text-emerald-400" />تفعيل الوحدة</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(node.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 ml-2" />حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mt-1.5 space-y-1.5 border-r-2 mr-7 pr-1" style={{ borderColor: `${tc.color}30`, marginRight: `${level * 24 + 28}px`, paddingRight: 0 }}>
          {node.children.map(child => (
            <TreeNode
              key={child.id} node={child} level={0}
              onEdit={onEdit} onDelete={onDelete} onMove={onMove}
              onToggleStatus={onToggleStatus} allUnits={allUnits}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   VISIBILITY SCOPE TABLE
══════════════════════════════════════════════ */
function VisibilityScopeTable() {
  const SCOPE_ROLES = [
    { role: "مالك المكتب",    scope: "ALL",           color: "#2563EB" },
    { role: "مدير المكتب",    scope: "ORGANIZATION",  color: "#3B82F6" },
    { role: "مدير قانوني",    scope: "UNIT",          color: "#8B5CF6" },
    { role: "مدير العقود",    scope: "UNIT",          color: "#6366F1" },
    { role: "مدير الامتثال",  scope: "UNIT",          color: "#EF4444" },
    { role: "مدير الحوكمة",   scope: "UNIT",          color: "#EC4899" },
    { role: "محامي",          scope: "ASSIGNED_ONLY", color: "#10B981" },
    { role: "محامي متدرب",    scope: "ASSIGNED_ONLY", color: "#06B6D4" },
    { role: "محاسب",          scope: "UNIT",          color: "#F59E0B" },
    { role: "وسيط",           scope: "OWN_ONLY",      color: "#F97316" },
    { role: "متعاون",         scope: "OWN_ONLY",      color: "#EC4899" },
    { role: "عميل",           scope: "OWN_ONLY",      color: "#64748B" },
  ];

  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 border-b">
          <tr>
            <th className="text-right px-4 py-2.5 font-semibold text-xs">الدور</th>
            <th className="text-right px-4 py-2.5 font-semibold text-xs">نطاق الرؤية</th>
            <th className="text-right px-4 py-2.5 font-semibold text-xs">الوصف</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {SCOPE_ROLES.map(r => {
            const scope = VISIBILITY_SCOPES.find(s => s.value === r.scope)!;
            return (
              <tr key={r.role} className="hover:bg-muted/20">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                    <span className="font-medium text-xs">{r.role}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-[10px]" style={{ borderColor: `${r.color}40`, color: r.color }}>
                    {scope.label}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{scope.desc}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
export default function OrgStructure() {
  const { data: units = [], isLoading } = useUnits();
  const { data: dashboard } = useDashboard();
  const { data: users = [] } = useUsers();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("tree");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; unit?: OrgUnit }>({ open: false });
  const [moveDialog, setMoveDialog] = useState<{ open: boolean; unit?: OrgUnit }>({ open: false });
  const [typeFilter, setTypeFilter] = useState("ALL");

  const tree = useMemo(() => buildTree(units), [units]);

  const filteredUnits = useMemo(() => {
    return units.filter(u => {
      const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === "ALL" || u.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [units, search, typeFilter]);

  const deleteMut = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/org-units/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "✅ تم حذف الوحدة" });
      qc.invalidateQueries({ queryKey: ["org-units"] });
      qc.invalidateQueries({ queryKey: ["org-units-dashboard"] });
    },
    onError: async (e: any) => {
      let msg = e.message;
      try { const d = await e.response?.json?.(); msg = d?.error ?? msg; } catch {}
      toast({ title: "خطأ", description: msg, variant: "destructive" });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`${BASE}/api/org-units/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      toast({ title: "✅ تم تحديث حالة الوحدة" });
      qc.invalidateQueries({ queryKey: ["org-units"] });
    },
  });

  const handleDelete = (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه الوحدة؟")) return;
    deleteMut.mutate(id);
  };

  const handleToggle = (u: OrgUnit) => {
    toggleStatus.mutate({ id: u.id, status: u.status === "active" ? "inactive" : "active" });
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            الهيكل التنظيمي للمكتب
          </h1>
          <p className="text-muted-foreground text-sm mt-1">إدارة الفروع والأقسام والفرق بهيكل هرمي متكامل</p>
        </div>
        <Button size="sm" onClick={() => setDialog({ open: true })} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          وحدة جديدة
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الوحدات",  value: dashboard?.total  ?? units.length,                       icon: Network,   color: "#6366F1" },
          { label: "وحدات نشطة",      value: dashboard?.active ?? units.filter(u => u.status === "active").length, icon: CheckCircle2, color: "#10B981" },
          { label: "وحدات موقوفة",    value: (dashboard?.total ?? units.length) - (dashboard?.active ?? 0), icon: XCircle, color: "#EF4444" },
          { label: "أعلى قضايا",      value: dashboard?.topUnits?.[0]?.name ?? "—",                   icon: Scale,     color: "#2563EB", isText: true },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${stat.color}15` }}>
              <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
            </div>
            <div className="min-w-0">
              <div className={`font-bold ${(stat as any).isText ? "text-sm truncate" : "text-2xl"}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList className="flex gap-1 h-auto bg-muted/50 p-1 rounded-xl">
            <TabsTrigger value="tree"  className="gap-1.5 text-xs"><GitBranch className="h-3.5 w-3.5" />الشجرة</TabsTrigger>
            <TabsTrigger value="list"  className="gap-1.5 text-xs"><Layers className="h-3.5 w-3.5" />القائمة</TabsTrigger>
            <TabsTrigger value="stats" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" />الإحصائيات</TabsTrigger>
            <TabsTrigger value="scope" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" />نطاق الرؤية</TabsTrigger>
          </TabsList>

          {(activeTab === "list") && (
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="ابحث..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pr-8 text-xs w-48" />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">جميع الأنواع</SelectItem>
                  {UNIT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* ══ TREE TAB ══ */}
        <TabsContent value="tree" className="mt-4">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : tree.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/50 py-20 text-center">
              <Network className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground font-medium">لا يوجد هيكل تنظيمي بعد</p>
              <p className="text-muted-foreground/60 text-sm mt-1 mb-4">ابدأ بإضافة وحدة رئيسية</p>
              <Button size="sm" onClick={() => setDialog({ open: true })} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />إضافة أول وحدة
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tree.map(node => (
                <TreeNode
                  key={node.id} node={node} level={0}
                  allUnits={units}
                  onEdit={u => setDialog({ open: true, unit: u })}
                  onDelete={handleDelete}
                  onMove={u => setMoveDialog({ open: true, unit: u })}
                  onToggleStatus={handleToggle}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ══ LIST TAB ══ */}
        <TabsContent value="list" className="mt-4">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-muted/30 border-b border-border/50">
                  <tr>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold">الوحدة</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold hidden sm:table-cell">النوع</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold hidden md:table-cell">الوحدة الأعلى</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold hidden md:table-cell">المدير</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold">الحالة</th>
                    <th className="w-[44px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                        ))}
                        <td />
                      </tr>
                    ))
                    : filteredUnits.length === 0
                    ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                          لا توجد وحدات مطابقة للبحث
                        </td>
                      </tr>
                    )
                    : filteredUnits.map(u => {
                      const tc2 = getTypeConfig(u.type);
                      const Icon2 = tc2.icon;
                      const parent = units.find(p => p.id === u.parent_id);
                      return (
                        <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${tc2.color}18` }}>
                                <Icon2 className="h-3.5 w-3.5" style={{ color: tc2.color }} />
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{u.name}</p>
                                {u.description && <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{u.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 hidden sm:table-cell">
                            <Badge variant="outline" className="text-[10px]" style={{ borderColor: `${tc2.color}40`, color: tc2.color }}>{tc2.label}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                            {parent?.name ?? <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                            {u.manager_name ?? <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${u.status === "active" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-muted-foreground"}`}
                            >
                              {u.status === "active" ? "نشطة" : "موقوفة"}
                            </Badge>
                          </td>
                          <td className="px-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDialog({ open: true, unit: u })}>
                                  <Edit3 className="h-4 w-4 ml-2" />تعديل
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setMoveDialog({ open: true, unit: u })}>
                                  <ArrowRightLeft className="h-4 w-4 ml-2" />نقل
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleToggle(u)}>
                                  {u.status === "active"
                                    ? <><PowerOff className="h-4 w-4 ml-2 text-orange-400" />إيقاف</>
                                    : <><Power className="h-4 w-4 ml-2 text-emerald-400" />تفعيل</>}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(u.id)} className="text-destructive focus:text-destructive">
                                  <Trash2 className="h-4 w-4 ml-2" />حذف
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ STATS TAB ══ */}
        <TabsContent value="stats" className="mt-4 space-y-4">
          {/* Type distribution */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                توزيع الوحدات حسب النوع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {UNIT_TYPES.map(t => {
                  const count = units.filter(u => u.type === t.value).length;
                  if (count === 0) return null;
                  const Icon = t.icon;
                  return (
                    <div key={t.value} className="rounded-xl border p-3 flex items-center gap-2" style={{ borderColor: `${t.color}25`, background: `${t.color}08` }}>
                      <Icon className="h-5 w-5 shrink-0" style={{ color: t.color }} />
                      <div>
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-[10px] text-muted-foreground">{t.label}</p>
                      </div>
                    </div>
                  );
                })}
                {UNIT_TYPES.every(t => units.filter(u => u.type === t.value).length === 0) && (
                  <p className="col-span-4 text-center text-sm text-muted-foreground py-8">لا توجد وحدات بعد</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top Units */}
          {dashboard?.topUnits?.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  أكثر الوحدات نشاطاً (حسب القضايا)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border/50">
                    <tr>
                      <th className="text-right px-4 py-2 text-xs font-semibold">الوحدة</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold">النوع</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold">القضايا</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold">العملاء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {dashboard.topUnits.map((u: any) => {
                      const tc2 = getTypeConfig(u.type);
                      const Icon2 = tc2.icon;
                      return (
                        <tr key={u.id} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Icon2 className="h-3.5 w-3.5" style={{ color: tc2.color }} />
                              <span className="font-medium text-xs">{u.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] text-muted-foreground">{tc2.label}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-sm">{u.cases_count}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-sm">{u.clients_count}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* New Roles Info */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                الأدوار التنظيمية الجديدة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {NEW_ROLES.map(r => (
                  <div key={r.value} className="rounded-xl border p-3 flex items-center gap-2" style={{ borderColor: `${r.color}25`, background: `${r.color}08` }}>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                    <div>
                      <p className="text-xs font-semibold">{r.label}</p>
                      <p className="text-[10px] text-muted-foreground">{r.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══ SCOPE TAB ══ */}
        <TabsContent value="scope" className="mt-4 space-y-4">
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              نطاق الرؤية يحدد حدود وصول كل دور للبيانات بناءً على موقعه في الهيكل التنظيمي.
              يُطبَّق هذا النطاق تلقائياً عند عرض القضايا والعملاء والعقود والفواتير.
            </p>
          </div>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                جدول الأدوار ونطاق الرؤية
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <VisibilityScopeTable />
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                تعريف نطاقات الرؤية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {VISIBILITY_SCOPES.map(s => (
                  <div key={s.value} className="flex items-start gap-3 rounded-lg border border-border/50 px-4 py-3">
                    <Circle className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{s.label}</span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0">{s.value}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <UnitDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false })}
        unit={dialog.unit}
        units={units}
        users={users}
      />
      <MoveDialog
        open={moveDialog.open}
        onClose={() => setMoveDialog({ open: false })}
        unit={moveDialog.unit}
        units={units}
      />
    </div>
  );
}
