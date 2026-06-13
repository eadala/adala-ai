import { useState, useMemo } from "react";
import { useBranding } from "@/hooks/use-branding";
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
  const { data: branding } = useBranding();
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
        toast.error(d.error || "فشل الإرسال — تحقق من إعدادات واتساب");
      }
    } catch {
      toast.error("تعذّر الاتصال بخدمة واتساب");
    } finally { setWaSending(false); }
  };

  const sendWhatsApp = () => {
    if (!invoice) return;
    setWaDialogOpen(true);
  };

  const printInvoice = () => {
    if (!invoice) return;
    const inv = invoice as any;
    const items: any[] = (typeof inv.items === "string" ? JSON.parse(inv.items || "[]") : inv.items) ?? [];
    const subtotal = items.reduce((s: number, it: any) => s + Number(it.total ?? ((it.quantity ?? 1) * (it.unitPrice ?? 0))), 0);
    const vatRate = Number(invoice.vatRate ?? 15);
    const vatAmount = Math.round(subtotal * (vatRate / 100));
    const grandTotal = Number(invoice.total ?? (subtotal + vatAmount));
    const isPaid = invoice.status === "paid";
    const isOverdue = invoice.status === "overdue";
    const issueDate = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    const fmt = (n: number) => (n / 100).toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
    const fmtDateAr = (d: Date) => d.toLocaleDateString("ar-SA-u-nu-latn", { day: "2-digit", month: "long", year: "numeric" });

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>فاتورة ضريبية / Tax Invoice — ${invoice.invoiceNumber ?? ""}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Montserrat:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#1a1a2e;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ═══ WATERMARK ═══ */
.watermark{
  position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);
  font-size:88pt;font-weight:900;letter-spacing:4px;pointer-events:none;z-index:0;
  ${isPaid ? "color:rgba(16,185,129,0.07);content:'PAID'" : isOverdue ? "color:rgba(239,68,68,0.07)" : "color:rgba(201,168,76,0.05)"}
}

/* ═══ WRAPPER ═══ */
.page{
  width:210mm;min-height:297mm;margin:0 auto;position:relative;z-index:1;
  display:flex;flex-direction:column;
}

