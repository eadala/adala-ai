import { useState } from "react";
import { useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Mail, Phone, Shield, Clock, Check, X, RefreshCw,
  MoreHorizontal, Trash2, Edit3, UserCheck, UserX, Plus, Lock,
  Eye, FileText, Bot, Users as UsersIcon, MessageSquare, CreditCard, LayoutDashboard,
  AlertCircle, Send, Key
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  invitedBy?: string;
  createdAt: string;
  expiresAt: string;
}

interface AuditLog {
  id: string;
  userId?: string;
  userFullName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  createdAt: string;
}

// ─── Permission Config ────────────────────────────────────────────────────────

const PERMISSION_MODULES = [
  {
    key: "dashboard",
    label: "لوحة التحكم",
    icon: LayoutDashboard,
    color: "#6366F1",
    perms: [{ key: "dashboard:view", label: "عرض" }],
  },
  {
    key: "cases",
    label: "القضايا",
    icon: Shield,
    color: "#C9A84C",
    perms: [
      { key: "cases:view", label: "عرض" },
      { key: "cases:create", label: "إنشاء" },
      { key: "cases:edit", label: "تعديل" },
      { key: "cases:delete", label: "حذف" },
    ],
  },
  {
    key: "documents",
    label: "المستندات",
    icon: FileText,
    color: "#10B981",
    perms: [
      { key: "documents:view", label: "عرض" },
      { key: "documents:create", label: "إنشاء" },
      { key: "documents:edit", label: "تعديل" },
      { key: "documents:delete", label: "حذف" },
    ],
  },
  {
    key: "ai",
    label: "الذكاء الاصطناعي",
    icon: Bot,
    color: "#8B5CF6",
    perms: [
      { key: "ai:view", label: "عرض" },
      { key: "ai:run", label: "تشغيل" },
    ],
  },
  {
    key: "users",
    label: "المستخدمون",
    icon: UsersIcon,
    color: "#F59E0B",
    perms: [
      { key: "users:view", label: "عرض" },
      { key: "users:manage", label: "إدارة" },
    ],
  },
  {
    key: "messages",
    label: "المراسلات",
    icon: MessageSquare,
    color: "#06B6D4",
    perms: [
      { key: "messages:view", label: "عرض" },
      { key: "messages:send", label: "إرسال" },
    ],
  },
  {
    key: "billing",
    label: "الفوترة",
    icon: CreditCard,
    color: "#EF4444",
    perms: [
      { key: "billing:view", label: "عرض" },
      { key: "billing:manage", label: "إدارة" },
    ],
  },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-400 border-red-500/20",
  lawyer: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  paralegal: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  viewer: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: "إنشاء", color: "text-emerald-400" },
  update: { label: "تعديل", color: "text-blue-400" },
  delete: { label: "حذف", color: "text-red-400" },
  invite: { label: "دعوة", color: "text-purple-400" },
  update_role: { label: "تغيير الدور", color: "text-yellow-400" },
  update_status: { label: "تغيير الحالة", color: "text-orange-400" },
};

