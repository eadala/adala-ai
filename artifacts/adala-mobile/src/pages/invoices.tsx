import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Search, X, TrendingUp } from "lucide-react";

const API = "/api";
const fetchJson = (path: string) => fetch(`${API}${path}`).then(r => r.json());

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة", sent: "مُرسَلة", paid: "مدفوعة",
  overdue: "متأخرة", cancelled: "ملغاة",
};

const FILTERS = [
  { value: "", label: "الكل" },
  { value: "draft", label: "مسودة" },
  { value: "sent", label: "مُرسَلة" },
  { value: "paid", label: "مدفوعة" },
  { value: "overdue", label: "متأخرة" },
];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function formatCurrency(amount: number | string): string {
  const n = Number(amount);
  if (isNaN(n)) return "—";
  return n.toLocaleString("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " ر.س";
}

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: () => fetchJson(`/invoices${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const list = Array.isArray(invoices) ? invoices : [];

  const filtered = list.filter((inv: any) =>
    !search ||
    inv.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
    inv.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPaid = list
    .filter((i: any) => i.status === "paid")
    .reduce((sum: number, i: any) => sum + Number(i.totalAmount ?? i.amount ?? 0), 0);

  const totalOutstanding = list
    .filter((i: any) => ["sent", "overdue"].includes(i.status))
    .reduce((sum: number, i: any) => sum + Number(i.totalAmount ?? i.amount ?? 0), 0);

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-12 pb-4 safe-top">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">الفواتير</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {filtered.length} فاتورة
          </span>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
            <p className="text-xs text-green-400/80 mb-1">إجمالي المدفوعات</p>
            <p className="text-sm font-bold text-green-300">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
            <p className="text-xs text-orange-400/80 mb-1">المستحقة</p>
            <p className="text-sm font-bold text-orange-300">{formatCurrency(totalOutstanding)}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في الفواتير..."
            className="w-full bg-muted border border-border rounded-xl py-2.5 pr-9 pl-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-border/50">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold tap-effect transition-colors ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt size={48} className="text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">لا توجد فواتير</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              {search ? "جرب كلمة بحث مختلفة" : "لم يتم إنشاء أي فواتير بعد"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((inv: any) => (
              <div key={inv.id} className="bg-card rounded-2xl p-4 border border-border/50 tap-effect">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Receipt size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {inv.invoiceNumber ?? `#${inv.id?.toString().slice(-6)}`}
                      </p>
                      {inv.clientName && (
                        <p className="text-xs text-muted-foreground truncate">{inv.clientName}</p>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium status-${inv.status}`}>
                    {STATUS_LABEL[inv.status] ?? inv.status}
                  </span>
                </div>

                <div className="flex items-center justify-between mr-11">
                  <span className="text-base font-bold text-foreground">
                    {formatCurrency(inv.totalAmount ?? inv.amount ?? 0)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(inv.issueDate ?? inv.createdAt).toLocaleDateString("ar-SA")}
                  </span>
                </div>

                {inv.dueDate && inv.status !== "paid" && inv.status !== "cancelled" && (
                  <div className="mr-11 mt-1">
                    <span className={`text-xs ${
                      new Date(inv.dueDate) < new Date()
                        ? "text-red-400"
                        : "text-muted-foreground"
                    }`}>
                      تاريخ الاستحقاق: {new Date(inv.dueDate).toLocaleDateString("ar-SA")}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
