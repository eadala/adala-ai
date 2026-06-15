import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Users, Scale, FileText, DollarSign, TrendingUp, Bot, Building2,
  Shield, Clock, CheckCircle, AlertTriangle, ChevronRight, Star,
  UserPlus, Settings, Eye, Send, Key, Lock, RefreshCw, MoreHorizontal,
  Trash2, Edit3, UserCheck, UserX, Plus, BarChart3, Briefcase,
  CreditCard, Award, Target, Activity, Bell, Calendar, XCircle,
  ArrowUpRight, ArrowDownRight, Crown, Zap, Receipt, TrendingDown,
  PieChart as PieChartIcon, LayoutGrid, List, ChevronDown, Check, X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

// ─── Constants ──────────────────────────────────────────────────────────────

const GOLD = "#2563EB";
const NAVY = "#1E40AF";

const COLORS = [GOLD, "#6366F1", "#10B981", "#3B82F6", "#EC4899", "#F59E0B", "#8B5CF6", "#06B6D4"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:         { label: "مفتوحة",   color: "#6366F1", bg: "rgba(99,102,241,0.12)" },
  in_progress:  { label: "جارية",    color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  closed:       { label: "مغلقة",    color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  on_hold:      { label: "معلقة",    color: "#94A3B8", bg: "rgba(148,163,184,0.12)" },
  active:       { label: "نشط",      color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  inactive:     { label: "غير نشط",  color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  paid:         { label: "مدفوعة",   color: "#10B981", bg: "rgba(16,185,129,0.12)" },
  pending:      { label: "معلقة",    color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  overdue:      { label: "متأخرة",   color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  cancelled:    { label: "ملغاة",    color: "#94A3B8", bg: "rgba(148,163,184,0.12)" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام", lawyer: "محامٍ", paralegal: "مساعد قانوني", viewer: "مراقب",
};

const PERMISSION_MODULES = [
  { key: "cases",     label: "القضايا",           color: GOLD,      perms: ["cases:view","cases:create","cases:edit","cases:delete"] },
  { key: "documents", label: "المستندات",          color: "#10B981", perms: ["documents:view","documents:create","documents:edit","documents:delete"] },
  { key: "ai",        label: "الذكاء الاصطناعي",  color: "#8B5CF6", perms: ["ai:view","ai:run"] },
  { key: "users",     label: "المستخدمون",         color: "#F59E0B", perms: ["users:view","users:manage"] },
  { key: "messages",  label: "المراسلات",          color: "#06B6D4", perms: ["messages:view","messages:send"] },
  { key: "billing",   label: "الفوترة",            color: "#EF4444", perms: ["billing:view","billing:manage"] },
  { key: "dashboard", label: "لوحة التحكم",       color: "#6366F1", perms: ["dashboard:view"] },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 0 });
}

function fmtSAR(n: number) {
  return `${fmt(n)} ر.س`;
}

function pct(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

function trend(current: number, prev: number) {
  if (prev === 0) return null;
  const d = ((current - prev) / prev) * 100;
  return { value: Math.abs(Math.round(d)), up: d >= 0 };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface FirmOverview {
  kpis: {
    activeCases: number; closedCases: number; totalCases: number;
    totalRevenue: number; outstanding: number;
    totalClients: number; clientsThisMonth: number;
    activeUsers: number; totalUsers: number;
    aiDone: number; totalAiTasks: number;
    totalDocuments: number; successRate: number;
    casesThisMonth: number; casesLastMonth: number;
    revenueThisMonth: number; revenueLastMonth: number;
  };
  caseByStatus: Record<string, number>;
  topTypes: { name: string; value: number }[];
  charts: { month: string; revenue: number; cases: number }[];
  lawyerStats: {
    id: string; name: string; email: string;
    role: string; roleLabel: string; status: string;
    totalCases: number; activeCases: number; closedCases: number;
    aiTasks: number; avatar: string;
  }[];
  invoiceSummary: {
    total: number; paid: number; pending: number; overdue: number;
    totalAmount: number; paidAmount: number; outstandingAmount: number;
  };
  expiringContracts: { id: string; title: string; expiresAt: string }[];
  recentCases: { id: string; title: string; status: string; caseType: string; createdAt: string }[];
  recentInvoices: { id: string; title: string; total: number; status: string; createdAt: string }[];
  recentActivity: { id: string; action: string; resource: string; details?: string; userFullName?: string; createdAt: string }[];
}

interface Role {
  id: string; name: string; displayName: string; description?: string;
  permissions: string[]; isSystem: boolean; createdAt: string;
}

interface Invitation {
  id: string; email: string; role: string; status: string;
  invitedBy?: string; createdAt: string; expiresAt: string;
}

// ─── Sub Components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#94A3B8", bg: "rgba(148,163,184,0.1)" };
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ color: cfg.color, background: cfg.bg }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color, trend: t, prefix, suffix
}: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; trend?: { value: number; up: boolean } | null;
  prefix?: string; suffix?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18` }}>
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          {t && (
            <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${t.up ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
              {t.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {t.value}%
            </div>
          )}
        </div>
        <div className="text-2xl font-bold tracking-tight mt-1">
          {prefix && <span className="text-sm text-muted-foreground ml-1">{prefix}</span>}
          {typeof value === "number" ? fmt(value) : value}
          {suffix && <span className="text-sm text-muted-foreground mr-1">{suffix}</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
        {sub && <div className="text-xs mt-1" style={{ color }}>{sub}</div>}
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="font-bold text-lg text-foreground">{title}</h3>
        {desc && <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border shadow-xl p-3 text-xs" style={{ background: "#F8FAFC", borderColor: "#E2E8F0" }}>
      <p className="font-bold mb-2" style={{ color: GOLD }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{typeof p.value === "number" ? fmt(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Invite Dialog ────────────────────────────────────────────────────────────

function InviteDialog({ open, onClose, roles }: { open: boolean; onClose: () => void; roles: Role[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("lawyer");
  const { toast } = useToast();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/rbac/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast({ title: "تم إرسال الدعوة", description: `دُعي ${email} للانضمام` });
      qc.invalidateQueries({ queryKey: ["rbac-invitations"] });
      qc.invalidateQueries({ queryKey: ["firm-overview"] });
      setEmail(""); setRole("lawyer"); onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" style={{ color: GOLD }} />
            دعوة عضو جديد للفريق
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input type="email" placeholder="lawyer@firm.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>الدور الوظيفي</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map(r => <SelectItem key={r.id} value={r.name}>{r.displayName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl p-3 text-sm text-muted-foreground" style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
            سيصلهم بريد إلكتروني يحتوي على رابط الدعوة صالح لـ 7 أيام.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={!email || mut.isPending}>
            <Send className="h-4 w-4 ml-2" />
            {mut.isPending ? "جارٍ الإرسال..." : "إرسال الدعوة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Role Dialog ─────────────────────────────────────────────────────────────

function RoleDialog({ open, onClose, editRole }: { open: boolean; onClose: () => void; editRole?: Role }) {
  const [displayName, setDisplayName] = useState(editRole?.displayName ?? "");
  const [description, setDescription] = useState(editRole?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(editRole?.permissions ?? []);
  const { toast } = useToast();
  const qc = useQueryClient();

  const isEdit = !!editRole;

  const mut = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `/api/rbac/roles/${editRole!.id}` : "/api/rbac/roles";
      const r = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName.toLowerCase().replace(/\s+/g, "_"),
          displayName, description, permissions,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast({ title: isEdit ? "تم تحديث الدور" : "تم إنشاء الدور" });
      qc.invalidateQueries({ queryKey: ["firm-roles"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const toggle = (key: string) => {
    if (isEdit && editRole?.isSystem) return;
    setPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" style={{ color: GOLD }} />
            {isEdit ? `تعديل دور: ${editRole!.displayName}` : "إنشاء دور جديد"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم الدور</Label>
              <Input placeholder="مثال: محامي أول" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input placeholder="وصف مختصر" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-3 text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" style={{ color: GOLD }} />
              مصفوفة الصلاحيات
            </h4>
            {isEdit && editRole?.isSystem ? (
              <div className="rounded-xl border p-4 text-sm text-muted-foreground flex items-center gap-2"
                style={{ borderColor: "#E2E8F0", background: "#F8FAFC" }}>
                <Lock className="h-4 w-4" />
                الأدوار الأساسية محمية ولا يمكن تعديل صلاحياتها
              </div>
            ) : (
              <div className="space-y-2">
                {PERMISSION_MODULES.map(mod => {
                  const allOn = mod.perms.every(k => permissions.includes(k));
                  const someOn = mod.perms.some(k => permissions.includes(k)) && !allOn;
                  return (
                    <div key={mod.key} className="rounded-xl border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
                      <div className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: "#E2E8F0", background: `${mod.color}08` }}>
                        <span className="font-medium text-sm flex-1">{mod.label}</span>
                        <Switch
                          checked={allOn}
                          onCheckedChange={() => {
                            if (allOn) setPermissions(p => p.filter(x => !mod.perms.includes(x)));
                            else setPermissions(p => [...new Set([...p, ...mod.perms])]);
                          }}
                          className="scale-90"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 p-3">
                        {mod.perms.map(key => {
                          const on = permissions.includes(key);
                          const label = key.split(":")[1] === "view" ? "عرض" : key.split(":")[1] === "create" ? "إنشاء" : key.split(":")[1] === "edit" ? "تعديل" : key.split(":")[1] === "delete" ? "حذف" : key.split(":")[1] === "run" ? "تشغيل" : key.split(":")[1] === "manage" ? "إدارة" : key.split(":")[1] === "send" ? "إرسال" : key.split(":")[1];
                          return (
                            <button key={key} onClick={() => toggle(key)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer"
                              style={on ? { background: mod.color, borderColor: mod.color, color: "#fff" } : { background: "#F8FAFC", borderColor: "#E2E8F0", color: "#64748B" }}>
                              {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-50" />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={!displayName || mut.isPending}>
            {mut.isPending ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "إنشاء الدور"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FirmAdmin() {
  const [tab, setTab] = useState("overview");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role?: Role }>({ open: false });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: overview, isLoading, refetch } = useQuery<FirmOverview>({
    queryKey: ["firm-overview"],
    queryFn: () => fetch("/api/firm-admin/overview").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    refetchInterval: 60_000,
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["firm-roles"],
    queryFn: () => fetch("/api/rbac/roles").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ["firm-invitations"],
    queryFn: () => fetch("/api/rbac/invitations").then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const changeRole = async (userId: string, role: string) => {
    const r = await fetch(`/api/rbac/users/${userId}/role`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (r.ok) { toast({ title: "تم تغيير الدور بنجاح" }); qc.invalidateQueries({ queryKey: ["firm-overview"] }); }
    else toast({ title: "خطأ", variant: "destructive" });
  };

  const changeStatus = async (userId: string, status: string) => {
    const r = await fetch(`/api/rbac/users/${userId}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) { toast({ title: status === "active" ? "تم تفعيل الحساب" : "تم تعطيل الحساب" }); qc.invalidateQueries({ queryKey: ["firm-overview"] }); }
  };

  const deleteRole = async (id: string) => {
    const r = await fetch(`/api/rbac/roles/${id}`, { method: "DELETE" });
    if (r.ok) { toast({ title: "تم حذف الدور" }); qc.invalidateQueries({ queryKey: ["firm-roles"] }); }
    else { const d = await r.json(); toast({ title: "خطأ", description: d.error, variant: "destructive" }); }
  };

  const deleteInvite = async (id: string) => {
    await fetch(`/api/rbac/invitations/${id}`, { method: "DELETE" });
    toast({ title: "تم سحب الدعوة" }); qc.invalidateQueries({ queryKey: ["firm-invitations"] });
  };

  const resendInvite = async (id: string) => {
    await fetch(`/api/rbac/invitations/${id}/resend`, { method: "PATCH" });
    toast({ title: "تم إعادة إرسال الدعوة" }); qc.invalidateQueries({ queryKey: ["firm-invitations"] });
  };

  const k = overview?.kpis;
  const isLoaded = !!overview && !isLoading;

  const pendingInvites = invitations.filter(i => i.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: `linear-gradient(135deg, ${GOLD}30, ${GOLD}10)`, border: `1px solid ${GOLD}30` }}>
            <Crown className="h-6 w-6" style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">لوحة مدير المكتب</h1>
            <p className="text-muted-foreground text-sm mt-0.5">صلاحيات متقدمة — إدارة شاملة للمكتب والفريق والأداء</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 ml-1" />
            تحديث
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 ml-1" />
            دعوة عضو
          </Button>
        </div>
      </div>

      {/* ── KPIs Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="border-0"><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))
        ) : (
          <>
            <KpiCard label="القضايا النشطة" value={k?.activeCases ?? 0} icon={Scale}
              color="#6366F1" sub={`من أصل ${k?.totalCases} قضية`}
              trend={trend(k?.casesThisMonth ?? 0, k?.casesLastMonth ?? 1)} />
            <KpiCard label="الإيرادات المحصّلة" value={fmtSAR(k?.totalRevenue ?? 0)} icon={DollarSign}
              color="#10B981" sub={`هذا الشهر: ${fmtSAR(k?.revenueThisMonth ?? 0)}`}
              trend={trend(k?.revenueThisMonth ?? 0, k?.revenueLastMonth ?? 1)} />
            <KpiCard label="أعضاء الفريق" value={k?.activeUsers ?? 0} icon={Users}
              color={GOLD} sub={`${k?.totalUsers} مسجّل`} />
            <KpiCard label="مستحقات قائمة" value={fmtSAR(k?.outstanding ?? 0)} icon={Receipt}
              color="#F59E0B" sub="قيد التحصيل" />
            <KpiCard label="العملاء" value={k?.totalClients ?? 0} icon={Briefcase}
              color="#3B82F6" sub={`+${k?.clientsThisMonth} هذا الشهر`} />
            <KpiCard label="نسبة الإغلاق" value={`${k?.successRate ?? 0}%`} icon={Target}
              color="#EC4899" sub={`${k?.closedCases} قضية مغلقة`} />
            <KpiCard label="مهام الذكاء الاصطناعي" value={k?.aiDone ?? 0} icon={Bot}
              color="#8B5CF6" sub={`من ${k?.totalAiTasks} مهمة`} />
            <KpiCard label="المستندات" value={k?.totalDocuments ?? 0} icon={FileText}
              color="#06B6D4" sub="ملفات مرفوعة" />
          </>
        )}
      </div>

      {/* ── Alerts Row ── */}
      {isLoaded && (overview.expiringContracts.length > 0 || (overview.invoiceSummary.overdue > 0)) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {overview.invoiceSummary.overdue > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 text-sm"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <span className="font-medium text-red-400">{overview.invoiceSummary.overdue} فاتورة متأخرة</span>
              <span className="text-muted-foreground">— بادر بالتحصيل</span>
            </div>
          )}
          {overview.expiringContracts.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 text-sm"
              style={{ background: `${GOLD}08`, border: `1px solid ${GOLD}25` }}>
              <Bell className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />
              <span className="font-medium" style={{ color: GOLD }}>{overview.expiringContracts.length} عقد</span>
              <span className="text-muted-foreground">تنتهي خلال 30 يوماً</span>
            </div>
          )}
          {pendingInvites > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl flex-1 text-sm"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <Send className="h-4 w-4 text-indigo-400 flex-shrink-0" />
              <span className="font-medium text-indigo-400">{pendingInvites} دعوة معلقة</span>
              <span className="text-muted-foreground">لم تُقبل بعد</span>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1 p-1.5 bg-muted/50" style={{ borderRadius: "0.875rem" }}>
          {[
            { value: "overview",  label: "النظرة العامة",  icon: LayoutGrid },
            { value: "team",      label: "الفريق",          icon: Users },
            { value: "financial", label: "المالية",          icon: DollarSign },
            { value: "cases",     label: "القضايا",          icon: Scale },
            { value: "roles",     label: "الأدوار والصلاحيات", icon: Key },
            { value: "activity",  label: "سجل النشاط",     icon: Activity },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value}
              className="flex items-center gap-1.5 px-3 py-2 text-sm data-[state=active]:shadow-sm">
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.value === "team" && pendingInvites > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                  {pendingInvites}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ TAB: OVERVIEW ═══ */}
        <TabsContent value="overview" className="mt-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Revenue Chart */}
            <Card className="lg:col-span-2 border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" style={{ color: GOLD }} />
                  الإيرادات والقضايا — آخر 6 أشهر
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-56 w-full" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={overview?.charts ?? []}>
                      <defs>
                        <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradCases" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />
                      <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#A0ADB8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12, color: "#A0ADB8" }} />
                      <Area type="monotone" dataKey="revenue" name="الإيرادات (ر.س)" stroke={GOLD} strokeWidth={2} fill="url(#gradRev)" />
                      <Area type="monotone" dataKey="cases" name="القضايا" stroke="#6366F1" strokeWidth={2} fill="url(#gradCases)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Pie Chart - Case by Status */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4" style={{ color: GOLD }} />
                  توزيع القضايا
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-56 w-full" /> : (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={[
                          { name: "مفتوحة", value: overview?.caseByStatus?.open ?? 0 },
                          { name: "جارية", value: overview?.caseByStatus?.in_progress ?? 0 },
                          { name: "مغلقة", value: overview?.caseByStatus?.closed ?? 0 },
                          { name: "معلقة", value: overview?.caseByStatus?.on_hold ?? 0 },
                        ].filter(d => d.value > 0)}
                          cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                          dataKey="value" paddingAngle={3}>
                          {["#6366F1","#F59E0B","#10B981","#94A3B8"].map((c, i) => <Cell key={i} fill={c} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {[
                        { label: "مفتوحة",  val: overview?.caseByStatus?.open ?? 0,        color: "#6366F1" },
                        { label: "جارية",   val: overview?.caseByStatus?.in_progress ?? 0, color: "#F59E0B" },
                        { label: "مغلقة",   val: overview?.caseByStatus?.closed ?? 0,      color: "#10B981" },
                        { label: "معلقة",   val: overview?.caseByStatus?.on_hold ?? 0,     color: "#94A3B8" },
                      ].map(d => (
                        <div key={d.label} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-muted-foreground">{d.label}</span>
                          <span className="font-bold">{d.val}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent Cases */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Scale className="h-4 w-4" style={{ color: GOLD }} />
                  آخر القضايا
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? <div className="p-4"><Skeleton className="h-40 w-full" /></div> : (
                  <div className="divide-y" style={{ borderColor: "#E2E8F0" }}>
                    {(overview?.recentCases ?? []).map(c => (
                      <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{c.caseType}</p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                    ))}
                    {(overview?.recentCases ?? []).length === 0 && (
                      <p className="text-muted-foreground text-sm text-center py-8">لا توجد قضايا بعد</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Invoices */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4" style={{ color: GOLD }} />
                  آخر الفواتير
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? <div className="p-4"><Skeleton className="h-40 w-full" /></div> : (
                  <div className="divide-y" style={{ borderColor: "#E2E8F0" }}>
                    {(overview?.recentInvoices ?? []).map(inv => (
                      <div key={inv.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate">{inv.title}</p>
                          <p className="text-xs font-bold mt-0.5" style={{ color: GOLD }}>{fmtSAR(inv.total)}</p>
                        </div>
                        <StatusBadge status={inv.status} />
                      </div>
                    ))}
                    {(overview?.recentInvoices ?? []).length === 0 && (
                      <p className="text-muted-foreground text-sm text-center py-8">لا توجد فواتير بعد</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Usage by type */}
          {isLoaded && (overview.topTypes?.length ?? 0) > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: GOLD }} />
                  القضايا حسب النوع
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={overview.topTypes} layout="vertical" margin={{ right: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#A0ADB8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fill: "#A0ADB8", fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="القضايا" radius={[0, 6, 6, 0]}>
                      {overview.topTypes.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB: TEAM ═══ */}
        <TabsContent value="team" className="mt-5 space-y-5">
          <SectionHeader title="أعضاء الفريق" desc="إدارة المحامين والمساعدين والصلاحيات">
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 ml-1.5" />
              دعوة عضو
            </Button>
          </SectionHeader>

          {/* Team Performance Cards */}
          {isLoaded && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(overview.lawyerStats ?? []).map(member => (
                <Card key={member.id} className="border-0 shadow-sm overflow-hidden">
                  <div className="h-1" style={{ background: `linear-gradient(90deg, ${GOLD}, #6366F1)` }} />
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2" style={{ borderColor: `${GOLD}40` }}>
                          <AvatarFallback style={{ background: `${GOLD}20`, color: GOLD }} className="font-bold text-sm">
                            {member.avatar}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => changeRole(member.id, "admin")}>
                            <Shield className="h-4 w-4 ml-2 text-primary" />تعيين كمدير
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeRole(member.id, "lawyer")}>
                            <Scale className="h-4 w-4 ml-2 text-blue-400" />تعيين كمحامٍ
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeRole(member.id, "paralegal")}>
                            <FileText className="h-4 w-4 ml-2 text-emerald-400" />تعيين كمساعد
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {member.status === "active" ? (
                            <DropdownMenuItem className="text-red-400" onClick={() => changeStatus(member.id, "inactive")}>
                              <UserX className="h-4 w-4 ml-2" />تعطيل الحساب
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-emerald-400" onClick={() => changeStatus(member.id, "active")}>
                              <UserCheck className="h-4 w-4 ml-2" />تفعيل الحساب
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs">{member.roleLabel}</Badge>
                      <StatusBadge status={member.status} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg p-2" style={{ background: "rgba(45,61,107,0.4)" }}>
                        <div className="text-lg font-bold">{member.activeCases}</div>
                        <div className="text-[10px] text-muted-foreground">قضايا نشطة</div>
                      </div>
                      <div className="rounded-lg p-2" style={{ background: "rgba(45,61,107,0.4)" }}>
                        <div className="text-lg font-bold" style={{ color: "#10B981" }}>{member.closedCases}</div>
                        <div className="text-[10px] text-muted-foreground">قضايا مغلقة</div>
                      </div>
                      <div className="rounded-lg p-2" style={{ background: "rgba(45,61,107,0.4)" }}>
                        <div className="text-lg font-bold" style={{ color: "#8B5CF6" }}>{member.aiTasks}</div>
                        <div className="text-[10px] text-muted-foreground">مهام AI</div>
                      </div>
                    </div>

                    {member.totalCases > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>معدل الإغلاق</span>
                          <span>{pct(member.closedCases, member.totalCases)}%</span>
                        </div>
                        <Progress value={pct(member.closedCases, member.totalCases)} className="h-1.5" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {(overview?.lawyerStats ?? []).length === 0 && (
                <div className="col-span-3 text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>لا يوجد أعضاء في الفريق بعد. ابدأ بدعوة أول عضو.</p>
                </div>
              )}
            </div>
          )}
          {isLoading && <div className="grid grid-cols-3 gap-4">{Array.from({length:3}).map((_,i)=><Card key={i} className="border-0"><CardContent className="p-4"><Skeleton className="h-40 w-full"/></CardContent></Card>)}</div>}

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div>
              <SectionHeader title="الدعوات المعلقة" desc={`${pendingInvites} دعوة بانتظار القبول`} />
              <Card className="border-0 shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>البريد الإلكتروني</TableHead>
                      <TableHead>الدور</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الانتهاء</TableHead>
                      <TableHead className="text-left">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.email}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABELS[inv.role] ?? inv.role}</Badge></TableCell>
                        <TableCell><StatusBadge status={inv.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(inv.expiresAt), "dd/MM/yyyy", { locale: arSA })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {inv.status === "pending" && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => resendInvite(inv.id)}>
                                <RefreshCw className="h-3 w-3 ml-1" />إعادة
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteInvite(inv.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ═══ TAB: FINANCIAL ═══ */}
        <TabsContent value="financial" className="mt-5 space-y-5">
          <SectionHeader title="التحكم المالي" desc="الإيرادات والمستحقات والأداء المالي" />

          {/* Financial KPIs */}
          {isLoaded && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "إجمالي الفواتير",       val: overview.invoiceSummary.total,           icon: Receipt,    color: "#6366F1", suffix: " فاتورة" },
                { label: "محصّل",                  val: fmtSAR(overview.invoiceSummary.paidAmount), icon: CheckCircle, color: "#10B981" },
                { label: "مستحق",                  val: fmtSAR(overview.invoiceSummary.outstandingAmount), icon: Clock, color: GOLD },
                { label: "متأخرة",                 val: overview.invoiceSummary.overdue,         icon: AlertTriangle, color: "#EF4444", suffix: " فاتورة" },
              ].map(item => (
                <Card key={item.label} className="border-0 shadow-sm">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${item.color}15` }}>
                      <item.icon className="h-5 w-5" style={{ color: item.color }} />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{item.val}{item.suffix}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Revenue Bar Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" style={{ color: GOLD }} />
                الإيرادات الشهرية — آخر 6 أشهر
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-64 w-full" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={overview?.charts ?? []} margin={{ top: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />
                    <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#A0ADB8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="revenue" name="الإيرادات (ر.س)" fill={GOLD} radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Invoice breakdown */}
          {isLoaded && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">توزيع الفواتير حسب الحالة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "مدفوعة",  val: overview.invoiceSummary.paid,    total: overview.invoiceSummary.total, color: "#10B981" },
                    { label: "معلقة",   val: overview.invoiceSummary.pending, total: overview.invoiceSummary.total, color: GOLD },
                    { label: "متأخرة",  val: overview.invoiceSummary.overdue, total: overview.invoiceSummary.total, color: "#EF4444" },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className="font-semibold">{r.val} ({pct(r.val, r.total)}%)</span>
                      </div>
                      <Progress value={pct(r.val, r.total)} className="h-2"
                        style={{ "--progress-color": r.color } as any} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expiring Contracts */}
          {isLoaded && overview.expiringContracts.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  عقود تنتهي قريباً
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {overview.expiringContracts.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b last:border-0"
                    style={{ borderColor: "#E2E8F0" }}>
                    <span className="text-sm">{c.title}</span>
                    <span className="text-xs text-amber-400 font-medium">
                      ينتهي {format(new Date(c.expiresAt), "dd MMM yyyy", { locale: arSA })}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB: CASES ═══ */}
        <TabsContent value="cases" className="mt-5 space-y-5">
          <SectionHeader title="تحليلات القضايا" desc="توزيع القضايا والأداء القانوني للمكتب" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Case by type pie */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4" style={{ color: GOLD }} />
                  القضايا حسب النوع
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-56 w-full" /> : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={overview?.topTypes ?? []} cx="50%" cy="50%"
                          outerRadius={80} dataKey="value" paddingAngle={3}
                          label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                          labelLine={false}>
                          {(overview?.topTypes ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(overview?.topTypes ?? []).map((t, i) => (
                        <div key={t.name} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-muted-foreground">{t.name}:</span>
                          <span className="font-bold">{t.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Cases vs Time */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" style={{ color: GOLD }} />
                  القضايا الجديدة شهرياً
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-56 w-full" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={overview?.charts ?? []}>
                      <defs>
                        <linearGradient id="caseGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" opacity={0.5} />
                      <XAxis dataKey="month" tick={{ fill: "#A0ADB8", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#A0ADB8", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="cases" name="قضايا جديدة"
                        stroke="#6366F1" strokeWidth={2} fill="url(#caseGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Team Case Performance */}
          {isLoaded && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Award className="h-4 w-4" style={{ color: GOLD }} />
                  أداء الفريق في القضايا
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المحامي</TableHead>
                      <TableHead className="text-center">قضايا نشطة</TableHead>
                      <TableHead className="text-center">قضايا مغلقة</TableHead>
                      <TableHead className="text-center">إجمالي</TableHead>
                      <TableHead>معدل الإغلاق</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.lawyerStats.filter(m => m.totalCases > 0).map(m => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback style={{ background: `${GOLD}20`, color: GOLD, fontSize: "10px", fontWeight: 700 }}>
                                {m.avatar}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{m.name}</p>
                              <p className="text-xs text-muted-foreground">{m.roleLabel}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold text-indigo-400">{m.activeCases}</TableCell>
                        <TableCell className="text-center font-semibold text-emerald-400">{m.closedCases}</TableCell>
                        <TableCell className="text-center font-bold">{m.totalCases}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={pct(m.closedCases, m.totalCases)} className="h-2 flex-1" />
                            <span className="text-xs font-semibold w-8">{pct(m.closedCases, m.totalCases)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {overview.lawyerStats.filter(m => m.totalCases > 0).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          لا توجد بيانات قضايا مسندة بعد
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB: ROLES ═══ */}
        <TabsContent value="roles" className="mt-5 space-y-5">
          <SectionHeader title="الأدوار والصلاحيات" desc="تحكم في ما يمكن لكل عضو فعله داخل المنصة">
            <Button size="sm" onClick={() => setRoleDialog({ open: true })}>
              <Plus className="h-4 w-4 ml-1.5" />
              دور جديد
            </Button>
          </SectionHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map(role => (
              <Card key={role.id} className="border-0 shadow-sm overflow-hidden">
                <div className="h-1" style={{ background: role.isSystem ? GOLD : "#6366F1" }} />
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: role.isSystem ? `${GOLD}20` : "rgba(99,102,241,0.15)" }}>
                        <Shield className="h-4 w-4" style={{ color: role.isSystem ? GOLD : "#6366F1" }} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{role.displayName}</p>
                        {role.isSystem && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 mt-0.5" style={{ color: GOLD, borderColor: `${GOLD}40` }}>
                            أساسي
                          </Badge>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setRoleDialog({ open: true, role })}>
                          <Edit3 className="h-4 w-4 ml-2" />
                          {role.isSystem ? "عرض التفاصيل" : "تعديل"}
                        </DropdownMenuItem>
                        {!role.isSystem && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-400" onClick={() => deleteRole(role.id)}>
                              <Trash2 className="h-4 w-4 ml-2" />حذف الدور
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {role.description && (
                    <p className="text-xs text-muted-foreground mt-2 mb-3">{role.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {role.permissions.slice(0, 5).map(p => (
                      <span key={p} className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: `${GOLD}15`, color: GOLD }}>
                        {p.replace(":", ".")}
                      </span>
                    ))}
                    {role.permissions.length > 5 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        +{role.permissions.length - 5}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Permission Reference Table */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="h-4 w-4" style={{ color: GOLD }} />
                مرجع الصلاحيات — مقارنة الأدوار
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b" style={{ borderColor: "#E2E8F0" }}>
                      <th className="text-right py-2 pr-2 font-semibold text-muted-foreground">الصلاحية</th>
                      {roles.map(r => (
                        <th key={r.id} className="text-center py-2 px-3 font-semibold"
                          style={{ color: r.isSystem ? GOLD : "#A0ADB8" }}>
                          {r.displayName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      "cases:view","cases:create","cases:edit","cases:delete",
                      "documents:view","documents:create","documents:edit",
                      "ai:view","ai:run",
                      "users:view","users:manage",
                      "billing:view","billing:manage",
                    ].map(perm => (
                      <tr key={perm} className="border-b hover:bg-muted/20 transition-colors" style={{ borderColor: "#E2E8F030" }}>
                        <td className="py-2 pr-2 font-mono text-muted-foreground">{perm}</td>
                        {roles.map(r => (
                          <td key={r.id} className="text-center py-2">
                            {r.permissions.includes(perm)
                              ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                              : <XCircle className="h-3.5 w-3.5 text-muted mx-auto opacity-30" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: ACTIVITY ═══ */}
        <TabsContent value="activity" className="mt-5 space-y-5">
          <SectionHeader title="سجل نشاط المكتب" desc="جميع الأحداث والإجراءات المنفذة داخل المنصة" />

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({length: 8}).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: "#E2E8F0" }}>
                  {(overview?.recentActivity ?? []).map((log: any) => {
                    const actionMap: Record<string,{label:string; color:string; bg:string}> = {
                      create:        { label: "إنشاء",         color: "#10B981", bg: "rgba(16,185,129,0.12)" },
                      update:        { label: "تعديل",         color: "#6366F1", bg: "rgba(99,102,241,0.12)" },
                      delete:        { label: "حذف",           color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
                      invite:        { label: "دعوة",          color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
                      update_role:   { label: "تغيير الدور",   color: GOLD,      bg: `${GOLD}18` },
                      update_status: { label: "تغيير الحالة",  color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
                    };
                    const cfg = actionMap[log.action] ?? { label: log.action, color: "#A0ADB8", bg: "rgba(160,173,184,0.1)" };
                    const resMap: Record<string,string> = { role: "دور", user: "مستخدم", invitation: "دعوة", case: "قضية", document: "مستند" };
                    return (
                      <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: cfg.bg }}>
                          <Activity className="h-4 w-4" style={{ color: cfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                            <span className="text-sm font-medium">{resMap[log.resource] ?? log.resource}</span>
                            {log.details && <span className="text-sm text-muted-foreground truncate">{log.details}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {log.userFullName && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />{log.userFullName}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: arSA })}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(overview?.recentActivity ?? []).length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>لا توجد أحداث مسجّلة بعد</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ── */}
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} roles={roles} />
      <RoleDialog
        open={roleDialog.open}
        onClose={() => setRoleDialog({ open: false })}
        editRole={roleDialog.role}
      />
    </div>
  );
}