const RESOURCE_LABELS: Record<string, string> = {
  role: "دور", user: "مستخدم", invitation: "دعوة",
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useRoles() {
  return useQuery<Role[]>({
    queryKey: ["rbac-roles"],
    queryFn: async () => {
      const r = await fetch("/api/rbac/roles");
      return r.json();
    },
  });
}

function useInvitations() {
  return useQuery<Invitation[]>({
    queryKey: ["rbac-invitations"],
    queryFn: async () => {
      const r = await fetch("/api/rbac/invitations");
      return r.json();
    },
  });
}

function useAuditLogs() {
  return useQuery<AuditLog[]>({
    queryKey: ["rbac-audit-logs"],
    queryFn: async () => {
      const r = await fetch("/api/rbac/audit-logs");
      return r.json();
    },
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RoleBadge({ role, roles }: { role: string; roles?: Role[] }) {
  const roleData = roles?.find(r => r.name === role);
  const label = roleData?.displayName ?? role;
  const colorClass = ROLE_COLORS[role] ?? "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={`font-medium text-xs ${colorClass}`}>
      {label}
    </Badge>
  );
}

function PermissionMatrix({ permissions, onChange, readOnly = false }: {
  permissions: string[];
  onChange?: (perms: string[]) => void;
  readOnly?: boolean;
}) {
  const toggle = (key: string) => {
    if (readOnly || !onChange) return;
    const next = permissions.includes(key)
      ? permissions.filter(p => p !== key)
      : [...permissions, key];
    onChange(next);
  };

  const toggleAll = (modPerms: string[], allOn: boolean) => {
    if (readOnly || !onChange) return;
    const next = allOn
      ? permissions.filter(p => !modPerms.includes(p))
      : [...new Set([...permissions, ...modPerms])];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {PERMISSION_MODULES.map(mod => {
        const modKeys = mod.perms.map(p => p.key);
        const allOn = modKeys.every(k => permissions.includes(k));
        const Icon = mod.icon;
        return (
          <div key={mod.key} className="rounded-xl border bg-card overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer select-none"
              style={{ background: `${mod.color}08` }}
              onClick={() => toggleAll(modKeys, allOn)}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${mod.color}20` }}>
                <Icon className="h-3.5 w-3.5" style={{ color: mod.color }} />
              </div>
              <span className="font-semibold text-sm text-foreground flex-1">{mod.label}</span>
              {!readOnly && (
                <Switch
                  checked={allOn}
                  onCheckedChange={() => toggleAll(modKeys, allOn)}
                  onClick={e => e.stopPropagation()}
                  className="scale-90"
                />
              )}
              {readOnly && allOn && <Check className="h-4 w-4 text-emerald-400" />}
              {readOnly && !allOn && modKeys.some(k => permissions.includes(k)) && (
                <div className="h-4 w-4 rounded-sm border-2 border-primary flex items-center justify-center">
                  <div className="h-1.5 w-1.5 bg-primary rounded-sm" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {mod.perms.map(perm => {
                const on = permissions.includes(perm.key);
                return (
                  <button
                    key={perm.key}
                    onClick={() => toggle(perm.key)}
                    disabled={readOnly}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      on
                        ? "text-white border-transparent"
                        : "bg-muted/30 text-muted-foreground border-muted hover:border-primary/50"
                    } ${readOnly ? "cursor-default" : "cursor-pointer hover:opacity-80"}`}
                    style={on ? { background: mod.color, borderColor: mod.color } : {}}
                  >
                    {on ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-50" />}
                    {perm.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────

function InviteDialog({ open, onClose, roles }: { open: boolean; onClose: () => void; roles: Role[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("lawyer");
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/rbac/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast({ title: "تم إرسال الدعوة", description: `تم دعوة ${email} للانضمام إلى المنصة` });
      qc.invalidateQueries({ queryKey: ["rbac-invitations"] });
      qc.invalidateQueries({ queryKey: ["rbac-audit-logs"] });
      setEmail(""); setRole("lawyer");
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            دعوة مستخدم جديد
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>البريد الإلكتروني</Label>
            <Input
              placeholder="example@lawfirm.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label>الدور</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.name}>
                    <div className="flex items-center gap-2">
                      <span>{r.displayName}</span>
                      {r.isSystem && <Badge variant="outline" className="text-[10px] py-0 px-1">أساسي</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg p-3 text-sm text-muted-foreground" style={{ background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.2)" }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>ستصلهم رسالة بريد إلكتروني تحتوي على رابط الدعوة الصالح لمدة 7 أيام.</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={!email || mutation.isPending}>
            <Send className="h-4 w-4 ml-2" />
            {mutation.isPending ? "جارٍ الإرسال..." : "إرسال الدعوة"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleDialog({ open, onClose, role }: { open: boolean; onClose: () => void; role?: Role }) {
  const [displayName, setDisplayName] = useState(role?.displayName ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const { toast } = useToast();
  const qc = useQueryClient();

  const isEdit = !!role;

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `/api/rbac/roles/${role!.id}` : "/api/rbac/roles";
      const method = isEdit ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: displayName.toLowerCase().replace(/\s+/g, "_"),
          displayName,
          description,
          permissions,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast({ title: isEdit ? "تم تحديث الدور" : "تم إنشاء الدور" });
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
      qc.invalidateQueries({ queryKey: ["rbac-audit-logs"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            {isEdit ? `تعديل دور: ${role!.displayName}` : "إنشاء دور جديد"}
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
              <Input placeholder="وصف مختصر للدور" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-primary" />
              مصفوفة الصلاحيات
            </h4>
            <PermissionMatrix
              permissions={permissions}
              onChange={isEdit && role?.isSystem ? undefined : setPermissions}
              readOnly={isEdit && role?.isSystem}
            />
            {isEdit && role?.isSystem && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                الأدوار الأساسية محمية ولا يمكن تعديل صلاحياتها
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={!displayName || mutation.isPending}>
            {mutation.isPending ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "إنشاء الدور"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Users() {
  const { data: users, isLoading: usersLoading } = useListUsers();
  const { data: roles = [], isLoading: rolesLoading } = useRoles();
  const { data: invitations = [], isLoading: invitationsLoading } = useInvitations();
  const { data: auditLogs = [], isLoading: auditLoading } = useAuditLogs();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleDialog, setRoleDialog] = useState<{ open: boolean; role?: Role }>({ open: false });
  const [activeTab, setActiveTab] = useState("users");

  const { toast } = useToast();
  const qc = useQueryClient();

  const pendingInvitations = invitations.filter(i => i.status === "pending").length;

  const changeRole = async (userId: string, role: string) => {
    const r = await fetch(`/api/rbac/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (r.ok) {
      toast({ title: "تم تغيير الدور بنجاح" });
      qc.invalidateQueries({ queryKey: ["listUsers"] });
      qc.invalidateQueries({ queryKey: ["rbac-audit-logs"] });
    }
  };

  const changeStatus = async (userId: string, status: string) => {
    const r = await fetch(`/api/rbac/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      toast({ title: status === "active" ? "تم تفعيل الحساب" : "تم تعطيل الحساب" });
      qc.invalidateQueries({ queryKey: ["listUsers"] });
      qc.invalidateQueries({ queryKey: ["rbac-audit-logs"] });
    }
  };

  const deleteInvitation = async (id: string) => {
    await fetch(`/api/rbac/invitations/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["rbac-invitations"] });
    toast({ title: "تم سحب الدعوة" });
  };

  const resendInvitation = async (id: string) => {
    await fetch(`/api/rbac/invitations/${id}/resend`, { method: "PATCH" });
    qc.invalidateQueries({ queryKey: ["rbac-invitations"] });
    toast({ title: "تم إعادة إرسال الدعوة" });
  };

  const deleteRole = async (id: string) => {
    const r = await fetch(`/api/rbac/roles/${id}`, { method: "DELETE" });
    if (r.ok) {
      toast({ title: "تم حذف الدور" });
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    } else {
      const data = await r.json();
      toast({ title: "خطأ", description: data.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إدارة الصلاحيات والفريق</h1>
          <p className="text-muted-foreground mt-1">تحكم في أدوار المستخدمين وصلاحيات الوصول</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRoleDialog({ open: true })}>
            <Plus className="ml-2 h-4 w-4" />
            دور جديد
          </Button>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="ml-2 h-4 w-4" />
            دعوة مستخدم
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المستخدمين", value: users?.length ?? 0, icon: UsersIcon, color: "#6366F1" },
          { label: "مستخدمون نشطون", value: users?.filter(u => u.status === "active").length ?? 0, icon: UserCheck, color: "#10B981" },
          { label: "الأدوار المُعرَّفة", value: roles.length, icon: Key, color: "#C9A84C" },
          { label: "دعوات معلقة", value: pendingInvitations, icon: Send, color: "#F59E0B" },
        ].map(stat => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
              <div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
          <TabsTrigger value="roles">الأدوار</TabsTrigger>
          <TabsTrigger value="invitations" className="relative">
            الدعوات
            {pendingInvitations > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                {pendingInvitations}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit">سجل التدقيق</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: USERS ── */}
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">التواصل</TableHead>
                    <TableHead className="text-right">الدور</TableHead>
                    <TableHead className="text-right">الصلاحيات</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading
                    ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-6 w-full" /></TableCell>
                        ))}
                        <TableCell />
                      </TableRow>
                    ))
                    : users?.map(user => {
                      const roleData = roles.find(r => r.name === user.role);
                      const permCount = roleData?.permissions.length ?? 0;
                      return (
                        <TableRow key={user.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                                  {user.fullName.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-sm">{user.fullName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(user.createdAt), "dd MMM yyyy", { locale: arSA })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>
                              {user.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{user.phone}</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={user.role} onValueChange={v => changeRole(user.id, v)}>
                              <SelectTrigger className="h-8 w-36 text-xs border-0 bg-muted/50">
                                <SelectValue>
                                  <RoleBadge role={user.role} roles={roles} />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map(r => (
                                  <SelectItem key={r.id} value={r.name} className="text-xs">
                                    {r.displayName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 rounded-full bg-muted flex-1 max-w-[80px]">
                                <div
                                  className="h-1.5 rounded-full bg-primary transition-all"
                                  style={{ width: `${Math.min(100, (permCount / 17) * 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{permCount}/17</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.status === "active" ? "default" : "outline"}
                              className={user.status === "active" ? "bg-emerald-600/80 text-white border-0 text-xs" : "text-xs"}
                            >
                              {user.status === "active" ? "نشط" : "معطّل"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => changeStatus(user.id, user.status === "active" ? "inactive" : "active")}>
                                  {user.status === "active"
                                    ? <><UserX className="h-4 w-4 ml-2 text-destructive" />تعطيل الحساب</>
                                    : <><UserCheck className="h-4 w-4 ml-2 text-emerald-500" />تفعيل الحساب</>
                                  }
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setActiveTab("roles")}>
                                  <Eye className="h-4 w-4 ml-2" />
                                  عرض صلاحيات الدور
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: ROLES ── */}
        <TabsContent value="roles" className="mt-4 space-y-4">
          {rolesLoading
            ? <Skeleton className="h-48 w-full rounded-xl" />
            : roles.map(role => (
              <Card key={role.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{role.displayName}</CardTitle>
                          {role.isSystem && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                              <Lock className="h-2.5 w-2.5" />أساسي
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs mt-0.5">{role.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {role.permissions.length} صلاحية
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setRoleDialog({ open: true, role })}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      {!role.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteRole(role.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <PermissionMatrix permissions={role.permissions} readOnly />
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        {/* ── TAB 3: INVITATIONS ── */}
        <TabsContent value="invitations" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right">الدور المُعيَّن</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">تاريخ الإرسال</TableHead>
                    <TableHead className="text-right">تنتهي في</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitationsLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                        <TableCell />
                      </TableRow>
                    ))
                    : invitations.length === 0
                    ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <Send className="h-8 w-8 mx-auto mb-3 opacity-30" />
                          لا توجد دعوات مرسلة
                        </TableCell>
                      </TableRow>
                    )
                    : invitations.map(inv => {
                      const isExpired = new Date(inv.expiresAt) < new Date();
                      const statusMap: Record<string, { label: string; class: string }> = {
                        pending: { label: "معلقة", class: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
                        accepted: { label: "مقبولة", class: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
                        expired: { label: "منتهية", class: "bg-muted text-muted-foreground" },
                      };
                      const s = isExpired && inv.status === "pending" ? statusMap.expired : (statusMap[inv.status] ?? statusMap.pending);
                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">{inv.email}</TableCell>
                          <TableCell><RoleBadge role={inv.role} roles={roles} /></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${s.class}`}>{s.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(inv.createdAt), "dd/MM/yyyy", { locale: arSA })}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(inv.expiresAt), "dd/MM/yyyy", { locale: arSA })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {inv.status === "pending" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resendInvitation(inv.id)} title="إعادة الإرسال">
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteInvitation(inv.id)} title="سحب الدعوة">
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 4: AUDIT LOG ── */}
        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                سجل التدقيق — آخر 100 عملية
              </CardTitle>
              <CardDescription>تتبع كامل لجميع التغييرات في الصلاحيات والمستخدمين</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {auditLoading
                ? <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                : auditLogs.length === 0
                ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    لا توجد سجلات بعد
                  </div>
                )
                : (
                  <div className="divide-y">
                    {auditLogs.map((log, i) => {
                      const action = ACTION_LABELS[log.action] ?? { label: log.action, color: "text-foreground" };
                      const resource = RESOURCE_LABELS[log.resource] ?? log.resource;
                      return (
                        <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold ${action.color}`}>{action.label}</span>
                              <span className="text-sm text-muted-foreground">{resource}</span>
                              {log.details && <span className="text-sm text-foreground">— {log.details}</span>}
                            </div>
                            {log.userFullName && (
                              <div className="text-xs text-muted-foreground mt-0.5">بواسطة: {log.userFullName}</div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex-shrink-0 mt-1">
                            {format(new Date(log.createdAt), "dd/MM HH:mm", { locale: arSA })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} roles={roles} />
      <RoleDialog
        open={roleDialog.open}
        onClose={() => setRoleDialog({ open: false })}
        role={roleDialog.role}
      />
    </div>
  );
}
