import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Receipt, Plus, Trash2, Link2, CheckCircle2, Clock, Send,
  XCircle, Eye, Loader2, CreditCard, Copy, ExternalLink,
  FileText, AlertCircle, Banknote, TrendingUp
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

type InvoiceItem = { description: string; quantity: number; unitPrice: number };
type Invoice = {
  id: string; invoiceNumber: string; clientId?: string; caseId?: string;
  title: string; items: string; subtotal: number; vatRate: number;
  vatAmount: number; total: number; currency: string; status: string;
  dueDate?: string; notes?: string; stripePaymentLinkUrl?: string;
  createdAt: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft:    { label: "مسودة",   color: "bg-gray-500/10 text-gray-400 border-gray-500/20",   icon: FileText },
  sent:     { label: "مُرسَلة",  color: "bg-blue-500/10 text-blue-400 border-blue-500/20",    icon: Send },
  paid:     { label: "مدفوعة",  color: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle2 },
  overdue:  { label: "متأخرة",  color: "bg-red-500/10 text-red-400 border-red-500/20",       icon: AlertCircle },
  cancelled:{ label: "ملغاة",   color: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: XCircle },
};

const PAYMENT_METHODS = [
  { icon: "💳", label: "مدى" },
  { icon: "💳", label: "Visa" },
  { icon: "💳", label: "Mastercard" },
  { icon: "🍎", label: "Apple Pay" },
  { icon: "🔵", label: "Google Pay" },
];

function fmt(n: number) {
  return (n / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2 });
}

