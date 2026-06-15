import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Landmark, Plus, Pencil, Trash2, Loader2, Star } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function fmt(n: any) { return parseFloat(String(n || 0)).toLocaleString("ar-SA", { maximumFractionDigits: 2 }) + " ر.س"; }
const BANKS = ["البنك الأهلي السعودي","بنك الراجحي","بنك ريادة","بنك الإمارات دبي الوطني","البنك السعودي الفرنسي","مصرف الإنماء","بنك البلاد","بنك الجزيرة","بنك الرياض","بنك سامبا","بنك HSBC السعودية","بنك آخر"];

interface BankAccount { id:string; bankName:string; accountName:string; accountNumber:string; iban:string|null; currency:string; currentBalance:string; isDefault:boolean; notes:string|null; }
const empty=():Partial<BankAccount>=>{return{bankName:"البنك الأهلي السعودي",accountName:"",accountNumber:"",iban:"",currency:"SAR",currentBalance:"0",isDefault:false,notes:""}};

export default function BankAccounts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount|null>(null);
  const [form, setForm] = useState<Partial<BankAccount>>(empty());
  const [delId, setDelId] = useState<string|null>(null);

  const { data: rows = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ["accounting-bank-accounts"],
    queryFn: () => fetch(`${BASE}/api/accounting/bank-accounts`).then(r => r.json()),
  });

  const saveMut = useMutation({
    mutationFn: (data: any) => editing
      ? fetch(`${BASE}/api/accounting/bank-accounts/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json())
      : fetch(`${BASE}/api/accounting/bank-accounts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-bank-accounts"] }); toast.success(editing ? "تم التعديل" : "تم الإضافة"); close_(); },
    onError: () => toast.error("خطأ في الحفظ"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/api/accounting/bank-accounts/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-bank-accounts"] }); toast.success("تم الحذف"); setDelId(null); },
  });

  function close_() { setOpen(false); setEditing(null); setForm(empty()); }
  function openEdit(r: BankAccount) { setEditing(r); setForm({ ...r }); setOpen(true); }
  function openCreate() { setEditing(null); setForm(empty()); setOpen(true); }
  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  const totalBalance = rows.reduce((s, r) => s + parseFloat(String(r.currentBalance || 0)), 0);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><Landmark className="h-5 w-5 text-blue-400" /></div>
            <div><h1 className="text-xl font-bold text-foreground">الحسابات البنكية</h1><p className="text-xs text-muted-foreground">إدارة الحسابات والأرصدة</p></div>
          </div>
          <Button onClick={openCreate} className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold gap-1.5"><Plus className="h-4 w-4" />إضافة حساب</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">إجمالي الأرصدة</p><p className="text-xl font-bold text-primary">{fmt(totalBalance)}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">عدد الحسابات</p><p className="text-2xl font-bold text-foreground">{rows.length}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">الحساب الافتراضي</p><p className="text-sm font-medium text-foreground truncate">{rows.find(r => r.isDefault)?.bankName ?? "غير محدد"}</p></CardContent></Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin ml-2" />جارٍ التحميل...</div>
          ) : rows.length === 0 ? (
            <div className="col-span-full flex flex-col items-center py-14 text-muted-foreground"><Landmark className="h-10 w-10 mb-2 opacity-20" /><p className="text-sm">لا توجد حسابات</p><Button size="sm" variant="link" className="text-primary mt-1" onClick={openCreate}>إضافة أول حساب</Button></div>
          ) : rows.map(r => (
            <Card key={r.id} className={`bg-card border-border hover:border-primary/30 transition-colors ${r.isDefault ? "border-primary/40" : ""}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground truncate">{r.bankName}</p>
                      {r.isDefault && <Star className="h-3 w-3 text-primary fill-[#C9A84C] shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{r.accountName}</p>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px] shrink-0">{r.currency}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">الرقم: {r.accountNumber}</p>
                  {r.iban && <p className="text-xs text-muted-foreground mt-0.5 truncate">IBAN: {r.iban}</p>}
                </div>
                <div className="pt-1 border-t border-border flex items-center justify-between">
                  <div><p className="text-xs text-muted-foreground">الرصيد</p><p className="text-lg font-bold text-primary">{fmt(r.currentBalance)}</p></div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-400" onClick={() => setDelId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={open} onOpenChange={v => !v && close_()}>
          <DialogContent className="bg-card border-border text-foreground max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>{editing ? "تعديل الحساب" : "إضافة حساب بنكي"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label className="text-xs text-muted-foreground">اسم البنك *</Label>
                <select value={form.bankName ?? ""} onChange={e => set("bankName", e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-md px-3 py-2 text-sm text-foreground mt-1">
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">اسم الحساب *</Label><Input value={form.accountName ?? ""} onChange={e => set("accountName", e.target.value)} className="bg-background/50 border-border mt-1 text-sm" /></div>
                <div><Label className="text-xs text-muted-foreground">رقم الحساب *</Label><Input value={form.accountNumber ?? ""} onChange={e => set("accountNumber", e.target.value)} className="bg-background/50 border-border mt-1 text-sm" dir="ltr" /></div>
              </div>
              <div><Label className="text-xs text-muted-foreground">IBAN (اختياري)</Label><Input value={form.iban ?? ""} onChange={e => set("iban", e.target.value)} className="bg-background/50 border-border mt-1 text-sm" dir="ltr" placeholder="SA..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">الرصيد الحالي (ر.س)</Label><Input type="number" value={form.currentBalance ?? ""} onChange={e => set("currentBalance", e.target.value)} className="bg-background/50 border-border mt-1 text-sm" /></div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3 mt-1">
                  <Label className="text-xs text-muted-foreground">الحساب الافتراضي</Label>
                  <Switch checked={form.isDefault ?? false} onCheckedChange={v => set("isDefault", v)} />
                </div>
              </div>
              <div><Label className="text-xs text-muted-foreground">ملاحظات</Label><Textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} className="bg-background/50 border-border mt-1 text-sm resize-none" rows={2} /></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={close_}>إلغاء</Button>
              <Button className="bg-[#C9A84C] hover:bg-[#b8943f] text-black font-bold" disabled={!form.bankName || !form.accountName || !form.accountNumber || saveMut.isPending} onClick={() => saveMut.mutate(form)}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!delId} onOpenChange={v => !v && setDelId(null)}>
          <DialogContent className="bg-card border-border text-foreground max-w-sm" dir="rtl">
            <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا الحساب؟</p>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setDelId(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={() => delMut.mutate(delId!)} disabled={delMut.isPending}>{delMut.isPending && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}حذف</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
