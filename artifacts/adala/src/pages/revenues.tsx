import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TrendingUp, Plus, Pencil, Trash2, Search, Loader2, DollarSign, Calendar, Filter } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const CATEGORIES = ["أتعاب محاماة","استشارات قانونية","تحكيم ووساطة","عقود وتوثيق","خدمات بحثية","إيرادات متنوعة"];
const METHODS = [{ v: "cash", l: "نقدي" },{ v: "bank", l: "بنكي" },{ v: "check", l: "شيك" },{ v: "transfer", l: "تحويل إلكتروني" }];
const today = () => new Date().toISOString().split("T")[0];

function fmt(n: any) { return parseFloat(String(n||0)).toLocaleString("ar-SA",{maximumFractionDigits:0}) + " ر.س"; }

interface Revenue { id:string; title:string; category:string; amount:string; paymentMethod:string; date:string; notes:string|null; }

const empty = ():Partial<Revenue> => ({ title:"", category:"أتعاب محاماة", amount:"", paymentMethod:"bank", date:today(), notes:"" });

export default function Revenues() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Revenue|null>(null);
  const [form, setForm] = useState<Partial<Revenue>>(empty());
  const [delId, setDelId] = useState<string|null>(null);

  const { data: rows = [], isLoading } = useQuery<Revenue[]>({
    queryKey: ["accounting-revenues"],
    queryFn: () => fetch(`${BASE}/api/accounting/revenues`).then(r=>r.json()),
  });

  const saveMut = useMutation({
    mutationFn: (data:any) => editing
      ? fetch(`${BASE}/api/accounting/revenues/${editing.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(r=>r.json())
      : fetch(`${BASE}/api/accounting/revenues`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({queryKey:["accounting-revenues"]}); qc.invalidateQueries({queryKey:["accounting-summary"]}); toast.success(editing?"تم تعديل الإيراد":"تم إضافة الإيراد"); closeDialog(); },
    onError: () => toast.error("خطأ في الحفظ"),
  });

  const delMut = useMutation({
    mutationFn: (id:string) => fetch(`${BASE}/api/accounting/revenues/${id}`,{method:"DELETE"}).then(r=>r.json()),
    onSuccess: () => { qc.invalidateQueries({queryKey:["accounting-revenues"]}); qc.invalidateQueries({queryKey:["accounting-summary"]}); toast.success("تم الحذف"); setDelId(null); },
  });

  function closeDialog() { setOpen(false); setEditing(null); setForm(empty()); }
  function openEdit(r:Revenue) { setEditing(r); setForm({...r}); setOpen(true); }
  function openCreate() { setEditing(null); setForm(empty()); setOpen(true); }
  function set(k:string,v:string) { setForm(f=>({...f,[k]:v})); }

  const filtered = rows
    .filter(r => catFilter==="all" || r.category===catFilter)
    .filter(r => !search || r.title.includes(search) || r.category.includes(search));

  const total = filtered.reduce((s,r) => s+parseFloat(String(r.amount||0)), 0);
  const thisMonth = rows.filter(r => r.date?.startsWith(today().slice(0,7))).reduce((s,r)=>s+parseFloat(String(r.amount||0)),0);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">الإيرادات</h1>
              <p className="text-xs text-muted-foreground">إدارة الدخل والإيرادات</p>
            </div>
          </div>
          <Button onClick={openCreate} className="bg-primary hover:bg-[#b8943f] text-black font-bold gap-1.5">
            <Plus className="h-4 w-4" /> إضافة إيراد
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
              <p className="text-xl font-bold text-green-400">{fmt(rows.reduce((s,r)=>s+parseFloat(String(r.amount||0)),0))}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">إيرادات هذا الشهر</p>
              <p className="text-xl font-bold text-primary">{fmt(thisMonth)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">عدد السجلات</p>
              <p className="text-2xl font-bold text-foreground">{rows.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)}
              className="pr-9 bg-card border-border text-foreground h-9 text-sm" />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-44 h-9 bg-card border-border text-sm">
              <SelectValue placeholder="الفئة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الفئات</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Total indicator */}
        {filtered.length > 0 && (
          <p className="text-sm text-primary">المجموع: {fmt(total)} ({filtered.length} سجل)</p>
        )}

        {/* Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin ml-2" />جارٍ التحميل...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-14 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">لا توجد إيرادات</p>
                <Button size="sm" variant="link" className="text-primary mt-1" onClick={openCreate}>إضافة أول إيراد</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-right">
                      <th className="px-4 py-3 font-medium">العنوان</th>
                      <th className="px-4 py-3 font-medium">الفئة</th>
                      <th className="px-4 py-3 font-medium">المبلغ</th>
                      <th className="px-4 py-3 font-medium">طريقة الدفع</th>
                      <th className="px-4 py-3 font-medium">التاريخ</th>
                      <th className="px-4 py-3 font-medium">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-card-accent/30 transition-colors">
                        <td className="px-4 py-3 text-foreground font-medium">{r.title}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">{r.category}</Badge>
                        </td>
                        <td className="px-4 py-3 text-green-400 font-bold">{fmt(r.amount)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{METHODS.find(m=>m.v===r.paymentMethod)?.l ?? r.paymentMethod}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{r.date}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={()=>openEdit(r)}><Pencil className="h-3.5 w-3.5"/></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-400" onClick={()=>setDelId(r.id)}><Trash2 className="h-3.5 w-3.5"/></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={open} onOpenChange={v=>!v&&closeDialog()}>
          <DialogContent className="bg-card border-border text-foreground max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>{editing?"تعديل الإيراد":"إضافة إيراد جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label className="text-xs text-muted-foreground">عنوان الإيراد *</Label>
                <Input value={form.title??""} onChange={e=>set("title",e.target.value)} className="bg-background/50 border-border mt-1 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">الفئة</Label>
                  <Select value={form.category??""} onValueChange={v=>set("category",v)}>
                    <SelectTrigger className="bg-background/50 border-border mt-1 text-sm h-9"><SelectValue/></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label className="text-xs text-muted-foreground">المبلغ (ر.س) *</Label>
                  <Input type="number" value={form.amount??""} onChange={e=>set("amount",e.target.value)} className="bg-background/50 border-border mt-1 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
                  <Select value={form.paymentMethod??""} onValueChange={v=>set("paymentMethod",v)}>
                    <SelectTrigger className="bg-background/50 border-border mt-1 text-sm h-9"><SelectValue/></SelectTrigger>
                    <SelectContent>{METHODS.map(m=><SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
                  </Select></div>
                <div><Label className="text-xs text-muted-foreground">التاريخ</Label>
                  <Input type="date" value={form.date??""} onChange={e=>set("date",e.target.value)} className="bg-background/50 border-border mt-1 text-sm" /></div>
              </div>
              <div><Label className="text-xs text-muted-foreground">ملاحظات</Label>
                <Textarea value={form.notes??""} onChange={e=>set("notes",e.target.value)} className="bg-background/50 border-border mt-1 text-sm resize-none" rows={2}/></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={closeDialog}>إلغاء</Button>
              <Button className="bg-primary hover:bg-[#b8943f] text-black font-bold"
                disabled={!form.title||!form.amount||saveMut.isPending}
                onClick={()=>saveMut.mutate(form)}>
                {saveMut.isPending&&<Loader2 className="h-4 w-4 ml-1 animate-spin"/>} حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={!!delId} onOpenChange={v=>!v&&setDelId(null)}>
          <DialogContent className="bg-card border-border text-foreground max-w-sm" dir="rtl">
            <DialogHeader><DialogTitle>تأكيد الحذف</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">هل أنت متأكد من حذف هذا الإيراد؟ لا يمكن التراجع.</p>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={()=>setDelId(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={()=>delMut.mutate(delId!)} disabled={delMut.isPending}>
                {delMut.isPending&&<Loader2 className="h-4 w-4 ml-1 animate-spin"/>} حذف
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}
