import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, AlertTriangle, Clock, Search, Send, CreditCard,
  Mail, Phone, Calendar, Loader2, CheckCircle2, ExternalLink,
  TrendingUp, Receipt, Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function fmtSAR(n: number) {
  const r = n / 100;
  return r.toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ر.س";
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}
function isOverdue(inv: any) {
  return inv.status === "overdue" || (inv.status === "sent" && inv.due_date && new Date(inv.due_date) < new Date());
}

const STATUS_STYLE: Record<string, { label: string; class: string }> = {
  overdue: { label: "متأخرة",   class: "bg-red-500/15 text-red-400 border-red-500/25" },
  sent:    { label: "مُرسَلة",  class: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  paid:    { label: "مدفوعة",   class: "bg-green-500/15 text-green-400 border-green-500/25" },
};

export default function Collections() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [payDialog, setPayDialog] = useState<any>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "bank_transfer", notes: "" });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["collections", statusFilter],
    queryFn: () => fetch(`${BASE}/api/finance/collections?status=${statusFilter}`).then(r => r.json()),
    staleTime: 30_000,
  });

  const invoices: any[] = data?.invoices ?? [];
  const summary = data?.summary ?? {};

  const filtered = invoices.filter((inv: any) =>
    !search ||
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
    inv.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.title?.toLowerCase().includes(search.toLowerCase())
  );

  const recordPayMut = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/finance/collections/${payDialog.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(payForm.amount) || undefined, paymentMethod: payForm.method, notes: payForm.notes }),
      }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast({ title: "خطأ", description: d.error, variant: "destructive" }); return; }
      toast({ title: "✅ تم تسجيل الدفعة بنجاح" });
      qc.invalidateQueries({ queryKey: ["collections"] });
      qc.invalidateQueries({ queryKey: ["finance-dashboard"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setPayDialog(null);
    },
  });

  const [reminderLoading, setReminderLoading] = useState<string | null>(null);
  const sendReminder = async (inv: any) => {
    setReminderLoading(inv.id);
    try {
      const r = await fetch(`${BASE}/api/finance/collections/${inv.id}/reminder`, { method: "POST" }).then(r => r.json());
      if (r.success) toast({ title: "✅ تم إرسال التذكير بنجاح" });
      else toast({ title: "تنبيه", description: r.reason ?? "لم يُرسَل التذكير", variant: "destructive" });
    } catch { toast({ title: "خطأ في إرسال التذكير", variant: "destructive" }); }
    finally { setReminderLoading(null); }
  };

  return (
    <div className="space-y-6" dir="rtl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-[#C9A84C]" />
          التحصيل
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">إدارة الفواتير المستحقة والمتأخرة</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">فواتير متأخرة</p>
                <p className="text-lg font-bold text-red-400">{summary.overdue_count ?? 0}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{fmtSAR(Number(summary.overdue_amount ?? 0))}</p>
          </CardContent>
        </Card>
        <Card className="bg-sidebar border-sidebar-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">فواتير قيد التحصيل</p>
                <p className="text-lg font-bold text-amber-400">{summary.pending_count ?? 0}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{fmtSAR(Number(summary.pending_amount ?? 0))}</p>
          </CardContent>
        </Card>
        <Card className="bg-sidebar border-sidebar-border col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#C9A84C]/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-[#C9A84C]" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">إجمالي قيد التحصيل</p>
                <p className="text-xl font-bold text-[#C9A84C]">
                  {fmtSAR(Number(summary.overdue_amount ?? 0) + Number(summary.pending_amount ?? 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-sidebar border-sidebar-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو رقم الفاتورة..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pr-9 bg-muted/30 border-none"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-muted/30 border-none">
                <Filter className="h-4 w-4 ml-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفواتير</SelectItem>
                <SelectItem value="overdue">المتأخرة فقط</SelectItem>
                <SelectItem value="pending">قيد التحصيل</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card className="bg-sidebar border-sidebar-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[#C9A84C]" />
            الفواتير ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3 opacity-60" />
              <p className="text-muted-foreground text-sm">لا توجد فواتير معلقة 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filtered.map((inv: any) => {
                const overdue = isOverdue(inv);
                const st = overdue ? STATUS_STYLE.overdue : STATUS_STYLE[inv.status] ?? STATUS_STYLE.sent;
                return (
                  <div key={inv.id} className={`p-4 hover:bg-muted/20 transition-colors ${overdue ? "bg-red-500/3" : ""}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      {/* Left info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="font-semibold text-sm text-foreground">{inv.invoice_number ?? inv.id}</span>
                          <Badge variant="outline" className={`text-[10px] ${st.class}`}>{st.label}</Badge>
                          {overdue && inv.due_date && (
                            <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                              <AlertTriangle className="h-3 w-3" />
                              متأخر {Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000)} يوم
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{inv.title}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          {inv.client_name && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />{inv.client_name}
                            </span>
                          )}
                          {inv.client_email && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />{inv.client_email}
                            </span>
                          )}
                          {inv.due_date && (
                            <span className={`text-xs flex items-center gap-1 ${overdue ? "text-red-400" : "text-muted-foreground"}`}>
                              <Calendar className="h-3 w-3" />
                              الاستحقاق: {fmtDate(inv.due_date)}
                            </span>
                          )}
                          {inv.case_title && (
                            <span className="text-xs text-muted-foreground">القضية: {inv.case_title}</span>
                          )}
                        </div>
                      </div>

                      {/* Amount + Actions */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className={`text-lg font-bold ${overdue ? "text-red-400" : "text-[#C9A84C]"}`}>
                          {fmtSAR(Number(inv.total ?? 0))}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {inv.stripe_payment_link_url && (
                            <a href={inv.stripe_payment_link_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10">
                                <ExternalLink className="h-3 w-3" />رابط دفع
                              </Button>
                            </a>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                            onClick={() => sendReminder(inv)}
                            disabled={reminderLoading === inv.id || !inv.client_email}
                          >
                            {reminderLoading === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            تذكير
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1 bg-[#C9A84C] hover:bg-[#b8943f] text-black font-semibold"
                            onClick={() => { setPayDialog(inv); setPayForm({ amount: String((Number(inv.total ?? 0)) / 100), method: "bank_transfer", notes: "" }); }}
                          >
                            <CreditCard className="h-3 w-3" />تسجيل دفعة
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={!!payDialog} onOpenChange={v => !v && setPayDialog(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#C9A84C]" />
              تسجيل دفعة
            </DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">رقم الفاتورة</span>
                  <span className="font-medium">{payDialog.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">العميل</span>
                  <span className="font-medium">{payDialog.client_name ?? "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المبلغ الكلي</span>
                  <span className="font-bold text-[#C9A84C]">{fmtSAR(Number(payDialog.total ?? 0))}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>المبلغ المحصَّل (ر.س)</Label>
                <Input
                  type="number"
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="bg-muted/30 border-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label>طريقة الدفع</Label>
                <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="bg-muted/30 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="cash">نقداً</SelectItem>
                    <SelectItem value="check">شيك</SelectItem>
                    <SelectItem value="card">بطاقة ائتمانية</SelectItem>
                    <SelectItem value="online">دفع إلكتروني</SelectItem>
                    <SelectItem value="other">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>ملاحظات (اختياري)</Label>
                <Input
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="أي معلومات إضافية..."
                  className="bg-muted/30 border-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayDialog(null)}>إلغاء</Button>
            <Button
              onClick={() => recordPayMut.mutate()}
              disabled={recordPayMut.isPending || !payForm.amount}
              className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold gap-2"
            >
              {recordPayMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد الدفعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
