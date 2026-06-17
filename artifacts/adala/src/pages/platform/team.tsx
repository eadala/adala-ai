/**
 * Team Management — إدارة الفريق والصلاحيات
 * RBAC: roles, permissions matrix, invitations, member management
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { Can } from "@/components/can";
import {
  Users, UserPlus, Shield, Crown, Briefcase, FileText,
  MoreHorizontal, Mail, Clock, CheckCircle2, XCircle,
  RefreshCw, Trash2, Edit2, ChevronRight, Key
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/* ── Role config ───────────────────────────────────────────────────────── */
const ROLE_CFG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  firm_owner:     { label: "مالك المكتب",   icon: Crown,     color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/30" },
  office_manager: { label: "مدير المكتب",   icon: Shield,    color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/30" },
  lawyer:         { label: "محامي",          icon: Briefcase, color: "text-purple-400",  bg: "bg-purple-500/10 border-purple-500/30" },
  trainee_lawyer: { label: "محامي متدرب",    icon: FileText,  color: "text-cyan-400",    bg: "bg-cyan-500/10 border-cyan-500/30" },
  accountant:     { label: "محاسب",          icon: FileText,  color: "text-green-400",   bg: "bg-green-500/10 border-green-500/30" },
  secretary:      { label: "سكرتير",         icon: Users,     color: "text-pink-400",    bg: "bg-pink-500/10 border-pink-500/30" },
  collaborator:   { label: "متعاون",         icon: Users,     color: "text-muted-foreground",   bg: "bg-muted/30 10 border-slate-500/30" },
  broker:         { label: "وسيط",           icon: Users,     color: "text-orange-400",  bg: "bg-orange-500/10 border-orange-500/30" },
};

/* ── Permission categories for matrix ─────────────────────────────────── */
const PERM_GROUPS = [
  { label: "القضايا",       perms: ["cases:view","cases:create","cases:edit","cases:assign","cases:delete","cases:close"] },
  { label: "العملاء",       perms: ["clients:view","clients:create","clients:edit","clients:delete"] },
  { label: "العقود",        perms: ["contracts:view","contracts:create","contracts:edit"] },
  { label: "الوثائق",       perms: ["documents:view","documents:upload","documents:edit","documents:delete"] },
  { label: "المالية",       perms: ["invoices:view","invoices:create","payments:view","reports:view","financial:view"] },
  { label: "الفريق",        perms: ["users:view","users:create","users:edit","roles:view","roles:create","roles:edit"] },
  { label: "الإعدادات",     perms: ["settings:view","settings:edit"] },
  { label: "الذكاء الاصطناعي", perms: ["ai:access"] },
  { label: "المراسلات",     perms: ["messages:view","messages:send"] },
];

const PERM_LABEL: Record<string, string> = {
  "cases:view": "عرض", "cases:create": "إنشاء", "cases:edit": "تعديل",
  "cases:assign": "تعيين", "cases:delete": "حذف", "cases:close": "إغلاق",
  "clients:view": "عرض", "clients:create": "إنشاء", "clients:edit": "تعديل", "clients:delete": "حذف",
  "contracts:view": "عرض", "contracts:create": "إنشاء", "contracts:edit": "تعديل",
  "documents:view": "عرض", "documents:upload": "رفع", "documents:edit": "تعديل", "documents:delete": "حذف",
  "invoices:view": "فواتير", "invoices:create": "إنشاء", "payments:view": "مدفوعات",
  "reports:view": "تقارير", "financial:view": "مالية",
  "users:view": "عرض", "users:create": "إضافة", "users:edit": "تعديل",
  "roles:view": "أدوار", "roles:create": "إنشاء", "roles:edit": "تعديل",
  "settings:view": "عرض", "settings:edit": "تعديل",
  "ai:access": "وصول كامل",
  "messages:view": "عرض", "messages:send": "إرسال",
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CFG[role] ?? { label: role, icon: Users, color: "text-muted-foreground", bg: "bg-muted border-border" };
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("text-xs gap-1 border", cfg.bg, cfg.color)}>
      <Icon className="h-2.5 w-2.5" />{cfg.label}
    </Badge>
  );
}

