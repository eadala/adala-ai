import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Code2, Plus, Trash2, Edit2, RefreshCw, Loader2, User, Mail,
  Check, X, ShieldCheck, AlertCircle, ToggleLeft, ToggleRight,
  Database, Globe, Zap, Eye, Terminal, Server, Brain,
  BookOpen, Lock, Unlock, FileText, Settings, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DEV_API } from "../shared/api";

/* ── Permission definitions ──────────────────────── */
const PERMISSIONS = [
  { key: "system_info",    icon: Server,    label: "معلومات النظام",         desc: "عرض حالة السيرفر والموارد",         group: "النظام"    },
  { key: "db_stats",       icon: Database,  label: "إحصائيات قاعدة البيانات", desc: "استعراض الجداول والإحصائيات",      group: "النظام"    },
  { key: "view_logs",      icon: FileText,  label: "سجلات النظام",           desc: "عرض سجلات الأحداث والأخطاء",        group: "النظام"    },
  { key: "manage_tokens",  icon: Lock,      label: "إدارة توكنات API",       desc: "إنشاء وحذف مفاتيح الوصول",          group: "API"       },
  { key: "api_full_access",icon: Globe,     label: "API — وصول كامل",        desc: "استدعاء جميع مسارات API",            group: "API"       },
  { key: "ghost_access",   icon: Eye,       label: "الوصول الخفي",           desc: "انتحال هوية المكاتب للمراجعة",      group: "أمان"      },
  { key: "manage_offices", icon: Settings,  label: "إدارة المكاتب",          desc: "عرض وتعديل بيانات المكاتب",         group: "إدارة"     },
  { key: "ai_access",      icon: Brain,     label: "الذكاء الاصطناعي",       desc: "الوصول لبوابة AI والتكوين",          group: "إدارة"     },
  { key: "deploy_access",  icon: Zap,       label: "النشر والبنية التحتية",  desc: "إعادة التشغيل وإدارة الخدمات",      group: "إدارة"     },
  { key: "view_billing",   icon: BookOpen,  label: "الفوترة والباقات",       desc: "استعراض الفواتير والاشتراكات",       group: "المالية"   },
  { key: "env_info",       icon: Terminal,  label: "متغيرات البيئة",         desc: "عرض الإعدادات البيئية (آمن)",        group: "النظام"    },
  { key: "engineering",    icon: ShieldCheck, label: "مركز الهندسة",         desc: "سجلات الهندسة وأدوات التطوير",       group: "إدارة"     },
];

const GROUPS = ["النظام", "API", "أمان", "إدارة", "المالية"];
const GROUP_COLORS: Record<string, string> = {
  "النظام": "bg-slate-100 text-slate-700",
  "API":     "bg-blue-100 text-blue-700",
  "أمان":    "bg-red-100 text-red-700",
  "إدارة":   "bg-purple-100 text-purple-700",
  "المالية": "bg-green-100 text-green-700",
};

function permCount(perms: Record<string, boolean>) {
  return Object.values(perms).filter(Boolean).length;
}

function timeSince(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts); const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "اليوم"; if (days === 1) return "أمس";
  if (days < 30) return `منذ ${days} يوم`;
  return d.toLocaleDateString("ar-SA");
}

const EMPTY_PERMS = Object.fromEntries(PERMISSIONS.map(p => [p.key, false]));

