import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, flexRender, type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Receipt, Plus, Trash2, Link2, CheckCircle2, Clock, Send,
  XCircle, Loader2, CreditCard, Copy, ExternalLink, FileText,
  AlertCircle, Banknote, TrendingUp, MoreHorizontal, Eye,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  MessageSquare, Printer, Filter, Search, ArrowUpDown,
} from "lucide-react";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") + "/";

/**
 * Robust clipboard copy — works on Chrome, Firefox, Safari, and Mobile iOS.
 * Primary: navigator.clipboard.writeText (requires user gesture + HTTPS/localhost).
 * Fallback: document.execCommand('copy') via a hidden textarea (iOS < 13.4, older Android).
 */
function copyToClipboard(text: string, onSuccess?: () => void): void {
  const succeed = () => {
    toast.success("تم نسخ الرابط ✓");
    onSuccess?.();
  };
  const fail = () => toast.error("تعذّر نسخ الرابط، يرجى نسخه يدوياً");

  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    navigator.clipboard.writeText(text).then(succeed).catch(() => execCommandFallback(text, succeed, fail));
  } else {
    execCommandFallback(text, succeed, fail);
  }
}

function execCommandFallback(text: string, succeed: () => void, fail: () => void): void {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    /* iOS requires setSelectionRange */
    if (typeof ta.setSelectionRange === "function") ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    ok ? succeed() : fail();
  } catch {
    fail();
  }
}

type InvoiceItem = { description: string; quantity: number; unitPrice: number };
type Invoice = {
  id: string; invoiceNumber: string; clientId?: string; caseId?: string;
  title: string; items: string; subtotal: number; vatRate: number;
  vatAmount: number; total: number; currency: string; status: string;
  dueDate?: string; notes?: string; stripePaymentLinkUrl?: string;
  createdAt: string; paidAt?: string;
};
type Client = { id: string; fullName: string; type?: string };

