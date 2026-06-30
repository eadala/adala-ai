import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdaptiveDialog, AdaptiveDialogContent } from "@/components/adaptive";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Wallet, Plus, Loader2, CheckCircle2, Clock, XCircle, RefreshCw, ChevronDown } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function fmt(n: any) { return parseFloat(String(n || 0)).toLocaleString("ar-SA", { maximumFractionDigits: 0 }) + " ر.س"; }
const today = () => new Date().toISOString().split("T")[0];

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending:  { label: "في الانتظار",   color: "border-yellow-500/30 text-yellow-400", icon: Clock },
  approved: { label: "معتمدة",        color: "border-blue-500/30 text-blue-400",    icon: CheckCircle2 },
  active:   { label: "جارية السداد",  color: "border-purple-500/30 text-purple-400",icon: RefreshCw },
  repaid:   { label: "مسددة",         color: "border-green-500/30 text-green-400",  icon: CheckCircle2 },
  rejected: { label: "مرفوضة",        color: "border-red-500/30 text-red-400",      icon: XCircle },
};

interface Advance { id:string; employeeName:string; amount:string; purpose:string; repaymentMonths:number; amountRepaid:string; status:string; date:string; notes:string|null; }
const empty = ():Partial<Advance> => ({ employeeName:"", amount:"", purpose:"", repaymentMonths:1, date:today(), notes:"" });