/* ── Main component ──────────────────────────────── */
export function DeveloperAccountsTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected]     = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  /* Form state */
  const [form, setForm] = useState({ email: "", name: "", notes: "" });
  const [perms, setPerms] = useState<Record<string, boolean>>(EMPTY_PERMS);

  const { data: accounts = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["dev", "dev-accounts"],
    queryFn: () => DEV_API("/dev-accounts"),
    retry: false,
  });

  function openAdd() {
    setForm({ email: "", name: "", notes: "" });
    setPerms(EMPTY_PERMS);
    setSelected(null);
    setDialogMode("add");
  }

  function openEdit(acc: any) {
    setForm({ email: acc.email, name: acc.name ?? "", notes: acc.notes ?? "" });
    setPerms({ ...EMPTY_PERMS, ...(acc.permissions ?? {}) });
    setSelected(acc);
    setDialogMode("edit");
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (dialogMode === "add") {
        const r = await fetch("/api/developer/dev-accounts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, permissions: perms }),
        });
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
      } else {
        const r = await fetch(`/api/developer/dev-accounts/${selected.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name, notes: form.notes, permissions: perms }),
        });
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
      }
    },
    onSuccess: () => {
      toast({ title: dialogMode === "add" ? "✅ تم الإنشاء" : "✅ تم التحديث" });
      setDialogMode(null);
      qc.invalidateQueries({ queryKey: ["dev", "dev-accounts"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      fetch(`/api/developer/dev-accounts/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dev", "dev-accounts"] }),
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/developer/dev-accounts/${id}`, { method: "DELETE" })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      toast({ title: "✅ تم الحذف" });
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["dev", "dev-accounts"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const allOn  = () => setPerms(Object.fromEntries(PERMISSIONS.map(p => [p.key, true])));
  const allOff = () => setPerms(EMPTY_PERMS);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">حسابات المطورين</h2>
            <p className="text-sm text-muted-foreground">
              حسابات بصلاحيات محددة وقابلة للتعديل في أي وقت
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 me-1.5 ${isLoading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button size="sm" onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 me-1.5" />
            إضافة مطور
          </Button>
        </div>
      </div>

      {/* Permission groups legend */}
      <div className="flex flex-wrap gap-2">
        {GROUPS.map(g => (
          <span key={g} className={`text-xs px-2.5 py-1 rounded-full font-medium ${GROUP_COLORS[g]}`}>{g}</span>
        ))}
        <span className="text-xs text-muted-foreground self-center me-1">— مجموعات الصلاحيات</span>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-600" />
            المطورون المسجَّلون
            <Badge variant="secondary" className="ms-auto">{accounts.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Code2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا يوجد مطورون مسجَّلون بعد</p>
              <Button size="sm" className="mt-4" onClick={openAdd}>
                <Plus className="w-4 h-4 me-1.5" />
                إضافة أول مطور
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المطور</TableHead>
                  <TableHead className="text-right">البريد الإلكتروني</TableHead>
                  <TableHead className="text-right">الصلاحيات</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">تاريخ الإضافة</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc: any) => {
                  const count = permCount(acc.permissions ?? {});
                  return (
                    <TableRow key={acc.id} className={!acc.is_active ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{acc.name || "—"}</p>
                            {acc.notes && (
                              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{acc.notes}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground flex items-center gap-1" dir="ltr">
                          <Mail className="w-3 h-3 shrink-0" />
                          {acc.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${(count / PERMISSIONS.length) * 100}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {count} / {PERMISSIONS.length}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          className="flex items-center gap-1.5 text-xs"
                          onClick={() => toggleActive.mutate({ id: acc.id, is_active: !acc.is_active })}
                        >
                          {acc.is_active ? (
                            <><ToggleRight className="w-5 h-5 text-green-500" /><span className="text-green-600 font-medium">نشط</span></>
                          ) : (
                            <><ToggleLeft className="w-5 h-5 text-muted-foreground" /><span className="text-muted-foreground">معطَّل</span></>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{timeSince(acc.created_at)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(acc)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setConfirmDel(acc.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit dialog */}
      <AdaptiveDialog open={!!dialogMode} onOpenChange={() => setDialogMode(null)}>
        <AdaptiveDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-blue-600" />
              {dialogMode === "add" ? "إضافة حساب مطور جديد" : `تعديل: ${selected?.name || selected?.email}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              {dialogMode === "add" && (
                <div className="col-span-2">
                  <Label className="mb-1.5 block text-sm">البريد الإلكتروني *</Label>
                  <Input dir="ltr" type="email" placeholder="dev@example.com"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  <p className="text-xs text-muted-foreground mt-1">
                    إذا كان المستخدم مسجَّلاً، سيُحدَّث دوره تلقائياً في Clerk
                  </p>
                </div>
              )}
              <div>
                <Label className="mb-1.5 block text-sm">الاسم</Label>
                <Input placeholder="اسم المطور"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">ملاحظات</Label>
                <Input placeholder="مثال: مطور frontend"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* Permissions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">الصلاحيات</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={allOn}>
                    <Check className="w-3 h-3 me-1" />تفعيل الكل
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={allOff}>
                    <X className="w-3 h-3 me-1" />إيقاف الكل
                  </Button>
                </div>
              </div>

              {GROUPS.map(group => {
                const groupPerms = PERMISSIONS.filter(p => p.group === group);
                return (
                  <div key={group} className="mb-4">
                    <div className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium mb-2 ${GROUP_COLORS[group]}`}>
                      {group}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groupPerms.map(p => {
                        const Icon = p.icon;
                        const active = !!perms[p.key];
                        return (
                          <div key={p.key}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              active
                                ? "bg-blue-50 border-blue-200"
                                : "bg-muted/30 border-border hover:bg-muted/60"
                            }`}
                            onClick={() => setPerms(prev => ({ ...prev, [p.key]: !prev[p.key] }))}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              active ? "bg-blue-100" : "bg-background"
                            }`}>
                              <Icon className={`w-4 h-4 ${active ? "text-blue-600" : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${active ? "text-blue-700" : "text-foreground"}`}>
                                {p.label}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">{p.desc}</p>
                            </div>
                            <Switch
                              checked={active}
                              onCheckedChange={v => setPerms(prev => ({ ...prev, [p.key]: v }))}
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="mt-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
                <span>الصلاحيات المُفعَّلة: <strong className="text-foreground">{permCount(perms)}</strong> من أصل {PERMISSIONS.length}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)}>إلغاء</Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || (dialogMode === "add" && !form.email)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="me-1.5">{dialogMode === "add" ? "إنشاء الحساب" : "حفظ التغييرات"}</span>
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* Confirm delete */}
      <AdaptiveDialog open={!!confirmDel} onOpenChange={() => setConfirmDel(null)}>
        <AdaptiveDialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              حذف حساب المطور
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            سيُحذف الحساب نهائياً وتُسحب صلاحياته من Clerk تلقائياً.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(null)}>إلغاء</Button>
            <Button variant="destructive"
              onClick={() => confirmDel && deleteMut.mutate(confirmDel)}
              disabled={deleteMut.isPending}>
              {deleteMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حذف نهائي"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}