// ─── New Invoice Dialog ───
function NewInvoiceDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(15);
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0 },
  ]);

  const addItem    = () => setItems(p => [...p, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i));
  const setItem    = (i: number, k: keyof InvoiceItem, v: any) =>
    setItems(p => p.map((item, j) => j === i ? { ...item, [k]: v } : item));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vatAmt   = Math.round(subtotal * vatRate / 100);
  const total    = subtotal + vatAmt;

  const create = useMutation({
    mutationFn: () => fetch(`${BASE}api/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, items, vatRate, dueDate: dueDate || undefined, notes: notes || undefined }),
    }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast.error(d.error); return; }
      toast.success("تم إنشاء الفاتورة ✅");
      setOpen(false);
      setTitle(""); setDueDate(""); setNotes(""); setVatRate(15);
      setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
      onCreated();
    },
    onError: () => toast.error("فشل إنشاء الفاتورة"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" />فاتورة جديدة</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" />إنشاء فاتورة جديدة</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-2">
            <Label>عنوان الفاتورة *</Label>
            <Input placeholder="مثال: أتعاب قضية رقم 2024/123" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>نسبة ضريبة القيمة المضافة</Label>
              <Select value={String(vatRate)} onValueChange={v => setVatRate(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15% (القياسية)</SelectItem>
                  <SelectItem value="0">معفى من الضريبة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تاريخ الاستحقاق</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>بنود الفاتورة *</Label>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs">
                <Plus className="h-3 w-3" />إضافة بند
              </Button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1">
                <span className="col-span-6">البيان</span>
                <span className="col-span-2 text-center">الكمية</span>
                <span className="col-span-3 text-center">السعر (هللة)</span>
                <span className="col-span-1" />
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-6 text-sm" placeholder="وصف الخدمة"
                    value={item.description} onChange={e => setItem(i, "description", e.target.value)} />
                  <Input className="col-span-2 text-sm text-center" type="number" min={1}
                    value={item.quantity} onChange={e => setItem(i, "quantity", Number(e.target.value))} />
                  <Input className="col-span-3 text-sm text-center" type="number" min={0} placeholder="0"
                    value={item.unitPrice || ""} onChange={e => setItem(i, "unitPrice", Number(e.target.value))} />
                  <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8 text-red-400"
                    onClick={() => removeItem(i)} disabled={items.length === 1}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">المجموع قبل الضريبة</span>
              <span className="font-mono">{fmt(subtotal)} ر.س</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ضريبة القيمة المضافة ({vatRate}%)</span>
              <span className="font-mono">{fmt(vatAmt)} ر.س</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>الإجمالي</span>
              <span className="text-primary font-mono">{fmt(total)} ر.س</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea placeholder="شروط الدفع، تعليمات خاصة..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <Button className="w-full" onClick={() => create.mutate()} disabled={!title || create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Receipt className="h-4 w-4 ml-2" />}
            إنشاء الفاتورة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice Card ───
function InvoiceCard({ invoice, onRefresh }: { invoice: Invoice; onRefresh: () => void }) {
  const [loadingLink, setLoadingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const items: InvoiceItem[] = JSON.parse(invoice.items || "[]");
  const st = STATUS_MAP[invoice.status] ?? STATUS_MAP.draft;
  const StatusIcon = st.icon;

  const generateLink = async () => {
    setLoadingLink(true);
    try {
      const r = await fetch(`${BASE}api/invoices/${invoice.id}/payment-link`, { method: "POST" });
      const d = await r.json();
      if (d.error) { toast.error(d.error); return; }
      toast.success(d.existing ? "تم استرجاع رابط الدفع ✅" : "تم إنشاء رابط الدفع ✅");
      onRefresh();
    } catch { toast.error("فشل إنشاء رابط الدفع"); }
    setLoadingLink(false);
  };

  const markPaid = useMutation({
    mutationFn: () => fetch(`${BASE}api/invoices/${invoice.id}/mark-paid`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => { toast.success("تم تسجيل الدفع ✅"); onRefresh(); },
  });

  const copyLink = () => {
    if (!invoice.stripePaymentLinkUrl) return;
    navigator.clipboard.writeText(invoice.stripePaymentLinkUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="hover:border-primary/30 transition-all">
      <CardContent className="pt-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">{invoice.invoiceNumber}</span>
              <Badge variant="outline" className={`text-xs px-2 py-0 ${st.color}`}>
                <StatusIcon className="h-3 w-3 ml-1" />{st.label}
              </Badge>
            </div>
            <p className="font-semibold text-sm leading-tight truncate">{invoice.title}</p>
            {invoice.dueDate && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />الاستحقاق: {invoice.dueDate}
              </p>
            )}
          </div>
          <div className="text-left shrink-0">
            <p className="font-bold text-lg text-primary font-mono">{fmt(invoice.total)}</p>
            <p className="text-xs text-muted-foreground">ر.س</p>
          </div>
        </div>

        {/* Items preview */}
        {items.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 space-y-1">
            {items.slice(0, 3).map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground truncate ml-4">{item.description || "بند"}</span>
                <span className="font-mono shrink-0">{fmt(item.quantity * item.unitPrice)}</span>
              </div>
            ))}
            {items.length > 3 && <p className="text-xs text-muted-foreground">+{items.length - 3} بنود أخرى</p>}
            <Separator className="my-1" />
            <div className="flex justify-between text-xs font-medium">
              <span>ض.ق.م {invoice.vatRate}%</span>
              <span className="font-mono">{fmt(invoice.vatAmount)}</span>
            </div>
          </div>
        )}

        {/* Payment methods hint */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {PAYMENT_METHODS.map(m => (
            <span key={m.label} className="text-xs bg-muted/50 px-2 py-0.5 rounded-full">
              {m.icon} {m.label}
            </span>
          ))}
        </div>

        {/* Payment Link */}
        {invoice.stripePaymentLinkUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
              <Link2 className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-xs text-green-400 truncate flex-1 font-mono">
                {invoice.stripePaymentLinkUrl.replace("https://", "")}
              </span>
              <button onClick={copyLink} className="shrink-0 text-muted-foreground hover:text-foreground">
                {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" asChild>
                <a href={invoice.stripePaymentLinkUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />فتح رابط الدفع
                </a>
              </Button>
              {invoice.status !== "paid" && (
                <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs text-green-500 border-green-500/30"
                  onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
                  <CheckCircle2 className="h-3.5 w-3.5" />تسجيل كمدفوعة
                </Button>
              )}
            </div>
          </div>
        ) : (
          invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <Button className="w-full gap-2 text-sm" variant="outline" onClick={generateLink} disabled={loadingLink}>
              {loadingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {loadingLink ? "جاري إنشاء رابط الدفع..." : "إنشاء رابط دفع إلكتروني"}
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ───
export default function Invoices() {
  const qc = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: () => fetch(`${BASE}api/invoices`).then(r => r.json()),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["invoices"] });

  const stats = {
    total:   invoices.length,
    paid:    invoices.filter(i => i.status === "paid").length,
    pending: invoices.filter(i => ["sent", "draft"].includes(i.status)).length,
    revenue: invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0),
    outstanding: invoices.filter(i => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + i.total, 0),
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">الفواتير</h1>
          <p className="text-muted-foreground mt-1">أنشئ فواتير ووزّع روابط دفع إلكترونية تدعم مدى وفيزا وماستر وApple Pay وGoogle Pay</p>
        </div>
        <NewInvoiceDialog onCreated={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الفواتير", value: stats.total, icon: Receipt, color: "text-primary" },
          { label: "مدفوعة", value: stats.paid, icon: CheckCircle2, color: "text-green-500" },
          { label: "في الانتظار", value: stats.pending, icon: Clock, color: "text-amber-500" },
          { label: "الإيرادات المحصّلة", value: `${fmt(stats.revenue)} ر.س`, icon: TrendingUp, color: "text-blue-400", wide: true },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted/50`}>
                    <Icon className={`h-4 w-4 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`font-bold text-lg font-mono ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Outstanding Banner */}
      {stats.outstanding > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 pt-4">
            <Banknote className="h-6 w-6 text-amber-500 shrink-0" />
            <div>
              <p className="font-semibold text-sm">مستحقات غير محصّلة</p>
              <p className="text-xl font-bold text-amber-500 font-mono">{fmt(stats.outstanding)} ر.س</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Methods Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 flex-wrap">
            <CreditCard className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm font-medium">طرق الدفع المدعومة عبر Stripe:</p>
            {PAYMENT_METHODS.map(m => (
              <Badge key={m.label} variant="outline" className="text-xs gap-1 border-primary/20">
                {m.icon} {m.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : invoices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Receipt className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground">لا توجد فواتير بعد</p>
            <NewInvoiceDialog onCreated={refresh} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {invoices.map(inv => (
            <InvoiceCard key={inv.id} invoice={inv} onRefresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