export default function Advances() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Advance>>(empty());
  const [repayId, setRepayId] = useState<string|null>(null);
  const [repayAmt, setRepayAmt] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: rows = [], isLoading } = useQuery<Advance[]>({
    queryKey: ["accounting-advances"],
    queryFn: () => fetch(`${BASE}/api/accounting/advances`).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => fetch(`${BASE}/api/accounting/advances`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-advances"] }); toast.success("تم إضافة السلفة"); setOpen(false); setForm(empty()); },
    onError: () => toast.error("خطأ في الإضافة"),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/api/accounting/advances/${id}/approve`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvedBy: "المدير" }) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-advances"] }); toast.success("تمت الموافقة"); },
  });

  const repayMut = useMutation({
    mutationFn: ({ id, amount }: { id:string; amount:number }) => fetch(`${BASE}/api/accounting/advances/${id}/repay`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }) }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-advances"] }); toast.success("تم تسجيل السداد"); setRepayId(null); setRepayAmt(""); },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/api/accounting/advances/${id}`, { method: "DELETE" }).then(r => { if (!r.ok) throw new Error("خطأ في الخادم"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounting-advances"] }); toast.success("تم الحذف"); },
  });

  function set(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  const filtered = rows.filter(r => filterStatus === "all" || r.status === filterStatus);
  const totalAdvances = rows.reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0);
  const totalRepaid = rows.reduce((s, r) => s + parseFloat(String(r.amountRepaid || 0)), 0);
  const outstanding = totalAdvances - totalRepaid;

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><Wallet className="h-5 w-5 text-purple-400" /></div>
            <div><h1 className="text-xl font-bold text-foreground">العهد والسلف</h1><p className="text-xs text-muted-foreground">إدارة السلف والقروض للموظفين</p></div>
          </div>
          <Button onClick={() => { setForm(empty()); setOpen(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"><Plus className="h-4 w-4" />سلفة جديدة</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">إجمالي السلف</p><p className="text-xl font-bold text-foreground">{fmt(totalAdvances)}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">المسدد</p><p className="text-xl font-bold text-green-400">{fmt(totalRepaid)}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">القائم</p><p className="text-xl font-bold text-primary">{fmt(outstanding)}</p></CardContent></Card>
          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground mb-1">عدد السلف</p><p className="text-2xl font-bold text-foreground">{rows.length}</p></CardContent></Card>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-2">
          {[{ v:"all",l:"الكل"},...Object.entries(STATUS_MAP).map(([v,c])=>({v,l:c.label}))].map(s=>(
            <button key={s.v} onClick={()=>setFilterStatus(s.v)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus===s.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {s.l}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin ms-2" />جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-muted-foreground"><Wallet className="h-10 w-10 mb-2 opacity-20" /><p className="text-sm">لا توجد سلف</p></div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => {
              const st = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
              const StIcon = st.icon;
              const pct = parseFloat(String(r.amount||0)) > 0 ? (parseFloat(String(r.amountRepaid||0)) / parseFloat(String(r.amount))) * 100 : 0;
              return (
                <Card key={r.id} className="bg-card border-border hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-foreground">{r.employeeName}</p>
                          <Badge variant="outline" className={`text-[10px] ${st.color}`}>
                            <StIcon className="h-2.5 w-2.5 ms-1" />{st.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.purpose} · {r.date}</p>
                        {(r.status === "active" || r.status === "approved") && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>السداد: {fmt(r.amountRepaid)} من {fmt(r.amount)}</span>
                              <span>{pct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 bg-card-border rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-lg font-bold text-primary">{fmt(r.amount)}</p>
                        <div className="flex gap-1">
                          {r.status === "pending" && (
                            <Button size="sm" variant="outline" className="text-xs border-green-500/30 text-green-400 hover:bg-green-500/10"
                              onClick={() => approveMut.mutate(r.id)} disabled={approveMut.isPending}>موافقة</Button>
                          )}
                          {(r.status === "approved" || r.status === "active") && (
                            <Button size="sm" variant="outline" className="text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              onClick={() => { setRepayId(r.id); setRepayAmt(""); }}>سداد</Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-400" disabled={delMut.isPending} onClick={() => delMut.mutate(r.id)}><Loader2 className={`h-3.5 w-3.5 ${delMut.isPending ? "animate-spin" : "hidden"}`} /><XCircle className={`h-3.5 w-3.5 ${delMut.isPending ? "hidden" : ""}`} /></Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create dialog */}
        <AdaptiveDialog open={open} onOpenChange={v => !v && setOpen(false)}>
          <AdaptiveDialogContent className="bg-card border-border text-foreground max-w-md" dir="rtl">
            <DialogHeader><DialogTitle>سلفة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label className="text-xs text-muted-foreground">اسم الموظف *</Label><Input value={form.employeeName??""} onChange={e=>set("employeeName",e.target.value)} className="bg-background/50 border-border mt-1 text-sm"/></div>
              <div className="grid grid-cols-2 gap-3 mobile-single-col">
                <div><Label className="text-xs text-muted-foreground">المبلغ (ر.س) *</Label><Input type="number" min="0" value={form.amount??""} onChange={e=>set("amount",e.target.value)} className="bg-background/50 border-border mt-1 text-sm"/></div>
                <div><Label className="text-xs text-muted-foreground">أقساط السداد (شهر)</Label><Input type="number" value={form.repaymentMonths??1} onChange={e=>set("repaymentMonths",parseInt(e.target.value))} className="bg-background/50 border-border mt-1 text-sm"/></div>
              </div>
              <div><Label className="text-xs text-muted-foreground">الغرض من السلفة *</Label><Input value={form.purpose??""} onChange={e=>set("purpose",e.target.value)} className="bg-background/50 border-border mt-1 text-sm"/></div>
              <div><Label className="text-xs text-muted-foreground">التاريخ</Label><Input type="date" value={form.date??""} onChange={e=>set("date",e.target.value)} className="bg-background/50 border-border mt-1 text-sm"/></div>
              <div><Label className="text-xs text-muted-foreground">ملاحظات</Label><Textarea value={form.notes??""} onChange={e=>set("notes",e.target.value)} className="bg-background/50 border-border mt-1 text-sm resize-none" rows={2}/></div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={()=>setOpen(false)}>إلغاء</Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold" disabled={!form.employeeName||!form.amount||!form.purpose||createMut.isPending} onClick={()=>createMut.mutate(form)}>
                {createMut.isPending&&<Loader2 className="h-4 w-4 ms-1 animate-spin"/>}حفظ
              </Button>
            </DialogFooter>
          </AdaptiveDialogContent>
        </AdaptiveDialog>

        {/* Repay dialog */}
        <AdaptiveDialog open={!!repayId} onOpenChange={v=>!v&&setRepayId(null)}>
          <AdaptiveDialogContent className="bg-card border-border text-foreground max-w-sm" dir="rtl">
            <DialogHeader><DialogTitle>تسجيل دفعة سداد</DialogTitle></DialogHeader>
            <div className="py-2">
              <Label className="text-xs text-muted-foreground">مبلغ الدفعة (ر.س)</Label>
              <Input type="number" value={repayAmt} onChange={e=>setRepayAmt(e.target.value)} className="bg-background/50 border-border mt-1" />
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={()=>setRepayId(null)}>إلغاء</Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold" disabled={!repayAmt||repayMut.isPending}
                onClick={()=>repayMut.mutate({id:repayId!,amount:parseFloat(repayAmt)})}>
                {repayMut.isPending&&<Loader2 className="h-4 w-4 ms-1 animate-spin"/>}تسجيل
              </Button>
            </DialogFooter>
          </AdaptiveDialogContent>
        </AdaptiveDialog>
    </div>
  );
}