function MemberAvatar({ name }: { name: string }) {
  const initials = (name ?? "؟").split(" ").slice(0, 2).map(w => w[0]).join("");
  const colors = ["#6366F1","#0EA5E9","#8B5CF6","#10B981","#F59E0B","#EF4444","#EC4899","#2563EB"];
  const idx    = name?.charCodeAt(0) % colors.length || 0;
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
      style={{ background: colors[idx] }}>
      {initials}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function TeamPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { isOwner, isAdmin } = usePermissions();

  const [inviteOpen, setInviteOpen]   = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole]   = useState("lawyer");
  const [activeTab, setActiveTab]     = useState("members");

  /* ── Queries ── */
  const { data: members = [], isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["rbac-members"],
    queryFn: () => fetch(`${BASE}/api/rbac/members`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<any[]>({
    queryKey: ["rbac-roles"],
    queryFn: () => fetch(`${BASE}/api/rbac/roles`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const { data: invitations = [] } = useQuery<any[]>({
    queryKey: ["rbac-invitations"],
    queryFn: () => fetch(`${BASE}/api/rbac/invitations`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  /* ── Mutations ── */
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      fetch(`${BASE}/api/rbac/members/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rbac-members"] }); toast({ title: "تم تحديث الدور" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      fetch(`${BASE}/api/rbac/members/${userId}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rbac-members"] }); toast({ title: "تم إزالة العضو" }); },
    onError: () => toast({ title: "حدث خطأ، يرجى المحاولة مجدداً", variant: "destructive" }),
  });

  const sendInvite = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/rbac/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-invitations"] });
      setInviteOpen(false);
      setInviteEmail("");
      toast({ title: "تم إرسال الدعوة", description: `دعوة أُرسلت إلى ${inviteEmail}` });
    },
  });

  const cancelInvite = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/api/rbac/invitations/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rbac-invitations"] }); toast({ title: "تم إلغاء الدعوة" }); },
  });

  const resendInvite = useMutation({
    mutationFn: (id: string) =>
      fetch(`${BASE}/api/rbac/invitations/${id}/resend`, { method: "PATCH" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => toast({ title: "تم إعادة إرسال الدعوة" }),
  });

  /* ── Stats ── */
  const countByRole = (r: string) => members.filter((m: any) => m.role === r && m.status === "active").length;
  const activeMembers = members.filter((m: any) => m.status === "active");

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            إدارة الفريق والصلاحيات
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            تحكّم كامل في أعضاء المكتب · الأدوار · مصفوفة الصلاحيات
          </p>
        </div>
        <Can permission="users:create">
          <Button className="gap-2" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />دعوة عضو جديد
          </Button>
        </Can>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي الأعضاء", value: activeMembers.length, color: "#2563EB", icon: Users },
          { label: "ملّاك ومديرون",  value: countByRole("firm_owner") + countByRole("office_manager"), color: "#6366F1", icon: Crown },
          { label: "محامون",          value: countByRole("lawyer") + countByRole("trainee_lawyer"), color: "#0EA5E9", icon: Briefcase },
          { label: "دعوات معلقة",    value: invitations.filter((i: any) => i.status === "pending").length, color: "#F59E0B", icon: Mail },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${s.color}18`, border: `1px solid ${s.color}35` }}>
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xl font-black">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9">
          <TabsTrigger value="members" className="text-xs gap-1.5">
            <Users className="h-3.5 w-3.5" />الأعضاء ({activeMembers.length})
          </TabsTrigger>
          <TabsTrigger value="matrix" className="text-xs gap-1.5">
            <Key className="h-3.5 w-3.5" />مصفوفة الصلاحيات
          </TabsTrigger>
          <TabsTrigger value="roles" className="text-xs gap-1.5">
            <Shield className="h-3.5 w-3.5" />الأدوار ({roles.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="text-xs gap-1.5">
            <Mail className="h-3.5 w-3.5" />الدعوات
            {invitations.filter((i: any) => i.status === "pending").length > 0 && (
              <span className="bg-amber-500 text-black text-[9px] px-1 rounded-full font-bold">
                {invitations.filter((i: any) => i.status === "pending").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Members ── */}
        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-5 border-b">
              <CardTitle className="text-sm">أعضاء المكتب</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {membersLoading ? (
                <div className="p-4 space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
              ) : activeMembers.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">لا يوجد أعضاء بعد</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {activeMembers.map((member: any) => (
                    <div key={member.user_id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
                      <MemberAvatar name={member.full_name ?? member.email ?? "؟"} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{member.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email ?? "—"}</p>
                      </div>
                      <RoleBadge role={member.role} />
                      <p className="text-xs text-muted-foreground/60 hidden md:block shrink-0">
                        انضم {member.joined_at ? new Date(member.joined_at).toLocaleDateString("ar-SA") : "—"}
                      </p>

                      <Can any={["users:edit","roles:edit"]}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <p className="text-[10px] text-muted-foreground px-2 py-1">تغيير الدور</p>
                            {Object.entries(ROLE_CFG).map(([key, cfg]) => (
                              <DropdownMenuItem key={key}
                                onClick={() => changeRole.mutate({ userId: member.user_id, role: key })}
                                className={cn("gap-2 text-xs", member.role === key && "bg-muted font-semibold")}>
                                <cfg.icon className={cn("h-3.5 w-3.5", cfg.color)} />
                                {cfg.label}
                                {member.role === key && <CheckCircle2 className="h-3 w-3 text-green-400 mr-auto" />}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive gap-2 text-xs"
                              onClick={() => {
                                if (confirm(`إزالة ${member.full_name ?? member.email} من المكتب؟`))
                                  removeMember.mutate(member.user_id);
                              }}>
                              <Trash2 className="h-3.5 w-3.5" />إزالة من المكتب
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Can>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Permissions Matrix ── */}
        <TabsContent value="matrix" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-5 border-b">
              <CardTitle className="text-sm">مصفوفة الصلاحيات — نظرة عامة</CardTitle>
              <CardDescription className="text-xs">✅ مسموح · ❌ غير مسموح · ⭐ مالك المكتب لديه جميع الصلاحيات</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              {rolesLoading ? (
                <Skeleton className="h-64 m-4" />
              ) : (
                <table className="w-full text-xs border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-right p-3 font-semibold border-b border-border/40 w-32 sticky right-0 bg-muted/50">الموديول</th>
                      <th className="p-2 text-center border-b border-border/40 w-24">الصلاحية</th>
                      {roles.filter(r => ["firm_owner","office_manager","lawyer","trainee_lawyer","accountant","secretary"].includes(r.name)).map((role: any) => (
                        <th key={role.id} className="p-2 text-center border-b border-border/40">
                          <div className="flex flex-col items-center gap-1">
                            {ROLE_CFG[role.name] && (() => {
                              const cfg = ROLE_CFG[role.name];
                              const Icon = cfg.icon;
                              return <Icon className={cn("h-3.5 w-3.5", cfg.color)} />;
                            })()}
                            <span className="text-[10px]">{role.displayName}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERM_GROUPS.map((group, gi) => (
                      group.perms.map((perm, pi) => {
                        const isFirst = pi === 0;
                        return (
                          <tr key={perm} className={cn("hover:bg-muted/10", gi % 2 === 0 ? "bg-transparent" : "bg-muted/5")}>
                            {isFirst ? (
                              <td className="p-3 font-bold border-b border-border/20 sticky right-0 bg-card text-xs"
                                rowSpan={group.perms.length}
                                style={{ verticalAlign: "top", paddingTop: "12px" }}>
                                {group.label}
                              </td>
                            ) : null}
                            <td className="p-2 text-center text-muted-foreground border-b border-border/10">{PERM_LABEL[perm] ?? perm}</td>
                            {roles.filter(r => ["firm_owner","office_manager","lawyer","trainee_lawyer","accountant","secretary"].includes(r.name)).map((role: any) => {
                              const perms: string[] = role.permissions ?? [];
                              const allowed = perms.includes("*") || perms.includes(perm);
                              return (
                                <td key={role.id} className="p-2 text-center border-b border-border/10">
                                  {allowed
                                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                                    : <XCircle className="h-3.5 w-3.5 text-red-400/40 mx-auto" />}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Roles ── */}
        <TabsContent value="roles" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {rolesLoading ? (
              Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-40" />)
            ) : roles.map((role: any) => {
              const cfg = ROLE_CFG[role.name];
              const Icon = cfg?.icon ?? Shield;
              const perms: string[] = role.permissions ?? [];
              const isWildcard = perms.includes("*");
              return (
                <Card key={role.id} className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                          style={{ background: `${cfg?.color?.replace("text-","").replace("-400","") || "#2563EB"}18` }}>
                          <Icon className={cn("h-3.5 w-3.5", cfg?.color ?? "text-muted-foreground")} />
                        </div>
                        {role.displayName}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        {role.isSystem && <Badge variant="outline" className="text-[9px] px-1">أساسي</Badge>}
                        <Badge variant="outline" className={cn("text-[9px] px-1.5",
                          isWildcard ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "")}>
                          {isWildcard ? "جميع الصلاحيات ⭐" : `${perms.length} صلاحية`}
                        </Badge>
                      </div>
                    </div>
                    {role.description && <CardDescription className="text-xs mt-1">{role.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    {!isWildcard && (
                      <div className="flex flex-wrap gap-1">
                        {perms.slice(0, 8).map((p: string) => (
                          <span key={p} className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">{p}</span>
                        ))}
                        {perms.length > 8 && (
                          <span className="text-[10px] text-muted-foreground">+{perms.length - 8} أخرى</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Invitations ── */}
        <TabsContent value="invitations" className="mt-4">
          <Card>
            <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm">الدعوات المرسلة</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                onClick={() => qc.invalidateQueries({ queryKey: ["rbac-invitations"] })}>
                <RefreshCw className="h-3 w-3" />تحديث
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {invitations.length === 0 ? (
                <div className="py-10 text-center">
                  <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">لا توجد دعوات مرسلة</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {invitations.map((inv: any) => (
                    <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          دور: {ROLE_CFG[inv.role]?.label ?? inv.role}
                          {" · "}
                          تنتهي {new Date(inv.expiresAt).toLocaleDateString("ar-SA")}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] border",
                        inv.status === "pending" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                        inv.status === "accepted" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" :
                        "bg-red-500/10 text-red-400 border-red-500/30")}>
                        {inv.status === "pending" ? "معلقة" : inv.status === "accepted" ? "مُقبلة" : "منتهية"}
                      </Badge>
                      <div className="flex gap-1">
                        {inv.status === "pending" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => resendInvite.mutate(inv.id)}>
                            إعادة إرسال
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm("إلغاء هذه الدعوة؟")) cancelInvite.mutate(inv.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Invite Dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4 text-primary" />دعوة عضو جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">البريد الإلكتروني</Label>
              <Input type="email" placeholder="name@example.com" value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">الدور</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="h-9 text-sm" dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {Object.entries(ROLE_CFG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <SelectItem key={key} value={key} className="text-sm">
                        <div className="flex items-center gap-2">
                          <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                          {cfg.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground border border-border/40">
              <p className="font-medium mb-1">{ROLE_CFG[inviteRole]?.label} — الصلاحيات:</p>
              {(() => {
                const role = roles.find((r: any) => r.name === inviteRole);
                if (!role) return null;
                const perms: string[] = role.permissions ?? [];
                if (perms.includes("*")) return <p className="text-amber-400">جميع الصلاحيات (Full Access)</p>;
                return <p>{perms.slice(0, 6).join(" · ")}{perms.length > 6 ? ` +${perms.length-6} أخرى` : ""}</p>;
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInviteOpen(false)}>إلغاء</Button>
            <Button size="sm" className="gap-1.5"
              disabled={!inviteEmail.trim() || sendInvite.isPending}
              onClick={() => sendInvite.mutate()}>
              <Mail className="h-3.5 w-3.5" />
              {sendInvite.isPending ? "جارٍ الإرسال..." : "إرسال الدعوة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
