import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Crown, Plus, Trash2, ShieldCheck, Mail, Loader2, RefreshCw,
  AlertCircle, CheckCircle, User, Calendar, Clock, Lock, Infinity,
  Shield, Star, Key, Database, Globe, Zap, Settings, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { DEV_API } from "../shared/api";

const FULL_PERMISSIONS = [
  { icon: Shield,   label: "إدارة المكاتب والمستخدمين" },
  { icon: Database, label: "الوصول الكامل لقاعدة البيانات" },
  { icon: Globe,    label: "الإعدادات والاستضافة" },
  { icon: Zap,      label: "مفاتيح AI وأرصدة المنصة" },
  { icon: Key,      label: "إدارة الباقات والفواتير" },
  { icon: Eye,      label: "الوصول الخفي والانتحال" },
  { icon: Settings, label: "مركز الهندسة والنشر" },
  { icon: Star,     label: "جميع التبويبات والتقارير" },
];

function timeSince(ts: number | string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  if (days < 30) return `منذ ${days} يوم`;
  return d.toLocaleDateString("ar-SA");
}

export function PlatformOwnersTab({ toast }: { toast: any }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail]     = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data: admins = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["dev", "platform-admins"],
    queryFn: () => DEV_API("/platform-admins"),
    retry: false,
  });

  const addMut = useMutation({
    mutationFn: (email: string) =>
      fetch(`/api/developer/platform-admins`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      toast({ title: "✅ تمت الإضافة", description: "تم ترقية المستخدم إلى مالك المنصة" });
      setAddOpen(false); setEmail("");
      qc.invalidateQueries({ queryKey: ["dev", "platform-admins"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/developer/platform-admins/${userId}`, { method: "DELETE" })
        .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
    onSuccess: () => {
      toast({ title: "✅ تم الإزالة", description: "تم سحب صلاحية مالك المنصة" });
      setConfirmId(null);
      qc.invalidateQueries({ queryKey: ["dev", "platform-admins"] });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
            <Crown className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">مالكو المنصة</h2>
            <p className="text-sm text-muted-foreground">
              صلاحيات مفتوحة وكاملة على كل مكونات النظام
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 me-1.5 ${isLoading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}
            className="bg-yellow-500 hover:bg-yellow-600 text-white">
            <Plus className="w-4 h-4 me-1.5" />
            إضافة مالك
          </Button>
        </div>
      </div>

      {/* Full access banner */}
      <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Infinity className="w-5 h-5 text-yellow-600" />
            الصلاحيات — مفتوحة بالكامل بلا قيود
          </CardTitle>
          <CardDescription>
            مالك المنصة يملك وصولاً كاملاً لكل وظائف لوحة التحكم
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {FULL_PERMISSIONS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-yellow-100 text-sm">
                  <Icon className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                  <span className="text-xs text-muted-foreground">{p.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Admins table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-yellow-600" />
            قائمة المالكين الحاليين
            <Badge variant="secondary" className="ms-auto">{admins.length} مالك</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Crown className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">لا يوجد مالكون مُسجَّلون</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">المالك</TableHead>
                  <TableHead className="text-right">البريد الإلكتروني</TableHead>
                  <TableHead className="text-right">المصدر</TableHead>
                  <TableHead className="text-right">آخر دخول</TableHead>
                  <TableHead className="text-right">الصلاحيات</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin: any) => (
                  <TableRow key={admin.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {admin.imageUrl ? (
                          <img src={admin.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-yellow-600" />
                          </div>
                        )}
                        <span className="font-medium text-sm">{admin.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {admin.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      {admin.fromEnv ? (
                        <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                          <Lock className="w-3 h-3 me-1" />
                          متغير البيئة
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-yellow-200 text-yellow-700 bg-yellow-50">
                          <Crown className="w-3 h-3 me-1" />
                          مُعيَّن يدوياً
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeSince(admin.lastSignInAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
                        <Infinity className="w-3 h-3 me-1" />
                        كاملة — بلا قيود
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!admin.fromEnv && (
                        <Button
                          size="sm" variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setConfirmId(admin.id)}
                          disabled={removeMut.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      {admin.fromEnv && (
                        <span className="text-xs text-muted-foreground px-2">محمي</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <AdaptiveDialog open={addOpen} onOpenChange={setAddOpen}>
        <AdaptiveDialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              إضافة مالك جديد للمنصة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>يجب أن يكون المستخدم مسجَّلاً في المنصة أولاً. سيحصل على صلاحيات كاملة وغير محدودة.</span>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">البريد الإلكتروني</label>
              <Input
                dir="ltr"
                type="email"
                placeholder="owner@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && email && addMut.mutate(email)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => addMut.mutate(email)}
              disabled={!email || addMut.isPending}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {addMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4" />}
              <span className="me-1.5">ترقية إلى مالك</span>
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>

      {/* Confirm remove dialog */}
      <AdaptiveDialog open={!!confirmId} onOpenChange={() => setConfirmId(null)}>
        <AdaptiveDialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              إزالة مالك المنصة
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            هل أنت متأكد من إزالة هذا المستخدم من قائمة مالكي المنصة؟ سيفقد جميع صلاحياته فوراً.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmId(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={() => confirmId && removeMut.mutate(confirmId)}
              disabled={removeMut.isPending}
            >
              {removeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "نعم، إزالة"}
            </Button>
          </DialogFooter>
        </AdaptiveDialogContent>
      </AdaptiveDialog>
    </div>
  );
}
