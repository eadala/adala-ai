import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Scale, Search, Plus, X, Filter, Briefcase, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const API = "/api";
const fetchJson = (path: string) => fetch(`${API}${path}`).then(r => r.json());

const STATUS_LABEL: Record<string, string> = {
  open: "مفتوحة", in_progress: "قيد التنفيذ", closed: "مغلقة",
};
const CASE_TYPES = [
  { value: "", label: "نوع القضية" },
  { value: "civil", label: "مدني" },
  { value: "criminal", label: "جنائي" },
  { value: "commercial", label: "تجاري" },
  { value: "family", label: "أسري" },
  { value: "administrative", label: "إداري" },
  { value: "labor", label: "عمالي" },
  { value: "other", label: "أخرى" },
];
const CASE_TYPE: Record<string, string> = Object.fromEntries(
  CASE_TYPES.filter(t => t.value).map(t => [t.value, t.label])
);
const FILTERS = [
  { value: "", label: "الكل" },
  { value: "open", label: "مفتوحة" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "closed", label: "مغلقة" },
];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

const EMPTY_FORM = { title: "", clientName: "", caseType: "", description: "" };

export default function Cases() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases", statusFilter],
    queryFn: () => fetchJson(`/cases${statusFilter ? `?status=${statusFilter}` : ""}`),
  });

  const addMutation = useMutation({
    mutationFn: (body: object) =>
      fetch(`${API}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["cases"] });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      toast.success("تم إنشاء القضية بنجاح");
    },
    onError: () => toast.error("حدث خطأ أثناء الإنشاء"),
  });

  const handleAdd = () => {
    if (!form.title.trim()) { toast.error("أدخل عنوان القضية"); return; }
    addMutation.mutate({ ...form, status: "open" });
  };

  const filtered = (Array.isArray(cases) ? cases : []).filter((c: any) =>
    !search ||
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="bg-card border-b border-border px-5 pt-12 pb-4 safe-top">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-foreground">القضايا</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {filtered.length} قضية
            </span>
            <button
              onClick={() => { setShowAdd(v => !v); }}
              className="w-9 h-9 rounded-2xl bg-primary flex items-center justify-center tap-effect"
            >
              {showAdd
                ? <X size={16} className="text-primary-foreground" />
                : <Plus size={16} className="text-primary-foreground" />}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في القضايا..."
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
          <p className="text-sm font-bold text-foreground mb-3">قضية جديدة</p>
          <div className="flex flex-col gap-3">
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="عنوان القضية *"
              className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
            <input
              value={form.clientName}
              onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
              placeholder="اسم الموكل (اختياري)"
              className="w-full bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
            <div className="relative">
              <select
                value={form.caseType}
                onChange={e => setForm(f => ({ ...f, caseType: e.target.value }))}
                className="w-full appearance-none bg-muted border border-border rounded-xl py-2.5 px-4 text-sm text-foreground outline-none focus:border-primary/50"
              >
                {CASE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="وصف القضية (اختياري)"
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
                {addMutation.isPending ? "جاري الإنشاء..." : "إنشاء القضية"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Chips */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-border/50">
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

      {/* Cases List */}
      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase size={48} className="text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground font-medium">لا توجد قضايا</p>
            <p className="text-muted-foreground/60 text-sm mt-1">
              {search ? "جرب كلمة بحث مختلفة" : "اضغط + لإنشاء أول قضية"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((c: any) => (
              <div key={c.id} className="bg-card rounded-2xl p-4 border border-border/50 tap-effect">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Scale size={16} className="text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground leading-snug truncate">{c.title}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium status-${c.status}`}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mr-11 flex-wrap">
                  {c.clientName && (
                    <span className="text-xs text-muted-foreground">👤 {c.clientName}</span>
                  )}
                  {c.caseType && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {CASE_TYPE[c.caseType] ?? c.caseType}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground mr-auto">
                    {new Date(c.createdAt).toLocaleDateString("ar-SA")}
                  </span>
                </div>
                {c.description && (
                  <p className="text-xs text-muted-foreground mt-2 mr-11 line-clamp-2">{c.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
