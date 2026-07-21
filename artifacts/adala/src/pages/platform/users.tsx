/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-non-null-assertion -- pre-existing lint debt; authFetch migration */
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
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus, Mail, Phone, Shield, Clock, Check, X, RefreshCw,
  MoreHorizontal, Trash2, Edit3, UserCheck, UserX, Plus, Lock,
  Eye, FileText, Bot, Users as UsersIcon, MessageSquare, CreditCard,
  LayoutDashboard, AlertCircle, Send, Key, Scale, BookOpen, DollarSign,
  Settings, Handshake, Crown, Briefcase, GraduationCap, Calculator,
  ClipboardList, Globe, Gavel, ChevronDown, ChevronRight, Info,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

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

// ─── Permission Modules (full matrix) ────────────────────────────────────────

const PERMISSION_MODULES = [
  {
    key: "cases",
    label: "القضايا",
    icon: Scale,
    color: "#2563EB",
    perms: [
      { key: "cases:view",   label: "عرض" },
      { key: "cases:create", label: "إنشاء" },
      { key: "cases:edit",   label: "تعديل" },
      { key: "cases:delete", label: "حذف" },
      { key: "cases:assign", label: "تعيين" },
      { key: "cases:close",  label: "إغلاق" },
    ],
  },
  {
    key: "clients",
    label: "العملاء",
    icon: UsersIcon,
    color: "#3B82F6",
    perms: [
      { key: "clients:view",   label: "عرض" },
      { key: "clients:create", label: "إنشاء" },
      { key: "clients:edit",   label: "تعديل" },
      { key: "clients:delete", label: "حذف" },
    ],
  },
  {
    key: "contracts",
    label: "العقود",
    icon: FileText,
    color: "#8B5CF6",
    perms: [
      { key: "contracts:view",   label: "عرض" },
      { key: "contracts:create", label: "إنشاء" },
      { key: "contracts:edit",   label: "تعديل" },
      { key: "contracts:delete", label: "حذف" },
    ],
  },
  {
    key: "documents",
    label: "المستندات",
    icon: BookOpen,
    color: "#10B981",
    perms: [
      { key: "documents:view",   label: "عرض" },
      { key: "documents:upload", label: "رفع" },
      { key: "documents:edit",   label: "تعديل" },
      { key: "documents:delete", label: "حذف" },
    ],
  },
  {
    key: "financial",
    label: "المالية",
    icon: DollarSign,
    color: "#EF4444",
    perms: [
      { key: "invoices:view",   label: "عرض الفواتير" },
      { key: "invoices:create", label: "إنشاء فاتورة" },
      { key: "invoices:edit",   label: "تعديل فاتورة" },
      { key: "invoices:delete", label: "حذف فاتورة" },
      { key: "payments:view",   label: "عرض المدفوعات" },
      { key: "payments:create", label: "إضافة دفعة" },
      { key: "reports:view",    label: "التقارير المالية" },
      { key: "financial:view",  label: "البيانات المالية" },
    ],
  },
  {
    key: "users",
    label: "المستخدمون",
    icon: UserPlus,
    color: "#F59E0B",
    perms: [
      { key: "users:view",   label: "عرض" },
      { key: "users:create", label: "إضافة" },
      { key: "users:edit",   label: "تعديل" },
      { key: "users:delete", label: "حذف" },
      { key: "roles:view",   label: "عرض الأدوار" },
      { key: "roles:create", label: "إنشاء دور" },
      { key: "roles:edit",   label: "تعديل دور" },
    ],
  },
  {
    key: "settings",
    label: "الإعدادات",
    icon: Settings,
    color: "#6B7280",
    perms: [
      { key: "settings:view", label: "عرض" },
      { key: "settings:edit", label: "تعديل" },
    ],
  },
  {
    key: "ai",
    label: "الذكاء الاصطناعي",
    icon: Bot,
    color: "#A855F7",
    perms: [
      { key: "ai:access", label: "وصول كامل" },
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
    key: "support",
    label: "الدعم الفني",
    icon: ClipboardList,
    color: "#EC4899",
    perms: [
      { key: "support:view",  label: "عرض" },
      { key: "support:reply", label: "رد" },
    ],
  },
  {
    key: "referral",
    label: "الإحالة والوساطة",
    icon: Handshake,
    color: "#F97316",
    perms: [
      { key: "referral:create",      label: "إنشاء إحالة" },
      { key: "referral:view",        label: "عرض الإحالات" },
      { key: "collaborator:access",  label: "وصول متعاون" },
    ],
  },
  {
    key: "audit",
    label: "التدقيق",
    icon: Eye,
    color: "#64748B",
    perms: [
      { key: "audit:view",     label: "عرض السجل" },
      { key: "dashboard:view", label: "لوحة التحكم" },
    ],
  },
];

const TOTAL_PERMS = PERMISSION_MODULES.reduce((s, m) => s + m.perms.length, 0);

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { color: string; bg: string; icon: React.ComponentType<any>; scope: string }> = {
  firm_owner:     { color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20",  icon: Crown,          scope: "جميع البيانات بلا قيود" },
  office_manager: { color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",      icon: Briefcase,      scope: "جميع بيانات المكتب" },
  lawyer:         { color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/20",  icon: Gavel,          scope: "القضايا المُعيَّنة فقط" },
  trainee_lawyer: { color: "text-indigo-400",  bg: "bg-indigo-500/10 border-indigo-500/20",  icon: GraduationCap,  scope: "القضايا المُعيَّنة — عرض فقط" },
  accountant:     { color: "text-green-400",   bg: "bg-green-500/10 border-green-500/20",    icon: Calculator,     scope: "البيانات المالية فقط" },
  secretary:      { color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/20",      icon: ClipboardList,  scope: "العملاء والوثائق — محدود" },
  broker:         { color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/20",  icon: Handshake,      scope: "الإحالات الخاصة به فقط" },
  collaborator:   { color: "text-rose-400",    bg: "bg-rose-500/10 border-rose-500/20",      icon: Globe,          scope: "المهام المشتركة فقط" },
  client:         { color: "text-muted-foreground",   bg: "bg-muted/30 10 border-slate-500/20",    icon: UsersIcon,      scope: "ملفه الشخصي فقط" },
  // legacy / custom
  admin:          { color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",        icon: Shield,         scope: "كامل" },
  paralegal:      { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20",icon: BookOpen,       scope: "محدود" },
  viewer:         { color: "text-muted-foreground",   bg: "bg-muted/30 10 border-slate-500/20",    icon: Eye,            scope: "قراءة فقط" },
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create:        { label: "إنشاء",          color: "text-emerald-400" },
  update:        { label: "تعديل",          color: "text-blue-400" },
  delete:        { label: "حذف",            color: "text-red-400" },
  invite:        { label: "دعوة",           color: "text-purple-400" },
  update_role:   { label: "تغيير الدور",    color: "text-yellow-400" },
  update_status: { label: "تغيير الحالة",  color: "text-orange-400" },
};

const RESOURCE_LABELS: Record<string, string> = {
  role: "دور", user: "مستخدم", invitation: "دعوة",
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useRoles() {
  return useQuery<Role[]>({
    queryKey: ["rbac-roles"],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/rbac/roles`);
      return r.json();
    },
  });
}

function useInvitations() {
  return useQuery<Invitation[]>({
    queryKey: ["rbac-invitations"],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/rbac/invitations`);
      return r.json();
    },
  });
}

function useAuditLogs() {
  return useQuery<AuditLog[]>({
    queryKey: ["rbac-audit-logs"],
    queryFn: async () => {
      const r = await authFetch(`${BASE}/api/rbac/audit-logs`);
      return r.json();
    },
  });
}

// ─── RoleBadge ────────────────────────────────────────────────────────────────

function RoleBadge({ role, roles }: { role: string; roles?: Role[] }) {
  const roleData = roles?.find(r => r.name === role);
  const label = roleData?.displayName ?? role;
  const meta = ROLE_META[role];
  const Icon = meta?.icon ?? Shield;
  return (
    <Badge variant="outline" className={`font-medium text-xs gap-1.5 ${meta?.bg ?? "bg-muted text-muted-foreground"}`}>
      <Icon className={`h-3 w-3 ${meta?.color ?? ""}`} />
      {label}
    </Badge>
  );
}

// ─── Permission Matrix ────────────────────────────────────────────────────────

function PermissionMatrix({ permissions, onChange, readOnly = false }: {
  permissions: string[];
  onChange?: (perms: string[]) => void;
  readOnly?: boolean;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const hasAll = permissions.includes("*");

  const toggle = (key: string) => {
    if (readOnly || !onChange) return;
    const next = permissions.includes(key)
      ? permissions.filter(p => p !== key)
      : [...permissions, key];
    onChange(next);
  };

  const toggleModule = (modPerms: string[], allOn: boolean) => {
    if (readOnly || !onChange) return;
    const next = allOn
      ? permissions.filter(p => !modPerms.includes(p))
      : [...new Set([...permissions, ...modPerms])];
    onChange(next);
  };

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  if (hasAll) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
        <Crown className="h-5 w-5 text-yellow-400" />
        <div>
          <p className="text-sm font-semibold text-yellow-400">صلاحيات كاملة (wildcard *)</p>
          <p className="text-xs text-muted-foreground">هذا الدور يمتلك وصولاً كاملاً لجميع وظائف المنصة</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {PERMISSION_MODULES.map(mod => {
        const modKeys = mod.perms.map(p => p.key);
        const activeKeys = modKeys.filter(k => permissions.includes(k));
        const allOn = activeKeys.length === modKeys.length;
        const someOn = activeKeys.length > 0 && !allOn;
        const isCollapsed = collapsed.has(mod.key);
        const Icon = mod.icon;

        return (
          <div key={mod.key} className="rounded-xl border border-border/50 overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none"
              style={{ background: activeKeys.length > 0 ? `${mod.color}08` : undefined }}
              onClick={() => toggleCollapse(mod.key)}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${mod.color}18` }}>
                <Icon className="h-3.5 w-3.5" style={{ color: mod.color }} />
              </div>
              <span className="font-semibold text-sm flex-1">{mod.label}</span>
              <span className="text-[10px] text-muted-foreground mr-auto">
                {activeKeys.length}/{modKeys.length}
              </span>
              {!readOnly && (
                <Switch
                  checked={allOn}
                  onCheckedChange={() => toggleModule(modKeys, allOn)}
                  onClick={e => e.stopPropagation()}
                  className="scale-90 ms-2"
                />
              )}
              {readOnly && allOn && <Check className="h-4 w-4 text-emerald-400 ms-2" />}
              {readOnly && someOn && (
                <div className="h-4 w-4 rounded-sm border-2 border-primary flex items-center justify-center ms-2">
                  <div className="h-1.5 w-1.5 bg-primary rounded-sm" />
                </div>
              )}
              {isCollapsed
                ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>

            {!isCollapsed && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-3 pt-1">
                {mod.perms.map(perm => {
                  const on = permissions.includes(perm.key);
                  return (
                    <button
                      key={perm.key}
                      onClick={() => toggle(perm.key)}
                      disabled={readOnly}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                        on ? "text-white border-transparent" : "bg-muted/30 text-muted-foreground border-muted hover:border-primary/50"
                      } ${readOnly ? "cursor-default" : "cursor-pointer hover:opacity-80"}`}
                      style={on ? { background: mod.color, borderColor: mod.color } : {}}
                    >
                      {on ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5 opacity-40" />}
                      {perm.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Visibility Scope Card ───────────────────────────────────────────────────

function VisibilityScopeGrid({ roles }: { roles: Role[] }) {
  const systemRoles = ["firm_owner", "office_manager", "lawyer", "trainee_lawyer", "accountant", "secretary", "broker", "collaborator", "client"];
  const ordered = [
    ...systemRoles.map(n => roles.find(r => r.name === n)).filter(Boolean) as Role[],
    ...roles.filter(r => !systemRoles.includes(r.name)),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {ordered.map(role => {
        const meta = ROLE_META[role.name];
        const Icon = meta?.icon ?? Shield;
        const hasAll = role.permissions.includes("*");
        const permCount = hasAll ? TOTAL_PERMS : role.permissions.length;

        return (
          <div key={role.id} className={`rounded-2xl border p-4 ${meta?.bg ?? "border-border/50 bg-card"}`}>
            <div className="flex items-start gap-3 mb-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${meta?.bg ?? "bg-muted"}`}>
                <Icon className={`h-5 w-5 ${meta?.color ?? "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-bold text-sm">{role.displayName}</p>
                  {role.isSystem && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      <Lock className="h-2 w-2 ms-0.5" />أساسي
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{role.description}</p>
              </div>
            </div>

            {/* Scope */}
            {meta?.scope && (
              <div className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-2 mb-3">
                <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground">{meta.scope}</span>
              </div>
            )}

            {/* Permission count bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>الصلاحيات</span>
                <span>{hasAll ? "كامل ✦" : `${permCount} / ${TOTAL_PERMS}`}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/50">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${hasAll ? 100 : Math.min(100, (permCount / TOTAL_PERMS) * 100)}%`,
                    background: meta?.color?.replace("text-", "") ? undefined : "#2563EB",
                    backgroundColor: hasAll ? "#2563EB" : undefined,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── InviteDialog ──────────────────────────────────────────────────────────────

function InviteDialog({ open, onClose, roles }: { open: boolean; onClose: () => void; roles: Role[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("lawyer");
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await authFetch(`${BASE}/api/rbac/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      toast({ title: "✅ تم إرسال الدعوة", description: `تم دعوة ${email} بدور ${roles.find(r => r.name === role)?.displayName}` });
      qc.invalidateQueries({ queryKey: ["rbac-invitations"] });
      qc.invalidateQueries({ queryKey: ["rbac-audit-logs"] });
      setEmail(""); setRole("lawyer");
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const selectedRole = roles.find(r => r.name === role);
  const selectedMeta = ROLE_META[role];
  const SelectedIcon = selectedMeta?.icon ?? Shield;

  return (
    <AdaptiveDialog open={open} onOpenChange={onClose}>
      <AdaptiveDialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            دعوة عضو جديد للمكتب
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">البريد الإلكتروني *</Label>
            <Input
              placeholder="name@lawfirm.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">الدور المُعيَّن *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => {
                  const m = ROLE_META[r.name];
                  const Icon = m?.icon ?? Shield;
                  return (
                    <SelectItem key={r.id} value={r.name}>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${m?.color ?? "text-muted-foreground"}`} />
                        <span>{r.displayName}</span>
                        {r.isSystem && <Badge variant="outline" className="text-[9px] py-0 px-1 h-4">أساسي</Badge>}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Selected role preview */}
          {selectedRole && (
            <div className={`rounded-xl border p-3 ${selectedMeta?.bg ?? "border-border bg-muted/10"}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <SelectedIcon className={`h-4 w-4 ${selectedMeta?.color ?? ""}`} />
                <span className={`text-sm font-semibold ${selectedMeta?.color ?? ""}`}>{selectedRole.displayName}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{selectedRole.description}</p>
              {selectedMeta?.scope && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  نطاق الرؤية: {selectedMeta.scope}
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg p-3 text-sm text-muted-foreground bg-primary/5 border border-primary/10">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="text-xs">سيُرسل رابط دعوة صالح لمدة 7 أيام. بعد القبول سيُضاف المستخدم تلقائياً بالدور المُحدَّد.</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={!email || mutation.isPending} className="gap-2">
            <Send className="h-3.5 w-3.5" />
            {mutation.isPending ? "جارٍ الإرسال..." : "إرسال الدعوة"}
          </Button>
        </DialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

// ─── RoleDialog ────────────────────────────────────────────────────────────────

function RoleDialog({ open, onClose, role }: { open: boolean; onClose: () => void; role?: Role }) {
  const [displayName, setDisplayName] = useState(role?.displayName ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? []);
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!role;

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEdit ? `${BASE}/api/rbac/roles/${role!.id}` : `${BASE}/api/rbac/roles`;
      const method = isEdit ? "PATCH" : "POST";
      const r = await authFetch(url, {
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
      toast({ title: isEdit ? "✅ تم تحديث الدور" : "✅ تم إنشاء الدور" });
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
      qc.invalidateQueries({ queryKey: ["rbac-audit-logs"] });
      onClose();
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <AdaptiveDialog open={open} onOpenChange={onClose}>
      <AdaptiveDialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            {isEdit ? `تعديل دور: ${role!.displayName}` : "إنشاء دور مخصص"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-4 mobile-single-col">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">اسم الدور *</Label>
              <Input placeholder="مثال: محامي أول" value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">الوصف</Label>
              <Input placeholder="وصف مختصر..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                مصفوفة الصلاحيات
              </h4>
              <span className="text-xs text-muted-foreground">
                {permissions.includes("*") ? "كامل" : `${permissions.length} / ${TOTAL_PERMS}`} صلاحية
              </span>
            </div>
            <PermissionMatrix
              permissions={permissions}
              onChange={isEdit && role?.isSystem ? undefined : setPermissions}
              readOnly={isEdit && (role?.isSystem ?? false)}
            />
            {isEdit && role?.isSystem && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                الأدوار الأساسية محمية — يمكن تعديل الاسم والوصف فقط
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mutation.mutate()} disabled={!displayName || mutation.isPending} className="gap-2">
            {mutation.isPending ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديلات" : "إنشاء الدور"}
          </Button>
        </DialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
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
  const [userSearch, setUserSearch] = useState("");

  const { toast } = useToast();
  const qc = useQueryClient();

  const pendingInvitations = invitations.filter(i => i.status === "pending").length;
  const filteredUsers = (users ?? []).filter(u =>
    u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const changeRole = async (userId: string, role: string) => {
    const r = await authFetch(`${BASE}/api/rbac/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (r.ok) {
      toast({ title: "✅ تم تغيير الدور" });
      qc.invalidateQueries({ queryKey: ["listUsers"] });
      qc.invalidateQueries({ queryKey: ["rbac-audit-logs"] });
    }
  };

  const changeStatus = async (userId: string, status: string) => {
    const r = await authFetch(`${BASE}/api/rbac/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      toast({ title: status === "active" ? "✅ تم تفعيل الحساب" : "⛔ تم تعطيل الحساب" });
      qc.invalidateQueries({ queryKey: ["listUsers"] });
      qc.invalidateQueries({ queryKey: ["rbac-audit-logs"] });
    }
  };

  const deleteInvitation = async (id: string) => {
    await authFetch(`${BASE}/api/rbac/invitations/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["rbac-invitations"] });
    toast({ title: "تم سحب الدعوة" });
  };

  const resendInvitation = async (id: string) => {
    await authFetch(`${BASE}/api/rbac/invitations/${id}/resend`, { method: "PATCH" });
    qc.invalidateQueries({ queryKey: ["rbac-invitations"] });
    toast({ title: "تم إعادة إرسال الدعوة" });
  };

  const deleteRole = async (id: string) => {
    const r = await authFetch(`${BASE}/api/rbac/roles/${id}`, { method: "DELETE" });
    if (r.ok) {
      toast({ title: "تم حذف الدور" });
      qc.invalidateQueries({ queryKey: ["rbac-roles"] });
    } else {
      const data = await r.json();
      toast({ title: "خطأ", description: data.error, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 p-1" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            لوحة إدارة الفريق والصلاحيات
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تحكم كامل في أدوار المستخدمين ونطاق وصولهم</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRoleDialog({ open: true })} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            دور مخصص
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            دعوة عضو
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الأعضاء",    value: users?.length ?? 0,                                          icon: UsersIcon,  color: "#6366F1" },
          { label: "أعضاء نشطون",       value: users?.filter(u => u.status === "active").length ?? 0,       icon: UserCheck,  color: "#10B981" },
          { label: "الأدوار المُعرَّفة", value: roles.length,                                                icon: Key,        color: "#2563EB" },
          { label: "دعوات معلقة",       value: pendingInvitations,                                          icon: Send,       color: "#F59E0B" },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${stat.color}15` }}>
              <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
            </div>
            <div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/50 p-1 rounded-xl w-full sm:w-auto">
          <TabsTrigger value="users" className="gap-1.5 text-xs"><UsersIcon className="h-3.5 w-3.5" />المستخدمون</TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5 text-xs"><Shield className="h-3.5 w-3.5" />الأدوار</TabsTrigger>
          <TabsTrigger value="scope" className="gap-1.5 text-xs"><Eye className="h-3.5 w-3.5" />نطاق الرؤية</TabsTrigger>
          <TabsTrigger value="invitations" className="relative gap-1.5 text-xs">
            <Send className="h-3.5 w-3.5" />الدعوات
            {pendingInvitations > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center font-bold">
                {pendingInvitations}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" />سجل التدقيق</TabsTrigger>
        </TabsList>

        {/* ══ TAB 1: USERS ══ */}
        <TabsContent value="users" className="mt-4 space-y-3">
          <div className="relative">
            <UsersIcon className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث باسم المستخدم أو البريد..."
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              className="pe-9"
            />
          </div>
          <Card className="border-border/50">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-right">العضو</TableHead>
                    <TableHead className="text-right">التواصل</TableHead>
                    <TableHead className="text-right">الدور</TableHead>
                    <TableHead className="text-right hidden md:table-cell">نطاق الوصول</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الصلاحيات</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="w-[44px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading
                    ? Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                        <TableCell />
                      </TableRow>
                    ))
                    : filteredUsers.length === 0
                    ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <UsersIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          {userSearch ? "لا توجد نتائج" : "لا يوجد أعضاء بعد"}
                        </TableCell>
                      </TableRow>
                    )
                    : filteredUsers.map(user => {
                      const roleData = roles.find(r => r.name === user.role);
                      const hasAll = roleData?.permissions.includes("*");
                      const permCount = hasAll ? TOTAL_PERMS : (roleData?.permissions.length ?? 0);
                      const meta = ROLE_META[user.role];

                      return (
                        <TableRow key={user.id} className="hover:bg-muted/20">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                                  {user.fullName.slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-semibold text-sm">{user.fullName}</div>
                                <div className="text-[10px] text-muted-foreground">
                                  {format(new Date(user.createdAt), "dd MMM yyyy", { locale: arSA })}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>
                              {user.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{user.phone}</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={user.role} onValueChange={v => changeRole(user.id, v)}>
                              <SelectTrigger className="h-8 w-40 text-xs border-0 bg-muted/40">
                                <SelectValue>
                                  <RoleBadge role={user.role} roles={roles} />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map(r => {
                                  const m = ROLE_META[r.name];
                                  const Icon = m?.icon ?? Shield;
                                  return (
                                    <SelectItem key={r.id} value={r.name} className="text-xs">
                                      <div className="flex items-center gap-2">
                                        <Icon className={`h-3.5 w-3.5 ${m?.color ?? ""}`} />
                                        {r.displayName}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {meta?.scope && (
                              <span className="text-[10px] text-muted-foreground">{meta.scope}</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 cursor-help">
                                  <div className="h-1.5 rounded-full bg-muted flex-1 max-w-[70px]">
                                    <div
                                      className="h-1.5 rounded-full bg-primary transition-all"
                                      style={{ width: `${hasAll ? 100 : Math.min(100, (permCount / TOTAL_PERMS) * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {hasAll ? "كامل" : `${permCount}/${TOTAL_PERMS}`}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{roleData?.displayName ?? user.role}: {hasAll ? "صلاحيات كاملة" : `${permCount} صلاحية`}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user.status === "active" ? "default" : "outline"}
                              className={`text-[10px] ${user.status === "active" ? "bg-emerald-600/80 text-white border-0" : ""}`}
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
                                    ? <><UserX className="h-4 w-4 ms-2 text-destructive" />تعطيل الحساب</>
                                    : <><UserCheck className="h-4 w-4 ms-2 text-emerald-500" />تفعيل الحساب</>}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setActiveTab("roles")}>
                                  <Eye className="h-4 w-4 ms-2" />عرض صلاحيات الدور
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

        {/* ══ TAB 2: ROLES ══ */}
        <TabsContent value="roles" className="mt-4 space-y-3">
          {rolesLoading
            ? <Skeleton className="h-48 w-full rounded-xl" />
            : roles.map(role => {
              const meta = ROLE_META[role.name];
              const Icon = meta?.icon ?? Shield;
              const hasAll = role.permissions.includes("*");
              return (
                <Card key={role.id} className="overflow-hidden border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta?.bg ?? "bg-primary/10"}`}>
                          <Icon className={`h-5 w-5 ${meta?.color ?? "text-primary"}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-sm">{role.displayName}</CardTitle>
                            {role.isSystem && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 flex items-center gap-1 h-4">
                                <Lock className="h-2.5 w-2.5" />أساسي
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="text-[11px] mt-0.5">{role.description}</CardDescription>
                          {meta?.scope && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Eye className="h-3 w-3" />نطاق: {meta.scope}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="text-[10px]">
                          {hasAll ? "كامل ✦" : `${role.permissions.length} صلاحية`}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRoleDialog({ open: true, role })}>
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        {!role.isSystem && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteRole(role.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <PermissionMatrix permissions={role.permissions} readOnly />
                  </CardContent>
                </Card>
              );
            })}
        </TabsContent>

        {/* ══ TAB 3: VISIBILITY SCOPE ══ */}
        <TabsContent value="scope" className="mt-4 space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
            <Info className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">
              نطاق الرؤية يحدد أي البيانات يستطيع كل دور الوصول إليها داخل المنصة — بغض النظر عن الصلاحيات الفردية.
            </p>
          </div>
          {rolesLoading
            ? <Skeleton className="h-64 w-full rounded-xl" />
            : <VisibilityScopeGrid roles={roles} />}
        </TabsContent>

        {/* ══ TAB 4: INVITATIONS ══ */}
        <TabsContent value="invitations" className="mt-4">
          <Card className="border-border/50">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right">الدور</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">تاريخ الإرسال</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">تنتهي في</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitationsLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}
                        <TableCell />
                      </TableRow>
                    ))
                    : invitations.length === 0
                    ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          لا توجد دعوات مرسلة
                        </TableCell>
                      </TableRow>
                    )
                    : invitations.map(inv => {
                      const isExpired = new Date(inv.expiresAt) < new Date();
                      const statusMap: Record<string, { label: string; cls: string }> = {
                        pending:  { label: "معلقة",  cls: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
                        accepted: { label: "مقبولة", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
                        expired:  { label: "منتهية", cls: "bg-muted text-muted-foreground" },
                      };
                      const s = isExpired && inv.status === "pending" ? statusMap.expired : (statusMap[inv.status] ?? statusMap.pending);
                      return (
                        <TableRow key={inv.id} className="hover:bg-muted/20">
                          <TableCell className="font-medium text-sm">{inv.email}</TableCell>
                          <TableCell><RoleBadge role={inv.role} roles={roles} /></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${s.cls}`}>{s.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                            {format(new Date(inv.createdAt), "dd/MM/yyyy", { locale: arSA })}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                            {format(new Date(inv.expiresAt), "dd/MM/yyyy", { locale: arSA })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {inv.status === "pending" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resendInvitation(inv.id)} title="إعادة الإرسال">
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteInvitation(inv.id)}>
                                <X className="h-3 w-3" />
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

        {/* ══ TAB 5: AUDIT LOG ══ */}
        <TabsContent value="audit" className="mt-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                سجل التدقيق — آخر 100 عملية
              </CardTitle>
              <CardDescription className="text-xs">تتبع كامل لجميع التغييرات في الصلاحيات والمستخدمين</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {auditLoading
                ? <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                : auditLogs.length === 0
                ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    لا توجد سجلات بعد
                  </div>
                )
                : (
                  <div className="divide-y divide-border/50">
                    {auditLogs.map(log => {
                      const action = ACTION_LABELS[log.action] ?? { label: log.action, color: "text-foreground" };
                      const resource = RESOURCE_LABELS[log.resource] ?? log.resource;
                      return (
                        <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/10 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap text-sm">
                              <span className={`font-semibold ${action.color}`}>{action.label}</span>
                              <span className="text-muted-foreground">{resource}</span>
                              {log.details && <span className="text-foreground">— {log.details}</span>}
                            </div>
                            {log.userFullName && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">بواسطة: {log.userFullName}</div>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground shrink-0 mt-1">
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
