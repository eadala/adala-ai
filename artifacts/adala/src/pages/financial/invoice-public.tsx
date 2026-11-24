import { useEffect, useState } from "react";
import { Loader2, Printer, CheckCircle2, Clock, XCircle, AlertCircle, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type InvoiceData = {
  id: string; invoice_number: string; title: string;
  client_id?: string; client_name?: string;
  items: string; subtotal: number; vat_rate: number; vat_amount: number; total: number;
  currency: string; status: string; due_date?: string; notes?: string;
  stripe_payment_link_url?: string; created_at: string; paid_at?: string;
  tax_enabled?: boolean;
  office_name?: string; office_phone?: string; office_email?: string;
  office_logo?: string; office_address?: string; office_website?: string;
  office_color?: string;
};

const STATUS: Record<string, { label: string; color: string }> = {
  draft:     { label: "مسودة",       color: "#94a3b8" },
  sent:      { label: "مُرسَلة",     color: "#3b82f6" },
  pending:   { label: "قيد الانتظار", color: "#f59e0b" },
  overdue:   { label: "متأخرة",      color: "#ef4444" },
  paid:      { label: "مدفوعة",      color: "#10b981" },
  cancelled: { label: "ملغاة",       color: "#6b7280" },
};

function fmt(n: number | string) {
  return Number(n).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

export default function InvoicePublic({ token }: { token: string }) {
  const [inv, setInv] = useState<InvoiceData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/invoices/public/${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setInv(d); })
      .catch(() => setError("تعذّر تحميل الفاتورة"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );

  if (error || !inv) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
        <p className="text-lg font-semibold text-gray-700">الفاتورة غير موجودة</p>
        <p className="text-sm text-gray-500">{error || "رابط الفاتورة غير صحيح أو انتهت صلاحيته"}</p>
      </div>
    </div>
  );

  let items: any[] = [];
  try { items = JSON.parse(inv.items || "[]"); } catch {}

  const st = STATUS[inv.status] ?? STATUS.draft;
  const accentColor = inv.office_color ?? "#1A56DB";
  const currency = inv.currency ?? "SAR";

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 py-8 px-4 print:bg-white print:py-0 print:px-0">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg print:shadow-none print:rounded-none overflow-hidden">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: `${accentColor}22` }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {inv.office_logo ? (
                <img src={inv.office_logo} alt={inv.office_name} className="h-14 w-14 object-contain rounded-xl" />
              ) : (
                <div className="h-14 w-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accentColor}15` }}>
                  <Scale className="h-7 w-7" style={{ color: accentColor }} />
                </div>
              )}
              <div>
                <p className="text-xl font-bold text-gray-900">{inv.office_name ?? "مكتب المحاماة"}</p>
                <div className="flex flex-wrap gap-3 mt-1">
                  {inv.office_phone && <span className="text-xs text-gray-500">📞 {inv.office_phone}</span>}
                  {inv.office_email && <span className="text-xs text-gray-500">✉ {inv.office_email}</span>}
                  {inv.office_address && <span className="text-xs text-gray-500">📍 {inv.office_address}</span>}
                </div>
              </div>
            </div>
            <div className="text-left shrink-0">
              <p className="text-xs text-gray-400 font-mono">INVOICE</p>
              <p className="text-2xl font-bold text-gray-900 font-mono">{inv.invoice_number}</p>
              <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: st.color }}>
                {st.label}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Meta */}
        <div className="px-8 py-5 grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50/60 border-b">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">العميل</p>
            <p className="text-sm font-semibold text-gray-800">{inv.client_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">تاريخ الإصدار</p>
            <p className="text-sm font-semibold text-gray-800">{formatDate(inv.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">تاريخ الاستحقاق</p>
            <p className="text-sm font-semibold text-gray-800">{formatDate(inv.due_date)}</p>
          </div>
        </div>

        {/* Title */}
        <div className="px-8 py-4 border-b">
          <p className="text-xs text-gray-400 mb-1">موضوع الفاتورة</p>
          <p className="text-base font-bold text-gray-900">{inv.title}</p>
        </div>

        {/* Items Table */}
        <div className="px-8 py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2" style={{ borderColor: `${accentColor}33` }}>
                <th className="text-right py-2.5 text-xs font-semibold text-gray-500 w-1/2">البيان</th>
                <th className="text-center py-2.5 text-xs font-semibold text-gray-500">الكمية</th>
                <th className="text-left py-2.5 text-xs font-semibold text-gray-500">سعر الوحدة</th>
                <th className="text-left py-2.5 text-xs font-semibold text-gray-500">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-3 text-gray-800 font-medium">{item.description}</td>
                  <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-3 text-left text-gray-600 font-mono">{fmt(item.unitPrice)} {currency}</td>
                  <td className="py-3 text-left font-semibold text-gray-800 font-mono">
                    {fmt((item.quantity ?? 1) * (item.unitPrice ?? 0))} {currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="px-8 pb-6">
          <div className="mr-auto max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>المبلغ قبل الضريبة</span>
              <span className="font-mono font-semibold">{fmt(inv.subtotal)} {currency}</span>
            </div>
            {inv.tax_enabled !== false && Number(inv.vat_rate) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>ضريبة القيمة المضافة ({inv.vat_rate}%)</span>
                <span className="font-mono font-semibold">{fmt(inv.vat_amount)} {currency}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 pt-2 mt-2" style={{ borderColor: accentColor }}>
              <span className="font-bold text-gray-900 text-base">الإجمالي المستحق</span>
              <span className="font-bold text-lg font-mono" style={{ color: accentColor }}>
                {fmt(inv.total)} {currency}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {inv.notes && (
          <div className="px-8 pb-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">ملاحظات</p>
              <p className="text-sm text-amber-800">{inv.notes}</p>
            </div>
          </div>
        )}

        {/* Pay Now */}
        {inv.stripe_payment_link_url && inv.status !== "paid" && inv.status !== "cancelled" && (
          <div className="px-8 pb-6">
            <a
              href={inv.stripe_payment_link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3.5 rounded-xl font-bold text-white text-base transition-opacity hover:opacity-90"
              style={{ backgroundColor: accentColor }}
            >
              💳 ادفع الآن — {fmt(inv.total)} {currency}
            </a>
          </div>
        )}

        {inv.status === "paid" && (
          <div className="px-8 pb-6">
            <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              تم سداد هذه الفاتورة — شكراً لك
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 border-t bg-slate-50/60 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {inv.office_website ?? ""}
          </p>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs print:hidden" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />طباعة
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-6 print:hidden">
        مدعوم بـ عدالة AI — منصة إدارة مكاتب المحاماة
      </p>
    </div>
  );
}