const STATUS_MAP: Record<string, { label: string; cls: string; icon: any }> = {
  draft:    { label: "مسودة",    cls: "bg-gray-500/10 text-gray-400 border-gray-500/20",    icon: FileText },
  sent:     { label: "مُرسَلة",   cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",     icon: Send },
  paid:     { label: "مدفوعة",   cls: "bg-green-500/10 text-green-400 border-green-500/20",  icon: CheckCircle2 },
  overdue:  { label: "متأخرة",   cls: "bg-red-500/10 text-red-400 border-red-500/20",        icon: AlertCircle },
  cancelled:{ label: "ملغاة",    cls: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: XCircle },
};

function fmt(n: number) {
  return (n / 100).toLocaleString("ar-SA", { minimumFractionDigits: 2 });
}
function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.draft;
  const Icon = s.icon;
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${s.cls}`}>
      <Icon className="h-3 w-3" />{s.label}
    </Badge>
  );
}

// ─── Revenue Chart ────────────────────────────────────────────────────────────
function RevenueChart({ invoices }: { invoices: Invoice[] }) {
  const data = useMemo(() => {
    const map: Record<string, { month: string; total: number; paid: number }> = {};
    invoices.forEach(inv => {
      const d = new Date(inv.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("ar-SA", { month: "short", year: "2-digit" });
      if (!map[key]) map[key] = { month: label, total: 0, paid: 0 };
      map[key].total += inv.total / 100;
      if (inv.status === "paid") map[key].paid += inv.total / 100;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v).slice(-6);
  }, [invoices]);

  if (data.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />الإيرادات الشهرية
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip
              contentStyle={{ background: "#0f1b2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
              formatter={(v: any, name: string) => [
                `${Number(v).toLocaleString("ar-SA")} ر.س`,
                name === "paid" ? "محصّل" : "إجمالي"
              ]}
            />
            <Bar dataKey="total" fill="rgba(180,130,60,0.3)" radius={[4, 4, 0, 0]} name="total" />
            <Bar dataKey="paid" fill="#b4823c" radius={[4, 4, 0, 0]} name="paid" />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-[#b4823c] inline-block" />محصّل
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-[rgba(180,130,60,0.3)] inline-block" />إجمالي
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── New Invoice Dialog ───────────────────────────────────────────────────────
function NewInvoiceDialog({ clients, onCreated }: { clients: Client[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(15);
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: 1, unitPrice: 0 }]);

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
      body: JSON.stringify({
        title, items, vatRate, dueDate: dueDate || undefined,
        notes: notes || undefined, clientId: clientId || undefined,
      }),
    }).then(r => r.json()),
    onSuccess: (d) => {
      if (d.error) { toast.error(d.error); return; }
      toast.success("تم إنشاء الفاتورة ✅");
      setOpen(false);
      setTitle(""); setClientId(""); setDueDate(""); setNotes(""); setVatRate(15);
      setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
      onCreated();
    },
    onError: () => toast.error("فشل إنشاء الفاتورة"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-[#b4823c] hover:bg-[#9a6f33] text-white">
          <Plus className="h-4 w-4" />فاتورة جديدة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />إنشاء فاتورة جديدة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>عنوان الفاتورة *</Label>
              <Input placeholder="مثال: أتعاب قضية رقم 2025/123" value={title}
                onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>العميل</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="اختر العميل (اختياري)" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تاريخ الاستحقاق</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>نسبة ضريبة القيمة المضافة</Label>
              <Select value={String(vatRate)} onValueChange={v => setVatRate(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15% — القياسية</SelectItem>
                  <SelectItem value="0">0% — معفى</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>بنود الفاتورة *</Label>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs">
                <Plus className="h-3 w-3" />إضافة بند
              </Button>
            </div>
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
              <span className="text-[#b4823c] font-mono">{fmt(total)} ر.س</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea placeholder="شروط الدفع، تعليمات خاصة..." value={notes}
              onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <Button className="w-full bg-[#b4823c] hover:bg-[#9a6f33] text-white"
            onClick={() => create.mutate()} disabled={!title || create.isPending}>
            {create.isPending
              ? <Loader2 className="h-4 w-4 animate-spin ml-2" />
              : <Receipt className="h-4 w-4 ml-2" />}
            إنشاء الفاتورة
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoice Details Sheet ────────────────────────────────────────────────────
function InvoiceSheet({
  invoice, open, onClose, onRefresh,
}: { invoice: Invoice | null; open: boolean; onClose: () => void; onRefresh: () => void }) {
  const qc = useQueryClient();
  const [loadingLink, setLoadingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const items: InvoiceItem[] = useMemo(() => {
    try { return JSON.parse(invoice?.items || "[]"); } catch { return []; }
  }, [invoice]);

  const generateLink = async () => {
    if (!invoice) return;
    setLoadingLink(true);
    try {
      const r = await fetch(`${BASE}api/invoices/${invoice.id}/payment-link`, { method: "POST" });
      const d = await r.json();
      if (d.error) { toast.error(d.error); }
      else { toast.success(d.existing ? "تم استرجاع رابط الدفع ✅" : "تم إنشاء رابط الدفع ✅"); onRefresh(); onClose(); }
    } catch { toast.error("فشل إنشاء رابط الدفع"); }
    setLoadingLink(false);
  };

  const markPaid = useMutation({
    mutationFn: () => fetch(`${BASE}api/invoices/${invoice!.id}/mark-paid`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => { toast.success("تم تسجيل الدفع ✅"); onRefresh(); onClose(); },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => fetch(`${BASE}api/invoices/${invoice!.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(r => r.json()),
    onSuccess: () => { toast.success("تم تحديث الحالة ✅"); onRefresh(); },
  });

  const copyLink = () => {
    const url = invoice?.stripePaymentLinkUrl;
    if (!url) return;
    copyToClipboard(url, () => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const [waSending, setWaSending] = useState(false);
  const [waPhone, setWaPhone] = useState("");
  const [waDialogOpen, setWaDialogOpen] = useState(false);

  const sendWhatsAppViaApi = async (phone: string) => {
    if (!invoice) return;
    const message = `السلام عليكم،\nيرجى سداد الفاتورة رقم ${invoice.invoiceNumber} بمبلغ ${fmt(invoice.total)} ر.س${invoice.stripePaymentLinkUrl ? `\nرابط الدفع: ${invoice.stripePaymentLinkUrl}` : ""}`;
    setWaSending(true);
    try {
      const r = await fetch(`${BASE}api/whatsapp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, message, template: "invoice" }),
      });
      const d = await r.json();
      if (d.ok) {
        toast.success("تم إرسال إشعار الفاتورة عبر واتساب ✅");
        setWaDialogOpen(false);
        setWaPhone("");
      } else {
        const msg = encodeURIComponent(message);
        window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
        toast.success("تم فتح واتساب لإرسال الفاتورة");
        setWaDialogOpen(false);
      }
    } catch {
      const message2 = `السلام عليكم،\nيرجى سداد الفاتورة رقم ${invoice.invoiceNumber}`;
      const msg = encodeURIComponent(message2);
      window.open(`https://wa.me/?text=${msg}`, "_blank");
    } finally { setWaSending(false); }
  };

  const sendWhatsApp = () => {
    if (!invoice) return;
    setWaDialogOpen(true);
  };

  const printInvoice = () => {
    window.print();
  };

  if (!invoice) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-full sm:w-[560px] overflow-y-auto" dir="rtl">
        <SheetHeader className="pb-4 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-base font-bold">{invoice.invoiceNumber}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{invoice.title}</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>
        </SheetHeader>

        <div className="space-y-5 pt-5">
          {/* Amount */}
          <div className="bg-[#b4823c]/10 border border-[#b4823c]/20 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">المبلغ الإجمالي</p>
            <p className="text-3xl font-bold text-[#b4823c] font-mono">{fmt(invoice.total)}</p>
            <p className="text-sm text-muted-foreground mt-0.5">ريال سعودي</p>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-0.5">تاريخ الإنشاء</p>
              <p className="font-medium">{fmtDate(invoice.createdAt)}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-0.5">تاريخ الاستحقاق</p>
              <p className="font-medium">{fmtDate(invoice.dueDate)}</p>
            </div>
            {invoice.paidAt && (
              <div className="bg-green-500/10 rounded-lg p-3 col-span-2">
                <p className="text-xs text-green-400 mb-0.5">تاريخ السداد</p>
                <p className="font-medium text-green-400">{fmtDate(invoice.paidAt)}</p>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div>
            <p className="text-sm font-semibold mb-2">بنود الفاتورة</p>
            <div className="border border-border/40 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/30">
                    <th className="p-3 text-right text-xs text-muted-foreground">البيان</th>
                    <th className="p-3 text-center text-xs text-muted-foreground w-16">كمية</th>
                    <th className="p-3 text-center text-xs text-muted-foreground w-24">سعر</th>
                    <th className="p-3 text-left text-xs text-muted-foreground w-28">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-border/20">
                      <td className="p-3">{item.description || "—"}</td>
                      <td className="p-3 text-center text-muted-foreground">{item.quantity}</td>
                      <td className="p-3 text-center text-muted-foreground font-mono">{fmt(item.unitPrice)}</td>
                      <td className="p-3 text-left font-mono">{fmt(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/40">
                    <td colSpan={3} className="p-3 text-right text-xs text-muted-foreground">قبل الضريبة</td>
                    <td className="p-3 text-left font-mono text-sm">{fmt(invoice.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="p-3 text-right text-xs text-muted-foreground">ضريبة {invoice.vatRate}%</td>
                    <td className="p-3 text-left font-mono text-sm">{fmt(invoice.vatAmount)}</td>
                  </tr>
                  <tr className="bg-muted/20">
                    <td colSpan={3} className="p-3 text-right font-bold text-sm">الإجمالي</td>
                    <td className="p-3 text-left font-bold font-mono text-sm text-[#b4823c]">{fmt(invoice.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
              <p className="text-sm">{invoice.notes}</p>
            </div>
          )}

          <Separator />

          {/* Payment Link Section */}
          {invoice.stripePaymentLinkUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3">
                <Link2 className="h-4 w-4 text-green-500 shrink-0" />
                <span className="text-xs text-green-400 truncate flex-1 font-mono">
                  {invoice.stripePaymentLinkUrl.replace("https://", "")}
                </span>
                <button onClick={copyLink} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" asChild>
                  <a href={invoice.stripePaymentLinkUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />فتح رابط الدفع
                  </a>
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs text-green-400 border-green-500/30"
                  onClick={copyLink}>
                  <Copy className="h-3.5 w-3.5" />نسخ الرابط
                </Button>
              </div>
            </div>
          ) : (
            invoice.status !== "paid" && invoice.status !== "cancelled" && (
              <Button className="w-full gap-2 bg-[#b4823c] hover:bg-[#9a6f33] text-white"
                onClick={generateLink} disabled={loadingLink}>
                {loadingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {loadingLink ? "جاري إنشاء رابط الدفع..." : "إنشاء رابط دفع Stripe"}
              </Button>
            )
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {invoice.status !== "paid" && (
              <Button size="sm" variant="outline"
                className="gap-1.5 text-xs text-green-400 border-green-500/30 col-span-1"
                onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
                {markPaid.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                مدفوعة
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={sendWhatsApp}>
              <MessageSquare className="h-3.5 w-3.5 text-green-500" />واتساب
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={printInvoice}>
              <Printer className="h-3.5 w-3.5" />طباعة
            </Button>
          </div>

          {/* WhatsApp phone dialog */}
          {waDialogOpen && (
            <div className="border border-green-500/30 bg-green-500/5 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-green-400 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />إرسال الفاتورة عبر واتساب
              </p>
              <div className="flex gap-2">
                <input
                  dir="ltr"
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background placeholder:text-muted-foreground"
                  placeholder="+966501234567 أو 0501234567"
                  value={waPhone}
                  onChange={e => setWaPhone(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && waPhone && sendWhatsAppViaApi(waPhone)}
                />
                <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700 text-white shrink-0"
                  onClick={() => sendWhatsAppViaApi(waPhone)}
                  disabled={!waPhone || waSending}>
                  {waSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  إرسال
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setWaDialogOpen(false); setWaPhone(""); }}>
                  ✕
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">سيتم إرسال تفاصيل الفاتورة ورابط الدفع تلقائياً</p>
            </div>
          )}

          {/* Status Change */}
          {invoice.status !== "paid" && (
            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-2">تغيير الحالة</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(STATUS_MAP).filter(([k]) => k !== invoice.status && k !== "paid").map(([k, v]) => (
                  <Button key={k} size="sm" variant="ghost"
                    className={`text-xs h-7 px-3 ${v.cls} border`}
                    onClick={() => updateStatus.mutate(k)}
                    disabled={updateStatus.isPending}>
                    {v.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Invoices() {
  const qc = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [rowSelection, setRowSelection] = useState({});

  const { data: allInvoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: () => fetch(`${BASE}api/invoices`).then(r => r.json()),
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: () => fetch(`${BASE}api/clients`).then(r => r.json()),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["invoices"] });

  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(inv => {
      const matchSearch = !search ||
        inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
        inv.title?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [allInvoices, search, statusFilter]);

  const stats = useMemo(() => {
    const total = allInvoices.length;
    const paid = allInvoices.filter(i => i.status === "paid");
    const pending = allInvoices.filter(i => ["sent", "draft"].includes(i.status));
    const overdue = allInvoices.filter(i => i.status === "overdue");
    const revenue = paid.reduce((s, i) => s + i.total, 0);
    const outstanding = pending.concat(overdue).reduce((s, i) => s + i.total, 0);
    const rate = total > 0 ? Math.round((paid.length / total) * 100) : 0;
    return { total, paidCount: paid.length, pendingCount: pending.length, overdueCount: overdue.length, revenue, outstanding, rate };
  }, [allInvoices]);

  const deleteInv = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}api/invoices/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => { toast.success("تم حذف الفاتورة"); refresh(); },
    onError: () => toast.error("فشل الحذف"),
  });

  const generateLink = async (invoice: Invoice) => {
    try {
      const r = await fetch(`${BASE}api/invoices/${invoice.id}/payment-link`, { method: "POST" });
      const d = await r.json();
      if (d.error) toast.error(d.error);
      else { toast.success("تم إنشاء رابط الدفع ✅"); refresh(); }
    } catch { toast.error("فشل إنشاء الرابط"); }
  };

  const markPaidDirect = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}api/invoices/${id}/mark-paid`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => { toast.success("تم تسجيل الدفع ✅"); refresh(); },
  });

  const columns: ColumnDef<Invoice>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={v => table.toggleAllPageRowsSelected(!!v)}
          aria-label="تحديد الكل"
          className="translate-y-px"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={v => row.toggleSelected(!!v)}
          aria-label="تحديد"
          className="translate-y-px"
          onClick={e => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "invoiceNumber",
      header: "رقم الفاتورة",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "title",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="gap-1 -mr-3 text-xs h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          العنوان
          {column.getIsSorted() === "asc"
            ? <ChevronUp className="h-3 w-3" />
            : column.getIsSorted() === "desc"
            ? <ChevronDown className="h-3 w-3" />
            : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </Button>
      ),
      cell: ({ getValue }) => (
        <span className="font-medium text-sm max-w-[180px] truncate block">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "total",
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="gap-1 -mr-3 text-xs h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          المبلغ
          {column.getIsSorted() === "asc"
            ? <ChevronUp className="h-3 w-3" />
            : column.getIsSorted() === "desc"
            ? <ChevronDown className="h-3 w-3" />
            : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </Button>
      ),
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-semibold text-[#b4823c]">
          {fmt(getValue() as number)} <span className="text-xs text-muted-foreground">ر.س</span>
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "الحالة",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: "dueDate",
      header: "الاستحقاق",
      cell: ({ getValue }) => {
        const v = getValue() as string | undefined;
        if (!v) return <span className="text-muted-foreground text-xs">—</span>;
        const overdue = new Date(v) < new Date();
        return (
          <span className={`text-xs ${overdue ? "text-red-400" : "text-muted-foreground"}`}>
            {fmtDate(v)}
          </span>
        );
      },
    },
    {
      id: "payment",
      header: "الدفع",
      cell: ({ row }) => {
        const inv = row.original;
        if (inv.stripePaymentLinkUrl)
          return <Badge variant="outline" className="text-xs gap-1 bg-green-500/10 text-green-400 border-green-500/20"><Link2 className="h-3 w-3" />رابط نشط</Badge>;
        if (inv.status === "paid")
          return <Badge variant="outline" className="text-xs gap-1 bg-green-500/10 text-green-400 border-green-500/20"><CheckCircle2 className="h-3 w-3" />مدفوعة</Badge>;
        return <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "تاريخ الإنشاء",
      cell: ({ getValue }) => (
        <span className="text-xs text-muted-foreground">{fmtDate(getValue() as string)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7"
                onClick={e => e.stopPropagation()}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48" dir="rtl">
              <DropdownMenuItem onClick={e => { e.stopPropagation(); setSelectedInvoice(inv); setSheetOpen(true); }}>
                <Eye className="h-4 w-4 ml-2" />عرض التفاصيل
              </DropdownMenuItem>
              {!inv.stripePaymentLinkUrl && inv.status !== "paid" && inv.status !== "cancelled" && (
                <DropdownMenuItem onClick={e => { e.stopPropagation(); generateLink(inv); }}>
                  <CreditCard className="h-4 w-4 ml-2" />إنشاء رابط دفع
                </DropdownMenuItem>
              )}
              {inv.stripePaymentLinkUrl && (
                <DropdownMenuItem onClick={e => { e.stopPropagation(); copyToClipboard(inv.stripePaymentLinkUrl!); }}>
                  <Copy className="h-4 w-4 ml-2" />نسخ رابط الدفع
                </DropdownMenuItem>
              )}
              {inv.status !== "paid" && (
                <DropdownMenuItem onClick={e => { e.stopPropagation(); markPaidDirect.mutate(inv.id); }}>
                  <CheckCircle2 className="h-4 w-4 ml-2 text-green-500" />تسجيل كمدفوعة
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-400 focus:text-red-400"
                onClick={e => { e.stopPropagation(); deleteInv.mutate(inv.id); }}>
                <Trash2 className="h-4 w-4 ml-2" />حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredInvoices,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const selectedCount = Object.keys(rowSelection).length;

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الفواتير</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            إدارة الفواتير والتحصيل عبر Stripe — مدى · Visa · Mastercard · Apple Pay · Google Pay
          </p>
        </div>
        <NewInvoiceDialog clients={clients} onCreated={refresh} />
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "إجمالي الفواتير",     value: stats.total,            icon: Receipt,       color: "text-primary",    bg: "bg-primary/5" },
          { label: "المحصّلة",            value: stats.paidCount,        icon: CheckCircle2,  color: "text-green-400",  bg: "bg-green-500/5" },
          { label: "في الانتظار",         value: stats.pendingCount,     icon: Clock,         color: "text-amber-400",  bg: "bg-amber-500/5" },
          { label: "المتأخرة",            value: stats.overdueCount,     icon: AlertCircle,   color: "text-red-400",    bg: "bg-red-500/5" },
          { label: "معدل التحصيل",        value: `${stats.rate}%`,       icon: TrendingUp,    color: "text-blue-400",   bg: "bg-blue-500/5" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className={`border-0 ${s.bg}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${s.color} shrink-0`} />
                  <div>
                    <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
                    <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Revenue + Outstanding */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <RevenueChart invoices={allInvoices} />
        </div>
        <div className="space-y-3">
          <Card className="border-[#b4823c]/20 bg-[#b4823c]/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-[#b4823c]" />
                <span className="text-xs text-muted-foreground">الإيرادات المحصّلة</span>
              </div>
              <p className="text-2xl font-bold text-[#b4823c] font-mono">{fmt(stats.revenue)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">ريال سعودي</p>
            </CardContent>
          </Card>
          {stats.outstanding > 0 && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="h-4 w-4 text-amber-400" />
                  <span className="text-xs text-muted-foreground">مستحقات غير محصّلة</span>
                </div>
                <p className="text-2xl font-bold text-amber-400 font-mono">{fmt(stats.outstanding)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">ريال سعودي</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث برقم الفاتورة أو العنوان..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCount > 0 && (
          <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 text-sm text-primary">
            <span>{selectedCount} محدد</span>
          </div>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : allInvoices.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-20 gap-3">
            <Receipt className="h-14 w-14 text-muted-foreground/20" />
            <p className="text-muted-foreground">لا توجد فواتير بعد</p>
            <NewInvoiceDialog clients={clients} onCreated={refresh} />
          </CardContent>
        ) : (
          <>
            <Table dir="rtl">
              <TableHeader>
                {table.getHeaderGroups().map(hg => (
                  <TableRow key={hg.id} className="border-border/40 hover:bg-transparent">
                    {hg.headers.map(h => (
                      <TableHead key={h.id} className="text-right text-xs">
                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                      لا توجد نتائج مطابقة
                    </TableCell>
                  </TableRow>
                ) : table.getRowModel().rows.map(row => (
                  <TableRow
                    key={row.id}
                    className="border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => { setSelectedInvoice(row.original); setSheetOpen(true); }}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                {filteredInvoices.length} فاتورة
                {filteredInvoices.length !== allInvoices.length && ` (من ${allInvoices.length})`}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
                </span>
                <Button variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Details Sheet */}
      <InvoiceSheet
        invoice={selectedInvoice}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onRefresh={refresh}
      />
    </div>
  );
}
