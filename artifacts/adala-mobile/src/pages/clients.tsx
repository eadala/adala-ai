import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, X, Phone, Mail, Plus, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const API = "/api";
const fetchJson = (path: string) => fetch(`${API}${path}`).then(r => r.json());

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function getInitials(name: string): string {
  if (!name) return "؟";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[parts.length - 1][0];
  return parts[0].slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-300",
  "bg-green-500/20 text-green-300",
  "bg-purple-500/20 text-purple-300",
  "bg-orange-500/20 text-orange-300",
  "bg-pink-500/20 text-pink-300",
  "bg-teal-500/20 text-teal-300",
];

const EMPTY_FORM = { fullName: "", type: "individual", phone: "", email: "", notes: "" };

export default function Clients() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchJson("/clients"),
  });

  const addMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${API}/clients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["clients"] });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      toast.success("تم إضافة العميل بنجاح");
    },
    onError: () => toast.error("حدث خطأ أثناء الإضافة"),
  });

  const handleAdd = () => {
    if (!form.fullName.trim()) { toast.error("أدخل اسم العميل"); return; }
    addMutation.mutate(form);
  };

  const filtered = (Array.isArray(clients) ? clients : []).filter((c: any) =>
    !search ||
    c.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const TYPES = [
    { value: "", label: "الكل" },
    { value: "individual", label: "أفراد" },
    { value: "company", label: "شركات" },
  ];

  const byType = typeFilter
    ? filtered.filter((c: any) => (c.clientType ?? c.type) === typeFilter)
    : filtered;

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-12 pb-4 safe-top">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">العملاء</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {byType.length} عميل
            </span>
            <button
              onClick={() => setShowAdd(v => !v)}
              className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center tap-effect"
            >
              {showAdd
                ? <X size={16} className="text-primary-foreground" />
                : <Plus size={16} className="text-primary-foreground" />}
            </button>
          </div>
        </div>
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في العملاء..."
            className="w-full bg-muted border border-border rounded-xl py-2.5 pr-9 pl-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2">
              <X size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Add Form (collapsible) */}
      {showAdd && (
        <div className="px-4 py-4 border-b border-border bg-card/50">
          <p className="text-sm font-bold text-foreground mb-3">عميل جديد</p>
          <div className="flex flex-col gap-3">
            <input
              value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
              placeholder="الاسم الكامل *"
              className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />

            {/* Type toggle */}
            <div className="flex gap-2">
              {[
                { value: "individual", label: "👤 فرد" },
                { value: "company",    label: "🏢 شركة" },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium tap-effect transition-colors border ${
                    form.type === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="رقم الهاتف"
                type="tel"
                className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
              <input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="البريد الإلكتروني"
                type="email"
                className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
            </div>

            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="ملاحظات (اختياري)"
              rows={2}
              className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none"
            />

            <div className="flex gap-2">
              <button
                onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }}
                className="flex-1 border border-border text-muted-foreground rounded-xl py-2.5 text-sm font-medium tap-effect"
              >
                إلغاء
              </button>
              <button
                onClick={handleAdd}
                disabled={addMutation.isPending}
                className="flex-[2] bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold tap-effect disabled:opacity-60"
              >
                {addMutation.isPending ? "جاري الإضافة..." : "إضافة العميل"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Chips */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-border/50">
        {TYPES.map(t => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold tap-effect transition-colors ${
              typeFilter === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Clients List */}
      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : byType.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users size={48} className="text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">لا توجد عملاء</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              {search ? "جرب كلمة بحث مختلفة" : "اضغط + لإضافة أول عميل"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {byType.map((client: any, idx: number) => {
              const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const initials = getInitials(client.fullName ?? "");
              const clientType = client.clientType ?? client.type;
              return (
                <div key={client.id} className="bg-card rounded-2xl p-4 border border-border/50 tap-effect">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-sm font-bold ${colorClass}`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {client.fullName ?? "—"}
                        </p>
                        {clientType && (
                          <span className="shrink-0 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                            {clientType === "company" ? "🏢 شركة" : "👤 فرد"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 mt-1.5">
                        {client.email && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Mail size={11} className="shrink-0" />
                            {client.email}
                          </span>
                        )}
                        {client.phone && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone size={11} className="shrink-0" />
                            {client.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {(client.caseCount !== undefined) && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">
                        📂 {client.caseCount ?? 0} قضية
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