/* ═══ TOP ACCENT BAR ═══ */
.accent-bar{
  height:6px;
  background:linear-gradient(90deg,#1A2744 0%,#1A2744 40%,#C9A84C 40%,#C9A84C 60%,#1A2744 60%,#1A2744 100%);
}

/* ═══ HEADER ═══ */
.header{
  background:linear-gradient(135deg,#0f1c35 0%,#1A2744 60%,#243560 100%);
  padding:28px 32px 24px;
  display:flex;justify-content:space-between;align-items:flex-start;
  position:relative;overflow:hidden;
}
.header::before{
  content:'';position:absolute;top:-40px;left:-40px;
  width:180px;height:180px;border-radius:50%;
  background:rgba(201,168,76,0.08);
}
.header::after{
  content:'';position:absolute;bottom:-50px;right:10%;
  width:240px;height:240px;border-radius:50%;
  background:rgba(201,168,76,0.05);
}

.brand-block{position:relative;z-index:1}
.brand-ar{font-size:28pt;font-weight:900;color:#fff;line-height:1;letter-spacing:-0.5px}
.brand-ar span{color:#C9A84C}
.brand-en{font-family:'Montserrat',Arial,sans-serif;font-size:10pt;font-weight:600;color:rgba(201,168,76,0.8);letter-spacing:3px;text-transform:uppercase;margin-top:3px}
.brand-tagline{font-size:8pt;color:rgba(255,255,255,0.45);margin-top:5px;font-weight:300}

.inv-badge{
  position:relative;z-index:1;text-align:left;
}
.inv-badge .inv-type-ar{font-size:16pt;font-weight:900;color:#C9A84C;line-height:1.1}
.inv-badge .inv-type-en{font-family:'Montserrat',Arial,sans-serif;font-size:9pt;color:rgba(201,168,76,0.7);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}
.inv-badge .inv-num{
  background:rgba(201,168,76,0.15);border:1px solid rgba(201,168,76,0.4);
  border-radius:6px;padding:6px 12px;display:inline-block;
  font-family:'Montserrat',Arial,sans-serif;font-size:11pt;font-weight:700;
  color:#fff;letter-spacing:1px;
}

/* ═══ STATUS RIBBON ═══ */
.status-ribbon{
  padding:8px 32px;
  display:flex;justify-content:space-between;align-items:center;
  font-family:'Montserrat',Arial,sans-serif;font-size:8.5pt;
  ${isPaid
    ? "background:#f0fdf4;border-bottom:2px solid #86efac;"
    : isOverdue
    ? "background:#fef2f2;border-bottom:2px solid #fca5a5;"
    : "background:#fffbf0;border-bottom:2px solid #C9A84C40;"}
}
.status-ribbon .dates{display:flex;gap:24px;color:#555}
.status-ribbon .dates span{display:flex;align-items:center;gap:6px}
.status-ribbon .dates label{font-weight:700;color:#333}
.status-pill{
  display:flex;align-items:center;gap:7px;
  font-weight:700;font-size:9pt;padding:4px 14px;border-radius:20px;
  ${isPaid
    ? "background:#dcfce7;color:#15803d;border:1.5px solid #86efac;"
    : isOverdue
    ? "background:#fee2e2;color:#b91c1c;border:1.5px solid #fca5a5;"
    : "background:#fff7ed;color:#b45309;border:1.5px solid #fcd34d;"}
}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;
  ${isPaid ? "background:#22c55e" : isOverdue ? "background:#ef4444" : "background:#f59e0b"}
}

/* ═══ BODY ═══ */
.body{padding:22px 32px;flex:1}

/* ═══ PARTIES GRID ═══ */
.parties{display:grid;grid-template-columns:1fr 1px 1fr;gap:0;margin-bottom:20px;
  border:1px solid #e8e8e8;border-radius:10px;overflow:hidden}
.party{padding:16px 20px}
.party:first-child{background:#fafbfd}
.party-divider{background:#e8e8e8}
.party:last-child{background:#fff}
.party-label{
  font-size:7.5pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;
  color:#C9A84C;margin-bottom:8px;display:flex;align-items:center;gap:5px;
}
.party-label .dot{width:5px;height:5px;border-radius:50%;background:#C9A84C}
.party-name{font-size:13pt;font-weight:900;color:#1A2744;margin-bottom:4px}
.party-detail{font-size:9pt;color:#666;line-height:1.7}
.party-detail strong{color:#444}

/* ═══ TABLE ═══ */
.tbl-wrap{border-radius:10px;overflow:hidden;border:1px solid #e8e8e8;margin-bottom:20px}
table{width:100%;border-collapse:collapse}
.tbl-head{background:linear-gradient(90deg,#1A2744,#243560)}
th{
  padding:11px 14px;font-size:9pt;font-weight:700;color:#fff;
  text-align:right;
}
th.en{font-family:'Montserrat',Arial,sans-serif;font-size:7pt;color:rgba(201,168,76,0.8);font-weight:600;display:block;letter-spacing:1px}
td{padding:10px 14px;font-size:10pt;border-bottom:1px solid #f0f0f0;color:#333;text-align:right}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:#f9fafb}
td.idx{width:36px;color:#aaa;font-size:9pt;font-family:'Montserrat',Arial,sans-serif}
td.num{font-family:'Montserrat',Arial,sans-serif;font-weight:600;color:#1A2744}
td.desc-en{font-size:8pt;color:#aaa;font-family:'Montserrat',Arial,sans-serif}
td.service-cell .svc-ar{font-weight:700;color:#1A2744}
td.service-cell .svc-en{font-size:8pt;color:#aaa;font-family:'Montserrat',Arial,sans-serif;margin-top:2px}

/* ═══ BOTTOM ROW ═══ */
.bottom-row{display:grid;grid-template-columns:1fr 280px;gap:20px;margin-bottom:20px}

/* ═══ PAYMENT INFO ═══ */
.payment-box{
  border:1px solid #e8e8e8;border-radius:10px;padding:16px;
  display:flex;flex-direction:column;justify-content:space-between;
}
.payment-box h4{
  font-size:8pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;
  color:#C9A84C;margin-bottom:10px;display:flex;align-items:center;gap:5px;
}
.payment-methods{display:flex;flex-wrap:wrap;gap:6px}
.pm-chip{
  padding:4px 10px;border-radius:20px;font-size:8pt;font-weight:600;
  background:#f4f4f5;color:#555;border:1px solid #e4e4e7;
  font-family:'Montserrat',Arial,sans-serif;
}
.pm-chip.primary{background:#1A2744;color:#C9A84C;border-color:#1A2744}
.due-notice{
  margin-top:10px;padding:7px 10px;border-radius:6px;
  background:#fffbf0;border:1px dashed #C9A84C60;
  font-size:8.5pt;color:#92400e;
}
.due-notice strong{color:#C9A84C}

/* ═══ TOTALS ═══ */
.totals-box{border:1px solid #e8e8e8;border-radius:10px;overflow:hidden}
.tot-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:10px 16px;border-bottom:1px solid #f0f0f0;
  font-size:10pt;
}
.tot-row:last-child{border-bottom:none}
.tot-row .lbl{color:#666}
.tot-row .lbl-en{font-family:'Montserrat',Arial,sans-serif;font-size:7.5pt;color:#aaa;display:block}
.tot-row .val{font-weight:700;color:#1A2744;font-family:'Montserrat',Arial,sans-serif;font-size:11pt}
.tot-row.vat .val{color:#555}
.tot-row.grand{background:linear-gradient(90deg,#1A2744,#243560);padding:14px 16px}
.tot-row.grand .lbl{color:rgba(255,255,255,0.8);font-weight:700;font-size:11pt}
.tot-row.grand .lbl-en{color:rgba(201,168,76,0.7)}
.tot-row.grand .val{color:#C9A84C;font-size:15pt;font-weight:900}
.tot-row.grand .currency{font-size:10pt;font-weight:600;opacity:.8}

/* ═══ NOTES ═══ */
.notes-box{
  border:1px solid #e8e8e8;border-radius:10px;padding:14px 16px;
  margin-bottom:20px;background:#fafbfd;
}
.notes-box h4{font-size:8pt;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:6px}
.notes-box p{font-size:9.5pt;color:#555;line-height:1.7}

/* ═══ SIGNATURE ROW ═══ */
.sig-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px}
.sig-box{border-top:1.5px solid #d0d0d0;padding-top:8px}
.sig-box .sig-label{font-size:8pt;color:#aaa;font-weight:600;letter-spacing:1px}
.sig-box .sig-name{font-size:9.5pt;color:#444;margin-top:16px;font-weight:700}

/* ═══ FOOTER ═══ */
.footer-bar{
  background:linear-gradient(90deg,#0f1c35,#1A2744);
  padding:14px 32px;
  display:flex;justify-content:space-between;align-items:center;
  margin-top:auto;
}
.footer-bar .f-brand{color:#C9A84C;font-weight:900;font-size:10pt}
.footer-bar .f-brand span{color:rgba(255,255,255,0.5);font-weight:400;font-size:8pt}
.footer-bar .f-meta{font-family:'Montserrat',Arial,sans-serif;font-size:7.5pt;color:rgba(255,255,255,0.4);text-align:left;line-height:1.7}

/* ═══ PRINT OVERRIDES ═══ */
@media print{
  body{margin:0}
  .page{width:100%;min-height:100vh}
  .no-print{display:none!important}
}
</style>
</head>
<body>

${isPaid ? `<div class="watermark">PAID ✓</div>` : isOverdue ? `<div class="watermark">OVERDUE</div>` : ""}

<div class="page">

  <!-- TOP ACCENT -->
  <div class="accent-bar"></div>

  <!-- HEADER -->
  <div class="header">
    <div class="brand-block">
      ${branding?.logoUrl ? `<img src="${branding.logoUrl}" alt="شعار المكتب" style="height:54px;width:auto;object-fit:contain;margin-bottom:6px;display:block;filter:brightness(0) invert(1)"/>` : ""}
      <div class="brand-ar">${branding?.officeName ? `${branding.officeName}` : `مكتب <span>المحاماة</span>`}</div>
      ${branding?.officeNameEn ? `<div class="brand-en">${branding.officeNameEn}</div>` : ""}
      ${branding?.tagline ? `<div class="brand-tagline">${branding.tagline}</div>` : (branding?.licenseNo ? `<div class="brand-tagline">رقم الترخيص: ${branding.licenseNo}</div>` : "")}
    </div>
    <div class="inv-badge">
      <div class="inv-type-ar">فاتورة ضريبية</div>
      <div class="inv-type-en">Tax Invoice</div>
      <div class="inv-num">${invoice.invoiceNumber ?? "INV-0000"}</div>
    </div>
  </div>

  <!-- STATUS RIBBON -->
  <div class="status-ribbon">
    <div class="dates">
      <span>
        <label>تاريخ الإصدار:</label>
        ${fmtDateAr(issueDate)} &nbsp;·&nbsp; ${fmtDate(issueDate)}
      </span>
      ${dueDate ? `<span><label>تاريخ الاستحقاق / Due:</label> ${fmtDateAr(dueDate)} &nbsp;·&nbsp; ${fmtDate(dueDate)}</span>` : ""}
    </div>
    <div class="status-pill">
      <div class="status-dot"></div>
      ${isPaid ? "مدفوعة / PAID" : isOverdue ? "متأخرة / OVERDUE" : "قيد الانتظار / PENDING"}
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- PARTIES -->
    <div class="parties">
      <div class="party">
        <div class="party-label"><div class="dot"></div> المُصدِر / ISSUED BY</div>
        <div class="party-name">${branding?.officeName || "مكتب المحاماة"}</div>
        <div class="party-detail">
          ${branding?.officeNameEn ? `${branding.officeNameEn}<br>` : ""}
          ${branding?.address ? `<strong>📍</strong> ${branding.address}<br>` : ""}
          ${branding?.phone ? `<strong>📞</strong> ${branding.phone}<br>` : ""}
          ${branding?.email ? `<strong>✉</strong> ${branding.email}<br>` : ""}
          ${branding?.website ? `<strong>🌐</strong> ${branding.website}<br>` : ""}
          ${branding?.licenseNo ? `<strong>🪪</strong> رقم الترخيص: ${branding.licenseNo}` : ""}
        </div>
      </div>
      <div class="party-divider"></div>
      <div class="party">
        <div class="party-label"><div class="dot"></div> العميل / BILLED TO</div>
        <div class="party-name">${(invoice as any).clientName ?? invoice.title ?? "—"}</div>
        <div class="party-detail">
          ${(invoice as any).clientEmail ? `<strong>✉</strong> ${(invoice as any).clientEmail}<br>` : ""}
          ${(invoice as any).caseTitle ? `<strong>⚖️</strong> القضية: ${(invoice as any).caseTitle}` : ""}
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <div class="tbl-wrap">
      <table>
        <thead class="tbl-head">
          <tr>
            <th style="width:36px">#</th>
            <th>الخدمة / Service <span class="en">DESCRIPTION</span></th>
            <th style="width:70px">الكمية <span class="en">QTY</span></th>
            <th style="width:120px">سعر الوحدة <span class="en">UNIT PRICE</span></th>
            <th style="width:130px">الإجمالي <span class="en">TOTAL</span></th>
          </tr>
        </thead>
        <tbody>
          ${items.length > 0
            ? items.map((it: any, idx: number) => {
                const qty = Number(it.quantity ?? 1);
                const up = Number(it.unitPrice ?? 0);
                const tot = Number(it.total ?? (qty * up));
                return `<tr>
                  <td class="idx">${idx + 1}</td>
                  <td class="service-cell">
                    <div class="svc-ar">${it.description ?? it.name ?? "—"}</div>
                    ${it.nameEn ? `<div class="svc-en">${it.nameEn}</div>` : ""}
                  </td>
                  <td class="num" style="text-align:center">${qty}</td>
                  <td class="num">${fmt(up)} <small style="color:#aaa;font-size:8pt">SAR</small></td>
                  <td class="num">${fmt(tot)} <small style="color:#aaa;font-size:8pt">SAR</small></td>
                </tr>`;
              }).join("")
            : `<tr><td colspan="5" style="text-align:center;padding:24px;color:#bbb;font-size:10pt">${invoice.title ?? "لا توجد بنود"}</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <!-- BOTTOM ROW -->
    <div class="bottom-row">
      <!-- PAYMENT INFO -->
      <div class="payment-box">
        <div>
          <h4>💳 طرق الدفع / Payment Methods</h4>
          <div class="payment-methods">
            <span class="pm-chip primary">تحويل بنكي / Bank Transfer</span>
            <span class="pm-chip">بطاقة ائتمانية / Card</span>
            <span class="pm-chip">رابط دفع / Payment Link</span>
            <span class="pm-chip">مدى / MADA</span>
          </div>
        </div>
        <div class="due-notice">
          ⏰ الدفع مستحق خلال <strong>14 يوماً</strong> من تاريخ الإصدار<br>
          <span style="font-family:'Montserrat',Arial,sans-serif;font-size:7.5pt">Payment due within 14 days of issue</span>
        </div>
      </div>

      <!-- TOTALS -->
      <div class="totals-box">
        <div class="tot-row">
          <span class="lbl">المجموع قبل الضريبة<span class="lbl-en">Subtotal</span></span>
          <span class="val">${fmt(subtotal)} <small class="currency">SAR</small></span>
        </div>
        <div class="tot-row vat">
          <span class="lbl">ضريبة القيمة المضافة (${vatRate}%)<span class="lbl-en">VAT</span></span>
          <span class="val">${fmt(vatAmount)} <small class="currency">SAR</small></span>
        </div>
        <div class="tot-row grand">
          <span class="lbl">الإجمالي النهائي<span class="lbl-en">Grand Total</span></span>
          <span class="val">${fmt(grandTotal)} <small class="currency">SAR</small></span>
        </div>
      </div>
    </div>

    ${invoice.notes ? `
    <div class="notes-box">
      <h4>📋 ملاحظات / Notes</h4>
      <p>${invoice.notes}</p>
    </div>` : ""}

    <!-- SIGNATURES -->
    <div class="sig-row">
      <div class="sig-box">
        ${branding?.signatureUrl ? `<img src="${branding.signatureUrl}" alt="توقيع" style="height:56px;max-width:140px;object-fit:contain;margin-bottom:4px;display:block"/>` : `<div style="height:56px"></div>`}
        <div class="sig-label">توقيع المسؤول / Authorized Signature</div>
        <div class="sig-name">${branding?.officeName || "&nbsp;"}</div>
      </div>
      <div class="sig-box">
        ${branding?.stampUrl ? `<img src="${branding.stampUrl}" alt="ختم" style="height:60px;width:60px;object-fit:contain;margin:0 auto 4px;display:block"/>` : `<div style="height:60px"></div>`}
        <div class="sig-label">ختم المكتب / Office Stamp</div>
        <div class="sig-name">&nbsp;</div>
      </div>
      <div class="sig-box">
        <div style="height:60px"></div>
        <div class="sig-label">توقيع العميل / Client Signature</div>
        <div class="sig-name">&nbsp;</div>
      </div>
    </div>

  </div><!-- /body -->

  <!-- FOOTER -->
  <div class="footer-bar">
    <div class="f-brand">${branding?.officeName || "مكتب المحاماة"} ${branding?.showAdalalahFooter !== false ? `<span>· Adalah AI</span>` : ""}</div>
    <div class="f-meta">
      ${branding?.website ? `${branding.website} &nbsp;·&nbsp; ` : ""}${branding?.phone || ""}${branding?.email ? ` &nbsp;·&nbsp; ${branding.email}` : ""}<br>
      Generated: ${new Date().toLocaleDateString("en-GB")}${branding?.licenseNo ? ` &nbsp;·&nbsp; رخصة: ${branding.licenseNo}` : ""}
    </div>
  </div>

</div><!-- /page -->

<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),600)})</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=1100,scrollbars=yes");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
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
            <DropdownMenuContent align="start" className="w-48">
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
